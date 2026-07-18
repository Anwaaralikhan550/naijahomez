export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth-middleware';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getCanonicalImageCount, getNormalizedCleanupDuplicateKey } from '@/lib/hubFirestore';

function errorResponse(message, code = 'INTERNAL_ERROR', status = 500, details = null) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

async function authFailureResponse(authError, fallbackCode = 'UNAUTHORIZED') {
  const status = authError?.status || 401;
  let message = status === 403 ? 'Forbidden' : status === 503 ? 'Authentication service unavailable' : 'Unauthorized';

  try {
    const payload = await authError.clone().json();
    if (typeof payload?.error === 'string' && payload.error.trim()) {
      message = payload.error;
    }
  } catch {
    // Keep fallback message.
  }

  const code =
    status === 401 ? 'UNAUTHORIZED' :
    status === 403 ? 'FORBIDDEN' :
    status === 404 ? 'NOT_FOUND' :
    status === 503 ? 'SERVICE_UNAVAILABLE' :
    fallbackCode;

  return errorResponse(message, code, status);
}

const TARGET_COLLECTIONS = ['properties', 'marketplace', 'housemates'];
const WRITE_BATCH_SIZE = 400;
const RETENTION_DAYS = 180;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const LOW_PHOTO_THRESHOLD = 1;
const SAMPLE_LIMIT = 25;
const RULE_DUPLICATE = 'duplicates';
const RULE_OLD_AD = 'oldAds';
const RULE_LOW_PHOTO = 'lowPhoto';

function parseBooleanFlag(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y';
}

async function parseRequestOptions(request) {
  let body = {};

  try {
    body = await request.json();
  } catch {
    // Body is optional for this endpoint.
  }

  const url = new URL(request.url);
  const execute = parseBooleanFlag(url.searchParams.get('execute')) || parseBooleanFlag(body.execute);
  const hardDelete = parseBooleanFlag(url.searchParams.get('hardDelete')) || parseBooleanFlag(body.hardDelete);

  return {
    execute,
    hardDelete,
  };
}

function parseDateValue(value) {
  if (!value) {
    return null;
  }

  if (typeof value?.toDate === 'function') {
    const dateFromTimestamp = value.toDate();
    return Number.isNaN(dateFromTimestamp?.getTime?.()) ? null : dateFromTimestamp;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  if (typeof value === 'object' && value !== null && typeof value._seconds === 'number') {
    const parsedDate = new Date(value._seconds * 1000);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  return null;
}

function getDateMs(value) {
  const parsed = parseDateValue(value);
  return parsed ? parsed.getTime() : null;
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function sortByMostRecent(a, b) {
  const aScore = a.updatedAtMs ?? a.createdAtMs ?? Number.NEGATIVE_INFINITY;
  const bScore = b.updatedAtMs ?? b.createdAtMs ?? Number.NEGATIVE_INFINITY;

  if (aScore !== bScore) {
    return bScore - aScore;
  }

  return a.id.localeCompare(b.id);
}

function toIsoOrNull(ms) {
  return typeof ms === 'number' ? new Date(ms).toISOString() : null;
}

function isAlreadyInactiveStatus(statusValue) {
  const normalizedStatus = normalizeText(statusValue);
  return normalizedStatus === 'archived' || normalizedStatus === 'deleted' || normalizedStatus === 'inactive';
}

function hasRefreshOrPromotionProtection(data, cutoffMs, nowMs) {
  const promotionFlags = [
    data?.isPromoted,
    data?.promoted,
    data?.isFeatured,
    data?.featured,
    data?.isBoosted,
    data?.boosted,
  ];

  if (promotionFlags.some((flag) => flag === true)) {
    return true;
  }

  const promotedUntilMs = getDateMs(data?.promotedUntil || data?.promotionEndsAt || data?.featuredUntil);
  if (typeof promotedUntilMs === 'number' && promotedUntilMs >= nowMs) {
    return true;
  }

  const recencyFields = [
    data?.refreshedAt,
    data?.lastRefreshedAt,
    data?.renewedAt,
    data?.bumpedAt,
    data?.promotedAt,
    data?.lastPromotedAt,
  ];

  return recencyFields.some((value) => {
    const ms = getDateMs(value);
    return typeof ms === 'number' && ms >= cutoffMs;
  });
}

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function safeString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function POST(request) {
  try {
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return authFailureResponse(adminResult.error, 'FORBIDDEN');
    }

    const { execute, hardDelete } = await parseRequestOptions(request);
    const db = getAdminFirestore();
    const nowMs = Date.now();
    const cutoffMs = nowMs - RETENTION_MS;

    const totals = {
      scanned: 0,
      candidates: 0,
      actionsExecuted: 0,
      byRule: {
        [RULE_DUPLICATE]: { candidates: 0, executed: 0 },
        [RULE_OLD_AD]: { candidates: 0, executed: 0 },
        [RULE_LOW_PHOTO]: { candidates: 0, executed: 0 },
      },
    };

    const perCollection = {};
    const sampleCandidates = [];
    const collectionErrors = [];
    const writeOperations = [];

    const recordCandidate = ({ collection, doc, reason, action, duplicateKey }) => {
      const candidateLog = {
        collection,
        docId: doc.id,
        reason,
        action,
        keyFields: {
          title: safeString(doc.data.title),
          price: safeString(doc.data.price),
          location: safeString(doc.data.location || doc.data.city || doc.data.address),
          duplicateKey: duplicateKey || null,
          createdAt: toIsoOrNull(doc.createdAtMs),
          updatedAt: toIsoOrNull(doc.updatedAtMs),
          imageCount: doc.imageCount,
          status: safeString(doc.data.status),
          promoted: Boolean(doc.data.isPromoted || doc.data.promoted),
          refreshedAt: safeString(doc.data.refreshedAt || doc.data.lastRefreshedAt || null),
        },
      };

      console.info('cleanup-db:candidate', candidateLog);

      totals.candidates += 1;
      totals.byRule[reason].candidates += 1;

      perCollection[collection].candidates += 1;
      perCollection[collection].byRule[reason].candidates += 1;

      if (sampleCandidates.length < SAMPLE_LIMIT) {
        sampleCandidates.push(candidateLog);
      }

      if (execute) {
        writeOperations.push({
          collection,
          rule: reason,
          action,
          ref: doc.ref,
          payload: action === 'update'
            ? {
                ...doc.updatePayload,
                cleanupMeta: {
                  ...(doc.data.cleanupMeta || {}),
                  lastRule: reason,
                  lastProcessedAt: new Date(),
                  mode: 'execute',
                },
                updatedAt: new Date(),
              }
            : null,
        });
      }
    };

    for (const collectionName of TARGET_COLLECTIONS) {
      perCollection[collectionName] = {
        scanned: 0,
        candidates: 0,
        executed: 0,
        byRule: {
          [RULE_DUPLICATE]: { candidates: 0, executed: 0 },
          [RULE_OLD_AD]: { candidates: 0, executed: 0 },
          [RULE_LOW_PHOTO]: { candidates: 0, executed: 0 },
        },
      };

      try {
        const snapshot = await db.collection(collectionName).get();
        const docs = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const createdAtMs = getDateMs(data.createdAt);
          const updatedAtMs = getDateMs(data.updatedAt);

          docs.push({
            id: docSnap.id,
            ref: docSnap.ref,
            data,
            createdAtMs,
            updatedAtMs,
            imageCount: getCanonicalImageCount(data),
            duplicateKey: getNormalizedCleanupDuplicateKey(data),
            cleanupReason: null,
            action: null,
            updatePayload: null,
          });
        });

        totals.scanned += docs.length;
        perCollection[collectionName].scanned = docs.length;

        const duplicateGroups = new Map();
        for (const doc of docs) {
          if (!doc.duplicateKey) {
            continue;
          }

          if (!duplicateGroups.has(doc.duplicateKey)) {
            duplicateGroups.set(doc.duplicateKey, []);
          }

          duplicateGroups.get(doc.duplicateKey).push(doc);
        }

        for (const [duplicateKey, groupDocs] of duplicateGroups.entries()) {
          if (groupDocs.length <= 1) {
            continue;
          }

          groupDocs.sort(sortByMostRecent);

          for (let i = 1; i < groupDocs.length; i += 1) {
            const duplicateDoc = groupDocs[i];
            duplicateDoc.cleanupReason = RULE_DUPLICATE;
            duplicateDoc.action = hardDelete ? 'delete' : 'update';
            duplicateDoc.updatePayload = {
              status: 'archived',
              archivedAt: new Date(),
              archivedReason: 'duplicate',
            };

            recordCandidate({
              collection: collectionName,
              doc: duplicateDoc,
              reason: RULE_DUPLICATE,
              action: duplicateDoc.action,
              duplicateKey,
            });
          }
        }

        for (const doc of docs) {
          if (doc.cleanupReason) {
            continue;
          }

          const baselineMs = doc.updatedAtMs ?? doc.createdAtMs;
          if (typeof baselineMs !== 'number' || baselineMs >= cutoffMs) {
            continue;
          }

          if (isAlreadyInactiveStatus(doc.data.status)) {
            continue;
          }

          if (hasRefreshOrPromotionProtection(doc.data, cutoffMs, nowMs)) {
            continue;
          }

          doc.cleanupReason = RULE_OLD_AD;
          doc.action = hardDelete ? 'delete' : 'update';
          doc.updatePayload = {
            status: 'archived',
            archivedAt: new Date(),
            archivedReason: 'retention-expired',
          };

          recordCandidate({
            collection: collectionName,
            doc,
            reason: RULE_OLD_AD,
            action: doc.action,
            duplicateKey: doc.duplicateKey,
          });
        }

        for (const doc of docs) {
          if (doc.cleanupReason) {
            continue;
          }

          if (doc.imageCount > LOW_PHOTO_THRESHOLD) {
            continue;
          }

          doc.cleanupReason = RULE_LOW_PHOTO;
          doc.action = 'update';
          doc.updatePayload = {
            status: 'low-quality',
            moderationFlags: {
              ...(doc.data.moderationFlags || {}),
              lowPhoto: true,
            },
            reviewRequired: true,
          };

          recordCandidate({
            collection: collectionName,
            doc,
            reason: RULE_LOW_PHOTO,
            action: doc.action,
            duplicateKey: doc.duplicateKey,
          });
        }
      } catch (collectionError) {
        const collectionErrorMessage = collectionError?.message || 'Unknown collection failure';
        console.error(`cleanup-db: failed processing ${collectionName}`, collectionError);
        collectionErrors.push({
          collection: collectionName,
          code: 'COLLECTION_PROCESS_FAILED',
          message: collectionErrorMessage,
        });
      }
    }

    if (execute && writeOperations.length > 0) {
      const chunks = chunkArray(writeOperations, WRITE_BATCH_SIZE);

      for (const chunk of chunks) {
        const batch = db.batch();

        for (const operation of chunk) {
          if (operation.action === 'delete') {
            batch.delete(operation.ref);
          } else {
            batch.set(operation.ref, operation.payload, { merge: true });
          }
        }

        await batch.commit();

        for (const operation of chunk) {
          totals.actionsExecuted += 1;
          totals.byRule[operation.rule].executed += 1;
          perCollection[operation.collection].executed += 1;
          perCollection[operation.collection].byRule[operation.rule].executed += 1;
        }
      }
    }

    return NextResponse.json({
      success: true,
      code: execute ? 'CLEANUP_EXECUTED' : 'CLEANUP_DRY_RUN',
      mode: execute ? 'executed' : 'dry-run',
      executeRequiredForWrites: true,
      retentionDays: RETENTION_DAYS,
      lowPhotoThreshold: LOW_PHOTO_THRESHOLD,
      writeStrategy: {
        batchChunkSize: WRITE_BATCH_SIZE,
        hardDelete,
      },
      totals,
      perCollection,
      sampleCandidates,
      metadata: {
        indexGuidance: {
          requiredForCurrentScan: false,
          notes: [
            'Current cleanup runs a full collection scan and does not require composite indexes.',
            'If you move old-ad filtering to Firestore queries, create composite indexes for status + updatedAt and status + createdAt per collection.',
          ],
        },
      },
      warnings: collectionErrors,
    });
  } catch (error) {
    console.error('cleanup-db fatal error:', error);
    return errorResponse(
      error?.message || 'Cleanup failed',
      'CLEANUP_FAILED',
      500,
      {
        mode: 'failed',
      }
    );
  }
}
