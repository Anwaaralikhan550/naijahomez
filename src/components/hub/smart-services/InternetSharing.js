'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wifi, 
  Users, 
  DollarSign, 
  Plus,
  Calendar,
  Settings,
  Zap,
  Signal,
  Router,
  Globe,
  UserPlus,
  UserMinus,
  CheckCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const InternetSharing = ({ communityId }) => {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    ispProvider: '',
    packageType: '',
    speed: '',
    monthlyCost: 0,
    maxParticipants: 10,
    installationCost: 0,
    coverageArea: '',
    contractDuration: 12
  });

  const loadInternetServices = useCallback(async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/smart-services?communityId=${communityId}&type=internet`);
      const result = await response.json();

      if (result.success) {
        setServices(result.data);
      } else {
        toast.error('Failed to load internet sharing services');
      }
    } catch (error) {
      console.error('Error loading internet services:', error);
      toast.error('Error loading internet services');
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    if (communityId) {
      loadInternetServices();
    }
  }, [communityId, loadInternetServices]);

  const handleCreateService = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please log in to create internet sharing plan');
      return;
    }

    try {
      const serviceData = {
        communityId,
        type: 'internet',
        title: formData.title || 'Internet Cost Sharing',
        description: formData.description,
        requesterUserId: user.uid,
        requesterName: user.displayName || user.email,
        requesterContact: user.phoneNumber || user.email,
        scheduledAt: new Date().toISOString(),
        maxParticipants: formData.maxParticipants,
        estimatedCost: formData.monthlyCost + (formData.installationCost / formData.maxParticipants),
        costPerParticipant: (formData.monthlyCost / formData.maxParticipants) + (formData.installationCost / formData.maxParticipants),
        metadata: {
          ispProvider: formData.ispProvider,
          packageType: formData.packageType,
          speed: formData.speed,
          monthlyCost: formData.monthlyCost,
          installationCost: formData.installationCost,
          coverageArea: formData.coverageArea,
          contractDuration: formData.contractDuration,
          serviceType: 'internet_sharing'
        }
      };

      const response = await authenticatedFetch('/api/hub/smart-services', {
        method: 'POST',
        body: JSON.stringify(serviceData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Internet sharing plan created!');
        setShowCreateForm(false);
        setFormData({
          title: '',
          description: '',
          ispProvider: '',
          packageType: '',
          speed: '',
          monthlyCost: 0,
          maxParticipants: 10,
          installationCost: 0,
          coverageArea: '',
          contractDuration: 12
        });
        loadInternetServices();
      } else {
        toast.error(result.error || 'Failed to create internet sharing plan');
      }
    } catch (error) {
      console.error('Error creating internet service:', error);
      toast.error('Error creating internet service');
    }
  };

  const handleJoinService = async (serviceId) => {
    if (!user) {
      toast.error('Please log in to join internet sharing');
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
        toast.success('Successfully joined internet sharing plan!');
        loadInternetServices();
      } else {
        toast.error(result.error || 'Failed to join internet sharing');
      }
    } catch (error) {
      console.error('Error joining internet service:', error);
      toast.error('Error joining internet service');
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
        toast.success('Left internet sharing plan');
        loadInternetServices();
      } else {
        toast.error(result.error || 'Failed to leave internet sharing');
      }
    } catch (error) {
      console.error('Error leaving internet service:', error);
      toast.error('Error leaving internet service');
    }
  };

  const nigerianISPs = [
    'MTN Nigeria',
    'Airtel Nigeria',
    'Glo Mobile',
    '9mobile',
    'Spectranet',
    'Swift Networks',
    'Smile Communications',
    'InterC Networks',
    'Coollink',
    'Other'
  ];

  const packageTypes = [
    'Fiber Optic',
    '4G LTE',
    '5G',
    'Cable Internet',
    'Satellite Internet'
  ];

  const internetSpeeds = [
    '10 Mbps',
    '20 Mbps',
    '50 Mbps',
    '100 Mbps',
    '200 Mbps',
    '500 Mbps',
    '1 Gbps'
  ];

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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Internet Cost Sharing</h2>
          <p className="text-gray-600 text-sm">Share high-speed internet costs with neighbors</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          <span>Create Plan</span>
        </button>
      </div>

      {/* Benefits Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-green-100 rounded-full">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="font-semibold">Save 40-60%</h3>
          </div>
          <p className="text-sm text-gray-600">Significantly reduce your internet costs through bulk purchasing</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-full">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold">Faster Speeds</h3>
          </div>
          <p className="text-sm text-gray-600">Access to high-speed fiber and premium packages</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-full">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-semibold">Community Network</h3>
          </div>
          <p className="text-sm text-gray-600">Reliable connection shared with trusted neighbors</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-orange-100 rounded-full">
              <Settings className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="font-semibold">Professional Setup</h3>
          </div>
          <p className="text-sm text-gray-600">Managed installation and maintenance included</p>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Create Internet Sharing Plan</h3>
          <form onSubmit={handleCreateService} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., Block A Fiber Internet Plan"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                placeholder="Describe the internet plan and any special requirements..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ISP Provider
                </label>
                <select
                  value={formData.ispProvider}
                  onChange={(e) => setFormData({...formData, ispProvider: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select ISP</option>
                  {nigerianISPs.map((isp) => (
                    <option key={isp} value={isp}>{isp}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Connection Type
                </label>
                <select
                  value={formData.packageType}
                  onChange={(e) => setFormData({...formData, packageType: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Type</option>
                  {packageTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Internet Speed
                </label>
                <select
                  value={formData.speed}
                  onChange={(e) => setFormData({...formData, speed: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Speed</option>
                  {internetSpeeds.map((speed) => (
                    <option key={speed} value={speed}>{speed}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Cost (₦)
                </label>
                <input
                  type="number"
                  value={formData.monthlyCost}
                  onChange={(e) => setFormData({...formData, monthlyCost: parseFloat(e.target.value) || 0})}
                  placeholder="Total monthly cost"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Installation Cost (₦)
                </label>
                <input
                  type="number"
                  value={formData.installationCost}
                  onChange={(e) => setFormData({...formData, installationCost: parseFloat(e.target.value) || 0})}
                  placeholder="One-time setup cost"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Participants
                </label>
                <input
                  type="number"
                  value={formData.maxParticipants}
                  onChange={(e) => setFormData({...formData, maxParticipants: parseInt(e.target.value)})}
                  min="2"
                  max="50"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contract Duration (months)
                </label>
                <select
                  value={formData.contractDuration}
                  onChange={(e) => setFormData({...formData, contractDuration: parseInt(e.target.value)})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={6}>6 months</option>
                  <option value={12}>12 months</option>
                  <option value={24}>24 months</option>
                  <option value={36}>36 months</option>
                </select>
              </div>
            </div>

            {formData.monthlyCost > 0 && formData.maxParticipants > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Cost Breakdown</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Monthly per household:</span>
                    <p className="font-semibold text-blue-900">₦{(formData.monthlyCost / formData.maxParticipants).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-blue-700">Installation per household:</span>
                    <p className="font-semibold text-blue-900">₦{(formData.installationCost / formData.maxParticipants).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-blue-700">Total first month:</span>
                    <p className="font-semibold text-blue-900">₦{((formData.monthlyCost + formData.installationCost) / formData.maxParticipants).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                Create Internet Plan
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
            <Wifi className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Internet Plans</h3>
            <p className="text-gray-600 mb-4">
              Create or join internet sharing plans to reduce costs and get better connectivity.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Create First Plan
            </button>
          </div>
        ) : (
          services.map((service) => {
            const isParticipant = service.participants.some(p => p.userId === user?.uid);
            const isCreator = service.requesterUserId === user?.uid;
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
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div className="flex items-center space-x-2">
                        <Globe className="w-4 h-4 text-gray-500" />
                        <span>{service.metadata?.ispProvider || 'ISP TBD'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Signal className="w-4 h-4 text-gray-500" />
                        <span>{service.metadata?.speed || 'Speed TBD'} {service.metadata?.packageType}</span>
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
                      <div className="text-sm text-gray-600 mb-2">
                        <strong>Coverage:</strong> {service.metadata.coverageArea}
                      </div>
                    )}

                    <div className="text-sm text-gray-600">
                      <strong>Contract:</strong> {service.metadata?.contractDuration || 12} months
                      {service.metadata?.installationCost > 0 && (
                        <span className="ml-4">
                          <strong>Setup:</strong> ₦{(service.metadata.installationCost / service.maxParticipants).toLocaleString()} per household
                        </span>
                      )}
                    </div>
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
                      <span>Join Plan</span>
                    </button>
                  )}
                  
                  {isParticipant && !isCreator && (
                    <button
                      onClick={() => handleLeaveService(service.id)}
                      className="flex items-center space-x-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200"
                    >
                      <UserMinus className="w-4 h-4" />
                      <span>Leave Plan</span>
                    </button>
                  )}

                  {isCreator && (
                    <div className="flex items-center space-x-2 text-blue-600">
                      <Settings className="w-4 h-4" />
                      <span className="text-sm font-medium">You organized this plan</span>
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

export default InternetSharing;
