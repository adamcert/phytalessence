import { z } from 'zod';
import { AdminRole } from '@prisma/client';

export const createAdminSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Mot de passe minimum 8 caractères'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.nativeEnum(AdminRole).default(AdminRole.VIEWER),
});

export const updateAdminSchema = z.object({
  email: z.string().email('Email invalide').optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.nativeEnum(AdminRole).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string().min(8, 'Nouveau mot de passe minimum 8 caractères'),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Mot de passe minimum 8 caractères'),
});

export const adminIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID invalide').transform(Number),
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type UpdateAdminInput = z.infer<typeof updateAdminSchema>;
