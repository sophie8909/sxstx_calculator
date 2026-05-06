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
const PRIMORDIAL_RECOMMENDATION_SHEET = {
  id: '1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E',
  gid: '1955218134',
};
const DUNGEON_DIFFICULTIES = ['普通', '困難', '惡夢', '煉獄', '深淵'];
const PRIMORDIAL_RECOMMENDATION_TIERS = [
  ['normal', '微氪 normal'],
  ['heavy', '中氪 heavy'],
  ['super', '頂氪 super'],
];
const FRAGMENT_FEE_RATES = {
  normal: [10, 20, 30, 50, 70],
  discount: [5, 12, 20, 40, 60],
};
const TARGET_RECOMMENDATION_FIELDS = {
  equipment_level: 'target-equipment_resonance',
  skill_level: 'target-skill_resonance',
  pet_level: 'target-pet_resonance',
  relic_level: 'target-relic_resonance',
};
let dungeonPowerRowsCache = null;
let primordialRecommendationRowsCache = null;
let fragmentRowsCache = null;
let dungeonFragmentYieldRowsCache = null;
const ACTIVE_PAGE_STORAGE_KEY = 'sxstxCalculatorActivePage';

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

function parseNumberValue(value) {
  const raw = String(value ?? '').replace(/,/g, '').trim();
  if (!raw) return 0;
  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
}

function makeFragmentKey(row, fragmentName, stoneAmount, fragmentHeader) {
  return [
    normalizeSeasonId(row.season_id),
    row.dungeon_name,
    fragmentHeader,
    fragmentName,
    stoneAmount,
  ].join('|');
}

function parseFragmentRowsFromCsvRows(rows) {
  const headers = (rows.shift() || []).map((header) => String(header || '').trim());
  const findHeaderIndex = (names) => headers.findIndex((header) => names.some((name) => header === name));
  const fragmentIndex = findHeaderIndex(['裝備碎片']);
  const infernoIndex = findHeaderIndex(['煉獄裝', '神裝']);
  const infernoStoneIndex = findHeaderIndex(['煉獄分解神鑄石', '神級分解神鑄石']);
  const mythicStoneIndex = findHeaderIndex(['神話分解神鑄石', '傳說分解神鑄石']);
  const miracleStoneIndex = findHeaderIndex(['奇蹟分解神鑄石']);
  const fragmentColumns = [];

  if (fragmentIndex >= 0) {
    const stoneColumns = [
      { stoneIndex: mythicStoneIndex, stoneHeader: headers[mythicStoneIndex] || '神話分解神鑄石', displayTier: '紅' },
      { stoneIndex: miracleStoneIndex, stoneHeader: headers[miracleStoneIndex] || '奇蹟分解神鑄石', displayTier: '金' },
    ].filter((column) => column.stoneIndex >= 0);
    if (stoneColumns.length > 0) fragmentColumns.push({
      fragmentIndex,
      stoneColumns,
      header: headers[fragmentIndex],
    });
  }

  if (infernoIndex >= 0 && infernoStoneIndex >= 0) {
    fragmentColumns.push({
      fragmentIndex: infernoIndex,
      stoneColumns: [{
        stoneIndex: infernoStoneIndex,
        stoneHeader: headers[infernoStoneIndex] || '煉獄分解神鑄石',
        displayTier: '煉獄',
      }],
      header: headers[infernoIndex],
    });
  }

  if (fragmentColumns.length === 0) {
    headers.forEach((header, index) => {
      if (!header.includes('裝備碎片')) return;

      const stoneColumns = [];
      for (let candidateIndex = index + 1; candidateIndex < headers.length; candidateIndex += 1) {
        const candidate = headers[candidateIndex];
        if (candidate.includes('裝備碎片')) break;
        if (candidate.includes('分解神鑄石') || candidate.includes('神鑄石')) {
          stoneColumns.push({ stoneIndex: candidateIndex, stoneHeader: candidate });
        }
      }

      if (stoneColumns.length > 0) fragmentColumns.push({ fragmentIndex: index, stoneColumns, header });
    });
  }

  const seen = new Set();
  const parsed = [];
  rows.forEach((row) => {
    const base = {
      season_id: normalizeSeasonId(row[0]),
      server_day: Number(row[1]),
      season_day: Number(row[2]),
      dungeon_name: String(row[3] || '').trim(),
    };

    fragmentColumns.forEach(({ fragmentIndex, stoneColumns, header }) => {
      const fragmentName = String(row[fragmentIndex] || '').trim();
      if (!fragmentName) return;

      stoneColumns.forEach(({ stoneIndex, stoneHeader, displayTier }) => {
        const rawStoneAmount = String(row[stoneIndex] ?? '').trim();
        const stoneAmount = parseNumberValue(rawStoneAmount);

        const item = {
          ...base,
          fragment_name: fragmentName,
          fragment_header: header,
          stone_header: stoneHeader,
          display_tier: displayTier || '',
          has_stone_value: rawStoneAmount !== '',
          stone_per_fragment: stoneAmount,
        };
        const key = makeFragmentKey(item, fragmentName, stoneAmount, stoneHeader);
        if (seen.has(key)) return;
        seen.add(key);
        parsed.push(item);
      });
    });
  });

  return parsed;
}

async function fetchFragmentRows() {
  if (fragmentRowsCache) return fragmentRowsCache;

  const url = getGoogleSheetCsvUrl(DUNGEON_POWER_SHEET);
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    fragmentRowsCache = parseFragmentRowsFromCsvRows(parseCsvRows(await res.text()));
  } catch (err) {
    console.warn('[fragment calculator] fetch failed', err);
    fragmentRowsCache = [];
  }

  return fragmentRowsCache;
}

function getHeaderIndex(headers, names) {
  return headers.findIndex((header) => names.some((name) => header === name));
}

function parseDungeonFragmentYieldRows(csvRows) {
  const headers = (csvRows.shift() || []).map((header) => String(header || '').trim());
  const index = {
    season: getHeaderIndex(headers, ['賽季', 'season']),
    serverDay: getHeaderIndex(headers, ['天數', 'server_day']),
    seasonDay: getHeaderIndex(headers, ['開國天數', '開国天數', 'season_day']),
    dungeon: getHeaderIndex(headers, ['副本', 'dungeon']),
    equipmentFragment: getHeaderIndex(headers, ['裝備碎片']),
    infernoGear: getHeaderIndex(headers, ['煉獄裝', '神裝']),
    normalPieces: getHeaderIndex(headers, ['普通碎片量']),
    hardPieces: getHeaderIndex(headers, ['困難碎片量']),
    nightmarePieces: getHeaderIndex(headers, ['惡夢碎片量', '噩夢碎片量']),
    hellPieces: getHeaderIndex(headers, ['煉獄碎片量']),
    abyssPieces: getHeaderIndex(headers, ['深淵碎片量']),
    infernoStone: getHeaderIndex(headers, ['煉獄分解神鑄石', '神級分解神鑄石']),
    mythicStone: getHeaderIndex(headers, ['神話分解神鑄石', '傳說分解神鑄石']),
    miracleStone: getHeaderIndex(headers, ['奇蹟分解神鑄石']),
  };

  return csvRows
    .map((row) => ({
      season_id: normalizeSeasonId(row[index.season]),
      server_day: Number(row[index.serverDay]) || 0,
      season_day: Number(row[index.seasonDay]) || 0,
      dungeon_name: String(row[index.dungeon] || '').trim(),
      equipment_fragment: String(row[index.equipmentFragment] || '').trim(),
      inferno_gear: String(row[index.infernoGear] || '').trim(),
      normal_pieces: parseNumberValue(row[index.normalPieces]) || 8,
      hard_pieces: parseNumberValue(row[index.hardPieces]) || 10,
      nightmare_pieces: parseNumberValue(row[index.nightmarePieces]) || 8,
      hell_pieces: parseNumberValue(row[index.hellPieces]) || 10,
      abyss_pieces: parseNumberValue(row[index.abyssPieces]) || 3,
      inferno_stone: parseNumberValue(row[index.infernoStone]),
      mythic_stone: parseNumberValue(row[index.mythicStone]),
      miracle_stone: parseNumberValue(row[index.miracleStone]),
    }))
    .filter((row) => row.dungeon_name && (row.equipment_fragment || row.inferno_gear));
}

async function fetchDungeonFragmentYieldRows() {
  if (dungeonFragmentYieldRowsCache) return dungeonFragmentYieldRowsCache;

  const url = getGoogleSheetCsvUrl(DUNGEON_POWER_SHEET);
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    dungeonFragmentYieldRowsCache = parseDungeonFragmentYieldRows(parseCsvRows(await res.text()));
  } catch (err) {
    console.warn('[fragment dungeon yield] fetch failed', err);
    dungeonFragmentYieldRowsCache = [];
  }

  return dungeonFragmentYieldRowsCache;
}

async function fetchPrimordialRecommendationRows() {
  if (primordialRecommendationRowsCache) return primordialRecommendationRowsCache;

  const url = getGoogleSheetCsvUrl(PRIMORDIAL_RECOMMENDATION_SHEET);
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const rows = parseCsvRows(await res.text());
    const headers = (rows.shift() || []).map(normalizeHeader);

    primordialRecommendationRowsCache = rows
      .map((row) => ({
        season_id: normalizeSeasonId(getCsvValue(row, headers, ['season', '賽季'])),
        type: getCsvValue(row, headers, ['type', '檔位']).toLowerCase(),
        star: getCsvValue(row, headers, ['star', '原初']),
        equipment_level: getCsvValue(row, headers, ['equipment_level', '裝備等級']),
        skill_level: getCsvValue(row, headers, ['skill_level', '技能等級']),
        pet_level: getCsvValue(row, headers, ['pet_level', '寵物等級']),
        relic_level: getCsvValue(row, headers, ['relic_level', '遺物等級']),
      }))
      .filter((row) => row.season_id && row.type);
  } catch (err) {
    console.warn('[primordial recommendations] fetch failed', err);
    primordialRecommendationRowsCache = [];
  }

  return primordialRecommendationRowsCache;
}

function getRecommendationForCurrentSeason(rows, type) {
  const currentSeason = normalizeSeasonId(state.seasonId);
  return rows.find((item) => item.season_id === currentSeason && item.type === type) || null;
}

async function renderPrimordialRecommendations() {
  const panel = document.getElementById('primordial-recommendation-panel');
  const fields = document.getElementById('primordial-recommendation-fields');
  if (!panel || !fields) return;

  const rows = await fetchPrimordialRecommendationRows();

  fields.innerHTML = PRIMORDIAL_RECOMMENDATION_TIERS.map(([key, label]) => {
    const row = getRecommendationForCurrentSeason(rows, key);
    const value = row?.star || '';
    return `
      <label class="block min-w-0">
        <span class="block text-sm font-semibold mb-1">${escapeHtml(label)}</span>
        <input
          class="input-field rounded p-2 w-full text-right"
          value="${escapeHtml(value)}"
          disabled
          aria-label="${escapeHtml(label)}累計原初推薦"
        />
      </label>
    `;
  }).join('');
}

async function applyTargetRecommendation(type) {
  if (!type || type === 'custom') return;

  const rows = await fetchPrimordialRecommendationRows();
  const recommendation = getRecommendationForCurrentSeason(rows, type);
  if (!recommendation) return;

  Object.entries(TARGET_RECOMMENDATION_FIELDS).forEach(([field, inputId]) => {
    const input = document.getElementById(inputId);
    const value = recommendation[field];
    if (input && value !== '') input.value = value;
  });
}

async function applySelectedTargetRecommendationIfNeeded() {
  const type = document.getElementById('target-recommendation-type')?.value || 'custom';
  if (type !== 'custom') await applyTargetRecommendation(type);
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
  const navButtons = Array.from(document.querySelectorAll('.calculator-nav-btn'));
  const calculatorPageContent = document.getElementById('calculator-page-content');
  const fragmentCalculatorPanel = document.getElementById('fragment-calculator-panel');
  const targetTimeFormPanel = document.getElementById('target-time-form-panel');

  if (!navButtons.length || !calculatorPageContent || !fragmentCalculatorPanel || !targetTimeFormPanel) return;

  const scrollToToggle = () => {
    const firstButton = navButtons[0];
    const top = firstButton.getBoundingClientRect().top + window.scrollY - 24;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  const panels = {
    primordial: calculatorPageContent,
    fragment: fragmentCalculatorPanel,
    'target-time-form': targetTimeFormPanel,
  };

  const showPage = (page, shouldScroll = true) => {
    const targetPage = panels[page] ? page : 'primordial';
    Object.entries(panels).forEach(([key, panel]) => {
      panel.classList.toggle('hidden', key !== targetPage);
    });

    navButtons.forEach((button) => {
      const active = button.dataset.page === targetPage;
      button.classList.toggle('bg-[#2cb5ab]', active);
      button.classList.toggle('hover:bg-[#23a69d]', active);
      button.classList.toggle('bg-gray-600', !active);
      button.classList.toggle('hover:bg-gray-500', !active);
    });

    localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, targetPage);
    if (shouldScroll) scrollToToggle();
  };

  navButtons.forEach((button) => {
    button.addEventListener('click', () => showPage(button.dataset.page || 'primordial'));
  });

  showPage(localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY) || 'primordial', false);
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

function getFragmentDisplayName(row) {
  const baseName = String(row?.fragment_name || '').trim();
  const fragmentName = baseName.endsWith('碎片') ? baseName : `${baseName}碎片`;
  const stoneType = row?.display_tier || String(row?.stone_header || '')
    .replace('分解神鑄石', '')
    .replace('神鑄石', '')
    .replace('奇蹟', '金')
    .replace('神話', '紅')
    .trim();
  const typeSuffix = stoneType ? `（${stoneType}）` : '';
  const dungeonSuffix = row?.dungeon_name ? ` - ${row.dungeon_name}` : '';
  return `${fragmentName}${typeSuffix}${dungeonSuffix}`;
}

function formatFragmentNumber(value, fractionDigits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return number.toLocaleString('zh-Hant', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  });
}

function getSelectedFragmentRow() {
  const select = document.getElementById('fragment-kind');
  const index = Number(select?.value);
  if (!Number.isInteger(index) || index < 0) return null;
  return fragmentRowsCache?.[index] || null;
}

function getPreviousSeasonId(seasonId) {
  const seasonNumber = Number(String(seasonId || '').replace(/^s/i, ''));
  if (!Number.isFinite(seasonNumber) || seasonNumber <= 1) return '';
  return `s${seasonNumber - 1}`;
}

function getPreviousSeasonFinalDungeonName(rows, seasonId) {
  const previousSeasonId = getPreviousSeasonId(seasonId);
  if (!previousSeasonId) return '';

  const finalRow = rows
    .filter((row) => row.season_id === previousSeasonId && row.dungeon_name)
    .sort((a, b) => (b.server_day || 0) - (a.server_day || 0))[0];
  return finalRow?.dungeon_name || '';
}

function filterRowsForCurrentAndPreviousFinal(rows) {
  const currentSeason = normalizeSeasonId(state.seasonId);
  const previousSeasonId = getPreviousSeasonId(currentSeason);
  const previousFinalDungeon = getPreviousSeasonFinalDungeonName(rows, currentSeason);

  return rows.filter((row) => (
    row.season_id === currentSeason ||
    (
      previousSeasonId &&
      row.season_id === previousSeasonId &&
      row.dungeon_name === previousFinalDungeon
    )
  ));
}

function updateFragmentFeeRates() {
  const discount = document.getElementById('fragment-discount-fee')?.checked || false;
  const feeSelect = document.getElementById('fragment-fee-rate');
  if (!feeSelect) return;

  const mode = discount ? 'discount' : 'normal';
  const current = feeSelect.value;
  const rates = FRAGMENT_FEE_RATES[mode];
  feeSelect.innerHTML = rates.map((rate) => `<option value="${rate}">${rate}%</option>`).join('');
  feeSelect.value = rates.map(String).includes(current) ? current : String(rates[0]);

  document.querySelectorAll('.fragment-fee-mode-btn').forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('bg-[#2cb5ab]', active);
    button.classList.toggle('text-white', active);
    button.classList.toggle('text-[#0f766e]', !active);
  });
}

function updateFragmentCalculator() {
  const row = getSelectedFragmentRow();
  const output = document.getElementById('fragment-stone-output');
  const quantity = parseNumberValue(document.getElementById('fragment-quantity')?.value);
  const fragmentPrice = parseNumberValue(document.getElementById('fragment-price')?.value);
  const stonePrice = parseNumberValue(document.getElementById('fragment-stone-price')?.value);
  const feeRate = parseNumberValue(document.getElementById('fragment-fee-rate')?.value);
  const selectedKey = document.getElementById('fragment-kind')?.value || '';
  const hasSheetStoneValue = row?.has_stone_value === true;

  if (output) {
    const previousKey = output.dataset.fragmentKey || '';
    output.dataset.fragmentKey = selectedKey;
    output.disabled = hasSheetStoneValue;
    if (previousKey && previousKey !== selectedKey && !hasSheetStoneValue) output.value = '0';
  }

  const stoneOutput = hasSheetStoneValue
    ? quantity * row.stone_per_fragment
    : parseNumberValue(output?.value);
  const buyCost = quantity * fragmentPrice;
  const saleBeforeFee = stoneOutput * stonePrice;
  const saleAfterFee = saleBeforeFee * (1 - feeRate / 100);
  const moonStarGain = saleAfterFee - buyCost;

  if (output && hasSheetStoneValue) output.value = formatFragmentNumber(stoneOutput, 2);

  const result = document.getElementById('fragment-calculator-result');
  if (result) {
    result.innerHTML = `
      <div>可獲得晨星數：${formatFragmentNumber(moonStarGain, 2)}</div>
      <div class="mt-2 text-sm font-normal text-slate-600">
        購買成本 ${formatFragmentNumber(buyCost, 2)}，出售扣稅後 ${formatFragmentNumber(saleAfterFee, 2)}
      </div>
    `;
  }
}

function getDungeonYieldDisplayRows(row) {
  if (!row) return [];

  return [
    {
      name: '普通',
      fragment: row.equipment_fragment,
      tier: '金',
      pieces: row.normal_pieces,
      stonePerPiece: row.miracle_stone,
    },
    {
      name: '困難',
      fragment: row.equipment_fragment,
      tier: '金',
      pieces: row.hard_pieces,
      stonePerPiece: row.miracle_stone,
    },
    {
      name: '惡夢',
      fragment: row.equipment_fragment,
      tier: '紅',
      pieces: row.nightmare_pieces,
      stonePerPiece: row.mythic_stone,
    },
    {
      name: '煉獄',
      fragment: row.equipment_fragment,
      tier: '紅',
      pieces: row.hell_pieces,
      stonePerPiece: row.mythic_stone,
    },
    {
      name: '深淵',
      fragment: row.inferno_gear,
      tier: '煉獄',
      pieces: row.abyss_pieces,
      stonePerPiece: row.inferno_stone,
    },
  ];
}

function getPreviousSeasonFinalDungeon(rows, row) {
  const previousSeasonId = getPreviousSeasonId(row?.season_id);
  if (!previousSeasonId) return null;

  const previousFinalDungeon = getPreviousSeasonFinalDungeonName(rows, row.season_id);
  const candidates = rows
    .filter((candidate) => (
      candidate.season_id === previousSeasonId &&
      candidate.dungeon_name === previousFinalDungeon &&
      candidate.equipment_fragment
    ))
    .sort((a, b) => (b.server_day || 0) - (a.server_day || 0));
  return candidates[0] || null;
}

function renderDungeonYieldCard(item, extraLabel = '') {
  if (!item.fragment) {
    return `
      <div class="info-item rounded-lg p-3">
        <div class="font-bold">${escapeHtml(item.name)}${extraLabel}</div>
        <div class="text-sm text-slate-600 mt-1">無對應碎片資料</div>
      </div>
    `;
  }

  const total = item.pieces * item.stonePerPiece;
  const fragmentName = item.fragment.endsWith('碎片') ? item.fragment : `${item.fragment}碎片`;
  const detail = item.stonePerPiece > 0
    ? `${formatFragmentNumber(item.pieces)} 片 × ${formatFragmentNumber(item.stonePerPiece, 2)} = ${formatFragmentNumber(total, 2)}`
    : '缺少分解神鑄石數量';

  return `
    <div class="info-item rounded-lg p-3">
      <div class="font-bold">${escapeHtml(item.name)}${extraLabel}</div>
      <div class="text-sm text-slate-600 mt-1">${escapeHtml(fragmentName)}（${escapeHtml(item.tier)}）</div>
      <div class="mt-2 text-lg font-bold">${formatFragmentNumber(total, 2)}</div>
      <div class="text-xs text-slate-500">${escapeHtml(detail)}</div>
    </div>
  `;
}

function updateDungeonFragmentYield() {
  const select = document.getElementById('fragment-dungeon-select');
  const result = document.getElementById('fragment-dungeon-yield-result');
  if (!select || !result) return;

  const row = dungeonFragmentYieldRowsCache?.[Number(select.value)] || null;
  if (!row) {
    result.innerHTML = '<div class="text-sm text-slate-600">目前沒有可用的副本碎片資料。</div>';
    return;
  }

  const rows = getDungeonYieldDisplayRows(row);
  const previousRow = getPreviousSeasonFinalDungeon(dungeonFragmentYieldRowsCache || [], row);
  if (previousRow) {
    const hasPreviousAbyss = previousRow.inferno_gear && previousRow.inferno_stone > 0;
    rows.push({
      name: `上季最後副本 ${previousRow.dungeon_name} ${hasPreviousAbyss ? '深淵' : '煉獄'}`,
      fragment: hasPreviousAbyss ? previousRow.inferno_gear : previousRow.equipment_fragment,
      tier: hasPreviousAbyss ? '煉獄' : '紅',
      pieces: hasPreviousAbyss ? previousRow.abyss_pieces : previousRow.hell_pieces,
      stonePerPiece: hasPreviousAbyss ? previousRow.inferno_stone : previousRow.mythic_stone,
    });
  }

  result.innerHTML = rows.map((item) => renderDungeonYieldCard(item)).join('');
}

async function initFragmentCalculator(saved = {}) {
  const select = document.getElementById('fragment-kind');
  const status = document.getElementById('fragment-calculator-status');
  if (!select) return;

  if (status) status.textContent = '正在載入碎片資料...';
  const rows = await fetchFragmentRows();
  const visibleRows = filterRowsForCurrentAndPreviousFinal(rows);
  select.innerHTML = visibleRows.map((row) => {
    const index = rows.indexOf(row);
    return `<option value="${index}">${escapeHtml(getFragmentDisplayName(row))}</option>`;
  }).join('');

  if (visibleRows.length === 0) {
    select.innerHTML = '<option value="">目前賽季沒有可用的碎片資料</option>';
    select.disabled = true;
    if (status) status.textContent = '目前賽季沒有可用的碎片與神鑄石資料。';
  } else {
    select.disabled = false;
    const savedValue = saved['fragment-kind'];
    const hasSavedOption = Array.from(select.options).some((option) => option.value === savedValue);
    if (hasSavedOption) select.value = savedValue;
    if (status) status.textContent = `已載入 ${visibleRows.length} 筆當前賽季與上季末副本分解資料。`;
  }

  updateFragmentFeeRates();
  updateFragmentCalculator();
}

async function initDungeonFragmentYield(saved = {}) {
  const select = document.getElementById('fragment-dungeon-select');
  if (!select) return;

  const rows = await fetchDungeonFragmentYieldRows();
  const visibleRows = filterRowsForCurrentAndPreviousFinal(rows);
  select.innerHTML = visibleRows.map((row) => {
    const index = rows.indexOf(row);
    return `<option value="${index}">${escapeHtml(String(row.season_id || '').toUpperCase())} ${escapeHtml(row.dungeon_name)}</option>`;
  }).join('');

  if (visibleRows.length === 0) {
    select.innerHTML = '<option value="">目前賽季沒有可用的副本資料</option>';
    select.disabled = true;
  } else {
    select.disabled = false;
    const savedValue = saved['fragment-dungeon-select'];
    const hasSavedOption = Array.from(select.options).some((option) => option.value === savedValue);
    if (hasSavedOption) select.value = savedValue;
  }

  updateDungeonFragmentYield();
}

function markTargetRecommendationCustom(target) {
  if (!target?.id || !target.id.startsWith('target-')) return;
  if (target.id === 'target-primordial_star') return;

  const selector = document.getElementById('target-recommendation-type');
  if (selector && selector.value !== 'custom') selector.value = 'custom';
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
        if (t.id?.startsWith('fragment-')) {
          updateFragmentCalculator();
          saveAllInputs();
          return;
        }

        markTargetRecommendationCustom(t);

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
      if (t.id?.startsWith('fragment-')) {
        if (t.id === 'fragment-discount-fee') updateFragmentFeeRates();
        if (t.id === 'fragment-dungeon-select') updateDungeonFragmentYield();
        updateFragmentCalculator();
        saveAllInputs();
        return;
      }

      if (t.tagName === 'INPUT') markTargetRecommendationCustom(t);

      if (t.id === 'relic-ui-mode') {
        saveAllInputs();
        renderRelicDistribution(containers.relicDistributionInputs);
        loadAllInputs(['season-select']);
        updateRelicModeButtons();
        updateRelicTotal();
        triggerRecalculate(containers);
        return;
      }

      if (t.id === 'target-recommendation-type') {
        saveAllInputs();
        applyTargetRecommendation(t.value).then(() => {
          saveAllInputs();
          triggerRecalculate(containers);
        });
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
    const feeButton = e.target.closest('.fragment-fee-mode-btn');
    if (feeButton) {
      const checkbox = document.getElementById('fragment-discount-fee');
      if (!checkbox) return;

      checkbox.checked = feeButton.dataset.mode === 'discount';
      updateFragmentFeeRates();
      updateFragmentCalculator();
      saveAllInputs();
      return;
    }

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
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  await initFragmentCalculator(saved);
  await initDungeonFragmentYield(saved);
  await renderPrimordialRecommendations();
  await applySelectedTargetRecommendationIfNeeded();

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
  await initFragmentCalculator(saved);
  await initDungeonFragmentYield(saved);

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
  await renderPrimordialRecommendations();
  updateFragmentFeeRates();
  updateFragmentCalculator();

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
    renderPrimordialRecommendations();
    applySelectedTargetRecommendationIfNeeded().then(() => triggerRecalculate(containers));
    updateFragmentFeeRates();
    updateFragmentCalculator();
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

