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
} from './view.js';
import { applyStaticTranslations, initLanguage, t } from './i18n-inline.js';

/* ============================================================
 * Google 閰衣?銵剁?Published CSV嚗身摰????賊? / 隡箸??其?皞?
 * 閰衣?銵冽?雿?server_name, description, time
 * ============================================================ */
const TIME_PRESETS_SHEET = {
  base: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMlpHJpHMNQTCxhYgj2fmvazou_cQpAiVa-w5tg7WR2EJTn4EExoLwojYM3BoS8FSTpxvaKIQdmPQC/pub',
  gid: '717680438',
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

function getServerGroupMembers(name) {
  return normalizeServerName(name)
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
  return isSubsetMembers(aMembers, bMembers) || isSubsetMembers(bMembers, aMembers);
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

function readBedProgressState() {
  const currentLevel = parseInt(document.getElementById('character-current')?.value, 10) || 0;
  const ownedWan = getOwnedExpWanValue();
  const bedHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;
  const targetLevel = parseInt(document.getElementById('target-character')?.value, 10) || 0;
  const ownedExp = syncOwnedExpInputFromWan(ownedWan);

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
  const targetBonusHours = getSpeedupHoursForHours(getTargetTimeHoursRemaining());
  const { levelupTs, minutesNeeded } = computeEtaToNextLevel(
    currentLevel,
    ownedExp,
    bedHourly,
    nextLevelBonusHours
  );
  renderLevelupTimeText(minutesNeeded, levelupTs);

  const { minutesNeeded: targetMinutesNeeded, etaTs } =
    computeEtaToTargetLevel(currentLevel, ownedExp, bedHourly, targetLevel, targetBonusHours);
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
  const url = `${TIME_PRESETS_SHEET.base}?output=csv&gid=${encodeURIComponent(TIME_PRESETS_SHEET.gid)}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(s => s.trim().toLowerCase());
    const serverIdx = headers.indexOf('server_name');

    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(s => s.trim());
      const server = cols[serverIdx] || '';
      const normalizedServer = normalizeServerName(server);
      if (normalizedServer) out.push(normalizedServer);
    }
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
async function fetchTimePresetsFromSheet() {
  const url = `${TIME_PRESETS_SHEET.base}?output=csv&gid=${encodeURIComponent(TIME_PRESETS_SHEET.gid)}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(s => s.trim().toLowerCase());

    const serverIdx = headers.indexOf('server_name');
    const descIdx   = headers.indexOf('description');
    const timeIdx   = headers.indexOf('time');
    const seasonIdx = headers.indexOf('season_id');

    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cols  = lines[i].split(',').map(s => s.trim());
      const server = normalizeServerName(cols[serverIdx] || '');
      const desc   = cols[descIdx]   || '';
      const time   = cols[timeIdx]   || '';
      const rawSeasonId = seasonIdx >= 0 ? (cols[seasonIdx] || '') : '';
      if (!server && !desc && !time) continue;

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
            continue;
          }
        }
      }

      const isoTime = `${datePart}T08:00:00+08:00`;

      const inferredSeasonId = rawSeasonId || (desc.match(/\b(s\d+)\b/i)?.[1]?.toLowerCase() ?? '');

      out.push({
        key: `${server}_${i}`,
        season_id: inferredSeasonId,
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

  const allPresets = await fetchTimePresetsFromSheet();
  const selectedServer = normalizeServerName(state.serverName);
  const selectedSeasonId = state.seasonId;
  const nowTs = Date.now();

  // 憛怠 select嚗?整?撩????賊?
  presetSel.innerHTML = '';
  allPresets.forEach(p => {
    if (p.server_name && !areServerGroupsEquivalentOrMerged(p.server_name, selectedServer)) return;
    if (p.season_id && p.season_id !== selectedSeasonId) return;
    if (p.iso) {
      const presetTs = new Date(p.iso).getTime();
      if (Number.isFinite(presetTs) && presetTs < nowTs) return;
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

  // ??憪?隡箸??券?殷???隡箸??刻??亦璅????
  await initServerSelector(containers);
  await initTargetTimeControls(containers);

  updateRelicTotal();
  triggerRecalculate(containers);
}

/* -----------------------------
 * ??賊?嚗????祈??綽?
 * ---------------------------*/
async function enableLevelUpNotifications() {
  {
    const { currentLevel, ownedWan, ownedExp, bedHourly } = readBedProgressState();
    const bonusHours = getNextLevelSpeedupHours(currentLevel, ownedExp, bedHourly);

    const notifyTimeSelect = document.getElementById('notify-time-select');
    let notifyTime = 0;
    if (notifyTimeSelect.value === 'min1') notifyTime = 1;
    else if (notifyTimeSelect.value === 'min2') notifyTime = 2;
    else if (notifyTimeSelect.value === 'min3') notifyTime = 3;
    else if (notifyTimeSelect.value === 'min5') notifyTime = 5;

    if (Number.isNaN(ownedWan)) return;

    import('./model.js').then(({ scheduleLevelUpNotification }) => {
      scheduleLevelUpNotification(currentLevel, ownedExp, bedHourly, currentLevel + 1, notifyTime, bonusHours);
      alert(t('alert_notify_enabled'));
    });
    return;
  }

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

  import('./model.js').then(({ scheduleLevelUpNotification }) => { // TODO: 頝臬???./model/model.js ?寧 ./model.js
    scheduleLevelUpNotification(curLv, ownedExp, bedHourly, curLv + 1, notifyTime);
      alert(t('alert_notify_enabled'));
  });
}

async function disableLevelUpNotifications() {
  import('./model.js').then(({ clearLevelUpNotification }) => { // TODO: 頝臬???./model/model.js ?寧 ./model.js
    clearLevelUpNotification();
    alert(t('alert_notify_disabled'));
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

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

  // ??撱箇?鞈賢迤?詨 + 憟?脣???
  initSeasonSelector(containers, saved);

  // ?????
  const levelUpNotifyBtn = document.getElementById('enable-levelup-notify-btn');
  levelUpNotifyBtn?.addEventListener('click', () => enableLevelUpNotifications());

  const disableNotifyBtn = document.getElementById('disable-notify-btn');
  disableNotifyBtn?.addEventListener('click', () => disableLevelUpNotifications());

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

