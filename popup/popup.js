// popup/popup.js

document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  document.getElementById('learnMore').addEventListener('click', () => {
    chrome.tabs.create({ 
      url: 'https://www.consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams' 
    });
  });
});

function loadStats() {
  chrome.storage.local.get(['emailsChecked', 'threatsBlocked', 'latestScan'], (result) => {
    document.getElementById('emailsChecked').textContent = result.emailsChecked || 0;
    document.getElementById('threatsBlocked').textContent = result.threatsBlocked || 0;
    updateLatestScan(result.latestScan);
  });
}

function updateLatestScan(latestScan) {
  const scoreEl = document.getElementById('latestScanScore');
  const levelEl = document.getElementById('latestScanLevel');
  const explanationEl = document.getElementById('latestScanExplanation');
  const timeEl = document.getElementById('latestScanTime');
  const cardEl = document.getElementById('latestScanCard');

  if (!latestScan) {
    scoreEl.textContent = '--';
    levelEl.textContent = 'Scan an email to see details.';
    explanationEl.textContent = '';
    timeEl.textContent = 'No scans yet';
    cardEl.classList.remove('is-danger', 'is-warning', 'is-safe');
    return;
  }

  scoreEl.textContent = latestScan.score ?? '--';
  levelEl.textContent = latestScan.title || latestScan.level || 'Result';
  explanationEl.textContent = latestScan.explanation || '';
  timeEl.textContent = formatTimestamp(latestScan.timestamp);

  cardEl.classList.remove('is-danger', 'is-warning', 'is-safe');
  if (latestScan.level === 'danger') {
    cardEl.classList.add('is-danger');
  } else if (latestScan.level === 'warning') {
    cardEl.classList.add('is-warning');
  } else {
    cardEl.classList.add('is-safe');
  }
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}
