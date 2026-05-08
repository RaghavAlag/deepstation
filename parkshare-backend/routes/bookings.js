const express = require('express');
const { randomUUID } = require('crypto');
const { db } = require('../firebase/firebaseAdmin');
const { createBooking, getBooking, updateBooking } = require('../firebase/schema');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { driverId, ownerId, spotId, status } = req.query;
    let query = db.collection('bookings');

    if (driverId) {
      query = query.where('driverId', '==', driverId);
    }
    if (ownerId) {
      query = query.where('ownerId', '==', ownerId);
    }
    if (spotId) {
      query = query.where('spotId', '==', spotId);
    }

    const snapshot = await query.get();
    let bookings = snapshot.docs.map((doc) => doc.data());

    if (status) {
      const allowed = status.split(',').map((entry) => entry.trim());
      bookings = bookings.filter((booking) => allowed.includes(booking.status));
    }

    bookings.sort((a, b) => {
      const aTime = new Date(a.startTime || 0).getTime();
      const bTime = new Date(b.startTime || 0).getTime();
      return bTime - aTime;
    });

    return res.json({ bookings });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

router.get('/:bookingId', async (req, res) => {
  try {
    const booking = await getBooking(req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    return res.json({ booking });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

router.post('/', async (req, res) => {
  try {
    const bookingId = randomUUID();
    const payload = {
      bookingId,
      status: 'active',
      damageClaimStatus: 'none',
      paymentStatus: 'mock_paid',
      aiSurgeMultiplier: 1,
      ...req.body
    };
    const booking = await createBooking(payload);
    return res.status(201).json({ booking });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create booking' });
  }
});

router.patch('/:bookingId', async (req, res) => {
  try {
    const booking = await getBooking(req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    await updateBooking(req.params.bookingId, req.body);
    const updatedBooking = await getBooking(req.params.bookingId);
    return res.json({ booking: updatedBooking });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update booking' });
  }
});

module.exports = router;
