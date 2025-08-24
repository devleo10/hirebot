// popup/popup.js - HireBot Candidate Interview Assistant

let currentQAs = [];
let detectedFields = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadQAs();
  setupEventListeners();
  await scanCurrentPage();
});

function setupEventListeners() {
  document.getElementById('scanBtn').addEventListener('click', scanCurrentPage);
  document.getElementById('autoFillBtn').addEventListener('click', autoFillAnswers);
  document.getElementById('saveQuickQA').addEventListener('click', saveQuickQA);
  document.getElementById('searchQAs').addEventListener('input', filterQAs);
  document.getElementById('openOptions').addEventListener('click', openOptions);
}

async function loadQAs() {
  const result = await chrome.storage.sync.get(['interviewQAs']);
  currentQAs = result.interviewQAs || [];
  renderQAs(currentQAs);
}

async function scanCurrentPage() {
  showStatus('Scanning page for form fields...', 'info');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractQuestions
    });
    
    detectedFields = results[0].result || [];
    renderDetectedFields();
    
    if (detectedFields.length > 0) {
      showStatus(`Found ${detectedFields.length} form fields!`, 'success');
      document.getElementById('detectedSection').style.display = 'block';
    } else {
      showStatus('No form fields detected on this page', 'info');
      document.getElementById('detectedSection').style.display = 'none';
    }
  } catch (error) {
    console.error('Scan error:', error);
    showStatus('Error scanning page', 'error');
  }
}

function extractQuestions() {
  // This function runs in the page context
  const fields = [];
  const inputs = [...document.querySelectorAll('input, textarea')].filter(el => {
    return el.offsetParent !== null && 
           el.type !== 'hidden' && 
           el.type !== 'submit' && 
           el.type !== 'button';
  });
  
  inputs.forEach(el => {
    let label = '';
    
    // Try placeholder
    if (el.placeholder) label = el.placeholder;
    
    // Try associated label
    if (!label && el.id) {
      const lbl = document.querySelector(`label[for='${el.id}']`);
      if (lbl) label = lbl.textContent.trim();
    }
    
    // Try parent label
    if (!label && el.closest('label')) {
      label = el.closest('label').textContent.trim();
    }
    
    // Try preceding text
    if (!label) {
      const prev = el.previousElementSibling;
      if (prev && prev.textContent) label = prev.textContent.trim();
    }
    
    if (label && label.length > 0) {
      fields.push({
        selector: getUniqueSelector(el),
        label: label.substring(0, 100),
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || ''
      });
    }
  });
  
  function getUniqueSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let sel = node.nodeName.toLowerCase();
      if (node.classList.length) {
        sel += '.' + [...node.classList].slice(0,2).map(c => CSS.escape(c)).join('.');
      }
      const siblings = [...(node.parentNode?.children || [])].filter(n => n.nodeName === node.nodeName);
      const idx = siblings.indexOf(node);
      if (idx >= 0 && siblings.length > 1) sel += `:nth-of-type(${idx+1})`;
      parts.unshift(sel);
      node = node.parentElement;
    }
    return parts.join(' > ');
  }
  
  return fields;
}

function renderDetectedFields() {
  const container = document.getElementById('detectedFields');
  
  if (detectedFields.length === 0) {
    container.innerHTML = '<div class="no-results">No form fields detected</div>';
    return;
  }
  
  container.innerHTML = detectedFields.map(field => {
    const matchingQA = findMatchingQA(field.label);
    return `
      <div class="field-item">
        <div class="field-label">${escapeHtml(field.label)}</div>
        <div class="field-actions">
          ${matchingQA ? `
            <button class="btn btn-small btn-success" onclick="fillField('${field.selector}', '${escapeForJs(matchingQA.answer)}')">
              ✨ Fill: "${matchingQA.question.substring(0, 30)}..."
            </button>
          ` : `
            <button class="btn btn-small btn-secondary" onclick="suggestQA('${escapeForJs(field.label)}')">
              ➕ Save Answer
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function findMatchingQA(fieldLabel) {
  const label = fieldLabel.toLowerCase();
  return currentQAs.find(qa => {
    const question = qa.question.toLowerCase();
    const keywords = question.split(/\W+/).filter(w => w.length > 2);
    return keywords.some(keyword => label.includes(keyword)) ||
           label.includes(question) ||
           question.includes(label);
  });
}

async function autoFillAnswers() {
  if (detectedFields.length === 0) {
    showStatus('Scan the page first to detect form fields', 'error');
    return;
  }
  
  showStatus('Auto-filling answers...', 'info');
  let filledCount = 0;
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    for (const field of detectedFields) {
      const matchingQA = findMatchingQA(field.label);
      if (matchingQA) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: fillFieldFunction,
          args: [field.selector, matchingQA.answer]
        });
        
        // Update usage count
        matchingQA.lastUsed = Date.now();
        matchingQA.useCount = (matchingQA.useCount || 0) + 1;
        filledCount++;
      }
    }
    
    // Save updated usage stats
    await chrome.storage.sync.set({ interviewQAs: currentQAs });
    
    showStatus(`Auto-filled ${filledCount} fields!`, 'success');
  } catch (error) {
    console.error('Auto-fill error:', error);
    showStatus('Error during auto-fill', 'error');
  }
}

function fillFieldFunction(selector, value) {
  // This function runs in the page context
  try {
    const element = document.querySelector(selector);
    if (element) {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  } catch (error) {
    console.error('Fill field error:', error);
  }
  return false;
}

async function fillField(selector, answer) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: fillFieldFunction,
      args: [selector, answer]
    });
    
    showStatus('Field filled!', 'success');
  } catch (error) {
    console.error('Fill field error:', error);
    showStatus('Error filling field', 'error');
  }
}

function suggestQA(fieldLabel) {
  document.getElementById('quickQuestion').value = fieldLabel;
  document.getElementById('quickAnswer').focus();
}

async function saveQuickQA() {
  const question = document.getElementById('quickQuestion').value.trim();
  const answer = document.getElementById('quickAnswer').value.trim();
  
  if (!question || !answer) {
    showStatus('Please fill in both question and answer', 'error');
    return;
  }
  
  const qa = {
    id: Date.now().toString(),
    question,
    answer,
    tags: [],
    created: Date.now(),
    lastUsed: null,
    useCount: 0
  };
  
  currentQAs.push(qa);
  await chrome.storage.sync.set({ interviewQAs: currentQAs });
  
  document.getElementById('quickQuestion').value = '';
  document.getElementById('quickAnswer').value = '';
  
  await loadQAs();
  await scanCurrentPage(); // Refresh to show new matches
  showStatus('Q&A saved!', 'success');
}

function renderQAs(qas) {
  const container = document.getElementById('qaList');
  
  if (qas.length === 0) {
    container.innerHTML = '<div class="no-results">No Q&As saved yet. Add one above!</div>';
    return;
  }
  
  const displayed = qas.slice(0, 5); // Show only first 5 in popup
  container.innerHTML = displayed.map(qa => `
    <div class="qa-item">
      <div class="qa-question">${escapeHtml(qa.question)}</div>
      <div class="qa-answer">${escapeHtml(qa.answer.length > 80 ? qa.answer.substring(0, 80) + '...' : qa.answer)}</div>
      <div class="qa-actions">
        <button class="btn btn-small btn-secondary" onclick="editQA('${qa.id}')">✏️</button>
        <button class="btn btn-small btn-success" onclick="copyAnswer('${escapeForJs(qa.answer)}')">📋</button>
      </div>
    </div>
  `).join('');
  
  if (qas.length > 5) {
    container.innerHTML += `<div style="text-align: center; margin-top: 8px; color: #718096; font-size: 0.8em;">
      Showing 5 of ${qas.length} Q&As. <a href="#" onclick="openOptions()" style="color: #667eea;">View all</a>
    </div>`;
  }
}

function filterQAs() {
  const search = document.getElementById('searchQAs').value.toLowerCase();
  const filtered = currentQAs.filter(qa => 
    qa.question.toLowerCase().includes(search) || 
    qa.answer.toLowerCase().includes(search)
  );
  renderQAs(filtered);
}

async function copyAnswer(answer) {
  try {
    await navigator.clipboard.writeText(answer);
    showStatus('Answer copied to clipboard!', 'success');
  } catch (error) {
    console.error('Copy error:', error);
    showStatus('Could not copy to clipboard', 'error');
  }
}

function editQA(id) {
  // For popup, we'll just open options page to the specific Q&A
  openOptions();
}

function openOptions() {
  chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
  window.close();
}

function showStatus(message, type) {
  const statusEl = document.getElementById('statusMsg');
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
  statusEl.style.display = 'block';
  
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeForJs(text) {
  return text.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// Make functions globally available for onclick handlers
window.fillField = fillField;
window.suggestQA = suggestQA;
window.editQA = editQA;
window.copyAnswer = copyAnswer;
window.openOptions = openOptions;
