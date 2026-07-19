import { haversineDistance } from '../../../src/lib/geo';

describe('Geo Library', () => {
  describe('haversineDistance', () => {
    it('should correctly calculate distance between two points', () => {
      // New York to London approx
      const nyLat = 40.7128;
      const nyLng = -74.006;
      const lonLat = 51.5074;
      const lonLng = -0.1278;

      const dist = haversineDistance(nyLat, nyLng, lonLat, lonLng);
      // Roughly 5570 km = 5,570,000 meters
      expect(dist).toBeGreaterThan(5500000);
      expect(dist).toBeLessThan(5600000);
    });

    it('should return 0 for identical points', () => {
      const dist = haversineDistance(10, 10, 10, 10);
      expect(dist).toBe(0);
    });
  });
});
