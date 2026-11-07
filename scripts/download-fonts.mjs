#!/usr/bin/env node
// Download fonts from Google Fonts GitHub repository

import { writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const fonts = [
  {
    url: 'https://github.com/google/fonts/raw/main/ofl/imfelldwpica/IMFePIrm28P.ttf',
    path: 'assets/fonts/IMFellDWPica-Regular.ttf'
  },
  {
    url: 'https://github.com/google/fonts/raw/main/ofl/imfelldwpica/IMFePIit28P.ttf',
    path: 'assets/fonts/IMFellDWPica-Italic.ttf'
  },
  {
    url: 'https://github.com/google/fonts/raw/main/ofl/imfelldwpica/OFL.txt',
    path: 'assets/fonts/OFL.txt'
  },
  {
    url: 'https://github.com/google/fonts/raw/main/ofl/grenzegotisch/GrenzeGotisch%5Bwght%5D.ttf',
    path: 'assets/fonts/GrenzeGotisch.ttf'
  },
  {
    url: 'https://github.com/google/fonts/raw/main/ofl/atkinsonhyperlegible/AtkinsonHyperlegible-Regular.ttf',
    path: 'assets/fonts/AtkinsonHyperlegible-Regular.ttf'
  },
  {
    url: 'https://github.com/google/fonts/raw/main/ofl/atkinsonhyperlegible/AtkinsonHyperlegible-Bold.ttf',
    path: 'assets/fonts/AtkinsonHyperlegible-Bold.ttf'
  }
];

for (const font of fonts) {
  const fullPath = join(projectRoot, font.path);
  console.log(`Downloading ${font.url}...`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  
  try {
    const response = await fetch(font.url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`Failed to download ${font.url}: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, Buffer.from(buffer));
    console.log(`Saved to ${fullPath}`);
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error(`Download timeout for ${font.url}`);
    }
    throw error;
  }
}

console.log('All fonts downloaded successfully!');
