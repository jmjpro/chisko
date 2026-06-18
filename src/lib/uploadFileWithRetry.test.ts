// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { uploadFileWithRetry } from "./uploadFileWithRetry";

class FakeXMLHttpRequest {
  static instances: FakeXMLHttpRequest[] = [];
  upload = { onprogress: null as ((e: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  responseText = "";
  open() {}
  setRequestHeader() {}
  send() {}

  constructor() {
    FakeXMLHttpRequest.instances.push(this);
  }
}

describe("uploadFileWithRetry", () => {
  it("resolves with the parsed result on a successful upload", async () => {
    FakeXMLHttpRequest.instances = [];
    const originalXHR = global.XMLHttpRequest;
    // @ts-expect-error stubbing global XHR with a deterministic fake for the test
    global.XMLHttpRequest = FakeXMLHttpRequest;

    try {
      const file = new File(["a,b,c"], "meter.csv", { type: "text/csv" });
      const promise = uploadFileWithRetry(file, "https://upload.example/put");

      const xhr = FakeXMLHttpRequest.instances[0];
      xhr.responseText = JSON.stringify({ storageId: "storage123" });
      xhr.onload?.();

      await expect(promise).resolves.toEqual({ storageId: "storage123" });
    } finally {
      global.XMLHttpRequest = originalXHR;
    }
  });

  it("forwards upload progress percentages to onProgress", async () => {
    FakeXMLHttpRequest.instances = [];
    const originalXHR = global.XMLHttpRequest;
    // @ts-expect-error stubbing global XHR with a deterministic fake for the test
    global.XMLHttpRequest = FakeXMLHttpRequest;

    try {
      const file = new File(["a,b,c"], "meter.csv", { type: "text/csv" });
      const onProgress = vi.fn();
      const promise = uploadFileWithRetry(file, "https://upload.example/put", {
        onProgress,
      });

      const xhr = FakeXMLHttpRequest.instances[0];
      xhr.upload.onprogress?.({
        loaded: 50,
        total: 200,
      } as ProgressEvent);
      xhr.upload.onprogress?.({
        loaded: 200,
        total: 200,
      } as ProgressEvent);

      xhr.responseText = JSON.stringify({ storageId: "storage123" });
      xhr.onload?.();
      await promise;

      expect(onProgress).toHaveBeenCalledWith(25);
      expect(onProgress).toHaveBeenCalledWith(100);
    } finally {
      global.XMLHttpRequest = originalXHR;
    }
  });

  it("retries on failure and succeeds on a later attempt", async () => {
    FakeXMLHttpRequest.instances = [];
    const originalXHR = global.XMLHttpRequest;
    // @ts-expect-error stubbing global XHR with a deterministic fake for the test
    global.XMLHttpRequest = FakeXMLHttpRequest;
    vi.useFakeTimers();

    try {
      const file = new File(["a,b,c"], "meter.csv", { type: "text/csv" });
      const onRetry = vi.fn();
      const promise = uploadFileWithRetry(file, "https://upload.example/put", {
        onRetry,
      });

      FakeXMLHttpRequest.instances[0].onerror?.();
      await vi.runOnlyPendingTimersAsync();

      FakeXMLHttpRequest.instances[1].responseText = JSON.stringify({
        storageId: "storage123",
      });
      FakeXMLHttpRequest.instances[1].onload?.();

      await expect(promise).resolves.toEqual({ storageId: "storage123" });
      expect(onRetry).toHaveBeenCalledWith(2);
      expect(FakeXMLHttpRequest.instances).toHaveLength(2);
    } finally {
      vi.useRealTimers();
      global.XMLHttpRequest = originalXHR;
    }
  });

  it("rejects after exhausting all attempts", async () => {
    FakeXMLHttpRequest.instances = [];
    const originalXHR = global.XMLHttpRequest;
    // @ts-expect-error stubbing global XHR with a deterministic fake for the test
    global.XMLHttpRequest = FakeXMLHttpRequest;
    vi.useFakeTimers();

    try {
      const file = new File(["a,b,c"], "meter.csv", { type: "text/csv" });
      const promise = uploadFileWithRetry(file, "https://upload.example/put");
      const assertion = expect(promise).rejects.toThrow("Upload failed");

      for (let i = 0; i < 3; i++) {
        FakeXMLHttpRequest.instances[i].onerror?.();
        await vi.runOnlyPendingTimersAsync();
      }

      await assertion;
      expect(FakeXMLHttpRequest.instances).toHaveLength(3);
    } finally {
      vi.useRealTimers();
      global.XMLHttpRequest = originalXHR;
    }
  });

  it("requests the wake lock on start and releases it on success", async () => {
    FakeXMLHttpRequest.instances = [];
    const originalXHR = global.XMLHttpRequest;
    // @ts-expect-error stubbing global XHR with a deterministic fake for the test
    global.XMLHttpRequest = FakeXMLHttpRequest;
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    // @ts-expect-error stubbing the Wake Lock API, which jsdom doesn't implement
    navigator.wakeLock = { request };

    try {
      const file = new File(["a,b,c"], "meter.csv", { type: "text/csv" });
      const promise = uploadFileWithRetry(file, "https://upload.example/put");

      const xhr = FakeXMLHttpRequest.instances[0];
      xhr.responseText = JSON.stringify({ storageId: "storage123" });
      xhr.onload?.();
      await promise;

      expect(request).toHaveBeenCalledWith("screen");
      expect(release).toHaveBeenCalled();
    } finally {
      global.XMLHttpRequest = originalXHR;
      // @ts-expect-error removing the stub
      delete navigator.wakeLock;
    }
  });

  it("releases the wake lock after exhausting all attempts", async () => {
    FakeXMLHttpRequest.instances = [];
    const originalXHR = global.XMLHttpRequest;
    // @ts-expect-error stubbing global XHR with a deterministic fake for the test
    global.XMLHttpRequest = FakeXMLHttpRequest;
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    // @ts-expect-error stubbing the Wake Lock API, which jsdom doesn't implement
    navigator.wakeLock = { request };
    vi.useFakeTimers();

    try {
      const file = new File(["a,b,c"], "meter.csv", { type: "text/csv" });
      const promise = uploadFileWithRetry(file, "https://upload.example/put");
      const assertion = expect(promise).rejects.toThrow("Upload failed");

      for (let i = 0; i < 3; i++) {
        FakeXMLHttpRequest.instances[i].onerror?.();
        await vi.runOnlyPendingTimersAsync();
      }

      await assertion;
      expect(release).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      global.XMLHttpRequest = originalXHR;
      // @ts-expect-error removing the stub
      delete navigator.wakeLock;
    }
  });

  it("re-acquires the wake lock when visibility changes back to visible", async () => {
    FakeXMLHttpRequest.instances = [];
    const originalXHR = global.XMLHttpRequest;
    // @ts-expect-error stubbing global XHR with a deterministic fake for the test
    global.XMLHttpRequest = FakeXMLHttpRequest;
    const release1 = vi.fn().mockResolvedValue(undefined);
    const release2 = vi.fn().mockResolvedValue(undefined);
    const request = vi
      .fn()
      .mockResolvedValueOnce({ release: release1 })
      .mockResolvedValueOnce({ release: release2 });
    // @ts-expect-error stubbing the Wake Lock API, which jsdom doesn't implement
    navigator.wakeLock = { request };

    try {
      const file = new File(["a,b,c"], "meter.csv", { type: "text/csv" });
      const promise = uploadFileWithRetry(file, "https://upload.example/put");

      // let the initial (non-blocking) wake lock acquisition settle
      await Promise.resolve();
      await Promise.resolve();

      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
      await Promise.resolve();

      expect(request).toHaveBeenCalledTimes(2);

      const xhr = FakeXMLHttpRequest.instances[0];
      xhr.responseText = JSON.stringify({ storageId: "storage123" });
      xhr.onload?.();
      await promise;

      expect(release1).not.toHaveBeenCalled();
      expect(release2).toHaveBeenCalled();
    } finally {
      global.XMLHttpRequest = originalXHR;
      // @ts-expect-error removing the stub
      delete navigator.wakeLock;
    }
  });
});
