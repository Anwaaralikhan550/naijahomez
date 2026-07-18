export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';

function errorResponse(message, code = 'INTERNAL_ERROR', status = 500) {
  return NextResponse.json({ success: false, error: message, code }, { status });
}

async function authFailureResponse(authError, fallbackCode = 'UNAUTHORIZED') {
  const status = authError?.status || 401;
  let message = status === 403 ? 'Forbidden' : status === 503 ? 'Authentication service unavailable' : 'Unauthorized';

  try {
    const payload = await authError.clone().json();
    if (typeof payload?.error === 'string' && payload.error.trim()) {
      message = payload.error;
    }
  } catch {
    // Keep fallback message.
  }

  const code =
    status === 401 ? 'UNAUTHORIZED' :
    status === 403 ? 'FORBIDDEN' :
    status === 404 ? 'NOT_FOUND' :
    status === 503 ? 'SERVICE_UNAVAILABLE' :
    fallbackCode;

  return errorResponse(message, code, status);
}



export async function GET(request) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    console.log('Dashboard stats request - verifying admin authentication...');

    // CRITICAL: Verify authentication and admin role
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      console.error('Unauthorized dashboard stats attempt blocked');
      return authFailureResponse(authResult.error);
    }

    // For now, allow authenticated users to access their community dashboard
    // TODO: Implement proper community-level admin checking

    console.log('Admin dashboard stats access approved for user:', authResult.userId);

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');

    if (!communityId) {
      return errorResponse('Community ID is required', 'VALIDATION_ERROR', 400);
    }

    // Run all count aggregations and recent activity in parallel
    const [
      membersCountSnapshot,
      issuesCountSnapshot,
      visitorsCountSnapshot,
      marketplaceCountSnapshot,
      notificationsCountSnapshot,
      amenitiesCountSnapshot,
      alertsCountSnapshot,
      joinRequestsCountSnapshot,
      recentActivitySnapshot
    ] = await Promise.all([
      // Total active members
      db.collection('hubMembers')
        .where('communityId', '==', communityId)
        .where('isActive', '==', true)
        .count()
        .get(),

      // Active issues (open and in-progress)
      db.collection('hubIssues')
        .where('communityId', '==', communityId)
        .where('status', 'in', ['open', 'in-progress'])
        .count()
        .get(),

      // Today's visitors
      db.collection('visitorCodes')
        .where('communityId', '==', communityId)
        .where('visitDate', '>=', getTodayStart())
        .where('visitDate', '<=', getTodayEnd())
        .count()
        .get(),

      // Active marketplace items
      db.collection('marketplace')
        .where('communityId', '==', communityId)
        .where('status', '==', 'active')
        .count()
        .get(),

      // Notifications sent this month
      db.collection('hubNotifications')
        .where('communityId', '==', communityId)
        .where('createdAt', '>=', getMonthStart())
        .count()
        .get(),

      // Active amenities
      db.collection('hubAmenities')
        .where('communityId', '==', communityId)
        .where('isActive', '==', true)
        .count()
        .get(),

      // Active emergency alerts
      db.collection('hubEmergencyAlerts')
        .where('communityId', '==', communityId)
        .where('isActive', '==', true)
        .count()
        .get(),

      // Pending join requests
      db.collection('joinRequests')
        .where('communityId', '==', communityId)
        .where('status', '==', 'pending')
        .count()
        .get(),

      // Recent activity details still require document reads
      db.collection('hubIssues')
        .where('communityId', '==', communityId)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get()
    ]);

    const recentActivity = [];
    recentActivitySnapshot.forEach((doc) => {
      const data = doc.data();
      recentActivity.push({
        id: doc.id,
        type: 'issue',
        title: data.title,
        description: data.description,
        createdAt: data.createdAt,
        reporterName: data.reporterName
      });
    });

    const stats = {
      totalMembers: membersCountSnapshot.data().count,
      activeIssues: issuesCountSnapshot.data().count,
      pendingVisitors: visitorsCountSnapshot.data().count,
      marketplaceItems: marketplaceCountSnapshot.data().count,
      notificationsThisMonth: notificationsCountSnapshot.data().count,
      activeAmenities: amenitiesCountSnapshot.data().count,
      activeAlerts: alertsCountSnapshot.data().count,
      pendingJoinRequests: joinRequestsCountSnapshot.data().count,
      recentActivity
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error in dashboard-stats API:', error);
    return errorResponse(error.message, 'INTERNAL_ERROR', 500);
  }
}

function getTodayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getTodayEnd() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

function getMonthStart() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}
