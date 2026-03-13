> **[OpenA2A](https://github.com/opena2a-org)**: [CLI](https://github.com/opena2a-org/opena2a) · [HackMyAgent](https://github.com/opena2a-org/hackmyagent) · [Secretless](https://github.com/opena2a-org/secretless-ai) · [AIM](https://github.com/opena2a-org/agent-identity-management) · [DVAA](https://github.com/opena2a-org/damn-vulnerable-ai-agent) · [Registry](https://registry.opena2a.org)

# AI Browser Guard

[![Build](https://github.com/opena2a-org/AI-BrowserGuard/actions/workflows/ci.yml/badge.svg)](https://github.com/opena2a-org/AI-BrowserGuard/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-259%20passing-brightgreen)](https://github.com/opena2a-org/AI-BrowserGuard)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4)](https://developer.chrome.com/docs/extensions/mv3/)

**See it. Control it. Protect it.**

AI agents in your terminal cannot read browser cookies directly, but they can read cookie databases from disk. Browser Guard detects and controls AI access to browser sessions.

Chrome extension that detects, monitors, and controls AI agents operating in your browser. Identifies Playwright, Puppeteer, Selenium, Anthropic Computer Use, and OpenAI Operator without requiring the agent to identify itself. Detection is verified against real framework instances. Provides an emergency kill switch, delegation rules, boundary violation alerts, and a session timeline.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/ojphpdmabflmcjhglfogmkdgchkncikf)

[Install from Chrome Web Store](https://chromewebstore.google.com/detail/ojphpdmabflmcjhglfogmkdgchkncikf) | [Website](https://opena2a.org/aibrowserguard) | [Privacy Policy](https://opena2a.org/aibrowserguard/privacy)

| Detection | Delegation Wizard | Read-Only Config | Kill Switch |
|:---------:|:-----------------:|:----------------:|:-----------:|
| ![Detection](docs/screenshots/1-detection.png) | ![Delegation](docs/screenshots/2-delegation.png) | ![Read-Only](docs/screenshots/3-readOnly.png) | ![Kill Switch](docs/screenshots/4-killswitch.png) |

---

## Install

**From the Chrome Web Store (recommended):**

[Install AI Browser Guard](https://chromewebstore.google.com/detail/ojphpdmabflmcjhglfogmkdgchkncikf) -- one click, automatic updates.

**From source (for development):**

```bash
git clone https://github.com/opena2a-org/AI-BrowserGuard.git
cd AI-BrowserGuard
npm install
npm run build
```

Then load in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked** and select the `dist/` directory
4. The AI Browser Guard icon appears in the Chrome toolbar

---

## Table of Contents

- [Why This Exists](#why-this-exists)
- [Features](#features)
- [Detected Frameworks](#detected-frameworks)
- [Architecture](#architecture)
- [Development](#development)
- [Project Structure](#project-structure)
- [Privacy](#privacy)
- [Permissions](#permissions)
- [Contributing](#contributing)

---

## Why This Exists

Browser-based AI agents (Playwright, Puppeteer, Selenium, Anthropic Computer Use, OpenAI Operator) can take control of your browser session without notice. There is currently no built-in mechanism in Chrome to detect their presence, limit their actions, or terminate them. AI Browser Guard fills that gap by giving users visibility into what agents are doing and control over what they are allowed to do.

---

## Features

- **Agent Takeover Detection** -- Three-layer detection: (1) CDP debugger monitoring via `chrome.debugger.getTargets()`, (2) V8 stack trace analysis for framework signatures (UtilityScript, pptr:, callFunction), (3) behavioral and environment fingerprinting (WebGL renderer, screen resolution, dimension anomalies). Works without requiring the agent to identify itself.
- **Emergency Kill Switch** -- One-click termination of all agent connections. Revokes delegated permissions, clears automation flags, and terminates CDP sessions. Available via popup or keyboard shortcut (Ctrl+Shift+K / Cmd+Shift+K).
- **Delegation Wizard** -- Define agent access boundaries before granting control. Three presets: Read-Only (navigate and read only), Limited (specific sites, time-bounded), and Full Access (unrestricted with logging). Supports site allowlists/blocklists with glob patterns.
- **Boundary Violation Alerts** -- Fail-closed rule evaluation blocks unauthorized actions before they execute. Each violation generates a Chrome notification with details and a one-time override option.
- **Session Timeline** -- Chronological log of all agent actions per session. Records action type, target URL, target element, and outcome (allowed/blocked). Retains the last 5 sessions.

---

## Detected Frameworks

Every detection method listed below has been verified against the real framework.

| Framework | Detection Method | Verified Against |
|-----------|-----------------|-----------------|
| Playwright | CDP debugger attachment, `UtilityScript.evaluate` in V8 stack traces | Real Playwright MCP controlling Chrome |
| Puppeteer | CDP debugger attachment, `pptr:evaluate` stack traces, `navigator.webdriver`, dimension inversion (outer < inner), HeadlessChrome UA | Real Puppeteer v24 + Chromium 145 |
| Selenium | CDP debugger attachment, `callFunction`/`executeScript` stack traces, `navigator.webdriver`, dimension equality (outer === inner) | Real Selenium 4.41 + ChromeDriver 146 |
| Anthropic Computer Use | Software WebGL renderer (llvmpipe/Mesa), Xvfb screen resolution (1024x768), Linux platform fingerprint | Real Anthropic Computer Use Docker reference implementation |
| OpenAI Operator | Same as Playwright (Operator uses Playwright internally) + Linux/cloud environment signals | Playwright verification (Operator uses identical CDP stack) |
| Generic CDP | `chrome.debugger.getTargets()` detects any attached CDP client | Any CDP-based framework |
| Generic WebDriver | `navigator.webdriver` flag (W3C WebDriver spec requirement) | Puppeteer, Selenium |

---

## Architecture

The extension runs as three isolated components under Chrome Manifest V3:

```
Content Script (per tab)          Background Service Worker          Popup UI
  Injected at document_start        Manages state and storage         Status display
  Runs detection pipeline           Routes messages                   Kill switch control
  Enforces delegation rules         Handles kill switch logic         Delegation wizard
  Intercepts agent actions          Badge and alarm management        Violation log
        |                                    |                        Timeline view
        +-------- chrome.runtime.sendMessage --------+
```

**Detection pipeline (three layers):**

- **Layer 1 -- CDP debugger monitoring (background):** The background service worker polls `chrome.debugger.getTargets()` every 3 seconds to detect any attached CDP client. This catches Playwright, Puppeteer, Selenium 4+, and any other CDP-based framework regardless of stealth measures.
- **Layer 2 -- V8 stack trace analysis (MAIN world):** A content script injected into the page's JavaScript context installs an `Error.prepareStackTrace` trap. When automation frameworks execute code via CDP `Runtime.evaluate`, the V8 call stack reveals framework-specific signatures (e.g., `UtilityScript` for Playwright, `pptr:` for Puppeteer, `callFunction` for Selenium).
- **Layer 3 -- Behavioral and environment fingerprinting (content script):** Checks `navigator.webdriver`, window dimension anomalies, WebGL renderer (software rendering indicates virtual display), screen resolution, user agent strings, and Chrome API presence.

Results from all layers are sent to the background service worker for session management and badge updates.

**Delegation enforcement:** Every agent action is checked against the active delegation rule before execution. The rule engine evaluates site patterns (first-match-wins), action restrictions (default-deny), and time bounds. Actions that fail any check are blocked at the content script level.

**Storage:** All data is persisted in `chrome.storage.local` with a defined schema (`StorageSchema`): sessions, delegation rules, user settings, and detection logs.

See [docs/architecture.md](docs/architecture.md) for detailed diagrams and [docs/adr/](docs/adr/) for architectural decision records.

---

## Development

```bash
npm install          # Install dependencies
npm run build        # TypeScript check + build to dist/
npm run dev          # Watch mode for development
npm run test         # Run test suite (259 tests)
npm run test:watch   # Run tests in watch mode
npm run lint         # TypeScript strict type checking
```

The build system uses Vite with separate entry points for each extension component. Content scripts are bundled as IIFE (no module imports allowed in content scripts), the background service worker uses ES modules, and the popup is a standard HTML entry.

---

## Project Structure

```
src/
  background/       Background service worker (state, routing, alarms)
  content/          Content script (detection, monitoring, enforcement)
  detection/        Detection modules (CDP, WebDriver, behavioral, automation)
  delegation/       Delegation rule engine and wizard logic
  alerts/           Boundary violation evaluation and notifications
  killswitch/       Kill switch activation and cleanup
  session/          Session timeline, storage, and types
  popup/            Popup UI (HTML, TypeScript, CSS)
  types/            Shared type definitions (agent, delegation, events)
  __tests__/        Test setup and Chrome API mocks
docs/
  screenshots/      Extension screenshots
  architecture.md   Architecture diagrams (Mermaid)
  adr/              Architectural decision records
  privacy-policy.html
  store-listing.md
scripts/
  build.js          Multi-entry build orchestrator
manifest.json       Chrome Extension Manifest V3
vite.config.ts      Vite build configuration
vitest.config.ts    Test configuration
```

### Key Types

| Type | File | Purpose |
|------|------|---------|
| `AgentIdentity` | `src/types/agent.ts` | Detected agent with type, confidence, capabilities |
| `DelegationRule` | `src/types/delegation.ts` | Access control rule with scope and time bounds |
| `AgentEvent` | `src/types/events.ts` | Timeline entry for an agent action |
| `BoundaryViolation` | `src/types/events.ts` | Blocked action with reason and override status |
| `AgentSession` | `src/session/types.ts` | Complete session with events and summary statistics |
| `StorageSchema` | `src/session/types.ts` | Top-level chrome.storage.local data shape |

---

## Privacy

AI Browser Guard makes zero external network requests. All detection, delegation, and session tracking runs locally in the browser. No data leaves the extension. No analytics, no telemetry, no remote APIs.

The full privacy policy is available at [opena2a.org/aibrowserguard/privacy](https://opena2a.org/aibrowserguard/privacy).

---

## Permissions

| Permission | Reason |
|------------|--------|
| `storage` | Persist sessions, rules, and settings locally |
| `alarms` | Delegation expiration timers |
| `notifications` | Boundary violation alerts |
| `debugger` | Detect CDP client attachments (Layer 1 detection) |
| `<all_urls>` | Detect agents on any page the user visits |

---

## Tech Stack

- **Language:** TypeScript (strict mode, ES2022 target)
- **Bundler:** Vite 5 (multi-entry: IIFE for content, ESM for background, HTML for popup)
- **Testing:** Vitest 2 with Chrome API mocks
- **Extension:** Chrome Manifest V3
- **UI:** Vanilla TypeScript and CSS (no frameworks, minimal bundle)
- **Runtime dependencies:** None (pure Chrome APIs)

---

## Contributing

Contributions are welcome. Please open an issue to discuss proposed changes before submitting a pull request.

1. Fork the repository
2. Create a feature branch (`feat/your-feature`)
3. Run `npm run lint` and `npm run test` before committing
4. Open a pull request against `main`

All pull requests require passing CI checks and code review.

---

## License

[Apache-2.0](LICENSE) -- Copyright 2026 OpenA2A

---

## OpenA2A Ecosystem

| Project | Description | Install |
|---------|-------------|---------|
| [**Secretless AI**](https://github.com/opena2a-org/secretless-ai) | Credential management for AI coding tools -- Claude Code, Cursor, Windsurf | `npx secretless-ai init` |
| [**HackMyAgent**](https://github.com/opena2a-org/hackmyagent) | Security scanner -- 147 checks, attack mode, auto-fix | `npx hackmyagent secure` |
| [**AIM**](https://github.com/opena2a-org/agent-identity-management) | Identity & access management for AI agents | `pip install aim-sdk` |
| [**OASB**](https://github.com/opena2a-org/oasb) | Open Agent Security Benchmark -- 182 attack scenarios | `npm install @opena2a/oasb` |
| [**ARP**](https://github.com/opena2a-org/arp) | Agent Runtime Protection -- process, network, filesystem monitoring | `npm install @opena2a/arp` |
| [**DVAA**](https://github.com/opena2a-org/damn-vulnerable-ai-agent) | Damn Vulnerable AI Agent -- security training and red-teaming | `docker pull opena2a/dvaa` |
