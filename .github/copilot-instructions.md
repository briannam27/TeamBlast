## Repo: TeamBlast — AI contributor instructions

Purpose: quick, actionable guidance so an AI coding agent (or a human using Copilot) can be immediately productive editing and extending this Chrome extension.

Keep this file short and specific to discoverable patterns in the codebase. Do not invent missing behaviours; ask for clarification if a design choice is not encoded in the repo.

---

1) Big-picture architecture (what to know first)

- This is a Manifest V3 Chrome extension named "Email Safety Assistant" (see `manifest.json`).
- Major components:
  - Content script: `content/content.js` — injects UI into mail providers (Gmail/Outlook), extracts email data, and sends messages to the background service worker.
  - Background service worker: `background/background.js` — central analysis engine. Listens to messages (action: `analyzeEmail`), runs checks (links, sender, content), computes score, stores metrics in `chrome.storage.local`.
  - Popup UI: `popup/popup.html` + `popup/popup.js` — reads `emailsChecked` and `threatsBlocked` from storage and links to consumer guidance.

Why the structure: content scripts run in the page context to access DOM; heavy analysis and storage live in the background worker and are communicated via `chrome.runtime.sendMessage`.

2) Key files to open when editing

- `manifest.json` — permissions and content scripts (host permissions for Gmail/Outlook). Changes here affect install/load behavior.
- `content/content.js` — DOM selectors and injection points. Look for `.safety-checked`, `.safety-results`, and the `analyzeEmail` flow.
- `background/background.js` — contains the analysis pipeline and all rule functions: `checkLinks`, `checkSender`, `analyzeContent`, `calculateSafetyScore`, `extractWarnings`, `generateTips`.
- `popup/popup.js` — how stats are displayed (`chrome.storage.local.get(['emailsChecked','threatsBlocked'])`).

3) Messaging, storage, and patterns to preserve

- Messaging: content -> background uses `chrome.runtime.sendMessage({ action: 'analyzeEmail', data })`. The background listener returns true for async responses. Maintain this pattern when adding new message types.
- Storage keys: `emailsChecked`, `threatsBlocked`. Use `chrome.storage.local.get` / `set` consistently.
- UI injection: content script marks processed headers with `.safety-checked` to avoid duplicate buttons. Keep that deduplication when modifying DOM logic.
- Score thresholds: score > 70 => 'safe'; 41-70 => 'warning'; <=40 => 'danger'. If you change scoring, update title/icon logic in `background/background.js` and any tests/examples.

4) Local testing & debugging (concrete steps)

- No build system: to test, load the extension as an unpacked extension in Chrome/Edge:
  - Open chrome://extensions, enable Developer mode, click "Load unpacked", select this repo folder.
- Debugging background service worker: open chrome://extensions, find the extension, click "service worker" -> "Inspect" to view console and set breakpoints.
- Debugging content script: open devtools on the target site (e.g., https://mail.google.com), inspect the page where the script injects buttons. Use the Elements panel to find `.safety-checked` or `.safety-results`.

5) Conventions and project-specific patterns

- Keep the UI text simple and elder-friendly (the README states the goal: help older adults). Prefer short sentences and friendly emojis (icons already used in results). Example: `button.textContent = '🛡️ Check Safety'` in `content/content.js`.
- Use the existing scoring and warnings arrays to power the UI. The message payload shape returned by background is:
  { level, icon, title, score, explanation, warnings, tips }
- When adding checks, create small, focused functions (like `checkLinks`, `checkSender`, `analyzeContent`) and include them in the `analyzeEmailSafety` pipeline.

6) Integration & external dependencies

- Host permissions in `manifest.json` grant access to Gmail and Outlook. Be cautious when broadening host permissions.
- No external npm packages or build step are present. If adding a new library, include a clear reason and provide instructions for how to bundle it (this repo currently relies on plain JS, so prefer minimal additions).

7) Safe change checklist (quick PR checklist for AI edits)

- If you change scoring or warnings: update `generateExplanation`, `title/icon` logic, and any UI that consumes the score.
- If you add storage keys: document the key name and default behavior in `background/background.js` and `popup/popup.js`.
- If you update selectors in `content/content.js`: verify both Gmail and Outlook pages (selectors are Gmail-specific now); add comments about provider-specific code.

8) Example prompts the AI should use when making edits

- "Add a new link check that flags domains ending with '.xyz' and deducts 10 points from the safety score; update warnings and tips accordingly. Show the exact changes to `background/background.js` and add a unit-style example showing input links and expected score." 
- "Refactor `extractEmailData` to support Outlook's DOM: add provider detection and vendor-specific selectors while preserving Gmail behavior. Show the modified `content/content.js` and a brief test plan to verify on both Gmail and Outlook." 

---

If anything here is unclear or you'd like the AI to prefer a different approach (e.g., adding unit tests, converting to TypeScript, or introducing a build step), say so and I'll iterate. After your feedback I will merge or refine this file.
