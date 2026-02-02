'use client';
import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  MessageCircle, 
  Camera, 
  Clock, 
  CheckCircle,
  XCircle,
  Plus,
  Filter,
  Eye
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const IssueReporting = ({ communityId }) => {
  const { user } = useAuth();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);

  const [filterStatus, setFilterStatus] = useState('all');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'medium',
    location: '',
    images: []
  });

  const issueCategories = [
    'Maintenance',
    'Security', 
    'Utilities',
    'Common Areas',
    'Noise Complaint',
    'Parking',
    'Waste Management',
    'Other'
  ];

  const priorityLevels = [
    { value: 'low', label: 'Low', color: 'text-green-600' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
    { value: 'high', label: 'High', color: 'text-red-600' },
    { value: 'urgent', label: 'Urgent', color: 'text-red-800' }
  ];

  const statusOptions = [
    { value: 'all', label: 'All Issues' },
    { value: 'open', label: 'Open' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' }
  ];

  useEffect(() => {
    if (user && communityId) {
      loadIssues();
    }
  }, [user, communityId]);

  const loadIssues = async () => {
    try {
      setLoading(true);
      console.log('Loading issues for community:', communityId, 'user:', user.uid);
      const response = await authenticatedFetch(`/api/hub/issues?communityId=${communityId}&userId=${user.uid}`);
      const result = await response.json();

      console.log('Issues API response:', result);
      
      if (response.ok) {
        const issues = result.issues || [];
        console.log('First issue raw data:', issues[0]);
        setIssues(issues);
        console.log('Issues set:', issues);
      } else {
        console.error('Failed to load issues:', result);
      }
    } catch (error) {
      console.error('Error loading issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      setLoading(true);
      const { uploadMultipleHubImages } = await import('@/utils/hubS3Upload');
      const imageUrls = await uploadMultipleHubImages(files, 'issues');
      
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...imageUrls]
      }));

      toast.success(`✅ ${files.length} image(s) uploaded successfully!`);
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error(`❌ Failed to upload images: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.title.trim()) {
      toast.error('Please enter a title for the issue');
      return;
    }
    
    if (!formData.description.trim()) {
      toast.error('Please enter a description for the issue');
      return;
    }
    
    if (!communityId) {
      toast.error('Community ID is missing. Please try refreshing the page.');
      return;
    }

    setLoading(true);

    const requestData = {
      action: 'create_issue',
      ...formData,
      userId: user.uid,
      communityId,
      reporterName: user.displayName || user.email,
      reporterEmail: user.email
    };


    try {
      const response = await authenticatedFetch(`/api/hub/issues?userId=${user.uid}`, {
        method: 'POST',
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('✅ Issue reported successfully!', {
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

        setFormData({
          title: '',
          description: '',
          category: '',
          priority: 'medium',
          location: '',
          images: []
        });
        setShowReportForm(false);
        loadIssues();
      } else {
        throw new Error(result.error || 'Failed to report issue');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`, {
        duration: 4000,
        position: 'top-center',
        style: {
          background: '#EF4444',
          color: 'white',
          fontWeight: 'bold',
          padding: '16px',
          borderRadius: '8px'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'No date';
    
    try {
      const d = new Date(date);
      
      // Check if date is valid
      if (isNaN(d.getTime())) {
        console.log('Invalid date:', date);
        return 'Invalid date';
      }
      
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    } catch (error) {
      console.error('Date formatting error:', error, 'for date:', date);
      return 'Date error';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    const level = priorityLevels.find(p => p.value === priority);
    return level ? level.color : 'text-gray-600';
  };

  const filteredIssues = filterStatus === 'all' 
    ? issues 
    : issues.filter(issue => issue.status === filterStatus);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Issue Reporting</h2>
          <p className="text-gray-600">Report and track community issues</p>
        </div>
        <button
          onClick={() => setShowReportForm(true)}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Report Issue
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center space-x-4">
        <Filter className="w-5 h-5 text-gray-400" />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Report Form Modal */}
      {showReportForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Report an Issue</h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Issue Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Brief description of the issue"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      required
                    >
                      <option value="">Select category</option>
                      {issueCategories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority *
                    </label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      {priorityLevels.map(level => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Building, floor, or area"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Detailed description of the issue..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Photos (Optional)
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                      disabled={loading}
                    />
                    <label
                      htmlFor="image-upload"
                      className="cursor-pointer text-blue-600 hover:text-blue-700"
                    >
                      Click to upload photos
                    </label>
                    {formData.images.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm text-green-600">
                          {formData.images.length} image(s) uploaded
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowReportForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 transition"
                  >
                    {loading ? 'Reporting...' : 'Report Issue'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Issues List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Your Reported Issues</h3>
        </div>

        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No issues found</p>
            <p className="text-sm">
              {filterStatus === 'all' ? 'Report your first issue to get started' : `No ${filterStatus} issues`}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredIssues.map((issue) => (
              <div key={issue.id} className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{issue.title}</h4>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(issue.status)}`}>
                        {issue.status}
                      </span>
                      <span className={`text-sm font-medium ${getPriorityColor(issue.priority)}`}>
                        {issue.priority} priority
                      </span>
                      <span className="text-sm text-gray-500">{issue.category}</span>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {formatDate(issue.createdAt)}
                    </div>
                  </div>
                </div>
                
                <p className="text-gray-600 mb-3">{issue.description}</p>
                
                {issue.location && (
                  <p className="text-sm text-gray-500 mb-3">
                    📍 {issue.location}
                  </p>
                )}

                {issue.adminNotes && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 mb-1">Admin Response:</p>
                    <p className="text-sm text-blue-700">{issue.adminNotes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IssueReporting;