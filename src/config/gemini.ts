// ============================================================================
// Gemini API Configuration
// ============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from './env';
import { logger } from '../middleware/logging';

let client: GoogleGenerativeAI | null = null;

export async function initializeGemini(): Promise<void> {
  if (!env.GEMINI_API_KEY || !env.ENABLE_GEMINI_FORECASTING) {
    logger.warn('Gemini API key not set or forecasting disabled — using rule-based fallback');
    return;
  }

  client = new GoogleGenerativeAI(env.GEMINI_API_KEY);

  try {
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
    // Light connectivity test
    await model.generateContent('ping');
    logger.info('✓ Gemini API initialized');
  } catch (error) {
    logger.warn({ error }, '⚠️ Gemini API unavailable, using rule-based fallback');
    client = null;
  }
}

export async function generateForecast(prompt: string): Promise<string | null> {
  if (!client) return null;

  try {
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    logger.error({ error }, 'Gemini API forecast error');
    return null;
  }
}

export function isGeminiAvailable(): boolean {
  return client !== null;
}
