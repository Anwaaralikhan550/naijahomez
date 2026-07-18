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

async function main() {
  const appUrl = String(process.env.PRODUCTION_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://nijahomzs.com').replace(/\/+$/, '');
  const limit = Math.min(Math.max(parseInt(readArg('limit', '50'), 10) || 50, 1), 100);
  const delayMs = Math.max(parseInt(readArg('delay-ms', '800'), 10) || 800, 0);
  const maxAgeDays = Math.max(parseInt(readArg('max-age-days', '30'), 10) || 30, 1);
  const runOnboarding = !readBooleanArg('skip-onboarding', false);
  const onboardingMaxJobs = Math.min(Math.max(parseInt(readArg('onboarding-max-jobs', String(limit)), 10) || limit, 1), 100);

  const serviceAccount = {
    projectId: requireEnv('FIREBASE_PROJECT_ID'),
    clientEmail: requireEnv('FIREBASE_CLIENT_EMAIL'),
    privateKey: requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n')
  };

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  const customToken = await admin.auth().createCustomToken('codex-production-scraper-admin', {
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

  const scrapeResponse = await fetch(`${appUrl}/api/admin/scraper`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenResult.idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source: 'nigeria-property-centre',
      category: 'property',
      limit,
      detail: true,
      delayMs,
      maxAgeDays,
      concurrency: 2,
      runOnboarding,
      onboardingMaxJobs
    })
  });

  const scrapeText = await scrapeResponse.text();
  let scrapeResult;
  try {
    scrapeResult = JSON.parse(scrapeText);
  } catch {
    scrapeResult = { raw: scrapeText };
  }

  console.log(JSON.stringify({
    ok: scrapeResponse.ok,
    status: scrapeResponse.status,
    appUrl,
    requested: { limit, delayMs, maxAgeDays, runOnboarding, onboardingMaxJobs },
    result: scrapeResult
  }, null, 2));

  if (!scrapeResponse.ok || scrapeResult?.success === false) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error.message
  }, null, 2));
  process.exit(1);
});
