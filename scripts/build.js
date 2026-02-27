/**
 * Build script for AI Browser Guard Chrome extension.
 *
 * Builds each entry point separately to avoid shared chunk issues.
 * Content scripts need IIFE format (no ES module imports).
 * Background and popup can use ES modules.
 */

import { execSync } from 'child_process';
import { rmSync, existsSync } from 'fs';

const entries = ['content', 'background', 'popup'];

// Clean dist
if (existsSync('dist')) {
  rmSync('dist', { recursive: true, force: true });
}

for (const entry of entries) {
  console.log(`\nBuilding ${entry}...`);
  execSync(`ENTRY=${entry} npx vite build`, { stdio: 'inherit' });
}

console.log('\nBuild complete.');
