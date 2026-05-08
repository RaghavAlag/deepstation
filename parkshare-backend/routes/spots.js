const express = require('express');
const { randomUUID } = require('crypto');
const { db } = require('../firebase/firebaseAdmin');
const {
  createSpot,
  getSpot,
  getAllActiveSpots,
  getSpotsByOwner,
  updateSpot
} = require('../firebase/schema');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { ownerId } = req.query;
    const spots = ownerId ? await getSpotsByOwner(ownerId) : await getAllActiveSpots();
    return res.json({ spots });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch spots' });
  }
});

router.get('/:spotId', async (req, res) => {
  try {
    const spot = await getSpot(req.params.spotId);
    if (!spot) {
      return res.status(404).json({ error: 'Spot not found' });
    }
    return res.json({ spot });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch spot' });
  }
});

router.post('/', async (req, res) => {
  try {
    const spotId = randomUUID();
    const payload = {
      ...req.body,
      spotId,
      blockedDrivers: Array.isArray(req.body.blockedDrivers) ? req.body.blockedDrivers : []
    };
    const spot = await createSpot(payload);
    return res.status(201).json({ spot });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create spot' });
  }
});

router.patch('/:spotId', async (req, res) => {
  try {
    const { spotId } = req.params;
    const existingSpot = await getSpot(spotId);
    if (!existingSpot) {
      return res.status(404).json({ error: 'Spot not found' });
    }

    const data = { ...req.body };
    if (data.blockDriverUid) {
      const blockedDrivers = Array.isArray(existingSpot.blockedDrivers) ? existingSpot.blockedDrivers : [];
      if (!blockedDrivers.includes(data.blockDriverUid)) {
        blockedDrivers.push(data.blockDriverUid);
      }
      data.blockedDrivers = blockedDrivers;
      delete data.blockDriverUid;
    }

    await updateSpot(spotId, data);
    const updatedSpot = await getSpot(spotId);
    return res.json({ spot: updatedSpot });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update spot' });
  }
});

router.delete('/:spotId', async (req, res) => {
  try {
    await db.collection('parkingSpots').doc(req.params.spotId).delete();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete spot' });
  }
});

module.exports = router;
