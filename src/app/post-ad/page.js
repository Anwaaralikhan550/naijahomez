'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function PostAdRedirect() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (user) {
      // Authenticated user - go to dashboard post-ad tab
      router.replace('/dashboard?tab=post-ad');
    } else {
      // Unauthenticated user - redirect to login with return URL
      router.replace('/login?redirect=%2Fdashboard%3Ftab%3Dpost-ad');
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}