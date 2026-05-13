import localforage from 'localforage';
import CryptoJS from 'crypto-js';

const SECRET_KEY = 'PoultryMindSecureKey2026'; // Secret key for local IndexedDB encryption

// Helper to encrypt data
const encryptData = (data: any): string => {
  return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
};

// Helper to decrypt data
const decryptData = (ciphertext: any): any => {
  if (!ciphertext) return null;
  
  // If it's already an object (not a string), it's old unencrypted data from localforage
  if (typeof ciphertext !== 'string') {
    return ciphertext;
  }

  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedStr) {
      // If decryption returns empty, it might be unencrypted string
      try { return JSON.parse(ciphertext); } catch(e) { return ciphertext; }
    }
    const decryptedData = JSON.parse(decryptedStr);
    return decryptedData;
  } catch (err) {
    // Fallback: try to parse it as raw JSON if decryption fails
    try {
      return JSON.parse(ciphertext);
    } catch (e) {
      console.error('Error decrypting data:', err);
      return null;
    }
  }
};

export const syncToDb = async (key: string, data: any) => {
  // Ensure data is an object/array if it's a stringified JSON (could be multiple times)
  let cleanData = data;
  while (typeof cleanData === 'string') {
    try {
      const parsed = JSON.parse(cleanData);
      if (typeof parsed === 'object' && parsed !== null) {
        cleanData = parsed;
      } else {
        break;
      }
    } catch (e) {
      break;
    }
  }

  // 1. Save locally to IndexedDB (Encrypted)
  const encrypted = encryptData(cleanData);
  await localforage.setItem(key, encrypted);
  
  // 2. Try syncing to Backend (Decrypted / Plain)
  try {
    const res = await fetch(`/api/sync/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanData)
    });
    if (!res.ok) throw new Error('Server error');
  } catch (error) {
    console.warn(`[Offline] Queueing sync for ${key}`, error);
    // 3. Add to IndexedDB sync queue
    const queue = await localforage.getItem<string[]>('sync_queue') || [];
    if (!queue.includes(key)) {
      await localforage.setItem('sync_queue', [...queue, key]);
    }
  }
};

export const processSyncQueue = async () => {
  const queue = await localforage.getItem<string[]>('sync_queue') || [];
  if (queue.length === 0) return;
  
  const newQueue = [];
  for (const key of queue) {
    try {
      const encryptedData = await localforage.getItem<string>(key);
      if (encryptedData) {
        let decryptedData = decryptData(encryptedData);
        if (decryptedData) {
          // Robust cleaning: Unstringify as many times as needed
          while (typeof decryptedData === 'string') {
            try {
              const parsed = JSON.parse(decryptedData);
              if (typeof parsed === 'object' && parsed !== null) {
                decryptedData = parsed;
              } else {
                break;
              }
            } catch (e) {
              break;
            }
          }

          const res = await fetch(`/api/sync/${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(decryptedData)
          });
          if (!res.ok) throw new Error('Server error');
          console.log(`[Online] Synced queued data for ${key}`);
        }
      }
    } catch (error) {
      newQueue.push(key); // Keep in queue if still failing
    }
  }
  await localforage.setItem('sync_queue', newQueue);
};

// Start background listener for online events
if (typeof window !== 'undefined') {
  window.addEventListener('online', processSyncQueue);
  // Also try periodically every 1 minute
  setInterval(processSyncQueue, 60000);
}

export const loadFromDbOrIndexedDB = async (key: string, setter: (val: any) => void) => {
  try {
    // 1. Try to load from Backend
    const res = await fetch(`/api/sync/${key}`);
    if (res.ok) {
      let data = await res.json();
      // Robust cleaning: Unstringify as many times as needed
      while (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          if (typeof parsed === 'object' && parsed !== null) {
            data = parsed;
          } else {
            break;
          }
        } catch (e) {
          break;
        }
      }
      setter(data);
      // Save locally (Encrypted)
      await localforage.setItem(key, encryptData(data));
      return;
    }
  } catch (err) {
    console.warn(`[Offline] Falling back to IndexedDB for ${key}`);
  }
  
  // 2. Fallback to IndexedDB
  const encryptedLocalData = await localforage.getItem<string>(key);
  if (encryptedLocalData) {
    const decryptedData = decryptData(encryptedLocalData);
    if (decryptedData) {
      setter(decryptedData);
    }
  }
};
