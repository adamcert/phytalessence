import { Response, NextFunction } from 'express';
import { AdminRole } from '@prisma/client';
import { AppError } from './error.js';
import { AuthenticatedRequest } from '../types/index.js';

export const roleMiddleware = (...allowedRoles: AdminRole[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentification requise', 401, 'UNAUTHORIZED'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError('Accès non autorisé', 403, 'FORBIDDEN'));
      return;
    }

    next();
  };
};

// Convenience middleware for admin-only routes
export const adminOnly = roleMiddleware(AdminRole.ADMIN);

// Convenience middleware for any authenticated user
export const anyRole = roleMiddleware(AdminRole.ADMIN, AdminRole.VIEWER);
