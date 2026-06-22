const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const notificationModel = require('../models/notification');

router.use(authenticate);

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const { unread } = req.query;
    const notifications = await notificationModel.findByUser(req.user.id, { unread_only: unread === 'true' });
    const unread_count = await notificationModel.countUnread(req.user.id);
    res.json({ notifications, unread_count });
  } catch (err) {
    console.error('notifications error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    await notificationModel.markRead(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// PUT /api/notifications/mark-all-read
router.put('/mark-all-read', async (req, res) => {
  try {
    await notificationModel.markAllRead(req.user.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;
