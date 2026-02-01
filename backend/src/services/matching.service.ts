import { Product } from '@prisma/client';
import { distance as levenshteinDistance } from 'fastest-levenshtein';
import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { TicketProduct } from '../validators/webhook.validator.js';

export interface MatchedProduct {
  ticketProduct: TicketProduct;
  catalogProduct: Product | null;
  isMatched: boolean;
  eligibleAmount: number;
  matchMethod?: string; // How the match was found
}

export interface MatchingResult {
  matchedProducts: MatchedProduct[];
  totalMatched: number;
  totalUnmatched: number;
  eligibleAmount: number;
  matchRate: number;
}

// Brand prefixes that indicate Phytalessence products (canonical versions)
const BRAND_PREFIXES = ['phytaless', 'phytalessence', 'phyta'];

/**
 * Check if a word is similar to a brand prefix (tolerance for OCR errors)
 * Allows up to 2 character errors for longer prefixes
 * Uses Levenshtein distance for fuzzy matching
 */
const isSimilarToPrefix = (word: string, prefix: string): boolean => {
  const maxDistance = prefix.length <= 5 ? 1 : 2; // 1 error for short, 2 for long
  const dist = levenshteinDistance(word.toLowerCase(), prefix);
  return dist <= maxDistance;
};

// Abbreviation dictionary: abbreviated term -> possible full terms
// MINIMUM 3 LETTERS for all aliases
const ABBREVIATION_MAP: Record<string, string[]> = {
  // Common product abbreviations (3+ letters only)
  'gluc': ['glucosamine'],
  'calc': ['calcium'],
  'magn': ['magnesium'],
  'sil': ['silice', 'silicium'],
  'msm': ['msm'],
  'circ': ['circulation'],
  'circu': ['circulation'],
  'art': ['articulaire', 'articulation', 'arthro'],
  'arthro': ['arthro', 'articulaire'],
  'vit': ['vitamine', 'vitamin'],
  'vita': ['vitamine', 'vitamin'],
  'vitam': ['vitamine', 'vitamin'],
  'som': ['sommeil'],
  'somm': ['sommeil'],
  'stress': ['stress'],
  'relax': ['relaxation', 'relax'],
  'immun': ['immunite', 'immunitaire', 'immune'],
  'immu': ['immunite', 'immunitaire', 'immune'],
  'diges': ['digestion', 'digestif'],
  'dig': ['digestion', 'digestif'],
  'minceur': ['minceur'],
  'minc': ['minceur'],
  'detox': ['detox', 'detoxification'],
  'energie': ['energie', 'energy'],
  'energ': ['energie', 'energy'],
  'ener': ['energie', 'energy'],
  'chev': ['cheveux'],
  'chevx': ['cheveux'],
  'ongl': ['ongles'],
  'peau': ['peau'],
  'beaut': ['beaute', 'beauty'],
  'omega': ['omega'],
  'omeg': ['omega'],
  'collag': ['collagene', 'collagen'],
  'colla': ['collagene', 'collagen'],
  'prob': ['probiotique', 'probiotic'],
  'probio': ['probiotique', 'probiotic'],
  'fer': ['fer', 'iron'],
  'zinc': ['zinc'],
  'curc': ['curcuma', 'curcumin'],
  'curcum': ['curcuma', 'curcumin'],
  'hyal': ['hyaluronique', 'hyaluronic'],
  'hyalu': ['hyaluronique', 'hyaluronic'],
  'multi': ['multivitamine', 'multivitamines'],
  'antio': ['antioxydant', 'antioxidant'],
  'antiox': ['antioxydant', 'antioxidant'],
  'card': ['cardiaque', 'cardiovasculaire'],
  'cardio': ['cardiaque', 'cardiovasculaire'],
  'mem': ['memoire', 'memory'],
  'memo': ['memoire', 'memory'],
  'conc': ['concentration'],
  'concen': ['concentration'],
  'vis': ['vision', 'visuel'],
  'vision': ['vision'],
  'oeil': ['oeil', 'yeux'],
  'yeux': ['yeux', 'oeil'],
  'osseux': ['osseux', 'os'],
  'musc': ['muscle', 'musculaire'],
  'muscl': ['muscle', 'musculaire'],
  'ginseng': ['ginseng'],
  'gins': ['ginseng'],
  'spirul': ['spiruline', 'spirulina'],
  'spiru': ['spiruline', 'spirulina'],
  'mela': ['melatonine', 'melatonin'],
  'melat': ['melatonine', 'melatonin'],
  // Plants
  'valer': ['valeriane', 'valériane'],
  'valeri': ['valeriane', 'valériane'],
  'valeria': ['valeriane', 'valériane'],
  'valeriane': ['valeriane', 'valériane'],
  'rhodi': ['rhodiola'],
  'rhodio': ['rhodiola'],
  'rhodiola': ['rhodiola'],
  'echina': ['echinacea', 'echinacee'],
  'ginkgo': ['ginkgo'],
  'mille': ['millepertuis'],
  'millep': ['millepertuis'],
  'harpago': ['harpagophytum'],
  'passi': ['passiflore'],
  'passif': ['passiflore'],
};

/**
 * Normalizes a product name for comparison
 * - Lowercase
 * - Remove accents
 * - Trim whitespace
 * - Remove multiple spaces
 * - Replace separators with spaces
 */
const normalizeName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
    .trim()
    .replace(/[|/\\-]+/g, ' ')  // Replace separators with space
    .replace(/\s+/g, ' ')       // Collapse multiple spaces
    .trim();
};

/**
 * Extracts keywords from a normalized name (minimum 3 letters)
 */
const extractKeywords = (name: string): string[] => {
  return normalizeName(name)
    .split(' ')
    .filter(word => word.length >= 3) // Minimum 3 letters
    .filter(word => !['les', 'des', 'avec', 'pour', 'bio', 'gelules', 'gelule', 'comprimes', 'comprime', 'capsules', 'capsule'].includes(word));
};

/**
 * Extracts significant keywords (product names, not quantities/forms)
 * These are keywords that identify the product itself
 */
const extractSignificantKeywords = (name: string): string[] => {
  const stopWords = [
    'bio', 'gelules', 'gelule', 'comprimes', 'comprime', 'capsules', 'capsule',
    'mono', 'plante', 'plantes', 'extrait', 'extraits', 'complexe',
    'les', 'des', 'avec', 'pour', 'plus', 'fort', 'forte'
  ];
  const numericPattern = /^\d+$/;

  return normalizeName(name)
    .split(' ')
    .filter(word => word.length >= 3)
    .filter(word => !stopWords.includes(word))
    .filter(word => !numericPattern.test(word));
};

/**
 * Removes brand prefix from ticket product name
 * Handles exact matches and fuzzy matches (OCR typos)
 */
const removeBrandPrefix = (name: string): string => {
  const normalized = normalizeName(name);
  const words = normalized.split(' ');
  const firstWord = words[0] || '';

  // Check exact prefix match first
  for (const prefix of BRAND_PREFIXES) {
    if (normalized.startsWith(prefix + ' ')) {
      return normalized.slice(prefix.length + 1).trim();
    }
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length).trim();
    }
  }

  // Check fuzzy match on first word and remove it if it matches
  if (firstWord.length >= 5) {
    for (const prefix of BRAND_PREFIXES) {
      if (isSimilarToPrefix(firstWord, prefix)) {
        // Remove the first word (the typo'd brand name)
        return words.slice(1).join(' ').trim();
      }
    }
  }

  return normalized;
};

/**
 * Checks if a ticket product name indicates a Phytalessence product
 * Uses fuzzy matching to handle OCR typos (e.g., PYHTALESS instead of PHYTALESS)
 */
const isPhytalessenceProduct = (name: string): boolean => {
  const normalized = normalizeName(name);
  const firstWord = normalized.split(' ')[0] || '';

  // Check exact prefix match first (fast path)
  if (BRAND_PREFIXES.some(prefix => normalized.startsWith(prefix))) {
    return true;
  }

  // Check fuzzy match on first word (handles OCR typos)
  // Only check if first word is long enough to be a brand name
  if (firstWord.length >= 5) {
    return BRAND_PREFIXES.some(prefix => isSimilarToPrefix(firstWord, prefix));
  }

  return false;
};

/**
 * Expands abbreviations in a name
 * Returns array of possible expanded names
 */
const expandAbbreviations = (name: string): string[] => {
  const keywords = extractKeywords(name);
  const expansions: string[][] = [];

  for (const keyword of keywords) {
    const possibleExpansions = ABBREVIATION_MAP[keyword];
    if (possibleExpansions) {
      expansions.push(possibleExpansions);
    } else {
      expansions.push([keyword]);
    }
  }

  // Generate all combinations of expansions
  const combinations: string[] = [];
  const generateCombinations = (index: number, current: string[]) => {
    if (index === expansions.length) {
      combinations.push(current.join(' '));
      return;
    }
    const currentExpansions = expansions[index];
    if (currentExpansions) {
      for (const exp of currentExpansions) {
        generateCombinations(index + 1, [...current, exp]);
      }
    }
  };

  if (expansions.length > 0) {
    generateCombinations(0, []);
  }

  return combinations;
};

/**
 * Calculates similarity score between two strings (0-1)
 * Based on shared keywords
 */
const calculateSimilarity = (str1: string, str2: string): number => {
  const keywords1 = new Set(extractKeywords(str1));
  const keywords2 = new Set(extractKeywords(str2));

  if (keywords1.size === 0 || keywords2.size === 0) return 0;

  let matchCount = 0;
  for (const keyword of keywords1) {
    for (const keyword2 of keywords2) {
      // Exact match
      if (keyword === keyword2) {
        matchCount++;
        break;
      }
      // Partial match (one contains the other)
      if (keyword.length >= 3 && keyword2.length >= 3) {
        if (keyword.includes(keyword2) || keyword2.includes(keyword)) {
          matchCount += 0.7;
          break;
        }
      }
    }
  }

  // Score based on matched keywords relative to both strings
  const score1 = matchCount / keywords1.size;
  const score2 = matchCount / keywords2.size;

  return (score1 + score2) / 2;
};

/**
 * Get aliases for a product (from DB field)
 */
const getProductAliases = (product: Product): string[] => {
  try {
    const aliases = product.aliases as string[];
    return Array.isArray(aliases) ? aliases.map(a => normalizeName(a)) : [];
  } catch {
    return [];
  }
};

/**
 * Find best match for a ticket product in catalog
 * Matches any product found in the catalog (catalog is source of truth)
 */
const findBestMatch = (
  ticketName: string,
  catalogProducts: Product[]
): { product: Product | null; method: string; score: number } => {
  // Remove brand prefix if present (for matching purposes)
  const cleanedName = removeBrandPrefix(ticketName);
  const normalizedTicketName = normalizeName(ticketName);

  // Strategy 0: Check product aliases (highest priority)
  for (const product of catalogProducts) {
    const aliases = getProductAliases(product);
    for (const alias of aliases) {
      if (alias === normalizedTicketName || alias === cleanedName) {
        return { product, method: 'alias_exact', score: 1 };
      }
      // Partial alias match (alias contained in ticket name)
      if (cleanedName.includes(alias) || normalizedTicketName.includes(alias)) {
        return { product, method: 'alias_partial', score: 0.95 };
      }
    }
  }

  // Strategy 1: Exact match (after normalization)
  for (const product of catalogProducts) {
    if (normalizeName(product.name) === normalizedTicketName) {
      return { product, method: 'exact', score: 1 };
    }
  }

  // Strategy 2: Exact match on cleaned name (without brand prefix)
  for (const product of catalogProducts) {
    if (normalizeName(product.name) === cleanedName) {
      return { product, method: 'exact_cleaned', score: 1 };
    }
  }

  // Strategy 3: Check if cleaned name is contained in catalog name or vice versa
  for (const product of catalogProducts) {
    const normalizedCatalogName = normalizeName(product.name);
    if (normalizedCatalogName.includes(cleanedName) || cleanedName.includes(normalizedCatalogName)) {
      return { product, method: 'contains', score: 0.9 };
    }
  }

  // Strategy 4: Expand abbreviations and try matching
  const expandedNames = expandAbbreviations(cleanedName);
  for (const expandedName of expandedNames) {
    for (const product of catalogProducts) {
      const normalizedCatalogName = normalizeName(product.name);

      // Check if all expanded keywords are in catalog name
      const expandedKeywords = extractKeywords(expandedName);
      const catalogKeywords = extractKeywords(normalizedCatalogName);

      const allMatch = expandedKeywords.length > 0 && expandedKeywords.every(ek =>
        catalogKeywords.some(ck => ck === ek || (ck.length >= 5 && ek.length >= 5 && (ck.includes(ek) || ek.includes(ck))))
      );

      if (allMatch) {
        return { product, method: 'abbreviation_expansion', score: 0.85 };
      }
    }
  }

  // Strategy 5: Primary keyword matching (strict - exact keyword match only)
  const ticketSignificantKeywords = extractSignificantKeywords(cleanedName);

  for (const product of catalogProducts) {
    const catalogSignificantKeywords = extractSignificantKeywords(product.name);

    // Check if any significant keyword from ticket EXACTLY matches catalog
    for (const ticketKeyword of ticketSignificantKeywords) {
      for (const catalogKeyword of catalogSignificantKeywords) {
        // Only exact match or very close match (min 5 chars and one starts with the other)
        if (ticketKeyword === catalogKeyword) {
          return { product, method: 'keyword_exact', score: 0.85 };
        }
        // Allow partial match only if both are long enough and one starts with the other
        if (ticketKeyword.length >= 5 && catalogKeyword.length >= 5) {
          if (catalogKeyword.startsWith(ticketKeyword) || ticketKeyword.startsWith(catalogKeyword)) {
            return { product, method: 'keyword_prefix', score: 0.8 };
          }
        }
      }
    }
  }

  // Strategy 6: Fuzzy matching with higher threshold
  let bestMatch: Product | null = null;
  let bestScore = 0;
  const minScoreThreshold = 0.6; // Higher threshold to avoid false positives

  for (const product of catalogProducts) {
    const score = calculateSimilarity(cleanedName, product.name);

    if (score > bestScore && score >= minScoreThreshold) {
      bestScore = score;
      bestMatch = product;
    }

    // Also try with expanded abbreviations
    for (const expandedName of expandedNames) {
      const expandedScore = calculateSimilarity(expandedName, product.name);
      if (expandedScore > bestScore && expandedScore >= minScoreThreshold) {
        bestScore = expandedScore;
        bestMatch = product;
      }
    }
  }

  if (bestMatch) {
    return { product: bestMatch, method: 'fuzzy', score: bestScore };
  }

  // No match found in catalog
  logger.debug('Product not matched in catalog', {
    originalName: ticketName,
    cleanedName,
  });

  return { product: null, method: 'no_catalog_match', score: 0 };
};

/**
 * Matches ticket products against the product catalog
 * Uses multiple matching strategies
 */
export const matchProducts = async (
  ticketProducts: TicketProduct[]
): Promise<MatchingResult> => {
  logger.info('Starting product matching', {
    ticketProductsCount: ticketProducts.length,
  });

  // Get all active products from catalog
  const catalogProducts = await prisma.product.findMany({
    where: { active: true },
  });

  const matchedProducts: MatchedProduct[] = [];
  let totalMatched = 0;
  let totalUnmatched = 0;
  let eligibleAmount = 0;

  for (const ticketProduct of ticketProducts) {
    const { product: catalogProduct, method, score } = findBestMatch(
      ticketProduct.name,
      catalogProducts
    );
    const isMatched = catalogProduct !== null;

    // Calculate eligible amount for this product (price * quantity)
    const productAmount = isMatched
      ? ticketProduct.price * ticketProduct.quantity
      : 0;

    matchedProducts.push({
      ticketProduct,
      catalogProduct,
      isMatched,
      eligibleAmount: productAmount,
      matchMethod: isMatched ? `${method} (${(score * 100).toFixed(0)}%)` : undefined,
    });

    if (isMatched) {
      totalMatched++;
      eligibleAmount += productAmount;
      logger.debug('Product matched', {
        ticketName: ticketProduct.name,
        catalogName: catalogProduct.name,
        method,
        score,
      });
    } else {
      totalUnmatched++;
    }
  }

  const matchRate =
    ticketProducts.length > 0
      ? (totalMatched / ticketProducts.length) * 100
      : 0;

  logger.info('Product matching completed', {
    totalMatched,
    totalUnmatched,
    eligibleAmount,
    matchRate: `${matchRate.toFixed(1)}%`,
  });

  return {
    matchedProducts,
    totalMatched,
    totalUnmatched,
    eligibleAmount,
    matchRate,
  };
};

/**
 * Formats matching result for storage in transaction
 */
export const formatMatchingResultForStorage = (
  result: MatchingResult
): object[] => {
  // Return array format matching frontend MatchedProduct[] type
  return result.matchedProducts.map((mp) => ({
    ticketProduct: {
      name: mp.ticketProduct.name,
      quantity: mp.ticketProduct.quantity,
      price: mp.ticketProduct.price,
    },
    matched: mp.isMatched,
    matchedProductId: mp.catalogProduct?.id || null,
    matchedProductName: mp.catalogProduct?.name || null,
    eligibleAmount: mp.eligibleAmount,
    matchMethod: mp.matchMethod || null,
  }));
};
