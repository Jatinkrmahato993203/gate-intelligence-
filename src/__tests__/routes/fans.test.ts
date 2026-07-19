import request from 'supertest';
import { createApp } from '../../app';

// We need to mock the services because this is an integration test of the Express routing layer
jest.mock('../../services/nudge.service', () => ({
  NudgeService: {
    generateNudge: jest.fn(),
  },
}));

jest.mock('../../services/route.service', () => ({
  RouteService: {
    calculateRoute: jest.fn(),
  },
}));

import { NudgeService } from '../../services/nudge.service';
import { RouteService } from '../../services/route.service';

const app = createApp();

describe('Fans API Routes', () => {
  describe('GET /api/fans/nudge', () => {
    it('should return 400 if validation fails (missing query params)', async () => {
      const response = await request(app)
        .get('/api/fans/nudge')
        // Using a valid mock auth token that our setup.ts mock understands
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 200 and the nudge data for valid request', async () => {
      const mockNudge = {
        nudge_id: '123',
        recommended_gate: 'C',
        wait_time_saved_min: 7,
      };

      (NudgeService.generateNudge as jest.Mock).mockResolvedValueOnce(mockNudge);

      const response = await request(app)
        .get('/api/fans/nudge')
        .query({
          user_id: 'user1',
          current_gate_id: 'A',
          lat: 10.0,
          lng: 20.0,
        })
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockNudge);
      expect(NudgeService.generateNudge).toHaveBeenCalledWith('user1', 'A', 10, 20);
    });
  });

  describe('POST /api/fans/route', () => {
    it('should return route data', async () => {
      const mockRoute = {
        distance: 500,
        time_min: 3,
        steps: [],
      };

      (RouteService.calculateRoute as jest.Mock).mockResolvedValueOnce(mockRoute);

      const response = await request(app)
        .post('/api/fans/route')
        .send({
          from_gate_id: 'A',
          to_gate_id: 'C',
        })
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRoute);
    });
  });
});
