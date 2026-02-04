'use client';
import React, { useState, useEffect } from 'react';
import { uploadToS3 } from '@/utils/s3Upload';
import { Image, X, Loader2, MapPin, Home, Bath, Car, Wifi, Wind, Shield, DollarSign } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import apiService from '@/services/api';
import toast from 'react-hot-toast';
import { db } from '@/lib/firebase-client';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function PropertyForm({ onSubmit, onCancel }) {
  const { user } = useAuth();
  const [draftId, setDraftId] = useState(null);
  const [images, setImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Main form data state
  const [formData, setFormData] = useState({
    // Basic details (already existed)
    title: '',
    description: '',
    price: '',
    location: '',
    propertyType: '',
    bedrooms: '',
    bathrooms: '',
    squareMeters: '',

    // Listing type - Sale or Rent
    listingType: 'rent', // 'sale' or 'rent'

    // New fields - Address details
    address: {
      street: '',
      town: '',
      state: ''
    },

    // New fields - Property details
    boysQuarters: {
      available: false,
      rooms: ''
    },
    parking: {
      available: true,
      spaces: ''
    },
    amenities: [],
    furnishing: 'not_furnished', // 'furnished', 'not_furnished'

    // Sale-specific fields
    salePrice: '',

    // Rent-specific fields
    rentType: 'monthly', // 'monthly', 'annual'
    rentAmount: {
      monthly: '',
      annual: ''
    },
    fees: {
      agency: {
        type: 'percentage', // 'percentage', 'fixed'
        value: ''
      },
      legal: {
        type: 'percentage', // 'percentage', 'fixed'
        value: ''
      },
      caution: {
        required: true,
        value: ''
      },
      service: {
        required: true,
        type: 'fixed', // 'percentage', 'fixed'
        value: ''
      },
      other: []
    },
    
    // New fields - Contact details
    contact: {
      phone: '',
      email: '',
      website: ''
    },
    
    // Status (already existed)
    status: 'active'
  });

  // Available amenities list
  const amenityOptions = [
    { value: 'estate_water', label: 'Estate Water' },
    { value: 'estate_electricity', label: 'Estate/Private Electricity' },
    { value: 'broadband_wifi', label: 'Broadband/Wi-Fi' },
    { value: 'kitchen_appliances', label: 'Kitchen Appliances' },
    { value: 'water_heater', label: 'Water Heater' },
    { value: 'air_extractor', label: 'Air Extractor' },
    { value: 'estate_security', label: 'Gated with Private Estate Security' }
  ];

  // Other fees array state
  const [otherFee, setOtherFee] = useState({ name: '', amount: '' });

  // Load existing draft if available
  useEffect(() => {
    const loadDraft = async () => {
      const storedDraftId = localStorage.getItem('propertyDraftId');
      if (storedDraftId) {
        try {
          const draftDoc = await getDoc(doc(db, 'drafts', storedDraftId));
          if (draftDoc.exists()) {
            const draftData = draftDoc.data();
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

    // Validate file types and sizes
    const validFiles = files.filter(file => {
      const isValidType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB limit
      if (!isValidType) toast.error(`${file.name} is not a supported image type`);
      if (!isValidSize) toast.error(`${file.name} is too large (max 5MB)`);
      return isValidType && isValidSize;
    });

    if (validFiles.length === 0) return;

    setIsUploading(true);
    
    try {
      for (const file of validFiles) {
        const { url, draftId: newDraftId } = await uploadToS3(file, draftId, user?.uid);
        if (!draftId) {
          setDraftId(newDraftId);
          localStorage.setItem('propertyDraftId', newDraftId);
        }
        setImages(prev => [...prev, { url }]);
      }
      toast.success('Images uploaded successfully');
      
      // Update draft with current form data
      if (draftId) {
        await updateDoc(doc(db, 'drafts', draftId), {
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
        await updateDoc(doc(db, 'drafts', draftId), {
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
    const requiredFields = ['title', 'description', 'location', 'propertyType', 'listingType'];
    const missingFields = requiredFields.filter(field => !formData[field]);

    // Validate price based on listing type
    if (formData.listingType === 'sale') {
      if (!formData.salePrice) {
        missingFields.push('salePrice');
      }
    } else {
      // Rent listing
      if (formData.rentType === 'monthly' && !formData.rentAmount.monthly) {
        missingFields.push('rentAmount');
      } else if (formData.rentType === 'annual' && !formData.rentAmount.annual) {
        missingFields.push('rentAmount');
      }
    }

    if (missingFields.length > 0) {
      toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare the price field (backwards compatibility)
      let submissionData = {
        ...formData,
        type: 'property'
      };

      // Set price based on listing type (sale vs rent)
      if (formData.listingType === 'sale') {
        // For sale listings, use the sale price
        if (formData.salePrice) {
          submissionData.price = `₦${formatPrice(formData.salePrice)}`;
        }
        // Clear rent-specific fields for sale listings
        submissionData.rentType = null;
        submissionData.rentAmount = { monthly: '', annual: '' };
      } else {
        // For rent listings, use rent amount
        if (formData.rentType === 'monthly' && formData.rentAmount.monthly) {
          submissionData.price = `₦${formatPrice(formData.rentAmount.monthly)}/month`;
        } else if (formData.rentType === 'annual' && formData.rentAmount.annual) {
          submissionData.price = `₦${formatPrice(formData.rentAmount.annual)}/year`;
        }
        // Clear sale-specific fields for rent listings
        submissionData.salePrice = null;
      }
      
      // Submit the form
      await onSubmit(submissionData, images);
      
      // Clean up draft
      if (draftId) {
        await deleteDoc(doc(db, 'drafts', draftId));
        localStorage.removeItem('propertyDraftId');
      }

      toast.success('Property listed successfully!');
    } catch (error) {
      console.error('Submission error:', error);
      toast.error('Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to update nested objects in formData
  const updateNestedField = (path, value) => {
    const pathArray = path.split('.');
    const updatedFormData = { ...formData };
    
    let current = updatedFormData;
    for (let i = 0; i < pathArray.length - 1; i++) {
      current = current[pathArray[i]];
    }
    
    current[pathArray[pathArray.length - 1]] = value;
    
    return updatedFormData;
  };

  const handleInputChange = async (e) => {
    const { name, value, type, checked } = e.target;
    
    let updatedData;
    
    // Handle checkbox inputs
    if (type === 'checkbox') {
      if (name === 'amenities') {
        // Handle amenities checkboxes
        const amenity = value;
        let updatedAmenities = [...formData.amenities];
        
        if (checked) {
          updatedAmenities.push(amenity);
        } else {
          updatedAmenities = updatedAmenities.filter(a => a !== amenity);
        }
        
        updatedData = {
          ...formData,
          amenities: updatedAmenities
        };
      } else if (name === 'boysQuarters.available') {
        // Handle boys quarters availability
        updatedData = updateNestedField(name, checked);
      } else if (name === 'parking.available') {
        // Handle parking availability
        updatedData = updateNestedField(name, checked);
      } else if (name === 'fees.caution.required') {
        // Handle caution fee requirement
        updatedData = updateNestedField(name, checked);
      } else if (name === 'fees.service.required') {
        // Handle service charge requirement
        updatedData = updateNestedField(name, checked);
      } else {
        // Handle other checkboxes
        updatedData = {
          ...formData,
          [name]: checked
        };
      }
    } else if (name.includes('.')) {
      // Handle nested fields
      updatedData = updateNestedField(name, value);
    } else {
      // Handle regular inputs
      updatedData = {
        ...formData,
        [name]: value
      };
    }
    
    setFormData(updatedData);

    // Update draft with new form data
    if (draftId) {
      try {
        await updateDoc(doc(db, 'drafts', draftId), {
          formData: updatedData,
          updatedAt: new Date()
        });
      } catch (error) {
        console.error('Error updating draft:', error);
      }
    }
  };

  // Handle adding other fee
  const handleAddOtherFee = async () => {
    if (!otherFee.name || !otherFee.amount) {
      toast.error('Please enter both name and amount for the additional fee');
      return;
    }
    
    const updatedFees = {
      ...formData.fees,
      other: [...formData.fees.other, { ...otherFee }]
    };
    
    const updatedFormData = {
      ...formData,
      fees: updatedFees
    };
    
    setFormData(updatedFormData);
    setOtherFee({ name: '', amount: '' });
    
    // Update draft
    if (draftId) {
      try {
        await updateDoc(doc(db, 'drafts', draftId), {
          formData: updatedFormData,
          updatedAt: new Date()
        });
      } catch (error) {
        console.error('Error updating draft:', error);
      }
    }
  };

  // Handle removing other fee
  const handleRemoveOtherFee = async (index) => {
    const updatedFees = {
      ...formData.fees,
      other: formData.fees.other.filter((_, i) => i !== index)
    };
    
    const updatedFormData = {
      ...formData,
      fees: updatedFees
    };
    
    setFormData(updatedFormData);
    
    // Update draft
    if (draftId) {
      try {
        await updateDoc(doc(db, 'drafts', draftId), {
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
          await deleteDoc(doc(db, 'drafts', draftId));
          localStorage.removeItem('propertyDraftId');
          
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
                accept="image/jpeg,image/png,image/webp"
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

      {/* Basic Property Details */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Basic Details</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              name="title"
              required
              className="w-full p-2 border rounded-lg"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Modern 3 Bedroom Apartment"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Property Type *
            </label>
            <select
              name="propertyType"
              required
              className="w-full p-2 border rounded-lg"
              value={formData.propertyType}
              onChange={handleInputChange}
            >
              <option value="">Select Type</option>
              <option value="house">House</option>
              <option value="apartment">Apartment</option>
              <option value="land">Land</option>
              <option value="commercial">Commercial</option>
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
                className="w-full p-2 pl-8 border rounded-lg"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="e.g., Lekki Phase 1, Lagos"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              name="description"
              required
              rows={4}
              className="w-full p-2 border rounded-lg"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe your property in detail..."
            />
          </div>
        </div>
      </div>

      {/* Address Details */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Address Details</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Street
            </label>
            <input
              type="text"
              name="address.street"
              className="w-full p-2 border rounded-lg"
              value={formData.address.street}
              onChange={handleInputChange}
              placeholder="Street name/number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Town
            </label>
            <input
              type="text"
              name="address.town"
              className="w-full p-2 border rounded-lg"
              value={formData.address.town}
              onChange={handleInputChange}
              placeholder="Town/Area"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              State
            </label>
            <input
              type="text"
              name="address.state"
              className="w-full p-2 border rounded-lg"
              value={formData.address.state}
              onChange={handleInputChange}
              placeholder="State"
            />
          </div>
        </div>
      </div>

      {/* Property Features */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Property Features</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Bedrooms
            </label>
            <div className="flex items-center">
              <Home size={18} className="text-gray-400 mr-2" />
              <input
                type="number"
                name="bedrooms"
                min="0"
                className="w-full p-2 border rounded-lg"
                value={formData.bedrooms}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Bathrooms
            </label>
            <div className="flex items-center">
              <Bath size={18} className="text-gray-400 mr-2" />
              <input
                type="number"
                name="bathrooms"
                min="0"
                className="w-full p-2 border rounded-lg"
                value={formData.bathrooms}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Square Meters
            </label>
            <input
              type="number"
              name="squareMeters"
              min="0"
              className="w-full p-2 border rounded-lg"
              value={formData.squareMeters}
              onChange={handleInputChange}
              placeholder="e.g., 150"
            />
          </div>

          <div className="md:col-span-3">
            <div className="border-t my-4"></div>
          </div>

          <div>
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                id="boysQuarters"
                name="boysQuarters.available"
                checked={formData.boysQuarters.available}
                onChange={handleInputChange}
                className="rounded text-blue-500 mr-2"
              />
              <label className="text-sm font-medium text-gray-700">
                Boys Quarters Available
              </label>
            </div>
            {formData.boysQuarters.available && (
              <div className="mt-2 pl-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Rooms
                </label>
                <input
                  type="number"
                  name="boysQuarters.rooms"
                  min="0"
                  className="w-full p-2 border rounded-lg"
                  value={formData.boysQuarters.rooms}
                  onChange={handleInputChange}
                />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                id="parking"
                name="parking.available"
                checked={formData.parking.available}
                onChange={handleInputChange}
                className="rounded text-blue-500 mr-2"
              />
              <label className="text-sm font-medium text-gray-700">
                Parking Space Available
              </label>
            </div>
            {formData.parking.available && (
              <div className="mt-2 pl-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Spaces
                </label>
                <div className="flex items-center">
                  <Car size={18} className="text-gray-400 mr-2" />
                  <input
                    type="number"
                    name="parking.spaces"
                    min="0"
                    className="w-full p-2 border rounded-lg"
                    value={formData.parking.spaces}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Furnishing
            </label>
            <select
              name="furnishing"
              className="w-full p-2 border rounded-lg"
              value={formData.furnishing}
              onChange={handleInputChange}
            >
              <option value="not_furnished">Not Furnished</option>
              <option value="furnished">Furnished</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Amenities
            </label>
            <div className="grid md:grid-cols-4 gap-4">
              {amenityOptions.map(amenity => (
                <div key={amenity.value} className="flex items-center">
                  <input
                    type="checkbox"
                    id={amenity.value}
                    name="amenities"
                    value={amenity.value}
                    checked={formData.amenities.includes(amenity.value)}
                    onChange={handleInputChange}
                    className="rounded text-blue-500 mr-2"
                  />
                  <label htmlFor={amenity.value} className="text-sm text-gray-700">
                    {amenity.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Details */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Pricing Details</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Sale/Rent Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Listing Type *
            </label>
            <select
              name="listingType"
              required
              className="w-full p-2 border rounded-lg"
              value={formData.listingType}
              onChange={handleInputChange}
            >
              <option value="rent">For Rent</option>
              <option value="sale">For Sale</option>
            </select>
          </div>

          {/* Sale Price Field - Only shown when listingType is 'sale' */}
          {formData.listingType === 'sale' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sale Price (₦) *
              </label>
              <div className="relative">
                <DollarSign size={18} className="absolute left-2 top-2.5 text-gray-400" />
                <input
                  type="text"
                  name="salePrice"
                  required
                  className="w-full p-2 pl-8 border rounded-lg"
                  value={formatPrice(formData.salePrice)}
                  onChange={(e) => {
                    const parsedValue = parsePrice(e.target.value);
                    if (parsedValue === '' || /^\d*$/.test(parsedValue)) {
                      handleInputChange({
                        target: {
                          name: 'salePrice',
                          value: parsedValue
                        }
                      });
                    }
                  }}
                  placeholder="e.g., 50000000"
                />
              </div>
            </div>
          )}

          {/* Rent Type Selector - Only shown when listingType is 'rent' */}
          {formData.listingType === 'rent' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rent Type
              </label>
              <select
                name="rentType"
                className="w-full p-2 border rounded-lg"
                value={formData.rentType}
                onChange={handleInputChange}
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          )}

          {/* Rent Amount Fields - Only shown when listingType is 'rent' */}
          {formData.listingType === 'rent' && formData.rentType === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rent Per Month (₦) *
              </label>
              <div className="relative">
                <DollarSign size={18} className="absolute left-2 top-2.5 text-gray-400" />
                <input
                  type="text"
                  name="rentAmount.monthly"
                  required
                  className="w-full p-2 pl-8 border rounded-lg"
                  value={formatPrice(formData.rentAmount.monthly)}
                  onChange={(e) => {
                    const parsedValue = parsePrice(e.target.value);
                    if (parsedValue === '' || /^\d*$/.test(parsedValue)) {
                      handleInputChange({
                        target: {
                          name: 'rentAmount.monthly',
                          value: parsedValue
                        }
                      });
                    }
                  }}
                  placeholder="e.g., 150000"
                />
              </div>
            </div>
          )}

          {formData.listingType === 'rent' && formData.rentType === 'annual' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rent Per Annum (₦) *
              </label>
              <div className="relative">
                <DollarSign size={18} className="absolute left-2 top-2.5 text-gray-400" />
                <input
                  type="text"
                  name="rentAmount.annual"
                  required
                  className="w-full p-2 pl-8 border rounded-lg"
                  value={formatPrice(formData.rentAmount.annual)}
                  onChange={(e) => {
                    const parsedValue = parsePrice(e.target.value);
                    if (parsedValue === '' || /^\d*$/.test(parsedValue)) {
                      handleInputChange({
                        target: {
                          name: 'rentAmount.annual',
                          value: parsedValue
                        }
                      });
                    }
                  }}
                  placeholder="e.g., 1800000"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agency Fee Type
            </label>
            <select
              name="fees.agency.type"
              className="w-full p-2 border rounded-lg"
              value={formData.fees.agency.type}
              onChange={handleInputChange}
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {formData.fees.agency.type === 'percentage' ? 'Agency Fee (%)' : 'Agency Fee (₦)'}
            </label>
            <input
              type="text"
              name="fees.agency.value"
              className="w-full p-2 border rounded-lg"
              value={formData.fees.agency.value}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*$/.test(value) || (formData.fees.agency.type === 'fixed' && /^\d*$/.test(parsePrice(value)))) {
                  handleInputChange({
                    target: {
                      name: 'fees.agency.value',
                      value: formData.fees.agency.type === 'fixed' ? formatPrice(parsePrice(value)) : value
                    }
                  });
                }
              }}
              placeholder={formData.fees.agency.type === 'percentage' ? 'e.g., 10' : 'e.g., 50000'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Legal Fee Type
            </label>
            <select
              name="fees.legal.type"
              className="w-full p-2 border rounded-lg"
              value={formData.fees.legal.type}
              onChange={handleInputChange}
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {formData.fees.legal.type === 'percentage' ? 'Legal Fee (%)' : 'Legal Fee (₦)'}
            </label>
            <input
              type="text"
              name="fees.legal.value"
              className="w-full p-2 border rounded-lg"
              value={formData.fees.legal.value}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*$/.test(value) || (formData.fees.legal.type === 'fixed' && /^\d*$/.test(parsePrice(value)))) {
                  handleInputChange({
                    target: {
                      name: 'fees.legal.value',
                      value: formData.fees.legal.type === 'fixed' ? formatPrice(parsePrice(value)) : value
                    }
                  });
                }
              }}
              placeholder={formData.fees.legal.type === 'percentage' ? 'e.g., 5' : 'e.g., 25000'}
            />
          </div>

          <div>
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                id="cautionRequired"
                name="fees.caution.required"
                checked={formData.fees.caution.required}
                onChange={handleInputChange}
                className="rounded text-blue-500 mr-2"
              />
              <label className="text-sm font-medium text-gray-700">
                Refundable Caution Fee Required
              </label>
            </div>
            {formData.fees.caution.required && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Caution Fee Amount (₦)
                </label>
                <input
                  type="text"
                  name="fees.caution.value"
                  className="w-full p-2 border rounded-lg"
                  value={formatPrice(formData.fees.caution.value)}
                  onChange={(e) => {
                    const parsedValue = parsePrice(e.target.value);
                    if (parsedValue === '' || /^\d*$/.test(parsedValue)) {
                      handleInputChange({
                        target: {
                          name: 'fees.caution.value',
                          value: parsedValue
                        }
                      });
                    }
                  }}
                  placeholder="e.g., 100000"
                />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                id="serviceRequired"
                name="fees.service.required"
                checked={formData.fees.service.required}
                onChange={handleInputChange}
                className="rounded text-blue-500 mr-2"
              />
              <label className="text-sm font-medium text-gray-700">
                Service Charge Required
              </label>
            </div>
            {formData.fees.service.required && (
              <div className="mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type
                    </label>
                    <select
                      name="fees.service.type"
                      className="w-full p-2 border rounded-lg"
                      value={formData.fees.service.type}
                      onChange={handleInputChange}
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {formData.fees.service.type === 'percentage' ? 'Value (%)' : 'Value (₦)'}
                    </label>
                    <input
                      type="text"
                      name="fees.service.value"
                      className="w-full p-2 border rounded-lg"
                      value={formData.fees.service.type === 'fixed' ? formatPrice(formData.fees.service.value) : formData.fees.service.value}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^\d*$/.test(value) || (formData.fees.service.type === 'fixed' && /^\d*$/.test(parsePrice(value)))) {
                          handleInputChange({
                            target: {
                              name: 'fees.service.value',
                              value: formData.fees.service.type === 'fixed' ? parsePrice(value) : value
                            }
                          });
                        }
                      }}
                      placeholder={formData.fees.service.type === 'percentage' ? 'e.g., 5' : 'e.g., 50000'}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Other Fees
            </label>
            <div className="space-y-2">
              {formData.fees.other.map((fee, index) => (
                <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                  <div className="flex-grow">{fee.name}: ₦{formatPrice(fee.amount)}</div>
                  <button
                    type="button"
                    onClick={() => handleRemoveOtherFee(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <input
                    type="text"
                    placeholder="Fee Name"
                    value={otherFee.name}
                    onChange={(e) => setOtherFee({...otherFee, name: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div className="col-span-1">
                  <input
                    type="text"
                    placeholder="Amount (₦)"
                    value={formatPrice(otherFee.amount)}
                    onChange={(e) => {
                      const parsedValue = parsePrice(e.target.value);
                      if (parsedValue === '' || /^\d*$/.test(parsedValue)) {
                        setOtherFee({...otherFee, amount: parsedValue});
                      }
                    }}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div className="col-span-1">
                  <button
                    type="button"
                    onClick={handleAddOtherFee}
                    className="w-full p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    Add Fee
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Details */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Contact Details</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              name="contact.phone"
              className="w-full p-2 border rounded-lg"
              value={formData.contact.phone}
              onChange={handleInputChange}
              placeholder="e.g., +2341234567890"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              name="contact.email"
              className="w-full p-2 border rounded-lg"
              value={formData.contact.email}
              onChange={handleInputChange}
              placeholder="e.g., contact@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Website
            </label>
            <input
              type="url"
              name="contact.website"
              className="w-full p-2 border rounded-lg"
              value={formData.contact.website}
              onChange={handleInputChange}
              placeholder="e.g., https://example.com"
            />
          </div>
        </div>
      </div>

      {/* Legacy Price Field - Hidden as it's now auto-calculated from listingType selection */}

      {/* Submit Buttons */}
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={handleCancel}
          className="px-6 py-2 text-gray-600 hover:text-gray-800"
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
            <span>Post Property</span>
          )}
        </button>
      </div>
    </form>
  );
}