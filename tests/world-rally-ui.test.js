import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { WORLD_RALLY_I18N } from '../src/i18n-world-rally.js';
import { WORLD_RALLY_STATE_I18N } from '../src/i18n-world-rally-state.js';

const count = (source, pattern) => [...source.matchAll(pattern)].length;

test('World Rally reuses the only global player and season controls', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.equal(count(html, /id="player-code-input"/g), 1);
  assert.equal(count(html, /id="season-select"/g), 1);
  assert.doesNotMatch(html, /id="world-rally-player-code"/);
  assert.doesNotMatch(html, /id="world-rally-season"/);
  assert.doesNotMatch(html, /id="world-rally-calculate"/);
  assert.doesNotMatch(html, /world_rally_calculate/);
});

test('World Rally renders on activation and attaches one reactive listener per global control', async () => {
  const controller = await readFile(new URL('../src/ui/controller.js', import.meta.url), 'utf8');

  assert.match(controller, /if \(targetPage === 'world-rally'\) renderWorldRallyFromGlobalState\(\)/);
  assert.match(controller, /document\.getElementById\('player-code-input'\)/);
  assert.match(controller, /document\.getElementById\('season-select'\)/);
  assert.equal(count(controller, /playerInput\.addEventListener\('input', renderWhenActive\)/g), 1);
  assert.equal(count(controller, /seasonSelect\.addEventListener\('change', renderWhenActive\)/g), 1);
});

test('World Rally visible strings exist in every supported language', () => {
  const dictionaries = { ...WORLD_RALLY_I18N, ...WORLD_RALLY_STATE_I18N };
  const requiredKeys = [
    'nav_world_rally',
    'world_rally_title',
    'world_rally_intro',
    'world_rally_empty_prompt',
    'world_rally_before_s4',
    'world_rally_current_indicator',
  ];

  for (const key of requiredKeys) {
    assert.ok(dictionaries[key], `missing ${key}`);
    for (const language of ['zh-Hant', 'zh-Hans', 'en']) {
      assert.ok(dictionaries[key][language], `missing ${key}.${language}`);
      assert.notEqual(dictionaries[key][language], key);
    }
  }
});
