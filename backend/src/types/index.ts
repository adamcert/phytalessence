import { Request } from 'express';
import { AdminRole } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
    role: AdminRole;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
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

export interface AdminSafeData {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: AdminRole;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
