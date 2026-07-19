import { calculateWaitTime } from '../../../src/lib/wait-time-calculation';
import { QueueObservation } from '../../../src/types';

describe('WaitTimeCalculation', () => {
  describe('calculateWaitTime', () => {
    it('should calculate 0 minutes when there is no queue', () => {
      const gate = {
        throughput_per_min: 100,
        max_queue_length: 500,
        processing_time_sec: 10,
        crowd_slowdown_factor: 1.0,
        queue_history: [] as QueueObservation[]
      };

      const forecast = {
        time_window: '15m',
        predicted_arrivals: 0,
        confidence: 1,
        factors: []
      };

      const waitTime = calculateWaitTime(gate, forecast as any);
      expect(waitTime.estimated_wait_min).toBe(0);
    });

    it('should calculate correct wait time based on throughput', () => {
      const gate = {
        throughput_per_min: 50, // 50 people per minute
        max_queue_length: 500,
        processing_time_sec: 10,
        crowd_slowdown_factor: 1.0,
        queue_history: [{
          observed_queue_count: 100,
          observation_source: 'sensor',
          confidence: 0.9,
          timestamp: new Date()
        } as QueueObservation]
      };

      const forecast = {
        time_window: '15m',
        predicted_arrivals: 0,
        confidence: 1,
        factors: []
      };

      // 100 people in queue / 50 throughput = 2 minutes
      const waitTime = calculateWaitTime(gate, forecast as any);
      expect(waitTime.estimated_wait_min).toBeGreaterThan(1);
    });
  });
});
