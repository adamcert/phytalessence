import { logger } from '../utils/logger.js';
import { getSettingAsNumber, getSetting } from './settings.service.js';

export interface PointsCalculationResult {
  eligibleAmount: number;
  pointsRatio: number;
  rawPoints: number;
  roundedPoints: number;
  roundingMethod: string;
}

type RoundingMethod = 'floor' | 'ceil' | 'round';

/**
 * Round points based on the configured rounding method
 */
const applyRounding = (value: number, method: RoundingMethod): number => {
  switch (method) {
    case 'ceil':
      return Math.ceil(value);
    case 'round':
      return Math.round(value);
    case 'floor':
    default:
      return Math.floor(value);
  }
};

/**
 * Calculate points from an eligible amount
 * Uses configurable ratio from settings (default: 1 point per euro)
 */
export const calculatePoints = async (
  eligibleAmount: number
): Promise<PointsCalculationResult> => {
  // Get settings
  const pointsRatio = await getSettingAsNumber('POINTS_RATIO');
  const minEligibleAmount = await getSettingAsNumber('MIN_ELIGIBLE_AMOUNT');
  const roundingMethod = (await getSetting('POINTS_ROUNDING')) as RoundingMethod;

  // Check minimum eligible amount
  if (eligibleAmount < minEligibleAmount) {
    logger.info('Amount below minimum threshold', {
      eligibleAmount,
      minEligibleAmount,
    });

    return {
      eligibleAmount,
      pointsRatio,
      rawPoints: 0,
      roundedPoints: 0,
      roundingMethod,
    };
  }

  // Calculate raw points
  const rawPoints = eligibleAmount * pointsRatio;

  // Apply rounding
  const roundedPoints = applyRounding(rawPoints, roundingMethod);

  logger.info('Points calculated', {
    eligibleAmount,
    pointsRatio,
    rawPoints,
    roundedPoints,
    roundingMethod,
  });

  return {
    eligibleAmount,
    pointsRatio,
    rawPoints,
    roundedPoints,
    roundingMethod,
  };
};

/**
 * Calculate points with a specific ratio (for testing or preview)
 */
export const calculatePointsWithRatio = (
  eligibleAmount: number,
  pointsRatio: number,
  roundingMethod: RoundingMethod = 'floor'
): PointsCalculationResult => {
  const rawPoints = eligibleAmount * pointsRatio;
  const roundedPoints = applyRounding(rawPoints, roundingMethod);

  return {
    eligibleAmount,
    pointsRatio,
    rawPoints,
    roundedPoints,
    roundingMethod,
  };
};
