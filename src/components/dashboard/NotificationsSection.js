// components/dashboard/NotificationsSection.js
import { Bell } from 'lucide-react';

export default function NotificationsSection() {
    return (
      <div className="text-center text-gray-500 py-8">
        <Bell className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>No notifications</p>
      </div>
    );
  }