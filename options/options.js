// options/options.js - Q&A Management for HireBot

let editingId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadQAs();
  await loadSettings();
  setupEventListeners();
  updateStats();
});

function setupEventListeners() {
  document.getElementById('saveQABtn').addEventListener('click', saveQA);
  document.getElementById('cancelEditBtn').addEventListener('click', cancelEdit);
  document.getElementById('searchInput').addEventListener('input', filterQAs);
  document.getElementById('exportBtn').addEventListener('click', exportQAs);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', importQAs);
  document.getElementById('autoSuggest').addEventListener('change', saveSettings);
  document.getElementById('highlightFields').addEventListener('change', saveSettings);
}

async function loadQAs() {
  const result = await chrome.storage.sync.get(['interviewQAs']);
  const qas = result.interviewQAs || [];
  renderQAs(qas);
}

async function loadSettings() {
  const result = await chrome.storage.sync.get(['autoSuggest', 'highlightFields']);
  const autoSuggestEl = document.getElementById('autoSuggest');
  const highlightFieldsEl = document.getElementById('highlightFields');
  if (autoSuggestEl) autoSuggestEl.checked = result.autoSuggest !== false;
  if (highlightFieldsEl) highlightFieldsEl.checked = result.highlightFields !== false;
}

async function saveSettings() {
  const settings = {
    autoSuggest: document.getElementById('autoSuggest').checked,
    highlightFields: document.getElementById('highlightFields').checked
  };
  await chrome.storage.sync.set(settings);
}

async function saveQA() {
  const question = document.getElementById('questionInput').value.trim();
  const answer = document.getElementById('answerInput').value.trim();
  const tags = document.getElementById('tagsInput').value.trim();

  if (!question || !answer) {
    alert('Please fill in both question and answer');
    return;
  }

  const result = await chrome.storage.sync.get(['interviewQAs']);
  let qas = result.interviewQAs || [];

  const qa = {
    id: editingId || Date.now().toString(),
    question,
    answer,
    tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [],
    created: editingId ? qas.find(q => q.id === editingId)?.created || Date.now() : Date.now(),
    lastUsed: null,
    useCount: editingId ? qas.find(q => q.id === editingId)?.useCount || 0 : 0
  };

  if (editingId) {
    qas = qas.map(q => q.id === editingId ? qa : q);
  } else {
    qas.push(qa);
  }

  await chrome.storage.sync.set({ interviewQAs: qas });
  
  // Clear form
  document.getElementById('questionInput').value = '';
  document.getElementById('answerInput').value = '';
  document.getElementById('tagsInput').value = '';
  
  cancelEdit();
  await loadQAs();
  updateStats();
}

function cancelEdit() {
  editingId = null;
  document.getElementById('saveQABtn').textContent = '💾 Save Q&A';
  document.getElementById('cancelEditBtn').style.display = 'none';
  document.getElementById('questionInput').value = '';
  document.getElementById('answerInput').value = '';
  document.getElementById('tagsInput').value = '';
}

function editQA(id) {
  chrome.storage.sync.get(['interviewQAs'], (result) => {
    const qas = result.interviewQAs || [];
    const qa = qas.find(q => q.id === id);
    if (qa) {
      editingId = id;
      document.getElementById('questionInput').value = qa.question;
      document.getElementById('answerInput').value = qa.answer;
      document.getElementById('tagsInput').value = qa.tags.join(', ');
      document.getElementById('saveQABtn').textContent = '💾 Update Q&A';
      document.getElementById('cancelEditBtn').style.display = 'inline-block';
      document.getElementById('questionInput').scrollIntoView({ behavior: 'smooth' });
    }
  });
}

async function deleteQA(id) {
  if (!confirm('Are you sure you want to delete this Q&A?')) return;
  
  const result = await chrome.storage.sync.get(['interviewQAs']);
  const qas = result.interviewQAs || [];
  const filtered = qas.filter(q => q.id !== id);
  
  await chrome.storage.sync.set({ interviewQAs: filtered });
  await loadQAs();
  updateStats();
}

function renderQAs(qas) {
  const container = document.getElementById('qaList');
  
  if (qas.length === 0) {
    container.innerHTML = '<div class="no-results">No Q&As found. Add some interview questions and answers above!</div>';
    return;
  }

  container.innerHTML = qas.map(qa => `
    <div class="qa-item">
      <div class="qa-question">${escapeHtml(qa.question)}</div>
      <div class="qa-answer">${escapeHtml(qa.answer.length > 150 ? qa.answer.substring(0, 150) + '...' : qa.answer)}</div>
      ${qa.tags.length > 0 ? `<div class="qa-tags">${qa.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      <div class="qa-actions">
        <button class="btn btn-secondary" onclick="editQA('${qa.id}')">✏️ Edit</button>
        <button class="btn btn-danger" onclick="deleteQA('${qa.id}')">🗑️ Delete</button>
        <small style="color: #718096; margin-left: auto;">Used ${qa.useCount || 0} times</small>
      </div>
    </div>
  `).join('');
}

function filterQAs() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  chrome.storage.sync.get(['interviewQAs'], (result) => {
    const qas = result.interviewQAs || [];
    const filtered = qas.filter(qa => 
      qa.question.toLowerCase().includes(search) || 
      qa.answer.toLowerCase().includes(search) ||
      qa.tags.some(tag => tag.toLowerCase().includes(search))
    );
    renderQAs(filtered);
  });
}

async function updateStats() {
  const result = await chrome.storage.sync.get(['interviewQAs']);
  const qas = result.interviewQAs || [];
  const totalQAsEl = document.getElementById('totalQAs');
  const recentlyUsedEl = document.getElementById('recentlyUsed');
  if (totalQAsEl) totalQAsEl.textContent = qas.length;
  const recentlyUsed = qas.filter(qa => {
    if (!qa.lastUsed) return false;
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    return qa.lastUsed > weekAgo;
  }).length;
  if (recentlyUsedEl) recentlyUsedEl.textContent = recentlyUsed;
}

function exportQAs() {
  chrome.storage.sync.get(['interviewQAs'], (result) => {
    const qas = result.interviewQAs || [];
    const dataStr = JSON.stringify(qas, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `hirebot-qas-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  });
}

function importQAs(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) {
        alert('Invalid file format');
        return;
      }
      
      const result = await chrome.storage.sync.get(['interviewQAs']);
      const existing = result.interviewQAs || [];
      
      // Merge with existing, avoiding duplicates
      const merged = [...existing];
      imported.forEach(importedQA => {
        if (!existing.find(qa => qa.question === importedQA.question)) {
          merged.push({
            ...importedQA,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
          });
        }
      });
      
      await chrome.storage.sync.set({ interviewQAs: merged });
      await loadQAs();
      updateStats();
      alert(`Imported ${imported.length} Q&As`);
    } catch (error) {
      alert('Error importing file: ' + error.message);
    }
  };
  reader.readAsText(file);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make functions globally available for onclick handlers
window.editQA = editQA;
window.deleteQA = deleteQA;
