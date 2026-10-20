const RECORDS_KEY = 'sxstxLocalRecords';
const DEFAULT_RECORD_ID = 'default';

function readRecords() {
  const raw = localStorage.getItem(RECORDS_KEY);
  if (!raw) return null;
  const state = JSON.parse(raw);
  if (state?.version !== 1 || !Array.isArray(state.records) || !state.records.length
    || !state.records.every((record) => record && typeof record.id === 'string' && record.id
      && typeof record.name === 'string' && record.name.trim() && record.name.length <= 60)
    || new Set(state.records.map((record) => record.id)).size !== state.records.length
    || !state.records.some((record) => record.id === state.activeId)) {
    throw new Error('Invalid local record catalog');
  }
  return state;
}

// Keep this page bound to its own record even when another tab switches records.
const pageRecordId = (() => {
  try { return readRecords()?.activeId || DEFAULT_RECORD_ID; }
  catch { return DEFAULT_RECORD_ID; }
})();

export function getLocalRecordStorageKey(key) {
  return pageRecordId === DEFAULT_RECORD_ID ? key : `${key}:${pageRecordId}`;
}

function writeRecords(state) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(state));
  return state;
}

function validateName(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 60) {
    throw new Error('Record name must contain 1 to 60 characters');
  }
  return name.trim();
}

export function initializeLocalRecords(defaultName) {
  const state = readRecords();
  if (state) return { ...state, activeId: pageRecordId };
  return writeRecords({
    version: 1,
    activeId: DEFAULT_RECORD_ID,
    records: [{ id: DEFAULT_RECORD_ID, name: validateName(defaultName) }],
  });
}

export function renameLocalRecord(name) {
  const state = readRecords();
  const record = state?.records.find((entry) => entry.id === pageRecordId);
  if (!record) throw new Error('Current local record is unavailable');
  record.name = validateName(name);
  writeRecords(state);
  return { ...state, activeId: pageRecordId };
}

export function createLocalRecord(name) {
  const state = readRecords();
  if (!state) throw new Error('Local records are not initialized');
  const record = { id: crypto.randomUUID(), name: validateName(name) };
  return writeRecords({ ...state, activeId: record.id, records: [...state.records, record] });
}

export function switchLocalRecord(id) {
  const state = readRecords();
  if (!state?.records.some((record) => record.id === id)) throw new Error('Unknown local record');
  return writeRecords({ ...state, activeId: id });
}
