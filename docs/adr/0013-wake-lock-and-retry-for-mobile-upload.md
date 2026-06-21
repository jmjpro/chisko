# Mitigate mobile cellular upload failures via Wake Lock, visible progress, and whole-file retry — not chunked/resumable upload

*Superseded by [ADR 0015](./0015-client-side-smart-meter-parsing-and-matching.md): the smart-meter CSV is no longer uploaded at all, so this mitigation (and the code it describes) no longer applies. Kept for history.*

The smart-meter CSV upload (`WizardIsland.tsx`'s `handleFileUpload`) was failing in production on mobile cellular connections only, never on WiFi, across both Android Chrome and iOS Safari — confirmed by toggling networks on the same device. Files are ~4MB. The upload finishes fast enough on WiFi to never hit the problem, but is slow enough on cellular that the screen locks (or the user switches apps) mid-upload, interrupting the in-flight request with no corresponding entry in Convex or Vercel logs, since the request never completes a round trip.

We mitigate this with three changes confined to the upload handler and `CsvDropzone`:

1. **Wake Lock**, requested when the upload starts, re-acquired on `visibilitychange` back to visible (the browser auto-releases the lock on backgrounding), released on completion or error. Prevents the interruption outright in the common case (idle screen timeout).
2. **Real upload-percentage progress**, replacing the indeterminate spinner. Requires moving the upload call from `fetch` to `XMLHttpRequest` for `upload.onprogress` access. Gives the user a concrete reason not to lock the screen.
3. **Automatic whole-file retry**, up to 3 attempts with backoff, triggered on upload failure (covers cases Wake Lock doesn't: unsupported browsers — iOS before 16.4 — or the user manually backgrounding the app). A visible "retrying" indicator is shown during a retry. If all attempts are exhausted, falls back to the existing "Error processing file. Please try again." message, same as today.

## Considered Options

- **Wake Lock + progress + whole-file retry (chosen)**: directly addresses the reported failure mode. At ~4MB, re-uploading the whole file on retry costs a few seconds even on a poor connection, so no resumption state is needed.
- **Chunked/resumable upload**: would survive any interruption regardless of cause and wouldn't depend on Wake Lock support or retry attempts completing. Rejected — Convex's `ctx.storage.generateUploadUrl()` only accepts a single full-body PUT with no native multipart/range support, so this would mean hand-building chunk-splitting client-side, a server-side chunk-assembly mechanism, and resumption state persisted across reloads (e.g. IndexedDB) from scratch. That cost only pays off at file sizes where re-sending the whole thing is expensive (tens of MB+) or interruptions are frequent enough that single attempts rarely complete — neither is true at 4MB with Wake Lock already preventing most interruptions.
