import { Response, NextFunction } from 'express';
import { AdminRole } from '@prisma/client';
import { verifyToken } from '../utils/jwt.js';
import { AppError } from './error.js';
import { AuthenticatedRequest } from '../types/index.js';

// Re-export for convenience
export { AuthenticatedRequest } from '../types/index.js';

export const authMiddleware = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AppError('Token d\'authentification requis', 401, 'UNAUTHORIZED');
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new AppError('Format de token invalide', 401, 'UNAUTHORIZED');
    }

    const token = parts[1];

    if (!token) {
      throw new AppError('Token manquant', 401, 'UNAUTHORIZED');
    }

    const payload = verifyToken(token);

    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as AdminRole,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Token invalide ou expiré', 401, 'UNAUTHORIZED'));
    }
  }
};
