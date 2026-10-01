import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/styles/theme.css', import.meta.url), 'utf8');
const failures = [];

const pxWidth = [...css.matchAll(/(?:min-|max-)?width\s*:\s*[^;]*px[^;]*/g)].map((m) => m[0]);
if (pxWidth.length) failures.push(`Pixel-based widths are not allowed: ${pxWidth.join(', ')}`);

const pxMedia = [...css.matchAll(/@media[^\{]*\d+px/g)].map((m) => m[0]);
if (pxMedia.length) failures.push(`Pixel-based breakpoints are not allowed: ${pxMedia.join(', ')}`);

const allowedBreakpoints = new Set([
  'max-width: 29.99rem',
  'min-width: 30rem',
  'min-width: 48rem',
  'min-width: 64rem',
  'min-width: 90rem'
]);

const media = [...css.matchAll(/@media\s*\(([^)]+)\)/g)].map((m) => m[1].trim());
for (const query of media) {
  if (!allowedBreakpoints.has(query) && !query.includes('and')) {
    failures.push(`Unexpected breakpoint: ${query}`);
  }
}

if (!css.includes('overflow-x: clip')) failures.push('Document-level horizontal overflow containment is missing.');
if (!css.includes('grid-template-columns: repeat(12, minmax(0, 1fr))')) failures.push('Desktop 12-column grid is missing.');
if (!css.includes('--content-max: 90rem')) failures.push('Responsive content max token is missing.');

if (failures.length) {
  console.error('Responsive CSS checks failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('Responsive CSS checks passed.');
