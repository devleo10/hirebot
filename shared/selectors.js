// shared/selectors.js
// Heuristics for extracting generic interview questions from forms

export function extractQuestions() {
  const fields = [];
  const inputs = [...document.querySelectorAll('input, textarea')].filter(el => {
    return el.offsetParent !== null && 
           el.type !== 'hidden' && 
           el.type !== 'submit' && 
           el.type !== 'button' &&
           el.type !== 'checkbox' &&
           el.type !== 'radio' &&
           el.type !== 'range' &&
           el.type !== 'number' &&
           el.type !== 'date' &&
           el.type !== 'time' &&
           el.type !== 'file' &&
           el.type !== 'color' &&
           el.type !== 'search' &&
           !el.disabled &&
           !el.readOnly;
  });

  inputs.forEach(el => {
    const label = extractFieldLabel(el);
    
    // Only include if it looks like an actual interview question
    if (label && isLikelyInterviewQuestion(label, el)) {
      fields.push({
        selector: uniqueSelector(el),
        label: label,
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        placeholder: el.placeholder || '',
        value: el.value || ''
      });
    }
  });
  
  return fields;
}

function extractFieldLabel(el) {
  let label = '';
  
  // Try placeholder first (but validate it)
  if (el.placeholder && el.placeholder.length > 10 && isLikelyQuestionText(el.placeholder)) {
    label = el.placeholder;
  }
  
  // Try associated label
  if (!label && el.id) {
    const lbl = document.querySelector(`label[for='${el.id}']`);
    if (lbl) {
      const labelText = lbl.textContent.trim();
      if (labelText.length > 10 && isLikelyQuestionText(labelText)) {
        label = labelText;
      }
    }
  }
  
  // Try parent label
  if (!label && el.closest('label')) {
    const parentLabel = el.closest('label');
    const labelText = parentLabel.textContent.replace(el.value || '', '').trim();
    if (labelText.length > 10 && isLikelyQuestionText(labelText)) {
      label = labelText;
    }
  }
  
  // Try preceding elements (like div, span, p before the input)
  if (!label) {
    const prevElement = el.previousElementSibling;
    if (prevElement) {
      const text = prevElement.textContent.trim();
      if (text.length > 10 && text.length < 500 && isLikelyQuestionText(text)) {
        label = text;
      }
    }
  }
  
  // Try parent container text
  if (!label) {
    const parent = el.parentElement;
    if (parent) {
      // Look for question text in parent's direct text nodes
      const walker = document.createTreeWalker(
        parent,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            const text = node.textContent.trim();
            return text.length > 10 && text.length < 500 && 
                   isLikelyQuestionText(text) ? 
                   NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
          }
        }
      );
      
      const textNode = walker.nextNode();
      if (textNode) {
        label = textNode.textContent.trim();
      }
    }
  }
  
  // Clean up label
  if (label) {
    label = label.replace(/[*:]+$/g, '').trim();
    // Remove common non-question patterns
    if (label.length < 10 || 
        /^(filter|sort|search|select|choose|pick|minimum|maximum|min|max|from|to|between)$/i.test(label) ||
        /^\d+$/.test(label)) {
      label = '';
    }
  }
  
  return label;
}

function isLikelyQuestionText(text) {
  if (!text || text.length < 10) return false;
  
  // Common filter/control patterns to exclude
  const excludePatterns = [
    /^(salary|pay|wage|income|amount|price|cost|fee|budget|rate)\s*(from|to|min|max|minimum|maximum|range|between)?$/i,
    /^(location|city|state|country|zip|postal|address|area|region|distance)$/i,
    /^(company|organization|employer|industry|department|role|position|title|level)$/i,
    /^(experience|years?|months?|duration|period|time|since|until|from|to)$/i,
    /^(skills?|technology|technologies|language|languages|tool|tools|software)$/i,
    /^(education|degree|qualification|certification|course|school|university)$/i,
    /^(filter|sort|search|select|choose|pick|option|dropdown|checkbox|radio)$/i,
    /^(apply|submit|send|save|cancel|reset|clear|delete|remove|edit|update)$/i,
    /^(name|email|phone|contact|profile|account|login|password|username)$/i,
    /^\d+(\s*(k|thousand|million|m|yr|year|month|mo|day|hour|hr|min|sec))?$/i,
    /^(yes|no|true|false|on|off|enabled|disabled|active|inactive)$/i,
    /^(all|any|none|other|others|various|multiple|single|one|two|three)$/i
  ];
  
  // Check if text matches exclude patterns
  if (excludePatterns.some(pattern => pattern.test(text.trim()))) {
    return false;
  }
  
  // Positive indicators for interview questions
  const questionIndicators = [
    /\b(tell|describe|explain|why|how|what|when|where|which|would|could|should|do|did|have|has|are|is|will|can)\b/i,
    /\b(experience|background|strength|weakness|challenge|goal|motivation|passion|interest)\b/i,
    /\b(team|project|problem|solution|achievement|accomplishment|success|failure|learn|grow)\b/i,
    /\b(yourself|career|future|past|previous|current|ideal|preferred|favorite|best|worst)\b/i,
    /\?(.*)?$/,  // Ends with question mark
    /\b(interview|question|answer|response|comment|feedback|opinion|thought|view)\b/i
  ];
  
  // Must have at least one question indicator
  return questionIndicators.some(pattern => pattern.test(text));
}

function isLikelyInterviewQuestion(label, element) {
  if (!label || label.length < 10) return false;
  
  // Check element characteristics
  const isTextarea = element.tagName.toLowerCase() === 'textarea';
  const isLongInput = element.type === 'text' && (element.maxLength > 100 || !element.maxLength);
  
  // Textareas are more likely to be for detailed answers
  if (isTextarea) return true;
  
  // Long text inputs might be for questions
  if (isLongInput && isLikelyQuestionText(label)) return true;
  
  // Check for specific interview question patterns
  const interviewPatterns = [
    /\b(tell\s+(me|us)\s+about|describe\s+your|explain\s+your)\b/i,
    /\b(why\s+(do\s+)?you\s+(want|chose|decided|like|think))\b/i,
    /\b(what\s+(is\s+your|are\s+your|motivates|drives|interests))\b/i,
    /\b(how\s+(do\s+you|would\s+you|did\s+you))\b/i,
    /\b(where\s+do\s+you\s+see\s+yourself)\b/i,
    /\b(strength|weakness|challenge|goal|achievement|accomplishment)\b/i,
    /\b(experience\s+(with|in)|background\s+in)\b/i,
    /\b(handle\s+(conflict|pressure|stress|difficult))\b/i,
    /\b(work\s+(style|environment|team|alone))\b/i,
    /\b(cover\s+letter|personal\s+statement|essay|response)\b/i
  ];
  
  return interviewPatterns.some(pattern => pattern.test(label));
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
