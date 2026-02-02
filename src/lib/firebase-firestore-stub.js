// Comprehensive stub for Firebase Firestore client functions
// All database operations now use API endpoints

console.warn('Firebase Firestore client SDK is deprecated. Use API endpoints instead.');

// Mock functions that throw helpful errors
const createStubFunction = (name) => () => {
  throw new Error(`${name} is deprecated. Use API endpoints instead of direct Firestore access.`);
};

// Export all commonly used Firestore functions as stubs
export const collection = createStubFunction('collection');
export const doc = createStubFunction('doc'); 
export const getDoc = createStubFunction('getDoc');
export const getDocs = createStubFunction('getDocs');
export const setDoc = createStubFunction('setDoc');
export const addDoc = createStubFunction('addDoc');
export const updateDoc = createStubFunction('updateDoc');
export const deleteDoc = createStubFunction('deleteDoc');
export const query = createStubFunction('query');
export const where = createStubFunction('where');
export const orderBy = createStubFunction('orderBy');
export const limit = createStubFunction('limit');
export const startAfter = createStubFunction('startAfter');
export const endAt = createStubFunction('endAt');
export const onSnapshot = createStubFunction('onSnapshot');
export const serverTimestamp = createStubFunction('serverTimestamp');
export const increment = createStubFunction('increment');
export const arrayUnion = createStubFunction('arrayUnion');
export const arrayRemove = createStubFunction('arrayRemove');
export const FieldValue = {
  serverTimestamp: createStubFunction('FieldValue.serverTimestamp'),
  increment: createStubFunction('FieldValue.increment'),
  arrayUnion: createStubFunction('FieldValue.arrayUnion'),
  arrayRemove: createStubFunction('FieldValue.arrayRemove'),
};