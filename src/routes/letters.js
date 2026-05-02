const express = require('express');

function isValidEmail(email) {
  if (!email) return false;
  // Simple RFC-ish check; SMTP validation is provider-side.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function parseLocalDatetimeToUtcIso(receivedAtLocal) {
  // Expect value from <input type="datetime-local">, e.g. "2026-03-20T13:45"
  const m = String(receivedAtLocal || '').match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);

  // Create as local time, then convert to UTC ISO.
  const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function createLettersRouter({ db }) {
  const router = express.Router();

  router.post('/letters', async (req, res) => {
    try {
      const { toEmail, receivedAtLocal, content } = req.body || {};

      if (!isValidEmail(toEmail)) {
        return res.status(400).json({ error: 'Invalid toEmail' });
      }

      const scheduledAtUtcIso = parseLocalDatetimeToUtcIso(receivedAtLocal);
      if (!scheduledAtUtcIso) {
        return res.status(400).json({ error: 'Invalid receivedAtLocal' });
      }

      const text = String(content || '').trim();
      if (!text) {
        return res.status(400).json({ error: 'Content is required' });
      }
      if (text.length > 4000) {
        return res.status(400).json({ error: 'Content is too long (max 4000 chars)' });
      }

      const created = await db.createLetter({
        toEmail: String(toEmail).trim(),
        scheduledAtUtcIso,
        content: text
      });

      return res.json(created);
    } catch (err) {
      console.error('[api] POST /letters error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/letters/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '');
      if (!id) return res.status(400).json({ error: 'Missing id' });

      const row = await db.getLetterById(id);
      if (!row) return res.status(404).json({ error: 'Not found' });

      const { content, ...safe } = row;
      return res.json(safe);
    } catch (err) {
      console.error('[api] GET /letters/:id error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

module.exports = { createLettersRouter };

