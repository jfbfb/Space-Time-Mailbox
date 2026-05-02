const nodemailer = require('nodemailer');

function parseBool(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.toLowerCase() === 'true';
}

function getSecureMode({ smtpPort, smtpSecure }) {
  const parsed = parseBool(smtpSecure);
  if (parsed !== null) return parsed;
  return Number(smtpPort) === 465;
}

function buildTransporter(env) {
  const smtpHost = env.SMTP_HOST;
  const smtpPort = Number(env.SMTP_PORT || 587);
  const smtpUser = env.SMTP_USER;
  const smtpPass = env.SMTP_PASS;
  const smtpFrom = env.SMTP_FROM;
  const secure = getSecureMode({ smtpPort, smtpSecure: env.SMTP_SECURE });

  if (!smtpHost) throw new Error('Missing SMTP_HOST in env');
  if (!smtpFrom) throw new Error('Missing SMTP_FROM in env');
  if (!smtpUser || !smtpPass) {
    // Some SMTP servers may allow no-auth, but most providers require auth.
    // We keep behavior explicit to avoid confusing failures.
    throw new Error('Missing SMTP_USER/SMTP_PASS in env');
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

async function sendFutureEmail({ transporter, smtpFrom, toEmail, content }) {
  const subject = envOrDefault('LETTER_SUBJECT', 'A letter from your future');

  // Keep it plain text so providers render reliably.
  const text = content;

  return transporter.sendMail({
    from: smtpFrom,
    to: toEmail,
    subject,
    text
  });
}

function envOrDefault(key, defaultValue) {
  const v = process.env[key];
  return v && String(v).trim() ? String(v).trim() : defaultValue;
}

module.exports = {
  buildTransporter,
  sendFutureEmail
};

