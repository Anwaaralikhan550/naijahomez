'use client';
// components/dashboard/forms/NoticeForm.js
import React, { useState, useEffect } from 'react';
import { uploadToS3 } from '@/utils/s3Upload';
import { Image, X, Loader2, Calendar, MapPin } from 'lucide-react';
import apiService from '@/services/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

export default function NoticeForm({ onSubmit, onCancel }) {
  const { user } = useAuth();
  const [draftId, setDraftId] = useState(null);
  const [images, setImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    noticeType: 'announcement',
    // Fields for event type
    eventDate: '',
    eventTime: '',
    venue: '',
    organizer: '',
    // Fields for job type
    jobType: '',
    salary: '',
    company: '',
    deadline: '',
    // Contact details
    phoneNumber: '',
    email: ''
  });

  // Load existing draft if available
  useEffect(() => {
    const loadDraft = async () => {
      const storedDraftId = localStorage.getItem('noticeDraftId');
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
    
    if (images.length + files.length > 5) {
      toast.error('Maximum 5 images allowed');
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
          localStorage.setItem('noticeDraftId', newDraftId);
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
    try {
      const imageToRemove = images[index];
      // Delete from S3
      const response = await fetch('/api/delete-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: imageToRemove.url })
      });

      if (!response.ok) {
        throw new Error('Failed to delete image');
      }

      // Update images state
      setImages(prev => prev.filter((_, i) => i !== index));
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
    const requiredFields = ['title', 'description', 'location', 'noticeType'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    
    if (missingFields.length > 0) {
      toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Submit the form
      console.log("Submitting form with data:", formData);
      console.log("Image data:", images);
      
      await onSubmit({...formData, type: 'notice'}, images);
      
      // Clean up draft
      if (draftId) {
        await deleteDoc(doc(db, 'drafts', draftId));
        localStorage.removeItem('noticeDraftId');
      }

      toast.success('Notice posted successfully!');
    } catch (error) {
      console.error('Submission error:', error);
      toast.error(`Failed to post notice: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    const updatedFormData = {
      ...formData,
      [name]: value
    };
    setFormData(updatedFormData);

    // Update draft with new form data
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
          localStorage.removeItem('noticeDraftId');
          
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

  // Notice types
  const noticeTypes = [
    { value: 'announcement', label: 'Announcement' },
    { value: 'event', label: 'Event' },
    { value: 'job', label: 'Job Opportunity' },
    { value: 'lost_found', label: 'Lost & Found' },
    { value: 'community', label: 'Community Notice' },
    { value: 'other', label: 'Other' }
  ];

  // Job types
  const jobTypes = [
    { value: 'full-time', label: 'Full-time' },
    { value: 'part-time', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'freelance', label: 'Freelance' },
    { value: 'internship', label: 'Internship' },
    { value: 'volunteer', label: 'Volunteer' }
  ];

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
          {images.length < 5 && (
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

      {/* Notice Details */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Notice Details</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notice Title*</label>
            <input
              type="text"
              name="title"
              required
              className="w-full p-2 border rounded-lg"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter a clear, descriptive title"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notice Type*</label>
            <select
              name="noticeType"
              required
              className="w-full p-2 border rounded-lg"
              value={formData.noticeType}
              onChange={handleInputChange}
            >
              {noticeTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location*</label>
            <input
              type="text"
              name="location"
              required
              className="w-full p-2 border rounded-lg"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="e.g., Lekki, Lagos"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
            <input
              type="tel"
              name="phoneNumber"
              className="w-full p-2 border rounded-lg"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              placeholder="Contact phone number"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              name="email"
              className="w-full p-2 border rounded-lg"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Contact email"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Description*</label>
            <textarea
              name="description"
              required
              rows={6}
              className="w-full p-2 border rounded-lg"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Provide detailed information about your notice"
            />
          </div>
        </div>
      </div>

      {/* Event-specific Fields */}
      {formData.noticeType === 'event' && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Event Details</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Date</label>
              <input
                type="date"
                name="eventDate"
                className="w-full p-2 border rounded-lg"
                value={formData.eventDate}
                onChange={handleInputChange}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Time</label>
              <input
                type="time"
                name="eventTime"
                className="w-full p-2 border rounded-lg"
                value={formData.eventTime}
                onChange={handleInputChange}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Venue</label>
              <input
                type="text"
                name="venue"
                className="w-full p-2 border rounded-lg"
                value={formData.venue}
                onChange={handleInputChange}
                placeholder="Specific location of the event"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Organizer</label>
              <input
                type="text"
                name="organizer"
                className="w-full p-2 border rounded-lg"
                value={formData.organizer}
                onChange={handleInputChange}
                placeholder="Person or organization hosting the event"
              />
            </div>
          </div>
        </div>
      )}

      {/* Job-specific Fields */}
      {formData.noticeType === 'job' && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Job Details</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Job Type</label>
              <select
                name="jobType"
                className="w-full p-2 border rounded-lg"
                value={formData.jobType}
                onChange={handleInputChange}
              >
                <option value="">Select Job Type</option>
                {jobTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Salary</label>
              <input
                type="text"
                name="salary"
                className="w-full p-2 border rounded-lg"
                value={formData.salary}
                onChange={handleInputChange}
                placeholder="e.g., ₦150,000/month or Negotiable"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
              <input
                type="text"
                name="company"
                className="w-full p-2 border rounded-lg"
                value={formData.company}
                onChange={handleInputChange}
                placeholder="Name of the hiring company"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Application Deadline</label>
              <input
                type="date"
                name="deadline"
                className="w-full p-2 border rounded-lg"
                value={formData.deadline}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>
      )}

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
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>Posting...</span>
            </>
          ) : (
            <span>Post Notice</span>
          )}
        </button>
      </div>
    </form>
  );
}