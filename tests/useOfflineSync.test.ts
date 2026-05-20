import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useOfflineSync } from "../hooks/useOfflineSync";
import * as offlineModule from "../lib/alumno-offline";

vi.mock("../lib/alumno-offline");

describe("useOfflineSync", () => {
  const mockQueue = [
    {
      id: "1",
      url: "/api/test",
      method: "POST",
      body: '{"test":"data"}',
      headers: { "content-type": "application/json" },
      retries: 0,
    },
    {
      id: "2",
      url: "/api/test2",
      method: "GET",
      body: undefined,
      headers: {},
      retries: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });

    const mockOfflineStore = {
      getQueue: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue(undefined),
      updateRetries: vi.fn().mockResolvedValue(undefined),
      enqueue: vi.fn().mockResolvedValue(undefined),
      init: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    Object.defineProperty(offlineModule, "offlineStore", {
      value: mockOfflineStore,
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with isSyncing false and syncedCount 0", async () => {
    const { result } = renderHook(() => useOfflineSync());

    // isSyncing might be true briefly during initialization
    // so we need to wait for it to settle
    await waitFor(() => {
      expect(result.current.isSyncing).toBe(false);
    });
    expect(result.current.syncedCount).toBe(0);
  });

  it("syncs queue on page load when online", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const mockOfflineStore = {
      getQueue: vi.fn().mockResolvedValue(mockQueue),
      remove: vi.fn().mockResolvedValue(undefined),
      updateRetries: vi.fn().mockResolvedValue(undefined),
      enqueue: vi.fn().mockResolvedValue(undefined),
      init: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    Object.defineProperty(offlineModule, "offlineStore", {
      value: mockOfflineStore,
      writable: true,
    });

    const { result } = renderHook(() => useOfflineSync());

    await waitFor(() => {
      expect(result.current.syncedCount).toBeGreaterThan(0);
    });
  });

  it("does not sync when offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    renderHook(() => useOfflineSync());

    await waitFor(() => {
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  it("syncs when online event fires", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const mockOfflineStore = {
      getQueue: vi.fn().mockResolvedValue(mockQueue),
      remove: vi.fn().mockResolvedValue(undefined),
      updateRetries: vi.fn().mockResolvedValue(undefined),
      enqueue: vi.fn().mockResolvedValue(undefined),
      init: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    Object.defineProperty(offlineModule, "offlineStore", {
      value: mockOfflineStore,
      writable: true,
    });

    renderHook(() => useOfflineSync());

    act(() => {
      const event = new Event("online");
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it("removes successful requests from queue", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const mockOfflineStore = {
      getQueue: vi.fn().mockResolvedValue(mockQueue),
      remove: vi.fn().mockResolvedValue(undefined),
      updateRetries: vi.fn().mockResolvedValue(undefined),
      enqueue: vi.fn().mockResolvedValue(undefined),
      init: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    Object.defineProperty(offlineModule, "offlineStore", {
      value: mockOfflineStore,
      writable: true,
    });

    const { result } = renderHook(() => useOfflineSync());

    await waitFor(() => {
      expect(result.current.syncedCount).toBe(mockQueue.length);
    });

    expect(mockOfflineStore.remove).toHaveBeenCalledTimes(mockQueue.length);
  });

  it("increments retries on failed requests", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    global.fetch = mockFetch;

    const mockOfflineStore = {
      getQueue: vi.fn().mockResolvedValue([
        { ...mockQueue[0], retries: 0 },
      ]),
      remove: vi.fn().mockResolvedValue(undefined),
      updateRetries: vi.fn().mockResolvedValue(undefined),
      enqueue: vi.fn().mockResolvedValue(undefined),
      init: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    Object.defineProperty(offlineModule, "offlineStore", {
      value: mockOfflineStore,
      writable: true,
    });

    const { result } = renderHook(() => useOfflineSync());

    await waitFor(() => {
      expect(result.current.isSyncing).toBe(false);
    });

    expect(mockOfflineStore.updateRetries).toHaveBeenCalledWith("1", 1);
  });

  it("does not increment retries beyond 3", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    global.fetch = mockFetch;

    const mockOfflineStore = {
      getQueue: vi.fn().mockResolvedValue([
        { ...mockQueue[0], retries: 3 },
      ]),
      remove: vi.fn().mockResolvedValue(undefined),
      updateRetries: vi.fn().mockResolvedValue(undefined),
      enqueue: vi.fn().mockResolvedValue(undefined),
      init: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    Object.defineProperty(offlineModule, "offlineStore", {
      value: mockOfflineStore,
      writable: true,
    });

    const { result } = renderHook(() => useOfflineSync());

    await waitFor(() => {
      expect(result.current.isSyncing).toBe(false);
    });

    expect(mockOfflineStore.updateRetries).not.toHaveBeenCalled();
  });

  it("handles 401 responses as successful (removes from queue)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    global.fetch = mockFetch;

    const mockOfflineStore = {
      getQueue: vi.fn().mockResolvedValue([mockQueue[0]]),
      remove: vi.fn().mockResolvedValue(undefined),
      updateRetries: vi.fn().mockResolvedValue(undefined),
      enqueue: vi.fn().mockResolvedValue(undefined),
      init: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    Object.defineProperty(offlineModule, "offlineStore", {
      value: mockOfflineStore,
      writable: true,
    });

    const { result } = renderHook(() => useOfflineSync());

    await waitFor(() => {
      expect(result.current.syncedCount).toBe(1);
    });

    expect(mockOfflineStore.remove).toHaveBeenCalledWith("1");
  });

  it("exposes syncQueue method", async () => {
    const mockOfflineStore = {
      getQueue: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue(undefined),
      updateRetries: vi.fn().mockResolvedValue(undefined),
      enqueue: vi.fn().mockResolvedValue(undefined),
      init: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    Object.defineProperty(offlineModule, "offlineStore", {
      value: mockOfflineStore,
      writable: true,
    });

    const { result } = renderHook(() => useOfflineSync());

    expect(typeof result.current.syncQueue).toBe("function");

    act(() => {
      result.current.syncQueue();
    });

    await waitFor(() => {
      expect(mockOfflineStore.getQueue).toHaveBeenCalled();
    });
  });
});
