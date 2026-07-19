#!/usr/bin/env node
/**
 * Phase 6 burn-in monitor: dual-auth migration coverage + health.
 *
 * Compares Firebase Auth (source of truth for total user count during the
 * transition window) against app_user_profiles (the new Postgres-native
 * auth store) to report:
 *   - migration coverage (% of Firebase users that have logged in at least
 *     once since cutover and gotten a lazy-migrated Postgres credential)
 *   - orphans: Firebase users with no Postgres profile at all yet (expected,
 *     shrinks over time as users log in)
 *   - locked-out / high-failed-attempt accounts (possible attack or bug)
 *   - profiles with a password_hash vs Google-only sign-in
 *
 * Safe to run repeatedly (read-only). Intended as a daily check through the
 * Phase 6 burn-in window.
 *
 * Usage: node scripts/auth-migration-status.js [--json]
 */

const path = require('path');
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(path.resolve(__dirname, '..'));

const { query, closePool } = require('../src/lib/db/postgres-client.cjs');
const { getAdminAuth } = require('../src/lib/firebase-admin.js');

const asJson = process.argv.includes('--json');

async function listAllFirebaseUsers() {
  const users = [];
  let pageToken;
  do {
    const res = await getAdminAuth().listUsers(1000, pageToken);
    users.push(...res.users);
    pageToken = res.pageToken;
  } while (pageToken);
  return users;
}

async function main() {
  const [firebaseUsers, profilesResult, lockedResult, failedResult] = await Promise.all([
    listAllFirebaseUsers(),
    query(`SELECT user_id, email, sign_in_provider, password_hash IS NOT NULL AS has_password,
                  auth_migrated_at, failed_login_attempts, locked_until
           FROM app_user_profiles`),
    query(`SELECT user_id, email, locked_until FROM app_user_profiles
           WHERE locked_until IS NOT NULL AND locked_until > NOW()`),
    query(`SELECT user_id, email, failed_login_attempts FROM app_user_profiles
           WHERE failed_login_attempts > 0 ORDER BY failed_login_attempts DESC LIMIT 20`)
  ]);

  const profileByUid = new Map(profilesResult.rows.map((r) => [r.user_id, r]));
  const migrated = profilesResult.rows.filter((r) => r.auth_migrated_at);
  const withPassword = profilesResult.rows.filter((r) => r.has_password);
  const googleOnly = profilesResult.rows.filter((r) => r.sign_in_provider === 'google' && !r.has_password);

  const orphanFirebaseUsers = firebaseUsers.filter((u) => !profileByUid.has(u.uid));

  const report = {
    generatedAt: new Date().toISOString(),
    firebaseTotalUsers: firebaseUsers.length,
    postgresProfiles: profilesResult.rows.length,
    migratedCount: migrated.length,
    migrationCoveragePct: firebaseUsers.length
      ? Number(((migrated.length / firebaseUsers.length) * 100).toFixed(1))
      : 0,
    orphanFirebaseUsers: orphanFirebaseUsers.length,
    withPasswordCredential: withPassword.length,
    googleOnlyCredential: googleOnly.length,
    currentlyLockedAccounts: lockedResult.rows,
    accountsWithFailedAttempts: failedResult.rows
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('=== Phase 6 Auth Migration Status ===');
    console.log(`Firebase Auth total users:     ${report.firebaseTotalUsers}`);
    console.log(`Postgres profiles created:     ${report.postgresProfiles}`);
    console.log(`Migrated (auth_migrated_at):   ${report.migratedCount} (${report.migrationCoveragePct}%)`);
    console.log(`Not yet migrated (orphans):    ${report.orphanFirebaseUsers}`);
    console.log(`  - with password credential:  ${report.withPasswordCredential}`);
    console.log(`  - Google-only credential:    ${report.googleOnlyCredential}`);
    console.log(`Currently locked accounts:     ${report.currentlyLockedAccounts.length}`);
    if (report.currentlyLockedAccounts.length) {
      report.currentlyLockedAccounts.forEach((r) => console.log(`    ${r.email} locked until ${r.locked_until}`));
    }
    console.log(`Accounts with failed attempts:  ${report.accountsWithFailedAttempts.length}`);
    report.accountsWithFailedAttempts.forEach((r) => console.log(`    ${r.email}: ${r.failed_login_attempts} failed attempts`));
  }

  await closePool();
}

main().catch((err) => {
  console.error('auth-migration-status failed:', err);
  process.exit(1);
});
