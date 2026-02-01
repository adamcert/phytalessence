import { Admin, AdminRole, Prisma } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { hashPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';

export type AdminWithoutPassword = Omit<Admin, 'password'>;

export const getAllAdmins = async (): Promise<AdminWithoutPassword[]> => {
  const admins = await prisma.admin.findMany({
    orderBy: { email: 'asc' },
  });

  // Remove password from response
  return admins.map(({ password, ...admin }) => admin);
};

export const getAdminById = async (id: number): Promise<AdminWithoutPassword | null> => {
  const admin = await prisma.admin.findUnique({
    where: { id },
  });

  if (!admin) return null;

  const { password, ...adminWithoutPassword } = admin;
  return adminWithoutPassword;
};

export const getAdminByEmail = async (email: string): Promise<Admin | null> => {
  return prisma.admin.findUnique({
    where: { email: email.toLowerCase() },
  });
};

export const createAdmin = async (data: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: AdminRole;
}): Promise<AdminWithoutPassword> => {
  const hashedPassword = await hashPassword(data.password);

  logger.info('Creating admin', { email: data.email, role: data.role });

  const admin = await prisma.admin.create({
    data: {
      email: data.email.toLowerCase(),
      password: hashedPassword,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      role: data.role || AdminRole.VIEWER,
    },
  });

  const { password, ...adminWithoutPassword } = admin;
  return adminWithoutPassword;
};

export const updateAdmin = async (
  id: number,
  data: Prisma.AdminUpdateInput
): Promise<AdminWithoutPassword> => {
  logger.info('Updating admin', { id });

  const admin = await prisma.admin.update({
    where: { id },
    data,
  });

  const { password, ...adminWithoutPassword } = admin;
  return adminWithoutPassword;
};

export const updateAdminPassword = async (
  id: number,
  newPassword: string
): Promise<void> => {
  const hashedPassword = await hashPassword(newPassword);

  await prisma.admin.update({
    where: { id },
    data: { password: hashedPassword },
  });

  logger.info('Admin password updated', { id });
};

export const deleteAdmin = async (id: number): Promise<void> => {
  logger.info('Deleting admin', { id });

  await prisma.admin.delete({
    where: { id },
  });
};

export const countAdmins = async (): Promise<number> => {
  return prisma.admin.count();
};

export const countAdminsByRole = async (role: AdminRole): Promise<number> => {
  return prisma.admin.count({
    where: { role },
  });
};
