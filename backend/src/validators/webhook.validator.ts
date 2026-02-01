import { z } from 'zod';

// Product in ticket
const ticketProductSchema = z.object({
  name: z.string().min(1, 'Nom du produit requis'),
  quantity: z.number().positive('Quantité doit être positive'),
  price: z.number().nonnegative('Prix doit être positif ou zéro'),
});

// Wallet object (user info) - accept null values from Snapss
const walletObjectSchema = z.object({
  email: z.string().email('Email invalide'),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});

// Ticket data
const ticketDataSchema = z.object({
  ticket_id: z.string().min(1, 'Ticket ID requis'),
  total_amount: z.number().nonnegative('Montant total doit être positif'),
  currency: z.string().default('EUR'),
  authenticity_score: z.number().optional(),
  total_discount: z.number().optional(),
  image_hash: z.string().optional(),
  image_processed_at: z.string().optional(),
  products: z.array(ticketProductSchema).min(1, 'Au moins un produit requis'),
});

// NFT object (optional)
const nftObjectSchema = z.object({
  id: z.number().optional(),
  collection_object: z.object({
    collection_name: z.string().optional(),
  }).optional(),
}).optional();

// Ticket image (optional)
const ticketImageSchema = z.object({
  base64: z.string().optional(),
  mime_type: z.string().optional(),
  filename: z.string().optional(),
  size: z.number().optional(),
}).optional();

// Gate object (optional) - action can be string or object
const gateObjectSchema = z.object({
  title: z.string().nullable().optional(),
  action: z.union([z.string(), z.object({
    update_attributes: z.array(z.any()).optional(),
  })]).optional(),
}).passthrough().optional();

// Action object (optional)
const actionSchema = z.object({
  update_attributes: z.array(z.any()).optional(),
}).optional();

// Complete Snapss webhook payload - use passthrough to accept extra fields
export const snapssWebhookSchema = z.object({
  nft_object: nftObjectSchema,
  wallet_object: walletObjectSchema,
  ticket_data: ticketDataSchema,
  ticket_image: ticketImageSchema,
  gate_object: gateObjectSchema,
  action: actionSchema,
}).passthrough();

export type SnapssWebhookPayload = z.infer<typeof snapssWebhookSchema>;
export type TicketProduct = z.infer<typeof ticketProductSchema>;
