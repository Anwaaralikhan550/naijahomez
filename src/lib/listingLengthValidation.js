const MAX_STRING_LENGTH_DEFAULT = 5000;

const FIELD_MAX_LENGTHS = {
  title: 160,
  name: 160,
  description: 5000,
  location: 180,
  interestedAreas: 300,
  houseRules: 2000,
  serviceType: 80,
  propertyType: 80,
  category: 80,
  subCategory: 80,
  condition: 80,
  noticeType: 60,
  jobType: 60,
  salary: 120,
  organizer: 120,
  company: 120,
  venue: 200,
  availability: 120,
  phoneNumber: 30,
  userPhoneNumber: 30,
  email: 254,
  userEmail: 254,
  website: 2048
};

export function validateListingStringLengths(input, path = '') {
  if (typeof input === 'string') {
    const key = path.split('.').pop() || '';
    const maxLength = FIELD_MAX_LENGTHS[key] || MAX_STRING_LENGTH_DEFAULT;
    if (input.length > maxLength) {
      return {
        valid: false,
        field: path || key || 'value',
        maxLength,
        actualLength: input.length
      };
    }
    return { valid: true };
  }

  if (Array.isArray(input)) {
    for (let i = 0; i < input.length; i += 1) {
      const result = validateListingStringLengths(input[i], `${path}[${i}]`);
      if (!result.valid) return result;
    }
    return { valid: true };
  }

  if (input && typeof input === 'object') {
    for (const [key, value] of Object.entries(input)) {
      const nextPath = path ? `${path}.${key}` : key;
      const result = validateListingStringLengths(value, nextPath);
      if (!result.valid) return result;
    }
  }

  return { valid: true };
}

export function buildLengthExceededErrorMessage(lengthValidation) {
  return `Field '${lengthValidation.field}' exceeds max length of ${lengthValidation.maxLength} characters`;
}

