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
} from '../features/progression/legacyAdapter.js';

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
  renderTargetLevels,
} from './view.js';
import { applyStaticTranslations, getCurrentLanguage, initLanguage, t } from '../i18n-inline.js';
import { findMissingUpgradeLevel } from '../core/upgradeCost.js';
import {
  calculateRemainingExperience,
  convertExperienceToAbsolute,
  parseExperienceInput,
} from '../core/experience.js';
import { loadRallyRules, loadServers } from '../services/dataService.js';
import { getSheetDefinition } from '../services/sheetRegistry.js';
import { CACHE_FALLBACK_EVENT, CACHE_UPDATED_EVENT, fetchTextWithCache } from '../services/dataCache.js';
import { setReadOnlyField, summaryMetric } from '../shared/components.js';
import { convertTargetLayout, convertRelicLayout, minimumFilledValue } from '../core/targetLayouts.js';
import {
  buildPlayerNumber,
  deriveServerContext,
  extractPlayerSuffix,
  findServerById,
  normalizePlayerNumber,
  parsePlayerNumber,
  resolvePlayerContext,
} from '../core/serverWorlds.js';
import { createWorldRallyViewModel } from '../features/world-rally/model.js';
import { normalizeTool, readToolFromLocation } from '../app/router.js';
import { renderBootstrapError, runShellBootstrap } from '../app/bootstrap.js';
import { createGlobalStore } from '../app/store.js';

export const globalStore = createGlobalStore();

/* ============================================================
 * Google Sheet published CSV settings.
 * Expected columns: server_name, description, time.
 * ============================================================ */
const TIME_PRESETS_SHEET = {
  id: '1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E',
  gid: '859085671',
};
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
let hasCompletedInitialLoad = false;

const SEASON_START_CATEGORY = '【賽季開始】';
const SEASON_END_CATEGORY = '【賽季結束】';
const SEASON_CATEGORY = '【賽季】';
const DUNGEON_CATEGORY = '【副本開啟】';
const DUNGEON_ANCHOR_LABEL = '淨心護甲';
const DUNGEON_OPEN_INTERVAL_DAYS = 14;
const CURRENT_SEASON_DUNGEON_COUNT = 12;
const DUNGEON_POWER_SHEET = {
  id: '1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E',
  gid: '2044399102',
};
const EQUIPMENT_RATING_SHEET = {
  id: '1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E',
  gid: '1012321192',
};
const PRIMORDIAL_RECOMMENDATION_SHEET = {
  id: '1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E',
  gid: '1955218134',
};
const GIFT_CALCULATOR_SHEET = {
  id: '1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E',
  gid: '547650001',
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
const EQUIPMENT_SLOT_IDS = [
  'main_weapon',
  'off_weapon',
  'helmet',
  'armor',
  'boots',
];
const EQUIPMENT_CLASS_DISPLAY_KEYS = {
  sage: { main_weapon: 'staff', off_weapon: 'orb' },
  warlock: { main_weapon: 'staff', off_weapon: 'book' },
  fighter: { main_weapon: 'sword', off_weapon: 'knuckle' },
  knight: { main_weapon: 'sword', off_weapon: 'shield' },
};
const EQUIPMENT_SCORE_COLUMNS = {
  abyss: { label: '深淵', scoreKey: 'abyss', sourceKey: 'abyssKey' },
  mythic: { label: '神話', scoreKey: 'mythic', sourceKey: 'normalKey' },
  miracle: { label: '奇蹟', scoreKey: 'miracle', sourceKey: 'normalKey' },
};
const EQUIPMENT_DISPLAY_COLUMNS = {
  normal: {
    main_weapon: { staff: '主武器（杖）', sword: '主武器（劍）' },
    off_weapon: {
      orb: '副武器（法球）',
      book: '副武器（法書）',
      knuckle: '副武器（拳套）',
      shield: '副武器（盾牌）',
    },
    helmet: '頭盔',
    armor: '護甲',
    boots: '鞋子',
  },
  abyss: {
    main_weapon: { staff: '深淵主武器（杖）', sword: '深淵主武器（劍）' },
    off_weapon: {
      orb: '深淵副武器（法球）',
      book: '深淵副武器（法書）',
      knuckle: '深淵副武器（拳套）',
      shield: '深淵副武器（盾牌）',
    },
    helmet: '深淵頭盔',
    armor: '深淵護甲',
    boots: '深淵鞋子',
  },
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
const CURRENT_LEVEL_CATEGORIES = ['equipment', 'skill', 'pet'];
let dungeonPowerRowsCache = null;
let primordialRecommendationRowsCache = null;
let fragmentRowsCache = null;
let dungeonFragmentYieldRowsCache = null;
let giftRowsCache = null;
let serverRowsCache = null;
let equipmentSeasonScoreRows = [];
let equipmentRatingThresholds = {};
let equipmentSeasonScoreDataPromise = null;
let renderWorldRallyFromGlobalState = () => {};
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
    if (icon) icon.setAttribute('aria-hidden', 'true');
    if (body) {
      body.setAttribute('role', 'tooltip');
      body.textContent = text;
    }
    return;
  }

  target.dataset.tooltipBound = '1';
  target.classList.add('label-with-help');
  target.insertAdjacentHTML(
    'beforeend',
    `<span class="tooltip"><span class="tooltip-icon" aria-hidden="true">i</span><span class="tooltip-text" role="tooltip">${text}</span></span>`
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
  if (key === 'single') return server.server_short;

  const prefix = server.server_id.slice(0, 5);
  if (key === 'merge_16') return prefix;

  const groupSize = Number(key.replace('merge_', ''));
  const sequence = Number(server.server_id.slice(-2));
  if (!Number.isFinite(groupSize) || !Number.isFinite(sequence) || sequence < 1) {
    return server.server_short;
  }

  const start = Math.floor((sequence - 1) / groupSize) * groupSize + 1;
  return prefix + ':' + start + '-' + (start + groupSize - 1);
}

function getServerRowsInGroup(groupKey) {
  if (!serverRowsCache || !groupKey) return [];
  const rangedGroup = groupKey.match(/^(\d{5}):(\d+)-(\d+)$/);
  if (rangedGroup) {
    const [, prefix, start, end] = rangedGroup;
    return serverRowsCache.filter((server) => {
      if (!server.server_id.startsWith(prefix)) return false;
      const sequence = Number(server.server_id.slice(-2));
      return sequence >= Number(start) && sequence <= Number(end);
    });
  }
  if (/^\d{5}$/.test(groupKey)) {
    return serverRowsCache.filter((server) => server.server_id.startsWith(groupKey));
  }

  const range = parseServerRange(groupKey);
  if (range.length === 0) return serverRowsCache.filter((server) => server.server_short === groupKey);

  const shortSet = new Set(range);
  return serverRowsCache.filter((server) => shortSet.has(server.server_short));
}

function getServerByName(name) {
  const normalizedName = normalizeServerName(name);
  return (serverRowsCache || []).find((server) => normalizeServerName(server.server_name) === normalizedName) || null;
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
          level_limit: getCsvValue(row, headers, ['等級限制', '等级限制', 'level_limit', 'level_requirement']),
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
    fragmentRowsCache = null;
    throw err;
  }

  return fragmentRowsCache;
}

function getHeaderIndex(headers, names) {
  return headers.findIndex((header) => names.some((name) => header === name));
}

async function fetchGoogleSheetCsvRows(sheet) {
  const gid = String(sheet?.gid || 'unknown');
  const text = await fetchTextWithCache(`google-sheet:${gid}`, getGoogleSheetCsvUrl(sheet));
  return parseCsvRows(text);
}

function getEquipmentDisplayNamesFromSheetRow(row, headers, groupName, columnMap) {
  const out = {};
  Object.entries(columnMap).forEach(([slotId, config]) => {
    if (typeof config === 'string') {
      const value = getCsvValue(row, headers, [config]);
      if (value) out[slotId] = value;
      return;
    }

    const slotValues = {};
    Object.entries(config).forEach(([displayKey, headerName]) => {
      const value = getCsvValue(row, headers, [headerName]);
      if (value) slotValues[displayKey] = value;
    });
    if (Object.keys(slotValues).length > 0) out[slotId] = slotValues;
  });
  return Object.keys(out).length > 0 ? { [groupName]: out } : {};
}

function parseEquipmentSeasonScoreRows(csvRows) {
  const headers = (csvRows.shift() || []).map(normalizeHeader);

  return csvRows
    .map((row) => {
      const normalKey = getCsvValue(row, headers, ['裝備碎片']);
      const abyssKey = getCsvValue(row, headers, ['深淵裝', '深淵碎片', '煉獄裝', '神裝']);
      const normalDisplayNames = getEquipmentDisplayNamesFromSheetRow(row, headers, 'normal', EQUIPMENT_DISPLAY_COLUMNS.normal);
      const abyssDisplayNames = getEquipmentDisplayNamesFromSheetRow(row, headers, 'abyss', EQUIPMENT_DISPLAY_COLUMNS.abyss);

      return {
        season: normalizeSeasonId(getCsvValue(row, headers, ['賽季', 'season'])),
        normalKey,
        abyssKey,
        scores: {
          abyss: getCsvValue(row, headers, ['深淵賽季分數']),
          mythic: getCsvValue(row, headers, ['神話賽季分數']),
          miracle: getCsvValue(row, headers, ['奇蹟賽季分數']),
        },
        displayNames: {
          ...normalDisplayNames,
          ...abyssDisplayNames,
        },
      };
    })
    .filter((row) => row.season && (row.normalKey || row.abyssKey));
}

function parseEquipmentRatingThresholds(csvRows) {
  const headers = (csvRows.shift() || []).map(normalizeHeader);
  return csvRows.reduce((thresholds, row) => {
    const season = normalizeSeasonId(getCsvValue(row, headers, ['season', '賽季']));
    if (!season) return thresholds;

    thresholds[season] = {
      c: getCsvValue(row, headers, ['equipment_c']),
      b: getCsvValue(row, headers, ['equipment_b']),
      a: getCsvValue(row, headers, ['equipment_a']),
      s: getCsvValue(row, headers, ['equipment_s']),
      ss: getCsvValue(row, headers, ['equipment_ss']),
      sss: getCsvValue(row, headers, ['equipment_sss']),
    };
    return thresholds;
  }, {});
}

async function loadEquipmentSeasonScoreData() {
  if (equipmentSeasonScoreDataPromise) return equipmentSeasonScoreDataPromise;

  equipmentSeasonScoreDataPromise = Promise.all([
    fetchGoogleSheetCsvRows(DUNGEON_POWER_SHEET),
    fetchGoogleSheetCsvRows(EQUIPMENT_RATING_SHEET),
  ])
    .then(([scoreRows, ratingRows]) => {
      equipmentSeasonScoreRows = parseEquipmentSeasonScoreRows(scoreRows);
      equipmentRatingThresholds = parseEquipmentRatingThresholds(ratingRows);
    })
    .catch((error) => {
      console.warn('[equipment season score] fetch failed', error);
      equipmentSeasonScoreRows = [];
      equipmentRatingThresholds = {};
    });

  return equipmentSeasonScoreDataPromise;
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

function parseGiftCalculatorRows(csvRows) {
  const headers = (csvRows.shift() || []).map((header) => String(header || '').trim());
  const index = {
    level: getHeaderIndex(headers, ['level']),
    partnerRequiredFavor: getHeaderIndex(headers, ['夥伴所需好感', '伙伴所需好感', '所需好感']),
    starGodRequiredFavor: getHeaderIndex(headers, ['星間之神所需好感', '星间之神所需好感']),
    quality: getHeaderIndex(headers, ['禮物品質']),
    favor: getHeaderIndex(headers, ['好感']),
    price: getHeaderIndex(headers, ['價格']),
    daily: getHeaderIndex(headers, ['日用品']),
    flower: getHeaderIndex(headers, ['花']),
    book: getHeaderIndex(headers, ['書']),
    valuables: getHeaderIndex(headers, ['貴重品']),
  };

  return csvRows.map((row) => ({
    level: String(row[index.level] || '').trim(),
    partner_required_favor: String(row[index.partnerRequiredFavor] || '').trim(),
    star_god_required_favor: String(row[index.starGodRequiredFavor] || '').trim(),
    quality: String(row[index.quality] || '').trim(),
    favor: String(row[index.favor] || '').trim(),
    price: String(row[index.price] || '').trim(),
    categories: {
      daily: String(row[index.daily] || '').trim(),
      flower: String(row[index.flower] || '').trim(),
      book: String(row[index.book] || '').trim(),
      valuables: String(row[index.valuables] || '').trim(),
    },
  }));
}

function getGiftLevelRows(rows, recipientType = 'partner') {
  const favorKey = recipientType === 'star_god' ? 'star_god_required_favor' : 'partner_required_favor';
  return rows
    .map((row) => ({
      level: parseNumberValue(row.level),
      requiredFavor: parseNumberValue(row[favorKey]),
    }))
    .filter((row) => Number.isFinite(row.level) && row.level > 0 && row.requiredFavor > 0)
    .sort((a, b) => a.level - b.level);
}

function getGiftQualityRows(rows) {
  return rows
    .map((row) => ({
      quality: String(row.quality || '').trim(),
      favor: parseNumberValue(row.favor),
      price: parseNumberValue(row.price),
      categories: row.categories || {},
    }))
    .filter((row) => row.quality && row.favor > 0)
    .sort((a, b) => a.price - b.price || a.favor - b.favor || a.quality.localeCompare(b.quality));
}

async function fetchGiftCalculatorRows() {
  if (giftRowsCache) return giftRowsCache;

  const url = getGoogleSheetCsvUrl(GIFT_CALCULATOR_SHEET);
  try {
    giftRowsCache = parseGiftCalculatorRows(
      parseCsvRows(await fetchTextWithCache('google-sheet:gift-calculator', url))
    );
  } catch (err) {
    console.warn('[gift calculator] fetch failed', err);
    giftRowsCache = null;
    throw err;
  }

  return giftRowsCache;
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
      <label class="field-group field-group--readonly block min-w-0">
        <span class="field-label-row block text-sm font-semibold mb-1">
          <span>${escapeHtml(label)}</span>
          <span class="readonly-badge">${escapeHtml(t('readonly_badge'))}</span>
        </span>
        <input
          class="readonly-field rounded p-2 w-full text-right"
          value="${escapeHtml(value)}"
          readonly
          aria-readonly="true"
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
  const detailedIds = {
    equipment_level: ['target-equipment_main_weapon', 'target-equipment_off_weapon', 'target-equipment_helmet', 'target-equipment_armor', 'target-equipment_boots'],
    skill_level: ['target-skill_combat1', 'target-skill_combat2', 'target-skill_combat3', 'target-skill_combat4', 'target-skill_arcane1', 'target-skill_arcane2', 'target-skill_arcane3', 'target-skill_arcane4'],
    pet_level: ['target-pet1', 'target-pet2', 'target-pet3', 'target-pet4'],
    relic_level: document.getElementById('target-relic-layout-mode')?.value === 'individual'
      ? Array.from({ length: 20 }, (_, index) => 'target-relic-' + (index + 1))
      : Array.from({ length: 5 }, (_, index) => 'target-relic-element-' + (index + 1)),
  };
  Object.entries(detailedIds).forEach(([field, ids]) => {
    const value = recommendation[field];
    if (value === '') return;
    ids.forEach((id) => { const input = document.getElementById(id); if (input) input.value = value; });
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

function getOwnedExpUnitDivisor() {
  if (getCurrentLanguage() === 'en') return usesLargeExpUnit() ? 1000000 : 1000;
  return usesLargeExpUnit() ? 100000000 : 10000;
}

function readCurrentExpInput() {
  const rawInput = document.getElementById('owned-exp-wan')?.value?.trim() || '';
  const parsedValue = parseExperienceInput(rawInput);
  const absoluteValue = convertExperienceToAbsolute(parsedValue, usesLargeExpUnit(), getOwnedExpUnitDivisor());
  return { rawInput, parsedValue, absoluteValue };
}

function convertExpToOwnedInputUnit(expValue) {
  const divisor = getOwnedExpUnitDivisor();
  const value = Math.max(0, Number(expValue) || 0) / divisor;
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function syncOwnedExpInputFromAbsolute(absoluteValue) {
  const ownedExpInput = document.getElementById('owned-exp');
  if (!ownedExpInput) return 0;

  if (!Number.isFinite(absoluteValue)) {
    ownedExpInput.value = '';
    return 0;
  }

  ownedExpInput.value = String(absoluteValue);
  return absoluteValue;
}

function buildOwnedExpSignature(currentLevel, rawInput, absoluteValue, bedHourly) {
  return [state.seasonId, currentLevel, rawInput || 'nan', absoluteValue, bedHourly].join('|');
}

function getLiveOwnedExp(currentLevel, rawInput, absoluteValue, bedHourly) {
  const ownedExpInput = document.getElementById('owned-exp');
  if (!ownedExpInput) return 0;

  if (!Number.isFinite(absoluteValue)) {
    liveOwnedExpState.signature = '';
    liveOwnedExpState.baseOwnedExp = 0;
    liveOwnedExpState.baseTimestamp = Date.now();
    ownedExpInput.value = '';
    return 0;
  }

  const signature = buildOwnedExpSignature(currentLevel, rawInput, absoluteValue, bedHourly);
  if (liveOwnedExpState.signature !== signature) {
    liveOwnedExpState.signature = signature;
    liveOwnedExpState.baseOwnedExp = syncOwnedExpInputFromAbsolute(absoluteValue);
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
  const currentExpInput = readCurrentExpInput();
  const bedHourly = Math.max(0, parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0);
  const experienceTarget = document.getElementById('character-exp-target')?.value;
  const targetLevel = Math.max(0, parseInt(experienceTarget || document.getElementById('target-character')?.value, 10) || 0);
  const ownedExp = getLiveOwnedExp(
    currentLevel,
    currentExpInput.rawInput,
    currentExpInput.absoluteValue,
    bedHourly
  );

  return {
    currentLevel,
    ownedWan: currentExpInput.parsedValue,
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
  updateExpRequiredFormButton(currentLevel, targetLevel);

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
  giftRowsCache = null;
  serverRowsCache = null;
}

function setGlobalDataStatus(status, message) {
  const element = document.getElementById('global-data-status');
  if (!element) return;
  element.dataset.status = status;
  const statusKeys = {
    loading: 'data_status_loading', ready: 'data_status_ready', stale: 'data_status_stale',
    unavailable: 'data_status_unavailable', refreshing: 'data_status_refreshing', error: 'data_status_error',
  };
  element.title = message || '';
  element.textContent = t(statusKeys[status] || 'data_status_loading');
  globalStore.update({ dataStatus: status });
}

function bindDataCacheHandlers(containers) {
  window.addEventListener(CACHE_FALLBACK_EVENT, (event) => {
    state.cacheFallback = true;
    const sheet = event.detail?.sheet || 'Google data';
    setGlobalDataStatus('stale', `${sheet} refresh failed; showing cached data.`);
    if (containers?.results && globalStore.getState().activeTool === 'primordial') triggerRecalculate(containers);
  });

  window.addEventListener(CACHE_UPDATED_EVENT, (event) => {
    const sheet = event.detail?.sheet || 'Google data';
    setGlobalDataStatus('ready', `${sheet} refreshed.`);
    const serverGids = new Set([
      getSheetDefinition('servers').gid,
      getSheetDefinition('serverSubmissions').gid,
    ]);
    if (serverGids.has(Number(event.detail?.gid))) {
      clearControllerRemoteRowsCaches();
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      void initGlobalContext(containers, saved).catch((error) => {
        console.error('[server data refresh]', error);
      });
    }
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

  // Character row L is the transition L -> L + 1. The current level starts
  // after row L - 1, while the next level ends after row L.
  const currentExpBase = getCharacterCumulativeExp(curLv - 1);
  const nextLevelExpBase = getCharacterCumulativeExp(curLv);
  const targetExpBase = getCharacterCumulativeExp(targetChar - 1);

  const requiredExp = Math.max(0, nextLevelExpBase - currentExpBase);
  const targetRequiredExp = Math.max(0, targetExpBase - currentExpBase);
  const remainingExp = calculateRemainingExperience(requiredExp, ownedExp);
  const targetRemainingExp = calculateRemainingExperience(targetRequiredExp, ownedExp);

  const elNext = document.getElementById('bed-levelup-exp');
  const elTarget = document.getElementById('bed-target-exp');
  if (elNext) elNext.textContent = remainingExp.toLocaleString();
  if (elTarget) elTarget.textContent = targetRemainingExp.toLocaleString();
}

function getMissingCharacterExpLevel(currentLevel, targetLevel) {
  return findMissingUpgradeLevel(
    state.gameData.characterUpgradeCosts,
    currentLevel,
    targetLevel
  );
}

function updateExpRequiredFormButton(currentLevel, targetLevel) {
  const button = document.getElementById('open-exp-required-form-btn');
  if (!button) return;

  const missingLevel = getMissingCharacterExpLevel(currentLevel, targetLevel);
  const wasVisible = !button.classList.contains('hidden');
  button.classList.toggle('hidden', missingLevel === null);

  if (wasVisible && missingLevel === null) {
    window.dispatchEvent(new CustomEvent('expRequiredFormCollapse'));
  }
}

function getExpRequiredFormDefaults() {
  const { currentLevel, targetLevel } = readBedProgressState();
  const selectedSeason = getSelectedSeason();
  const missingLevel = getMissingCharacterExpLevel(currentLevel, targetLevel);

  return {
    season: selectedSeason?.name || selectedSeason?.id?.toUpperCase() || '',
    level: missingLevel === null ? '' : String(missingLevel),
    requiredExp: '',
  };
}

function openExpRequiredFormInterface(event) {
  event?.preventDefault();
  const card = document.getElementById('exp-required-inline-card');
  if (card && !card.classList.contains('hidden')) {
    window.dispatchEvent(new CustomEvent('expRequiredFormCollapse'));
    return;
  }

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
      .filter((server) => server.server_id);
    serverRowsCache.sort((a, b) => Number(a.server_id) - Number(b.server_id));
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
    console.warn('[time presets] Google data is unavailable', err);
    return [];
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
    globalStore.update({ seasonId: state.seasonId });

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
  // Keep the source order identical on mobile and desktop.
}

function bindTargetTimeFormToggle() {
  const navButtons = Array.from(document.querySelectorAll('.calculator-nav-btn'));
  const calculatorPageContent = document.getElementById('calculator-page-content');
  const fragmentCalculatorPanel = document.getElementById('fragment-calculator-panel');
  const giftCalculatorPanel = document.getElementById('gift-calculator-panel');
  const worldRallyPanel = document.getElementById('world-rally-panel');
  const targetTimeFormPanel = document.getElementById('target-time-form-panel');

  if (!navButtons.length || !calculatorPageContent || !fragmentCalculatorPanel || !giftCalculatorPanel || !worldRallyPanel || !targetTimeFormPanel) return;

  const scrollToToggle = () => {
    const firstButton = navButtons[0];
    const top = firstButton.getBoundingClientRect().top + window.scrollY - 24;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  const panels = {
    primordial: calculatorPageContent,
    fragment: fragmentCalculatorPanel,
    gift: giftCalculatorPanel,
    'world-rally': worldRallyPanel,
    'target-time-form': targetTimeFormPanel,
  };
  const pageToTool = {
    primordial: 'primordial',
    fragment: 'equipment',
    gift: 'gift',
    'world-rally': 'world-rally',
    'target-time-form': 'contribution',
  };
  const toolToPage = Object.fromEntries(Object.entries(pageToTool).map(([page, tool]) => [tool, page]));

  const showPage = (page, shouldScroll = true, { updateHistory = true, replaceHistory = false } = {}) => {
    const requestedPage = panels[page] ? page : toolToPage[normalizeTool(page)];
    const targetPage = panels[requestedPage] ? requestedPage : 'primordial';
    globalStore.update({ activeTool: pageToTool[targetPage] });
    Object.entries(panels).forEach(([key, panel]) => {
      panel.classList.toggle('hidden', key !== targetPage);
    });
    if (targetPage === 'world-rally') renderWorldRallyFromGlobalState();

    navButtons.forEach((button) => {
      const active = button.dataset.page === targetPage;
      button.setAttribute('aria-current', active ? 'page' : 'false');
      button.setAttribute('aria-pressed', String(active));
    });


    localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, targetPage);
    if (updateHistory) {
      const tool = pageToTool[targetPage];
      const url = new URL(window.location.href);
      url.searchParams.set('tool', tool);
      window.history[replaceHistory ? 'replaceState' : 'pushState']({ tool }, '', `${url.pathname}${url.search}${url.hash}`);
      window.gtag?.('event', 'page_view', { page_title: `calculator:${tool}`, page_location: url.href });
    }
    window.dispatchEvent(new CustomEvent('sxstx:tool-change', { detail: { tool: pageToTool[targetPage] } }));
    if (shouldScroll) scrollToToggle();
  };

  navButtons.forEach((button) => {
    button.addEventListener('click', () => showPage(button.dataset.page || 'primordial'));
  });
  window.addEventListener('popstate', () => {
    const tool = normalizeTool(new URLSearchParams(window.location.search).get('tool'));
    showPage(toolToPage[tool], false, { updateHistory: false });
  });

  const initialTool = normalizeTool(new URLSearchParams(window.location.search).get('tool'));
  showPage(toolToPage[initialTool], false, { replaceHistory: true });
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
    const targetOption = serverSelector.selectedOptions?.[0];
    const matchingOption = Array.from(serverSelect.options).find((option) =>
      option.value === targetServer || option.dataset.serverNumber === targetServer || option.dataset.serverId === targetServer
    );
    if (matchingOption) {
      serverSelect.value = matchingOption.value;
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
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function getCurrentLevelLayout(category) {
  if (!CURRENT_LEVEL_CATEGORIES.includes(category)) return null;

  const modeSelect = document.getElementById(`${category}-current-layout-mode`);
  const compactInput = document.getElementById(`${category}-resonance-current`);
  const container = modeSelect?.parentElement?.parentElement;
  if (!modeSelect || !compactInput || !container) return null;

  return {
    modeSelect,
    compactInput,
    container,
    detailedInputs: Array.from(container.querySelectorAll('.current-layout-detailed input')),
  };
}

function updateCurrentLevelLayout(category) {
  const layout = getCurrentLevelLayout(category);
  if (!layout) return;

  const mode = layout.modeSelect.value || 'compact';
  layout.container.querySelector('.current-layout-compact')?.classList.toggle('hidden', mode !== 'compact');
  layout.container.querySelector('.current-layout-detailed')?.classList.toggle('hidden', mode !== 'detailed');
  layout.container.querySelectorAll('.current-layout-mode-btn').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  });
}

function syncSavedCompactCurrentLevels() {
  CURRENT_LEVEL_CATEGORIES.forEach((category) => {
    const layout = getCurrentLevelLayout(category);
    if (!layout) return;

    if (layout.modeSelect.value === 'compact') {
      if (layout.compactInput.value === '') layout.compactInput.value = minimumFilledValue(layout.detailedInputs.map((input) => input.value));
      layout.detailedInputs.forEach((input) => { input.value = layout.compactInput.value; });
    }
    updateCurrentLevelLayout(category);
  });
}

function switchCurrentLevelLayout(containers, category, nextMode) {
  const layout = getCurrentLevelLayout(category);
  const currentMode = layout?.modeSelect.value || 'compact';
  if (!layout || currentMode === nextMode || !['compact', 'detailed'].includes(nextMode)) return;

  if (nextMode === 'compact') layout.compactInput.value = minimumFilledValue(layout.detailedInputs.map((input) => input.value));
  layout.detailedInputs.forEach((input) => { input.value = layout.compactInput.value; });
  layout.modeSelect.value = nextMode;
  updateCurrentLevelLayout(category);
  saveAllInputs();
  triggerRecalculate(containers);
}

function mirrorCompactCurrentLevelInput(input) {
  const category = CURRENT_LEVEL_CATEGORIES.find((key) => input?.id === `${key}-resonance-current`);
  const layout = category ? getCurrentLevelLayout(category) : null;
  if (!layout) return;
  layout.detailedInputs.forEach((detailedInput) => { detailedInput.value = input.value; });
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

function formatEquipmentScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return number.toLocaleString(getCurrentLanguage() === 'en' ? 'en-US' : getCurrentLanguage() === 'zh-Hans' ? 'zh-CN' : 'zh-TW', {
    maximumFractionDigits: 0,
  });
}

function getCurrentSeasonEquipmentRows() {
  const currentSeason = normalizeSeasonId(state.seasonId);
  return equipmentSeasonScoreRows
    .filter((item) => item.season === currentSeason && (item.normalKey || item.abyssKey))
    .slice(-2);
}

function getSelectedEquipmentClass() {
  return document.getElementById('job-select')?.value || 'sage';
}

function stripFragmentSuffix(value) {
  return String(value || '').trim().replace(/碎片$/, '');
}

function getEquipmentDisplayName(row, slotId, rarity) {
  const classDisplayKeys = EQUIPMENT_CLASS_DISPLAY_KEYS[getSelectedEquipmentClass()] || EQUIPMENT_CLASS_DISPLAY_KEYS.sage;
  const displayGroup = rarity === 'abyss' ? 'abyss' : 'normal';
  const slotDisplayNames = row?.displayNames?.[displayGroup]?.[slotId];
  if (!slotDisplayNames) return '';
  if (typeof slotDisplayNames === 'string') return slotDisplayNames.trim();

  const displayKey = classDisplayKeys?.[slotId];
  return String(slotDisplayNames[displayKey] || '').trim();
}

function getEquipmentBaseName(row, rarity) {
  return stripFragmentSuffix(rarity === 'abyss' ? row?.abyssKey : row?.normalKey);
}

function makeEquipmentOptionValue({ slotId, sourceKey, rarity, scoreColumn }) {
  return [slotId, sourceKey, rarity, scoreColumn].map((part) => encodeURIComponent(part)).join('|');
}

function hasEquipmentScore(row, scoreColumn) {
  return String(row?.scores?.[scoreColumn] ?? '').trim() !== '';
}

function getEquipmentOptionLabel(option) {
  const displayName = getEquipmentDisplayName(option.row, option.slotId, option.rarity);
  const baseName = getEquipmentBaseName(option.row, option.rarity);
  const rarityLabel = EQUIPMENT_SCORE_COLUMNS[option.scoreColumn].label;
  return displayName
    ? `【${baseName}】${displayName}（${rarityLabel}）`
    : `【${baseName}】（${rarityLabel}）`;
}

function getEquipmentOptionsForSlot(slotId) {
  const options = [];
  getCurrentSeasonEquipmentRows().forEach((row) => {
    ['mythic', 'miracle', 'abyss'].forEach((scoreColumn) => {
      const sourceKey = getEquipmentBaseName(row, scoreColumn);
      if (!sourceKey) return;

      const hasScore = hasEquipmentScore(row, scoreColumn);
      options.push({
        id: makeEquipmentOptionValue({ slotId, sourceKey, rarity: scoreColumn, scoreColumn }),
        row,
        slotId,
        sourceKey,
        rarity: scoreColumn,
        scoreColumn,
        score: hasScore ? parseNumberValue(row?.scores?.[scoreColumn]) : 0,
        missingScore: !hasScore,
      });
    });
  });
  return options;
}

export function calculateEquipmentSeasonScore(selectedEquipment) {
  return selectedEquipment.reduce((total, item) => (
    total + parseNumberValue(item?.score)
  ), 0);
}

export function getEquipmentRating(totalScore, ratingThresholds) {
  const thresholds = ratingThresholds || {};
  const levels = [
    ['SSS', thresholds.sss],
    ['SS', thresholds.ss],
    ['S', thresholds.s],
    ['A', thresholds.a],
    ['B', thresholds.b],
    ['C', thresholds.c],
  ];

  const match = levels.find(([, threshold]) => (
    Number.isFinite(Number(threshold)) && totalScore >= Number(threshold)
  ));
  return match?.[0] || '未達 C';
}

function getSelectedEquipmentSeasonItems() {
  return EQUIPMENT_SLOT_IDS.map((slotId) => {
    const selectedId = document.getElementById(`equipment-season-${slotId}`)?.value || '';
    return getEquipmentOptionsForSlot(slotId).find((item) => item.id === selectedId);
  }).filter(Boolean);
}

function updateEquipmentSeasonScoreWarnings(selectedEquipment) {
  const selectedBySlot = new Map(selectedEquipment.map((item) => [item.slotId, item]));
  EQUIPMENT_SLOT_IDS.forEach((slotId) => {
    const warning = document.getElementById(`equipment-season-${slotId}-warning`);
    if (!warning) return;

    const item = selectedBySlot.get(slotId);
    warning.textContent = item?.missingScore
      ? ` 缺少 ${item.sourceKey}（${EQUIPMENT_SCORE_COLUMNS[item.scoreColumn].label}）裝備分數`
      : '';
  });
}

function updateEquipmentSeasonScore() {
  const totalDisplay = document.getElementById('equipment-season-total');
  const ratingInput = document.getElementById('equipment-season-rating');
  if (!totalDisplay || !ratingInput) return;

  const selectedEquipment = getSelectedEquipmentSeasonItems();
  const totalScore = calculateEquipmentSeasonScore(selectedEquipment);
  const rating = getEquipmentRating(totalScore, equipmentRatingThresholds[normalizeSeasonId(state.seasonId)]);

  totalDisplay.textContent = formatEquipmentScore(totalScore);
  ratingInput.value = rating === '未達 C' ? t('equipment_rating_below_c') : rating;
  updateEquipmentSeasonScoreWarnings(selectedEquipment);
}

async function initEquipmentSeasonScore(saved = {}) {
  await loadEquipmentSeasonScoreData();
  const emptyOption = `<option value="">${t('equipment_no_current_season_options')}</option>`;

  EQUIPMENT_SLOT_IDS.forEach((slotId) => {
    const select = document.getElementById(`equipment-season-${slotId}`);
    if (!select) return;

    const currentValue = select.value;
    const options = getEquipmentOptionsForSlot(slotId);
    const optionHtml = options
      .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(getEquipmentOptionLabel(item))}</option>`)
      .join('');

    select.innerHTML = options.length > 0 ? optionHtml : emptyOption;
    select.disabled = options.length === 0;

    const savedValue = saved[`equipment-season-${slotId}`];
    const desiredValue = savedValue || currentValue;
    const hasDesiredOption = Array.from(select.options).some((option) => option.value === desiredValue);
    if (hasDesiredOption) select.value = desiredValue;
  });

  updateEquipmentSeasonScore();
}

function getSelectedFragmentRow() {
  const select = document.getElementById('fragment-kind');
  const index = Number(select?.value);
  if (!Number.isInteger(index) || index < 0) return null;
  return fragmentRowsCache?.[index] || null;
}

function getGiftCategoryOptions() {
  return [
    ['daily', t('gift_category_daily')],
    ['flower', t('gift_category_flower')],
    ['book', t('gift_category_book')],
    ['valuables', t('gift_category_valuables')],
  ];
}

const GIFT_KINGDOMS = [
  { id: 'forest', labelKey: 'gift_kingdom_forest', aliases: ['森之國', '森之国'] },
  { id: 'mountain', labelKey: 'gift_kingdom_mountain', aliases: ['山之國', '山之国'] },
  { id: 'marsh', labelKey: 'gift_kingdom_marsh', aliases: ['澤之國', '泽之国'] },
  { id: 'dragon', labelKey: 'gift_kingdom_dragon', aliases: ['龍之國', '龙之国'] },
  { id: 'wing', labelKey: 'gift_kingdom_wing', aliases: ['羽之國', '羽之国'] },
  { id: 'hapadi', labelKey: 'gift_kingdom_hapadi', aliases: ['哈帕迪'] },
  { id: 'ignis', labelKey: 'gift_kingdom_ignis', aliases: ['伊格尼斯'] },
];

const GIFT_RECIPIENT_TYPES = [
  { id: 'partner', labelKey: 'gift_recipient_partner', totalNeededLabelKey: 'gift_partner_total_needed_label' },
  { id: 'star_god', labelKey: 'gift_recipient_star_god', totalNeededLabelKey: 'gift_star_god_total_needed_label' },
];

function getGiftRecipientType(value) {
  return GIFT_RECIPIENT_TYPES.find((type) => type.id === value) || GIFT_RECIPIENT_TYPES[0];
}

function getGiftRowsData(recipientType = 'partner') {
  const rows = giftRowsCache || [];
  return {
    levelRows: getGiftLevelRows(rows, recipientType),
    qualityRows: getGiftQualityRows(rows),
  };
}

const GIFT_CURRENT_LEVEL_BOUNDS = { min: 1, max: 99 };
const GIFT_TARGET_LEVEL_BOUNDS = { min: 1, max: 100 };

function clampGiftLevelInput(input, bounds, fallback) {
  if (!input) return fallback;

  input.min = String(bounds.min);
  input.max = String(bounds.max);
  input.step = '1';

  const rawValue = Number(input.value);
  const fallbackLevel = Number.isInteger(fallback) ? fallback : bounds.min;
  const integerValue = Number.isFinite(rawValue) ? Math.trunc(rawValue) : fallbackLevel;
  const clampedValue = Math.min(bounds.max, Math.max(bounds.min, integerValue));
  input.value = String(clampedValue);
  return clampedValue;
}

function calculateGiftFavorNeeded(levelRows, currentLevel, currentFavor, targetLevel) {
  if (!levelRows.length || targetLevel <= currentLevel) {
    return { totalNeeded: 0, missingLevels: [] };
  }

  const levelMap = new Map(levelRows.map((row) => [row.level, row.requiredFavor]));
  const missingLevels = [];
  let total = 0;
  for (let level = currentLevel; level < targetLevel; level += 1) {
    const required = levelMap.get(level);
    if (!Number.isFinite(required)) {
      missingLevels.push(level);
      continue;
    }
    if (level === currentLevel) {
      total += Math.max(0, required - currentFavor);
    } else {
      total += required;
    }
  }

  return {
    totalNeeded: missingLevels.length ? null : total,
    missingLevels,
  };
}

function getGiftAvailableKingdoms(row, category) {
  const value = String(row?.categories?.[category] || '').trim();
  return value || t('gift_no_available_kingdoms');
}

function getGiftOwnedGiftRows(qualityRows) {
  return qualityRows
    .slice()
    .sort((a, b) => (
      parseNumberValue(b.price) - parseNumberValue(a.price) ||
      parseNumberValue(b.favor) - parseNumberValue(a.favor) ||
      String(a.quality || '').localeCompare(String(b.quality || ''))
    ))
    .slice(0, 3)
    .flatMap((row) => [1, 2].map((slot) => ({
      ...row,
      slotLabel: `${row.quality} ${slot}`,
    })));
}

function calculateGiftQualityResult(row, totalNeeded, category) {
  const favorPerGift = parseNumberValue(row?.favor);
  const canCalculateQuantity = Number.isFinite(totalNeeded) && totalNeeded >= 0;
  const giftsNeeded = canCalculateQuantity && favorPerGift > 0 ? Math.ceil(totalNeeded / favorPerGift) : null;
  const totalCost = giftsNeeded === null ? null : giftsNeeded * parseNumberValue(row?.price);
  const overflowFavor = giftsNeeded === null ? null : Math.max(0, giftsNeeded * favorPerGift - totalNeeded);
  return {
    quality: row?.quality || '',
    favorPerGift,
    price: parseNumberValue(row?.price),
    giftsNeeded,
    totalCost,
    overflowFavor,
    kingdoms: getGiftAvailableKingdoms(row, category),
  };
}

function formatGiftNumber(value) {
  if (!Number.isFinite(value)) return '--';
  return formatFragmentNumber(value, 2);
}

function getGiftKingdomLabel(kingdom) {
  return t(kingdom.labelKey);
}

function readGiftKingdomCoins() {
  return new Map(GIFT_KINGDOMS.map((kingdom) => {
    const value = parseNumberValue(document.getElementById(`gift-coins-${kingdom.id}`)?.value);
    return [kingdom.id, Math.max(0, Math.trunc(value))];
  }));
}

function readOwnedGiftCounts(ownedGiftRows) {
  const counts = new Map();
  ownedGiftRows.forEach((row, index) => {
    const value = parseNumberValue(document.getElementById(`gift-owned-${index}`)?.value);
    counts.set(row.quality, (counts.get(row.quality) || 0) + Math.max(0, Math.trunc(value)));
  });
  return counts;
}

function getAvailableGiftKingdoms(row, category) {
  const value = String(row?.categories?.[category] || '').trim();
  if (!value) return [];
  return GIFT_KINGDOMS
    .map((kingdom, fallbackRank) => {
      const aliasRanks = kingdom.aliases
        .map((alias) => value.indexOf(alias))
        .filter((rank) => rank >= 0);
      if (!aliasRanks.length) return null;
      return {
        ...kingdom,
        sourceRank: Math.min(...aliasRanks) * GIFT_KINGDOMS.length + fallbackRank,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sourceRank - b.sourceRank);
}

function renderGiftSummaryItem(labelKey, value, options = {}) {
  return summaryMetric({
    label: t(labelKey),
    value,
    ...options,
  });
}

function getGiftSourceRank(source) {
  if (source?.kingdomId === 'owned' || source === 'owned') return -1;
  if (Number.isFinite(source?.sourceRank)) return source.sourceRank;
  const kingdomId = source?.kingdomId || source;
  const index = GIFT_KINGDOMS.findIndex((kingdom) => kingdom.id === kingdomId);
  return index >= 0 ? index : GIFT_KINGDOMS.length;
}

function getGiftPlanMetrics(plan) {
  const purchases = plan?.purchases || [];
  const paidPurchases = purchases.filter((purchase) => purchase.kingdomId !== 'owned');
  const paidLocations = new Set(paidPurchases.map((purchase) => purchase.kingdomId));
  const sourceSignature = [...paidLocations]
    .map((kingdomId) => getGiftSourceRank(purchases.find((purchase) => purchase.kingdomId === kingdomId) || kingdomId))
    .sort((a, b) => a - b)
    .map((rank) => String(rank).padStart(2, '0'))
    .join('|');

  return {
    paidGiftCount: paidPurchases.reduce((sum, purchase) => sum + purchase.quantity, 0),
    paidLocationCount: paidLocations.size,
    cost: plan?.cost || 0,
    totalGiftCount: plan?.gifts || 0,
    sourceSignature,
  };
}

function compareGiftMetricValues(left, right) {
  if (left.cost !== right.cost) return left.cost < right.cost ? -1 : 1;
  if (left.paidGiftCount !== right.paidGiftCount) return left.paidGiftCount < right.paidGiftCount ? -1 : 1;
  if (left.paidLocationCount !== right.paidLocationCount) return left.paidLocationCount < right.paidLocationCount ? -1 : 1;
  if (left.sourceSignature !== right.sourceSignature) return left.sourceSignature.localeCompare(right.sourceSignature);
  if (left.totalGiftCount !== right.totalGiftCount) return left.totalGiftCount < right.totalGiftCount ? -1 : 1;
  return 0;
}

function compareGiftPlanState(a, b) {
  if (!b) return a;
  if (!a) return b;
  return compareGiftMetricValues(getGiftPlanMetrics(a), getGiftPlanMetrics(b)) <= 0 ? a : b;
}

function addGiftPurchase(purchases, option, quantity) {
  if (quantity <= 0) return purchases;
  const next = purchases.map((purchase) => ({ ...purchase }));
  const existing = next.find((purchase) => purchase.kingdomId === option.kingdom.id && purchase.quality === option.quality);
  if (existing) {
    existing.quantity += quantity;
    existing.spent += option.price * quantity;
    existing.obtainedFavor += option.favor * quantity;
  } else {
    next.push({
      kingdomId: option.kingdom.id,
      kingdomLabel: getGiftKingdomLabel(option.kingdom),
      quality: option.quality,
      favorPerGift: option.favor,
      price: option.price,
      sourceRank: getGiftSourceRank(option.kingdom),
      quantity,
      spent: option.price * quantity,
      obtainedFavor: option.favor * quantity,
    });
  }
  return next;
}

function buildGiftPurchaseOptions(qualityRows, category, coinsByKingdom) {
  const options = [];
  qualityRows.forEach((row) => {
    const favor = Math.trunc(parseNumberValue(row.favor));
    const price = Math.trunc(parseNumberValue(row.price));
    if (!row.quality || favor <= 0 || price <= 0) return;

    getAvailableGiftKingdoms(row, category).forEach((kingdom) => {
      const budget = coinsByKingdom.get(kingdom.id) || 0;
      const maxCount = Math.floor(budget / price);
      if (maxCount <= 0) return;
      options.push({
        kingdom,
        quality: row.quality,
        favor,
        price,
        maxCount,
      });
    });
  });
  return options;
}

function buildOwnedGiftOptions(qualityRows, ownedGiftCounts) {
  return qualityRows
    .map((row) => ({
      kingdom: { id: 'owned', labelKey: 'gift_owned_source_label' },
      quality: row.quality,
      favor: Math.trunc(parseNumberValue(row.favor)),
      price: 0,
      maxCount: ownedGiftCounts.get(row.quality) || 0,
    }))
    .filter((option) => option.quality && option.favor > 0 && option.maxCount > 0);
}

function optimizeGiftKingdomOptions(options, favorCap, budget) {
  let states = new Map([[0, { favor: 0, cost: 0, gifts: 0, purchases: [] }]]);

  options.forEach((option) => {
    let remaining = option.maxCount;
    let chunkSize = 1;
    while (remaining > 0) {
      const quantity = Math.min(chunkSize, remaining);
      const chunk = {
        favor: option.favor * quantity,
        cost: option.price * quantity,
        gifts: quantity,
        option,
        quantity,
      };
      const nextStates = new Map(states);
      states.forEach((stateValue) => {
        if (stateValue.cost + chunk.cost > budget) return;
        const favor = Math.min(favorCap, stateValue.favor + chunk.favor);
        const candidate = {
          favor,
          cost: stateValue.cost + chunk.cost,
          gifts: stateValue.gifts + chunk.gifts,
          purchases: addGiftPurchase(stateValue.purchases, chunk.option, chunk.quantity),
        };
        nextStates.set(favor, compareGiftPlanState(candidate, nextStates.get(favor)));
      });
      states = nextStates;
      remaining -= quantity;
      chunkSize *= 2;
    }
  });

  return states;
}

function combineGiftKingdomPlans(currentStates, kingdomStates, favorCap) {
  const nextStates = new Map();
  currentStates.forEach((currentState) => {
    kingdomStates.forEach((kingdomState) => {
      const favor = Math.min(favorCap, currentState.favor + kingdomState.favor);
      const candidate = {
        favor,
        cost: currentState.cost + kingdomState.cost,
        gifts: currentState.gifts + kingdomState.gifts,
        purchases: [...currentState.purchases, ...kingdomState.purchases],
      };
      nextStates.set(favor, compareGiftPlanState(candidate, nextStates.get(favor)));
    });
  });
  return nextStates;
}

function compareGiftFinalPlan(candidate, best, neededFavor) {
  if (!best) return candidate;
  const candidateReachable = candidate.favor >= neededFavor;
  const bestReachable = best.favor >= neededFavor;
  if (candidateReachable !== bestReachable) return candidateReachable ? candidate : best;

  if (candidateReachable) {
    const candidateOverflow = candidate.favor - neededFavor;
    const bestOverflow = best.favor - neededFavor;
    if (candidateOverflow !== bestOverflow) return candidateOverflow < bestOverflow ? candidate : best;
    const metricComparison = compareGiftMetricValues(getGiftPlanMetrics(candidate), getGiftPlanMetrics(best));
    if (metricComparison !== 0) return metricComparison < 0 ? candidate : best;
    return best;
  }

  if (candidate.favor !== best.favor) return candidate.favor > best.favor ? candidate : best;
  const metricComparison = compareGiftMetricValues(getGiftPlanMetrics(candidate), getGiftPlanMetrics(best));
  return metricComparison < 0 ? candidate : best;
}

function optimizeGiftPurchases(qualityRows, category, coinsByKingdom, ownedGiftCounts, neededFavor, ownedFirst = false) {
  if (!Number.isFinite(neededFavor) || neededFavor <= 0) {
    return { favor: 0, cost: 0, gifts: 0, purchases: [], reachable: neededFavor === 0 };
  }

  const ownedOptions = buildOwnedGiftOptions(qualityRows, ownedGiftCounts);
  const paidOptions = buildGiftPurchaseOptions(qualityRows, category, coinsByKingdom);
  const options = [
    ...ownedOptions,
    ...paidOptions,
  ];
  const maxGiftFavor = options.reduce((max, option) => Math.max(max, option.favor), 0);
  const favorCap = Math.max(neededFavor, neededFavor + maxGiftFavor - 1);
  let combinedStates = new Map([[0, { favor: 0, cost: 0, gifts: 0, purchases: [] }]]);

  const ownedStates = optimizeGiftKingdomOptions(ownedOptions, favorCap, 0);
  if (ownedFirst) {
    let ownedBase = null;
    ownedStates.forEach((stateValue) => {
      ownedBase = compareGiftFinalPlan(stateValue, ownedBase, neededFavor);
    });
    if (ownedBase?.favor >= neededFavor) {
      return { ...ownedBase, reachable: true };
    }
    combinedStates = new Map([[ownedBase?.favor || 0, ownedBase || { favor: 0, cost: 0, gifts: 0, purchases: [] }]]);
  } else {
    combinedStates = combineGiftKingdomPlans(combinedStates, ownedStates, favorCap);
  }

  GIFT_KINGDOMS.forEach((kingdom) => {
    const kingdomOptions = paidOptions.filter((option) => option.kingdom.id === kingdom.id);
    const kingdomStates = optimizeGiftKingdomOptions(kingdomOptions, favorCap, coinsByKingdom.get(kingdom.id) || 0);
    combinedStates = combineGiftKingdomPlans(combinedStates, kingdomStates, favorCap);
  });

  let best = null;
  combinedStates.forEach((stateValue) => {
    best = compareGiftFinalPlan(stateValue, best, neededFavor);
  });

  return {
    ...(best || { favor: 0, cost: 0, gifts: 0, purchases: [] }),
    reachable: Boolean(best && best.favor >= neededFavor),
  };
}

function renderGiftPurchaseTable(purchases) {
  if (!purchases.length) {
    return `<div class="text-sm text-slate-600">${escapeHtml(t('gift_no_purchase_plan'))}</div>`;
  }

  const rows = purchases
    .slice()
    .sort((a, b) => getGiftSourceRank(a) - getGiftSourceRank(b) || a.price - b.price || a.quality.localeCompare(b.quality))
    .map((item) => `
      <tr>
        <td class="gift-table-cell border px-3 py-2 font-semibold">${escapeHtml(item.kingdomLabel)}</td>
        <td class="gift-table-cell border px-3 py-2">${escapeHtml(item.quality)}</td>
        <td class="gift-table-cell border px-3 py-2 text-right">${formatGiftNumber(item.favorPerGift)}</td>
        <td class="gift-table-cell border px-3 py-2 text-right">${formatGiftNumber(item.price)}</td>
        <td class="gift-table-cell border px-3 py-2 text-right">${formatGiftNumber(item.quantity)}</td>
        <td class="gift-table-cell border px-3 py-2 text-right">${formatGiftNumber(item.spent)}</td>
        <td class="gift-table-cell border px-3 py-2 text-right">${formatGiftNumber(item.obtainedFavor)}</td>
      </tr>
    `).join('');

  return `
    <div class="responsive-table gift-table-shell">
      <table class="text-sm border-collapse">
        <thead>
          <tr>
            <th class="gift-table-cell border px-3 py-2 text-left">${escapeHtml(t('gift_table_kingdom'))}</th>
            <th class="gift-table-cell border px-3 py-2 text-left">${escapeHtml(t('gift_table_quality'))}</th>
            <th class="gift-table-cell border px-3 py-2 text-right">${escapeHtml(t('gift_table_favor'))}</th>
            <th class="gift-table-cell border px-3 py-2 text-right">${escapeHtml(t('gift_table_price'))}</th>
            <th class="gift-table-cell border px-3 py-2 text-right">${escapeHtml(t('gift_table_quantity'))}</th>
            <th class="gift-table-cell border px-3 py-2 text-right">${escapeHtml(t('gift_table_spent'))}</th>
            <th class="gift-table-cell border px-3 py-2 text-right">${escapeHtml(t('gift_table_obtained'))}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderGiftPlanSection(titleKey, plan, neededFavor) {
  const missingFavor = Number.isFinite(neededFavor) ? Math.max(0, neededFavor - plan.favor) : null;
  const overflowFavor = Number.isFinite(neededFavor) && plan.reachable ? Math.max(0, plan.favor - neededFavor) : null;
  return `
    <div class="space-y-2">
      <h4 class="text-lg font-bold">${escapeHtml(t(titleKey))}</h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        ${renderGiftSummaryItem('gift_obtainable_favor_label', formatGiftNumber(plan.favor), { variant: 'info' })}
        ${renderGiftSummaryItem('gift_missing_favor_label', formatGiftNumber(missingFavor), { variant: missingFavor > 0 ? 'shortage' : 'success' })}
        ${renderGiftSummaryItem('gift_overflow_label', formatGiftNumber(overflowFavor), { variant: 'overflow' })}
        ${renderGiftSummaryItem('gift_total_cost_label', formatGiftNumber(plan.cost))}
      </div>
      ${renderGiftPurchaseTable(plan.purchases)}
    </div>
  `;
}

function renderGiftComparisonTable(results) {
  const body = results.map((item) => `
    <tr>
      <td class="gift-table-cell border px-3 py-2 font-semibold">${escapeHtml(item.quality)}</td>
      <td class="gift-table-cell border px-3 py-2 text-right">${formatGiftNumber(item.favorPerGift)}</td>
      <td class="gift-table-cell border px-3 py-2 text-right">${formatGiftNumber(item.price)}</td>
      <td class="gift-table-cell border px-3 py-2">${escapeHtml(item.kingdoms)}</td>
    </tr>
  `).join('');

  return `
    <div class="responsive-table gift-table-shell">
      <table class="text-sm border-collapse">
        <thead>
          <tr>
            <th class="gift-table-cell border px-3 py-2 text-left">${escapeHtml(t('gift_table_quality'))}</th>
            <th class="gift-table-cell border px-3 py-2 text-right">${escapeHtml(t('gift_table_favor'))}</th>
            <th class="gift-table-cell border px-3 py-2 text-right">${escapeHtml(t('gift_table_price'))}</th>
            <th class="gift-table-cell border px-3 py-2 text-left">${escapeHtml(t('gift_table_kingdoms'))}</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function updateGiftCalculatorResult() {
  const result = document.getElementById('gift-calculator-result');
  const purchaseTable = document.getElementById('gift-purchase-table');
  const comparison = document.getElementById('gift-comparison-table');
  const warning = document.getElementById('gift-level-warning');
  if (!result || !purchaseTable || !comparison) return;

  const recipientType = getGiftRecipientType(document.getElementById('gift-recipient-type')?.value);
  const { levelRows, qualityRows } = getGiftRowsData(recipientType.id);
  const currentLevelInput = document.getElementById('gift-current-level');
  const targetLevelInput = document.getElementById('gift-target-level');
  const currentLevel = clampGiftLevelInput(currentLevelInput, GIFT_CURRENT_LEVEL_BOUNDS, GIFT_CURRENT_LEVEL_BOUNDS.min);
  const currentFavor = Math.max(0, Math.trunc(parseNumberValue(document.getElementById('gift-current-favor')?.value)));
  const targetLevel = clampGiftLevelInput(targetLevelInput, GIFT_TARGET_LEVEL_BOUNDS, Math.min(GIFT_TARGET_LEVEL_BOUNDS.max, currentLevel + 1));
  const selectedCategory = document.getElementById('gift-category')?.value || 'daily';
  const { totalNeeded, missingLevels } = calculateGiftFavorNeeded(levelRows, currentLevel, currentFavor, targetLevel);

  if (!levelRows.length || !qualityRows.length) {
    if (warning) {
      warning.classList.add('hidden');
      warning.textContent = '';
    }
    result.innerHTML = `<div class="text-sm text-slate-600">${t('gift_no_data')}</div>`;
    purchaseTable.innerHTML = '';
    comparison.innerHTML = '';
    return;
  }

  if (warning) {
    if (missingLevels.length) {
      warning.textContent = t('gift_missing_level_data', { levels: missingLevels.join(getCurrentLanguage() === 'en' ? ', ' : '、') });
      warning.classList.remove('hidden');
    } else {
      warning.textContent = '';
      warning.classList.add('hidden');
    }
  }

  const coinsByKingdom = readGiftKingdomCoins();
  const ownedGiftRows = getGiftOwnedGiftRows(qualityRows);
  const ownedGiftCounts = readOwnedGiftCounts(ownedGiftRows);
  const canOptimize = Number.isFinite(totalNeeded);
  const minimumOverflowPlan = canOptimize
    ? optimizeGiftPurchases(qualityRows, selectedCategory, coinsByKingdom, ownedGiftCounts, totalNeeded, false)
    : { favor: null, cost: null, purchases: [], reachable: false };
  const ownedFirstPlan = canOptimize
    ? optimizeGiftPurchases(qualityRows, selectedCategory, coinsByKingdom, ownedGiftCounts, totalNeeded, true)
    : { favor: null, cost: null, purchases: [], reachable: false };
  const summaryPlan = minimumOverflowPlan;
  const missingFavor = Number.isFinite(totalNeeded) ? Math.max(0, totalNeeded - summaryPlan.favor) : null;
  const overflowFavor = canOptimize ? (summaryPlan.reachable ? Math.max(0, summaryPlan.favor - totalNeeded) : 0) : null;
  result.innerHTML = [
    renderGiftSummaryItem(recipientType.totalNeededLabelKey, formatGiftNumber(totalNeeded), { variant: 'default' }),
    renderGiftSummaryItem('gift_obtainable_favor_label', formatGiftNumber(summaryPlan.favor), { variant: 'info' }),
    renderGiftSummaryItem('gift_missing_favor_label', formatGiftNumber(missingFavor), { variant: missingFavor > 0 ? 'shortage' : 'success' }),
    renderGiftSummaryItem('gift_total_cost_label', formatGiftNumber(summaryPlan.cost), { variant: 'default' }),
    renderGiftSummaryItem('gift_overflow_label', formatGiftNumber(overflowFavor), { variant: 'overflow' }),
    renderGiftSummaryItem('gift_reachable_label', summaryPlan.reachable ? t('gift_reachable_yes') : t('gift_reachable_no'), {
      variant: summaryPlan.reachable ? 'success' : 'unavailable',
      statusIcon: summaryPlan.reachable ? '?' : '?',
    }),
  ].join('');

  purchaseTable.innerHTML = [
    renderGiftPlanSection('gift_plan_min_overflow_title', minimumOverflowPlan, totalNeeded),
    renderGiftPlanSection('gift_plan_owned_first_title', ownedFirstPlan, totalNeeded),
  ].join('');
  const comparisonResults = qualityRows.map((row) => calculateGiftQualityResult(row, totalNeeded, selectedCategory));
  comparison.innerHTML = renderGiftComparisonTable(comparisonResults);
}

async function renderGiftCalculator(saved = {}) {
  const status = document.getElementById('gift-calculator-status');
  const currentLevelInput = document.getElementById('gift-current-level');
  const targetLevelInput = document.getElementById('gift-target-level');
  const recipientTypeSelect = document.getElementById('gift-recipient-type');
  const categorySelect = document.getElementById('gift-category');
  const currentFavorInput = document.getElementById('gift-current-favor');
  const kingdomCoinsContainer = document.getElementById('gift-kingdom-coins');
  const ownedGiftsContainer = document.getElementById('gift-owned-gifts');
  if (!currentLevelInput || !targetLevelInput || !recipientTypeSelect || !categorySelect || !kingdomCoinsContainer || !ownedGiftsContainer) return;

  if (status) status.textContent = t('gift_loading');
  await fetchGiftCalculatorRows();
  const savedRecipientType = getGiftRecipientType(saved['gift-recipient-type']);
  const { levelRows, qualityRows } = getGiftRowsData(savedRecipientType.id);

  recipientTypeSelect.innerHTML = GIFT_RECIPIENT_TYPES
    .map((type) => `<option value="${type.id}">${escapeHtml(t(type.labelKey))}</option>`)
    .join('');
  categorySelect.innerHTML = getGiftCategoryOptions()
    .map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`)
    .join('');
  kingdomCoinsContainer.innerHTML = GIFT_KINGDOMS.map((kingdom) => {
    const inputId = `gift-coins-${kingdom.id}`;
    return `
      <label class="block min-w-0">
        <span class="block text-sm font-semibold mb-1">${escapeHtml(t('gift_kingdom_coin_label', { kingdom: getGiftKingdomLabel(kingdom) }))}</span>
        <input id="${inputId}" type="number" min="0" step="1" class="input-field rounded p-2 w-full text-right" value="0" />
      </label>
    `;
  }).join('');
  const ownedGiftRows = getGiftOwnedGiftRows(qualityRows);
  ownedGiftsContainer.innerHTML = ownedGiftRows.map((row, index) => {
    const inputId = `gift-owned-${index}`;
    return `
      <label class="block min-w-0">
        <span class="block text-sm font-semibold mb-1">${escapeHtml(row.slotLabel || row.quality)}</span>
        <input id="${inputId}" type="number" min="0" step="1" class="input-field rounded p-2 w-full text-right" value="0" />
      </label>
    `;
  }).join('');

  currentLevelInput.disabled = false;
  targetLevelInput.disabled = false;
  recipientTypeSelect.disabled = false;
  categorySelect.disabled = false;

  const defaultCurrentLevel = GIFT_CURRENT_LEVEL_BOUNDS.min;
  const defaultTargetLevel = Math.min(GIFT_TARGET_LEVEL_BOUNDS.max, defaultCurrentLevel + 1);
  const defaults = {
    'gift-current-level': String(defaultCurrentLevel),
    'gift-target-level': String(defaultTargetLevel),
    'gift-recipient-type': savedRecipientType.id,
    'gift-category': 'daily',
  };

  [currentLevelInput, targetLevelInput].forEach((input) => {
    const bounds = input.id === 'gift-current-level' ? GIFT_CURRENT_LEVEL_BOUNDS : GIFT_TARGET_LEVEL_BOUNDS;
    input.min = String(bounds.min);
    input.max = String(bounds.max);
    input.value = saved[input.id] || defaults[input.id] || String(bounds.min);
  });
  GIFT_KINGDOMS.forEach((kingdom) => {
    const input = document.getElementById(`gift-coins-${kingdom.id}`);
    if (input) input.value = saved[input.id] || '0';
  });
  ownedGiftRows.forEach((row, index) => {
    const input = document.getElementById(`gift-owned-${index}`);
    if (input) input.value = saved[input.id] || '0';
  });

  [recipientTypeSelect, categorySelect].forEach((select) => {
    const desiredValue = saved[select.id] || defaults[select.id] || '';
    const hasOption = Array.from(select.options).some((option) => option.value === desiredValue);
    if (hasOption) select.value = desiredValue;
  });
  if (currentFavorInput && saved['gift-current-favor'] !== undefined) {
    currentFavorInput.value = saved['gift-current-favor'];
  }

  if (status) {
    status.textContent = levelRows.length && qualityRows.length
      ? t('gift_loaded_status', { levels: levelRows.length, qualities: qualityRows.length })
      : t('gift_no_data');
  }
  updateGiftCalculatorResult();
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
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
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
    setReadOnlyField(output, hasSheetStoneValue);
    output.closest('label')?.querySelector('.readonly-badge')?.classList.toggle('hidden', !hasSheetStoneValue);
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

function readTargetDomValues() {
  const values = {};
  document.querySelectorAll('[id^="target-"]').forEach((input) => { values[input.id] = input.value; });
  return values;
}

function applyTargetDomValues(values) {
  Object.entries(values).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input) input.value = value;
  });
}

function switchTargetLayout(containers, nextMode) {
  const layoutSelect = document.getElementById('target-level-layout-mode');
  const currentMode = layoutSelect?.value || 'compact';
  if (!layoutSelect || currentMode === nextMode) return;
  const relicMode = document.getElementById('target-relic-layout-mode')?.value || 'element';
  const values = convertTargetLayout(readTargetDomValues(), currentMode, nextMode, relicMode);
  applyTargetDomValues(values);
  layoutSelect.value = nextMode;
  saveAllInputs();
  renderTargetLevels(containers.targetLevels);
  loadAllInputs(['season-select']);
  triggerRecalculate(containers);
}

function switchTargetRelicLayout(containers, nextMode) {
  const relicSelect = document.getElementById('target-relic-layout-mode');
  const currentMode = relicSelect?.value || 'element';
  if (!relicSelect || currentMode === nextMode) return;
  const values = convertRelicLayout(readTargetDomValues(), currentMode, nextMode);
  applyTargetDomValues(values);
  relicSelect.value = nextMode;
  saveAllInputs();
  renderTargetLevels(containers.targetLevels);
  loadAllInputs(['season-select']);
  triggerRecalculate(containers);
}

function markTargetRecommendationCustom(target) {
  if (!target?.id || !target.id.startsWith('target-')) return;
  if (target.id === 'target-character') target.removeAttribute('data-dungeon-auto-level');
  if (target.id === 'target-primordial_star') return;

  const selector = document.getElementById('target-recommendation-type');
  if (selector && selector.value !== 'custom') selector.value = 'custom';
}

function restoreDungeonAutoTargetLevel() {
  const input = document.getElementById('target-character');
  const level = parseNumberValue(input?.dataset.dungeonAutoLevel);
  if (input && level > 0) input.value = String(level);
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
  const levelLimit = parseNumberValue(powerRow?.level_limit);
  const levelLimitEl = document.getElementById('dungeon-power-level-limit');
  if (levelLimitEl) {
    levelLimitEl.textContent = levelLimit > 0
      ? t('dungeon_power_level_limit', { level: levelLimit })
      : '';
  }

  const targetCharacterInput = document.getElementById('target-character');
  const previousAutoLevel = parseNumberValue(targetCharacterInput?.dataset.dungeonAutoLevel);
  const targetValue = targetCharacterInput?.value.trim() || '';
  const canAutoFillTarget = !hasCompletedInitialLoad || !targetValue || (previousAutoLevel > 0 && Number(targetValue) === previousAutoLevel);
  if (targetCharacterInput && canAutoFillTarget && levelLimit > 0) {
    targetCharacterInput.value = String(levelLimit);
    targetCharacterInput.dataset.dungeonAutoLevel = String(levelLimit);
  }

  fields.innerHTML = DUNGEON_DIFFICULTIES.map((difficulty) => {
    const value = formatPowerRequirement(powerRow?.powers?.[difficulty] || '');
    const difficultyLabel = getDifficultyLabel(difficulty);
    const safeDifficulty = escapeHtml(difficultyLabel);
    const safeValue = escapeHtml(value);
    return `
      <label class="field-group field-group--readonly block min-w-0">
        <span class="field-label-row block text-sm font-semibold mb-1">
          <span>${safeDifficulty}</span>
          <span class="readonly-badge">${escapeHtml(t('readonly_badge'))}</span>
        </span>
        <input
          class="readonly-field rounded p-2 w-full text-right"
          value="${safeValue}"
          placeholder=""
          readonly
          aria-readonly="true"
          aria-label="${escapeHtml(t('power_requirement_aria', { difficulty: difficultyLabel }))}"
        />
      </label>
    `;
  }).join('');
  panel.classList.remove('hidden');
}

async function initGlobalContext(containers, saved = {}) {
  const serverSelect = document.getElementById('server-select');
  const playerInput = document.getElementById('player-code-input');
  const playerError = document.getElementById('player-code-error');
  if (!serverSelect || !playerInput) return;

  const servers = await fetchServerRows();
  const savedPlayerNumber = normalizePlayerNumber(saved.playerNumber || saved['player-code-input'] || '');
  const savedServerValue = String(saved.serverId || saved['server-select'] || saved.serverName || '').trim();
  const savedServer = findServerById(servers, savedServerValue)
    || servers.find((server) => server.server_name === savedServerValue)
    || null;
  let syncGeneration = 0;

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.textContent = t('server_select_placeholder');
  serverSelect.replaceChildren(placeholder);
  servers.forEach((server) => {
    const option = document.createElement('option');
    option.value = String(server.server_id);
    option.dataset.serverId = String(server.server_id);
    option.dataset.serverName = server.server_name;
    option.textContent = `[${server.server_id}] ${server.server_name || t('server_unknown_name')}`;
    serverSelect.appendChild(option);
  });

  const ensureServerOption = (serverId, serverName) => {
    if (!serverId) return null;
    let option = [...serverSelect.options].find((candidate) => candidate.value === serverId);
    if (!option) {
      option = document.createElement('option');
      option.value = serverId;
      option.dataset.serverId = serverId;
      option.dataset.serverName = serverName || t('server_unknown_name');
      option.textContent = `[${serverId}] ${option.dataset.serverName}`;
      serverSelect.appendChild(option);
    }
    return option;
  };

  const persistLegacyCompatibility = (context) => {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    data['player-code-input'] = context.playerNumber;
    data['server-select'] = context.serverId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const notifyContext = (context, source, previous) => {
    const changed = ['playerNumber', 'playerSuffix', 'serverId', 'serverName', 'realmCode', 'realm', 'world']
      .some((key) => previous[key] !== context[key]);
    if (!changed) return false;
    Object.assign(state, {
      playerNumber: context.playerNumber,
      playerSuffix: context.playerSuffix,
      serverName: context.serverName,
      realmCode: context.realmCode,
      worldNumber: context.worldNumber,
    });
    globalStore.update({ ...context, parsedServer: context.server });
    window.dispatchEvent(new CustomEvent('sxstx:global-context-change', { detail: { ...context, source } }));
    return true;
  };

  const syncContext = async (source, inputValue, requestedServerId = '') => {
    const generation = ++syncGeneration;
    const previous = globalStore.getState();
    const normalizedInput = normalizePlayerNumber(inputValue);
    const next = resolvePlayerContext({
      source,
      playerNumber: normalizedInput,
      serverId: requestedServerId,
      serverRows: servers,
      unknownName: t('server_unknown_name'),
    });
    playerInput.value = source === 'server-select' && next.playerNumber !== normalizedInput
      ? next.playerNumber
      : inputValue;
    if (next.serverId) {
      ensureServerOption(next.serverId, next.serverName);
      serverSelect.value = next.serverId;
    } else {
      serverSelect.value = '';
    }

    if (playerError) {
      playerError.textContent = normalizedInput && !/^\d{12}$/.test(normalizedInput)
        ? t('player_code_invalid')
        : '';
    }

    const didChange = notifyContext(next, source, previous);
    if (didChange) persistLegacyCompatibility(next);
    if (generation !== syncGeneration || !didChange) return;

    if (source !== 'initial-load' && next.serverId !== previous.serverId) {
      await initTargetTimeControls(containers);
      triggerRecalculate(containers);
      updateTargetTimeFormDefaults();
    }
  };

  if (savedPlayerNumber) playerInput.value = savedPlayerNumber;
  if (serverSelect.dataset.serverBound !== '1') {
    serverSelect.dataset.serverBound = '1';
    serverSelect.addEventListener('change', () => {
      void syncContext('server-select', playerInput.value, serverSelect.value);
    });
  }
  if (playerInput.dataset.playerBound !== '1') {
    playerInput.dataset.playerBound = '1';
    playerInput.addEventListener('input', () => {
      void syncContext('player-input', playerInput.value);
    });
  }

  const savedPlayer = parsePlayerNumber(savedPlayerNumber, servers);
  const initialServerId = savedPlayer.ok
    ? savedPlayer.serverId
    : deriveServerContext(savedServer?.server_id || savedServerValue, servers).serverId || '';
  await syncContext('initial-load', savedPlayer.ok ? savedPlayerNumber : playerInput.value, initialServerId);
  await initTargetTimeControls(containers);
  window.addEventListener('languagechange', () => {
    placeholder.textContent = t('server_select_placeholder');
    Array.from(serverSelect.options).forEach((option) => {
      if (!option.value) return;
      option.textContent = `[${option.value}] ${option.dataset.serverName || t('server_unknown_name')}`;
    });
  });
}
async function initWorldRally() {
  const playerInput = document.getElementById('player-code-input');
  const seasonSelect = document.getElementById('season-select');
  const serverSelect = document.getElementById('server-select');
  const panel = document.getElementById('world-rally-panel');
  const resultElement = document.getElementById('world-rally-result');
  if (!playerInput || !seasonSelect || !serverSelect || !panel || !resultElement) return;

  const [serverRows, rallyRules] = await Promise.all([fetchServerRows(), loadRallyRules()]);

  const renderMessage = (message, className = 'world-rally-state') => {
    resultElement.replaceChildren();
    const paragraph = document.createElement('p');
    paragraph.className = className;
    paragraph.textContent = message;
    resultElement.appendChild(paragraph);
  };

  const appendEntries = (container, entries) => {
    const list = document.createElement('ul');
    list.className = 'world-rally-server-list';
    entries.forEach((entry) => {
      const item = document.createElement('li');
      item.dataset.serverId = entry.serverId;
      item.className = entry.isCurrent ? 'world-rally-server current-server' : 'world-rally-server';
      const label = document.createElement('span');
      label.textContent = entry.label;
      item.appendChild(label);
      if (entry.isCurrent) {
        const indicator = document.createElement('strong');
        indicator.className = 'current-server-indicator';
        indicator.textContent = t('world_rally_current_indicator');
        item.appendChild(indicator);
      }
      list.appendChild(item);
    });
    container.appendChild(list);
  };

  renderWorldRallyFromGlobalState = () => {
    const context = globalStore.getState();
    if (!context.serverId) {
      renderMessage(t('world_rally_empty_prompt'));
      return;
    }

    const viewModel = createWorldRallyViewModel({
      playerNumber: context.playerNumber,
      serverId: context.serverId,
      season: seasonSelect.value,
      serverRows,
      ruleRows: rallyRules,
    });
    if (!viewModel.playerSummary) {
      renderMessage(t('player_code_invalid'), 'world-rally-state world-rally-state-error');
      return;
    }

    resultElement.replaceChildren();
    const summary = document.createElement('section');
    summary.className = 'world-rally-section world-rally-summary';
    const summaryHeading = document.createElement('h3');
    summaryHeading.textContent = t('world_rally_player_summary');
    const summaryList = document.createElement('dl');
    summaryList.className = 'world-rally-summary-grid';
    const fields = [
      ['world_rally_player_number', viewModel.playerSummary.playerNumber || t('player_code_incomplete')],
      ['world_rally_selected_season', viewModel.playerSummary.season],
      ['world_rally_server_id', viewModel.playerSummary.serverId],
      ['world_rally_server_name', viewModel.playerSummary.serverName || t('world_rally_unknown_server')],
      ['world_rally_realm_code', viewModel.playerSummary.realmCode],
      ['world_rally_world_number', viewModel.playerSummary.worldNumber],
    ];
    fields.forEach(([key, value]) => {
      const wrapper = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = t(key);
      description.textContent = String(value);
      wrapper.append(term, description);
      summaryList.appendChild(wrapper);
    });
    summary.append(summaryHeading, summaryList);

    const realm = document.createElement('section');
    realm.className = 'world-rally-section';
    const realmHeading = document.createElement('h3');
    realmHeading.textContent = t('world_rally_realm_heading');
    const realmExplanation = document.createElement('p');
    realmExplanation.textContent = t('world_rally_realm_explanation');
    realm.append(realmHeading, realmExplanation);
    appendEntries(realm, viewModel.realmEntries);

    const rally = document.createElement('section');
    rally.className = 'world-rally-section';
    const rallyHeading = document.createElement('h3');
    rallyHeading.textContent = t('world_rally_group_heading');
    rally.appendChild(rallyHeading);
    if (!viewModel.enabled) {
      const message = document.createElement('p');
      message.className = 'world-rally-state';
      message.textContent = viewModel.supported
        ? t('world_rally_disabled_for_season')
        : t('world_rally_rule_unavailable');
      rally.appendChild(message);
    } else {
      appendEntries(rally, viewModel.rallyEntries);
    }
    resultElement.append(summary, realm, rally);
  };
  const renderWhenActive = () => {
    if (!panel.classList.contains('hidden')) renderWorldRallyFromGlobalState();
  };
  if (panel.dataset.worldRallyBound !== '1') {
    panel.dataset.worldRallyBound = '1';
    window.addEventListener('sxstx:global-context-change', renderWhenActive);
    seasonSelect.addEventListener('change', renderWhenActive);
  }
  if (!panel.classList.contains('hidden')) renderWorldRallyFromGlobalState();
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
    if (getPresetTitleKey(p) === SEASON_CATEGORY) return false;
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

  // These controls are refreshed when the server or season changes. Replace
  // the handlers instead of stacking another listener on every refresh.
  presetSel.onchange = apply;
  customInput.oninput = apply;

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
  const bondMats = ['freeze_dried'];
  const storeMats = ['stone', 'essence', 'sand', 'freeze_dried']; 

  dungeonMats.forEach((m) => updateMaterialSourceRow('dungeon', m));
  exploreMats.forEach((m) => updateMaterialSourceRow('explore', m));
  bondMats.forEach((m) => updateMaterialSourceRow('bond', m));
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
        mirrorCompactCurrentLevelInput(t);
        if (t.id?.startsWith('equipment-season-')) {
          updateEquipmentSeasonScore();
          saveAllInputs();
          return;
        }

        if (t.id?.startsWith('fragment-')) {
          updateFragmentCalculator();
          saveAllInputs();
          return;
        }

        if (t.id?.startsWith('gift-')) {
          updateGiftCalculatorResult();
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
      if (t.id === 'job-select') {
        initEquipmentSeasonScore().then(() => saveAllInputs());
        return;
      }

      if (t.id?.startsWith('equipment-season-')) {
        updateEquipmentSeasonScore();
        saveAllInputs();
        return;
      }

      if (t.id?.startsWith('fragment-')) {
        if (t.id === 'fragment-discount-fee') updateFragmentFeeRates();
        if (t.id === 'fragment-dungeon-select') updateDungeonFragmentYield();
        updateFragmentCalculator();
        saveAllInputs();
        return;
      }

      if (t.id?.startsWith('gift-')) {
        updateGiftCalculatorResult();
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

    const currentLayoutButton = e.target.closest('.current-layout-mode-btn');
    if (currentLayoutButton) {
      switchCurrentLevelLayout(containers, currentLayoutButton.dataset.category, currentLayoutButton.dataset.mode);
      return;
    }

    const targetLayoutButton = e.target.closest('.target-layout-mode-btn');
    if (targetLayoutButton) {
      switchTargetLayout(containers, targetLayoutButton.dataset.mode);
      return;
    }

    const targetRelicButton = e.target.closest('.target-relic-mode-btn');
    if (targetRelicButton) {
      switchTargetRelicLayout(containers, targetRelicButton.dataset.mode);
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


function getFeatureStatusTarget(tool) {
  if (tool === 'gift') return document.getElementById('gift-calculator-status');
  if (tool === 'world-rally') return document.getElementById('world-rally-result');
  if (tool === 'equipment') return document.getElementById('fragment-calculator-status');
  return document.getElementById('global-data-status');
}

function setFeatureLoading(tool) {
  const target = getFeatureStatusTarget(tool);
  if (!target) return;
  if (tool === 'world-rally') target.innerHTML = '<p class="world-rally-state">Loading World Rally data...</p>';
  else target.textContent = 'Loading feature data...';
}

function renderFeatureUnavailable(tool, error, retry) {
  const target = getFeatureStatusTarget(tool) || document.getElementById('global-data-status');
  if (!target) return;
  setGlobalDataStatus('unavailable', `${error?.sheet || 'Required Google data'} is unavailable.`);
  target.replaceChildren();
  const message = document.createElement('span');
  const sheet = error?.sheet ? `${error.sheet} (gid ${error.gid})` : 'Required Google data';
  message.textContent = `${sheet} is unavailable: ${error?.message || 'Unknown error'}`;
  target.appendChild(message);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'data-retry-button';
  button.textContent = 'Retry';
  button.addEventListener('click', retry, { once: true });
  target.appendChild(button);
}

let activeFeatureGeneration = 0;
async function initializeActiveFeature(containers, saved = {}, { refresh = false } = {}) {
  const tool = globalStore.getState().activeTool || readToolFromLocation();
  const generation = ++activeFeatureGeneration;
  setFeatureLoading(tool);
  if (refresh) {
    clearControllerRemoteRowsCaches();
    clearRemoteDataMemoryCaches();
  }

  try {
    if (tool === 'primordial') {
      await loadDataForSeason(state.seasonId);
      if (generation !== activeFeatureGeneration) return;
      preprocessCostData();
      renderAll(containers);
      bindTooltipLayers();
      loadAllInputs(['season-select']);
      syncSavedCompactCurrentLevels();
      renderRelicDistribution(containers.relicDistributionInputs);
      restoreDungeonAutoTargetLevel();
      updateRelicModeButtons();
      await Promise.allSettled([
        initEquipmentSeasonScore(saved),
        renderPrimordialRecommendations(),
        loadMaterialAvgDefaults(),
      ]);
      renderMaterialSource(containers);
      updateRelicTotal();
      triggerRecalculate(containers);
    } else if (tool === 'equipment') {
      await Promise.all([initFragmentCalculator(saved), initDungeonFragmentYield(saved)]);
      updateFragmentFeeRates();
      updateFragmentCalculator();
    } else if (tool === 'gift') {
      await renderGiftCalculator(saved);
    } else if (tool === 'world-rally') {
      await initWorldRally();
    } else if (tool === 'contribution') {
      const settled = await Promise.allSettled([initTargetTimeControls(containers)]);
      const failed = settled.find((result) => result.status === 'rejected');
      if (failed) throw failed.reason;
      updateTargetTimeFormDefaults();
    }
    if (generation !== activeFeatureGeneration) return;
    setGlobalDataStatus(
      state.cacheFallback ? 'stale' : 'ready',
      state.cacheFallback ? t('cache_fallback_notice') : t('data_status_ready')
    );
    hasCompletedInitialLoad = true;
  } catch (error) {
    if (generation !== activeFeatureGeneration) return;
    console.error('[feature initialization]', tool, error);
    renderFeatureUnavailable(tool, error, () => initializeActiveFeature(containers, saved, { refresh: true }));
  }
}

async function handleSeasonChange(containers) {
  const seasonSelector = document.getElementById('season-select');
  state.seasonId = seasonSelector?.value || state.seasonId || 's2';
  globalStore.update({ seasonId: state.seasonId });
  state.cacheFallback = false;
  await initTargetTimeControls(containers);
  await initializeActiveFeature(
    containers,
    JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'),
    { refresh: true }
  );
}

function openGoogleCalendarEvent({ title, details, eventTs }) {
  const eventStart = new Date(eventTs);
  const eventEnd = new Date(eventTs);
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
    eventTs: levelupTs,
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
    eventTs: etaTs,
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
  let containers = null;
  let saved = {};

  await runShellBootstrap({
    documentLike: document,
    loadingMessage: t('loading_app_data'),
    onLoadingChange(loading) {
      isAppLoading = loading;
    },
    mountShell() {
      containers = getContainers();
      applyMobileSectionOrder();
      renderAll(containers);
    },
    async restorePreferences() {
      await initLanguage();
      renderAll(containers);
      enhanceStaticFieldTooltips();
      bindTooltipLayers();
      bindGlobalHandlers(containers);
      bindDataCacheHandlers(containers);
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      initSeasonSelector(containers, saved);
      bindTargetTimeFormToggle();

      const clearLocalDataBtn = document.getElementById('clear-local-data-btn');
      clearLocalDataBtn?.addEventListener('click', () => {
        if (confirm(t('confirm_clear_local_data'))) {
          localStorage.removeItem(STORAGE_KEY);
          alert(t('alert_local_data_cleared'));
          location.reload();
        }
      });
    },
    async initializeGlobalContext() {
      globalStore.update({
        activeTool: readToolFromLocation(),
        seasonId: state.seasonId,
        language: document.documentElement.lang,
        theme: document.documentElement.dataset.theme || 'light',
      });
      await initGlobalContext(containers, saved);
    },
    onError(error, stage) {
      console.error('[bootstrap]', stage, error);
      renderBootstrapError(document, error, () => init());
    },
    onTimeout(error) {
      console.error('[bootstrap watchdog]', error);
      renderBootstrapError(document, error, () => init());
    },
  });
  if (!containers) return;
  setupAutoUpdate();
  setInterval(() => updateCurrentTime(containers.currentTimeDisplay), 1000);
  updateCurrentTime(containers.currentTimeDisplay);

  window.addEventListener('languagechange', () => {
    applyStaticTranslations();
    refreshSeasonSelectorLabels();
    applyMobileSectionOrder();
    renderAll(containers);
    initializeActiveFeature(containers, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  });
  window.addEventListener('resize', applyMobileSectionOrder, { passive: true });
  window.addEventListener('sxstx:tool-change', () => {
    initializeActiveFeature(containers, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  });

  initializeActiveFeature(containers, saved);
}

document.addEventListener('DOMContentLoaded', init);

