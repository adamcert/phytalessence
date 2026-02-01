export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
export type AdminRole = 'ADMIN' | 'VIEWER';

export interface User {
  userId: number;
  email: string;
  role: AdminRole;
  firstName?: string;
  lastName?: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  aliases: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketProduct {
  name: string;
  price: number;
  quantity: number;
}

export interface MatchedProduct {
  ticketProduct: TicketProduct;
  matchedProductId: number | null;
  matchedProductName: string | null;
  matched: boolean;
  eligibleAmount: number;
  matchMethod?: string | null;
}

export interface Transaction {
  id: number;
  ticketId: string;
  userEmail: string;
  userName: string | null;
  userPhone: string | null;
  totalAmount: string;
  eligibleAmount: string;
  pointsCalculated: number;
  pointsAwarded: boolean;
  notificationSent: boolean;
  status: TransactionStatus;
  createdAt: string;
  processedAt: string | null;
  ticketProducts?: TicketProduct[];
  matchedProducts?: MatchedProduct[];
  ticketImageBase64?: string | null;
  errorMessage?: string | null;
}

export interface Admin {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: AdminRole;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Setting {
  key: string;
  value: string;
  description: string;
  isDefault: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TransactionStats {
  total: number;
  today: number;
  byStatus: Record<string, number>;
  totalPointsAwarded: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface UserSummary {
  userEmail: string;
  userName: string | null;
  userPhone: string | null;
  totalTransactions: number;
  totalAmount: number;
  totalEligible: number;
  totalPoints: number;
  lastTransactionDate: string | null;
}
