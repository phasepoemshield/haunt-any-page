// Shared settings module
// All settings live in chrome.storage.local: defaults and per-site overrides

export const DEFAULTS = {
  fog: true,
  fogDensity: 55,
  bats: true,
  font: true,
  flicker: false
};

/**
 * Extract origin from a URL (scheme + host + port)
 * @param {string} url - Full URL
 * @returns {string|null} Origin or null if invalid
 */
export function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Load settings for a specific site origin
 * @param {string} origin - Origin to load (e.g., "https:" + "//example.com")
 * @returns {Promise<Object>} Settings object (defaults merged with saved overrides)
 */
export async function loadSite(origin) {
  const stored = await chrome.storage.local.get(['defaults', 'sites']);
  const globalDefaults = stored.defaults || DEFAULTS;
  const siteSettings = stored.sites?.[origin] || {};
  
  return { ...globalDefaults, ...siteSettings };
}

/**
 * Save settings for a specific site origin
 * @param {string} origin - Origin to save (e.g., "https:" + "//example.com")
 * @param {Object} patch - Settings to merge (partial object)
 * @returns {Promise<void>}
 */
export async function saveSite(origin, patch) {
  const stored = await chrome.storage.local.get('sites');
  const sites = stored.sites || {};
  const current = sites[origin] || {};
  
  sites[origin] = { ...current, ...patch };
  await chrome.storage.local.set({ sites });
}

/**
 * Load all site settings
 * @returns {Promise<Object>} Object mapping origins to their settings
 */
export async function loadAllSites() {
  const stored = await chrome.storage.local.get('sites');
  return stored.sites || {};
}
