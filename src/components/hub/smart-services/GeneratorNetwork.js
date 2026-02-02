'use client';
import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Clock, 
  Users, 
  DollarSign, 
  Plus, 
  Calendar,
  Battery,
  Fuel,
  AlertTriangle,
  CheckCircle,
  UserPlus,
  UserMinus,
  Settings
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const GeneratorNetwork = ({ communityId }) => {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  
  // Power status tracking
  const [powerStatus, setPowerStatus] = useState('unknown'); // 'on', 'off', 'unknown'
  const [lastOutage, setLastOutage] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updatedBy, setUpdatedBy] = useState(null);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduledAt: '',
    duration: 4, // hours
    maxParticipants: 10,
    estimatedFuelCost: 0,
    generatorCapacity: '',
    location: ''
  });

  useEffect(() => {
    if (communityId) {
      loadGeneratorServices();
      loadPowerStatus();
    }
  }, [communityId]);

  const loadGeneratorServices = async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/smart-services?communityId=${communityId}&type=generator`);
      const result = await response.json();

      if (result.success) {
        setServices(result.data);
      } else {
        toast.error('Failed to load generator services');
      }
    } catch (error) {
      console.error('Error loading generator services:', error);
      toast.error('Error loading generator services');
    } finally {
      setLoading(false);
    }
  };

  const loadPowerStatus = async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/power-status?communityId=${communityId}`);
      const result = await response.json();

      if (result.success && result.data) {
        setPowerStatus(result.data.status);
        setLastUpdate(result.data.lastUpdate ? new Date(result.data.lastUpdate) : null);
        setUpdatedBy(result.data.updatedBy);
        if (result.data.lastOutage) {
          setLastOutage(new Date(result.data.lastOutage));
        }
      }
    } catch (error) {
      console.error('Error loading power status:', error);
    }
  };

  const updatePowerStatus = async (newStatus) => {
    if (!user) {
      toast.error('Please log in to update power status');
      return;
    }

    try {
      const statusData = {
        communityId,
        status: newStatus,
        updatedBy: user.displayName || user.email,
        updatedById: user.uid,
        lastUpdate: new Date().toISOString()
      };

      if (newStatus === 'off') {
        statusData.lastOutage = new Date().toISOString();
      }

      const response = await authenticatedFetch('/api/hub/power-status', {
        method: 'POST',
        body: JSON.stringify(statusData),
      });

      const result = await response.json();
      
      if (result.success) {
        setPowerStatus(newStatus);
        setLastUpdate(new Date());
        setUpdatedBy(user.displayName || user.email);
        setShowStatusUpdate(false);
        
        if (newStatus === 'off') {
          setLastOutage(new Date());
        }
        
        toast.success(`Power status updated to: ${newStatus.toUpperCase()}`);
      } else {
        toast.error('Failed to update power status');
      }
    } catch (error) {
      console.error('Error updating power status:', error);
      toast.error('Error updating power status');
    }
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please log in to create generator service');
      return;
    }

    try {
      const serviceData = {
        communityId,
        type: 'generator',
        title: formData.title || 'Generator Sharing Session',
        description: formData.description,
        requesterUserId: user.uid,
        requesterName: user.displayName || user.email,
        requesterContact: user.phoneNumber || user.email,
        scheduledAt: formData.scheduledAt,
        maxParticipants: formData.maxParticipants,
        estimatedCost: formData.estimatedFuelCost,
        costPerParticipant: formData.estimatedFuelCost / formData.maxParticipants,
        metadata: {
          duration: formData.duration,
          generatorCapacity: formData.generatorCapacity,
          location: formData.location,
          fuelType: 'petrol' // default
        }
      };

      const response = await authenticatedFetch('/api/hub/smart-services', {
        method: 'POST',
        body: JSON.stringify(serviceData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Generator sharing session created!');
        setShowCreateForm(false);
        setFormData({
          title: '',
          description: '',
          scheduledAt: '',
          duration: 4,
          maxParticipants: 10,
          estimatedFuelCost: 0,
          generatorCapacity: '',
          location: ''
        });
        loadGeneratorServices();
      } else {
        toast.error(result.error || 'Failed to create generator service');
      }
    } catch (error) {
      console.error('Error creating generator service:', error);
      toast.error('Error creating generator service');
    }
  };

  const handleJoinService = async (serviceId) => {
    if (!user) {
      toast.error('Please log in to join generator sharing');
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
        toast.success('Successfully joined generator sharing!');
        loadGeneratorServices();
      } else {
        toast.error(result.error || 'Failed to join generator sharing');
      }
    } catch (error) {
      console.error('Error joining generator service:', error);
      toast.error('Error joining generator service');
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
        toast.success('Left generator sharing session');
        loadGeneratorServices();
      } else {
        toast.error(result.error || 'Failed to leave generator sharing');
      }
    } catch (error) {
      console.error('Error leaving generator service:', error);
      toast.error('Error leaving generator service');
    }
  };

  const getPowerStatusColor = () => {
    switch (powerStatus) {
      case 'on': return 'text-green-600 bg-green-100';
      case 'off': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
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
      {/* Power Status Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${getPowerStatusColor()}`}>
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Community Power Status</h3>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  NEPA Grid: <span className="font-medium capitalize">{powerStatus}</span>
                  {lastOutage && powerStatus === 'off' && (
                    <span className="ml-2 text-red-600">
                      (Outage since {lastOutage.toLocaleTimeString()})
                    </span>
                  )}
                </p>
                {lastUpdate && updatedBy && (
                  <p className="text-xs text-gray-500">
                    Last updated by {updatedBy} at {lastUpdate.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowStatusUpdate(!showStatusUpdate)}
              className="px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
            >
              Update Status
            </button>
            <button
              onClick={loadPowerStatus}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Status Update Form */}
        {showStatusUpdate && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Update Community Power Status</h4>
            <div className="flex space-x-3">
              <button
                onClick={() => updatePowerStatus('on')}
                className="flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Power ON</span>
              </button>
              <button
                onClick={() => updatePowerStatus('off')}
                className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Power OFF</span>
              </button>
              <button
                onClick={() => setShowStatusUpdate(false)}
                className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This will update the power status for all community members to see.
            </p>
          </div>
        )}

        {powerStatus === 'off' && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <span className="text-orange-800 font-medium">Power Outage Detected</span>
            </div>
            <p className="text-orange-700 mt-2 text-sm">
              Join or create a generator sharing session to coordinate backup power with your neighbors.
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Generator Sharing Network</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          <span>Create Session</span>
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Create Generator Sharing Session</h3>
          <form onSubmit={handleCreateService} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., Evening Generator Share - Block A"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Generator Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="e.g., House 12, Block A"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                placeholder="Additional details about generator capacity, fuel sharing, etc."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({...formData, scheduledAt: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (hours)
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value)})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={2}>2 hours</option>
                  <option value={4}>4 hours</option>
                  <option value={6}>6 hours</option>
                  <option value={8}>8 hours</option>
                  <option value={12}>12 hours</option>
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
                  min="1"
                  max="20"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Fuel Cost (₦)
                </label>
                <input
                  type="number"
                  value={formData.estimatedFuelCost}
                  onChange={(e) => setFormData({...formData, estimatedFuelCost: parseFloat(e.target.value) || 0})}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {formData.estimatedFuelCost > 0 && formData.maxParticipants > 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    ₦{(formData.estimatedFuelCost / formData.maxParticipants).toFixed(0)} per person
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Generator Capacity
                </label>
                <select
                  value={formData.generatorCapacity}
                  onChange={(e) => setFormData({...formData, generatorCapacity: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select capacity</option>
                  <option value="1-3kVA">1-3 kVA (Small homes)</option>
                  <option value="3-5kVA">3-5 kVA (Medium homes)</option>
                  <option value="5-10kVA">5-10 kVA (Large homes)</option>
                  <option value="10kVA+">10+ kVA (Commercial)</option>
                </select>
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                Create Generator Session
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Services */}
      <div className="space-y-4">
        {services.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Battery className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Generator Sessions</h3>
            <p className="text-gray-600 mb-4">
              Create or join generator sharing sessions to coordinate backup power with neighbors.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Create First Session
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
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span>{service.metadata?.duration || 4}h duration</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span>{service.currentParticipants}/{service.maxParticipants} joined</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-gray-500" />
                        <span>₦{service.costPerParticipant.toFixed(0)}/person</span>
                      </div>
                    </div>

                    {service.metadata?.location && (
                      <div className="mt-2 text-sm text-gray-600">
                        <strong>Location:</strong> {service.metadata.location}
                      </div>
                    )}

                    {service.metadata?.generatorCapacity && (
                      <div className="mt-1 text-sm text-gray-600">
                        <strong>Capacity:</strong> {service.metadata.generatorCapacity}
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
                          className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
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
                      <span>Join Session</span>
                    </button>
                  )}
                  
                  {isParticipant && !isCreator && (
                    <button
                      onClick={() => handleLeaveService(service.id)}
                      className="flex items-center space-x-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200"
                    >
                      <UserMinus className="w-4 h-4" />
                      <span>Leave Session</span>
                    </button>
                  )}

                  {isCreator && (
                    <div className="flex items-center space-x-2 text-blue-600">
                      <Settings className="w-4 h-4" />
                      <span className="text-sm font-medium">You created this session</span>
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

export default GeneratorNetwork;