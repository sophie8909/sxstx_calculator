import { costKeyToMaterialId, findLastIndexByLevel } from '../utils/format.js';

export function normalizeKey(key) {
  return key ? String(key).replace(/^\uFEFF/, '').trim() : key;
}

export function buildCumulativeCostData(gameData) {
  const tables = {
    character: gameData.characterUpgradeCosts,
    equipment: gameData.equipmentUpgradeCosts,
    skill: gameData.skillUpgradeCosts,
    relic: gameData.relicUpgradeCosts,
    pet: gameData.petUpgradeCosts,
  };
  const output = {};

  Object.entries(tables).forEach(([type, source]) => {
    output[type] = [];
    if (!source || source.length === 0) return;

    const firstRow = source[0];
    const costKeys = Object.keys(firstRow)
      .map((key) => normalizeKey(key))
      .filter((key) => /^cost_/.test(String(key).toLowerCase()));
    const cumulative = {};
    costKeys.forEach((key) => {
      cumulative[key] = 0;
    });

    source.forEach((rawRow) => {
      const row = {};
      Object.keys(rawRow).forEach((key) => {
        row[normalizeKey(key).toLowerCase()] = rawRow[key];
      });

      const level = Number(row.level ?? row['等級'] ?? row.lvl ?? 0);
      costKeys.forEach((key) => {
        const normalized = key.toLowerCase();
        const value = Number(row[normalized] ?? 0);
        cumulative[normalized] = (cumulative[normalized] || 0) + (Number.isFinite(value) ? value : 0);
      });
      output[type].push({ level, ...cumulative });
    });
  });

  return output;
}

export function getCumulative(costTable, level) {
  const empty = {};
  if (!costTable || costTable.length === 0) return empty;
  costTable.forEach((row) => Object.keys(row).forEach((key) => {
    empty[key] = 0;
  }));
  delete empty.level;
  if (level <= 0) return empty;

  const index = findLastIndexByLevel(costTable, level);
  return index !== -1 ? { ...empty, ...costTable[index] } : empty;
}

export function getCharacterCumulativeExpFromTable(table, level) {
  if (!table || !table.length || level <= 0) return 0;

  const maxLevelInTable = table[table.length - 1]?.level || 0;
  if (level <= maxLevelInTable) {
    return getCumulative(table, level).cost_exp || 0;
  }

  const lastKnownExp = getCumulative(table, maxLevelInTable).cost_exp || 0;
  const previousKnownExp = getCumulative(table, maxLevelInTable - 1).cost_exp || 0;
  const lastLevelExp = Math.max(0, lastKnownExp - previousKnownExp);
  return lastKnownExp + lastLevelExp * (level - maxLevelInTable);
}

export function getCostDelta(costTable, currentLevel, targetLevel) {
  if (!costTable) return {};

  const start = getCumulative(costTable, currentLevel - 1);
  const end = getCumulative(costTable, targetLevel - 1);
  const delta = {};

  Object.keys(end).forEach((key) => {
    if (!key.startsWith('cost_')) return;
    const materialId = costKeyToMaterialId(key);
    delta[materialId] = (end[key] || 0) - (start[key] || 0);
  });

  return delta;
}

export function findMissingUpgradeLevel(sourceTable, currentLevel, targetLevel) {
  if (!sourceTable || sourceTable.length === 0) return null;

  const levels = new Set(
    sourceTable
      .map((row) => Number(row.level))
      .filter((value) => Number.isFinite(value) && value >= 0)
  );
  if (levels.size === 0) return null;

  const start = Math.max(0, Math.floor(Number(currentLevel) || 0));
  const end = Math.max(start, Math.floor(Number(targetLevel) || 0));
  const minLevel = Math.min(...Array.from(levels));
  const effectiveStart = Math.max(start, minLevel);

  if (effectiveStart >= end) return null;

  for (let level = effectiveStart; level < end; level += 1) {
    if (!levels.has(level)) return level;
  }
  return null;
}
