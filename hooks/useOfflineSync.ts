"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { offlineStore } from "@/lib/alumno-offline";

export function useOfflineSync(onSyncComplete?: () => void | Promise<void>) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const syncCallbackRef = useRef(onSyncComplete);

  useEffect(() => {
    syncCallbackRef.current = onSyncComplete;
  }, [onSyncComplete]);

  const syncQueue = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return;

    setIsSyncing(true);
    const queue = await offlineStore.getQueue();
    let successCount = 0;

    for (const item of queue) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
          credentials: "include",
        });

        if (res.ok || res.status === 401) {
          await offlineStore.remove(item.id);
          successCount++;
        } else if (item.retries < 3) {
          await offlineStore.updateRetries(item.id, item.retries + 1);
        }
      } catch (err) {
        if (item.retries < 3) {
          await offlineStore.updateRetries(item.id, item.retries + 1);
        }
      }
    }

    setSyncedCount(successCount);
    // Llamar callback después de sincronizar (para recargar datos)
    if (successCount > 0 && syncCallbackRef.current) {
      await syncCallbackRef.current();
    }
    setIsSyncing(false);
  }, [isSyncing]);

  useEffect(() => {
    const handleOnline = () => {
      syncQueue();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [isSyncing]);

  useEffect(() => {
    if (navigator.onLine) {
      syncQueue();
    }
  }, []);

  return { isSyncing, syncedCount, syncQueue };
}
