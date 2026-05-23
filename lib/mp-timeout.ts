type MpFetchOptions = {
  method?: "GET" | "POST" | "PUT";
  headers?: Record<string, string>;
  body?: string;
  retryable?: boolean;
};

type MpFetchResult = {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
};

const TIMEOUT_MS = 8000;
const MAX_RETRIES_IDEMPOTENT = 2;

export async function fetchMpWithTimeout(
  url: string,
  opts: MpFetchOptions = {},
): Promise<MpFetchResult> {
  const isIdempotent = opts.retryable ?? opts.method !== "POST";
  const maxRetries = isIdempotent ? MAX_RETRIES_IDEMPOTENT : 0;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await fetch(url, {
        method: opts.method || "GET",
        headers: opts.headers,
        body: opts.body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (response.ok) {
        const data = await response.json().catch(() => null);
        return { ok: true, status: response.status, data };
      }

      // Retry only on 503 (Service Unavailable) for idempotent calls
      if (response.status === 503 && attempt <= maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 500;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      const error = await response.text().catch(() => "");
      return { ok: false, status: response.status, data: null, error };
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === "AbortError";

      // Retry timeout on idempotent calls
      if (isTimeout && attempt <= maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 500;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return {
        ok: false,
        status: 0,
        data: null,
        error: isTimeout ? "MP API timeout" : String(err),
      };
    }
  }

  return {
    ok: false,
    status: 0,
    data: null,
    error: "Max retries exceeded",
  };
}
