/**
 * Bump version in both manifest.json and package.json simultaneously.
 *
 * Usage:
 *   npm run bump -- patch    # 0.2.0 -> 0.2.1
 *   npm run bump -- minor    # 0.2.0 -> 0.3.0
 *   npm run bump -- major    # 0.2.0 -> 1.0.0
 *   npm run bump -- 0.3.0    # explicit version
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: npm run bump -- <patch|minor|major|x.y.z>');
  process.exit(1);
}

// Read current version from manifest (single source of truth)
const manifestPath = resolve(root, 'manifest.json');
const packagePath = resolve(root, 'package.json');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));

const current = manifest.version;
const [major, minor, patch] = current.split('.').map(Number);

let newVersion;
switch (arg) {
  case 'patch':
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
  default:
    if (/^\d+\.\d+\.\d+$/.test(arg)) {
      newVersion = arg;
    } else {
      console.error(`Invalid version argument: ${arg}`);
      console.error('Use: patch, minor, major, or an explicit x.y.z version');
      process.exit(1);
    }
}

// Update both files
manifest.version = newVersion;
pkg.version = newVersion;

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`${current} -> ${newVersion}`);
console.log(`  Updated: manifest.json, package.json`);
console.log(`  Popup footer: reads from manifest at runtime (automatic)`);
