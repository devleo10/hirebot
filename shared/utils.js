// shared/utils.js - Utility functions for HireBot

export const log = (...args) => console.log("[HireBot]", ...args);

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function matchQuestion(queryText, savedQuestion) {
  const query = queryText.toLowerCase().trim();
  const question = savedQuestion.toLowerCase().trim();
  
  // Exact match
  if (query === question) return 100;
  
  // Contains match
  if (question.includes(query) || query.includes(question)) return 80;
  
  // Word overlap
  const queryWords = query.split(/\W+/).filter(w => w.length > 2);
  const questionWords = question.split(/\W+/).filter(w => w.length > 2);
  
  const overlap = queryWords.filter(word => 
    questionWords.some(qWord => qWord.includes(word) || word.includes(qWord))
  ).length;
  
  const score = (overlap / Math.max(queryWords.length, questionWords.length)) * 60;
  return score;
}

export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString();
}

export function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

export function toClipboard(text) {
  return navigator.clipboard.writeText(text || "");
}

export function mustache(template, data) {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    const parts = key.split(".");
    let cur = data;
    for (const p of parts) {
      cur = (cur && p in cur) ? cur[p] : "";
    }
    return (cur ?? "").toString();
  });
}

// Calculate similarity between two strings using Jaccard similarity
export function jaccardSimilarity(str1, str2) {
  const tokens1 = new Set(str1.toLowerCase().split(/\s+/));
  const tokens2 = new Set(str2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
}

// Find best matching answer for a question
export function findBestAnswer(question, savedAnswers, threshold = 0.3) {
  let bestMatch = null;
  let bestScore = threshold;
  
  for (const answer of savedAnswers) {
    const score = jaccardSimilarity(question, answer.question);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = answer;
    }
  }
  
  return bestMatch;
}
