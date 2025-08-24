// shared/selectors.js
// Heuristics for extracting generic interview questions from forms

export function extractQuestions() {
  // Find all visible textarea and input fields with labels or placeholders
  const fields = [];
  const inputs = [...document.querySelectorAll('input, textarea')].filter(el => el.offsetParent !== null);
  inputs.forEach(el => {
    let label = '';
    if (el.placeholder) label = el.placeholder;
    // Try to find a label element
    if (!label && el.id) {
      const lbl = document.querySelector(`label[for='${el.id}']`);
      if (lbl) label = lbl.textContent.trim();
    }
    // Try parent label
    if (!label && el.parentElement && el.parentElement.tagName === 'LABEL') {
      label = el.parentElement.textContent.trim();
    }
    if (label) {
      fields.push({
        selector: uniqueSelector(el),
        label,
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || ''
      });
    }
  });
  return fields;
}

function uniqueSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && parts.length < 5) {
    let sel = node.nodeName.toLowerCase();
    if (node.classList.length) sel += '.' + [...node.classList].slice(0,2).map(c => CSS.escape(c)).join('.');
    const idx = [...(node.parentNode?.children || [])].filter(n => n.nodeName === node.nodeName).indexOf(node);
    if (idx >= 0) sel += `:nth-of-type(${idx+1})`;
    parts.unshift(sel);
    node = node.parentElement;
  }
  return parts.join(' > ');
}
