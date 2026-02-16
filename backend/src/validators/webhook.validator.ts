import { z } from 'zod';

// === OLD FORMAT (legacy) ===
const ticketProductSchema = z.object({
  name: z.string().min(1, 'Nom du produit requis'),
  quantity: z.number().positive('Quantité doit être positive'),
  price: z.number().nonnegative('Prix doit être positif ou zéro'),
});

// === NEW FORMAT (v2 - with discounts) ===
const matchedProductSchema = z.object({
  raw_text: z.string().optional(),
  matched_name: z.string().optional(),
  quantity: z.number().default(1),
  unit_price: z.number().nonnegative().default(0),
  total_price: z.number().default(0),
  discount: z.number().default(0),
  confidence: z.number().default(0),
});

const otherProductSchema = z.object({
  raw_text: z.string().optional(),
  matched_name: z.string().optional(),
  quantity: z.number().default(1),
  unit_price: z.number().default(0),
  total_price: z.number().default(0),
  discount: z.number().default(0),
  confidence: z.number().default(0),
}).passthrough();

// Wallet object (user info) - accept null values from Snapss
const walletObjectSchema = z.object({
  email: z.string().email('Email invalide'),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});

// Ticket data - supports both old and new format
const ticketDataSchema = z.object({
  ticket_id: z.string().min(1, 'Ticket ID requis'),
  // Old format fields (optional for new format)
  total_amount: z.number().nonnegative().optional(),
  products: z.array(ticketProductSchema).optional(),
  // New format fields
  matched_products: z.array(matchedProductSchema).optional(),
  potential_products: z.array(otherProductSchema).optional(),
  other_products: z.array(otherProductSchema).optional(),
  total_receipt: z.number().optional(),
  total_matched_before_discount: z.number().optional(),
  total_matched_after_all_discounts: z.number().optional(),
  total_product_discount: z.number().optional(),
  total_matched: z.number().optional(),
  total_potential: z.number().optional(),
  overall_confidence: z.number().optional(),
  brand_searched: z.string().optional(),
  store_name: z.string().nullable().optional(),
  purchase_date: z.string().nullable().optional(),
  // Shared fields
  currency: z.string().default('EUR'),
  authenticity_score: z.number().optional(),
  total_discount: z.number().optional(),
  image_hash: z.string().optional(),
  image_processed_at: z.string().optional(),
}).refine(
  (data) => (data.products && data.products.length > 0) || (data.matched_products && data.matched_products.length >= 0),
  { message: 'Au moins products ou matched_products requis' }
);

// NFT object (optional)
const nftObjectSchema = z.object({
  id: z.number().optional(),
  nft_id: z.number().optional(), // This is the actual token ID for Certhis API
  collection_object: z.object({
    collection_name: z.string().optional(),
  }).optional(),
}).passthrough().optional();

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
export type MatchedProductV2 = z.infer<typeof matchedProductSchema>;

/** Internal normalized product used throughout the pipeline */
export interface NormalizedProduct {
  name: string;
  rawText: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;       // price after discount (line total)
  discount: number;
  confidence: number;
  isNewFormat: boolean;
}
