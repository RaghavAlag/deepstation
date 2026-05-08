const express = require('express');
const { randomUUID } = require('crypto');
const { db } = require('../firebase/firebaseAdmin');
const {
  getBooking,
  updateBooking,
  getSpot,
  getAllActiveSpots,
  createConflictRequest,
  updateConflictRequest,
  createNotification
} = require('../firebase/schema');
const { resolveConflictWithAI } = require('../ai/conflict');

const router = express.Router();

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.post('/request', async (req, res) => {
  try {
    const { bookingId, extensionHours } = req.body;
    const hours = Number(extensionHours);
    if (!bookingId || !hours || hours <= 0) {
      return res.status(400).json({ error: 'bookingId and extensionHours are required' });
    }

    const booking = await getBooking(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const existingEndMs = new Date(booking.endTime).getTime();
    const newEndMs = existingEndMs + hours * 60 * 60 * 1000;
    const newEndIso = new Date(newEndMs).toISOString();

    const snapshot = await db.collection('bookings').where('spotId', '==', booking.spotId).get();
    const conflictBooking = snapshot.docs
      .map((doc) => doc.data())
      .find((item) => {
        if (item.bookingId === bookingId || item.status === 'cancelled') return false;
        const itemStart = new Date(item.startTime).getTime();
        return itemStart >= existingEndMs && itemStart <= newEndMs;
      });

    if (!conflictBooking) {
      await updateBooking(bookingId, { endTime: newEndIso });
      const extensionCost = hours * Number(booking.baseRate || 0) * Number(booking.aiSurgeMultiplier || 1);
      return res.json({ approved: true, newEndTime: newEndIso, extensionCost });
    }

    const spot = await getSpot(booking.spotId);
    const allSpots = await getAllActiveSpots();
    const nearbySpots = allSpots
      .filter((entry) => entry.spotId !== booking.spotId)
      .map((entry) => ({
        title: entry.title,
        address: entry.address,
        distanceKm: Math.round(haversineDistance(Number(spot.latitude), Number(spot.longitude), Number(entry.latitude), Number(entry.longitude)) * 10) / 10,
        rate: entry.baseHourlyRate
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5);

    const ai = await resolveConflictWithAI({
      extensionHours: hours,
      nearbySpots,
      currentDriverName: booking.driverName || 'Current Driver',
      nextDriverName: conflictBooking.driverName || 'Next Driver'
    });

    const conflictId = randomUUID();
    await createConflictRequest({
      conflictId,
      currentBookingId: bookingId,
      nextBookingId: conflictBooking.bookingId,
      currentDriverId: booking.driverId,
      nextDriverId: conflictBooking.driverId,
      spotId: booking.spotId,
      extensionHours: hours,
      compensationOffer: ai.compensationAmount,
      alternateSpots: nearbySpots,
      proposedNewEndTime: newEndIso,
      status: 'pending'
    });

    return res.json({
      approved: false,
      conflictData: {
        conflictId,
        compensationAmount: ai.compensationAmount,
        compensationReason: ai.compensationReason,
        alternateSpotRecommendation: ai.alternateSpotRecommendation,
        urgencyLevel: ai.urgencyLevel,
        resolutionStrategy: ai.resolutionStrategy,
        nextDriverName: conflictBooking.driverName || 'Next Driver'
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to process extension request' });
  }
});

router.post('/resolve', async (req, res) => {
  try {
    const { conflictId, outcome } = req.body;
    if (!conflictId || !['accepted', 'rejected'].includes(outcome)) {
      return res.status(400).json({ error: 'conflictId and valid outcome are required' });
    }

    const conflictSnap = await db.collection('conflictRequests').doc(conflictId).get();
    if (!conflictSnap.exists) {
      return res.status(404).json({ error: 'Conflict request not found' });
    }
    const conflict = conflictSnap.data();

    await updateConflictRequest(conflictId, { status: outcome, resolvedAt: new Date().toISOString() });

    if (outcome === 'accepted') {
      await updateBooking(conflict.currentBookingId, { endTime: conflict.proposedNewEndTime });
      await createNotification(
        conflict.currentDriverId,
        'extension_approved',
        `Extension approved! New end time: ${conflict.proposedNewEndTime}`,
        { conflictId }
      );
      await createNotification(
        conflict.nextDriverId,
        'booking_delay',
        `Your booking start may be delayed. Compensation of ₹${conflict.compensationOffer} is being arranged.`,
        { conflictId }
      );
    } else {
      await createNotification(
        conflict.currentDriverId,
        'extension_denied',
        'Extension denied. Please vacate the spot on time.',
        { conflictId }
      );
    }

    return res.json({ success: true, outcome });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to resolve extension request' });
  }
});

module.exports = router;
