document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadStats();
  
  // Google Safe Browsing handlers
  document.getElementById('saveGoogleApi').addEventListener('click', saveGoogleApi);
  document.getElementById('testGoogleApi').addEventListener('click', testGoogleApi);
  
  // AI API handlers
  document.getElementById('saveAiApi').addEventListener('click', saveAiApi);
  
  // Stats handlers
  document.getElementById('resetStats').addEventListener('click', resetStats);
});

// Load existing settings
function loadSettings() {
  chrome.storage.local.get([
    'googleSafeBrowsingApiKey',
    'aiApiKey',
    'aiApiUrl',
    'aiModel'
  ], (result) => {
    // Google Safe Browsing
    if (result.googleSafeBrowsingApiKey) {
      document.getElementById('googleApiKey').value = result.googleSafeBrowsingApiKey;
      updateStatus('googleStatus', 'Configured ✓', true);
    }
    
    // AI settings
    if (result.aiApiKey) {
      document.getElementById('aiApiKey').value = result.aiApiKey;
      document.getElementById('aiApiUrl').value = result.aiApiUrl || 'https://api.openai.com/v1/chat/completions';
      document.getElementById('aiModel').value = result.aiModel || 'gpt-4o-mini';
      updateStatus('aiStatus', 'Configured ✓', true);
    }
  });
}

// Save Google Safe Browsing API key
function saveGoogleApi() {
  const apiKey = document.getElementById('googleApiKey').value.trim();
  
  if (!apiKey) {
    showStatus('googleApiStatus', 'Please enter an API key', 'error');
    return;
  }
  
  chrome.storage.local.set({ googleSafeBrowsingApiKey: apiKey }, () => {
    showStatus('googleApiStatus', 'API key saved successfully!', 'success');
    updateStatus('googleStatus', 'Configured ✓', true);
  });
}

// Test Google Safe Browsing API
async function testGoogleApi() {
  const apiKey = document.getElementById('googleApiKey').value.trim();
  
  if (!apiKey) {
    showStatus('googleApiStatus', 'Please enter an API key first', 'error');
    return;
  }
  
  showStatus('googleApiStatus', 'Testing connection...', 'info');
  
  try {
    // Test with a known bad URL (Google's test URL)
    const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: {
          clientId: "scam-guard-test",
          clientVersion: "1.0.0"
        },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [
            { url: "http://malware.testing.google.test/testing/malware/" }
          ]
        }
      })
    });
    
    if (response.ok) {
      showStatus('googleApiStatus', '✓ Connection successful! API is working.', 'success');
    } else {
      showStatus('googleApiStatus', `Error: ${response.status} - ${response.statusText}. Check your API key.`, 'error');
    }
  } catch (error) {
    showStatus('googleApiStatus', `Connection failed: ${error.message}`, 'error');
  }
}

// Save AI API settings
function saveAiApi() {
  const apiKey = document.getElementById('aiApiKey').value.trim();
  const apiUrl = document.getElementById('aiApiUrl').value.trim();
  const model = document.getElementById('aiModel').value.trim();
  
  if (!apiKey) {
    showStatus('aiApiStatus', 'Please enter an API key', 'error');
    return;
  }
  
  chrome.storage.local.set({
    aiApiKey: apiKey,
    aiApiUrl: apiUrl || 'https://api.openai.com/v1/chat/completions',
    aiModel: model || 'gpt-4o-mini'
  }, () => {
    showStatus('aiApiStatus', 'AI settings saved successfully!', 'success');
    updateStatus('aiStatus', 'Configured ✓', true);
  });
}

// Load and display statistics
function loadStats() {
  chrome.storage.local.get(['emailsChecked', 'threatsBlocked'], (result) => {
    document.getElementById('statsEmails').textContent = result.emailsChecked || 0;
    document.getElementById('statsThreats').textContent = result.threatsBlocked || 0;
  });
}

// Reset statistics
function resetStats() {
  if (confirm('Are you sure you want to reset all statistics?')) {
    chrome.storage.local.set({
      emailsChecked: 0,
      threatsBlocked: 0
    }, () => {
      loadStats();
      alert('Statistics reset successfully!');
    });
  }
}

// Helper: Show status message
function showStatus(elementId, message, type) {
  const statusEl = document.getElementById(elementId);
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  
  if (type === 'success') {
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }
}

// Helper: Update API status indicator
function updateStatus(statusId, text, isActive) {
  document.getElementById(statusId).textContent = text;
  const indicatorId = statusId + 'Indicator';
  const indicator = document.getElementById(indicatorId);
  if (isActive) {
    indicator.classList.add('active');
  } else {
    indicator.classList.remove('active');
  }
}
