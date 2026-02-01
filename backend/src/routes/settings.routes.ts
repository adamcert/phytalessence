import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { updateSettingSchema, settingKeyParamSchema } from '../validators/settings.validator.js';
import { getAllSettings, getSetting, setSetting, DEFAULT_SETTINGS } from '../services/settings.service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/error.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Settings to hide from UI (internal/API settings)
const HIDDEN_SETTINGS = [
  'SNAPSS_HOST',
  'SNAPSS_API_KEY',
  'SNAPSS_API_PASS',
  'SNAPSS_API_KEY_DN',
  'SNAPSS_API_PASS_DN',
  'SNAPSS_TEMPLATE_ID',
  'SNAPSS_COLLECTION_INDEX',
  // Legacy lowercase keys (in case they still exist in DB)
  'snapss_host',
  'snapss_api_key',
  'snapss_api_pass',
  'snapss_api_key_dn',
  'snapss_api_pass_dn',
  'snapss_template_id',
  'snapss_collection_index',
  'points_ratio', // Old lowercase key
];

// GET /api/settings - Get all settings
router.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await getAllSettings();

      // Add descriptions for known settings and filter out hidden ones
      const settingsWithMeta = Object.entries(settings)
        .filter(([key]) => !HIDDEN_SETTINGS.includes(key))
        .map(([key, value]) => ({
          key,
          value,
          isDefault: DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] === value,
          description: getSettingDescription(key),
        }));

      res.json({ data: settingsWithMeta });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/settings/:key - Get a specific setting
router.get(
  '/:key',
  validateParams(settingKeyParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = req.params.key as string;
      const value = await getSetting(key as keyof typeof DEFAULT_SETTINGS);

      res.json({
        data: {
          key,
          value,
          description: getSettingDescription(key),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/settings/:key - Update a setting (ADMIN only)
router.put(
  '/:key',
  roleMiddleware('ADMIN'),
  validateParams(settingKeyParamSchema),
  validateBody(updateSettingSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = req.params.key as string;
      const { value, description } = req.body as { value: string; description?: string };

      // Validate value based on key
      const validationError = validateSettingValue(key, value);
      if (validationError) {
        throw new AppError(validationError, 400, 'VALIDATION_ERROR');
      }

      const setting = await setSetting(key, value, description);

      logger.info('Setting updated', { key, value });

      res.json({ data: setting });
    } catch (error) {
      next(error);
    }
  }
);

// Helper function to get setting description
function getSettingDescription(key: string): string {
  const descriptions: Record<string, string> = {
    POINTS_RATIO: 'Nombre de points attribués par euro dépensé',
    POINTS_ROUNDING: 'Méthode d\'arrondi des points (floor, ceil, round)',
    MIN_ELIGIBLE_AMOUNT: 'Montant minimum pour gagner des points (en euros)',
  };
  return descriptions[key] || '';
}

// Helper function to validate setting value
function validateSettingValue(key: string, value: string): string | null {
  switch (key) {
    case 'POINTS_RATIO': {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        return 'Le ratio doit être un nombre positif';
      }
      break;
    }
    case 'POINTS_ROUNDING': {
      if (!['floor', 'ceil', 'round'].includes(value)) {
        return 'Méthode d\'arrondi invalide (floor, ceil, round)';
      }
      break;
    }
    case 'MIN_ELIGIBLE_AMOUNT': {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        return 'Le montant minimum doit être un nombre positif ou zéro';
      }
      break;
    }
  }
  return null;
}

export default router;
