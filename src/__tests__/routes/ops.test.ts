import request from 'supertest';
import express from 'express';
import opsRoutes from '../../../src/routes/ops';
import { WaitTimeService } from '../../../src/services/wait-time.service';

const app = express();
app.use(express.json());
app.use('/api/ops', opsRoutes);

// Mock the dependencies
jest.mock('../../../src/services/wait-time.service');
jest.mock('../../../src/services/outcome.service');
jest.mock('../../../src/services/ops.service');

describe('Ops API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/ops/wait-times', () => {
    it('returns 200 and wait times for a valid venue', async () => {
      const mockWaitTimes = {
        timestamp: new Date().toISOString(),
        gates: [{ gate_id: 'gate-a', wait_time_min: 5, status: 'open' }],
      };

      (WaitTimeService.getAllWaitTimes as jest.Mock).mockResolvedValue(mockWaitTimes);

      const response = await request(app)
        .get('/api/ops/wait-times')
        .query({ venue_id: 'stadiumA' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockWaitTimes);
      expect(WaitTimeService.getAllWaitTimes).toHaveBeenCalledWith('stadiumA');
    });

    it('uses default venue_id if not provided', async () => {
      (WaitTimeService.getAllWaitTimes as jest.Mock).mockResolvedValue({ gates: [] });

      const response = await request(app).get('/api/ops/wait-times');

      expect(response.status).toBe(200);
      expect(WaitTimeService.getAllWaitTimes).toHaveBeenCalled();
    });
  });
});
