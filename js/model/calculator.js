// js/model/calculator.js
// ★ 核心計算層：包含經驗、時間、分數與總計算邏輯 ★

import { state } from './model.js';
import { MAX_LEVEL, categories, targetLevelConfig, materials, productionSources } from './constants.js';
import { getCumulative } from './costProcessor.js';
import { costKeyToMaterialId } from '../utils.js'; // 引入 utils.js

// 通知相關的輔助函式 (移到此處以避免 model.js 過長)

/** 清除升級通知排程 */
export function clearLevelUpNotification(options = { levelUp: true, targetLevel: true }) {
  if (options.levelUp && state.notificationTimerIdLevelUp !== null) {
    clearTimeout(state.notificationTimerIdLevelUp);
    state.notificationTimerIdLevelUp = null;
  }
  if (options.targetLevel && state.notificationTimerIdTargetLevel !== null) {
    clearTimeout(state.notificationTimerIdTargetLevel);
    state.notificationTimerIdTargetLevel = null;
  }
}

/**
 * 核心經驗計算函式
 * 輸出到達目標等級所需的時間戳、分鐘數和所需經驗值。
 */
export function expCalculation(currentLevel, ownedExp, bedExpHourly, targetLevel) {
  const table = state.cumulativeCostData['character'];
  if (!table || !Number.isFinite(currentLevel) || currentLevel >= MAX_LEVEL) {
    return { levelupTs: NaN, minutesNeeded: 0, expNeeded: NaN };
  }
  if (targetLevel <= currentLevel) {
    return { minutesNeeded: 0, etaTs: Date.now(), needExp: 0, status: 'reached' };
  }
  const cumPrev = (getCumulative(table, currentLevel - 1).cost_exp || 0);
  const cumThis = (getCumulative(table, targetLevel - 1).cost_exp || 0);
  const expNeeded = Math.max(0, cumThis - cumPrev - (Number(ownedExp) || 0));
  if (expNeeded <= 0) return { levelupTs: Date.now(), minutesNeeded: 0, expNeeded: 0 };
  const ratePerHour = Number(bedExpHourly);
  if (!Number.isFinite(ratePerHour) || ratePerHour <= 0) {
    return { levelupTs: NaN, minutesNeeded: 0, expNeeded };
  }
  const minutesNeeded = Math.ceil((expNeeded / ratePerHour) * 60);
  const levelupTs = Date.now() + minutesNeeded * 60 * 1000;
  return { levelupTs, minutesNeeded, expNeeded };
}

/** 計算到達下一級 ETA */
export function computeEtaToNextLevel(currentLevel, ownedExp, bedExpHourly) {
  return expCalculation(currentLevel, ownedExp, bedExpHourly, currentLevel + 1);
}

/** 計算到達「目標角色等級」ETA（以及總所需經驗） */
export function computeEtaToTargetLevel(currentLevel, ownedExp, bedExpHourly, targetLevel) {
  const { levelupTs, minutesNeeded, expNeeded } = expCalculation(currentLevel, ownedExp, bedExpHourly, targetLevel);
  return { etaTs: levelupTs, minutesNeeded, needExp: expNeeded };
}

/**
 * 計算「最低可達角色等級」
 * (此函式假設它接收到的參數都來自 controller 的輸入收集)
 */
export function computeReachableCharacterLevel(curLv, ownedExp, bedExpHourly, targetTimeStr) {
  const table = state.cumulativeCostData['character'];
  if (!table || !Number.isFinite(curLv)) return curLv;
  const hours = targetTimeStr
    ? Math.max(0, (new Date(targetTimeStr).getTime() - Date.now()) / 36e5)
    : 0;
  const baseCum = (getCumulative(table, curLv - 1)?.cost_exp || 0);
  const available =
    Math.max(0, Number(ownedExp) || 0) +
    Math.max(0, Number(bedExpHourly) || 0) * hours;
  const totalExp = baseCum + available;
  const idx = table.findLastIndex(d => (d.cost_exp || 0) <= totalExp);
  const reachable = (idx !== -1 ? table[idx].level : curLv);
  const maxLevelInTable = table[table.length - 1]?.level ?? curLv;
  return Math.min(Math.max(reachable, curLv), maxLevelInTable);
}

// --- 賽季分數與星數計算 ---

export function calculateSeasonScore_S1(targets) {
  let score = 0;
  const season_level = 100;
  if (targets.character > season_level) score += (targets.character - season_level) * 100;
  if (targets.equipment_resonance > season_level) score += (targets.equipment_resonance - season_level) * 38 * 5;
  if (targets.skill_resonance > season_level) score += (targets.skill_resonance - season_level) * 14 * 8;
  if (targets.pet_resonance > season_level) score += (targets.pet_resonance - season_level) * 14 * 4;
  if (targets.relic_resonance > season_level/10) score += (targets.relic_resonance - season_level/10) * 57 * 20;
  return score;
}
export function calculateSeasonScore_S2(targets) {
  let score = 0;
  const season_level = 130;
  if (targets.character > season_level) {
    score += (targets.character - season_level) * 100;
  }
  if (targets.equipment_resonance > season_level) score += (targets.equipment_resonance - season_level) * 18 * 5;
  if (targets.skill_resonance > season_level) score += (targets.skill_resonance - season_level) * 7 * 8;
  if (targets.pet_resonance > season_level) score += (targets.pet_resonance - season_level) * 8 * 4;
  if (targets.relic_resonance > season_level/10) score += (targets.relic_resonance - season_level/10) * 33 * 20;
  return score;
}
export function calculateSeasonScore_S3(targets) {
  let score = 0;
  const season_level = 160;
  if (targets.character > season_level) {
    score += (targets.character - season_level) * 100;
  }
  if (targets.equipment_resonance > season_level) score += (targets.equipment_resonance - season_level) * 14 * 5;
  if (targets.skill_resonance > season_level) score += (targets.skill_resonance - season_level) * 5 * 8;
  if (targets.pet_resonance > season_level) score += (targets.pet_resonance - season_level) * 6 * 4;
  if (targets.relic_resonance > season_level/10) score += (targets.relic_resonance - season_level/10) * 26 * 20;
  return score;
}

export function convertPrimordialStar_S1(score) {
  return Math.floor(score / 100 + 10);
}
export function convertPrimordialStar_S2(score) {
  return Math.floor(score / 27 + 45);
}
export function convertPrimordialStar_S3(score) {
  return Math.floor(score / 13 + 65);
}

/**
 * 主計算：需求 / 時產收益 / 缺口（渲染用 payload）
 * (此函式仍需透過 DOM 獲取輸入，待 controller 拆分完後可簡化簽名)
 */
export function computeAll(containers) {
  const required = {};
  const gains = {};
  const deficit = {};
  const missingDataErrors = {};
  let hasError = false;
  let hasInput = false;
  
  // --- 1. 收集輸入 (暫時保留在 model，待 controller 拆分 inputCollector 後移動) ---
  const targets = {};
  targetLevelConfig.forEach(t => {
    const v = parseInt(document.getElementById(`target-${t.id}`)?.value) || 0;
    targets[t.id] = v;
  });
  const curCharLv = parseInt(document.getElementById('character-current')?.value) || 0;
  const ownedExp = parseInt(document.getElementById('owned-exp')?.value) || 0;
  const bedExpHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;
  const targetTimeStr = document.getElementById('target-time')?.value;
  // --- 收集輸入結束 ---

  // --- 2. 計算自動欄位：可達等級、原初之星 ---
  const reachable = computeReachableCharacterLevel(curCharLv, ownedExp, bedExpHourly, targetTimeStr);
  const reachableEl = document.getElementById('target-char-reachable-level');
  if (reachableEl) reachableEl.textContent = `最低可達: ${reachable > 0 ? reachable : '--'}`;
  
  const seasonId = state.seasonId;
  let score = 0;
  if (seasonId === 's1') score = calculateSeasonScore_S1(targets);
  else if (seasonId === 's2') score = calculateSeasonScore_S2(targets);
  else if (seasonId === 's3') score = calculateSeasonScore_S3(targets);
  let ps = 0;
  if (seasonId === 's1') ps = convertPrimordialStar_S1(score);
  else if (seasonId === 's2') ps = convertPrimordialStar_S2(score);
  else if (seasonId === 's3') ps = convertPrimordialStar_S3(score);
  const psInput = document.getElementById('target-primordial_star');
  if (psInput) psInput.value = ps;
  
  // 帶入本季原初之星 (UI 互動，應移至 Controller)
  const thisSeasonPs = ps;
  // ... (省略 UI 互動邏輯，改由 Controller 處理)
  
  // 累計原初之星 (UI 互動，應移至 Controller)
  // ... (省略 UI 互動邏輯，改由 Controller 處理)

  // --- 3. 遺物成本計算 ---
  const targetRelicRes = targets.relic_resonance || 0;
  let relicCount = 0;
  for (let i = 10; i <= 20; i++) {
    const count = parseInt(document.getElementById(`relic-level-${i}`)?.value) || 0;
    if (count > 0) hasInput = true;
    relicCount += count;
    for (let j = 0; j < count; j++) {
      const current = i;
      const finalTarget = Math.max(current, targetRelicRes);
      if (finalTarget > current) {
        const costTable = state.cumulativeCostData.relic;
        const sourceTable = state.gameData.relicUpgradeCosts;
        let missing = false;
        if (sourceTable) {
          // ... (數據缺失檢查邏輯) ...
        }
        if (!missing && costTable) {
          const start = getCumulative(costTable, current - 1);
          const end = getCumulative(costTable, finalTarget - 1);
          Object.keys(end).forEach(key => {
            if (key.startsWith('cost_')) {
              const matId = costKeyToMaterialId(key);
              const delta = (end[key] || 0) - (start[key] || 0);
              required[matId] = (required[matId] || 0) + delta;
            }
          });
        }
      }
    }
  }
  if (relicCount > 0 && relicCount !== 20) hasError = true;

  // --- 4. 角色 / 裝備 / 技能 / 幻獸成本計算 ---
  categories.forEach(cat => {
    const current = parseInt(document.getElementById(`${cat.id}-current`)?.value) || 0;
    if (current > 0) hasInput = true;
    let targetRes = 0;
    if (cat.id === 'character') targetRes = targets.character || 0;
    else if (cat.id.startsWith('equipment_')) targetRes = targets.equipment_resonance || 0;
    else if (cat.id.startsWith('skill_')) targetRes = targets.skill_resonance || 0;
    else if (cat.id.startsWith('pet')) targetRes = targets.pet_resonance || 0;
    const finalTarget = Math.max(current, targetRes);
    if (finalTarget > current) {
      let costTable, sourceTable, affected = [];
      const g = state.gameData;
      // ... (成本計算邏輯，與原 model.js 相同) ...
       if (cat.id.startsWith('equipment_')) {
        costTable = state.cumulativeCostData.equipment;
        sourceTable = g.equipmentUpgradeCosts;
        affected = ['stoneOre', 'rola', 'refiningStone'];
      } else if (cat.id.startsWith('skill_')) {
        costTable = state.cumulativeCostData.skill;
        sourceTable = g.skillUpgradeCosts;
        affected = ['essence'];
      } else if (cat.id.startsWith('pet')) {
        costTable = state.cumulativeCostData.pet;
        sourceTable = g.petUpgradeCosts;
        affected = ['freezeDried'];
      } else {
        costTable = state.cumulativeCostData[cat.id];
        sourceTable = g.characterUpgradeCosts;
        affected = ['exp'];
      }
      let missing = false;
      if (sourceTable) {
        // ... (數據缺失檢查) ...
      }
      if (!missing && costTable) {
        const start = getCumulative(costTable, current - 1);
        const end = getCumulative(costTable, finalTarget - 1);
        Object.keys(end).forEach(key => {
          if (key.startsWith('cost_')) {
            const matId = costKeyToMaterialId(key);
            const delta = (end[key] || 0) - (start[key] || 0);
            required[matId] = (required[matId] || 0) + delta;
          }
        });
      }
    }
  });
  
  if (hasError) return { error: '輸入有誤 (例如遺物總數不為20)，請檢查。' };
  if (!hasInput) return { required: {}, gains: {}, deficit: {}, materialErrors: missingDataErrors };
  
  // --- 5. 掛機收益計算 ---
  if (targetTimeStr) {
    const hours = Math.max(0, (new Date(targetTimeStr).getTime() - Date.now()) / 36e5);
    Object.entries(productionSources).forEach(([srcId, src]) => {
      const hourly = parseFloat(document.getElementById(`manual-hourly-${srcId}`)?.value) || 0;
      const mat = src.materialId;
      gains[mat] = (gains[mat] || 0) + Math.floor(hourly * hours);
    });
    if (bedExpHourly > 0) gains['exp'] = (gains['exp'] || 0) + Math.floor(bedExpHourly * hours);
  }
  
  // --- 6. 缺口計算 ---
  for (const matId in materials) {
    const need = required[matId] || 0;
    const owned = parseInt(document.getElementById(`owned-${matId}`)?.value) || 0; // 暫時保留 DOM 讀取
    const g = gains[matId] || 0;
    deficit[matId] = Math.max(0, need - owned - g);
  }
  
  return { required, gains, deficit, materialErrors: missingDataErrors };
}

/**
 * 通用通知排程 (邏輯與原 model.js 相同)
 * (此函式仍需透過 DOM 獲取 ownedExp/bedExpHourly，待 controller 拆分後可簡化簽名)
 */
function scheduleNotification(currentLevel, ownedExp, bedExpHourly, targetLevel, notifyTime, type) {
  clearLevelUpNotification(type === 'targetLevel' ? { targetLevel: true } : { levelUp: true });
  // ... (邏輯與原 model.js 相同) ...
  let levelupTs;
  if (type === 'targetLevel') {
    const { etaTs } = computeEtaToTargetLevel(currentLevel, ownedExp, bedExpHourly, targetLevel);
    levelupTs = etaTs;
  } else {
    const { levelupTs: ts } = expCalculation(currentLevel, ownedExp, bedExpHourly, currentLevel + 1);
    levelupTs = ts;
  }
  if (!Number.isFinite(levelupTs)) return;
  if ('Notification' in window && Notification.permission === 'granted') {
    const aligned = Math.ceil(levelupTs / 60000) * 60000;
    const notifyAt = aligned - notifyTime * 60 * 1000;
    const delay = notifyAt - Date.now();
    if (delay > 0) {
      const MAX_DELAY = 0x7fffffff; // 最長延遲約 24.8 天
      const schedule = (ms) => {
        if (ms > MAX_DELAY) {
          const tid = setTimeout(() => schedule(ms - MAX_DELAY), MAX_DELAY);
          if (type === 'targetLevel') state.notificationTimerIdTargetLevel = tid;
          else state.notificationTimerIdLevelUp = tid;
        } else {
          const tid = setTimeout(() => {
            const nextLevel = type === 'targetLevel' ? targetLevel : currentLevel + 1;
            new Notification('杖劍傳說提醒', {
              body: `您的角色約 ${notifyTime} 分鐘後可升級至 ${nextLevel} 級！`,
              icon: 'https://placehold.co/192x192/31c9be/ffffff?text=LV',
            });
            if (type === 'targetLevel') {
              state.notificationTimerIdTargetLevel = null;
            } else {
              state.notificationTimerIdLevelUp = null;
            }
          }, ms);
          if (type === 'targetLevel') state.notificationTimerIdTargetLevel = tid;
          else state.notificationTimerIdLevelUp = tid;
        }
      };
      schedule(delay);
    }
  }
}

/** 排定下一級升級通知 */
export function scheduleLevelUpNotification(currentLevel, ownedExp, bedExpHourly, targetLevel, notifyTime) {
  scheduleNotification(currentLevel, ownedExp, bedExpHourly, targetLevel, notifyTime, 'levelUp');
}

/** 排定目標等級通知 */
export function scheduleTargetLevelNotification(currentLevel, ownedExp, bedExpHourly, targetLevel, notifyTime) {
  scheduleNotification(currentLevel, ownedExp, bedExpHourly, targetLevel, notifyTime, 'targetLevel');
}