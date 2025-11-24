// js/controller/configLoader.js
// ★ 處理外部配置：伺服器與時間選項的載入與初始化 ★

import { state, STORAGE_KEY, seasonOptions } from '../model/model.js';
import { updateDaysRemainingFromTarget, updateAllMaterialSources } from './materialSource.js';

// Google 試算表設定 (從 controller.js 搬移)
const TIME_PRESETS_SHEET = {
  base: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMlpHJpHMNQTCxhYgj2fmvazou_cQpAiVa-w5tg7WR2EJTn4EExoLwojYM3BoS8FSTpxvaKIQdmPQC/pub',
  gid: '717680438',
};
const TIME_PRESETS_FALLBACK = [
  // ... (從 controller.js 搬移 fallback 資料)
  { key: 's1_end', server_name: '淨心護甲', label: 'S1 結束（淨心護甲）', iso: '2025-10-13T08:00:00+08:00' },
  { key: 's2_open', server_name: '淨心護甲', label: 'S2 開啟（淨心護甲）', iso: '2025-11-10T08:00:00+08:00' },
];

/* -----------------------------
 * 處理 Google Sheet 網路請求（因為邏輯複雜，這裡單獨保留在一個新的 dataFetcher 內）
 * 由於您未提供 dataFetcher 檔案，我們將其邏輯暫時放在此模組，但為了結構清晰，命名不變
 * ---------------------------*/
async function fetchServerOptionsFromSheet_Internal() {
  const url = `${TIME_PRESETS_SHEET.base}?output=csv&gid=${encodeURIComponent(TIME_PRESETS_SHEET.gid)}`;
  // ... (原 fetchServerOptionsFromSheet 邏輯，從 controller.js 搬移)
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(s => s.trim().toLowerCase());
    const serverIdx = headers.indexOf('server_name');

    const out = new Set();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(s => s.trim());
      const server = cols[serverIdx] || '';
      if (server) out.add(server);
    }
    return Array.from(out);
  } catch (err) {
    console.warn('[server options] fetch failed, using fallback', err);
    return ['淨心護甲'];
  }
}
async function fetchTimePresetsFromSheet_Internal() {
  const url = `${TIME_PRESETS_SHEET.base}?output=csv&gid=${encodeURIComponent(TIME_PRESETS_SHEET.gid)}`;
  // ... (原 fetchTimePresetsFromSheet 邏輯，從 controller.js 搬移)
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(s => s.trim().toLowerCase());

    const serverIdx = headers.indexOf('server_name');
    const descIdx   = headers.indexOf('description');
    const timeIdx   = headers.indexOf('time');

    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cols  = lines[i].split(',').map(s => s.trim());
      const server = cols[serverIdx] || '';
      const desc   = cols[descIdx]   || '';
      const time   = cols[timeIdx]   || '';
      if (!server && !desc && !time) continue;

      let datePart = '';
      if (time.includes('T')) {
        datePart = time.split('T')[0];
      } else {
        const m = time.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
        if (m) {
          const [, y, mo, d] = m;
          datePart = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
        } else {
          const d2 = new Date(time);
          if (!Number.isNaN(d2.getTime())) {
            datePart = d2.toISOString().slice(0, 10);
          } else {
            continue;
          }
        }
      }
      const isoTime = `${datePart}T08:00:00+08:00`;
      out.push({
        key: `${server}_${i}`,
        server_name: server,
        label: `${desc}`,
        iso: isoTime,
      });
    }
    return out;
  } catch (err) {
    console.warn('[time presets] fetch failed, using fallback', err);
    return TIME_PRESETS_FALLBACK.slice();
  }
}

/**
 * 初始化伺服器下拉選單 #server-select
 * @param {object} containers - DOM 容器
 * @param {function} triggerRecalculate - 觸發總計算的函式
 * @param {function} initTargetTimeControls - 載入目標時間控制的函式
 */
export async function initServerSelector(containers, triggerRecalculate) {
  const serverSel = document.getElementById('server-select');
  if (!serverSel) return;

  const servers = await fetchServerOptionsFromSheet_Internal();
  serverSel.innerHTML = '';
  servers.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    serverSel.appendChild(opt);
  });

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const savedServer = saved['server-select'];
  if (savedServer && [...serverSel.options].some(o => o.value === savedServer)) {
    serverSel.value = savedServer;
    state.serverName = savedServer;
  } else {
    serverSel.selectedIndex = 0;
    state.serverName = serverSel.value;
  }

  serverSel.addEventListener('change', () => {
    state.serverName = serverSel.value;
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    data['server-select'] = serverSel.value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    initTargetTimeControls(containers);
    triggerRecalculate(containers);
  });
}

/**
 * 目標時間控制
 * @param {object} containers - DOM 容器
 * @param {function} triggerRecalculate - 觸發總計算的函式
 */
export async function initTargetTimeControls(containers, triggerRecalculate) {
  const presetSel = document.getElementById('target-time-preset');
  const displayBox = document.getElementById('target-time-display');
  const customInput = document.getElementById('target-time-custom');
  const hiddenField = document.getElementById('target-time');

  if (!presetSel || !displayBox || !customInput || !hiddenField) return;

  const allPresets = await fetchTimePresetsFromSheet_Internal();
  const selectedServer = state.serverName;

  presetSel.innerHTML = '';
  allPresets.forEach(p => {
    if (p.server_name && p.server_name !== selectedServer) return;
    const opt = document.createElement('option');
    opt.value = p.key;
    opt.textContent = p.label;
    presetSel.appendChild(opt);
  });

  const optCustom = document.createElement('option');
  optCustom.value = '__custom__';
  optCustom.textContent = '自訂時間';
  presetSel.appendChild(optCustom);

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const savedKey = saved['target-time-preset'];
  if (savedKey && [...presetSel.options].some(o => o.value === savedKey)) {
    presetSel.value = savedKey;
  } else {
    presetSel.selectedIndex = 0;
  }
  customInput.value = saved['target-time-custom'] || '';

  const apply = () => {
    const v = presetSel.value;
    if (v === '__custom__') {
      customInput.classList.remove('hidden');
      displayBox.classList.add('hidden');

      if (!customInput.value) {
        const now = new Date();
        const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        customInput.value = localISO;
      }
      hiddenField.value = customInput.value || '';
    } else {
      customInput.classList.add('hidden');
      displayBox.classList.remove('hidden');

      const found = allPresets.find(p => p.key === v);
      const ts = found?.iso || '';
      hiddenField.value = ts;

      if (ts) {
        const d = new Date(ts);
        displayBox.textContent = d.toLocaleString('zh-TW', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
      } else {
        displayBox.textContent = '--';
      }
    }

    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    data['target-time-preset'] = presetSel.value;
    data['target-time-custom'] = customInput.value || '';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    updateDaysRemainingFromTarget(); // 依賴 materialSource
    updateAllMaterialSources();      // 依賴 materialSource

    triggerRecalculate(containers);
  };

  presetSel.addEventListener('change', apply);
  customInput.addEventListener('input', apply);
  apply();
}