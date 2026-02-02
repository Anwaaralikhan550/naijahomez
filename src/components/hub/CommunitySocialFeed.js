'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus,
  Heart,
  MessageCircle,
  Mail,
  MoreHorizontal,
  Image,
  MapPin,
  Calendar,
  Users,
  Bookmark,
  Flag,
  Edit,
  Trash2,
  Camera,
  Smile,
  Hash,
  AtSign,
  Clock,
  Eye,
  ThumbsUp,
  Award,
  Zap,
  Megaphone,
  ShoppingBag,
  DollarSign,
  Clock3,
  MapPin as LocationIcon,
  ArrowRight,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';
import PullToRefresh from '@/components/shared/PullToRefresh';
import { useFirestoreUpdates } from '@/hooks/useFirestoreQuery';
import { db } from '@/lib/firebase-client';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';

const CommunitySocialFeed = ({ communityId, onNavigateToMessages }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [editingPost, setEditingPost] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [userAds, setUserAds] = useState([]);
  const [loadingAds, setLoadingAds] = useState(false);
  const [newPostData, setNewPostData] = useState({
    content: '',
    type: 'text', // text, image, event, poll, announcement
    tags: [],
    location: '',
    attachments: [],
    // Event-specific fields
    eventDate: '',
    eventTime: '',
    eventEndDate: '',
    eventEndTime: '',
    maxAttendees: '',
    requiresApproval: false,
    // Marketplace-specific fields
    selectedAdId: '',
    selectedAdCollection: '',
    // Poll-specific fields
    pollOptions: ['', ''],
    pollDuration: '7' // days
  });

  const postTypes = [
    { id: 'text', name: 'General Discussion', icon: MessageCircle, color: 'bg-blue-100 text-blue-800' },
    { id: 'announcement', name: 'Announcement', icon: Zap, color: 'bg-red-100 text-red-800' },
    { id: 'event', name: 'Event', icon: Calendar, color: 'bg-green-100 text-green-800' },
    { id: 'poll', name: 'Community Poll', icon: Award, color: 'bg-purple-100 text-purple-800' },
    { id: 'marketplace', name: 'Buy & Sell', icon: Hash, color: 'bg-yellow-100 text-yellow-800' },
    { id: 'maintenance', name: 'Maintenance Issue', icon: MessageSquare, color: 'bg-orange-100 text-orange-800' },
    { id: 'recommendations', name: 'Recommendation', icon: MessageSquare, color: 'bg-teal-100 text-teal-800' },
    { id: 'security', name: 'Safety & Security', icon: MessageSquare, color: 'bg-pink-100 text-pink-800' }
  ];

  const filters = [
    { id: 'all', name: 'All Posts' },
    { id: 'text', name: 'General Discussion' },
    { id: 'announcements', name: 'Announcements' },
    { id: 'events', name: 'Events & Activities' },
    { id: 'marketplace', name: 'Buy & Sell' },
    { id: 'polls', name: 'Community Polls' },
    { id: 'maintenance', name: 'Maintenance & Repairs' },
    { id: 'recommendations', name: 'Recommendations' },
    { id: 'security', name: 'Safety & Security' },
    { id: 'trending', name: 'Trending' }
  ];

  const loadPosts = useCallback(async () => {
    if (!communityId) return;
    
    try {
      setLoading(true);
      let url = `/api/hub/social-feed?communityId=${communityId}&filter=${selectedFilter}&limit=20`;
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }
      
      const response = await authenticatedFetch(url);
      const result = await response.json();

      if (response.ok) {
        let filteredPosts = result.posts || [];
        
        // Client-side search if API doesn't support it yet
        if (searchQuery.trim()) {
          filteredPosts = filteredPosts.filter(post =>
            post.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            post.authorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (post.tags && post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
          );
        }
        
        setPosts(filteredPosts);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [communityId, selectedFilter, searchQuery]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Create Firestore query for real-time social feed updates (memoized)
  const socialFeedQuery = useMemo(() => {
    return communityId
      ? query(
          collection(db, 'socialPosts'),
          where('communityId', '==', communityId),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc'),
          limit(50)
        )
      : null;
  }, [communityId]);

  // Memoized callback for handling Firestore updates
  const handleFirestoreUpdates = useCallback((changes) => {
    setConnectionStatus('connected');
    
    setPosts(currentPosts => {
      let updatedPosts = [...currentPosts];
      
      changes.forEach(change => {
        if (change.type === 'added') {
          // Add new post if it doesn't already exist
          const existingIndex = updatedPosts.findIndex(p => p.id === change.doc.id);
          if (existingIndex === -1) {
            updatedPosts = [change.doc, ...updatedPosts];
            
            // Show notification for new posts from others
            if (change.doc.authorId !== user?.uid) {
              toast(`📝 New post from ${change.doc.authorName}`, {
                duration: 3000
              });
            }
          }
        } else if (change.type === 'modified') {
          const index = updatedPosts.findIndex(p => p.id === change.doc.id);
          if (index !== -1) {
            updatedPosts[index] = change.doc;
          }
        } else if (change.type === 'removed') {
          updatedPosts = updatedPosts.filter(p => p.id !== change.doc.id);
        }
      });
      
      return updatedPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    });
  }, [user?.uid]);

  // Use Firestore client SDK for real-time updates
  const { isListening } = useFirestoreUpdates(
    socialFeedQuery,
    handleFirestoreUpdates
  );

  // Set connection status based on listener state
  useEffect(() => {
    setConnectionStatus(isListening ? 'connected' : 'disconnected');
  }, [isListening]);


  const loadUserAds = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      setLoadingAds(true);
      const response = await authenticatedFetch(`/api/ads?userId=${user.uid}`);
      const result = await response.json();

      if (response.ok) {
        // Filter for marketplace and other relevant collections
        const relevantAds = result.ads?.filter(ad => 
          ['marketplace', 'properties', 'services'].includes(ad.collectionName)
        ) || [];
        setUserAds(relevantAds);
      }
    } catch (error) {
      console.error('Error loading user ads:', error);
      toast.error('Failed to load your ads');
    } finally {
      setLoadingAds(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (newPostData.type === 'marketplace' && showCreatePost) {
      loadUserAds();
    }
  }, [newPostData.type, showCreatePost, loadUserAds]);

  const createPost = async (e) => {
    e.preventDefault();
    
    if (!newPostData.content.trim()) {
      toast.error('Post content is required');
      return;
    }

    try {
      setLoading(true);
      
      const postData = {
        action: 'create_post',
        communityId,
        ...newPostData,
        authorId: user.uid,
        authorName: user.displayName || user.email
      };
      
      
      const response = await authenticatedFetch(`/api/hub/social-feed?userId=${user.uid}`, {
        method: 'POST',
        body: JSON.stringify(postData)
      });

      if (response.ok) {
        toast.success('✅ Post created successfully!');
        setShowCreatePost(false);
        setNewPostData({
          content: '', type: 'text', tags: [], location: '', attachments: [],
          eventDate: '', eventTime: '', eventEndDate: '', eventEndTime: '',
          selectedAdId: '', selectedAdCollection: '',
          pollOptions: ['', ''], pollDuration: '7'
        });
        // SSE will automatically show the new post
      } else {
        throw new Error('Failed to create post');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const likePost = async (postId) => {
    try {
      const response = await authenticatedFetch(`/api/hub/social-feed?userId=${user.uid}`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'like_post',
          postId,
          userId: user.uid
        })
      });

      if (response.ok) {
        toast.success('👍 Post liked!');
        // SSE will automatically update the posts
      } else {
        const error = await response.json();
        console.error('Like failed:', error);
        toast.error(`Failed to like post: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Like error:', error);
      toast.error('Failed to like post');
    }
  };

  const commentOnPost = async (postId, content) => {
    try {
      const response = await authenticatedFetch(`/api/hub/social-feed?userId=${user.uid}`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'comment_on_post',
          postId,
          content,
          authorId: user.uid,
          authorName: user.displayName || user.email
        })
      });

      if (response.ok) {
        toast.success('💬 Comment added!');
        // SSE will automatically update the posts
      } else {
        const error = await response.json();
        console.error('Comment failed:', error);
        toast.error(`Failed to add comment: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Comment error:', error);
      toast.error('Failed to add comment');
    }
  };

  const messageAuthor = (post) => {
    // Don't allow messaging yourself
    if (post.authorId === user.uid) {
      toast.info('💬 You cannot message yourself');
      return;
    }

    if (onNavigateToMessages) {
      onNavigateToMessages(post.authorId, post.authorName);
      toast.success(`💬 Opening conversation with ${post.authorName}`);
    } else {
      toast.error('Messaging not available');
    }
  };

  const editPost = async (postId, updatedContent) => {
    try {
      const response = await authenticatedFetch(`/api/hub/social-feed?userId=${user.uid}`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'update_post',
          postId,
          content: updatedContent.trim()
        })
      });

      if (response.ok) {
        toast.success('✏️ Post updated!');
        setEditingPost(null);
        // SSE will automatically update the posts
      } else {
        const error = await response.json();
        console.error('Edit failed:', error);
        toast.error(`Failed to update post: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Edit error:', error);
      toast.error('Failed to update post');
    }
  };

  const deletePost = async (postId) => {
    try {
      const response = await authenticatedFetch(`/api/hub/social-feed?userId=${user.uid}`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete_post',
          postId
        })
      });

      if (response.ok) {
        toast.success('🗑️ Post deleted!');
        setShowDeleteConfirm(null);
        // SSE will automatically update the posts
      } else {
        const error = await response.json();
        console.error('Delete failed:', error);
        toast.error(`Failed to delete post: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete post');
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    
    try {
      // Handle Firestore Timestamp objects (if coming from real-time updates)
      if (timestamp && typeof timestamp.toDate === 'function') {
        const date = timestamp.toDate();
        return getTimeAgo(date);
      }
      
      // Handle Firebase Timestamp objects with seconds/nanoseconds
      if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
        const date = new Date(timestamp.seconds * 1000);
        return getTimeAgo(date);
      }
      
      // Handle ISO string timestamps (most common from API)
      if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return getTimeAgo(date);
        }
      }
      
      // Handle numeric timestamps (milliseconds or seconds)
      if (typeof timestamp === 'number') {
        // If it's a small number, it's probably seconds, convert to milliseconds
        const date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
        if (!isNaN(date.getTime())) {
          return getTimeAgo(date);
        }
      }
      
      // Last resort: try direct Date constructor
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return getTimeAgo(date);
      }
      
      // If we still can't parse it, log for debugging and return a safe fallback
      console.warn('Could not parse timestamp:', timestamp, typeof timestamp);
      return 'Unknown time';
      
    } catch (error) {
      console.warn('Error parsing timestamp:', timestamp, error);
      return 'Unknown time';
    }
  };
  
  const getTimeAgo = (date) => {
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    
    try {
      // Handle Firestore Timestamp objects
      if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleDateString();
      }
      
      // Handle Firebase Timestamp objects with seconds/nanoseconds
      if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleDateString();
      }
      
      // Handle ISO strings and other date formats
      const date = new Date(timestamp);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Could not parse date:', timestamp, typeof timestamp);
        return 'Unknown date';
      }
      
      return date.toLocaleDateString();
    } catch (error) {
      console.warn('Error parsing date:', timestamp, error);
      return 'Unknown date';
    }
  };

  const isUpcomingEvent = (eventDate) => {
    if (!eventDate) return false;
    
    try {
      // Handle Firestore Timestamp objects
      if (eventDate && typeof eventDate.toDate === 'function') {
        return eventDate.toDate() > new Date();
      }
      
      // Handle Firebase Timestamp objects with seconds/nanoseconds
      if (eventDate && typeof eventDate === 'object' && eventDate.seconds) {
        const date = new Date(eventDate.seconds * 1000);
        return date > new Date();
      }
      
      // Handle string/other formats
      const date = new Date(eventDate);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return false;
      }
      
      return date > new Date();
    } catch (error) {
      return false;
    }
  };

  const getPostTypeIcon = (type) => {
    const postType = postTypes.find(t => t.id === type);
    return postType ? postType.icon : MessageCircle;
  };

  const getPostTypeColor = (type) => {
    const postType = postTypes.find(t => t.id === type);
    return postType ? postType.color : 'bg-gray-100 text-gray-800';
  };

  // Specialized content renderers for each post type
  const renderAnnouncementContent = (post) => (
    <div className="border-l-4 border-red-500 pl-4 bg-red-50 rounded-r-lg p-4 mb-4">
      <div className="flex items-center mb-2">
        <Megaphone className="w-5 h-5 text-red-600 mr-2" />
        <span className="font-semibold text-red-800">Community Announcement</span>
      </div>
      <p className="text-gray-700 whitespace-pre-wrap font-medium">{post.content}</p>
    </div>
  );

  const renderEventContent = (post) => {
    const userRsvp = post.rsvps?.find(rsvp => rsvp.userId === user?.uid);
    const rsvpCounts = post.rsvps?.reduce((acc, rsvp) => {
      acc[rsvp.status] = (acc[rsvp.status] || 0) + 1;
      return acc;
    }, {}) || {};

    const handleRSVP = async (status) => {
      try {
        const response = await authenticatedFetch(`/api/hub/social-feed?userId=${user.uid}`, {
          method: 'POST',
          body: JSON.stringify({
            action: 'rsvp_event',
            postId: post.id,
            status,
            userId: user.uid,
            userName: user.displayName || user.email
          })
        });

        if (response.ok) {
          toast.success(`✅ RSVP updated: ${status}`);
        } else {
          throw new Error('Failed to update RSVP');
        }
      } catch (error) {
        toast.error(`❌ ${error.message}`);
      }
    };

    return (
      <div className="border border-green-200 rounded-lg p-4 mb-4 bg-green-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <Calendar className="w-5 h-5 text-green-600 mr-2" />
            <span className="font-semibold text-green-800">Community Event</span>
          </div>
          <div className="bg-green-200 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
            <Clock3 className="w-3 h-3 inline mr-1" />
            {isUpcomingEvent(post.eventDate) ? 'Upcoming' : 'Past'}
          </div>
        </div>
        <p className="text-gray-700 whitespace-pre-wrap mb-3">{post.content}</p>
        
        {/* Event Details */}
        <div className="bg-green-100 rounded-lg p-3 mb-3">
          <h4 className="font-medium text-green-800 mb-2">📅 Event Details</h4>
          <div className="space-y-1 text-sm">
            {post.eventDate && (
              <div className="flex items-center text-green-700">
                <Calendar className="w-4 h-4 mr-2" />
                <span>Date: {formatDate(post.eventDate)}</span>
                {post.eventTime && <span className="ml-2">at {post.eventTime}</span>}
              </div>
            )}
            {post.eventEndDate && (
              <div className="flex items-center text-green-700">
                <Clock3 className="w-4 h-4 mr-2" />
                <span>Ends: {formatDate(post.eventEndDate)}</span>
                {post.eventEndTime && <span className="ml-2">at {post.eventEndTime}</span>}
              </div>
            )}
            {post.maxAttendees && (
              <div className="flex items-center text-green-700">
                <Users className="w-4 h-4 mr-2" />
                <span>Max Attendees: {post.maxAttendees}</span>
              </div>
            )}
          </div>
        </div>

        {/* RSVP Section */}
        <div className="bg-white rounded-lg p-3 mb-3 border border-green-200">
          <h4 className="font-medium text-green-800 mb-3 flex items-center">
            <Users className="w-4 h-4 mr-2" />
            RSVP ({(rsvpCounts.going || 0) + (rsvpCounts.maybe || 0)} responses)
          </h4>
          
          {/* RSVP Buttons */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => handleRSVP('going')}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ${
                userRsvp?.status === 'going'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              <ThumbsUp className="w-4 h-4 mr-1" />
              Going ({rsvpCounts.going || 0})
            </button>
            <button
              onClick={() => handleRSVP('maybe')}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ${
                userRsvp?.status === 'maybe'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              }`}
            >
              <Clock className="w-4 h-4 mr-1" />
              Maybe ({rsvpCounts.maybe || 0})
            </button>
            <button
              onClick={() => handleRSVP('not_going')}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ${
                userRsvp?.status === 'not_going'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >
              <MessageCircle className="w-4 h-4 mr-1" />
              Can't Go ({rsvpCounts.not_going || 0})
            </button>
          </div>

          {/* Attendee List */}
          {post.rsvps && post.rsvps.length > 0 && (
            <div className="space-y-2">
              {rsvpCounts.going > 0 && (
                <div>
                  <span className="text-xs font-medium text-green-700">Going:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {post.rsvps.filter(rsvp => rsvp.status === 'going').slice(0, 10).map((rsvp, idx) => (
                      <span key={idx} className="inline-block bg-green-200 text-green-800 px-2 py-1 rounded-full text-xs">
                        {rsvp.userName}
                      </span>
                    ))}
                    {post.rsvps.filter(rsvp => rsvp.status === 'going').length > 10 && (
                      <span className="text-xs text-green-600">+{post.rsvps.filter(rsvp => rsvp.status === 'going').length - 10} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {post.location && (
            <div className="flex items-center text-sm text-green-700 bg-green-100 px-3 py-1 rounded-full w-fit">
              <LocationIcon className="w-4 h-4 mr-1" />
              {post.location}
            </div>
          )}
          <div className="flex items-center text-sm text-green-700 bg-green-100 px-3 py-1 rounded-full w-fit">
            <Users className="w-4 h-4 mr-1" />
            Community Event
          </div>
        </div>
      </div>
    );
  };

  const renderMarketplaceContent = (post) => {
    // For legacy posts that might have direct price/condition fields
    if (post.price || post.condition) {
      return (
        <div className="border border-yellow-200 rounded-lg p-4 mb-4 bg-yellow-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <ShoppingBag className="w-5 h-5 text-yellow-600 mr-2" />
              <span className="font-semibold text-yellow-800">For Sale</span>
            </div>
            {post.price && (
              <div className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-sm font-bold">
                <DollarSign className="w-4 h-4 inline mr-1" />
                {post.price}
              </div>
            )}
          </div>
          <p className="text-gray-700 whitespace-pre-wrap mb-3">{post.content}</p>
          
          {/* Legacy Marketplace Details */}
          {(post.condition || post.category) && (
            <div className="bg-yellow-100 rounded-lg p-3 mb-3">
              <h4 className="font-medium text-yellow-800 mb-2">🏷️ Item Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {post.condition && (
                  <div className="flex items-center text-yellow-700">
                    <span className="font-medium mr-2">Condition:</span>
                    <span className="capitalize bg-yellow-200 px-2 py-1 rounded text-xs">{post.condition}</span>
                  </div>
                )}
                {post.category && (
                  <div className="flex items-center text-yellow-700">
                    <span className="font-medium mr-2">Category:</span>
                    <span className="bg-yellow-200 px-2 py-1 rounded text-xs">{post.category}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex gap-2 flex-wrap">
            {post.location && (
              <div className="flex items-center text-sm text-yellow-700 bg-yellow-100 px-3 py-1 rounded-full w-fit">
                <LocationIcon className="w-4 h-4 mr-1" />
                {post.location}
              </div>
            )}
            <div className="flex items-center text-sm text-yellow-700 bg-yellow-100 px-3 py-1 rounded-full w-fit">
              <ShoppingBag className="w-4 h-4 mr-1" />
              Marketplace Item
            </div>
          </div>
        </div>
      );
    }

    // New ad reference format
    if (!post.adReference) {
      return (
        <div className="border border-yellow-200 rounded-lg p-4 mb-4 bg-yellow-50">
          <div className="flex items-center mb-3">
            <ShoppingBag className="w-5 h-5 text-yellow-600 mr-2" />
            <span className="font-semibold text-yellow-800">Marketplace Post</span>
          </div>
          <p className="text-gray-700 whitespace-pre-wrap mb-3">{post.content}</p>
          <p className="text-sm text-yellow-700 italic">Ad details not available</p>
        </div>
      );
    }

    return (
      <div className="border border-yellow-200 rounded-lg p-4 mb-4 bg-yellow-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <ShoppingBag className="w-5 h-5 text-yellow-600 mr-2" />
            <span className="font-semibold text-yellow-800">Shared Listing</span>
          </div>
          <div className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
            <ArrowRight className="w-3 h-3 inline mr-1" />
            {post.adReference.collection}
          </div>
        </div>
        
        <p className="text-gray-700 whitespace-pre-wrap mb-3">{post.content}</p>
        
        {/* Ad Reference Notice */}
        <div className="bg-yellow-100 rounded-lg p-3 mb-3">
          <h4 className="font-medium text-yellow-800 mb-2">📋 Referenced Listing</h4>
          <p className="text-sm text-yellow-700">
            This post references a listing from the {post.adReference.collection} section.
          </p>
          <div className="flex gap-2 mt-2">
            <a 
              href={`/${post.adReference.collection}/${post.adReference.adId}`}
              target="_blank"
              className="inline-flex items-center text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 transition"
            >
              <Eye className="w-3 h-3 mr-1" />
              View Full Listing
            </a>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {post.location && (
            <div className="flex items-center text-sm text-yellow-700 bg-yellow-100 px-3 py-1 rounded-full w-fit">
              <LocationIcon className="w-4 h-4 mr-1" />
              {post.location}
            </div>
          )}
          <div className="flex items-center text-sm text-yellow-700 bg-yellow-100 px-3 py-1 rounded-full w-fit">
            <ShoppingBag className="w-4 h-4 mr-1" />
            Shared from {post.adReference.collection}
          </div>
        </div>
      </div>
    );
  };

  const renderPollContent = (post) => (
    <div className="border border-purple-200 rounded-lg p-4 mb-4 bg-purple-50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <Award className="w-5 h-5 text-purple-600 mr-2" />
          <span className="font-semibold text-purple-800">Community Poll</span>
        </div>
        <div className="bg-purple-200 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
          <Clock3 className="w-3 h-3 inline mr-1" />
          {post.pollDuration ? `${post.pollDuration} days` : 'Active'}
        </div>
      </div>
      <p className="text-gray-700 whitespace-pre-wrap mb-3">{post.content}</p>
      
      {/* Poll Options */}
      {post.pollOptions && post.pollOptions.length > 0 && (
        <div className="bg-purple-100 p-3 rounded-lg mb-3">
          <h4 className="font-medium text-purple-800 mb-3">📊 Poll Options</h4>
          <div className="space-y-2">
            {post.pollOptions.filter(option => option?.trim()).map((option, index) => {
              const voteCount = post.pollVotes?.[index] || 0;
              const totalVotes = Object.values(post.pollVotes || {}).reduce((sum, count) => sum + count, 0);
              const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
              
              return (
                <div key={index} className="relative">
                  <button className="w-full text-left p-3 bg-white border border-purple-200 rounded-lg hover:border-purple-300 transition">
                    <div className="flex justify-between items-center">
                      <span className="text-purple-800">{option}</span>
                      <span className="text-sm text-purple-600">{percentage}% ({voteCount})</span>
                    </div>
                    <div className="mt-2 w-full bg-purple-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-center">
            <p className="text-sm text-purple-700">
              {Object.values(post.pollVotes || {}).reduce((sum, count) => sum + count, 0)} total votes
            </p>
          </div>
        </div>
      )}
      
      {(!post.pollOptions || post.pollOptions.length === 0) && (
        <div className="bg-purple-100 p-3 rounded-lg">
          <p className="text-sm text-purple-700">📊 Poll options will appear here once configured</p>
        </div>
      )}
    </div>
  );

  const renderTextContent = (post) => (
    <div className="mb-4">
      <p className="text-gray-700 whitespace-pre-wrap">{post.content}</p>
    </div>
  );

  const renderPostContent = (post) => {
    switch (post.type) {
      case 'announcement':
        return renderAnnouncementContent(post);
      case 'event':
        return renderEventContent(post);
      case 'marketplace':
        return renderMarketplaceContent(post);
      case 'poll':
        return renderPollContent(post);
      case 'text':
      default:
        return renderTextContent(post);
    }
  };

  // Helper functions for dynamic form fields
  const addPollOption = () => {
    if (newPostData.pollOptions.length < 6) {
      setNewPostData({
        ...newPostData,
        pollOptions: [...newPostData.pollOptions, '']
      });
    }
  };

  const removePollOption = (index) => {
    if (newPostData.pollOptions.length > 2) {
      setNewPostData({
        ...newPostData,
        pollOptions: newPostData.pollOptions.filter((_, i) => i !== index)
      });
    }
  };

  const updatePollOption = (index, value) => {
    const updatedOptions = [...newPostData.pollOptions];
    updatedOptions[index] = value;
    setNewPostData({
      ...newPostData,
      pollOptions: updatedOptions
    });
  };

  const PostCard = ({ post }) => {
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [showActions, setShowActions] = useState(false);
    const [comments, setComments] = useState(post.comments || []);
    const [loadingComments, setLoadingComments] = useState(false);
    
    
    const isLiked = post.likes?.includes(user.uid);
    const PostIcon = getPostTypeIcon(post.type);
    
    // Load comments on demand when comment section is opened
    const loadComments = async () => {
      if (loadingComments || comments.length > 0) return;

      try {
        setLoadingComments(true);
        const response = await authenticatedFetch(`/api/hub/social-feed/comments?postId=${post.id}&limit=10`);
        const result = await response.json();

        if (response.ok) {
          setComments(result.comments || []);
        }
      } catch (error) {
        console.error('Error loading comments:', error);
      } finally {
        setLoadingComments(false);
      }
    };
    
    const handleToggleComments = () => {
      const newShowState = !showComments;
      setShowComments(newShowState);
      
      // Load comments when opening comment section
      if (newShowState && comments.length === 0) {
        loadComments();
      }
    };

    return (
      <div className="bg-white rounded-lg shadow border p-6 mb-4">
        {/* Post Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
              {post.authorName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="font-medium text-gray-900">{post.authorName}</h4>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPostTypeColor(post.type)}`}>
                  <PostIcon className="w-3 h-3 inline mr-1" />
                  {postTypes.find(t => t.id === post.type)?.name || `Unknown (${post.type})`}
                </span>
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="w-3 h-3 mr-1" />
                {formatTime(post.createdAt)}
                {post.location && (
                  <>
                    <MapPin className="w-3 h-3 ml-2 mr-1" />
                    {post.location}
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            
            {showActions && (
              <div className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg py-1 z-10 w-48">
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center">
                  <Bookmark className="w-4 h-4 mr-2" />
                  Save Post
                </button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </button>
                {post.authorId === user.uid && (
                  <>
                    <button 
                      onClick={() => {
                        setEditingPost({ id: post.id, content: post.content });
                        setShowActions(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </button>
                    <button 
                      onClick={() => {
                        setShowDeleteConfirm(post.id);
                        setShowActions(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </button>
                  </>
                )}
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center text-red-600">
                  <Flag className="w-4 h-4 mr-2" />
                  Report
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Post Content */}
        <div>
          {renderPostContent(post)}
          
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {post.tags.map((tag, index) => (
                <span key={index} className="text-blue-600 text-sm hover:underline cursor-pointer">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Post Stats */}
        <div className="flex items-center justify-between text-sm text-gray-500 mb-4 pt-4 border-t">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Heart className="w-4 h-4 mr-1" />
              {post.likeCount || 0} likes
            </div>
            <div className="flex items-center">
              <MessageCircle className="w-4 h-4 mr-1" />
              {post.commentCount || 0} comments
            </div>
            <div className="flex items-center">
              <Eye className="w-4 h-4 mr-1" />
              {post.viewCount || 0} views
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <button
            onClick={() => likePost(post.id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
              isLiked ? 'text-red-600 bg-red-50' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            <span>{isLiked ? 'Liked' : 'Like'}</span>
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleComments();
            }}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Comment</span>
          </button>
          
          <button
            onClick={() => messageAuthor(post)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
              post.authorId === user.uid 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            disabled={post.authorId === user.uid}
          >
            <Mail className="w-4 h-4" />
            <span>{post.authorId === user.uid ? 'Your Post' : 'Message'}</span>
          </button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="mt-4 pt-4 border-t bg-gray-50 rounded-lg p-4">
            {/* Comment Form */}
            <form onSubmit={(e) => {
              e.preventDefault();
              if (newComment.trim()) {
                commentOnPost(post.id, newComment);
                setNewComment('');
                // Add comment to local state immediately
                const tempComment = {
                  id: `temp-${Date.now()}`,
                  content: newComment,
                  authorId: user.uid,
                  authorName: user.displayName || user.email,
                  createdAt: new Date().toISOString()
                };
                setComments([...comments, tempComment]);
              }
            }} className="mb-4">
              <div className="flex space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {user.displayName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Write a comment..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  Post
                </button>
              </div>
            </form>

            {/* Comments List */}
            {loadingComments ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading comments...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-2">No comments yet. Be the first to comment!</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex space-x-3">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {comment.authorName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <div className="bg-gray-100 rounded-lg px-3 py-2">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-gray-900 text-sm">{comment.authorName}</span>
                            <span className="text-xs text-gray-500">{formatTime(comment.createdAt)}</span>
                          </div>
                          <p className="text-gray-700 text-sm">{comment.content}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center space-x-3">
            <h3 className="text-xl font-semibold text-gray-900">Community Feed</h3>
            {/* Connection Status Indicator */}
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
              }`}></div>
              <span className="text-xs text-gray-500">
                {connectionStatus === 'connected' ? 'Live' :
                 connectionStatus === 'connecting' ? 'Connecting...' :
                 connectionStatus === 'error' ? 'Reconnecting...' : 'Offline'}
              </span>
            </div>
          </div>
          <p className="text-gray-600">Stay connected with your community</p>
        </div>
        <button
          onClick={() => setShowCreatePost(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Post
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        {/* Search Bar */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && loadPosts()}
            placeholder="Search posts, authors, or tags..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={loadPosts}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Search
          </button>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
              }}
              className="px-3 py-2 text-gray-600 hover:text-gray-800 transition"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedFilter === filter.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.name}
            </button>
          ))}
        </div>
      </div>

      {/* Posts Feed */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No posts yet</p>
          <p className="text-sm text-gray-400 mt-1">Be the first to share something with the community!</p>
        </div>
      ) : (
        <PullToRefresh 
          onRefresh={loadPosts} 
          className="h-full"
          disabled={loading}
        >
          <div>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </PullToRefresh>
      )}

      {/* Edit Post Modal */}
      {editingPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Post</h3>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                editPost(editingPost.id, editingPost.content);
              }} className="space-y-4">
                <div>
                  <textarea
                    value={editingPost.content}
                    onChange={(e) => setEditingPost({...editingPost, content: e.target.value})}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Update your post..."
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingPost(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
                  >
                    Update Post
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Post</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this post? This action cannot be undone.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deletePost(showDeleteConfirm)}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Post</h3>
              
              <form onSubmit={createPost} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Post Type
                  </label>
                  <select
                    value={newPostData.type}
                    onChange={(e) => setNewPostData({...newPostData, type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {postTypes.map((type) => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content *
                  </label>
                  <textarea
                    value={newPostData.content}
                    onChange={(e) => setNewPostData({...newPostData, content: e.target.value})}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={
                      newPostData.type === 'announcement' ? 'What would you like to announce to the community?' :
                      newPostData.type === 'event' ? 'Describe your community event...' :
                      newPostData.type === 'marketplace' ? 'Describe what you\'re selling...' :
                      newPostData.type === 'poll' ? 'Ask your question to the community...' :
                      'Share something with your community...'
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location (Optional)
                  </label>
                  <input
                    type="text"
                    value={newPostData.location}
                    onChange={(e) => setNewPostData({...newPostData, location: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add a location..."
                  />
                </div>

                {/* Announcement-specific fields */}
                {newPostData.type === 'announcement' && (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <div className="flex items-center text-red-700 mb-2">
                      <Megaphone className="w-4 h-4 mr-2" />
                      <span className="text-sm font-medium">This will be marked as an important community announcement</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-red-600">
                      <input
                        type="checkbox"
                        id="urgent-announcement"
                        className="rounded border-red-300"
                      />
                      <label htmlFor="urgent-announcement">Mark as urgent</label>
                    </div>
                  </div>
                )}

                {/* Event-specific fields */}
                {newPostData.type === 'event' && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-800 mb-3 flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      Event Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Event Date *
                        </label>
                        <input
                          type="date"
                          value={newPostData.eventDate}
                          onChange={(e) => setNewPostData({...newPostData, eventDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Event Time *
                        </label>
                        <input
                          type="time"
                          value={newPostData.eventTime}
                          onChange={(e) => setNewPostData({...newPostData, eventTime: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          End Date (Optional)
                        </label>
                        <input
                          type="date"
                          value={newPostData.eventEndDate}
                          onChange={(e) => setNewPostData({...newPostData, eventEndDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          End Time (Optional)
                        </label>
                        <input
                          type="time"
                          value={newPostData.eventEndTime}
                          onChange={(e) => setNewPostData({...newPostData, eventEndTime: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Max Attendees (Optional)
                        </label>
                        <input
                          type="number"
                          value={newPostData.maxAttendees}
                          onChange={(e) => setNewPostData({...newPostData, maxAttendees: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="Leave empty for unlimited"
                        />
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="requires-approval"
                          checked={newPostData.requiresApproval}
                          onChange={(e) => setNewPostData({...newPostData, requiresApproval: e.target.checked})}
                          className="mr-2"
                        />
                        <label htmlFor="requires-approval" className="text-sm text-gray-700">
                          Require RSVP approval
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Marketplace-specific fields */}
                {newPostData.type === 'marketplace' && (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-yellow-800 flex items-center">
                        <ShoppingBag className="w-4 h-4 mr-2" />
                        Share Your Listing
                      </h4>
                      <a 
                        href="/marketplace" 
                        target="_blank"
                        className="text-sm text-yellow-600 hover:text-yellow-700 underline flex items-center"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Post New Ad
                      </a>
                    </div>
                    
                    {loadingAds ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-600 mx-auto"></div>
                        <p className="text-sm text-yellow-700 mt-2">Loading your ads...</p>
                      </div>
                    ) : userAds.length > 0 ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select an ad to share with the community *
                        </label>
                        <select
                          value={`${newPostData.selectedAdId}-${newPostData.selectedAdCollection}`}
                          onChange={(e) => {
                            const [adId, collection] = e.target.value.split('-');
                            setNewPostData({
                              ...newPostData, 
                              selectedAdId: adId,
                              selectedAdCollection: collection
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          required
                        >
                          <option value="">Choose an ad...</option>
                          {userAds.map((ad) => (
                            <option key={`${ad.id}-${ad.collectionName}`} value={`${ad.id}-${ad.collectionName}`}>
                              {ad.title || ad.propertyName || ad.serviceName} - {ad.collectionName}
                              {ad.price && ` - ${ad.price}`}
                            </option>
                          ))}
                        </select>
                        
                        {newPostData.selectedAdId && (
                          <div className="mt-3 p-3 bg-yellow-100 rounded-lg">
                            {(() => {
                              const selectedAd = userAds.find(ad => 
                                ad.id === newPostData.selectedAdId && 
                                ad.collectionName === newPostData.selectedAdCollection
                              );
                              if (!selectedAd) return null;
                              
                              return (
                                <div>
                                  <h5 className="font-medium text-yellow-800">
                                    {selectedAd.title || selectedAd.propertyName || selectedAd.serviceName}
                                  </h5>
                                  <p className="text-sm text-yellow-700 mt-1">
                                    {selectedAd.description?.substring(0, 100)}...
                                  </p>
                                  <div className="flex items-center gap-2 mt-2 text-xs text-yellow-600">
                                    <span className="bg-yellow-200 px-2 py-1 rounded">
                                      {selectedAd.collectionName}
                                    </span>
                                    {selectedAd.price && (
                                      <span className="bg-yellow-200 px-2 py-1 rounded">
                                        {selectedAd.price}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-yellow-700">
                        <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                        <p className="font-medium">No ads found</p>
                        <p className="text-sm mt-1">You need to create an ad first before sharing it here.</p>
                        <a 
                          href="/marketplace" 
                          target="_blank"
                          className="inline-flex items-center mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Your First Ad
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Poll-specific fields */}
                {newPostData.type === 'poll' && (
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h4 className="font-medium text-purple-800 mb-3 flex items-center">
                      <Award className="w-4 h-4 mr-2" />
                      Poll Options
                    </h4>
                    <div className="space-y-3">
                      {newPostData.pollOptions.map((option, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => updatePollOption(index, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder={`Option ${index + 1}`}
                            required
                          />
                          {newPostData.pollOptions.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removePollOption(index)}
                              className="px-3 py-2 text-red-600 hover:bg-red-100 rounded-md transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {newPostData.pollOptions.length < 6 && (
                        <button
                          type="button"
                          onClick={addPollOption}
                          className="flex items-center text-purple-600 hover:bg-purple-100 px-3 py-2 rounded-md transition"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Option
                        </button>
                      )}
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Poll Duration (Days)
                      </label>
                      <select
                        value={newPostData.pollDuration}
                        onChange={(e) => setNewPostData({...newPostData, pollDuration: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="1">1 Day</option>
                        <option value="3">3 Days</option>
                        <option value="7">7 Days</option>
                        <option value="14">14 Days</option>
                        <option value="30">30 Days</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreatePost(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {loading ? 'Posting...' : 'Create Post'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunitySocialFeed;