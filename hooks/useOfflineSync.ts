"use client";

import { useEffect, useState } from "react";
import { offlineStore } from "@/lib/alumno-offline";

export function useOfflineSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);

  const syncQueue = async () => {
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
    setIsSyncing(false);
  };

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
