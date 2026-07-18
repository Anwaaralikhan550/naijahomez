'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  Send,
  Inbox,
  Calendar,
  MapPin,
  Eye,
  Trash2,
  RefreshCw,
  Search
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import Link from 'next/link';
import apiService, { authenticatedFetch } from '@/services/api';

const MessagesSection = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('received'); // 'sent' or 'received'
  const [searchTerm, setSearchTerm] = useState('');

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      if (!user) {
        toast.error('Please sign in to view messages');
        return;
      }

      // Use apiService which automatically includes Firebase auth token
      const result = await apiService.getMessages(activeTab, user.uid);
      setMessages(result.messages || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [activeTab, user]);

  // Load messages on component mount and tab change
  useEffect(() => {
    if (user) {
      loadMessages();
    } else {
      setLoading(false);
    }
  }, [loadMessages, user]);

  const markAsRead = async (messageId) => {
    try {
      const response = await authenticatedFetch(`/api/messages/${messageId}/read`, {
        method: 'PATCH'
      });

      if (response.ok) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === messageId ? { ...msg, isRead: true } : msg
          )
        );
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const deleteMessage = async (messageId) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      const response = await authenticatedFetch(`/api/messages/${messageId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
        toast.success('🗑️ Message deleted successfully!', {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#EF4444',
            color: 'white',
            fontWeight: 'bold',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '16px'
          },
          icon: '✅'
        });
      } else {
        throw new Error('Failed to delete message');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };

  const getListingTypeLabel = (type) => {
    switch (type) {
      case 'property': return 'Property';
      case 'marketplace': return 'Marketplace';
      case 'housemate': return 'Housemate';
      case 'tradespeople': return 'Service';
      case 'noticeboard': return 'Notice';
      default: return 'Listing';
    }
  };

  const getListingUrl = (listingType, listingId) => {
    switch (listingType) {
      case 'property': return `/property/${listingId}`;
      case 'marketplace': return `/marketplace/${listingId}`;
      case 'housemate': return `/housemate/${listingId}`;
      case 'tradespeople': return `/tradespeople/${listingId}`;
      case 'noticeboard': return `/noticeboard/${listingId}`;
      default: return '#';
    }
  };

  const filteredMessages = messages.filter(message =>
    message.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (message.senderName && message.senderName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      {/* Header with tabs and search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('received')}
            className={`px-4 py-2 rounded-md transition-colors ${
              activeTab === 'received'
                ? 'bg-white text-blue-500 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Inbox className="inline w-4 h-4 mr-2" />
            Received
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`px-4 py-2 rounded-md transition-colors ${
              activeTab === 'sent'
                ? 'bg-white text-blue-500 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Send className="inline w-4 h-4 mr-2" />
            Sent
          </button>
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={loadMessages}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages list */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-2" />
            <p className="text-gray-600">Loading messages...</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {activeTab} messages
            </h3>
            <p className="text-gray-500">
              {activeTab === 'sent' 
                ? "You haven't sent any messages yet." 
                : "You haven't received any messages yet."}
            </p>
          </div>
        ) : (
          filteredMessages.map((message) => (
            <div
              key={message.id}
              className={`p-4 border rounded-lg transition-colors ${
                !message.isRead && activeTab === 'received'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">
                      {activeTab === 'sent' ? 'To:' : 'From:'} {message.senderName || 'Anonymous'}
                    </span>
                    {!message.isRead && activeTab === 'received' && (
                      <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
                        New
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(message.createdAt)}
                    </span>
                    <span className="flex items-center gap-1 text-blue-600">
                      <MapPin className="w-4 h-4" />
                      {getListingTypeLabel(message.listingType)}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!message.isRead && activeTab === 'received' && (
                    <button
                      onClick={() => markAsRead(message.id)}
                      className="p-1 text-blue-500 hover:bg-blue-100 rounded"
                      title="Mark as read"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteMessage(message.id)}
                    className="p-1 text-red-500 hover:bg-red-100 rounded"
                    title="Delete message"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <p className="text-gray-800 whitespace-pre-wrap">{message.message}</p>
              </div>

              <div className="flex items-center justify-between text-sm">
                <Link
                  href={getListingUrl(message.listingType, message.listingId)}
                  className="text-blue-500 hover:text-blue-600 underline"
                >
                  View {getListingTypeLabel(message.listingType)} Listing
                </Link>
                
                {message.senderEmail && (
                  <a
                    href={`mailto:${message.senderEmail}`}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Reply via Email
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Message count */}
      {filteredMessages.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          Showing {filteredMessages.length} of {messages.length} messages
        </div>
      )}
    </div>
  );
};

export default MessagesSection;
