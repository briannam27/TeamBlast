class SafeBrowsingChecker {
  constructor() {
    this.apiKey = null;
    this.apiEndpoint = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';
    this.loadApiKey();
  }

  // Load API key from Chrome storage
  async loadApiKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['googleSafeBrowsingApiKey'], (result) => {
        this.apiKey = result.googleSafeBrowsingApiKey || null;
        resolve(this.apiKey);
      });
    });
  }

  // Check if URLs are malicious using Google Safe Browsing
  async checkUrls(urls) {
    // Make sure we have the API key
    if (!this.apiKey) {
      await this.loadApiKey();
    }

    // If still no API key, return null (will fallback to heuristics)
    if (!this.apiKey) {
      console.log('Google Safe Browsing API key not configured');
      return null;
    }

    // Filter out empty URLs
    const validUrls = urls.filter(url => url && url.trim() !== '');
    if (validUrls.length === 0) {
      return { threats: [], safe: true };
    }

    try {
      // Prepare the request body
      const requestBody = {
        client: {
          clientId: "scam-guard-extension",
          clientVersion: "1.0.0"
        },
        threatInfo: {
          // What types of threats to check for
          threatTypes: [
            "MALWARE",
            "SOCIAL_ENGINEERING",  // Phishing
            "UNWANTED_SOFTWARE",
            "POTENTIALLY_HARMFUL_APPLICATION"
          ],
          // What platforms to check
          platformTypes: ["ANY_PLATFORM"],
          // What threat entry types
          threatEntryTypes: ["URL"],
          // The URLs to check
          threatEntries: validUrls.map(url => ({ url }))
        }
      };

      console.log('Checking URLs with Safe Browsing:', validUrls);

      // Make the API call
      const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        console.error('Safe Browsing API error:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      
      // Parse the response
      if (data.matches && data.matches.length > 0) {
        // Found threats!
        return {
          threats: data.matches.map(match => ({
            url: match.threat.url,
            threatType: match.threatType,
            platformType: match.platformType,
            threatEntryType: match.threatEntryType
          })),
          safe: false
        };
      } else {
        // No threats found
        return {
          threats: [],
          safe: true
        };
      }

    } catch (error) {
      console.error('Safe Browsing check failed:', error);
      return null;
    }
  }

  // Convert threat types to user-friendly messages
  getThreatMessage(threatType) {
    const messages = {
      'MALWARE': 'contains malware that could harm your computer',
      'SOCIAL_ENGINEERING': 'is a phishing site trying to steal your information',
      'UNWANTED_SOFTWARE': 'may try to install unwanted software',
      'POTENTIALLY_HARMFUL_APPLICATION': 'may contain harmful applications'
    };
    return messages[threatType] || 'has been flagged as dangerous';
  }
}

// Create a single instance
const safeBrowsingChecker = new SafeBrowsingChecker();