// background/background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeEmail') {
    analyzeEmailSafety(request.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({
        level: 'error',
        title: 'Analysis Failed',
        explanation: 'Could not analyze email'
      }));
    return true; // Keep message channel open for async response
  }
});

async function analyzeEmailSafety(emailData) {
  const checks = await Promise.all([
    checkLinks(emailData.links),
    checkSender(emailData.sender),
    analyzeContent(emailData.subject + ' ' + emailData.body)
  ]);

  const score = calculateSafetyScore(checks);
  const warnings = extractWarnings(checks);
  const tips = generateTips(warnings);

  return {
    level: score > 70 ? 'safe' : score > 40 ? 'warning' : 'danger',
    icon: score > 70 ? '✅' : score > 40 ? '⚠️' : '🚨',
    title: score > 70 ? 'Looks Safe' : score > 40 ? 'Be Careful' : 'Likely a Scam',
    score: score,
    explanation: generateExplanation(score, warnings),
    warnings: warnings,
    tips: tips
  };
}

async function checkLinks(links) {
  // Check links against VirusTotal, Google Safe Browsing, etc.
  const suspiciousLinks = [];
  
  for (const link of links) {
    try {
      // Example: Check if link domain matches sender domain
      const url = new URL(link);
      if (url.hostname.includes('bit.ly') || url.hostname.includes('tinyurl')) {
        suspiciousLinks.push({
          link,
          reason: 'Shortened URL - could hide malicious site'
        });
      }
      
      // Here you'd call external APIs
      // const vtResult = await checkVirusTotal(link);
      
    } catch (e) {
      console.error('Invalid URL:', link);
    }
  }
  
  return { type: 'links', suspicious: suspiciousLinks };
}

async function checkSender(sender) {
  const warnings = [];
  
  // Check for common spoofing patterns
  if (sender.includes('paypal') && !sender.endsWith('@paypal.com')) {
    warnings.push('Sender pretends to be PayPal but email doesn\'t match');
  }
  
  if (sender.includes('amazon') && !sender.endsWith('@amazon.com')) {
    warnings.push('Sender pretends to be Amazon but email doesn\'t match');
  }
  
  // Check for lookalike characters (homograph attacks)
  if (/[а-яА-Я]/.test(sender)) { // Cyrillic characters
    warnings.push('Email contains unusual characters that look like English');
  }
  
  return { type: 'sender', warnings };
}

async function analyzeContent(text) {
  const redFlags = [];
  const lowercaseText = text.toLowerCase();
  
  // Urgency tactics
  const urgencyPhrases = [
    'urgent action required',
    'account will be closed',
    'verify immediately',
    'act now',
    'limited time',
    'suspended account'
  ];
  
  urgencyPhrases.forEach(phrase => {
    if (lowercaseText.includes(phrase)) {
      redFlags.push(`Uses pressure tactic: "${phrase}"`);
    }
  });
  
  // Requests for sensitive info
  const sensitiveRequests = [
    'social security',
    'password',
    'credit card',
    'bank account',
    'pin number'
  ];
  
  sensitiveRequests.forEach(term => {
    if (lowercaseText.includes(term)) {
      redFlags.push(`Asks for sensitive information: ${term}`);
    }
  });
  
  // Here you could call Claude API for deeper analysis
  // const aiAnalysis = await analyzeWithClaude(text);
  
  return { type: 'content', redFlags };
}

function calculateSafetyScore(checks) {
  let score = 100;
  
  checks.forEach(check => {
    if (check.type === 'links' && check.suspicious.length > 0) {
      score -= check.suspicious.length * 15;
    }
    if (check.type === 'sender' && check.warnings.length > 0) {
      score -= check.warnings.length * 20;
    }
    if (check.type === 'content' && check.redFlags.length > 0) {
      score -= check.redFlags.length * 10;
    }
  });
  
  return Math.max(0, score);
}

function extractWarnings(checks) {
  const warnings = [];
  
  checks.forEach(check => {
    if (check.suspicious) {
      check.suspicious.forEach(s => warnings.push(s.reason));
    }
    if (check.warnings) {
      warnings.push(...check.warnings);
    }
    if (check.redFlags) {
      warnings.push(...check.redFlags);
    }
  });
  
  return warnings;
}

function generateExplanation(score, warnings) {
  if (score > 70) {
    return 'This email appears to be legitimate. No major red flags detected.';
  } else if (score > 40) {
    return 'This email has some suspicious elements. Review the warnings below carefully before taking action.';
  } else {
    return 'This email shows multiple signs of being a scam. Do not click links or provide any information.';
  }
}

function generateTips(warnings) {
  const tips = [];
  
  if (warnings.some(w => w.includes('link') || w.includes('URL'))) {
    tips.push('Don\'t click any links in this email');
    tips.push('Go directly to the website by typing the address yourself');
  }
  
  if (warnings.some(w => w.includes('sender') || w.includes('email'))) {
    tips.push('Verify the sender\'s email address carefully');
    tips.push('Contact the company directly using their official phone number');
  }
  
  if (warnings.some(w => w.includes('sensitive') || w.includes('password'))) {
    tips.push('Never provide passwords or personal information via email');
    tips.push('Real companies will never ask for this information by email');
  }
  
  if (warnings.some(w => w.includes('pressure') || w.includes('urgent'))) {
    tips.push('Scammers create fake urgency to make you act without thinking');
    tips.push('Take your time and verify before taking any action');
  }
  
  if (tips.length === 0) {
    tips.push('Stay vigilant with all emails asking for action');
  }
  
  return tips;
}