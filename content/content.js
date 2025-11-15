// content/content.js

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
  const emailHeaders = document.querySelectorAll('.adn.ads:not(.safety-checked)');
 
  emailHeaders.forEach(header => {
    header.classList.add('safety-checked');
   
    const button = document.createElement('button');
    button.className = 'safety-check-btn';
    button.innerHTML = defaultScanLabel();
    button.addEventListener('click', () => analyzeEmail(header, button));

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

function analyzeEmail(emailElement, triggerButton) {
  const emailData = extractEmailData(emailElement);
  setButtonState(triggerButton, 'loading');
  
  chrome.runtime.sendMessage({
    action: 'analyzeEmail',
    data: emailData
  }, (response) => {
    if (!response || response.level === 'error') {
      setButtonState(triggerButton, 'error');
      return;
    }
    
    setButtonState(triggerButton, 'success');
    displayResults(response, emailElement);
  });
}

function extractEmailData(emailElement) {
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
  if (!result || !emailElement) {
    return;
  }

  const emailContainer = emailElement.parentElement;
  const existingCard = emailContainer.querySelector('.safety-results');
  if (existingCard) {
    existingCard.remove();
  }

  const warningsMarkup = (result.warnings && result.warnings.length)
    ? result.warnings.map(w => `<div class="warning-item"><span class="warning-icon">⚠️</span>${w}</div>`).join('')
    : '<div class="warning-item is-empty">No specific warnings detected.</div>';

  const tipsMarkup = (result.tips && result.tips.length)
    ? result.tips.map(t => `<li>${t}</li>`).join('')
    : '<li>Stay cautious with unexpected requests.</li>';

  const resultsCard = document.createElement('div');
  resultsCard.className = `safety-results safety-${result.level}`;
  resultsCard.innerHTML = `
    <div class="safety-header">
      <div class="safety-header-info">
        <span class="safety-icon">${result.icon || '🛡️'}</span>
        <div>
          <h3>${result.title}</h3>
          <div class="safety-score">Safety Score: ${result.score}/100</div>
        </div>
      </div>
      <button class="safety-toggle" aria-expanded="true">Hide details</button>
    </div>
    <div class="safety-body">
      <div class="safety-explanation">${result.explanation}</div>
      <div class="safety-warnings">
        <h4>Warnings</h4>
        ${warningsMarkup}
      </div>
      <div class="safety-tips">
        <strong>What to do:</strong>
        <ul>
          ${tipsMarkup}
        </ul>
      </div>
    </div>
  `;
  
  const toggleBtn = resultsCard.querySelector('.safety-toggle');
  const safetyBody = resultsCard.querySelector('.safety-body');
  toggleBtn.addEventListener('click', () => {
    const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    toggleBtn.setAttribute('aria-expanded', (!expanded).toString());
    toggleBtn.textContent = expanded ? 'Show details' : 'Hide details';
    safetyBody.classList.toggle('is-collapsed', expanded);
  });

  emailContainer.insertBefore(resultsCard, emailElement.nextSibling);
  resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function defaultScanLabel() {
  return '<span class="safety-check-icon">🛡️</span>Scan Email';
}

function setButtonState(button, state = 'default') {
  if (!button) return;
  button.classList.remove('is-loading', 'is-success', 'is-error');
  switch (state) {
    case 'loading':
      button.disabled = true;
      button.classList.add('is-loading');
      button.innerHTML = '<span class="safety-spinner"></span>Scanning...';
      break;
    case 'success':
      button.disabled = false;
      button.classList.add('is-success');
      button.innerHTML = '<span class="safety-check-icon">✔️</span>Scanned';
      setTimeout(() => setButtonState(button, 'default'), 2000);
      break;
    case 'error':
      button.disabled = false;
      button.classList.add('is-error');
      button.innerHTML = '<span class="safety-check-icon">↻</span>Try Again';
      setTimeout(() => setButtonState(button, 'default'), 2500);
      break;
    default:
      button.disabled = false;
      button.innerHTML = defaultScanLabel();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForGmail);
} else {
  waitForGmail();
}
