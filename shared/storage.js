// shared/storage.js - Storage utilities for HireBot

export async function getQAs() {
  const result = await chrome.storage.sync.get(['interviewQAs']);
  return result.interviewQAs || [];
}

export async function saveQAs(qas) {
  await chrome.storage.sync.set({ interviewQAs: qas });
}

export async function addQA(qa) {
  const qas = await getQAs();
  qas.push(qa);
  await saveQAs(qas);
  return qa;
}

export async function updateQA(id, updates) {
  const qas = await getQAs();
  const index = qas.findIndex(qa => qa.id === id);
  if (index >= 0) {
    qas[index] = { ...qas[index], ...updates };
    await saveQAs(qas);
    return qas[index];
  }
  return null;
}

export async function deleteQA(id) {
  const qas = await getQAs();
  const filtered = qas.filter(qa => qa.id !== id);
  await saveQAs(filtered);
  return filtered;
}

export async function getSettings() {
  const result = await chrome.storage.sync.get(['autoSuggest', 'highlightFields']);
  return {
    autoSuggest: result.autoSuggest !== false,
    highlightFields: result.highlightFields !== false
  };
}

export async function saveSettings(settings) {
  await chrome.storage.sync.set(settings);
}
