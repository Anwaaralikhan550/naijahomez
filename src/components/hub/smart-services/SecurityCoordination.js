'use client';
import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  Clock, 
  DollarSign, 
  Plus,
  Calendar,
  UserCheck,
  MapPin,
  AlertTriangle,
  UserPlus,
  UserMinus,
  Settings,
  Eye,
  Phone
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const SecurityCoordination = ({ communityId }) => {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    shiftType: 'day', // day, night, 24hours
    maxParticipants: 10,
    estimatedMonthlyCost: 0,
    guardRequirements: '',
    coverageArea: ''
  });

  useEffect(() => {
    if (communityId) {
      loadSecurityServices();
    }
  }, [communityId]);

  const loadSecurityServices = async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/smart-services?communityId=${communityId}&type=security`);
      const result = await response.json();

      if (result.success) {
        setServices(result.data);
      } else {
        toast.error('Failed to load security services');
      }
    } catch (error) {
      console.error('Error loading security services:', error);
      toast.error('Error loading security services');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please log in to create security coordination');
      return;
    }

    try {
      const serviceData = {
        communityId,
        type: 'security',
        title: formData.title || 'Security Guard Coordination',
        description: formData.description,
        requesterUserId: user.uid,
        requesterName: user.displayName || user.email,
        requesterContact: user.phoneNumber || user.email,
        scheduledAt: formData.startDate,
        maxParticipants: formData.maxParticipants,
        estimatedCost: formData.estimatedMonthlyCost,
        costPerParticipant: formData.estimatedMonthlyCost / formData.maxParticipants,
        metadata: {
          endDate: formData.endDate,
          shiftType: formData.shiftType,
          guardRequirements: formData.guardRequirements,
          coverageArea: formData.coverageArea,
          serviceType: 'security_coordination'
        }
      };

      const response = await authenticatedFetch('/api/hub/smart-services', {
        method: 'POST',
        body: JSON.stringify(serviceData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Security coordination created!');
        setShowCreateForm(false);
        setFormData({
          title: '',
          description: '',
          startDate: '',
          endDate: '',
          shiftType: 'day',
          maxParticipants: 10,
          estimatedMonthlyCost: 0,
          guardRequirements: '',
          coverageArea: ''
        });
        loadSecurityServices();
      } else {
        toast.error(result.error || 'Failed to create security coordination');
      }
    } catch (error) {
      console.error('Error creating security service:', error);
      toast.error('Error creating security service');
    }
  };

  const handleJoinService = async (serviceId) => {
    if (!user) {
      toast.error('Please log in to join security coordination');
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
        toast.success('Successfully joined security coordination!');
        loadSecurityServices();
      } else {
        toast.error(result.error || 'Failed to join security coordination');
      }
    } catch (error) {
      console.error('Error joining security service:', error);
      toast.error('Error joining security service');
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
        toast.success('Left security coordination');
        loadSecurityServices();
      } else {
        toast.error(result.error || 'Failed to leave security coordination');
      }
    } catch (error) {
      console.error('Error leaving security service:', error);
      toast.error('Error leaving security service');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Security Guard Coordination</h2>
          <p className="text-gray-600 text-sm">Pool resources to hire shared security services</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
        >
          <Plus className="w-5 h-5" />
          <span>Create Coordination</span>
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Create Security Coordination</h3>
          <form onSubmit={handleCreateService} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coordination Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., Block A Security Guards"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coverage Area
                </label>
                <input
                  type="text"
                  value={formData.coverageArea}
                  onChange={(e) => setFormData({...formData, coverageArea: e.target.value})}
                  placeholder="e.g., Block A, Houses 1-20"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                placeholder="Describe the security needs and coordination details..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shift Type
                </label>
                <select
                  value={formData.shiftType}
                  onChange={(e) => setFormData({...formData, shiftType: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="day">Day Shift (6AM - 6PM)</option>
                  <option value="night">Night Shift (6PM - 6AM)</option>
                  <option value="24hours">24 Hours Coverage</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Cost (₦)
                </label>
                <input
                  type="number"
                  value={formData.estimatedMonthlyCost}
                  onChange={(e) => setFormData({...formData, estimatedMonthlyCost: parseFloat(e.target.value) || 0})}
                  placeholder="Total monthly cost for guards"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {formData.estimatedMonthlyCost > 0 && formData.maxParticipants > 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    ₦{(formData.estimatedMonthlyCost / formData.maxParticipants).toLocaleString()} per household
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Participating Households
                </label>
                <input
                  type="number"
                  value={formData.maxParticipants}
                  onChange={(e) => setFormData({...formData, maxParticipants: parseInt(e.target.value)})}
                  min="2"
                  max="50"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Guard Requirements
              </label>
              <textarea
                value={formData.guardRequirements}
                onChange={(e) => setFormData({...formData, guardRequirements: e.target.value})}
                placeholder="Specify requirements: armed/unarmed, experience level, patrol routes, etc."
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700"
              >
                Create Security Coordination
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
            <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Security Coordination</h3>
            <p className="text-gray-600 mb-4">
              Create or join security coordination to share guard costs with neighbors.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
            >
              Create First Coordination
            </button>
          </div>
        ) : (
          services.map((service) => {
            const isParticipant = service.participants.some(p => p.userId === user?.uid);
            const isCreator = service.requesterUserId === user?.uid;
            const startDate = service.scheduledAt ? new Date(service.scheduledAt) : null;
            const endDate = service.metadata?.endDate ? new Date(service.metadata.endDate) : null;
            const isActive = service.status === 'in-progress';
            
            return (
              <div key={service.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold">{service.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        isActive ? 'bg-green-100 text-green-800' :
                        service.status === 'open' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {service.status}
                      </span>
                    </div>
                    {service.description && (
                      <p className="text-gray-600 mb-3">{service.description}</p>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span>
                          {startDate ? 
                            `${startDate.toLocaleDateString()} - ${endDate?.toLocaleDateString() || 'Ongoing'}` : 
                            'No dates set'
                          }
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="capitalize">{service.metadata?.shiftType || 'Day'} Shift</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span>{service.currentParticipants}/{service.maxParticipants} households</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-gray-500" />
                        <span>₦{service.costPerParticipant.toLocaleString()}/month</span>
                      </div>
                    </div>

                    {service.metadata?.coverageArea && (
                      <div className="mt-2 text-sm text-gray-600">
                        <strong>Coverage:</strong> {service.metadata.coverageArea}
                      </div>
                    )}

                    {service.metadata?.guardRequirements && (
                      <div className="mt-1 text-sm text-gray-600">
                        <strong>Requirements:</strong> {service.metadata.guardRequirements}
                      </div>
                    )}
                  </div>
                </div>

                {/* Participants */}
                {service.participants.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Participating Households:</h4>
                    <div className="flex flex-wrap gap-2">
                      {service.participants.map((participant, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full"
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
                      className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Join Coordination</span>
                    </button>
                  )}
                  
                  {isParticipant && !isCreator && (
                    <button
                      onClick={() => handleLeaveService(service.id)}
                      className="flex items-center space-x-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200"
                    >
                      <UserMinus className="w-4 h-4" />
                      <span>Leave Coordination</span>
                    </button>
                  )}

                  {isCreator && (
                    <div className="flex items-center space-x-2 text-purple-600">
                      <Settings className="w-4 h-4" />
                      <span className="text-sm font-medium">You created this coordination</span>
                    </div>
                  )}

                  <div className="flex-1 text-right text-sm text-gray-500">
                    Organized by {service.requesterName}
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

export default SecurityCoordination;