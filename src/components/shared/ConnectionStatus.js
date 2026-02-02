'use client';
import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertTriangle, CheckCircle } from 'lucide-react';
import { useRealtime } from '@/hooks/useRealtime';

const ConnectionStatus = ({ communityId, userId, className = '' }) => {
  const { status } = useRealtime(communityId, userId);
  const [showTooltip, setShowTooltip] = useState(false);

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          text: 'Connected',
          description: 'Real-time updates enabled'
        };
      case 'connecting':
        return {
          icon: <Wifi className="w-4 h-4 animate-pulse" />,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          text: 'Connecting',
          description: 'Establishing connection...'
        };
      case 'error':
        return {
          icon: <AlertTriangle className="w-4 h-4" />,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          text: 'Error',
          description: 'Connection error occurred'
        };
      default:
        return {
          icon: <WifiOff className="w-4 h-4" />,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          text: 'Disconnected',
          description: 'Real-time updates disabled'
        };
    }
  };

  const config = getStatusConfig();

  // Only show if there's an issue or user wants to see status
  const shouldShow = status !== 'connected' || showTooltip;

  return (
    <div 
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${config.color} ${config.bgColor}`}>
        {config.icon}
        <span className="hidden sm:inline">{config.text}</span>
      </div>
      
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap z-50">
          {config.description}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;