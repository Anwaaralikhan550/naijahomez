'use client';
// app/dashboard/page.js
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/layout/DashboardLayout';
import PostAdSection from '@/components/dashboard/PostAdSection';
import MyAdsSection from '@/components/dashboard/MyAdsSection';
import MessagesSection from '@/components/dashboard/MessagesSection';
import AdminMessagesSection from '@/components/dashboard/AdminMessagesSection';
import NotificationsSection from '@/components/dashboard/NotificationsSection';
import SettingsSection from '@/components/dashboard/SettingsSection';

function DashboardContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('post-ad');
  
  useEffect(() => {
    // Get tab from URL parameter
    const tab = searchParams.get('tab');
    if (tab && ['post-ad', 'my-ads', 'messages', 'admin-messages', 'notifications', 'settings'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const renderContent = () => {
    switch (activeTab) {
      case 'post-ad':
        return <PostAdSection setActiveTab={setActiveTab} />;
      case 'my-ads':
        return <MyAdsSection />;
      case 'messages':
        return <MessagesSection />;
      case 'admin-messages':
        return <AdminMessagesSection />;
      case 'notifications':
        return <NotificationsSection />;
      case 'settings':
        return <SettingsSection />;
      default:
        return <PostAdSection setActiveTab={setActiveTab} />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </DashboardLayout>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      }>
        <DashboardContent />
      </Suspense>
    </ProtectedRoute>
  );
}