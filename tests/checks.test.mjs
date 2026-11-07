// Tests for the project check scripts used by the Kiro hooks.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkManifest } from '../scripts/check-manifest.mjs';
import { checkCss, contrastRatio, parseColor } from '../scripts/check-contrast.mjs';
import { checkSource } from '../scripts/check-privacy.mjs';

const GOOD_MANIFEST = {
  manifest_version: 3,
  name: 'Haunt Any Page',
  version: '0.1.0',
  description: 'One click turns any website into a haunted version of itself.',
  permissions: ['activeTab', 'scripting', 'storage'],
  optional_host_permissions: ['https://*/*', 'http://*/*'],
  background: { service_worker: 'src/background.js', type: 'module' },
  action: { default_popup: 'src/popup/popup.html', default_icon: { 32: 'assets/icons/icon-32.png' } },
  icons: { 128: 'assets/icons/icon-128.png' },
  web_accessible_resources: [{ resources: ['assets/fonts/*'], matches: ['<all_urls>'], use_dynamic_url: true }],
};

function project(manifest, files = ['src/background.js', 'src/popup/popup.html', 'assets/icons/icon-32.png', 'assets/icons/icon-128.png']) {
  const root = mkdtempSync(join(tmpdir(), 'haunt-'));
  for (const f of files) {
    mkdirSync(join(root, f, '..'), { recursive: true });
    writeFileSync(join(root, f), '');
  }
  writeFileSync(join(root, 'manifest.json'), typeof manifest === 'string' ? manifest : JSON.stringify(manifest));
  return root;
}

test('manifest: valid manifest passes', () => {
  assert.deepEqual(checkManifest(project(GOOD_MANIFEST)), []);
});

test('manifest: missing file and invalid JSON are reported', () => {
  assert.match(checkManifest(mkdtempSync(join(tmpdir(), 'haunt-')))[0], /not found/);
  assert.match(checkManifest(project('{ nope'))[0], /not valid JSON/);
});

test('manifest: broad or extra permissions are rejected', () => {
  const errors = checkManifest(project({
    ...GOOD_MANIFEST,
    permissions: ['activeTab', 'tabs', 'storage'],
    host_permissions: ['<all_urls>'],
    content_scripts: [{ matches: ['<all_urls>'], js: ['x.js'] }],
  }));
  assert.equal(errors.length, 3);
  assert.ok(errors.some(e => e.includes('"tabs"')));
  assert.ok(errors.some(e => e.includes('host_permissions')));
  assert.ok(errors.some(e => e.includes('content_scripts')));
});

test('manifest: MV2, missing referenced files and unsafe CSP are rejected', () => {
  const errors = checkManifest(project(
    { ...GOOD_MANIFEST, manifest_version: 2, content_security_policy: { extension_pages: "script-src 'self' https://cdn.example" } },
    ['src/background.js'],
  ));
  assert.ok(errors.some(e => e.includes('manifest_version')));
  assert.ok(errors.some(e => e.includes('popup.html')));
  assert.ok(errors.some(e => e.includes('icon-128.png')));
  assert.ok(errors.some(e => e.includes('content_security_policy')));
});

test('manifest: web accessible resources limited to fonts with dynamic URL', () => {
  const errors = checkManifest(project({
    ...GOOD_MANIFEST,
    web_accessible_resources: [{ resources: ['src/content/haunt.js'], matches: ['<all_urls>'] }],
  }));
  assert.equal(errors.length, 2);
});

test('contrast: ratio math matches WCAG reference values', () => {
  assert.equal(contrastRatio(parseColor('#000'), parseColor('#fff')).toFixed(1), '21.0');
  assert.equal(contrastRatio(parseColor('#777777'), parseColor('#ffffff')).toFixed(2), '4.48');
});

test('contrast: concept palette passes, bad pairs fail with line numbers', () => {
  const css = `:root{--night:#0b0c0f;--bone:#e9e3d2;--candle:#ffb04a;--ash:#8f9199;--stone:#17191f}
body{background:var(--night);color:var(--bone)}
.big{background:var(--candle);color:#1a1205}
.hint{color:var(--ash);background:var(--stone)}
.bad{
  color:#555a66;
  background-color:var(--stone)
}`;
  const problems = checkCss(css, 'popup.css');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^popup\.css:5 "\.bad"/);
});

test('contrast: gradients, translucent backgrounds and contrast-ignore are skipped', () => {
  const css = `.a{color:#222;background:linear-gradient(#000,#111)}
.b{color:#222;background:rgba(0,0,0,.5)}
.c{color:#222;background:#000 /* contrast-ignore */}`;
  assert.deepEqual(checkCss(css), []);
});

test('privacy: clean code passes', () => {
  const src = `const NS = 'http://www.w3.org/2000/svg';
chrome.storage.local.get('sites');
chrome.runtime.getURL('assets/fonts/fell.ttf');`;
  assert.deepEqual(checkSource(src), []);
});

test('privacy: network calls, remote URLs, eval and sync storage are flagged', () => {
  const src = `fetch('/x');
new XMLHttpRequest();
navigator.sendBeacon('/y');
const u = "https://fonts.googleapis.com/css2";
eval('1');
chrome.storage.sync.set({});
fetch('/ok'); // privacy-ignore`;
  const problems = checkSource(src, 'a.js');
  assert.equal(problems.length, 6);
  assert.match(problems[3], /^a\.js:4 remote URL/);
});
