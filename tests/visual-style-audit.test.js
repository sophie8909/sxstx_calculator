import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = [
  'index.html', 'css/style.css', 'css/world-rally.css',
  'src/shared/components.js', 'src/app/shell.js', 'src/ui/view.js', 'src/ui/controller.js', 'src/form-relay.js',
  'src/styles/tokens.css', 'src/styles/themes.css', 'src/styles/components.css', 'src/styles/fantasy.css',
  'src/styles/features/primordial.css', 'src/styles/features/equipment.css', 'src/styles/features/gift.css',
  'src/styles/features/world-rally.css', 'src/styles/features/contribution.css',
];

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('visual style audit rejects obsolete primary-theme palette usage', async () => {
  const entries = await Promise.all(files.map(async (path) => [path, await read(path)]));
  const forbidden = /(?:#0f6b68|#0b5654|#dcefed|#edf6f5|#61c7b1|#dcf7f0|\bbg-teal-|\btext-teal-|\bborder-teal-|\bring-teal-|\bbg-cyan-|\btext-cyan-|\bborder-cyan-|\bring-cyan-|\b(?:teal|cyan|turquoise|aqua)\b)/i;
  const violations = entries.filter(([, content]) => forbidden.test(content)).map(([path]) => path);
  assert.deepEqual(violations, [], `obsolete visual tokens found in: ${violations.join(', ')}`);
});

test('shared fantasy semantic variants cover routes and themes', async () => {
  const [shell, shared, components, tokens, themes, fantasy] = await Promise.all([
    read('src/app/shell.js'), read('src/shared/components.js'), read('src/styles/components.css'),
    read('src/styles/tokens.css'), read('src/styles/themes.css'), read('src/styles/fantasy.css'),
  ]);
  for (const route of ['primordial', 'equipment', 'gift', 'world-rally', 'contribution']) assert.match(shell, new RegExp(route));
  for (const variant of ['neutral', 'info', 'shortage', 'warning', 'success', 'unavailable']) {
    assert.match(shared, new RegExp(`["']${variant}["']`));
    assert.match(components, new RegExp(`summary-metric--${variant}`));
  }
  for (const token of ['--metric-neutral-bg', '--metric-info-bg', '--metric-shortage-bg', '--metric-warning-bg', '--metric-success-bg', '--metric-unavailable-bg']) {
    assert.match(tokens, new RegExp(token));
    assert.match(themes, new RegExp(token));
  }
  assert.match(fantasy, /\.notice-panel/);
  assert.match(fantasy, /\.status-panel/);
  assert.match(fantasy, /\.border-fantasy/);
});