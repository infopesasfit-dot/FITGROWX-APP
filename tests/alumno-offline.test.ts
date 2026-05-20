import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AlumnoOfflineStore } from "../lib/alumno-offline";

describe("AlumnoOfflineStore", () => {
  let store: AlumnoOfflineStore;

  beforeEach(async () => {
    store = new AlumnoOfflineStore();
    await store.init();
  });

  afterEach(async () => {
    await store.clear();
  });

  it("initializes without errors", async () => {
    expect(store).toBeDefined();
  });

  it("enqueues a request with auto-generated id and timestamp", async () => {
    const id = await store.enqueue({
      url: "/api/test",
      method: "POST",
      body: '{"test":"data"}',
      headers: { "content-type": "application/json" },
    });

    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("retrieves enqueued requests from queue", async () => {
    await store.enqueue({
      url: "/api/test1",
      method: "POST",
      body: '{"data":"1"}',
    });

    await store.enqueue({
      url: "/api/test2",
      method: "GET",
    });

    const queue = await store.getQueue();

    expect(queue).toHaveLength(2);
    const urls = queue.map((r) => r.url);
    expect(urls).toContain("/api/test1");
    expect(urls).toContain("/api/test2");
  });

  it("returns empty queue when no requests are enqueued", async () => {
    const queue = await store.getQueue();
    expect(queue).toEqual([]);
  });

  it("removes request from queue by id", async () => {
    const id = await store.enqueue({
      url: "/api/test",
      method: "POST",
    });

    let queue = await store.getQueue();
    expect(queue).toHaveLength(1);

    await store.remove(id);

    queue = await store.getQueue();
    expect(queue).toHaveLength(0);
  });

  it("updates retry count for a request", async () => {
    const id = await store.enqueue({
      url: "/api/test",
      method: "POST",
    });

    let queue = await store.getQueue();
    expect(queue[0].retries).toBe(0);

    await store.updateRetries(id, 1);

    queue = await store.getQueue();
    expect(queue[0].retries).toBe(1);
  });

  it("increments retry count multiple times", async () => {
    const id = await store.enqueue({
      url: "/api/test",
      method: "POST",
    });

    await store.updateRetries(id, 1);
    await store.updateRetries(id, 2);
    await store.updateRetries(id, 3);

    const queue = await store.getQueue();
    expect(queue[0].retries).toBe(3);
  });

  it("clears all requests from queue", async () => {
    await store.enqueue({ url: "/api/test1", method: "POST" });
    await store.enqueue({ url: "/api/test2", method: "GET" });
    await store.enqueue({ url: "/api/test3", method: "DELETE" });

    let queue = await store.getQueue();
    expect(queue).toHaveLength(3);

    await store.clear();

    queue = await store.getQueue();
    expect(queue).toHaveLength(0);
  });

  it("preserves request metadata (url, method, body, headers)", async () => {
    const body = JSON.stringify({ alumno_id: "123", data: "test" });
    const headers = { "content-type": "application/json", authorization: "Bearer token" };

    await store.enqueue({
      url: "/api/alumno/test",
      method: "POST",
      body,
      headers,
    });

    const queue = await store.getQueue();
    const request = queue[0];

    expect(request.url).toBe("/api/alumno/test");
    expect(request.method).toBe("POST");
    expect(request.body).toBe(body);
    expect(request.headers).toEqual(headers);
  });

  it("stores timestamp for each enqueued request", async () => {
    const beforeTime = Date.now();

    await store.enqueue({
      url: "/api/test",
      method: "GET",
    });

    const afterTime = Date.now();

    const queue = await store.getQueue();
    const request = queue[0];

    expect(request.timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(request.timestamp).toBeLessThanOrEqual(afterTime);
  });

  it("generates unique ids for multiple enqueues", async () => {
    const id1 = await store.enqueue({ url: "/api/test1", method: "GET" });
    const id2 = await store.enqueue({ url: "/api/test2", method: "GET" });
    const id3 = await store.enqueue({ url: "/api/test3", method: "GET" });

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });

  it("handles optional body and headers", async () => {
    const id = await store.enqueue({
      url: "/api/test",
      method: "GET",
    });

    const queue = await store.getQueue();
    const request = queue[0];

    expect(request.body).toBeUndefined();
    expect(request.headers).toBeUndefined();
  });

  it("allows reinit after clearing", async () => {
    await store.enqueue({ url: "/api/test", method: "POST" });
    await store.clear();

    const queue1 = await store.getQueue();
    expect(queue1).toHaveLength(0);

    const id = await store.enqueue({ url: "/api/test2", method: "GET" });
    expect(id).toBeTruthy();

    const queue2 = await store.getQueue();
    expect(queue2).toHaveLength(1);
  });

  it("does not remove wrong request on delete", async () => {
    const id1 = await store.enqueue({ url: "/api/test1", method: "POST" });
    const id2 = await store.enqueue({ url: "/api/test2", method: "GET" });

    await store.remove(id1);

    const queue = await store.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].url).toBe("/api/test2");
  });

  it("handles multiple rapid enqueues", async () => {
    const promises = Array(10)
      .fill(null)
      .map((_, i) =>
        store.enqueue({
          url: `/api/test${i}`,
          method: "POST",
        })
      );

    const ids = await Promise.all(promises);

    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);

    const queue = await store.getQueue();
    expect(queue).toHaveLength(10);
  });
});
