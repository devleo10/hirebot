import { getActiveProfile, getAllAnswers, normalizeQuestion } from '../shared/storage.js';

const FIELD_MAPPINGS = [
  { keys: ['first name', 'firstname', 'given-name', 'given name'], profileKey: 'firstName' },
  { keys: ['last name', 'lastname', 'surname', 'family-name'], profileKey: 'lastName' },
  { keys: ['full name', 'name'], profileKey: 'fullName' },
  { keys: ['email', 'e-mail'], profileKey: 'email' },
  { keys: ['phone', 'mobile'], profileKey: 'phone' },
  { keys: ['college', 'university', 'school'], profileKey: 'college' },
  { keys: ['github', 'git hub'], profileKey: 'github' },
  { keys: ['portfolio', 'website', 'site', 'personal site'], profileKey: 'portfolio' },
  { keys: ['linkedin'], profileKey: 'linkedin' },
  { keys: ['skills', 'tech stack'], profileKey: 'skills' },
  { keys: ['location', 'city'], profileKey: 'location' }
];

async function smartFill() {
  const profile = await getActiveProfile();
  if (!profile) {
    console.info('[JobJinni] No active profile');
    return;
  }
  fillBasicInputs(profile);
  await fillQuestions(profile);
}

function fieldScore(fieldLabel, keys) {
  const l = fieldLabel.toLowerCase();
  return keys.some(k => l.includes(k)) ? 1 : 0;
}

function fillBasicInputs(profile) {
  const inputs = Array.from(document.querySelectorAll('input, textarea'));
  inputs.forEach(el => {
    if (el.matches('[type=password],[type=hidden],[type=checkbox],[type=radio]')) return;
    const labelText = getLabelText(el) || el.getAttribute('placeholder') || '';
    if (!labelText) return;
    const mapping = FIELD_MAPPINGS.find(m => fieldScore(labelText, m.keys));
    if (!mapping) return;
    const value = profile[mapping.profileKey];
    if (value && !el.value) {
      setValue(el, value);
    }
  });
}

function setValue(el, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(el.__proto__, 'value')?.set;
  nativeInputValueSetter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function getLabelText(el) {
  const id = el.id;
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) return label.innerText.trim();
  }
  let cur = el.parentElement;
  for (let i = 0; i < 2 && cur; i++) {
    const label = cur.querySelector('label');
    if (label) return label.innerText.trim();
    cur = cur.parentElement;
  }
  return '';
}

const SIMILARITY_THRESHOLD = 0.6; // lowered for better fuzzy capture
let JJ_DEBUG = false; // toggle via window.JOBJINNI_DEBUG = true in console

function extractQuestionText(area) {
  // Priority: explicit label, aria-label, placeholder, nearby heading/text
  const direct = getLabelText(area) || area.getAttribute('aria-label') || area.getAttribute('placeholder');
  if (direct) return direct;
  // Look for preceding sibling text elements (p, div, label, span with length)
  const container = area.parentElement;
  if (container) {
    // Collect up to a couple of text candidates
    const candidates = [];
    let prev = area.previousElementSibling;
    let hops = 0;
    while (prev && hops < 3) {
      const txt = (prev.innerText || '').trim();
      if (txt.split(/\s+/).length >= 3) candidates.push(txt);
      prev = prev.previousElementSibling;
      hops++;
    }
    if (candidates.length) return candidates[0];
  }
  return '';
}

async function fillQuestions(profile) {
  const answers = await getAllAnswers();
  const textareas = Array.from(document.querySelectorAll('textarea'));
  textareas.forEach(area => {
    const label = extractQuestionText(area);
    if (!label) return;
    const norm = normalizeQuestion(label);
    let bestKey = null;
    let bestScore = 0;
    Object.keys(answers).forEach(key => {
      const ans = answers[key];
      if (!ans || !ans.text) return; // skip empty template placeholders
      // Fast exact / substring checks first
      if (key === norm) {
        bestKey = key; bestScore = 1; return;
      }
      if (norm.includes(key) || key.includes(norm)) {
        const heuristic = key.length / norm.length > 0.5 ? 0.95 : 0.7;
        if (heuristic > bestScore) { bestScore = heuristic; bestKey = key; }
        return;
      }
      const score = similarity(norm, key);
      if (score >= SIMILARITY_THRESHOLD && score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    });
    if (bestKey) {
      const ans = answers[bestKey];
      if (!ans.profileId || ans.profileId === profile.id) {
        if (!area.value) {
          setValue(area, ans.text);
          injectBadge(area, 'JobJinni ✓');
          JJ_DEBUG && console.log('[JobJinni] Filled textarea', { label, norm, matchedKey: bestKey, score: bestScore });
        } else {
          JJ_DEBUG && console.log('[JobJinni] Skipped (already has value)', { label });
        }
      }
    } else {
      JJ_DEBUG && console.log('[JobJinni] No match for', { label, norm });
    }
  });
}

function similarity(a, b) {
  if (a === b) return 1;
  const setA = new Set(a.split(' '));
  const setB = new Set(b.split(' '));
  const inter = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return inter / union;
}

function injectBadge(el, text) {
  if (el.dataset.jjBadge) return;
  const badge = document.createElement('span');
  badge.textContent = text;
  badge.style.position = 'absolute';
  badge.style.right = '4px';
  badge.style.top = '4px';
  badge.style.background = '#2563eb';
  badge.style.color = '#fff';
  badge.style.fontSize = '10px';
  badge.style.padding = '2px 4px';
  badge.style.borderRadius = '3px';
  badge.style.fontFamily = 'system-ui, sans-serif';
  badge.style.zIndex = '999999';
  badge.style.pointerEvents = 'none';
  badge.style.boxShadow = '0 1px 2px rgba(0,0,0,0.15)';
  el.style.position = 'relative';
  el.parentElement?.style.position || (el.parentElement.style.position = 'relative');
  el.parentElement?.appendChild(badge);
  el.dataset.jjBadge = '1';
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'SMART_FILL_TRIGGER') {
    smartFill();
  }
});

// Auto run once after load (debounced)
setTimeout(smartFill, 1500);
