import { Product, Prisma } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

export const getAllProducts = async (activeOnly: boolean = true): Promise<Product[]> => {
  return prisma.product.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { name: 'asc' },
  });
};

export const getProductById = async (id: number): Promise<Product | null> => {
  return prisma.product.findUnique({
    where: { id },
  });
};

export const getProductByName = async (name: string): Promise<Product | null> => {
  // MySQL with utf8mb4_unicode_ci collation is already case-insensitive
  return prisma.product.findFirst({
    where: {
      name: {
        equals: name,
      },
      active: true,
    },
  });
};

export const getProductsByNames = async (names: string[]): Promise<Product[]> => {
  // Normalize names for comparison
  const normalizedNames = names.map((n) => n.toLowerCase().trim());

  const products = await prisma.product.findMany({
    where: {
      active: true,
    },
  });

  // Filter products that match any of the names (case-insensitive)
  return products.filter((p) =>
    normalizedNames.includes(p.name.toLowerCase().trim())
  );
};

export const createProduct = async (data: {
  name: string;
  sku?: string;
  aliases?: string[];
  active?: boolean;
}): Promise<Product> => {
  logger.info('Creating product', { name: data.name, sku: data.sku, aliases: data.aliases });

  return prisma.product.create({
    data: {
      name: data.name,
      sku: data.sku || null,
      aliases: data.aliases || [],
      active: data.active ?? true,
    },
  });
};

export const updateProduct = async (
  id: number,
  data: Prisma.ProductUpdateInput
): Promise<Product> => {
  logger.info('Updating product', { id, data });

  return prisma.product.update({
    where: { id },
    data,
  });
};

export const deleteProduct = async (id: number): Promise<Product> => {
  logger.info('Deleting product', { id });

  return prisma.product.delete({
    where: { id },
  });
};

export const countProducts = async (activeOnly: boolean = true): Promise<number> => {
  return prisma.product.count({
    where: activeOnly ? { active: true } : undefined,
  });
};
