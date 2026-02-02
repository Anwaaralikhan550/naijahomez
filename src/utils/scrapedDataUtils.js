// Utility functions for handling scraped listing data

/**
 * Check if a listing is from scraped data (no real user account)
 * @param {Object} listing - The listing object
 * @returns {boolean} - True if scraped listing, false if user-created
 */
export function isScrapedListing(listing) {
  const userId = listing.userId || listing.agent?.id;
  return !userId || userId === 'unknown' || userId === '' || userId === 'system';
}

/**
 * Get available contact methods for a listing
 * @param {Object} listing - The listing object
 * @returns {Object} - Available contact methods
 */
export function getContactMethods(listing) {
  return {
    phone: listing.phoneNumber || listing.contact?.phone || listing.agent?.phone || null,
    email: listing.email || listing.contact?.email || listing.agent?.email || null,
    website: listing.website || listing.contact?.website || null,
    whatsapp: listing.whatsappNumber || listing.contact?.whatsapp || null
  };
}

/**
 * Format phone number for WhatsApp (Nigerian format)
 * @param {string} phone - The phone number
 * @returns {string} - Formatted phone number
 */
export function formatPhoneForWhatsApp(phone) {
  if (!phone) return null;
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Handle Nigerian numbers
  if (digits.length === 10) {
    // Add Nigeria country code
    return `234${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    // Replace leading 0 with 234
    return `234${digits.substring(1)}`;
  } else if (digits.length === 13 && digits.startsWith('234')) {
    // Already in correct format
    return digits;
  }
  
  return digits; // Return as-is if format is unclear
}

/**
 * Create WhatsApp URL with pre-filled message
 * @param {string} phone - The phone number
 * @param {string} listingTitle - The listing title
 * @param {string} listingType - The type of listing
 * @returns {string} - WhatsApp URL
 */
export function createWhatsAppUrl(phone, listingTitle = '', listingType = 'listing') {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  if (!formattedPhone) return null;
  
  const message = `Hello, I'm interested in your ${listingType} listing${listingTitle ? `: ${listingTitle}` : ''} on Nijahomzs.`;
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Create email URL with pre-filled subject and body
 * @param {string} email - The email address
 * @param {string} listingTitle - The listing title
 * @param {string} listingType - The type of listing
 * @param {string} message - Custom message
 * @returns {string} - mailto URL
 */
export function createEmailUrl(email, listingTitle = '', listingType = 'listing', message = '') {
  if (!email) return null;
  
  const subject = `Inquiry about ${listingType} listing${listingTitle ? `: ${listingTitle}` : ''}`;
  const body = message || `Hello,\n\nI'm interested in your ${listingType} listing${listingTitle ? ` "${listingTitle}"` : ''} that I found on Nijahomzs.\n\nPlease provide more details.\n\nThank you.`;
  
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Get display name for listing owner
 * @param {Object} listing - The listing object
 * @returns {string} - Display name
 */
export function getOwnerDisplayName(listing) {
  return listing.userName || 
         listing.ownerName || 
         listing.agent?.name || 
         listing.contact?.name || 
         'Property Owner';
}

/**
 * Create system user ID for scraped listings
 * This can be used as a fallback recipient for analytics/admin purposes
 * @returns {string} - System user ID
 */
export function getSystemUserId() {
  return 'system-scraped-listings';
}

/**
 * Determine the best contact method for a scraped listing
 * @param {Object} listing - The listing object
 * @returns {Object} - Recommended contact method
 */
export function getBestContactMethod(listing) {
  const contacts = getContactMethods(listing);
  
  // Prioritize WhatsApp/Phone for Nigerian market
  if (contacts.phone) {
    return {
      type: 'phone',
      value: contacts.phone,
      label: 'Phone/WhatsApp',
      action: 'call'
    };
  }
  
  if (contacts.whatsapp) {
    return {
      type: 'whatsapp',
      value: contacts.whatsapp,
      label: 'WhatsApp',
      action: 'message'
    };
  }
  
  if (contacts.email) {
    return {
      type: 'email',
      value: contacts.email,
      label: 'Email',
      action: 'email'
    };
  }
  
  if (contacts.website) {
    return {
      type: 'website',
      value: contacts.website,
      label: 'Website',
      action: 'visit'
    };
  }
  
  return null;
}