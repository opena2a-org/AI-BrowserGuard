# AI Browser Guard

Detect, monitor, and control AI agents operating in your browser.

## Overview

AI Browser Guard is a Chrome extension that gives you visibility and control over AI agents interacting with your browser. Whether an agent is using Puppeteer, Playwright, Selenium, Anthropic Computer Use, or OpenAI Operator, AI Browser Guard detects its presence and lets you define exactly what it can and cannot do.

## Features

### Agent Detection

Identifies when automation frameworks take control of your browser session. Detects CDP connections, WebDriver flags, programmatic DOM interactions, and framework-specific signatures. Works without requiring the agent to identify itself.

### Emergency Kill Switch

One-click termination of all agent connections. Revokes delegated permissions, clears automation flags, and terminates CDP sessions. Available via the popup button or keyboard shortcut (Ctrl+Shift+K / Cmd+Shift+K).

### Delegation Wizard

Define boundaries for agent access before granting control. Three presets cover common use cases:

- **Read-Only**: Agent can navigate and read pages but cannot interact with page elements.
- **Limited**: Agent can interact with specific allowlisted sites for a defined time period.
- **Full Access**: Agent has unrestricted access with full logging and boundary alerts.

### Capability Boundary Alerts

Real-time alerts when an agent attempts actions outside its delegated scope. Each violation is blocked before execution, logged, and optionally surfaced as a system notification with a one-time override option.

### Session Timeline

Chronological log of all agent actions per session, including what was attempted, where, and whether it was allowed or blocked. Retains the last 5 sessions for review.

## Installation

### Chrome Web Store

Coming soon.

### Manual Installation (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/opena2a-org/aibrowserguard.git
   cd aibrowserguard
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Open Chrome and navigate to `chrome://extensions`.

4. Enable **Developer mode** (toggle in the top-right corner).

5. Click **Load unpacked** and select the `dist/` directory from this project.

6. The AI Browser Guard icon appears in the Chrome toolbar.

## How It Works

AI Browser Guard runs as a Chrome Manifest V3 extension with three components:

- **Content Script**: Injected into every page at `document_start`. Runs detection checks for CDP connections, WebDriver flags, automation framework signatures, and behavioral anomalies (timing patterns, click precision, typing cadence). Enforces delegation boundaries by intercepting agent actions before they execute.

- **Background Service Worker**: Manages session state, delegation rules, and storage. Routes messages between content scripts and the popup. Handles the kill switch, delegation expiration, and badge updates.

- **Popup UI**: Displays detection status, kill switch control, delegation wizard, boundary violation log, and session timeline. Built with vanilla TypeScript and CSS for minimal bundle size.

All processing is local. The free tier makes no external network calls.

## Development

```bash
npm install          # Install dependencies
npm run build        # Build to dist/
npm run dev          # Watch mode for development
npm run test         # Run tests
npm run lint         # TypeScript strict type checking
```

## Tech Stack

- TypeScript (strict mode)
- Vite (multi-entry bundling)
- Vitest (testing)
- Chrome Extension Manifest V3
- No external runtime dependencies

## Contributing

Contributions are welcome. Please open an issue to discuss proposed changes before submitting a pull request.

1. Fork the repository.
2. Create a feature branch (`feat/your-feature`).
3. Commit your changes.
4. Open a pull request against `main`.

## License

Apache-2.0
