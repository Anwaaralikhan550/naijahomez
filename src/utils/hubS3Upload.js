// utils/hubS3Upload.js
export const uploadHubImage = async (file, context = 'general', userId = null) => {
  try {
    console.log("Starting Hub image upload to S3:", file.name);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('context', `hub-${context}`); // Prefix with 'hub-' for organization
    
    // Add user ID for authentication
    if (userId) {
      formData.append('userId', userId);
    }

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Hub upload API error:", errorData);
      throw new Error(`Upload failed: ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log("Hub upload response:", data);

    if (!data.url) {
      throw new Error('No URL returned from upload service');
    }

    return data.url;
  } catch (error) {
    console.error('Hub upload error:', error);
    throw error;
  }
};

export const uploadMultipleHubImages = async (files, context = 'general', userId = null) => {
  try {
    const uploadPromises = files.map(file => uploadHubImage(file, context, userId));
    const urls = await Promise.all(uploadPromises);
    return urls;
  } catch (error) {
    console.error('Multiple Hub images upload error:', error);
    throw error;
  }
};