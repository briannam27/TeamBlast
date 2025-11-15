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
    button.textContent = '🛡️ Check Safety';
    button.onclick = () => analyzeEmail(header);
    
    header.appendChild(button);
  });
}

function analyzeEmail(emailElement) {
  // Extract email content
  const emailData = extractEmailData(emailElement);
  
  // Send to background script for analysis
  chrome.runtime.sendMessage({
    action: 'analyzeEmail',
    data: emailData
  }, (response) => {
    displayResults(response, emailElement);
  });
}

function extractEmailData(emailElement) {
  // This is simplified - actual selectors depend on email provider
  const subjectElement = document.querySelector('[data-legacy-thread-id] h2');
  const bodyElement = document.querySelector('.a3s.aiL');
  const senderElement = document.querySelector('.gD');
  const linksElements = document.querySelectorAll('.a3s.aiL a');
  
  return {
    subject: subjectElement?.textContent || '',
    body: bodyElement?.textContent || '',
    sender: senderElement?.getAttribute('email') || '',
    links: Array.from(linksElements).map(a => a.href)
  };
}

function displayResults(result, emailElement) {
  // Create results card
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
  emailElement.parentElement.insertBefore(resultsCard, emailElement.nextSibling);
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForGmail);
} else {
  waitForGmail();
}