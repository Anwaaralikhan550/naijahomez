// Temporary stub for session.js to fix build errors
// This will be replaced with proper client-side auth integration

export const validateSession = async (sessionId) => {
  // For now, just return null since we're using client-side auth
  return null;
};

export const generateSessionId = () => {
  // Not used anymore, but keeping for compatibility
  return '';
};

export const createSession = async (sessionId, userId) => {
  // Not used anymore, but keeping for compatibility
  return null;
};

export const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours