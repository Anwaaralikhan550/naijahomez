'use client';
import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  Phone, 
  Mail, 
  Calendar, 
  MapPin, 
  Eye,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Filter,
  Download
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import Link from 'next/link';

const AdminMessagesSection = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'unread', 'read', 'forwarded'
  const [filterListingType, setFilterListingType] = useState('all');

  // Load admin messages on component mount
  useEffect(() => {
    loadAdminMessages();
  }, []);

  const loadAdminMessages = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        toast.error('Please sign in to view admin messages');
        return;
      }

      // Fetch messages for the admin system user
      const response = await fetch(`/api/messages?type=received&userId=system-admin-scraped`);
      const result = await response.json();

      if (response.ok) {
        setMessages(result.messages || []);
      } else {
        throw new Error(result.error || 'Failed to load admin messages');
      }
    } catch (error) {
      console.error('Error loading admin messages:', error);
      toast.error('Failed to load admin messages');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/read`, {
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

  const markAsForwarded = async (messageId) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/forward`, {
        method: 'PATCH'
      });

      if (response.ok) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId ? { ...msg, isForwarded: true } : msg
          )
        );
        toast.success('✅ Message marked as forwarded!', {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#10B981',
            color: 'white',
            fontWeight: 'bold',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '16px'
          },
          icon: '📤'
        });
      }
    } catch (error) {
      console.error('Error marking message as forwarded:', error);
      toast.error('❌ Failed to mark as forwarded', {
        duration: 4000,
        position: 'top-center',
        style: {
          background: '#EF4444',
          color: 'white',
          fontWeight: 'bold',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '16px'
        },
        icon: '⚠️'
      });
    }
  };

  const contactOriginalSeller = (message) => {
    if (message.originalSellerPhone) {
      const whatsappUrl = `https://wa.me/${message.originalSellerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Hello! A customer is interested in your listing "${message.listingId}" and sent this message: "${message.message}"\n\nCustomer: ${message.senderName}\nEmail: ${message.senderEmail}`
      )}`;
      window.open(whatsappUrl, '_blank');
    } else if (message.originalSellerEmail) {
      const emailUrl = `mailto:${message.originalSellerEmail}?subject=${encodeURIComponent(
        `Customer Inquiry for Your Listing`
      )}&body=${encodeURIComponent(
        `Hello!\n\nA customer is interested in your listing and sent this message:\n\n"${message.message}"\n\nCustomer Details:\nName: ${message.senderName}\nEmail: ${message.senderEmail}\n\nPlease contact them directly.\n\nBest regards,\nNijahomzs Team`
      )}`;
      window.open(emailUrl);
    } else {
      toast.error('❌ No contact information available for this seller', {
        duration: 4000,
        position: 'top-center',
        style: {
          background: '#F59E0B',
          color: 'white',
          fontWeight: 'bold',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '16px'
        },
        icon: '📞'
      });
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

  // Filter messages based on search and filters
  const filteredMessages = messages.filter(message => {
    const matchesSearch = message.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (message.senderName && message.senderName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (message.originalSellerName && message.originalSellerName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'unread' && !message.isRead) ||
      (filterStatus === 'read' && message.isRead) ||
      (filterStatus === 'forwarded' && message.isForwarded);

    const matchesListingType = filterListingType === 'all' || message.listingType === filterListingType;

    return matchesSearch && matchesStatus && matchesListingType;
  });

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const exportMessages = () => {
    const csvContent = [
      ['Date', 'Customer Name', 'Customer Email', 'Listing Type', 'Message', 'Seller Name', 'Seller Phone', 'Seller Email', 'Status'].join(','),
      ...filteredMessages.map(msg => [
        formatDate(msg.createdAt),
        msg.senderName || '',
        msg.senderEmail || '',
        getListingTypeLabel(msg.listingType),
        `"${msg.message.replace(/"/g, '""')}"`,
        msg.originalSellerName || '',
        msg.originalSellerPhone || '',
        msg.originalSellerEmail || '',
        msg.isForwarded ? 'Forwarded' : msg.isRead ? 'Read' : 'Unread'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scraped-listings-inquiries-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getMessageStatusColor = (message) => {
    if (message.isForwarded) return 'text-green-600 bg-green-50 border-green-200';
    if (message.isRead) return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-orange-600 bg-orange-50 border-orange-200';
  };

  const getMessageStatusLabel = (message) => {
    if (message.isForwarded) return 'Forwarded';
    if (message.isRead) return 'Read';
    return 'New';
  };

  return (
    <div className="space-y-6">
      {/* Header with stats and actions */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-2">Scraped Listings Inquiries</h2>
        <p className="opacity-90">Manage customer inquiries for scraped listings and forward them to original sellers</p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-white/20 p-3 rounded">
            <div className="text-2xl font-bold">{messages.length}</div>
            <div className="text-sm opacity-80">Total Messages</div>
          </div>
          <div className="bg-white/20 p-3 rounded">
            <div className="text-2xl font-bold">{messages.filter(m => !m.isRead).length}</div>
            <div className="text-sm opacity-80">Unread</div>
          </div>
          <div className="bg-white/20 p-3 rounded">
            <div className="text-2xl font-bold">{messages.filter(m => m.isForwarded).length}</div>
            <div className="text-sm opacity-80">Forwarded</div>
          </div>
          <div className="bg-white/20 p-3 rounded">
            <div className="text-2xl font-bold">{messages.filter(m => m.isScrapedListing).length}</div>
            <div className="text-sm opacity-80">Scraped Listings</div>
          </div>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-wrap gap-2">
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
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="forwarded">Forwarded</option>
          </select>

          <select
            value={filterListingType}
            onChange={(e) => setFilterListingType(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="property">Property</option>
            <option value="marketplace">Marketplace</option>
            <option value="housemate">Housemate</option>
            <option value="tradespeople">Services</option>
            <option value="noticeboard">Notices</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportMessages}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={loadAdminMessages}
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
            <p className="text-gray-600">Loading admin messages...</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No messages found
            </h3>
            <p className="text-gray-500">
              {searchTerm || filterStatus !== 'all' || filterListingType !== 'all'
                ? "Try adjusting your search or filters"
                : "No customer inquiries yet for scraped listings"}
            </p>
          </div>
        ) : (
          filteredMessages.map((message) => (
            <div
              key={message.id}
              className={`p-4 border rounded-lg transition-colors ${getMessageStatusColor(message)}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">
                      From: {message.senderName || 'Anonymous'}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${getMessageStatusColor(message)}`}>
                      {getMessageStatusLabel(message)}
                    </span>
                    <span className="text-blue-600 text-sm font-medium">
                      {getListingTypeLabel(message.listingType)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(message.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {message.senderEmail}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!message.isRead && (
                    <button
                      onClick={() => markAsRead(message.id)}
                      className="p-1 text-blue-500 hover:bg-blue-100 rounded"
                      title="Mark as read"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  {!message.isForwarded && (
                    <button
                      onClick={() => markAsForwarded(message.id)}
                      className="p-1 text-green-500 hover:bg-green-100 rounded"
                      title="Mark as forwarded"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-3 p-3 bg-white/50 rounded border-l-4 border-blue-500">
                <p className="text-gray-800 font-medium mb-1">Customer Message:</p>
                <p className="text-gray-700 whitespace-pre-wrap">{message.message}</p>
              </div>

              {/* Original seller info */}
              {(message.originalSellerName || message.originalSellerPhone || message.originalSellerEmail) && (
                <div className="mb-3 p-3 bg-gray-50 rounded">
                  <p className="text-gray-700 font-medium mb-2">Original Seller Contact:</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    {message.originalSellerName && (
                      <div>
                        <span className="font-medium">Name:</span> {message.originalSellerName}
                      </div>
                    )}
                    {message.originalSellerPhone && (
                      <div>
                        <span className="font-medium">Phone:</span> {message.originalSellerPhone}
                      </div>
                    )}
                    {message.originalSellerEmail && (
                      <div>
                        <span className="font-medium">Email:</span> {message.originalSellerEmail}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <Link
                    href={getListingUrl(message.listingType, message.listingId)}
                    className="text-blue-500 hover:text-blue-600 underline flex items-center gap-1"
                    target="_blank"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Listing
                  </Link>
                  
                  <a
                    href={`mailto:${message.senderEmail}?subject=Re: Your inquiry about our listing`}
                    className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <Mail className="w-4 h-4" />
                    Reply to Customer
                  </a>
                </div>
                
                {(message.originalSellerPhone || message.originalSellerEmail) && (
                  <button
                    onClick={() => contactOriginalSeller(message)}
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center gap-1"
                  >
                    {message.originalSellerPhone ? <Phone className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                    Contact Seller
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {filteredMessages.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          Showing {filteredMessages.length} of {messages.length} messages
        </div>
      )}
    </div>
  );
};

export default AdminMessagesSection;