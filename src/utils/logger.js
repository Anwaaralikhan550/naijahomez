'use client';

/**
 * Comprehensive logging and monitoring utilities
 */

// Log levels
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

const LOG_LEVEL_NAMES = {
  [LOG_LEVELS.DEBUG]: 'DEBUG',
  [LOG_LEVELS.INFO]: 'INFO',
  [LOG_LEVELS.WARN]: 'WARN',
  [LOG_LEVELS.ERROR]: 'ERROR',
  [LOG_LEVELS.FATAL]: 'FATAL'
};

// Logger configuration
const config = {
  level: process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG,
  enableConsole: true,
  enableRemote: process.env.NODE_ENV === 'production',
  remoteEndpoint: '/api/logs',
  maxLocalStorageEntries: 100,
  enablePerformanceTracking: true,
  enableUserTracking: true,
  enableErrorBoundary: true
};

// Log entry structure
class LogEntry {
  constructor(level, message, context = {}, logger) {
    this.timestamp = new Date().toISOString();
    this.level = level;
    this.levelName = LOG_LEVEL_NAMES[level];
    this.message = message;
    this.context = context;
    
    // Safe session ID retrieval
    try {
      this.sessionId = logger && typeof logger.getSessionId === 'function' 
        ? logger.getSessionId() 
        : 'unknown';
    } catch (error) {
      console.warn('Failed to get session ID:', error);
      this.sessionId = 'error';
    }
    
    // Safe user ID retrieval
    try {
      this.userId = logger && typeof logger.getUserId === 'function' 
        ? logger.getUserId() 
        : null;
    } catch (error) {
      console.warn('Failed to get user ID:', error);
      this.userId = null;
    }
    
    this.url = typeof window !== 'undefined' ? window.location.href : '';
    this.userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    this.id = this.generateId();
  }
  
  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }
  
  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      level: this.level,
      levelName: this.levelName,
      message: this.message,
      context: this.context,
      sessionId: this.sessionId,
      userId: this.userId,
      url: this.url,
      userAgent: this.userAgent
    };
  }
}

// Main Logger class
class Logger {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.userId = null;
    this.buffer = [];
    this.performance = new Map();
    this.errors = [];
    this.initializeErrorHandling();
    this.startPerformanceMonitoring();
  }
  
  generateSessionId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
  
  getSessionId() {
    return this.sessionId;
  }
  
  getUserId() {
    return this.userId;
  }
  
  setUserId(userId) {
    this.userId = userId;
  }
  
  // Core logging methods
  log(level, message, context = {}) {
    if (level < config.level) return;
    
    const entry = new LogEntry(level, message, {
      ...context,
      component: context.component || this.getCallerInfo(),
      performance: this.getCurrentPerformanceMetrics()
    }, this);
    
    this.processLogEntry(entry);
  }
  
  debug(message, context = {}) {
    this.log(LOG_LEVELS.DEBUG, message, context);
  }
  
  info(message, context = {}) {
    this.log(LOG_LEVELS.INFO, message, context);
  }
  
  warn(message, context = {}) {
    this.log(LOG_LEVELS.WARN, message, context);
  }
  
  error(message, error = null, context = {}) {
    const errorContext = {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      } : null
    };
    
    this.log(LOG_LEVELS.ERROR, message, errorContext);
    
    // Track errors separately
    this.trackError(message, error, context);
  }
  
  fatal(message, error = null, context = {}) {
    this.error(message, error, { ...context, fatal: true });
    this.flush(); // Ensure fatal errors are sent immediately
  }
  
  // Process log entry
  processLogEntry(entry) {
    // Add to buffer
    this.buffer.push(entry);
    
    // Console output
    if (config.enableConsole) {
      this.logToConsole(entry);
    }
    
    // Local storage (for debugging)
    this.saveToLocalStorage(entry);
    
    // Remote logging (batched)
    if (config.enableRemote && entry.level >= LOG_LEVELS.WARN) {
      this.sendToRemote(entry);
    }
    
    // Buffer management
    if (this.buffer.length > 50) {
      this.flush();
    }
  }
  
  // Console logging with formatting
  logToConsole(entry) {
    const style = this.getConsoleStyle(entry.level);
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    
    console.log(
      `%c[${timestamp}] ${entry.levelName}%c ${entry.message}`,
      style,
      'color: inherit',
      entry.context
    );
  }
  
  getConsoleStyle(level) {
    const styles = {
      [LOG_LEVELS.DEBUG]: 'color: #666; font-weight: normal',
      [LOG_LEVELS.INFO]: 'color: #0066cc; font-weight: bold',
      [LOG_LEVELS.WARN]: 'color: #ff6600; font-weight: bold',
      [LOG_LEVELS.ERROR]: 'color: #cc0000; font-weight: bold',
      [LOG_LEVELS.FATAL]: 'color: white; background: #cc0000; font-weight: bold; padding: 2px 4px'
    };
    return styles[level] || styles[LOG_LEVELS.INFO];
  }
  
  // Local storage for debugging
  saveToLocalStorage(entry) {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const key = 'app_logs';
      const logs = JSON.parse(localStorage.getItem(key) || '[]');
      logs.push(entry.toJSON());
      
      // Keep only last N entries
      if (logs.length > config.maxLocalStorageEntries) {
        logs.splice(0, logs.length - config.maxLocalStorageEntries);
      }
      
      localStorage.setItem(key, JSON.stringify(logs));
    } catch (error) {
      console.error('Failed to save log to localStorage:', error);
    }
  }
  
  // Remote logging
  async sendToRemote(entry) {
    try {
      await fetch(config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entry.toJSON())
      });
    } catch (error) {
      console.error('Failed to send log to remote:', error);
    }
  }
  
  // Batch flush logs
  async flush() {
    if (this.buffer.length === 0) return;
    
    const logsToSend = [...this.buffer];
    this.buffer = [];
    
    if (config.enableRemote) {
      try {
        await fetch(config.remoteEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            batch: true,
            logs: logsToSend.map(entry => entry.toJSON())
          })
        });
      } catch (error) {
        console.error('Failed to flush logs:', error);
        // Put logs back in buffer if send failed
        this.buffer.unshift(...logsToSend);
      }
    }
  }
  
  // Performance tracking
  startTimer(name) {
    this.performance.set(name, {
      start: performance.now(),
      name
    });
  }
  
  endTimer(name, context = {}) {
    const timer = this.performance.get(name);
    if (!timer) {
      this.warn(`Timer "${name}" not found`);
      return null;
    }
    
    const duration = performance.now() - timer.start;
    this.performance.delete(name);
    
    this.info(`Performance: ${name}`, {
      ...context,
      duration: `${duration.toFixed(2)}ms`,
      performance: true
    });
    
    return duration;
  }
  
  // Error tracking
  trackError(message, error, context = {}) {
    const errorInfo = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        fileName: error.fileName,
        lineNumber: error.lineNumber,
        columnNumber: error.columnNumber
      } : null,
      context,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      userId: this.userId,
      sessionId: this.sessionId
    };
    
    this.errors.push(errorInfo);
    
    // Keep only last 10 errors in memory
    if (this.errors.length > 10) {
      this.errors.shift();
    }
    
    // Send critical errors immediately
    if (error && (error.name === 'ChunkLoadError' || error.message?.includes('Loading CSS chunk'))) {
      this.sendErrorToRemote(errorInfo);
    }
  }
  
  async sendErrorToRemote(errorInfo) {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(errorInfo)
      });
    } catch (error) {
      console.error('Failed to send error to remote:', error);
    }
  }
  
  // Global error handling
  initializeErrorHandling() {
    if (typeof window === 'undefined') return;
    
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled Promise Rejection', event.reason, {
        type: 'unhandledrejection',
        promise: event.promise
      });
    });
    
    // Global errors
    window.addEventListener('error', (event) => {
      this.error('Global Error', event.error, {
        type: 'error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
    
    // Resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.error('Resource Load Error', null, {
          type: 'resource',
          element: event.target.tagName,
          source: event.target.src || event.target.href
        });
      }
    }, true);
  }
  
  // Performance monitoring
  startPerformanceMonitoring() {
    if (typeof window === 'undefined' || !config.enablePerformanceTracking) return;
    
    // Monitor navigation timing
    window.addEventListener('load', () => {
      setTimeout(() => {
        this.trackNavigationTiming();
      }, 100);
    });
    
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.duration > 50) {
              this.warn('Long Task detected', {
                duration: `${entry.duration.toFixed(2)}ms`,
                startTime: entry.startTime,
                name: entry.name
              });
            }
          });
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        console.warn('Long task monitoring not supported:', error);
      }
    }
  }
  
  trackNavigationTiming() {
    if (!performance.timing) return;
    
    const timing = performance.timing;
    const metrics = {
      dns: timing.domainLookupEnd - timing.domainLookupStart,
      tcp: timing.connectEnd - timing.connectStart,
      ssl: timing.secureConnectionStart ? timing.connectEnd - timing.secureConnectionStart : 0,
      ttfb: timing.responseStart - timing.requestStart,
      download: timing.responseEnd - timing.responseStart,
      domProcessing: timing.domComplete - timing.domLoading,
      totalLoad: timing.loadEventEnd - timing.navigationStart
    };
    
    this.info('Navigation Timing', {
      performance: true,
      metrics: Object.keys(metrics).reduce((acc, key) => {
        acc[key] = `${metrics[key]}ms`;
        return acc;
      }, {})
    });
  }
  
  // Utility methods
  getCallerInfo() {
    try {
      const stack = new Error().stack;
      const lines = stack.split('\n');
      const callerLine = lines[4]; // Adjust based on call stack depth
      return callerLine ? callerLine.trim() : 'unknown';
    } catch {
      return 'unknown';
    }
  }
  
  getCurrentPerformanceMetrics() {
    if (typeof performance === 'undefined') return null;
    
    return {
      memory: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      } : null,
      now: performance.now()
    };
  }
  
  // Export logs for debugging
  exportLogs() {
    const logs = {
      buffer: this.buffer.map(entry => entry.toJSON()),
      errors: this.errors,
      performance: Array.from(this.performance.entries()),
      session: {
        id: this.sessionId,
        userId: this.userId,
        timestamp: new Date().toISOString()
      }
    };
    
    return JSON.stringify(logs, null, 2);
  }
  
  // Clear all logs
  clear() {
    this.buffer = [];
    this.errors = [];
    this.performance.clear();
    
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('app_logs');
    }
  }
}

// Create singleton logger instance
const logger = new Logger();

// Convenience functions
export const debug = (message, context) => logger.debug(message, context);
export const info = (message, context) => logger.info(message, context);
export const warn = (message, context) => logger.warn(message, context);
export const error = (message, err, context) => logger.error(message, err, context);
export const fatal = (message, err, context) => logger.fatal(message, err, context);

export const startTimer = (name) => logger.startTimer(name);
export const endTimer = (name, context) => logger.endTimer(name, context);

export const setUserId = (userId) => logger.setUserId(userId);
export const flush = () => logger.flush();
export const exportLogs = () => logger.exportLogs();
export const clear = () => logger.clear();

export default logger;