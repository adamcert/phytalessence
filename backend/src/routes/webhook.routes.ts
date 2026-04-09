import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { snapssWebhookSchema } from '../validators/webhook.validator.js';
import { createTransaction, getTransactionByTicketId, getTransactionByImageHash, getSuspiciousDuplicate, getDuplicateByProductFingerprint, buildProductFingerprint } from '../services/transaction.service.js';
import { processTransactionAsync } from '../services/processing.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Shared webhook handler for both GET and POST
async function handleWebhook(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  try {
    // Log incoming webhook with all data for debugging
    logger.info('Webhook received', {
      method: req.method,
      ip: req.ip,
      contentType: req.get('content-type'),
      query: req.query,
      bodySize: JSON.stringify(req.body).length,
      body: req.body,
    });

    // Try to get payload from body (POST) or query params (GET)
    let payload = req.body;

    // If body is empty, try query params
    if (!payload || Object.keys(payload).length === 0) {
      // Check if data is in a 'data' query param (JSON string)
      if (req.query.data) {
        try {
          payload = JSON.parse(req.query.data as string);
        } catch {
          logger.warn('Failed to parse data query param');
        }
      } else {
        // Use query params directly
        payload = req.query;
      }
    }

    // Validate payload
    const validationResult = snapssWebhookSchema.safeParse(payload);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      );

      logger.warn('Webhook validation failed', { errors, payload });

      res.status(400).json({
        received: false,
        error: 'Payload invalide',
        details: errors,
      });
      return;
    }

    const validPayload = validationResult.data;
    const ticketId = validPayload.ticket_data.ticket_id;
    const userEmail = validPayload.wallet_object.email;
    const imageHash = validPayload.ticket_data.image_hash;
    const totalAmount = validPayload.ticket_data.total_amount ?? validPayload.ticket_data.total_receipt ?? 0;

    // === ANTI-FRAUD: 4-layer duplicate detection ===

    // Sentinel ticket_ids that mean "OCR could not extract a number".
    // These must NOT be used for duplicate detection — otherwise the first
    // ever "not_found" transaction becomes a ghost that swallows every
    // subsequent failed-OCR ticket from any user.
    const UNKNOWN_TICKET_IDS = new Set(['not_found', 'unknown', 'none', 'null', '']);
    const hasRealTicketId =
      typeof ticketId === 'string' &&
      ticketId.trim().length > 0 &&
      !UNKNOWN_TICKET_IDS.has(ticketId.trim().toLowerCase());

    // Layer 1: Same ticket_id (exact re-send) — skipped when ticket_id is unknown
    if (hasRealTicketId) {
      const existingByTicketId = await getTransactionByTicketId(ticketId);
      if (existingByTicketId) {
        logger.warn('Duplicate ticket: same ticket_id', {
          ticketId,
          existingTransactionId: existingByTicketId.id,
        });
        res.status(200).json({
          received: true,
          transactionId: existingByTicketId.id,
          message: 'Ticket déjà traité',
          duplicate: true,
          reason: 'ticket_id',
        });
        return;
      }
    } else {
      logger.info('Skipping Layer 1 duplicate check: unknown ticket_id', { ticketId });
    }

    // Layer 2: Same image hash (same physical ticket scanned again)
    if (imageHash) {
      const existingByImage = await getTransactionByImageHash(imageHash);
      if (existingByImage) {
        logger.warn('Duplicate ticket: same image_hash', {
          ticketId,
          imageHash,
          existingTransactionId: existingByImage.id,
          existingTicketId: existingByImage.ticketId,
        });
        res.status(200).json({
          received: true,
          transactionId: existingByImage.id,
          message: 'Ce ticket a déjà été scanné',
          duplicate: true,
          reason: 'image_hash',
        });
        return;
      }
    }

    // Layer 3: Same user + same amount within 5 minutes (suspicious re-scan)
    if (userEmail && totalAmount > 0) {
      const suspicious = await getSuspiciousDuplicate(userEmail, totalAmount);
      if (suspicious) {
        logger.warn('Duplicate ticket: suspicious same user+amount within 5min', {
          ticketId,
          userEmail,
          totalAmount,
          existingTransactionId: suspicious.id,
          existingTicketId: suspicious.ticketId,
          timeDiffMs: Date.now() - suspicious.createdAt.getTime(),
        });
        res.status(200).json({
          received: true,
          transactionId: suspicious.id,
          message: 'Ticket similaire déjà traité récemment',
          duplicate: true,
          reason: 'same_user_amount_window',
        });
        return;
      }
    }

    // Layer 4: Same user + same amount + same products (any time, no window)
    // Catches the case where someone re-scans the same physical ticket days later
    if (userEmail && totalAmount > 0) {
      const rawProducts = validPayload.ticket_data.matched_products || validPayload.ticket_data.products || [];
      const fingerprint = buildProductFingerprint(rawProducts);
      if (fingerprint) {
        const duplicate = await getDuplicateByProductFingerprint(userEmail, totalAmount, fingerprint);
        if (duplicate) {
          logger.warn('Duplicate ticket: same user+amount+products (fingerprint match)', {
            ticketId,
            userEmail,
            totalAmount,
            fingerprint,
            existingTransactionId: duplicate.id,
            existingTicketId: duplicate.ticketId,
            daysSinceOriginal: Math.round((Date.now() - duplicate.createdAt.getTime()) / 86400000),
          });
          res.status(200).json({
            received: true,
            transactionId: duplicate.id,
            message: 'Ce ticket a déjà été soumis',
            duplicate: true,
            reason: 'product_fingerprint',
          });
          return;
        }
      }
    }

    // Create transaction
    const transaction = await createTransaction(validPayload);

    const duration = Date.now() - startTime;

    logger.info('Webhook processed successfully', {
      transactionId: transaction.id,
      ticketId,
      userEmail,
      duration: `${duration}ms`,
    });

    // Respond immediately
    res.status(200).json({
      received: true,
      transactionId: transaction.id,
    });

    // Trigger async processing (matching, points, notification)
    processTransactionAsync(transaction.id);

  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof ZodError) {
      logger.warn('Webhook validation error', {
        error: error.message,
        duration: `${duration}ms`,
      });

      res.status(400).json({
        received: false,
        error: 'Payload invalide',
      });
      return;
    }

    logger.error('Webhook processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    });

    next(error);
  }
}

// GET /api/webhook/snapss - Accept webhook via GET
router.get('/snapss', handleWebhook);

// POST /api/webhook/snapss - Accept webhook via POST
router.post('/snapss', handleWebhook);

// Legacy endpoint info
router.get('/snapss/info', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    endpoint: 'Phytalessence CRM Webhook',
    methods: ['GET', 'POST'],
    message: 'Envoyez vos tickets sur cette URL',
  });
});

export default router;
