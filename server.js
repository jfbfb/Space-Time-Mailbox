require('dotenv').config();

const path = require('path');
const express = require('express');

const { createDb } = require('./src/db');
const { buildTransporter } = require('./src/email');
const { startScheduler } = require('./src/scheduler');
const { createLettersRouter } = require('./src/routes/letters');

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

async function main() {
  const databasePath = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(__dirname, 'letters.sqlite');

  const db = await createDb({ databasePath });
  const transporter = buildTransporter(process.env);

  const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS || 30000);
  const dueLimit = Number(process.env.DUE_LIMIT || 20);
  const scheduler = startScheduler({
    db,
    transporter,
    pollIntervalMs,
    dueLimit
  });

  app.use('/api', createLettersRouter({ db }));

  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  const hostHint = host === '0.0.0.0' ? 'LAN_IP' : host;
  const server = app.listen(port, host, () => {
    console.log(`[server] listening on http://localhost:${port}`);
    console.log(`[server] LAN access: http://${hostHint}:${port}`);
  });

  async function shutdown() {
    scheduler.stop();
    server.close(() => {});
    await db.close();
  }

  process.on('SIGINT', () => {
    shutdown()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
  process.on('SIGTERM', () => {
    shutdown()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});

