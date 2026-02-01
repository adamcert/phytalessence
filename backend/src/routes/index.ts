import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import webhookRoutes from './webhook.routes.js';
import productRoutes from './product.routes.js';
import transactionRoutes from './transaction.routes.js';
import settingsRoutes from './settings.routes.js';
import adminRoutes from './admin.routes.js';
import exportRoutes from './export.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

// Health check route
router.use('/health', healthRoutes);

// Auth routes
router.use('/auth', authRoutes);

// Webhook routes (public - no auth required)
router.use('/webhook', webhookRoutes);

// Protected API routes (require authentication)
router.use('/products', productRoutes);
router.use('/transactions', transactionRoutes);
router.use('/settings', settingsRoutes);
router.use('/admins', adminRoutes);
router.use('/export', exportRoutes);
router.use('/users', userRoutes);

export default router;
