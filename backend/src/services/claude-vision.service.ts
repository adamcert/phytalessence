import axios from 'axios';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import prisma from '../utils/prisma.js';

interface ClaudeProduct {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_phytalessence: boolean;
  matched_catalog_product?: string;
  matched_catalog_id?: number;
}

interface ClaudeExtractionResult {
  store_name: string;
  ticket_id: string;
  total_receipt: number;
  products: ClaudeProduct[];
}

/**
 * Analyze a ticket image using Claude Vision API.
 * Sends the base64 image + product catalog to Claude, which extracts
 * and identifies Phytalessence products with matching against the catalog.
 */
export async function analyzeTicketWithClaude(
  imageBase64: string,
  transactionId: number
): Promise<ClaudeExtractionResult | null> {
  if (!config.claude.apiKey) {
    logger.warn('Claude API key not configured, skipping vision analysis');
    return null;
  }

  // Get catalog products for matching
  const catalogProducts = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });

  const catalogList = catalogProducts
    .map((p) => `- [ID:${p.id}] ${p.name}`)
    .join('\n');

  // Strip data URI prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const imageSize = Buffer.byteLength(base64Data, 'base64');

  logger.info('Calling Claude API for ticket analysis', {
    catalogProductCount: catalogProducts.length,
    imageSize,
  });

  const prompt = `Analyse cette image de ticket de caisse d'une pharmacie/parapharmacie.

Extrais les informations suivantes au format JSON strict :

1. **store_name** : nom du magasin/pharmacie
2. **ticket_id** : numéro de ticket/facture
3. **total_receipt** : montant total TTC du ticket
4. **products** : liste de TOUS les produits du ticket avec pour chacun :
   - name : nom exact tel qu'il apparaît sur le ticket
   - quantity : quantité
   - unit_price : prix unitaire TTC
   - total_price : prix total (quantity × unit_price)
   - is_phytalessence : true si c'est un produit de la marque Phytalessence (cherche les mots clés : phytalessence, phytaless, phyta, ou un nom qui correspond au catalogue ci-dessous)
   - matched_catalog_product : si is_phytalessence=true, le nom du produit catalogue le plus proche
   - matched_catalog_id : si is_phytalessence=true, l'ID du produit catalogue

Catalogue Phytalessence :
${catalogList}

IMPORTANT :
- Ne matche que les produits qui sont clairement de la marque Phytalessence
- Les produits d'autres marques (Laroche Posay, Nettoyant, Listerine, Vicks, etc.) doivent avoir is_phytalessence=false
- Réponds UNIQUEMENT avec le JSON, sans markdown, sans commentaire
- Si tu ne peux pas lire un prix, mets 0`;

  try {
    const startTime = Date.now();

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: config.claude.model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      },
      {
        headers: {
          'x-api-key': config.claude.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const duration = Date.now() - startTime;
    const usage = response.data.usage;
    const inputTokens = usage?.input_tokens || 0;
    const outputTokens = usage?.output_tokens || 0;
    // Sonnet pricing: $3/M input, $15/M output
    const cost = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

    logger.info('Claude API usage', {
      model: config.claude.model,
      inputTokens,
      outputTokens,
      cost: `$${cost.toFixed(4)}`,
    });

    // Parse the response
    const content = response.data.content?.[0]?.text || '';
    // Try to extract JSON from the response (handle possible markdown wrapping)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('Claude returned no valid JSON', { content: content.substring(0, 500) });
      return null;
    }

    const result: ClaudeExtractionResult = JSON.parse(jsonMatch[0]);

    const brandProducts = result.products.filter((p) => p.is_phytalessence).length;
    const eligibleAmount = result.products
      .filter((p) => p.is_phytalessence)
      .reduce((sum, p) => sum + p.total_price, 0);

    logger.info('Claude extraction result', {
      ticketId: result.ticket_id,
      storeName: result.store_name,
      totalReceipt: result.total_receipt,
      totalProducts: result.products.length,
      brandProducts,
      eligibleAmount,
    });

    return result;
  } catch (error: any) {
    logger.error('Claude API call failed', {
      transactionId,
      error: error.response?.data?.error?.message || error.message,
      status: error.response?.status,
    });
    return null;
  }
}
