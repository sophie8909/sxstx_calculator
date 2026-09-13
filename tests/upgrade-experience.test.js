import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateUpgradeExperience, fillMissingUpgradeExperience } from '../src/core/upgradeExperience.js';

test('uses destination levels and rounds to 5, or to 10 for pets', () => {
  assert.equal(calculateUpgradeExperience('equipment', 's2', 100), 9280);
  assert.equal(calculateUpgradeExperience('equipment', 's4', 190), 57000);
  assert.equal(calculateUpgradeExperience('skill', 's4', 190), 38425);
  assert.equal(calculateUpgradeExperience('relic', 's4', 19), 115000);
  assert.equal(calculateUpgradeExperience('pet', 's5', 191), 741630);
  assert.equal(calculateUpgradeExperience('pet', 's1', 12), 960);
});

test('keeps all source CSV segment endpoints and correct rounding', () => {
  for (const line of readFileSync(new URL('../docs/data/upg_res_0.4.0.csv', import.meta.url), 'utf8').trim().split(/\r?\n/).slice(1)) {
    const [season, type, to, base, slope] = line.split(',');
    if (!season) continue;
    if (base === '?') continue;
    const step = type === 'pet' ? 10 : 5;
    assert.equal(calculateUpgradeExperience(type, season, Number(to)), step * Math.round((Number(base) + Number(slope) * Number(to)) / step), line);
  }
});

test('S4 screenshot supplies all 24 unknown formula levels', () => {
  const values = [276320,277510,278950,280290,281580,283060,284210,285840,286840,288610,291390,291870,294160,294780,296940,297700,299710,300620,302490,303540,306220,306460,309280,309380];
  values.forEach((value, index) => assert.equal(calculateUpgradeExperience('pet', 's4', 167 + index), value));
  assert.equal(calculateUpgradeExperience('pet', 's4', 191), 312300);
});

test('fills whole missing tables and blank rows without overwriting positive live data', () => {
  const rows = fillMissingUpgradeExperience([
    { season: 's4', level: 190, cost_exp: '', cost_stone_ore: '' },
    { season: 's4', level: 191, cost_exp: 12345, cost_stone_ore: 1 },
    { season: 's4', level: 192, cost_exp: 0, cost_stone_ore: 0 },
  ], 'equipment', 's4');
  assert.equal(rows.find(r => r.level === 190).cost_stone_ore, 57000);
  assert.equal(rows.find(r => r.level === 191).cost_exp, 12345);
  assert.equal(rows.find(r => r.level === 191).cost_stone_ore, 1);
  assert.equal(rows.find(r => r.level === 192).cost_stone_ore, 58140);
  const pets = fillMissingUpgradeExperience([], 'pet', 's4');
  assert.equal(pets.length, 300);
  assert.equal(pets.find(r => r.level === 166).cost_exp, 276320);
  assert.equal(fillMissingUpgradeExperience([], 'equipment', 's2').find(r => r.level === 99).cost_stone_ore, 9280);
});

test('does not invent out-of-range data or discard missing rows', () => {
  assert.equal(calculateUpgradeExperience('pet', 's4', 301), null);
  assert.equal(calculateUpgradeExperience('pet', 's6', 100), null);
  const rows = fillMissingUpgradeExperience([{ season: 's4', level: 301 }], 'pet', 's4');
  assert.equal(rows.find(r => r.level === 301).cost_exp, undefined);
  assert.deepEqual(fillMissingUpgradeExperience([], 'character', 's5'), []);
});


test('fills pet food from confirmed 50 EXP conversion without replacing known costs', () => {
  const rows = fillMissingUpgradeExperience([
    { season: 's4', level: 166, cost_exp: 276320, cost_freeze_dried: '' },
    { season: 's4', level: 167, cost_exp: 277510, cost_freeze_dried: 0 },
    { season: 's4', level: 168, cost_exp: 278950, cost_freeze_dried: 123 },
    { season: 's4', level: 301, cost_exp: 0, cost_freeze_dried: '' },
  ], 'pet', 's4');
  assert.equal(rows.find(r => r.level === 166).cost_freeze_dried, 5526.4);
  assert.equal(rows.find(r => r.level === 167).cost_freeze_dried, 5550.2);
  assert.equal(rows.find(r => r.level === 168).cost_freeze_dried, 123);
  assert.equal(rows.find(r => r.level === 301).cost_freeze_dried, '');
  for (const season of ['s1', 's2', 's3', 's4', 's5']) {
    const generated = fillMissingUpgradeExperience([], 'pet', season);
    assert.ok(generated.length > 0);
    for (const row of generated) {
      assert.ok(row.cost_exp > 0, season + ':' + row.level);
      assert.equal(row.cost_freeze_dried, row.cost_exp / 50);
    }
  }
});

test('pet resonance needs increase for S3 through S5 after filling missing food', async () => {
  const { buildCumulativeCostData, getCostDelta } = await import('../src/core/upgradeCost.js');
  for (const season of ['s3', 's4', 's5']) {
    const rows = fillMissingUpgradeExperience([], 'pet', season);
    const table = buildCumulativeCostData({ petUpgradeCosts: rows }).pet;
    const first = getCostDelta(table, 166, 167, { expectedMaterials: ['freezeDried'] });
    const next = getCostDelta(table, 166, 168, { expectedMaterials: ['freezeDried'] });
    assert.equal(first.missingMaterials, undefined);
    assert.equal(next.missingMaterials, undefined);
    assert.ok(first.materials.freezeDried > 0);
    assert.ok(next.materials.freezeDried > first.materials.freezeDried);
  }
});
