import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (fileName) => readFile(new URL(`../${fileName}`, import.meta.url), 'utf8');

test('material source panels keep the requested two-row content order', async () => {
  const view = await readSource('src/ui/view.js');
  const grid = view.match(/<div class="material-source-grid">([\s\S]*?)<\/div>/)?.[1] || '';

  assert.ok(grid.indexOf('${dungeonHtml}') < grid.indexOf('${exploreHtml}'));
  assert.ok(grid.indexOf('${exploreHtml}') < grid.indexOf('${storeHtml}'));
  assert.ok(grid.indexOf('${storeHtml}') < grid.indexOf('${bondHtml}'));
  assert.ok(grid.indexOf('${bondHtml}') < grid.indexOf('${mineSettingsHtml}'));
  assert.ok(grid.indexOf('${mineSettingsHtml}') < grid.indexOf('${storeSummaryHtml}'));
  assert.match(view, /material-source-panel--\$\{source\}/);
});

test('material source grid uses one, two, and three columns without a four-column rule', async () => {
  const css = await readSource('css/style.css');

  assert.match(css, /\.material-source-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(css, /@media \(min-width:\s*768px\)[\s\S]*?\.material-source-grid\s*\{[^}]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(min-width:\s*1280px\)[\s\S]*?\.material-source-grid\s*\{[^}]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.material-source-panel--dungeon\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1/s);
  assert.match(css, /\.material-source-panel--explore\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1/s);
  assert.match(css, /\.material-source-panel--store\s*\{[^}]*grid-column:\s*3;[^}]*grid-row:\s*1/s);
  assert.match(css, /\.material-source-panel--bond\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*2/s);
  assert.match(css, /\.material-source-panel--mine\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*2/s);
  assert.match(css, /\.material-source-panel--store-summary\s*\{[^}]*grid-column:\s*3;[^}]*grid-row:\s*2/s);
  assert.doesNotMatch(css, /\.material-source-panel--bond\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s);
  assert.doesNotMatch(css, /\.material-source-grid\s*\{[^}]*repeat\(4,/s);
});

test('big mine controls and store totals render as dedicated panels with stable ids', async () => {
  const view = await readSource('src/ui/view.js');

  assert.match(view, /material-source-panel--mine/);
  assert.match(view, /id="explore-big-mine-enabled"/);
  assert.match(view, /material-source-panel--store-summary/);
  assert.match(view, /id="store-price-daily-total"/);
  assert.match(view, /id="store-price-period-total"/);
  assert.doesNotMatch(view, /\$\{exploreSummary\}/);
  assert.doesNotMatch(view, /\$\{storeSummary\}/);
});

test('material source tables fill their panels and keep overflow local', async () => {
  const view = await readSource('src/ui/view.js');
  const css = await readSource('css/style.css');

  assert.match(view, /class="material-source-table-wrap responsive-table"/);
  assert.match(view, /class="material-source-table w-full text-sm border-collapse"/);
  assert.doesNotMatch(view, /material-source-table-wide/);
  assert.match(css, /\.responsive-table \.material-source-table\s*\{[^}]*width:\s*100%[^}]*min-width:\s*100%/s);
  assert.match(css, /\.material-source-table th\s*\{[^}]*white-space:\s*normal/s);
});
