// utils/propertyMigration.js

/**
 * Utility functions to migrate legacy property data to the enhanced format
 * and to ensure backward compatibility when viewing old listings
 */

/**
 * Convert a legacy property object to the enhanced format
 * @param {Object} legacyProperty - The old property data format
 * @returns {Object} - The enhanced property data format
 */
export function migratePropertyToEnhancedFormat(legacyProperty) {
    if (!legacyProperty) return null;
    
    // Create base enhanced property with all the legacy fields
    const enhancedProperty = { ...legacyProperty };
    
    // Extract price information
    const priceInfo = extractPriceInfo(legacyProperty.price);
    
    // Set up the enhanced structure
    enhancedProperty.rentType = priceInfo.type;
    enhancedProperty.rentAmount = {
      monthly: priceInfo.type === 'monthly' ? priceInfo.value : '',
      annual: priceInfo.type === 'annual' ? priceInfo.value : ''
    };
    
    // Initialize address if not present
    if (!enhancedProperty.address) {
      enhancedProperty.address = {
        street: '',
        town: extractTownFromLocation(legacyProperty.location),
        state: extractStateFromLocation(legacyProperty.location)
      };
    }
    
    // Initialize boys quarters if not present
    if (!enhancedProperty.boysQuarters) {
      enhancedProperty.boysQuarters = {
        available: false,
        rooms: ''
      };
    }
    
    // Initialize parking if not present
    if (!enhancedProperty.parking) {
      enhancedProperty.parking = {
        available: true,
        spaces: '1'
      };
    }
    
    // Initialize amenities if not present
    if (!enhancedProperty.amenities) {
      enhancedProperty.amenities = [];
    }
    
    // Initialize furnishing if not present
    if (!enhancedProperty.furnishing) {
      enhancedProperty.furnishing = 'not_furnished';
    }
    
    // Initialize fees if not present
    if (!enhancedProperty.fees) {
      enhancedProperty.fees = {
        agency: {
          type: 'percentage',
          value: '10'
        },
        legal: {
          type: 'percentage',
          value: '5'
        },
        caution: {
          required: true,
          value: priceInfo.value // Default to one month/year rent
        },
        service: {
          required: false,
          type: 'fixed',
          value: ''
        },
        other: []
      };
    }
    
    // Initialize contact if not present
    if (!enhancedProperty.contact) {
      enhancedProperty.contact = {
        phone: legacyProperty.userPhone || '',
        email: legacyProperty.userEmail || '',
        website: ''
      };
    }
    
    return enhancedProperty;
  }
  
  /**
   * Extract price information from the legacy price string
   * @param {string} priceString - The price string (e.g., "₦150,000/month")
   * @returns {Object} - The parsed price info with value and type
   */
  function extractPriceInfo(priceString) {
    if (!priceString) {
      return { value: '', type: 'monthly' };
    }
    
    // Convert to string if not already
    priceString = String(priceString);
    
    // Default values
    let type = 'monthly';
    let value = '';
    
    // Check if it's annual or monthly
    if (priceString.toLowerCase().includes('/year') || 
        priceString.toLowerCase().includes('per year') ||
        priceString.toLowerCase().includes('per annum') ||
        priceString.toLowerCase().includes('/annum')) {
      type = 'annual';
    }
    
    // Extract the numeric value
    const numericMatch = priceString.match(/[0-9,]+/);
    if (numericMatch) {
      value = numericMatch[0].replace(/,/g, '');
    }
    
    return { value, type };
  }
  
  /**
   * Try to extract town from location string
   * @param {string} location - The location string
   * @returns {string} - The extracted town, or empty string if not found
   */
  function extractTownFromLocation(location) {
    if (!location) return '';
    
    // Convert to string if not already
    location = String(location);
    
    // Common town/area patterns in Nigerian addresses
    const commonTowns = [
      'Lekki', 'Ikeja', 'Victoria Island', 'Ikoyi', 'Ajah', 'Yaba', 
      'Surulere', 'Gbagada', 'Magodo', 'Maryland', 'Ojodu', 'Festac', 
      'Apapa', 'Lagos Island', 'Lagos Mainland', 'Abuja', 'Port Harcourt',
      'Ibadan', 'Kano', 'Calabar', 'Warri', 'Benin City', 'Owerri', 
      'Enugu', 'Asaba', 'Onitsha', 'Kaduna', 'Sokoto', 'Abeokuta'
    ];
    
    // Try to match known towns
    for (const town of commonTowns) {
      if (location.includes(town)) {
        return town;
      }
    }
    
    // If comma separated, try to extract town (typically second to last part)
    if (location.includes(',')) {
      const parts = location.split(',').map(part => part.trim());
      if (parts.length >= 2) {
        return parts[parts.length - 2];
      }
    }
    
    return '';
  }
  
  /**
   * Try to extract state from location string
   * @param {string} location - The location string
   * @returns {string} - The extracted state, or empty string if not found
   */
  function extractStateFromLocation(location) {
    if (!location) return '';
    
    // Convert to string if not already
    location = String(location);
    
    // Common Nigerian states
    const nigerianStates = [
      'Lagos', 'FCT', 'Abuja', 'Rivers', 'Oyo', 'Kano', 'Enugu', 
      'Kaduna', 'Imo', 'Delta', 'Anambra', 'Edo', 'Ogun', 'Osun',
      'Akwa Ibom', 'Bayelsa', 'Benue', 'Cross River', 'Ebonyi', 
      'Ekiti', 'Gombe', 'Jigawa', 'Katsina', 'Kebbi', 'Kogi', 
      'Kwara', 'Nasarawa', 'Niger', 'Ondo', 'Plateau', 'Sokoto',
      'Taraba', 'Yobe', 'Zamfara', 'Abia', 'Adamawa', 'Bauchi', 'Borno'
    ];
    
    // Try to match known states
    for (const state of nigerianStates) {
      if (location.includes(state)) {
        return state;
      }
    }
    
    // If comma separated, try to extract state (typically last part)
    if (location.includes(',')) {
      const parts = location.split(',').map(part => part.trim());
      return parts[parts.length - 1];
    }
    
    return '';
  }
  
  /**
   * Normalize a property object, ensuring all necessary fields exist
   * for display in both old and new formats
   * @param {Object} property - The property object to normalize
   * @returns {Object} - The normalized property object
   */
  export function normalizePropertyObject(property) {
    if (!property) return null;
    
    // Create a copy to avoid modifying the original
    const normalizedProperty = { ...property };
    
    // Ensure basic fields exist
    normalizedProperty.title = normalizedProperty.title || '';
    normalizedProperty.description = normalizedProperty.description || '';
    normalizedProperty.location = normalizedProperty.location || '';
    normalizedProperty.price = normalizedProperty.price || '';
    normalizedProperty.propertyType = normalizedProperty.propertyType || normalizedProperty.type || '';
    normalizedProperty.bedrooms = normalizedProperty.bedrooms || '';
    normalizedProperty.bathrooms = normalizedProperty.bathrooms || '';
    normalizedProperty.squareMeters = normalizedProperty.squareMeters || '';
    normalizedProperty.imageUrls = normalizedProperty.imageUrls || [];
    
    // Check if it's an enhanced property
    const isEnhanced = normalizedProperty.address || 
                      normalizedProperty.rentAmount || 
                      normalizedProperty.fees || 
                      normalizedProperty.contact || 
                      normalizedProperty.amenities;
    
    // If not enhanced, add placeholder enhanced fields for compatibility
    if (!isEnhanced) {
      const enhancedFields = migratePropertyToEnhancedFormat(normalizedProperty);
      
      // Merge enhanced fields, but keep original values where they exist
      Object.keys(enhancedFields).forEach(key => {
        if (!normalizedProperty[key]) {
          normalizedProperty[key] = enhancedFields[key];
        }
      });
    }
    
    return normalizedProperty;
  }
  
  /**
   * Batch update function to migrate multiple properties at once
   * @param {Array} properties - Array of property objects to migrate
   * @returns {Array} - Array of migrated property objects
   */
  export function batchMigrateProperties(properties) {
    if (!properties || !Array.isArray(properties)) return [];
    
    return properties.map(property => normalizePropertyObject(property));
  }
  
  /**
   * Function to merge property data from form submission with existing property data
   * @param {Object} existingProperty - The existing property data
   * @param {Object} formData - The new form data to merge
   * @returns {Object} - The merged property data
   */
  export function mergePropertyData(existingProperty, formData) {
    if (!existingProperty) return formData;
    if (!formData) return existingProperty;
    
    // Start with all existing property data
    const mergedProperty = { ...existingProperty };
    
    // Override with new form data
    Object.keys(formData).forEach(key => {
      // Special handling for nested objects
      if (key === 'address' || key === 'rentAmount' || key === 'fees' || 
          key === 'contact' || key === 'boysQuarters' || key === 'parking') {
        mergedProperty[key] = {
          ...(mergedProperty[key] || {}),
          ...(formData[key] || {})
        };
      } else {
        mergedProperty[key] = formData[key];
      }
    });
    
    // Ensure updatedAt timestamp is set
    mergedProperty.updatedAt = new Date();
    
    return mergedProperty;
  }