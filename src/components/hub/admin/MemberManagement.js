'use client';
import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Shield,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Eye
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const MemberManagement = ({ communityId }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberDetails, setShowMemberDetails] = useState(false);

  useEffect(() => {
    if (communityId) {
      loadMembers();
      loadJoinRequests();
    }
  }, [communityId]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/admin/members?communityId=${communityId}`);
      const result = await response.json();

      if (response.ok) {
        setMembers(result.members || []);
      }
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadJoinRequests = async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/join-requests?communityId=${communityId}`);
      const result = await response.json();

      if (response.ok) {
        setJoinRequests(result.requests || []);
      }
    } catch (error) {
      console.error('Error loading join requests:', error);
    }
  };

  const handleApproveRequest = async (request) => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/hub/join-requests', {
        method: 'POST',
        body: JSON.stringify({
          action: 'approve',
          requestId: request.id,
          userId: request.userId,
          communityId: request.communityId,
          unitNumber: request.unitNumber,
          phoneNumber: request.phoneNumber,
          adminId: user.uid
        })
      });

      if (response.ok) {
        toast.success('✅ Member approved successfully!', {
          duration: 4000,
          position: 'top-center',
          style: {
            background: '#10B981',
            color: 'white',
            fontWeight: 'bold',
            padding: '16px',
            borderRadius: '8px'
          }
        });

        loadJoinRequests();
        loadMembers();
      } else {
        throw new Error('Failed to approve member');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRequest = async (request, reason = '') => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/hub/join-requests', {
        method: 'POST',
        body: JSON.stringify({
          action: 'reject',
          requestId: request.id,
          adminId: user.uid,
          adminNotes: reason
        })
      });

      if (response.ok) {
        toast.success('✅ Request rejected', {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#EF4444',
            color: 'white',
            fontWeight: 'bold',
            padding: '16px',
            borderRadius: '8px'
          }
        });

        loadJoinRequests();
      } else {
        throw new Error('Failed to reject request');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateMemberRole = async (memberId, newRole) => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/hub/admin/members', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update_role',
          memberId,
          role: newRole,
          adminId: user.uid
        })
      });

      if (response.ok) {
        toast.success('✅ Member role updated!');
        loadMembers();
      } else {
        throw new Error('Failed to update role');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (memberId) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/hub/admin/members', {
        method: 'POST',
        body: JSON.stringify({
          action: 'remove_member',
          memberId,
          adminId: user.uid
        })
      });

      if (response.ok) {
        toast.success('✅ Member removed');
        loadMembers();
      } else {
        throw new Error('Failed to remove member');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Unknown';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString();
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'moderator': return 'bg-blue-100 text-blue-800';
      case 'member': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.unitNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredRequests = joinRequests.filter(request => {
    const matchesSearch = request.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.unitNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingRequestsCount = joinRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Member Management</h3>
          <p className="text-gray-600">Manage community members and join requests</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('members')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'members'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Members ({filteredMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`py-2 px-1 border-b-2 font-medium text-sm relative ${
              activeTab === 'requests'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlus className="w-4 h-4 inline mr-2" />
            Join Requests ({filteredRequests.length})
            {pendingRequestsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingRequestsCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          {activeTab === 'members' ? (
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
              <option value="member">Member</option>
            </select>
          ) : (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'members' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h4 className="text-lg font-semibold text-gray-900">Community Members</h4>
          </div>

          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No members found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredMembers.map((member) => (
                <div key={member.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h5 className="font-medium text-gray-900">{member.userName}</h5>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(member.role)}`}>
                          {member.role}
                        </span>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Mail className="w-4 h-4 mr-2" />
                          {member.userEmail}
                        </div>
                        {member.unitNumber && (
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-2" />
                            Unit: {member.unitNumber}
                          </div>
                        )}
                        {member.phoneNumber && (
                          <div className="flex items-center">
                            <Phone className="w-4 h-4 mr-2" />
                            {member.phoneNumber}
                          </div>
                        )}
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2" />
                          Joined: {formatDate(member.joinedAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <select
                        value={member.role}
                        onChange={(e) => updateMemberRole(member.id, e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={loading}
                      >
                        <option value="member">Member</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => removeMember(member.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition"
                        disabled={loading}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h4 className="text-lg font-semibold text-gray-900">Join Requests</h4>
          </div>

          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <UserPlus className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No join requests found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredRequests.map((request) => (
                <div key={request.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h5 className="font-medium text-gray-900">{request.userName}</h5>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600 mb-3">
                        <div className="flex items-center">
                          <Mail className="w-4 h-4 mr-2" />
                          {request.userEmail}
                        </div>
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-2" />
                          Unit: {request.unitNumber}
                        </div>
                        <div className="flex items-center">
                          <Phone className="w-4 h-4 mr-2" />
                          {request.phoneNumber}
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2" />
                          Requested: {formatDate(request.createdAt)}
                        </div>
                      </div>

                      {request.message && (
                        <div className="bg-gray-50 p-3 rounded-lg mb-3">
                          <p className="text-sm text-gray-700">{request.message}</p>
                        </div>
                      )}

                      {request.adminNotes && (
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <p className="text-sm font-medium text-blue-800 mb-1">Admin Notes:</p>
                          <p className="text-sm text-blue-700">{request.adminNotes}</p>
                        </div>
                      )}
                    </div>

                    {request.status === 'pending' && (
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleApproveRequest(request)}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition flex items-center text-sm"
                          disabled={loading}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request)}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition flex items-center text-sm"
                          disabled={loading}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MemberManagement;