'use client';
import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle,
  Send,
  Search,
  User,
  MoreVertical,
  ArrowLeft,
  Plus,
  Circle,
  Paperclip,
  Smile,
  Phone,
  Video,
  Info,
  Trash2,
  Edit,
  Check,
  CheckCheck
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';
import { useFirestoreUpdates } from '@/hooks/useFirestoreQuery';
import { db } from '@/lib/firebase-client';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';

const PrivateMessages = ({ communityId }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const messagesEndRef = useRef(null);

  // Create Firestore queries for real-time updates
  const conversationsQuery = communityId && user?.uid
    ? query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', user.uid),
        where('communityId', '==', communityId),
        orderBy('updatedAt', 'desc')
      )
    : null;

  const messagesQuery = selectedConversation
    ? query(
        collection(db, 'privateMessages'),
        where('conversationId', '==', selectedConversation.id),
        orderBy('createdAt', 'asc'),
        limit(50)
      )
    : null;

  // Use Firestore client SDK for real-time conversation updates
  const { isListening: conversationsListening } = useFirestoreUpdates(
    conversationsQuery,
    (changes) => {
      setConversations(currentConversations => {
        let updated = [...currentConversations];
        
        changes.forEach(change => {
          if (change.type === 'added') {
            const exists = updated.some(c => c.id === change.doc.id);
            if (!exists) {
              updated.push(change.doc);
            }
          } else if (change.type === 'modified') {
            const index = updated.findIndex(c => c.id === change.doc.id);
            if (index !== -1) {
              updated[index] = change.doc;
            }
          }
        });
        
        return updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });
    }
  );

  // Use Firestore client SDK for real-time message updates
  const { isListening: messagesListening } = useFirestoreUpdates(
    messagesQuery,
    (changes) => {
      setMessages(currentMessages => {
        let updated = [...currentMessages];
        
        changes.forEach(change => {
          if (change.type === 'added') {
            const exists = updated.some(m => m.id === change.doc.id);
            if (!exists) {
              updated.push(change.doc);
              
              // Show notification for new private messages from others
              if (change.doc.senderId !== user?.uid) {
                toast(`📨 New message from ${change.doc.senderName}`, {
                  duration: 4000
                });
              }
            }
          }
        });
        
        return updated.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      });
    }
  );

  useEffect(() => {
    if (communityId && user) {
      loadConversations();
      loadAvailableMembers();
    }
  }, [communityId, user]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      markAsRead(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversations = async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/messages/conversations?userId=${user.uid}&communityId=${communityId}`);
      const result = await response.json();

      if (response.ok) {
        setConversations(result.conversations || []);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadAvailableMembers = async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/members?communityId=${communityId}`);
      const result = await response.json();

      if (response.ok) {
        // Filter out current user
        const members = (result.members || []).filter(member => member.userId !== user.uid);
        setAvailableMembers(members);
      }
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/messages?conversationId=${conversationId}&limit=50`);
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

  const startNewConversation = async (memberId, memberName) => {
    try {
      const response = await authenticatedFetch('/api/hub/messages/conversations', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_conversation',
          communityId,
          participantIds: [user.uid, memberId],
          participantNames: [user.displayName || user.email, memberName],
          createdBy: user.uid
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setShowNewChatModal(false);
        loadConversations();
        // Select the new conversation
        const newConversation = {
          id: result.conversationId,
          otherParticipant: { id: memberId, name: memberName },
          lastMessage: null,
          unreadCount: 0,
          updatedAt: new Date()
        };
        setSelectedConversation(newConversation);
      }
    } catch (error) {
      toast.error('Failed to start conversation');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      setSendingMessage(true);
      const response = await authenticatedFetch('/api/hub/messages', {
        method: 'POST',
        body: JSON.stringify({
          action: 'send_message',
          conversationId: selectedConversation.id,
          content: newMessage.trim(),
          senderId: user.uid,
          senderName: user.displayName || user.email,
          messageType: 'text'
        })
      });

      if (response.ok) {
        setNewMessage('');
        loadMessages(selectedConversation.id);
        loadConversations(); // Update conversation list
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setSendingMessage(false);
    }
  };

  const markAsRead = async (conversationId) => {
    try {
      await authenticatedFetch('/api/hub/messages', {
        method: 'POST',
        body: JSON.stringify({
          action: 'mark_as_read',
          conversationId,
          userId: user.uid
        })
      });
    } catch (error) {
      console.error('Error marking as read:', error);
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
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString();
  };

  const filteredConversations = conversations.filter(conv =>
    conv.otherParticipant?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const ConversationItem = ({ conversation }) => (
    <div
      onClick={() => setSelectedConversation(conversation)}
      className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition ${
        selectedConversation?.id === conversation.id ? 'bg-blue-50 border-blue-200' : ''
      }`}
    >
      <div className="flex items-center space-x-3">
        <div className="relative">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
            {conversation.otherParticipant?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          {conversation.otherParticipant?.isOnline && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 truncate">
              {conversation.otherParticipant?.name}
            </h4>
            <span className="text-xs text-gray-500">
              {formatTime(conversation.updatedAt)}
            </span>
          </div>
          
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-gray-600 truncate">
              {conversation.lastMessage?.content || 'No messages yet'}
            </p>
            {conversation.unreadCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                {conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const MessageItem = ({ message }) => {
    const isOwn = message.senderId === user.uid;
    
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isOwn 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-200 text-gray-900'
        }`}>
          <p className="text-sm">{message.content}</p>
          <div className={`flex items-center justify-end mt-1 space-x-1 ${
            isOwn ? 'text-blue-100' : 'text-gray-500'
          }`}>
            <span className="text-xs">{formatTime(message.createdAt)}</span>
            {isOwn && (
              <div className="flex">
                {message.isRead ? (
                  <CheckCheck className="w-3 h-3" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[600px] flex bg-white rounded-lg shadow overflow-hidden">
      {/* Conversations Sidebar */}
      <div className="w-80 border-r bg-gray-50">
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Messages</h3>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Search conversations..."
            />
          </div>
        </div>
        
        <div className="overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No conversations yet</p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="text-blue-600 text-sm mt-2 hover:underline"
              >
                Start your first chat
              </button>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <ConversationItem key={conversation.id} conversation={conversation} />
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="lg:hidden text-gray-600 hover:text-gray-800"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                    {selectedConversation.otherParticipant?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedConversation.otherParticipant?.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedConversation.otherParticipant?.isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
                    <Phone className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
                    <Video className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
                    <Info className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <MessageCircle className="w-12 h-12 mb-3 text-gray-300" />
                  <p>Start the conversation!</p>
                  <p className="text-sm">Send your first message to {selectedConversation.otherParticipant?.name}</p>
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

            {/* Message Input */}
            <div className="p-4 border-t bg-white">
              <form onSubmit={sendMessage} className="flex items-end space-x-2">
                <div className="flex-1">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(e);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder={`Message ${selectedConversation.otherParticipant?.name}...`}
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
                    type="button"
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title="Add emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  
                  <button
                    type="submit"
                    disabled={sendingMessage || !newMessage.trim()}
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
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p>Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Start New Conversation</h3>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {availableMembers.map((member) => (
                  <div
                    key={member.userId}
                    onClick={() => startNewConversation(member.userId, member.userName)}
                    className="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition"
                  >
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium mr-3">
                      {member.userName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{member.userName}</h4>
                      <p className="text-sm text-gray-600">{member.userEmail}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowNewChatModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivateMessages;