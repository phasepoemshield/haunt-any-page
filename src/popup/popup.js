// Popup logic
import { DEFAULTS, originOf, loadSite, saveSite } from '../shared/settings.js';

let currentTab = null;
let currentOrigin = null;
let currentSettings = null;
let isHaunted = false;

// DOM elements
const elements = {
  popup: document.querySelector('.popup'),
  origin: document.querySelector('.origin'),
  stateText: document.querySelector('.state-text'),
  toggleButton: document.getElementById('toggleButton'),
  buttonText: document.querySelector('.button-text'),
  effects: document.getElementById('effects'),
  unsupported: document.getElementById('unsupported'),
  fogCheckbox: document.getElementById('fogCheckbox'),
  densityRow: document.getElementById('densityRow'),
  densitySlider: document.getElementById('densitySlider'),
  batsCheckbox: document.getElementById('batsCheckbox'),
  fontCheckbox: document.getElementById('fontCheckbox'),
  flickerCheckbox: document.getElementById('flickerCheckbox'),
  rememberCheckbox: document.getElementById('rememberCheckbox')
};

async function init() {
  try {
    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];
    
    if (!currentTab || !currentTab.url) {
      showUnsupported();
      return;
    }
    
    currentOrigin = originOf(currentTab.url);
    
    // Check if URL is supported (http/https only)
    if (!currentOrigin || (!currentTab.url.startsWith('http://') && !currentTab.url.startsWith('https://'))) {
      showUnsupported();
      return;
    }
    
    // Load settings for this origin
    currentSettings = await loadSite(currentOrigin);
    isHaunted = currentSettings.haunted || false;
    
    // Update UI
    updateUI();
    
    // Attach event listeners
    attachListeners();
    
  } catch (error) {
    console.error('Haunt popup init error:', error);
    showUnsupported();
  }
}

function showUnsupported() {
  elements.popup.classList.add('unsupported-page');
}

function updateUI() {
  // Origin display
  const displayOrigin = currentOrigin.replace(/^https?:\/\//, '');
  elements.origin.textContent = displayOrigin;
  
  // State text
  elements.stateText.textContent = isHaunted ? ' is haunted.' : ' looks normal.';
  
  // Toggle button
  elements.toggleButton.setAttribute('aria-pressed', isHaunted ? 'true' : 'false');
  elements.buttonText.textContent = isHaunted ? 'Restore the page' : 'Haunt this page';
  
  // Effect controls
  elements.fogCheckbox.checked = currentSettings.fog ?? DEFAULTS.fog;
  elements.densitySlider.value = currentSettings.fogDensity ?? DEFAULTS.fogDensity;
  elements.densityRow.style.display = elements.fogCheckbox.checked ? 'flex' : 'none';
  elements.batsCheckbox.checked = currentSettings.bats ?? DEFAULTS.bats;
  elements.fontCheckbox.checked = currentSettings.font ?? DEFAULTS.font;
  elements.flickerCheckbox.checked = currentSettings.flicker ?? DEFAULTS.flicker;
  
  // Remember checkbox
  elements.rememberCheckbox.checked = currentSettings.remember || false;
}

function attachListeners() {
  // Toggle button
  elements.toggleButton.addEventListener('click', handleToggle);
  
  // Effect controls
  elements.fogCheckbox.addEventListener('change', handleFogChange);
  elements.densitySlider.addEventListener('input', handleDensityChange);
  elements.batsCheckbox.addEventListener('change', handleEffectChange);
  elements.fontCheckbox.addEventListener('change', handleEffectChange);
  elements.flickerCheckbox.addEventListener('change', handleEffectChange);
  
  // Remember checkbox
  elements.rememberCheckbox.addEventListener('change', handleRememberChange);
}

async function handleToggle() {
  try {
    if (isHaunted) {
      // Restore
      await sendMessage({ type: 'haunt:restore' });
      await chrome.scripting.removeCSS({
        target: { tabId: currentTab.id },
        files: ['src/content/haunt.css']
      });
      
      isHaunted = false;
      currentSettings.haunted = false;
      await saveSite(currentOrigin, { haunted: false });
      
    } else {
      // Haunt
      await chrome.scripting.insertCSS({
        target: { tabId: currentTab.id },
        files: ['src/content/haunt.css']
      });
      
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        files: ['src/content/haunt.js']
      });
      
      await sendMessage({ type: 'haunt:apply', settings: currentSettings });
      
      isHaunted = true;
      currentSettings.haunted = true;
      await saveSite(currentOrigin, { haunted: true });
    }
    
    updateUI();
    
  } catch (error) {
    console.error('Toggle error:', error);
    // If script not found, inject and retry once
    if (error.message && error.message.includes('Could not establish connection')) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ['src/content/haunt.js']
        });
        await sendMessage({ type: isHaunted ? 'haunt:restore' : 'haunt:apply', settings: currentSettings });
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      }
    }
  }
}

async function handleFogChange() {
  currentSettings.fog = elements.fogCheckbox.checked;
  elements.densityRow.style.display = currentSettings.fog ? 'flex' : 'none';
  await saveAndUpdate();
}

async function handleDensityChange() {
  currentSettings.fogDensity = parseInt(elements.densitySlider.value, 10);
  await saveAndUpdate();
}

async function handleEffectChange(event) {
  const id = event.target.id;
  if (id === 'batsCheckbox') {
    currentSettings.bats = elements.batsCheckbox.checked;
  } else if (id === 'fontCheckbox') {
    currentSettings.font = elements.fontCheckbox.checked;
  } else if (id === 'flickerCheckbox') {
    currentSettings.flicker = elements.flickerCheckbox.checked;
  }
  await saveAndUpdate();
}

async function saveAndUpdate() {
  await saveSite(currentOrigin, currentSettings);
  
  if (isHaunted) {
    try {
      await sendMessage({ type: 'haunt:apply', settings: currentSettings });
    } catch (error) {
      console.error('Update message failed:', error);
    }
  }
}

async function handleRememberChange() {
  const remember = elements.rememberCheckbox.checked;
  
  if (remember) {
    // Request permission
    try {
      const granted = await chrome.permissions.request({
        origins: [currentOrigin + '/*']
      });
      
      if (granted) {
        currentSettings.remember = true;
        await saveSite(currentOrigin, { remember: true });
      } else {
        // User denied, uncheck
        elements.rememberCheckbox.checked = false;
      }
    } catch (error) {
      console.error('Permission request error:', error);
      elements.rememberCheckbox.checked = false;
    }
  } else {
    // Remove permission
    try {
      await chrome.permissions.remove({
        origins: [currentOrigin + '/*']
      });
      currentSettings.remember = false;
      await saveSite(currentOrigin, { remember: false });
    } catch (error) {
      console.error('Permission remove error:', error);
    }
  }
}

async function sendMessage(message) {
  return chrome.tabs.sendMessage(currentTab.id, message);
}

// Initialize on load
init();
