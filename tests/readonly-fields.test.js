import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Primordial cumulative keeps the accumulated value editable and marks calculated values read-only', async () => {
  const view = await read('src/ui/view.js');
  assert.match(view, /\['primordial-star-accumulated',[\s\S]*?false\]/);
  assert.match(view, /createInputGroup[\s\S]*?\['input-field', 'rounded', 'w-full', 'p-2'\]/);
  assert.match(view, /\['primordial-star-current-season',[\s\S]*?true\]/);
  assert.match(view, /\['primordial-star-total',[\s\S]*?true\]/);
  assert.match(view, /setReadOnlyField\(input\)/);
  assert.doesNotMatch(view, /input\.disabled = true/);
});

test('recommendations use the shared read-only surface and semantic attributes', async () => {
  const controller = await read('src/ui/controller.js');
  const start = controller.indexOf('async function renderPrimordialRecommendations');
  const end = controller.indexOf('async function applyTargetRecommendation', start);
  const recommendationBlock = controller.slice(start, end);
  assert.match(recommendationBlock, /field-group--readonly/);
  assert.match(recommendationBlock, /class="readonly-field/);
  assert.match(recommendationBlock, /readonly\s+aria-readonly="true"/);
  assert.match(recommendationBlock, /t\('readonly_badge'\)/);
  assert.doesNotMatch(recommendationBlock, /class="input-field/);
  assert.doesNotMatch(recommendationBlock, /disabled/);
});

test('static calculated controls are read-only rather than disabled or editable-looking', async () => {
  const html = await read('index.html');
  for (const id of ['equipment-season-rating', 'fragment-decomposed-sale', 'fragment-sale-after-fee', 'fragment-profit']) {
    const tag = html.match(new RegExp(`<input id="${id}"[^>]*>`))?.[0] || '';
    assert.match(tag, /class="readonly-field/);
    assert.match(tag, /\sreadonly(?:\s|>)/);
    assert.match(tag, /aria-readonly="true"/);
    assert.doesNotMatch(tag, /input-field/);
    assert.doesNotMatch(tag, /\sdisabled(?:\s|>)/);
  }
});

test('read-only number controls hide steppers and have dedicated light and dark surfaces', async () => {
  const fantasy = await read('src/styles/fantasy.css');
  assert.match(fantasy, /input\[readonly\]\[type="number"\] \{ appearance: textfield; \}/);
  assert.match(fantasy, /input\[readonly\]\[type="number"\]::\-webkit-inner-spin-button/);
  assert.match(fantasy, /input\.readonly-field,\.readonly-field[\s\S]*?border: 0!important/);
  assert.match(fantasy, /cursor: default/);
  assert.match(fantasy, /html\[data-theme='dark'\] input\.readonly-field/);
  assert.match(fantasy, /rgba\(68,48,91,.92\)/);
});

test('Traditional Chinese exposes a compact 唯讀 indicator', async () => {
  const [i18n, html] = await Promise.all([read('src/i18n-data.js'), read('index.html')]);
  assert.match(i18n, /"readonly_badge"\s*:\s*\{[\s\S]*?"zh-Hant"\s*:\s*"唯讀"/);
  assert.match(html, /class="readonly-badge"[^>]*data-i18n="readonly_badge">唯讀<\/span>/);
});

test('derived context and score displays use semantic calculated surfaces', async () => {
  const [shell, html, relay] = await Promise.all([
    read('src/app/shell.js'), read('index.html'), read('src/form-relay.js'),
  ]);
  assert.match(shell, /context-summary readonly-field" role="status" aria-live="polite"/);
  assert.match(html, /readonly-field readonly-field--summary[^>]*role="status" aria-live="polite"/);
  assert.match(relay, /setReadOnlyField\(descriptionInput\)/);
  assert.match(relay, /relay-description-readonly-badge/);
});
test('shared helper never presents a read-only control as unavailable', async () => {
  const shared = await read('src/shared/components.js');
  assert.match(shared, /export function setReadOnlyField/);
  assert.match(shared, /control\.disabled = false/);
  assert.match(shared, /control\.readOnly = readOnly/);
  assert.match(shared, /classList\.toggle\('readonly-field', readOnly\)/);
  assert.match(shared, /setAttribute\('aria-readonly', 'true'\)/);
});