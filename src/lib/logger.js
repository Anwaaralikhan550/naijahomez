/**
 * Production-ready logger utility with environment-based log levels.
 *
 * Usage:
 *   import logger from '@/lib/logger';
 *   logger.info('User logged in', { userId: user.uid });
 *   logger.error('Failed to fetch data', error);
 *   logger.warn('Deprecated API usage');
 *   logger.debug('Debug info'); // Only in development
 *
 * Environment variables:
 *   - NODE_ENV: 'development' | 'production' | 'test'
 *   - NEXT_PUBLIC_LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error' | 'none' (optional)
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4
};

// Determine current log level based on environment
function getLogLevel() {
  // Allow explicit override via env variable
  const envLevel = typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_LOG_LEVEL
    : process.env.LOG_LEVEL || process.env.NEXT_PUBLIC_LOG_LEVEL;

  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return LOG_LEVELS[envLevel];
  }

  // Default based on NODE_ENV
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production') {
    return LOG_LEVELS.warn; // Only warn and error in production
  }
  if (nodeEnv === 'test') {
    return LOG_LEVELS.error; // Only errors in test
  }
  return LOG_LEVELS.debug; // All logs in development
}

const currentLevel = getLogLevel();
const isProduction = process.env.NODE_ENV === 'production';

// Format message with optional context
function formatMessage(level, message, context) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (context) {
    return { prefix, message, context };
  }
  return { prefix, message };
}

// Sanitize sensitive data in production
function sanitizeForProduction(data) {
  if (!isProduction || !data) return data;

  // Create a shallow copy to avoid mutating original
  if (typeof data === 'object') {
    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    // Remove sensitive fields
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'authorization', 'cookie'];
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return sanitized;
  }
  return data;
}

const logger = {
  /**
   * Debug level - development only, verbose logging
   */
  debug(message, context = null) {
    if (currentLevel <= LOG_LEVELS.debug) {
      const { prefix, message: msg } = formatMessage('debug', message, context);
      if (context) {
        console.log(prefix, msg, sanitizeForProduction(context));
      } else {
        console.log(prefix, msg);
      }
    }
  },

  /**
   * Info level - general information, development and staging
   */
  info(message, context = null) {
    if (currentLevel <= LOG_LEVELS.info) {
      const { prefix, message: msg } = formatMessage('info', message, context);
      if (context) {
        console.info(prefix, msg, sanitizeForProduction(context));
      } else {
        console.info(prefix, msg);
      }
    }
  },

  /**
   * Warn level - warnings, included in production
   */
  warn(message, context = null) {
    if (currentLevel <= LOG_LEVELS.warn) {
      const { prefix, message: msg } = formatMessage('warn', message, context);
      if (context) {
        console.warn(prefix, msg, sanitizeForProduction(context));
      } else {
        console.warn(prefix, msg);
      }
    }
  },

  /**
   * Error level - errors, always logged
   */
  error(message, error = null, context = null) {
    if (currentLevel <= LOG_LEVELS.error) {
      const { prefix, message: msg } = formatMessage('error', message);

      // Format error object for logging
      const errorInfo = error ? {
        message: error.message,
        code: error.code,
        stack: isProduction ? undefined : error.stack
      } : null;

      if (errorInfo && context) {
        console.error(prefix, msg, errorInfo, sanitizeForProduction(context));
      } else if (errorInfo) {
        console.error(prefix, msg, errorInfo);
      } else if (context) {
        console.error(prefix, msg, sanitizeForProduction(context));
      } else {
        console.error(prefix, msg);
      }
    }
  },

  /**
   * Check if a log level is enabled
   */
  isEnabled(level) {
    return currentLevel <= LOG_LEVELS[level];
  },

  /**
   * Get current log level name
   */
  getLevel() {
    return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === currentLevel) || 'unknown';
  }
};

export default logger;

// Named exports for direct import
export const { debug, info, warn, error } = logger;
