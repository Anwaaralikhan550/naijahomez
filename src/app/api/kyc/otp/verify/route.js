export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  buildOtpDocId,
  hashOtp,
  maskPhone,
  normalizePhoneNumber,
  nowDate,
  OTP_MAX_ATTEMPTS
} from '@/lib/kyc/kyc-service';

export async function POST(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) return authResult.error;

    const body = await request.json().catch(() => ({}));
    const phone = normalizePhoneNumber(body.phone);
    const code = String(body.code || '').replace(/\D/g, '');

    if (!phone || code.length !== 6) {
      return NextResponse.json(
        { success: false, error: 'Enter the 6-digit code sent to WhatsApp.' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const otpRef = db.collection('otpRequests').doc(buildOtpDocId(authResult.userId, phone));
    const userRef = db.collection('users').doc(authResult.userId);
    const now = nowDate();

    await db.runTransaction(async (transaction) => {
      const otpDoc = await transaction.get(otpRef);
      if (!otpDoc.exists) {
        const err = new Error('OTP code not found. Please request a new code.');
        err.status = 404;
        throw err;
      }

      const data = otpDoc.data() || {};
      const expiresAt = data.expiresAt?.toDate?.() || new Date(data.expiresAt);
      const attempts = Number(data.attempts || 0);

      if (data.verifiedAt) {
        return;
      }

      if (!expiresAt || expiresAt.getTime() <= Date.now()) {
        const err = new Error('OTP code has expired. Please request a new code.');
        err.status = 400;
        throw err;
      }

      if (attempts >= OTP_MAX_ATTEMPTS) {
        const err = new Error('Too many incorrect attempts. Please request a new code.');
        err.status = 429;
        throw err;
      }

      const expectedHash = hashOtp({ code, userId: authResult.userId, phone });
      if (expectedHash !== data.otpHash) {
        transaction.update(otpRef, {
          attempts: attempts + 1,
          updatedAt: now
        });
        const err = new Error('Invalid OTP code.');
        err.status = 400;
        throw err;
      }

      transaction.update(otpRef, {
        verifiedAt: now,
        attempts,
        updatedAt: now
      });

      transaction.set(userRef, {
        uid: authResult.userId,
        phoneNumber: phone,
        phoneVerification: {
          verified: true,
          method: 'whatsapp_otp',
          phone,
          verifiedAt: now.toISOString()
        },
        updatedAt: now
      }, { merge: true });
    });

    return NextResponse.json({
      success: true,
      phone: maskPhone(phone),
      phoneVerification: {
        verified: true,
        method: 'whatsapp_otp'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to verify OTP' },
      { status: error.status || 500 }
    );
  }
}
