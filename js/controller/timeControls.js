// js/controller/timeControls.js
// ★ 處理經驗、升級時間計算、自動更新與通知 ★

import { state, getCumulative, computeEtaToNextLevel, computeEtaToTargetLevel } from '../model/model.js';
import { renderLevelupTimeText, renderTargetEtaText } from '../view.js'; // 引入 View 渲染函式

/* -----------------------------
 * 顯示升級所需經驗
 * ---------------------------*/
function updateExpRequirements(curLv, ownedExp, targetChar) {
  const table = state.cumulativeCostData['character'];
  if (!table || !table.length) return;

  const cur = getCumulative(table, curLv - 1);
  const nxt = getCumulative(table, curLv);
  const tgt = getCumulative(table, targetChar - 1);

  const needNextExp = Math.max(0, (nxt.cost_exp || 0) - (cur.cost_exp || 0) - ownedExp);
  const needTargetExp = Math.max(0, (tgt.cost_exp || 0) - (cur.cost_exp || 0) - ownedExp);

  const elNext = document.getElementById('bed-levelup-exp');
  const elTarget = document.getElementById('bed-target-exp');
  if (elNext) elNext.textContent = `升至下一級所需經驗: ${needNextExp.toLocaleString()}`;
  if (elTarget) elTarget.textContent = `升至目標等級所需經驗: ${needTargetExp.toLocaleString()}`;
}

/* -----------------------------
 * 每秒同步更新經驗（並更新 ETA 顯示）
 * ---------------------------*/
export function setupAutoUpdate(containers) {
  setInterval(() => {
    const curLv = parseInt(document.getElementById('character-current')?.value) || 0;
    const ownedWanStr = document.getElementById('owned-exp-wan')?.value?.trim();
    const ownedWan = ownedWanStr === '' ? NaN : parseFloat(ownedWanStr);
    const bedHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;
    const targetChar = parseInt(document.getElementById('target-character')?.value) || 0;

    const ownedExpInput = document.getElementById('owned-exp');
    if (!ownedExpInput || isNaN(ownedWan)) return;

    // 1. 經驗累加
    const base = parseFloat(ownedExpInput.value) || ownedWan * 10000;
    const newExp = base + (bedHourly / 3600);
    ownedExpInput.value = Math.floor(newExp);
    const ownedExp = parseInt(ownedExpInput.value) || 0;

    // 2. 更新 ETA 顯示
    const { levelupTs, minutesNeeded } =
      computeEtaToNextLevel(curLv, ownedExp, bedHourly);
    renderLevelupTimeText(minutesNeeded, levelupTs);

    const { minutesNeeded: m2, etaTs } =
      computeEtaToTargetLevel(curLv, ownedExp, bedHourly, targetChar);
    renderTargetEtaText(m2, etaTs);

    // 3. 更新所需經驗顯示
    updateExpRequirements(curLv, ownedExp, targetChar);
  }, 1000);
}

/* -----------------------------
 * 通知相關（從 controller.js 搬移）
 * ---------------------------*/
// 通知邏輯保持在 model/calculator.js 內，這裡只處理輸入和觸發

export async function enableLevelUpNotifications() {
  const curLv = parseInt(document.getElementById('character-current')?.value) || 0;
  const ownedWanStr = document.getElementById('owned-exp-wan')?.value?.trim();
  const ownedWan = ownedWanStr === '' ? NaN : parseFloat(ownedWanStr);
  const bedHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;
  const ownedExpInput = document.getElementById('owned-exp');

  const notifyTimeSelect = document.getElementById('notify-time-select');
  let notifyTime = 0;
  if (notifyTimeSelect.value === 'min1') notifyTime = 1;
  else if (notifyTimeSelect.value === 'min2') notifyTime = 2;
  else if (notifyTimeSelect.value === 'min3') notifyTime = 3;
  else if (notifyTimeSelect.value === 'min5') notifyTime = 5;

  if (ownedExpInput && isNaN(ownedWan)) return;
  const ownedExp = parseInt(ownedExpInput?.value) || 0;

  // 使用新的 model/model.js 匯出
  const { scheduleLevelUpNotification } = await import('../model/model.js');
  scheduleLevelUpNotification(curLv, ownedExp, bedHourly, curLv + 1, notifyTime);
  alert('已啟用升級（下一級）通知');
}

export async function disableLevelUpNotifications() {
  const { clearLevelUpNotification } = await import('../model/model.js');
  clearLevelUpNotification();
  alert('已清除升級通知');
}

export { updateExpRequirements }; // 匯出，供 controller.js 的 triggerRecalculate 使用