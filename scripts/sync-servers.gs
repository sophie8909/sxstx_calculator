const SERVER_SYNC_CONFIG = Object.freeze({
  spreadsheetId: '1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E',
  canonicalSheetName: '伺服器',
  formSheetName: '伺服器時間',
  canonicalHeaders: [
    '伺服器編號', '伺服器名稱', 'server_short', 'realm_id',
    'merge_2', 'merge_4', 'merge_8', 'merge_16', 'current_state',
  ],
});

function isValidCanonicalServerId_(serverId) {
  const value = String(serverId || '').trim();
  if (!/^600\d{4}$/.test(value)) return false;
  const world = Number(value.slice(-2));
  return Number.isInteger(world) && world >= 1 && world <= 16;
}

function buildMergeRange_(shortId, size) {
  const realm = Number(shortId.slice(0, 2));
  const world = Number(shortId.slice(2));
  const start = Math.floor((world - 1) / size) * size + 1;
  const end = start + size - 1;
  return `${String(realm).padStart(2, '0')}${String(start).padStart(2, '0')}-${String(realm).padStart(2, '0')}${String(end).padStart(2, '0')}`;
}

function normalizeServerRecord_(serverId, serverName) {
  const id = String(serverId || '').trim();
  const name = String(serverName || '').trim();
  if (!isValidCanonicalServerId_(id) || !name) return null;
  const shortId = id.slice(3);
  return [
    id,
    name,
    shortId,
    shortId.slice(0, 2),
    buildMergeRange_(shortId, 2),
    buildMergeRange_(shortId, 4),
    buildMergeRange_(shortId, 8),
    buildMergeRange_(shortId, 16),
    'single',
  ];
}

function ensureCanonicalHeaders_(sheet) {
  const width = SERVER_SYNC_CONFIG.canonicalHeaders.length;
  const current = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  SERVER_SYNC_CONFIG.canonicalHeaders.forEach((header, index) => {
    if (!String(current[index] || '').trim()) sheet.getRange(1, index + 1).setValue(header);
  });
}

function readLatestSubmittedServers_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = (values.shift() || []).map((value) => String(value || '').trim().toLowerCase());
  const timestampIndex = headers.indexOf('時間戳記');
  const nameIndex = headers.indexOf('server_name');
  const idIndex = headers.indexOf('伺服器編號');
  if (timestampIndex < 0 || nameIndex < 0 || idIndex < 0) throw new Error('伺服器時間 headers are invalid.');

  const latest = new Map();
  values.forEach((row, index) => {
    const record = normalizeServerRecord_(row[idIndex], row[nameIndex]);
    if (!record) return;
    const timestamp = row[timestampIndex] instanceof Date ? row[timestampIndex].getTime() : Date.parse(row[timestampIndex]);
    const existing = latest.get(record[0]);
    if (!existing || (Number.isFinite(timestamp) && timestamp >= existing.timestamp) || index >= existing.index) {
      latest.set(record[0], { record, timestamp, index });
    }
  });
  return [...latest.values()].map((entry) => entry.record);
}

function syncServers() {
  const spreadsheet = SpreadsheetApp.openById(SERVER_SYNC_CONFIG.spreadsheetId);
  const canonicalSheet = spreadsheet.getSheetByName(SERVER_SYNC_CONFIG.canonicalSheetName);
  const formSheet = spreadsheet.getSheetByName(SERVER_SYNC_CONFIG.formSheetName);
  if (!canonicalSheet || !formSheet) throw new Error('Required server sheets are missing.');

  ensureCanonicalHeaders_(canonicalSheet);
  const width = SERVER_SYNC_CONFIG.canonicalHeaders.length;
  const lastRow = canonicalSheet.getLastRow();
  const canonicalRows = lastRow > 1
    ? canonicalSheet.getRange(2, 1, lastRow - 1, width).getDisplayValues()
    : [];
  const rowById = new Map();
  canonicalRows.forEach((row, index) => {
    const id = String(row[0] || '').trim();
    if (isValidCanonicalServerId_(id)) rowById.set(id, { row, rowNumber: index + 2 });
  });

  let inserted = 0;
  let completed = 0;
  readLatestSubmittedServers_(formSheet).forEach((record) => {
    const existing = rowById.get(record[0]);
    if (!existing) {
      canonicalSheet.appendRow(record);
      inserted += 1;
      return;
    }
    record.forEach((value, columnIndex) => {
      if (!String(existing.row[columnIndex] || '').trim() && String(value || '').trim()) {
        canonicalSheet.getRange(existing.rowNumber, columnIndex + 1).setValue(value);
        completed += 1;
      }
    });
  });
  return { inserted, completed, canonicalCount: canonicalSheet.getLastRow() - 1 };
}

function onFormSubmit(e) {
  if (e && e.range && e.range.getSheet().getName() === SERVER_SYNC_CONFIG.formSheetName) syncServers();
}
