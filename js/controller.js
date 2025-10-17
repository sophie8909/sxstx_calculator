// controller.js
// ★ 控制器層：初始化、事件繫結、調用 Model 與 View ★

import {
  state, STORAGE_KEY, loadDataForSeason, preprocessCostData,
  saveAllInputs, loadAllInputs, computeAll, scheduleLevelUpNotification,
  calculateSeasonScore_S1, calculateSeasonScore_S2, convertPrimordialStar_S1
} from './model.js';

import {
  getContainers, renderAll, updateCurrentTime, updateRelicTotal, renderResults, renderLevelupTimeText
} from './view.js';

function bindGlobalHandlers(containers) {
  // 任一數值/時間變更 → 計算 + 儲存
  document.body.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('input[type=number], input[type=datetime-local]')) {
      if (t.classList.contains('relic-dist-input')) updateRelicTotal();
      const payload = computeAll(containers);
      renderResults(containers, payload, state.missingFiles);

      // 推播估算
      const curLv = parseInt(document.getElementById('character-current')?.value) || 0;
      const ownedExp = parseInt(document.getElementById('owned-exp')?.value) || 0;
      const bedHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;
      const { levelupTs, minutesNeeded } = scheduleLevelUpNotification(curLv, ownedExp, bedHourly);
      renderLevelupTimeText(minutesNeeded, levelupTs);

      saveAllInputs();
    }
  });

  // 啟用通知
  const notifBtn = document.getElementById('enable-notifications-btn');
  if ('Notification' in window) {
    notifBtn.addEventListener('click', () => {
      Notification.requestPermission().then(p => {
        if (p === 'granted') {
          notifBtn.textContent = '通知已啟用';
          notifBtn.disabled = true;
          new Notification('通知已啟用', { body: '角色升級前 3 分鐘將提醒您！' });
        } else {
          notifBtn.textContent = '通知被拒絕'; notifBtn.disabled = true;
        }
      });
    });
  } else {
    notifBtn.textContent = '瀏覽器不支援通知'; notifBtn.disabled = true;
  }

  // 清除本地紀錄
  const clearBtn = document.getElementById('clear-data-btn');
  clearBtn.addEventListener('click', () => {
    if (confirm('確定要清除所有已儲存的本地紀錄嗎？此操作無法復原。')) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });
}

async function handleSeasonChange(containers) {
  const seasonSelector = document.getElementById('season-select');
  state.seasonId = seasonSelector.value;

  containers.results.innerHTML = '<p class="text-gray-500 text-center py-8">正在載入新賽季數據...</p>';
  await loadDataForSeason(state.seasonId);
  preprocessCostData();

  // 重新渲染「靜態區塊」（避免初始 mount 後容器被清空）
  renderAll(containers);

  // 回填 LocalStorage 的值（賽季切換後仍保留）
  loadAllInputs(['season-select']);

  // 初次更新遺物總數、時間、結果
  updateRelicTotal();
  const payload = computeAll(containers);
  renderResults(containers, payload, state.missingFiles);

  // 儲存賽季選擇
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  data['season-select'] = state.seasonId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

async function init() {
  // 容器
  const containers = getContainers();

  // 首渲染靜態 UI
  renderAll(containers);

  // 綁定全域事件
  bindGlobalHandlers(containers);

  // 恢復已存輸入（含賽季值）
  const saved = JSON.parse(localStorage.getItem('sxstxCalculatorData') || '{}');
  const seasonSelector = document.getElementById('season-select');
  seasonSelector.value = saved['season-select'] || 's1';

  // 載入賽季資料 → 預處理
  await handleSeasonChange(containers);

  // 監聽賽季切換
  seasonSelector.addEventListener('change', () => handleSeasonChange(containers));

  // 時鐘
  setInterval(() => updateCurrentTime(containers.currentTimeDisplay), 1000);
  updateCurrentTime(containers.currentTimeDisplay);
}

document.addEventListener('DOMContentLoaded', init);
