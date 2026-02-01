import { calculatePointsWithRatio } from './points.service';

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Points Service', () => {
  describe('calculatePointsWithRatio', () => {
    it('should calculate points with default 1:1 ratio', () => {
      const result = calculatePointsWithRatio(50.0, 1);

      expect(result.eligibleAmount).toBe(50.0);
      expect(result.pointsRatio).toBe(1);
      expect(result.rawPoints).toBe(50.0);
      expect(result.roundedPoints).toBe(50);
    });

    it('should calculate points with 2:1 ratio', () => {
      const result = calculatePointsWithRatio(50.0, 2);

      expect(result.rawPoints).toBe(100.0);
      expect(result.roundedPoints).toBe(100);
    });

    it('should calculate points with 0.5:1 ratio', () => {
      const result = calculatePointsWithRatio(50.0, 0.5);

      expect(result.rawPoints).toBe(25.0);
      expect(result.roundedPoints).toBe(25);
    });

    it('should apply floor rounding by default', () => {
      const result = calculatePointsWithRatio(15.99, 1, 'floor');

      expect(result.rawPoints).toBe(15.99);
      expect(result.roundedPoints).toBe(15);
    });

    it('should apply ceil rounding when specified', () => {
      const result = calculatePointsWithRatio(15.01, 1, 'ceil');

      expect(result.rawPoints).toBe(15.01);
      expect(result.roundedPoints).toBe(16);
    });

    it('should apply round rounding when specified', () => {
      const result1 = calculatePointsWithRatio(15.49, 1, 'round');
      expect(result1.roundedPoints).toBe(15);

      const result2 = calculatePointsWithRatio(15.50, 1, 'round');
      expect(result2.roundedPoints).toBe(16);
    });

    it('should handle zero amount', () => {
      const result = calculatePointsWithRatio(0, 1);

      expect(result.rawPoints).toBe(0);
      expect(result.roundedPoints).toBe(0);
    });

    it('should handle decimal amounts correctly', () => {
      const result = calculatePointsWithRatio(99.99, 1.5, 'floor');

      expect(result.rawPoints).toBeCloseTo(149.985, 2);
      expect(result.roundedPoints).toBe(149);
    });

    it('should handle large amounts', () => {
      const result = calculatePointsWithRatio(1000.0, 1);

      expect(result.roundedPoints).toBe(1000);
    });

    it('should handle fractional ratios', () => {
      const result = calculatePointsWithRatio(100.0, 1.25, 'floor');

      expect(result.rawPoints).toBe(125);
      expect(result.roundedPoints).toBe(125);
    });

    it('should handle very small amounts', () => {
      const result = calculatePointsWithRatio(0.50, 1, 'floor');

      expect(result.rawPoints).toBe(0.50);
      expect(result.roundedPoints).toBe(0);
    });

    it('should return correct rounding method in result', () => {
      const result1 = calculatePointsWithRatio(10, 1, 'floor');
      expect(result1.roundingMethod).toBe('floor');

      const result2 = calculatePointsWithRatio(10, 1, 'ceil');
      expect(result2.roundingMethod).toBe('ceil');

      const result3 = calculatePointsWithRatio(10, 1, 'round');
      expect(result3.roundingMethod).toBe('round');
    });
  });
});
