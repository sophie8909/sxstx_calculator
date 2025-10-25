// controller.js
// ★ 控制器層：初始化、事件繫結、調用 Model 與 View ★

import {
  state, STORAGE_KEY, loadDataForSeason, preprocessCostData,
  saveAllInputs, loadAllInputs, computeAll,
  computeEtaToNextLevel, computeEtaToTargetLevel, getCumulative
} from './model.js';

import {
  getContainers, renderAll, updateCurrentTime, updateRelicTotal,
  renderResults, renderLevelupTimeText, renderTargetEtaText
} from './view.js';

/** 綁定全域輸入事件（即時更新 + 儲存） */
function bindGlobalHandlers(containers) {
  document.body.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.matches('input[type=number], input[type=datetime-local]')) return;

    if (t.classList.contains('relic-dist-input')) updateRelicTotal();
    triggerRecalculate(containers);
  });

   const enableBtn = document.getElementById('enable-notifications-next-btn');
  enableBtn?.addEventListener('click', () => enableLevelUpNotifications());

  const enableTargetBtn = document.getElementById('enable-notifications-target-btn');
  enableTargetBtn?.addEventListener('click', () => (enableTargetLevelNotifications()));

  const disableBtn = document.getElementById('disable-notifications-btn');
  disableBtn?.addEventListener('click', () => disableLevelUpNotifications());

  // 清除本地資料
  const clearBtn = document.getElementById('clear-data-btn');
  clearBtn.addEventListener('click', () => {
    if (confirm('確定要清除所有已儲存的本地紀錄嗎？此操作無法復原。')) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });
}

/** 資料重算 */
function triggerRecalculate(containers) {
  const payload = computeAll(containers);
  renderResults(containers, payload, state.missingFiles);

  const curLv = parseInt(document.getElementById('character-current')?.value) || 0;
  const ownedExpWanStr = document.getElementById('owned-exp-wan')?.value?.trim();
  const ownedExpWan = ownedExpWanStr === '' ? NaN : parseFloat(ownedExpWanStr);
  const bedHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;

  // 計算實際經驗值（若輸入為空則不顯示）
  const ownedExpInput = document.getElementById('owned-exp');
  if (ownedExpInput) {
    if (!isNaN(ownedExpWan)) {
      ownedExpInput.value = Math.floor(ownedExpWan * 10000);
    } else {
      ownedExpInput.value = '';
    }
  }

  // 推播估算（下一級）
  const ownedExp = parseInt(ownedExpInput?.value) || 0;

  const { levelupTs, minutesNeeded } = computeEtaToNextLevel(curLv, ownedExp, bedHourly);
  console.log(levelupTs, minutesNeeded);
  renderLevelupTimeText(minutesNeeded, levelupTs);

  // 到達目標角色等級 ETA
  const targetChar = parseInt(document.getElementById('target-character')?.value) || 0;
  const { minutesNeeded: m2, etaTs } = computeEtaToTargetLevel(curLv, ownedExp, bedHourly, targetChar);
  renderTargetEtaText(m2, etaTs);

  // 更新下一級與目標等級所需經驗
  updateExpRequirements(curLv, ownedExp, targetChar);

  saveAllInputs();
}

/** 計算並更新「升至下一級 / 目標等級所需經驗」 */
function updateExpRequirements(curLv, ownedExp, targetChar) {
  const table = state.cumulativeCostData['character'];
  if (!table || !table.length) return;

  const cur = getCumulative(table, curLv - 1);
  const next = getCumulative(table, curLv);
  const target = getCumulative(table, targetChar - 1);

  const needNextExp = Math.max(0, (next.cost_exp || 0) - (cur.cost_exp || 0) - ownedExp);
  const needTargetExp = Math.max(0, (target.cost_exp || 0) - (cur.cost_exp || 0) - ownedExp);

  const elNext = document.getElementById('bed-levelup-exp');
  const elTarget = document.getElementById('bed-target-exp');
  if (elNext) elNext.textContent = `升至下一級所需經驗: ${needNextExp.toLocaleString()}`;
  if (elTarget) elTarget.textContent = `升至目標等級所需經驗: ${needTargetExp.toLocaleString()}`;
}

/** 每秒同步更新：經驗累積、時間推算 */
function setupAutoUpdate(containers) {
  setInterval(() => {
    const curLv = parseInt(document.getElementById('character-current')?.value) || 0;
    const ownedExpWanStr = document.getElementById('owned-exp-wan')?.value?.trim();
    const ownedExpWan = ownedExpWanStr === '' ? NaN : parseFloat(ownedExpWanStr);
    const bedHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;
    const targetChar = parseInt(document.getElementById('target-character')?.value) || 0;

    const ownedExpInput = document.getElementById('owned-exp');
    if (!ownedExpInput) return;

    // 若輸入空白 → 不更新經驗
    if (isNaN(ownedExpWan)) return;

    // 累加經驗
    const hourly = bedHourly || 0;
    const expPerSec = hourly / 3600;
    const lastExp = parseFloat(ownedExpInput.value) || ownedExpWan * 10000;
    const newExp = lastExp + expPerSec;
    ownedExpInput.value = Math.floor(newExp);

    const ownedExp = parseInt(ownedExpInput.value) || 0;

    const { levelupTs, minutesNeeded } = computeEtaToNextLevel(curLv, ownedExp, bedHourly);
    renderLevelupTimeText(minutesNeeded, levelupTs);

    const { minutesNeeded: m2, etaTs } = computeEtaToTargetLevel(curLv, ownedExp, bedHourly, targetChar);
    renderTargetEtaText(m2, etaTs);

    updateExpRequirements(curLv, ownedExp, targetChar);
  }, 1000);
}

/** 切換賽季 */
async function handleSeasonChange(containers) {
  const seasonSelector = document.getElementById('season-select');
  state.seasonId = seasonSelector?.value || 's2';

  containers.results.innerHTML = '<p class="text-gray-500 text-center py-8">正在載入新賽季數據...</p>';
  await loadDataForSeason(state.seasonId);
  preprocessCostData();

  renderAll(containers);
  loadAllInputs(['season-select']);

  updateRelicTotal();
  const payload = computeAll(containers);
  renderResults(containers, payload, state.missingFiles);

  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  data['season-select'] = state.seasonId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

async function enableLevelUpNotifications() {
  const curLv = parseInt(document.getElementById('character-current')?.value) || 0;
  const ownedWanStr = document.getElementById('owned-exp-wan')?.value?.trim();
  const ownedWan = ownedWanStr === '' ? NaN : parseFloat(ownedWanStr);
  const bedHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;
  const ownedExpInput = document.getElementById('owned-exp');
  const targetLevelInput = document.getElementById('target-level');
  const targetLevel = parseInt(targetLevelInput?.value) || curLv;
  
  // 通知時間設定
  const notifyTimeSelect = document.getElementById('notify-time-select');
  let notifyTime = 0;
  if (notifyTimeSelect.value == 'min0') {
    notifyTime = 0;
  } else if (notifyTimeSelect.value == 'min1') {
    notifyTime = 1;
  } else if (notifyTimeSelect.value == 'min2') {
    notifyTime = 2;
  } else if (notifyTimeSelect.value == 'min3') {
    notifyTime = 3;
  } else if (notifyTimeSelect.value == 'min5') {
    notifyTime = 5;
  }
  if (ownedExpInput && isNaN(ownedWan)) return;
  const ownedExp = parseInt(ownedExpInput?.value) || 0;
  import('./model.js').then(({ scheduleLevelUpNotification }) => {
    scheduleLevelUpNotification(curLv, ownedExp, bedHourly, targetLevel,notifyTime);
    alert('已啟用升級（下一級）通知');
  });
}


async function enableTargetLevelNotifications() {
  const curLv = parseInt(document.getElementById('character-current')?.value) || 0;
  const ownedWanStr = document.getElementById('owned-exp-wan')?.value?.trim();
  const ownedWan = ownedWanStr === '' ? NaN : parseFloat(ownedWanStr);
  const bedHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;
  const ownedExpInput = document.getElementById('owned-exp');
  const targetLevelInput = document.getElementById('target-level');
  const targetLevel = parseInt(targetLevelInput?.value) || curLv;
  
  // 通知時間設定
  const notifyTimeSelect = document.getElementById('notify-time-select');
  let notifyTime = 0;
  if (notifyTimeSelect.value == 'min0') {
    notifyTime = 0;
  } else if (notifyTimeSelect.value == 'min1') {
    notifyTime = 1;
  } else if (notifyTimeSelect.value == 'min2') {
    notifyTime = 2;
  } else if (notifyTimeSelect.value == 'min3') {
    notifyTime = 3;
  } else if (notifyTimeSelect.value == 'min5') {
    notifyTime = 5;
  }
  if (ownedExpInput && isNaN(ownedWan)) return;
  const ownedExp = parseInt(ownedExpInput?.value) || 0;
  import('./model.js').then(({ scheduleTargetLevelNotification }) => {
    scheduleTargetLevelNotification(curLv, ownedExp, bedHourly, targetLevel,notifyTime);
    alert('已啟用升級（目標級）通知');
  });
}

async function disableLevelUpNotifications() {
  import('./model.js').then(({ clearLevelUpNotification }) => {
    clearLevelUpNotification();
    alert('已清除升級通知');
  });
}

/* -----------------------------
 * 初始化
 * ---------------------------*/
async function init() {
  const containers = getContainers();
  renderAll(containers);
  bindGlobalHandlers(containers);

  const saved = JSON.parse(localStorage.getItem('sxstxCalculatorData') || '{}');
  const seasonSelector = document.getElementById('season-select');
  if (seasonSelector) seasonSelector.value = saved['season-select'] || 's2';


  await handleSeasonChange(containers);
  seasonSelector.addEventListener('change', () => handleSeasonChange(containers));

  setupAutoUpdate(containers);
  setInterval(() => updateCurrentTime(containers.currentTimeDisplay), 1000);
  updateCurrentTime(containers.currentTimeDisplay);
}

document.addEventListener('DOMContentLoaded', init);
