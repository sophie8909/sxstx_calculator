import { fetchTextWithCache, RemoteDataError } from './dataCache.js';
import { getSheetDefinition, SPREADSHEET_ID } from './sheetRegistry.js';
import { mergeServerRows, normalizeSubmittedServerRows } from '../core/serverData.js';

const requestCache = new Map();

if (typeof window !== 'undefined') {
  window.addEventListener('sxstx:data-cache-updated', (event) => {
    const gid = Number(event.detail?.gid);
    if (Number.isFinite(gid)) requestCache.delete(gid);
  });
}

export class SheetDataError extends RemoteDataError {
  constructor(code, message, definition, metadata = {}, options = {}) {
    super(message, {
      code,
      sheet: definition?.title,
      gid: definition?.gid,
      ...metadata,
    }, options);
    this.name = 'SheetDataError';
  }
}

export function getGoogleSheetCsvUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
}

export function normalizeHeader(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase();
}

export function parseCsvRows(text, definition) {
  const source = String(text ?? '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];
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
  if (inQuotes) {
    throw new SheetDataError('sheet_invalid_csv', `${definition?.title || 'Google Sheet'} contains an unterminated quoted field`, definition);
  }
  row.push(cell);
  if (row.some((value) => String(value).trim() !== '')) rows.push(row);
  if (!rows.length) {
    throw new SheetDataError('sheet_empty', `${definition?.title || 'Google Sheet'} contains no rows`, definition);
  }
  return rows;
}

function parseCell(value) {
  const text = String(value ?? '').trim();
  if (text === '') return '';
  if (/^(?:true|false)$/i.test(text)) return text.toLowerCase() === 'true';
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
    throw new SheetDataError(
      'sheet_missing_headers',
      `${definition.title} is missing required headers: ${missing.join(', ')}`,
      definition,
      { missingHeaders: missing }
    );
  }
  return normalized;
}

function findHeaderRowIndex(csvRows, definition) {
  if (!(definition.requiredHeaders || []).length) return 0;
  return csvRows.findIndex((row) => {
    try {
      validateSheetHeaders(row, definition);
      return true;
    } catch {
      return false;
    }
  });
}

export function rowsToObjects(csvRows, definition) {
  const headerIndex = findHeaderRowIndex(csvRows, definition);
  if (headerIndex < 0) {
    validateSheetHeaders(csvRows[0] || [], definition);
  }
  const rawHeaders = csvRows[headerIndex] || [];
  const dataRows = csvRows.slice(headerIndex + 1);
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

function validateSheetText(text, definition) {
  const objects = rowsToObjects(parseCsvRows(text, definition), definition);
  return { signature: JSON.stringify(objects) };
}

export function clearDataServiceMemoryCache(gid) {
  if (gid === undefined || gid === null) requestCache.clear();
  else requestCache.delete(Number(gid));
}

export function loadSheet(sheetKey, { refresh = false, timeoutMs } = {}) {
  const definition = getSheetDefinition(sheetKey);
  if (refresh) requestCache.delete(definition.gid);
  if (!requestCache.has(definition.gid)) {
    const request = fetchTextWithCache(
      `google-sheet:${definition.gid}`,
      getGoogleSheetCsvUrl(definition.gid),
      {
        refresh,
        timeoutMs,
        metadata: { sheetKey, sheet: definition.title, gid: definition.gid },
        validate: (text) => validateSheetText(text, definition),
      }
    ).then((text) => rowsToObjects(parseCsvRows(text, definition), definition));
    requestCache.set(definition.gid, request);
    request.catch(() => requestCache.delete(definition.gid));
  }
  return requestCache.get(definition.gid);
}

export function refreshSheet(sheetKey, options = {}) {
  return loadSheet(sheetKey, { ...options, refresh: true });
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
  const [canonicalRows, submissionRows] = await Promise.all([
    loadSheet('servers'),
    loadSheet('serverSubmissions'),
  ]);
  const canonical = canonicalRows
    .filter((row) => /^600\d{4}$/.test(String(row.server_id || '').trim()))
    .map((row) => ({
      ...row,
      server_id: String(row.server_id || '').trim(),
      server_name: String(row.server_name || '').trim(),
      server_short: String(row.server_short || row.server_id.slice(3)).padStart(4, '0'),
      realm_id: String(row.realm_id || row.server_id.slice(3, 5)).padStart(2, '0'),
    }))
    .filter((row) => row.server_name);
  const submissions = normalizeSubmittedServerRows(submissionRows).rows;

  return mergeServerRows(canonical, submissions)
    .filter((row) => String(row.server_name || '').trim())
    .sort((left, right) => Number(left.server_id) - Number(right.server_id));
}

export function loadRallyRules(options) {
  return loadSheet('rallyRules', options);
}

export function loadGameSettings(options) {
  return loadSheet('gameSettings', options);
}
