import { TransactionStatus, Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { getTransactionById, updateTransaction } from './transaction.service.js';
import { matchProducts, formatMatchingResultForStorage } from './matching.service.js';
import { calculatePoints } from './points.service.js';
import { addPointsWithRetry, sendNotificationWithRetry, fetchCerthisPoints } from './snapss.service.js';
import { updateUserCurrentPoints } from './user.service.js';
import { getNotificationMessage } from './settings.service.js';
import prisma from '../utils/prisma.js';
import { TicketProduct, MatchedProductV2 } from '../validators/webhook.validator.js';
import { parseTicketProducts, parseNewFormatProducts } from './ticket-parser.service.js';
import { analyzeTicketWithClaude } from './claude-vision.service.js';
import { config } from '../config/index.js';

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

    // Parse products - detect format and normalize
    const rawProducts = transaction.ticketProducts as any[];
    const expectedTotal = Number(transaction.totalAmount) || 0;

    // Detect new format: products have _source tag or matched_name/unit_price fields
    const isV2 = rawProducts.length > 0 && ('_source' in rawProducts[0] || 'unit_price' in rawProducts[0] || 'matched_name' in rawProducts[0]);

    const ticketProducts = isV2
      ? parseNewFormatProducts(rawProducts)
      : parseTicketProducts(rawProducts as TicketProduct[], expectedTotal);

    logger.info('Products parsed', {
      transactionId,
      format: isV2 ? 'v2' : 'legacy',
      productCount: ticketProducts.length,
    });

    // Step 1: Match products — try Claude Vision first, fallback to Levenshtein
    let matchedProductsData: object[];
    let eligibleAmount: number;
    let totalMatched: number;
    let totalUnmatched: number;
    let usedClaude = false;

    if (transaction.ticketImageBase64 && config.claude.apiKey) {
      // Use Claude Vision for matching
      logger.info('Using Claude Vision for matching', { transactionId });
      const claudeResult = await analyzeTicketWithClaude(
        transaction.ticketImageBase64,
        transactionId
      );

      if (claudeResult) {
        usedClaude = true;

        // Convert Claude results to matchedProducts format
        matchedProductsData = claudeResult.products.map((p) => ({
          ticketProduct: {
            name: p.name,
            rawText: p.name,
            quantity: p.quantity,
            price: p.unit_price,
            unitPrice: p.unit_price,
            totalPrice: p.total_price,
            discount: 0,
            confidence: 10,
          },
          matched: p.is_phytalessence && !!p.matched_catalog_id,
          matchedProductId: p.matched_catalog_id || null,
          matchedProductName: p.matched_catalog_product || null,
          eligibleAmount: p.is_phytalessence && p.matched_catalog_id ? p.total_price : 0,
          matchMethod: p.is_phytalessence && p.matched_catalog_id ? 'claude_vision' : null,
        }));

        totalMatched = matchedProductsData.filter((p: any) => p.matched).length;
        totalUnmatched = matchedProductsData.filter((p: any) => !p.matched).length;
        eligibleAmount = matchedProductsData.reduce(
          (sum: number, p: any) => sum + (p.matched ? p.eligibleAmount : 0),
          0
        );

        logger.info('Claude matching completed — ticketProducts updated', {
          transactionId,
          matched: totalMatched,
          unmatched: totalUnmatched,
          eligibleAmount,
        });

        // Store Claude's OCR products separately + update totalAmount if it was 0
        const updateData: any = {
          ocrProducts: claudeResult as unknown as Prisma.InputJsonValue,
          ocrUsed: true,
          storeName: claudeResult.store_name || transaction.storeName,
        };
        if (Number(transaction.totalAmount) === 0 && claudeResult.total_receipt > 0) {
          updateData.totalAmount = new Prisma.Decimal(claudeResult.total_receipt);
        }
        await updateTransaction(transactionId, updateData);
      } else {
        // Claude failed, fallback to Levenshtein
        logger.warn('Claude Vision failed, falling back to Levenshtein', { transactionId });
        const matchingResult = await matchProducts(ticketProducts);
        matchedProductsData = formatMatchingResultForStorage(matchingResult);
        totalMatched = matchingResult.totalMatched;
        totalUnmatched = matchingResult.totalUnmatched;
        eligibleAmount = matchingResult.eligibleAmount;
      }
    } else {
      // No image or no API key — use Levenshtein matching
      logger.info('Matching products', { transactionId });
      const matchingResult = await matchProducts(ticketProducts);
      matchedProductsData = formatMatchingResultForStorage(matchingResult);
      totalMatched = matchingResult.totalMatched;
      totalUnmatched = matchingResult.totalUnmatched;
      eligibleAmount = matchingResult.eligibleAmount;
    }

    // Step 2: Calculate points
    logger.info('Calculating points', {
      transactionId,
      eligibleAmount,
    });
    const pointsResult = await calculatePoints(eligibleAmount);

    // Step 3: Update transaction with matching and points data
    await updateTransaction(transactionId, {
      matchedProducts: matchedProductsData as Prisma.InputJsonValue,
      eligibleAmount: new Prisma.Decimal(eligibleAmount),
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
      totalMatched > 0
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
      matchedProducts: totalMatched,
      points: pointsResult.roundedPoints,
      notificationSent,
      usedClaude,
      duration: `${duration}ms`,
    });

    return {
      success: true,
      transactionId,
      matchedProducts: totalMatched,
      unmatchedProducts: totalUnmatched,
      eligibleAmount,
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
