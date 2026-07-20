export const EQUIPMENT_TARGET_IDS = [
  'target-equipment_main_weapon', 'target-equipment_off_weapon', 'target-equipment_helmet',
  'target-equipment_armor', 'target-equipment_boots',
];
export const SKILL_TARGET_IDS = [
  'target-skill_combat1', 'target-skill_combat2', 'target-skill_combat3', 'target-skill_combat4',
  'target-skill_arcane1', 'target-skill_arcane2', 'target-skill_arcane3', 'target-skill_arcane4',
];
export const PET_TARGET_IDS = ['target-pet1', 'target-pet2', 'target-pet3', 'target-pet4'];
export const ELEMENT_TARGET_IDS = Array.from({ length: 5 }, (_, i) => 'target-relic-element-' + (i + 1));
export const RELIC_TARGET_IDS = Array.from({ length: 20 }, (_, i) => 'target-relic-' + (i + 1));

export function isFilledValue(value) {
  return value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
}

export function copyFilledValue(value, ids, values) {
  if (!isFilledValue(value)) return values;
  ids.forEach((id) => { if (!isFilledValue(values[id])) values[id] = String(value); });
  return values;
}

export function minimumFilledValue(values) {
  const numbers = values.filter(isFilledValue).map(Number);
  return numbers.length ? String(Math.min(...numbers)) : '';
}

export function expandElementsToRelics(elements) {
  return ELEMENT_TARGET_IDS.flatMap((id) => Array(4).fill(elements[id] ?? ''));
}

export function reduceRelicsToElements(relics) {
  return ELEMENT_TARGET_IDS.reduce((result, id, index) => {
    result[id] = minimumFilledValue(relics.slice(index * 4, index * 4 + 4));
    return result;
  }, {});
}

export function normalizeTargetValues(values = {}, layoutMode = 'compact', relicMode = 'element') {
  const read = (id) => isFilledValue(values[id]) ? Number(values[id]) : null;
  const readValue = (value) => isFilledValue(value) ? Number(value) : null;
  const equipment = layoutMode === 'compact'
    ? Object.fromEntries(EQUIPMENT_TARGET_IDS.map((id) => [id.replace('target-', ''), readValue(values['target-equipment_resonance'])]))
    : Object.fromEntries(EQUIPMENT_TARGET_IDS.map((id) => [id.replace('target-', ''), readValue(values[id])]));
  const skills = layoutMode === 'compact'
    ? Object.fromEntries(SKILL_TARGET_IDS.map((id) => [id.replace('target-', ''), readValue(values['target-skill_resonance'])]))
    : Object.fromEntries(SKILL_TARGET_IDS.map((id) => [id.replace('target-', ''), readValue(values[id])]));
  const pets = layoutMode === 'compact'
    ? Object.fromEntries(PET_TARGET_IDS.map((id) => [id.replace('target-', ''), readValue(values['target-pet_resonance'])]))
    : Object.fromEntries(PET_TARGET_IDS.map((id) => [id.replace('target-', ''), readValue(values[id])]));
  let relics;
  if (layoutMode === 'compact') relics = Array(20).fill(readValue(values['target-relic_resonance']));
  else if (relicMode === 'individual') relics = RELIC_TARGET_IDS.map((id) => readValue(values[id]));
  else relics = expandElementsToRelics(Object.fromEntries(ELEMENT_TARGET_IDS.map((id) => [id, values[id] ?? '']))).map((value) => isFilledValue(value) ? Number(value) : null);
  return { character: read('target-character'), equipment, skills, pets, relics };
}

export function convertTargetLayout(values, fromMode, toMode, relicMode = 'element') {
  const next = { ...values };
  const fill = (source, ids) => { if (isFilledValue(source)) ids.forEach((id) => { next[id] = String(source); }); };
  const reduce = (ids, compactId) => { next[compactId] = minimumFilledValue(ids.map((id) => next[id] ?? '')); };
  if (fromMode === 'compact' && toMode === 'detailed') {
    fill(values['target-equipment_resonance'], EQUIPMENT_TARGET_IDS);
    fill(values['target-skill_resonance'], SKILL_TARGET_IDS);
    fill(values['target-pet_resonance'], PET_TARGET_IDS);
    if (relicMode === 'individual') fill(values['target-relic_resonance'], RELIC_TARGET_IDS);
    else fill(values['target-relic_resonance'], ELEMENT_TARGET_IDS);
  }
  if (fromMode === 'detailed' && toMode === 'compact') {
    reduce(EQUIPMENT_TARGET_IDS, 'target-equipment_resonance');
    reduce(SKILL_TARGET_IDS, 'target-skill_resonance');
    reduce(PET_TARGET_IDS, 'target-pet_resonance');
    reduce(relicMode === 'individual' ? RELIC_TARGET_IDS : ELEMENT_TARGET_IDS, 'target-relic_resonance');
  }
  return next;
}

export function convertRelicLayout(values, fromMode, toMode) {
  const next = { ...values };
  if (fromMode === 'element' && toMode === 'individual') {
    ELEMENT_TARGET_IDS.forEach((id, index) => {
      if (isFilledValue(values[id])) RELIC_TARGET_IDS.slice(index * 4, index * 4 + 4).forEach((relicId) => { next[relicId] = String(values[id]); });
    });
  } else if (fromMode === 'individual' && toMode === 'element') {
    Object.assign(next, reduceRelicsToElements(RELIC_TARGET_IDS.map((id) => values[id] ?? '')));
  }
  return next;
}
