import { getReliableQueueCount, calculateWaitTime } from '../../../src/lib/wait-time-calculation';
import { QueueObservation, Gate, ArrivalForecast } from '../../../src/types';

describe('WaitTimeCalculation Library', () => {
  describe('getReliableQueueCount', () => {
    it('returns 0 when there are no observations', () => {
      expect(getReliableQueueCount([])).toBe(0);
    });

    it('filters out noisy outliers to find a reliable count', () => {
      const now = new Date();
      const observations: QueueObservation[] = [
        { observed_queue_count: 50, confidence: 0.9, timestamp: now, observation_source: 'sensor' },
        { observed_queue_count: 52, confidence: 0.9, timestamp: now, observation_source: 'sensor' },
        { observed_queue_count: 49, confidence: 0.9, timestamp: now, observation_source: 'sensor' },
        { observed_queue_count: 500, confidence: 0.1, timestamp: now, observation_source: 'sensor' }, // obvious outlier
      ];
      
      const count = getReliableQueueCount(observations);
      // It should be close to 50
      expect(count).toBeGreaterThanOrEqual(49);
      expect(count).toBeLessThanOrEqual(52);
    });
  });

  describe('calculateWaitTime', () => {
    const mockGate: Pick<Gate, 'queue_history' | 'throughput_per_min' | 'processing_time_sec' | 'max_queue_length' | 'gate_status' | 'crowd_slowdown_factor'> = {
      queue_history: [],
      throughput_per_min: 20,
      processing_time_sec: 15,
      max_queue_length: 500,
      gate_status: 'open',
      crowd_slowdown_factor: 1
    };

    it('calculates wait time based on queue length and throughput', () => {
      const forecast: ArrivalForecast = {
        time_window: 'now',
        predicted_arrivals: 0,
        confidence: 0.8,
        factors: {
          historical_pattern: 0,
          event_triggered: false,
          external_signal: null,
          rule_based_forecast: 0
        }
      };

      const gateWithQueue = { ...mockGate, queue_history: [{
        observed_queue_count: 100, confidence: 1, timestamp: new Date(), observation_source: 'sensor'
      } as QueueObservation] };
      
      // 100 people / 20 throughput per min = 5 minutes
      // 100 people / 20 throughput per min + processing time logic
      const result = calculateWaitTime(gateWithQueue, forecast);
      expect(result.estimated_wait_min).toBe(5.5);
    });

    it('factors in expected surge arrivals from forecast', () => {
      const forecast: ArrivalForecast = {
        time_window: 'next_5_min',
        predicted_arrivals: 100, // Surge of 100 people
        confidence: 0.8,
        factors: {
          historical_pattern: 0,
          event_triggered: false,
          external_signal: null,
          rule_based_forecast: 100
        }
      };
      
      // Initially 0 people in line
      const result = calculateWaitTime(mockGate, forecast);
      
      // With 100 incoming people over the next few minutes, wait time should increase
      expect(result.estimated_wait_min).toBeGreaterThan(0);
    });
  });


});
