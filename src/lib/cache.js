// Simple in-memory cache with TTL
class Cache {
  constructor() {
    this.store = new Map();
    this.timers = new Map();
  }

  set(key, value, ttl = 300000) { // Default 5 minutes
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Set the value
    this.store.set(key, {
      value,
      timestamp: Date.now()
    });

    // Set expiration timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);

    this.timers.set(key, timer);
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    return item.value;
  }

  delete(key) {
    this.store.delete(key);
    
    // Clear timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    this.store.clear();
    this.timers.clear();
  }

  has(key) {
    return this.store.has(key);
  }
}

// Create singleton instance
const cache = new Cache();

// Cache keys generator
export const cacheKeys = {
  properties: (params) => `properties:${JSON.stringify(params)}`,
  property: (id) => `property:${id}`,
  propertyBySlug: (slug) => `property:slug:${slug}`,
  featuredProperties: () => 'featured:properties',
  
  marketplace: (params) => `marketplace:${JSON.stringify(params)}`,
  marketplaceItem: (id) => `marketplace:${id}`,
  marketplaceBySlug: (slug) => `marketplace:slug:${slug}`,
  
  tradespeople: (params) => `tradespeople:${JSON.stringify(params)}`,
  service: (id) => `service:${id}`,
  serviceBySlug: (slug) => `service:slug:${slug}`,
  
  housemates: (params) => `housemates:${JSON.stringify(params)}`,
  housemate: (id) => `housemate:${id}`,
  housemateBySlug: (slug) => `housemate:slug:${slug}`,
  
  noticeboard: (params) => `noticeboard:${JSON.stringify(params)}`,
  notice: (id) => `notice:${id}`,
  noticeBySlug: (slug) => `notice:slug:${slug}`,
  
  userAds: (userId, type) => `user:${userId}:ads:${type || 'all'}`
};

export default cache;