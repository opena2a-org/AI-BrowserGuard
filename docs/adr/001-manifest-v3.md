# ADR-001: Chrome Extension Manifest V3

**Status:** Accepted
**Date:** 2026-02-27

## Context

Chrome Web Store stopped accepting new Manifest V2 extensions in 2024 and has
been removing V2 extensions from the store. Manifest V3 introduces a
fundamentally different execution model: background pages are replaced by
service workers, `chrome.webRequest` blocking is replaced by
`declarativeNetRequest`, and remote code execution is prohibited.

AI Browser Guard is a new extension. Starting with V2 would require an
immediate rewrite to ship on the Chrome Web Store, and V2 patterns (persistent
background pages, unlimited `eval`) conflict with the security posture expected
of a security-focused extension.

## Decision

Build exclusively on Manifest V3 from the initial commit. The background
script runs as a service worker (`"type": "module"` in `manifest.json`). All
state is persisted to `chrome.storage.local` rather than held in memory.
Content scripts are injected via the `content_scripts` manifest key with
`"run_at": "document_start"` to intercept automation signals early.

Permissions are declared explicitly: `activeTab`, `storage`, `alarms`,
`scripting`, `tabs`, and `notifications`. Host permissions use `<all_urls>`
because the extension must detect agent activity on any page the user visits.

## Consequences

### Positive
- Compliant with Chrome Web Store submission requirements from day one.
- Service worker lifecycle forces proper state management through
  `chrome.storage.local`, making the extension more resilient to restarts.
- No persistent background page reduces memory footprint when idle.
- Aligns with Chrome's security model: no remote code, no `eval`, explicit
  permissions.

### Negative
- Service workers terminate after ~30 seconds of inactivity. Long-running
  detection state must be serialized and restored, adding complexity to the
  background service worker (`src/background/index.ts`).
- Content scripts cannot share ES module chunks with the background worker.
  The build system (`vite.config.ts`, `scripts/build.js`) must produce
  separate builds: IIFE for content scripts, ES modules for the background
  worker, and a standard Rollup build for the popup.
- Some Chrome APIs behave differently in service workers (e.g., no `window`
  object, no DOM access), requiring care in shared utility code.

### Neutral
- The `commands` API for the kill switch keyboard shortcut
  (`Ctrl+Shift+K` / `Cmd+Shift+K`) works identically in V3 and V2.
- `chrome.storage.local` quota (10 MB by default) is sufficient for storing
  the last 5 sessions and 100 detection log entries.
