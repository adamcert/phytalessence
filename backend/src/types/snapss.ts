/**
 * Snapss API Types
 * Based on the Snapss webhook format
 */

// Actions disponibles sur l'API Snapss
export type SnapssAction = 'add_points' | 'send_notification';

// Paramètres de requête pour l'API Snapss
export interface SnapssQueryParams {
  api_key: string;
  api_pass: string;
  api_key_dn: string;
  api_pass_dn: string;
  template_id: string;
  collection_index: string;
  crm: 'custom';
  action: SnapssAction;
  points?: number;
  notification?: string;
}

// Body de la requête (uniquement l'email)
export interface SnapssRequestBody {
  email: string;
}

// Response from Snapss API
export interface SnapssApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: Record<string, unknown>;
}

// Payload pour ajouter des points
export interface AddPointsPayload {
  email: string;
  points: number;
}

// Payload pour envoyer une notification
export interface SendNotificationPayload {
  email: string;
  notification: string;
}

// Notification payload for points awarded (used by processing service)
export interface PointsNotificationPayload {
  userEmail: string;
  pointsAwarded: number;
  totalPoints?: number;
  transactionId: number;
  ticketId: string;
}

// Result of Snapss API call
export interface SnapssResult {
  success: boolean;
  snapssResponse?: SnapssApiResponse;
  error?: string;
  sentAt: Date;
}

// Alias pour compatibilité
export type NotificationResult = SnapssResult;
