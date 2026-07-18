#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const { getEvolutionConfig } = require('../src/lib/whatsapp/evolution-client');

function loadEnv() {
  dotenv.config();
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
}

async function main() {
  loadEnv();
  const { apiUrl, apiKey, instanceName } = getEvolutionConfig();
  const headers = {
    apikey: apiKey,
    Origin: process.env.EVOLUTION_HEALTH_ORIGIN || 'http://127.0.0.1:3000'
  };

  const rootResponse = await fetch(`${apiUrl}/`, {
    headers
  });
  const rootPayload = await rootResponse.json().catch(() => ({}));

  if (!rootResponse.ok) {
    console.error('[evolution:health] Failed');
    console.error(JSON.stringify(rootPayload, null, 2));
    process.exit(1);
  }

  const stateResponse = await fetch(
    `${apiUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`,
    { headers }
  );
  const statePayload = await stateResponse.json().catch(() => ({}));

  console.log('[evolution:health] API OK');
  console.log(JSON.stringify({
    api: {
      status: rootPayload.status,
      version: rootPayload.version,
      message: rootPayload.message
    },
    instance: stateResponse.ok
      ? statePayload
      : {
          status: 'not_ready',
          message: `Instance "${instanceName}" is not connected/created yet. QR scan can be done later.`
        }
  }, null, 2));
}

main().catch((error) => {
  console.error('[evolution:health] Failed');
  console.error(error.message);
  process.exit(1);
});
