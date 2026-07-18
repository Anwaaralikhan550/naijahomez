import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

async function loadEngine() {
  const engineModule = await import('@/lib/content/content-engine');
  return engineModule.default || engineModule;
}

async function adminOrError(request) {
  const adminResult = await isAdmin(request);
  if (!adminResult.success) return { error: adminResult.error };
  return { admin: adminResult };
}

function jsonError(message, status = 500, code = 'CONTENT_ERROR') {
  return NextResponse.json({ success: false, error: message, code }, { status });
}

export async function GET(request) {
  try {
    const auth = await adminOrError(request);
    if (auth.error) return auth.error;

    const engine = await loadEngine();
    const data = await engine.listAdminContent({ limit: 60 });
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error('Failed to load admin content dashboard:', error);
    return jsonError('Failed to load content dashboard');
  }
}

export async function POST(request) {
  try {
    const auth = await adminOrError(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').trim();
    const engine = await loadEngine();

    if (action === 'createJob') {
      const job = await engine.createContentJob({
        topic: body.topic,
        promptType: body.promptType || 'property_guide',
        scheduledFor: body.scheduledFor || null,
        createdBy: auth.admin.userId,
        sourceReferences: body.sourceReferences || []
      });
      return NextResponse.json({ success: true, job });
    }

    if (action === 'updatePost') {
      const post = await engine.updateBlogPost({
        postId: body.postId,
        updates: body.updates || {},
        actorId: auth.admin.userId
      });
      return NextResponse.json({ success: true, post });
    }

    if (action === 'publishPost') {
      const post = await engine.updateBlogPost({
        postId: body.postId,
        updates: { ...(body.updates || {}), status: 'published' },
        actorId: auth.admin.userId
      });
      return NextResponse.json({ success: true, post });
    }

    if (action === 'schedulePost') {
      const post = await engine.updateBlogPost({
        postId: body.postId,
        updates: { ...(body.updates || {}), status: 'scheduled', scheduledFor: body.scheduledFor },
        actorId: auth.admin.userId
      });
      return NextResponse.json({ success: true, post });
    }

    if (action === 'rejectPost') {
      const post = await engine.updateBlogPost({
        postId: body.postId,
        updates: { status: 'rejected', rejectionReason: body.rejectionReason || 'Rejected by admin' },
        actorId: auth.admin.userId
      });
      return NextResponse.json({ success: true, post });
    }

    if (action === 'queueSocial') {
      const queued = await engine.queueSocialSharesForPost({
        postId: body.postId,
        scheduledFor: body.scheduledFor || null,
        actorId: auth.admin.userId
      });
      return NextResponse.json({ success: true, queued });
    }

    if (action === 'refreshTrends') {
      const result = await engine.refreshMarketTrends({ dryRun: Boolean(body.dryRun) });
      return NextResponse.json({ success: true, ...result });
    }

    return jsonError('Unsupported content action', 400, 'UNSUPPORTED_ACTION');
  } catch (error) {
    console.error('Failed to update content dashboard:', error);
    return jsonError(error.message || 'Failed to update content dashboard', error.status || 500);
  }
}
