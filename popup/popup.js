// popup/popup.js

document.addEventListener('DOMContentLoaded', () => {
  // Load statistics from storage
  loadStats();
  
  // Set up learn more button
  document.getElementById('learnMore').addEventListener('click', () => {
    chrome.tabs.create({ 
      url: 'https://www.consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams' 
    });
  });
});

function loadStats() {
  chrome.storage.local.get(['emailsChecked', 'threatsBlocked'], (result) => {
    document.getElementById('emailsChecked').textContent = result.emailsChecked || 0;
    document.getElementById('threatsBlocked').textContent = result.threatsBlocked || 0;
  });
}