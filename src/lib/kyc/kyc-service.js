import crypto from 'crypto';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const KYC_STATUSES = ['unverified', 'pending', 'verified', 'rejected'];
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_DAILY_LIMIT = 8;
export const MAX_KYC_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const LISTING_COLLECTIONS_FOR_KYC_SYNC = [
  'properties',
  'marketplace',
  'housemates',
  'housemate',
  'noticeboard',
  'services',
  'tradespeople'
];

const ALLOWED_DOCUMENT_TYPES = ['id', 'cac'];
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf'
];

export function nowDate() {
  return new Date();
}

export function toIso(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizePhoneNumber(rawValue) {
  const digits = String(rawValue || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('234') && digits.length === 13) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`;
  if (digits.length === 10 && /^[789]/.test(digits)) return `234${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

export function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}****${digits.slice(-3)}`;
}

export function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function getOtpSecret() {
  return process.env.KYC_OTP_SECRET || process.env.EVOLUTION_API_KEY || 'nijahomzs-kyc-otp-dev-secret';
}

export function hashOtp({ code, userId, phone }) {
  return crypto
    .createHmac('sha256', getOtpSecret())
    .update(`${userId}:${phone}:${code}`)
    .digest('hex');
}

export function buildOtpDocId(userId, phone) {
  return `${userId}_${phone}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 220);
}

export function sanitizeDocumentMetadata(documentValue, docType) {
  if (!ALLOWED_DOCUMENT_TYPES.includes(docType)) {
    throw new Error('Invalid KYC document type.');
  }

  if (!documentValue || typeof documentValue !== 'object') {
    throw new Error('Document metadata is required.');
  }

  const url = String(documentValue.url || documentValue.downloadURL || '').trim();
  const storagePath = String(documentValue.storagePath || documentValue.fullPath || '').trim();
  const fileName = String(documentValue.fileName || documentValue.name || '').trim();
  const contentType = String(documentValue.contentType || documentValue.type || '').toLowerCase().trim();
  const size = Number(documentValue.size || 0);

  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error('A valid uploaded document URL is required.');
  }

  if (!fileName || fileName.length > 180) {
    throw new Error('A valid document file name is required.');
  }

  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new Error('Only JPG, PNG, and PDF documents are allowed.');
  }

  if (!Number.isFinite(size) || size <= 0 || size > MAX_KYC_FILE_SIZE_BYTES) {
    throw new Error('Document must be 10MB or smaller.');
  }

  return {
    type: docType,
    url,
    storagePath: storagePath || null,
    fileName,
    contentType,
    size,
    uploadedAt: nowDate().toISOString()
  };
}

export function mapKycSubmission(doc) {
  if (!doc?.exists) return null;
  const data = doc.data() || {};
  return {
    id: doc.id,
    userId: data.userId,
    status: data.status || 'unverified',
    documents: data.documents || {},
    phoneVerification: data.phoneVerification || null,
    rejectionReason: data.rejectionReason || null,
    submittedAt: toIso(data.submittedAt),
    reviewedAt: toIso(data.reviewedAt),
    reviewedBy: data.reviewedBy || null,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt)
  };
}

export async function getLatestKycSubmission(db, userId) {
  const snapshot = await db.collection('kycSubmissions')
    .where('userId', '==', userId)
    .get();

  if (snapshot.empty) return null;
  const latestDoc = snapshot.docs
    .map((doc) => ({ doc, data: doc.data() || {} }))
    .sort((a, b) => {
      const aTime = a.data.updatedAt?.toMillis?.() || Date.parse(a.data.updatedAt || '') || 0;
      const bTime = b.data.updatedAt?.toMillis?.() || Date.parse(b.data.updatedAt || '') || 0;
      return bTime - aTime;
    })[0];

  return { ref: latestDoc.doc.ref, doc: latestDoc.doc, data: latestDoc.data };
}

export function mapKycStatus({ userDoc, latestSubmission }) {
  const userData = userDoc?.exists ? userDoc.data() || {} : {};
  const submission = latestSubmission ? mapKycSubmission(latestSubmission.doc) : null;
  const status = userData.kycStatus || submission?.status || 'unverified';

  return {
    status,
    kycStatus: status,
    phoneNumber: userData.phoneNumber || '',
    phoneVerification: userData.phoneVerification || null,
    idVerification: userData.idVerification || submission?.documents?.id || null,
    cacVerification: userData.cacVerification || submission?.documents?.cac || null,
    rejectionReason: userData.verificationRejectedReason || submission?.rejectionReason || null,
    latestSubmission: submission,
    verifiedAt: toIso(userData.verifiedAt),
    updatedAt: toIso(userData.updatedAt)
  };
}

export async function getKycStatusForUser(userId) {
  const db = getAdminFirestore();
  const [userDoc, latestSubmission] = await Promise.all([
    db.collection('users').doc(userId).get(),
    getLatestKycSubmission(db, userId)
  ]);

  return mapKycStatus({ userDoc, latestSubmission });
}

export async function backfillListingsKycStatus({ db, userId, kycStatus }) {
  const normalizedStatus = KYC_STATUSES.includes(kycStatus) ? kycStatus : 'unverified';
  const isVerified = normalizedStatus === 'verified';
  let updatedCount = 0;

  for (const collectionName of LISTING_COLLECTIONS_FOR_KYC_SYNC) {
    const snapshot = await db.collection(collectionName)
      .where('userId', '==', userId)
      .limit(250)
      .get()
      .catch(() => null);

    if (!snapshot || snapshot.empty) continue;

    let batch = db.batch();
    let batchCount = 0;

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        kycStatus: normalizedStatus,
        userVerified: isVerified,
        verified: isVerified,
        updatedAt: nowDate()
      });
      batchCount += 1;
      updatedCount += 1;
    });

    if (batchCount > 0) {
      await batch.commit();
    }
  }

  return updatedCount;
}

export async function getUserTrustFields(db, userId) {
  if (!userId) {
    return {
      kycStatus: 'unverified',
      userVerified: false,
      verified: false
    };
  }

  const userDoc = await db.collection('users').doc(userId).get().catch(() => null);
  const kycStatus = String(userDoc?.data?.()?.kycStatus || 'unverified').toLowerCase();
  const isVerified = kycStatus === 'verified';

  return {
    kycStatus,
    userVerified: isVerified,
    verified: isVerified
  };
}
