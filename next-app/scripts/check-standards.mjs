import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const ROOT = new URL('../src/', import.meta.url);
const ROOT_PATH = ROOT.pathname;
const violations = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }

  return files;
}

function report(file, rule, detail) {
  violations.push(`${relative(ROOT_PATH, file)}: ${rule} — ${detail}`);
}

for (const file of await walk(ROOT_PATH)) {
  const extension = extname(file);
  if (!['.css', '.ts', '.tsx'].includes(extension)) continue;

  const content = await readFile(file, 'utf8');

  if (extension === '.css') {
    const pixelMatches = content.match(/(?:\d*\.)?\d+px\b/g);
    if (pixelMatches) report(file, 'responsive-units', `use rem/em/relative units instead of ${[...new Set(pixelMatches)].join(', ')}`);

    if (!file.endsWith('styles/theme.css')) {
      const rawColorMatches = content.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g);
      if (rawColorMatches) report(file, 'design-tokens', 'move hard-coded colors into styles/theme.css');
    }
  }

  if (extension === '.tsx' && /style=\{\{/.test(content)) {
    report(file, 'no-inline-styles', 'move presentation into the component stylesheet or shared styles');
  }
}

if (violations.length > 0) {
  console.error('Coding-standard violations found:\n');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Frontend coding-standard checks passed.');
