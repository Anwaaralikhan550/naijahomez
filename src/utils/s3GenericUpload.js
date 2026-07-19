// Drop-in replacement for the old firebaseStorageUpload.js, backed by the
// existing S3 /api/upload route instead of Firebase Storage. Kept as a thin
// wrapper (not merged into s3Upload.js) because callers here don't want the
// image-only validation, compression, or Firestore-draft side effects that
// s3Upload.js's uploadToS3() carries — this is a plain "upload one file,
// get back a URL" helper for KYC documents (PDF/image) and ad creatives.
import { getValidAccessToken } from '@/lib/auth/client-session';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const uploadFile = async (file, folderPath) => {
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

  const token = await getValidAccessToken();
  if (!token) {
    throw new Error('Authentication required for upload');
  }

  const formData = new FormData();
  formData.append('file', file);
  if (folderPath) {
    formData.append('folder', folderPath);
  }

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) {
    throw new Error(data?.error || 'Failed to upload file.');
  }

  return {
    url: data.url,
    metadata: data.metadata || {
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
      fullPath: null,
      bucket: null
    }
  };
};

export default uploadFile;
