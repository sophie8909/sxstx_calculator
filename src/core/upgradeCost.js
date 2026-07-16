import { costKeyToMaterialId } from '../utils/format.js';

export function normalizeKey(key) {
  return key ? String(key).replace(/^\uFEFF/, '').trim() : key;
}

function readLevelFromRow(normalizedRow, rawRow) {
  const direct = Number(normalizedRow.level ?? normalizedRow.lvl ?? 0);
  if (Number.isFinite(direct)) return direct;

  const nonCostCandidates = Object.entries(normalizedRow).filter(
    ([key, value]) => !key.startsWith('cost_') && Number.isFinite(Number(value))
  );
  if (nonCostCandidates.length > 0) return Number(nonCostCandidates[0][1]) || 0;

  const rawCandidates = Object.entries(rawRow || {}).filter(
    ([key, value]) => !normalizeKey(key).toLowerCase().startsWith('cost_') && Number.isFinite(Number(value))
  );
  if (rawCandidates.length > 0) return Number(rawCandidates[0][1]) || 0;

  return 0;
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

    const sourceRows = type === 'character'
      ? source.filter((rawRow) => {
        const costExp = Number(rawRow?.cost_exp);
        return Number.isFinite(costExp) && costExp > 0;
      })
      : source;
    if (sourceRows.length === 0) return;

    const firstRow = sourceRows[0];
    const costKeys = Object.keys(firstRow)
      .map((key) => normalizeKey(key))
      .filter((key) => /^cost_/.test(String(key).toLowerCase()));
    const cumulative = {};
    costKeys.forEach((key) => {
      cumulative[key] = 0;
    });

    sourceRows.forEach((rawRow) => {
      const row = {};
      Object.keys(rawRow).forEach((key) => {
        row[normalizeKey(key).toLowerCase()] = rawRow[key];
      });

      const level = readLevelFromRow(row, rawRow);
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

function getTableTemplate(costTable) {
  const empty = {};
  if (!costTable || costTable.length === 0) return empty;

  costTable.forEach((row) => {
    Object.keys(row).forEach((key) => {
      empty[key] = 0;
    });
  });
  delete empty.level;
  return empty;
}

function normalizeRange(range) {
  const from = Number(range?.from);
  const to = Number(range?.to);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return '';
  if (from === to) return `${from}-${to}`;
  return `${Math.min(from, to)}-${Math.max(from, to)}`;
}

function getCumulativeWithMeta(costTable, level, options = {}) {
  const template = getTableTemplate(costTable);
  if (!costTable || costTable.length === 0) return { row: template, estimatedRanges: [], exact: false };
  if (level <= 0) return { row: template, estimatedRanges: [], exact: true };

  const sorted = [...costTable].sort((a, b) => (Number(a.level) || 0) - (Number(b.level) || 0));
  const requestLevel = Number(level);
  const exact = sorted.find((row) => Number(row.level) === requestLevel);
  if (exact) {
    return { row: { ...template, ...exact }, estimatedRanges: [], exact: true };
  }

  let lower = null;
  let upper = null;
  for (let i = 0; i < sorted.length; i += 1) {
    const currentLevel = Number(sorted[i].level) || 0;
    if (currentLevel < requestLevel) {
      if (!lower || currentLevel > (Number(lower.level) || 0)) lower = sorted[i];
      continue;
    }
    if (currentLevel > requestLevel && !upper) upper = sorted[i];
    break;
  }

  if (!lower) return { row: template, estimatedRanges: [], exact: false };

  const lowerLevel = Number(lower.level) || 0;
  if (!upper) {
    if (sorted.length < 2) return { row: { ...template, ...lower }, estimatedRanges: [], exact: false };

    const secondLast = sorted[sorted.length - 2];
    const secondLastLevel = Number(secondLast.level) || 0;
    const span = lowerLevel - secondLastLevel;
    if (span === 0) return { row: { ...template, ...lower }, estimatedRanges: [], exact: false };

    const estimated = { ...template, ...lower };
    const range = { from: lowerLevel, to: requestLevel };
    Object.keys(template).forEach((key) => {
      const prev = Number(secondLast[key]) || 0;
      const last = Number(lower[key]) || 0;
      const deltaPerLevel = (last - prev) / span;
      estimated[key] = Math.max(0, Math.round(last + deltaPerLevel * (requestLevel - lowerLevel)));
    });
    return { row: estimated, estimatedRanges: options.trackRange ? [range] : [range], exact: false };
  }

  const upperLevel = Number(upper.level) || 0;
  const span = upperLevel - lowerLevel;
  if (span <= 0) return { row: { ...template, ...lower }, estimatedRanges: [], exact: false };

  const ratio = (requestLevel - lowerLevel) / span;
  const estimated = { ...template };
  const range = { from: lowerLevel, to: upperLevel };
  Object.keys(template).forEach((key) => {
    const lowerValue = Number(lower[key]) || 0;
    const upperValue = Number(upper[key]) || 0;
    estimated[key] = Math.max(0, Math.round(lowerValue + (upperValue - lowerValue) * ratio));
  });
  return { row: estimated, estimatedRanges: options.trackRange ? [range] : [range], exact: false };
}

export function getCumulative(costTable, level) {
  return getCumulativeWithMeta(costTable, level).row;
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
  if (!costTable) return { materials: {}, estimatedRanges: [] };

  const start = getCumulativeWithMeta(costTable, currentLevel - 1, { trackRange: true });
  const end = getCumulativeWithMeta(costTable, targetLevel - 1, { trackRange: true });
  const materials = {};
  const estimatedRangesMap = new Map();

  Object.keys(end.row).forEach((key) => {
    if (!key.startsWith('cost_')) return;
    const materialId = costKeyToMaterialId(key);
    const value = (end.row[key] || 0) - (start.row[key] || 0);
    if (value !== 0) materials[materialId] = value;
  });

  [start, end].forEach((info) => {
    info.estimatedRanges?.forEach((range) => {
      const rangeKey = normalizeRange(range);
      if (!rangeKey) return;
      if (!estimatedRangesMap.has(rangeKey)) estimatedRangesMap.set(rangeKey, range);
    });
  });

  return {
    materials,
    estimatedRanges: Array.from(estimatedRangesMap.values()),
  };
}

export function findMissingUpgradeLevel(sourceTable, currentLevel, targetLevel) {
  if (!sourceTable || sourceTable.length === 0) return null;

  const availableLevels = new Set(sourceTable
    .filter((row) => {
      if (!Object.prototype.hasOwnProperty.call(row, 'cost_exp')) return true;
      const costExp = Number(row.cost_exp);
      return Number.isFinite(costExp) && costExp > 0;
    })
    .map((row) => Number(row.level))
    .filter((value) => Number.isFinite(value)));
  if (availableLevels.size === 0) return null;

  const start = Math.max(0, Math.floor(Number(currentLevel) || 0));
  const end = Math.max(start, Math.floor(Number(targetLevel) || 0));
  if (end <= start) return null;

  for (let level = start; level < end; level += 1) {
    if (!availableLevels.has(level)) return level;
  }

  return null;
}
