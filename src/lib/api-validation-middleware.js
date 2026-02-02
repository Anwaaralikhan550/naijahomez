// API validation middleware for Hub system
import { NextResponse } from 'next/server';
import { validateApiRequest, createRateLimiter } from '@/utils/validation';
import logger from '@/lib/logger';

// Rate limiters for different endpoints
const globalRateLimiter = createRateLimiter(100, 60000); // 100 requests per minute
const authRateLimiter = createRateLimiter(10, 60000);    // 10 auth requests per minute
const messageRateLimiter = createRateLimiter(50, 60000); // 50 messages per minute

// Get client identifier for rate limiting
const getClientIdentifier = (request) => {
  // Try to get user ID from auth, otherwise use IP
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
  
  // You could also use authenticated user ID if available
  return ip;
};

// Validation wrapper for API routes
export const withValidation = (handler, options = {}) => {
  return async (request) => {
    try {
      const {
        requiredFields = [],
        validateBody = true,
        rateLimitType = 'global',
        skipAuth = false
      } = options;

      // Rate limiting
      const clientId = getClientIdentifier(request);
      let rateLimiter;
      
      switch (rateLimitType) {
        case 'auth':
          rateLimiter = authRateLimiter;
          break;
        case 'message':
          rateLimiter = messageRateLimiter;
          break;
        default:
          rateLimiter = globalRateLimiter;
      }
      
      const rateLimit = rateLimiter(clientId);
      if (!rateLimit.allowed) {
        return NextResponse.json({
          error: rateLimit.error,
          retryAfter: rateLimit.resetTime
        }, { 
          status: 429,
          headers: {
            'Retry-After': rateLimit.resetTime.toString(),
            'X-RateLimit-Remaining': '0'
          }
        });
      }

      // Body validation for POST/PUT requests
      if (validateBody && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        let body;
        try {
          body = await request.json();
        } catch (error) {
          return NextResponse.json({
            error: 'Invalid JSON in request body'
          }, { status: 400 });
        }

        // Validate required fields
        if (requiredFields.length > 0) {
          const validation = validateApiRequest(body, requiredFields);
          if (!validation.valid) {
            return NextResponse.json({
              error: 'Validation failed',
              details: validation.errors
            }, { status: 400 });
          }
        }

        // Recreate request with parsed body for handler
        const modifiedRequest = new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(body)
        });
        modifiedRequest.parsedBody = body;
        
        return await handler(modifiedRequest);
      }

      return await handler(request);
    } catch (error) {
      logger.error('Validation middleware error', error);
      return NextResponse.json({
        error: 'Internal server error'
      }, { status: 500 });
    }
  };
};

// Specific validation functions for different data types
export const validateCommunityRequest = (data) => {
  const { validateCommunityData } = require('@/utils/validation');
  return validateCommunityData(data);
};

export const validateMemberRequest = (data) => {
  const { validateMemberData } = require('@/utils/validation');
  return validateMemberData(data);
};

export const validateMessageRequest = (data) => {
  const { validateMessage } = require('@/utils/validation');
  
  if (!data.content) {
    return { valid: false, errors: { content: 'Message content is required' } };
  }
  
  const validation = validateMessage(data.content);
  return {
    valid: validation.valid,
    errors: validation.valid ? {} : { content: validation.error }
  };
};

// Security headers middleware
export const addSecurityHeaders = (response) => {
  const headers = new Headers(response.headers);

  // CORS headers - SECURITY: Never fall back to wildcard '*'
  // In production, NEXT_PUBLIC_APP_URL must be set properly
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
  } else {
    // Development fallback - restrict to localhost only
    // In production, this should NEVER be reached
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      // In production without proper config, deny cross-origin requests
      // by not setting the header at all (browser will block)
      console.error('SECURITY WARNING: NEXT_PUBLIC_APP_URL not set in production!');
    } else {
      // Development mode - allow localhost origins
      headers.set('Access-Control-Allow-Origin', 'http://localhost:3000');
    }
  }
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Allow-Credentials', 'true');
  
  // Security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  headers.set('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https:; " +
    "frame-ancestors 'none';"
  );
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
};

// Combined middleware wrapper
export const withApiSecurity = (handler, validationOptions = {}) => {
  const validatedHandler = withValidation(handler, validationOptions);
  
  return async (request) => {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return addSecurityHeaders(new Response(null, { status: 200 }));
    }
    
    try {
      const response = await validatedHandler(request);
      return addSecurityHeaders(response);
    } catch (error) {
      logger.error('API Security middleware error', error);
      const errorResponse = NextResponse.json({
        error: 'Internal server error'
      }, { status: 500 });
      return addSecurityHeaders(errorResponse);
    }
  };
};

// Input sanitization middleware
export const sanitizeInput = (data) => {
  const { sanitizeHTML } = require('@/utils/validation');
  
  if (typeof data === 'string') {
    return sanitizeHTML(data.trim());
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    Object.keys(data).forEach(key => {
      sanitized[key] = sanitizeInput(data[key]);
    });
    return sanitized;
  }
  
  return data;
};

// Error response helper
export const createErrorResponse = (message, status = 400, details = null) => {
  const response = { error: message };
  if (details) response.details = details;
  
  return NextResponse.json(response, { status });
};

// Success response helper
export const createSuccessResponse = (data, message = null) => {
  const response = { success: true, ...data };
  if (message) response.message = message;
  
  return NextResponse.json(response);
};

export default {
  withValidation,
  withApiSecurity,
  validateCommunityRequest,
  validateMemberRequest,
  validateMessageRequest,
  addSecurityHeaders,
  sanitizeInput,
  createErrorResponse,
  createSuccessResponse
};