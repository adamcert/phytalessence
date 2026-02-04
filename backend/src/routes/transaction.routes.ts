import { Router, Request, Response, NextFunction } from 'express';
import { TransactionStatus, Prisma } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { validateParams, validateQuery, validateBody } from '../middleware/validate.js';
import {
  transactionIdParamSchema,
  transactionQuerySchema,
  reprocessTransactionSchema,
  forceMatchSchema,
} from '../validators/transaction.validator.js';
import { getTransactionById, updateTransactionStatus, deleteTransaction, forceMatchProduct } from '../services/transaction.service.js';
import { processTransaction } from '../services/processing.service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/error.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/transactions - List transactions with filters
router.get(
  '/',
  validateQuery(transactionQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, userEmail, startDate, endDate, page, limit, sortBy, sortOrder } =
        req.query as unknown as {
          status?: TransactionStatus;
          userEmail?: string;
          startDate?: string;
          endDate?: string;
          page: number;
          limit: number;
          sortBy: string;
          sortOrder: 'asc' | 'desc';
        };

      const skip = (page - 1) * limit;

      // Build where clause
      const where: Prisma.TransactionWhereInput = {};

      if (status) {
        where.status = status;
      }

      if (userEmail) {
        where.userEmail = { contains: userEmail };
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
      }

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
          select: {
            id: true,
            ticketId: true,
            userEmail: true,
            userName: true,
            userPhone: true,
            totalAmount: true,
            eligibleAmount: true,
            pointsCalculated: true,
            pointsAwarded: true,
            status: true,
            createdAt: true,
            processedAt: true,
          },
        }),
        prisma.transaction.count({ where }),
      ]);

      res.json({
        data: transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/transactions/stats - Get transaction statistics
router.get(
  '/stats',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [
        totalCount,
        statusCounts,
        totalPoints,
        todayCount,
      ] = await Promise.all([
        prisma.transaction.count(),
        prisma.transaction.groupBy({
          by: ['status'],
          _count: true,
        }),
        prisma.transaction.aggregate({
          _sum: { pointsCalculated: true },
        }),
        prisma.transaction.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
      ]);

      const statusMap = statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        data: {
          total: totalCount,
          today: todayCount,
          byStatus: statusMap,
          totalPointsAwarded: totalPoints._sum.pointsCalculated || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/transactions/:id - Get transaction detail
router.get(
  '/:id',
  validateParams(transactionIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as { id: number };
      const transaction = await getTransactionById(id);

      if (!transaction) {
        throw new AppError('Transaction non trouvée', 404, 'NOT_FOUND');
      }

      res.json({ data: transaction });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/transactions/:id/reprocess - Reprocess a transaction (ADMIN only)
router.post(
  '/:id/reprocess',
  roleMiddleware('ADMIN'),
  validateParams(transactionIdParamSchema),
  validateBody(reprocessTransactionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { force } = req.body as { force: boolean };

      const transaction = await getTransactionById(id);

      if (!transaction) {
        throw new AppError('Transaction non trouvée', 404, 'NOT_FOUND');
      }

      // Only allow reprocessing of PENDING or FAILED transactions (unless forced)
      if (
        !force &&
        transaction.status !== TransactionStatus.PENDING &&
        transaction.status !== TransactionStatus.FAILED
      ) {
        throw new AppError(
          'Cette transaction a déjà été traitée. Utilisez force=true pour forcer le retraitement.',
          400,
          'ALREADY_PROCESSED'
        );
      }

      // Reset status to PENDING if forcing
      if (force && transaction.status !== TransactionStatus.PENDING) {
        await updateTransactionStatus(id, TransactionStatus.PENDING);
      }

      logger.info('Reprocessing transaction', { transactionId: id, force });

      const result = await processTransaction(id);

      res.json({
        message: 'Transaction retraitée',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/transactions/:id/force-match - Force match a product (ADMIN only)
router.post(
  '/:id/force-match',
  roleMiddleware('ADMIN'),
  validateParams(transactionIdParamSchema),
  validateBody(forceMatchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { productIndex, catalogProductId, note } = req.body;
      const adminEmail = (req as any).user?.email || 'unknown';

      const transaction = await getTransactionById(id);

      if (!transaction) {
        throw new AppError('Transaction non trouvée', 404, 'NOT_FOUND');
      }

      logger.info('Force matching product', {
        transactionId: id,
        productIndex,
        catalogProductId,
        adminEmail,
      });

      const result = await forceMatchProduct(id, { productIndex, catalogProductId, note }, adminEmail);

      res.json({
        message: 'Produit forcé avec succès',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/transactions/:id - Delete a transaction (ADMIN only)
router.delete(
  '/:id',
  roleMiddleware('ADMIN'),
  validateParams(transactionIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as { id: number };

      const transaction = await getTransactionById(id);

      if (!transaction) {
        throw new AppError('Transaction non trouvée', 404, 'NOT_FOUND');
      }

      await deleteTransaction(id);

      logger.info('Transaction deleted', { transactionId: id });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
