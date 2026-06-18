export interface UploadFileResult {
  storageId: string;
}

export interface UploadCallbacks {
  onProgress?: (percent: number) => void;
  onRetry?: (attempt: number) => void;
}

const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 1000;

function uploadOnce(
  file: File,
  uploadUrl: string,
  callbacks: UploadCallbacks,
): Promise<UploadFileResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("Content-Type", "text/csv");
    xhr.upload.onprogress = (e) => {
      if (e.total > 0) {
        callbacks.onProgress?.(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () =>
      resolve(JSON.parse(xhr.responseText) as UploadFileResult);
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface WakeLockSentinel {
  release: () => Promise<void>;
}

async function acquireWakeLock(): Promise<WakeLockSentinel | null> {
  if (!("wakeLock" in navigator)) return null;
  try {
    return await (
      navigator as Navigator & {
        wakeLock: { request: (type: "screen") => Promise<WakeLockSentinel> };
      }
    ).wakeLock.request("screen");
  } catch {
    return null;
  }
}

function setupWakeLock(): { release: () => Promise<void> } {
  let current: WakeLockSentinel | null = null;
  let pending = acquireWakeLock().then((wl) => {
    current = wl;
  });

  function onVisibilityChange() {
    if (document.visibilityState === "visible") {
      pending = acquireWakeLock().then((wl) => {
        current = wl;
      });
    }
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

  return {
    async release() {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      await pending;
      await current?.release();
    },
  };
}

export async function uploadFileWithRetry(
  file: File,
  uploadUrl: string,
  callbacks: UploadCallbacks = {},
): Promise<UploadFileResult> {
  const wakeLock = setupWakeLock();
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await uploadOnce(file, uploadUrl, callbacks);
      } catch (err) {
        if (attempt >= MAX_ATTEMPTS) throw err;
        callbacks.onRetry?.(attempt + 1);
        await wait(RETRY_BACKOFF_MS * attempt);
      }
    }
    throw new Error("Upload failed");
  } finally {
    await wakeLock.release();
  }
}
