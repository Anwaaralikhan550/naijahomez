'use client';
import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Plus, 
  Copy, 
  Eye, 
  EyeOff, 
  Trash2, 
  Clock, 
  Users,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  QrCode,
  Download
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const AccessCodeGenerator = ({ communityId }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('codes');
  const [accessCodes, setAccessCodes] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [codeData, setCodeData] = useState({
    description: '',
    maxUses: '',
    expiresAt: '',
    role: 'member',
    isActive: true
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCode, setShowCode] = useState({});

  useEffect(() => {
    if (communityId && user?.uid) {
      loadAccessCodes();
      loadAccessCodeRequests();
    }
  }, [communityId, user?.uid]);

  const loadAccessCodes = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/access-codes?communityId=${communityId}&admin=true`);
      const result = await response.json();

      if (response.ok) {
        setAccessCodes(result.accessCodes || []);
      }
    } catch (error) {
      console.error('Error loading access codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAccessCodeRequests = async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/access-code-requests?communityId=${communityId}&userId=${user.uid}`);
      const result = await response.json();

      if (response.ok) {
        setRequests(result.requests || []);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCodeData({
      ...codeData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const generateAccessCode = () => {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // Exclude O and 0 for clarity
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!codeData.description.trim()) {
      toast.error('Description is required');
      return;
    }

    try {
      setLoading(true);
      const accessCode = generateAccessCode();

      const response = await authenticatedFetch('/api/hub/access-codes', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_code',
          communityId,
          code: accessCode,
          description: codeData.description,
          maxUses: codeData.maxUses ? parseInt(codeData.maxUses) : null,
          expiresAt: codeData.expiresAt ? new Date(codeData.expiresAt) : null,
          role: codeData.role,
          isActive: codeData.isActive,
          createdBy: user.uid,
          createdByName: user.displayName || user.email
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('✅ Access code generated successfully!', {
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

        // Reset form
        setCodeData({
          description: '',
          maxUses: '',
          expiresAt: '',
          role: 'member',
          isActive: true
        });
        setShowCreateForm(false);
        loadAccessCodes();
      } else {
        throw new Error(result.error || 'Failed to generate access code');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleCodeStatus = async (codeId, isActive) => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/hub/access-codes', {
        method: 'POST',
        body: JSON.stringify({
          action: 'toggle_status',
          codeId,
          isActive: !isActive
        })
      });

      if (response.ok) {
        toast.success(`✅ Access code ${!isActive ? 'activated' : 'deactivated'}`);
        loadAccessCodes();
      } else {
        throw new Error('Failed to update access code');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteAccessCode = async (codeId) => {
    if (!confirm('Are you sure you want to delete this access code?')) return;

    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/hub/access-codes', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete_code',
          codeId
        })
      });

      if (response.ok) {
        toast.success('✅ Access code deleted');
        loadAccessCodes();
      } else {
        throw new Error('Failed to delete access code');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (requestId, action) => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/access-code-requests?userId=${user.uid}`, {
        method: 'POST',
        body: JSON.stringify({
          action: action === 'approve' ? 'approve_request' : 'reject_request',
          requestId,
          adminId: user.uid,
          communityId
        })
      });

      if (response.ok) {
        toast.success(`✅ Request ${action}d successfully`);
        loadAccessCodeRequests();
        if (action === 'approve') {
          loadAccessCodes(); // Refresh codes if a new one was generated
        }
      } else {
        throw new Error(`Failed to ${action} request`);
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('📋 Copied to clipboard!');
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  const getStatusColor = (isActive, usesLeft, expiresAt) => {
    if (!isActive) return 'bg-red-100 text-red-800';
    if (usesLeft === 0) return 'bg-gray-100 text-gray-800';
    if (expiresAt && new Date(expiresAt.toDate ? expiresAt.toDate() : expiresAt) < new Date()) {
      return 'bg-yellow-100 text-yellow-800';
    }
    return 'bg-green-100 text-green-800';
  };

  const getStatus = (isActive, usesLeft, expiresAt) => {
    if (!isActive) return 'Inactive';
    if (usesLeft === 0) return 'Exhausted';
    if (expiresAt && new Date(expiresAt.toDate ? expiresAt.toDate() : expiresAt) < new Date()) {
      return 'Expired';
    }
    return 'Active';
  };

  const filteredCodes = accessCodes.filter(code => {
    const matchesSearch = code.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         code.code?.toLowerCase().includes(searchTerm.toLowerCase());
    const status = getStatus(code.isActive, code.usesLeft, code.expiresAt);
    const matchesStatus = statusFilter === 'all' || status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Access Code Management</h3>
          <p className="text-gray-600">Generate and manage community access codes</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Generate Code
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('codes')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'codes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Key className="w-4 h-4 inline mr-2" />
            Access Codes ({accessCodes.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'requests'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Requests ({requests.filter(r => r.status === 'pending').length})
          </button>
        </nav>
      </div>

      {/* Access Codes Tab */}
      {activeTab === 'codes' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-blue-600">{accessCodes.length}</div>
              <div className="text-sm text-gray-600">Total Codes</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-green-600">
                {accessCodes.filter(c => c.isActive && (!c.expiresAt || new Date(c.expiresAt.toDate ? c.expiresAt.toDate() : c.expiresAt) > new Date())).length}
              </div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-yellow-600">
                {accessCodes.filter(c => c.expiresAt && new Date(c.expiresAt.toDate ? c.expiresAt.toDate() : c.expiresAt) < new Date()).length}
              </div>
              <div className="text-sm text-gray-600">Expired</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-gray-600">{accessCodes.filter(c => c.usesLeft === 0).length}</div>
              <div className="text-sm text-gray-600">Exhausted</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search codes..."
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
              <option value="exhausted">Exhausted</option>
            </select>
          </div>

          {/* Codes List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h4 className="text-lg font-semibold text-gray-900">
                Generated Access Codes ({filteredCodes.length})
              </h4>
            </div>

            {filteredCodes.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Key className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No access codes found</p>
                <p className="text-sm text-gray-400 mt-1">Generate your first access code to get started</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredCodes.map((code) => (
                  <div key={code.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="flex items-center">
                            <span className="font-mono text-lg font-bold text-gray-900">
                              {showCode[code.id] ? code.code : '••••••••'}
                            </span>
                            <button
                              onClick={() => setShowCode({...showCode, [code.id]: !showCode[code.id]})}
                              className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                            >
                              {showCode[code.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            {showCode[code.id] && (
                              <button
                                onClick={() => copyToClipboard(code.code)}
                                className="ml-1 p-1 text-gray-400 hover:text-gray-600"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(code.isActive, code.usesLeft, code.expiresAt)}`}>
                            {getStatus(code.isActive, code.usesLeft, code.expiresAt)}
                          </span>
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            {code.role}
                          </span>
                        </div>
                        
                        <p className="text-gray-600 mb-3">{code.description}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-1" />
                            Used: {(code.maxUses || 0) - (code.usesLeft || 0)}{code.maxUses ? `/${code.maxUses}` : ''}
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            Created: {formatDate(code.createdAt)}
                          </div>
                          {code.expiresAt && (
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              Expires: {formatDate(code.expiresAt)}
                            </div>
                          )}
                          <div>
                            By: {code.createdByName}
                          </div>
                        </div>
                      </div>

                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={() => toggleCodeStatus(code.id, code.isActive)}
                          className={`px-3 py-1 rounded text-sm transition flex items-center ${
                            code.isActive 
                              ? 'bg-red-600 text-white hover:bg-red-700' 
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {code.isActive ? <XCircle className="w-3 h-3 mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                          {code.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => deleteAccessCode(code.id)}
                          className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition flex items-center"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h4 className="text-lg font-semibold text-gray-900">Access Code Requests</h4>
          </div>

          {requests.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No access code requests</p>
            </div>
          ) : (
            <div className="divide-y">
              {requests.map((request) => (
                <div key={request.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h5 className="font-medium text-gray-900">{request.requesterName}</h5>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {request.status}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 mb-3">{request.reason}</p>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <div>Email: {request.requesterEmail}</div>
                        <div>Requested: {formatDate(request.createdAt)}</div>
                        {request.contactInfo && <div>Contact: {request.contactInfo}</div>}
                      </div>
                    </div>

                    {request.status === 'pending' && (
                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={() => handleRequest(request.id, 'approve')}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition flex items-center"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleRequest(request.id, 'reject')}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition flex items-center"
                        >
                          <XCircle className="w-3 h-3 mr-1" />
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

      {/* Create Code Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Access Code</h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <input
                    type="text"
                    name="description"
                    value={codeData.description}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Purpose of this access code"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <select
                      name="role"
                      value={codeData.role}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="member">Member</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Uses
                    </label>
                    <input
                      type="number"
                      name="maxUses"
                      value={codeData.maxUses}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Unlimited"
                      min="1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expires At (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    name="expiresAt"
                    value={codeData.expiresAt}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={codeData.isActive}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    Active and ready to use
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {loading ? 'Generating...' : 'Generate Code'}
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

export default AccessCodeGenerator;