"use client";

const DB_NAME = "fitgrowx_alumno";
const DB_VERSION = 1;
const STORE_NAME = "offline_queue";

interface OfflineRequest {
  id: string;
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
  timestamp: number;
  retries: number;
}

export class AlumnoOfflineStore {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        this.db = req.result;
        resolve();
      };

      req.onupgradeneeded = (ev) => {
        const db = (ev.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
    });
  }

  async enqueue(req: Omit<OfflineRequest, "id" | "timestamp" | "retries">): Promise<string> {
    if (!this.db) await this.init();

    const id = `${Date.now()}-${Math.random()}`;
    const item: OfflineRequest = {
      ...req,
      id,
      timestamp: Date.now(),
      retries: 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const addReq = store.add(item);

      addReq.onerror = () => reject(addReq.error);
      addReq.onsuccess = () => resolve(id);
    });
  }

  async getQueue(): Promise<OfflineRequest[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || []);
    });
  }

  async remove(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async updateRetries(id: string, retries: number): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onerror = () => reject(getReq.error);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (item) {
          item.retries = retries;
          const updateReq = store.put(item);
          updateReq.onerror = () => reject(updateReq.error);
          updateReq.onsuccess = () => resolve();
        }
      };
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const req = store.clear();

      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }
}

export const offlineStore = new AlumnoOfflineStore();

export function useOfflineDetection(onOnline?: () => void, onOffline?: () => void) {
  if (typeof window === "undefined") return;

  const handleOnline = () => {
    onOnline?.();
  };

  const handleOffline = () => {
    onOffline?.();
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
