// background/background.js - COMPLETE VERSION

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeEmail') {
    analyzeEmailSafety(request.data)
      .then(result => {
        // Update statistics
        updateStats(result.level === 'danger');
        sendResponse(result);
      })
      .catch(error => sendResponse({
        level: 'error',
        title: 'Analysis Failed',
        explanation: 'Could not analyze email',
        score: 0,
        warnings: [],
        tips: []
      }));
    return true;
  }
});

function updateStats(isThreat) {
  chrome.storage.local.get(['emailsChecked', 'threatsBlocked'], (result) => {
    const emailsChecked = (result.emailsChecked || 0) + 1;
    const threatsBlocked = (result.threatsBlocked || 0) + (isThreat ? 1 : 0);
    
    chrome.storage.local.set({ emailsChecked, threatsBlocked });
  });
}

async function analyzeEmailSafety(emailData) {
  const checks = await Promise.all([
    checkLinks(emailData.links),
    checkSender(emailData.sender, emailData.body),
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
  const suspicious = [];
  
  for (const link of links) {
    try {
      const url = new URL(link);
      
      // Check for URL shorteners
      const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd'];
      if (shorteners.some(s => url.hostname.includes(s))) {
        suspicious.push({
          link,
          reason: 'URL shortener detected - hides real destination'
        });
      }
      
      // Check for IP addresses
      if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
        suspicious.push({
          link,
          reason: 'Uses IP address instead of domain name'
        });
      }
      
      // Check for unusual TLDs
      const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top'];
      if (suspiciousTLDs.some(tld => url.hostname.endsWith(tld))) {
        suspicious.push({
          link,
          reason: 'Uses suspicious domain extension'
        });
      }
      
      // Check for excessive subdomains
      const parts = url.hostname.split('.');
      if (parts.length > 4) {
        suspicious.push({
          link,
          reason: 'Too many subdomains'
        });
      }
      
    } catch (e) {
      suspicious.push({
        link,
        reason: 'Malformed or invalid URL'
      });
    }
  }
  
  return { type: 'links', suspicious };
}

async function checkSender(sender, body) {
  const warnings = [];
  const senderLower = sender.toLowerCase();
  const bodyLower = body.toLowerCase();
  
  // NEW: Extract "tag off" signature from body
  const tagOffMismatch = detectTagOffMismatch(sender, body);
  if (tagOffMismatch) {
    warnings.push(tagOffMismatch);
  }
  
  // Check for company impersonation
  const companies = {
    'paypal': '@paypal.com',
    'amazon': '@amazon.com',
    'apple': '@apple.com',
    'microsoft': '@microsoft.com',
    'google': '@google.com',
    'facebook': '@facebook.com',
    'netflix': '@netflix.com',
    'bank of america': '@bankofamerica.com',
    'wells fargo': '@wellsfargo.com',
    'chase': '@chase.com'
  };
  
  for (const [company, domain] of Object.entries(companies)) {
    if (bodyLower.includes(company) && !senderLower.includes(domain)) {
      warnings.push(`Claims to be from ${company} but email doesn't match official domain`);
    }
  }
  
  // Check for lookalike characters
  if (/[а-яА-Я]/.test(sender)) {
    warnings.push('Email contains unusual characters that look like English letters');
  }
  
  return { type: 'sender', warnings };
}

function detectTagOffMismatch(sender, body) {
  // Common sign-off patterns in emails
  const signOffPatterns = [
    // "Thanks, John Smith" or "Best regards, John Smith"
    /(?:thanks|regards|sincerely|best|cheers|respectfully),?\s*\n?\s*([a-z\s.'-]+)/gi,
    
    // "- John Smith" or "-- John Smith"
    /^-{1,2}\s*([a-z\s.'-]+)$/gim,
    
    // "Sent from John Smith" 
    /sent\s+(?:from|by)\s+([a-z\s.'-]+)/gi,
    
    // Email signatures like "John Smith | Company"
    /^([a-z\s.'-]+)\s*\|/gim,
    
    // Phone numbers followed by names
    /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\s*\n\s*([a-z\s.'-]+)/gi
  ];
  
  let signOffName = null;
  
  // Try to find a sign-off name in the email body
  for (const pattern of signOffPatterns) {
    const match = pattern.exec(body);
    if (match && match[1]) {
      const name = match[1].trim();
      
      // Filter out common false positives
      const excludeWords = [
        'team', 'support', 'service', 'department', 'company', 
        'us', 'me', 'you', 'your', 'our', 'the', 'customer',
        'account', 'payment', 'invoice', 'order', 'security'
      ];
      
      const nameLower = name.toLowerCase();
      const isExcluded = excludeWords.some(word => nameLower === word || nameLower.includes(word + ' '));
      
      // Must be between 2-50 characters and contain at least 2 words (first + last name)
      if (!isExcluded && name.length > 2 && name.length < 50 && name.includes(' ')) {
        signOffName = name;
        break;
      }
    }
  }
  
  if (!signOffName) {
    return null; // No sign-off detected
  }
  
  // Extract name from sender email address
  // Examples: "John Smith <john@example.com>" or just "john@example.com"
  let senderName = null;
  
  // Check for display name format: "Display Name <email@domain.com>"
  const displayNameMatch = sender.match(/^([^<]+)\s*</);
  if (displayNameMatch) {
    senderName = displayNameMatch[1].trim();
  } else {
    // Extract from email address: john.smith@example.com → John Smith
    const emailMatch = sender.match(/^([^@]+)@/);
    if (emailMatch) {
      const username = emailMatch[1];
      // Convert john.smith or john_smith to John Smith
      senderName = username
        .replace(/[._-]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
  }
  
  if (!senderName) {
    return null;
  }
  
  // Compare names (normalize for comparison)
  const normalizeName = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')      // Normalize spaces
      .trim();
  };
  
  const normalizedSender = normalizeName(senderName);
  const normalizedSignOff = normalizeName(signOffName);
  
  // Check if names match
  // Allow partial matches (e.g., "John Smith" matches "John A. Smith")
  const senderWords = normalizedSender.split(' ');
  const signOffWords = normalizedSignOff.split(' ');
  
  // Check if at least first and last name match
  const firstNameMatch = senderWords[0] === signOffWords[0];
  const lastNameMatch = senderWords[senderWords.length - 1] === signOffWords[signOffWords.length - 1];
  
  if (firstNameMatch && lastNameMatch) {
    return null; // Names match - all good
  }
  
  // Check if it's a similar name (fuzzy match)
  const similarity = calculateSimilarity(normalizedSender, normalizedSignOff);
  if (similarity > 0.7) {
    return null; // Close enough
  }
  
  // Names don't match!
  return `Email is signed as "${signOffName}" but sender shows as "${senderName}" - this is suspicious!`;
}

// Helper function to calculate string similarity
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) {
    return 1.0;
  }
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Levenshtein distance algorithm
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
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
    'suspended account',
    'confirm your identity',
    'unusual activity',
    'expires today'
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
    'pin number',
    'ssn',
    'routing number'
  ];
  
  sensitiveRequests.forEach(term => {
    if (lowercaseText.includes(term)) {
      redFlags.push(`Asks for sensitive information: ${term}`);
    }
  });
  
  // Suspicious phrases
  const suspiciousPhrases = [
    'click here',
    'verify your account',
    'confirm your information',
    'claim your prize',
    'you have won',
    'congratulations',
    'free money'
  ];
  
  suspiciousPhrases.forEach(phrase => {
    if (lowercaseText.includes(phrase)) {
      redFlags.push(`Suspicious phrase: "${phrase}"`);
    }
  });
  
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
  
  if (warnings.some(w => w.toLowerCase().includes('link') || w.toLowerCase().includes('url'))) {
    tips.push('Don\'t click any links in this email');
    tips.push('Go directly to the website by typing the address yourself');
  }
  
  if (warnings.some(w => w.toLowerCase().includes('sender') || w.toLowerCase().includes('email') || w.toLowerCase().includes('domain'))) {
    tips.push('Verify the sender\'s email address carefully');
    tips.push('Contact the company directly using their official phone number');
  }
  
  if (warnings.some(w => w.toLowerCase().includes('sensitive') || w.toLowerCase().includes('password') || w.toLowerCase().includes('information'))) {
    tips.push('Never provide passwords or personal information via email');
    tips.push('Real companies will never ask for this information by email');
  }
  
  if (warnings.some(w => w.toLowerCase().includes('pressure') || w.toLowerCase().includes('urgent') || w.toLowerCase().includes('tactic'))) {
    tips.push('Scammers create fake urgency to make you act without thinking');
    tips.push('Take your time and verify before taking any action');
  }
  
  if (tips.length === 0) {
    tips.push('Stay vigilant with all emails asking for action');
    tips.push('When in doubt, contact the company directly');
  }
  
  return tips;
}
