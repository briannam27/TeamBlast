// content/content.js

// Wait for Gmail to load
function waitForGmail() {
  const checkInterval = setInterval(() => {
    const emailView = document.querySelector('[role="main"]');
    if (emailView) {
      clearInterval(checkInterval);
      initializeSafetyChecker();
    }
  }, 1000);
}

function initializeSafetyChecker() {
  // Add safety check button to emails
  const observer = new MutationObserver(() => {
    addSafetyButtons();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  addSafetyButtons();
}

function addSafetyButtons() {
  // Find email headers (Gmail-specific selectors)
  const emailHeaders = document.querySelectorAll('.adn.ads:not(.safety-checked)');
  
  emailHeaders.forEach(header => {
    header.classList.add('safety-checked');
    
    const button = document.createElement('button');
    button.className = 'safety-check-btn';
    button.innerHTML = '<span class="safety-check-icon"></span>Scan Email';
    button.onclick = () => analyzeEmail(header);

    const container = document.createElement('div');
    container.className = 'safety-check-container';
    container.appendChild(button);
    
    const toolbar = header.querySelector('.gE') || header.firstElementChild;
    if (toolbar && toolbar.parentElement) {
      toolbar.parentElement.insertBefore(container, toolbar.nextSibling);
    } else {
      header.insertBefore(container, header.firstChild);
    }
  });
}

function analyzeEmail(emailElement) {
  // Extract email content
  const emailData = extractEmailData(emailElement);
  
  // Validate we have sender data
  if (!emailData.sender || emailData.sender.length < 3) {
    alert('Could not extract sender email. Please make sure the email is fully loaded and try again.');
    console.error('No sender data extracted!');
    return;
  }
  
  // Send to background script for analysis
  chrome.runtime.sendMessage({
    action: 'analyzeEmail',
    data: emailData
  }, (response) => {
    displayResults(response, emailElement);
  });
}

function extractEmailData(emailElement) {
  // Extract subject
  const subjectElement = document.querySelector('[data-legacy-thread-id] h2, .hP');
  
  // Extract body
  const bodyElement = document.querySelector('.a3s.aiL, [data-message-id] .a3s');
  
  // Extract sender - MULTIPLE METHODS to ensure we get it
  let sender = '';
  
  // Method 1: Try the email attribute on .gD element
  const senderElement = document.querySelector('.gD');
  if (senderElement) {
    sender = senderElement.getAttribute('email') || '';
  }
  
  // Method 2: Try the title attribute (shows on hover)
  if (!sender && senderElement) {
    sender = senderElement.getAttribute('title') || '';
  }
  
  // Method 3: Try data-hovercard-id attribute
  if (!sender && senderElement) {
    sender = senderElement.getAttribute('data-hovercard-id') || '';
  }
  
  // Method 4: Look in the message header area for email pattern
  if (!sender) {
    const headerArea = document.querySelector('.gE.iv.gt, .ajy');
    if (headerArea) {
      const text = headerArea.textContent;
      // Extract email from format like "Name <email@domain.com>"
      const emailMatch = text.match(/<([^>]+@[^>]+)>/) || 
                        text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailMatch) {
        sender = emailMatch[1] || emailMatch[0];
      }
    }
  }
  
  // Method 5: Check the expanded "Show details" section
  if (!sender) {
    const detailsSection = document.querySelector('.ajy');
    if (detailsSection) {
      const emailMatch = detailsSection.textContent.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailMatch) {
        sender = emailMatch[0];
      }
    }
  }
  
  // Method 6: Look for the "mailed-by" or "signed-by" information
  if (!sender) {
    const mailedBy = document.querySelector('[data-tooltip*="mailed-by"], [data-tooltip*="signed-by"]');
    if (mailedBy) {
      const tooltip = mailedBy.getAttribute('data-tooltip');
      const emailMatch = tooltip?.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailMatch) {
        sender = emailMatch[0];
      }
    }
  }
  
  // Method 7: Try to get it from the sender's name element text content
  if (!sender && senderElement) {
    const text = senderElement.textContent;
    const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    if (emailMatch) {
      sender = emailMatch[0];
    }
  }
  
  // Extract links
  const linksElements = document.querySelectorAll('.a3s.aiL a, [data-message-id] a');
  
  const extractedData = {
    subject: subjectElement?.textContent?.trim() || '',
    body: bodyElement?.textContent?.trim() || '',
    sender: sender.trim(),
    links: Array.from(linksElements).map(a => a.href).filter(href => href && !href.startsWith('mailto:'))
  };
  
  // Debug logging - helps you see what's being extracted
  console.log('=== EXTRACTED EMAIL DATA ===');
  console.log('Sender:', extractedData.sender);
  console.log('Subject:', extractedData.subject);
  console.log('Body preview:', extractedData.body.substring(0, 150) + '...');
  console.log('Links found:', extractedData.links.length);
  console.log('Sample links:', extractedData.links.slice(0, 3));
  console.log('===========================');
  
  return extractedData;
}

function displayResults(result, emailElement) {
  // Create results card
  const emailContainer = emailElement.parentElement;
  const existingCard = emailContainer.querySelector('.safety-results');
  if (existingCard) {
    existingCard.remove();
  }

  const resultsCard = document.createElement('div');
  resultsCard.className = `safety-results safety-${result.level}`;
  resultsCard.innerHTML = `
    <div class="safety-header">
      <span class="safety-icon">${result.icon}</span>
      <h3>${result.title}</h3>
    </div>
    <div class="safety-score">Safety Score: ${result.score}/100</div>
    <div class="safety-explanation">${result.explanation}</div>
    <div class="safety-warnings">
      ${result.warnings.map(w => `<div class="warning-item">⚠️ ${w}</div>`).join('')}
    </div>
    <div class="safety-tips">
      <strong>What to do:</strong>
      <ul>
        ${result.tips.map(t => `<li>${t}</li>`).join('')}
      </ul>
    </div>
  `;
  
  // Insert after email header
  emailContainer.insertBefore(resultsCard, emailElement.nextSibling);
  resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForGmail);
} else {
  waitForGmail();
}