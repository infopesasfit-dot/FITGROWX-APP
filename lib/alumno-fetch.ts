"use client";

import { offlineStore } from "./alumno-offline";

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  skipOfflineQueue?: boolean;
}

interface FetchError extends Error {
  status?: number;
  isNetworkError?: boolean;
  isTimeoutError?: boolean;
}

export async function alumnoFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { retries = 2, retryDelay = 1000, timeout = 10000, skipOfflineQueue = false, ...fetchOptions } = options;

  let lastError: FetchError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(url, {
        ...fetchOptions,
        credentials: "include",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 401 no reintentar - sesión expirada
      if (res.status === 401) {
        return res;
      }

      // 429 reintentar después de delay
      if (res.status === 429 && attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
        continue;
      }

      return res;
    } catch (err) {
      const error: FetchError = new Error(
        err instanceof Error ? err.message : "Network error"
      );

      if (err instanceof Error && err.name === "AbortError") {
        error.isTimeoutError = true;
      } else {
        error.isNetworkError = true;
      }

      lastError = error;

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }
  }

  // Enqueue in offline store if network error and not skipping
  if (lastError?.isNetworkError && !skipOfflineQueue && typeof window !== "undefined" && !navigator.onLine) {
    const body = fetchOptions.body ?
      (typeof fetchOptions.body === "string" ? fetchOptions.body : JSON.stringify(fetchOptions.body)) :
      undefined;

    try {
      await offlineStore.enqueue({
        url,
        method: fetchOptions.method || "GET",
        body,
        headers: fetchOptions.headers as Record<string, string> | undefined,
      });
    } catch (enqueueErr) {
      console.error("[alumnoFetch] Failed to enqueue offline request:", enqueueErr);
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  onError?: (error: Error) => void
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    const error = err instanceof Error ? err : new Error("Unknown error");
    onError?.(error);
    console.error("[withErrorHandling]", error);
    return null;
  }
}
