import { handleRuntimeMessage } from '../shared/messages.js';
import { getAllProfiles, getAllAnswers, saveAnswers, normalizeQuestion } from '../shared/storage.js';

// Lazy dynamic import pattern not needed; templates is lightweight.
async function seedTemplates() {
  try {
    const { DEFAULT_TEMPLATE_QUESTIONS } = await import('../shared/templates.js');
    const answers = await getAllAnswers();
    let mutated = false;
    DEFAULT_TEMPLATE_QUESTIONS.forEach(q => {
      const key = normalizeQuestion(q);
      if (!answers[key]) {
        answers[key] = { text: '', profileId: null, updatedAt: Date.now(), rawQuestion: q };
        mutated = true;
      }
    });
    if (mutated) await saveAnswers(answers);
  } catch (e) {
    console.warn('[JobJinni] Template seed failed', e);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('JobJinni installed');
  seedTemplates();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleRuntimeMessage(message, sender, sendResponse);
  return true; // async
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'trigger-smart-fill') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SMART_FILL_TRIGGER' });
    }
  }
});

// Context menu for quick smart fill (permission required: contextMenus)
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.contextMenus?.create) {
    try {
      chrome.contextMenus.create({
        id: 'jobJinniSmartFill',
        title: 'JobJinni Smart Fill',
        contexts: ['page', 'editable']
      });
    } catch (e) {
      console.warn('[JobJinni] contextMenus.create failed', e);
    }
  }
});

if (chrome.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'jobJinniSmartFill' && tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SMART_FILL_TRIGGER' });
    }
  });
}

// Expose profiles to devtools (debug aid)
chrome.runtime.onMessage.addListener((msg, _, send) => {
  if (msg?.type === 'GET_PROFILES') {
    getAllProfiles().then(profiles => send({ profiles }));
    return true;
  }
});

// Opportunistic seed on service worker start (e.g., after update)
seedTemplates();
