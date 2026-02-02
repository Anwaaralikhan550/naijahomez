'use client';
import React, { useState, useEffect } from 'react';
import { 
  Users,
  Search,
  Filter,
  Mail,
  Phone,
  MapPin,
  Calendar,
  MessageCircle,
  UserPlus,
  Shield,
  Star,
  Building,
  Clock,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import { HubErrorBoundary } from '@/components/shared/ErrorBoundary';
import { AsyncStateHandler, useAsyncState } from '@/components/shared/LoadingAndErrorStates';
import { Pagination, usePagination } from '@/components/shared/Pagination';
import { AdvancedSearch, useAdvancedSearch } from '@/components/shared/AdvancedSearch';
import toast from 'react-hot-toast';

const MemberDirectory = ({ communityId }) => {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  
  // Use the async state hook for better error handling
  const { loading, error, execute: executeAsync } = useAsyncState();
  
  // Advanced search configuration
  const searchConfig = {
    searchFields: ['userName', 'userEmail', 'apartment', 'building'],
    defaultSort: 'userName',
    filters: [
      {
        key: 'role',
        label: 'Role',
        type: 'select',
        options: [
          { value: 'admin', label: 'Admins' },
          { value: 'moderator', label: 'Moderators' },
          { value: 'member', label: 'Members' }
        ]
      },
      {
        key: 'building',
        label: 'Building',
        type: 'select',
        options: [...new Set(members.map(m => m.building).filter(Boolean))].map(b => ({ value: b, label: b }))
      },
      {
        key: 'isPublicContact',
        label: 'Public Contact',
        type: 'checkbox'
      }
    ]
  };
  
  // Use advanced search hook
  const {
    searchTerm,
    setSearchTerm,
    filters,
    updateFilter,
    results: filteredMembers,
    resultCount,
    hasActiveFilters
  } = useAdvancedSearch(members, searchConfig);
  
  // Pagination for filtered members
  const pagination = usePagination(filteredMembers.length, 12); // 12 members per page
  
  // Get paginated members
  const paginatedMembers = filteredMembers.slice(pagination.startIndex, pagination.endIndex);

  useEffect(() => {
    if (communityId) {
      loadMembers();
    }
  }, [communityId]);

  const loadMembers = async () => {
    await executeAsync(async () => {
      const response = await authenticatedFetch(`/api/hub/members?communityId=${communityId}`);

      if (!response.ok) {
        throw new Error(`Failed to load members: ${response.status}`);
      }

      const result = await response.json();
      setMembers(result.members || []);
      return result.members;
    });
  };


  const sendMessage = async (recipientId, recipientName) => {
    try {
      const response = await authenticatedFetch('/api/hub/messages/conversations', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_conversation',
          participantId: recipientId,
          participantName: recipientName,
          communityId: communityId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      const result = await response.json();
      toast.success(`Starting conversation with ${recipientName}`);

      // Close the modal and potentially navigate to messages
      setShowContactModal(false);

      // You could emit an event or use a callback to navigate to messages
      // For now, just show success
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to start conversation. Please try again.');
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'moderator':
        return 'bg-blue-100 text-blue-800';
      case 'member':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-3 h-3" />;
      case 'moderator':
        return <Star className="w-3 h-3" />;
      default:
        return <Users className="w-3 h-3" />;
    }
  };

  const formatJoinDate = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString();
  };

  // Buildings are now dynamically loaded in the searchConfig

  const MemberCard = ({ member }) => (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
            {member.userName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="ml-3">
            <h3 className="font-medium text-gray-900">{member.userName}</h3>
            <p className="text-sm text-gray-600">{member.userEmail}</p>
          </div>
        </div>
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
          {getRoleIcon(member.role)}
          <span className="ml-1 capitalize">{member.role}</span>
        </span>
      </div>

      <div className="space-y-2 mb-4">
        {member.apartment && (
          <div className="flex items-center text-sm text-gray-600">
            <Building className="w-4 h-4 mr-2" />
            {member.building && `${member.building}, `}Apt {member.apartment}
          </div>
        )}
        
        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="w-4 h-4 mr-2" />
          Joined {formatJoinDate(member.joinedAt)}
        </div>

        {member.phone && (
          <div className="flex items-center text-sm text-gray-600">
            <Phone className="w-4 h-4 mr-2" />
            {member.phone}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            setSelectedMember(member);
            setShowContactModal(true);
          }}
          className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition text-sm flex items-center justify-center"
        >
          <Mail className="w-4 h-4 mr-1" />
          Contact
        </button>
        <button
          onClick={() => sendMessage(member.userId, member.userName)}
          className="flex-1 border border-gray-300 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-50 transition text-sm flex items-center justify-center"
        >
          <MessageCircle className="w-4 h-4 mr-1" />
          Message
        </button>
      </div>
    </div>
  );

  const MemberListItem = ({ member }) => (
    <div className="bg-white border-b p-4 hover:bg-gray-50 transition">
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold mr-3">
            {member.userName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          
          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
            <div>
              <h3 className="font-medium text-gray-900">{member.userName}</h3>
              <p className="text-sm text-gray-600">{member.userEmail}</p>
            </div>
            
            <div className="text-sm text-gray-600">
              {member.apartment && (
                <div className="flex items-center">
                  <Building className="w-3 h-3 mr-1" />
                  {member.building && `${member.building}, `}Apt {member.apartment}
                </div>
              )}
            </div>
            
            <div className="text-sm text-gray-600">
              <div className="flex items-center">
                <Calendar className="w-3 h-3 mr-1" />
                {formatJoinDate(member.joinedAt)}
              </div>
            </div>
            
            <div className="flex items-center">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                {getRoleIcon(member.role)}
                <span className="ml-1 capitalize">{member.role}</span>
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 ml-4">
          <button
            onClick={() => {
              setSelectedMember(member);
              setShowContactModal(true);
            }}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition"
          >
            Contact
          </button>
          <button
            onClick={() => sendMessage(member.userId, member.userName)}
            className="border border-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-50 transition"
          >
            Message
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <HubErrorBoundary>
      <AsyncStateHandler
        loading={loading}
        error={error}
        onRetry={loadMembers}
        data={members}
        loadingMessage="Loading community members..."
        emptyTitle="No members found"
        emptyMessage="This community doesn't have any members yet."
      >
        <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Member Directory</h3>
          <p className="text-gray-600">Connect with your community neighbors</p>
        </div>
        <div className="text-sm text-gray-500">
          {filteredMembers.length} of {members.length} members
        </div>
      </div>

      {/* Advanced Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col gap-4">
          {/* Advanced Search Component */}
          <AdvancedSearch
            searchConfig={{
              ...searchConfig,
              placeholder: "Search members, apartments, or emails..."
            }}
            onSearchChange={setSearchTerm}
            onFiltersChange={(newFilters) => {
              Object.entries(newFilters).forEach(([key, value]) => {
                updateFilter(key, value);
              });
            }}
          />
          
          {/* View Mode Toggle */}
          <div className="flex justify-end">
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 text-sm ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 text-sm ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                List
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Members Display */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {searchTerm || hasActiveFilters
              ? 'No members match your search criteria' 
              : 'No members found'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchTerm('');
                Object.keys(filters).forEach(key => updateFilter(key, null));
              }}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedMembers.map((member) => (
                <MemberCard key={member.id} member={member} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {paginatedMembers.map((member) => (
                <MemberListItem key={member.id} member={member} />
              ))}
            </div>
          )}
          
          {/* Pagination */}
          {filteredMembers.length > 12 && (
            <div className="mt-8">
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={filteredMembers.length}
                itemsPerPage={pagination.itemsPerPage}
                onPageChange={pagination.goToPage}
                showInfo={true}
                className="justify-center"
              />
            </div>
          )}
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Contact {selectedMember.userName}
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-semibold">
                    {selectedMember.userName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                </div>
                
                <div className="text-center">
                  <h4 className="font-medium text-gray-900">{selectedMember.userName}</h4>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${getRoleColor(selectedMember.role)}`}>
                    {getRoleIcon(selectedMember.role)}
                    <span className="ml-1 capitalize">{selectedMember.role}</span>
                  </span>
                </div>

                <div className="space-y-3 border-t pt-4">
                  {selectedMember.userEmail && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 text-gray-600 mr-2" />
                        <span className="text-sm text-gray-900">{selectedMember.userEmail}</span>
                      </div>
                      <button
                        onClick={() => window.location.href = `mailto:${selectedMember.userEmail}`}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Email
                      </button>
                    </div>
                  )}

                  {selectedMember.phone && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 text-gray-600 mr-2" />
                        <span className="text-sm text-gray-900">{selectedMember.phone}</span>
                      </div>
                      <button
                        onClick={() => window.location.href = `tel:${selectedMember.phone}`}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Call
                      </button>
                    </div>
                  )}

                  {selectedMember.apartment && (
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Building className="w-4 h-4 text-gray-600 mr-2" />
                      <span className="text-sm text-gray-900">
                        {selectedMember.building && `${selectedMember.building}, `}
                        Apartment {selectedMember.apartment}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => sendMessage(selectedMember.userId, selectedMember.userName)}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Send Message
                  </button>
                  <button
                    onClick={() => setShowContactModal(false)}
                    className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </AsyncStateHandler>
    </HubErrorBoundary>
  );
};

export default MemberDirectory;