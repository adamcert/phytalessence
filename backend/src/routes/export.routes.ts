import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { validateQuery } from '../middleware/validate.js';
import { transactionQuerySchema } from '../validators/transaction.validator.js';
import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

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

// GET /api/export/wallets - Export Certhis wallets as CSV with phydelite tag column
router.get(
  '/wallets',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = config.snapss.apiKey;
      const apiSecret = config.snapss.apiPass;

      if (!apiKey || !apiSecret) {
        res.status(500).json({ error: 'Certhis API credentials not configured' });
        return;
      }

      const url = 'https://api.certhis.io/wallets?export_csv=true&tag_id=&attribute_filter=points';

      const upstream = await fetch(url, {
        method: 'GET',
        headers: {
          accept: 'application/json, text/plain, */*',
          api_key: apiKey,
          api_secret: apiSecret,
          origin: 'https://snapss.io',
          referer: 'https://snapss.io/',
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        },
      });

      if (!upstream.ok) {
        const text = await upstream.text();
        logger.error('Certhis wallets export failed', {
          status: upstream.status,
          body: text.slice(0, 500),
        });
        res.status(502).json({
          error: 'Certhis API error',
          status: upstream.status,
        });
        return;
      }

      const rawCsv = await upstream.text();

      // Parse CSV: detect separator, drop "Wallet Address" column, append "tag" column
      const lines = rawCsv.split(/\r?\n/);
      // Strip UTF-8 BOM if present on first line
      if (lines.length > 0 && lines[0] && lines[0].charCodeAt(0) === 0xfeff) {
        lines[0] = lines[0].slice(1);
      }

      // Detect separator from header line (prefer ; then , then \t)
      const headerLine = lines[0] ?? '';
      const separator = headerLine.includes(';')
        ? ';'
        : headerLine.includes('\t')
        ? '\t'
        : ',';

      // Minimal RFC4180-ish CSV row parser (handles quoted fields, escaped quotes)
      const parseCsvRow = (row: string, sep: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
          const ch = row[i];
          if (inQuotes) {
            if (ch === '"') {
              if (row[i + 1] === '"') {
                cur += '"';
                i++;
              } else {
                inQuotes = false;
              }
            } else {
              cur += ch;
            }
          } else {
            if (ch === '"') {
              inQuotes = true;
            } else if (ch === sep) {
              result.push(cur);
              cur = '';
            } else {
              cur += ch;
            }
          }
        }
        result.push(cur);
        return result;
      };

      const serializeCsvRow = (cells: string[], sep: string): string =>
        cells
          .map((c) => {
            const needsQuote = c.includes(sep) || c.includes('"') || c.includes('\n');
            const escaped = c.replace(/"/g, '""');
            return needsQuote ? `"${escaped}"` : escaped;
          })
          .join(sep);

      // Parse header to find Wallet Address column index
      const headerCells = parseCsvRow(headerLine, separator);
      const walletAddressIdx = headerCells.findIndex(
        (h) => h.trim().toLowerCase() === 'wallet address'
      );

      const outLines: string[] = [];
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx] ?? '';
        if (line.length === 0) {
          outLines.push(line);
          continue;
        }
        const cells = parseCsvRow(line, separator);
        if (walletAddressIdx >= 0 && walletAddressIdx < cells.length) {
          cells.splice(walletAddressIdx, 1);
        }
        if (idx === 0) {
          cells.push('tag_source');
        } else {
          cells.push('phydelite');
        }
        outLines.push(serializeCsvRow(cells, separator));
      }

      const augmented = outLines.join('\n');

      logger.info('Wallets exported', {
        lines: lines.length - 1,
        walletAddressRemoved: walletAddressIdx >= 0,
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="export_phydelite_${new Date().toISOString().split('T')[0]}.csv"`
      );
      res.send('\uFEFF' + augmented);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
