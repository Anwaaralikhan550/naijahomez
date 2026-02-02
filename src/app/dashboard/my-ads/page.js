'use client';
// app/dashboard/my-ads/page.js
import { useState } from 'react';
import DashboardLayout from '@/components/dashboard/layout/DashboardLayout';
import MyAdsSection from '@/components/dashboard/MyAdsSection';

export default function MyAdsPage() {
  const [activeTab, setActiveTab] = useState('my-ads');

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      <MyAdsSection />
    </DashboardLayout>
  );
}