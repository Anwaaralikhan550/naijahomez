// Client-side API service to replace direct Firestore calls
import { auth } from '@/lib/firebase-client';
import logger from '@/lib/logger';
import { compressImageForUpload } from '@/lib/imageProcessor';

function normalizeImageList(value) {
  const rawList = Array.isArray(value)
    ? value
    : value !== undefined && value !== null
      ? [value]
      : [];

  return [...new Set(
    rawList
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  )];
}

function normalizeListingPayload(data = {}) {
  const payload = { ...data };
  const normalizedImages = normalizeImageList(
    Array.isArray(payload.imageUrls) && payload.imageUrls.length > 0
      ? payload.imageUrls
      : payload.images
  );

  if (normalizedImages.length > 0 || Array.isArray(payload.imageUrls) || Array.isArray(payload.images)) {
    payload.imageUrls = normalizedImages;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'images')) {
    delete payload.images;
  }

  return payload;
}

class ApiService {
  constructor() {
    this.baseUrl = '/api';
  }

  normalizeApiErrorPayload(payload, fallbackMessage = 'Request failed') {
    if (!payload || typeof payload !== 'object') {
      return {
        message: fallbackMessage,
        code: null
      };
    }

    const rawError = payload.error;
    const message =
      (typeof rawError === 'string' && rawError.trim()) ||
      (rawError && typeof rawError === 'object' && (rawError.message || rawError.error)) ||
      payload.message ||
      fallbackMessage;

    return {
      message,
      code: payload.code || rawError?.code || null
    };
  }

  /**
   * Get the current user's Firebase ID token for API authentication.
   * Returns null if user is not authenticated.
   */
  async getAuthToken() {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return null;
      }
      // Force refresh if token is about to expire (within 5 minutes)
      // return await currentUser.getIdToken(/* forceRefresh */ false);
      
      // Attempt to get token with timeout to prevent hanging
      const tokenPromise = currentUser.getIdToken(false);
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 2000));
      
      const token = await Promise.race([tokenPromise, timeoutPromise]);
      if (!token) {
          console.warn('Token retrieval timed out, using cached token');
          return currentUser.accessToken;
      }
      return token;
    } catch (error) {
      logger.error('Failed to get auth token', error);
      return null;
    }
  }

  async request(url, options = {}) {
    try {
      // Build headers with optional auth token
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      // Add Authorization header if user is authenticated
      const token = await this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        credentials: 'include', // Include session cookies
        ...options,
        headers
      });

      const contentType = response.headers.get('content-type') || '';
      const isJsonResponse = contentType.includes('application/json');
      const responseBody = isJsonResponse ? await response.json() : await response.text();

      if (!response.ok) {
        const parsedError =
          isJsonResponse && responseBody && typeof responseBody === 'object'
            ? responseBody
            : null;

        const normalizedError = this.normalizeApiErrorPayload(
          parsedError,
          typeof responseBody === 'string' && responseBody
            ? responseBody
            : `Request failed with status ${response.status}`
        );
        const errorMessage = normalizedError.message;

        const apiError = new Error(errorMessage);
        apiError.code = normalizedError.code;
        apiError.status = response.status;
        apiError.payload = parsedError;
        throw apiError;
      }

      if (isJsonResponse) {
        return responseBody;
      }

      return { success: true, data: responseBody };
    } catch (error) {
      logger.error('API request failed', error);
      throw error;
    }
  }

  // Properties API
  async getProperties(params = {}, options = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`${this.baseUrl}/properties${queryString ? `?${queryString}` : ''}`, options);
  }

  async getPropertyById(id) {
    return this.request(`${this.baseUrl}/properties/${id}`);
  }

  async getPropertyBySlug(slug) {
    return this.request(`${this.baseUrl}/properties/slug/${slug}`);
  }

  async createProperty(data) {
    return this.request(`${this.baseUrl}/properties`, {
      method: 'POST',
      body: JSON.stringify(normalizeListingPayload(data))
    });
  }

  async updateProperty(id, data) {
    return this.request(`${this.baseUrl}/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(normalizeListingPayload(data))
    });
  }

  async deleteProperty(id) {
    return this.request(`${this.baseUrl}/properties/${id}`, {
      method: 'DELETE'
    });
  }

  // Featured properties with caching
  async getFeaturedProperties(count = 4) {
    return this.request(`${this.baseUrl}/properties?limit=${count}&sortBy=createdAt&sortOrder=desc`);
  }

  async getPublicStats() {
    return this.request(`${this.baseUrl}/public-stats`);
  }

  // Search properties
  async searchProperties(searchQuery, options = {}) {
    const params = {
      search: searchQuery,
      ...options
    };
    return this.getProperties(params);
  }

  // Marketplace API
  async getMarketplaceItems(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`${this.baseUrl}/marketplace${queryString ? `?${queryString}` : ''}`);
  }

  async getMarketplaceItemById(id) {
    return this.request(`${this.baseUrl}/marketplace/${id}`);
  }

  async getMarketplaceItemBySlug(slug) {
    return this.request(`${this.baseUrl}/marketplace/slug/${slug}`);
  }

  async createMarketplaceItem(data) {
    return this.request(`${this.baseUrl}/marketplace`, {
      method: 'POST',
      body: JSON.stringify(normalizeListingPayload(data))
    });
  }

  async updateMarketplaceItem(id, data) {
    return this.request(`${this.baseUrl}/marketplace/${id}`, {
      method: 'PUT',
      body: JSON.stringify(normalizeListingPayload(data))
    });
  }

  async deleteMarketplaceItem(id) {
    return this.request(`${this.baseUrl}/marketplace/${id}`, {
      method: 'DELETE'
    });
  }

  // Tradespeople API
  async getTradespeople(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`${this.baseUrl}/tradespeople${queryString ? `?${queryString}` : ''}`);
  }

  async getServiceById(id) {
    return this.request(`${this.baseUrl}/tradespeople/${id}`);
  }

  async getServiceBySlug(slug) {
    return this.request(`${this.baseUrl}/tradespeople/slug/${slug}`);
  }

  async createService(data) {
    return this.request(`${this.baseUrl}/tradespeople`, {
      method: 'POST',
      body: JSON.stringify(normalizeListingPayload(data))
    });
  }

  async updateService(id, data) {
    return this.request(`${this.baseUrl}/tradespeople/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteService(id) {
    return this.request(`${this.baseUrl}/tradespeople/${id}`, {
      method: 'DELETE'
    });
  }

  // Featured tradespeople
  async getFeaturedTradespeople(count = 4) {
    return this.request(`${this.baseUrl}/tradespeople?limit=${count}&sortBy=createdAt&sortOrder=desc`);
  }

  // Housemates API
  async getHousemates(params = {}, options = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`${this.baseUrl}/housemates${queryString ? `?${queryString}` : ''}`, options);
  }

  async getHousemateById(id) {
    return this.request(`${this.baseUrl}/housemates/${id}`);
  }

  async getHousemateBySlug(slug) {
    return this.request(`${this.baseUrl}/housemates/slug/${slug}`);
  }

  async createHousemate(data) {
    return this.request(`${this.baseUrl}/housemates`, {
      method: 'POST',
      body: JSON.stringify(normalizeListingPayload(data))
    });
  }

  async updateHousemate(id, data) {
    return this.request(`${this.baseUrl}/housemates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(normalizeListingPayload(data))
    });
  }

  // Tradespeople/Services API methods
  async getTradespeople(params = {}) {
    const searchParams = new URLSearchParams(params);
    return this.request(`${this.baseUrl}/tradespeople?${searchParams}`);
  }

  async getTradespersonById(id) {
    return this.request(`${this.baseUrl}/tradespeople/${id}`);
  }

  async getTradespersonBySlug(slug) {
    return this.request(`${this.baseUrl}/tradespeople/slug/${slug}`);
  }

  async createTradesperson(data) {
    return this.request(`${this.baseUrl}/tradespeople`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Noticeboard API methods
  async getNoticeboards(params = {}) {
    const searchParams = new URLSearchParams(params);
    return this.request(`${this.baseUrl}/noticeboard?${searchParams}`);
  }

  async getNoticeboardById(id) {
    return this.request(`${this.baseUrl}/noticeboard/${id}`);
  }

  async getNoticeboardBySlug(slug) {
    return this.request(`${this.baseUrl}/noticeboard/slug/${slug}`);
  }

  async createNoticeboard(data) {
    return this.request(`${this.baseUrl}/noticeboard`, {
      method: 'POST',
      body: JSON.stringify(normalizeListingPayload(data))
    });
  }

  async deleteHousemate(id) {
    return this.request(`${this.baseUrl}/housemates/${id}`, {
      method: 'DELETE'
    });
  }

  // Noticeboard API
  async getNotices(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`${this.baseUrl}/noticeboard${queryString ? `?${queryString}` : ''}`);
  }

  async getNoticeById(id) {
    return this.request(`${this.baseUrl}/noticeboard/${id}`);
  }

  async getNoticeBySlug(slug) {
    return this.request(`${this.baseUrl}/noticeboard/slug/${slug}`);
  }

  async createNotice(data) {
    return this.request(`${this.baseUrl}/noticeboard`, {
      method: 'POST',
      body: JSON.stringify(normalizeListingPayload(data))
    });
  }

  async updateNotice(id, data) {
    return this.request(`${this.baseUrl}/noticeboard/${id}`, {
      method: 'PUT',
      body: JSON.stringify(normalizeListingPayload(data))
    });
  }

  async deleteNotice(id) {
    return this.request(`${this.baseUrl}/noticeboard/${id}`, {
      method: 'DELETE'
    });
  }

  // Messages API
  async sendMessage(data) {
    return this.request(`${this.baseUrl}/messages`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getMessages(type, userId) {
    return this.request(`${this.baseUrl}/messages?type=${type}&userId=${userId}`);
  }

  // Ads API
  async createAd(data) {
    return this.request(`${this.baseUrl}/ads`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getUserAds(type = null) {
    const params = type ? `?type=${type}` : '';
    return this.request(`${this.baseUrl}/ads${params}`);
  }

  // Upload API
  async uploadImage(file, draftId = null) {
    const optimized = await compressImageForUpload(file, {
      thresholdBytes: 2 * 1024 * 1024,
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.8,
      outputType: 'image/webp'
    });

    const formData = new FormData();
    formData.append('file', optimized.file);
    if (draftId) {
      formData.append('draftId', draftId);
    }

    // Get auth token for upload authorization
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('Authentication required for upload');
    }

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const normalizedError = apiService.normalizeApiErrorPayload(error, 'Upload failed');
      const apiError = new Error(normalizedError.message);
      apiError.code = normalizedError.code;
      apiError.status = response.status;
      apiError.payload = error;
      throw apiError;
    }

    return await response.json();
  }

  async deleteImage(imageUrl, draftId = null) {
    return this.request(`${this.baseUrl}/delete-image`, {
      method: 'POST',
      body: JSON.stringify({ imageUrl, draftId })
    });
  }
}

// Create singleton instance
const apiService = new ApiService();

/**
 * Helper function to get auth headers for direct fetch calls.
 * Usage: const headers = await getAuthHeaders();
 *        fetch('/api/endpoint', { headers, ... })
 */
export async function getAuthHeaders() {
  const token = await apiService.getAuthToken();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Authenticated fetch wrapper for components using direct fetch.
 * Automatically includes the Firebase ID token in Authorization header.
 */
export async function authenticatedFetch(url, options = {}) {
  const authHeaders = await getAuthHeaders();
  return fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers
    }
  });
}

export default apiService;
