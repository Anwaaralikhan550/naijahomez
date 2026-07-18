'use client';
// components/dashboard/forms/ServiceForm.js
import React, { useState } from 'react';
import { AD_IMAGE_ACCEPT, uploadToS3, validateAdImageFiles } from '@/utils/s3Upload';
import { Image, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

export default function ServiceForm({ onSubmit, onCancel }) {
  const { user } = useAuth();
  const [images, setImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    location: '',
    serviceType: '',
    experience: '',
    availability: ''
  });

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
      const uploadPromises = validFiles.map(async (file) => {
        const { url } = await uploadToS3(file, null, user?.uid);
        return { url };
      });

      const newImages = await Promise.all(uploadPromises);
      setImages((prev) => [...prev, ...newImages]);
      toast.success('Images uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload images');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (images.length === 0) {
      toast.error('Please upload at least one image');
      return;
    }

    const requiredFields = ['title', 'serviceType', 'price', 'experience', 'location', 'availability', 'description'];
    const missing = requiredFields.filter((field) => !String(formData[field] ?? '').trim());
    if (missing.length > 0) {
      setMissingFields(missing);
      toast.error('Please fill in all required fields');
      return;
    }

    setMissingFields([]);
    setIsSubmitting(true);
    try {
      await onSubmit(formData, images);
    } catch (error) {
      console.error('Submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (missingFields.includes(name) && String(value || '').trim()) {
      setMissingFields((prev) => prev.filter((field) => field !== name));
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const getFieldClass = (fieldName) =>
    `w-full p-2 border rounded-lg ${missingFields.includes(fieldName) ? 'border-red-500 ring-1 ring-red-300 bg-red-50' : ''}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Image Upload Section */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Upload Images</h3>
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
      </div>

      {/* Service Details */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Service Details</h3>
        {missingFields.length > 0 && (
          <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Missing required fields are highlighted in red.
          </p>
        )}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Service Title *</label>
            <input
              type="text"
              name="title"
              required
              className={getFieldClass('title')}
              value={formData.title}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Service Type *</label>
            <select
              name="serviceType"
              required
              className={getFieldClass('serviceType')}
              value={formData.serviceType}
              onChange={handleInputChange}
            >
              <option value="">Select Service Type</option>
              <option value="cleaning">Cleaning</option>
              <option value="electrical">Electrical</option>
              <option value="plumbing">Plumbing</option>
              <option value="carpentry">Carpentry</option>
              <option value="painting">Painting</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rate/Price *</label>
            <input
              type="text"
              name="price"
              required
              placeholder="e.g., NGN 5000/hour or NGN 50000 fixed"
              className={getFieldClass('price')}
              value={formData.price}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Experience (Years) *</label>
            <input
              type="number"
              name="experience"
              min="0"
              required
              className={getFieldClass('experience')}
              value={formData.experience}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
            <input
              type="text"
              name="location"
              required
              className={getFieldClass('location')}
              value={formData.location}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Availability *</label>
            <input
              type="text"
              name="availability"
              required
              placeholder="e.g., Mon-Fri, 9 AM - 5 PM"
              className={getFieldClass('availability')}
              value={formData.availability}
              onChange={handleInputChange}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
            <textarea
              name="description"
              required
              rows={4}
              maxLength={5000}
              placeholder="Describe your services, experience, and qualifications..."
              className={getFieldClass('description')}
              value={formData.description}
              onChange={handleInputChange}
            />
          </div>
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-red-400 text-red-700 rounded-lg hover:bg-red-700 hover:text-white hover:border-red-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>Posting...</span>
            </>
          ) : (
            <span>Post Service</span>
          )}
        </button>
      </div>
    </form>
  );
}
