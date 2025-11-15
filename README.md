# Scam Guard
Proactively prevents scam emails for elder people

## AI-powered analysis

The background service can optionally call an AI model (OpenAI-compatible chat completions API) for deeper scam detection. This is disabled by default until you store credentials in extension storage.

1. Load the extension in Chrome.
2. Open `chrome://extensions`, find Scam Guard, and click “service worker” to open the background console.
3. In that console run:

```js
chrome.storage.local.set({
  aiApiKey: 'YOUR_API_KEY',
  aiApiUrl: 'https://api.openai.com/v1/chat/completions',
  aiModel: 'gpt-4o-mini'
});
```

4. Reload the extension. Future email checks will be enriched with the model’s verdict plus extra warnings/tips. If the AI call fails or no key is set, the extension automatically falls back to the built-in heuristic checks.
