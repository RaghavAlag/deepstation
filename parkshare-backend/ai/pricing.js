const { GoogleGenerativeAI } = require('@google/generative-ai');

const FALLBACK_REASON = 'AI pricing unavailable — showing base rate';

function safeFallback(baseRate) {
  return {
    surgeMultiplier: 1.0,
    finalPrice: Number(baseRate) || 0,
    reasoning: FALLBACK_REASON,
    demandLevel: 'medium'
  };
}

function sanitizeModelResponse(text) {
  if (!text) return '';
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

async function getDynamicPricing(input) {
  const baseRate = Number(input.baseRate) || 0;
  if (!process.env.GEMINI_API_KEY) {
    return safeFallback(baseRate);
  }

  const prompt =
    `You are a smart parking pricing AI for ParkShare, an urban parking marketplace in India. ` +
    `Given the following context, calculate a dynamic price multiplier and return ONLY a valid JSON object ` +
    `with no markdown, no explanation, no code fences, just raw JSON, with these exact fields: ` +
    `surgeMultiplier (number between 1.0 and 3.0), finalPrice (number, calculated as baseRate multiplied by ` +
    `surgeMultiplier rounded to nearest 10), reasoning (string, exactly one sentence explaining why this price ` +
    `was chosen), demandLevel (string, exactly one of: 'low', 'medium', 'high', 'very_high'). Context: Base rate ` +
    `₹${baseRate}/hr. Time: ${input.timeOfDay} on ${input.dayOfWeek}. Nearby occupancy: ${(Number(input.occupancyNearby) * 100).toFixed(0)}%. ` +
    `Upcoming conflict booking: ${Boolean(input.hasUpcomingBooking)}. Location coordinates: ${input.lat}, ${input.lng}.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const rawText = result?.response?.text?.() || '';
    const cleaned = sanitizeModelResponse(rawText);
    const parsed = JSON.parse(cleaned);
    if (
      typeof parsed.surgeMultiplier !== 'number' ||
      typeof parsed.finalPrice !== 'number' ||
      typeof parsed.reasoning !== 'string' ||
      !['low', 'medium', 'high', 'very_high'].includes(parsed.demandLevel)
    ) {
      return safeFallback(baseRate);
    }
    return parsed;
  } catch (error) {
    return safeFallback(baseRate);
  }
}

module.exports = { getDynamicPricing };
