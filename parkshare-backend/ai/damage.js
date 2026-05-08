const { GoogleGenerativeAI } = require('@google/generative-ai');

function fallbackDamage() {
  return {
    damageDetected: false,
    confidenceScore: 0,
    suspectedDamageAreas: [],
    severity: 'none',
    estimatedRepairCost: 0,
    recommendation: 'dismiss',
    aiRemarks: 'Unable to process damage assessment at this time.'
  };
}

function clean(text) {
  return (text || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

async function analyzeDamage({ driverNote }) {
  if (!process.env.GEMINI_API_KEY) {
    return fallbackDamage();
  }

  const prompt =
    `You are ParkShare's AI damage verification system. A driver has raised a damage complaint after parking. ` +
    `The driver's note says: '${driverNote}'. Generate a realistic and plausible damage assessment for a vehicle ` +
    `in an urban Indian parking scenario. Return ONLY a valid JSON object with no markdown, no code fences, just raw JSON, ` +
    `with these exact fields: damageDetected (boolean), confidenceScore (number between 0 and 100), suspectedDamageAreas ` +
    `(array of strings, e.g. ['rear bumper', 'left door', 'hood']), severity (string, exactly one of: 'none', 'minor', ` +
    `'moderate', 'severe'), estimatedRepairCost (number in INR, realistic Indian auto repair pricing), recommendation ` +
    `(string, exactly one of: 'dismiss', 'investigate', 'compensate'), aiRemarks (string, 2 to 3 sentences of analysis ` +
    `explaining the assessment). This is a demo/simulation system — generate a plausible report based on the driver note.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(clean(result?.response?.text?.() || ''));
    const validSeverity = ['none', 'minor', 'moderate', 'severe'].includes(parsed.severity);
    const validRecommendation = ['dismiss', 'investigate', 'compensate'].includes(parsed.recommendation);
    if (
      typeof parsed.damageDetected !== 'boolean' ||
      typeof parsed.confidenceScore !== 'number' ||
      !Array.isArray(parsed.suspectedDamageAreas) ||
      !validSeverity ||
      typeof parsed.estimatedRepairCost !== 'number' ||
      !validRecommendation ||
      typeof parsed.aiRemarks !== 'string'
    ) {
      return fallbackDamage();
    }
    return parsed;
  } catch (error) {
    return fallbackDamage();
  }
}

module.exports = { analyzeDamage };
