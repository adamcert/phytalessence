import { Router, Response, NextFunction } from 'express';
import { login, getAdminById } from '../services/auth.service.js';
import { loginSchema } from '../validators/auth.validator.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// POST /api/auth/login
router.post(
  '/login',
  validate(loginSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const result = await login(email, password);

      res.json({
        token: result.token,
        admin: result.admin,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/auth/me
router.get(
  '/me',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Utilisateur non authentifié', 401, 'UNAUTHORIZED');
      }

      const admin = await getAdminById(req.user.userId);

      if (!admin) {
        throw new AppError('Utilisateur non trouvé', 404, 'NOT_FOUND');
      }

      res.json({ admin });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
