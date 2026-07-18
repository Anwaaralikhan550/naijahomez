'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, User, ChevronDown, LogOut, Settings, Building2, Bell, AlertCircle } from 'lucide-react';
import GeolocationButton from '@/components/shared/GeolocationButton';
import NotificationDropdown from '@/components/layout/NotificationDropdown';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import toast from 'react-hot-toast';

const navItems = [
  { name: 'Property', href: '/property' },
  { name: 'Housemate', href: '/housemate' },
  { name: 'Marketplace', href: '/marketplace' },
  { name: 'Tradespeople', href: '/tradespeople' },
  { name: 'Noticeboard', href: '/noticeboard' }
];

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const userMenuRef = useRef(null);
  const notificationRef = useRef(null);
  const notifications = [];

  // Check if user is currently in community section
  const isInHub = pathname?.startsWith('/the-hub') || pathname?.startsWith('/dashboard/community');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationOpen(false);
      }
    };

    if (isUserMenuOpen || isNotificationOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen, isNotificationOpen]);

  // Auto-close mobile menu whenever route changes
  useEffect(() => {
    setIsMenuOpen(false);
    setIsUserMenuOpen(false);
    setIsNotificationOpen(false);
  }, [pathname]);

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
      <div className="w-full px-2 md:px-3 lg:px-4 py-0 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center h-12 md:h-14 lg:h-16 flex-shrink-0 ml-0 lg:-ml-5">
          <Image
            src="/nijahomzs-logo.png"
            alt="Nijahomzs Logo"
            width={256}
            height={80}
            sizes="(max-width: 1024px) 192px, 256px"
            className="h-full w-auto object-contain"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center justify-center flex-1 min-w-0 px-1 pr-6 relative z-10">
          <div className="flex items-center gap-x-5 xl:gap-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="relative text-white hover:text-orange-200 transition-colors text-sm lg:text-base xl:text-lg font-medium group whitespace-nowrap"
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
            <>
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setIsNotificationOpen((prev) => !prev)}
                  className="relative p-2 text-white hover:text-orange-200 transition-colors"
                  aria-label="Toggle notifications"
                >
                  <Bell className="w-6 h-6" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </button>
                {isNotificationOpen && <NotificationDropdown notifications={notifications} />}
              </div>

              {/* User Dropdown */}
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
                    href="/dashboard/community"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    Community Hub
                  </Link>
                  
                  <Link
                    href="/dashboard"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    My Account
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
            </>
          ) : (
            <>
              {/* Community Hub Link */}
              <Link
                href="/dashboard/community"
                className="flex items-center text-white hover:text-orange-200 transition-colors text-lg lg:text-xl xl:text-2xl font-medium"
              >
                <Building2 className="w-6 h-6 mr-2" />
                Community Hub
              </Link>

              {/* Login Button */}
              <Link
                href="/login"
                className="px-4 py-2 lg:px-5 lg:py-2.5 bg-white text-blue-600 font-semibold rounded-full hover:bg-gray-100 transition-colors text-sm lg:text-base"
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
                className="text-white hover:text-orange-200 transition-colors text-sm"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            
            {user ? (
              <>
                <Link 
                  href="/dashboard/community" 
                  className="text-white hover:text-orange-200 transition-colors flex items-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Building2 className="w-4 h-4 mr-1" />
                  Community Hub
                </Link>
                
                <Link 
                  href="/dashboard" 
                  className="text-white hover:text-orange-200 transition-colors flex items-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Settings className="w-4 h-4 mr-1" />
                  My Account
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
                  href="/dashboard/community" 
                  className="text-white hover:text-orange-200 transition-colors flex items-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Building2 className="w-4 h-4 mr-1" />
                  Community Hub
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
