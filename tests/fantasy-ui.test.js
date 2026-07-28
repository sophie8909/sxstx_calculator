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

test('shell uses four balanced context sections, fantasy icons, and responsive navigation', async () => {
  const [shell, shared, fantasy] = await Promise.all([
    read('src/app/shell.js'), read('src/shared/components.js'), read('src/styles/fantasy.css'),
  ]);
  for (const id of ['context-season', 'context-player', 'context-server', 'context-status']) {
    assert.match(shell, new RegExp(id));
  }
  assert.doesNotMatch(shell, /context-realm-value|context-world-value|context-summary/);
  assert.match(shared, /<svg viewBox=/);
  assert.match(fantasy, /grid-template-columns: minmax\(150px,.8fr\) minmax\(210px,1fr\) minmax\(280px,1.4fr\) minmax\(190px,.9fr\)/);
  assert.match(fantasy, /@media \(max-width:1199px\)[\s\S]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(fantasy, /@media \(max-width:767px\)[\s\S]*grid-template-columns: 1fr/);
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

test('Gift results use shared semantic fantasy summary metrics', async () => {
  const [controller, shared, components, gift, tokens, themes] = await Promise.all([
    read('src/ui/controller.js'), read('src/shared/components.js'), read('src/styles/components.css'),
    read('src/styles/features/gift.css'), read('src/styles/tokens.css'), read('src/styles/themes.css'),
  ]);
  assert.match(controller, /import \{ setReadOnlyField, summaryMetric \}/);
  assert.match(controller, /summaryMetric\(\{/);
  assert.match(controller, /variant: missingFavor > 0 \? 'shortage' : 'success'/);
  assert.match(controller, /variant: 'overflow'/);
  assert.match(controller, /variant: summaryPlan\.reachable \? 'success' : 'unavailable'/);
  assert.match(shared, /summary-metric--\$\{safeVariant\}/);
  assert.match(components, /\.summary-metric--shortage/);
  assert.match(components, /\.summary-metric--overflow/);
  assert.match(components, /\.summary-metric--success/);
  assert.match(components, /height: 100%/);
  assert.match(gift, /#gift-calculator-result > div \{ height: 100%/);
  for (const token of ['--metric-default-bg', '--metric-info-bg', '--metric-shortage-bg', '--metric-overflow-bg', '--metric-success-bg']) {
    assert.match(tokens, new RegExp(token));
    assert.match(themes, new RegExp(token));
  }
  assert.doesNotMatch(gift, /teal|cyan|turquoise|#0f6b68|#dcefed|#edf6f5/);
});
