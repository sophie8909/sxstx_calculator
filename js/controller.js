// controller.js
// ???批?典惜嚗?憪???隞嗥鼠蝯矽??Model ??View ??

import {
  state,
  STORAGE_KEY,
  seasonOptions,
  loadDataForSeason,
  preprocessCostData,
  saveAllInputs,
  loadAllInputs,
  computeAll,
  computeEtaToNextLevel,
  computeEtaToTargetLevel,
  getCumulative,
  getSpeedupHoursForDays,
  getSpeedupHoursForHours,
  loadMaterialAvgDefaults, 
} from './model.js';

import {
  getContainers,
  renderAll,
  updateCurrentTime,
  updateRelicTotal,
  renderResults,
  renderLevelupTimeText,
  renderTargetEtaText,
  renderMaterialSource,
  renderRelicDistribution,
} from './view.js';
import { applyStaticTranslations, getCurrentLanguage, initLanguage, t } from './i18n-inline.js';

/* ============================================================
 * Google 閰衣?銵剁?Published CSV嚗身摰????賊? / 隡箸??其?皞?
 * 閰衣?銵冽?雿?server_name, description, time
 * ============================================================ */
const TIME_PRESETS_SHEET = {
  id: '1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E',
  gid: '859085671',
};

// 霈銝閰衣?銵冽????渲?????撌脫??08:00嚗?
const TIME_PRESETS_FALLBACK = [
  {
    key: 's1_end',
    season_id: 's1',
    server_name: '台港澳',
    label: 'S1 結束',
    iso: '2025-10-13T08:00:00+08:00'
  },
  {
    key: 's2_open',
    season_id: 's2',
    server_name: '台港澳',
    label: 'S2 開始',
    iso: '2025-11-10T08:00:00+08:00'
  },
];

const SEASON_START_CATEGORY = '【賽季開始】';
const DUNGEON_CATEGORY = '【副本開啟】';
const DUNGEON_ANCHOR_LABEL = '淨心護甲';
const DUNGEON_OPEN_INTERVAL_DAYS = 14;
const CURRENT_SEASON_DUNGEON_COUNT = 12;
const DUNGEON_POWER_SHEET = {
  id: '1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E',
  gid: '2044399102',
};
const DUNGEON_DIFFICULTIES = ['普通', '困難', '惡夢', '煉獄', '深淵'];
let dungeonPowerRowsCache = null;

const liveOwnedExpState = {
  signature: '',
  baseOwnedExp: 0,
  baseTimestamp: Date.now(),
};

function addDaysToIsoDate(datePart, days) {
  const [year, month, day] = String(datePart || '').split('-').map(Number);
  if (!year || !month || !day) return '';

  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}T08:00:00+08:00`;
}

function stripDungeonCategory(label) {
  return String(label || '')
    .replace(DUNGEON_CATEGORY, '')
    .replace(/[（(]副本[開开][啟启啓][）)]/g, '')
    .trim();
}

function getPresetDungeonName(preset) {
  return String(preset?.dungeon_name || stripDungeonCategory(preset?.label)).trim();
}

function isBaselineTimeLabel(label) {
  const text = String(label || '');
  return (
    text.startsWith(SEASON_START_CATEGORY) ||
    text.includes('賽季開始') ||
    text.includes('开服') ||
    text.includes('開服') ||
    /^s\s*\d+\s*$/i.test(text) ||
    /^s\s*\d+\s*([開开][始啟启啓])/i.test(text)
  );
}

function getBaselineKind(label) {
  const text = String(label || '');
  return text.includes('开服') || text.includes('開服') ? 'server_open' : 'season_start';
}

function isDungeonTimeLabel(label) {
  const text = String(label || '');
  return text.startsWith(DUNGEON_CATEGORY) || /[（(]?副本[開开][啟启啓][）)]?/.test(text);
}

function getDungeonRowsForSeason(rows, seasonId) {
  const targetSeason = normalizeSeasonId(seasonId);
  return rows.filter((row) => !row.season_id || row.season_id === targetSeason);
}

function getPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function getDungeonOffsetDays(row, index, baselineKind) {
  const day = baselineKind === 'server_open'
    ? getPositiveNumber(row?.server_day)
    : getPositiveNumber(row?.season_day) || getPositiveNumber(row?.day);

  // Day 1 means the baseline date itself.
  return day > 0 ? day - 1 : index * DUNGEON_OPEN_INTERVAL_DAYS;
}

function withGeneratedDungeonOpenTimes(presets, dungeonRows = []) {
  const generated = [];

  presets.forEach((preset) => {
    const label = String(preset.label || '');
    const isSeasonStart = isBaselineTimeLabel(label);
    const isDungeonAnchor = label.includes(DUNGEON_ANCHOR_LABEL);
    if (!isSeasonStart && !isDungeonAnchor) return;

    const datePart = String(preset.iso || '').slice(0, 10);
    if (!datePart) return;
    const baselineKind = isSeasonStart ? getBaselineKind(label) : 'season_start';
    const serverName = isSeasonStart ? preset.server_name : '';
    const rowsForSeason = getDungeonRowsForSeason(dungeonRows, preset.season_id);
    const sourceRows = rowsForSeason.length > 0
      ? rowsForSeason
      : Array.from({ length: CURRENT_SEASON_DUNGEON_COUNT }, (_, index) => ({
          dungeon_name: `第 ${index + 1} 個副本`,
          day: index * DUNGEON_OPEN_INTERVAL_DAYS + 1,
          season_day: index * DUNGEON_OPEN_INTERVAL_DAYS + 1,
          server_day: index * DUNGEON_OPEN_INTERVAL_DAYS + 1,
        }));
    const anchorRow = sourceRows.find((row) => row.dungeon_name.includes(DUNGEON_ANCHOR_LABEL));
    const anchorOffset = isDungeonAnchor && anchorRow
      ? getDungeonOffsetDays(anchorRow, sourceRows.indexOf(anchorRow), 'season_start')
      : 0;

    sourceRows.forEach((row, index) => {
      generated.push({
        key: `${preset.key}_dungeon_${index + 1}`,
        season_id: preset.season_id,
        server_name: serverName,
        label: `${DUNGEON_CATEGORY}${row.dungeon_name || `第 ${index + 1} 個副本`}`,
        iso: addDaysToIsoDate(datePart, getDungeonOffsetDays(row, index, baselineKind) - anchorOffset),
        generated_from: isDungeonAnchor ? 'global_dungeon_anchor' : baselineKind,
        dungeon_name: row.dungeon_name || '',
      });
    });
  });

  return generated.length > 0 ? presets.concat(generated) : presets;
}

function appendStaticTooltip(target, text) {
  if (!target || !text) return;

  const existing = target.querySelector('.tooltip');
  if (existing) {
    const icon = existing.querySelector('.tooltip-icon');
    const body = existing.querySelector('.tooltip-text');
    if (icon) icon.setAttribute('aria-label', text);
    if (body) body.textContent = text;
    return;
  }

  target.dataset.tooltipBound = '1';
  target.classList.add('label-with-help');
  target.insertAdjacentHTML(
    'beforeend',
    `<span class="tooltip"><span class="tooltip-icon" tabindex="0" role="button" aria-label="${text}">i</span><span class="tooltip-text">${text}</span></span>`
  );
}

function enhanceStaticFieldTooltips() {
  appendStaticTooltip(document.querySelector('label[for="season-select"]'), t('season_tooltip'));
  appendStaticTooltip(document.querySelector('label[for="server-select"]'), t('server_tooltip'));
  appendStaticTooltip(document.querySelector('label[for="notify-time-select"]'), t('notify_tooltip'));
  appendStaticTooltip(document.getElementById('target-time-display')?.previousElementSibling, t('target_time_tooltip'));
  appendStaticTooltip(document.getElementById('primordial-star-cumulative')?.previousElementSibling, t('primordial_star_tooltip'));
  appendStaticTooltip(document.getElementById('relic-total-display')?.parentElement, t('relic_tooltip'));
}

function getSelectedSeason() {
  return seasonOptions.find((season) => season.id === state.seasonId) || seasonOptions[0] || null;
}

function normalizeServerName(name) {
  return String(name || '')
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSeasonId(value) {
  const match = String(value || '').match(/\bs\s*(\d+)\b/i);
  return match ? `s${match[1]}` : '';
}

function getServerGroupMembers(name) {
  return normalizeServerName(name)
    .replace(/[－—–]/g, '-')
    .replace(/\s+-\s+/g, '、')
    .split(/[、,，/／]+/)
    .map((part) => normalizeServerName(part))
    .filter(Boolean);
}

function isSubsetMembers(sourceMembers, targetMembers) {
  if (!sourceMembers.length || !targetMembers.length) return false;
  const targetSet = new Set(targetMembers);
  return sourceMembers.every((member) => targetSet.has(member));
}

function areServerGroupsEquivalentOrMerged(a, b) {
  const aMembers = getServerGroupMembers(a);
  const bMembers = getServerGroupMembers(b);
  if (!aMembers.length || !bMembers.length) return false;
  if (isSubsetMembers(aMembers, bMembers) || isSubsetMembers(bMembers, aMembers)) return true;

  return aMembers.some((aMember) =>
    bMembers.some((bMember) =>
      aMember === bMember || aMember.includes(bMember) || bMember.includes(aMember)
    )
  );
}

function mergeServerOptions(serverNames) {
  const normalized = serverNames
    .map((name) => normalizeServerName(name))
    .filter(Boolean);

  const uniqueNames = Array.from(new Set(normalized));
  return uniqueNames.filter((name, index, list) => {
    const members = getServerGroupMembers(name);
    return !list.some((otherName, otherIndex) => {
      if (index === otherIndex) return false;
      const otherMembers = getServerGroupMembers(otherName);
      return otherMembers.length > members.length && isSubsetMembers(members, otherMembers);
    });
  });
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => String(value).trim() !== '')) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase();
}

function getCsvValue(row, headers, names) {
  for (const name of names) {
    const index = headers.indexOf(normalizeHeader(name));
    if (index >= 0) return String(row[index] || '').trim();
  }
  return '';
}

function getGoogleSheetCsvUrl(sheet) {
  return `https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=csv&gid=${sheet.gid}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPowerRequirement(value) {
  const raw = String(value || '').replace(/,/g, '').trim();
  if (!raw) return '';

  const amountWan = Number(raw);
  if (!Number.isFinite(amountWan)) return value;

  if (Math.abs(amountWan) >= 10000) {
    const amountYi = amountWan / 10000;
    return `${Number.isInteger(amountYi) ? amountYi : amountYi.toFixed(2).replace(/\.?0+$/, '')}億`;
  }
  return `${amountWan}萬`;
}

async function fetchDungeonPowerRows() {
  if (dungeonPowerRowsCache) return dungeonPowerRowsCache;

  const url = `https://docs.google.com/spreadsheets/d/${DUNGEON_POWER_SHEET.id}/export?format=csv&gid=${DUNGEON_POWER_SHEET.gid}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const rows = parseCsvRows(await res.text());
    const headers = (rows.shift() || []).map(normalizeHeader);

    dungeonPowerRowsCache = rows
      .map((row) => {
        const powers = {};
        DUNGEON_DIFFICULTIES.forEach((difficulty) => {
          powers[difficulty] = getCsvValue(row, headers, [difficulty]);
        });

        return {
          season_id: normalizeSeasonId(getCsvValue(row, headers, ['賽季', 'season'])),
          server_day: Number(getCsvValue(row, headers, ['天數', 'server_day'])),
          season_day: Number(getCsvValue(row, headers, ['開國天數', '開国天數', 'season_day'])),
          day: Number(getCsvValue(row, headers, ['時間', 'time', 'day'])),
          dungeon_name: getCsvValue(row, headers, ['副本', 'dungeon']),
          powers,
        };
      })
      .filter((row) => row.dungeon_name);
  } catch (err) {
    console.warn('[dungeon power] fetch failed', err);
    dungeonPowerRowsCache = [];
  }

  return dungeonPowerRowsCache;
}

function findDungeonPowerRow(preset, rows, seasonId) {
  const dungeonName = getPresetDungeonName(preset);
  if (!dungeonName) return null;

  return getDungeonRowsForSeason(rows, seasonId).find((row) =>
    row.dungeon_name === dungeonName ||
    row.dungeon_name.includes(dungeonName) ||
    dungeonName.includes(row.dungeon_name)
  ) || null;
}

function usesLargeExpUnit() {
  return (getSelectedSeason()?.season || 0) >= 4;
}

function getOwnedExpWanValue() {
  const raw = document.getElementById('owned-exp-wan')?.value?.trim() || '';
  if (raw === '') return NaN;

  const value = parseFloat(raw);
  return Number.isNaN(value) ? NaN : value;
}

function convertWanToOwnedExp(ownedWan) {
  if (Number.isNaN(ownedWan)) return NaN;
  return Math.floor(ownedWan * (usesLargeExpUnit() ? 100000000 : 10000));
}

function syncOwnedExpInputFromWan(ownedWan) {
  const ownedExpInput = document.getElementById('owned-exp');
  if (!ownedExpInput) return 0;

  if (Number.isNaN(ownedWan)) {
    ownedExpInput.value = '';
    return 0;
  }

  const ownedExp = convertWanToOwnedExp(ownedWan);
  ownedExpInput.value = String(ownedExp);
  return ownedExp;
}

function buildOwnedExpSignature(currentLevel, ownedWan, bedHourly) {
  return [state.seasonId, currentLevel, Number.isNaN(ownedWan) ? 'nan' : ownedWan, bedHourly].join('|');
}

function getLiveOwnedExp(currentLevel, ownedWan, bedHourly) {
  const ownedExpInput = document.getElementById('owned-exp');
  if (!ownedExpInput) return 0;

  if (Number.isNaN(ownedWan)) {
    liveOwnedExpState.signature = '';
    liveOwnedExpState.baseOwnedExp = 0;
    liveOwnedExpState.baseTimestamp = Date.now();
    ownedExpInput.value = '';
    return 0;
  }

  const signature = buildOwnedExpSignature(currentLevel, ownedWan, bedHourly);
  if (liveOwnedExpState.signature !== signature) {
    liveOwnedExpState.signature = signature;
    liveOwnedExpState.baseOwnedExp = convertWanToOwnedExp(ownedWan);
    liveOwnedExpState.baseTimestamp = Date.now();
  }

  const elapsedMs = Math.max(0, Date.now() - liveOwnedExpState.baseTimestamp);
  const gainedExp = Math.floor((Math.max(0, bedHourly) * elapsedMs) / 36e5);
  const ownedExp = liveOwnedExpState.baseOwnedExp + gainedExp;
  ownedExpInput.value = String(ownedExp);
  return ownedExp;
}

function readBedProgressState() {
  const currentLevel = parseInt(document.getElementById('character-current')?.value, 10) || 0;
  const ownedWan = getOwnedExpWanValue();
  const bedHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;
  const targetLevel = parseInt(document.getElementById('target-character')?.value, 10) || 0;
  const ownedExp = getLiveOwnedExp(currentLevel, ownedWan, bedHourly);

  return {
    currentLevel,
    ownedWan,
    ownedExp,
    bedHourly,
    targetLevel,
  };
}

function getTargetTimeHoursRemaining() {
  const targetTime = document.getElementById('target-time')?.value;
  if (!targetTime) return 0;

  const hours = (new Date(targetTime).getTime() - Date.now()) / 36e5;
  return Math.max(0, hours);
}

function getNextLevelSpeedupHours(currentLevel, ownedExp, bedHourly) {
  const { minutesNeeded } = computeEtaToNextLevel(currentLevel, ownedExp, bedHourly);
  if (!Number.isFinite(minutesNeeded) || minutesNeeded <= 0) return 0;
  return getSpeedupHoursForDays(minutesNeeded / (24 * 60));
}

function updateSpeedupHints(nextLevelHours, targetHours) {
  const nextLevelEl = document.getElementById('bed-levelup-speedup');
  const targetEl = document.getElementById('bed-target-speedup');

  if (nextLevelEl) nextLevelEl.textContent = t('speedup_next_level', { hours: nextLevelHours });
  if (targetEl) targetEl.textContent = t('speedup_target_time', { hours: targetHours });
}

function localizeEtaDisplays(levelupMinutes, levelupTs, targetMinutes, etaTs) {
  const levelupEl = document.getElementById('bed-levelup-time');
  const targetEl = document.getElementById('bed-target-eta');

  if (levelupEl) {
    if (!Number.isFinite(levelupTs)) levelupEl.textContent = t('levelup_eta_empty');
    else if (levelupMinutes <= 0) levelupEl.textContent = t('levelup_eta_ready');
    else {
      const timeText = new Date(levelupTs).toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      levelupEl.textContent = t('levelup_eta_value', { minutes: levelupMinutes.toLocaleString(), time: timeText });
    }
  }

  if (targetEl) {
    if (!Number.isFinite(etaTs)) targetEl.textContent = t('target_eta_empty');
    else if (targetMinutes <= 0) targetEl.textContent = t('target_eta_ready');
    else {
      const timeText = new Date(etaTs).toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      targetEl.textContent = t('target_eta_value', { minutes: targetMinutes.toLocaleString(), time: timeText });
    }
  }
}

function refreshBedProgressSummary() {
  const { currentLevel, ownedExp, bedHourly, targetLevel } = readBedProgressState();
  const nextLevelBonusHours = getNextLevelSpeedupHours(currentLevel, ownedExp, bedHourly);
  const { levelupTs, minutesNeeded } = computeEtaToNextLevel(
    currentLevel,
    ownedExp,
    bedHourly,
    nextLevelBonusHours
  );
  renderLevelupTimeText(minutesNeeded, levelupTs);

  const {
    minutesNeeded: targetMinutesNeeded,
    etaTs,
    bonusHours: targetBonusHours,
  } = computeEtaToTargetLevel(currentLevel, ownedExp, bedHourly, targetLevel);
  renderTargetEtaText(targetMinutesNeeded, etaTs);
  localizeEtaDisplays(minutesNeeded, levelupTs, targetMinutesNeeded, etaTs);

  updateExpRequirements(currentLevel, ownedExp, targetLevel);
  updateSpeedupHints(nextLevelBonusHours, targetBonusHours);

  return {
    currentLevel,
    ownedExp,
    bedHourly,
    targetLevel,
    nextLevelBonusHours,
    targetBonusHours,
    levelupTs,
    minutesNeeded,
    etaTs,
    targetMinutesNeeded,
  };
}

/* -----------------------------
 * 蝯曹???
 * ---------------------------*/
function triggerRecalculate(containers) {
  const payload = computeAll(containers);
  renderResults(containers, payload, state.missingFiles);
  refreshBedProgressSummary();
  saveAllInputs();
  return;

  const curLv = parseInt(document.getElementById('character-current')?.value) || 0;
  const ownedWanStr = document.getElementById('owned-exp-wan')?.value?.trim();
  const ownedWan = ownedWanStr === '' ? NaN : parseFloat(ownedWanStr);
  const bedHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;

  const ownedExpInput = document.getElementById('owned-exp');
  if (ownedExpInput) {
    if (seasonOptions.some((s) => s.season >= 4)) {
      // S4 隞亙??箏雿?蝞?
      ownedExpInput.value = isNaN(ownedWan) ? '' : Math.floor(ownedWan * 100000000);
    }
    else {
      // S1-S3 隞誑?祉?桐???
      ownedExpInput.value = isNaN(ownedWan) ? '' : Math.floor(ownedWan * 10000);
    }
  }
  const ownedExp = parseInt(ownedExpInput?.value) || 0;

  const { levelupTs, minutesNeeded } = computeEtaToNextLevel(curLv, ownedExp, bedHourly);
  renderLevelupTimeText(minutesNeeded, levelupTs);

  const targetChar = parseInt(document.getElementById('target-character')?.value) || 0;
  const { minutesNeeded: m2, etaTs } =
    computeEtaToTargetLevel(curLv, ownedExp, bedHourly, targetChar);
  renderTargetEtaText(m2, etaTs);

  updateExpRequirements(curLv, ownedExp, targetChar);
  saveAllInputs();
}

// 霈????皞? input嚗??交活??/ 撟喳???/ ??瘥鞈潸眺嚗?
// 瑼?: controller.js (甇文撘?霈?嚗?摰?脣? rolaCost ????

function getMaterialInput(source, material, role) {
  const el = document.querySelector(
    `.material-source-input[data-source="${source}"][data-material="${material}"][data-role="${role}"]`
  );

  if (!el) return 0;

  const v = parseFloat(el.value);
  return Number.isNaN(v) ? 0 : v;
}


/* -----------------------------
 * 憿舐內????蝬?
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
  if (elNext) elNext.textContent = t('next_level_exp', { value: needNextExp.toLocaleString() });
  if (elTarget) elTarget.textContent = t('target_level_exp', { value: needTargetExp.toLocaleString() });
}

/* -----------------------------
 * 瘥??郊?湔蝬?
 * ---------------------------*/
function setupAutoUpdate(containers) {
  setInterval(() => {
    refreshBedProgressSummary();
    return;

    const curLv = parseInt(document.getElementById('character-current')?.value) || 0;
    const ownedWanStr = document.getElementById('owned-exp-wan')?.value?.trim();
    const ownedWan = ownedWanStr === '' ? NaN : parseFloat(ownedWanStr);
    const bedHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;
    const targetChar = parseInt(document.getElementById('target-character')?.value) || 0;

    const ownedExpInput = document.getElementById('owned-exp');
    if (!ownedExpInput || isNaN(ownedWan)) return;

    if (seasonOptions.some((s) => s.season >= 4)) {
      // S4 隞亙??箏雿?蝞?
      ownedExpInput.value = Math.floor(ownedWan * 100000000);
    }
    else {
      // S1-S3 隞誑?祉?桐???
      ownedExpInput.value = Math.floor(ownedWan * 10000);
    }
    const base = parseFloat(ownedExpInput.value) || ownedWan * 10000;
    const newExp = base + (bedHourly / 3600);
    ownedExpInput.value = Math.floor(newExp);
    const ownedExp = parseInt(ownedExpInput.value) || 0;

    const { levelupTs, minutesNeeded } =
      computeEtaToNextLevel(curLv, ownedExp, bedHourly);
    renderLevelupTimeText(minutesNeeded, levelupTs);

    const { minutesNeeded: m2, etaTs } =
      computeEtaToTargetLevel(curLv, ownedExp, bedHourly, targetChar);
    renderTargetEtaText(m2, etaTs);

    updateExpRequirements(curLv, ownedExp, targetChar);
  }, 1000);
}

/* -----------------------------
 * 敺?Google 閰衣?銵刻??撩??賊???
 * 銵券嚗erver_name, description, time
 * 憿舐內??嚗erver_name
 * ---------------------------*/
async function fetchServerOptionsFromSheet() {
  const url = getGoogleSheetCsvUrl(TIME_PRESETS_SHEET);
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const rows = parseCsvRows(await res.text());
    const headers = (rows.shift() || []).map(normalizeHeader);

    const out = [];
    rows.forEach((cols) => {
      const server = getCsvValue(cols, headers, ['server_name', '伺服器', 'server']);
      const normalizedServer = normalizeServerName(server);
      if (normalizedServer) out.push(normalizedServer);
    });
    return mergeServerOptions(out);
  } catch (err) {
    console.warn('[server options] fetch failed, using fallback', err);
    return ['台港澳'];
  }
}

/* -----------------------------
 * 敺?Google 閰衣?銵刻??????
 * 銵券嚗erver_name, description, time
 * 憿舐內??嚗description} ({server_name})
 * ??銝敺???閰脫??08:00嚗?08:00嚗?
 * ---------------------------*/
async function fetchTimePresetsFromSheet(dungeonPowerRows = []) {
  const url = getGoogleSheetCsvUrl(TIME_PRESETS_SHEET);
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const rows = parseCsvRows(await res.text());
    const headers = (rows.shift() || []).map(normalizeHeader);

    const out = [];
    rows.forEach((cols, index) => {
      const server = normalizeServerName(getCsvValue(cols, headers, ['server_name', '伺服器', 'server']));
      const desc = getCsvValue(cols, headers, ['description', '說明', '描述']);
      const time = getCsvValue(cols, headers, ['time', '時間', '日期']);
      const rawSeasonId = getCsvValue(cols, headers, ['season_id', '賽季', 'season']);
      if (!server && !desc && !time) return;

      // ?芸??交?嚗敺???08:00:00+08:00
      let datePart = '';

      if (time.includes('T')) {
        // 撌脩???ISO 敶Ｗ? ???芸??交?
        datePart = time.split('T')[0];
      } else {
        // 靘???025/10/13????025-10-13??
        const m = time.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
        if (m) {
          const [, y, mo, d] = m;
          datePart = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
        } else {
          // ??銵停鈭斤策 Date 閰西? parse嚗?璅????
          const d2 = new Date(time);
          if (!Number.isNaN(d2.getTime())) {
            datePart = d2.toISOString().slice(0, 10);
          } else {
            // 摰???停?仿??????
            return;
          }
        }
      }

      const isoTime = `${datePart}T08:00:00+08:00`;

      const inferredSeasonId = normalizeSeasonId(rawSeasonId) || normalizeSeasonId(desc);

      out.push({
        key: `${server}_${index + 1}`,
        season_id: inferredSeasonId,
        server_name: server,
        label: `${desc}`,
        iso: isoTime,
      });
    });
    return withGeneratedDungeonOpenTimes(out, dungeonPowerRows);
  } catch (err) {
    console.warn('[time presets] fetch failed, using fallback', err);
    return withGeneratedDungeonOpenTimes(TIME_PRESETS_FALLBACK.slice(), dungeonPowerRows);
  }
}

/* -----------------------------
 * ???魚摮?????#season-select
 * ??靘? model.js ??seasonOptions ?Ｙ??賊?
 * ---------------------------*/
function initSeasonSelector(containers, saved = null) {
  const seasonSelector = document.getElementById('season-select');
  if (!seasonSelector) return;

  // ??蝛綽??? seasonOptions 撱箇??賊?
  seasonSelector.innerHTML = '';
  seasonOptions.forEach((s) => {
    if (s.readonly) return; // 頝喲??航?鞈賢迤
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = t(`season_name_${s.id}`);
    seasonSelector.appendChild(opt);
  });

  // 憟?脣??魚摮???交?嚗?
  const data = saved ?? JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const savedSeason = data['season-select'];
  const defaultId = seasonOptions[0]?.id || 's2';

  if (savedSeason && seasonOptions.some((s) => s.id === savedSeason)) {
    seasonSelector.value = savedSeason;
    state.seasonId = savedSeason;
  } else {
    seasonSelector.value = defaultId;
    state.seasonId = defaultId;
  }

  // ??鞈賢迤霈嚗神??state + localStorage + ?頛鞈賢迤鞈?
  seasonSelector.addEventListener('change', async () => {
    state.seasonId = seasonSelector.value;

    const latest = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    latest['season-select'] = state.seasonId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));

    await handleSeasonChange(containers);
    updateTargetTimeFormDefaults();
  });
}

function refreshSeasonSelectorLabels() {
  const seasonSelector = document.getElementById('season-select');
  if (!seasonSelector) return;

  Array.from(seasonSelector.options).forEach((option) => {
    option.textContent = t(`season_name_${option.value}`);
  });
}

function positionTooltip(icon, text) {
  if (!icon || !text) return;

  text.classList.add('tooltip-floating');
  const margin = 12;
  const iconRect = icon.getBoundingClientRect();
  const tooltipRect = text.getBoundingClientRect();

  let left = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));

  let top = iconRect.top - tooltipRect.height - 10;
  if (top < margin) top = iconRect.bottom + 10;

  text.style.setProperty('--tooltip-left', `${left}px`);
  text.style.setProperty('--tooltip-top', `${top}px`);
}

function bindTooltipLayers() {
  document.querySelectorAll('.tooltip').forEach((tooltip) => {
    if (tooltip.dataset.floatingBound === '1') return;
    tooltip.dataset.floatingBound = '1';

    const icon = tooltip.querySelector('.tooltip-icon');
    const text = tooltip.querySelector('.tooltip-text');
    if (!icon || !text) return;

    const show = () => {
      tooltip.classList.add('tooltip-active');
      positionTooltip(icon, text);
    };

    const hide = () => {
      tooltip.classList.remove('tooltip-active');
      text.classList.remove('tooltip-floating');
      text.style.removeProperty('--tooltip-left');
      text.style.removeProperty('--tooltip-top');
    };

    tooltip.addEventListener('mouseenter', show);
    tooltip.addEventListener('mouseleave', hide);
    tooltip.addEventListener('focusin', show);
    tooltip.addEventListener('focusout', hide);
  });
}

function applyMobileSectionOrder() {
  const main = document.getElementById('primary-content-grid');
  const targetTimeCard = document.getElementById('target-time-card');
  const relicCard = document.getElementById('relic-card');
  if (!main || !targetTimeCard || !relicCard) return;

  const parent = main.parentElement;
  if (!parent) return;

  if (window.innerWidth <= 767) {
    if (main.previousElementSibling !== null) {
      parent.insertBefore(main, targetTimeCard);
    }
    return;
  }

  if (main.previousElementSibling !== relicCard) {
    parent.insertBefore(main, relicCard.nextSibling);
  }
}

function bindTargetTimeFormToggle() {
  const openButton = document.getElementById('open-target-time-form-btn');
  const closeButton = document.getElementById('close-target-time-form-btn');
  const calculatorPageContent = document.getElementById('calculator-page-content');
  const targetTimeFormPanel = document.getElementById('target-time-form-panel');

  if (!openButton || !closeButton || !calculatorPageContent || !targetTimeFormPanel) return;

  const scrollToToggle = () => {
    const top = openButton.getBoundingClientRect().top + window.scrollY - 24;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  openButton.addEventListener('click', () => {
    calculatorPageContent.classList.add('hidden');
    targetTimeFormPanel.classList.remove('hidden');
    scrollToToggle();
  });

  closeButton.addEventListener('click', () => {
    targetTimeFormPanel.classList.add('hidden');
    calculatorPageContent.classList.remove('hidden');
    scrollToToggle();
  });
}

function updateTargetTimeFormDefaults() {
  const serverSelect = document.getElementById('relay-server-name');
  const serverManualInput = document.getElementById('relay-server-name-manual');
  const serverManualWrap = document.getElementById('relay-server-manual-wrap');
  const serverManualToggle = document.getElementById('relay-server-manual-toggle');
  const seasonSelect = document.getElementById('relay-season');
  const seasonSelector = document.getElementById('season-select');
  const serverSelector = document.getElementById('server-select');
  if (serverSelect && serverSelector?.value) {
    const targetServer = serverSelector.value;
    const hasOption = Array.from(serverSelect.options).some((option) => option.value === targetServer);
    if (hasOption) {
      serverSelect.value = targetServer;
      if (serverManualInput) serverManualInput.value = '';
      if (serverManualWrap) serverManualWrap.classList.add('hidden');
      if (serverManualToggle) serverManualToggle.textContent = '手動輸入';
    } else {
      serverSelect.value = '';
      if (serverManualInput) serverManualInput.value = targetServer;
      if (serverManualWrap) serverManualWrap.classList.remove('hidden');
      if (serverManualToggle) serverManualToggle.textContent = '使用清單';
    }
  }
  if (seasonSelect && seasonSelector?.value) seasonSelect.value = String(seasonSelector.value).toUpperCase();
}

function updateRelicModeButtons() {
  const mode = document.getElementById('relic-ui-mode')?.value || 'compact';
  document.querySelectorAll('.relic-mode-btn').forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('bg-[#2cb5ab]', active);
    button.classList.toggle('text-white', active);
    button.classList.toggle('text-[#0f766e]', !active);
  });
}

function renderDungeonPowerPanel(preset, dungeonPowerRows) {
  const panel = document.getElementById('dungeon-power-panel');
  const fields = document.getElementById('dungeon-power-fields');
  if (!panel || !fields) return;

  const isDungeonPreset = preset && preset !== '__custom__' && isDungeonTimeLabel(preset.label);
  if (!isDungeonPreset) {
    panel.classList.add('hidden');
    fields.innerHTML = '';
    return;
  }

  const powerRow = findDungeonPowerRow(preset, dungeonPowerRows, state.seasonId);
  fields.innerHTML = DUNGEON_DIFFICULTIES.map((difficulty) => {
    const value = formatPowerRequirement(powerRow?.powers?.[difficulty] || '');
    const safeDifficulty = escapeHtml(difficulty);
    const safeValue = escapeHtml(value);
    return `
      <label class="block min-w-0">
        <span class="block text-sm font-semibold mb-1">${safeDifficulty}</span>
        <input
          class="input-field rounded p-2 w-full text-right"
          value="${safeValue}"
          placeholder=""
          disabled
          aria-label="${safeDifficulty}戰力需求"
        />
      </label>
    `;
  }).join('');
  panel.classList.remove('hidden');
}

/* -----------------------------
 * ???撩?銝??詨 #server-select
 * 銝行??詨?蝯?摮 state.serverName
 * ---------------------------*/
async function initServerSelector(containers) {
  const serverSel = document.getElementById('server-select');
  if (!serverSel) return;

  const servers = await fetchServerOptionsFromSheet();
  serverSel.innerHTML = '';
  servers.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    serverSel.appendChild(opt);
  });

  // ?Ｗ儔銋??賊??撩?
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

    // ?撩????啗??亙????格????賊?
    initTargetTimeControls(containers);
    triggerRecalculate(containers);
    updateTargetTimeFormDefaults();
  });
}

/* -----------------------------
 * ?格????批
 * ---------------------------*/
async function initTargetTimeControls(containers) {
  const presetSel = document.getElementById('target-time-preset');
  const displayBox = document.getElementById('target-time-display');
  const customInput = document.getElementById('target-time-custom');
  const hiddenField = document.getElementById('target-time');

  if (!presetSel || !displayBox || !customInput || !hiddenField) return;

  const dungeonPowerRows = await fetchDungeonPowerRows();
  const allPresets = await fetchTimePresetsFromSheet(dungeonPowerRows);
  const selectedServer = normalizeServerName(state.serverName);
  const selectedSeasonId = normalizeSeasonId(state.seasonId);

  // 憛怠 select嚗?整?撩????賊?
  presetSel.innerHTML = '';
  const matchingPresets = allPresets.filter((p) => {
    if (normalizeSeasonId(p.season_id) !== selectedSeasonId) return false;
    if (p.server_name && !areServerGroupsEquivalentOrMerged(p.server_name, selectedServer)) return false;
    return true;
  });
  const hasServerDungeonBaseline = matchingPresets.some((p) =>
    (p.generated_from === 'season_start' || p.generated_from === 'server_open') &&
    p.server_name &&
    areServerGroupsEquivalentOrMerged(p.server_name, selectedServer)
  ) || matchingPresets.some((p) =>
    !p.generated_from &&
    p.server_name &&
    areServerGroupsEquivalentOrMerged(p.server_name, selectedServer) &&
    (
      isDungeonTimeLabel(p.label) ||
      String(p.label || '').includes(DUNGEON_ANCHOR_LABEL)
    )
  );

  matchingPresets.forEach(p => {
    if (hasServerDungeonBaseline && p.generated_from === 'global_dungeon_anchor') return;
    if (p.generated_from === 'season_start') {
      const generatedDungeon = getPresetDungeonName(p);
      const hasManualSameDungeon = matchingPresets.some((candidate) =>
        !candidate.generated_from &&
        candidate.server_name &&
        areServerGroupsEquivalentOrMerged(candidate.server_name, selectedServer) &&
        getPresetDungeonName(candidate) === generatedDungeon
      );
      if (hasManualSameDungeon) return;
    }
    const opt = document.createElement('option');
    opt.value = p.key;
    opt.textContent = p.label;
    presetSel.appendChild(opt);
  });

  // 餈賢??閮???
  const optCustom = document.createElement('option');
  optCustom.value = '__custom__';
  optCustom.textContent = t('custom_target_time');
  presetSel.appendChild(optCustom);

  // ?Ｗ儔?詨?
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
      renderDungeonPowerPanel(null, dungeonPowerRows);

      // ?芾????亦蝛????葆?亦?冽???
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
      renderDungeonPowerPanel(found, dungeonPowerRows);
      const ts = found?.iso || '';
      hiddenField.value = ts;

      if (ts) {
        const d = new Date(ts);
        displayBox.textContent = d.toLocaleString('zh-TW', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      } else {
        displayBox.textContent = '--';
      }
    }

    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    data['target-time-preset'] = presetSel.value;
    data['target-time-custom'] = customInput.value || '';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    updateDaysRemainingFromTarget();
    updateAllMaterialSources();

    triggerRecalculate(containers);
  };

  presetSel.addEventListener('change', apply);
  customInput.addEventListener('input', apply);

  apply();
}

// ??#target-time ?函??拚?憭拇嚗璅???- ?曉??嚗?
function updateDaysRemainingFromTarget() {
  const hidden = document.getElementById('target-time');   // ?梯??格???
  const daysInput = document.getElementById('days-remaining');
  if (!hidden || !daysInput || !hidden.value) return;

  const target = new Date(hidden.value);
  if (Number.isNaN(target.getTime())) return;

  const now = new Date();
  let diffMs = target.getTime() - now.getTime();
  if (diffMs < 0) diffMs = 0;

  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));  // ???詨停敺銝???
  daysInput.value = days;
}

function updateMaterialSourceRow(source, material) {
  const days = parseInt(
    document.getElementById('days-remaining')?.value || '0',
    10
  );

  const totalSpan = document.querySelector(
    `.material-source-total[data-source="${source}"][data-material="${material}"]`
  );
  if (!totalSpan) return;

  let total = 0;

  if (source === 'store') { // TODO: 靽格迤靘??迂??'store'嚗? view.js ??data-source 銝??
    const dailyBuy = getMaterialInput(source, material, 'avg');
    total = dailyBuy * days; // TODO: ??蝝?脣? = 瘥鞈潸眺 ? ?拚?憭拇
  } else {
    const daily = getMaterialInput(source, material, 'daily');
    const avg = getMaterialInput(source, material, 'avg');
    total = daily * avg * days; // TODO: 蝘?/?Ｙ揣蝝?脣? = 瘥甈⊥ ? 撟喳?瘥活 ? ?拚?憭拇
  }

  totalSpan.textContent = total ? total.toLocaleString() : '0';
}


function updateAllMaterialSources() {
  const dungeonMats = ['stone', 'essence', 'sand', 'rola'];
  const exploreMats = ['stone', 'essence', 'sand', 'rola'];
  const storeMats = ['stone', 'essence', 'sand', 'freeze_dried']; 

  dungeonMats.forEach((m) => updateMaterialSourceRow('dungeon', m));
  exploreMats.forEach((m) => updateMaterialSourceRow('explore', m));
  storeMats.forEach((m) => updateMaterialSourceRow('store', m)); 

  updateStoreRolaCost(); 
}


function updateStoreRolaCost() {
  const days =
    parseInt(document.getElementById('days-remaining')?.value || '0', 10) || 0;

  // 蝝?皜???getMaterialSourceConfig().sourceMaterials.store 銝??
  const storeMats = ['stone', 'essence', 'sand', 'freeze_dried'];
  let autoDailyCost = 0; // TODO: ?芸?閮??箇?瘥?梯祥

  storeMats.forEach((mat) => {
    const unit = getMaterialInput('store', mat, 'rola-cost');
    const dailyBuy = getMaterialInput('store', mat, 'avg');
    autoDailyCost += dailyBuy * unit;
  });

  const dailyEl = document.getElementById('store-rola-daily-cost');
  const dailyManualEl = document.getElementById('store-rola-daily-cost-manual');
  const totalEl = document.getElementById('store-rola-total-cost');

  // TODO: ?身雿輻?芸?閮????亥鞎?
  let dailyCost = autoDailyCost;

  // TODO: ?交?憛怒????亥鞎颯??誑???箔蜓嚗征?質??箸憛恬?
  if (dailyManualEl) {
    const manualRaw = dailyManualEl.value.trim();
    if (manualRaw !== '') {
      const manualVal = parseFloat(manualRaw);
      if (!Number.isNaN(manualVal)) {
        dailyCost = manualVal;
      }
    }
  }

  if (dailyEl) dailyEl.textContent = dailyCost ? dailyCost.toLocaleString() : '0';
  if (totalEl) totalEl.textContent = (dailyCost * days).toLocaleString();
}



/* -----------------------------
 * ?典?鈭辣嚗遙雿撓??/ ?豢?霈?賡?蝞?
 * ---------------------------*/
function bindGlobalHandlers(containers) {

  document.addEventListener('input',
    (e) => {
      const t = e.target;
      if (t.tagName === 'INPUT') {
        // 蝝?靘?隡啁?甈?
        if (t.classList.contains('material-source-input')) {
          const src = t.dataset.source;
          const mat = t.dataset.material;
          if (src && mat) updateMaterialSourceRow(src, mat);
          if (src === 'store') updateStoreRolaCost();
        }

      if (t.classList.contains('relic-dist-input')) updateRelicTotal();
      triggerRecalculate(containers);
    }
  }, { passive: true });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.tagName === 'INPUT' || t.tagName === 'SELECT') {
      if (t.id === 'relic-ui-mode') {
        saveAllInputs();
        renderRelicDistribution(containers.relicDistributionInputs);
        loadAllInputs(['season-select']);
        updateRelicModeButtons();
        updateRelicTotal();
        triggerRecalculate(containers);
        return;
      }

      if (t.classList.contains('material-source-input')) {
        const src = t.dataset.source;
        const mat = t.dataset.material;
        if (src && mat) updateMaterialSourceRow(src, mat);
        if (src === 'store') updateStoreRolaCost();
      }

      if (t.classList.contains('relic-dist-input')) updateRelicTotal();
      triggerRecalculate(containers);
    }
  }, { passive: true });

  document.addEventListener('click', (e) => {
    const button = e.target.closest('.relic-mode-btn');
    if (!button) return;

    const select = document.getElementById('relic-ui-mode');
    if (!select || select.value === button.dataset.mode) return;

    select.value = button.dataset.mode;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });

}


/* -----------------------------
 * 鞈賢迤??
 * ---------------------------*/
async function handleSeasonChange(containers) {
  const seasonSelector = document.getElementById('season-select');
  // ??selector 摮撠曹誑?恍?箸?嚗?窒??state ?桀???
  state.seasonId = seasonSelector?.value || state.seasonId || 's2';

  containers.results.innerHTML =
    `<p class="text-gray-500 text-center py-8">${t('loading_season_data')}</p>`;

  await loadDataForSeason(state.seasonId);
  preprocessCostData();

  renderAll(containers);
  bindTooltipLayers();
  loadAllInputs(['season-select']); // 鞈賢迤?冽??撌梁??摩??
  renderRelicDistribution(containers.relicDistributionInputs);
  loadAllInputs(['season-select']);
  updateRelicModeButtons();

  // ??憪?隡箸??券?殷???隡箸??刻??亦璅????
  await initServerSelector(containers);
  await initTargetTimeControls(containers);

  updateRelicTotal();
  triggerRecalculate(containers);
}

/* -----------------------------
 * ??賊?嚗????祈??綽?
 * ---------------------------*/
function openGoogleCalendarEvent({ title, details, eventTs }) {
  const eventStart = new Date(eventTs);
  const eventEnd = new Date(eventTs + 30 * 60 * 1000);
  const formatGoogleCalendarDate = (date) =>
    date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  const calendarUrl = new URL('https://calendar.google.com/calendar/render');
  calendarUrl.searchParams.set('action', 'TEMPLATE');
  calendarUrl.searchParams.set('text', title);
  calendarUrl.searchParams.set('details', details);
  calendarUrl.searchParams.set('location', t('app_title'));
  calendarUrl.searchParams.set(
    'dates',
    `${formatGoogleCalendarDate(eventStart)}/${formatGoogleCalendarDate(eventEnd)}`
  );

  window.open(calendarUrl.toString(), '_blank', 'noopener');
}

function getNotifyLeadMinutes() {
  const notifyTimeSelect = document.getElementById('notify-time-select');
  let notifyTime = 0;
  if (notifyTimeSelect?.value === 'min1') notifyTime = 1;
  else if (notifyTimeSelect?.value === 'min2') notifyTime = 2;
  else if (notifyTimeSelect?.value === 'min3') notifyTime = 3;
  else if (notifyTimeSelect?.value === 'min5') notifyTime = 5;
  return notifyTime;
}

async function enableLevelUpNotifications() {
  const locale = getCurrentLanguage() === 'zh-Hans' ? 'zh-CN' : 'zh-TW';
  const { currentLevel, ownedWan, ownedExp, bedHourly } = readBedProgressState();
  const notifyTime = getNotifyLeadMinutes();

  if (Number.isNaN(ownedWan)) {
    alert(t('calendar_import_unavailable'));
    return;
  }

  const bonusHours = getNextLevelSpeedupHours(currentLevel, ownedExp, bedHourly);
  const { levelupTs } = computeEtaToNextLevel(currentLevel, ownedExp, bedHourly, bonusHours);

  if (!Number.isFinite(levelupTs)) {
    alert(t('calendar_import_unavailable'));
    return;
  }

  const eventTs = levelupTs - notifyTime * 60 * 1000;
  const upgradeTimeText = new Date(levelupTs).toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  openGoogleCalendarEvent({
    title: t('calendar_event_title', { level: currentLevel + 1 }),
    details:
    t('calendar_event_details', {
      notifyMinutes: notifyTime,
      upgradeTime: upgradeTimeText,
    }),
    eventTs,
  });
}

async function enableTargetLevelCalendar() {
  const locale = getCurrentLanguage() === 'zh-Hans' ? 'zh-CN' : 'zh-TW';
  const { currentLevel, ownedWan, ownedExp, bedHourly, targetLevel } = readBedProgressState();
  const notifyTime = getNotifyLeadMinutes();

  if (Number.isNaN(ownedWan) || !Number.isFinite(targetLevel) || targetLevel <= currentLevel) {
    alert(t('calendar_target_unavailable'));
    return;
  }

  const { etaTs } = computeEtaToTargetLevel(currentLevel, ownedExp, bedHourly, targetLevel);
  if (!Number.isFinite(etaTs)) {
    alert(t('calendar_target_unavailable'));
    return;
  }

  const eventTs = etaTs - notifyTime * 60 * 1000;
  const targetTimeText = new Date(etaTs).toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  openGoogleCalendarEvent({
    title: t('calendar_target_event_title', { level: targetLevel }),
    details: t('calendar_target_event_details', {
      notifyMinutes: notifyTime,
      upgradeTime: targetTimeText,
      level: targetLevel,
    }),
    eventTs,
  });
}

/* -----------------------------
 * ????
 * ---------------------------*/
async function init() {
  await initLanguage();
  const containers = getContainers();
  applyMobileSectionOrder();
  renderAll(containers);
  enhanceStaticFieldTooltips();
  bindTooltipLayers();
  bindGlobalHandlers(containers);
  bindTargetTimeFormToggle();

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

  // ??撱箇?鞈賢迤?詨 + 憟?脣???
  initSeasonSelector(containers, saved);

  // ?????
  const levelUpNotifyBtn = document.getElementById('enable-levelup-notify-btn');
  levelUpNotifyBtn?.addEventListener('click', () => enableLevelUpNotifications());
  const targetNotifyBtn = document.getElementById('enable-target-notify-btn');
  targetNotifyBtn?.addEventListener('click', () => enableTargetLevelCalendar());

  const clearLocalDataBtn = document.getElementById('clear-local-data-btn');
  clearLocalDataBtn?.addEventListener('click', () => {
    if (confirm(t('confirm_clear_local_data'))) {
      localStorage.removeItem(STORAGE_KEY);
      alert(t('alert_local_data_cleared'));
      location.reload();
    }
  });

  // ?寞??嗅?鞈賢迤頛撠?鞈?
  await handleSeasonChange(containers);
  updateTargetTimeFormDefaults();
  updateRelicModeButtons();

  // ???亙像?潦??怎???皞?UI
  await loadMaterialAvgDefaults();       // TODO: ?啣?嚗??model.js 銝剔??身撟喳??潸??伐??桀??箏???no-op嚗?
  renderMaterialSource(containers);
  bindTooltipLayers();
  updateDaysRemainingFromTarget();
  updateAllMaterialSources();

  // ?芸??湔蝬???冽???
  setupAutoUpdate(containers);
  setInterval(() => updateCurrentTime(containers.currentTimeDisplay), 1000);
  updateCurrentTime(containers.currentTimeDisplay);
  window.addEventListener('languagechange', () => {
    applyStaticTranslations();
    refreshSeasonSelectorLabels();
    applyMobileSectionOrder();
    renderAll(containers);
    enhanceStaticFieldTooltips();
    bindTooltipLayers();
    loadAllInputs(['season-select']);
    renderRelicDistribution(containers.relicDistributionInputs);
    loadAllInputs(['season-select']);
    updateRelicModeButtons();
    updateTargetTimeFormDefaults();
    renderMaterialSource(containers);
    bindTooltipLayers();
    updateDaysRemainingFromTarget();
    updateAllMaterialSources();
    updateRelicTotal();
    triggerRecalculate(containers);
    applyStaticTranslations();
  });
  window.addEventListener('resize', applyMobileSectionOrder, { passive: true });
}

document.addEventListener('DOMContentLoaded', init);

