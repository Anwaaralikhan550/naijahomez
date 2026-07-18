'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  Plus, 
  Edit, 
  Trash2, 
  Clock, 
  Users, 
  Settings,
  MapPin,
  CheckCircle,
  XCircle,
  Filter,
  Search,
  Eye
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const AmenityManagement = ({ communityId }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('amenities');
  const [amenities, setAmenities] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAmenityForm, setShowAmenityForm] = useState(false);
  const [editingAmenity, setEditingAmenity] = useState(null);
  const [amenityData, setAmenityData] = useState({
    name: '',
    description: '',
    location: '',
    capacity: '',
    rules: '',
    availableHours: {
      start: '08:00',
      end: '22:00'
    },
    bookingAdvanceDays: 7,
    maxBookingHours: 4,
    requiresApproval: false,
    isActive: true,
    fee: '',
    images: []
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadAmenities = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/amenities?communityId=${communityId}&admin=true`);
      const result = await response.json();

      if (response.ok) {
        setAmenities(result.amenities || []);
      }
    } catch (error) {
      console.error('Error loading amenities:', error);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  const loadBookings = useCallback(async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/amenity-bookings?communityId=${communityId}&admin=true`);
      const result = await response.json();

      if (response.ok) {
        setBookings(result.bookings || []);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  }, [communityId]);

  useEffect(() => {
    if (communityId) {
      loadAmenities();
      loadBookings();
    }
  }, [communityId, loadAmenities, loadBookings]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('availableHours.')) {
      const field = name.split('.')[1];
      setAmenityData({
        ...amenityData,
        availableHours: {
          ...amenityData.availableHours,
          [field]: value
        }
      });
    } else {
      setAmenityData({
        ...amenityData,
        [name]: type === 'checkbox' ? checked : value
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!amenityData.name.trim()) {
      toast.error('Amenity name is required');
      return;
    }

    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/hub/amenities', {
        method: 'POST',
        body: JSON.stringify({
          action: editingAmenity ? 'update_amenity' : 'create_amenity',
          amenityId: editingAmenity?.id,
          communityId,
          ...amenityData,
          capacity: amenityData.capacity ? parseInt(amenityData.capacity) : null,
          bookingAdvanceDays: parseInt(amenityData.bookingAdvanceDays),
          maxBookingHours: parseInt(amenityData.maxBookingHours),
          fee: amenityData.fee ? parseFloat(amenityData.fee) : 0,
          createdBy: user.uid,
          createdByName: user.displayName || user.email
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(`✅ Amenity ${editingAmenity ? 'updated' : 'created'} successfully!`);
        
        // Reset form
        setAmenityData({
          name: '',
          description: '',
          location: '',
          capacity: '',
          rules: '',
          availableHours: { start: '08:00', end: '22:00' },
          bookingAdvanceDays: 7,
          maxBookingHours: 4,
          requiresApproval: false,
          isActive: true,
          fee: '',
          images: []
        });
        setShowAmenityForm(false);
        setEditingAmenity(null);
        loadAmenities();
      } else {
        throw new Error(result.error || `Failed to ${editingAmenity ? 'update' : 'create'} amenity`);
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const editAmenity = (amenity) => {
    setEditingAmenity(amenity);
    setAmenityData({
      name: amenity.name || '',
      description: amenity.description || '',
      location: amenity.location || '',
      capacity: amenity.capacity?.toString() || '',
      rules: amenity.rules || '',
      availableHours: amenity.availableHours || { start: '08:00', end: '22:00' },
      bookingAdvanceDays: amenity.bookingAdvanceDays || 7,
      maxBookingHours: amenity.maxBookingHours || 4,
      requiresApproval: amenity.requiresApproval || false,
      isActive: amenity.isActive !== false,
      fee: amenity.fee?.toString() || '',
      images: amenity.images || []
    });
    setShowAmenityForm(true);
  };

  const deleteAmenity = async (amenityId) => {
    if (!confirm('Are you sure you want to delete this amenity?')) return;

    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/hub/amenities', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete_amenity',
          amenityId
        })
      });

      if (response.ok) {
        toast.success('✅ Amenity deleted successfully');
        loadAmenities();
      } else {
        throw new Error('Failed to delete amenity');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId, status) => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/hub/amenity-bookings', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update_booking_status',
          bookingId,
          status,
          adminId: user.uid
        })
      });

      if (response.ok) {
        toast.success(`✅ Booking ${status}!`);
        loadBookings();
      } else {
        throw new Error('Failed to update booking');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = booking.amenityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.bookerName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Amenity Management</h3>
          <p className="text-gray-600">Manage community amenities and bookings</p>
        </div>
        <button
          onClick={() => {
            setEditingAmenity(null);
            setAmenityData({
              name: '',
              description: '',
              location: '',
              capacity: '',
              rules: '',
              availableHours: { start: '08:00', end: '22:00' },
              bookingAdvanceDays: 7,
              maxBookingHours: 4,
              requiresApproval: false,
              isActive: true,
              fee: '',
              images: []
            });
            setShowAmenityForm(true);
          }}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Amenity
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('amenities')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'amenities'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Amenities ({amenities.length})
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'bookings'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar className="w-4 h-4 inline mr-2" />
            Bookings ({bookings.length})
          </button>
        </nav>
      </div>

      {/* Amenities Tab */}
      {activeTab === 'amenities' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-purple-600">{amenities.length}</div>
              <div className="text-sm text-gray-600">Total Amenities</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-green-600">{amenities.filter(a => a.isActive).length}</div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-yellow-600">{bookings.filter(b => b.status === 'pending').length}</div>
              <div className="text-sm text-gray-600">Pending Bookings</div>
            </div>
          </div>

          {/* Amenities List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h4 className="text-lg font-semibold text-gray-900">Community Amenities</h4>
            </div>

            {amenities.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No amenities created yet</p>
                <p className="text-sm text-gray-400 mt-1">Create your first amenity to get started</p>
              </div>
            ) : (
              <div className="divide-y">
                {amenities.map((amenity) => (
                  <div key={amenity.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h5 className="font-medium text-gray-900">{amenity.name}</h5>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            amenity.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {amenity.isActive ? 'Active' : 'Inactive'}
                          </span>
                          {amenity.requiresApproval && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                              Requires Approval
                            </span>
                          )}
                        </div>
                        
                        <p className="text-gray-600 mb-3">{amenity.description}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          {amenity.location && (
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1" />
                              {amenity.location}
                            </div>
                          )}
                          {amenity.capacity && (
                            <div className="flex items-center">
                              <Users className="w-4 h-4 mr-1" />
                              {amenity.capacity} people
                            </div>
                          )}
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {amenity.availableHours?.start} - {amenity.availableHours?.end}
                          </div>
                          {amenity.fee > 0 && (
                            <div>
                              Fee: ₦{amenity.fee}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={() => editAmenity(amenity)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition flex items-center"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => deleteAmenity(amenity.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition flex items-center"
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

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Search bookings..."
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Bookings List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h4 className="text-lg font-semibold text-gray-900">
                Amenity Bookings ({filteredBookings.length})
              </h4>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No bookings found</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredBookings.map((booking) => (
                  <div key={booking.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h5 className="font-medium text-gray-900">{booking.amenityName}</h5>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(booking.status)}`}>
                            {booking.status}
                          </span>
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600">
                          <div>Booked by: {booking.bookerName}</div>
                          <div>Date: {booking.bookingDate ? new Date(booking.bookingDate.seconds ? booking.bookingDate.seconds * 1000 : booking.bookingDate).toLocaleDateString() : 'N/A'}</div>
                          <div>Time: {booking.startTime} - {booking.endTime}</div>
                          <div>Created: {formatDate(booking.createdAt)}</div>
                          {booking.purpose && <div>Purpose: {booking.purpose}</div>}
                        </div>
                      </div>

                      {booking.status === 'pending' && (
                        <div className="ml-4 flex gap-2">
                          <button
                            onClick={() => updateBookingStatus(booking.id, 'approved')}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition flex items-center"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Approve
                          </button>
                          <button
                            onClick={() => updateBookingStatus(booking.id, 'rejected')}
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
        </div>
      )}

      {/* Amenity Form Modal */}
      {showAmenityForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingAmenity ? 'Edit Amenity' : 'Create New Amenity'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amenity Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={amenityData.name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={amenityData.location}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={amenityData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Capacity (people)
                    </label>
                    <input
                      type="number"
                      name="capacity"
                      value={amenityData.capacity}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Booking Fee (₦)
                    </label>
                    <input
                      type="number"
                      name="fee"
                      value={amenityData.fee}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Hours per Booking
                    </label>
                    <input
                      type="number"
                      name="maxBookingHours"
                      value={amenityData.maxBookingHours}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      min="1"
                      max="24"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Available From
                    </label>
                    <input
                      type="time"
                      name="availableHours.start"
                      value={amenityData.availableHours.start}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Available Until
                    </label>
                    <input
                      type="time"
                      name="availableHours.end"
                      value={amenityData.availableHours.end}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rules & Guidelines
                  </label>
                  <textarea
                    name="rules"
                    value={amenityData.rules}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="List any rules or guidelines for using this amenity..."
                  />
                </div>

                <div className="flex items-center space-x-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="requiresApproval"
                      checked={amenityData.requiresApproval}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    Requires admin approval for bookings
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={amenityData.isActive}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    Active and available for booking
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAmenityForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 transition"
                  >
                    {loading ? 'Saving...' : editingAmenity ? 'Update Amenity' : 'Create Amenity'}
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

export default AmenityManagement;
