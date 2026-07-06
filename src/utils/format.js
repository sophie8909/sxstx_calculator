// utils.js

/** Create an element and apply classes. */
export function el(tag, classes = []) {
  const n = document.createElement(tag);
  if (classes.length) n.classList.add(...classes);
  return n;
}

/** Format a number with group separators. */
export function fmt(n) {
  return Number(n || 0).toLocaleString();
}

/** Find the nearest row whose level is <= the target level. */
export function findLastIndexByLevel(arr, level) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].level <= level) return i;
  }
  return -1;
}

/** Convert cost_xxx keys to material ids. */
export function costKeyToMaterialId(costKey) {
  let id = costKey.replace('cost_', '');
  return id.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
}

/** Server season-end settings. */
const SERVER_TIMEZONE = 'Asia/Taipei';
const SERVER_BIND_TIME = { hour: 23, minute: 59, second: 0 };

const SEASON_ENDS = [
  { id: 's1', label: 'S1 End', date: '2025-02-28' },
  { id: 's2', label: 'S2 End', date: '2025-05-31' },
];

/** Time-zone helpers. */
function getTzOffsetMinutes(instant, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const parts = dtf.formatToParts(instant);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  const asTZ = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second);
  return (asTZ - instant.getTime()) / 60000;
}

function makeServerEndDate(ymd, bind = SERVER_BIND_TIME, tz = SERVER_TIMEZONE) {
  const [y, m, d] = ymd.split('-').map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, bind.hour, bind.minute, bind.second);
  const offMin = -getTzOffsetMinutes(new Date(utcGuess), tz);
  return new Date(utcGuess - offMin * 60000);
}

function fmtLocal(dt) {
  return dt.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}