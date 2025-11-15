// utils/api.js

async function checkVirusTotal(url) {
  const apiKey = 'YOUR_VIRUSTOTAL_API_KEY';
  const response = await fetch(`https://www.virustotal.com/api/v3/urls`, {
    method: 'POST',
    headers: {
      'x-apikey': apiKey,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `url=${encodeURIComponent(url)}`
  });
  return await response.json();
}

async function analyzeWithClaude(emailText) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'YOUR_ANTHROPIC_API_KEY',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analyze this email for phishing/scam indicators. Explain in simple terms why it might be dangerous:\n\n${emailText}`
      }]
    })
  });
  
  const data = await response.json();
  return data.content[0].text;
}