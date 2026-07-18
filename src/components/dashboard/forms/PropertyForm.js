'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Loader2, MapPin, Home, Bath, Car, Wifi, Wind, Shield, Sparkles, Eye, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { getDraft, updateDraft, deleteDraft } from '@/lib/client-drafts';
import ListingImageUploader from './ListingImageUploader';

export default function PropertyForm({ onSubmit, onCancel }) {
  const { user } = useAuth();
  const [draftId, setDraftId] = useState(null);
  const [images, setImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const [priceSuggestion, setPriceSuggestion] = useState(null);
  const [isSuggestingPrice, setIsSuggestingPrice] = useState(false);
  const [placesReady, setPlacesReady] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const locationInputRef = useRef(null);
  const streetInputRef = useRef(null);
  const townInputRef = useRef(null);
  const stateInputRef = useRef(null);
  const formDataRef = useRef(null);
  
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

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

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
          const draftDoc = await getDraft(storedDraftId);
          if (draftDoc.exists) {
            const draftData = draftDoc.data;
            setDraftId(storedDraftId);
            const draftImages = Array.isArray(draftData.images)
              ? draftData.images
              : (draftData.imageUrls || []).map((url, index) => ({
                  url,
                  metadata: draftData.imageMeta?.[index] || null
                }));
            setImages(draftImages);
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

  const persistDraftImages = useCallback(async (nextImages, nextDraftId = draftId) => {
    if (!nextDraftId) return;
    await updateDraft(nextDraftId, {
      imageUrls: nextImages.map((img) => img.url),
      imageMeta: nextImages.map((img) => img.metadata || null),
      images: nextImages,
      formData,
      updatedAt: new Date()
    });
  }, [draftId, formData]);

  const handleDraftIdChange = useCallback((nextDraftId) => {
    if (!nextDraftId) return;
    setDraftId(nextDraftId);
    localStorage.setItem('propertyDraftId', nextDraftId);
  }, []);

  const handleImagesChange = useCallback(async (nextImages, nextDraftId = draftId) => {
    setImages(nextImages);
    try {
      await persistDraftImages(nextImages, nextDraftId);
    } catch (error) {
      console.error('Error updating draft images:', error);
    }
  }, [draftId, persistDraftImages]);

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

      const nextImages = images.filter((_, i) => i !== index);
      setImages(nextImages);

      // Update draft in Firebase
      if (draftId) {
        await updateDraft(draftId, {
          imageUrls: nextImages.map(img => img.url),
          imageMeta: nextImages.map(img => img.metadata || null),
          images: nextImages,
          updatedAt: new Date()
        });
      }

      toast.success('Image removed');
    } catch (error) {
      console.error('Error removing image:', error);
      toast.error('Failed to remove image');
    }
  };

  const validateFormForPublish = () => {
    if (images.length === 0) {
      toast.error('Please upload at least one image');
      return false;
    }

    const requiredFields = ['title', 'description', 'location', 'propertyType', 'listingType'];
    const missing = requiredFields.filter((field) => !String(formData[field] ?? '').trim());

    if (formData.listingType === 'sale') {
      if (!formData.salePrice) {
        missing.push('salePrice');
      }
    } else {
      // Rent listing
      if (formData.rentType === 'monthly' && !formData.rentAmount.monthly) {
        missing.push('rentAmount.monthly');
      } else if (formData.rentType === 'annual' && !formData.rentAmount.annual) {
        missing.push('rentAmount.annual');
      }
    }

    if (missing.length > 0) {
      setMissingFields(missing);
      toast.error('Please fill in all required fields');
      return false;
    }

    setMissingFields([]);
    return true;
  };

  const handlePreviewClick = () => {
    if (!validateFormForPublish()) return;
    setIsPreviewOpen(true);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    
    if (!validateFormForPublish()) return;
    setIsPreviewOpen(false);

    setIsSubmitting(true);
    try {
      // Prepare the price field (backwards compatibility)
      let submissionData = {
        ...formData,
        type: 'property',
        imageMeta: images.map((img) => img.metadata || null)
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
        await deleteDraft(draftId);
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
    if (missingFields.includes(name) && String(value || '').trim()) {
      setMissingFields((prev) => prev.filter((field) => field !== name));
    }
    
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
        await updateDraft(draftId, {
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
        await updateDraft(draftId, {
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

  const getFieldClass = (fieldName) =>
    `w-full p-2 border rounded-lg ${missingFields.includes(fieldName) ? 'border-red-500 ring-1 ring-red-300 bg-red-50' : ''}`;

  const formatNaira = (value) => {
    const number = Number(value || 0);
    if (!Number.isFinite(number) || number <= 0) return '';
    return `₦${Math.round(number).toLocaleString('en-NG')}`;
  };

  const getPreviewPrice = () => {
    if (formData.listingType === 'sale') {
      return formData.salePrice ? formatNaira(formData.salePrice) : 'Price not set';
    }
    const rentValue = formData.rentType === 'annual'
      ? formData.rentAmount.annual
      : formData.rentAmount.monthly;
    const suffix = formData.rentType === 'annual' ? '/year' : '/month';
    return rentValue ? `${formatNaira(rentValue)}${suffix}` : 'Rent not set';
  };

  const getPropertyTypeLabel = () => {
    const labels = {
      house: 'House',
      apartment: 'Apartment',
      land: 'Land',
      commercial: 'Commercial'
    };
    return labels[formData.propertyType] || 'Property';
  };

  const selectedAmenities = amenityOptions
    .filter((amenity) => Array.isArray(formData.amenities) && formData.amenities.includes(amenity.value))
    .map((amenity) => amenity.label);

  const previewImage = images[0]?.url || '';

  const applySuggestedPrice = () => {
    if (!priceSuggestion?.median) return;
    const nextValue = String(Math.round(priceSuggestion.median));
    if (formData.listingType === 'sale') {
      handleInputChange({ target: { name: 'salePrice', value: nextValue } });
      return;
    }
    const targetName = formData.rentType === 'annual' ? 'rentAmount.annual' : 'rentAmount.monthly';
    handleInputChange({ target: { name: targetName, value: nextValue } });
  };

  const applyAddressPatch = useCallback(async (patch) => {
    if (!patch || Object.keys(patch).length === 0) return;
    const currentFormData = formDataRef.current || formData;
    const nextData = {
      ...currentFormData,
      ...patch,
      address: {
        ...(currentFormData.address || {}),
        ...(patch.address || {})
      }
    };
    formDataRef.current = nextData;
    setFormData(nextData);
    if (draftId) {
      try {
        await updateDraft(draftId, {
          formData: nextData,
          updatedAt: new Date()
        });
      } catch (error) {
        console.error('Error updating draft:', error);
      }
    }
  }, [draftId, formData]);

  const parseGooglePlace = useCallback((place) => {
    const components = place?.address_components || [];
    const getPart = (types) => {
      const match = components.find((component) => types.some((type) => component.types?.includes(type)));
      return match?.long_name || '';
    };

    const streetNumber = getPart(['street_number']);
    const route = getPart(['route']);
    const town = getPart(['sublocality_level_1', 'locality', 'administrative_area_level_2']);
    const state = getPart(['administrative_area_level_1']);
    const formatted = place?.formatted_address || '';

    const patch = {};
    const address = {};
    const location = town && state ? `${town}, ${state}` : formatted;
    const street = [streetNumber, route].filter(Boolean).join(' ');

    if (location) patch.location = location;
    if (street) address.street = street;
    if (town) address.town = town;
    if (state) address.state = state;
    if (Object.keys(address).length > 0) patch.address = address;

    return patch;
  }, []);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || typeof window === 'undefined') return undefined;

    let cancelled = false;
    const scriptId = 'google-maps-places-script';

    const initializeAutocomplete = () => {
      if (cancelled || !window.google?.maps?.places) return;
      setPlacesReady(true);
      const refs = [locationInputRef, streetInputRef, townInputRef, stateInputRef];
      refs.forEach((inputRef) => {
        if (!inputRef.current || inputRef.current.dataset.placesReady === 'true') return;
        inputRef.current.dataset.placesReady = 'true';
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'ng' },
          fields: ['address_components', 'formatted_address', 'name']
        });
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          applyAddressPatch(parseGooglePlace(place));
        });
      });
    };

    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      if (window.google?.maps?.places) initializeAutocomplete();
      else existingScript.addEventListener('load', initializeAutocomplete, { once: true });
      return () => {
        cancelled = true;
        existingScript.removeEventListener('load', initializeAutocomplete);
      };
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', initializeAutocomplete, { once: true });
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.removeEventListener('load', initializeAutocomplete);
    };
  }, [applyAddressPatch, parseGooglePlace]);

  useEffect(() => {
    const controller = new AbortController();
    const shouldFetch = formData.location && formData.propertyType && formData.listingType;
    if (!shouldFetch) {
      setPriceSuggestion(null);
      return undefined;
    }

    const timeout = setTimeout(async () => {
      setIsSuggestingPrice(true);
      try {
        const params = new URLSearchParams({
          location: formData.location,
          propertyType: formData.propertyType,
          bedrooms: formData.bedrooms || '',
          bathrooms: formData.bathrooms || '',
          listingType: formData.listingType,
          rentType: formData.rentType || ''
        });
        const response = await fetch(`/api/listings/price-suggestions?${params.toString()}`, {
          signal: controller.signal
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'No suggestion available');
        setPriceSuggestion(result.suggestion || null);
      } catch (error) {
        if (error.name !== 'AbortError') setPriceSuggestion(null);
      } finally {
        setIsSuggestingPrice(false);
      }
    }, 500);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [formData.bathrooms, formData.bedrooms, formData.listingType, formData.location, formData.propertyType, formData.rentType]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handlePreviewClick();
      }}
      className="space-y-6"
      noValidate
    >
      <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-600 p-2 text-white">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-blue-950">Smart Assist</h3>
            <p className="mt-1 text-sm text-gray-600">
              Use address autocomplete, suggested pricing, compressed uploads, and ordered cover images to post faster.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
              <span className={`rounded-full px-3 py-1 ${placesReady ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'}`}>
                {placesReady ? 'Address autofill ready' : 'Manual address fallback'}
              </span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 ring-1 ring-blue-200">
                Draft autosave active
              </span>
              {priceSuggestion?.median && (
                <button
                  type="button"
                  onClick={applySuggestedPrice}
                  className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                >
                  Apply suggested price {formatNaira(priceSuggestion.median)}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ListingImageUploader
        images={images}
        draftId={draftId}
        userId={user?.uid}
        onDraftIdChange={handleDraftIdChange}
        onImagesChange={handleImagesChange}
        onRemoveImage={removeImage}
        onUploadingChange={setIsUploading}
        disabled={isSubmitting}
      />

      {/* Basic Property Details */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Basic Details</h3>
        {missingFields.length > 0 && (
          <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Missing required fields are highlighted in red.
          </p>
        )}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              name="title"
              required
              className={getFieldClass('title')}
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
              className={getFieldClass('propertyType')}
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
                ref={locationInputRef}
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
              ref={streetInputRef}
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
              ref={townInputRef}
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
              ref={stateInputRef}
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
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-900">Pricing Details</h3>
            <p className="text-sm text-gray-500">Suggestions are based on similar active listings and can be overridden.</p>
          </div>
          <div className="min-h-8">
            {isSuggestingPrice ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 ring-1 ring-blue-100">
                <Loader2 size={14} className="animate-spin" />
                Checking range
              </span>
            ) : priceSuggestion?.median ? (
              <button
                type="button"
                onClick={applySuggestedPrice}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
              >
                Suggested {formatNaira(priceSuggestion.min)} - {formatNaira(priceSuggestion.max)}
                <span className="text-xs text-emerald-600">Use median</span>
              </button>
            ) : (
              <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 ring-1 ring-amber-100">
                Add location and type for price range
              </span>
            )}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Sale/Rent Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Listing Type *
            </label>
            <select
              name="listingType"
              required
              className={getFieldClass('listingType')}
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
                <span className="absolute left-2 top-2.5 text-sm font-semibold text-gray-500">₦</span>
                <input
                  type="text"
                  name="salePrice"
                  required
                  className={`${getFieldClass('salePrice')} pl-8`}
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
                <span className="absolute left-2 top-2.5 text-sm font-semibold text-gray-500">₦</span>
                <input
                  type="text"
                  name="rentAmount.monthly"
                  required
                  className={`${getFieldClass('rentAmount.monthly')} pl-8`}
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
                <span className="absolute left-2 top-2.5 text-sm font-semibold text-gray-500">₦</span>
                <input
                  type="text"
                  name="rentAmount.annual"
                  required
                  className={`${getFieldClass('rentAmount.annual')} pl-8`}
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

      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Preview advert</p>
                <h3 className="text-xl font-bold text-blue-950">Review before going public</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close preview"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-150px)] overflow-y-auto p-5">
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt={formData.title || 'Property preview'}
                      className="h-64 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center bg-blue-50 text-sm font-semibold text-blue-900">
                      No image selected
                    </div>
                  )}
                  <div className="space-y-3 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-2xl font-bold text-slate-950">{formData.title || 'Untitled property'}</h4>
                        <p className="mt-1 flex items-center text-sm text-gray-600">
                          <MapPin className="mr-1.5 h-4 w-4 text-blue-500" />
                          {formData.location || 'Location not set'}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-4 py-2 text-base font-bold text-emerald-700 ring-1 ring-emerald-100">
                        {getPreviewPrice()}
                      </span>
                    </div>

                    <p className="whitespace-pre-line text-sm leading-6 text-gray-700">
                      {formData.description || 'No description added.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <h5 className="mb-3 font-semibold text-gray-900">Key details</h5>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs font-medium uppercase text-gray-500">Type</p>
                        <p className="font-semibold text-gray-900">{getPropertyTypeLabel()}</p>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs font-medium uppercase text-gray-500">Listing</p>
                        <p className="font-semibold text-gray-900">{formData.listingType === 'sale' ? 'For Sale' : 'For Rent'}</p>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs font-medium uppercase text-gray-500">Bedrooms</p>
                        <p className="font-semibold text-gray-900">{formData.bedrooms || 'N/A'}</p>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs font-medium uppercase text-gray-500">Bathrooms</p>
                        <p className="font-semibold text-gray-900">{formData.bathrooms || 'N/A'}</p>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs font-medium uppercase text-gray-500">Parking</p>
                        <p className="font-semibold text-gray-900">
                          {formData.parking.available ? `${formData.parking.spaces || 'Yes'} available` : 'Not listed'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs font-medium uppercase text-gray-500">Images</p>
                        <p className="font-semibold text-gray-900">{images.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-4">
                    <h5 className="mb-3 font-semibold text-gray-900">Amenities</h5>
                    {selectedAmenities.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedAmenities.map((amenity) => (
                          <span key={amenity} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            {amenity}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No amenities selected.</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-4">
                    <h5 className="mb-3 font-semibold text-gray-900">Contact shown on advert</h5>
                    <div className="space-y-2 text-sm text-gray-700">
                      <p><span className="font-medium text-gray-900">Phone:</span> {formData.contact.phone || 'Not provided'}</p>
                      <p><span className="font-medium text-gray-900">Email:</span> {formData.contact.email || 'Not provided'}</p>
                      <p><span className="font-medium text-gray-900">Website:</span> {formData.contact.website || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-100"
              >
                Edit advert
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || isUploading}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-5 w-5" />
                    Confirm & Post
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleCancel}
          className="px-6 py-2 border border-red-400 text-red-700 rounded-lg hover:bg-red-700 hover:text-white hover:border-red-700 transition-colors sm:w-auto"
        >
          Cancel
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handlePreviewClick}
            disabled={isSubmitting || isUploading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500 bg-white px-6 py-2 font-semibold text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
          >
            <Eye size={20} />
            <span>Preview Ad</span>
          </button>
          <button
            type="button"
            onClick={handlePreviewClick}
            disabled={isSubmitting || isUploading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                <span>Post Property</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
