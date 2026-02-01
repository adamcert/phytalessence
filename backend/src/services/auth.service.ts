import { Admin } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { verifyPassword } from '../utils/password.js';
import { generateToken, JwtPayload } from '../utils/jwt.js';
import { AppError } from '../middleware/error.js';
import { AdminSafeData } from '../types/index.js';

// Remove password from admin object
const sanitizeAdmin = (admin: Admin): AdminSafeData => {
  const { password: _, ...safeAdmin } = admin;
  return safeAdmin;
};

export interface LoginResult {
  token: string;
  admin: AdminSafeData;
}

export const login = async (email: string, password: string): Promise<LoginResult> => {
  // Find admin by email
  const admin = await prisma.admin.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!admin) {
    throw new AppError('Email ou mot de passe incorrect', 401, 'INVALID_CREDENTIALS');
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, admin.password);

  if (!isValidPassword) {
    throw new AppError('Email ou mot de passe incorrect', 401, 'INVALID_CREDENTIALS');
  }

  // Update last login
  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  // Generate JWT
  const payload: JwtPayload = {
    userId: admin.id,
    email: admin.email,
    role: admin.role,
  };

  const token = generateToken(payload);

  return {
    token,
    admin: sanitizeAdmin(admin),
  };
};

export const getAdminById = async (id: number): Promise<AdminSafeData | null> => {
  const admin = await prisma.admin.findUnique({
    where: { id },
  });

  if (!admin) {
    return null;
  }

  return sanitizeAdmin(admin);
};

export const getAdminByEmail = async (email: string): Promise<AdminSafeData | null> => {
  const admin = await prisma.admin.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!admin) {
    return null;
  }

  return sanitizeAdmin(admin);
};
