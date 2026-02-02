import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { OptimizedUpload } from '@/utils/optimizedUpload';

/**
 * React hook for optimized image uploads with pre-processing
 */
export const useOptimizedUpload = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const uploadImages = async (files, options = {}) => {
    if (!files || files.length === 0) {
      throw new Error('No files provided');
    }

    if (!user?.uid) {
      throw new Error('User authentication required for upload');
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const fileArray = Array.from(files);
      const results = [];

      // Include user ID in options
      const uploadOptions = {
        ...options,
        userId: user.uid
      };

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        
        // Update progress
        setProgress((i / fileArray.length) * 90); // Reserve 10% for completion

        console.log(`Uploading file ${i + 1}/${fileArray.length}: ${file.name}`);
        
        const result = await OptimizedUpload.uploadImageWithSizes(file, uploadOptions);
        results.push(result);
      }

      setProgress(100);
      return results;

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
      // Reset progress after a short delay
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const uploadSingleImage = async (file, options = {}) => {
    return uploadImages([file], options).then(results => results[0]);
  };

  const clearError = () => setError(null);

  return {
    uploadImages,
    uploadSingleImage,
    uploading,
    progress,
    error,
    clearError
  };
};