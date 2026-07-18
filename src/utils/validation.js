// Comprehensive validation utilities for Hub system
const DANGEROUS_TAGS = ['iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'meta', 'link', 'style', 'base'];
const DANGEROUS_TAG_PATTERNS = DANGEROUS_TAGS.map((tag) => ({
  open: new RegExp(`<${tag}[^>]*>`, 'gi'),
  close: new RegExp(`</${tag}>`, 'gi'),
  selfClose: new RegExp(`<${tag}[^>]*/>`, 'gi')
}));

// Email validation
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone number validation (flexible format)
export const isValidPhone = (phone) => {
  const phoneRegex = /^[\+]?[1-9]?[\d\s\-\(\)]{7,15}$/;
  return phoneRegex.test(phone);
};

// Access code validation
export const isValidAccessCode = (code) => {
  // Access codes should be 6-10 alphanumeric characters
  const codeRegex = /^[A-Z0-9]{6,10}$/;
  return codeRegex.test(code);
};

// Text validation with length constraints
export const validateText = (text, minLength = 0, maxLength = 500) => {
  if (!text || typeof text !== 'string') {
    return { valid: false, error: 'Text is required' };
  }
  
  const trimmed = text.trim();
  if (trimmed.length < minLength) {
    return { valid: false, error: `Text must be at least ${minLength} characters` };
  }
  
  if (trimmed.length > maxLength) {
    return { valid: false, error: `Text must be no more than ${maxLength} characters` };
  }
  
  return { valid: true, value: trimmed };
};

// Community data validation
export const validateCommunityData = (data) => {
  const errors = {};
  
  // Name validation
  const nameValidation = validateText(data.name, 2, 100);
  if (!nameValidation.valid) {
    errors.name = nameValidation.error;
  }
  
  // Description validation
  const descValidation = validateText(data.description, 10, 500);
  if (!descValidation.valid) {
    errors.description = descValidation.error;
  }
  
  // Location validation
  const locationValidation = validateText(data.location, 2, 100);
  if (!locationValidation.valid) {
    errors.location = locationValidation.error;
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      name: nameValidation.valid ? nameValidation.value : data.name,
      description: descValidation.valid ? descValidation.value : data.description,
      location: locationValidation.valid ? locationValidation.value : data.location,
      isPublic: !!data.isPublic
    }
  };
};

// Member data validation
export const validateMemberData = (data) => {
  const errors = {};
  
  // Name validation
  if (!data.userName || data.userName.trim().length < 2) {
    errors.userName = 'Name must be at least 2 characters';
  } else if (data.userName.trim().length > 50) {
    errors.userName = 'Name must be no more than 50 characters';
  }
  
  // Email validation
  if (!data.userEmail) {
    errors.userEmail = 'Email is required';
  } else if (!isValidEmail(data.userEmail)) {
    errors.userEmail = 'Please enter a valid email address';
  }
  
  // Phone validation (optional)
  if (data.phoneNumber && !isValidPhone(data.phoneNumber)) {
    errors.phoneNumber = 'Please enter a valid phone number';
  }
  
  // Apartment/unit validation (optional)
  if (data.apartment && (data.apartment.length < 1 || data.apartment.length > 20)) {
    errors.apartment = 'Unit number must be 1-20 characters';
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      userName: data.userName?.trim(),
      userEmail: data.userEmail?.trim().toLowerCase(),
      phoneNumber: data.phoneNumber?.trim(),
      apartment: data.apartment?.trim(),
      building: data.building?.trim(),
      role: data.role || 'member'
    }
  };
};

// Message validation
export const validateMessage = (content, maxLength = 1000) => {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Message content is required' };
  }
  
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  if (trimmed.length > maxLength) {
    return { valid: false, error: `Message too long (max ${maxLength} characters)` };
  }
  
  return { valid: true, value: trimmed };
};

// Event data validation
export const validateEventData = (data) => {
  const errors = {};
  
  // Title validation
  const titleValidation = validateText(data.title, 3, 100);
  if (!titleValidation.valid) {
    errors.title = titleValidation.error;
  }
  
  // Description validation
  const descValidation = validateText(data.description, 10, 1000);
  if (!descValidation.valid) {
    errors.description = descValidation.error;
  }
  
  // Date validation
  if (!data.eventDate) {
    errors.eventDate = 'Event date is required';
  } else {
    const eventDate = new Date(data.eventDate);
    const now = new Date();
    if (eventDate < now) {
      errors.eventDate = 'Event date must be in the future';
    }
  }
  
  // Time validation (optional)
  if (data.eventTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data.eventTime)) {
    errors.eventTime = 'Please enter time in HH:MM format';
  }
  
  // Location validation (optional)
  if (data.location) {
    const locationValidation = validateText(data.location, 2, 100);
    if (!locationValidation.valid) {
      errors.location = locationValidation.error;
    }
  }
  
  // Max participants validation (optional)
  if (data.maxParticipants && (isNaN(data.maxParticipants) || data.maxParticipants < 1)) {
    errors.maxParticipants = 'Max participants must be a positive number';
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      title: titleValidation.valid ? titleValidation.value : data.title,
      description: descValidation.valid ? descValidation.value : data.description,
      eventDate: data.eventDate,
      eventTime: data.eventTime?.trim(),
      location: data.location?.trim(),
      maxParticipants: data.maxParticipants ? parseInt(data.maxParticipants) : null,
      isPublic: !!data.isPublic,
      requiresApproval: !!data.requiresApproval
    }
  };
};

// Access code request validation
export const validateAccessCodeRequest = (data) => {
  const errors = {};
  
  // Name validation
  const nameValidation = validateText(data.name, 2, 50);
  if (!nameValidation.valid) {
    errors.name = nameValidation.error;
  }
  
  // Email validation
  if (!data.email) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(data.email)) {
    errors.email = 'Please enter a valid email address';
  }
  
  // Phone validation (optional)
  if (data.phone && !isValidPhone(data.phone)) {
    errors.phone = 'Please enter a valid phone number';
  }
  
  // Message validation (optional)
  if (data.message) {
    const messageValidation = validateText(data.message, 0, 500);
    if (!messageValidation.valid) {
      errors.message = messageValidation.error;
    }
  }
  
  // Community ID validation
  if (!data.communityId) {
    errors.communityId = 'Community ID is required';
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      name: nameValidation.valid ? nameValidation.value : data.name,
      email: data.email?.trim().toLowerCase(),
      phone: data.phone?.trim(),
      message: data.message?.trim() || '',
      communityId: data.communityId
    }
  };
};

// Sanitize HTML content to prevent XSS
// SECURITY: Comprehensive sanitization - strips ALL potentially dangerous content
export const sanitizeHTML = (html) => {
  if (!html) return '';
  if (typeof html !== 'string') return '';

  let sanitized = html;

  // Remove all script tags (including variations)
  sanitized = sanitized.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<script[\s\S]*?\/>/gi, '');
  sanitized = sanitized.replace(/<script[\s\S]*?>/gi, '');

  // Remove all event handlers (with or without quotes, with or without spaces)
  // Matches: onclick=, onclick =, onclick= "...", onclick='...', onclick=...
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Remove javascript: protocol (including encoded variations)
  sanitized = sanitized.replace(/javascript\s*:/gi, '');
  sanitized = sanitized.replace(/java\s*script\s*:/gi, '');
  sanitized = sanitized.replace(/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, '');
  // Handle HTML entity encoded versions
  sanitized = sanitized.replace(/&#x?[0-9a-f]+;?/gi, (match) => {
    // Decode and check if it's trying to spell javascript
    const decoded = match.replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
                         .replace(/&#(\d+);?/gi, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
    if (/javascript/i.test(decoded)) return '';
    return match;
  });

  // Remove vbscript: protocol
  sanitized = sanitized.replace(/vbscript\s*:/gi, '');

  // Remove data: protocol for non-image content (can execute JS)
  sanitized = sanitized.replace(/data\s*:\s*(?!image\/)[^,]*,/gi, 'data:blocked,');

  // Remove expression() - IE CSS expression
  sanitized = sanitized.replace(/expression\s*\(/gi, 'blocked(');

  // Remove dangerous tags entirely
  DANGEROUS_TAG_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern.open, '');
    sanitized = sanitized.replace(pattern.close, '');
    sanitized = sanitized.replace(pattern.selfClose, '');
  });

  // Remove SVG with potential XSS vectors
  sanitized = sanitized.replace(/<svg[\s\S]*?>[\s\S]*?<\/svg>/gi, '');
  sanitized = sanitized.replace(/<svg[\s\S]*?\/>/gi, '');

  // Remove form elements that could be used for phishing
  sanitized = sanitized.replace(/<form[\s\S]*?>[\s\S]*?<\/form>/gi, '');
  sanitized = sanitized.replace(/<input[\s\S]*?>/gi, '');
  sanitized = sanitized.replace(/<button[\s\S]*?>[\s\S]*?<\/button>/gi, '');

  return sanitized.trim();
};

// File validation
export const validateFile = (file, maxSizeMB = 10, allowedTypes = ['image/jpeg', 'image/png', 'image/gif']) => {
  if (!file) {
    return { valid: false, error: 'File is required' };
  }
  
  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { valid: false, error: `File size must be less than ${maxSizeMB}MB` };
  }
  
  // Check file type
  if (!allowedTypes.includes(file.type)) {
    const allowedTypesStr = allowedTypes.map(type => type.split('/')[1]).join(', ');
    return { valid: false, error: `File type must be: ${allowedTypesStr}` };
  }
  
  return { valid: true };
};

// Generic API request validator
export const validateApiRequest = (data, requiredFields = []) => {
  const errors = {};
  
  // Check required fields
  requiredFields.forEach(field => {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      errors[field] = `${field} is required`;
    }
  });
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};

// Rate limiting helper
export const createRateLimiter = (maxRequests = 10, windowMs = 60000) => {
  const requests = new Map();
  let lastCleanup = 0;
  
  return (identifier) => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Periodically clean old request timestamps in bulk.
    if (now - lastCleanup >= windowMs) {
      for (const [key, timestamps] of requests.entries()) {
        const validTimestamps = timestamps.filter((time) => time > windowStart);
        if (validTimestamps.length > 0) {
          requests.set(key, validTimestamps);
        } else {
          requests.delete(key);
        }
      }
      lastCleanup = now;
    }
    
    // Check current requests
    let userRequests = requests.get(identifier) || [];
    if (userRequests.length > 0 && userRequests[0] <= windowStart) {
      userRequests = userRequests.filter((time) => time > windowStart);
      if (userRequests.length > 0) {
        requests.set(identifier, userRequests);
      } else {
        requests.delete(identifier);
      }
    }

    if (userRequests.length >= maxRequests) {
      return {
        allowed: false,
        error: 'Rate limit exceeded. Please try again later.',
        resetTime: Math.ceil((userRequests[0] + windowMs - now) / 1000)
      };
    }
    
    // Add new request
    userRequests.push(now);
    requests.set(identifier, userRequests);
    
    return { allowed: true };
  };
};

export default {
  isValidEmail,
  isValidPhone,
  isValidAccessCode,
  validateText,
  validateCommunityData,
  validateMemberData,
  validateMessage,
  validateEventData,
  validateAccessCodeRequest,
  sanitizeHTML,
  validateFile,
  validateApiRequest,
  createRateLimiter
};
