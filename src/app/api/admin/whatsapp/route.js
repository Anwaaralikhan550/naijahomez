export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth-middleware';
import {
  getEvolutionConnectionState,
  getEvolutionInstanceDetails,
  requestEvolutionPairing
} from '@/lib/whatsapp/evolution-client';

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

// GET - current link state of the outreach WhatsApp number.
export async function GET(request) {
  try {
    const adminResult = await isAdmin(request);
    if (!adminResult.success) return adminResult.error;

    const [state, details] = await Promise.all([
      getEvolutionConnectionState().catch(() => null),
      getEvolutionInstanceDetails().catch(() => null)
    ]);

    if (!state && !details) {
      return errorResponse('Could not reach the WhatsApp gateway.', 'EVOLUTION_UNREACHABLE', 503);
    }

    const connectionStatus = details?.connectionStatus || state?.state || 'unknown';

    return NextResponse.json({
      success: true,
      connected: connectionStatus === 'open',
      connectionStatus,
      instanceName: state?.instanceName || details?.instanceName || null,
      number: details?.ownerJid ? details.ownerJid.split('@')[0] : null,
      profileName: details?.profileName || null,
      disconnectionAt: details?.disconnectionAt || null,
      disconnectReason: details?.disconnectReason || null,
      disconnectionReasonCode: details?.disconnectionReasonCode ?? null
    });
  } catch (error) {
    return errorResponse(error.message || 'Failed to read WhatsApp status.', 'WHATSAPP_STATUS_FAILED', 500);
  }
}

// POST - mint a fresh pairing QR. The QR expires within about a minute, so it
// is generated on demand rather than stored or emailed anywhere.
export async function POST(request) {
  try {
    const adminResult = await isAdmin(request);
    if (!adminResult.success) return adminResult.error;

    const pairing = await requestEvolutionPairing();
    if (!pairing.qrBase64 && !pairing.pairingCode) {
      return errorResponse(
        'The gateway did not return a QR code. It may already be linked.',
        'NO_QR_RETURNED',
        409
      );
    }

    return NextResponse.json({
      success: true,
      qrBase64: pairing.qrBase64,
      pairingCode: pairing.pairingCode,
      expiresInSeconds: 60,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return errorResponse(error.message || 'Failed to generate a QR code.', 'WHATSAPP_PAIRING_FAILED', 500);
  }
}
