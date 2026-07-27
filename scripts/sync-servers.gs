const SERVER_SYNC_CONFIG = Object.freeze({
  spreadsheetId: '1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E',
  canonicalSheetName: '伺服器',
  formSheetName: '伺服器時間',
  repositoryCsvUrl: 'https://raw.githubusercontent.com/sophie8909/sxstx_calculator/main/data/raw/servers.csv',
  canonicalHeaders: ['伺服器編號', '伺服器名稱'],
});

function isValidCanonicalServerId_(serverId) {
  const value = String(serverId || '').trim();
  if (!/^600\d{4}$/.test(value)) return false;
  const world = Number(value.slice(-2));
  return Number.isInteger(world) && world >= 1 && world <= 16;
}

function normalizeCanonicalServerRecord_(serverId, serverName) {
  const id = String(serverId || '').trim();
  const name = String(serverName || '').trim();
  return isValidCanonicalServerId_(id) && name ? [id, name] : null;
}

function parseSubmittedTimestamp_(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  const parsed = new Date(String(value || '').trim()).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function readRepositoryServers_() {
  const response = UrlFetchApp.fetch(SERVER_SYNC_CONFIG.repositoryCsvUrl);
  const rows = Utilities.parseCsv(response.getContentText('UTF-8'));
  const headers = rows.shift().map((header) => String(header).trim().toLowerCase());
  const idIndex = headers.indexOf('server_id');
  const nameIndex = headers.indexOf('server_name');
  if (idIndex < 0 || nameIndex < 0) throw new Error('Repository servers.csv headers are invalid.');
  return rows
    .map((row) => normalizeCanonicalServerRecord_(row[idIndex], row[nameIndex]))
    .filter(Boolean);
}

function readCanonicalServers_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues()
    .map((row) => normalizeCanonicalServerRecord_(row[0], row[1]))
    .filter(Boolean);
}

function readSubmittedServers_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = (values.shift() || []).map((header) => String(header).trim().toLowerCase());
  const timestampIndex = headers.indexOf('時間戳記');
  const nameIndex = headers.indexOf('server_name');
  const idIndex = headers.indexOf('伺服器編號');
  if (timestampIndex < 0 || nameIndex < 0 || idIndex < 0) {
    throw new Error('伺服器時間 headers are invalid.');
  }

  const latestById = new Map();
  values.forEach((row, sheetIndex) => {
    const record = normalizeCanonicalServerRecord_(row[idIndex], row[nameIndex]);
    if (!record) return;
    const [serverId, serverName] = record;
    const timestamp = parseSubmittedTimestamp_(row[timestampIndex]);
    const existing = latestById.get(serverId);
    const bothTimestampsValid = existing
      && Number.isFinite(existing.timestamp)
      && Number.isFinite(timestamp);
    const shouldReplace = !existing
      || (bothTimestampsValid ? timestamp >= existing.timestamp : sheetIndex >= existing.sheetIndex);
    if (shouldReplace) {
      latestById.set(serverId, { serverId, serverName, timestamp, sheetIndex });
    }
  });
  return [...latestById.values()].map(({ serverId, serverName }) => [serverId, serverName]);
}

function escapeCsvCell_(value) {
  const text = String(value == null ? '' : value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function backupCanonicalServers_(rows) {
  if (rows.length === 0) return;
  const content = [
    SERVER_SYNC_CONFIG.canonicalHeaders,
    ...rows,
  ].map((row) => row.map(escapeCsvCell_).join(',')).join('\n');
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd-HHmmss');
  DriveApp.createFile(`servers-canonical-backup-${timestamp}.csv`, content, MimeType.CSV);
}

function syncServers() {
  const spreadsheet = SpreadsheetApp.openById(SERVER_SYNC_CONFIG.spreadsheetId);
  const canonicalSheet = spreadsheet.getSheetByName(SERVER_SYNC_CONFIG.canonicalSheetName);
  const formSheet = spreadsheet.getSheetByName(SERVER_SYNC_CONFIG.formSheetName);
  if (!canonicalSheet || !formSheet) throw new Error('Required server sheets are missing.');

  const currentCanonical = readCanonicalServers_(canonicalSheet);
  const repositoryServers = readRepositoryServers_();
  const submittedServers = readSubmittedServers_(formSheet);
  const merged = new Map();

  submittedServers.forEach(([serverId, serverName]) => merged.set(serverId, serverName));
  repositoryServers.forEach(([serverId, serverName]) => merged.set(serverId, serverName));
  currentCanonical.forEach(([serverId, serverName]) => merged.set(serverId, serverName));

  const output = [...merged.entries()].sort(
    ([leftId], [rightId]) => Number(leftId) - Number(rightId)
  );
  if (repositoryServers.some(([serverId]) => !merged.has(serverId))) {
    throw new Error('Output validation failed: repository server records are missing.');
  }

  backupCanonicalServers_(currentCanonical);
  const values = [SERVER_SYNC_CONFIG.canonicalHeaders, ...output];
  canonicalSheet.getRange(1, 1, canonicalSheet.getMaxRows(), 2).clearContent();
  canonicalSheet.getRange(1, 1, values.length, 2).setValues(values);
  return {
    repositoryCount: repositoryServers.length,
    submittedCount: submittedServers.length,
    finalCount: output.length,
  };
}

function onFormSubmit(e) {
  if (e && e.range && e.range.getSheet().getName() === SERVER_SYNC_CONFIG.formSheetName) {
    syncServers();
  }
}
