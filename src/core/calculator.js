import {
  getCharacterCumulativeExpFromTable,
  getCostDelta,
} from './upgradeCost.js';
import { calculateRemainingExperience } from './experience.js';

function addMaterialDelta(target, delta) {
  Object.entries(delta).forEach(([materialId, value]) => {
    target[materialId] = (target[materialId] || 0) + value;
  });
}

function mergeEstimateHints(target, materials, estimatedRanges) {
  if (!Array.isArray(estimatedRanges) || estimatedRanges.length === 0) return;

  Object.keys(materials).forEach((materialId) => {
    if (!target[materialId]) target[materialId] = new Set();
    estimatedRanges.forEach((range) => {
      target[materialId].add(`${range.from}-${range.to}`);
    });
  });
}

export function calculateSeasonScore(targets, seasonScore, seasonId) {
  const cfg = seasonScore?.[seasonId];
  if (!cfg) return 0;

  const seasonLevel = cfg.season_level || 100;
  let score = 0;

  if (targets.character > seasonLevel) {
    score += (targets.character - seasonLevel) * cfg.character_level_score;
  }
  if (targets.equipment_resonance > seasonLevel) {
    score += (targets.equipment_resonance - seasonLevel) * cfg.equipment_level_score * 5;
  }
  if (targets.skill_resonance > seasonLevel) {
    score += (targets.skill_resonance - seasonLevel) * cfg.skill_level_score * 8;
  }
  if (targets.pet_resonance > seasonLevel) {
    score += (targets.pet_resonance - seasonLevel) * cfg.pet_level_score * 4;
  }
  if (targets.relic_resonance > seasonLevel / 10) {
    score += (targets.relic_resonance - seasonLevel / 10) * cfg.relic_level_score * 20;
  }

  return score;
}

export function convertPrimordialStar(score, seasonScore, seasonId) {
  const cfg = seasonScore?.[seasonId];
  if (!cfg) return 0;
  return Math.floor(score / cfg.star_convert + cfg.star_basis);
}

export function getNextDailyResetTimestamp(fromTs = Date.now()) {
  const resetAt = new Date(fromTs);
  resetAt.setHours(8, 0, 0, 0);
  if (fromTs >= resetAt.getTime()) {
    resetAt.setDate(resetAt.getDate() + 1);
  }
  return resetAt.getTime();
}

export function countAvailableFreeSpeedupsUntil(targetTs, freeUsedToday, nowTs = Date.now()) {
  if (!Number.isFinite(targetTs) || targetTs <= nowTs) return 0;

  const firstResetTs = getNextDailyResetTimestamp(nowTs);
  const futureResetUses = targetTs >= firstResetTs
    ? Math.floor((targetTs - firstResetTs) / 86400000) + 1
    : 0;
  return (freeUsedToday ? 0 : 1) + Math.max(0, futureResetUses);
}

export function getSpeedupHoursForDays(dayCount, speedupState = {}, hoursPerUse = 2) {
  const normalizedDays = Math.max(0, Math.ceil(Number(dayCount) || 0));
  if (normalizedDays <= 0) return 0;

  const freeUses = Math.max(0, normalizedDays - (speedupState.freeUsedToday ? 1 : 0));
  const stoneCount = Math.max(0, Math.floor(Number(speedupState.stoneCount) || 0));
  return (freeUses + stoneCount) * hoursPerUse;
}

export function getSpeedupHoursForHours(hours, speedupState = {}, hoursPerUse = 2) {
  const normalizedHours = Math.max(0, Number(hours) || 0);
  const dayCount = normalizedHours > 0 ? Math.ceil(normalizedHours / 24) : 0;
  return getSpeedupHoursForDays(dayCount, speedupState, hoursPerUse);
}

export function getDynamicSpeedupHoursForEta(targetTs, speedupState = {}, nowTs = Date.now(), hoursPerUse = 2) {
  const freeUses = countAvailableFreeSpeedupsUntil(targetTs, !!speedupState.freeUsedToday, nowTs);
  const stoneCount = Math.max(0, Math.floor(Number(speedupState.stoneCount) || 0));
  return (freeUses + stoneCount) * hoursPerUse;
}

export function computeReachableCharacterLevel({
  cumulativeCostData,
  currentLevel,
  ownedExp,
  bedExpHourly,
  targetTime,
  speedupState,
  speedupHoursPerUse = 2,
  now = Date.now(),
}) {
  const table = cumulativeCostData.character;
  if (!table || !table.length || !Number.isFinite(currentLevel)) return currentLevel;

  const normalizedCurrentLevel = Math.max(0, Math.floor(Number(currentLevel) || 0));
  const hours = targetTime
    ? Math.max(0, (new Date(targetTime).getTime() - now) / 36e5)
    : 0;
  const bonusHours = getSpeedupHoursForHours(hours, speedupState, speedupHoursPerUse);
  // The character's current-level base is the experience needed to reach
  // level L, which ends at transition row L - 1.
  const baseCum = getCharacterCumulativeExpFromTable(table, normalizedCurrentLevel - 1);
  const available =
    Math.max(0, Number(ownedExp) || 0) +
    Math.max(0, Number(bedExpHourly) || 0) * (hours + bonusHours);
  const totalExp = baseCum + available;
  const index = table.findLastIndex((row) => (row.cost_exp || 0) <= totalExp);
  // A cumulative row L represents the start of level L + 1.
  let reachable = index !== -1 ? table[index].level + 1 : currentLevel;
  const maxLevelInTable = table[table.length - 1]?.level ?? currentLevel;
  const maxKnownExp = getCharacterCumulativeExpFromTable(table, maxLevelInTable);
  const previousKnownExp = getCharacterCumulativeExpFromTable(table, maxLevelInTable - 1);
  const lastLevelExp = Math.max(0, maxKnownExp - previousKnownExp);

  if (totalExp >= maxKnownExp && lastLevelExp > 0) {
    reachable = maxLevelInTable + 1 + Math.floor((totalExp - maxKnownExp) / lastLevelExp);
  }

  return Math.max(reachable, normalizedCurrentLevel);
}

export function expCalculation({
  cumulativeCostData,
  currentLevel,
  ownedExp,
  bedExpHourly,
  targetLevel,
  bonusHours = 0,
  now = Date.now(),
}) {
  const table = cumulativeCostData.character;
  if (!table || !table.length || !Number.isFinite(currentLevel)) {
    return { levelupTs: NaN, minutesNeeded: 0, expNeeded: NaN };
  }
  const normalizedCurrentLevel = Math.max(0, Math.floor(Number(currentLevel) || 0));
  const normalizedTargetLevel = Math.max(0, Math.floor(Number(targetLevel) || 0));
  if (normalizedTargetLevel <= normalizedCurrentLevel) {
    return { levelupTs: now, minutesNeeded: 0, expNeeded: 0, status: 'reached' };
  }

  // Target level T is reached after transition row T - 1. Do not use row T,
  // because row T is the cost from T to T + 1.
  const cumPrev = getCharacterCumulativeExpFromTable(table, normalizedCurrentLevel - 1);
  const cumThis = getCharacterCumulativeExpFromTable(table, normalizedTargetLevel - 1);
  const acceleratedExp = Math.max(0, Number(bedExpHourly) || 0) * Math.max(0, Number(bonusHours) || 0);
  const requiredExp = Math.max(0, cumThis - cumPrev);
  const expNeeded = calculateRemainingExperience(requiredExp, ownedExp + acceleratedExp);
  if (expNeeded <= 0) return { levelupTs: now, minutesNeeded: 0, expNeeded: 0 };

  const ratePerHour = Number(bedExpHourly);
  if (!Number.isFinite(ratePerHour) || ratePerHour <= 0) {
    return { levelupTs: NaN, minutesNeeded: 0, expNeeded };
  }

  const minutesNeeded = Math.ceil((expNeeded / ratePerHour) * 60);
  return {
    levelupTs: now + minutesNeeded * 60 * 1000,
    minutesNeeded,
    expNeeded,
  };
}

export function computeEtaToNextLevel({
  cumulativeCostData,
  currentLevel,
  ownedExp,
  bedExpHourly,
  bonusHours = 0,
  now = Date.now(),
}) {
  const { levelupTs, minutesNeeded, expNeeded } = expCalculation({
    cumulativeCostData,
    currentLevel,
    ownedExp,
    bedExpHourly,
    targetLevel: currentLevel + 1,
    bonusHours,
    now,
  });
  return { levelupTs, minutesNeeded, expNeeded };
}

export function computeEtaToTargetLevel({
  cumulativeCostData,
  currentLevel,
  ownedExp,
  bedExpHourly,
  targetLevel,
  bonusHours = 0,
  speedupState,
  speedupHoursPerUse = 2,
  now = Date.now(),
}) {
  let appliedBonusHours = Math.max(0, Number(bonusHours) || 0);
  let result = expCalculation({
    cumulativeCostData,
    currentLevel,
    ownedExp,
    bedExpHourly,
    targetLevel,
    bonusHours: appliedBonusHours,
    now,
  });

  for (let i = 0; i < 8; i += 1) {
    if (!Number.isFinite(result.levelupTs) || result.minutesNeeded <= 0) break;

    const nextBonusHours = getDynamicSpeedupHoursForEta(
      result.levelupTs,
      speedupState,
      now,
      speedupHoursPerUse
    );
    if (nextBonusHours === appliedBonusHours) break;

    appliedBonusHours = nextBonusHours;
    result = expCalculation({
      cumulativeCostData,
      currentLevel,
      ownedExp,
      bedExpHourly,
      targetLevel,
      bonusHours: appliedBonusHours,
      now,
    });
  }

  return {
    etaTs: result.levelupTs,
    minutesNeeded: result.minutesNeeded,
    needExp: result.expNeeded,
    bonusHours: appliedBonusHours,
  };
}

function getTargetForCategory(categoryId, targets) {
  if (categoryId === 'character') return targets.character || 0;
  if (categoryId.startsWith('equipment_')) return targets.equipment_resonance || 0;
  if (categoryId.startsWith('skill_')) return targets.skill_resonance || 0;
  if (categoryId.startsWith('pet')) return targets.pet_resonance || 0;
  return 0;
}

function getCategoryCostConfig(categoryId, gameData, cumulativeCostData, labels) {
  if (categoryId.startsWith('equipment_')) {
    return {
      costTable: cumulativeCostData.equipment,
      sourceTable: gameData.equipmentUpgradeCosts,
      itemName: labels.equipment,
      affected: ['stoneOre', 'rola', 'refiningStone'],
    };
  }
  if (categoryId.startsWith('skill_')) {
    return {
      costTable: cumulativeCostData.skill,
      sourceTable: gameData.skillUpgradeCosts,
      itemName: labels.skill,
      affected: ['essence'],
    };
  }
  if (categoryId.startsWith('pet')) {
    return {
      costTable: cumulativeCostData.pet,
      sourceTable: gameData.petUpgradeCosts,
      itemName: labels.pet,
      affected: ['freezeDried'],
    };
  }
  return {
    costTable: cumulativeCostData[categoryId],
    sourceTable: gameData.characterUpgradeCosts,
    itemName: labels.character,
    affected: ['exp'],
  };
}

export function calculateUpgradeResults(input, context) {
  const required = {};
  const gains = {};
  const deficit = {};
  const materialErrors = {};
  const estimated = {};
  let hasError = false;
  let hasInput = false;

  const {
    categories,
    cumulativeCostData,
    gameData,
    materials,
    productionSources,
    relicCountRequired,
    seasonId,
    seasonScore,
    speedupHoursPerUse,
  } = context;
  const {
    bedProgress,
    categoryCurrentLevels,
    materialSourceGains,
    ownedMaterials,
    primordial,
    productionHourly,
    relicDistribution,
    speedupState,
    targets,
  } = input;
  const now = input.now ?? Date.now();

  const targetHours = bedProgress.targetTime
    ? Math.max(0, (new Date(bedProgress.targetTime).getTime() - now) / 36e5)
    : 0;
  const targetBonusHours = getSpeedupHoursForHours(targetHours, speedupState, speedupHoursPerUse);
  const reachableLevel = computeReachableCharacterLevel({
    cumulativeCostData,
    currentLevel: bedProgress.currentLevel,
    ownedExp: bedProgress.ownedExp,
    bedExpHourly: bedProgress.bedExpHourly,
    targetTime: bedProgress.targetTime,
    speedupState,
    speedupHoursPerUse,
    now,
  });
  const score = calculateSeasonScore(targets, seasonScore, seasonId);
  const primordialStar = convertPrimordialStar(score, seasonScore, seasonId);
  const primordialStarTotal = (primordial.accumulated || 0) + primordialStar;

  let relicCount = 0;
  relicDistribution.forEach(({ level, count }) => {
    const currentLevel = Number(level) || 0;
    if (count > 0) hasInput = true;
    relicCount += count;

    for (let index = 0; index < count; index += 1) {
      const targetLevel = Math.max(currentLevel, targets.relic_resonance || 0);
      if (targetLevel <= currentLevel) continue;

      const { materials: delta, estimatedRanges } = getCostDelta(cumulativeCostData.relic, currentLevel, targetLevel);
      addMaterialDelta(required, delta);
      mergeEstimateHints(estimated, delta, estimatedRanges);
    }
  });
  if (relicCount > 0 && relicCount !== relicCountRequired) hasError = true;

  categories.forEach((category) => {
    const currentLevel = categoryCurrentLevels[category.id] || 0;
    if (currentLevel > 0) hasInput = true;

    const targetLevel = Math.max(currentLevel, getTargetForCategory(category.id, targets));
    if (targetLevel <= currentLevel) return;

    const costConfig = getCategoryCostConfig(
      category.id,
      gameData,
      cumulativeCostData,
      context.labels
    );

    const { materials: delta, estimatedRanges } = getCostDelta(costConfig.costTable, currentLevel, targetLevel);
    addMaterialDelta(required, delta);
    mergeEstimateHints(estimated, delta, estimatedRanges);
  });

  Object.entries(materialSourceGains || {}).forEach(([materialId, total]) => {
    if (total > 0) {
      gains[materialId] = (gains[materialId] || 0) + total;
      hasInput = true;
    }
  });

  const derived = {
    reachableLevel,
    seasonScore: score,
    primordialStar,
    primordialStarTotal,
  };

  if (hasError) return { error: context.messages.relicCountError, derived };
  if (!hasInput) return { required: {}, gains: {}, deficit: {}, materialErrors, derived };

  if (bedProgress.targetTime) {
    const hours = targetHours + targetBonusHours;
    Object.entries(productionSources).forEach(([sourceId, source]) => {
      const hourly = productionHourly[sourceId] || 0;
      const materialId = source.materialId;
      gains[materialId] = (gains[materialId] || 0) + Math.floor(hourly * hours);
    });
    if (bedProgress.bedExpHourly > 0) {
      gains.exp = (gains.exp || 0) + Math.floor(bedProgress.bedExpHourly * hours);
    }
  }

  Object.keys(materials).forEach((materialId) => {
    const need = required[materialId] || 0;
    const owned = ownedMaterials[materialId] || 0;
    const gain = gains[materialId] || 0;
    deficit[materialId] = Math.max(0, need - owned - gain);
  });

  return { required, gains, deficit, materialErrors, estimated, derived };
}
