#!/usr/bin/env node
// Validates manifest.json against the project rules in .kiro/steering/extension-rules.md.
// Usage: node scripts/check-manifest.mjs [projectRoot]   (default: current directory)
// Exit code 0 = OK, 1 = problems found (printed to stderr).
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ALLOWED_PERMISSIONS = new Set(['activeTab', 'scripting', 'storage']);
const ALLOWED_OPTIONAL_HOSTS = new Set(['https://*/*', 'http://*/*']);

export function checkManifest(root) {
  const errors = [];
  const path = join(root, 'manifest.json');
  if (!existsSync(path)) return [`manifest.json not found in ${root}`];

  let m;
  try {
    m = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return [`manifest.json is not valid JSON: ${e.message}`];
  }

  if (m.manifest_version !== 3) errors.push('manifest_version must be 3');
  for (const key of ['name', 'version', 'description']) {
    if (typeof m[key] !== 'string' || !m[key].trim()) errors.push(`"${key}" must be a non-empty string`);
  }
  if (typeof m.version === 'string' && !/^\d+(\.\d+){0,3}$/.test(m.version)) {
    errors.push(`"version" must be 1-4 dot-separated integers, got "${m.version}"`);
  }
  if (typeof m.description === 'string' && m.description.length > 132) {
    errors.push('"description" must be at most 132 characters (Chrome Web Store limit)');
  }

  for (const p of m.permissions ?? []) {
    if (!ALLOWED_PERMISSIONS.has(p)) errors.push(`permission "${p}" is not allowed (allowed: ${[...ALLOWED_PERMISSIONS].join(', ')})`);
  }
  if (m.host_permissions?.length) errors.push('"host_permissions" must be empty; use "optional_host_permissions" requested at runtime');
  for (const h of m.optional_host_permissions ?? []) {
    if (!ALLOWED_OPTIONAL_HOSTS.has(h)) errors.push(`optional host permission "${h}" is not allowed`);
  }
  if (m.optional_permissions?.length) errors.push('"optional_permissions" is not used by this project');
  if (m.content_scripts?.length) errors.push('static "content_scripts" are not allowed; register them at runtime with chrome.scripting.registerContentScripts');
  if (m.externally_connectable) errors.push('"externally_connectable" is not allowed');
  if (m.update_url) errors.push('"update_url" is not allowed');

  const csp = m.content_security_policy?.extension_pages;
  if (csp && /(https?:|unsafe-eval|unsafe-inline|\*)/.test(csp)) {
    errors.push('content_security_policy.extension_pages must not allow remote hosts, unsafe-eval or unsafe-inline');
  }

  for (const war of m.web_accessible_resources ?? []) {
    for (const r of war.resources ?? []) {
      if (!/^assets\/fonts\//.test(r)) errors.push(`web_accessible_resources may only expose assets/fonts/*, got "${r}"`);
    }
    if (war.use_dynamic_url !== true) errors.push('web_accessible_resources entries must set "use_dynamic_url": true');
  }

  // Every file the manifest points at must exist.
  const files = [];
  if (m.action?.default_popup) files.push(m.action.default_popup);
  if (m.background?.service_worker) {
    files.push(m.background.service_worker);
    if (m.background.type !== 'module') errors.push('background.type must be "module"');
  }
  for (const v of Object.values(m.icons ?? {})) files.push(v);
  for (const v of Object.values(m.action?.default_icon ?? {})) files.push(v);
  for (const f of files) {
    if (!existsSync(join(root, f))) errors.push(`referenced file "${f}" does not exist`);
  }
  if (!m.icons?.['128']) errors.push('a 128px icon is required in "icons"');

  return errors;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(process.argv[2] ?? '.');
  const errors = checkManifest(root);
  if (errors.length) {
    console.error(`manifest check FAILED (${errors.length}):\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  console.log('manifest check OK');
}
