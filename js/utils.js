// utils.js
// 小工具與共用函式（View 與 Controller 皆可能使用）

/** 建立元素並可一次加入 class */
export function el(tag, classes = []) {
  const n = document.createElement(tag);
  if (classes.length) n.classList.add(...classes);
  return n;
}

/** 將數字做千分位 */
export function fmt(n) {
  return Number(n || 0).toLocaleString();
}

/** 取最近 <= level 的索引（陣列元素需含 level 屬性） */
export function findLastIndexByLevel(arr, level) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].level <= level) return i;
  }
  return -1;
}

/** cost_xxx -> materialId（stone_ore -> stoneOre） */
export function costKeyToMaterialId(costKey) {
  let id = costKey.replace('cost_', '');
  return id.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
}

/** ===== 伺服器與賽季結束設定 ===== */
const SERVER_TIMEZONE = 'Asia/Taipei';          // 伺服器時區（例：台港服）
const SERVER_BIND_TIME = { hour: 23, minute: 59, second: 0 }; // 你要綁定的固定時間點

// 在這裡維護賽季結束「日期」（不含時間，時間由 SERVER_BIND_TIME 決定）
const SEASON_ENDS = [
  { id: 's1', label: 'S1 澤之國 結束', date: '2025-02-28' },
  { id: 's2', label: 'S2 龍之國 結束', date: '2025-05-31' },
  // ... 需要就往下加
];

/** ===== 時區工具：把某個「伺服器時區的年月日 + 固定時刻」轉成 Date ===== */
// 取得某個瞬間在指定時區的「相對 UTC offset（分鐘）」
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
  return (asTZ - instant.getTime()) / 60000; // 分鐘
}

// 把「YYYY-MM-DD + 固定時刻」視為 SERVER_TIMEZONE 的牆上時間 → Date
function makeServerEndDate(ymd, bind = SERVER_BIND_TIME, tz = SERVER_TIMEZONE) {
  const [y, m, d] = ymd.split('-').map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, bind.hour, bind.minute, bind.second);
  const offMin = -getTzOffsetMinutes(new Date(utcGuess), tz); // 注意正負號
  return new Date(utcGuess - offMin * 60000);
}

/** 顯示用：轉成人類可讀字串（顯示使用者本地時區） */
function fmtLocal(dt) {
  return dt.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}