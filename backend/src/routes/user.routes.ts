import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/role.js';
import { validateQuery, validateBody } from '../middleware/validate.js';
import {
  getAllUsers,
  getUserByEmail,
  adjustUserPoints,
  getUserTransactions,
  getUserAdjustments,
  getUserCerthisPoints,
} from '../services/user.service.js';
import { logger } from '../utils/logger.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Query params validation for list
const listUsersQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sortBy: z.enum(['userEmail', 'userName', 'totalTransactions', 'totalAmount', 'totalPoints', 'lastTransactionDate']).optional().default('totalPoints'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Points adjustment body validation
const adjustPointsBodySchema = z.object({
  delta: z.number().int().refine(val => val !== 0, 'Delta cannot be 0'),
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500),
  sendNotification: z.boolean().optional().default(false),
});

// Transactions query schema
const transactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;

/**
 * GET /users
 * Get all users with their aggregated points
 */
router.get(
  '/',
  validateQuery(listUsersQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ListUsersQuery;
      const { search, page, limit, sortBy, sortOrder } = query;

      const result = await getAllUsers({
        search,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      res.json({
        data: result.users,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /users/:email
 * Get a specific user by email
 */
router.get(
  '/:email',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = req.params.email as string;
      const user = await getUserByEmail(decodeURIComponent(email));

      if (!user) {
        res.status(404).json({
          error: 'User not found',
          message: `No transactions found for email: ${email}`,
        });
        return;
      }

      res.json({ data: user });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /users/:email/transactions
 * Get user transactions
 */
router.get(
  '/:email/transactions',
  validateQuery(transactionsQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = req.params.email as string;
      const query = req.query as unknown as TransactionsQuery;
      const { page, limit } = query;

      const result = await getUserTransactions(decodeURIComponent(email), {
        page,
        limit,
      });

      res.json({
        data: result.transactions,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /users/:email/points
 * Adjust user points (add or remove)
 * Requires ADMIN role
 * delta: positive to add, negative to remove
 */
router.post(
  '/:email/points',
  adminOnly,
  validateBody(adjustPointsBodySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = req.params.email as string;
      const { delta, reason, sendNotification } = req.body;
      const authReq = req as AuthenticatedRequest;
      const adminId = authReq.user?.userId || 0;

      logger.info('Admin adjusting user points', {
        adminId,
        userEmail: email,
        delta,
        reason,
        sendNotification,
      });

      const result = await adjustUserPoints({
        userEmail: decodeURIComponent(email),
        delta,
        reason,
        adminId,
        sendNotification,
      });

      if (!result.success) {
        res.status(400).json({
          error: 'Failed to adjust points',
          message: result.message,
        });
        return;
      }

      res.json({
        success: true,
        message: result.message,
        data: {
          email: decodeURIComponent(email),
          delta,
          newTotal: result.newTotal,
          reason,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /users/:email/adjustments
 * Get user points adjustments history
 */
router.get(
  '/:email/adjustments',
  validateQuery(transactionsQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = req.params.email as string;
      const query = req.query as unknown as TransactionsQuery;
      const { page, limit } = query;

      const result = await getUserAdjustments(decodeURIComponent(email), {
        page,
        limit,
      });

      res.json({
        data: result.adjustments,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /users/:email/certhis-points
 * Fetch current points from Certhis API (source of truth)
 * Also updates local database with fetched points
 */
router.get(
  '/:email/certhis-points',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = req.params.email as string;

      const result = await getUserCerthisPoints(decodeURIComponent(email));

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.json({
        success: true,
        points: result.points,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
