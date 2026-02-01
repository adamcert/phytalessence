import { z } from 'zod';
import { TransactionStatus } from '@prisma/client';

export const transactionIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID invalide').transform(Number),
});

export const transactionQuerySchema = z.object({
  status: z.nativeEnum(TransactionStatus).optional(),
  userEmail: z.string().email().optional(),
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

export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
