// Client-side API service to replace direct Firestore calls
import { auth } from '@/lib/firebase-client';
import logger from '@/lib/logger';

class ApiService {
  constructor() {
    this.baseUrl = '/api';
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
      return await currentUser.getIdToken(/* forceRefresh */ false);
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

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
      }

      return await response.json();
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
      body: JSON.stringify(data)
    });
  }

  async updateProperty(id, data) {
    return this.request(`${this.baseUrl}/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
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
      body: JSON.stringify(data)
    });
  }

  async updateMarketplaceItem(id, data) {
    return this.request(`${this.baseUrl}/marketplace/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
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
      body: JSON.stringify(data)
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
      body: JSON.stringify(data)
    });
  }

  async updateHousemate(id, data) {
    return this.request(`${this.baseUrl}/housemates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
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
      body: JSON.stringify(data)
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
      body: JSON.stringify(data)
    });
  }

  async updateNotice(id, data) {
    return this.request(`${this.baseUrl}/noticeboard/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
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
    const formData = new FormData();
    formData.append('file', file);
    if (draftId) {
      formData.append('draftId', draftId);
    }

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
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