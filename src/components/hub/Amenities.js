'use client';
import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Plus,
  CheckCircle,
  XCircle,
  RefreshCw,
  Info,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const Amenities = ({ communityId: propCommunityId }) => {
  const { user } = useAuth();
  const [amenities, setAmenities] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState(null);
  const [currentCommunity, setCurrentCommunity] = useState(propCommunityId || null);
  const [bookingData, setBookingData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    purpose: '',
    guestCount: 1,
    notes: ''
  });

  // Get current community from localStorage or user memberships
  useEffect(() => {
    const loadCommunity = async () => {
      if (propCommunityId) {
        setCurrentCommunity(propCommunityId);
        return;
      }

      if (user) {
        try {
          // Check localStorage first
          const stored = localStorage.getItem('hubCurrentCommunity');
          if (stored) {
            setCurrentCommunity(stored);
            return;
          }

          // Get user's communities to find primary community
          const response = await authenticatedFetch(`/api/hub/communities?type=user&userId=${user.uid}`);
          const result = await response.json();

          if (response.ok && result.communities?.length > 0) {
            const primaryCommunity = result.communities.find(c => c.role === 'admin') || result.communities[0];
            setCurrentCommunity(primaryCommunity.id);
          }
        } catch (error) {
          console.error('Error loading community:', error);
        }
      }
    };

    loadCommunity();
  }, [user, propCommunityId]);

  useEffect(() => {
    if (currentCommunity) {
      loadAmenities();
      if (user) {
        loadUserBookings();
      }
    }
  }, [currentCommunity, user]);

  const loadAmenities = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/amenities?communityId=${currentCommunity}`);
      const result = await response.json();

      if (response.ok) {
        setAmenities(result.amenities || []);
      }
    } catch (error) {
      console.error('Error loading amenities:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserBookings = async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/amenities?action=bookings&userId=${user.uid}&communityId=${currentCommunity}`);
      const result = await response.json();

      if (response.ok) {
        setBookings(result.bookings || []);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  };

  const handleBookAmenity = (amenity) => {
    setSelectedAmenity(amenity);
    setShowBookingModal(true);
    setBookingData({
      date: '',
      startTime: '',
      endTime: '',
      purpose: '',
      guestCount: 1,
      notes: ''
    });
  };

  const handleInputChange = (e) => {
    setBookingData({
      ...bookingData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const bookingDateTime = new Date(`${bookingData.date}T${bookingData.startTime}`);
      const endDateTime = new Date(`${bookingData.date}T${bookingData.endTime}`);

      if (endDateTime <= bookingDateTime) {
        throw new Error('End time must be after start time');
      }

      const response = await authenticatedFetch(`/api/hub/amenities?userId=${user.uid}`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_booking',
          amenityId: selectedAmenity.id,
          amenityName: selectedAmenity.name,
          userId: user.uid,
          communityId: currentCommunity,
          userName: user.displayName || user.email,
          userEmail: user.email,
          bookingDate: bookingDateTime,
          startTime: bookingDateTime,
          endTime: endDateTime,
          purpose: bookingData.purpose,
          guestCount: parseInt(bookingData.guestCount),
          notes: bookingData.notes
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('✅ Amenity booked successfully!', {
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

        setShowBookingModal(false);
        setSelectedAmenity(null);
        loadUserBookings();
      } else {
        throw new Error(result.error || 'Failed to book amenity');
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

  const cancelBooking = async (bookingId) => {
    try {
      const response = await authenticatedFetch(`/api/hub/amenities?userId=${user.uid}`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'cancel_booking',
          bookingId
        })
      });

      if (response.ok) {
        toast.success('✅ Booking cancelled successfully!');
        loadUserBookings();
      } else {
        throw new Error('Failed to cancel booking');
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const createSampleAmenities = async () => {
    setLoading(true);
    
    const sampleAmenities = [
      {
        name: "Swimming Pool",
        description: "Olympic-sized swimming pool with lifeguard on duty during operating hours",
        location: "Pool Area, Building A",
        capacity: 50,
        rules: "No diving in shallow end. Children under 12 must be supervised. Pool hours: 6 AM - 10 PM daily.",
        operatingHours: "6:00 AM - 10:00 PM",
        maxBookingHours: 2,
        requiresApproval: false
      },
      {
        name: "Clubhouse",
        description: "Multi-purpose community hall perfect for events, meetings, and celebrations",
        location: "Ground Floor, Community Center",
        capacity: 100,
        rules: "Clean up after use. No smoking indoors. Music must end by 11 PM on weekdays, 12 AM on weekends.",
        operatingHours: "8:00 AM - 12:00 AM",
        maxBookingHours: 6,
        requiresApproval: true
      },
      {
        name: "Fitness Center",
        description: "Fully equipped gym with cardio machines, weights, and exercise area",
        location: "2nd Floor, Community Center",
        capacity: 25,
        rules: "Wipe down equipment after use. Proper gym attire required. No dropping weights.",
        operatingHours: "5:00 AM - 11:00 PM",
        maxBookingHours: 2,
        requiresApproval: false
      },
      {
        name: "Tennis Court",
        description: "Professional tennis court with lighting for evening play",
        location: "Sports Complex, Court 1",
        capacity: 4,
        rules: "Non-marking tennis shoes only. Book in 1-hour slots. Court fee applies.",
        operatingHours: "6:00 AM - 10:00 PM",
        maxBookingHours: 2,
        requiresApproval: false
      },
      {
        name: "BBQ Area",
        description: "Outdoor barbecue area with grills, tables, and seating for gatherings",
        location: "Garden Area, Near Pool",
        capacity: 30,
        rules: "Clean grills after use. Dispose of charcoal properly. No glass containers allowed.",
        operatingHours: "8:00 AM - 10:00 PM",
        maxBookingHours: 4,
        requiresApproval: false
      }
    ];

    try {
      for (const amenity of sampleAmenities) {
        const response = await authenticatedFetch(`/api/hub/amenities?userId=${user.uid}`, {
          method: 'POST',
          body: JSON.stringify({
            action: 'create_amenity',
            communityId: currentCommunity,
            ...amenity,
            createdBy: user.uid,
            createdByName: user.displayName || user.email,
            isActive: true,
            fee: 0,
            images: []
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to create ${amenity.name}`);
        }
      }

      toast.success('✅ Sample amenities created successfully!', {
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

      // Reload amenities to show the new ones
      loadAmenities();
    } catch (error) {
      toast.error(`❌ Failed to create amenities: ${error.message}`, {
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

  // Show loading or no community message
  if (!currentCommunity) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Loading community...</p>
          <p className="text-sm text-gray-400 mt-1">Please wait while we load your community information</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Community Amenities</h2>
          <p className="text-gray-600">Book and manage facility reservations</p>
        </div>
        <button
          onClick={loadUserBookings}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Available Amenities */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Available Amenities</h3>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : amenities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No amenities available</p>
            <p className="text-sm text-gray-400 mt-1">Community amenities need to be set up by an administrator</p>
            
            <div className="mt-6 p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg max-w-lg mx-auto">
              <h4 className="font-medium text-gray-900 mb-3">🏢 Admin Required</h4>
              <p className="text-sm text-gray-600 mb-4">Community administrators can create amenities through the Admin Panel</p>
              
              <div className="text-left">
                <p className="text-xs text-gray-500 mb-2">Common amenities include:</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>🏊‍♂️ Swimming Pool</li>
                  <li>🏢 Clubhouse/Community Hall</li>
                  <li>💪 Fitness Center</li>
                  <li>🎾 Tennis/Basketball Court</li>
                  <li>🔥 BBQ/Picnic Area</li>
                  <li>🎮 Game Room</li>
                  <li>📚 Study Room</li>
                </ul>
                <p className="text-xs text-gray-500 mt-3">
                  Contact your community administrator to add these facilities.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {amenities.map((amenity) => (
              <div key={amenity.id} className="bg-white rounded-lg shadow hover:shadow-lg transition">
                {/* Amenity Image Placeholder */}
                <div className="h-40 bg-gradient-to-br from-purple-100 to-blue-100 rounded-t-lg flex items-center justify-center">
                  <Calendar className="w-12 h-12 text-purple-600" />
                </div>
                
                <div className="p-4">
                  <h4 className="font-semibold text-gray-900 text-lg mb-2">{amenity.name}</h4>
                  
                  {amenity.description && (
                    <p className="text-gray-600 text-sm mb-3">{amenity.description}</p>
                  )}
                  
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    {amenity.capacity && (
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-2" />
                        Capacity: {amenity.capacity} people
                      </div>
                    )}
                    {amenity.location && (
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-2" />
                        {amenity.location}
                      </div>
                    )}
                    {amenity.operatingHours && (
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        {amenity.operatingHours}
                      </div>
                    )}
                  </div>
                  
                  {amenity.rules && (
                    <div className="bg-gray-50 p-3 rounded-md mb-4">
                      <div className="flex items-start">
                        <Info className="w-4 h-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-700">{amenity.rules}</p>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => handleBookAmenity(amenity)}
                    className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition flex items-center justify-center"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Book Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {showBookingModal && selectedAmenity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Book {selectedAmenity.name}
              </h3>
              
              <form onSubmit={handleSubmitBooking} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={bookingData.date}
                    onChange={handleInputChange}
                    min={getTodayDate()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time *
                    </label>
                    <input
                      type="time"
                      name="startTime"
                      value={bookingData.startTime}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time *
                    </label>
                    <input
                      type="time"
                      name="endTime"
                      value={bookingData.endTime}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Guests
                  </label>
                  <input
                    type="number"
                    name="guestCount"
                    value={bookingData.guestCount}
                    onChange={handleInputChange}
                    min="1"
                    max={selectedAmenity.capacity || 100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purpose
                  </label>
                  <input
                    type="text"
                    name="purpose"
                    value={bookingData.purpose}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Birthday party, Meeting"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    name="notes"
                    value={bookingData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Any special requirements..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowBookingModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 transition"
                  >
                    {loading ? 'Booking...' : 'Confirm Booking'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* User Bookings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Your Bookings</h3>
        
        {bookings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No bookings found</p>
            <p className="text-sm">Book an amenity to see your reservations here</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <div className="divide-y">
              {bookings.map((booking) => (
                <div key={booking.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h5 className="font-medium text-gray-900">{booking.amenityName}</h5>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(booking.status)}`}>
                          {booking.status}
                        </span>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2" />
                          {formatDate(booking.startTime)} - {new Date(booking.endTime.toDate ? booking.endTime.toDate() : booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {booking.purpose && (
                          <div className="flex items-center">
                            <Info className="w-4 h-4 mr-2" />
                            {booking.purpose}
                          </div>
                        )}
                        {booking.guestCount > 1 && (
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-2" />
                            {booking.guestCount} guests
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {booking.status === 'confirmed' && new Date(booking.bookingDate.toDate ? booking.bookingDate.toDate() : booking.bookingDate) > new Date() && (
                      <button
                        onClick={() => cancelBooking(booking.id)}
                        className="ml-4 px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Amenities;