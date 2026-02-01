import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  me: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Products API
export const productsApi = {
  getAll: async (params?: { page?: number; limit?: number; search?: string; activeOnly?: boolean }) => {
    const response = await api.get('/products', { params });
    return response.data;
  },
  getById: async (id: number) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },
  create: async (data: { name: string; sku?: string; active?: boolean }) => {
    const response = await api.post('/products', data);
    return response.data;
  },
  update: async (id: number, data: { name?: string; sku?: string; active?: boolean }) => {
    const response = await api.put(`/products/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },
  import: async (products: Array<{ name: string; sku?: string }>) => {
    const response = await api.post('/products/import', { products });
    return response.data;
  },
};

// Transactions API
export const transactionsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    userEmail?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const response = await api.get('/transactions', { params });
    return response.data;
  },
  getById: async (id: number) => {
    const response = await api.get(`/transactions/${id}`);
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/transactions/stats');
    return response.data;
  },
  reprocess: async (id: number, force?: boolean) => {
    const response = await api.post(`/transactions/${id}/reprocess`, { force });
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/transactions/${id}`);
    return response.data;
  },
};

// Settings API
export const settingsApi = {
  getAll: async () => {
    const response = await api.get('/settings');
    return response.data;
  },
  update: async (key: string, value: string) => {
    const response = await api.put(`/settings/${key}`, { value });
    return response.data;
  },
};

// Admins API
export const adminsApi = {
  getAll: async () => {
    const response = await api.get('/admins');
    return response.data;
  },
  getById: async (id: number) => {
    const response = await api.get(`/admins/${id}`);
    return response.data;
  },
  create: async (data: { email: string; password: string; firstName?: string; lastName?: string; role?: string }) => {
    const response = await api.post('/admins', data);
    return response.data;
  },
  update: async (id: number, data: { email?: string; firstName?: string; lastName?: string; role?: string }) => {
    const response = await api.put(`/admins/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/admins/${id}`);
    return response.data;
  },
  resetPassword: async (id: number, newPassword: string) => {
    const response = await api.post(`/admins/${id}/reset-password`, { newPassword });
    return response.data;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post('/admins/me/change-password', { currentPassword, newPassword });
    return response.data;
  },
};

// Export API
export const exportApi = {
  transactions: async (params?: { status?: string; startDate?: string; endDate?: string }) => {
    const response = await api.get('/export/transactions', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
  products: async () => {
    const response = await api.get('/export/products', {
      responseType: 'blob',
    });
    return response.data;
  },
};

// Users API
export const usersApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    const response = await api.get('/users', { params });
    return response.data;
  },
  getById: async (email: string) => {
    const response = await api.get(`/users/${encodeURIComponent(email)}`);
    return response.data;
  },
  getTransactions: async (email: string, params?: { page?: number; limit?: number }) => {
    const response = await api.get(`/users/${encodeURIComponent(email)}/transactions`, { params });
    return response.data;
  },
  adjustPoints: async (email: string, delta: number, reason: string, sendNotification: boolean = false) => {
    const response = await api.post(`/users/${encodeURIComponent(email)}/points`, { delta, reason, sendNotification });
    return response.data;
  },
  getAdjustments: async (email: string, params?: { page?: number; limit?: number }) => {
    const response = await api.get(`/users/${encodeURIComponent(email)}/adjustments`, { params });
    return response.data;
  },
  getCerthisPoints: async (email: string) => {
    const response = await api.get(`/users/${encodeURIComponent(email)}/certhis-points`);
    return response.data;
  },
};
