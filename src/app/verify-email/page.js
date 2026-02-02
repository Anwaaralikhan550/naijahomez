'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

function VerifyEmailContent() {
  const { user, sendVerificationEmail, reloadUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const continueUrl = searchParams.get('continueUrl') || '/dashboard';

  useEffect(() => {
    // Auto-check verification status when component mounts
    checkVerificationStatus();
    
    // Set up periodic checking
    const interval = setInterval(checkVerificationStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const checkVerificationStatus = async () => {
    if (!user) return;
    
    setIsChecking(true);
    const result = await reloadUser();
    setIsChecking(false);
    
    if (result.emailVerified) {
      // User is now verified, redirect them
      router.push(continueUrl);
    }
  };

  const handleResendEmail = async () => {
    setIsResending(true);
    setResendMessage('');

    const result = await sendVerificationEmail();
    
    if (result.error) {
      setResendMessage(`Error: ${result.error}`);
    } else {
      setResendMessage('Verification email sent! Please check your inbox.');
    }
    
    setIsResending(false);
  };

  if (!user) {
    return (
      <div className="bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Not Logged In</h2>
            <p className="text-gray-600 mb-4">
              You need to be logged in to verify your email.
            </p>
            <Link 
              href="/login"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show success if email is verified OR if user doesn't need verification
  if (user.emailVerified || !user.requiresEmailVerification) {
    return (
      <div className="bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {user.emailVerified ? 'Email Verified!' : 'All Set!'}
            </h2>
            <p className="text-gray-600 mb-4">
              {user.emailVerified 
                ? 'Your email has been successfully verified.'
                : 'Your account is ready to use.'}
            </p>
            <Link 
              href={continueUrl}
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Continue to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Only show verification UI if user actually needs verification
  if (!user.requiresEmailVerification) {
    // User doesn't need verification, redirect them
    router.push(continueUrl);
    return null;
  }

  return (
    <div className="bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center mb-6">
            <Mail className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
            <p className="text-gray-600">
              We've sent a verification email to:
            </p>
            <p className="text-blue-600 font-medium mt-1">{user.email}</p>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Next Steps:</h3>
              <ol className="text-sm text-blue-700 space-y-1">
                <li>1. Check your email inbox</li>
                <li>2. Click the verification link</li>
                <li>3. Return to this page or wait for automatic redirect</li>
              </ol>
            </div>

            {isChecking && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center">
                <Loader2 className="w-4 h-4 animate-spin text-yellow-600 mr-2" />
                <span className="text-sm text-yellow-700">Checking verification status...</span>
              </div>
            )}

            {resendMessage && (
              <div className={`border rounded-lg p-4 ${
                resendMessage.includes('Error') 
                  ? 'bg-red-50 border-red-200 text-red-700' 
                  : 'bg-green-50 border-green-200 text-green-700'
              }`}>
                {resendMessage}
              </div>
            )}

            <div className="flex flex-col space-y-3">
              <button
                onClick={handleResendEmail}
                disabled={isResending}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition flex items-center justify-center"
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  'Resend Verification Email'
                )}
              </button>

              <button
                onClick={checkVerificationStatus}
                disabled={isChecking}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Checking...
                  </>
                ) : (
                  'Check Verification Status'
                )}
              </button>
            </div>

            <div className="pt-4 border-t text-center">
              <Link
                href="/"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Skip for now (verification required for full access)
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p>Loading...</p>
          </div>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}