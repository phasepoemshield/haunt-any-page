#!/usr/bin/env node
// Checks WCAG text contrast in CSS rules that set BOTH a text color and a solid background.
// Colors may be hex, rgb()/rgba() or var(--token) defined anywhere in the same file.
// Rules whose background is a gradient, image or translucent color are skipped.
// Put /* contrast-ignore */ inside a rule to skip it on purpose.
// Minimum ratio: 4.5:1 (WCAG AA, normal text).
// Usage: node scripts/check-contrast.mjs [file.css ...]   (default: every .css under src/)
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MIN_RATIO = 4.5;

export function parseColor(v) {
  v = v.trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(a);
  }
  m = v.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.slice(0, 3).every(n => !isNaN(n))) return [p[0], p[1], p[2], p[3] ?? 1];
  }
  if (v === 'white') return [255, 255, 255, 1];
  if (v === 'black') return [0, 0, 0, 1];
  return null;
}

function luminance([r, g, b]) {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

function resolveVars(value, vars, depth = 0) {
  if (depth > 10) return value;
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, name, fallback) =>
    resolveVars(vars[name] ?? fallback ?? '', vars, depth + 1));
}

export function checkCss(css, file = '<css>') {
  const problems = [];
  // Blank out comments (keeping line numbers) except contrast-ignore markers.
  const text = css.replace(/\/\*[\s\S]*?\*\//g, c => (/contrast-ignore/.test(c) ? c : c.replace(/[^\n]/g, ' ')));
  const blocks = [];
  const re = /([^{}]*)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    const line = text.slice(0, m.index + m[1].length).split('\n').length;
    blocks.push({ selector: m[1].trim(), body: m[2], line });
  }
  const vars = {};
  for (const b of blocks) {
    for (const d of b.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) vars[d[1]] = d[2].trim();
  }
  for (const b of blocks) {
    if (/contrast-ignore/.test(b.body)) continue;
    const decl = name => {
      const all = [...b.body.matchAll(new RegExp(`(?:^|[;\\s])${name}\\s*:\\s*([^;]+)`, 'g'))];
      return all.length ? all[all.length - 1][1].replace(/!important/, '').trim() : null;
    };
    const color = decl('color');
    const background = decl('background-color') ?? decl('background');
    if (!color || !background) continue;
    const fg = parseColor(resolveVars(color, vars));
    const bg = parseColor(resolveVars(background, vars));
    if (!fg || !bg || bg[3] < 1) continue; // not a solid, resolvable pair
    const ratio = contrastRatio(fg, bg);
    if (ratio < MIN_RATIO) {
      problems.push(`${file}:${b.line} "${b.selector}" contrast ${ratio.toFixed(2)}:1 is below ${MIN_RATIO}:1 (color ${color} on ${background})`);
    }
  }
  return problems;
}

function cssFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? cssFiles(p) : p.endsWith('.css') ? [p] : [];
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = process.argv.length > 2 ? process.argv.slice(2) : cssFiles('src');
  const problems = files.flatMap(f => checkCss(readFileSync(f, 'utf8'), relative('.', f)));
  if (problems.length) {
    console.error(`contrast check FAILED (${problems.length}):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`contrast check OK (${files.length} file${files.length === 1 ? '' : 's'})`);
}
