export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres-client.cjs';
import { hashToken } from '@/lib/automation/onboarding-queue-adapter.cjs';
import { logEvent } from '@/lib/db/outreach-events-repository.cjs';

// Lightweight, unauthenticated beacon for client-only signals in the claim
// flow that have no other server touchpoint -- currently just "the agent
// hit the claim page while not logged in and is being sent to /login".
// Locked down to a fixed event-type whitelist and requires the token to
// resolve to a real (not necessarily unexpired -- it was just validated a
// moment ago by the caller) claim token, so this can't be used to write
// arbitrary events.
const ALLOWED_EVENT_TYPES = new Set(['login_required']);

export async function POST(request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const token = String(payload.token || '');
    const eventType = String(payload.eventType || '');

    if (!token || !ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ success: false, error: 'Invalid event' }, { status: 400 });
    }

    const tokenHash = hashToken(token);

    const singleResult = await query(
      `SELECT id, advert_id, collection_name FROM advert_claim_tokens WHERE token_hash = $1 LIMIT 1`,
      [tokenHash]
    );

    if (singleResult.rowCount > 0) {
      const row = singleResult.rows[0];
      await logEvent({
        claimTokenId: row.id,
        advertId: row.advert_id,
        collectionName: row.collection_name,
        eventType
      });
      return NextResponse.json({ success: true });
    }

    const batchResult = await query(
      `SELECT id, phone FROM advert_claim_batches WHERE token_hash = $1 LIMIT 1`,
      [tokenHash]
    );

    if (batchResult.rowCount > 0) {
      const row = batchResult.rows[0];
      await logEvent({
        batchTokenId: row.id,
        phone: row.phone || null,
        eventType
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unknown token' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to log event' }, { status: 500 });
  }
}
