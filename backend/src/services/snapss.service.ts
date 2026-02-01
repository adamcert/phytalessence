import axios, { AxiosError } from 'axios';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import prisma from '../utils/prisma.js';
import { getNotificationMessage } from './settings.service.js';
import {
  SnapssApiResponse,
  SnapssResult,
  PointsNotificationPayload,
  NotificationResult,
} from '../types/snapss.js';

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 8000,  // 8 seconds max
};

/**
 * Sleep for a given number of milliseconds
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate delay with exponential backoff
 */
const calculateBackoffDelay = (attempt: number): number => {
  const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
};

/**
 * Check if Certhis API is properly configured
 */
export const isCerthisConfigured = (): boolean => {
  const { apiUrl, apiKey, apiPass } = config.certhis;
  return !!(apiUrl && apiKey && apiPass);
};

/**
 * Check if Card refresh is properly configured
 */
const isRefreshConfigured = (): boolean => {
  const { collectionAddress, chainId } = config.certhis;
  return !!(collectionAddress && chainId);
};

/**
 * Certhis NFT API response type
 */
interface CerthisNftResponse {
  status: boolean;
  message: string;
  data: {
    ipfs_object?: {
      attributes?: Array<{
        trait_type: string;
        value: string;
      }>;
    };
  };
}

/**
 * Fetch current points from Certhis API
 * This is the source of truth for user points
 */
export const fetchCerthisPoints = async (tokenId: string): Promise<number> => {
  if (!isRefreshConfigured()) {
    logger.warn('Certhis not configured, cannot fetch points');
    return 0;
  }

  const url = `https://api.certhis.io/nft?nft_id=${tokenId}&chain_id=${config.certhis.chainId}&collection_address=${config.certhis.collectionAddress}`;

  try {
    const response = await axios.get<CerthisNftResponse>(url, { timeout: 10000 });

    const attributes = response.data?.data?.ipfs_object?.attributes;
    if (!attributes || !Array.isArray(attributes)) {
      logger.info('No attributes found in Certhis response', { tokenId });
      return 0;
    }

    const pointsAttribute = attributes.find(attr => attr.trait_type === 'points');
    const currentPoints = pointsAttribute ? parseInt(pointsAttribute.value, 10) || 0 : 0;

    logger.info('Fetched current points from Certhis', { tokenId, currentPoints });
    return currentPoints;
  } catch (error) {
    const axiosError = error as AxiosError;
    logger.error('Failed to fetch points from Certhis', {
      tokenId,
      error: axiosError.message,
      status: axiosError.response?.status,
    });
    return 0;
  }
};

/**
 * Refresh Card metadata via Certhis public API
 * This ensures the updated points are visible immediately
 */
const refreshCard = async (nftId: string): Promise<void> => {
  if (!isRefreshConfigured()) {
    logger.warn('Card refresh not configured, skipping refresh');
    return;
  }

  const url = `https://api.certhis.io/nft?nft_id=${nftId}&chain_id=${config.certhis.chainId}&collection_address=${config.certhis.collectionAddress}&refresh=1`;

  logger.info('Card refresh request', { url, nftId });

  try {
    const response = await axios.get(url, { timeout: 10000 });
    logger.info('Card refresh successful', { nftId, response: response.data });
  } catch (error) {
    const axiosError = error as AxiosError;
    logger.warn('Card refresh failed (non-blocking)', {
      nftId,
      url,
      error: axiosError.message,
      status: axiosError.response?.status,
      responseData: axiosError.response?.data,
    });
    // Don't throw - refresh failure should not block the main operation
  }
};

/**
 * Get user's NFT ID and Token ID from the database
 */
const getUserNftData = async (email: string): Promise<{ nftId: string | null; tokenId: string | null }> => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { nftId: true, tokenId: true },
  });
  return {
    nftId: user?.nftId || null,
    tokenId: user?.tokenId || null,
  };
};

/**
 * Update points for a user via Certhis API
 * Uses the NFT attribute endpoint to set the points value
 */
export const addPoints = async (email: string, points: number): Promise<SnapssResult> => {
  if (!isCerthisConfigured()) {
    logger.warn('Certhis API not configured, skipping add_points');
    return {
      success: false,
      error: 'Certhis API not configured',
      sentAt: new Date(),
    };
  }

  // Get user's NFT ID and Token ID from database
  const { nftId, tokenId } = await getUserNftData(email);

  if (!tokenId) {
    logger.warn('User Token ID not found, cannot update points', { email });
    return {
      success: false,
      error: 'User Token ID not found in database',
      sentAt: new Date(),
    };
  }

  const url = `${config.certhis.apiUrl}/nft/attribute`;

  logger.info('Sending points to Certhis API', { email, points, tokenId });

  try {
    const response = await axios.post<SnapssApiResponse>(
      url,
      {
        nft_id: tokenId,
        attribute_name: 'points',
        attribute_value: String(points),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api_key': config.certhis.apiKey,
          'api_pass': config.certhis.apiPass,
        },
        timeout: 10000,
      }
    );

    logger.info('Certhis add_points successful', {
      email,
      points,
      tokenId,
      response: response.data,
    });

    // Refresh Card to ensure updated points are visible immediately
    // Small delay to allow the update to propagate before refresh
    await sleep(500);
    await refreshCard(tokenId);

    return {
      success: true,
      snapssResponse: response.data,
      sentAt: new Date(),
    };
  } catch (error) {
    const axiosError = error as AxiosError<SnapssApiResponse>;
    const errorMessage = axiosError.response?.data?.error || axiosError.message;

    logger.error('Certhis add_points failed', {
      email,
      points,
      tokenId,
      error: errorMessage,
      status: axiosError.response?.status,
      responseData: axiosError.response?.data,
    });

    return {
      success: false,
      error: errorMessage,
      sentAt: new Date(),
    };
  }
};

/**
 * Check if Snapss notification is properly configured
 */
const isSnapssNotificationConfigured = (): boolean => {
  const { host, apiKey, apiPass, apiKeyDn, apiPassDn, templateId, collectionIndex } = config.snapss;
  return !!(host && apiKey && apiPass && apiKeyDn && apiPassDn && templateId && collectionIndex);
};

/**
 * Send a notification to a user via Snapss webhook
 * Uses POST request with email in body
 */
export const sendNotification = async (email: string, message: string): Promise<SnapssResult> => {
  if (!isSnapssNotificationConfigured()) {
    logger.warn('Snapss notification not configured, skipping send_notification');
    return {
      success: false,
      error: 'Snapss notification not configured',
      sentAt: new Date(),
    };
  }

  const params = new URLSearchParams({
    api_key: config.snapss.apiKey,
    api_pass: config.snapss.apiPass,
    api_key_dn: config.snapss.apiKeyDn,
    api_pass_dn: config.snapss.apiPassDn,
    template_id: config.snapss.templateId,
    collection_index: config.snapss.collectionIndex,
    crm: 'custom',
    action: 'send_notification',
    notification: message,
  });

  const url = `${config.snapss.host}/webhook-snapss?${params.toString()}`;

  logger.info('Sending notification via Snapss', { email, message, url });

  try {
    const response = await axios.post(
      url,
      { email: email },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );

    logger.info('Snapss send_notification successful', {
      email,
      response: response.data,
    });

    return {
      success: true,
      snapssResponse: response.data,
      sentAt: new Date(),
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    const errorMessage = axiosError.response?.data
      ? JSON.stringify(axiosError.response.data)
      : axiosError.message;

    logger.error('Snapss send_notification failed', {
      email,
      error: errorMessage,
      status: axiosError.response?.status,
      responseData: axiosError.response?.data,
    });

    return {
      success: false,
      error: errorMessage,
      sentAt: new Date(),
    };
  }
};

/**
 * Send points and notification to user (combined operation)
 * Used after processing a transaction
 */
export const sendPointsNotification = async (
  payload: PointsNotificationPayload
): Promise<NotificationResult> => {
  const { userEmail, pointsAwarded, transactionId, ticketId } = payload;

  logger.info('Processing points notification', {
    userEmail,
    pointsAwarded,
    transactionId,
    ticketId,
  });

  // 1. Add points
  const pointsResult = await addPoints(userEmail, pointsAwarded);

  if (!pointsResult.success) {
    return pointsResult;
  }

  // 2. Send notification (using template from settings)
  const notificationMessage = await getNotificationMessage(pointsAwarded);
  const notificationResult = await sendNotification(userEmail, notificationMessage);

  return notificationResult;
};

/**
 * Test Certhis connection
 */
export const testCerthisConnection = async (): Promise<boolean> => {
  if (!isCerthisConfigured()) {
    logger.warn('Certhis API not configured');
    return false;
  }

  try {
    // Test with a simple request to the API
    const url = `${config.certhis.apiUrl}/nft/attribute`;
    await axios.post(
      url,
      { nft_id: '0', attribute_name: 'test', attribute_value: 'connection_check' },
      {
        headers: {
          'Content-Type': 'application/json',
          'api_key': config.certhis.apiKey,
          'api_pass': config.certhis.apiPass,
        },
        timeout: 5000,
      }
    );
    logger.info('Certhis connection test successful');
    return true;
  } catch (error) {
    const axiosError = error as AxiosError;
    // If we get a response (even an error), the connection works
    if (axiosError.response) {
      logger.info('Certhis connection test: server reachable');
      return true;
    }
    logger.error('Certhis connection test failed', {
      error: axiosError.message,
    });
    return false;
  }
};

/**
 * Add points with automatic retry and exponential backoff
 * Used for critical operations where we want to ensure delivery
 */
export const addPointsWithRetry = async (
  email: string,
  points: number
): Promise<SnapssResult> => {
  let lastError: string = 'Unknown error';

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = calculateBackoffDelay(attempt - 1);
      logger.info('Retrying Certhis add_points', {
        email,
        points,
        attempt,
        delayMs: delay,
      });
      await sleep(delay);
    }

    const result = await addPoints(email, points);

    if (result.success) {
      if (attempt > 0) {
        logger.info('Certhis add_points succeeded after retry', {
          email,
          points,
          attempts: attempt + 1,
        });
      }
      return result;
    }

    lastError = result.error || 'Unknown error';
    logger.warn('Certhis add_points attempt failed', {
      email,
      points,
      attempt: attempt + 1,
      maxRetries: RETRY_CONFIG.maxRetries + 1,
      error: lastError,
    });
  }

  logger.error('Certhis add_points failed after all retries', {
    email,
    points,
    totalAttempts: RETRY_CONFIG.maxRetries + 1,
    lastError,
  });

  return {
    success: false,
    error: `Failed after ${RETRY_CONFIG.maxRetries + 1} attempts: ${lastError}`,
    sentAt: new Date(),
  };
};

/**
 * Send notification with automatic retry and exponential backoff
 */
export const sendNotificationWithRetry = async (
  email: string,
  notification: string
): Promise<SnapssResult> => {
  let lastError: string = 'Unknown error';

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = calculateBackoffDelay(attempt - 1);
      logger.info('Retrying Certhis send_notification', {
        email,
        attempt,
        delayMs: delay,
      });
      await sleep(delay);
    }

    const result = await sendNotification(email, notification);

    if (result.success) {
      if (attempt > 0) {
        logger.info('Certhis send_notification succeeded after retry', {
          email,
          attempts: attempt + 1,
        });
      }
      return result;
    }

    lastError = result.error || 'Unknown error';
    logger.warn('Certhis send_notification attempt failed', {
      email,
      attempt: attempt + 1,
      maxRetries: RETRY_CONFIG.maxRetries + 1,
      error: lastError,
    });
  }

  logger.error('Certhis send_notification failed after all retries', {
    email,
    totalAttempts: RETRY_CONFIG.maxRetries + 1,
    lastError,
  });

  return {
    success: false,
    error: `Failed after ${RETRY_CONFIG.maxRetries + 1} attempts: ${lastError}`,
    sentAt: new Date(),
  };
};

// Legacy aliases for backward compatibility
export const isSnapssConfigured = isCerthisConfigured;
export const testSnapssConnection = testCerthisConnection;
