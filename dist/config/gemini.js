"use strict";
// ============================================================================
// Gemini API Configuration
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeGemini = initializeGemini;
exports.generateForecast = generateForecast;
exports.isGeminiAvailable = isGeminiAvailable;
const generative_ai_1 = require("@google/generative-ai");
const env_1 = require("./env");
const logging_1 = require("../middleware/logging");
let client = null;
async function initializeGemini() {
    if (!env_1.env.GEMINI_API_KEY || !env_1.env.ENABLE_GEMINI_FORECASTING) {
        logging_1.logger.warn('Gemini API key not set or forecasting disabled — using rule-based fallback');
        return;
    }
    client = new generative_ai_1.GoogleGenerativeAI(env_1.env.GEMINI_API_KEY);
    try {
        const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
        // Light connectivity test
        await model.generateContent('ping');
        logging_1.logger.info('✓ Gemini API initialized');
    }
    catch (error) {
        logging_1.logger.warn({ error }, '⚠️ Gemini API unavailable, using rule-based fallback');
        client = null;
    }
}
async function generateForecast(prompt) {
    if (!client)
        return null;
    try {
        const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        return result.response.text();
    }
    catch (error) {
        logging_1.logger.error({ error }, 'Gemini API forecast error');
        return null;
    }
}
function isGeminiAvailable() {
    return client !== null;
}
//# sourceMappingURL=gemini.js.map