// Client-side stub for hubFirestore
// This file prevents client-side imports of the server-only hubFirestore module

const createStubFunction = (name) => async () => {
  throw new Error(`${name} cannot be called from client-side code. Use the appropriate API endpoint instead.`);
};

// Export all hubFirestore functions as stubs
export const createAccessCode = createStubFunction('createAccessCode');
export const getAccessCodes = createStubFunction('getAccessCodes');
export const validateAccessCode = createStubFunction('validateAccessCode');
export const createDocument = createStubFunction('createDocument');
export const getDocument = createStubFunction('getDocument');
export const getDocuments = createStubFunction('getDocuments');
export const updateDocument = createStubFunction('updateDocument');
export const deleteDocument = createStubFunction('deleteDocument');
export const createIssue = createStubFunction('createIssue');
export const getIssues = createStubFunction('getIssues');
export const updateIssueStatus = createStubFunction('updateIssueStatus');

// Special handling for getUserCommunities - provide helpful error
export const getUserCommunities = async (userId) => {
  throw new Error('getUserCommunities cannot be called from client-side code. Use fetch("/api/hub/communities?userId=" + userId) instead.');
};

// Additional function stubs
export const getEmergencyAlerts = createStubFunction('getEmergencyAlerts');
export const createEmergencyAlert = createStubFunction('createEmergencyAlert');
export const getAmenities = createStubFunction('getAmenities');
export const createAmenityBooking = createStubFunction('createAmenityBooking');
export const getHubCommunity = createStubFunction('getHubCommunity');
export const getHubMember = createStubFunction('getHubMember');
export const searchHubCommunities = createStubFunction('searchHubCommunities');
export const createHubCommunity = createStubFunction('createHubCommunity');
export const createHubMember = createStubFunction('createHubMember');
export const getMarketplaceItems = createStubFunction('getMarketplaceItems');
export const createMarketplaceItem = createStubFunction('createMarketplaceItem');
export const getNotifications = createStubFunction('getNotifications');
export const createNotification = createStubFunction('createNotification');
export const validateVisitorCode = createStubFunction('validateVisitorCode');
export const getVisitorCodes = createStubFunction('getVisitorCodes');
export const createVisitorCode = createStubFunction('createVisitorCode');