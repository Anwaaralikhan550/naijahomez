import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { 
  withApiSecurity, 
  createErrorResponse, 
  createSuccessResponse,
  sanitizeInput 
} from '@/lib/api-validation-middleware';

// In production, you might want to store logs in a database or send to a logging service
// For now, we'll just log to console and could extend to use services like Winston, Sentry, etc.

async function handlePOST(request) {
  try {
    const body = request.parsedBody;
    const { batch, logs, ...singleLog } = body;

    if (batch && Array.isArray(logs)) {
      // Handle batch logs
      console.log('=== BATCH LOGS ===');
      logs.forEach(log => {
        logEntry(log);
      });
      console.log('=== END BATCH LOGS ===');
      
      return createSuccessResponse({ 
        received: logs.length,
        message: 'Batch logs received' 
      });
    } else {
      // Handle single log
      logEntry(singleLog);
      
      return createSuccessResponse({ 
        received: 1,
        message: 'Log received' 
      });
    }
  } catch (error) {
    console.error('Error processing logs:', error);
    return createErrorResponse('Failed to process logs', 500);
  }
}

function logEntry(log) {
  const { levelName, message, timestamp, context, userId, sessionId, url } = log;
  
  // Format for console output
  const logMessage = `[${timestamp}] ${levelName}: ${message}`;
  const metadata = {
    userId,
    sessionId,
    url,
    context: context || {}
  };
  
  // Use appropriate console method based on level
  switch (levelName) {
    case 'DEBUG':
      console.debug(logMessage, metadata);
      break;
    case 'INFO':
      console.info(logMessage, metadata);
      break;
    case 'WARN':
      console.warn(logMessage, metadata);
      break;
    case 'ERROR':
    case 'FATAL':
      console.error(logMessage, metadata);
      break;
    default:
      console.log(logMessage, metadata);
  }
  
  // In production, you might want to:
  // 1. Store in database
  // 2. Send to external logging service (Datadog, LogRocket, etc.)
  // 3. Trigger alerts for ERROR/FATAL logs
  // 4. Aggregate metrics
  
  // Example: Send critical errors to external service
  if (levelName === 'FATAL' || levelName === 'ERROR') {
    // Could integrate with Sentry, Rollbar, Bugsnag, etc.
    // await sendToCrashReporting(log);
  }
}

// Apply security middleware with rate limiting
export const POST = withApiSecurity(handlePOST, {
  rateLimitType: 'global',
  rateLimitMax: 1000, // Allow many log entries per window
  rateLimitWindowMs: 60000, // 1 minute window
  validateBody: true
});