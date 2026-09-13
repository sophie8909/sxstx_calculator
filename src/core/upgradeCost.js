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

    const costKeys = Array.from(new Set(sourceRows.flatMap((rawRow) => Object.keys(rawRow)
      .map((key) => normalizeKey(key).toLowerCase())
      .filter((key) => /^cost_/.test(String(key))))));
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
      const costAvailability = {};
      const costValues = {};
      costKeys.forEach((key) => {
        const value = Number(row[key]);
        const available = Number.isFinite(value) && value > 0;
        cumulative[key] = (cumulative[key] || 0) + (available ? value : 0);
        costAvailability[key] = available;
        costValues[key] = available ? value : null;
      });
      output[type].push({ level, ...cumulative, __costAvailability: costAvailability, __costValues: costValues });
    });
  });

  return output;
}

function getTableTemplate(costTable) {
  const empty = {};
  if (!costTable || costTable.length === 0) return empty;

  costTable.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!key.startsWith('__')) empty[key] = 0;
    });
  });
  delete empty.level;
  return empty;
}

function normalizeRange(range) {
  const from = Number(range?.from);
  const to = Number(range?.to);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return '';
  return `${Math.min(from, to)}-${Math.max(from, to)}`;
}

function getCumulativeWithMeta(costTable, level) {
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
    return { row: estimated, estimatedRanges: [range], exact: false };
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
  return { row: estimated, estimatedRanges: [range], exact: false };
}

export function getCumulative(costTable, level) {
  return getCumulativeWithMeta(costTable, level).row;
}

export function getCharacterCumulativeExpFromTable(table, level) {
  // Character rows describe transitions: row L is the cost from L to L + 1.
  // This helper returns C(L), the sum through transition row L.
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

function compactRanges(levels) {
  if (!levels.length) return [];
  const sorted = [...new Set(levels)].sort((a, b) => a - b);
  const ranges = [];
  let from = sorted[0];
  let to = from;
  sorted.slice(1).forEach((level) => {
    if (level === to + 1) { to = level; return; }
    ranges.push({ from, to });
    from = level;
    to = level;
  });
  ranges.push({ from, to });
  return ranges;
}

function getMissingMaterialRanges(costTable, currentLevel, targetLevel, expectedMaterials) {
  if (!expectedMaterials.length || targetLevel <= currentLevel) return {};
  const rows = Array.isArray(costTable) ? costTable : [];
  const tracksAvailability = rows.some((row) => row && row.__costAvailability);
  if (!tracksAvailability) {
    if (rows.length) return {};
    return Object.fromEntries(expectedMaterials.map((materialId) => [materialId, [{ from: currentLevel, to: targetLevel - 1 }]]));
  }
  const rowsByLevel = new Map(rows.map((row) => [Number(row.level), row]));
  const keysByMaterial = new Map();
  rows.forEach((row) => Object.keys(row.__costAvailability || {}).forEach((key) => {
    const materialId = costKeyToMaterialId(key);
    if (!keysByMaterial.has(materialId)) keysByMaterial.set(materialId, key);
  }));
  return Object.fromEntries(expectedMaterials.map((materialId) => {
    const key = keysByMaterial.get(materialId);
    const missingLevels = [];
    for (let level = currentLevel; level < targetLevel; level += 1) {
      const row = rowsByLevel.get(level);
      if (!row || !key || row.__costAvailability[key] !== true) missingLevels.push(level);
    }
    return [materialId, compactRanges(missingLevels)];
  }).filter(([, ranges]) => ranges.length));
}

export function getCostDelta(costTable, currentLevel, targetLevel, { expectedMaterials = [] } = {}) {
  const startLevel = Math.max(0, Math.floor(Number(currentLevel) || 0));
  const endLevel = Math.max(startLevel, Math.floor(Number(targetLevel) || 0));
  if (endLevel <= startLevel) return { materials: {}, estimatedRanges: [] };
  const missingMaterials = getMissingMaterialRanges(costTable, startLevel, endLevel, expectedMaterials);
  if (!costTable) return { materials: {}, estimatedRanges: [], ...(Object.keys(missingMaterials).length ? { missingMaterials } : {}) };
  if (costTable.some((row) => row.__costValues)) {
    const materials = {};
    costTable.filter((row) => row.level >= startLevel && row.level < endLevel).forEach((row) => {
      Object.entries(row.__costValues || {}).forEach(([key, value]) => {
        const materialId = costKeyToMaterialId(key);
        if (missingMaterials[materialId] || (expectedMaterials.length && !expectedMaterials.includes(materialId))) return;
        if (value !== null) materials[materialId] = (materials[materialId] || 0) + value;
      });
    });
    return { materials, estimatedRanges: [], ...(Object.keys(missingMaterials).length ? { missingMaterials } : {}) };
  }
  const start = getCumulativeWithMeta(costTable, startLevel - 1);
  const end = getCumulativeWithMeta(costTable, endLevel - 1);
  const materials = {};
  const estimatedRangesMap = new Map();
  Object.keys(end.row).forEach((key) => {
    if (!key.startsWith('cost_')) return;
    const materialId = costKeyToMaterialId(key);
    if (missingMaterials[materialId]) return;
    const value = (end.row[key] || 0) - (start.row[key] || 0);
    if (value !== 0) materials[materialId] = value;
  });
  [start, end].forEach((info) => info.estimatedRanges.forEach((range) => {
    const rangeKey = normalizeRange(range);
    if (rangeKey && !estimatedRangesMap.has(rangeKey)) estimatedRangesMap.set(rangeKey, range);
  }));
  return { materials, estimatedRanges: Array.from(estimatedRangesMap.values()), ...(Object.keys(missingMaterials).length ? { missingMaterials } : {}) };
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
