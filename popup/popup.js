// popup/popup.js - HireBot Candidate Interview Assistant

let currentQAs = [];
let detectedFields = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadQAs();
  setupEventListeners();
  await scanCurrentPage();
  setupFooterAndModals();
  setupQuickSettings();
});
// --- Quick Settings Logic ---
function setupQuickSettings() {
  const autoFillToggle = document.getElementById('autoFillEnabled');
  const autoFillStatus = document.getElementById('autoFillStatus');
  if (!autoFillToggle) return;

  // Load setting from storage
  chrome.storage.sync.get(['autoFillEnabled'], (result) => {
    const enabled = result.autoFillEnabled !== false; // default true
    autoFillToggle.checked = enabled;
    autoFillStatus.textContent = enabled ? 'Auto-fill is ON' : 'Auto-fill is OFF';
    autoFillStatus.style.color = enabled ? '#38a169' : '#e53e3e';
  });

  autoFillToggle.addEventListener('change', () => {
    const enabled = autoFillToggle.checked;
    chrome.storage.sync.set({ autoFillEnabled: enabled });
    autoFillStatus.textContent = enabled ? 'Auto-fill is ON' : 'Auto-fill is OFF';
    autoFillStatus.style.color = enabled ? '#38a169' : '#e53e3e';
  });
}

function setupEventListeners() {
  document.getElementById('scanBtn').addEventListener('click', scanCurrentPage);
  document.getElementById('autoFillBtn').addEventListener('click', autoFillAnswers);
  document.getElementById('saveQuickQA').addEventListener('click', saveQuickQA);
  document.getElementById('searchQAs').addEventListener('input', filterQAs);
  document.getElementById('openOptions').addEventListener('click', openOptions);
  
  // AI and Template features
  document.getElementById('improveAnswerBtn').addEventListener('click', improveAnswerWithAI);
  document.getElementById('useTemplateBtn').addEventListener('click', showTemplateOptions);
  
  // Question suggestions
  document.getElementById('quickQuestion').addEventListener('input', showQuestionSuggestions);
  document.getElementById('quickQuestion').addEventListener('focus', showQuestionSuggestions);
  document.getElementById('quickQuestion').addEventListener('blur', hideQuestionSuggestions);
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch(e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          saveQuickQA();
          break;
        case 'f':
          e.preventDefault();
          document.getElementById('searchQAs').focus();
          break;
        case 'enter':
          if (e.target.id === 'quickAnswer') {
            e.preventDefault();
            saveQuickQA();
          }
          break;
      }
    }
    if (e.key === 'Escape') {
      // Close any open modals
      const modals = document.querySelectorAll('.modal');
      modals.forEach(modal => modal.style.display = 'none');
      hideQuestionSuggestions();
    }
  });
  
  // Auto-resize textareas
  const textareas = document.querySelectorAll('textarea');
  textareas.forEach(textarea => {
    textarea.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
    });
  });
}

async function loadQAs() {
  try {
    const result = await chrome.storage.sync.get(['interviewQAs']);
    currentQAs = result.interviewQAs || [];
    
    // Sort by most recently used, then by creation date
    currentQAs.sort((a, b) => {
      if (a.lastUsed && b.lastUsed) {
        return b.lastUsed - a.lastUsed;
      }
      if (a.lastUsed && !b.lastUsed) return -1;
      if (!a.lastUsed && b.lastUsed) return 1;
      return (b.created || 0) - (a.created || 0);
    });
    
    renderQAs(currentQAs);
    
    // Check storage usage
    const usage = await chrome.storage.sync.getBytesInUse();
    const maxBytes = chrome.storage.sync.QUOTA_BYTES || 102400; // 100KB default
    if (usage > maxBytes * 0.9) {
      showStatus(`Storage almost full (${Math.round(usage/1024)}KB/${Math.round(maxBytes/1024)}KB)`, 'info');
    }
  } catch (error) {
    console.error('Load error:', error);
    showStatus('Error loading Q&As', 'error');
    currentQAs = [];
    renderQAs(currentQAs);
  }
}

async function scanCurrentPage() {
  showStatus('Scanning page for form fields...', 'info');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if this is a chrome:// or extension page
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
      showStatus('Cannot scan browser internal pages. Please navigate to a regular website.', 'error');
      document.getElementById('detectedSection').style.display = 'none';
      return;
    }
    
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
    if (error.message.includes('Cannot access a chrome')) {
      showStatus('Cannot scan browser internal pages. Please navigate to a regular website.', 'error');
    } else {
      showStatus('Error scanning page', 'error');
    }
    document.getElementById('detectedSection').style.display = 'none';
  }
}

function extractQuestions() {
  // This function runs in the page context
  const fields = [];
  const inputs = [...document.querySelectorAll('input, textarea, [contenteditable="true"]')].filter(el => {
    return el.offsetParent !== null && 
           el.type !== 'hidden' && 
           el.type !== 'submit' && 
           el.type !== 'button' &&
           el.type !== 'image' &&
           el.type !== 'file' &&
           !el.disabled &&
           !el.readOnly;
  });
  
  inputs.forEach(el => {
    let label = '';
    
    // Try placeholder first (most reliable)
    if (el.placeholder && el.placeholder.trim()) {
      label = el.placeholder.trim();
    }
    
    // Try associated label
    if (!label && el.id) {
      const lbl = document.querySelector(`label[for='${el.id}']`);
      if (lbl && lbl.textContent.trim()) {
        label = lbl.textContent.trim();
      }
    }
    
    // Try parent label
    if (!label && el.closest('label')) {
      const parentLabel = el.closest('label').textContent.trim();
      if (parentLabel) label = parentLabel;
    }
    
    // Try aria-label
    if (!label && el.getAttribute('aria-label')) {
      label = el.getAttribute('aria-label').trim();
    }
    
    // Try preceding text elements
    if (!label) {
      const siblings = [el.previousElementSibling, el.parentElement?.previousElementSibling];
      for (const sibling of siblings) {
        if (sibling && sibling.textContent && sibling.textContent.trim()) {
          label = sibling.textContent.trim();
          break;
        }
      }
    }
    
    // Try data attributes
    if (!label) {
      const dataLabel = el.getAttribute('data-label') || el.getAttribute('data-placeholder');
      if (dataLabel) label = dataLabel.trim();
    }
    
    // Clean up label
    if (label) {
      label = label.replace(/[*:]+$/, '').trim(); // Remove trailing asterisks and colons
      label = label.substring(0, 200); // Limit length
      
      if (label.length > 3) { // Only add meaningful labels
        fields.push({
          selector: getUniqueSelector(el),
          label: label,
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || el.getAttribute('contenteditable') || '',
          placeholder: el.placeholder || '',
          id: el.id || '',
          className: el.className || ''
        });
      }
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
  
  container.innerHTML = detectedFields.map((field, index) => {
    const matchingQA = findMatchingQA(field.label);
    return `
      <div class="field-item">
        <div class="field-label">${escapeHtml(field.label)}</div>
        <div class="field-actions">
          ${matchingQA ? `
            <button class="btn btn-small btn-success field-fill-btn" data-selector="${escapeHtml(field.selector)}" data-answer="${escapeHtml(matchingQA.answer)}">
              ✨ Fill: "${matchingQA.question.substring(0, 30)}..."
            </button>
          ` : `
            <button class="btn btn-small btn-secondary field-suggest-btn" data-label="${escapeHtml(field.label)}">
              ➕ Save Answer
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
  
  // Add event listeners for the buttons
  container.querySelectorAll('.field-fill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const selector = btn.getAttribute('data-selector');
      const answer = unescapeHtml(btn.getAttribute('data-answer'));
      fillField(selector, answer);
    });
  });
  
  container.querySelectorAll('.field-suggest-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = unescapeHtml(btn.getAttribute('data-label'));
      suggestQA(label);
    });
  });
}

function findMatchingQA(fieldLabel) {
  const label = fieldLabel.trim().toLowerCase();
  
  // Enhanced matching with scoring system
  const candidates = currentQAs.map(qa => ({
    qa,
    score: calculateMatchScore(label, qa.question.toLowerCase(), qa.tags || [])
  })).filter(item => item.score > 0.3); // Minimum threshold
  
  // Sort by score and return best match
  candidates.sort((a, b) => b.score - a.score);
  return candidates.length > 0 ? candidates[0].qa : null;
}

function calculateMatchScore(fieldLabel, question, tags) {
  let score = 0;
  
  // Exact match gets highest score
  if (fieldLabel === question) return 1.0;
  
  // Substring matches
  if (fieldLabel.includes(question) || question.includes(fieldLabel)) {
    score += 0.8;
  }
  
  // Fuzzy matching for common variations
  const commonMappings = {
    'about yourself': ['tell me about yourself', 'introduce yourself', 'background'],
    'strengths': ['strength', 'what are you good at', 'skills'],
    'weaknesses': ['weakness', 'areas for improvement', 'challenges'],
    'why here': ['why do you want to work here', 'why this company', 'interest'],
    'experience': ['tell me about your experience', 'background', 'work history'],
    'salary': ['salary expectation', 'compensation', 'pay', 'expected salary'],
    'questions': ['do you have questions', 'questions for us', 'anything to ask']
  };
  
  for (const [key, variations] of Object.entries(commonMappings)) {
    if (fieldLabel.includes(key) || variations.some(v => fieldLabel.includes(v))) {
      if (question.includes(key) || variations.some(v => question.includes(v))) {
        score += 0.7;
      }
    }
  }
  
  // Tag matching
  const fieldWords = fieldLabel.split(/\W+/).filter(w => w.length > 2);
  const tagMatches = tags.filter(tag => 
    fieldWords.some(word => tag.toLowerCase().includes(word))
  );
  score += tagMatches.length * 0.2;
  
  // Keyword matching with better weighting
  const questionWords = question.split(/\W+/).filter(w => w.length > 2);
  const keywordMatches = questionWords.filter(word => fieldLabel.includes(word));
  score += (keywordMatches.length / questionWords.length) * 0.5;
  
  return Math.min(score, 1.0);
}

async function autoFillAnswers() {
  // Check if auto-fill is enabled
  const { autoFillEnabled } = await chrome.storage.sync.get(['autoFillEnabled']);
  if (autoFillEnabled === false) {
    showStatus('Auto-fill is disabled in Quick Settings', 'error');
    return;
  }
  if (detectedFields.length === 0) {
    showStatus('Scan the page first to detect form fields', 'error');
    return;
  }
  showStatus('Auto-filling answers...', 'info');
  let filledCount = 0;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // Check if this is a chrome:// or extension page
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
      showStatus('Cannot auto-fill on browser internal pages. Please navigate to a regular website.', 'error');
      return;
    }
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
        // Small delay between fills to be more natural
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    // Save updated usage stats
    await chrome.storage.sync.set({ interviewQAs: currentQAs });
    if (filledCount > 0) {
      showStatus(`Auto-filled ${filledCount} fields!`, 'success');
    } else {
      showStatus('No matching answers found for detected fields', 'info');
    }
  } catch (error) {
    console.error('Auto-fill error:', error);
    if (error.message.includes('Cannot access a chrome')) {
      showStatus('Cannot auto-fill on browser internal pages. Please navigate to a regular website.', 'error');
    } else {
      showStatus('Error during auto-fill', 'error');
    }
  }
}

function fillFieldFunction(selector, value) {
  // This function runs in the page context
  try {
    const element = document.querySelector(selector);
    if (!element) return false;
    
    // Handle different types of elements
    if (element.contentEditable === 'true') {
      // For contenteditable elements
      element.innerHTML = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (element.tagName === 'SELECT') {
      // For select elements, try to find matching option
      const options = [...element.options];
      const matchingOption = options.find(opt => 
        opt.text.toLowerCase().includes(value.toLowerCase()) ||
        opt.value.toLowerCase().includes(value.toLowerCase())
      );
      if (matchingOption) {
        element.value = matchingOption.value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else {
      // For regular input/textarea elements
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
    }
    
    // Focus and blur to trigger any validation
    element.focus();
    setTimeout(() => element.blur(), 100);
    
    return true;
  } catch (error) {
    console.error('Fill field error:', error);
    return false;
  }
}

async function fillField(selector, answer) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if this is a chrome:// or extension page
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
      showStatus('Cannot fill fields on browser internal pages. Please navigate to a regular website.', 'error');
      return;
    }
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: fillFieldFunction,
      args: [selector, answer]
    });
    
    showStatus('Field filled!', 'success');
  } catch (error) {
    console.error('Fill field error:', error);
    if (error.message.includes('Cannot access a chrome')) {
      showStatus('Cannot fill fields on browser internal pages. Please navigate to a regular website.', 'error');
    } else {
      showStatus('Error filling field', 'error');
    }
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
  
  if (question.length > 500) {
    showStatus('Question is too long (max 500 characters)', 'error');
    return;
  }
  
  if (answer.length > 2000) {
    showStatus('Answer is too long (max 2000 characters)', 'error');
    return;
  }
  
  // Auto-detect question category/tags
  const detectedTags = detectQuestionCategory(question);
  
  // Check for duplicates
  const existingQA = currentQAs.find(qa => qa.question.toLowerCase().trim() === question.toLowerCase());
  if (existingQA) {
    if (confirm('A similar question already exists. Do you want to update it?')) {
      existingQA.answer = answer;
      existingQA.tags = [...new Set([...existingQA.tags, ...detectedTags])]; // Merge tags
      existingQA.lastModified = Date.now();
    } else {
      return;
    }
  } else {
    const qa = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      question,
      answer,
      tags: detectedTags,
      category: detectedTags[0] || 'general',
      created: Date.now(),
      lastUsed: null,
      useCount: 0,
      difficulty: detectDifficulty(question),
      wordCount: answer.split(' ').length
    };
    currentQAs.push(qa);
  }
  
  try {
    await chrome.storage.sync.set({ interviewQAs: currentQAs });
    
    document.getElementById('quickQuestion').value = '';
    document.getElementById('quickAnswer').value = '';
    
    await loadQAs();
    await scanCurrentPage(); // Refresh to show new matches
    showStatus('Q&A saved with smart tags!', 'success');
  } catch (error) {
    console.error('Save error:', error);
    showStatus('Error saving Q&A', 'error');
  }
}

function detectQuestionCategory(question) {
  const q = question.toLowerCase();
  const tags = [];
  
  // Behavioral questions
  if (q.includes('tell me about a time') || q.includes('describe a situation') || 
      q.includes('give me an example') || q.includes('how did you handle')) {
    tags.push('behavioral');
  }
  
  // Technical questions
  if (q.includes('code') || q.includes('algorithm') || q.includes('system design') ||
      q.includes('technical') || q.includes('programming') || q.includes('database')) {
    tags.push('technical');
  }
  
  // Personal/Background
  if (q.includes('tell me about yourself') || q.includes('background') || 
      q.includes('introduce yourself')) {
    tags.push('personal', 'introduction');
  }
  
  // Motivation/Fit
  if (q.includes('why do you want') || q.includes('why this company') || 
      q.includes('why here') || q.includes('interested in')) {
    tags.push('motivation', 'company-fit');
  }
  
  // Strengths/Weaknesses
  if (q.includes('strength') || q.includes('weakness') || q.includes('good at') ||
      q.includes('areas for improvement')) {
    tags.push('self-assessment');
  }
  
  // Career goals
  if (q.includes('5 years') || q.includes('career goal') || q.includes('future plans')) {
    tags.push('career-goals');
  }
  
  // Conflict/Stress
  if (q.includes('conflict') || q.includes('stress') || q.includes('pressure') ||
      q.includes('difficult situation')) {
    tags.push('conflict-resolution');
  }
  
  // Leadership
  if (q.includes('leadership') || q.includes('team lead') || q.includes('manage')) {
    tags.push('leadership');
  }
  
  return tags.length > 0 ? tags : ['general'];
}

function detectDifficulty(question) {
  const q = question.toLowerCase();
  if (q.includes('system design') || q.includes('architecture') || q.includes('complex')) {
    return 'hard';
  }
  if (q.includes('technical') || q.includes('algorithm') || q.includes('challenge')) {
    return 'medium';
  }
  return 'easy';
}

function renderQAs(qas) {
  const container = document.getElementById('qaList');
  
  if (qas.length === 0) {
    container.innerHTML = '<div class="no-results">No Q&As saved yet. Add one above!</div>';
    return;
  }
  
  // Group by category for better organization
  const grouped = qas.reduce((acc, qa) => {
    const category = qa.category || qa.tags?.[0] || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(qa);
    return acc;
  }, {});
  
  const displayed = qas.slice(0, 8); // Show more items
  container.innerHTML = displayed.map(qa => {
    const difficultyColor = qa.difficulty === 'hard' ? '#e53e3e' : 
                           qa.difficulty === 'medium' ? '#dd6b20' : '#38a169';
    const categoryBadge = qa.category || qa.tags?.[0] || 'general';
    
    return `
      <div class="qa-item" style="position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <span class="category-badge" style="background: ${getCategoryColor(categoryBadge)}; color: white; padding: 2px 6px; border-radius: 12px; font-size: 0.7em; font-weight: 500;">
            ${categoryBadge}
          </span>
          <span class="difficulty-badge" style="color: ${difficultyColor}; font-size: 0.7em; font-weight: 600;">
            ${qa.difficulty || 'easy'}
          </span>
        </div>
        <div class="qa-question" style="margin-bottom: 8px;">${escapeHtml(qa.question)}</div>
        <div class="qa-answer" style="margin-bottom: 8px;">${escapeHtml(qa.answer.length > 80 ? qa.answer.substring(0, 80) + '...' : qa.answer)}</div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="qa-stats" style="font-size: 0.7em; color: #718096;">
            Used ${qa.useCount || 0} times • ${qa.wordCount || qa.answer.split(' ').length} words
          </div>
          <div class="qa-actions">
            <button class="btn btn-small btn-secondary qa-edit-btn" data-id="${qa.id}" title="Edit">✏️</button>
            <button class="btn btn-small btn-success qa-copy-btn" data-answer="${escapeHtml(qa.answer)}" title="Copy">📋</button>
            <button class="btn btn-small btn-danger qa-delete-btn" data-id="${qa.id}" title="Delete">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add event listeners for QA actions
  container.querySelectorAll('.qa-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openEditQAModal(id);
    });
  });
  
  container.querySelectorAll('.qa-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const answer = unescapeHtml(btn.getAttribute('data-answer'));
      copyAnswer(answer);
    });
  });
  
  container.querySelectorAll('.qa-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      deleteQA(id);
    });
  });
  
  if (qas.length > 8) {
    const viewAllDiv = document.createElement('div');
    viewAllDiv.style.cssText = 'text-align: center; margin-top: 8px; color: #718096; font-size: 0.8em;';
    viewAllDiv.innerHTML = `Showing 8 of ${qas.length} Q&As. <a href="#" class="view-all-link" style="color: #667eea;">View all in Options</a>`;
    container.appendChild(viewAllDiv);
    
    viewAllDiv.querySelector('.view-all-link').addEventListener('click', (e) => {
      e.preventDefault();
      openOptions();
    });
  }
}

function getCategoryColor(category) {
  const colors = {
    'behavioral': '#667eea',
    'technical': '#f56565',
    'personal': '#48bb78',
    'motivation': '#ed8936',
    'company-fit': '#38b2ac',
    'self-assessment': '#9f7aea',
    'career-goals': '#4299e1',
    'leadership': '#ed64a6',
    'general': '#718096'
  };
  return colors[category] || colors.general;
}

function filterQAs() {
  const search = document.getElementById('searchQAs').value.toLowerCase();
  
  if (!search.trim()) {
    renderQAs(currentQAs);
    return;
  }
  
  // Enhanced search with scoring
  const filtered = currentQAs.map(qa => ({
    qa,
    score: calculateSearchScore(search, qa)
  })).filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.qa);
  
  renderQAs(filtered);
  
  // Show search results count
  const statusEl = document.getElementById('statusMsg');
  if (filtered.length === 0) {
    statusEl.textContent = `No results found for "${search}"`;
    statusEl.className = 'status info';
    statusEl.style.display = 'block';
    setTimeout(() => statusEl.style.display = 'none', 2000);
  }
}

function calculateSearchScore(search, qa) {
  let score = 0;
  const searchTerms = search.split(/\s+/).filter(term => term.length > 1);
  
  // Search in question
  const question = qa.question.toLowerCase();
  searchTerms.forEach(term => {
    if (question.includes(term)) {
      score += question === term ? 2 : 1; // Exact match vs partial
    }
  });
  
  // Search in answer
  const answer = qa.answer.toLowerCase();
  searchTerms.forEach(term => {
    if (answer.includes(term)) {
      score += 0.5;
    }
  });
  
  // Search in tags
  const tags = (qa.tags || []).join(' ').toLowerCase();
  searchTerms.forEach(term => {
    if (tags.includes(term)) {
      score += 1.5;
    }
  });
  
  // Search in category
  const category = (qa.category || '').toLowerCase();
  searchTerms.forEach(term => {
    if (category.includes(term)) {
      score += 1;
    }
  });
  
  return score;
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

function openEditQAModal(id) {
  const qa = currentQAs.find(q => q.id === id);
  if (!qa) return;
  
  const answerModal = document.getElementById('answerModal');
  if (!answerModal) {
    showStatus('Modal not found', 'error');
    return;
  }
  
  document.getElementById('modalTitle').textContent = 'Edit Q&A';
  document.getElementById('questionInput').value = qa.question;
  document.getElementById('answerInput').value = qa.answer;
  document.getElementById('tagsInput').value = (qa.tags || []).join(', ');
  answerModal.style.display = 'block';
  
  // Remove previous event listeners to avoid duplicates
  const saveBtn = document.getElementById('saveAnswerBtn');
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  
  // Add new event listener
  newSaveBtn.addEventListener('click', async () => {
    const newQ = document.getElementById('questionInput').value.trim();
    const newA = document.getElementById('answerInput').value.trim();
    const newTags = document.getElementById('tagsInput').value.split(',').map(t => t.trim()).filter(Boolean);
    
    if (!newQ || !newA) {
      showStatus('Please fill in both question and answer', 'error');
      return;
    }
    
    if (newQ.length > 500) {
      showStatus('Question is too long (max 500 characters)', 'error');
      return;
    }
    
    if (newA.length > 2000) {
      showStatus('Answer is too long (max 2000 characters)', 'error');
      return;
    }
    
    qa.question = newQ;
    qa.answer = newA;
    qa.tags = newTags;
    qa.lastModified = Date.now();
    
    try {
      await chrome.storage.sync.set({ interviewQAs: currentQAs });
      answerModal.style.display = 'none';
      await loadQAs();
      await scanCurrentPage();
      showStatus('Q&A updated!', 'success');
    } catch (error) {
      console.error('Save error:', error);
      showStatus('Error saving Q&A', 'error');
    }
  });
}

async function deleteQA(id) {
  const qa = currentQAs.find(q => q.id === id);
  if (!qa) {
    showStatus('Q&A not found', 'error');
    return;
  }
  
  const questionPreview = qa.question.length > 50 ? 
    qa.question.substring(0, 50) + '...' : 
    qa.question;
    
  if (!confirm(`Delete this Q&A?\n\n"${questionPreview}"`)) {
    return;
  }
  
  try {
    currentQAs = currentQAs.filter(q => q.id !== id);
    await chrome.storage.sync.set({ interviewQAs: currentQAs });
    await loadQAs();
    await scanCurrentPage();
    showStatus('Q&A deleted!', 'success');
  } catch (error) {
    console.error('Delete error:', error);
    showStatus('Error deleting Q&A', 'error');
  }
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
  
  // Auto-hide after 3 seconds, except for errors which stay longer
  const hideDelay = type === 'error' ? 5000 : 3000;
  setTimeout(() => {
    if (statusEl.style.display !== 'none') {
      statusEl.style.display = 'none';
    }
  }, hideDelay);
  
  // Add fade out animation
  setTimeout(() => {
    if (statusEl.style.display !== 'none') {
      statusEl.style.opacity = '0.5';
      setTimeout(() => {
        statusEl.style.display = 'none';
        statusEl.style.opacity = '1';
      }, 500);
    }
  }, hideDelay - 500);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeForJs(text) {
  if (!text) return '';
  return text.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function unescapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.innerHTML = text;
  return div.textContent || div.innerText || '';
}

// --- Footer and Modal Logic ---
function setupFooterAndModals() {
  // Footer buttons
  const optionsBtn = document.getElementById('optionsBtn');
  if (optionsBtn) optionsBtn.addEventListener('click', openOptions);

  // Modal controls
  const answerModal = document.getElementById('answerModal');
  const modalClose = document.getElementById('modalClose');
  const cancelBtn = document.getElementById('cancelBtn');
  if (modalClose) modalClose.addEventListener('click', () => answerModal.style.display = 'none');
  if (cancelBtn) cancelBtn.addEventListener('click', () => answerModal.style.display = 'none');

  // Template modal controls
  const templateModal = document.getElementById('templateModal');
  const templateModalClose = document.getElementById('templateModalClose');
  const templateCancelBtn = document.getElementById('templateCancelBtn');
  if (templateModalClose) templateModalClose.addEventListener('click', () => templateModal.style.display = 'none');
  if (templateCancelBtn) templateCancelBtn.addEventListener('click', () => templateModal.style.display = 'none');
  
  // Add sample Q&As button if no Q&As exist
  if (currentQAs.length === 0) {
    addSampleQAsButton();
  }
}

function addSampleQAsButton() {
  const qaList = document.getElementById('qaList');
  if (qaList && qaList.querySelector('.no-results')) {
    qaList.innerHTML = `
      <div class="no-results">
        <p>No Q&As saved yet.</p>
        <button class="btn btn-primary" id="loadSampleBtn" style="margin-top: 10px;">
          📝 Load Sample Q&As
        </button>
      </div>
    `;
    
    document.getElementById('loadSampleBtn').addEventListener('click', loadSampleQAs);
  }
}

async function loadSampleQAs() {
  try {
    const response = await fetch(chrome.runtime.getURL('templates/sample_qas.json'));
    const data = await response.json();
    
    if (data.qas && Array.isArray(data.qas)) {
      currentQAs = data.qas.map(qa => ({
        ...qa,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        created: Date.now()
      }));
      
      await chrome.storage.sync.set({ interviewQAs: currentQAs });
      await loadQAs();
      await scanCurrentPage();
      showStatus(`Loaded ${data.qas.length} sample Q&As!`, 'success');
    }
  } catch (error) {
    console.error('Load sample Q&As error:', error);
    showStatus('Error loading sample Q&As', 'error');
  }
}


// Remove the deprecated window assignments as they're no longer needed
// All event handlers are now properly attached via addEventListener

// --- AI and Template Features ---
function showQuestionSuggestions() {
  const input = document.getElementById('quickQuestion');
  const dropdown = document.getElementById('questionSuggestions');
  const query = input.value.toLowerCase().trim();
  
  if (query.length < 2) {
    dropdown.style.display = 'none';
    return;
  }
  
  const commonQuestions = [
    "Tell me about yourself",
    "Why do you want to work here?",
    "What are your strengths?",
    "What are your weaknesses?", 
    "Where do you see yourself in 5 years?",
    "Why are you leaving your current job?",
    "Describe a challenging project you worked on",
    "How do you handle stress and pressure?",
    "What motivates you?",
    "Do you have any questions for us?",
    "What is your expected salary?",
    "Describe a time you showed leadership",
    "Tell me about a conflict you resolved",
    "What is your greatest accomplishment?",
    "How do you prioritize your work?"
  ];
  
  const matches = commonQuestions.filter(q => 
    q.toLowerCase().includes(query) || 
    query.split(' ').some(word => q.toLowerCase().includes(word))
  ).slice(0, 5);
  
  if (matches.length === 0) {
    dropdown.style.display = 'none';
    return;
  }
  
  dropdown.innerHTML = matches.map(question => 
    `<div class="suggestion-item" data-question="${escapeHtml(question)}">${escapeHtml(question)}</div>`
  ).join('');
  
  dropdown.style.display = 'block';
  
  // Add click handlers
  dropdown.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent blur from firing
      input.value = item.getAttribute('data-question');
      dropdown.style.display = 'none';
      document.getElementById('quickAnswer').focus();
    });
  });
}

function hideQuestionSuggestions() {
  setTimeout(() => {
    document.getElementById('questionSuggestions').style.display = 'none';
  }, 150);
}

async function improveAnswerWithAI() {
  const question = document.getElementById('quickQuestion').value.trim();
  const currentAnswer = document.getElementById('quickAnswer').value.trim();
  
  if (!question) {
    showStatus('Please enter a question first', 'error');
    return;
  }
  
  // Mock AI improvement (replace with actual AI API call)
  showStatus('Improving answer with AI...', 'info');
  
  try {
    const improvedAnswer = await generateImprovedAnswer(question, currentAnswer);
    document.getElementById('quickAnswer').value = improvedAnswer;
    showStatus('Answer improved!', 'success');
  } catch (error) {
    console.error('AI improvement error:', error);
    showStatus('AI service unavailable. Try again later.', 'error');
  }
}

async function generateImprovedAnswer(question, currentAnswer) {
  // Mock AI response - in production, this would call an actual AI API
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay
  
  const improvements = {
    structure: "I'd be happy to answer that. ",
    specificity: "Based on my experience, ",
    conclusion: " I'm excited about the opportunity to contribute to your team."
  };
  
  if (currentAnswer) {
    return `${improvements.structure}${currentAnswer}${improvements.conclusion}`;
  }
  
  // Generate template based on question type
  const q = question.toLowerCase();
  if (q.includes('about yourself')) {
    return `I'm a passionate professional with [X years] of experience in [field]. I specialize in [key skills] and have successfully [achievement]. I'm particularly excited about [relevant interest] and am always eager to take on new challenges that help me grow professionally.`;
  } else if (q.includes('why') && q.includes('work here')) {
    return `I'm excited about this opportunity because [company/role attraction]. Your company's [specific value/project] aligns perfectly with my career goals and values. I believe my experience in [relevant skills] would contribute meaningfully to [specific team/project].`;
  } else if (q.includes('strength')) {
    return `One of my key strengths is [specific strength]. For example, [specific example with context and result]. This has helped me [positive outcome] and I believe it would be valuable in this role because [connection to job].`;
  }
  
  return `${improvements.structure}[Your specific answer here]. ${improvements.specificity}[Add relevant examples]. ${improvements.conclusion}`;
}

function showTemplateOptions() {
  const question = document.getElementById('quickQuestion').value.trim();
  
  if (!question) {
    showStatus('Please enter a question first', 'error');
    return;
  }
  
  const templates = getTemplatesForQuestion(question);
  
  if (templates.length === 0) {
    showStatus('No templates available for this question type', 'info');
    return;
  }
  
  // Show template selection modal or dropdown
  const templateModal = document.getElementById('templateModal');
  if (templateModal) {
    document.querySelector('#templateModal .modal-header h3').textContent = 'Choose Template';
    document.getElementById('templateForm').innerHTML = templates.map((template, index) => `
      <div class="template-option" style="margin-bottom: 15px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer;" data-template="${escapeHtml(template.content)}">
        <div style="font-weight: 600; margin-bottom: 4px;">${template.name}</div>
        <div style="font-size: 0.9em; color: #718096;">${template.description}</div>
      </div>
    `).join('');
    
    templateModal.style.display = 'block';
    
    // Add click handlers for template selection
    document.querySelectorAll('.template-option').forEach(option => {
      option.addEventListener('click', () => {
        const template = option.getAttribute('data-template');
        document.getElementById('quickAnswer').value = unescapeHtml(template);
        templateModal.style.display = 'none';
        showStatus('Template applied!', 'success');
      });
    });
  }
}

function getTemplatesForQuestion(question) {
  const q = question.toLowerCase();
  const templates = [];
  
  if (q.includes('about yourself')) {
    templates.push({
      name: 'Professional Introduction',
      description: 'Structured intro with experience and goals',
      content: 'I\'m a [profession] with [X years] of experience in [field]. I specialize in [skills] and have successfully [achievement]. I\'m passionate about [interest] and excited to contribute to [company goal].'
    });
    templates.push({
      name: 'Career Journey',
      description: 'Focus on career progression and growth',
      content: 'My career began in [starting point] where I developed [foundational skills]. I then moved to [next role] which taught me [new skills]. Now I\'m looking to [future goal] and believe this role aligns perfectly with my aspirations.'
    });
  }
  
  if (q.includes('strength')) {
    templates.push({
      name: 'STAR Format Strength',
      description: 'Situation, Task, Action, Result structure',
      content: 'One of my key strengths is [strength]. For example, at [company], I faced [situation] where I needed to [task]. I [action taken] which resulted in [positive outcome]. This demonstrates my ability to [skill/quality].'
    });
  }
  
  if (q.includes('weakness')) {
    templates.push({
      name: 'Growth-Focused Weakness',
      description: 'Shows self-awareness and improvement',
      content: 'I used to struggle with [weakness], but I\'ve been actively working on this by [improvement actions]. For example, [specific example]. I\'ve seen improvement in [measurable way] and continue to [ongoing efforts].'
    });
  }
  
  return templates;
}
