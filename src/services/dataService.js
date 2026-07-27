import { fetchTextWithCache } from './dataCache.js';
import { getSheetDefinition, SPREADSHEET_ID } from './sheetRegistry.js';

const requestCache = new Map();

export function getGoogleSheetCsvUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
}

export function normalizeHeader(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase();
}

export function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let index = 0; index < String(text).length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];
    if (character === '"' && inQuotes && nextCharacter === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((character === '\r' || character === '\n') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  row.push(cell);
  if (row.some((value) => String(value).trim() !== '')) rows.push(row);
  return rows;
}

function parseCell(value) {
  const text = String(value ?? '').trim();
  if (text === '') return '';
  const numeric = text.replace(/,/g, '');
  if (!/^[+-]?(?:\d+|\d*\.\d+)$/.test(numeric)) return text;
  const number = Number(numeric);
  return Number.isFinite(number) ? number : text;
}

function resolveAlias(headers, definition, field) {
  const candidates = [field, ...(definition.aliases?.[field] || [])].map(normalizeHeader);
  return candidates.find((candidate) => headers.includes(candidate)) || null;
}

export function validateSheetHeaders(headers, definition) {
  const normalized = headers.map(normalizeHeader);
  const missing = (definition.requiredHeaders || []).filter((header) => {
    const canonical = normalizeHeader(header);
    if (normalized.includes(canonical)) return false;
    return !Object.entries(definition.aliases || {}).some(([field, aliases]) => (
      normalizeHeader(field) === canonical
      && aliases.some((alias) => normalized.includes(normalizeHeader(alias)))
    ));
  });
  if (missing.length) {
    throw new Error(`${definition.title} is missing required headers: ${missing.join(', ')}`);
  }
  return normalized;
}

function rowsToObjects(csvRows, definition) {
  const [rawHeaders = [], ...dataRows] = csvRows;
  const headers = validateSheetHeaders(rawHeaders, definition);
  const aliasFields = Object.keys(definition.aliases || {});
  return dataRows.map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      if (header) object[header] = parseCell(row[index]);
    });
    aliasFields.forEach((field) => {
      const sourceHeader = resolveAlias(headers, definition, field);
      if (sourceHeader) object[field] = object[sourceHeader];
    });
    if (object.season !== undefined) object.season = String(object.season).trim().toLowerCase();
    if (object.server_id !== undefined) object.server_id = String(object.server_id).trim();
    return object;
  });
}

export function clearDataServiceMemoryCache() {
  requestCache.clear();
}

export function loadSheet(sheetKey, { refresh = false } = {}) {
  const definition = getSheetDefinition(sheetKey);
  if (refresh) requestCache.delete(definition.gid);
  if (!requestCache.has(definition.gid)) {
    const request = fetchTextWithCache(
      `google-sheet:${definition.gid}`,
      getGoogleSheetCsvUrl(definition.gid),
      { refresh }
    ).then((text) => rowsToObjects(parseCsvRows(text), definition));
    requestCache.set(definition.gid, request);
    request.catch(() => requestCache.delete(definition.gid));
  }
  return requestCache.get(definition.gid);
}

export function refreshSheet(sheetKey) {
  return loadSheet(sheetKey, { refresh: true });
}

const UPGRADE_SHEET_KEYS = Object.freeze({
  character: 'characterUpgradeCosts',
  equipment: 'equipmentUpgradeCosts',
  skill: 'skillUpgradeCosts',
  relic: 'relicUpgradeCosts',
  pet: 'petUpgradeCosts',
});

export async function loadUpgradeCosts(category, season) {
  const sheetKey = UPGRADE_SHEET_KEYS[String(category || '').trim()];
  if (!sheetKey) throw new RangeError(`Unknown upgrade category: ${category}`);
  const normalizedSeason = String(season || '').trim().toLowerCase();
  const rows = await loadSheet(sheetKey);
  return rows
    .filter((row) => row.season === normalizedSeason)
    .map((row) => ({ ...row, category }));
}

export async function loadUpgradeCostTablesForSeason(season) {
  const entries = await Promise.all(
    Object.entries(UPGRADE_SHEET_KEYS).map(async ([category, sheetKey]) => {
      const rows = await loadSheet(sheetKey);
      return [
        sheetKey,
        rows
          .filter((row) => row.season === String(season).toLowerCase())
          .map((row) => ({ ...row, category })),
      ];
    })
  );
  return Object.fromEntries(entries);
}

export async function loadServers() {
  const rows = await loadSheet('servers');
  return rows
    .filter((row) => /^600\d{4}$/.test(row.server_id))
    .map((row) => ({
      ...row,
      server_name: String(row.server_name || '').trim(),
      server_short: String(row.server_short || row.server_id.slice(3)).padStart(4, '0'),
      realm_id: String(row.realm_id || row.server_id.slice(3, 5)).padStart(2, '0'),
    }))
    .sort((left, right) => Number(left.server_id) - Number(right.server_id));
}

export function loadRallyRules() {
  return loadSheet('rallyRules');
}

export function loadGameSettings() {
  return loadSheet('gameSettings');
}
