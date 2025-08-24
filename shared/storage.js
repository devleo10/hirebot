// Simple storage helpers using chrome.storage.local

const KEYS = {
  PROFILES: 'jj_profiles',
  ACTIVE_PROFILE_ID: 'jj_active_profile_id',
  ANSWERS: 'jj_answers' // map questionKey -> { text, profileId?, updatedAt }
};

export function getAllProfiles() {
  return new Promise((resolve) => {
    chrome.storage.local.get([KEYS.PROFILES], (res) => {
      resolve(res[KEYS.PROFILES] || []);
    });
  });
}

export function saveProfiles(profiles) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [KEYS.PROFILES]: profiles }, resolve);
  });
}

export function getActiveProfileId() {
  return new Promise((resolve) => {
    chrome.storage.local.get([KEYS.ACTIVE_PROFILE_ID], (res) => {
      resolve(res[KEYS.ACTIVE_PROFILE_ID] || null);
    });
  });
}

export function setActiveProfileId(id) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [KEYS.ACTIVE_PROFILE_ID]: id }, resolve);
  });
}

export async function getActiveProfile() {
  const [profiles, activeId] = await Promise.all([getAllProfiles(), getActiveProfileId()]);
  return profiles.find(p => p.id === activeId) || null;
}

export function getAllAnswers() {
  return new Promise((resolve) => {
    chrome.storage.local.get([KEYS.ANSWERS], (res) => {
      resolve(res[KEYS.ANSWERS] || {});
    });
  });
}

export function saveAnswers(answers) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [KEYS.ANSWERS]: answers }, resolve);
  });
}

export async function upsertAnswer(rawQuestion, text, profileId) {
  const key = normalizeQuestion(rawQuestion);
  const answers = await getAllAnswers();
  answers[key] = { text, profileId: profileId || null, updatedAt: Date.now(), rawQuestion };
  await saveAnswers(answers);
  return answers[key];
}

export function normalizeQuestion(q) {
  return q.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 120);
}

export { KEYS };
