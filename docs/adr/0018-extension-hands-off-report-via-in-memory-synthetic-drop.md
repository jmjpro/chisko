# Extension hands the retrieved report to the wizard via in-memory synthetic drop, never touching disk

Once the extension retrieves the IEC report attachment from the user's mail tab, it needs to get that file into the existing wizard's upload step (`UploadStep.tsx`) so the unchanged client-side parse/match flow ([[ADR-0015]]) can take over — the extension's job ends at "the wizard has the file," not parsing or uploading it itself. We chose to fetch the attachment as a blob in memory (mail content script reads it directly from the mail provider's authenticated session, the same way `mail.js`/`gmail.js` already read the inbox) and hand it directly to a content script on the chisko.app wizard tab, which reconstructs a `File` and dispatches a synthetic `drop` event on the upload dropzone — rather than writing the file to the user's Downloads folder and asking them to drag it in themselves, or asking them to grant the extension `file://` access to read it back off disk.

Browsers don't let scripts set a `<input type="file">`'s `.files` property directly (a deliberate security restriction), so some hand-off mechanism beyond "set the value" is required regardless of which option is chosen. Writing to disk first and reading it back would require the user to manually enable "Allow access to file URLs" in `chrome://extensions` — itself a manual step, defeating the goal of eliminating manual steps — so we keep the file in extension-controlled memory end to end and use the same synthetic-`DataTransfer`-drop technique either way.

## Considered Options

- **Download to disk, ask the user to drag it into the wizard manually**: simplest and most robust against `UploadStep.tsx` changes, but leaves exactly the manual step CHI-43 exists to remove.
- **Download to disk via `chrome.downloads`, then read it back to perform the synthetic drop**: rejected — reading a `file://` URL back requires the user to manually grant file-URL access in `chrome://extensions`, trading one manual step for another.

## Consequences

This couples the extension to `UploadStep.tsx`'s dropzone implementation (selectors/event handling it listens for). If that component's drop handling changes, the extension's synthetic-drop script needs a matching update — there's no compiler/type system catching this drift across the extension/web-app boundary.
