'use client';
import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  FileText, 
  Camera, 
  Phone,
  MapPin,
  Clock,
  User,
  Shield,
  Plus,
  Upload,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const IncidentReporter = ({ communityId }) => {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReportForm, setShowReportForm] = useState(false);

  // Form data for reporting incidents
  const [reportForm, setReportForm] = useState({
    title: '',
    description: '',
    incidentType: 'security', // security, theft, vandalism, suspicious_activity, other
    severity: 'medium', // low, medium, high, critical
    location: '',
    anonymous: false,
    contactPolice: false,
    witnesses: '',
    actionTaken: ''
  });

  useEffect(() => {
    if (communityId) {
      loadIncidents();
    }
  }, [communityId]);

  const loadIncidents = async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/emergency-alerts?communityId=${communityId}&type=incident`);
      const result = await response.json();

      if (result.success) {
        setIncidents(result.data || []);
      }
    } catch (error) {
      console.error('Error loading incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitReport = async (e) => {
    e.preventDefault();
    
    if (!user && !reportForm.anonymous) {
      toast.error('Please log in to submit reports');
      return;
    }

    try {
      const incidentData = {
        communityId,
        type: 'incident_report',
        title: reportForm.title,
        message: reportForm.description,
        alertType: 'incident',
        priority: reportForm.severity,
        createdBy: reportForm.anonymous ? 'Anonymous' : (user?.displayName || user?.email || 'Anonymous'),
        createdById: reportForm.anonymous ? 'anonymous' : (user?.uid || 'anonymous'),
        isActive: true,
        metadata: {
          incidentType: reportForm.incidentType,
          location: reportForm.location,
          anonymous: reportForm.anonymous,
          contactPolice: reportForm.contactPolice,
          witnesses: reportForm.witnesses,
          actionTaken: reportForm.actionTaken,
          reportedAt: new Date().toISOString()
        }
      };

      const response = await authenticatedFetch('/api/hub/emergency-alerts', {
        method: 'POST',
        body: JSON.stringify(incidentData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Incident report submitted successfully!');
        setShowReportForm(false);
        setReportForm({
          title: '',
          description: '',
          incidentType: 'security',
          severity: 'medium',
          location: '',
          anonymous: false,
          contactPolice: false,
          witnesses: '',
          actionTaken: ''
        });
        loadIncidents();
      } else {
        toast.error('Failed to submit incident report');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Error submitting incident report');
    }
  };

  const getIncidentIcon = (type) => {
    switch (type) {
      case 'security': return <Shield className="w-5 h-5" />;
      case 'theft': return <AlertTriangle className="w-5 h-5" />;
      case 'vandalism': return <AlertTriangle className="w-5 h-5" />;
      case 'suspicious_activity': return <Eye className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 border-red-500 text-red-800';
      case 'high': return 'bg-orange-100 border-orange-500 text-orange-800';
      case 'medium': return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      case 'low': return 'bg-blue-100 border-blue-500 text-blue-800';
      default: return 'bg-gray-100 border-gray-500 text-gray-800';
    }
  };

  const emergencyContacts = [
    { name: 'Police Emergency', number: '199', icon: Phone },
    { name: 'Lagos State Emergency', number: '767', icon: Phone },
    { name: 'Fire Service', number: '190', icon: Phone },
    { name: 'Medical Emergency', number: '199', icon: Phone }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Emergency Contacts */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="font-semibold text-red-900 mb-3 flex items-center space-x-2">
          <Phone className="w-5 h-5" />
          <span>Emergency Contacts</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {emergencyContacts.map((contact, index) => (
            <a
              key={index}
              href={`tel:${contact.number}`}
              className="flex items-center space-x-2 p-2 bg-white rounded border hover:bg-gray-50 text-sm"
            >
              <contact.icon className="w-4 h-4 text-red-600" />
              <div>
                <div className="font-medium text-gray-900">{contact.name}</div>
                <div className="text-red-600">{contact.number}</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Incident Reporting System</h2>
          <p className="text-gray-600 text-sm">Report security incidents and safety concerns</p>
        </div>
        <button
          onClick={() => setShowReportForm(true)}
          className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          <Plus className="w-5 h-5" />
          <span>Report Incident</span>
        </button>
      </div>

      {/* Report Form */}
      {showReportForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Submit Incident Report</h3>
          <form onSubmit={submitReport} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Incident Title *
                </label>
                <input
                  type="text"
                  value={reportForm.title}
                  onChange={(e) => setReportForm({...reportForm, title: e.target.value})}
                  placeholder="Brief description of the incident"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Incident Type
                </label>
                <select
                  value={reportForm.incidentType}
                  onChange={(e) => setReportForm({...reportForm, incidentType: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                >
                  <option value="security">General Security Issue</option>
                  <option value="theft">Theft/Burglary</option>
                  <option value="vandalism">Vandalism/Property Damage</option>
                  <option value="suspicious_activity">Suspicious Activity</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Detailed Description *
              </label>
              <textarea
                value={reportForm.description}
                onChange={(e) => setReportForm({...reportForm, description: e.target.value})}
                placeholder="Provide detailed information about what happened, when it occurred, and any other relevant details..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location/Address
                </label>
                <input
                  type="text"
                  value={reportForm.location}
                  onChange={(e) => setReportForm({...reportForm, location: e.target.value})}
                  placeholder="Where did this incident occur?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Severity Level
                </label>
                <select
                  value={reportForm.severity}
                  onChange={(e) => setReportForm({...reportForm, severity: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                >
                  <option value="low">Low - Minor incident</option>
                  <option value="medium">Medium - Moderate concern</option>
                  <option value="high">High - Serious incident</option>
                  <option value="critical">Critical - Immediate attention needed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Witnesses (Optional)
              </label>
              <textarea
                value={reportForm.witnesses}
                onChange={(e) => setReportForm({...reportForm, witnesses: e.target.value})}
                placeholder="Names and contact information of any witnesses"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action Already Taken (Optional)
              </label>
              <textarea
                value={reportForm.actionTaken}
                onChange={(e) => setReportForm({...reportForm, actionTaken: e.target.value})}
                placeholder="Describe any immediate actions you took in response to this incident"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Options */}
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={reportForm.anonymous}
                  onChange={(e) => setReportForm({...reportForm, anonymous: e.target.checked})}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="anonymous" className="flex items-center space-x-2 text-sm">
                  <EyeOff className="w-4 h-4" />
                  <span>Submit this report anonymously</span>
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="contactPolice"
                  checked={reportForm.contactPolice}
                  onChange={(e) => setReportForm({...reportForm, contactPolice: e.target.checked})}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="contactPolice" className="flex items-center space-x-2 text-sm">
                  <Phone className="w-4 h-4" />
                  <span>This incident requires police involvement</span>
                </label>
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
              >
                Submit Incident Report
              </button>
              <button
                type="button"
                onClick={() => setShowReportForm(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recent Incidents */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Recent Incident Reports</h3>
        
        {incidents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Incidents Reported</h3>
            <p className="text-gray-600 mb-4">
              Help keep the community safe by reporting security incidents and concerns.
            </p>
            <button
              onClick={() => setShowReportForm(true)}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
            >
              Report First Incident
            </button>
          </div>
        ) : (
          incidents.map((incident) => (
            <div key={incident.id} className={`rounded-lg border-l-4 p-4 ${getSeverityColor(incident.priority)}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5">
                    {getIncidentIcon(incident.metadata?.incidentType || 'other')}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-semibold">{incident.title}</h4>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-white bg-opacity-50 capitalize">
                        {incident.priority}
                      </span>
                      {incident.metadata?.anonymous && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                          Anonymous
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm mb-2">{incident.message}</p>
                    
                    {incident.metadata?.location && (
                      <div className="flex items-center space-x-1 text-xs mb-1">
                        <MapPin className="w-3 h-3" />
                        <span>Location: {incident.metadata.location}</span>
                      </div>
                    )}
                    
                    <div className="text-xs opacity-75 flex items-center space-x-4">
                      <span>Reported by {incident.createdBy}</span>
                      <span>•</span>
                      <span>{new Date(incident.createdAt).toLocaleString()}</span>
                      {incident.metadata?.contactPolice && (
                        <>
                          <span>•</span>
                          <span className="flex items-center space-x-1 text-blue-600">
                            <Phone className="w-3 h-3" />
                            <span>Police notified</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <AlertTriangle className="w-5 h-5 opacity-50" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default IncidentReporter;