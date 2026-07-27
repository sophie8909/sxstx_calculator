const SERVER_ID_PATTERN = /^600\d{4}$/;

export function isValidServerId(serverId) {
  const value = String(serverId ?? '').trim();
  if (!SERVER_ID_PATTERN.test(value)) return false;
  const world = Number(value.slice(5, 7));
  return Number.isInteger(world) && world >= 1 && world <= 16;
}

export function parseSubmittedServerTimestamp(value) {
  const text = String(value ?? '').trim();
  if (!text) return Number.NaN;

  const localized = text.match(
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s*(上午|下午)\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (localized) {
    const [, year, month, day, period, rawHour, minute, second = '0'] = localized;
    let hour = Number(rawHour) % 12;
    if (period === '下午') hour += 12;
    const timestamp = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      hour,
      Number(minute),
      Number(second)
    ).getTime();
    return Number.isFinite(timestamp) ? timestamp : Number.NaN;
  }

  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function toSubmittedServerRow(row, sheetIndex) {
  const serverId = String(row?.server_id ?? '').trim();
  const serverName = String(row?.server_name ?? '').trim();
  if (!isValidServerId(serverId) || !serverName) return null;

  return {
    server_id: serverId,
    server_short: serverId.slice(3),
    server_name: serverName,
    realm_id: serverId.slice(3, 5),
    merge_2: '',
    merge_4: '',
    merge_8: '',
    merge_16: '',
    current_state: 'single',
    submitted_timestamp: String(row?.timestamp ?? '').trim(),
    submitted_timestamp_ms: parseSubmittedServerTimestamp(row?.timestamp),
    submitted_sheet_index: sheetIndex,
  };
}

export function normalizeSubmittedServerRows(rows) {
  const byServerId = new Map();
  const invalidRows = [];

  (rows || []).forEach((row, sheetIndex) => {
    const normalized = toSubmittedServerRow(row, sheetIndex);
    if (!normalized) {
      invalidRows.push({
        sheetIndex,
        server_id: String(row?.server_id ?? '').trim(),
        server_name: String(row?.server_name ?? '').trim(),
      });
      return;
    }

    const existing = byServerId.get(normalized.server_id);
    if (!existing) {
      byServerId.set(normalized.server_id, normalized);
      return;
    }

    const bothTimestampsValid = Number.isFinite(existing.submitted_timestamp_ms)
      && Number.isFinite(normalized.submitted_timestamp_ms);
    const shouldReplace = bothTimestampsValid
      ? normalized.submitted_timestamp_ms >= existing.submitted_timestamp_ms
      : normalized.submitted_sheet_index >= existing.submitted_sheet_index;
    if (shouldReplace) byServerId.set(normalized.server_id, normalized);
  });

  return {
    rows: [...byServerId.values()],
    invalidRows,
  };
}

export function mergeServerRows(builtInRows, submittedRows) {
  const merged = new Map();

  (builtInRows || []).forEach((row) => {
    const serverId = String(row?.server_id ?? '').trim();
    if (serverId) merged.set(serverId, row);
  });

  (submittedRows || []).forEach((row) => {
    const serverId = String(row?.server_id ?? '').trim();
    if (isValidServerId(serverId) && !merged.has(serverId)) {
      merged.set(serverId, row);
    }
  });

  return [...merged.values()].sort(
    (left, right) => Number(left.server_id) - Number(right.server_id)
  );
}

export function mergeCanonicalServerRows(localRows, canonicalRows) {
  const merged = new Map();
  (localRows || []).forEach((row) => {
    const serverId = String(row?.server_id ?? '').trim();
    if (serverId) merged.set(serverId, row);
  });

  (canonicalRows || []).forEach((row) => {
    const serverId = String(row?.server_id ?? '').trim();
    const serverName = String(row?.server_name ?? '').trim();
    if (!isValidServerId(serverId) || !serverName) return;
    const existing = merged.get(serverId);
    merged.set(serverId, existing
      ? { ...existing, server_name: serverName }
      : row);
  });

  return [...merged.values()].sort(
    (left, right) => Number(left.server_id) - Number(right.server_id)
  );
}

export function createServerMap(serverRows) {
  return new Map(
    (serverRows || []).map((row) => [String(row?.server_id ?? '').trim(), row])
  );
}
