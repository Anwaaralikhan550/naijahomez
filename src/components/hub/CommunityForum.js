'use client';
import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  Filter,
  Users,
  Clock,
  MessageCircle,
  Pin,
  Trash2,
  Edit,
  Reply,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Eye,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const CommunityForum = ({ communityId }) => {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState('categories');
  const [categories, setCategories] = useState([]);
  const [discussions, setDiscussions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedDiscussion, setSelectedDiscussion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTopicData, setNewTopicData] = useState({
    title: '',
    content: '',
    category: '',
    isPinned: false
  });
  const [replyContent, setReplyContent] = useState('');

  const defaultCategories = [
    {
      id: 'general',
      name: 'General Discussion',
      description: 'General community topics and conversations',
      icon: '💬',
      color: 'bg-blue-100 text-blue-800'
    },
    {
      id: 'maintenance',
      name: 'Maintenance & Repairs',
      description: 'Issues, repairs, and maintenance discussions',
      icon: '🔧',
      color: 'bg-red-100 text-red-800'
    },
    {
      id: 'events',
      name: 'Community Events',
      description: 'Upcoming events, parties, and gatherings',
      icon: '🎉',
      color: 'bg-green-100 text-green-800'
    },
    {
      id: 'marketplace',
      name: 'Buy & Sell',
      description: 'Community marketplace discussions',
      icon: '🛒',
      color: 'bg-purple-100 text-purple-800'
    },
    {
      id: 'recommendations',
      name: 'Recommendations',
      description: 'Local services, restaurants, and recommendations',
      icon: '⭐',
      color: 'bg-yellow-100 text-yellow-800'
    },
    {
      id: 'security',
      name: 'Safety & Security',
      description: 'Security concerns and safety discussions',
      icon: '🛡️',
      color: 'bg-orange-100 text-orange-800'
    }
  ];

  useEffect(() => {
    if (communityId) {
      loadCategories();
      if (selectedCategory) {
        loadDiscussions(selectedCategory.id);
      }
    }
  }, [communityId, selectedCategory?.id]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      // For now, use default categories. In production, these could be customizable
      setCategories(defaultCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDiscussions = async (categoryId) => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/forum/discussions?communityId=${communityId}&category=${categoryId}`);
      const result = await response.json();

      if (response.ok) {
        setDiscussions(result.discussions || []);
      }
    } catch (error) {
      console.error('Error loading discussions:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewTopic = async (e) => {
    e.preventDefault();
    
    if (!newTopicData.title.trim() || !newTopicData.content.trim()) {
      toast.error('Title and content are required');
      return;
    }

    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/hub/forum/discussions', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_discussion',
          communityId,
          categoryId: selectedCategory.id,
          title: newTopicData.title,
          content: newTopicData.content,
          isPinned: newTopicData.isPinned,
          authorId: user.uid,
          authorName: user.displayName || user.email
        })
      });

      if (response.ok) {
        toast.success('✅ Discussion created successfully!');
        setShowNewTopic(false);
        setNewTopicData({ title: '', content: '', category: '', isPinned: false });
        loadDiscussions(selectedCategory.id);
      } else {
        throw new Error('Failed to create discussion');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const postReply = async (discussionId) => {
    if (!replyContent.trim()) {
      toast.error('Reply content is required');
      return;
    }

    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/hub/forum/replies', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_reply',
          discussionId,
          content: replyContent,
          authorId: user.uid,
          authorName: user.displayName || user.email
        })
      });

      if (response.ok) {
        toast.success('✅ Reply posted!');
        setReplyContent('');
        // Reload discussion to show new reply
        loadDiscussionDetails(discussionId);
      } else {
        throw new Error('Failed to post reply');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadDiscussionDetails = async (discussionId) => {
    try {
      const response = await authenticatedFetch(`/api/hub/forum/discussions/${discussionId}`);
      const result = await response.json();

      if (response.ok) {
        setSelectedDiscussion(result.discussion);
        setActiveView('discussion');
      }
    } catch (error) {
      console.error('Error loading discussion:', error);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  const renderCategoriesView = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Community Forum</h3>
          <p className="text-gray-600">Join discussions with your neighbors</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <div
            key={category.id}
            onClick={() => {
              setSelectedCategory(category);
              setActiveView('category');
            }}
            className="bg-white rounded-lg shadow hover:shadow-md transition cursor-pointer p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-3xl">{category.icon}</div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${category.color}`}>
                5 topics {/* TODO: Load actual count */}
              </span>
            </div>
            
            <h4 className="font-semibold text-gray-900 mb-2">{category.name}</h4>
            <p className="text-sm text-gray-600 mb-4">{category.description}</p>
            
            <div className="flex items-center text-xs text-gray-500">
              <Clock className="w-3 h-3 mr-1" />
              Last post 2 hours ago {/* TODO: Load actual data */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCategoryView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => setActiveView('categories')}
            className="text-blue-600 hover:text-blue-700 mr-4"
          >
            ← Back to Categories
          </button>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 flex items-center">
              <span className="text-2xl mr-2">{selectedCategory?.icon}</span>
              {selectedCategory?.name}
            </h3>
            <p className="text-gray-600">{selectedCategory?.description}</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewTopic(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Topic
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search discussions..."
          />
        </div>
        <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="recent">Most Recent</option>
          <option value="popular">Most Popular</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>

      {/* Discussions List */}
      <div className="bg-white rounded-lg shadow">
        {discussions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No discussions yet in this category</p>
            <p className="text-sm mt-1">Be the first to start a conversation!</p>
          </div>
        ) : (
          <div className="divide-y">
            {discussions.map((discussion) => (
              <div
                key={discussion.id}
                onClick={() => loadDiscussionDetails(discussion.id)}
                className="p-6 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {discussion.isPinned && (
                        <Pin className="w-4 h-4 text-blue-600" />
                      )}
                      <h4 className="font-medium text-gray-900">{discussion.title}</h4>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {discussion.content}
                    </p>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <div className="flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        By {discussion.authorName}
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDate(discussion.createdAt)}
                      </div>
                      <div className="flex items-center">
                        <MessageCircle className="w-3 h-3 mr-1" />
                        {discussion.replyCount || 0} replies
                      </div>
                      <div className="flex items-center">
                        <Eye className="w-3 h-3 mr-1" />
                        {discussion.viewCount || 0} views
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderDiscussionView = () => (
    <div className="space-y-6">
      <div className="flex items-center">
        <button
          onClick={() => setActiveView('category')}
          className="text-blue-600 hover:text-blue-700 mr-4"
        >
          ← Back to {selectedCategory?.name}
        </button>
      </div>

      {selectedDiscussion && (
        <div className="space-y-6">
          {/* Original Post */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center space-x-2 mb-4">
              {selectedDiscussion.isPinned && (
                <Pin className="w-4 h-4 text-blue-600" />
              )}
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedDiscussion.title}
              </h2>
            </div>
            
            <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                {selectedDiscussion.authorName}
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                {formatDate(selectedDiscussion.createdAt)}
              </div>
            </div>
            
            <div className="prose max-w-none">
              <p className="text-gray-700">{selectedDiscussion.content}</p>
            </div>
            
            <div className="flex items-center space-x-4 mt-6 pt-4 border-t">
              <button className="flex items-center text-gray-600 hover:text-blue-600">
                <ThumbsUp className="w-4 h-4 mr-1" />
                Like ({selectedDiscussion.likes || 0})
              </button>
              <button className="flex items-center text-gray-600 hover:text-red-600">
                <Flag className="w-4 h-4 mr-1" />
                Report
              </button>
            </div>
          </div>

          {/* Replies */}
          <div className="space-y-4">
            {selectedDiscussion.replies?.map((reply) => (
              <div key={reply.id} className="bg-white rounded-lg shadow p-6 ml-8">
                <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {reply.authorName}
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {formatDate(reply.createdAt)}
                  </div>
                </div>
                
                <p className="text-gray-700">{reply.content}</p>
                
                <div className="flex items-center space-x-4 mt-4">
                  <button className="flex items-center text-gray-600 hover:text-blue-600 text-sm">
                    <ThumbsUp className="w-3 h-3 mr-1" />
                    Like ({reply.likes || 0})
                  </button>
                  <button className="flex items-center text-gray-600 hover:text-blue-600 text-sm">
                    <Reply className="w-3 h-3 mr-1" />
                    Reply
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Reply Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="font-medium text-gray-900 mb-4">Post a Reply</h4>
            <form onSubmit={(e) => { e.preventDefault(); postReply(selectedDiscussion.id); }}>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Share your thoughts..."
                required
              />
              <div className="flex justify-end mt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {loading ? 'Posting...' : 'Post Reply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {activeView === 'categories' && renderCategoriesView()}
      {activeView === 'category' && renderCategoryView()}
      {activeView === 'discussion' && renderDiscussionView()}

      {/* New Topic Modal */}
      {showNewTopic && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Create New Topic in {selectedCategory?.name}
              </h3>
              
              <form onSubmit={createNewTopic} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Topic Title *
                  </label>
                  <input
                    type="text"
                    value={newTopicData.title}
                    onChange={(e) => setNewTopicData({...newTopicData, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter topic title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content *
                  </label>
                  <textarea
                    value={newTopicData.content}
                    onChange={(e) => setNewTopicData({...newTopicData, content: e.target.value})}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Share your thoughts..."
                    required
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newTopicData.isPinned}
                      onChange={(e) => setNewTopicData({...newTopicData, isPinned: e.target.checked})}
                      className="mr-2"
                    />
                    Pin this topic (admin only)
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewTopic(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {loading ? 'Creating...' : 'Create Topic'}
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

export default CommunityForum;