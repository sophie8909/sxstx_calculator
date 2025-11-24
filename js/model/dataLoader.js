// js/model/dataLoader.js
// ★ 數據載入層：CSV Fetch/解析、數據載入與預處理 ★

import { state } from './model.js';
import {
  GOOGLE_SHEET_BASE,
  DATA_FILES_CONFIG,
  MOCK_GAME_DATA,
  MATERIAL_AVG_SHEETS,
  MATERIAL_DAILY_DEFAULTS,
} from './constants.js';

// 小工具：正規化 key（去掉 BOM、trim）
const normalizeKey = (k) => k ? k.replace(/^\uFEFF/, '').trim() : k;

/** 強韌版 CSV 解析：處理 BOM、CR/LF、千分位、空值 */
export async function fetchAndParseCsv(url) {
  const res = await fetch(url, { cache: 'no-store' }); // 免快取，避免 GH Pages 舊檔
  if (!res.ok) throw new Error(`無法載入 CSV: ${url}`);
  const text = await res.text();
  // 統一成 LF，避免 \r 影響 split
  const lines = text.replace(/\r\n?/g, '\n').trim().split('\n');
  if (lines.length === 0) return [];
  // 標頭去掉 BOM
  const rawHeaders = lines[0].split(',').map(h => normalizeKey(h));
  const headers = rawHeaders.map(h => h.toLowerCase()); // 全轉小寫，之後一致用小寫
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => {
      const raw = (values[i] ?? '').trim();
      // 去掉千分位逗號後再轉數字；空字串給 0；轉不動就保留字串
      const num = Number(raw.replace(/,/g, ''));
      obj[h] = Number.isFinite(num) ? num : (raw === '' ? 0 : raw);
    });
    return obj;
  });
  return rows;
}

/** 根據 gid 自動拼出 CSV URL */
function makeCsvUrl(gid) {
  return `${GOOGLE_SHEET_BASE}?gid=${gid}&single=true&output=csv`;
}

/**
 * 商店資料預處理：將 CSV 載入的 shop rows 轉成 { average, costRola } 格式，
 * 並更新 MATERIAL_DAILY_DEFAULTS 作為預設值。
 */
function buildShopDataForSeason(rows, seasonId) {
  const shop = {};

  // 清空舊的 shop 預設值
  Object.keys(MATERIAL_DAILY_DEFAULTS.shop).forEach((k) => {
    delete MATERIAL_DAILY_DEFAULTS.shop[k];
  });

  rows.forEach((r) => {
    const rowSeason = (r.season || "").toLowerCase();
    if (rowSeason && rowSeason !== seasonId.toLowerCase()) return;

    const id = (r.id || "").trim().toLowerCase(); // stone / essence / sand / freeze_dried
    if (!id) return;

    const avg = Number(r.average || 0);
    const costRola = Number(r.cost_rola || 0);

    shop[id] = { average: avg, costRola };

    // 這就是 UI「每日購買量」的預設值
    MATERIAL_DAILY_DEFAULTS.shop[id] = avg;
  });

  return shop;
}

/** 載入對應賽季的資料 */
export async function loadDataForSeason(seasonId) {
  const targetSeason = seasonId;
  const loaded = {};
  state.missingFiles = [];

  for (const [key, gid] of Object.entries(DATA_FILES_CONFIG)) {
    const url = makeCsvUrl(gid);
    try {
      const rows = await fetchAndParseCsv(url);

      const filtered = rows.filter((row) => {
        const s = String(row.season || '').toLowerCase();
        if (!s) return true; // 這一列沒有 season (共用)
        return s === targetSeason.toLowerCase();
      });

      if (key === 'shop') {
        state.gameData.shop = buildShopDataForSeason(filtered, seasonId);
      } else {
        loaded[key] = filtered;
      }

    } catch (err) {
      console.warn(`❌ 無法載入 ${key} (${url})，改用模擬數據`, err);
      loaded[key] = MOCK_GAME_DATA[key];
      state.missingFiles.push(key);
    }
  }

  // 將非 shop 的其他資料寫入 state.gameData
  Object.assign(state.gameData, loaded);
}

/** 讀單一 CSV：格式為 resource,average */
async function fetchMaterialAvgCSV({ base, gid }) {
  const url = `${base}?output=csv&gid=${encodeURIComponent(gid)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`[material avg] fetch failed ${res.status}`);

  const text = await res.text();
  const lines = text.replace(/\r\n?/g, '\n').trim().split('\n');
  const rows = lines.slice(1);

  const out = {};
  for (const line of rows) {
    if (!line.trim()) continue;
    const [idRaw, avgRaw] = line.split(',').map(s => s.trim());
    if (!idRaw) continue;

    const id = idRaw.toLowerCase();
    const avg = parseFloat(avgRaw);
    out[id] = Number.isNaN(avg) ? 0 : avg;
  }
  return out;
}

/** 一次載入所有來源的平均值到 state */
export async function loadMaterialAvgDefaults() {
  const entries = await Promise.all(
    Object.entries(MATERIAL_AVG_SHEETS).map(async ([source, cfg]) => {
      try {
        const avgMap = await fetchMaterialAvgCSV(cfg);
        return [source, avgMap];
      } catch (err) {
        console.warn('[material avg] use zeros for', source, err);
        return [source, {}];
      }
    })
  );

  for (const [source, avgMap] of entries) {
    state.materialAvgDefaults[source] = avgMap;
  }
}