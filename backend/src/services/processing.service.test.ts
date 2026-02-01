import { TransactionStatus } from '@prisma/client';

// Mock all dependencies before importing the service
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('./transaction.service', () => ({
  getTransactionById: jest.fn(),
  updateTransaction: jest.fn(),
}));

jest.mock('./matching.service', () => ({
  matchProducts: jest.fn(),
  formatMatchingResultForStorage: jest.fn(),
}));

jest.mock('./points.service', () => ({
  calculatePoints: jest.fn(),
}));

jest.mock('./snapss.service', () => ({
  sendPointsNotification: jest.fn(),
}));

import { processTransaction } from './processing.service';
import { getTransactionById, updateTransaction } from './transaction.service';
import { matchProducts, formatMatchingResultForStorage } from './matching.service';
import { calculatePoints } from './points.service';
import { sendPointsNotification } from './snapss.service';

describe('Processing Service', () => {
  const mockTransaction = {
    id: 1,
    ticketId: 'TICKET-001',
    userEmail: 'test@example.com',
    userName: 'Test User',
    userPhone: null,
    totalAmount: { toNumber: () => 50.0 },
    ticketProducts: [
      { name: 'Omega 3', quantity: 2, price: 15.99 },
      { name: 'Vitamine D3', quantity: 1, price: 12.50 },
    ],
    matchedProducts: null,
    eligibleAmount: { toNumber: () => 0 },
    pointsCalculated: 0,
    pointsAwarded: false,
    notificationSent: false,
    snapssResponse: null,
    status: TransactionStatus.PENDING,
    errorMessage: null,
    processedAt: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (getTransactionById as jest.Mock).mockResolvedValue(mockTransaction);
    (updateTransaction as jest.Mock).mockResolvedValue(mockTransaction);

    (matchProducts as jest.Mock).mockResolvedValue({
      matchedProducts: [],
      totalMatched: 2,
      totalUnmatched: 0,
      eligibleAmount: 44.48,
      matchRate: 100,
    });

    (formatMatchingResultForStorage as jest.Mock).mockReturnValue({
      products: [],
      summary: { totalMatched: 2, totalUnmatched: 0, eligibleAmount: 44.48, matchRate: 100 },
    });

    (calculatePoints as jest.Mock).mockResolvedValue({
      eligibleAmount: 44.48,
      pointsRatio: 1,
      rawPoints: 44.48,
      roundedPoints: 44,
      roundingMethod: 'floor',
    });

    (sendPointsNotification as jest.Mock).mockResolvedValue({
      success: true,
      sentAt: new Date(),
    });
  });

  describe('processTransaction', () => {
    it('should process a transaction successfully', async () => {
      const result = await processTransaction(1);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe(1);
      expect(result.matchedProducts).toBe(2);
      expect(result.unmatchedProducts).toBe(0);
      expect(result.eligibleAmount).toBe(44.48);
      expect(result.pointsCalculated).toBe(44);
      expect(result.notificationSent).toBe(true);
    });

    it('should return error if transaction not found', async () => {
      (getTransactionById as jest.Mock).mockResolvedValue(null);

      const result = await processTransaction(999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should skip already processed transactions', async () => {
      (getTransactionById as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.SUCCESS,
      });

      const result = await processTransaction(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already processed');
      expect(matchProducts).not.toHaveBeenCalled();
    });

    it('should handle zero points (no notification sent)', async () => {
      (calculatePoints as jest.Mock).mockResolvedValue({
        eligibleAmount: 0,
        pointsRatio: 1,
        rawPoints: 0,
        roundedPoints: 0,
        roundingMethod: 'floor',
      });

      (matchProducts as jest.Mock).mockResolvedValue({
        matchedProducts: [],
        totalMatched: 0,
        totalUnmatched: 2,
        eligibleAmount: 0,
        matchRate: 0,
      });

      const result = await processTransaction(1);

      expect(result.success).toBe(true);
      expect(result.pointsCalculated).toBe(0);
      expect(result.notificationSent).toBe(false);
      expect(sendPointsNotification).not.toHaveBeenCalled();
    });

    it('should continue processing even if notification fails', async () => {
      (sendPointsNotification as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Network error',
        sentAt: new Date(),
      });

      const result = await processTransaction(1);

      expect(result.success).toBe(true);
      expect(result.notificationSent).toBe(false);
    });

    it('should update transaction status to FAILED on error', async () => {
      (matchProducts as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await processTransaction(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
      expect(updateTransaction).toHaveBeenCalledWith(1, expect.objectContaining({
        status: TransactionStatus.FAILED,
        errorMessage: 'Database error',
      }));
    });
  });
});
