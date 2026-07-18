/**
 * Gate Intelligence Engine — Wait Time Calculation Logic
 *
 * Production-ready TypeScript implementation
 * - No external dependencies (uses native JavaScript)
 * - Handles sensor failures gracefully
 * - Forecasts arrival surges
 * - Applies stress factors under high crowd density
 */
import { QueueObservation, Gate, ArrivalForecast, WaitTimeResult, HistoricalPattern } from '../types';
/**
 * Get reliable queue count from noisy observations.
 * Uses weighted median + outlier rejection.
 */
export declare function getReliableQueueCount(observations: QueueObservation[]): number;
/**
 * Calculate wait time for a gate.
 * Main function for core estimation logic.
 */
export declare function calculateWaitTime(gate: Pick<Gate, 'queue_history' | 'throughput_per_min' | 'processing_time_sec' | 'max_queue_length' | 'crowd_slowdown_factor'>, arrivalForecast: ArrivalForecast): WaitTimeResult;
/**
 * Rule-based arrival forecast (fallback when Gemini API unavailable).
 */
export declare function predictArrivalsRuleBased(currentTime: Date, eventStartTime: Date, historicalData: HistoricalPattern[], weather?: {
    condition: string;
    temperature: number;
}): ArrivalForecast;
/**
 * Smooth wait time to avoid wild swings from sensor noise.
 */
export declare function smoothWaitTime(newEstimate: number, previousEstimate: number, confidence: number): number;
/**
 * Detect surge conditions and adjust strategy.
 */
export declare function detectSurge(previousQueueCount: number, newQueueCount: number): {
    isSurge: boolean;
    severity: 'low' | 'medium' | 'high';
};
//# sourceMappingURL=wait-time-calculation.d.ts.map