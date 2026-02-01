import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { validateQuery } from '../middleware/validate.js';
import { transactionQuerySchema } from '../validators/transaction.validator.js';
import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All routes require authentication and ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));

// GET /api/export/transactions - Export transactions as CSV
router.get(
  '/transactions',
  validateQuery(transactionQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, userEmail, startDate, endDate, sortBy, sortOrder } =
        req.query as unknown as {
          status?: string;
          userEmail?: string;
          startDate?: string;
          endDate?: string;
          sortBy: string;
          sortOrder: 'asc' | 'desc';
        };

      // Build where clause
      const where: Prisma.TransactionWhereInput = {};

      if (status) {
        where.status = status as Prisma.EnumTransactionStatusFilter;
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

      const transactions = await prisma.transaction.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
      });

      // Generate CSV
      const headers = [
        'ID',
        'Ticket ID',
        'Email',
        'Nom',
        'Téléphone',
        'Montant Total',
        'Montant Éligible',
        'Points Calculés',
        'Points Attribués',
        'Notification Envoyée',
        'Statut',
        'Date Création',
        'Date Traitement',
      ];

      const rows = transactions.map((t) => [
        t.id,
        t.ticketId,
        t.userEmail,
        t.userName || '',
        t.userPhone || '',
        t.totalAmount.toString(),
        t.eligibleAmount.toString(),
        t.pointsCalculated,
        t.pointsAwarded ? 'Oui' : 'Non',
        t.notificationSent ? 'Oui' : 'Non',
        t.status,
        t.createdAt.toISOString(),
        t.processedAt?.toISOString() || '',
      ]);

      const csv = [
        headers.join(';'),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(';')),
      ].join('\n');

      logger.info('Transactions exported', { count: transactions.length });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="transactions_${new Date().toISOString().split('T')[0]}.csv"`
      );
      res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/export/products - Export products as CSV
router.get(
  '/products',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const products = await prisma.product.findMany({
        orderBy: { name: 'asc' },
      });

      const headers = ['ID', 'Nom', 'SKU', 'Actif', 'Date Création'];

      const rows = products.map((p) => [
        p.id,
        p.name,
        p.sku || '',
        p.active ? 'Oui' : 'Non',
        p.createdAt.toISOString(),
      ]);

      const csv = [
        headers.join(';'),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(';')),
      ].join('\n');

      logger.info('Products exported', { count: products.length });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="products_${new Date().toISOString().split('T')[0]}.csv"`
      );
      res.send('\uFEFF' + csv);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/export/stats - Export dashboard stats as JSON
router.get(
  '/stats',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [
        transactionStats,
        productStats,
        dailyTransactions,
      ] = await Promise.all([
        // Transaction stats
        prisma.transaction.aggregate({
          _count: true,
          _sum: {
            pointsCalculated: true,
            eligibleAmount: true,
            totalAmount: true,
          },
        }),
        // Product stats
        prisma.product.aggregate({
          _count: true,
        }),
        // Daily transactions (last 30 days)
        prisma.$queryRaw`
          SELECT
            DATE(created_at) as date,
            COUNT(*) as count,
            SUM(points_calculated) as points
          FROM transactions
          WHERE created_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `,
      ]);

      const stats = {
        exportDate: new Date().toISOString(),
        transactions: {
          total: transactionStats._count,
          totalPoints: transactionStats._sum.pointsCalculated || 0,
          totalEligibleAmount: transactionStats._sum.eligibleAmount?.toString() || '0',
          totalAmount: transactionStats._sum.totalAmount?.toString() || '0',
        },
        products: {
          total: productStats._count,
        },
        dailyTransactions,
      };

      logger.info('Stats exported');

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="stats_${new Date().toISOString().split('T')[0]}.json"`
      );
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
