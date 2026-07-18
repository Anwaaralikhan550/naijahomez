'use client';
import React, { useState } from 'react';
import { 
  Building2,
  MapPin,
  Users,
  Mail,
  Phone,
  Globe,
  FileText,
  Plus,
  X,
  Save
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const CommunityCreator = ({ onClose, onSuccess }) => {
  const COMMUNITY_NAME_MAX = 100;
  const COMMUNITY_DESCRIPTION_MAX = 500;
  const COMMUNITY_LOCATION_MAX = 180;
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitFeedback, setSubmitFeedback] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    state: '',
    country: 'Nigeria',
    contactEmail: user?.email || '',
    contactPhone: '',
    website: '',
    rules: '',
    amenities: [],
    emergencyContacts: {
      security: '',
      maintenance: '',
      medical: ''
    }
  });
  
  const [newAmenity, setNewAmenity] = useState('');

  const REQUIRED_FIELD_ERRORS = {
    name: 'Community name is required',
    description: 'Description is required',
    address: 'Address is required'
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (submitFeedback) {
      setSubmitFeedback(null);
    }

    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }

    if (name.startsWith('emergencyContacts.')) {
      const field = name.split('.')[1];
      setFormData({
        ...formData,
        emergencyContacts: {
          ...formData.emergencyContacts,
          [field]: value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const validateForm = () => {
    const errors = {};

    Object.entries(REQUIRED_FIELD_ERRORS).forEach(([field, message]) => {
      if (!formData[field]?.trim()) {
        errors[field] = message;
      }
    });

    const composedLocation = [
      formData.address,
      formData.city,
      formData.state,
      formData.country
    ].filter(Boolean).join(', ');

    if (composedLocation.length > COMMUNITY_LOCATION_MAX) {
      errors.address = `Address/location must be ${COMMUNITY_LOCATION_MAX} characters or less`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const addAmenity = () => {
    if (newAmenity.trim() && !formData.amenities.includes(newAmenity.trim())) {
      setFormData({
        ...formData,
        amenities: [...formData.amenities, newAmenity.trim()]
      });
      setNewAmenity('');
    }
  };

  const removeAmenity = (amenity) => {
    setFormData({
      ...formData,
      amenities: formData.amenities.filter(a => a !== amenity)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitFeedback(null);

    if (!validateForm()) {
      setSubmitFeedback({
        type: 'error',
        message: 'Please fill all required fields marked with *.'
      });
      toast.error('Please fix the highlighted fields');
      return;
    }

    try {
      setLoading(true);

      // Combine address fields into location string for API compatibility
      const location = [
        formData.address,
        formData.city,
        formData.state,
        formData.country
      ].filter(Boolean).join(', ');

      const response = await authenticatedFetch('/api/hub/communities', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_community',
          name: formData.name,
          description: formData.description,
          location,
          isPublic: true,
          ...formData,
          createdBy: user.uid,
          createdByName: user.displayName || user.email,
          memberCount: 1
        })
      });

      const result = await response.json();

      if (!response.ok) {
        let errorMessage = result.error || 'Failed to create community';

        if (result.missing && typeof result.missing === 'object') {
          const backendFieldErrors = {};
          if (result.missing.name) backendFieldErrors.name = REQUIRED_FIELD_ERRORS.name;
          if (result.missing.description) backendFieldErrors.description = REQUIRED_FIELD_ERRORS.description;
          if (result.missing.location) backendFieldErrors.address = 'Address is required to build location';

          if (Object.keys(backendFieldErrors).length > 0) {
            setFieldErrors(prev => ({ ...prev, ...backendFieldErrors }));
          }

          const missingFields = Object.entries(result.missing)
            .filter(([_, isMissing]) => isMissing)
            .map(([field]) => field)
            .join(', ');
          errorMessage += ` (Missing: ${missingFields})`;
        }

        if (result.code === 'VALIDATION_LENGTH_EXCEEDED') {
          const backendFieldErrors = {};
          if (result.field === 'name') {
            backendFieldErrors.name = `Community name must be ${COMMUNITY_NAME_MAX} characters or less`;
          }
          if (result.field === 'description') {
            backendFieldErrors.description = `Description must be ${COMMUNITY_DESCRIPTION_MAX} characters or less`;
          }
          if (result.field === 'location') {
            backendFieldErrors.address = `Address/location must be ${COMMUNITY_LOCATION_MAX} characters or less`;
          }
          if (Object.keys(backendFieldErrors).length > 0) {
            setFieldErrors(prev => ({ ...prev, ...backendFieldErrors }));
          }
        }

        throw new Error(errorMessage);
      }

      setSubmitFeedback({
        type: 'success',
        message: 'Community created successfully. Redirecting...'
      });

      toast.success('Community created successfully!', {
        duration: 5000,
        position: 'top-center',
        style: {
          background: '#10B981',
          color: 'white',
          fontWeight: 'bold',
          padding: '16px',
          borderRadius: '8px'
        }
      });

      onSuccess && onSuccess({
        communityId: result.communityId,
        role: 'admin',
        membership: {
          communityId: result.communityId,
          role: 'admin',
          memberId: result.memberId || null,
          isFounder: true
        }
      });

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (error) {
      setSubmitFeedback({
        type: 'error',
        message: error.message || 'Failed to create community. Please try again.'
      });

      toast.error(`Community creation failed: ${error.message}`, {
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
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center">
            <Building2 className="w-6 h-6 mr-2 text-blue-600" />
            Create New Community
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="text-sm text-gray-600">
            Fields marked <span className="text-red-500 font-semibold">*</span> are required.
          </div>

          {submitFeedback && (
            <div
              className={`rounded-md px-4 py-3 text-sm font-medium ${
                submitFeedback.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {submitFeedback.message}
            </div>
          )}

          {/* Basic Information */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Community Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  maxLength={COMMUNITY_NAME_MAX}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    fieldErrors.name
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="e.g., Sunrise Estate, Marina Heights"
                  required
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? 'community-name-error' : undefined}
                />
                {fieldErrors.name && (
                  <p id="community-name-error" className="mt-1 text-sm text-red-600">
                    {fieldErrors.name}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {formData.name.length}/{COMMUNITY_NAME_MAX}
                </p>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  maxLength={COMMUNITY_DESCRIPTION_MAX}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    fieldErrors.description
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="Brief description of your community..."
                  required
                  aria-invalid={!!fieldErrors.description}
                  aria-describedby={fieldErrors.description ? 'community-description-error' : undefined}
                />
                {fieldErrors.description && (
                  <p id="community-description-error" className="mt-1 text-sm text-red-600">
                    {fieldErrors.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {formData.description.length}/{COMMUNITY_DESCRIPTION_MAX}
                </p>
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">Location</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  maxLength={COMMUNITY_LOCATION_MAX}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    fieldErrors.address
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="Street address"
                  required
                  aria-invalid={!!fieldErrors.address}
                  aria-describedby={fieldErrors.address ? 'community-address-error' : undefined}
                />
                {fieldErrors.address && (
                  <p id="community-address-error" className="mt-1 text-sm text-red-600">
                    {fieldErrors.address}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {formData.address.length}/{COMMUNITY_LOCATION_MAX}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="City"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="State"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Email
                </label>
                <input
                  type="email"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="admin@community.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  name="contactPhone"
                  value={formData.contactPhone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+234..."
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website (Optional)
                </label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {/* Emergency Contacts */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">Emergency Contacts</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Security
                </label>
                <input
                  type="tel"
                  name="emergencyContacts.security"
                  value={formData.emergencyContacts.security}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+234..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maintenance
                </label>
                <input
                  type="tel"
                  name="emergencyContacts.maintenance"
                  value={formData.emergencyContacts.maintenance}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+234..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Medical
                </label>
                <input
                  type="tel"
                  name="emergencyContacts.medical"
                  value={formData.emergencyContacts.medical}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+234..."
                />
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">Amenities</h4>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAmenity}
                  onChange={(e) => setNewAmenity(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAmenity())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Swimming Pool, Gym, Playground"
                />
                <button
                  type="button"
                  onClick={addAmenity}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {formData.amenities.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.amenities.map((amenity, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {amenity}
                      <button
                        type="button"
                        onClick={() => removeAmenity(amenity)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Community Rules */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">Community Rules & Guidelines</h4>
            <textarea
              name="rules"
              value={formData.rules}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Community rules, regulations, and guidelines..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition flex items-center"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Create Community
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CommunityCreator;

