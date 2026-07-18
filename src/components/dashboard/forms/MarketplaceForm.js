'use client';
// components/dashboard/forms/MarketplaceForm.js
import React, { useState, useEffect } from 'react';
import { AD_IMAGE_ACCEPT, uploadToS3, validateAdImageFiles } from '@/utils/s3Upload';
import { Image, X, Loader2, MapPin, Tag } from 'lucide-react';
import apiService from '@/services/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { getDraft, updateDraft, deleteDraft } from '@/lib/client-drafts';

export default function MarketplaceForm({ onSubmit, onCancel, editingItem = null }) {
  const { user } = useAuth();
  const [draftId, setDraftId] = useState(null);
  const [images, setImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    location: '',
    category: '',
    subCategory: '',
    condition: '',
    packaging: 'original_box',
    paymentType: 'cash',
    paymentCondition: 'before_collection',
    collectionType: 'pickup'
  });

  // Load editing item or existing draft if available
  useEffect(() => {
    const loadInitialData = async () => {
      // If we're editing an existing item, use that data
      if (editingItem) {
        // Load the form data from the existing item
        const itemData = {
          title: editingItem.title || '',
          description: editingItem.description || '',
          price: editingItem.price || '',
          location: editingItem.location || '',
          category: editingItem.category || '',
          subCategory: editingItem.subCategory || '',
          condition: editingItem.condition || '',
          packaging: editingItem.packaging || 'original_box',
          paymentType: editingItem.paymentType || 'cash',
          paymentCondition: editingItem.paymentCondition || 'before_collection',
          collectionType: editingItem.collectionType || 'pickup'
        };
        
        setFormData(itemData);
        
        // Load images if available
        if (editingItem.imageUrls && editingItem.imageUrls.length > 0) {
          setImages(editingItem.imageUrls.map(url => ({ url })));
        }
        
        return; // Skip loading from draft if we're editing
      }
      
      // Otherwise check for saved draft
      const storedDraftId = localStorage.getItem('marketplaceDraftId');
      if (storedDraftId) {
        try {
          const draftDoc = await getDraft(storedDraftId);
          if (draftDoc.exists) {
            const draftData = draftDoc.data;
            setDraftId(storedDraftId);
            setImages(draftData.imageUrls?.map(url => ({ url })) || []);
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

    loadInitialData();
  }, [editingItem]);

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
          localStorage.setItem('marketplaceDraftId', newDraftId);
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
    const requiredFields = ['title', 'description', 'price', 'location', 'category', 'condition'];
    const missing = requiredFields.filter((field) => !String(formData[field] ?? '').trim());
    
    if (missing.length > 0) {
      setMissingFields(missing);
      toast.error('Please fill in all required fields');
      return;
    }
    setMissingFields([]);

    setIsSubmitting(true);
    try {
      // Add type field for submission
      const submissionData = {
        ...formData,
        type: 'marketplace',
        category: 'marketplace', // For compatibility with existing code
      };
      
      // If editing, include the item ID
      if (editingItem) {
        submissionData.id = editingItem.id;
      }
      
      // Submit the form
      await onSubmit(submissionData, images);
      
      // Clean up draft if not editing
      if (draftId && !editingItem) {
        await deleteDraft(draftId);
        localStorage.removeItem('marketplaceDraftId');
      }

      toast.success(editingItem ? 'Item updated successfully!' : 'Item listed successfully!');
    } catch (error) {
      console.error('Submission error:', error);
      toast.error(editingItem ? 'Failed to update item' : 'Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    if (missingFields.includes(name) && String(value || '').trim()) {
      setMissingFields((prev) => prev.filter((field) => field !== name));
    }
    const updatedFormData = {
      ...formData,
      [name]: value
    };
    setFormData(updatedFormData);

    // Update draft with new form data if draft exists
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
    // If editing an existing item, just go back without confirmation
    if (editingItem) {
      onCancel();
      return;
    }
    
    // Otherwise prompt about the draft
    if (draftId) {
      // Ask for confirmation if there's a draft
      if (window.confirm('Are you sure you want to discard this draft?')) {
        try {
          // Delete draft document
          await deleteDraft(draftId);
          localStorage.removeItem('marketplaceDraftId');
          
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

  // Category options
  const categoryOptions = [
    { value: '', label: 'Select Category' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'vehicles', label: 'Vehicles' },
    { value: 'fashion', label: 'Fashion' },
    { value: 'home-appliances', label: 'Home Appliances' },
    { value: 'health-beauty', label: 'Health & Beauty' },
    { value: 'sports-leisure', label: 'Sports & Leisure' },
    { value: 'toys-games', label: 'Toys & Games' },
    { value: 'books-music-movies', label: 'Books, Music & Movies' },
    { value: 'other', label: 'Other' }
  ];

  // Subcategory options - dynamically shown based on main category
  const getSubcategoryOptions = (category) => {
    switch(category) {
      case 'electronics':
        return [
          { value: 'computers-laptops', label: 'Computers & Laptops' },
          { value: 'mobile-phones', label: 'Mobile Phones' },
          { value: 'tablets', label: 'Tablets' },
          { value: 'accessories-supplies', label: 'Accessories & Supplies' },
          { value: 'tv-audio', label: 'TV & Audio' },
          { value: 'cameras', label: 'Cameras' },
          { value: 'other-electronics', label: 'Other Electronics' }
        ];
      case 'furniture':
        return [
          { value: 'sofas-chairs', label: 'Sofas & Chairs' },
          { value: 'tables-dining', label: 'Tables & Dining' },
          { value: 'beds-bedding', label: 'Beds & Bedding' },
          { value: 'storage-organization', label: 'Storage & Organization' },
          { value: 'outdoor-furniture', label: 'Outdoor Furniture' },
          { value: 'other-furniture', label: 'Other Furniture' }
        ];
      // Add more categories as needed
      default:
        return [];
    }
  };

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

      {/* Basic Item Details */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Item Details</h3>
        {missingFields.length > 0 && (
          <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Missing required fields are highlighted in red.
          </p>
        )}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Title *
            </label>
            <input
              type="text"
              name="title"
              required
              className={getFieldClass('title')}
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Brand New iPhone 13 Pro Max 256GB"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              name="category"
              required
              className={getFieldClass('category')}
              value={formData.category}
              onChange={handleInputChange}
            >
              {categoryOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          {formData.category && getSubcategoryOptions(formData.category).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subcategory
              </label>
              <select
                name="subCategory"
                className="w-full p-2 border rounded-lg"
                value={formData.subCategory}
                onChange={handleInputChange}
              >
                <option value="">Select Subcategory</option>
                {getSubcategoryOptions(formData.category).map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price (₦) *
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
                placeholder="e.g., Lekki, Lagos"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Condition *
            </label>
            <select
              name="condition"
              required
              className={getFieldClass('condition')}
              value={formData.condition}
              onChange={handleInputChange}
            >
              <option value="">Select Condition</option>
              <option value="Brand New">Brand New</option>
              <option value="Like New">Like New</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="For Parts">For Parts/Not Working</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Packaging
            </label>
            <select
              name="packaging"
              className="w-full p-2 border rounded-lg"
              value={formData.packaging}
              onChange={handleInputChange}
            >
              <option value="original_box">Original Box</option>
              <option value="new_packaging">New Packaging</option>
              <option value="own_packaging">Own Packaging</option>
              <option value="no_packaging">No Packaging</option>
            </select>
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
              placeholder="Describe your item in detail, including features, specifications, and condition..."
            />
          </div>
        </div>
      </div>

      {/* Payment and Delivery Options */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Payment & Delivery Options</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Type
            </label>
            <select
              name="paymentType"
              className="w-full p-2 border rounded-lg"
              value={formData.paymentType}
              onChange={handleInputChange}
            >
              <option value="cash">Cash Only</option>
              <option value="bank_transfer">Bank Transfer Only</option>
              <option value="cash_and_transfer">Cash and Bank Transfer</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Condition
            </label>
            <select
              name="paymentCondition"
              className="w-full p-2 border rounded-lg"
              value={formData.paymentCondition}
              onChange={handleInputChange}
            >
              <option value="before_collection">Payment Before Collection/Delivery</option>
              <option value="on_delivery">Payment on Delivery</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Collection Type
            </label>
            <select
              name="collectionType"
              className="w-full p-2 border rounded-lg"
              value={formData.collectionType}
              onChange={handleInputChange}
            >
              <option value="pickup">Pick Up Only</option>
              <option value="delivery">Delivery Only</option>
              <option value="pickup_and_delivery">Pick Up and Delivery</option>
            </select>
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
              <span>{editingItem ? 'Updating...' : 'Posting...'}</span>
            </>
          ) : (
            <span>{editingItem ? 'Update Item' : 'Post Item'}</span>
          )}
        </button>
      </div>
    </form>
  );
}
