# Chrome Web Store Listing

## Short Name
AI Browser Guard

## Short Description (132 chars max)
[BETA] Detect and control AI agents in your browser. Kill switch, delegation rules, boundary alerts. Local-only, zero tracking.

## Detailed Description

BETA — AI Browser Guard is in active development. We are building the security infrastructure that the AI agent ecosystem needs, and we want your feedback to get it right. Report issues or suggest features: https://github.com/opena2a-org/aibrowserguard/issues

AI Browser Guard detects when AI automation frameworks take control of your browser and gives you tools to manage what they can do.

WHAT IT DOES

When an AI agent (Playwright, Puppeteer, Selenium, Anthropic Computer Use, OpenAI Operator, or any WebDriver-based tool) starts controlling your browser, AI Browser Guard:

- Detects the takeover using multiple signals: WebDriver flags, Chrome DevTools Protocol markers, behavioral analysis of mouse/keyboard patterns, and framework-specific fingerprints
- Shows detection status in the popup with confidence level and detection method
- Logs all agent activity in a session timeline

FIVE CORE FEATURES

1. Agent Takeover Detection
   Identifies automation frameworks without requiring agents to self-identify. Uses WebDriver flag detection, CDP connection scanning, behavioral heuristics (click precision, typing cadence, synthetic events), and framework fingerprinting.

2. Emergency Kill Switch
   One-click termination of all agent access. Clears automation flags, revokes delegated permissions, and broadcasts stop commands to all tabs. Keyboard shortcut: Ctrl+Shift+K (Cmd+Shift+K on Mac).

3. Delegation Wizard
   Define what agents can and cannot do before they connect:
   - Read-Only: Navigate and read, no clicking or typing
   - Limited: Interact with specific sites you choose, with time limits (15min / 1hr / 4hr)
   - Full Access: Everything allowed, with logging and alerts

4. Boundary Violation Alerts
   When an agent attempts an action outside its delegation scope, the action is blocked and you receive a notification showing what was attempted, which rule blocked it, and the option to allow it once.

5. Session Timeline
   Chronological log of all agent actions: timestamps, action types, target URLs, element selectors, and whether each action was allowed or blocked. Last 5 sessions retained.

PRIVACY

All processing happens locally on your device. Zero network requests. No analytics, no tracking, no data collection. Session logs and settings are stored in chrome.storage.local and deleted when you uninstall.

See full privacy policy: https://opena2a.org/aibrowserguard/privacy

PERMISSIONS EXPLAINED

This extension requires host access to all URLs because AI agents can operate on any website. Detection content scripts must run on every page to provide coverage. The extension makes no network requests and processes all data locally.

ABOUT OPENA2A

AI Browser Guard is built by OpenA2A, an open-source security platform focused on securing the AI agent ecosystem. As AI agents increasingly operate autonomously across the web — browsing, clicking, filling forms, making purchases — the gap between what agents can do and what users can control keeps growing. OpenA2A builds the tools to close that gap: agent identity management, runtime protection, security testing, and browser-level controls like this extension.

We believe AI infrastructure security should be open, auditable, and accessible to everyone — not locked behind enterprise paywalls. Every tool we ship is open source, privacy-first, and designed to work without requiring agents to cooperate.

Learn more: https://opena2a.org
Source code: https://github.com/opena2a-org/aibrowserguard

FEEDBACK

This is a beta release. We are actively improving detection accuracy, adding new framework signatures, and expanding delegation controls. If you encounter issues, have feature requests, or want to contribute, open an issue on GitHub:
https://github.com/opena2a-org/aibrowserguard/issues

---

## Category
Developer Tools

## Language
English

## Tags (up to 5)
- AI security
- browser automation
- agent detection
- privacy
- developer tools

## Permission Justifications

### activeTab
Required to detect automation frameworks on the current page and enforce delegation rules.

### storage
Required to persist session logs, delegation rules, and user settings locally on the device.

### alarms
Required to schedule periodic checks for delegation rule expiration and detection sweeps.

### scripting
Required to inject content scripts that detect automation patterns and enforce access boundaries.

### tabs
Required to detect agent activity across tabs, broadcast kill switch commands to all tabs, and track navigation for the session timeline.

### notifications
Required to alert the user when an AI agent attempts an action that violates the active delegation rules.

### host_permissions (<all_urls>)
AI agents can operate on any website. The detection content script must run on all pages to identify automation frameworks (WebDriver flags, CDP markers, behavioral patterns). Limiting to specific domains would leave users unprotected on unlisted sites. No page content is read or transmitted; only automation indicators are analyzed locally.
