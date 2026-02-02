'use client';
import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle,
  Send,
  Smile,
  Image,
  FileText,
  MoreVertical,
  Reply,
  Edit,
  Trash2,
  User,
  Crown,
  Shield,
  Clock,
  Search,
  Filter,
  Paperclip
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';
import { useRealtimeChat } from '@/hooks/useRealtime';
import { useFirestoreUpdates } from '@/hooks/useFirestoreQuery';
import { db } from '@/lib/firebase-client';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';

const CommunityChat = ({ communityId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState('general');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlineMembers, setOnlineMembers] = useState([]);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);

  // Real-time chat updates for immediate UI feedback
  const { newMessages, messageCount, clearNewMessages } = useRealtimeChat(
    communityId, 
    user?.uid, 
    selectedChannel
  );

  const channels = [
    { id: 'general', name: 'General', description: 'Community-wide discussions', emoji: '💬' },
    { id: 'announcements', name: 'Announcements', description: 'Important community updates', emoji: '📢' },
    { id: 'events', name: 'Events', description: 'Community events and activities', emoji: '🎉' },
    { id: 'marketplace', name: 'Marketplace', description: 'Buy, sell, and trade', emoji: '🛒' },
    { id: 'maintenance', name: 'Maintenance', description: 'Maintenance and repairs', emoji: '🔧' },
    { id: 'random', name: 'Random', description: 'Off-topic conversations', emoji: '🎲' }
  ];

  const commonEmojis = ['😊', '😂', '👍', '👎', '❤️', '🔥', '👏', '🎉', '😢', '😮'];

  // Create Firestore query for real-time chat updates
  const messagesQuery = communityId && selectedChannel
    ? query(
        collection(db, 'chatMessages'),
        where('communityId', '==', communityId),
        where('channelId', '==', selectedChannel),
        orderBy('createdAt', 'asc'),
        limit(100)
      )
    : null;

  // Use Firestore client SDK for real-time updates
  const { isListening, error: realtimeError } = useFirestoreUpdates(
    messagesQuery,
    (changes) => {
      // Handle real-time updates
      setMessages(currentMessages => {
        let updatedMessages = [...currentMessages];
        
        changes.forEach(change => {
          if (change.type === 'added') {
            // Add new message
            const exists = updatedMessages.some(m => m.id === change.doc.id);
            if (!exists) {
              updatedMessages.push(change.doc);
              
              // Show notification for new messages from others
              if (change.doc.authorId !== user?.uid) {
                toast(`💬 ${change.doc.authorName}: ${change.doc.content.substring(0, 50)}...`, {
                  duration: 3000
                });
              }
            }
          } else if (change.type === 'modified') {
            // Update existing message
            const index = updatedMessages.findIndex(m => m.id === change.doc.id);
            if (index !== -1) {
              updatedMessages[index] = change.doc;
            }
          } else if (change.type === 'removed') {
            // Remove deleted message
            updatedMessages = updatedMessages.filter(m => m.id !== change.doc.id);
          }
        });
        
        // Sort messages by creation date
        return updatedMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      });
    }
  );

  useEffect(() => {
    if (communityId && selectedChannel) {
      loadMessages(); // Load initial messages once
    }
  }, [communityId, selectedChannel]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle real-time message updates for immediate UI feedback
  useEffect(() => {
    if (newMessages.length > 0) {
      // Show indicator that new messages arrived
      const latestMessage = newMessages[0];
      if (latestMessage.authorId !== user?.uid) {
        // Show subtle notification for new messages from others
        toast(`💬 New message from ${latestMessage.authorName}`, {
          duration: 2000,
          position: 'bottom-right',
          style: {
            background: '#3B82F6',
            color: 'white',
            fontSize: '14px'
          }
        });
      }
    }
  }, [newMessages, user?.uid]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/chat/messages?communityId=${communityId}&channel=${selectedChannel}&limit=50`);
      const result = await response.json();

      if (response.ok) {
        setMessages(result.messages || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() && !replyingTo) return;

    try {
      setSendingMessage(true);
      const response = await authenticatedFetch('/api/hub/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          action: 'send_message',
          communityId,
          channel: selectedChannel,
          content: newMessage.trim(),
          authorId: user.uid,
          authorName: user.displayName || user.email,
          replyToId: replyingTo?.id || null,
          messageType: 'text'
        })
      });

      if (response.ok) {
        setNewMessage('');
        setReplyingTo(null);
        clearNewMessages(); // Clear real-time indicators
        loadMessages();
        messageInputRef.current?.focus();
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setSendingMessage(false);
    }
  };

  const editMessage = async (messageId, newContent) => {
    try {
      const response = await authenticatedFetch('/api/hub/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          action: 'edit_message',
          messageId,
          content: newContent.trim()
        })
      });

      if (response.ok) {
        setEditingMessage(null);
        loadMessages();
        toast.success('Message updated');
      }
    } catch (error) {
      toast.error('Failed to edit message');
    }
  };

  const deleteMessage = async (messageId) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      const response = await authenticatedFetch('/api/hub/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete_message',
          messageId
        })
      });

      if (response.ok) {
        loadMessages();
        toast.success('Message deleted');
      }
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };

  const reactToMessage = async (messageId, emoji) => {
    try {
      const response = await authenticatedFetch('/api/hub/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          action: 'react_to_message',
          messageId,
          emoji,
          userId: user.uid
        })
      });

      if (response.ok) {
        loadMessages();
      }
    } catch (error) {
      toast.error('Failed to add reaction');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const isOwner = (message) => message.authorId === user.uid;

  const getRoleIcon = (authorRole) => {
    switch (authorRole) {
      case 'admin':
        return <Crown className="w-3 h-3 text-yellow-500" />;
      case 'moderator':
        return <Shield className="w-3 h-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const MessageItem = ({ message }) => {
    const [showActions, setShowActions] = useState(false);
    
    return (
      <div 
        className={`group p-3 hover:bg-gray-50 ${message.isDeleted ? 'opacity-50' : ''}`}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {message.replyTo && (
          <div className="ml-10 mb-2 p-2 bg-gray-100 rounded border-l-2 border-gray-300 text-sm">
            <div className="flex items-center text-gray-600 mb-1">
              <Reply className="w-3 h-3 mr-1" />
              Replying to {message.replyTo.authorName}
            </div>
            <p className="text-gray-700 truncate">{message.replyTo.content}</p>
          </div>
        )}
        
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
            {message.authorName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-medium text-gray-900">{message.authorName}</span>
              {getRoleIcon(message.authorRole)}
              <span className="text-xs text-gray-500 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {formatTime(message.createdAt)}
              </span>
              {message.isEdited && (
                <span className="text-xs text-gray-400">(edited)</span>
              )}
            </div>
            
            {message.isDeleted ? (
              <p className="text-gray-500 italic">This message was deleted</p>
            ) : editingMessage === message.id ? (
              <form onSubmit={(e) => {
                e.preventDefault();
                editMessage(message.id, e.target.content.value);
              }}>
                <input
                  name="content"
                  defaultValue={message.content}
                  className="w-full px-2 py-1 border rounded"
                  autoFocus
                />
                <div className="flex gap-2 mt-1">
                  <button type="submit" className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                    Save
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setEditingMessage(null)}
                    className="text-xs text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <p className="text-gray-700">{message.content}</p>
                
                {message.reactions && Object.keys(message.reactions).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(message.reactions).map(([emoji, users]) => (
                      <button
                        key={emoji}
                        onClick={() => reactToMessage(message.id, emoji)}
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${
                          users.includes(user.uid) 
                            ? 'bg-blue-100 border-blue-300 text-blue-700' 
                            : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {emoji} {users.length}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {showActions && !message.isDeleted && (
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setReplyingTo(message)}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="Reply"
              >
                <Reply className="w-4 h-4" />
              </button>
              
              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Add reaction"
                >
                  <Smile className="w-4 h-4" />
                </button>
                
                {showEmojiPicker === message.id && (
                  <div className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg p-2 z-10">
                    <div className="grid grid-cols-5 gap-1">
                      {commonEmojis.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => {
                            reactToMessage(message.id, emoji);
                            setShowEmojiPicker(null);
                          }}
                          className="p-2 hover:bg-gray-100 rounded"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {isOwner(message) && (
                <>
                  <button
                    onClick={() => setEditingMessage(message.id)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMessage(message.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-[600px] flex bg-white rounded-lg shadow overflow-hidden">
      {/* Channels Sidebar */}
      <div className="w-64 bg-gray-50 border-r">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-900 flex items-center">
            <MessageCircle className="w-5 h-5 mr-2" />
            Community Chat
          </h3>
        </div>
        
        <div className="p-2">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search channels..."
            />
          </div>
          
          <div className="space-y-1">
            {channels
              .filter(channel => channel.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel.id)}
                  className={`w-full text-left p-2 rounded-lg transition ${
                    selectedChannel === channel.id 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center">
                    <span className="text-lg mr-2">{channel.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{channel.name}</div>
                      <div className={`text-xs truncate ${
                        selectedChannel === channel.id ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {channel.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Channel Header */}
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-2xl mr-2">
                {channels.find(c => c.id === selectedChannel)?.emoji}
              </span>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {channels.find(c => c.id === selectedChannel)?.name}
                </h3>
                <p className="text-sm text-gray-600">
                  {channels.find(c => c.id === selectedChannel)?.description}
                </p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {messages.length} messages
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageCircle className="w-12 h-12 mb-3 text-gray-300" />
              <p>No messages yet</p>
              <p className="text-sm">Be the first to start the conversation!</p>
            </div>
          ) : (
            <div>
              {messages.map((message) => (
                <MessageItem key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Reply Preview */}
        {replyingTo && (
          <div className="px-4 py-2 bg-gray-100 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-sm">
                <Reply className="w-4 h-4 mr-2 text-gray-600" />
                <span className="text-gray-600">Replying to</span>
                <span className="font-medium ml-1">{replyingTo.authorName}</span>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-gray-700 truncate mt-1">{replyingTo.content}</p>
          </div>
        )}

        {/* Message Input */}
        <div className="p-4 border-t bg-white">
          <form onSubmit={sendMessage} className="flex items-end space-x-2">
            <div className="flex-1">
              <textarea
                ref={messageInputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder={`Message #${channels.find(c => c.id === selectedChannel)?.name}`}
                rows={1}
                disabled={sendingMessage}
              />
            </div>
            
            <div className="flex items-center space-x-1">
              <button
                type="button"
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Attach file"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              
              <button
                type="submit"
                disabled={sendingMessage || (!newMessage.trim() && !replyingTo)}
                className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {sendingMessage ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CommunityChat;