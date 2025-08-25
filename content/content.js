// content/content.js - HireBot Content Script for Form Detection and Auto-fill

let isInitialized = false;
let settings = { autoSuggest: true, highlightFields: true };

// Import shared selectors
let { extractQuestions: extractQuestionsFromPage, uniqueSelector } = (() => {
  try {
    // Try to use shared module if available
    if (typeof window.extractQuestions === 'function') {
      return { extractQuestions: window.extractQuestions, uniqueSelector: window.uniqueSelector };
    }
  } catch (e) {
    console.warn('Could not load shared selectors, using fallback', e);
  }
  
  // Fallback implementation if shared module not available
  return {
    extractQuestions: extractQuestionsFallback,
    uniqueSelector: uniqueSelectorFallback
  };
})();

// Initialize content script
if (!isInitialized) {
  initialize();
  isInitialized = true;
}

async function initialize() {
  try {
    // Load settings
    const result = await chrome.storage.sync.get(['autoSuggest', 'highlightFields']);
    settings = {
      autoSuggest: result.autoSuggest !== false,
      highlightFields: result.highlightFields !== false
    };
    
    // Set up message listeners
    chrome.runtime.onMessage.addListener(handleMessage);
    
    // Highlight fields if enabled
    if (settings.highlightFields) {
      await highlightFormFields();
    }
    
    console.log('HireBot content script initialized');
  } catch (error) {
    console.error('HireBot initialization error:', error);
  }
}

// Fallback implementation if shared module not available
function extractQuestionsFallback() {
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
    const field = {
      selector: uniqueSelector(el),
      label: extractFieldLabel(el),
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      placeholder: el.placeholder || '',
      value: el.value || ''
    };
    
    // Only include if it looks like an actual interview question
    if (field.label && isLikelyInterviewQuestion(field.label, el)) {
      fields.push(field);
    }
  });
  
  return fields;
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

function uniqueSelectorFallback(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  
  const parts = [];
  let node = el;
  
  while (node && node.nodeType === 1 && parts.length < 5) {
    let sel = node.nodeName.toLowerCase();
    if (node.classList.length) {
      sel += '.' + [...node.classList].slice(0, 2)
        .map(c => CSS.escape(c))
        .filter(c => c.length > 0)
        .join('.');
    }
    
    // Add :nth-child if needed
    if (node.parentElement) {
      const siblings = Array.from(node.parentElement.children)
        .filter(n => n.nodeName === node.nodeName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(node);
        if (idx >= 0) {
          sel += `:nth-child(${idx + 1})`;
        }
      }
    }
    
    parts.unshift(sel);
    node = node.parentElement;
  }
  
  return parts.join(' > ');
}

function handleMessage(message, sender, sendResponse) {
  switch (message.type) {
    case 'EXTRACT_QUESTIONS':
      sendResponse(extractQuestions());
      break;
    case 'FILL_FIELD':
      fillField(message.selector, message.value);
      sendResponse({ success: true });
      break;
    case 'HIGHLIGHT_FIELDS':
      highlightFormFields();
      sendResponse({ success: true });
      break;
    default:
      return false;
  }
  return true;
}

// Use the shared extractQuestions function or fallback
function extractQuestions() {
  try {
    return extractQuestionsFromPage();
  } catch (error) {
    console.error('Error extracting questions:', error);
    return [];
  }
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
  
  // Try aria-label
  if (!label && el.getAttribute('aria-label')) {
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel.length > 10 && isLikelyQuestionText(ariaLabel)) {
      label = ariaLabel;
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

function getUniqueSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  
  if (el.name) {
    const nameSelector = `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;
    if (document.querySelectorAll(nameSelector).length === 1) {
      return nameSelector;
    }
  }
  
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && parts.length < 6) {
    let sel = node.nodeName.toLowerCase();
    
    if (node.classList.length) {
      const classes = [...node.classList].slice(0, 2).map(c => CSS.escape(c));
      sel += '.' + classes.join('.');
    }
    
    const siblings = [...(node.parentNode?.children || [])].filter(n => n.nodeName === node.nodeName);
    const idx = siblings.indexOf(node);
    if (idx >= 0 && siblings.length > 1) {
      sel += `:nth-of-type(${idx + 1})`;
    }
    
    parts.unshift(sel);
    node = node.parentElement;
    
    // Stop at form or body
    if (node && (node.tagName === 'FORM' || node.tagName === 'BODY')) break;
  }
  
  return parts.join(' > ');
}

function fillField(selector, value) {
  try {
    const element = document.querySelector(selector);
    if (!element) {
      console.warn('Element not found:', selector);
      return false;
    }
    
    // Focus the element
    element.focus();
    
    // Clear existing value
    element.value = '';
    
    // Set new value
    element.value = value;
    
    // Trigger events to notify frameworks
    const events = ['input', 'change', 'blur'];
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
    });
    
    // Special handling for React/Vue
    if (element._valueTracker) {
      element._valueTracker.setValue('');
    }
    
    // Highlight the filled field briefly
    const originalBg = element.style.backgroundColor;
    element.style.backgroundColor = '#c6f6d5';
    element.style.transition = 'background-color 0.3s ease';
    
    setTimeout(() => {
      element.style.backgroundColor = originalBg;
    }, 1500);
    
    console.log('Field filled:', selector, value.substring(0, 50) + '...');
    return true;
  } catch (error) {
    console.error('Error filling field:', error);
    return false;
  }
}

function highlightFormFields() {
  if (!settings.highlightFields) return;
  
  const fields = extractQuestions();
  
  fields.forEach(field => {
    try {
      const element = document.querySelector(field.selector);
      if (element && !element.dataset.hirebotHighlighted) {
        element.dataset.hirebotHighlighted = 'true';
        element.style.boxShadow = '0 0 0 2px #667eea40';
        element.style.transition = 'box-shadow 0.3s ease';
        
        // Add tooltip on hover
        element.title = `HireBot: ${field.label}`;
        
        // Remove highlight on focus
        element.addEventListener('focus', () => {
          element.style.boxShadow = '';
        }, { once: true });
      }
    } catch (error) {
      console.warn('Error highlighting field:', error);
    }
  });
}

// Auto-detect and highlight fields when page changes
const observer = new MutationObserver((mutations) => {
  let shouldRehighlight = false;
  
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      const addedNodes = Array.from(mutation.addedNodes);
      const hasFormElements = addedNodes.some(node => 
        node.nodeType === 1 && (
          node.matches && node.matches('input, textarea, form') ||
          node.querySelector && node.querySelector('input, textarea')
        )
      );
      
      if (hasFormElements) {
        shouldRehighlight = true;
      }
    }
  });
  
  if (shouldRehighlight && settings.highlightFields) {
    setTimeout(highlightFormFields, 500);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.autoSuggest || changes.highlightFields) {
    chrome.storage.sync.get(['autoSuggest', 'highlightFields'], (result) => {
      settings = {
        autoSuggest: result.autoSuggest !== false,
        highlightFields: result.highlightFields !== false
      };
      
      if (settings.highlightFields) {
        highlightFormFields();
      }
    });
  }
});
