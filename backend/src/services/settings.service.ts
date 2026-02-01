import { Setting } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

// Default settings values
export const DEFAULT_SETTINGS = {
  POINTS_RATIO: '1', // 1 point per euro
  POINTS_ROUNDING: 'floor', // floor, ceil, round
  MIN_ELIGIBLE_AMOUNT: '0', // Minimum amount to earn points
  NOTIFICATION_MESSAGE_TEMPLATE: 'Felicitations ! Vous avez gagne {points} point(s) fidelite Phytalessence.', // Notification template
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

/**
 * Get a setting value by key
 * Returns default value if setting doesn't exist
 */
export const getSetting = async (key: SettingKey): Promise<string> => {
  const setting = await prisma.setting.findUnique({
    where: { key },
  });

  if (!setting) {
    return DEFAULT_SETTINGS[key];
  }

  return setting.value;
};

/**
 * Get a setting as a number
 */
export const getSettingAsNumber = async (key: SettingKey): Promise<number> => {
  const value = await getSetting(key);
  const parsed = parseFloat(value);

  if (isNaN(parsed)) {
    logger.warn('Invalid numeric setting, using default', { key, value });
    return parseFloat(DEFAULT_SETTINGS[key]);
  }

  return parsed;
};

/**
 * Get all settings
 */
export const getAllSettings = async (): Promise<Record<string, string>> => {
  const settings = await prisma.setting.findMany();

  // Start with defaults
  const result: Record<string, string> = { ...DEFAULT_SETTINGS };

  // Override with database values
  for (const setting of settings) {
    result[setting.key] = setting.value;
  }

  return result;
};

/**
 * Set a setting value (upsert)
 */
export const setSetting = async (
  key: string,
  value: string,
  description?: string
): Promise<Setting> => {
  logger.info('Updating setting', { key, value });

  return prisma.setting.upsert({
    where: { key },
    update: { value, description },
    create: { key, value, description },
  });
};

/**
 * Get formatted notification message using template from settings
 * Replaces {points} placeholder with actual points value
 * Note: Uses lowercase key 'notification_message_template' to match database
 */
export const getNotificationMessage = async (points: number): Promise<string> => {
  // Query database directly with lowercase key (as stored in DB)
  const setting = await prisma.setting.findUnique({
    where: { key: 'notification_message_template' },
  });

  const template = setting?.value || DEFAULT_SETTINGS.NOTIFICATION_MESSAGE_TEMPLATE;
  return template.replace('{points}', String(points));
};

/**
 * Initialize default settings if they don't exist
 */
export const initializeDefaultSettings = async (): Promise<void> => {
  const descriptions: Record<SettingKey, string> = {
    POINTS_RATIO: 'Nombre de points par euro dépensé',
    POINTS_ROUNDING: 'Méthode d\'arrondi des points (floor, ceil, round)',
    MIN_ELIGIBLE_AMOUNT: 'Montant minimum pour gagner des points',
    NOTIFICATION_MESSAGE_TEMPLATE: 'Template du message de notification ({points} sera remplacé par le nombre de points)',
  };

  for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await prisma.setting.findUnique({ where: { key } });

    if (!existing) {
      await prisma.setting.create({
        data: {
          key,
          value: defaultValue,
          description: descriptions[key as SettingKey],
        },
      });
      logger.info('Created default setting', { key, value: defaultValue });
    }
  }
};
