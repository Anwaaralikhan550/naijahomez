'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children, requireEmailVerification = true }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // Redirect to login with current path as redirect parameter
      const currentPath = window.location.pathname + window.location.search;
      router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    // Check email verification requirement - only for users who actually need it
    if (requireEmailVerification && user && user.requiresEmailVerification && !user.emailVerified) {
      // Redirect to email verification page
      const currentPath = window.location.pathname + window.location.search;
      router.replace(`/verify-email?continueUrl=${encodeURIComponent(currentPath)}`);
      return;
    }
  }, [user, loading, router, requireEmailVerification]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If no user, show redirecting message
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // If email verification is required but user is not verified, show redirecting message
  if (requireEmailVerification && user && user.requiresEmailVerification && !user.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Redirecting to email verification...</p>
        </div>
      </div>
    );
  }

  // User is authenticated and verified (if required), render children
  return children;
}