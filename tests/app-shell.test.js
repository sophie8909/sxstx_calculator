import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('application shell defines five canonical features and responsive navigation', async () => {
  const [shell, layout, components] = await Promise.all([
    read('src/app/shell.js'), read('src/styles/layout.css'), read('src/shared/components.js'),
  ]);
  for (const tool of ['primordial', 'equipment', 'gift', 'world-rally', 'contribution']) {
    assert.match(shell, new RegExp(`['"]${tool}['"]`));
  }
  assert.match(shell, /desktop-feature-nav/);
  assert.match(shell, /mobile-navigation/);
  assert.match(layout, /--sidebar-width/);
  assert.match(layout, /@media \(max-width: 639px\)/);
  assert.match(components, /ariaSelected/);
  assert.match(components, /ArrowLeft/);
});

test('Primordial workspace exposes exactly three independent layouts and transfer actions', async () => {
  const shell = await read('src/app/shell.js');
  assert.match(shell, /id: 'primordial-workspace'/);
  assert.equal((shell.match(/\{ id: 'target', label: copy\.primordialTabs/g) || []).length, 1);
  assert.equal((shell.match(/\{ id: 'experience', label: copy\.primordialTabs/g) || []).length, 1);
  assert.equal((shell.match(/\{ id: 'resources', label: copy\.primordialTabs/g) || []).length, 1);
  assert.match(shell, /applyCharacter/);
  assert.match(shell, /applyAll/);
  assert.match(shell, /character-exp-target/);
  assert.match(shell, /target-character/);
});

test('source markup has one global player number and no obsolete quick-navigation component', async () => {
  const html = await read('index.html');
  assert.equal((html.match(/id="player-code-input"/g) || []).length, 1);
  assert.doesNotMatch(html, /id="section-side-nav"/);
  assert.doesNotMatch(html, /id="app-loading-overlay"/);
});

test('shared controls and design tokens are centralized', async () => {
  const [tokens, fantasy, components] = await Promise.all([
    read('src/styles/tokens.css'), read('src/styles/fantasy.css'), read('src/styles/components.css'),
  ]);
  assert.match(tokens, /--primary: #8064e8/);
  assert.match(tokens, /--content-max: 1500px/);
  assert.match(fantasy, /min-height: var\(--control-height\)/);
  assert.match(components, /\.btn-primary/);
  assert.match(components, /\.global-data-status/);
});
