'use client';
import React, { useState, useEffect } from 'react';
import { 
  Droplets, 
  Truck, 
  Users, 
  DollarSign, 
  Plus, 
  Calendar,
  MapPin,
  CheckCircle,
  UserPlus,
  UserMinus,
  Settings,
  Star,
  Phone,
  Clock
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const WaterScheduling = ({ communityId }) => {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduledAt: '',
    maxParticipants: 15,
    estimatedCost: 0,
    deliveryLocation: '',
    tankSize: 'mixed', // single size or mixed
    waterType: 'borehole' // borehole, treated, sachet-refill
  });

  // Mock water vendors data (in real app, this would come from a database)
  const mockVendors = [
    {
      id: 'v1',
      name: 'Pure Water Lagos',
      rating: 4.5,
      reviewCount: 127,
      phone: '08012345678',
      pricePerTruck: 15000,
      tankCapacity: 10000, // liters
      waterTypes: ['borehole', 'treated'],
      availability: ['morning', 'afternoon'],
      isVerified: true
    },
    {
      id: 'v2', 
      name: 'Crystal Clear Water',
      rating: 4.2,
      reviewCount: 89,
      phone: '08098765432',
      pricePerTruck: 18000,
      tankCapacity: 12000,
      waterTypes: ['treated', 'sachet-refill'],
      availability: ['morning', 'afternoon', 'evening'],
      isVerified: true
    },
    {
      id: 'v3',
      name: 'Community Water Co.',
      rating: 4.0,
      reviewCount: 56,
      phone: '08055443322',
      pricePerTruck: 12000,
      tankCapacity: 8000,
      waterTypes: ['borehole'],
      availability: ['morning'],
      isVerified: false
    }
  ];

  useEffect(() => {
    if (communityId) {
      loadWaterServices();
      setVendors(mockVendors);
    }
  }, [communityId]);

  const loadWaterServices = async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/smart-services?communityId=${communityId}&type=water`);
      const result = await response.json();

      if (result.success) {
        setServices(result.data);
      } else {
        toast.error('Failed to load water services');
      }
    } catch (error) {
      console.error('Error loading water services:', error);
      toast.error('Error loading water services');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please log in to create water order');
      return;
    }

    if (!selectedVendor) {
      toast.error('Please select a water vendor');
      return;
    }

    try {
      const vendor = vendors.find(v => v.id === selectedVendor);
      const serviceData = {
        communityId,
        type: 'water',
        title: formData.title || `Bulk Water Order - ${vendor.name}`,
        description: formData.description,
        requesterUserId: user.uid,
        requesterName: user.displayName || user.email,
        requesterContact: user.phoneNumber || user.email,
        scheduledAt: formData.scheduledAt,
        maxParticipants: formData.maxParticipants,
        estimatedCost: formData.estimatedCost || vendor.pricePerTruck,
        costPerParticipant: (formData.estimatedCost || vendor.pricePerTruck) / formData.maxParticipants,
        metadata: {
          vendorId: vendor.id,
          vendorName: vendor.name,
          vendorPhone: vendor.phone,
          deliveryLocation: formData.deliveryLocation,
          tankSize: formData.tankSize,
          waterType: formData.waterType,
          tankCapacity: vendor.tankCapacity,
          trucksNeeded: 1 // Can be calculated based on participants
        }
      };

      const response = await authenticatedFetch('/api/hub/smart-services', {
        method: 'POST',
        body: JSON.stringify(serviceData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Water order created!');
        setShowCreateForm(false);
        setFormData({
          title: '',
          description: '',
          scheduledAt: '',
          maxParticipants: 15,
          estimatedCost: 0,
          deliveryLocation: '',
          tankSize: 'mixed',
          waterType: 'borehole'
        });
        setSelectedVendor(null);
        loadWaterServices();
      } else {
        toast.error(result.error || 'Failed to create water order');
      }
    } catch (error) {
      console.error('Error creating water service:', error);
      toast.error('Error creating water service');
    }
  };

  const handleJoinService = async (serviceId) => {
    if (!user) {
      toast.error('Please log in to join water order');
      return;
    }

    try {
      const response = await authenticatedFetch('/api/hub/smart-services', {
        method: 'PUT',
        body: JSON.stringify({
          serviceId,
          action: 'join',
          userId: user.uid,
          userName: user.displayName || user.email,
          userContact: user.phoneNumber || user.email
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Successfully joined water order!');
        loadWaterServices();
      } else {
        toast.error(result.error || 'Failed to join water order');
      }
    } catch (error) {
      console.error('Error joining water service:', error);
      toast.error('Error joining water service');
    }
  };

  const handleLeaveService = async (serviceId) => {
    if (!user) return;

    try {
      const response = await authenticatedFetch('/api/hub/smart-services', {
        method: 'PUT',
        body: JSON.stringify({
          serviceId,
          action: 'leave',
          userId: user.uid
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Left water order');
        loadWaterServices();
      } else {
        toast.error(result.error || 'Failed to leave water order');
      }
    } catch (error) {
      console.error('Error leaving water service:', error);
      toast.error('Error leaving water service');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-blue-100 text-blue-600">
              <Droplets className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Community Water Ordering</h3>
              <p className="text-sm text-gray-600">
                Coordinate bulk water deliveries to save costs and ensure quality
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Create Bulk Water Order</h3>
          
          {/* Vendor Selection */}
          <div className="mb-6">
            <h4 className="text-md font-medium mb-3">Select Water Vendor</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {vendors.map((vendor) => (
                <div
                  key={vendor.id}
                  onClick={() => setSelectedVendor(vendor.id)}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedVendor === vendor.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-medium">{vendor.name}</h5>
                    {vendor.isVerified && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-1 mb-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span className="text-sm">{vendor.rating}</span>
                    <span className="text-xs text-gray-500">({vendor.reviewCount})</span>
                  </div>
                  
                  <div className="text-sm space-y-1">
                    <div className="flex items-center space-x-1">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      <span>₦{vendor.pricePerTruck.toLocaleString()}/truck</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Truck className="w-4 h-4 text-gray-500" />
                      <span>{vendor.tankCapacity.toLocaleString()}L capacity</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <span>{vendor.phone}</span>
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <div className="flex flex-wrap gap-1">
                      {vendor.waterTypes.map((type) => (
                        <span
                          key={type}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreateService} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., Weekend Water Delivery - Block B"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Location
                </label>
                <input
                  type="text"
                  value={formData.deliveryLocation}
                  onChange={(e) => setFormData({...formData, deliveryLocation: e.target.value})}
                  placeholder="e.g., Block B Central Area"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Additional details about the water order..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({...formData, scheduledAt: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Water Type
                </label>
                <select
                  value={formData.waterType}
                  onChange={(e) => setFormData({...formData, waterType: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="borehole">Borehole Water</option>
                  <option value="treated">Treated Water</option>
                  <option value="sachet-refill">Sachet Water Refill</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Participants
                </label>
                <input
                  type="number"
                  value={formData.maxParticipants}
                  onChange={(e) => setFormData({...formData, maxParticipants: parseInt(e.target.value)})}
                  min="3"
                  max="30"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Cost (₦) - Optional
                </label>
                <input
                  type="number"
                  value={formData.estimatedCost}
                  onChange={(e) => setFormData({...formData, estimatedCost: parseFloat(e.target.value) || 0})}
                  placeholder={selectedVendor ? `Default: ₦${vendors.find(v => v.id === selectedVendor)?.pricePerTruck || 0}` : "0"}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tank Size Preference
                </label>
                <select
                  value={formData.tankSize}
                  onChange={(e) => setFormData({...formData, tankSize: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="mixed">Mixed Sizes (Flexible)</option>
                  <option value="1000L">1000L Tanks Only</option>
                  <option value="2000L">2000L Tanks Only</option>
                  <option value="5000L">5000L Tanks Only</option>
                </select>
              </div>
            </div>

            {selectedVendor && formData.maxParticipants > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm">
                  <div className="font-medium text-blue-800 mb-2">Cost Breakdown:</div>
                  <div className="grid grid-cols-2 gap-4 text-blue-700">
                    <div>Total Cost: ₦{(formData.estimatedCost || vendors.find(v => v.id === selectedVendor)?.pricePerTruck || 0).toLocaleString()}</div>
                    <div>Cost per Person: ₦{Math.ceil((formData.estimatedCost || vendors.find(v => v.id === selectedVendor)?.pricePerTruck || 0) / formData.maxParticipants).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                disabled={!selectedVendor}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Create Water Order
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setSelectedVendor(null);
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Water Orders */}
      <div className="space-y-4">
        {services.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Water Orders</h3>
            <p className="text-gray-600 mb-4">
              Create or join bulk water orders to save money and coordinate deliveries.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Create First Order
            </button>
          </div>
        ) : (
          services.map((service) => {
            const isParticipant = service.participants.some(p => p.userId === user?.uid);
            const isCreator = service.requesterUserId === user?.uid;
            const scheduledDate = service.scheduledAt ? new Date(service.scheduledAt) : null;
            const isUpcoming = scheduledDate && scheduledDate > new Date();
            const isActive = service.status === 'in-progress';
            
            return (
              <div key={service.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold">{service.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        isActive ? 'bg-green-100 text-green-800' :
                        isUpcoming ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {service.status}
                      </span>
                    </div>
                    {service.description && (
                      <p className="text-gray-600 mb-3">{service.description}</p>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span>
                          {scheduledDate ? 
                            scheduledDate.toLocaleString() : 
                            'No schedule set'
                          }
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span>{service.currentParticipants}/{service.maxParticipants} joined</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-gray-500" />
                        <span>₦{service.costPerParticipant.toFixed(0)}/person</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Droplets className="w-4 h-4 text-gray-500" />
                        <span>{service.metadata?.waterType || 'Standard'}</span>
                      </div>
                    </div>

                    {service.metadata && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                        {service.metadata.vendorName && (
                          <div><strong>Vendor:</strong> {service.metadata.vendorName}</div>
                        )}
                        {service.metadata.deliveryLocation && (
                          <div><strong>Location:</strong> {service.metadata.deliveryLocation}</div>
                        )}
                        {service.metadata.tankCapacity && (
                          <div><strong>Tank:</strong> {service.metadata.tankCapacity.toLocaleString()}L capacity</div>
                        )}
                        {service.metadata.vendorPhone && (
                          <div className="flex items-center space-x-1">
                            <strong>Contact:</strong> 
                            <a 
                              href={`tel:${service.metadata.vendorPhone}`}
                              className="text-blue-600 hover:underline"
                            >
                              {service.metadata.vendorPhone}
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Participants */}
                {service.participants.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Participants:</h4>
                    <div className="flex flex-wrap gap-2">
                      {service.participants.map((participant, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                        >
                          {participant.userName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-3 pt-4 border-t border-gray-200">
                  {!isParticipant && !isCreator && service.status === 'open' && (
                    <button
                      onClick={() => handleJoinService(service.id)}
                      className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Join Order</span>
                    </button>
                  )}
                  
                  {isParticipant && !isCreator && (
                    <button
                      onClick={() => handleLeaveService(service.id)}
                      className="flex items-center space-x-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200"
                    >
                      <UserMinus className="w-4 h-4" />
                      <span>Leave Order</span>
                    </button>
                  )}

                  {isCreator && (
                    <div className="flex items-center space-x-2 text-blue-600">
                      <Settings className="w-4 h-4" />
                      <span className="text-sm font-medium">You created this order</span>
                    </div>
                  )}

                  <div className="flex-1 text-right text-sm text-gray-500">
                    Created by {service.requesterName}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WaterScheduling;