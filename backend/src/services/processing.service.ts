import { TransactionStatus, Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { getTransactionById, updateTransaction } from './transaction.service.js';
import { matchProducts, formatMatchingResultForStorage } from './matching.service.js';
import { calculatePoints } from './points.service.js';
import { addPointsWithRetry, sendNotificationWithRetry, fetchCerthisPoints } from './snapss.service.js';
import { updateUserCurrentPoints } from './user.service.js';
import { getNotificationMessage } from './settings.service.js';
import prisma from '../utils/prisma.js';
import { TicketProduct } from '../validators/webhook.validator.js';
import { parseTicketProducts } from './ticket-parser.service.js';

export interface ProcessingResult {
  success: boolean;
  transactionId: number;
  matchedProducts: number;
  unmatchedProducts: number;
  eligibleAmount: number;
  pointsCalculated: number;
  notificationSent: boolean;
  error?: string;
  duration: number;
}

/**
 * Process a transaction asynchronously
 * - Match products against catalog
 * - Calculate points
 * - Send notification to Snapss
 * - Update transaction status
 */
export const processTransaction = async (
  transactionId: number
): Promise<ProcessingResult> => {
  const startTime = Date.now();

  logger.info('Starting transaction processing', { transactionId });

  try {
    // Get transaction
    const transaction = await getTransactionById(transactionId);

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      logger.warn('Transaction already processed', {
        transactionId,
        status: transaction.status,
      });

      return {
        success: false,
        transactionId,
        matchedProducts: 0,
        unmatchedProducts: 0,
        eligibleAmount: 0,
        pointsCalculated: 0,
        notificationSent: false,
        error: `Transaction already processed with status: ${transaction.status}`,
        duration: Date.now() - startTime,
      };
    }

    // Parse and correct ticket products (merge multi-line names, remove 100% discounts)
    const rawProducts = transaction.ticketProducts as TicketProduct[];
    const expectedTotal = Number(transaction.totalAmount) || 0;
    const ticketProducts = parseTicketProducts(rawProducts, expectedTotal);

    // Step 1: Match products
    logger.info('Matching products', { transactionId });
    const matchingResult = await matchProducts(ticketProducts);
    const matchedProductsData = formatMatchingResultForStorage(matchingResult);

    // Step 2: Calculate points
    logger.info('Calculating points', {
      transactionId,
      eligibleAmount: matchingResult.eligibleAmount,
    });
    const pointsResult = await calculatePoints(matchingResult.eligibleAmount);

    // Step 3: Update transaction with matching and points data
    await updateTransaction(transactionId, {
      matchedProducts: matchedProductsData as Prisma.InputJsonValue,
      eligibleAmount: new Prisma.Decimal(matchingResult.eligibleAmount),
      pointsCalculated: pointsResult.roundedPoints,
    });

    // Step 4: Send points and notification to Certhis (if points > 0)
    let notificationSent = false;
    let snapssResponse: Prisma.InputJsonValue | undefined = undefined;

    if (pointsResult.roundedPoints > 0) {
      // Get user's tokenId to fetch current points from Certhis
      const user = await prisma.user.findUnique({
        where: { email: transaction.userEmail.toLowerCase() },
        select: { tokenId: true },
      });

      if (!user?.tokenId) {
        logger.error('User tokenId not found, cannot update points', {
          transactionId,
          userEmail: transaction.userEmail,
        });
      } else {
        // Fetch current points from Certhis (source of truth)
        const currentCerthisPoints = await fetchCerthisPoints(user.tokenId);
        const newTotalPoints = currentCerthisPoints + pointsResult.roundedPoints;

        logger.info('Sending points to Certhis with retry', {
          transactionId,
          currentCerthisPoints,
          pointsEarned: pointsResult.roundedPoints,
          newTotalPoints,
        });

        // Set new total points with retry (Certhis expects the total, not delta)
        const pointsAddResult = await addPointsWithRetry(
          transaction.userEmail,
          newTotalPoints
        );

        if (pointsAddResult.success) {
          // Update user's currentPoints in database
          await updateUserCurrentPoints(transaction.userEmail, newTotalPoints);

          // Send notification with retry (using template from settings)
          const notificationMessage = await getNotificationMessage(pointsResult.roundedPoints);
          const notificationResult = await sendNotificationWithRetry(
            transaction.userEmail,
            notificationMessage
          );

          notificationSent = notificationResult.success;
          snapssResponse = {
            pointsResult: pointsAddResult,
            notificationResult: notificationResult,
          } as unknown as Prisma.InputJsonValue;

          if (!notificationResult.success) {
            logger.warn('Certhis notification failed after retries', {
              transactionId,
              error: notificationResult.error,
            });
          }
        } else {
          logger.error('Certhis add_points failed after retries', {
            transactionId,
            error: pointsAddResult.error,
          });
          snapssResponse = pointsAddResult as unknown as Prisma.InputJsonValue;
        }
      }
    } else {
      logger.info('No points to award, skipping notification', { transactionId });
    }

    // Step 5: Update final transaction status
    const finalStatus =
      matchingResult.totalMatched > 0
        ? TransactionStatus.SUCCESS
        : TransactionStatus.PARTIAL;

    await updateTransaction(transactionId, {
      status: finalStatus,
      pointsAwarded: notificationSent,
      notificationSent,
      snapssResponse,
      processedAt: new Date(),
    });

    const duration = Date.now() - startTime;

    logger.info('Transaction processing completed', {
      transactionId,
      status: finalStatus,
      matchedProducts: matchingResult.totalMatched,
      points: pointsResult.roundedPoints,
      notificationSent,
      duration: `${duration}ms`,
    });

    return {
      success: true,
      transactionId,
      matchedProducts: matchingResult.totalMatched,
      unmatchedProducts: matchingResult.totalUnmatched,
      eligibleAmount: matchingResult.eligibleAmount,
      pointsCalculated: pointsResult.roundedPoints,
      notificationSent,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Transaction processing failed', {
      transactionId,
      error: errorMessage,
      duration: `${duration}ms`,
    });

    // Update transaction with error status
    try {
      await updateTransaction(transactionId, {
        status: TransactionStatus.FAILED,
        errorMessage,
        processedAt: new Date(),
      });
    } catch (updateError) {
      logger.error('Failed to update transaction status', {
        transactionId,
        error: updateError instanceof Error ? updateError.message : 'Unknown',
      });
    }

    return {
      success: false,
      transactionId,
      matchedProducts: 0,
      unmatchedProducts: 0,
      eligibleAmount: 0,
      pointsCalculated: 0,
      notificationSent: false,
      error: errorMessage,
      duration,
    };
  }
};

/**
 * Process transaction asynchronously (fire and forget)
 * Used by webhook to avoid blocking the response
 */
export const processTransactionAsync = (transactionId: number): void => {
  // Use setImmediate to defer processing to next event loop tick
  setImmediate(async () => {
    try {
      await processTransaction(transactionId);
    } catch (error) {
      logger.error('Async transaction processing failed', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
};
