#!/usr/bin/env node

const { loadEnvConfig } = require('@next/env');
const admin = require('firebase-admin');

loadEnvConfig(process.cwd());

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    return process.argv[index + 1];
  }

  return fallback;
}

function readBooleanArg(name, fallback = false) {
  const value = readArg(name, null);
  if (value === null) return process.argv.includes(`--${name}`) || fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function getAdminIdToken() {
  const serviceAccount = {
    projectId: requireEnv('FIREBASE_PROJECT_ID'),
    clientEmail: requireEnv('FIREBASE_CLIENT_EMAIL'),
    privateKey: requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n')
  };

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  const customToken = await admin.auth().createCustomToken('codex-production-onboarding-admin', {
    admin: true,
    isAdmin: true,
    role: 'admin'
  });

  const tokenResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${requireEnv('NEXT_PUBLIC_FIREBASE_API_KEY')}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    }
  );

  const tokenResult = await tokenResponse.json();
  if (!tokenResponse.ok) {
    throw new Error(`Firebase token exchange failed: ${JSON.stringify(tokenResult)}`);
  }

  return tokenResult.idToken;
}

async function main() {
  const appUrl = String(process.env.PRODUCTION_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://nijahomzs.com').replace(/\/+$/, '');
  const maxJobs = Math.min(Math.max(parseInt(readArg('max-jobs', '5'), 10) || 5, 1), 100);
  const maxBatches = Math.min(Math.max(parseInt(readArg('max-batches', '1'), 10) || 1, 1), 50);
  const delayMinMs = Math.max(parseInt(readArg('delay-min-ms', '6000'), 10) || 6000, 0);
  const delayMaxMs = Math.max(parseInt(readArg('delay-max-ms', '16000'), 10) || 16000, delayMinMs);
  const dryRun = readBooleanArg('dry-run', false);
  const idToken = await getAdminIdToken();

  const batches = [];
  let totalProcessed = 0;
  for (let batch = 1; batch <= maxBatches; batch += 1) {
    const response = await fetch(`${appUrl}/api/admin/onboarding/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        maxJobs,
        delayMinMs,
        delayMaxMs,
        dryRun
      })
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { raw: text };
    }

    batches.push({
      batch,
      ok: response.ok,
      status: response.status,
      processedCount: result?.processedCount || 0,
      stoppedReason: result?.stoppedReason || null,
      result
    });

    if (!response.ok || result?.success === false) {
      process.exitCode = 1;
      break;
    }

    totalProcessed += result.processedCount || 0;
    if (result.stoppedReason !== 'max_jobs_reached') break;
  }

  console.log(JSON.stringify({
    ok: process.exitCode !== 1,
    appUrl,
    requested: { maxJobs, maxBatches, delayMinMs, delayMaxMs, dryRun },
    totalProcessed,
    batches
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error.message
  }, null, 2));
  process.exit(1);
});
