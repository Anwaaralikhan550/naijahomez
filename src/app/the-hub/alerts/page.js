'use client';
import HubLayout from '@/components/hub/HubLayout';
import EmergencyAlerts from '@/components/hub/EmergencyAlerts';

export default function HubAlertsPage() {
  return (
    <HubLayout>
      <EmergencyAlerts />
    </HubLayout>
  );
}