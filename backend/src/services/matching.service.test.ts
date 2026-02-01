import { prismaMock } from '../__mocks__/prisma';
import { matchProducts, formatMatchingResultForStorage } from './matching.service';
import { TicketProduct } from '../validators/webhook.validator';

// Mock logger to avoid console output during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Matching Service', () => {
  const mockCatalogProducts = [
    { id: 1, name: 'Omega 3', sku: 'PHY-001', active: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 2, name: 'Vitamine D3', sku: 'PHY-002', active: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 3, name: 'Magnésium Marin', sku: 'PHY-003', active: true, createdAt: new Date(), updatedAt: new Date() },
  ];

  beforeEach(() => {
    prismaMock.product.findMany.mockResolvedValue(mockCatalogProducts);
  });

  describe('matchProducts', () => {
    it('should match products with exact names (case-insensitive)', async () => {
      const ticketProducts: TicketProduct[] = [
        { name: 'OMEGA 3', quantity: 2, price: 15.99 },
        { name: 'vitamine d3', quantity: 1, price: 12.50 },
      ];

      const result = await matchProducts(ticketProducts);

      expect(result.totalMatched).toBe(2);
      expect(result.totalUnmatched).toBe(0);
      expect(result.matchRate).toBe(100);
      expect(result.eligibleAmount).toBeCloseTo(44.48, 2); // (15.99 * 2) + (12.50 * 1)
    });

    it('should handle unmatched products', async () => {
      const ticketProducts: TicketProduct[] = [
        { name: 'Omega 3', quantity: 1, price: 15.99 },
        { name: 'Produit Inconnu', quantity: 1, price: 10.00 },
      ];

      const result = await matchProducts(ticketProducts);

      expect(result.totalMatched).toBe(1);
      expect(result.totalUnmatched).toBe(1);
      expect(result.matchRate).toBe(50);
      expect(result.eligibleAmount).toBe(15.99);
    });

    it('should return zero match when no products match', async () => {
      const ticketProducts: TicketProduct[] = [
        { name: 'Produit A', quantity: 1, price: 10.00 },
        { name: 'Produit B', quantity: 1, price: 20.00 },
      ];

      const result = await matchProducts(ticketProducts);

      expect(result.totalMatched).toBe(0);
      expect(result.totalUnmatched).toBe(2);
      expect(result.matchRate).toBe(0);
      expect(result.eligibleAmount).toBe(0);
    });

    it('should handle empty ticket products', async () => {
      const ticketProducts: TicketProduct[] = [];

      const result = await matchProducts(ticketProducts);

      expect(result.totalMatched).toBe(0);
      expect(result.totalUnmatched).toBe(0);
      expect(result.matchRate).toBe(0);
      expect(result.eligibleAmount).toBe(0);
    });

    it('should normalize product names (trim whitespace)', async () => {
      const ticketProducts: TicketProduct[] = [
        { name: '  Omega 3  ', quantity: 1, price: 15.99 },
      ];

      const result = await matchProducts(ticketProducts);

      expect(result.totalMatched).toBe(1);
    });

    it('should calculate eligible amount correctly for multiple quantities', async () => {
      const ticketProducts: TicketProduct[] = [
        { name: 'Omega 3', quantity: 5, price: 15.99 },
      ];

      const result = await matchProducts(ticketProducts);

      expect(result.eligibleAmount).toBeCloseTo(79.95, 2); // 15.99 * 5
    });
  });

  describe('formatMatchingResultForStorage', () => {
    it('should format matching result correctly', async () => {
      const ticketProducts: TicketProduct[] = [
        { name: 'Omega 3', quantity: 2, price: 15.99 },
        { name: 'Produit X', quantity: 1, price: 10.00 },
      ];

      const result = await matchProducts(ticketProducts);
      const formatted = formatMatchingResultForStorage(result);

      expect(formatted).toHaveProperty('products');
      expect(formatted).toHaveProperty('summary');

      const { products, summary } = formatted as any;

      expect(products).toHaveLength(2);
      expect(products[0].matched).toBe(true);
      expect(products[0].catalogProductId).toBe(1);
      expect(products[1].matched).toBe(false);
      expect(products[1].catalogProductId).toBe(null);

      expect(summary.totalMatched).toBe(1);
      expect(summary.totalUnmatched).toBe(1);
    });
  });
});
