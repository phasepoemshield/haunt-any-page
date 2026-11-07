// End-to-end smoke test with Puppeteer
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import puppeteer from 'puppeteer';
import http from 'http';
import { readFile } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const extensionPath = projectRoot;
const fixturePath = join(__dirname, 'fixtures', 'page.html');

// Simple HTTP server for the fixture
function startServer(port = 3000) {
  const server = http.createServer(async (req, res) => {
    const html = await readFile(fixturePath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });
  
  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({ server, url: `http://localhost:${port}` });
    });
  });
}

test('e2e: haunt and restore a page', { timeout: 60000 }, async () => {
  const { server, url } = await startServer(3001);
  let browser;
  
  try {
    // Launch Chrome with extension loaded
    browser = await puppeteer.launch({
      headless: false, // Extension doesn't work in headless
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });
    
    const page = await browser.newPage();
    
    // Track network requests
    const requests = [];
    page.on('request', (req) => {
      const url = req.url();
      // Only track external requests (not chrome-extension://)
      if (!url.startsWith('chrome-extension://') && !url.startsWith('http://localhost:')) {
        requests.push(url);
      }
    });
    
    // Navigate to fixture
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    // Capture original outerHTML
    const originalHTML = await page.evaluate(() => document.documentElement.outerHTML);
    
    // Inject extension content script manually (simulating popup action)
    await page.addStyleTag({ path: join(projectRoot, 'src/content/haunt.css') });
    await page.addScriptTag({ path: join(projectRoot, 'src/content/haunt.js'), type: 'module' });
    
    // Wait a bit for script to initialize
    await page.waitForTimeout(500);
    
    // Apply haunt effect
    await page.evaluate(() => {
      const settings = {
        fog: true,
        fogDensity: 55,
        bats: true,
        font: true,
        flicker: false
      };
      window.__hauntAnyPage.apply(settings);
    });
    
    // Wait for effects to apply
    await page.waitForTimeout(1000);
    
    // Verify haunt classes exist
    const hasHauntOn = await page.evaluate(() => 
      document.documentElement.classList.contains('haunt-on')
    );
    assert.equal(hasHauntOn, true, 'html should have haunt-on class');
    
    const hasHauntFog = await page.evaluate(() => 
      document.documentElement.classList.contains('haunt-fog')
    );
    assert.equal(hasHauntFog, true, 'html should have haunt-fog class');
    
    const hasHauntBats = await page.evaluate(() => 
      document.documentElement.classList.contains('haunt-bats')
    );
    assert.equal(hasHauntBats, true, 'html should have haunt-bats class');
    
    // Verify overlay exists
    const overlayExists = await page.evaluate(() => {
      const overlay = document.querySelector('haunt-any-page-overlay');
      return overlay !== null;
    });
    assert.equal(overlayExists, true, 'overlay element should exist');
    
    // Verify overlay has shadow root
    const hasShadowRoot = await page.evaluate(() => {
      const overlay = document.querySelector('haunt-any-page-overlay');
      return overlay && overlay.shadowRoot !== null;
    });
    assert.equal(hasShadowRoot, true, 'overlay should have shadow root');
    
    // Restore the page
    await page.evaluate(() => {
      window.__hauntAnyPage.restore();
    });
    
    // Wait for restoration
    await page.waitForTimeout(500);
    
    // Verify restoration
    const afterRestoreHTML = await page.evaluate(() => document.documentElement.outerHTML);
    
    // Check that haunt classes are removed
    const hasNoHauntOn = await page.evaluate(() => 
      !document.documentElement.classList.contains('haunt-on')
    );
    assert.equal(hasNoHauntOn, true, 'haunt-on class should be removed');
    
    // Check that overlay is removed
    const overlayRemoved = await page.evaluate(() => {
      const overlay = document.querySelector('haunt-any-page-overlay');
      return overlay === null;
    });
    assert.equal(overlayRemoved, true, 'overlay should be removed');
    
    // Verify no external network requests were made by the extension
    assert.equal(requests.length, 0, 'extension should not make external network requests');
    
    console.log('✓ E2E test passed: haunt applied and restored successfully');
    
  } finally {
    if (browser) {
      await browser.close();
    }
    server.close();
  }
});
