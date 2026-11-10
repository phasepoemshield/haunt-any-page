// Popup logic
import { DEFAULTS, originOf, loadSite, saveSite, loadWeather, saveWeather } from '../shared/settings.js';

let currentTab = null;
let currentOrigin = null;
let currentSettings = null;
let currentWeather = null;
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
  fogControls: document.getElementById('fogControls'),
  densitySlider: document.getElementById('densitySlider'),
  speedSlider: document.getElementById('speedSlider'),
  heightSlider: document.getElementById('heightSlider'),
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

    // The saved flag can be stale (page reloaded, tab restored): ask the page itself.
    isHaunted = await pageIsHaunted();
    if (isHaunted !== Boolean(currentSettings.haunted)) {
      currentSettings.haunted = isHaunted;
      await saveSite(currentOrigin, { haunted: isHaunted });
    }

    // Weather is stored apart from the haunt settings. Like the haunted flag, the
    // saved fog flag can be stale after a reload: the page itself has the final word.
    currentWeather = await loadWeather(currentOrigin);
    const fogUp = await pageHasFog();
    if (fogUp !== currentWeather.fog) {
      currentWeather.fog = fogUp;
      await saveWeather(currentOrigin, { fog: fogUp });
    }

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
  elements.fogCheckbox.checked = currentWeather.fog;
  elements.densitySlider.value = currentWeather.fogDensity;
  elements.speedSlider.value = currentWeather.fogSpeed;
  elements.heightSlider.value = currentWeather.fogHeight;
  elements.fogControls.hidden = !currentWeather.fog;
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
  elements.densitySlider.addEventListener('input', handleFogSlider);
  elements.speedSlider.addEventListener('input', handleFogSlider);
  elements.heightSlider.addEventListener('input', handleFogSlider);
  elements.batsCheckbox.addEventListener('change', handleEffectChange);
  elements.fontCheckbox.addEventListener('change', handleEffectChange);
  elements.flickerCheckbox.addEventListener('change', handleEffectChange);
  
  // Remember checkbox
  elements.rememberCheckbox.addEventListener('change', handleRememberChange);
}

// Ask the page whether the skin is active. No answer means the content
// script is not there (page reloaded or never haunted), so it is not haunted.
async function pageIsHaunted() {
  try {
    const reply = await sendMessage({ type: 'haunt:status' });
    return Boolean(reply && reply.haunted);
  } catch {
    return false;
  }
}

async function hauntPage() {
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

async function restorePage() {
  // If the content script is gone there is nothing to undo on the page.
  try {
    await sendMessage({ type: 'haunt:restore' });
  } catch {
    // no receiver
  }
  try {
    await chrome.scripting.removeCSS({
      target: { tabId: currentTab.id },
      files: ['src/content/haunt.css']
    });
  } catch {
    // style sheet was not injected by the popup (registered script) or tab is gone
  }

  isHaunted = false;
  currentSettings.haunted = false;
  await saveSite(currentOrigin, { haunted: false });
}

async function handleToggle() {
  try {
    if (isHaunted) {
      await restorePage();
    } else {
      await hauntPage();
    }
  } catch (error) {
    console.error('Toggle error:', error);
  }
  updateUI();
}

async function pageHasFog() {
  try {
    const reply = await sendMessage({ type: 'weather:status' });
    return Boolean(reply && reply.fog);
  } catch {
    return false;
  }
}

// Push the weather to the page. Fog works on a page that is not haunted, so the content
// script is injected here when it is missing (injecting twice is safe).
async function sendWeather() {
  const message = { type: 'weather:apply', weather: currentWeather };
  try {
    await sendMessage(message);
  } catch {
    if (!currentWeather.fog) return;
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['src/content/haunt.js']
    });
    await sendMessage(message);
  }
}

async function saveAndApplyWeather() {
  try {
    await saveWeather(currentOrigin, currentWeather);
    await sendWeather();
  } catch (error) {
    console.error('Weather update failed:', error);
  }
}

async function handleFogChange() {
  currentWeather.fog = elements.fogCheckbox.checked;
  elements.fogControls.hidden = !currentWeather.fog;
  await saveAndApplyWeather();
}

async function handleFogSlider() {
  currentWeather.fogDensity = parseInt(elements.densitySlider.value, 10);
  currentWeather.fogSpeed = parseInt(elements.speedSlider.value, 10);
  currentWeather.fogHeight = parseInt(elements.heightSlider.value, 10);
  await saveAndApplyWeather();
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
  // Weather has its own storage key; never write a stale copy of it back.
  const { weather, ...hauntSettings } = currentSettings;
  await saveSite(currentOrigin, hauntSettings);
  
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
