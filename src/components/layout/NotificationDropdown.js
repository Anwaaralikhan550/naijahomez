'use client';

import { Bell } from 'lucide-react';

export default function NotificationDropdown({ notifications = [] }) {
  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-100 z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
      </div>

      {notifications.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <Bell className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">You have no new notifications</p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="px-4 py-3 border-b last:border-b-0 border-gray-100 hover:bg-gray-50"
            >
              <p className="text-sm font-medium text-gray-800">{notification.title}</p>
              {notification.message && (
                <p className="text-xs text-gray-500 mt-1">{notification.message}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
