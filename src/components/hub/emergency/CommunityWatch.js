'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Eye, 
  Users, 
  Clock, 
  Calendar,
  UserCheck,
  Plus,
  MapPin,
  Shield,
  Phone,
  AlertTriangle,
  CheckCircle,
  UserPlus,
  UserMinus,
  Settings
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const CommunityWatch = ({ communityId }) => {
  const { user } = useAuth();
  const [patrols, setPatrols] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreatePatrol, setShowCreatePatrol] = useState(false);
  const [showVolunteerSignup, setShowVolunteerSignup] = useState(false);

  // Form data for creating patrols
  const [patrolForm, setPatrolForm] = useState({
    title: '',
    description: '',
    patrolDate: '',
    startTime: '',
    endTime: '',
    patrolRoute: '',
    maxVolunteers: 4,
    instructions: ''
  });

  // Volunteer signup form
  const [volunteerForm, setVolunteerForm] = useState({
    availability: [],
    phoneNumber: '',
    experience: '',
    preferredShifts: []
  });

  const loadPatrols = useCallback(async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/smart-services?communityId=${communityId}&type=community_watch`);
      const result = await response.json();

      if (result.success) {
        setPatrols(result.data || []);
      }
    } catch (error) {
      console.error('Error loading patrols:', error);
    }
  }, [communityId]);

  const loadVolunteers = useCallback(async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/volunteers?communityId=${communityId}`);
      const result = await response.json();

      if (result.success) {
        setVolunteers(result.data || []);
      }
    } catch (error) {
      console.error('Error loading volunteers:', error);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    if (communityId) {
      loadPatrols();
      loadVolunteers();
    }
  }, [communityId, loadPatrols, loadVolunteers]);

  const createPatrol = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please log in to create patrol schedules');
      return;
    }

    try {
      const patrolDateTime = new Date(`${patrolForm.patrolDate}T${patrolForm.startTime}`);
      
      const patrolData = {
        communityId,
        type: 'community_watch',
        title: patrolForm.title || 'Community Patrol',
        description: patrolForm.description,
        requesterUserId: user.uid,
        requesterName: user.displayName || user.email,
        requesterContact: user.phoneNumber || user.email,
        scheduledAt: patrolDateTime.toISOString(),
        maxParticipants: patrolForm.maxVolunteers,
        estimatedCost: 0,
        costPerParticipant: 0,
        metadata: {
          endTime: patrolForm.endTime,
          patrolRoute: patrolForm.patrolRoute,
          instructions: patrolForm.instructions,
          patrolType: 'scheduled',
          serviceType: 'community_watch'
        }
      };

      const response = await authenticatedFetch('/api/hub/smart-services', {
        method: 'POST',
        body: JSON.stringify(patrolData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Patrol schedule created!');
        setShowCreatePatrol(false);
        setPatrolForm({
          title: '',
          description: '',
          patrolDate: '',
          startTime: '',
          endTime: '',
          patrolRoute: '',
          maxVolunteers: 4,
          instructions: ''
        });
        loadPatrols();
      } else {
        toast.error('Failed to create patrol schedule');
      }
    } catch (error) {
      console.error('Error creating patrol:', error);
      toast.error('Error creating patrol schedule');
    }
  };

  const joinPatrol = async (patrolId) => {
    if (!user) {
      toast.error('Please log in to join patrol');
      return;
    }

    try {
      const response = await authenticatedFetch('/api/hub/smart-services', {
        method: 'PUT',
        body: JSON.stringify({
          serviceId: patrolId,
          action: 'join',
          userId: user.uid,
          userName: user.displayName || user.email,
          userContact: user.phoneNumber || user.email
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Successfully joined patrol!');
        loadPatrols();
      } else {
        toast.error(result.error || 'Failed to join patrol');
      }
    } catch (error) {
      console.error('Error joining patrol:', error);
      toast.error('Error joining patrol');
    }
  };

  const leavePatrol = async (patrolId) => {
    if (!user) return;

    try {
      const response = await authenticatedFetch('/api/hub/smart-services', {
        method: 'PUT',
        body: JSON.stringify({
          serviceId: patrolId,
          action: 'leave',
          userId: user.uid
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Left patrol schedule');
        loadPatrols();
      } else {
        toast.error('Failed to leave patrol');
      }
    } catch (error) {
      console.error('Error leaving patrol:', error);
      toast.error('Error leaving patrol');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 rounded-full">
              <Calendar className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{patrols.length}</p>
              <p className="text-sm text-gray-600">Scheduled Patrols</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-full">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{volunteers.length}</p>
              <p className="text-sm text-gray-600">Active Volunteers</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">24/7</p>
              <p className="text-sm text-gray-600">Community Coverage</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Community Watch Program</h2>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowVolunteerSignup(true)}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            <UserPlus className="w-5 h-5" />
            <span>Become Volunteer</span>
          </button>
          <button
            onClick={() => setShowCreatePatrol(true)}
            className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-5 h-5" />
            <span>Schedule Patrol</span>
          </button>
        </div>
      </div>

      {/* Volunteer Signup Form */}
      {showVolunteerSignup && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Join Community Watch Volunteers</h3>
          <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={volunteerForm.phoneNumber}
                  onChange={(e) => setVolunteerForm({...volunteerForm, phoneNumber: e.target.value})}
                  placeholder="Your contact number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Security Experience
                </label>
                <select
                  value={volunteerForm.experience}
                  onChange={(e) => setVolunteerForm({...volunteerForm, experience: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select experience level</option>
                  <option value="none">No experience</option>
                  <option value="basic">Basic security awareness</option>
                  <option value="trained">Trained security personnel</option>
                  <option value="professional">Professional security background</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Patrol Shifts
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['Morning (6AM-12PM)', 'Afternoon (12PM-6PM)', 'Evening (6PM-12AM)', 'Night (12AM-6AM)'].map((shift) => (
                  <label key={shift} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">{shift}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={() => {
                  toast.success('Volunteer application submitted!');
                  setShowVolunteerSignup(false);
                }}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
              >
                Submit Application
              </button>
              <button
                type="button"
                onClick={() => setShowVolunteerSignup(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Patrol Form */}
      {showCreatePatrol && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Schedule Community Patrol</h3>
          <form onSubmit={createPatrol} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patrol Title
                </label>
                <input
                  type="text"
                  value={patrolForm.title}
                  onChange={(e) => setPatrolForm({...patrolForm, title: e.target.value})}
                  placeholder="e.g., Evening Block A Patrol"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patrol Route/Area
                </label>
                <input
                  type="text"
                  value={patrolForm.patrolRoute}
                  onChange={(e) => setPatrolForm({...patrolForm, patrolRoute: e.target.value})}
                  placeholder="e.g., Block A perimeter, main gate to park"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={patrolForm.description}
                onChange={(e) => setPatrolForm({...patrolForm, description: e.target.value})}
                placeholder="Patrol objectives and any specific concerns to address..."
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patrol Date
                </label>
                <input
                  type="date"
                  value={patrolForm.patrolDate}
                  onChange={(e) => setPatrolForm({...patrolForm, patrolDate: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={patrolForm.startTime}
                  onChange={(e) => setPatrolForm({...patrolForm, startTime: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={patrolForm.endTime}
                  onChange={(e) => setPatrolForm({...patrolForm, endTime: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Volunteers Needed
                </label>
                <select
                  value={patrolForm.maxVolunteers}
                  onChange={(e) => setPatrolForm({...patrolForm, maxVolunteers: parseInt(e.target.value)})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={2}>2 volunteers</option>
                  <option value={3}>3 volunteers</option>
                  <option value={4}>4 volunteers</option>
                  <option value={6}>6 volunteers</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Instructions
              </label>
              <textarea
                value={patrolForm.instructions}
                onChange={(e) => setPatrolForm({...patrolForm, instructions: e.target.value})}
                placeholder="Meeting point, equipment needed, emergency contacts, etc..."
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700"
              >
                Schedule Patrol
              </button>
              <button
                type="button"
                onClick={() => setShowCreatePatrol(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Patrol Schedule */}
      <div className="space-y-4">
        {patrols.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Patrols Scheduled</h3>
            <p className="text-gray-600 mb-4">
              Create patrol schedules to coordinate community safety efforts.
            </p>
            <button
              onClick={() => setShowCreatePatrol(true)}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
            >
              Schedule First Patrol
            </button>
          </div>
        ) : (
          patrols.map((patrol) => {
            const isParticipant = patrol.participants.some(p => p.userId === user?.uid);
            const isCreator = patrol.requesterUserId === user?.uid;
            const patrolDate = patrol.scheduledAt ? new Date(patrol.scheduledAt) : null;
            const isUpcoming = patrolDate && patrolDate > new Date();
            
            return (
              <div key={patrol.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold">{patrol.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        isUpcoming ? 'bg-blue-100 text-blue-800' :
                        patrol.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {isUpcoming ? 'Upcoming' : patrol.status}
                      </span>
                    </div>
                    
                    {patrol.description && (
                      <p className="text-gray-600 mb-3">{patrol.description}</p>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span>
                          {patrolDate ? 
                            patrolDate.toLocaleDateString() : 
                            'No date set'
                          }
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span>
                          {patrolDate ? 
                            `${patrolDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${patrol.metadata?.endTime || 'N/A'}` : 
                            'No time set'
                          }
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span>{patrol.currentParticipants}/{patrol.maxParticipants} volunteers</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span>{patrol.metadata?.patrolRoute || 'Route TBD'}</span>
                      </div>
                    </div>

                    {patrol.metadata?.instructions && (
                      <div className="mt-2 text-sm text-gray-600">
                        <strong>Instructions:</strong> {patrol.metadata.instructions}
                      </div>
                    )}
                  </div>
                </div>

                {/* Volunteers */}
                {patrol.participants.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Volunteers:</h4>
                    <div className="flex flex-wrap gap-2">
                      {patrol.participants.map((participant, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full"
                        >
                          {participant.userName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-3 pt-4 border-t border-gray-200">
                  {!isParticipant && !isCreator && patrol.status === 'open' && isUpcoming && (
                    <button
                      onClick={() => joinPatrol(patrol.id)}
                      className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Join Patrol</span>
                    </button>
                  )}
                  
                  {isParticipant && !isCreator && isUpcoming && (
                    <button
                      onClick={() => leavePatrol(patrol.id)}
                      className="flex items-center space-x-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200"
                    >
                      <UserMinus className="w-4 h-4" />
                      <span>Leave Patrol</span>
                    </button>
                  )}

                  {isCreator && (
                    <div className="flex items-center space-x-2 text-indigo-600">
                      <Settings className="w-4 h-4" />
                      <span className="text-sm font-medium">You organized this patrol</span>
                    </div>
                  )}

                  <div className="flex-1 text-right text-sm text-gray-500">
                    Organized by {patrol.requesterName}
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

export default CommunityWatch;
