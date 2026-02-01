import { Router, Request, Response, NextFunction } from 'express';
import { AdminRole } from '@prisma/client';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  createAdminSchema,
  updateAdminSchema,
  changePasswordSchema,
  resetPasswordSchema,
  adminIdParamSchema,
} from '../validators/admin.validator.js';
import {
  getAllAdmins,
  getAdminById,
  getAdminByEmail,
  createAdmin,
  updateAdmin,
  updateAdminPassword,
  deleteAdmin,
  countAdminsByRole,
} from '../services/admin.service.js';
import { verifyPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/error.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/admins - List all admins (ADMIN only)
router.get(
  '/',
  roleMiddleware('ADMIN'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const admins = await getAllAdmins();
      res.json({ data: admins });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/admins/:id - Get admin by ID (ADMIN only)
router.get(
  '/:id',
  roleMiddleware('ADMIN'),
  validateParams(adminIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as { id: number };
      const admin = await getAdminById(id);

      if (!admin) {
        throw new AppError('Administrateur non trouvé', 404, 'NOT_FOUND');
      }

      res.json({ data: admin });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/admins - Create admin (ADMIN only)
router.post(
  '/',
  roleMiddleware('ADMIN'),
  validateBody(createAdminSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, firstName, lastName, role } = req.body;

      // Check if email already exists
      const existing = await getAdminByEmail(email);
      if (existing) {
        throw new AppError('Cet email est déjà utilisé', 400, 'EMAIL_EXISTS');
      }

      const admin = await createAdmin({
        email,
        password,
        firstName,
        lastName,
        role,
      });

      logger.info('Admin created', { adminId: admin.id, email: admin.email });

      res.status(201).json({ data: admin });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/admins/:id - Update admin (ADMIN only)
router.put(
  '/:id',
  roleMiddleware('ADMIN'),
  validateParams(adminIdParamSchema),
  validateBody(updateAdminSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { email, firstName, lastName, role } = req.body;

      // Check if admin exists
      const existing = await getAdminById(id);
      if (!existing) {
        throw new AppError('Administrateur non trouvé', 404, 'NOT_FOUND');
      }

      // Check if email is being changed to an existing one
      if (email && email !== existing.email) {
        const emailExists = await getAdminByEmail(email);
        if (emailExists) {
          throw new AppError('Cet email est déjà utilisé', 400, 'EMAIL_EXISTS');
        }
      }

      // Prevent removing the last ADMIN
      if (role === AdminRole.VIEWER && existing.role === AdminRole.ADMIN) {
        const adminCount = await countAdminsByRole(AdminRole.ADMIN);
        if (adminCount <= 1) {
          throw new AppError(
            'Impossible de rétrograder le dernier administrateur',
            400,
            'LAST_ADMIN'
          );
        }
      }

      const admin = await updateAdmin(id, {
        email: email?.toLowerCase(),
        firstName,
        lastName,
        role,
      });

      logger.info('Admin updated', { adminId: admin.id });

      res.json({ data: admin });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/admins/:id - Delete admin (ADMIN only)
router.delete(
  '/:id',
  roleMiddleware('ADMIN'),
  validateParams(adminIdParamSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as { id: number };

      // Check if admin exists
      const existing = await getAdminById(id);
      if (!existing) {
        throw new AppError('Administrateur non trouvé', 404, 'NOT_FOUND');
      }

      // Prevent self-deletion
      if (req.user?.userId === id) {
        throw new AppError('Impossible de supprimer votre propre compte', 400, 'SELF_DELETE');
      }

      // Prevent deleting the last ADMIN
      if (existing.role === AdminRole.ADMIN) {
        const adminCount = await countAdminsByRole(AdminRole.ADMIN);
        if (adminCount <= 1) {
          throw new AppError(
            'Impossible de supprimer le dernier administrateur',
            400,
            'LAST_ADMIN'
          );
        }
      }

      await deleteAdmin(id);

      logger.info('Admin deleted', { adminId: id });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/admins/:id/reset-password - Reset password (ADMIN only)
router.post(
  '/:id/reset-password',
  roleMiddleware('ADMIN'),
  validateParams(adminIdParamSchema),
  validateBody(resetPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { newPassword } = req.body;

      // Check if admin exists
      const existing = await getAdminById(id);
      if (!existing) {
        throw new AppError('Administrateur non trouvé', 404, 'NOT_FOUND');
      }

      await updateAdminPassword(id, newPassword);

      logger.info('Admin password reset', { adminId: id });

      res.json({ message: 'Mot de passe réinitialisé' });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/admins/me/change-password - Change own password
router.post(
  '/me/change-password',
  validateBody(changePasswordSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        throw new AppError('Non authentifié', 401, 'UNAUTHORIZED');
      }

      const { currentPassword, newPassword } = req.body;

      // Get admin with password
      const admin = await getAdminByEmail(user.email);
      if (!admin) {
        throw new AppError('Administrateur non trouvé', 404, 'NOT_FOUND');
      }

      // Verify current password
      const isValid = await verifyPassword(currentPassword, admin.password);
      if (!isValid) {
        throw new AppError('Mot de passe actuel incorrect', 400, 'INVALID_PASSWORD');
      }

      await updateAdminPassword(user.userId, newPassword);

      logger.info('Admin changed own password', { adminId: user.userId });

      res.json({ message: 'Mot de passe modifié' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
