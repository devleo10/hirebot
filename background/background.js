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
  try {
    switch (info.menuItemId) {
      case 'hirebot-save-answer':
        if (info.selectionText) {
          // Store selected text for popup to pick up
          await chrome.storage.session.set({ 
            selectedText: info.selectionText,
            fromContextMenu: true 
          });
          
          // Try to open popup, but handle case where it might fail
          try {
            await chrome.action.openPopup();
          } catch (popupError) {
            console.log('Could not open popup directly. User can click the extension icon to access saved text.');
          }
        }
        break;
        
      case 'hirebot-scan-page':
        if (!tab?.id) {
          console.error('No active tab found for scanning');
          return;
        }
        
        await handleScanCurrentTab(tab.id);
        break;
    }
  } catch (error) {
    console.error('Error in context menu handler:', error);
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
  }
}

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.url) {
    // Auto-inject content script on job/career sites
    const jobSites = [
      'wellfound.com',
      'linkedin.com/jobs',
      'indeed.com',
      'glassdoor.com',
      'greenhouse.io',
      'lever.co',
      'jobs.ashbyhq.com',
      'apply.workable.com'
    ];
    
    const isJobSite = jobSites.some(site => tab.url.includes(site)) || 
                     /(careers|jobs|apply)/i.test(tab.url);
    
    if (isJobSite) {
      handleScanCurrentTab(tabId).catch(error => {
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
