import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSeasonScore, calculateUpgradeResults } from '../src/core/calculator.js';
import { normalizeTargetValues } from '../src/core/targetLayouts.js';

const categories = [
  'equipment_main_weapon', 'equipment_off_weapon', 'equipment_helmet', 'equipment_armor', 'equipment_boots',
  'skill_combat1', 'skill_combat2', 'skill_combat3', 'skill_combat4',
  'skill_arcane1', 'skill_arcane2', 'skill_arcane3', 'skill_arcane4',
  'pet1', 'pet2', 'pet3', 'pet4',
].map((id) => ({ id }));
const table = (key) => [{ level: 1, [key]: 10 }, { level: 2, [key]: 10 }, { level: 3, [key]: 10 }];
const context = {
  categories,
  cumulativeCostData: { equipment: table('cost_stoneOre'), skill: table('cost_essence'), pet: table('cost_freezeDried'), relic: table('cost_sand') },
  gameData: { equipmentUpgradeCosts: [], skillUpgradeCosts: [], petUpgradeCosts: [], characterUpgradeCosts: [] },
  materials: { stoneOre: {}, essence: {}, freezeDried: {}, sand: {} }, productionSources: {}, relicCountRequired: 20,
  seasonId: 's1', seasonScore: { s1: { season_level: 100, character_level_score: 1, equipment_level_score: 1, skill_level_score: 1, pet_level_score: 1, relic_level_score: 1, star_convert: 1, star_basis: 0 } },
  speedupHoursPerUse: 2, labels: { character: 'character', equipment: 'equipment', skill: 'skill', pet: 'pet' }, messages: { relicCountError: 'error' },
};
function run(targets) { return calculateUpgradeResults({ targets, categoryCurrentLevels: Object.fromEntries(categories.map(({ id }) => [id, 1])), relicDistribution: [{ level: 1, count: 20 }], bedProgress: { currentLevel: 1, ownedExp: 0, bedExpHourly: 0, targetTime: '' }, primordial: { accumulated: 0 }, productionHourly: {}, materialSourceGains: {}, ownedMaterials: {}, speedupState: {}, now: 0 }, context); }

test('uniform compact and detailed targets have identical costs and score', () => {
  const compact = normalizeTargetValues({ 'target-equipment_resonance': '3', 'target-skill_resonance': '3', 'target-pet_resonance': '3', 'target-relic_resonance': '3' });
  const detailed = normalizeTargetValues({ ...Object.fromEntries(['equipment_main_weapon','equipment_off_weapon','equipment_helmet','equipment_armor','equipment_boots'].map((id) => ['target-' + id, '3'])), ...Object.fromEntries(['skill_combat1','skill_combat2','skill_combat3','skill_combat4','skill_arcane1','skill_arcane2','skill_arcane3','skill_arcane4'].map((id) => ['target-' + id, '3'])), ...Object.fromEntries(['pet1','pet2','pet3','pet4'].map((id) => ['target-' + id, '3'])), ...Object.fromEntries(Array.from({ length: 5 }, (_, i) => ['target-relic-element-' + (i + 1), '3'])) }, 'detailed');
  assert.deepEqual(run(compact).required, run(detailed).required);
  assert.equal(calculateSeasonScore(compact, context.seasonScore, 's1'), calculateSeasonScore(detailed, context.seasonScore, 's1'));
});

test('different detailed targets sum independently and blank targets do not cost', () => {
  const targets = normalizeTargetValues({ 'target-equipment_main_weapon': '3', 'target-equipment_off_weapon': '3', 'target-equipment_helmet': '', 'target-equipment_armor': '1', 'target-equipment_boots': '0', 'target-skill_combat1': '3' }, 'detailed');
  const result = run(targets);
  assert.equal(result.required.stoneOre, 20);
  assert.equal(result.required.essence, 10);
});
