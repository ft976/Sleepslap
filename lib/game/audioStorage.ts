import type { AudioKey } from './types';

const DB_NAME = 'sleep_slap_assets_db';
const DB_VERSION = 1;
const STORE_AUDIOS = 'custom_audios';

export interface StoredAudioRecord {
  key: AudioKey;
  fileName: string;
  blob: Blob;
}

function openAssetsDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_AUDIOS)) {
          db.createObjectStore(STORE_AUDIOS, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveStoredAudio(
  key: AudioKey,
  fileName: string,
  blob: Blob
): Promise<void> {
  const db = await openAssetsDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_AUDIOS, 'readwrite');
      tx.objectStore(STORE_AUDIOS).put({ key, fileName, blob } satisfies StoredAudioRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadAllStoredAudios(): Promise<StoredAudioRecord[]> {
  const db = await openAssetsDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_AUDIOS, 'readonly');
      const req = tx.objectStore(STORE_AUDIOS).getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? (req.result as StoredAudioRecord[]) : [];
        resolve(rows);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function deleteStoredAudio(key: AudioKey): Promise<void> {
  const db = await openAssetsDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_AUDIOS, 'readwrite');
      tx.objectStore(STORE_AUDIOS).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearAllStoredAudios(): Promise<void> {
  const db = await openAssetsDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_AUDIOS, 'readwrite');
      tx.objectStore(STORE_AUDIOS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
