'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import HubLayout from '@/components/hub/HubLayout';
import HubAdmin from '@/components/hub/HubAdmin';

/**
 * Admin Page with Auth + Role Guard
 *
 * Security requirements:
 * 1. Unauthenticated users -> redirect to /login with redirect param
 * 2. Authenticated non-admin users -> show Access Denied
 * 3. Authenticated admin users -> render admin dashboard
 *
 * IMPORTANT: No admin UI is rendered until auth check completes
 */
export default function HubAdminPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [roleCheckState, setRoleCheckState] = useState({
    checking: true,
    isAdmin: false,
    error: null
  });

  // Auth + Role check effect
  useEffect(() => {
    const checkAdminAccess = async () => {
      // Wait for auth to finish loading
      if (authLoading) {
        return;
      }

      // If not authenticated, redirect to login
      if (!user) {
        const redirectUrl = encodeURIComponent('/dashboard/community/admin');
        router.replace(`/login?redirect=${redirectUrl}`);
        return;
      }

      // Platform admins (app_user_profiles.isAdmin) always get access, even
      // with zero community memberships -- the tabs behind this gate (KYC,
      // support, advertising, agent outreach) are platform-wide concerns,
      // and every one of their API routes already guards with the real
      // isAdmin() check (src/lib/auth-middleware.js), not a community role.
      if (user.isAdmin) {
        setRoleCheckState({
          checking: false,
          isAdmin: true,
          error: null
        });
        return;
      }

      // Otherwise fall back to the community-admin check, for community
      // moderators who aren't platform admins but still need some of these
      // tabs (e.g. member/issue/amenity management scoped to their community).
      try {
        const response = await authenticatedFetch(`/api/hub/communities?type=user&userId=${user.uid}`);
        const result = await response.json();

        if (response.ok && result.communities?.length > 0) {
          // Check if user is admin in any community
          const isAdmin = result.communities.some(c => c.role === 'admin');
          setRoleCheckState({
            checking: false,
            isAdmin,
            error: null
          });
        } else {
          // User has no communities or API failed
          setRoleCheckState({
            checking: false,
            isAdmin: false,
            error: null
          });
        }
      } catch (error) {
        console.error('Error checking admin role:', error);
        setRoleCheckState({
          checking: false,
          isAdmin: false,
          error: 'Failed to verify admin access'
        });
      }
    };

    checkAdminAccess();
  }, [user, authLoading, router]);

  // STATE 1: Auth loading - show nothing to prevent flash
  if (authLoading) {
    return null;
  }

  // STATE 2: Not authenticated - redirect is happening, show nothing
  if (!user) {
    return null;
  }

  // STATE 3: Role check in progress - show minimal loading
  if (roleCheckState.checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // STATE 4: Error checking role
  if (roleCheckState.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{roleCheckState.error}</p>
          <button
            onClick={() => router.push('/dashboard/community')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Hub
          </button>
        </div>
      </div>
    );
  }

  // STATE 5: Not admin - show Access Denied
  if (!roleCheckState.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have admin privileges for any community.
            Admin access is required to view this page.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/dashboard/community/dashboard')}
              className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go to Community Hub
            </button>
            <button
              onClick={() => router.push('/dashboard/community/communities')}
              className="w-full inline-flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              Browse Communities
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STATE 6: Admin user - render admin dashboard
  return (
    <HubLayout>
      <HubAdmin />
    </HubLayout>
  );
}

