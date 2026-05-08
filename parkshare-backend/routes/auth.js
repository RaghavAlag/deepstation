const express = require('express');
const { admin } = require('../firebase/firebaseAdmin');
const { getUser, upsertUser } = require('../firebase/schema');

const router = express.Router();

router.post('/verify', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const existingUser = await getUser(uid);

    const payload = {
      uid,
      name: decodedToken.name || '',
      email: decodedToken.email || '',
      photoURL: decodedToken.picture || '',
      role: existingUser?.role || null,
      behaviorScore: existingUser?.behaviorScore ?? 100
    };

    if (!existingUser) {
      payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await upsertUser(uid, payload);
    const user = await getUser(uid);

    return res.json({ user });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

router.post('/set-role', async (req, res) => {
  try {
    const { uid, role } = req.body;
    if (!uid || !role) {
      return res.status(400).json({ error: 'uid and role are required' });
    }

    if (!['driver', 'owner'].includes(role)) {
      return res.status(400).json({ error: 'role must be "driver" or "owner"' });
    }

    await upsertUser(uid, { role });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to set role' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).json({ error: 'uid is required' });
    }

    const user = await getUser(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
