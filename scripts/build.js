/**
 * Build script for AI Browser Guard Chrome extension.
 *
 * Builds each entry point separately to avoid shared chunk issues.
 * Content scripts need IIFE format (no ES module imports).
 * Background and popup can use ES modules.
 * Copies manifest.json (with corrected paths) and icons into dist/.
 */

import { execSync } from 'child_process';
import { rmSync, existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const entries = ['content', 'background', 'popup'];

// Clean dist
if (existsSync('dist')) {
  rmSync('dist', { recursive: true, force: true });
}

for (const entry of entries) {
  console.log(`\nBuilding ${entry}...`);
  execSync(`ENTRY=${entry} npx vite build`, { stdio: 'inherit' });
}

// Copy and adjust manifest.json for dist/ as root
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf-8'));
manifest.background.service_worker = 'background/index.js';
manifest.content_scripts[0].js = ['content/index.js'];
manifest.action.default_popup = 'popup/index.html';
writeFileSync(resolve(root, 'dist', 'manifest.json'), JSON.stringify(manifest, null, 2));

// Copy icons
const iconsDir = resolve(root, 'dist', 'icons');
mkdirSync(iconsDir, { recursive: true });
for (const icon of ['icon16.png', 'icon48.png', 'icon128.png']) {
  copyFileSync(resolve(root, 'icons', icon), resolve(iconsDir, icon));
}

// Copy fonts
const fontsDir = resolve(root, 'dist', 'fonts');
mkdirSync(fontsDir, { recursive: true });
copyFileSync(resolve(root, 'fonts', 'inter-latin.woff2'), resolve(fontsDir, 'inter-latin.woff2'));

console.log('\nBuild complete. Load dist/ in chrome://extensions');
