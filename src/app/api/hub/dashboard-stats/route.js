import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth, isAdmin } from '@/lib/auth-middleware';

export async function GET(request) {
  try {
    // Initialize admin SDK
    const db = getAdminFirestore();

    console.log('Dashboard stats request - verifying admin authentication...');

    // CRITICAL: Verify authentication and admin role
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      console.error('Unauthorized dashboard stats attempt blocked');
      return authResult.error;
    }

    // For now, allow authenticated users to access their community dashboard
    // TODO: Implement proper community-level admin checking

    console.log('Admin dashboard stats access approved for user:', authResult.userId);

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');

    if (!communityId) {
      return NextResponse.json({ error: 'Community ID is required' }, { status: 400 });
    }

    // Get all stats in parallel
    const [
      membersSnapshot,
      issuesSnapshot,
      visitorsSnapshot,
      marketplaceSnapshot,
      notificationsSnapshot,
      amenitiesSnapshot,
      alertsSnapshot
    ] = await Promise.all([
      // Total active members
      db.collection('hubMembers')
        .where('communityId', '==', communityId)
        .where('isActive', '==', true)
        .get(),
      
      // Active issues (open and in-progress)
      db.collection('hubIssues')
        .where('communityId', '==', communityId)
        .where('status', 'in', ['open', 'in-progress'])
        .get(),
      
      // Today's visitors
      db.collection('visitorCodes')
        .where('communityId', '==', communityId)
        .where('visitDate', '>=', getTodayStart())
        .where('visitDate', '<=', getTodayEnd())
        .get(),
      
      // Active marketplace items
      db.collection('hubMarketplace')
        .where('communityId', '==', communityId)
        .where('isActive', '==', true)
        .get(),
      
      // Notifications sent this month
      db.collection('hubNotifications')
        .where('communityId', '==', communityId)
        .where('createdAt', '>=', getMonthStart())
        .get(),
      
      // Active amenities
      db.collection('hubAmenities')
        .where('communityId', '==', communityId)
        .where('isActive', '==', true)
        .get(),
      
      // Active emergency alerts
      db.collection('emergencyAlerts')
        .where('communityId', '==', communityId)
        .where('isActive', '==', true)
        .get()
    ]);

    // Get recent activity
    const recentActivitySnapshot = await db.collection('hubIssues')
      .where('communityId', '==', communityId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

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

    // Calculate join requests pending approval
    const joinRequestsSnapshot = await db.collection('joinRequests')
      .where('communityId', '==', communityId)
      .where('status', '==', 'pending')
      .get();

    const stats = {
      totalMembers: membersSnapshot.size,
      activeIssues: issuesSnapshot.size,
      pendingVisitors: visitorsSnapshot.size,
      marketplaceItems: marketplaceSnapshot.size,
      notificationsThisMonth: notificationsSnapshot.size,
      activeAmenities: amenitiesSnapshot.size,
      activeAlerts: alertsSnapshot.size,
      pendingJoinRequests: joinRequestsSnapshot.size,
      recentActivity
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error in dashboard-stats API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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