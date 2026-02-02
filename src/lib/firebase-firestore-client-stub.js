// Stub for 'firebase/firestore' imports to prevent build errors
// This replaces the client-side Firebase Firestore SDK

console.warn('firebase/firestore is deprecated. Use API endpoints instead.');

// Mock functions that throw helpful errors
const createStubFunction = (name) => () => {
  throw new Error(`${name} is deprecated. Use API endpoints instead of direct Firestore access.`);
};

// Export all commonly imported functions from firebase/firestore
export const getFirestore = createStubFunction('getFirestore');
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
export const connectFirestoreEmulator = createStubFunction('connectFirestoreEmulator');
export const enableNetwork = createStubFunction('enableNetwork');
export const disableNetwork = createStubFunction('disableNetwork');
export const waitForPendingWrites = createStubFunction('waitForPendingWrites');
export const terminate = createStubFunction('terminate');
export const clearIndexedDbPersistence = createStubFunction('clearIndexedDbPersistence');
export const enableIndexedDbPersistence = createStubFunction('enableIndexedDbPersistence');
export const enableMultiTabIndexedDbPersistence = createStubFunction('enableMultiTabIndexedDbPersistence');
export const getCountFromServer = createStubFunction('getCountFromServer');

// Export field value helpers
export const FieldValue = {
  serverTimestamp: createStubFunction('FieldValue.serverTimestamp'),
  increment: createStubFunction('FieldValue.increment'),
  arrayUnion: createStubFunction('FieldValue.arrayUnion'),
  arrayRemove: createStubFunction('FieldValue.arrayRemove'),
  delete: createStubFunction('FieldValue.delete')
};

export const Timestamp = {
  now: createStubFunction('Timestamp.now'),
  fromDate: createStubFunction('Timestamp.fromDate'),
  fromMillis: createStubFunction('Timestamp.fromMillis')
};