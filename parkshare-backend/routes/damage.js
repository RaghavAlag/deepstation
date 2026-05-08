const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { analyzeDamage } = require('../ai/damage');
const { getBooking, updateBooking, createNotification } = require('../firebase/schema');

const router = express.Router();
const videosRoot = path.join(__dirname, '..', 'uploads', 'bookings');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const bookingId = req.body.bookingId;
    const dir = path.join(videosRoot, bookingId || 'unknown');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const mode = req.body.mode === 'exit' ? 'exit' : 'entry';
    cb(null, `${mode}.webm`);
  }
});

const upload = multer({ storage });

router.post('/upload-video', upload.single('video'), (req, res) => {
  try {
    const bookingId = req.body.bookingId;
    const mode = req.body.mode === 'exit' ? 'exit' : 'entry';
    if (!bookingId || !req.file) {
      return res.status(400).json({ error: 'bookingId and video are required' });
    }
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const url = `${protocol}://${host}/uploads/bookings/${bookingId}/${mode}.webm`;
    return res.json({ videoURL: url });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to upload video' });
  }
});

router.post('/claim', async (req, res) => {
  try {
    const { bookingId, driverNote, entryVideoURL, exitVideoURL } = req.body;
    if (!bookingId || !driverNote) {
      return res.status(400).json({ error: 'bookingId and driverNote are required' });
    }

    const report = await analyzeDamage({ driverNote });
    await updateBooking(bookingId, {
      damageClaimStatus: 'pending',
      damageReport: report,
      entryVideoURL: entryVideoURL || null,
      exitVideoURL: exitVideoURL || null
    });

    const booking = await getBooking(bookingId);
    if (booking?.ownerId) {
      await createNotification(
        booking.ownerId,
        'damage_claim',
        `Damage claim raised for booking #${bookingId}. Please review.`,
        { bookingId }
      );
    }

    return res.json(report);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to process damage claim' });
  }
});

module.exports = router;
