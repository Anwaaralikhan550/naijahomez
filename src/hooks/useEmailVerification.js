'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export function useEmailVerification(options = {}) {
  const { 
    required = false, 
    redirectTo = '/verify-email', 
    allowSkip = false 
  } = options;
  
  const { user, loading } = useAuth();
  const router = useRouter();
  const [verificationChecked, setVerificationChecked] = useState(false);

  useEffect(() => {
    if (loading) return; // Wait for auth to load

    if (!user) {
      // Not authenticated - let other auth checks handle this
      setVerificationChecked(true);
      return;
    }

    // Check if email verification is required and user is not verified
    if (required && user && !user.emailVerified && !allowSkip) {
      // Redirect to verification page
      const currentUrl = window.location.pathname + window.location.search;
      const redirectUrl = `${redirectTo}?continueUrl=${encodeURIComponent(currentUrl)}`;
      router.replace(redirectUrl);
      return;
    }

    setVerificationChecked(true);
  }, [user, loading, required, redirectTo, allowSkip, router]);

  return {
    user,
    loading,
    isEmailVerified: user?.emailVerified || false,
    needsVerification: required && user && !user.emailVerified,
    verificationChecked
  };
}