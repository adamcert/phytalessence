import { Transaction, TransactionStatus, Prisma } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { SnapssWebhookPayload } from '../validators/webhook.validator.js';
import { ForceMatchInput } from '../validators/transaction.validator.js';
import { calculatePoints } from './points.service.js';
import { fetchCerthisPoints, addPointsWithRetry } from './snapss.service.js';

export interface CreateTransactionInput {
  ticketId: string;
  userEmail: string;
  userName: string | null;
  userPhone: string | null;
  totalAmount: number;
  ticketProducts: unknown;
}

export const createTransaction = async (
  payload: SnapssWebhookPayload
): Promise<Transaction> => {
  const { wallet_object, ticket_data, ticket_image, nft_object } = payload;

  // Build user name from first and last name
  const userName = [wallet_object.first_name, wallet_object.last_name]
    .filter(Boolean)
    .join(' ') || null;

  // Get ticket image base64 if available
  const ticketImageBase64 = ticket_image?.base64 || null;

  // Get NFT ID from payload (used for Certhis API)
  // nft_object.nft_id is the actual token ID for Certhis API, not nft_object.id
  const nftId = (nft_object as any)?.nft_id?.toString() || nft_object?.id?.toString() || null;

  logger.info('Creating transaction', {
    ticketId: ticket_data.ticket_id,
    userEmail: wallet_object.email,
    totalAmount: ticket_data.total_amount,
    productsCount: ticket_data.products.length,
    hasImage: !!ticketImageBase64,
    nftId,
  });

  // Create or update user record with their NFT ID and Token ID
  const userEmail = wallet_object.email.toLowerCase();
  await prisma.user.upsert({
    where: { email: userEmail },
    create: {
      email: userEmail,
      nftId,
      tokenId: nftId, // tokenId is same as nftId for Certhis API
      firstName: wallet_object.first_name || null,
      lastName: wallet_object.last_name || null,
      phone: wallet_object.phone || null,
    },
    update: {
      // Only update nftId/tokenId if it's not already set or if we have a new value
      ...(nftId && { nftId, tokenId: nftId }),
      // Update name/phone if provided
      ...(wallet_object.first_name && { firstName: wallet_object.first_name }),
      ...(wallet_object.last_name && { lastName: wallet_object.last_name }),
      ...(wallet_object.phone && { phone: wallet_object.phone }),
    },
  });

  const transaction = await prisma.transaction.create({
    data: {
      ticketId: ticket_data.ticket_id,
      userEmail,
      userName,
      userPhone: wallet_object.phone || null,
      totalAmount: new Prisma.Decimal(ticket_data.total_amount),
      ticketProducts: ticket_data.products as Prisma.InputJsonValue,
      ticketImageBase64,
      status: TransactionStatus.PENDING,
    },
  });

  logger.info('Transaction created', {
    transactionId: transaction.id,
    ticketId: transaction.ticketId,
    userNftId: nftId,
  });

  return transaction;
};

export const getTransactionById = async (id: number): Promise<Transaction | null> => {
  return prisma.transaction.findUnique({
    where: { id },
  });
};

export const getTransactionByTicketId = async (ticketId: string): Promise<Transaction | null> => {
  return prisma.transaction.findUnique({
    where: { ticketId },
  });
};

export const updateTransaction = async (
  id: number,
  data: Prisma.TransactionUpdateInput
): Promise<Transaction> => {
  return prisma.transaction.update({
    where: { id },
    data,
  });
};

export const updateTransactionStatus = async (
  id: number,
  status: TransactionStatus,
  errorMessage?: string
): Promise<Transaction> => {
  return prisma.transaction.update({
    where: { id },
    data: {
      status,
      errorMessage: errorMessage || null,
      processedAt: status !== TransactionStatus.PENDING ? new Date() : null,
    },
  });
};

export const deleteTransaction = async (id: number): Promise<void> => {
  logger.info('Deleting transaction', { id });
  await prisma.transaction.delete({
    where: { id },
  });
};

/**
 * Force match a product in a transaction
 * Updates the product as matched, recalculates points, and sends to Certhis
 */
export const forceMatchProduct = async (
  transactionId: number,
  input: ForceMatchInput,
  adminEmail: string
): Promise<Transaction> => {
  const { productIndex, catalogProductId, note } = input;

  // Get the transaction
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction) {
    throw new Error('Transaction non trouvée');
  }

  // Get the catalog product
  const catalogProduct = await prisma.product.findUnique({
    where: { id: catalogProductId },
  });

  if (!catalogProduct) {
    throw new Error('Produit catalogue non trouvé');
  }

  // Parse matchedProducts
  const matchedProducts = (transaction.matchedProducts as any[]) || [];

  if (productIndex < 0 || productIndex >= matchedProducts.length) {
    throw new Error('Index produit invalide');
  }

  const product = matchedProducts[productIndex];

  if (product.matched && !product.forced) {
    throw new Error('Ce produit est déjà validé');
  }

  // Calculate the additional eligible amount
  const additionalAmount = product.ticketProduct.price * product.ticketProduct.quantity;

  // Update the product in the array
  matchedProducts[productIndex] = {
    ...product,
    matched: true,
    matchedProductId: catalogProduct.id,
    matchedProductName: catalogProduct.name,
    eligibleAmount: additionalAmount,
    matchMethod: 'forced',
    forced: true,
    forcedNote: note,
    forcedBy: adminEmail,
    forcedAt: new Date().toISOString(),
  };

  // Recalculate total eligible amount
  const newEligibleAmount = matchedProducts.reduce(
    (sum, p) => sum + (p.matched ? p.eligibleAmount : 0),
    0
  );

  // Calculate new points
  const pointsResult = await calculatePoints(newEligibleAmount);
  const newPoints = pointsResult.roundedPoints;

  // Calculate the delta (additional points to add)
  const previousPoints = transaction.pointsCalculated || 0;
  const pointsDelta = newPoints - previousPoints;

  logger.info('Force matching product', {
    transactionId,
    productIndex,
    catalogProductId,
    catalogProductName: catalogProduct.name,
    additionalAmount,
    newEligibleAmount,
    previousPoints,
    newPoints,
    pointsDelta,
    adminEmail,
  });

  // Update transaction in database
  const updatedTransaction = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      matchedProducts: matchedProducts as Prisma.InputJsonValue,
      eligibleAmount: new Prisma.Decimal(newEligibleAmount),
      pointsCalculated: newPoints,
    },
  });

  // If there are additional points to add, send to Certhis
  if (pointsDelta > 0) {
    // Get user's current points from Certhis (source of truth)
    const user = await prisma.user.findUnique({
      where: { email: transaction.userEmail.toLowerCase() },
    });

    if (user?.tokenId) {
      const currentCerthisPoints = await fetchCerthisPoints(user.tokenId);
      const newTotalPoints = currentCerthisPoints + pointsDelta;

      logger.info('Sending forced points to Certhis', {
        transactionId,
        userEmail: transaction.userEmail,
        currentCerthisPoints,
        pointsDelta,
        newTotalPoints,
      });

      const result = await addPointsWithRetry(transaction.userEmail, newTotalPoints);

      if (result.success) {
        // Update local cache
        await prisma.user.update({
          where: { email: transaction.userEmail.toLowerCase() },
          data: { currentPoints: newTotalPoints },
        });

        logger.info('Forced points sent successfully', {
          transactionId,
          newTotalPoints,
        });
      } else {
        logger.error('Failed to send forced points to Certhis', {
          transactionId,
          error: result.error,
        });
      }
    } else {
      logger.warn('User has no tokenId, cannot send points to Certhis', {
        transactionId,
        userEmail: transaction.userEmail,
      });
    }
  }

  return updatedTransaction;
};
