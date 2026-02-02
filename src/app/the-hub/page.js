'use client';
import { useAuth } from '@/context/AuthContext';
import { redirect } from 'next/navigation';
import { useEffect } from 'react';

export default function TheHubPage() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Authenticated user - redirect to dashboard
        redirect('/the-hub/dashboard');
      } else {
        // Guest user - redirect to communities listing for discovery
        redirect('/the-hub/communities');
      }
    }
  }, [user, loading]);

  // Show loading while determining auth status
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return null;
}