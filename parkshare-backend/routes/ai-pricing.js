const express = require('express');
const { getDynamicPricing } = require('../ai/pricing');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const result = await getDynamicPricing(req.body || {});
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      surgeMultiplier: 1.0,
      finalPrice: Number(req.body?.baseRate) || 0,
      reasoning: 'AI pricing unavailable — showing base rate',
      demandLevel: 'medium'
    });
  }
});

module.exports = router;
