#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const { generateListingClaimMessage } = require('../src/lib/automation/message-template');
const { sendEvolutionTextMessage } = require('../src/lib/whatsapp/evolution-client');

function loadEnv() {
  dotenv.config();
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
}

async function main() {
  loadEnv();

  const phone = process.argv[2];
  if (!phone) {
    console.error('Usage: node scripts/test-whatsapp-send.js <phone>');
    process.exit(1);
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://nijahomzs.com').replace(/\/+$/, '');
  const message = generateListingClaimMessage({
    title: 'Test Property Advert',
    claimUrl: `${appUrl}/claim?token=test-token`
  });

  const response = await sendEvolutionTextMessage({
    to: phone,
    text: message
  });

  console.log('[test-whatsapp-send] Message sent');
  console.log(JSON.stringify({
    to: phone,
    providerMessageId: response?.key?.id || response?.messageId || response?.id || null
  }, null, 2));
}

main().catch((error) => {
  console.error('[test-whatsapp-send] Failed:', error.message);
  if (error.details) console.error(JSON.stringify(error.details, null, 2));
  process.exit(1);
});
