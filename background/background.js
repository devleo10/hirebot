// background/background.js - HireBot Background Script

// Install event - set up initial data
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('HireBot installed/updated');
  
  // Set up context menus
  await setupContextMenus();
  
  // Initialize default settings
  const result = await chrome.storage.sync.get(['autoSuggest', 'highlightFields', 'interviewQAs']);
  
  if (!result.interviewQAs) {
    // Add some default Q&As to get users started
    const defaultQAs = [
      {
        id: 'default1',
        question: 'Tell me about yourself',
        answer: 'I am a motivated professional with experience in [your field]. I have strong skills in [key skills] and am passionate about [relevant interests]. I enjoy solving problems and working collaboratively with teams.',
        tags: ['introduction', 'personal'],
        created: Date.now(),
        lastUsed: null,
        useCount: 0
      },
      {
        id: 'default2',
        question: 'Why do you want to work here',
        answer: 'I am excited about this opportunity because [company value/mission that resonates with you]. Your work in [specific area] aligns with my interests and career goals. I believe I can contribute to [specific way you can help].',
        tags: ['motivation', 'company'],
        created: Date.now(),
        lastUsed: null,
        useCount: 0
      },
      {
        id: 'default3',
        question: 'What are your strengths',
        answer: 'My key strengths include [strength 1], [strength 2], and [strength 3]. For example, [brief example of how you demonstrated one of these strengths]. These abilities help me [how they benefit the role].',
        tags: ['strengths', 'skills'],
        created: Date.now(),
        lastUsed: null,
        useCount: 0
      }
    ];
    
    await chrome.storage.sync.set({ 
      interviewQAs: defaultQAs,
      autoSuggest: true,
      highlightFields: true
    });
  }
});

// Set up context menus
async function setupContextMenus() {
  await chrome.contextMenus.removeAll();
  
  chrome.contextMenus.create({
    id: 'hirebot-save-answer',
    title: 'Save as Interview Answer',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'hirebot-scan-page',
    title: 'Scan Page for Questions',
    contexts: ['page']
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'hirebot-save-answer':
      if (info.selectionText) {
        // Open popup with selected text
        chrome.action.openPopup();
        // Store selected text for popup to pick up
        await chrome.storage.session.set({ 
          selectedText: info.selectionText,
          fromContextMenu: true 
        });
      }
      break;
      
    case 'hirebot-scan-page':
      // Inject content script and scan
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });
        
        chrome.tabs.sendMessage(tab.id, { type: 'HIGHLIGHT_FIELDS' });
      } catch (error) {
        console.error('Error scanning page:', error);
      }
      break;
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_SELECTED_TEXT':
      chrome.storage.session.get(['selectedText', 'fromContextMenu'], (result) => {
        sendResponse(result);
        // Clear after use
        chrome.storage.session.remove(['selectedText', 'fromContextMenu']);
      });
      return true;
      
    case 'SCAN_CURRENT_TAB':
      handleScanCurrentTab(sender.tab?.id)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message }));
      return true;
      
    case 'FILL_FIELD':
      chrome.tabs.sendMessage(sender.tab?.id || message.tabId, {
        type: 'FILL_FIELD',
        selector: message.selector,
        value: message.value
      }, (response) => {
        sendResponse(response);
      });
      return true;
      
    default:
      return false;
  }
});

async function handleScanCurrentTab(tabId) {
  if (!tabId) {
    throw new Error('No active tab');
  }
  
  try {
    // Inject content script if needed
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['shared/selectors.js', 'content/content.js']
    });
    
    // Get form fields
    const response = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_QUESTIONS' });
    return response || [];
  } catch (error) {
    console.error('Error scanning tab:', error);
    throw error;
  }
}

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Auto-inject content script on job/career sites
    const jobSites = [
      'linkedin.com',
      'indeed.com',
      'glassdoor.com',
      'monster.com',
      'ziprecruiter.com',
      'careerbuilder.com',
      'dice.com',
      'stackoverflow.com/jobs',
      'github.com/jobs',
      'angel.co',
      'wellfound.com'
    ];
    
    const isJobSite = jobSites.some(site => tab.url.includes(site));
    
    if (isJobSite) {
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content.js']
      }).catch(error => {
        console.log('Content script already injected or error:', error.message);
      });
    }
  }
});

// Badge management
chrome.storage.onChanged.addListener((changes) => {
  if (changes.interviewQAs) {
    const qas = changes.interviewQAs.newValue || [];
    chrome.action.setBadgeText({ text: qas.length > 0 ? qas.length.toString() : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
  }
});

// Set initial badge
chrome.storage.sync.get(['interviewQAs'], (result) => {
  const qas = result.interviewQAs || [];
  if (qas.length > 0) {
    chrome.action.setBadgeText({ text: qas.length.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
  }
});
