const express = require('express');
const { db } = require('../firebase/firebaseAdmin');
const { markNotificationRead } = require('../firebase/schema');

const router = express.Router();

router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const snapshot = await db
      .collection('notifications')
      .doc(uid)
      .collection('items')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();
    const notifications = snapshot.docs.map((doc) => ({ notifId: doc.id, ...doc.data() }));
    return res.json({ notifications });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.patch('/:uid/:notifId', async (req, res) => {
  try {
    await markNotificationRead(req.params.uid, req.params.notifId);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update notification' });
  }
});

module.exports = router;
