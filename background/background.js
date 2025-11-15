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

async function analyzeEmailSafety(emailData = {}) {
  const subject = emailData.subject || '';
  const body = emailData.body || '';
  const sender = emailData.sender || '';
  const senderDisplayName = emailData.senderDisplayName || '';
  const links = Array.isArray(emailData.links) ? emailData.links : [];

  // DEBUG: Log what we're receiving
  console.log('Analyzing email:', {
    sender,
    subject,
    linkCount: links.length
  });
  
  const checks = await Promise.all([
    checkLinks(links),
    checkSender(sender, body, senderDisplayName),
    analyzeContent(`${subject} ${body}`)
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

async function checkLinks(links = []) {
  const suspicious = [];
  const safeLinks = Array.isArray(links) ? links : [];
  
  for (const link of safeLinks) {
    try {
      const url = new URL(link);
      
      // NEW: Check if link domain seems unrelated to claimed sender
      // (This would catch imaginedragonsmusic.com for parking tickets!)
      const suspiciousKeywords = ['music', 'shop', 'store', 'game', 'play', 'fun', 'entertainment'];
      if (suspiciousKeywords.some(keyword => url.hostname.includes(keyword))) {
        suspicious.push({
          link,
          reason: 'Link appears to be for shopping/entertainment, not official business'
        });
      }
      
      // Check for URL shorteners
      const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly'];
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
      const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.pw', '.cc'];
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
          reason: 'Too many subdomains - possibly trying to confuse you'
        });
      }
      
      // NEW: Check for login/verify/secure in URL (phishing sites love these)
      const phishingKeywords = ['login', 'verify', 'secure', 'account', 'update', 'confirm', 'validate'];
      const hasPhishingKeyword = phishingKeywords.some(keyword => url.hostname.includes(keyword) || url.pathname.includes(keyword));
      if (hasPhishingKeyword) {
        suspicious.push({
          link,
          reason: 'URL contains suspicious keywords often used in phishing'
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

async function checkSender(sender = '', body = '', senderDisplayName = '') {
  const warnings = [];
  const senderLower = sender.toLowerCase();
  const bodyLower = body.toLowerCase();
  const displayLower = (senderDisplayName || '').toLowerCase();
  
  // Extract domain from sender
  const domain = sender.split('@')[1]?.toLowerCase() || '';
  
  // NEW: Check for suspicious domain patterns (Firebase, random strings, etc.)
  const suspiciousDomainPatterns = [
    /firebaseapp\.com$/,
    /\.tk$/, /\.ml$/, /\.ga$/, /\.cf$/, /\.gq$/,
    /\d{5,}/, // Long number sequences (like 564469-234450)
    /-\d+-\d+\./, // Patterns like -564469-234450
    /[a-z]{10,}\.com$/, // Random long letter strings
    /^[^.]*-[^.]*-[^.]*\./ // Multiple hyphens suggesting random generated
  ];
  
  for (const pattern of suspiciousDomainPatterns) {
    if (pattern.test(domain)) {
      warnings.push('MAJOR RED FLAG: Sender uses a suspicious, randomly-generated domain name');
      break;
    }
  }
  
  // NEW: Check display name vs actual domain mismatch
  const knownBrands = [
    'paypal', 'amazon', 'apple', 'microsoft', 'google', 'facebook', 'netflix',
    'bank of america', 'wells fargo', 'chase', 'walmart', 'ebay',
    'aaa', 'usps', 'fedex', 'ups', 'dhl', 'irs', 'social security',
    'geek squad', 'norton', 'mcafee', 'paypal', 'venmo', 'zelle'
  ];
  
  // Check if display name mentions a brand but domain doesn't match
  for (const brand of knownBrands) {
    const brandInDisplay = displayLower.includes(brand);
    const brandInDomain = domain.includes(brand.replace(/\s+/g, ''));
    
    if (brandInDisplay && !brandInDomain) {
      warnings.push(`MAJOR RED FLAG: Display name says "${brand}" but email is from unrelated domain: ${domain}`);
      break;
    }
  }
  
  // Check tag-off mismatch
  const tagOffMismatch = detectTagOffMismatch(sender, body);
  if (tagOffMismatch) {
    warnings.push(tagOffMismatch);
  }
  
  // NEW: Check for government/official entities using free email
  const govEntities = [
    'police', 'sheriff', 'department', 'authority', 'government',
    'irs', 'tax', 'dmv', 'court', 'federal', 'state', 'county',
    'city hall', 'town', 'municipality', 'agency', 'administration',
    'parking authority', 'parking enforcement', 'traffic', 'motor vehicle'
  ];
  
  const freeEmailProviders = [
    '@gmail.com', '@yahoo.com', '@hotmail.com', '@outlook.com',
    '@aol.com', '@icloud.com', '@mail.com', '@protonmail.com'
  ];
  
  const isFreeEmail = freeEmailProviders.some(provider => senderLower.includes(provider));
  const claimsToBeOfficial = govEntities.some(entity => bodyLower.includes(entity) || displayLower.includes(entity));
  
  if (isFreeEmail && claimsToBeOfficial) {
    warnings.push('MAJOR RED FLAG: Claims to be an official organization but uses a free personal email account (Gmail, Yahoo, etc.)');
  } else if (isFreeEmail) {
    warnings.push('Sender uses a free personal email account, not a business domain');
  }
  
  // Check for company impersonation (expanded list)
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
    'chase': '@chase.com',
    'walmart': '@walmart.com',
    'ebay': '@ebay.com',
    'aaa': '@aaa.com', // ADDED AAA
    'geek squad': '@geeksquad.com',
    'best buy': '@bestbuy.com'
  };
  
  for (const [company, officialDomain] of Object.entries(companies)) {
    const mentionedInBody = bodyLower.includes(company);
    const mentionedInDisplay = displayLower.includes(company);
    const hasOfficialDomain = senderLower.includes(officialDomain);
    
    if ((mentionedInBody || mentionedInDisplay) && !hasOfficialDomain) {
      warnings.push(`MAJOR RED FLAG: Claims to be from ${company.toUpperCase()} but email doesn't match official domain`);
    }
  }
  
  // Check for lookalike characters
  if (/[а-яА-Я]/.test(sender)) {
    warnings.push('Email contains unusual characters that look like English letters');
  }
  
  return { type: 'sender', warnings };
}

function detectTagOffMismatch(sender = '', body = '') {
  const senderLower = sender.toLowerCase();
  const bodyLower = body.toLowerCase();
  if (!senderLower || !bodyLower) {
    return null;
  }

  const entities = [
    'paypal', 'amazon', 'apple', 'microsoft', 'google', 'facebook', 'netflix',
    'bank of america', 'wells fargo', 'chase', 'irs', 'dmv', 'social security',
    'walmart', 'ebay', 'parking authority', 'city hall', 'police', 'sheriff'
  ];

  const senderEntity = entities.find(entity => senderLower.includes(entity));
  if (!senderEntity) {
    return null;
  }

  const conflictingEntity = entities.find(entity => entity !== senderEntity && bodyLower.includes(entity));
  if (conflictingEntity) {
    return `Mentions ${conflictingEntity} in the message but sender address references ${senderEntity}`;
  }

  return null;
}

async function analyzeContent(text = '') {
  const redFlags = [];
  const lowercaseText = text.toLowerCase();
  
  // NEW: Absurd/Illegal threats
  const absurdThreats = [
    'confiscate your vehicle',
    'seize your property',
    'arrest warrant',
    'legal action will be taken',
    'will be prosecuted',
    'law enforcement',
    'federal offense',
    'your closest friend', // This is ridiculous and obviously fake
    'family member will be',
    'warrant for your arrest'
  ];
  
  absurdThreats.forEach(threat => {
    if (lowercaseText.includes(threat)) {
      redFlags.push(`Contains threatening language: "${threat}" - Real organizations don't threaten like this`);
    }
  });
  
  // NEW: Deadline pressure tactics
  const deadlinePatterns = [
    /(?:by|before|within)\s+(?:november|december|january|february|march|april|may|june|july|august|september|october)\s+\d{1,2}/gi,
    /(?:by|before|within)\s+\d{1,2}\s+(?:days?|hours?|minutes?)/gi,
    /(?:expires?|deadline|due)\s+(?:today|tomorrow|tonight)/gi,
    /must (?:pay|respond|act|click|call) (?:by|before|within)/gi
  ];
  
  deadlinePatterns.forEach(pattern => {
    if (pattern.test(text)) {
      redFlags.push('Creates artificial deadline to pressure you into acting quickly');
    }
  });
  
  // Urgency tactics
  const urgencyPhrases = [
    'urgent action required',
    'immediate action',
    'account will be closed',
    'verify immediately',
    'act now',
    'limited time',
    'suspended account',
    'confirm your identity',
    'unusual activity',
    'expires today',
    'final notice',
    'last warning',
    'must be paid',
    'no choice but to'
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
    'routing number',
    'driver\'s license',
    'date of birth',
    'account number'
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
    'free money',
    're-validate',
    'update your payment'
  ];
  
  suspiciousPhrases.forEach(phrase => {
    if (lowercaseText.includes(phrase)) {
      redFlags.push(`Suspicious phrase: "${phrase}"`);
    }
  });
  
  // NEW: Check for copy-paste link instructions (huge red flag!)
  const copyPastePatterns = [
    'copy and paste',
    'copy paste',
    'paste into your browser',
    'paste the link',
    'copy the following',
    'paste this url'
  ];
  
  copyPastePatterns.forEach(phrase => {
    if (lowercaseText.includes(phrase)) {
      redFlags.push('MAJOR RED FLAG: Asks you to copy/paste a link - legitimate companies use clickable links');
    }
  });
  
  return { type: 'content', redFlags };
}

function calculateSafetyScore(checks) {
  let score = 100;
  
  checks.forEach(check => {
    if (check.type === 'links' && check.suspicious.length > 0) {
      check.suspicious.forEach(item => {
        // More penalty for major red flags
        if (item.reason.includes('MAJOR RED FLAG') || item.reason.includes('shopping/entertainment')) {
          score -= 25;
        } else {
          score -= 15;
        }
      });
    }
    if (check.type === 'sender' && check.warnings.length > 0) {
      check.warnings.forEach(warning => {
        // Heavier penalty for government impersonation
        if (warning.includes('MAJOR RED FLAG')) {
          score -= 30;
        } else {
          score -= 20;
        }
      });
    }
    if (check.type === 'content' && check.redFlags.length > 0) {
      check.redFlags.forEach(flag => {
        // Heavier penalty for threats and copy-paste requests
        if (flag.includes('MAJOR RED FLAG') || flag.includes('threatening')) {
          score -= 20;
        } else {
          score -= 10;
        }
      });
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
