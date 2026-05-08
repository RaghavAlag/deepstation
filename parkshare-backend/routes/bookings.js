const express = require('express');
const { randomUUID } = require('crypto');
const { db } = require('../firebase/firebaseAdmin');
const { createBooking, getBooking, updateBooking, createNotification } = require('../firebase/schema');

const router = express.Router();

function overlaps(newStart, newEnd, existingStart, existingEnd) {
  return newStart < existingEnd && newEnd > existingStart;
}

router.post('/', async (req, res) => {
  try {
    const bookingId = randomUUID();
    const startTime = new Date(req.body.startTime).toISOString();
    const endTime = new Date(req.body.endTime).toISOString();
    const spotId = req.body.spotId;

    const existingSnapshot = await db.collection('bookings').where('spotId', '==', spotId).get();
    const clash = existingSnapshot.docs
      .map((doc) => doc.data())
      .find((existing) => {
        if (existing.status === 'cancelled' || existing.status === 'completed') return false;
        return overlaps(startTime, endTime, existing.startTime, existing.endTime);
      });

    if (clash) {
      return res.status(409).json({
        error: 'Spot is already booked for this time window',
        conflictEndsAt: clash.endTime
      });
    }

    const payload = {
      bookingId,
      status: 'active',
      damageClaimStatus: 'none',
      paymentStatus: 'mock_paid',
      aiSurgeMultiplier: 1,
      ...req.body,
      startTime,
      endTime
    };
    const booking = await createBooking(payload);

    await createNotification(
      booking.driverId,
      'booking_confirmed',
      `Your booking at ${booking.spotTitle} is confirmed for ${booking.startTime}`,
      { bookingId }
    );
    await createNotification(
      booking.ownerId,
      'new_booking',
      `New booking from ${booking.driverName} for ${booking.spotTitle}`,
      { bookingId }
    );

    return res.status(201).json({ booking });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create booking' });
  }
});

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
      const aTime = new Date(a.createdAt || a.startTime || 0).getTime();
      const bTime = new Date(b.createdAt || b.startTime || 0).getTime();
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

router.patch('/:bookingId', async (req, res) => {
  try {
    const booking = await getBooking(req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const payload = { ...req.body };
    if (payload.status === 'completed' && !payload.endTime) {
      payload.endTime = new Date().toISOString();
    }
    await updateBooking(req.params.bookingId, payload);
    const updatedBooking = await getBooking(req.params.bookingId);
    return res.json({ booking: updatedBooking });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update booking' });
  }
});

module.exports = router;
