export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth-middleware';

const DEFAULT_MAX_JOBS = 20;
const HARD_MAX_JOBS = 100;

const errorResponse = (message, code, status = 500, extra = {}) =>
  NextResponse.json({ success: false, error: message, code, ...extra }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

function readPositiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(Math.floor(parsed), max);
}

function readNonNegativeInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(Math.floor(parsed), max);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

export async function POST(request) {
  try {
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return authErrorResponse(adminResult.error);
    }

    let payload = {};
    try {
      payload = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 'INVALID_JSON_BODY', 400);
    }

    const maxJobs = readPositiveInteger(payload.maxJobs, DEFAULT_MAX_JOBS, HARD_MAX_JOBS);
    if (maxJobs === null) {
      return errorResponse('maxJobs must be a positive integer', 'INVALID_MAX_JOBS', 400);
    }

    const delayMinMs = readNonNegativeInteger(payload.delayMinMs, 0, 120000);
    const delayMaxMs = readNonNegativeInteger(payload.delayMaxMs, 0, 120000);
    if (delayMinMs === null || delayMaxMs === null) {
      return errorResponse('delayMinMs and delayMaxMs must be non-negative integers', 'INVALID_DELAY', 400);
    }

    const dryRun = payload.dryRun === true;
    const outreachModule = await import('@/lib/automation/listing-outreach-service.js');
    const processNextOnboardingJob =
      outreachModule.processNextOnboardingJob ||
      outreachModule.default?.processNextOnboardingJob;

    if (!processNextOnboardingJob) {
      return errorResponse('Onboarding worker is not available', 'ONBOARDING_WORKER_UNAVAILABLE', 500);
    }

    const jobs = [];
    for (let index = 0; index < maxJobs; index += 1) {
      const result = await processNextOnboardingJob({ dryRun });
      if (!result?.processed) {
        return NextResponse.json({
          success: true,
          dryRun,
          requestedMaxJobs: maxJobs,
          processedCount: jobs.length,
          stoppedReason: result?.reason || 'no_pending_jobs',
          rateLimit: result?.reason === 'rate_limited'
            ? {
                scope: result.scope,
                count: result.count,
                limit: result.limit,
                waitMs: result.waitMs
              }
            : null,
          jobs
        });
      }

      jobs.push({
        queueId: result.queueId || null,
        listingId: result.listingId || null,
        to: result.to || null,
        sent: Boolean(result.sent),
        suppressed: Boolean(result.suppressed),
        batched: Boolean(result.batched),
        batchedCount: result.batchedCount || 1,
        batchTokenId: result.batchTokenId || null
      });

      const shouldDelay = !dryRun && result.sent && index < maxJobs - 1;
      if (shouldDelay && delayMaxMs > 0) {
        const spread = Math.max(0, delayMaxMs - delayMinMs);
        await sleep(delayMinMs + Math.floor(Math.random() * (spread + 1)));
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      requestedMaxJobs: maxJobs,
      processedCount: jobs.length,
      stoppedReason: 'max_jobs_reached',
      jobs
    });
  } catch (error) {
    console.error('POST /api/admin/onboarding/run failed:', error);
    return errorResponse(
      error?.message || 'Unexpected server error while running onboarding worker',
      'ONBOARDING_RUN_FAILED',
      500
    );
  }
}
