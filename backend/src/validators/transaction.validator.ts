import { z } from 'zod';
import { TransactionStatus } from '@prisma/client';

export const transactionIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID invalide').transform(Number),
});

export const transactionQuerySchema = z.object({
  status: z.nativeEnum(TransactionStatus).optional(),
  userEmail: z.string().min(1).max(255).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().regex(/^\d+$/).default('1').transform(Number),
  limit: z.string().regex(/^\d+$/).default('20').transform(Number),
  sortBy: z.enum(['createdAt', 'totalAmount', 'pointsCalculated']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const reprocessTransactionSchema = z.object({
  force: z.boolean().default(false),
});

export const forceMatchSchema = z.object({
  productIndex: z.number().int().min(0, 'Index produit invalide'),
  catalogProductId: z.number().int().positive('ID produit catalogue requis'),
  note: z.string().min(3, 'Note requise (min 3 caractères)').max(500, 'Note trop longue'),
  quantity: z.number().int().min(1).optional(),
  unitPrice: z.number().min(0).optional(),
});

export const unmatchSchema = z.object({
  productIndex: z.number().int().min(0, 'Index produit invalide'),
  note: z.string().min(3, 'Note requise (min 3 caractères)').max(500, 'Note trop longue'),
});

export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
export type ForceMatchInput = z.infer<typeof forceMatchSchema>;
export type UnmatchInput = z.infer<typeof unmatchSchema>;
