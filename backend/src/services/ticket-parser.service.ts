import { logger } from '../utils/logger.js';
import { TicketProduct, MatchedProductV2, NormalizedProduct, SnapssWebhookPayload } from '../validators/webhook.validator.js';

/**
 * Brand prefixes that indicate multi-line product names
 */
const BRAND_PREFIXES = ['PHYTALESSENCE', 'PHYTALESS', 'PHYTALES'];

const MIN_CONFIDENCE = 7;

/**
 * Detect if payload uses new format (v2 with matched_products)
 */
export function isNewFormat(ticketData: SnapssWebhookPayload['ticket_data']): boolean {
  return Array.isArray(ticketData.matched_products);
}

/**
 * Normalize new format matched_products into NormalizedProduct[]
 * Filters by confidence >= MIN_CONFIDENCE
 */
export function parseNewFormatProducts(
  matchedProducts: MatchedProductV2[]
): NormalizedProduct[] {
  const result: NormalizedProduct[] = [];

  for (const mp of matchedProducts) {
    if (mp.confidence < MIN_CONFIDENCE) {
      logger.info('Skipping low confidence product', {
        name: mp.matched_name || mp.raw_text,
        confidence: mp.confidence,
        minRequired: MIN_CONFIDENCE,
      });
      continue;
    }

    const name = mp.matched_name || mp.raw_text || 'Unknown';
    const rawText = mp.raw_text || mp.matched_name || 'Unknown';

    result.push({
      name,
      rawText,
      quantity: mp.quantity || 1,
      unitPrice: mp.unit_price || 0,
      totalPrice: mp.total_price || 0,
      discount: mp.discount || 0,
      confidence: mp.confidence || 0,
      isNewFormat: true,
    });
  }

  logger.info('New format products parsed', {
    inputCount: matchedProducts.length,
    outputCount: result.length,
    filteredByConfidence: matchedProducts.length - result.length,
    totalEligible: result.reduce((sum, p) => sum + p.totalPrice, 0).toFixed(2),
    totalDiscount: result.reduce((sum, p) => sum + p.discount, 0).toFixed(2),
  });

  return result;
}

/**
 * Parse and correct old format Snapss ticket products (legacy)
 * - Merges multi-line product names (PHYTALESSENCE + RHODIOLA 60 + GELULES)
 * - Removes items with 100% discount
 */
export function parseTicketProducts(
  products: TicketProduct[],
  expectedTotal: number
): NormalizedProduct[] {
  if (!products || products.length === 0) {
    return [];
  }

  const parsed: TicketProduct[] = [];
  let i = 0;

  while (i < products.length) {
    const current = products[i];
    if (!current) {
      i++;
      continue;
    }

    const upperName = current.name.toUpperCase().trim();

    // Check if this is a brand prefix that needs merging
    const isBrandPrefix = BRAND_PREFIXES.some(prefix => upperName === prefix);

    if (isBrandPrefix) {
      // Look ahead to merge following lines with same price
      let mergedName = current.name;
      let j = i + 1;

      while (j < products.length) {
        const next = products[j];
        if (!next) break;

        // Same price = likely continuation of product name
        if (next.price === current.price) {
          mergedName = `${mergedName} ${next.name}`.trim();
          j++;
        } else {
          break;
        }
      }

      // Check if next item after merge is a 100% discount (same price negative or remise)
      if (j < products.length) {
        const afterMerge = products[j];
        if (afterMerge && (
          afterMerge.price === -current.price ||
          (afterMerge.name.toLowerCase().includes('remise') && Math.abs(afterMerge.price) === current.price)
        )) {
          logger.info('Skipping discounted duplicate', {
            product: mergedName,
            discount: afterMerge.name
          });
          j++; // Skip the discount line

          // Also check if there's another identical product + discount
          if (j < products.length && j + 1 < products.length) {
            const nextProduct = products[j];
            const nextDiscount = products[j + 1];
            if (nextProduct && nextDiscount &&
                nextProduct.price === current.price &&
                (nextDiscount.price === -current.price ||
                 nextDiscount.name.toLowerCase().includes('remise'))) {
              j += 2;
            }
          }
        }
      }

      parsed.push({
        name: mergedName,
        quantity: current.quantity,
        price: current.price,
      });

      i = j;
    } else {
      // Regular product - check for discount on next line
      if (i + 1 < products.length) {
        const next = products[i + 1];
        if (next && (
          next.price === -current.price ||
          (next.name.toLowerCase().includes('remise') && next.price < 0)
        )) {
          logger.info('Skipping fully discounted product', {
            product: current.name
          });
          i += 2;
          continue;
        }
      }

      parsed.push({
        name: current.name,
        quantity: current.quantity,
        price: current.price,
      });
      i++;
    }
  }

  // Log the correction results
  const originalTotal = products.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const parsedTotal = parsed.reduce((sum, p) => sum + p.price * p.quantity, 0);

  if (parsed.length !== products.length || Math.abs(parsedTotal - originalTotal) > 0.01) {
    logger.info('Ticket products parsed (legacy)', {
      originalCount: products.length,
      parsedCount: parsed.length,
      originalTotal: originalTotal.toFixed(2),
      parsedTotal: parsedTotal.toFixed(2),
      expectedTotal: expectedTotal.toFixed(2),
      accurate: Math.abs(parsedTotal - expectedTotal) < 0.10,
    });
  }

  // Convert to NormalizedProduct (old format: no discount info)
  return parsed.map(p => ({
    name: p.name,
    rawText: p.name,
    quantity: p.quantity,
    unitPrice: p.price,
    totalPrice: p.price * p.quantity,  // no discount in old format
    discount: 0,
    confidence: 10, // old format = trusted
    isNewFormat: false,
  }));
}
