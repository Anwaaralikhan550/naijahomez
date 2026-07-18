import { getAdminFirestore } from '@/lib/firebase-admin';
import logger from '@/lib/logger';
import { sendMail } from '@/lib/email/mailer';

function classifyMailError(error) {
  const code = String(error?.code || '').toUpperCase();
  const responseCode = Number(error?.responseCode || 0);
  const message = String(error?.message || '').toLowerCase();

  if (code.includes('SMTP_CONFIG')) {
    return 'SMTP_CONFIG_INVALID';
  }
  if (code.includes('EAUTH') || responseCode === 535 || message.includes('auth')) {
    return 'SMTP_AUTH_FAILED';
  }
  if (responseCode === 429 || message.includes('rate') || message.includes('quota')) {
    return 'SMTP_RATE_LIMITED';
  }
  if (code.includes('ETIMEDOUT') || code.includes('ECONNECTION') || message.includes('connect')) {
    return 'SMTP_CONNECTION_FAILED';
  }

  return 'MAIL_SEND_FAILED';
}

function sanitizeErrorForLogs(error) {
  return {
    message: error?.message || 'Unknown mail error',
    code: error?.code || null,
    responseCode: error?.responseCode || null,
    command: error?.command || null
  };
}

async function writeMailFallbackLog({
  to,
  subject,
  verificationUrl,
  uid,
  reasonCode,
  reasonMessage,
  metadata = {}
}) {
  try {
    const db = getAdminFirestore();
    const payload = {
      type: 'verification_email',
      status: 'failed',
      to,
      subject,
      uid: uid || null,
      verificationUrl: verificationUrl || null,
      reasonCode,
      reasonMessage,
      metadata,
      createdAt: new Date()
    };
    const ref = await db.collection('mail_logs').add(payload);
    logger.warn('Verification email fallback logged', {
      uid: uid || null,
      to,
      reasonCode,
      mailLogId: ref.id
    });
    return ref.id;
  } catch (logError) {
    logger.error('Failed to persist mail fallback log', logError, { to, uid: uid || null });
    return null;
  }
}

export async function sendVerificationEmailWithFallback({
  to,
  subject,
  html,
  text,
  verificationUrl,
  uid,
  metadata = {}
}) {
  try {
    const info = await sendMail({ to, subject, html, text });
    return {
      success: true,
      messageId: info?.messageId || null,
      fallbackStored: false,
      mailLogId: null
    };
  } catch (error) {
    const reasonCode = classifyMailError(error);
    const errorInfo = sanitizeErrorForLogs(error);

    logger.error('Verification email send failed', error, {
      to,
      uid: uid || null,
      reasonCode,
      errorInfo
    });

    const mailLogId = await writeMailFallbackLog({
      to,
      subject,
      verificationUrl,
      uid,
      reasonCode,
      reasonMessage: errorInfo.message,
      metadata
    });

    return {
      success: false,
      reasonCode,
      reasonMessage: errorInfo.message,
      fallbackStored: Boolean(mailLogId),
      mailLogId
    };
  }
}
