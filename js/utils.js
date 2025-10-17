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
