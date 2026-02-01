import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  database: {
    url: process.env.DATABASE_URL || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 1000 : 100, // limit each IP to N requests per windowMs
  },

  snapss: {
    host: process.env.SNAPSS_HOST || '',
    apiKey: process.env.SNAPSS_API_KEY || '',
    apiPass: process.env.SNAPSS_API_PASS || '',
    apiKeyDn: process.env.SNAPSS_API_KEY_DN || '',
    apiPassDn: process.env.SNAPSS_API_PASS_DN || '',
    templateId: process.env.SNAPSS_TEMPLATE_ID || '',
    collectionIndex: process.env.SNAPSS_COLLECTION_INDEX || '',
  },

  certhis: {
    apiUrl: process.env.CERTHIS_API_URL || 'https://dynamic-api.certhis.io',
    apiKey: process.env.CERTHIS_API_KEY || '',
    apiPass: process.env.CERTHIS_API_PASS || '',
    collectionAddress: process.env.CERTHIS_COLLECTION_ADDRESS || '',
    chainId: process.env.CERTHIS_CHAIN_ID || '137',
    // Notification API credentials
    notificationApiKey: process.env.CERTHIS_NOTIFICATION_API_KEY || '',
    notificationApiSecret: process.env.CERTHIS_NOTIFICATION_API_SECRET || '',
  },
} as const;

export type Config = typeof config;
