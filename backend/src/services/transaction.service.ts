import { Transaction, TransactionStatus, Prisma } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { SnapssWebhookPayload } from '../validators/webhook.validator.js';

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
  const nftId = nft_object?.id?.toString() || null;

  logger.info('Creating transaction', {
    ticketId: ticket_data.ticket_id,
    userEmail: wallet_object.email,
    totalAmount: ticket_data.total_amount,
    productsCount: ticket_data.products.length,
    hasImage: !!ticketImageBase64,
    nftId,
  });

  // Create or update user record with their NFT ID
  const userEmail = wallet_object.email.toLowerCase();
  await prisma.user.upsert({
    where: { email: userEmail },
    create: {
      email: userEmail,
      nftId,
      firstName: wallet_object.first_name || null,
      lastName: wallet_object.last_name || null,
      phone: wallet_object.phone || null,
    },
    update: {
      // Only update nftId if it's not already set or if we have a new value
      ...(nftId && { nftId }),
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
