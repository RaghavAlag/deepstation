const { GoogleGenerativeAI } = require('@google/generative-ai');

function fallbackConflict(data) {
  const firstSpot = (data.nearbySpots || [])[0];
  return {
    compensationAmount: 120,
    compensationReason: 'This amount balances fairness for inconvenience while keeping extension costs reasonable.',
    alternateSpotRecommendation: firstSpot
      ? `${firstSpot.title} is nearby and has suitable access with a comparable hourly rate.`
      : 'No nearby alternatives are currently available, so prioritize clear communication and compensation.',
    urgencyLevel: 'medium',
    resolutionStrategy: 'Offer compensation immediately and confirm either extension or relocation quickly to avoid further delay.'
  };
}

function cleanResponse(text) {
  return (text || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

async function resolveConflictWithAI(data) {
  if (!process.env.GEMINI_API_KEY) {
    return fallbackConflict(data);
  }

  const nearbySummary = (data.nearbySpots || [])
    .slice(0, 5)
    .map((spot) => `${spot.title}, ${spot.address}, ${spot.distanceKm}km, ₹${spot.rate}/hr`)
    .join(' | ');

  const prompt =
    `You are ParkShare's conflict resolution AI. A driver wants to extend their parking by ${data.extensionHours} hour(s), ` +
    `but another driver has already booked the same spot immediately after. Return ONLY a valid JSON object with no markdown, ` +
    `no code fences, just raw JSON, with these exact fields: compensationAmount (number in INR — a fair and reasonable amount ` +
    `to offer the displaced driver as compensation), compensationReason (string, exactly one sentence explaining why this amount ` +
    `is fair), alternateSpotRecommendation (string, pick the best option from the nearby spots list and explain in one sentence ` +
    `why it is a good alternative), urgencyLevel (string, exactly one of: 'low', 'medium', 'high'), resolutionStrategy (string, ` +
    `exactly one sentence summarizing the recommended resolution approach). Context: currentDriver=${data.currentDriverName}, ` +
    `nextDriver=${data.nextDriverName}, nearbySpots=${nearbySummary || 'none'}.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(cleanResponse(result?.response?.text?.() || ''));
    if (
      typeof parsed.compensationAmount !== 'number' ||
      typeof parsed.compensationReason !== 'string' ||
      typeof parsed.alternateSpotRecommendation !== 'string' ||
      !['low', 'medium', 'high'].includes(parsed.urgencyLevel) ||
      typeof parsed.resolutionStrategy !== 'string'
    ) {
      return fallbackConflict(data);
    }
    return parsed;
  } catch (error) {
    return fallbackConflict(data);
  }
}

module.exports = { resolveConflictWithAI };
