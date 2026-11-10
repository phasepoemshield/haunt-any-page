// Unit tests for src/shared/settings.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Tiny in-memory fake of chrome.storage.local
let storage = {};

globalThis.chrome = {
  storage: {
    local: {
      async get(keys) {
        if (typeof keys === 'string') {
          return { [keys]: storage[keys] };
        }
        if (Array.isArray(keys)) {
          const result = {};
          for (const key of keys) {
            if (key in storage) {
              result[key] = storage[key];
            }
          }
          return result;
        }
        // keys is undefined or object (return all or defaults)
        return { ...storage };
      },
      async set(items) {
        Object.assign(storage, items);
      }
    }
  }
};

// Import after setting up global chrome
const { DEFAULTS, WEATHER_DEFAULTS, originOf, loadSite, saveSite, loadAllSites, loadWeather, saveWeather } = await import('../src/shared/settings.js');

test('settings: DEFAULTS has expected keys', () => {
  assert.equal(typeof DEFAULTS, 'object');
  assert.equal(DEFAULTS.fog, undefined, 'fog is weather, not an effect');
  assert.equal(DEFAULTS.bats, true);
  assert.equal(DEFAULTS.font, true);
  assert.equal(DEFAULTS.flicker, false);
});

test('settings: originOf extracts origin correctly', () => {
  assert.equal(originOf('https://example.com/path?q=1'), 'https://example.com');
  assert.equal(originOf('http://localhost:3000/page'), 'http://localhost:3000');
  assert.equal(originOf('https://en.wikipedia.org'), 'https://en.wikipedia.org');
  assert.equal(originOf('invalid-url'), null);
  assert.equal(originOf(''), null);
});

test('settings: loadSite returns defaults when no site settings exist', async () => {
  storage = {};
  const settings = await loadSite('https://example.com');
  assert.deepEqual(settings, DEFAULTS);
});

test('settings: loadSite merges defaults with site settings', async () => {
  storage = {
    sites: {
      'https://example.com': {
        fog: false,
        bats: false
      }
    }
  };
  const settings = await loadSite('https://example.com');
  assert.equal(settings.fog, false);
  assert.equal(settings.bats, false);
  assert.equal(settings.flicker, false); // from defaults
  assert.equal(settings.font, true); // from defaults
});

test('settings: loadSite uses custom defaults if set', async () => {
  storage = {
    defaults: {
      bats: false,
      font: false,
      flicker: true
    }
  };
  const settings = await loadSite('https://other.com');
  assert.equal(settings.bats, false);
  assert.equal(settings.flicker, true);
});

test('settings: saveSite creates new site entry', async () => {
  storage = {};
  await saveSite('https://example.com', { haunted: true, fog: false });
  assert.deepEqual(storage.sites, {
    'https://example.com': { haunted: true, fog: false }
  });
});

test('settings: saveSite merges with existing site entry', async () => {
  storage = {
    sites: {
      'https://example.com': { haunted: true, fog: false }
    }
  };
  await saveSite('https://example.com', { bats: false, remember: true });
  assert.deepEqual(storage.sites['https://example.com'], {
    haunted: true,
    fog: false,
    bats: false,
    remember: true
  });
});

test('settings: loadAllSites returns all site settings', async () => {
  storage = {
    sites: {
      'https://example.com': { haunted: true },
      'https://other.org': { fog: false }
    }
  };
  const sites = await loadAllSites();
  assert.deepEqual(sites, {
    'https://example.com': { haunted: true },
    'https://other.org': { fog: false }
  });
});

test('settings: loadAllSites returns empty object when no sites', async () => {
  storage = {};
  const sites = await loadAllSites();
  assert.deepEqual(sites, {});
});

test('weather: defaults are off with mid sliders', async () => {
  storage = {};
  assert.deepEqual(await loadWeather('https://example.com'), WEATHER_DEFAULTS);
  assert.equal(WEATHER_DEFAULTS.fog, false);
});

test('weather: stored per site and apart from haunt settings', async () => {
  storage = {};
  await saveSite('https://a.com', { haunted: true, bats: false });
  await saveWeather('https://a.com', { fog: true, fogHeight: 80 });
  await saveSite('https://a.com', { font: false });
  await saveWeather('https://b.com', { fogDensity: 10 });

  const a = await loadWeather('https://a.com');
  assert.equal(a.fog, true);
  assert.equal(a.fogHeight, 80);
  assert.equal(a.fogDensity, WEATHER_DEFAULTS.fogDensity);
  assert.equal((await loadWeather('https://b.com')).fog, false);
  assert.equal((await loadWeather('https://b.com')).fogDensity, 10);
  assert.equal(storage.sites['https://a.com'].haunted, true);
  assert.equal(storage.sites['https://a.com'].bats, false);
});
