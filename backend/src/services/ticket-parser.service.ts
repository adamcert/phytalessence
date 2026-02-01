import { logger } from '../utils/logger.js';
import { TicketProduct } from '../validators/webhook.validator.js';

/**
 * Brand prefixes that indicate multi-line product names
 */
const BRAND_PREFIXES = ['PHYTALESSENCE', 'PHYTALESS', 'PHYTALES'];

/**
 * Parse and correct Snapss ticket products
 * - Merges multi-line product names (PHYTALESSENCE + RHODIOLA 60 + GELULES)
 * - Removes items with 100% discount
 */
export function parseTicketProducts(
  products: TicketProduct[],
  expectedTotal: number
): TicketProduct[] {
  if (!products || products.length === 0) {
    return [];
  }

  const result: TicketProduct[] = [];
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
          // This is a "buy one get one free" - skip the second one
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
              // Skip both
              j += 2;
            }
          }
        }
      }

      result.push({
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
          // Product with 100% discount - skip both
          logger.info('Skipping fully discounted product', {
            product: current.name
          });
          i += 2;
          continue;
        }
      }

      result.push({
        name: current.name,
        quantity: current.quantity,
        price: current.price,
      });
      i++;
    }
  }

  // Log the correction results
  const originalTotal = products.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const parsedTotal = result.reduce((sum, p) => sum + p.price * p.quantity, 0);

  if (result.length !== products.length || Math.abs(parsedTotal - originalTotal) > 0.01) {
    logger.info('Ticket products parsed', {
      originalCount: products.length,
      parsedCount: result.length,
      originalTotal: originalTotal.toFixed(2),
      parsedTotal: parsedTotal.toFixed(2),
      expectedTotal: expectedTotal.toFixed(2),
      accurate: Math.abs(parsedTotal - expectedTotal) < 0.10,
    });
  }

  return result;
}
