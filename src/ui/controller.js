// controller.js

import {
  state,
  STORAGE_KEY,
  seasonOptions,
  loadDataForSeason,
  clearRemoteDataMemoryCaches,
  preprocessCostData,
  saveAllInputs,
  loadAllInputs,
  computeAll,
  computeEtaToNextLevel,
  computeEtaToTargetLevel,
  getCharacterCumulativeExp,
  getSpeedupHoursForDays,
  getSpeedupHoursForHours,
  NEXT_SEASON_EXP_HOARD_HOURS,
  NEXT_SEASON_EXP_HOARD_REMINDER_HOURS,
  loadMaterialAvgDefaults, 
  STAMINA_BIG_MINE_EXPECTED_MULTIPLIER,
} from '../model.js';

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
import { applyStaticTranslations, getCurrentLanguage, initLanguage, t } from '../i18n-inline.js';
import { loadServers } from '../services/dataService.js';
import { CACHE_FALLBACK_EVENT, CACHE_UPDATED_EVENT, fetchTextWithCache } from '../services/dataCache.js';

/* ============================================================
 * Google Sheet published CSV settings.
 * Expected columns: server_name, description, time.
 * ============================================================ */
const TIME_PRESETS_SHEET = {
  id: '1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E',
  gid: '859085671',
};
const PLAYER_CODE_PATTERN = /^\d{12}$/;
const seasonMergeMap = {
  s1: 'merge_2',
  s2: 'merge_4',
  s3: 'merge_8',
  s4: 'merge_16',
};
const mergePriority = {
  single: 1,
  merge_2: 2,
  merge_4: 4,
  merge_8: 8,
  merge_16: 16,
};
let isAppLoading = true;
const LOADING_DISABLED_ATTR = 'data-loading-disabled';

function setAppLoading(loading) {
  isAppLoading = loading;
  document.body.classList.toggle('app-loading', loading);
  document.body.setAttribute('aria-busy', loading ? 'true' : 'false');

  const loadingMessage = document.getElementById('app-loading-message');
  if (loadingMessage) loadingMessage.textContent = t('loading_app_data');

  const appShell = document.querySelector('.app-shell');
  if (appShell) {
    appShell.inert = loading;
    appShell.setAttribute('aria-hidden', loading ? 'true' : 'false');
  }

  document.querySelectorAll('button, input, select, textarea').forEach((control) => {
    if (loading) {
      if (!control.disabled) {
        control.disabled = true;
        control.setAttribute(LOADING_DISABLED_ATTR, '1');
      }
      return;
    }

    if (control.getAttribute(LOADING_DISABLED_ATTR) === '1') {
      control.disabled = false;
      control.removeAttribute(LOADING_DISABLED_ATTR);
    }
  });
}

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
const SEASON_END_CATEGORY = '【賽季結束】';
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
  ['normal', 'recommendation_normal'],
  ['heavy', 'recommendation_heavy'],
  ['super', 'recommendation_super'],
];
const FRAGMENT_FEE_RATES = {
  normal: [10, 20, 30, 50, 70],
  discount: [5, 12, 20, 40, 60],
};
const FRAGMENT_GROUP_SIZE = 10;
const FRAGMENT_DECOMPOSE_STONES = {
  miracle: 2,
  mythic: 3,
  abyss: 10,
};
const DUNGEON_FRAGMENT_REWARDS = {
  normal: { pieces: 8, tier: '奇蹟', stonePerPiece: FRAGMENT_DECOMPOSE_STONES.miracle },
  hard: { pieces: 10, tier: '奇蹟', stonePerPiece: FRAGMENT_DECOMPOSE_STONES.miracle },
  nightmare: { pieces: 8, tier: '神話', stonePerPiece: FRAGMENT_DECOMPOSE_STONES.mythic },
  hell: { pieces: 10, tier: '神話', stonePerPiece: FRAGMENT_DECOMPOSE_STONES.mythic },
  abyss: { pieces: 3, tier: '深淵', stonePerPiece: FRAGMENT_DECOMPOSE_STONES.abyss },
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
let serverRowsCache = null;
const ACTIVE_PAGE_STORAGE_KEY = 'sxstxCalculatorActivePage';
const CACHE_REFRESH_DEBOUNCE_MS = 250;
let cacheRefreshTimer = null;
let appContainers = null;

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

function getPresetTitleKey(preset) {
  return String(preset?.label || '').trim();
}

function getPresetTimeKey(preset) {
  const iso = String(preset?.iso || '').trim();
  if (!iso) return '';

  const timestamp = new Date(iso).getTime();
  return Number.isFinite(timestamp) ? String(timestamp) : iso;
}

function formatPresetOptionTime(iso) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return String(iso || '').trim();

  return date.toLocaleString(getCurrentLanguage() === 'en' ? 'en-US' : getCurrentLanguage() === 'zh-Hans' ? 'zh-CN' : 'zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function normalizeTargetTimePresetOptions(presets) {
  const uniquePresets = [];
  const seen = new Set();

  presets.forEach((preset) => {
    const titleKey = getPresetTitleKey(preset);
    const timeKey = getPresetTimeKey(preset);
    const uniqueKey = `${titleKey}\u0000${timeKey}`;
    if (seen.has(uniqueKey)) return;

    seen.add(uniqueKey);
    uniquePresets.push(preset);
  });

  const titleTimes = new Map();
  uniquePresets.forEach((preset) => {
    const titleKey = getPresetTitleKey(preset);
    const timeKey = getPresetTimeKey(preset);
    if (!titleTimes.has(titleKey)) titleTimes.set(titleKey, new Set());
    titleTimes.get(titleKey).add(timeKey);
  });

  return uniquePresets.map((preset) => {
    const titleKey = getPresetTitleKey(preset);
    const needsTimeSuffix = (titleTimes.get(titleKey)?.size || 0) > 1;
    return {
      ...preset,
      displayLabel: needsTimeSuffix
        ? `${preset.label} (${formatPresetOptionTime(preset.iso)})`
        : preset.label,
    };
  });
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

function isSeasonEndTimeLabel(label) {
  return String(label || '').includes('賽季結束');
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

function withDerivedSeasonEndTimes(presets) {
  const derived = [];
  const hasMatchingSeasonEnd = (candidate) => presets.some((preset) =>
    normalizeSeasonId(preset.season_id) === normalizeSeasonId(candidate.season_id) &&
    normalizeServerName(preset.server_name) === normalizeServerName(candidate.server_name) &&
    String(preset.iso || '').slice(0, 10) === String(candidate.iso || '').slice(0, 10) &&
    isSeasonEndTimeLabel(preset.label)
  );

  presets.forEach((preset) => {
    if (!preset.iso || getBaselineKind(preset.label) !== 'season_start' || !isBaselineTimeLabel(preset.label)) return;

    const previousSeasonId = getPreviousSeasonId(preset.season_id);
    if (!previousSeasonId) return;

    const candidate = {
      key: `${preset.key}_season_end_${previousSeasonId}`,
      season_id: previousSeasonId,
      server_name: preset.server_name,
      label: SEASON_END_CATEGORY,
      iso: preset.iso,
      generated_from: 'season_end',
    };
    if (!hasMatchingSeasonEnd(candidate)) derived.push(candidate);
  });

  return derived.length > 0 ? presets.concat(derived) : presets;
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

function parseServerRange(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{4})$/);
  if (!match) return [];

  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];

  const values = [];
  for (let short = Math.min(start, end); short <= Math.max(start, end); short += 1) {
    values.push(String(short).padStart(4, '0'));
  }
  return values;
}

function normalizeMergeState(value) {
  const key = String(value || '').trim();
  return Object.prototype.hasOwnProperty.call(mergePriority, key) ? key : 'single';
}

function normalizeSeasonMergeKey(seasonId) {
  return seasonMergeMap[normalizeSeasonId(seasonId)] || 'merge_16';
}

function getEffectiveMergeKey(server, selectedSeason) {
  if (!server) return 'single';

  const seasonKey = normalizeSeasonMergeKey(selectedSeason);
  const currentKey = normalizeMergeState(server.current_state);
  return mergePriority[currentKey] >= mergePriority[seasonKey] ? currentKey : seasonKey;
}

function getEffectiveServerGroup(server, selectedSeason) {
  if (!server) return '';

  const key = getEffectiveMergeKey(server, selectedSeason);
  return key === 'single' ? server.server_short : (server[key] || server.server_short);
}

function getServerRowsInGroup(groupKey) {
  if (!serverRowsCache || !groupKey) return [];

  const range = parseServerRange(groupKey);
  if (range.length === 0) return serverRowsCache.filter((server) => server.server_short === groupKey);

  const shortSet = new Set(range);
  return serverRowsCache.filter((server) => shortSet.has(server.server_short));
}

function getServerByName(name) {
  const normalizedName = normalizeServerName(name);
  return (serverRowsCache || []).find((server) => normalizeServerName(server.server_name) === normalizedName) || null;
}

function getServerById(serverId) {
  return (serverRowsCache || []).find((server) => server.server_id === String(serverId || '').trim()) || null;
}

function getSelectedServerRow() {
  return getServerByName(state.serverName);
}

function arePresetAndEffectiveGroupMatched(presetServerName, currentServer, selectedSeason) {
  const normalizedPreset = normalizeServerName(presetServerName);
  if (!normalizedPreset) return true;

  const effectiveGroup = getEffectiveServerGroup(currentServer, selectedSeason);
  if (!effectiveGroup) return areServerGroupsEquivalentOrMerged(normalizedPreset, state.serverName);

  const effectiveNameSet = new Set(
    getServerRowsInGroup(effectiveGroup).map((server) => normalizeServerName(server.server_name))
  );
  const presetMembers = getServerGroupMembers(normalizedPreset);
  if (presetMembers.some((member) => effectiveNameSet.has(member))) return true;

  const presetServer = getServerByName(presetMembers[0] || normalizedPreset);
  if (presetServer) return getEffectiveServerGroup(presetServer, selectedSeason) === effectiveGroup;

  return areServerGroupsEquivalentOrMerged(normalizedPreset, state.serverName);
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

function getDifficultyLabel(difficulty) {
  const key = {
    '普通': 'difficulty_normal',
    '困難': 'difficulty_hard',
    '惡夢': 'difficulty_nightmare',
    '煉獄': 'difficulty_hell',
    '深淵': 'difficulty_abyss',
  }[difficulty];
  return key ? t(key) : difficulty;
}

function getFragmentTierLabel(tier) {
  const key = {
    '奇蹟': 'fragment_tier_miracle',
    '神話': 'fragment_tier_mythic',
    '深淵': 'fragment_tier_abyss',
  }[tier];
  return key ? t(key) : tier;
}

function formatPowerRequirement(value) {
  const raw = String(value || '').replace(/,/g, '').trim();
  if (!raw) return '';

  const amountWan = Number(raw);
  if (!Number.isFinite(amountWan)) return value;

  if (Math.abs(amountWan) >= 10000) {
    const amountYi = amountWan / 10000;
    return t('power_unit_yi', { value: Number.isInteger(amountYi) ? amountYi : amountYi.toFixed(2).replace(/\.?0+$/, '') });
  }
  return t('power_unit_wan', { value: amountWan });
}

async function fetchDungeonPowerRows() {
  if (dungeonPowerRowsCache) return dungeonPowerRowsCache;

  const url = `https://docs.google.com/spreadsheets/d/${DUNGEON_POWER_SHEET.id}/export?format=csv&gid=${DUNGEON_POWER_SHEET.gid}`;
  try {
    const rows = parseCsvRows(await fetchTextWithCache('google-sheet:dungeon-power', url));
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
  const abyssFragmentIndex = findHeaderIndex(['深淵裝', '深淵碎片', '煉獄裝', '神裝']);
  const fragmentColumns = [];

  if (fragmentIndex >= 0) {
    const stoneColumns = [
      {
        stoneHeader: '奇蹟分解神鑄石',
        displayTier: DUNGEON_FRAGMENT_REWARDS.normal.tier,
        stoneAmount: FRAGMENT_DECOMPOSE_STONES.miracle,
      },
      {
        stoneHeader: '神話分解神鑄石',
        displayTier: DUNGEON_FRAGMENT_REWARDS.nightmare.tier,
        stoneAmount: FRAGMENT_DECOMPOSE_STONES.mythic,
      },
    ];
    fragmentColumns.push({
      fragmentIndex,
      stoneColumns,
      header: headers[fragmentIndex],
    });
  }

  if (abyssFragmentIndex >= 0) {
    fragmentColumns.push({
      fragmentIndex: abyssFragmentIndex,
      stoneColumns: [{
        stoneHeader: '深淵分解神鑄石',
        displayTier: DUNGEON_FRAGMENT_REWARDS.abyss.tier,
        stoneAmount: FRAGMENT_DECOMPOSE_STONES.abyss,
      }],
      header: headers[abyssFragmentIndex],
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

      stoneColumns.forEach(({ stoneIndex, stoneHeader, displayTier, stoneAmount: fixedStoneAmount }) => {
        const hasSheetColumn = Number.isInteger(stoneIndex) && stoneIndex >= 0;
        let stoneAmount = hasSheetColumn ? parseNumberValue(row[stoneIndex]) : 0;
        let hasStoneValue = hasSheetColumn && String(row[stoneIndex] ?? '').trim() !== '';
        if (Number.isFinite(stoneAmount) && stoneAmount > 0) {
          hasStoneValue = true;
        } else if (Number.isFinite(fixedStoneAmount)) {
          stoneAmount = fixedStoneAmount;
          hasStoneValue = true;
        }

        const item = {
          ...base,
          fragment_name: fragmentName,
          fragment_header: header,
          stone_header: stoneHeader,
          display_tier: displayTier || '',
          has_stone_value: hasStoneValue,
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
    fragmentRowsCache = parseFragmentRowsFromCsvRows(
      parseCsvRows(await fetchTextWithCache('google-sheet:dungeon-power', url))
    );
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
    abyssFragment: getHeaderIndex(headers, ['深淵裝', '深淵碎片', '煉獄裝', '神裝']),
  };

  return csvRows
    .map((row) => {
      const abyssFragment = String(row[index.abyssFragment] || '').trim();
      return {
        season_id: normalizeSeasonId(row[index.season]),
        server_day: Number(row[index.serverDay]) || 0,
        season_day: Number(row[index.seasonDay]) || 0,
        dungeon_name: String(row[index.dungeon] || '').trim(),
        equipment_fragment: String(row[index.equipmentFragment] || '').trim(),
        abyss_fragment: abyssFragment,
        normal_pieces: DUNGEON_FRAGMENT_REWARDS.normal.pieces,
        hard_pieces: DUNGEON_FRAGMENT_REWARDS.hard.pieces,
        nightmare_pieces: DUNGEON_FRAGMENT_REWARDS.nightmare.pieces,
        hell_pieces: DUNGEON_FRAGMENT_REWARDS.hell.pieces,
        abyss_pieces: DUNGEON_FRAGMENT_REWARDS.abyss.pieces,
        miracle_stone: FRAGMENT_DECOMPOSE_STONES.miracle,
        mythic_stone: FRAGMENT_DECOMPOSE_STONES.mythic,
        abyss_stone: FRAGMENT_DECOMPOSE_STONES.abyss,
      };
    })
    .filter((row) => row.dungeon_name && (row.equipment_fragment || row.abyss_fragment));
}

async function fetchDungeonFragmentYieldRows() {
  if (dungeonFragmentYieldRowsCache) return dungeonFragmentYieldRowsCache;

  const url = getGoogleSheetCsvUrl(DUNGEON_POWER_SHEET);
  try {
    dungeonFragmentYieldRowsCache = parseDungeonFragmentYieldRows(
      parseCsvRows(await fetchTextWithCache('google-sheet:dungeon-power', url))
    );
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
    const rows = parseCsvRows(await fetchTextWithCache('google-sheet:primordial-recommendations', url));
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

  fields.innerHTML = PRIMORDIAL_RECOMMENDATION_TIERS.map(([key, labelKey]) => {
    const label = t(labelKey);
    const row = getRecommendationForCurrentSeason(rows, key);
    const value = row?.star || '';
    return `
      <label class="block min-w-0">
        <span class="block text-sm font-semibold mb-1">${escapeHtml(label)}</span>
        <input
          class="input-field rounded p-2 w-full text-right"
          value="${escapeHtml(value)}"
          disabled
          aria-label="${escapeHtml(t('primordial_recommendation_aria', { label }))}"
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
  return Number.isNaN(value) ? NaN : Math.max(0, value);
}

function convertWanToOwnedExp(ownedWan) {
  if (Number.isNaN(ownedWan)) return NaN;
  return Math.floor(Math.max(0, ownedWan) * (usesLargeExpUnit() ? 100000000 : 10000));
}

function convertExpToOwnedInputUnit(expValue) {
  const divisor = usesLargeExpUnit() ? 100000000 : 10000;
  const value = Math.max(0, Number(expValue) || 0) / divisor;
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
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
  const currentLevel = Math.max(0, parseInt(document.getElementById('character-current')?.value, 10) || 0);
  const ownedWan = getOwnedExpWanValue();
  const bedHourly = Math.max(0, parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0);
  const targetLevel = Math.max(0, parseInt(document.getElementById('target-character')?.value, 10) || 0);
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

function isSelectedTargetTimeSeasonEnd() {
  return document.getElementById('target-time')?.dataset.presetKind === 'season_end';
}

function getSeasonEndTargetTimestamp() {
  if (!isSelectedTargetTimeSeasonEnd()) return NaN;

  const value = document.getElementById('target-time')?.value || '';
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : NaN;
}

function getNextLevelSpeedupHours(currentLevel, ownedExp, bedHourly) {
  const { minutesNeeded } = computeEtaToNextLevel(currentLevel, ownedExp, bedHourly);
  if (!Number.isFinite(minutesNeeded) || minutesNeeded <= 0) return 0;
  return getSpeedupHoursForDays(minutesNeeded / (24 * 60));
}

function updateSpeedupHints(nextLevelHours, targetHours) {
  const nextLevelEl = document.getElementById('bed-levelup-speedup');
  const targetEl = document.getElementById('bed-target-speedup');

  if (nextLevelEl) nextLevelEl.textContent = t('hours_delta', { hours: nextLevelHours });
  if (targetEl) targetEl.textContent = t('hours_delta', { hours: targetHours });
}

function refreshBedProgressSummary() {
  const { currentLevel, ownedExp, bedHourly, targetLevel } = readBedProgressState();
  const nextLevelTitle = document.getElementById('bed-levelup-summary-title');
  const targetLevelTitle = document.getElementById('bed-target-summary-title');
  if (nextLevelTitle) nextLevelTitle.textContent = t('levelup_summary_title', { level: currentLevel + 1 });
  if (targetLevelTitle) targetLevelTitle.textContent = t('target_summary_title', { level: targetLevel });

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

function triggerRecalculate(containers) {
  refreshBedProgressSummary();
  const payload = computeAll(containers);
  renderResults(containers, payload, state.missingFiles, { cacheFallback: state.cacheFallback });
  saveAllInputs();
}

function clearControllerRemoteRowsCaches() {
  dungeonPowerRowsCache = null;
  primordialRecommendationRowsCache = null;
  fragmentRowsCache = null;
  dungeonFragmentYieldRowsCache = null;
  serverRowsCache = null;
}

function bindDataCacheHandlers(containers) {
  window.addEventListener(CACHE_FALLBACK_EVENT, () => {
    state.cacheFallback = true;
    if (containers?.results) triggerRecalculate(containers);
  });

  window.addEventListener(CACHE_UPDATED_EVENT, () => {
    clearControllerRemoteRowsCaches();
    clearRemoteDataMemoryCaches();

    if (!appContainers) return;
    clearTimeout(cacheRefreshTimer);
    cacheRefreshTimer = setTimeout(() => {
      handleSeasonChange(appContainers);
    }, CACHE_REFRESH_DEBOUNCE_MS);
  });
}


function getMaterialInput(source, material, role) {
  const el = document.querySelector(
    `.material-source-input[data-source="${source}"][data-material="${material}"][data-role="${role}"]`
  );

  if (!el) return 0;

  const v = parseFloat(el.value);
  return Number.isNaN(v) ? 0 : v;
}


function formatMaterialSourceNumber(value, maximumFractionDigits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return '0';
  return number.toLocaleString(getCurrentLanguage() === 'en' ? 'en-US' : getCurrentLanguage() === 'zh-Hans' ? 'zh-CN' : 'zh-TW', { maximumFractionDigits });
}


function updateExpRequirements(curLv, ownedExp, targetChar) {
  const table = state.cumulativeCostData['character'];
  if (!table || !table.length) return;

  const currentExpBase = getCharacterCumulativeExp(curLv);
  const nextLevelExpBase = getCharacterCumulativeExp(curLv + 1);
  const targetExpBase = getCharacterCumulativeExp(targetChar);

  const needNextExp = Math.max(0, nextLevelExpBase - currentExpBase - ownedExp);
  const needTargetExp = Math.max(0, targetExpBase - currentExpBase - ownedExp);

  const elNext = document.getElementById('bed-levelup-exp');
  const elTarget = document.getElementById('bed-target-exp');
  if (elNext) elNext.textContent = needNextExp.toLocaleString();
  if (elTarget) elTarget.textContent = needTargetExp.toLocaleString();
}

function getNextLevelRequiredExpValue(currentLevel, ownedExp) {
  const table = state.cumulativeCostData['character'];
  if (!table || !table.length) return NaN;

  const currentExpBase = getCharacterCumulativeExp(currentLevel);
  const nextLevelExpBase = getCharacterCumulativeExp(currentLevel + 1);
  return Math.max(0, nextLevelExpBase - currentExpBase - ownedExp);
}

function getExpRequiredFormDefaults() {
  const { currentLevel, ownedExp } = readBedProgressState();
  const selectedSeason = getSelectedSeason();
  const nextExp = getNextLevelRequiredExpValue(currentLevel, ownedExp);

  return {
    season: selectedSeason?.name || selectedSeason?.id?.toUpperCase() || '',
    level: currentLevel > 0 ? String(currentLevel) : '',
    requiredExp: Number.isFinite(nextExp) ? convertExpToOwnedInputUnit(nextExp) : '',
  };
}

function openExpRequiredFormInterface(event) {
  event?.preventDefault();
  window.dispatchEvent(new CustomEvent('expRequiredFormPrefill', {
    detail: getExpRequiredFormDefaults(),
  }));
}

function setupAutoUpdate() {
  setInterval(() => {
    refreshBedProgressSummary();
  }, 1000);
}

async function fetchServerRows() {
  if (serverRowsCache) return serverRowsCache;

  try {
    const rows = await loadServers();
    serverRowsCache = rows
      .map((cols) => ({
        server_id: String(cols.server_id || '').trim(),
        server_short: String(cols.server_short || '').trim(),
        server_name: String(cols.server_name || '').trim(),
        realm_id: String(cols.realm_id || '').trim(),
        merge_2: String(cols.merge_2 || '').trim(),
        merge_4: String(cols.merge_4 || '').trim(),
        merge_8: String(cols.merge_8 || '').trim(),
        merge_16: String(cols.merge_16 || '').trim(),
        current_state: normalizeMergeState(cols.current_state),
      }))
      .filter((server) => server.server_id && server.server_name);
    return serverRowsCache;
  } catch (err) {
    console.error('伺服器資料載入失敗', err);
    serverRowsCache = [];
    const errorEl = document.getElementById('player-code-error');
    if (errorEl) errorEl.textContent = t('server_data_load_failed');
    return serverRowsCache;
  }
}

async function fetchTimePresetsFromSheet(dungeonPowerRows = []) {
  const url = getGoogleSheetCsvUrl(TIME_PRESETS_SHEET);
  try {
    const rows = parseCsvRows(await fetchTextWithCache('google-sheet:time-presets', url));
    const headers = (rows.shift() || []).map(normalizeHeader);

    const out = [];
    rows.forEach((cols, index) => {
      const server = normalizeServerName(getCsvValue(cols, headers, ['server_name', '伺服器', 'server']));
      const desc = getCsvValue(cols, headers, ['description', '說明', '描述']);
      const time = getCsvValue(cols, headers, ['time', '時間', '日期']);
      const rawSeasonId = getCsvValue(cols, headers, ['season_id', '賽季', 'season']);
      if (!server && !desc && !time) return;

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
    return withGeneratedDungeonOpenTimes(withDerivedSeasonEndTimes(out), dungeonPowerRows);
  } catch (err) {
    console.warn('[time presets] fetch failed, using fallback', err);
    return withGeneratedDungeonOpenTimes(withDerivedSeasonEndTimes(TIME_PRESETS_FALLBACK.slice()), dungeonPowerRows);
  }
}

function initSeasonSelector(containers, saved = null) {
  const seasonSelector = document.getElementById('season-select');
  if (!seasonSelector) return;

  seasonSelector.innerHTML = '';
  seasonOptions.forEach((s) => {
    if (s.readonly) return;
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = t(`season_name_${s.id}`);
    seasonSelector.appendChild(opt);
  });

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

function refreshTargetTimeLanguage() {
  const customOption = document.querySelector('#target-time-preset option[value="__custom__"]');
  if (customOption) customOption.textContent = t('custom_target_time');

  const hiddenField = document.getElementById('target-time');
  const displayBox = document.getElementById('target-time-display');
  if (!hiddenField?.value || !displayBox || displayBox.classList.contains('hidden')) return;

  const date = new Date(hiddenField.value);
  if (!Number.isFinite(date.getTime())) return;
  displayBox.textContent = date.toLocaleString(getCurrentLanguage() === 'en' ? 'en-US' : getCurrentLanguage() === 'zh-Hans' ? 'zh-CN' : 'zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
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
  const targetLevelsCard = document.getElementById('target-levels-card');
  if (!main || !targetTimeCard || !targetLevelsCard) return;

  const parent = main.parentElement;
  if (!parent) return;

  if (window.innerWidth <= 767) {
    if (main.previousElementSibling !== null) {
      parent.insertBefore(main, targetTimeCard);
    }
    return;
  }

  if (main.previousElementSibling !== targetLevelsCard) {
    parent.insertBefore(main, targetLevelsCard.nextSibling);
  }
}

function bindTargetTimeFormToggle() {
  const navButtons = Array.from(document.querySelectorAll('.calculator-nav-btn'));
  const calculatorPageContent = document.getElementById('calculator-page-content');
  const fragmentCalculatorPanel = document.getElementById('fragment-calculator-panel');
  const targetTimeFormPanel = document.getElementById('target-time-form-panel');
  const sectionSideNav = document.getElementById('section-side-nav');
  const appLayout = document.querySelector('.app-layout');

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

    if (sectionSideNav) {
      const showSectionNav = targetPage === 'primordial';
      sectionSideNav.classList.toggle('is-hidden', !showSectionNav);
      sectionSideNav.setAttribute('aria-hidden', showSectionNav ? 'false' : 'true');
    }
    appLayout?.classList.toggle('is-focused-page', targetPage !== 'primordial');

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
      if (serverManualToggle) serverManualToggle.textContent = t('relay_server_manual_toggle');
    } else {
      serverSelect.value = '';
      if (serverManualInput) serverManualInput.value = targetServer;
      if (serverManualWrap) serverManualWrap.classList.remove('hidden');
      if (serverManualToggle) serverManualToggle.textContent = t('relay_server_use_list');
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
  return number.toLocaleString(getCurrentLanguage() === 'en' ? 'en-US' : getCurrentLanguage() === 'zh-Hans' ? 'zh-CN' : 'zh-Hant', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  });
}

function formatFragmentInputNumber(value, fractionDigits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return Number(number.toFixed(fractionDigits)).toString();
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
  const decomposedSaleInput = document.getElementById('fragment-decomposed-sale');
  const saleAfterFeeInput = document.getElementById('fragment-sale-after-fee');
  const profitInput = document.getElementById('fragment-profit');
  const quantity = parseNumberValue(document.getElementById('fragment-quantity')?.value);
  const fragmentPricePerGroup = parseNumberValue(document.getElementById('fragment-price')?.value);
  const stonePricePerGroup = parseNumberValue(document.getElementById('fragment-stone-price')?.value);
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
  const stoneOutputPerGroup = row?.has_stone_value === true
    ? FRAGMENT_GROUP_SIZE * row.stone_per_fragment
    : parseNumberValue(output?.value);
  const stoneGroupsFromOneFragmentGroup = Math.floor(stoneOutputPerGroup / FRAGMENT_GROUP_SIZE);
  const buyCost = fragmentPricePerGroup;
  const saleBeforeFee = stoneGroupsFromOneFragmentGroup * stonePricePerGroup;
  const saleAfterFee = saleBeforeFee * (1 - feeRate / 100);
  const moonStarGain = saleAfterFee - buyCost;

  if (output && hasSheetStoneValue) output.value = formatFragmentInputNumber(stoneOutput, 2);
  if (decomposedSaleInput) decomposedSaleInput.value = formatFragmentInputNumber(saleBeforeFee, 2);
  if (saleAfterFeeInput) saleAfterFeeInput.value = formatFragmentInputNumber(saleAfterFee, 2);
  if (profitInput) profitInput.value = formatFragmentInputNumber(moonStarGain, 2);
}

function getDungeonYieldDisplayRows(row) {
  if (!row) return [];

  return [
    {
      name: '普通',
      fragment: row.equipment_fragment,
      tier: DUNGEON_FRAGMENT_REWARDS.normal.tier,
      pieces: row.normal_pieces,
      stonePerPiece: row.miracle_stone,
    },
    {
      name: '困難',
      fragment: row.equipment_fragment,
      tier: DUNGEON_FRAGMENT_REWARDS.hard.tier,
      pieces: row.hard_pieces,
      stonePerPiece: row.miracle_stone,
    },
    {
      name: '惡夢',
      fragment: row.equipment_fragment,
      tier: DUNGEON_FRAGMENT_REWARDS.nightmare.tier,
      pieces: row.nightmare_pieces,
      stonePerPiece: row.mythic_stone,
    },
    {
      name: '煉獄',
      fragment: row.equipment_fragment,
      tier: DUNGEON_FRAGMENT_REWARDS.hell.tier,
      pieces: row.hell_pieces,
      stonePerPiece: row.mythic_stone,
    },
    {
      name: '深淵',
      fragment: row.abyss_fragment,
      tier: DUNGEON_FRAGMENT_REWARDS.abyss.tier,
      pieces: row.abyss_pieces,
      stonePerPiece: row.abyss_stone,
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
  const itemName = getDifficultyLabel(item.name);
  if (!item.fragment) {
    return `
      <div class="info-item rounded-lg p-3">
        <div class="font-bold">${escapeHtml(itemName)}${extraLabel}</div>
        <div class="text-sm text-slate-600 mt-1">${t('fragment_no_matching_data')}</div>
      </div>
    `;
  }

  const total = item.pieces * item.stonePerPiece;
  const fragmentName = item.fragment.endsWith('碎片') ? item.fragment : `${item.fragment}碎片`;
  const tierLabel = getFragmentTierLabel(item.tier);
  const detail = item.stonePerPiece > 0
    ? t('fragment_yield_detail', {
        pieces: formatFragmentNumber(item.pieces),
        stone: formatFragmentNumber(item.stonePerPiece, 2),
        total: formatFragmentNumber(total, 2),
      })
    : t('fragment_missing_stone_quantity');

  return `
    <div class="info-item rounded-lg p-3">
      <div class="font-bold">${escapeHtml(itemName)}${extraLabel}</div>
      <div class="text-sm text-slate-600 mt-1">${escapeHtml(fragmentName)}（${escapeHtml(tierLabel)}）</div>
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
    result.innerHTML = `<div class="text-sm text-slate-600">${t('fragment_no_dungeon_yield_data')}</div>`;
    return;
  }

  const rows = getDungeonYieldDisplayRows(row);
  const previousRow = getPreviousSeasonFinalDungeon(dungeonFragmentYieldRowsCache || [], row);
  if (previousRow) {
    const hasPreviousAbyss = previousRow.abyss_fragment && previousRow.abyss_stone > 0;
    rows.push({
      name: t('previous_final_dungeon_label', {
        dungeon: previousRow.dungeon_name,
        difficulty: hasPreviousAbyss ? t('difficulty_abyss') : t('difficulty_hell'),
      }),
      fragment: hasPreviousAbyss ? previousRow.abyss_fragment : previousRow.equipment_fragment,
      tier: hasPreviousAbyss ? DUNGEON_FRAGMENT_REWARDS.abyss.tier : DUNGEON_FRAGMENT_REWARDS.hell.tier,
      pieces: hasPreviousAbyss ? previousRow.abyss_pieces : previousRow.hell_pieces,
      stonePerPiece: hasPreviousAbyss ? previousRow.abyss_stone : previousRow.mythic_stone,
    });
  }

  result.innerHTML = rows.map((item) => renderDungeonYieldCard(item)).join('');
}

async function initFragmentCalculator(saved = {}) {
  const select = document.getElementById('fragment-kind');
  const status = document.getElementById('fragment-calculator-status');
  if (!select) return;

  if (status) status.textContent = t('fragment_loading');
  const rows = await fetchFragmentRows();
  const visibleRows = filterRowsForCurrentAndPreviousFinal(rows);
  select.innerHTML = visibleRows.map((row) => {
    const index = rows.indexOf(row);
    return `<option value="${index}">${escapeHtml(getFragmentDisplayName(row))}</option>`;
  }).join('');

  if (visibleRows.length === 0) {
    select.innerHTML = `<option value="">${t('fragment_no_current_season_options')}</option>`;
    select.disabled = true;
    if (status) status.textContent = t('fragment_no_current_season_status');
  } else {
    select.disabled = false;
    const savedValue = saved['fragment-kind'];
    const hasSavedOption = Array.from(select.options).some((option) => option.value === savedValue);
    if (hasSavedOption) select.value = savedValue;
    if (status) status.textContent = t('fragment_loaded_status', { count: visibleRows.length });
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
    select.innerHTML = `<option value="">${t('fragment_no_dungeon_options')}</option>`;
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
    const difficultyLabel = getDifficultyLabel(difficulty);
    const safeDifficulty = escapeHtml(difficultyLabel);
    const safeValue = escapeHtml(value);
    return `
      <label class="block min-w-0">
        <span class="block text-sm font-semibold mb-1">${safeDifficulty}</span>
        <input
          class="input-field rounded p-2 w-full text-right"
          value="${safeValue}"
          placeholder=""
          disabled
          aria-label="${escapeHtml(t('power_requirement_aria', { difficulty: difficultyLabel }))}"
        />
      </label>
    `;
  }).join('');
  panel.classList.remove('hidden');
}

async function initServerSelector(containers) {
  const serverSel = document.getElementById('server-select');
  const playerInput = document.getElementById('player-code-input');
  const playerError = document.getElementById('player-code-error');
  if (!serverSel) return;

  const servers = await fetchServerRows();
  serverSel.innerHTML = '';
  servers.forEach((server) => {
    const opt = document.createElement('option');
    opt.value = server.server_name;
    opt.textContent = server.server_name;
    opt.dataset.serverId = server.server_id;
    serverSel.appendChild(opt);
  });

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const savedServer = saved['server-select'];
  const savedPlayerCode = saved['player-code-input'] || '';
  if (playerInput) playerInput.value = savedPlayerCode;

  const applyServer = async (serverName, persist = true) => {
    if (!serverName || ![...serverSel.options].some((option) => option.value === serverName)) return;

    serverSel.value = serverName;
    state.serverName = serverName;

    if (persist) {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      data['server-select'] = serverName;
      if (playerInput) data['player-code-input'] = playerInput.value || '';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    await initTargetTimeControls(containers);
    triggerRecalculate(containers);
    updateTargetTimeFormDefaults();
  };

  const applyPlayerCode = async () => {
    if (!playerInput) return;

    const playerCode = playerInput.value.trim();
    if (!playerCode) {
      if (playerError) playerError.textContent = '';
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      data['player-code-input'] = '';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return;
    }

    if (!PLAYER_CODE_PATTERN.test(playerCode)) {
      if (playerError) playerError.textContent = t('player_code_invalid');
      return;
    }

    const serverId = playerCode.slice(0, 7);
    const server = getServerById(serverId);
    if (!server) {
      if (playerError) playerError.textContent = t('player_code_server_not_found');
      return;
    }

    if (playerError) playerError.textContent = '';
    await applyServer(server.server_name, true);
  };

  if (savedServer && [...serverSel.options].some(o => o.value === savedServer)) {
    await applyServer(savedServer, false);
  } else {
    serverSel.selectedIndex = 0;
    state.serverName = serverSel.value;
  }

  if (savedPlayerCode && PLAYER_CODE_PATTERN.test(savedPlayerCode)) {
    await applyPlayerCode();
  }

  if (serverSel.dataset.serverBound !== '1') {
    serverSel.dataset.serverBound = '1';
    serverSel.addEventListener('change', () => {
      applyServer(serverSel.value, true);
    });
  }

  if (playerInput && playerInput.dataset.playerBound !== '1') {
    playerInput.dataset.playerBound = '1';
    playerInput.addEventListener('input', () => {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      data['player-code-input'] = playerInput.value.trim();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      applyPlayerCode();
    });
  }
}

async function initTargetTimeControls(containers) {
  const presetSel = document.getElementById('target-time-preset');
  const displayBox = document.getElementById('target-time-display');
  const customInput = document.getElementById('target-time-custom');
  const hiddenField = document.getElementById('target-time');

  if (!presetSel || !displayBox || !customInput || !hiddenField) return;

  const dungeonPowerRows = await fetchDungeonPowerRows();
  const allPresets = await fetchTimePresetsFromSheet(dungeonPowerRows);
  await fetchServerRows();
  const selectedServerRow = getSelectedServerRow();
  const selectedSeasonId = normalizeSeasonId(state.seasonId);

  presetSel.innerHTML = '';
  const matchingPresets = allPresets.filter((p) => {
    if (normalizeSeasonId(p.season_id) !== selectedSeasonId) return false;
    if (p.server_name && !arePresetAndEffectiveGroupMatched(p.server_name, selectedServerRow, selectedSeasonId)) return false;
    return true;
  });
  const hasServerDungeonBaseline = matchingPresets.some((p) =>
    (p.generated_from === 'season_start' || p.generated_from === 'server_open') &&
    p.server_name &&
    arePresetAndEffectiveGroupMatched(p.server_name, selectedServerRow, selectedSeasonId)
  ) || matchingPresets.some((p) =>
    !p.generated_from &&
    p.server_name &&
    arePresetAndEffectiveGroupMatched(p.server_name, selectedServerRow, selectedSeasonId) &&
    (
      isDungeonTimeLabel(p.label) ||
      String(p.label || '').includes(DUNGEON_ANCHOR_LABEL)
    )
  );

  const visiblePresets = normalizeTargetTimePresetOptions(matchingPresets.filter((p) => {
    if (hasServerDungeonBaseline && p.generated_from === 'global_dungeon_anchor') return;
    if (p.generated_from === 'season_start') {
      const generatedDungeon = getPresetDungeonName(p);
      const hasManualSameDungeon = matchingPresets.some((candidate) =>
        !candidate.generated_from &&
        candidate.server_name &&
        arePresetAndEffectiveGroupMatched(candidate.server_name, selectedServerRow, selectedSeasonId) &&
        getPresetDungeonName(candidate) === generatedDungeon
      );
      if (hasManualSameDungeon) return;
    }
    return true;
  }));

  visiblePresets.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.key;
    opt.textContent = p.displayLabel || p.label;
    presetSel.appendChild(opt);
  });

  const optCustom = document.createElement('option');
  optCustom.value = '__custom__';
  optCustom.textContent = t('custom_target_time');
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
      renderDungeonPowerPanel(null, dungeonPowerRows);

      if (!customInput.value) {
        const now = new Date();
        const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        customInput.value = localISO;
      }
      hiddenField.value = customInput.value || '';
      hiddenField.dataset.presetKind = '';
    } else {
      customInput.classList.add('hidden');
      displayBox.classList.remove('hidden');

      const found = visiblePresets.find(p => p.key === v) || allPresets.find(p => p.key === v);
      renderDungeonPowerPanel(found, dungeonPowerRows);
      const ts = found?.iso || '';
      hiddenField.value = ts;
      hiddenField.dataset.presetKind = found?.generated_from || '';

      if (ts) {
        const d = new Date(ts);
        displayBox.textContent = d.toLocaleString(getCurrentLanguage() === 'en' ? 'en-US' : getCurrentLanguage() === 'zh-Hans' ? 'zh-CN' : 'zh-TW', {
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

function updateDaysRemainingFromTarget() {
  const hidden = document.getElementById('target-time');
  const daysInput = document.getElementById('days-remaining');
  if (!hidden || !daysInput || !hidden.value) return;

  const target = new Date(hidden.value);
  if (Number.isNaN(target.getTime())) return;

  const now = new Date();
  let diffMs = target.getTime() - now.getTime();
  if (diffMs < 0) diffMs = 0;

  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  daysInput.value = days;
}

function shouldIncludeExploreBigMineGain() {
  return !!document.getElementById('explore-big-mine-enabled')?.checked;
}

function updateMaterialSourceRow(source, material) {
  if (source === 'explore' && material === 'bigMine') {
    ['stone', 'essence', 'sand', 'rola'].forEach((mat) => updateMaterialSourceRow('explore', mat));
    return;
  }

  const days = parseInt(
    document.getElementById('days-remaining')?.value || '0',
    10
  );

  const totalSpan = document.querySelector(
    `.material-source-total[data-source="${source}"][data-material="${material}"]`
  );
  if (!totalSpan) return;

  let total = 0;

  if (source === 'store') {
    const dailyBuy = getMaterialInput(source, material, 'daily');
    const avg = getMaterialInput(source, material, 'avg');
    total = dailyBuy * avg * days;
  } else {
    const daily = getMaterialInput(source, material, 'daily');
    const avg = getMaterialInput(source, material, 'avg');
    total = daily * avg * days;
    if (source === 'explore' && shouldIncludeExploreBigMineGain()) {
      total *= STAMINA_BIG_MINE_EXPECTED_MULTIPLIER;
    }
  }

  totalSpan.textContent = formatMaterialSourceNumber(total, 2);
}


function updateAllMaterialSources() {
  const dungeonMats = ['stone', 'essence', 'sand', 'rola'];
  const exploreMats = ['stone', 'essence', 'sand', 'rola'];
  const storeMats = ['stone', 'essence', 'sand', 'freeze_dried']; 

  dungeonMats.forEach((m) => updateMaterialSourceRow('dungeon', m));
  exploreMats.forEach((m) => updateMaterialSourceRow('explore', m));
  storeMats.forEach((m) => updateMaterialSourceRow('store', m)); 

  updateStoreSummaries(); 
}


function updateStoreEstimateSummary() {
  const days =
    parseInt(document.getElementById('days-remaining')?.value || '0', 10) || 0;

  const storeMats = ['stone', 'essence', 'sand', 'freeze_dried'];
  let dailyPriceTotal = 0;

  storeMats.forEach((mat) => {
    const priceWan = getMaterialInput('store', mat, 'shop-price');
    const dailyBuy = getMaterialInput('store', mat, 'daily');
    dailyPriceTotal += dailyBuy * priceWan * 10000;
  });

  const dailyPriceEl = document.getElementById('store-price-daily-total');
  const totalPriceEl = document.getElementById('store-price-period-total');

  if (dailyPriceEl) dailyPriceEl.textContent = formatMaterialSourceNumber(dailyPriceTotal, 2);
  if (totalPriceEl) totalPriceEl.textContent = formatMaterialSourceNumber(dailyPriceTotal * days, 2);
}


function updateStoreSummaries() {
  updateStoreEstimateSummary();
}



function bindGlobalHandlers(containers) {

  document.addEventListener('input',
    (e) => {
      if (isAppLoading) {
        e.preventDefault();
        return;
      }

      const t = e.target;
      if (t.tagName === 'INPUT') {
        if (t.id?.startsWith('fragment-')) {
          updateFragmentCalculator();
          saveAllInputs();
          return;
        }

        markTargetRecommendationCustom(t);

        if (t.classList.contains('material-source-input')) {
          const src = t.dataset.source;
          const mat = t.dataset.material;
          if (src && mat) updateMaterialSourceRow(src, mat);
          if (src === 'store') updateStoreSummaries();
        }

      if (t.classList.contains('relic-dist-input')) updateRelicTotal();
      triggerRecalculate(containers);
    }
  });

  document.addEventListener('change', (e) => {
    if (isAppLoading) {
      e.preventDefault();
      return;
    }

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
        if (src === 'store') updateStoreSummaries();
      }

      if (t.classList.contains('relic-dist-input')) updateRelicTotal();
      triggerRecalculate(containers);
    }
  });

  document.addEventListener('click', (e) => {
    if (isAppLoading) {
      e.preventDefault();
      return;
    }

    const characterExpAction = e.target.closest(
      '#enable-levelup-notify-btn, #enable-target-notify-btn, #enable-hoard-exp-notify-btn, #open-exp-required-form-btn'
    );
    if (characterExpAction) {
      e.preventDefault();
      if (characterExpAction.id === 'enable-levelup-notify-btn') enableLevelUpNotifications();
      if (characterExpAction.id === 'enable-target-notify-btn') enableTargetLevelCalendar();
      if (characterExpAction.id === 'enable-hoard-exp-notify-btn') enableNextSeasonExpHoardCalendar();
      if (characterExpAction.id === 'open-exp-required-form-btn') openExpRequiredFormInterface(e);
      return;
    }

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


async function handleSeasonChange(containers) {
  const seasonSelector = document.getElementById('season-select');
  state.seasonId = seasonSelector?.value || state.seasonId || 's2';
  state.cacheFallback = false;
  setAppLoading(true);

  containers.results.innerHTML =
    `<p class="text-gray-500 text-center py-8">${t('loading_season_data')}</p>`;

  try {
    await loadDataForSeason(state.seasonId);
    preprocessCostData();

    renderAll(containers);
    setAppLoading(true);
    bindTooltipLayers();
    loadAllInputs(['season-select']);
    renderRelicDistribution(containers.relicDistributionInputs);
    setAppLoading(true);
    loadAllInputs(['season-select']);
    updateRelicModeButtons();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    await initFragmentCalculator(saved);
    await initDungeonFragmentYield(saved);
    await renderPrimordialRecommendations();
    await applySelectedTargetRecommendationIfNeeded();

    await initServerSelector(containers);
    await initTargetTimeControls(containers);

    updateRelicTotal();
    triggerRecalculate(containers);
  } finally {
    setAppLoading(false);
  }
}

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
  const locale = getCurrentLanguage() === 'en' ? 'en-US' : getCurrentLanguage() === 'zh-Hans' ? 'zh-CN' : 'zh-TW';
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
  const locale = getCurrentLanguage() === 'en' ? 'en-US' : getCurrentLanguage() === 'zh-Hans' ? 'zh-CN' : 'zh-TW';
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

async function enableNextSeasonExpHoardCalendar() {
  const locale = getCurrentLanguage() === 'en' ? 'en-US' : getCurrentLanguage() === 'zh-Hans' ? 'zh-CN' : 'zh-TW';
  const seasonEndTs = getSeasonEndTargetTimestamp();
  if (!Number.isFinite(seasonEndTs)) {
    alert(t('calendar_hoard_unavailable'));
    return;
  }

  const eventTs = seasonEndTs - NEXT_SEASON_EXP_HOARD_REMINDER_HOURS * 60 * 60 * 1000;
  const seasonEndText = new Date(seasonEndTs).toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  openGoogleCalendarEvent({
    title: t('calendar_hoard_event_title'),
    details: t('calendar_hoard_event_details', {
      hours: NEXT_SEASON_EXP_HOARD_HOURS,
      seasonEndTime: seasonEndText,
    }),
    eventTs,
  });
}

async function init() {
  await initLanguage();
  const containers = getContainers();
  appContainers = containers;
  applyMobileSectionOrder();
  renderAll(containers);
  setAppLoading(true);
  enhanceStaticFieldTooltips();
  bindTooltipLayers();
  bindGlobalHandlers(containers);
  bindDataCacheHandlers(containers);
  bindTargetTimeFormToggle();

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  await initFragmentCalculator(saved);
  await initDungeonFragmentYield(saved);

  initSeasonSelector(containers, saved);
  setAppLoading(true);

  const clearLocalDataBtn = document.getElementById('clear-local-data-btn');
  clearLocalDataBtn?.addEventListener('click', () => {
    if (confirm(t('confirm_clear_local_data'))) {
      localStorage.removeItem(STORAGE_KEY);
      alert(t('alert_local_data_cleared'));
      location.reload();
    }
  });

  await handleSeasonChange(containers);
  updateTargetTimeFormDefaults();
  updateRelicModeButtons();
  await renderPrimordialRecommendations();
  updateFragmentFeeRates();
  updateFragmentCalculator();

  await loadMaterialAvgDefaults();
  renderMaterialSource(containers);
  loadAllInputs(['season-select']);
  bindTooltipLayers();
  updateDaysRemainingFromTarget();
  updateAllMaterialSources();

  setupAutoUpdate();
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
    initFragmentCalculator(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    initDungeonFragmentYield(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    updateTargetTimeFormDefaults();
    refreshTargetTimeLanguage();
    renderMaterialSource(containers);
    loadAllInputs(['season-select']);
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

