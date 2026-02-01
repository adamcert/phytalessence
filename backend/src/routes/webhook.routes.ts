import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { snapssWebhookSchema } from '../validators/webhook.validator.js';
import { createTransaction, getTransactionByTicketId } from '../services/transaction.service.js';
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

    // Check for duplicate ticket
    const existingTransaction = await getTransactionByTicketId(ticketId);

    if (existingTransaction) {
      logger.warn('Duplicate ticket received', {
        ticketId,
        existingTransactionId: existingTransaction.id,
      });

      res.status(200).json({
        received: true,
        transactionId: existingTransaction.id,
        message: 'Ticket déjà traité',
        duplicate: true,
      });
      return;
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
