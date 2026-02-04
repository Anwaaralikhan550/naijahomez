// utils/s3Upload.js
import { auth, db } from '@/lib/firebase-client';
import { doc, addDoc, updateDoc, collection, arrayUnion } from 'firebase/firestore';

export const uploadToS3 = async (file, draftId = null, userId = null) => {
  try {
    console.log("Starting file upload to S3:", file.name);

    // Get Firebase auth token for upload authorization
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authentication required for upload');
    }
    const token = await currentUser.getIdToken();

    const formData = new FormData();
    formData.append('file', file);

    // Add user ID for tracking (optional metadata)
    if (userId) {
      formData.append('userId', userId);
    }

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Upload API error:", errorData);
      throw new Error(`Upload failed: ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log("Upload response:", data);

    if (!data.url) {
      throw new Error('No URL returned from upload service');
    }

    const url = data.url;

    // Create or update draft in Firebase
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    if (!draftId) {
      // Create new draft
      const draftRef = await addDoc(collection(db, 'drafts'), {
        userId: user.uid,
        status: 'draft',
        imageUrls: [url],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log("Created new draft with image:", draftRef.id);
      return { url, draftId: draftRef.id };
    } else {
      // Update existing draft
      const draftRef = doc(db, 'drafts', draftId);
      await updateDoc(draftRef, {
        imageUrls: arrayUnion(url),
        updatedAt: new Date()
      });
      console.log("Updated draft with new image:", draftId);
      return { url, draftId };
    }
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};