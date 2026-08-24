import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('info icons stay out of the Tab order in dynamic and static fields', async () => {
  const [view, controller] = await Promise.all([read('src/ui/view.js'), read('src/ui/controller.js')]);
  assert.doesNotMatch(view, /icon\.tabIndex|tooltip-icon[^\n]*tabindex/);
  assert.doesNotMatch(controller, /tooltip-icon[^\n]*tabindex|tooltip-icon[^\n]*role="button"/);
  assert.match(view, /icon\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(controller, /tooltip-icon" aria-hidden="true"/);
});

test('equipment, skill, and pet inputs expose compact resonance and detailed modes', async () => {
  const [view, controller] = await Promise.all([read('src/ui/view.js'), read('src/ui/controller.js')]);
  for (const category of ['equipment', 'skill', 'pet']) {
    assert.match(view, new RegExp(`renderCurrentLevelInputs\\([\\s\\S]*?'${category}'`));
  }
  assert.match(controller, /const CURRENT_LEVEL_CATEGORIES = \['equipment', 'skill', 'pet'\]/);
  assert.match(controller, /\$\{category\}-current-layout-mode/);
  assert.match(controller, /\$\{category\}-resonance-current/);
  assert.match(controller, /minimumFilledValue\(layout\.detailedInputs\.map/);
  assert.match(controller, /mirrorCompactCurrentLevelInput\(t\)/);
  assert.match(controller, /syncSavedCompactCurrentLevels\(\)/);
});

test('all compact and detailed controls use the relic segmented button style', async () => {
  const [view, html, i18n] = await Promise.all([
    read('src/ui/view.js'),
    read('index.html'),
    read('src/i18n-data.js'),
  ]);
  assert.match(view, /target-layout-selector', 'segmented-control'/);
  assert.match(view, /const selector = el\('div', \['segmented-control'\]\)/);
  assert.match(html, /class="segmented-control"[^>]*data-i18n-aria-label="relic_input_mode"/);
  assert.match(i18n, /relic_mode_new: \{ 'zh-Hant': '精簡'/);
  assert.match(i18n, /relic_mode_old: \{ 'zh-Hant': '詳細'/);
});
