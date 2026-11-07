#!/usr/bin/env node
// Enforces "no data leaves the browser": scans extension source for network calls,
// remote URLs, dynamic code and cloud-synced storage.
// Put privacy-ignore in a comment on a line to skip that line on purpose.
// Usage: node scripts/check-privacy.mjs [dir]   (default: src)
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const RULES = [
  [/\bfetch\s*\(/, 'network call fetch()'],
  [/\bXMLHttpRequest\b/, 'network call XMLHttpRequest'],
  [/\bWebSocket\b/, 'network call WebSocket'],
  [/\bEventSource\b/, 'network call EventSource'],
  [/\bsendBeacon\b/, 'network call navigator.sendBeacon'],
  [/\bimportScripts\s*\(/, 'importScripts()'],
  [/\beval\s*\(/, 'eval()'],
  [/\bnew\s+Function\s*\(/, 'new Function()'],
  [/\bchrome\.storage\.sync\b/, 'chrome.storage.sync (syncs data to the cloud; use chrome.storage.local)'],
  [/https?:\/\/(?!www\.w3\.org\/)[^\s'"`)]+/, 'remote URL'],
];

export function checkSource(text, file = '<src>') {
  const problems = [];
  text.split('\n').forEach((line, i) => {
    if (/privacy-ignore/.test(line)) return;
    for (const [re, label] of RULES) {
      if (re.test(line)) problems.push(`${file}:${i + 1} ${label}: ${line.trim().slice(0, 100)}`);
    }
  });
  return problems;
}

function sourceFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(m?js|html|css)$/.test(p) ? [p] : [];
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = sourceFiles(process.argv[2] ?? 'src');
  const problems = files.flatMap(f => checkSource(readFileSync(f, 'utf8'), relative('.', f)));
  if (problems.length) {
    console.error(`privacy check FAILED (${problems.length}):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`privacy check OK (${files.length} file${files.length === 1 ? '' : 's'})`);
}
