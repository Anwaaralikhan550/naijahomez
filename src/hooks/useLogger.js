'use client';
import { useEffect, useRef, useCallback } from 'react';
import logger, { setUserId, startTimer, endTimer } from '@/utils/logger';

/**
 * Hook for component-level logging
 */
export const useLogger = (componentName) => {
  const componentLogger = useRef({
    debug: (message, context = {}) => 
      logger.debug(message, { ...context, component: componentName }),
    info: (message, context = {}) => 
      logger.info(message, { ...context, component: componentName }),
    warn: (message, context = {}) => 
      logger.warn(message, { ...context, component: componentName }),
    error: (message, error = null, context = {}) => 
      logger.error(message, error, { ...context, component: componentName }),
    fatal: (message, error = null, context = {}) => 
      logger.fatal(message, error, { ...context, component: componentName })
  });

  useEffect(() => {
    componentLogger.current.debug(`${componentName} mounted`);
    
    return () => {
      componentLogger.current.debug(`${componentName} unmounted`);
    };
  }, [componentName]);

  return componentLogger.current;
};

/**
 * Hook for performance tracking
 */
export const usePerformanceLogger = (operationName) => {
  const timerRef = useRef(null);
  
  const start = useCallback((context = {}) => {
    const timerKey = `${operationName}-${Date.now()}`;
    timerRef.current = timerKey;
    startTimer(timerKey);
    
    logger.debug(`Started: ${operationName}`, { performance: true, ...context });
    return timerKey;
  }, [operationName]);
  
  const end = useCallback((context = {}) => {
    if (timerRef.current) {
      const duration = endTimer(timerRef.current, { performance: true, ...context });
      timerRef.current = null;
      return duration;
    }
    return null;
  }, []);
  
  const measure = useCallback((asyncFn, context = {}) => {
    return async (...args) => {
      const timerKey = start(context);
      try {
        const result = await asyncFn(...args);
        end({ ...context, success: true });
        return result;
      } catch (error) {
        end({ ...context, success: false, error: error.message });
        throw error;
      }
    };
  }, [start, end]);
  
  return {
    start,
    end,
    measure
  };
};

/**
 * Hook for error boundary logging
 */
export const useErrorLogger = (componentName) => {
  const logError = useCallback((error, errorInfo = {}) => {
    logger.error(`Error in ${componentName}`, error, {
      component: componentName,
      errorBoundary: true,
      errorInfo,
      componentStack: errorInfo.componentStack
    });
  }, [componentName]);
  
  const logRecovery = useCallback((context = {}) => {
    logger.info(`${componentName} recovered from error`, {
      component: componentName,
      recovery: true,
      ...context
    });
  }, [componentName]);
  
  return {
    logError,
    logRecovery
  };
};

/**
 * Hook for user action logging
 */
export const useUserActionLogger = (componentName) => {
  const logAction = useCallback((action, details = {}) => {
    logger.info(`User action: ${action}`, {
      component: componentName,
      userAction: true,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  }, [componentName]);
  
  const logNavigation = useCallback((from, to, method = 'click') => {
    logger.info('User navigation', {
      component: componentName,
      navigation: true,
      from,
      to,
      method
    });
  }, [componentName]);
  
  const logFormSubmission = useCallback((formName, data = {}) => {
    const sanitizedData = Object.keys(data).reduce((acc, key) => {
      // Don't log sensitive data
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'email'];
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        acc[key] = '[REDACTED]';
      } else {
        acc[key] = data[key];
      }
      return acc;
    }, {});
    
    logger.info(`Form submitted: ${formName}`, {
      component: componentName,
      formSubmission: true,
      formName,
      data: sanitizedData
    });
  }, [componentName]);
  
  const logSearch = useCallback((query, filters = {}, results = null) => {
    logger.info('User search', {
      component: componentName,
      search: true,
      query,
      filters,
      resultCount: results ? results.length : null
    });
  }, [componentName]);
  
  const logInteraction = useCallback((element, action, details = {}) => {
    logger.debug(`User interaction: ${action} on ${element}`, {
      component: componentName,
      interaction: true,
      element,
      action,
      details
    });
  }, [componentName]);
  
  return {
    logAction,
    logNavigation,
    logFormSubmission,
    logSearch,
    logInteraction
  };
};

/**
 * Hook for API call logging
 */
export const useApiLogger = (componentName) => {
  const logApiCall = useCallback((endpoint, method = 'GET', requestData = null) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    
    logger.info(`API call: ${method} ${endpoint}`, {
      component: componentName,
      api: true,
      requestId,
      endpoint,
      method,
      requestData: requestData ? 'present' : 'none'
    });
    
    return requestId;
  }, [componentName]);
  
  const logApiResponse = useCallback((requestId, status, duration, error = null) => {
    if (error) {
      logger.error('API call failed', error, {
        component: componentName,
        api: true,
        requestId,
        status,
        duration: duration ? `${duration}ms` : null
      });
    } else {
      logger.info('API call successful', {
        component: componentName,
        api: true,
        requestId,
        status,
        duration: duration ? `${duration}ms` : null
      });
    }
  }, [componentName]);
  
  const wrapApiCall = useCallback((apiFunction, endpoint, method = 'GET') => {
    return async (...args) => {
      const requestId = logApiCall(endpoint, method, args[0]);
      const startTime = performance.now();
      
      try {
        const response = await apiFunction(...args);
        const duration = performance.now() - startTime;
        logApiResponse(requestId, response.status || 200, duration);
        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        logApiResponse(requestId, error.status || 500, duration, error);
        throw error;
      }
    };
  }, [logApiCall, logApiResponse]);
  
  return {
    logApiCall,
    logApiResponse,
    wrapApiCall
  };
};

/**
 * Hook for authentication logging
 */
export const useAuthLogger = () => {
  useEffect(() => {
    // Set user ID when component mounts and user changes
    const handleUserChange = (user) => {
      setUserId(user?.uid || null);
      
      if (user) {
        logger.info('User authenticated', {
          userId: user.uid,
          email: user.email ? '[REDACTED]' : null,
          displayName: user.displayName,
          auth: true
        });
      } else {
        logger.info('User signed out', {
          auth: true
        });
      }
    };
    
    // This would typically be connected to your auth context
    // handleUserChange(currentUser);
    
    return () => {
      // Cleanup on unmount
    };
  }, []);
  
  const logAuthAction = useCallback((action, success = true, error = null) => {
    if (success) {
      logger.info(`Auth action: ${action}`, {
        auth: true,
        action,
        success: true
      });
    } else {
      logger.error(`Auth action failed: ${action}`, error, {
        auth: true,
        action,
        success: false
      });
    }
  }, []);
  
  return {
    logAuthAction
  };
};

/**
 * Hook for development logging helpers
 */
export const useDevLogger = (componentName) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const devLog = useCallback((message, data = null) => {
    if (isDevelopment) {
      logger.debug(`[DEV] ${componentName}: ${message}`, {
        component: componentName,
        development: true,
        data
      });
    }
  }, [componentName, isDevelopment]);
  
  const devWarn = useCallback((message, data = null) => {
    if (isDevelopment) {
      logger.warn(`[DEV] ${componentName}: ${message}`, {
        component: componentName,
        development: true,
        data
      });
    }
  }, [componentName, isDevelopment]);
  
  const devError = useCallback((message, error = null, data = null) => {
    if (isDevelopment) {
      logger.error(`[DEV] ${componentName}: ${message}`, error, {
        component: componentName,
        development: true,
        data
      });
    }
  }, [componentName, isDevelopment]);
  
  return {
    devLog,
    devWarn,
    devError
  };
};

export default {
  useLogger,
  usePerformanceLogger,
  useErrorLogger,
  useUserActionLogger,
  useApiLogger,
  useAuthLogger,
  useDevLogger
};