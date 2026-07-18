import nodemailer from 'nodemailer';
import logger from '@/lib/logger';

let cachedTransporter = null;

function createConfigError(message, code = 'SMTP_CONFIG_MISSING') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getRequiredEnv(names, label) {
  const keys = Array.isArray(names) ? names : [names];
  const value = keys
    .map((key) => process.env[key])
    .find((entry) => typeof entry === 'string' && entry.trim().length > 0);

  if (!value) {
    throw createConfigError(`Missing required SMTP config: ${label} (${keys.join(' or ')})`);
  }

  return value.trim();
}

function getSmtpConfig() {
  const host = getRequiredEnv(['SMTP_HOST', 'MAIL_HOST'], 'host');
  const portValue = process.env.SMTP_PORT || process.env.MAIL_PORT || '587';
  const port = Number(portValue || 587);
  const user = getRequiredEnv(['SMTP_USER', 'MAIL_USER'], 'username');
  const pass = getRequiredEnv(['SMTP_PASS', 'MAIL_PASS'], 'password');
  const fromEmail = getRequiredEnv(
    ['SMTP_FROM_EMAIL', 'MAIL_FROM_EMAIL', 'MAIL_FROM', 'FROM_EMAIL'],
    'from email'
  );

  if (!Number.isFinite(port) || port <= 0) {
    throw createConfigError(`Invalid SMTP port: ${portValue}`, 'SMTP_CONFIG_INVALID');
  }

  return { host, port, user, pass, fromEmail };
}

function createTransporter() {
  const { host, port, user, pass } = getSmtpConfig();
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100
  });
}

export function getMailerTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = createTransporter();
    logger.info('SMTP transporter initialized');
  }
  return cachedTransporter;
}

export async function sendMail({ to, subject, html, text }) {
  try {
    const { fromEmail } = getSmtpConfig();
    const transporter = getMailerTransporter();

    const info = await transporter.sendMail({
      from: fromEmail,
      to,
      subject,
      html,
      text: text || undefined
    });

    logger.info('Email sent successfully', {
      to,
      messageId: info.messageId
    });

    return info;
  } catch (error) {
    if (!error?.code) {
      error.code = 'MAIL_SEND_FAILED';
    }
    logger.error('Failed to send email', error, { to, subject });
    throw error;
  }
}
