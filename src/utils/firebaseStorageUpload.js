import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase-client';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const sanitizePathSegment = (value) => {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9/_-]/g, '_')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/|\/$/g, '');
};

const getErrorMessage = (error) => {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('storage/unauthorized')) {
    return 'You do not have permission to upload this file.';
  }
  if (message.includes('storage/canceled')) {
    return 'Upload was canceled.';
  }
  if (message.includes('storage/retry-limit-exceeded')) {
    return 'Upload failed due to network issues. Please try again.';
  }
  return error?.message || 'Failed to upload file.';
};

export const uploadFile = async (file, folderPath) => {
  try {
    if (!file) {
      throw new Error('No file provided.');
    }

    if (!(file instanceof File)) {
      throw new Error('Invalid file input.');
    }

    if (file.size <= 0) {
      throw new Error('Selected file is empty.');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error('File must be 10MB or smaller.');
    }

    if (!String(file.name || '').trim()) {
      throw new Error('File name is missing.');
    }

    const safeFolderPath = sanitizePathSegment(folderPath);
    if (!safeFolderPath) {
      throw new Error('A valid upload folder path is required.');
    }

    const now = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${safeFolderPath}/${now}_${sanitizedName}`;
    const storageRef = ref(storage, storagePath);

    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type || 'application/octet-stream'
    });
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      url: downloadURL,
      metadata: {
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        fullPath: snapshot.metadata.fullPath || storagePath,
        bucket: snapshot.metadata.bucket || null,
        generation: snapshot.metadata.generation || null
      }
    };
  } catch (error) {
    const uploadError = new Error(getErrorMessage(error));
    uploadError.cause = error;
    throw uploadError;
  }
};

export default uploadFile;
