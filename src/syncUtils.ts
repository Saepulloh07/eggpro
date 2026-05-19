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

export const syncRecord = async (key: string, record: any) => {
  if (!record || !record.id) return;
  
  // Add timestamp for conflict resolution
  record.updatedAt = new Date().toISOString();
  
  // 1. Update/Add to local storage array
  const encryptedLocalData = await localforage.getItem<string>(key);
  let data: any[] = [];
  if (encryptedLocalData) {
    data = decryptData(encryptedLocalData) || [];
  }
  
  const index = data.findIndex(item => item.id === record.id);
  if (index !== -1) {
    data[index] = record;
  } else {
    data.push(record);
  }
  
  await localforage.setItem(key, encryptData(data));

  // 2. Sync individual record to backend
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiUrl}/api/sync/${key}/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    if (!res.ok) throw new Error('Server error');
  } catch (error) {
    console.warn(`[Offline] Queueing individual sync for ${key}:${record.id}`, error);
    // Add to a specific record-based sync queue if needed, or reuse key-based queue
    const queue = await localforage.getItem<string[]>('sync_queue') || [];
    if (!queue.includes(key)) {
      await localforage.setItem('sync_queue', [...queue, key]);
    }
  }
};

export const deleteRecord = async (key: string, id: string) => {
  if (!id) return;
  
  // 1. Update local storage
  const encryptedLocalData = await localforage.getItem<string>(key);
  if (encryptedLocalData) {
    const data = decryptData(encryptedLocalData) || [];
    const filtered = data.filter((item: any) => item.id !== id);
    await localforage.setItem(key, encryptData(filtered));
  }

  // 2. Sync deletion to backend
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiUrl}/api/sync/${key}/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Server error');
  } catch (error) {
    console.warn(`[Offline] Queueing deletion for ${key}:${id}`, error);
    // Add to specific delete queue
    const queue = await localforage.getItem<{key: string, id: string}[]>('sync_delete_queue') || [];
    queue.push({ key, id });
    await localforage.setItem('sync_delete_queue', queue);
  }
};

export const syncToDb = async (key: string, data: any) => {
  // Keeping this for compatibility but marking as potentially dangerous for multi-user
  console.warn(`[Sync] syncToDb called for ${key}. Use syncRecord for incremental updates.`);
  
  let cleanData = data;
  // ... rest of logic stays similar but we should be careful
  if (typeof cleanData === 'string') {
    try { cleanData = JSON.parse(cleanData); } catch (e) {}
  }

  const encrypted = encryptData(cleanData);
  await localforage.setItem(key, encrypted);
  
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiUrl}/api/sync/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanData)
    });
    if (!res.ok) throw new Error('Server error');
  } catch (error) {
    const queue = await localforage.getItem<string[]>('sync_queue') || [];
    if (!queue.includes(key)) {
      await localforage.setItem('sync_queue', [...queue, key]);
    }
  }
};

export const processSyncQueue = async () => {
  const apiUrl = import.meta.env.VITE_API_URL || '';

  // Process offline deletions first
  const delQueue = await localforage.getItem<{key: string, id: string}[]>('sync_delete_queue') || [];
  if (delQueue.length > 0) {
    const remainingDelQueue = [];
    for (const del of delQueue) {
      try {
        const res = await fetch(`${apiUrl}/api/sync/${del.key}/${del.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
      } catch (e) {
        remainingDelQueue.push(del);
      }
    }
    await localforage.setItem('sync_delete_queue', remainingDelQueue);
  }

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

          const apiUrl = import.meta.env.VITE_API_URL || '';
          const res = await fetch(`${apiUrl}/api/sync/${key}`, {
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
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiUrl}/api/sync/${key}`);
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

export const resetAllData = async () => {
  try {
    // 1. Reset Backend
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiUrl}/api/sync/all/reset`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to reset backend');
    
    // 2. Reset LocalForage
    await localforage.clear();
    
    // 3. Reset LocalStorage
    localStorage.clear();
    
    return true;
  } catch (error) {
    console.error('Reset error:', error);
    throw error;
  }
};
