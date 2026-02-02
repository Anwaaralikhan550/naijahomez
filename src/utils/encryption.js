// Simple encryption utility for client-side data protection
// Note: This is for obfuscation, not security against determined attackers
// Real security should be handled server-side

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'nijahomzs_hub_default_key_2024';

// Simple XOR encryption for client-side data obfuscation
function simpleEncrypt(text, key) {
  if (!text) return '';
  
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const keyChar = key.charCodeAt(i % key.length);
    const textChar = text.charCodeAt(i);
    result += String.fromCharCode(textChar ^ keyChar);
  }
  
  // Base64 encode to make it safe for localStorage
  return btoa(result);
}

function simpleDecrypt(encryptedText, key) {
  if (!encryptedText) return '';
  
  try {
    // Base64 decode first
    const text = atob(encryptedText);
    
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const keyChar = key.charCodeAt(i % key.length);
      const textChar = text.charCodeAt(i);
      result += String.fromCharCode(textChar ^ keyChar);
    }
    
    return result;
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}

// More robust encryption using Web Crypto API (where available)
class SecureStorage {
  constructor(keyName = 'hubSecureKey') {
    this.keyName = keyName;
    this.key = null;
    this.isWebCryptoSupported = 'crypto' in window && 'subtle' in window.crypto;
  }

  async generateKey() {
    if (!this.isWebCryptoSupported) {
      return ENCRYPTION_KEY;
    }

    try {
      const key = await window.crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256,
        },
        true,
        ['encrypt', 'decrypt']
      );
      
      // Export key to store it
      const exportedKey = await window.crypto.subtle.exportKey('jwk', key);
      localStorage.setItem(this.keyName, JSON.stringify(exportedKey));
      
      return key;
    } catch (error) {
      console.warn('Web Crypto API failed, falling back to simple encryption:', error);
      return ENCRYPTION_KEY;
    }
  }

  async getKey() {
    if (this.key) return this.key;

    if (!this.isWebCryptoSupported) {
      this.key = ENCRYPTION_KEY;
      return this.key;
    }

    try {
      const storedKey = localStorage.getItem(this.keyName);
      if (storedKey) {
        const keyData = JSON.parse(storedKey);
        this.key = await window.crypto.subtle.importKey(
          'jwk',
          keyData,
          {
            name: 'AES-GCM',
            length: 256,
          },
          true,
          ['encrypt', 'decrypt']
        );
      } else {
        this.key = await this.generateKey();
      }
      
      return this.key;
    } catch (error) {
      console.warn('Key loading failed, falling back to simple encryption:', error);
      this.key = ENCRYPTION_KEY;
      return this.key;
    }
  }

  async encrypt(data) {
    if (!data) return '';

    const key = await this.getKey();
    
    // If Web Crypto is not supported, use simple encryption
    if (typeof key === 'string') {
      return simpleEncrypt(JSON.stringify(data), key);
    }

    try {
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(JSON.stringify(data));
      
      // Generate a random IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        dataBytes
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Convert to base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.warn('Web Crypto encryption failed, falling back:', error);
      return simpleEncrypt(JSON.stringify(data), ENCRYPTION_KEY);
    }
  }

  async decrypt(encryptedData) {
    if (!encryptedData) return null;

    const key = await this.getKey();
    
    // If Web Crypto is not supported, use simple decryption
    if (typeof key === 'string') {
      const decrypted = simpleDecrypt(encryptedData, key);
      try {
        return JSON.parse(decrypted);
      } catch {
        return null;
      }
    }

    try {
      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(decrypted);
      
      return JSON.parse(decryptedText);
    } catch (error) {
      console.warn('Web Crypto decryption failed, trying fallback:', error);
      const decrypted = simpleDecrypt(encryptedData, ENCRYPTION_KEY);
      try {
        return JSON.parse(decrypted);
      } catch {
        return null;
      }
    }
  }
}

// Create a singleton instance
const secureStorage = new SecureStorage();

// Convenience functions
export const encryptData = (data) => secureStorage.encrypt(data);
export const decryptData = (encryptedData) => secureStorage.decrypt(encryptedData);

// Secure localStorage wrapper
export const secureLocalStorage = {
  setItem: async (key, value) => {
    try {
      const encrypted = await encryptData(value);
      localStorage.setItem(key, encrypted);
    } catch (error) {
      console.error('Secure storage setItem failed:', error);
      // Fallback to regular storage in extreme cases
      localStorage.setItem(key, JSON.stringify(value));
    }
  },

  getItem: async (key) => {
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;
      
      const decrypted = await decryptData(encrypted);
      return decrypted;
    } catch (error) {
      console.error('Secure storage getItem failed:', error);
      // Try to parse as regular JSON as fallback
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch {
        return null;
      }
    }
  },

  removeItem: (key) => {
    localStorage.removeItem(key);
  },

  clear: () => {
    localStorage.clear();
  }
};

// Legacy functions for backward compatibility
export const simpleEncryptData = (data) => simpleEncrypt(JSON.stringify(data), ENCRYPTION_KEY);
export const simpleDecryptData = (encryptedData) => {
  try {
    const decrypted = simpleDecrypt(encryptedData, ENCRYPTION_KEY);
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
};

export default secureStorage;