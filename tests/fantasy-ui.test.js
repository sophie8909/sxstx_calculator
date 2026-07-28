import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('approved pastel fantasy tokens replace the legacy teal identity', async () => {
  const [tokens, themes, fantasy] = await Promise.all([
    read('src/styles/tokens.css'), read('src/styles/themes.css'), read('src/styles/fantasy.css'),
  ]);
  for (const token of ['--page-bg: #f8f5ff', '--primary: #8064e8', '--secondary: #e78bb6', '--sky: #72b7ef', '--gold: #e8bd58']) {
    assert.match(tokens, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(tokens, /#0f6b68|#173536/);
  assert.match(themes, /--page-bg: #21172f/);
  assert.match(themes, /--gold: #e9c96f/);
  assert.match(fantasy, /linear-gradient\(145deg,var\(--primary\),var\(--secondary\)\)/);
  assert.match(fantasy, /prefers-reduced-motion:reduce/);
});

test('shell uses five context sections, fantasy icons, and responsive navigation', async () => {
  const [shell, shared, fantasy] = await Promise.all([
    read('src/app/shell.js'), read('src/shared/components.js'), read('src/styles/fantasy.css'),
  ]);
  for (const id of ['context-season', 'context-player', 'context-server', 'context-realm-value', 'context-status']) {
    assert.match(shell, new RegExp(id));
  }
  assert.match(shared, /<svg viewBox=/);
  assert.match(fantasy, /grid-template-columns: minmax\(135px,.8fr\).*minmax\(150px,.85fr\)/);
  assert.match(fantasy, /@media \(max-width:1199px\)/);
  assert.match(fantasy, /@media \(max-width:767px\)/);
});

test('Primordial resource workspace keeps the approved 2, 1, 3 card rows and mobile order', async () => {
  const [shell, primordial, fantasy] = await Promise.all([
    read('src/app/shell.js'), read('src/styles/features/primordial.css'), read('src/styles/fantasy.css'),
  ]);
  assert.match(shell, /resourceRow\('resource-row-top', \['equipment-card', 'skill-card'\]\)/);
  assert.match(shell, /resourceRow\('resource-row-pets', \['pet-card'\]\)/);
  assert.match(shell, /resourceRow\('resource-row-summary', \['owned-materials-card', 'production-card', 'results-card'\]\)/);
  assert.match(primordial, /\.resource-row-top \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(fantasy, /minmax\(0,1.15fr\) minmax\(280px,.9fr\) minmax\(300px,1fr\)/);
  assert.match(primordial, /@media \(max-width: 767px\)[\s\S]*resource-row-top, \.resource-row-pets, \.resource-row-summary/);
});
