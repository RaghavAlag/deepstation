const { db } = require('../firebase/firebaseAdmin');
const { updateBooking, createNotification } = require('../firebase/schema');

async function checkOverstays() {
  const nowMs = Date.now();
  const snapshot = await db
    .collection('bookings')
    .where('status', 'in', ['active', 'overstaying'])
    .get();
  const bookings = snapshot.docs.map((doc) => doc.data());
  for (const booking of bookings) {
    const endMs = new Date(booking.endTime).getTime();
    if (!Number.isFinite(endMs) || endMs >= nowMs) {
      continue;
    }

    if (!booking.overstayNotifiedAt) {
      await updateBooking(booking.bookingId, {
        status: 'overstaying',
        overstayNotifiedAt: new Date().toISOString()
      });
      await createNotification(
        booking.driverId,
        'overstaying',
        `⚠️ You are overstaying at ${booking.spotTitle}! Penalties are accruing.`,
        { bookingId: booking.bookingId }
      );
      await createNotification(
        booking.ownerId,
        'overstaying',
        `Driver ${booking.driverName} is overstaying at ${booking.spotTitle}.`,
        { bookingId: booking.bookingId }
      );
    }

    if (nowMs - endMs > 10 * 60 * 1000 && !booking.towAlertSentAt) {
      await updateBooking(booking.bookingId, { towAlertSentAt: new Date().toISOString() });
      await createNotification(
        booking.driverId,
        'tow_alert',
        `🚨 Tow Alert — Your vehicle at ${booking.spotTitle} has been flagged for removal. Return immediately.`,
        { bookingId: booking.bookingId }
      );
      await createNotification(
        booking.ownerId,
        'tow_alert',
        `🚨 Tow Alert — Vehicle at ${booking.spotTitle} flagged for removal.`,
        { bookingId: booking.bookingId }
      );
    }
  }
}

module.exports = { checkOverstays };
