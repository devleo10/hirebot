// content/content.js - HireBot Content Script for Form Detection and Auto-fill

let isInitialized = false;
let settings = { autoSuggest: true, highlightFields: true };

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
      highlightFormFields();
    }
    
    console.log('HireBot content script initialized');
  } catch (error) {
    console.error('HireBot initialization error:', error);
  }
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

function extractQuestions() {
  const fields = [];
  const inputs = [...document.querySelectorAll('input, textarea')].filter(el => {
    return el.offsetParent !== null && 
           el.type !== 'hidden' && 
           el.type !== 'submit' && 
           el.type !== 'button' &&
           el.type !== 'checkbox' &&
           el.type !== 'radio';
  });
  
  inputs.forEach(el => {
    let label = extractFieldLabel(el);
    
    if (label && label.length > 0) {
      fields.push({
        selector: getUniqueSelector(el),
        label: label.substring(0, 200),
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
  
  // Try placeholder first
  if (el.placeholder && el.placeholder.length > 5) {
    label = el.placeholder;
  }
  
  // Try associated label
  if (!label && el.id) {
    const lbl = document.querySelector(`label[for='${el.id}']`);
    if (lbl) label = lbl.textContent.trim();
  }
  
  // Try parent label
  if (!label && el.closest('label')) {
    const parentLabel = el.closest('label');
    label = parentLabel.textContent.replace(el.value || '', '').trim();
  }
  
  // Try preceding elements
  if (!label) {
    const prev = el.previousElementSibling;
    if (prev) {
      if (prev.tagName === 'LABEL') {
        label = prev.textContent.trim();
      } else if (prev.textContent && prev.textContent.trim().length < 100) {
        label = prev.textContent.trim();
      }
    }
  }
  
  // Try aria-label
  if (!label && el.getAttribute('aria-label')) {
    label = el.getAttribute('aria-label');
  }
  
  // Try parent container text
  if (!label) {
    const parent = el.parentElement;
    if (parent) {
      const textNodes = Array.from(parent.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent.trim())
        .filter(text => text.length > 0 && text.length < 100);
      
      if (textNodes.length > 0) {
        label = textNodes[0];
      }
    }
  }
  
  // Clean up label
  if (label) {
    label = label.replace(/[*:]+$/g, '').trim();
    if (label.length < 3) label = '';
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
