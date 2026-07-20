import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EQUIPMENT_TARGET_IDS, SKILL_TARGET_IDS, PET_TARGET_IDS, ELEMENT_TARGET_IDS, RELIC_TARGET_IDS,
  convertTargetLayout, convertRelicLayout, expandElementsToRelics, reduceRelicsToElements,
  minimumFilledValue, normalizeTargetValues,
} from '../src/core/targetLayouts.js';

test('compact values expand, including zero', () => {
  const values = convertTargetLayout({
    'target-equipment_resonance': '0', 'target-skill_resonance': '120',
    'target-pet_resonance': '80', 'target-relic_resonance': '20',
  }, 'compact', 'detailed', 'element');
  assert.deepEqual(EQUIPMENT_TARGET_IDS.map((id) => values[id]), ['0', '0', '0', '0', '0']);
  assert.equal(values['target-skill_arcane4'], '120');
  assert.equal(values['target-relic-element-5'], '20');
});

test('empty compact values do not overwrite detailed fields', () => {
  const values = convertTargetLayout({
    'target-equipment_resonance': '', 'target-equipment_main_weapon': '123',
  }, 'compact', 'detailed');
  assert.equal(values['target-equipment_main_weapon'], '123');
});

test('detailed values reduce to minimum and ignore empty fields', () => {
  const values = convertTargetLayout({
    'target-equipment_main_weapon': '120', 'target-equipment_off_weapon': '125',
    'target-equipment_helmet': '', 'target-equipment_armor': '130', 'target-equipment_boots': '118',
  }, 'detailed', 'compact');
  assert.equal(values['target-equipment_resonance'], '118');
  assert.equal(minimumFilledValue(['', '0', '2']), '0');
  assert.equal(minimumFilledValue(['', '']), '');
});

test('element targets expand to groups of four relics', () => {
  const values = Object.fromEntries(ELEMENT_TARGET_IDS.map((id, index) => [id, String(index + 1)]));
  assert.deepEqual(expandElementsToRelics(values).slice(4, 8), ['2', '2', '2', '2']);
  assert.equal(expandElementsToRelics(values).length, 20);
});

test('individual relics reduce to group minima', () => {
  const relics = Array.from({ length: 20 }, (_, index) => index === 5 ? '' : String(index + 1));
  const values = reduceRelicsToElements(relics);
  assert.equal(values['target-relic-element-2'], '5');
  assert.equal(Object.keys(values).length, 5);
});

test('detailed relic mode conversion preserves zero and four-slot grouping', () => {
  const values = convertRelicLayout({ 'target-relic-element-2': '0' }, 'element', 'individual');
  assert.deepEqual(RELIC_TARGET_IDS.slice(4, 8).map((id) => values[id]), ['0', '0', '0', '0']);
  const reduced = convertRelicLayout(values, 'individual', 'element');
  assert.equal(reduced['target-relic-element-2'], '0');
});

test('normalized compact targets always contain twenty relic slots', () => {
  const targets = normalizeTargetValues({ 'target-equipment_resonance': '100', 'target-relic_resonance': '20' });
  assert.equal(targets.equipment.equipment_main_weapon, 100);
  assert.equal(targets.relics.length, 20);
  assert.equal(targets.relics.every((value) => value === 20), true);
  assert.equal(SKILL_TARGET_IDS.length, 8);
  assert.equal(PET_TARGET_IDS.length, 4);
});
