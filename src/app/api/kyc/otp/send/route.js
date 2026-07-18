export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getAdminFirestore } from '@/lib/firebase-admin';
import evolutionClient from '@/lib/whatsapp/evolution-client';
import {
  buildOtpDocId,
  generateOtpCode,
  hashOtp,
  maskPhone,
  normalizePhoneNumber,
  nowDate,
  OTP_DAILY_LIMIT,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  toIso
} from '@/lib/kyc/kyc-service';

export async function POST(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) return authResult.error;

    const body = await request.json().catch(() => ({}));
    const phone = normalizePhoneNumber(body.phone);
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Enter a valid WhatsApp phone number.' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const otpRef = db.collection('otpRequests').doc(buildOtpDocId(authResult.userId, phone));
    const now = nowDate();
    const otpDoc = await otpRef.get();
    const existing = otpDoc.exists ? otpDoc.data() || {} : {};
    const sentAt = existing.sentAt?.toDate?.() || (existing.sentAt ? new Date(existing.sentAt) : null);
    const dailyWindowStart = existing.dailyWindowStart?.toDate?.() || null;
    const sameDailyWindow =
      dailyWindowStart && now.getTime() - dailyWindowStart.getTime() < 24 * 60 * 60 * 1000;
    const dailyCount = sameDailyWindow ? Number(existing.dailyCount || 0) : 0;

    if (sentAt && now.getTime() - sentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now.getTime() - sentAt.getTime())) / 1000);
      return NextResponse.json(
        {
          success: false,
          code: 'OTP_RATE_LIMITED',
          error: `Please wait ${retryAfterSeconds}s before requesting another code.`,
          retryAfterSeconds
        },
        { status: 429 }
      );
    }

    if (dailyCount >= OTP_DAILY_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          code: 'OTP_DAILY_LIMIT_REACHED',
          error: 'Daily OTP limit reached. Please try again tomorrow.'
        },
        { status: 429 }
      );
    }

    const code = generateOtpCode();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const text = `Your Nijahomzs verification code is ${code}. It expires in 10 minutes. Do not share this code.`;

    await evolutionClient.sendEvolutionTextMessage({ to: phone, text });

    await otpRef.set({
      userId: authResult.userId,
      phone,
      otpHash: hashOtp({ code, userId: authResult.userId, phone }),
      attempts: 0,
      sentAt: now,
      expiresAt,
      verifiedAt: null,
      dailyWindowStart: sameDailyWindow ? dailyWindowStart : now,
      dailyCount: dailyCount + 1,
      updatedAt: now,
      createdAt: existing.createdAt || now
    }, { merge: true });

    return NextResponse.json({
      success: true,
      phone: maskPhone(phone),
      expiresAt: toIso(expiresAt)
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        code: 'WHATSAPP_OTP_SEND_FAILED',
        error: error.message || 'Failed to send WhatsApp OTP'
      },
      { status: 500 }
    );
  }
}
