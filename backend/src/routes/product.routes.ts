import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  productQuerySchema,
} from '../validators/product.validator.js';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  countProducts,
} from '../services/product.service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/error.js';
import prisma from '../utils/prisma.js';

const router = Router();

// PUBLIC: GET /api/products/catalog - Liste publique des produits pour matching IA
router.get('/catalog', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, sku: true },
      orderBy: { name: 'asc' },
    });

    res.json({
      count: products.length,
      products: products.map(p => p.name),
      productsWithDetails: products,
    });
  } catch (error) {
    next(error);
  }
});

// All other routes require authentication
router.use(authMiddleware);

// GET /api/products - List all products
router.get(
  '/',
  validateQuery(productQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { activeOnly, search, page, limit } = req.query as unknown as {
        activeOnly: boolean;
        search?: string;
        page: number;
        limit: number;
      };

      const skip = (page - 1) * limit;

      // Build where clause
      const where: { active?: boolean; name?: { contains: string } } = {};
      if (activeOnly) {
        where.active = true;
      }
      if (search) {
        where.name = { contains: search };
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          orderBy: { name: 'asc' },
          skip,
          take: limit,
        }),
        prisma.product.count({ where }),
      ]);

      res.json({
        data: products,
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

// GET /api/products/:id - Get product by ID
router.get(
  '/:id',
  validateParams(productIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as { id: number };
      const product = await getProductById(id);

      if (!product) {
        throw new AppError('Produit non trouvé', 404, 'NOT_FOUND');
      }

      res.json({ data: product });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/products - Create product (ADMIN only)
router.post(
  '/',
  roleMiddleware('ADMIN'),
  validateBody(createProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await createProduct(req.body);

      logger.info('Product created', { productId: product.id, name: product.name });

      res.status(201).json({ data: product });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/products/:id - Update product (ADMIN only)
router.put(
  '/:id',
  roleMiddleware('ADMIN'),
  validateParams(productIdParamSchema),
  validateBody(updateProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as { id: number };

      // Check if product exists
      const existing = await getProductById(id);
      if (!existing) {
        throw new AppError('Produit non trouvé', 404, 'NOT_FOUND');
      }

      const product = await updateProduct(id, req.body);

      logger.info('Product updated', { productId: product.id });

      res.json({ data: product });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/products/:id - Delete product (ADMIN only)
router.delete(
  '/:id',
  roleMiddleware('ADMIN'),
  validateParams(productIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as { id: number };

      // Check if product exists
      const existing = await getProductById(id);
      if (!existing) {
        throw new AppError('Produit non trouvé', 404, 'NOT_FOUND');
      }

      await deleteProduct(id);

      logger.info('Product deleted', { productId: id });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/products/import - Bulk import products (ADMIN only)
router.post(
  '/import',
  roleMiddleware('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { products } = req.body as { products: Array<{ name: string; sku?: string }> };

      if (!Array.isArray(products) || products.length === 0) {
        throw new AppError('Liste de produits requise', 400, 'VALIDATION_ERROR');
      }

      const results = {
        created: 0,
        skipped: 0,
        errors: [] as string[],
      };

      for (const product of products) {
        try {
          if (!product.name) {
            results.errors.push(`Produit sans nom ignoré`);
            results.skipped++;
            continue;
          }

          // Check if product already exists (MySQL utf8mb4_unicode_ci is case-insensitive)
          const existing = await prisma.product.findFirst({
            where: { name: { equals: product.name } },
          });

          if (existing) {
            results.skipped++;
            continue;
          }

          await createProduct({
            name: product.name,
            sku: product.sku,
            active: true,
          });
          results.created++;
        } catch (err) {
          results.errors.push(`Erreur pour "${product.name}": ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
        }
      }

      logger.info('Products imported', results);

      res.json({
        message: 'Import terminé',
        ...results,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
