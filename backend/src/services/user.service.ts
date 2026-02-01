import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { addPointsWithRetry, sendNotification, fetchCerthisPoints } from './snapss.service.js';

export interface UserSummary {
  userEmail: string;
  userName: string | null;
  userPhone: string | null;
  totalTransactions: number;
  totalAmount: number;
  totalEligible: number;
  totalPoints: number;
  lastTransactionDate: Date | null;
}

export interface UserPointsAdjustment {
  userEmail: string;
  delta: number; // points to add (positive) or remove (negative)
  reason: string;
  adminId: number;
  sendNotification?: boolean; // default: false
}

/**
 * Get current total points for a user from all their transactions
 */
export const getUserCurrentPoints = async (userEmail: string): Promise<number> => {
  const result = await prisma.transaction.aggregate({
    where: { userEmail: userEmail.toLowerCase() },
    _sum: { pointsCalculated: true },
  });
  return result._sum.pointsCalculated || 0;
};

/**
 * Update user's currentPoints in the database
 * Used after processing a transaction
 */
export const updateUserCurrentPoints = async (userEmail: string, newTotal: number): Promise<void> => {
  await prisma.user.update({
    where: { email: userEmail.toLowerCase() },
    data: { currentPoints: newTotal },
  });
};

/**
 * Get all users with their aggregated points from transactions
 */
export const getAllUsers = async (params?: {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<{ users: UserSummary[]; total: number }> => {
  const { search, page = 1, limit = 20, sortBy = 'totalPoints', sortOrder = 'desc' } = params || {};

  logger.info('Fetching all users', { search, page, limit, sortBy, sortOrder });

  // Get aggregated data from transactions
  const aggregation = await prisma.transaction.groupBy({
    by: ['userEmail'],
    _sum: {
      pointsCalculated: true,
    },
    _count: {
      id: true,
    },
    _max: {
      createdAt: true,
    },
  });

  // Get user details for each email
  const userEmails = aggregation.map(a => a.userEmail);

  // Get the most recent transaction for each user to get their name/phone
  const userDetails = await prisma.transaction.findMany({
    where: {
      userEmail: { in: userEmails },
    },
    select: {
      userEmail: true,
      userName: true,
      userPhone: true,
      totalAmount: true,
      eligibleAmount: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Get currentPoints from User table
  const userRecords = await prisma.user.findMany({
    where: {
      email: { in: userEmails.map(e => e.toLowerCase()) },
    },
    select: {
      email: true,
      currentPoints: true,
    },
  });

  // Build a map of email -> currentPoints
  const userPointsMap = new Map<string, number>();
  for (const record of userRecords) {
    userPointsMap.set(record.email.toLowerCase(), record.currentPoints);
  }

  // Build user map with details
  const userMap = new Map<string, {
    userName: string | null;
    userPhone: string | null;
    totalAmount: number;
    totalEligible: number;
  }>();

  for (const detail of userDetails) {
    if (!userMap.has(detail.userEmail)) {
      userMap.set(detail.userEmail, {
        userName: detail.userName,
        userPhone: detail.userPhone,
        totalAmount: 0,
        totalEligible: 0,
      });
    }
    const user = userMap.get(detail.userEmail)!;
    user.totalAmount += parseFloat(detail.totalAmount.toString());
    user.totalEligible += parseFloat(detail.eligibleAmount.toString());
  }

  // Combine aggregation with user details
  let users: UserSummary[] = aggregation.map(agg => {
    const details = userMap.get(agg.userEmail);
    // Prefer currentPoints from User table, fall back to transaction sum
    const currentPoints = userPointsMap.get(agg.userEmail.toLowerCase());
    const totalPoints = currentPoints !== undefined ? currentPoints : (agg._sum.pointsCalculated || 0);
    return {
      userEmail: agg.userEmail,
      userName: details?.userName || null,
      userPhone: details?.userPhone || null,
      totalTransactions: agg._count.id,
      totalAmount: details?.totalAmount || 0,
      totalEligible: details?.totalEligible || 0,
      totalPoints,
      lastTransactionDate: agg._max.createdAt,
    };
  });

  // Filter by search if provided
  if (search) {
    const searchLower = search.toLowerCase();
    users = users.filter(u =>
      u.userEmail.toLowerCase().includes(searchLower) ||
      (u.userName && u.userName.toLowerCase().includes(searchLower))
    );
  }

  // Sort
  users.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'userEmail':
        comparison = a.userEmail.localeCompare(b.userEmail);
        break;
      case 'userName':
        comparison = (a.userName || '').localeCompare(b.userName || '');
        break;
      case 'totalTransactions':
        comparison = a.totalTransactions - b.totalTransactions;
        break;
      case 'totalAmount':
        comparison = a.totalAmount - b.totalAmount;
        break;
      case 'totalPoints':
      default:
        comparison = a.totalPoints - b.totalPoints;
        break;
      case 'lastTransactionDate':
        const dateA = a.lastTransactionDate?.getTime() || 0;
        const dateB = b.lastTransactionDate?.getTime() || 0;
        comparison = dateA - dateB;
        break;
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  const total = users.length;

  // Paginate
  const offset = (page - 1) * limit;
  const paginatedUsers = users.slice(offset, offset + limit);

  logger.info('Users fetched', { total, returned: paginatedUsers.length });

  return { users: paginatedUsers, total };
};

/**
 * Get a single user by email with their transactions
 */
export const getUserByEmail = async (email: string): Promise<UserSummary | null> => {
  logger.info('Fetching user by email', { email });

  const transactions = await prisma.transaction.findMany({
    where: { userEmail: email },
    orderBy: { createdAt: 'desc' },
  });

  if (transactions.length === 0) {
    return null;
  }

  const latestTransaction = transactions[0]!;

  const summary: UserSummary = {
    userEmail: email,
    userName: latestTransaction.userName,
    userPhone: latestTransaction.userPhone,
    totalTransactions: transactions.length,
    totalAmount: transactions.reduce((sum, t) => sum + parseFloat(t.totalAmount.toString()), 0),
    totalEligible: transactions.reduce((sum, t) => sum + parseFloat(t.eligibleAmount.toString()), 0),
    totalPoints: transactions.reduce((sum, t) => sum + t.pointsCalculated, 0),
    lastTransactionDate: latestTransaction.createdAt,
  };

  return summary;
};

/**
 * Adjust user points via Certhis API
 * Always fetches current points from Certhis (source of truth) before applying delta
 */
export const adjustUserPoints = async (adjustment: UserPointsAdjustment): Promise<{
  success: boolean;
  message: string;
  newTotal?: number;
  snapssResult?: unknown;
}> => {
  const { userEmail, delta, reason, adminId, sendNotification: shouldNotify = false } = adjustment;

  logger.info('Adjusting user points', { userEmail, delta, reason, adminId, sendNotification: shouldNotify });

  // Validate delta (cannot be 0)
  if (delta === 0) {
    return { success: false, message: 'Delta cannot be 0' };
  }

  try {
    // Get user to retrieve tokenId
    const user = await prisma.user.findUnique({
      where: { email: userEmail.toLowerCase() },
      select: { id: true, tokenId: true, currentPoints: true },
    });

    if (!user) {
      return { success: false, message: 'User not found in database' };
    }

    if (!user.tokenId) {
      return { success: false, message: 'User tokenId not found, cannot update points' };
    }

    // Fetch current points from Certhis (source of truth)
    const currentCerthisPoints = await fetchCerthisPoints(user.tokenId);
    const newTotalPoints = currentCerthisPoints + delta;

    // Validate new total (must be >= 0)
    if (newTotalPoints < 0) {
      return {
        success: false,
        message: `Cannot reduce points below 0. Current: ${currentCerthisPoints}, delta: ${delta}`
      };
    }

    logger.info('Calculating new points total', {
      userEmail,
      currentCerthisPoints,
      delta,
      newTotalPoints,
    });

    // Call Certhis API to set the new points total
    const snapssResult = await addPointsWithRetry(userEmail, newTotalPoints);

    if (!snapssResult.success) {
      logger.error('Certhis points update failed', { userEmail, newTotalPoints, error: snapssResult.error });
      return {
        success: false,
        message: `Failed to update points via Certhis: ${snapssResult.error}`,
        snapssResult,
      };
    }

    // Update user's currentPoints and record adjustment in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { currentPoints: newTotalPoints },
      }),
      prisma.pointsAdjustment.create({
        data: {
          userId: user.id,
          pointsBefore: currentCerthisPoints,
          pointsAfter: newTotalPoints,
          delta,
          reason,
          adminId,
        },
      }),
    ]);

    // Send notification to user (if requested)
    if (shouldNotify) {
      const notificationMessage = `Votre solde de points a ete mis a jour: ${newTotalPoints} point${newTotalPoints > 1 ? 's' : ''}. Raison: ${reason}`;
      await sendNotification(userEmail, notificationMessage);
    }

    logger.info('User points updated successfully', {
      userEmail,
      pointsBefore: currentCerthisPoints,
      newTotal: newTotalPoints,
      delta,
      reason,
      adminId,
    });

    return {
      success: true,
      message: `Points updated: ${delta > 0 ? '+' : ''}${delta} (nouveau total: ${newTotalPoints})`,
      newTotal: newTotalPoints,
      snapssResult,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating user points', { userEmail, delta, error: errorMessage });
    return {
      success: false,
      message: `Error updating points: ${errorMessage}`,
    };
  }
};

/**
 * Get current points from Certhis for a user
 * Returns points from Certhis API (source of truth)
 * Also updates local database with fetched points
 */
export const getUserCerthisPoints = async (email: string): Promise<{
  success: boolean;
  points: number;
  error?: string;
}> => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, tokenId: true, currentPoints: true },
  });

  if (!user) {
    return { success: false, points: 0, error: 'User not found' };
  }

  if (!user.tokenId) {
    return { success: false, points: 0, error: 'User tokenId not found' };
  }

  const points = await fetchCerthisPoints(user.tokenId);

  // Sync local database if points differ
  if (points !== user.currentPoints) {
    await prisma.user.update({
      where: { id: user.id },
      data: { currentPoints: points },
    });
    logger.info('Synced user points from Certhis', {
      email,
      oldPoints: user.currentPoints,
      newPoints: points,
    });
  }

  return { success: true, points };
};

/**
 * Get user transactions
 */
export const getUserTransactions = async (email: string, params?: {
  page?: number;
  limit?: number;
}) => {
  const { page = 1, limit = 20 } = params || {};
  const offset = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { userEmail: email },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.transaction.count({
      where: { userEmail: email },
    }),
  ]);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get user points adjustments history
 */
export const getUserAdjustments = async (email: string, params?: {
  page?: number;
  limit?: number;
}) => {
  const { page = 1, limit = 20 } = params || {};
  const offset = (page - 1) * limit;

  // Get user ID first
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });

  if (!user) {
    return {
      adjustments: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    };
  }

  const [adjustments, total] = await Promise.all([
    prisma.pointsAdjustment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        admin: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    }),
    prisma.pointsAdjustment.count({
      where: { userId: user.id },
    }),
  ]);

  return {
    adjustments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
