const firestoreQueue = require('./onboarding-queue');
const postgresQueue = require('./onboarding-queue-postgres.cjs');
const { isAppDbEnabled } = require('../db/postgres-client.cjs');

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function shouldUsePostgresOnboarding() {
  const provider = normalizeText(process.env.ONBOARDING_QUEUE_PROVIDER || '');
  if (provider === 'firestore') return false;
  if (provider === 'postgres' || provider === 'postgresql') return true;
  return isAppDbEnabled();
}

function selectQueue() {
  return shouldUsePostgresOnboarding() ? postgresQueue : firestoreQueue;
}

function proxy(name) {
  return (...args) => selectQueue()[name](...args);
}

module.exports = {
  shouldUsePostgresOnboarding,
  createBatchClaimToken: proxy('createBatchClaimToken'),
  createClaimToken: proxy('createClaimToken'),
  createOnboardingQueueItem: proxy('createOnboardingQueueItem'),
  claimBatchWithToken: proxy('claimBatchWithToken'),
  claimAdvertWithToken: proxy('claimAdvertWithToken'),
  countSentMessagesSince: proxy('countSentMessagesSince'),
  fetchListing: proxy('fetchListing'),
  getAppUrl: proxy('getAppUrl'),
  getLocationPriority: proxy('getLocationPriority'),
  hashToken: proxy('hashToken'),
  isNumberSuppressed: proxy('isNumberSuppressed'),
  isUnclaimedImportedListing: proxy('isUnclaimedImportedListing'),
  markQueueFailed: proxy('markQueueFailed'),
  markQueueSuppressed: proxy('markQueueSuppressed'),
  normalizePhoneNumber: proxy('normalizePhoneNumber'),
  randomDelayMs: proxy('randomDelayMs'),
  recoverStaleProcessingJobs: proxy('recoverStaleProcessingJobs'),
  resolveAgentName: proxy('resolveAgentName'),
  resolveAgentPhone: proxy('resolveAgentPhone'),
  resolveListingLocation: proxy('resolveListingLocation'),
  suppressNumber: proxy('suppressNumber'),
  toDate: proxy('toDate'),
  validateBatchClaimToken: proxy('validateBatchClaimToken'),
  validateClaimToken: proxy('validateClaimToken'),
  FieldValue: firestoreQueue.FieldValue
};
