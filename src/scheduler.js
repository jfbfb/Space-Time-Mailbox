const { sendFutureEmail } = require('./email');

function startScheduler({
  db,
  transporter,
  pollIntervalMs = 30000,
  dueLimit = 20
}) {
  let isSending = false;
  let timer = null;

  async function sendDueLettersOnce() {
    const nowUtcIso = new Date().toISOString();
    const smtpFrom = process.env.SMTP_FROM;
    const due = await db.claimDueLetters({ nowUtcIso, limit: dueLimit });

    if (!due.length) return;

    for (const letter of due) {
      try {
        await sendFutureEmail({
          transporter,
          smtpFrom,
          toEmail: letter.to_email,
          content: letter.content
        });
        await db.markSent({ id: letter.id });
      } catch (err) {
        await db.markFailed({ id: letter.id, error: err });
      }
    }
  }

  async function tick() {
    if (isSending) return;
    isSending = true;
    try {
      await sendDueLettersOnce();
    } catch (err) {
      // Do not crash the server; scheduler should keep trying.
      console.error('[scheduler] tick error:', err);
    } finally {
      isSending = false;
    }
  }

  // Send immediately on startup.
  tick().catch((_) => {});

  timer = setInterval(() => {
    tick().catch((_) => {});
  }, pollIntervalMs);

  function stop() {
    if (timer) clearInterval(timer);
  }

  return { stop };
}

module.exports = {
  startScheduler
};

