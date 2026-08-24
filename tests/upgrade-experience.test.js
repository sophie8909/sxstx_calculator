import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateUpgradeExperience,
  fillMissingUpgradeExperience,
} from '../src/core/upgradeExperience.js';

test('uses the 5x rounded formula for equipment, skill, and relic', () => {
  assert.equal(calculateUpgradeExperience('equipment', 's4', 190), 57000);
  assert.equal(calculateUpgradeExperience('skill', 's4', 190), 38425);
  assert.equal(calculateUpgradeExperience('relic', 's4', 19), 115000);
});

test('uses the 10x rounded formula for pets', () => {
  assert.equal(calculateUpgradeExperience('pet', 's5', 191), 1483260);
});

test('fills only missing cost_exp values and preserves Google Sheet values', () => {
  const rows = fillMissingUpgradeExperience([
    { season: 's4', level: 190, cost_exp: '', cost_stone_ore: 1 },
    { season: 's4', level: 191, cost_exp: 12345, cost_stone_ore: 1 },
    { season: 's4', level: 192, cost_exp: 0, cost_stone_ore: 1 },
  ], 'equipment');

  assert.equal(rows[0].cost_exp, 57000);
  assert.equal(rows[1].cost_exp, 12345);
  assert.equal(rows[2].cost_exp, 57570);
});

test('drops level-only rows as missing data', () => {
  assert.equal(calculateUpgradeExperience('pet', 's4', 301), null);
  assert.deepEqual(
    fillMissingUpgradeExperience([{ season: 's4', level: 301 }], 'pet'),
    []
  );
});
