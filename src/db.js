const sqlite3 = require('sqlite3').verbose();
const { nanoid } = require('nanoid');

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function escapeErrorMessage(message) {
  if (!message) return null;
  const s = String(message);
  return s.length > 2000 ? s.slice(0, 2000) : s;
}

async function createDb({ databasePath }) {
  const db = new sqlite3.Database(databasePath);

  // Schema
  await runAsync(
    db,
    `
    CREATE TABLE IF NOT EXISTS letters (
      id TEXT PRIMARY KEY,
      to_email TEXT NOT NULL,
      scheduled_at_utc TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      last_error TEXT,
      created_at_utc TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_letters_status_sched
      ON letters (status, scheduled_at_utc);
  `
  );

  async function createLetter({ toEmail, scheduledAtUtcIso, content }) {
    const id = nanoid();
    const createdAtUtcIso = new Date().toISOString();
    await runAsync(
      db,
      `
      INSERT INTO letters (id, to_email, scheduled_at_utc, content, status, last_error, created_at_utc)
      VALUES (?, ?, ?, ?, ?, NULL, ?)
    `,
      [id, toEmail, scheduledAtUtcIso, content, 'scheduled', createdAtUtcIso]
    );
    return { id, status: 'scheduled' };
  }

  async function getLetterById(id) {
    const row = await getAsync(db, 'SELECT * FROM letters WHERE id = ?', [id]);
    return row || null;
  }

  // Atomically claim due scheduled letters and mark them as "sending".
  async function claimDueLetters({ nowUtcIso, limit }) {
    const due = await (async () => {
      await runAsync(db, 'BEGIN IMMEDIATE');
      try {
        const rows = await allAsync(
          db,
          `
          SELECT id, to_email, content, scheduled_at_utc
          FROM letters
          WHERE status = ?
            AND scheduled_at_utc <= ?
          ORDER BY scheduled_at_utc ASC
          LIMIT ?
        `,
          ['scheduled', nowUtcIso, limit]
        );

        if (!rows.length) {
          await runAsync(db, 'COMMIT');
          return [];
        }

        const ids = rows.map((r) => r.id);
        const placeholders = ids.map(() => '?').join(',');
        await runAsync(
          db,
          `UPDATE letters SET status = ? WHERE status = ? AND id IN (${placeholders})`,
          ['sending', 'scheduled', ...ids]
        );
        await runAsync(db, 'COMMIT');
        return rows;
      } catch (err) {
        // Best-effort rollback
        try {
          await runAsync(db, 'ROLLBACK');
        } catch (_) {
          // ignore
        }
        throw err;
      }
    })();

    return due;
  }

  async function markSent({ id }) {
    await runAsync(
      db,
      'UPDATE letters SET status = ?, last_error = NULL WHERE id = ?',
      ['sent', id]
    );
  }

  async function markFailed({ id, error }) {
    await runAsync(
      db,
      'UPDATE letters SET status = ?, last_error = ? WHERE id = ?',
      ['failed', escapeErrorMessage(error?.message || error), id]
    );
  }

  function close() {
    return new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  return {
    createLetter,
    getLetterById,
    claimDueLetters,
    markSent,
    markFailed,
    close
  };
}

module.exports = {
  createDb
};

