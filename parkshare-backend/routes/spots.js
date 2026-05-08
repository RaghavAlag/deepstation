const express = require('express');
const { randomUUID } = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../firebase/firebaseAdmin');
const {
  createSpot,
  getSpot,
  getAllActiveSpots,
  getSpotsByOwner,
  updateSpot
} = require('../firebase/schema');

const router = express.Router();
const uploadsRoot = path.join(__dirname, '..', 'uploads', 'spots');
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const spotId = req.body.spotId || randomUUID();
    const dir = path.join(uploadsRoot, spotId);
    fs.mkdirSync(dir, { recursive: true });
    req.localSpotId = spotId;
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({ storage });

router.post('/upload', upload.array('images', 5), (req, res) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const files = req.files || [];
    const imageUrls = files.map((file) => {
      const normalized = file.path.split(path.sep).join('/');
      const idx = normalized.indexOf('/uploads/');
      const publicPath = idx >= 0 ? normalized.slice(idx) : `/uploads/spots/${req.localSpotId}/${file.filename}`;
      return `${protocol}://${host}${publicPath}`;
    });
    return res.json({ spotId: req.localSpotId, imageUrls });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to upload files locally' });
  }
});

router.get('/nearby', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius || 5);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat and lng are required numbers' });
    }

    const spots = await getAllActiveSpots();
    const nearbySpots = spots
      .map((spot) => {
        const distanceKm = haversineDistance(lat, lng, Number(spot.latitude), Number(spot.longitude));
        return { ...spot, distanceKm: Math.round(distanceKm * 10) / 10 };
      })
      .filter((spot) => Number.isFinite(spot.distanceKm) && spot.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return res.json({ spots: nearbySpots });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch nearby spots' });
  }
});

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
