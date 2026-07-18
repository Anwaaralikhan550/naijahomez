#!/usr/bin/env node
/**
 * Firestore vs Postgres drift/reconciliation report.
 *
 * Reads real Firestore (bypasses the DATA_STORE_PROVIDER shim on purpose --
 * this tool exists specifically to compare the two, so it must talk to the
 * actual Firebase Firestore Admin SDK, not the Postgres-backed emulation).
 * For every collection it knows about, it checks whether each Firestore doc
 * has a Postgres counterpart, and flags cases where Postgres looks stale
 * (older updatedAt than the Firestore doc).
 *
 * Three categories of collections, each compared against a different target:
 *   1. LISTING_COLLECTIONS   -> public_listings (matched by id)
 *   2. TYPED_TABLE_COLLECTIONS -> their dedicated typed table (matched by
 *      data->>'legacyDocId', the marker the backfill-app-documents-to-*
 *      scripts stamp on migrated rows; falls back to direct id match for
 *      rows never backfilled)
 *   3. GENERIC_COLLECTIONS   -> the generic app_documents shim (matched by
 *      collection_path + doc_id)
 *
 * Rows that exist in Postgres but not Firestore are NOT treated as errors --
 * new listings/records created after the Postgres-only cutover are expected
 * to never exist in Firestore. They're reported as informational counts.
 *
 * Usage:
 *   node scripts/reconcile-firestore-postgres.js [--collections=a,b,c] [--limit=500] [--json]
 */

const path = require('path');
const { loadEnvConfig } = require('@next/env');
const { FieldPath, getFirestore } = require('firebase-admin/firestore');
const { initAutomationAdmin } = require('../src/lib/automation/admin-firestore');
const { query, closePool } = require('../src/lib/db/postgres-client.cjs');

const projectRoot = path.resolve(__dirname, '..');

const LISTING_COLLECTIONS = new Set(['properties', 'marketplace', 'services', 'housemates', 'noticeboard']);

const TYPED_TABLE_COLLECTIONS = {
  blogPosts: 'blog_posts',
  contentJobs: 'content_jobs',
  supportTickets: 'support_tickets',
  listing_reports: 'listing_reports',
  kycSubmissions: 'kyc_submissions'
};

const GENERIC_COLLECTIONS = [
  'users', 'emailVerificationTokens', 'kycOtpCodes', 'supportEmailLogs',
  'marketTrends', 'socialShareQueue', 'socialShareLogs', 'adCampaigns',
  'adCampaignPayments', 'adMetricDaily', 'adMetricShards', 'adClickEvents',
  'marketEngagementReports', 'agentActivityReports', 'monetizationIntents',
  'transactionLogs', 'mail_logs', 'messages', 'privateConversations',
  'privateMessages', 'hubAccessCodes', 'hubCommunities', 'hubMembers',
  'hubNotifications', 'hubVisitorCodes', 'hubIssues', 'hubEmergencyAlerts',
  'hubAmenityBookings', 'hubAmenities', 'hubMarketplace', 'hubSmartServices',
  'hubEvents', 'hubForumDiscussions', 'hubForumReplies', 'hubJoinRequests',
  'hubAlerts', 'hubMessages', 'chatMessages', 'socialPosts', 'notifications',
  'surveyReports', 'surveySignatures'
];

const ALL_COLLECTIONS = [
  ...LISTING_COLLECTIONS,
  ...Object.keys(TYPED_TABLE_COLLECTIONS),
  ...GENERIC_COLLECTIONS
];

function parseArgs(argv) {
  const args = { collections: ALL_COLLECTIONS, limit: 0, batchSize: 300, json: false };
  for (const arg of argv) {
    if (arg.startsWith('--collections=')) {
      args.collections = arg.split('=').slice(1).join('=').split(',').map((s) => s.trim()).filter(Boolean);
    } else if (arg.startsWith('--limit=')) {
      args.limit = Math.max(0, parseInt(arg.split('=')[1], 10) || 0);
    } else if (arg === '--json') {
      args.json = true;
    }
  }
  return args;
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

async function fetchAllFirestoreDocs(db, collectionName, limit) {
  const docs = [];
  let lastDoc = null;
  const batchSize = 300;

  while (true) {
    const remaining = limit > 0 ? limit - docs.length : batchSize;
    if (limit > 0 && remaining <= 0) break;

    let ref = db.collection(collectionName).orderBy(FieldPath.documentId()).limit(Math.min(batchSize, remaining));
    if (lastDoc) ref = ref.startAfter(lastDoc);

    const snapshot = await ref.get();
    if (snapshot.empty) break;

    docs.push(...snapshot.docs);
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < Math.min(batchSize, remaining)) break;
  }

  return docs;
}

async function reconcileListingCollection(db, collectionName, limit) {
  const docs = await fetchAllFirestoreDocs(db, collectionName, limit);
  const result = { collection: collectionName, target: 'public_listings', firestoreCount: docs.length, missingInPostgres: [], staleInPostgres: [] };

  for (const doc of docs) {
    const data = doc.data() || {};
    const row = await query(
      `SELECT id, updated_at FROM public_listings WHERE collection_name = $1 AND id = $2 LIMIT 1`,
      [collectionName, doc.id]
    );

    if (row.rows.length === 0) {
      result.missingInPostgres.push(doc.id);
      continue;
    }

    const firestoreUpdated = toMillis(data.updatedAt);
    const postgresUpdated = toMillis(row.rows[0].updated_at);
    if (firestoreUpdated && postgresUpdated && firestoreUpdated > postgresUpdated + 5000) {
      result.staleInPostgres.push({ id: doc.id, firestoreUpdated, postgresUpdated });
    }
  }

  const countResult = await query(`SELECT COUNT(*) FROM public_listings WHERE collection_name = $1`, [collectionName]);
  result.postgresOnlyCount = Math.max(0, Number(countResult.rows[0].count) - (docs.length - result.missingInPostgres.length));
  return result;
}

async function reconcileTypedTable(db, collectionName, tableName, limit) {
  const docs = await fetchAllFirestoreDocs(db, collectionName, limit);
  const result = { collection: collectionName, target: tableName, firestoreCount: docs.length, missingInPostgres: [], staleInPostgres: [] };

  for (const doc of docs) {
    const data = doc.data() || {};
    const byLegacyId = await query(
      `SELECT id, updated_at FROM ${tableName} WHERE data->>'legacyDocId' = $1 LIMIT 1`,
      [doc.id]
    );
    const row = byLegacyId.rows.length > 0
      ? byLegacyId
      : await query(`SELECT id, updated_at FROM ${tableName} WHERE id::text = $1 LIMIT 1`, [doc.id]).catch(() => ({ rows: [] }));

    if (row.rows.length === 0) {
      result.missingInPostgres.push(doc.id);
      continue;
    }

    const firestoreUpdated = toMillis(data.updatedAt);
    const postgresUpdated = toMillis(row.rows[0].updated_at);
    if (firestoreUpdated && postgresUpdated && firestoreUpdated > postgresUpdated + 5000) {
      result.staleInPostgres.push({ id: doc.id, firestoreUpdated, postgresUpdated });
    }
  }

  const countResult = await query(`SELECT COUNT(*) FROM ${tableName}`, []);
  result.postgresOnlyCount = Math.max(0, Number(countResult.rows[0].count) - (docs.length - result.missingInPostgres.length));
  return result;
}

async function reconcileGenericCollection(db, collectionName, limit) {
  const docs = await fetchAllFirestoreDocs(db, collectionName, limit);
  const result = { collection: collectionName, target: 'app_documents', firestoreCount: docs.length, missingInPostgres: [], staleInPostgres: [] };

  for (const doc of docs) {
    const data = doc.data() || {};
    const row = await query(
      `SELECT doc_id, updated_at FROM app_documents WHERE collection_path = $1 AND doc_id = $2 LIMIT 1`,
      [collectionName, doc.id]
    );

    if (row.rows.length === 0) {
      result.missingInPostgres.push(doc.id);
      continue;
    }

    const firestoreUpdated = toMillis(data.updatedAt);
    const postgresUpdated = toMillis(row.rows[0].updated_at);
    if (firestoreUpdated && postgresUpdated && firestoreUpdated > postgresUpdated + 5000) {
      result.staleInPostgres.push({ id: doc.id, firestoreUpdated, postgresUpdated });
    }
  }

  const countResult = await query(`SELECT COUNT(*) FROM app_documents WHERE collection_path = $1`, [collectionName]);
  result.postgresOnlyCount = Math.max(0, Number(countResult.rows[0].count) - (docs.length - result.missingInPostgres.length));
  return result;
}

async function main() {
  loadEnvConfig(projectRoot);
  const args = parseArgs(process.argv.slice(2));

  // Bypass the DATA_STORE_PROVIDER shim on purpose -- we need the real
  // Firestore Admin client to compare against, not the Postgres facade.
  const db = getFirestore(initAutomationAdmin());

  const results = [];
  for (const collectionName of args.collections) {
    try {
      if (LISTING_COLLECTIONS.has(collectionName)) {
        results.push(await reconcileListingCollection(db, collectionName, args.limit));
      } else if (TYPED_TABLE_COLLECTIONS[collectionName]) {
        results.push(await reconcileTypedTable(db, collectionName, TYPED_TABLE_COLLECTIONS[collectionName], args.limit));
      } else {
        results.push(await reconcileGenericCollection(db, collectionName, args.limit));
      }
      const last = results[results.length - 1];
      console.log(`[reconcile] ${collectionName} -> ${last.target}: firestore=${last.firestoreCount} missing_in_postgres=${last.missingInPostgres.length} stale=${last.staleInPostgres.length} postgres_only=${last.postgresOnlyCount}`);
    } catch (error) {
      results.push({ collection: collectionName, error: error.message });
      console.error(`[reconcile] ${collectionName} FAILED: ${error.message}`);
    }
  }

  const summary = {
    totalCollections: results.length,
    totalMissingInPostgres: results.reduce((sum, r) => sum + (r.missingInPostgres?.length || 0), 0),
    totalStaleInPostgres: results.reduce((sum, r) => sum + (r.staleInPostgres?.length || 0), 0),
    totalPostgresOnly: results.reduce((sum, r) => sum + (r.postgresOnlyCount || 0), 0),
    collectionsWithErrors: results.filter((r) => r.error).map((r) => r.collection)
  };

  if (args.json) {
    console.log(JSON.stringify({ summary, results }, null, 2));
  } else {
    console.log('\n=== Reconciliation Summary ===');
    console.log(JSON.stringify(summary, null, 2));
  }

  process.exitCode = summary.totalMissingInPostgres > 0 || summary.collectionsWithErrors.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error('[reconcile] fatal error:', error);
  process.exitCode = 1;
}).finally(async () => {
  await closePool().catch(() => {});
});
