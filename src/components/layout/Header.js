'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, X, User, ChevronDown, LogOut, Settings, Building2, Bell, AlertCircle, Mail } from 'lucide-react';
import GeolocationButton from '@/components/shared/GeolocationButton';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import toast from 'react-hot-toast';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const userMenuRef = useRef(null);

  // Check if user is currently in The Hub
  const isInHub = pathname?.startsWith('/the-hub');

  const navItems = [
    { name: 'Property', href: '/property' },
    { name: 'Housemate', href: '/housemate' },
    { name: 'Marketplace', href: '/marketplace' },
    { name: 'Tradespeople', href: '/tradespeople' },
    { name: 'Noticeboard', href: '/noticeboard' }
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('✅ Logged out successfully!');
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('❌ Failed to logout');
    }
  };

  return (
    <header 
      className="sticky top-0 z-50"
      style={{
        background: 'linear-gradient(to right, #057BD4 0%, #057BD4 60%, #f97316 100%)',
        backgroundSize: '200% 100%',
        backgroundPosition: 'right bottom'
      }}
    >
      <div className="w-full px-4 md:px-6 lg:px-8 py-0 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center h-14 md:h-16 lg:h-20 flex-shrink-0 -ml-5">
          <img
            src="/nijahomzs-logo.png"
            alt="Nijahomzs Logo"
            className="h-full w-auto object-contain"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center justify-center flex-1 min-w-0 px-4">
          <div className="flex items-center gap-x-5 xl:gap-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="relative text-white hover:text-orange-200 transition-colors text-lg lg:text-xl xl:text-2xl font-medium group whitespace-nowrap"
              >
                {item.name}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 transition-all duration-300 ease-in-out group-hover:w-full"></span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Right Side Actions */}
        <div className="hidden lg:flex items-center gap-x-4 xl:gap-x-6 flex-shrink-0">
          {/* Geolocation Button */}
          <GeolocationButton hideText={true} />

          {user ? (
            /* User Dropdown */
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2 text-white hover:text-orange-200 transition-colors"
              >
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
                <span className="text-lg lg:text-xl xl:text-2xl font-medium">{user.displayName || user.email?.split('@')[0]}</span>
                <ChevronDown className={`w-6 h-6 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg py-2 z-50">
                  <div className="px-4 py-2 border-b">
                    <p className="text-sm font-medium text-gray-900">{user.displayName || 'User'}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  
                  {/* Email Verification Warning - Only for users who actually need verification */}
                  {user && user.requiresEmailVerification && !user.emailVerified && (
                    <div className="px-4 py-3 bg-yellow-50 border-b">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-yellow-800 font-medium">Email not verified</p>
                          <Link 
                            href="/verify-email"
                            className="text-xs text-yellow-700 hover:text-yellow-900 underline"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            Verify now
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <Link
                    href="/the-hub"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    The Hub
                  </Link>
                  
                  <Link
                    href="/dashboard"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Dashboard
                  </Link>
                  
                  <Link
                    href="/profile"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </Link>
                  
                  <Link
                    href="/dashboard?tab=my-ads"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    My Ads
                  </Link>
                  
                  <Link
                    href="/dashboard"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 font-semibold text-blue-600"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Post an Ad
                  </Link>
                  
                  <div className="border-t mt-2 pt-2">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* The Hub Link */}
              <Link
                href="/the-hub"
                className="flex items-center text-white hover:text-orange-200 transition-colors text-lg lg:text-xl xl:text-2xl font-medium"
              >
                <Building2 className="w-6 h-6 mr-2" />
                The Hub
              </Link>

              {/* Login Button */}
              <Link
                href="/login"
                className="px-6 py-2.5 lg:px-7 lg:py-3 bg-white text-blue-600 font-semibold rounded-full hover:bg-gray-100 transition-colors text-lg lg:text-xl xl:text-2xl"
              >
                Login
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <div className="lg:hidden flex items-center space-x-3">
          <GeolocationButton hideText={true} />
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-white hover:text-orange-200 transition-colors"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-blue-600 shadow-lg py-4">
          <div className="flex flex-col items-center space-y-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-white hover:text-orange-200 transition-colors text-[15px]"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            
            {user ? (
              <>
                <Link 
                  href="/the-hub" 
                  className="text-white hover:text-orange-200 transition-colors flex items-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Building2 className="w-4 h-4 mr-1" />
                  The Hub
                </Link>
                
                <Link 
                  href="/dashboard" 
                  className="text-white hover:text-orange-200 transition-colors flex items-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Settings className="w-4 h-4 mr-1" />
                  Dashboard
                </Link>
                
                <Link 
                  href="/profile" 
                  className="text-white hover:text-orange-200 transition-colors flex items-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <User className="w-4 h-4 mr-1" />
                  Profile
                </Link>
                
                <Link 
                  href="/dashboard?tab=my-ads" 
                  className="text-white hover:text-orange-200 transition-colors flex items-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Building2 className="w-4 h-4 mr-1" />
                  My Ads
                </Link>
                
                <Link 
                  href="/dashboard" 
                  className="text-white hover:text-orange-200 transition-colors font-semibold"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Post an Ad
                </Link>
                
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogout();
                  }}
                  className="text-white hover:text-orange-200 transition-colors"
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link 
                  href="/the-hub" 
                  className="text-white hover:text-orange-200 transition-colors flex items-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Building2 className="w-4 h-4 mr-1" />
                  The Hub
                </Link>
                
                <Link 
                  href="/login" 
                  className="
                    px-6 py-2.5 
                    bg-white
                    text-blue-600
                    font-semibold 
                    rounded-lg
                    transition-all 
                    duration-300
                    hover:bg-gray-100
                  "
                  onClick={() => setIsMenuOpen(false)}
                >
                  Login
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}