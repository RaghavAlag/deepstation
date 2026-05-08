require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { checkOverstays } = require('./routes/overstay');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ParkShare backend is running 🚀' });
});

// Routes (added in later phases)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/spots', require('./routes/spots'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/ai/pricing', require('./routes/ai-pricing'));
app.use('/api/extensions', require('./routes/extensions'));
app.use('/api/damage', require('./routes/damage'));
app.use('/api/notifications', require('./routes/notifications'));

setInterval(() => {
  checkOverstays().catch(() => {
    // Keep server alive even if overstay check fails intermittently.
  });
}, 60 * 1000);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ ParkShare backend running on http://localhost:${PORT}`);
});
