'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

// Landing page for the Google OAuth redirect flow. src/app/api/auth/google/callback
// redirects here with tokens in the URL fragment (not the query string, so they
// never reach server access logs) -- this page reads window.location.hash,
// hands the tokens to AuthContext, then moves on to the dashboard.
export default function AuthCompletePage() {
  const router = useRouter();
  const { completeGoogleSession } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const expiresAt = params.get('expiresAt');

    // Clear the fragment immediately so tokens don't linger in browser history.
    window.history.replaceState(null, '', window.location.pathname);

    if (!accessToken || !refreshToken) {
      setError('Sign-in did not complete. Please try again.');
      return;
    }

    completeGoogleSession({ accessToken, refreshToken, expiresAt }).then((result) => {
      if (result.error) {
        setError(result.error);
        return;
      }
      router.replace('/dashboard');
    });
  }, [completeGoogleSession, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <p className="text-red-600">{error}</p>
          <a href="/login" className="text-blue-600 font-medium hover:text-blue-500">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-gray-600 text-sm">Finishing sign-in...</p>
      </div>
    </div>
  );
}
