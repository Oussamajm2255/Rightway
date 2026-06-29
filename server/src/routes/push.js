const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const pushSubscriptionModel = require('../models/pushSubscription');
const { vapidPublicKey } = require('../services/pushService');

// GET /api/push/vapid-public-key — expose VAPID public key to client for subscription
router.get('/vapid-public-key', (_req, res) => {
  if (!vapidPublicKey) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ publicKey: vapidPublicKey });
});

// All routes below require authentication
router.use(authenticate);

// POST /api/push/subscribe — register a push subscription
router.post('/subscribe', async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription: endpoint, keys.p256dh, and keys.auth required' });
    }
    const user_agent = req.headers['user-agent']?.slice(0, 256) || null;
    const sub = await pushSubscriptionModel.upsert(
      req.user.id, endpoint, keys.p256dh, keys.auth, user_agent
    );
    console.log(`[push] User ${req.user.id} subscribed`);
    res.json({ ok: true, id: sub.id });
  } catch (err) {
    console.error('[push] subscribe error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/push/unsubscribe — remove a push subscription
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
    await pushSubscriptionModel.remove(req.user.id, endpoint);
    console.log(`[push] User ${req.user.id} unsubscribed`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[push] unsubscribe error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/push/subscriptions — list current user's subscriptions (for debugging)
router.get('/subscriptions', async (req, res) => {
  try {
    const subs = await pushSubscriptionModel.findByUser(req.user.id);
    res.json({ subscriptions: subs });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;
