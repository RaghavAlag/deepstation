const { admin, db } = require('./firebaseAdmin');

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

/**
 * @typedef {"driver" | "owner"} UserRole
 *
 * @typedef {Object} UserDoc
 * @property {string} uid
 * @property {string} name
 * @property {string} email
 * @property {string} photoURL
 * @property {UserRole} role
 * @property {number} behaviorScore
 * @property {FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue} createdAt
 */

/**
 * @typedef {Object} ParkingSpotDoc
 * @property {string} spotId
 * @property {string} ownerId
 * @property {string} ownerName
 * @property {string} title
 * @property {string} address
 * @property {string} description
 * @property {number} latitude
 * @property {number} longitude
 * @property {string[]} vehicleTypes
 * @property {boolean} isCovered
 * @property {boolean} hasEVCharging
 * @property {boolean} hasCCTV
 * @property {number} baseHourlyRate
 * @property {number} baseDailyRate
 * @property {string} availableFrom
 * @property {string} availableTo
 * @property {string[]} images
 * @property {boolean} isActive
 * @property {number} totalBookings
 * @property {number} averageRating
 */

/**
 * @typedef {"upcoming" | "active" | "completed" | "cancelled" | "overstaying"} BookingStatus
 * @typedef {"mock_paid" | "pending"} PaymentStatus
 * @typedef {"none" | "pending" | "resolved"} DamageClaimStatus
 *
 * @typedef {Object} BookingDoc
 * @property {string} bookingId
 * @property {string} spotId
 * @property {string} spotTitle
 * @property {string} spotAddress
 * @property {string} driverId
 * @property {string} driverName
 * @property {string} ownerId
 * @property {FirebaseFirestore.Timestamp} startTime
 * @property {FirebaseFirestore.Timestamp} endTime
 * @property {number} durationHours
 * @property {number} baseRate
 * @property {number} aiSurgeMultiplier
 * @property {number} totalAmount
 * @property {BookingStatus} status
 * @property {PaymentStatus} paymentStatus
 * @property {string | null} entryVideoURL
 * @property {string | null} exitVideoURL
 * @property {DamageClaimStatus} damageClaimStatus
 * @property {Object | null} damageReport
 * @property {FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue} createdAt
 */

/**
 * @typedef {"pending" | "accepted" | "rejected" | "expired"} ConflictStatus
 *
 * @typedef {Object} ConflictRequestDoc
 * @property {string} currentBookingId
 * @property {string} nextBookingId
 * @property {string} currentDriverId
 * @property {string} nextDriverId
 * @property {string} spotId
 * @property {number} extensionHours
 * @property {ConflictStatus} status
 * @property {number} compensationOffer
 * @property {Array<Object>} alternateSpots
 * @property {FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue} createdAt
 * @property {FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | null} resolvedAt
 */

/**
 * @typedef {Object} NotificationDoc
 * @property {string} type
 * @property {string} message
 * @property {boolean} read
 * @property {Object} metadata
 * @property {FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue} createdAt
 */

/**
 * @param {Partial<UserDoc>} userData
 * @returns {Promise<UserDoc>}
 */
async function createUser(userData) {
  const user = {
    behaviorScore: 100,
    createdAt: serverTimestamp(),
    ...userData
  };
  await db.collection('users').doc(user.uid).set(user);
  return user;
}

/**
 * @param {string} uid
 * @returns {Promise<UserDoc | null>}
 */
async function getUser(uid) {
  const snapshot = await db.collection('users').doc(uid).get();
  return snapshot.exists ? /** @type {UserDoc} */ (snapshot.data()) : null;
}

/**
 * @param {string} uid
 * @param {Partial<UserDoc>} data
 * @returns {Promise<void>}
 */
async function upsertUser(uid, data) {
  await db.collection('users').doc(uid).set(data, { merge: true });
}

/**
 * @param {Partial<ParkingSpotDoc>} spotData
 * @returns {Promise<ParkingSpotDoc>}
 */
async function createSpot(spotData) {
  const spot = {
    isActive: true,
    totalBookings: 0,
    averageRating: 0,
    ...spotData
  };
  await db.collection('parkingSpots').doc(spot.spotId).set(spot);
  return spot;
}

/**
 * @param {string} spotId
 * @returns {Promise<ParkingSpotDoc | null>}
 */
async function getSpot(spotId) {
  const snapshot = await db.collection('parkingSpots').doc(spotId).get();
  return snapshot.exists ? /** @type {ParkingSpotDoc} */ (snapshot.data()) : null;
}

/**
 * @returns {Promise<ParkingSpotDoc[]>}
 */
async function getAllActiveSpots() {
  const snapshot = await db.collection('parkingSpots').where('isActive', '==', true).get();
  return snapshot.docs.map((doc) => /** @type {ParkingSpotDoc} */ (doc.data()));
}

/**
 * @param {string} ownerId
 * @returns {Promise<ParkingSpotDoc[]>}
 */
async function getSpotsByOwner(ownerId) {
  const snapshot = await db.collection('parkingSpots').where('ownerId', '==', ownerId).get();
  return snapshot.docs.map((doc) => /** @type {ParkingSpotDoc} */ (doc.data()));
}

/**
 * @param {string} spotId
 * @param {Partial<ParkingSpotDoc>} data
 * @returns {Promise<void>}
 */
async function updateSpot(spotId, data) {
  await db.collection('parkingSpots').doc(spotId).set(data, { merge: true });
}

/**
 * @param {Partial<BookingDoc>} bookingData
 * @returns {Promise<BookingDoc>}
 */
async function createBooking(bookingData) {
  const booking = {
    aiSurgeMultiplier: 1,
    paymentStatus: 'pending',
    damageClaimStatus: 'none',
    damageReport: null,
    entryVideoURL: null,
    exitVideoURL: null,
    createdAt: serverTimestamp(),
    ...bookingData
  };
  await db.collection('bookings').doc(booking.bookingId).set(booking);
  return booking;
}

/**
 * @param {string} bookingId
 * @returns {Promise<BookingDoc | null>}
 */
async function getBooking(bookingId) {
  const snapshot = await db.collection('bookings').doc(bookingId).get();
  return snapshot.exists ? /** @type {BookingDoc} */ (snapshot.data()) : null;
}

/**
 * @param {string} driverId
 * @returns {Promise<BookingDoc[]>}
 */
async function getBookingsByDriver(driverId) {
  const snapshot = await db.collection('bookings').where('driverId', '==', driverId).get();
  return snapshot.docs.map((doc) => /** @type {BookingDoc} */ (doc.data()));
}

/**
 * @param {string} spotId
 * @returns {Promise<BookingDoc[]>}
 */
async function getBookingsBySpot(spotId) {
  const snapshot = await db.collection('bookings').where('spotId', '==', spotId).get();
  return snapshot.docs.map((doc) => /** @type {BookingDoc} */ (doc.data()));
}

/**
 * @param {string} driverId
 * @returns {Promise<BookingDoc | null>}
 */
async function getActiveBookingForDriver(driverId) {
  const snapshot = await db
    .collection('bookings')
    .where('driverId', '==', driverId)
    .where('status', 'in', ['active', 'overstaying'])
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return /** @type {BookingDoc} */ (snapshot.docs[0].data());
}

/**
 * @param {string} bookingId
 * @param {Partial<BookingDoc>} data
 * @returns {Promise<void>}
 */
async function updateBooking(bookingId, data) {
  await db.collection('bookings').doc(bookingId).set(data, { merge: true });
}

/**
 * @param {Partial<ConflictRequestDoc>} data
 * @returns {Promise<ConflictRequestDoc>}
 */
async function createConflictRequest(data) {
  const conflict = {
    status: 'pending',
    compensationOffer: 0,
    alternateSpots: [],
    createdAt: serverTimestamp(),
    resolvedAt: null,
    ...data
  };
  const conflictId = conflict.conflictId || db.collection('conflictRequests').doc().id;
  await db.collection('conflictRequests').doc(conflictId).set(conflict);
  return conflict;
}

/**
 * @param {string} conflictId
 * @param {Partial<ConflictRequestDoc>} data
 * @returns {Promise<void>}
 */
async function updateConflictRequest(conflictId, data) {
  await db.collection('conflictRequests').doc(conflictId).set(data, { merge: true });
}

/**
 * @param {string} uid
 * @param {string} type
 * @param {string} message
 * @param {Object} metadata
 * @returns {Promise<string>}
 */
async function createNotification(uid, type, message, metadata = {}) {
  const notifRef = db.collection('notifications').doc(uid).collection('items').doc();
  /** @type {NotificationDoc} */
  const payload = {
    type,
    message,
    read: false,
    metadata,
    createdAt: serverTimestamp()
  };
  await notifRef.set(payload);
  return notifRef.id;
}

/**
 * @param {string} uid
 * @returns {Promise<NotificationDoc[]>}
 */
async function getNotifications(uid) {
  const snapshot = await db
    .collection('notifications')
    .doc(uid)
    .collection('items')
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => /** @type {NotificationDoc} */ (doc.data()));
}

/**
 * @param {string} uid
 * @param {string} notifId
 * @returns {Promise<void>}
 */
async function markNotificationRead(uid, notifId) {
  await db.collection('notifications').doc(uid).collection('items').doc(notifId).set(
    {
      read: true
    },
    { merge: true }
  );
}

module.exports = {
  createUser,
  getUser,
  upsertUser,
  createSpot,
  getSpot,
  getAllActiveSpots,
  getSpotsByOwner,
  updateSpot,
  createBooking,
  getBooking,
  getBookingsByDriver,
  getBookingsBySpot,
  getActiveBookingForDriver,
  updateBooking,
  createConflictRequest,
  updateConflictRequest,
  createNotification,
  getNotifications,
  markNotificationRead
};
