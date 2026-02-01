import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(255, 'Nom trop long'),
  sku: z.string().max(100, 'SKU trop long').optional(),
  aliases: z.array(z.string().max(100)).default([]),
  active: z.boolean().default(true),
});

export const updateProductSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(255, 'Nom trop long').optional(),
  sku: z.string().max(100, 'SKU trop long').nullable().optional(),
  aliases: z.array(z.string().max(100)).optional(),
  active: z.boolean().optional(),
});

export const productIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID invalide').transform(Number),
});

export const productQuerySchema = z.object({
  activeOnly: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).default('1').transform(Number),
  limit: z.string().regex(/^\d+$/).default('50').transform(Number),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;
