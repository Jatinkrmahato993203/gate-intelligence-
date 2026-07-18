"use strict";
/**
 * Gate Intelligence Engine — Wait Time Calculation Logic
 *
 * Production-ready TypeScript implementation
 * - No external dependencies (uses native JavaScript)
 * - Handles sensor failures gracefully
 * - Forecasts arrival surges
 * - Applies stress factors under high crowd density
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReliableQueueCount = getReliableQueueCount;
exports.calculateWaitTime = calculateWaitTime;
exports.predictArrivalsRuleBased = predictArrivalsRuleBased;
exports.smoothWaitTime = smoothWaitTime;
exports.detectSurge = detectSurge;
// ============================================================================
// CORE CALCULATION FUNCTIONS
// ============================================================================
/**
 * Get reliable queue count from noisy observations.
 * Uses weighted median + outlier rejection.
 */
function getReliableQueueCount(observations) {
    if (observations.length === 0)
        return 0;
    const recent = observations
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10);
    const counts = recent.map((o) => o.observed_queue_count);
    const median = percentile(counts, 0.5);
    const stddev = calculateStddev(counts);
    const filtered = recent.filter((o) => Math.abs(o.observed_queue_count - median) < 2 * stddev);
    if (filtered.length === 0)
        return Math.round(median);
    const sumWeights = filtered.reduce((sum, o) => sum + o.confidence, 0);
    if (sumWeights === 0)
        return Math.round(median);
    return Math.round(filtered.reduce((sum, o) => sum + o.observed_queue_count * o.confidence, 0) / sumWeights);
}
/**
 * Calculate wait time for a gate.
 * Main function for core estimation logic.
 */
function calculateWaitTime(gate, arrivalForecast) {
    const queue_count = getReliableQueueCount(gate.queue_history);
    const capacity_utilization = queue_count / gate.max_queue_length;
    let stress_factor = 1.0;
    let processing_time = gate.processing_time_sec;
    if (capacity_utilization > 0.75) {
        stress_factor = gate.crowd_slowdown_factor;
        processing_time *= stress_factor;
    }
    const effective_throughput = gate.throughput_per_min * stress_factor;
    const queue_wait = queue_count / effective_throughput;
    const processing_wait = processing_time / 60;
    const forecasted_queue = Math.min(queue_count + arrivalForecast.predicted_arrivals, gate.max_queue_length);
    const total_wait_sec = (forecasted_queue / effective_throughput) * 60 + processing_time;
    const total_wait_min = total_wait_sec / 60;
    const rounded_wait = Math.round(total_wait_min * 2) / 2;
    const trend = calculateTrend(gate.queue_history);
    const observation_confidence = gate.queue_history.length > 0 ? gate.queue_history[0].confidence : 0.5;
    const overall_confidence = observation_confidence * 0.6 + arrivalForecast.confidence * 0.4;
    let display_as = `${Math.round(rounded_wait)} min`;
    if (overall_confidence < 0.65) {
        display_as = `~${Math.round(rounded_wait)} min`;
    }
    return {
        estimated_wait_min: rounded_wait,
        display_as,
        breakdown: { queue_wait, processing_wait, stress_factor },
        confidence: overall_confidence,
        trend,
    };
}
/**
 * Rule-based arrival forecast (fallback when Gemini API unavailable).
 */
function predictArrivalsRuleBased(currentTime, eventStartTime, historicalData, weather) {
    const minutesToKickoff = Math.floor((eventStartTime.getTime() - currentTime.getTime()) / 60000);
    const minuteOfDay = currentTime.getHours() * 60 + currentTime.getMinutes();
    const dayType = determineDayType(currentTime);
    const historicalEntry = historicalData.find((p) => p.minute_of_day === minuteOfDay && p.day_type === dayType);
    const baselineArrivals = historicalEntry?.arrival_rate_per_min || 180;
    let eventMultiplier = 1.0;
    if (minutesToKickoff >= 0 && minutesToKickoff < 90) {
        const intensities = {
            90: 1.0,
            60: 1.3,
            30: 2.2,
            15: 1.8,
            5: 0.4,
            0: 0.05,
        };
        eventMultiplier = interpolate(minutesToKickoff, intensities);
    }
    let weatherFactor = 1.0;
    if (weather?.condition === 'rain') {
        weatherFactor = 0.85;
    }
    const predictedArrivals = Math.round(baselineArrivals * eventMultiplier * weatherFactor * 5);
    return {
        time_window: 'next_5_min',
        predicted_arrivals: predictedArrivals,
        confidence: 0.72,
        factors: {
            historical_pattern: baselineArrivals,
            event_triggered: minutesToKickoff < 90,
            external_signal: minutesToKickoff < 10 && minutesToKickoff >= 0
                ? `Kickoff in ${minutesToKickoff} min`
                : null,
            rule_based_forecast: predictedArrivals,
        },
    };
}
/**
 * Smooth wait time to avoid wild swings from sensor noise.
 */
function smoothWaitTime(newEstimate, previousEstimate, confidence) {
    const maxChange = 2;
    if (confidence > 0.85) {
        return (previousEstimate +
            Math.max(-maxChange, Math.min(maxChange, newEstimate - previousEstimate)));
    }
    else if (confidence > 0.6) {
        return previousEstimate * 0.7 + newEstimate * 0.3;
    }
    else {
        return previousEstimate * 0.9 + newEstimate * 0.1;
    }
}
/**
 * Detect surge conditions and adjust strategy.
 */
function detectSurge(previousQueueCount, newQueueCount) {
    const ratio = newQueueCount / (previousQueueCount + 1);
    if (ratio > 3)
        return { isSurge: true, severity: 'high' };
    if (ratio > 1.8)
        return { isSurge: true, severity: 'medium' };
    if (ratio > 1.2)
        return { isSurge: true, severity: 'low' };
    return { isSurge: false, severity: 'low' };
}
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function calculateStddev(values) {
    if (values.length < 2)
        return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        values.length;
    return Math.sqrt(variance);
}
function percentile(values, p) {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = p * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (lower === upper)
        return sorted[lower];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
function interpolate(x, lookupTable) {
    const keys = Object.keys(lookupTable)
        .map(Number)
        .sort((a, b) => a - b);
    let lower = keys[0];
    let upper = keys[keys.length - 1];
    for (const k of keys) {
        if (k <= x)
            lower = k;
    }
    for (const k of keys) {
        if (k >= x) {
            upper = k;
            break;
        }
    }
    if (lower === upper)
        return lookupTable[lower];
    const y1 = lookupTable[lower];
    const y2 = lookupTable[upper];
    return y1 + ((x - lower) / (upper - lower)) * (y2 - y1);
}
function determineDayType(date) {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6)
        return 'normal';
    return 'light';
}
function calculateTrend(observations) {
    if (observations.length < 2)
        return 'stable';
    const recent = observations.slice(0, 2);
    const change = recent[0].observed_queue_count - recent[1].observed_queue_count;
    if (Math.abs(change) < 10)
        return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
}
//# sourceMappingURL=wait-time-calculation.js.map