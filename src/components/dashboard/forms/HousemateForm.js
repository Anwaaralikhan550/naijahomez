'use client';
import React, { useState, useEffect } from 'react';
import { AD_IMAGE_ACCEPT, uploadToS3, validateAdImageFiles } from '@/utils/s3Upload';
import { Image, X, Loader2, Calendar, MapPin, Home, Users } from 'lucide-react';
import apiService from '@/services/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { getDraft, updateDraft, deleteDraft } from '@/lib/client-drafts';

export default function HousemateForm({ onSubmit, onCancel }) {
  const { user } = useAuth();
  // Room type options (advert type)
  const advertTypes = [
    { value: 'room_for_rent', label: 'Room for Rent' },
    { value: 'room_wanted', label: 'Room Wanted' },
    { value: 'buddy_up', label: 'Buddy Up to Find Room' }
  ];

  // Property types
  const propertyTypes = [
    { value: 'house_share', label: 'Room in House Share' },
    { value: 'self_contained_room', label: 'Self-Contained Room' },
    { value: 'self_contained_flat', label: 'Self-Contained Flat' },
    { value: 'whole_property', label: 'Whole Property to Share' }
  ];

  // Tenant preferences
  const tenantPreferences = [
    { value: 'any', label: 'No Preference' },
    { value: 'female', label: 'Females Only' },
    { value: 'male', label: 'Males Only' },
    { value: 'male_or_female', label: 'Males or Females' },
    { value: 'couples', label: 'Couples' },
    { value: 'smoking', label: 'Smoking' },
    { value: 'non_smoking', label: 'Non-Smoking' },
    { value: 'smoking_or_non_smoking', label: 'Smoking or Non-Smoking' },
    { value: 'professionals', label: 'Professionals' },
    { value: 'professionals_or_non_professionals', label: 'Professional or Non-Professionals' }
  ];

  // Age range options
  const ageRangeOptions = [
    { value: 'under_30', label: 'Under 30 years' },
    { value: '30_to_40', label: '30 to 40 years' },
    { value: '40_to_50', label: '40 to 50 years' },
    { value: 'above_50', label: 'Above 50 years' },
    { value: 'any_age', label: 'Any Age' }
  ];

  // Length of stay options
  const lengthOfStayOptions = [
    { value: '1_to_3_months', label: '1-3 months' },
    { value: '3_to_6_months', label: '3-6 months' },
    { value: '6_to_12_months', label: '6-12 months' },
    { value: 'over_12_months', label: 'Over 12 months' },
    { value: 'flexible', label: 'Flexible' }
  ];

  // Common amenities
  const amenitiesOptions = [
    { value: 'ensuite', label: 'Ensuite' },
    { value: 'private_kitchen', label: 'Private Kitchen' },
    { value: 'furnished', label: 'Furnished' },
    { value: 'unfurnished', label: 'Unfurnished' },
    { value: 'car_park', label: 'Car Park' },
    { value: '24hr_light', label: '24hrs Light' },
    { value: 'gated_security', label: 'Gated with Security' },
    { value: 'garden', label: 'Garden' },
    { value: 'broadband', label: 'Broadband' },
    { value: 'wifi', label: 'WiFi' },
    { value: 'laundry', label: 'Laundry' },
    { value: 'bathroom', label: 'Private Bathroom' },
    { value: 'ac', label: 'Air Conditioning' },
    { value: 'water_heater', label: 'Water Heater' }
  ];

  const [draftId, setDraftId] = useState(null);
  const [images, setImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    price: '',
    minPrice: '',
    maxPrice: '',
    billsIncluded: false,
    advertType: 'room_for_rent',
    propertyType: 'house_share',
    moveInDate: new Date().toISOString().split('T')[0],
    lengthOfStay: 'flexible',
    interestedAreas: '',
    amenities: [],
    preferredGender: 'any',
    preferredAge: 'any_age',
    tenantPreferences: [],
    houseRules: '',
    phoneNumber: '',
    email: '',
    status: 'active'
  });

  // Load existing draft if available
  useEffect(() => {
    const loadDraft = async () => {
      const storedDraftId = localStorage.getItem('housemateDraftId');
      if (storedDraftId) {
        try {
          const draftDoc = await getDraft(storedDraftId);
          if (draftDoc.exists) {
            const draftData = draftDoc.data;
            setDraftId(storedDraftId);
            setImages(draftData.imageUrls.map(url => ({ url })));
            if (draftData.formData) {
              setFormData(draftData.formData);
            }
          }
        } catch (error) {
          console.error('Error loading draft:', error);
          toast.error('Failed to load saved draft');
        }
      }
    };

    loadDraft();
  }, []);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    
    if (images.length + files.length > 10) {
      toast.error('Maximum 10 images allowed');
      return;
    }

    const validFiles = validateAdImageFiles(files, toast.error);

    if (validFiles.length === 0) return;

    setIsUploading(true);
    
    try {
      for (const file of validFiles) {
        const { url, draftId: newDraftId } = await uploadToS3(file, draftId, user?.uid);
        if (!draftId) {
          setDraftId(newDraftId);
          localStorage.setItem('housemateDraftId', newDraftId);
        }
        setImages(prev => [...prev, { url }]);
      }
      toast.success('Images uploaded successfully');
      
      // Update draft with current form data
      if (draftId) {
        await updateDraft(draftId, {
          formData,
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload images');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = async (index) => {
    const imageToRemove = images[index];
    try {
      // Delete from S3
      const response = await fetch('/api/delete-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imageToRemove.url,
          draftId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete image');
      }

      // Update images state
      setImages(prev => prev.filter((_, i) => i !== index));

      // Update draft in Firebase
      if (draftId) {
        await updateDraft(draftId, {
          imageUrls: images.filter((_, i) => i !== index).map(img => img.url),
          updatedAt: new Date()
        });
      }

      toast.success('Image removed');
    } catch (error) {
      console.error('Error removing image:', error);
      toast.error('Failed to remove image');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (images.length === 0) {
      toast.error('Please upload at least one image');
      return;
    }

    // Validate required fields
    const requiredFields = ['title', 'description', 'location', 'propertyType', 'advertType'];
    const missing = requiredFields.filter((field) => !String(formData[field] ?? '').trim());

    if (formData.advertType === 'room_for_rent') {
      if (!String(formData.price || '').trim()) {
        missing.push('price');
      }
    } else {
      if (!String(formData.minPrice || '').trim()) {
        missing.push('minPrice');
      }
      if (!String(formData.maxPrice || '').trim()) {
        missing.push('maxPrice');
      }
    }
    
    if (missing.length > 0) {
      setMissingFields(missing);
      toast.error('Please fill in all required fields');
      return;
    }
    setMissingFields([]);

    setIsSubmitting(true);
    try {
      // Format the data for compatibility with existing data structure
      const submissionData = {
        ...formData,
        type: 'housemate',
        roomType: formData.propertyType, // For backward compatibility
        availableFrom: formData.moveInDate,
        preferredGender: formData.preferredGender
      };
      
      // Submit the form
      await onSubmit(submissionData, images);
      
      // Clean up draft
      if (draftId) {
        await deleteDraft(draftId);
        localStorage.removeItem('housemateDraftId');
      }

      toast.success('Housemate listing posted successfully!');
    } catch (error) {
      console.error('Submission error:', error);
      toast.error('Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = async (e) => {
    const { name, value, type, checked } = e.target;
    if (missingFields.includes(name) && String(value || '').trim()) {
      setMissingFields((prev) => prev.filter((field) => field !== name));
    }
    
    // Handle checkboxes for amenities
    if (name === 'amenities') {
      const amenity = value;
      let updatedAmenities;
      
      if (checked) {
        // Add the amenity if it's checked
        updatedAmenities = [...formData.amenities, amenity];
      } else {
        // Remove the amenity if it's unchecked
        updatedAmenities = formData.amenities.filter(a => a !== amenity);
      }
      
      const updatedFormData = {
        ...formData,
        amenities: updatedAmenities
      };
      
      setFormData(updatedFormData);
      
      // Update draft with new form data
      if (draftId) {
        try {
          await updateDraft(draftId, {
            formData: updatedFormData,
            updatedAt: new Date()
          });
        } catch (error) {
          console.error('Error updating draft:', error);
        }
      }
      
      return;
    }

    // Handle checkboxes for tenant preferences
    if (name === 'tenantPreferences') {
      const preference = value;
      let updatedPreferences;
      
      if (checked) {
        updatedPreferences = [...formData.tenantPreferences, preference];
      } else {
        updatedPreferences = formData.tenantPreferences.filter(p => p !== preference);
      }
      
      const updatedFormData = {
        ...formData,
        tenantPreferences: updatedPreferences
      };
      
      setFormData(updatedFormData);
      
      if (draftId) {
        try {
          await updateDraft(draftId, {
            formData: updatedFormData,
            updatedAt: new Date()
          });
        } catch (error) {
          console.error('Error updating draft:', error);
        }
      }
      
      return;
    }
    
    // Handle normal checkbox inputs
    if (type === 'checkbox') {
      const updatedFormData = {
        ...formData,
        [name]: checked
      };
      setFormData(updatedFormData);
      
      if (draftId) {
        try {
          await updateDraft(draftId, {
            formData: updatedFormData,
            updatedAt: new Date()
          });
        } catch (error) {
          console.error('Error updating draft:', error);
        }
      }
      
      return;
    }
    
    // Handle regular inputs
    const updatedFormData = {
      ...formData,
      [name]: value
    };
    setFormData(updatedFormData);

    // Update draft with new form data
    if (draftId) {
      try {
        await updateDraft(draftId, {
          formData: updatedFormData,
          updatedAt: new Date()
        });
      } catch (error) {
        console.error('Error updating draft:', error);
      }
    }
  };

  const handleCancel = async () => {
    if (draftId) {
      // Ask for confirmation if there's a draft
      if (window.confirm('Are you sure you want to discard this draft?')) {
        try {
          // Delete draft document
          await deleteDraft(draftId);
          localStorage.removeItem('housemateDraftId');
          
          // Delete all uploaded images
          if (images.length > 0) {
            await fetch('/api/delete-images', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageUrls: images.map(img => img.url) })
            });
          }
        } catch (error) {
          console.error('Error cleaning up draft:', error);
        }
      } else {
        return; // Don't proceed with cancel if user declines
      }
    }
    onCancel();
  };

  // Format price with commas
  const formatPrice = (value) => {
    if (!value) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Parse price by removing commas
  const parsePrice = (value) => {
    if (!value) return '';
    return value.toString().replace(/,/g, '');
  };

  const getFieldClass = (fieldName) =>
    `w-full p-2 border rounded-lg ${missingFields.includes(fieldName) ? 'border-red-500 ring-1 ring-red-300 bg-red-50' : ''}`;
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Image Upload Section */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Upload Images</h3>
        {draftId && (
          <p className="text-sm text-gray-500 mb-4">
            Draft saved automatically
          </p>
        )}
        <div className="grid grid-cols-5 gap-4">
          {images.map((image, index) => (
            <div key={index} className="relative group">
              <img
                src={image.url}
                alt={`Upload ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {images.length < 10 && (
            <label className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
              {isUploading ? (
                <Loader2 className="animate-spin text-blue-500" />
              ) : (
                <>
                  <Image size={24} className="text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Add Image</span>
                </>
              )}
              <input
                type="file"
                accept={AD_IMAGE_ACCEPT}
                multiple
                onChange={handleImageUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Supported formats: JPEG, PNG, WebP. Max size: 5MB per image.
        </p>
      </div>

      {/* Basic Listing Details */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Basic Listing Details</h3>
        {missingFields.length > 0 && (
          <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Missing required fields are highlighted in red.
          </p>
        )}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Listing Title *
            </label>
            <input
              type="text"
              name="title"
              required
              className={getFieldClass('title')}
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Spacious Room in Shared Apartment in Lekki"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Advert Type *
            </label>
            <select
              name="advertType"
              required
              className={getFieldClass('advertType')}
              value={formData.advertType}
              onChange={handleInputChange}
            >
              {advertTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Property Type *
            </label>
            <select
              name="propertyType"
              required
              className={getFieldClass('propertyType')}
              value={formData.propertyType}
              onChange={handleInputChange}
            >
              {propertyTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location *
            </label>
            <div className="relative">
              <MapPin size={18} className="absolute left-2 top-2.5 text-gray-400" />
              <input
                type="text"
                name="location"
                required
                className={`${getFieldClass('location')} pl-8`}
                value={formData.location}
                onChange={handleInputChange}
                placeholder="e.g., Lekki Phase 1, Lagos"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interested Areas
            </label>
            <input
              type="text"
              name="interestedAreas"
              className="w-full p-2 border rounded-lg"
              value={formData.interestedAreas}
              onChange={handleInputChange}
              placeholder="e.g., Lekki, Ikeja, Victoria Island"
            />
            <p className="text-xs text-gray-500 mt-1">Separate multiple areas with commas</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              name="phoneNumber"
              className="w-full p-2 border rounded-lg"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              placeholder="e.g., +2341234567890"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              className="w-full p-2 border rounded-lg"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="e.g., you@example.com"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              name="description"
              required
              rows={4}
              maxLength={5000}
              className={getFieldClass('description')}
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe the property, room, and surrounding area in detail..."
            />
          </div>
        </div>
      </div>

      {/* Price and Availability */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Price and Availability</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {formData.advertType === 'room_for_rent' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monthly Rent (₦) *
              </label>
              <input
                type="text"
                name="price"
                required
                className={getFieldClass('price')}
                value={formatPrice(formData.price)}
                onChange={(e) => {
                  const parsedValue = parsePrice(e.target.value);
                  if (parsedValue === '' || /^\d*$/.test(parsedValue)) {
                    handleInputChange({
                      target: {
                        name: 'price',
                        value: parsedValue
                      }
                    });
                  }
                }}
                placeholder="e.g., 150000"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Budget (₦) *
                </label>
                <input
                  type="text"
                  name="minPrice"
                  required
                  className={getFieldClass('minPrice')}
                  value={formatPrice(formData.minPrice)}
                  onChange={(e) => {
                    const parsedValue = parsePrice(e.target.value);
                    if (parsedValue === '' || /^\d*$/.test(parsedValue)) {
                      handleInputChange({
                        target: {
                          name: 'minPrice',
                          value: parsedValue
                        }
                      });
                    }
                  }}
                  placeholder="e.g., 100000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Budget (₦) *
                </label>
                <input
                  type="text"
                  name="maxPrice"
                  required
                  className={getFieldClass('maxPrice')}
                  value={formatPrice(formData.maxPrice)}
                  onChange={(e) => {
                    const parsedValue = parsePrice(e.target.value);
                    if (parsedValue === '' || /^\d*$/.test(parsedValue)) {
                      handleInputChange({
                        target: {
                          name: 'maxPrice',
                          value: parsedValue
                        }
                      });
                    }
                  }}
                  placeholder="e.g., 200000"
                />
              </div>
            </>
          )}

          <div className="flex items-center">
            <input
              type="checkbox"
              id="billsIncluded"
              name="billsIncluded"
              checked={formData.billsIncluded}
              onChange={handleInputChange}
              className="rounded text-blue-500 focus:ring-blue-500 mr-2"
            />
            <label htmlFor="billsIncluded" className="text-sm font-medium text-gray-700">
              Bills Included in Rent
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Move-in Date
            </label>
            <div className="relative">
              <Calendar size={18} className="absolute left-2 top-2.5 text-gray-400" />
              <input
                type="date"
                name="moveInDate"
                className="w-full p-2 pl-8 border rounded-lg"
                value={formData.moveInDate}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Length of Stay
            </label>
            <select
              name="lengthOfStay"
              className="w-full p-2 border rounded-lg"
              value={formData.lengthOfStay}
              onChange={handleInputChange}
            >
              {lengthOfStayOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Amenities */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Amenities</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {amenitiesOptions.map(amenity => (
            <label key={amenity.value} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="amenities"
                value={amenity.value}
                checked={formData.amenities.includes(amenity.value)}
                onChange={handleInputChange}
                className="rounded text-blue-500 focus:ring-blue-500"
              />
              <span>{amenity.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Tenant Preferences */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Tenant Preferences</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gender Preference
            </label>
            <select
              name="preferredGender"
              className="w-full p-2 border rounded-lg"
              value={formData.preferredGender}
              onChange={handleInputChange}
            >
              {tenantPreferences.slice(0, 5).map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Age Range
            </label>
            <select
              name="preferredAge"
              className="w-full p-2 border rounded-lg"
              value={formData.preferredAge}
              onChange={handleInputChange}
            >
              {ageRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Preferences
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {tenantPreferences.slice(5).map(preference => (
                <label key={preference.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="tenantPreferences"
                    value={preference.value}
                    checked={formData.tenantPreferences.includes(preference.value)}
                    onChange={handleInputChange}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <span>{preference.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              House Rules
            </label>
            <textarea
              name="houseRules"
              rows={3}
              maxLength={2000}
              className="w-full p-2 border rounded-lg"
              value={formData.houseRules}
              onChange={handleInputChange}
              placeholder="Any rules for living in the house? E.g., no smoking, quiet hours, etc."
            />
          </div>
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleCancel}
          className="px-6 py-2 border border-red-400 text-red-700 rounded-lg hover:bg-red-700 hover:text-white hover:border-red-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || isUploading}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>Posting...</span>
            </>
          ) : (
            <span>Post Listing</span>
          )}
        </button>
      </div>
    </form>
  );
}
