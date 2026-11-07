// Background service worker
// Syncs dynamic content script registration for remembered sites

import { loadAllSites } from './shared/settings.js';

const SCRIPT_ID = 'haunt-remembered';

// Sync registrations on various events
chrome.runtime.onInstalled.addListener(() => {
  syncRegistrations();
});

chrome.runtime.onStartup.addListener(() => {
  syncRegistrations();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.sites) {
    syncRegistrations();
  }
});

chrome.permissions.onAdded.addListener(() => {
  syncRegistrations();
});

chrome.permissions.onRemoved.addListener(() => {
  syncRegistrations();
});

async function syncRegistrations() {
  try {
    // Load all sites
    const sites = await loadAllSites();
    
    // Build matches array for sites that are:
    // - haunted: true
    // - remember: true
    // - have permission granted
    const matches = [];
    
    for (const [origin, settings] of Object.entries(sites)) {
      if (settings.haunted && settings.remember) {
        // Check if we have permission
        const hasPermission = await chrome.permissions.contains({
          origins: [origin + '/*']
        });
        
        if (hasPermission) {
          matches.push(origin + '/*');
        }
      }
    }
    
    // Unregister existing script
    try {
      await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    } catch (error) {
      // Script may not exist yet, that's OK
    }
    
    // Register new script if we have any matches
    if (matches.length > 0) {
      await chrome.scripting.registerContentScripts([{
        id: SCRIPT_ID,
        matches,
        js: ['src/content/haunt.js'],
        css: ['src/content/haunt.css'],
        runAt: 'document_start',
        persistAcrossSessions: true
      }]);
      
      console.log(`Haunt: registered for ${matches.length} site(s)`);
    } else {
      console.log('Haunt: no sites to remember');
    }
    
  } catch (error) {
    console.error('Haunt: syncRegistrations error:', error);
  }
}
