// js/model/constants.js
// ★ 常數配置層：包含所有靜態配置、ID 清單與模擬數據 ★

/** 全域常數 */
export const MAX_LEVEL = 200;
export const STORAGE_KEY = 'sxstxCalculatorData';

/** 左欄類別（可輸入的目前等級） */
export const categories = [
  { id: 'character', name: '角色等級' },
  { id: 'equipment_main_weapon', name: '主武器', group: '裝備等級' },
  { id: 'equipment_off_weapon', name: '副武器', group: '裝備等級' },
  { id: 'equipment_helmet', name: '頭盔', group: '裝備等級' },
  { id: 'equipment_armor', name: '鎧甲', group: '裝備等級' },
  { id: 'equipment_boots', name: '戰靴', group: '裝備等級' },
  { id: 'skill_combat1', name: '戰技一', group: '技能等級' },
  { id: 'skill_combat2', name: '戰技二', group: '技能等級' },
  { id: 'skill_combat3', name: '戰技三', group: '技能等級' },
  { id: 'skill_combat4', name: '戰技四', group: '技能等級' },
  { id: 'skill_arcane1', name: '祕法一', group: '技能等級' },
  { id: 'skill_arcane2', name: '祕法二', group: '技能等級' },
  { id: 'skill_arcane3', name: '祕法三', group: '技能等級' },
  { id: 'skill_arcane4', name: '祕法四', group: '技能等級' },
  { id: 'pet1', name: '幻獸一', group: '幻獸等級' },
  { id: 'pet2', name: '幻獸二', group: '幻獸等級' },
  { id: 'pet3', name: '幻獸三', group: '幻獸等級' },
  { id: 'pet4', name: '幻獸四', group: '幻獸等級' },
];

export const seasonOptions = [
  { id: 's1', name: 'S1 澤之國', readonly: false, season: 1 },
  { id: 's2', name: 'S2 龍之國', readonly: false, season: 2 },
  { id: 's3', name: 'S3 羽之國', readonly: false, season: 3 },
  { id: 'total', name: '總計', readonly: true },
];

/** 頂部目標等級群 */
export const targetLevelConfig = [
  { id: 'character', name: '角色等級' },
  { id: 'equipment_resonance', name: '裝備共鳴' },
  { id: 'skill_resonance', name: '技能共鳴' },
  { id: 'pet_resonance', name: '幻獸共鳴' },
  { id: 'relic_resonance', name: '遺物共鳴' },
  { id: 'primordial_star', name: '原初之星', readonly: true }, // 自動計算
];

/** 可用素材 */
export const materials = {
  exp: { name: '角色經驗', icon: '📖' },
  rola: { name: '羅拉', icon: '💰' },
  essence: { name: '歷戰精華', icon: '✨' },
  sand: { name: '時之砂', icon: '⏳' },
  stoneOre: { name: '粗煉石', icon: '💎' },
  refiningStone: { name: '精煉石', icon: '🔨' },
  freezeDried: { name: '幻獸凍乾', icon: '🍖' },
};

/** 小推車來源（手動時產） */
export const productionSources = {
  rola: { materialId: 'rola' },
  essence: { materialId: 'essence' },
  stoneOre: { materialId: 'stoneOre' },
  sand: { materialId: 'sand' },
  freezeDried: { materialId: 'freezeDried' },
};

/** 模擬資料（CSV 缺檔備援） */
export const MOCK_GAME_DATA = {
  equipmentUpgradeCosts: [
    { level: 1, cost_stone_ore: 10, cost_rola: 100, cost_refining_stone: 0 },
    { level: 2, cost_stone_ore: 20, cost_rola: 200, cost_refining_stone: 0 },
    { level: 30, cost_stone_ore: 500, cost_rola: 5000, cost_refining_stone: 1 },
  ],
  skillUpgradeCosts: [
    { level: 1, cost_essence: 50 },
    { level: 2, cost_essence: 75 },
    { level: 3, cost_essence: 100 },
  ],
  petUpgradeCosts: [
    { level: 1, cost_freeze_dried: 30 },
    { level: 2, cost_freeze_dried: 45 },
    { level: 3, cost_freeze_dried: 60 },
  ],
  relicUpgradeCosts: [
    { level: 1, cost_sand: 100, cost_rola: 1000 },
    { level: 2, cost_sand: 150, cost_rola: 1500 },
    { level: 3, cost_sand: 200, cost_rola: 2000 },
  ],
  characterUpgradeCosts: Array.from({ length: MAX_LEVEL }, (_, i) => ({
    level: i + 1,
    cost_exp: Math.floor(200 * Math.pow(i + 1, 2.2)),
  })),
};

// 1) 資源代號（需與試算表第一欄一致）
export const MATERIAL_TYPES = ['stone', 'essence', 'sand', 'rola', 'freeze_dried'];

export const MATERIAL_DISPLAY_NAMES = {
  stone: '粗煉石',
  essence: '歷戰精華',
  sand: '時之砂',
  rola: '羅拉',
  freeze_dried: '幻獸凍乾',
};

// 2) 使用者 UI 的預設「每日次數 / 購買量」
export const MATERIAL_DAILY_DEFAULTS = {
  dungeon: {
    stone: 4,
    essence: 2,
    sand: 4,
    rola: 2,
  },
  explore: {
    stone: 20,
    essence: 4,
    sand: 0,
    rola: 12,
  },
  // shop 預設留空，待 CSV 載入後依 average 填入
  shop: {},
};

/** Google 試算表基底連結（固定不動） */
export const GOOGLE_SHEET_BASE =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMlpHJpHMNQTCxhYgj2fmvazou_cQpAiVa-w5tg7WR2EJTn4EExoLwojYM3BoS8FSTpxvaKIQdmPQC/pub';

/** 各賽季資料設定，只保留 gid */
export const DATA_FILES_CONFIG = {
  characterUpgradeCosts: 314585849,  // 角色等級
  equipmentUpgradeCosts: 1205841685,  // 裝備
  skillUpgradeCosts:     682954597,  // 技能
  relicUpgradeCosts:     1548103854,  // 遺物
  petUpgradeCosts:       1910677696,  // 幻獸
  shop:                  2064242339,  // 商店 (假設的 gid，請替換為實際值)
};

export const MATERIAL_AVG_SHEETS = {
  dungeon: { base: GOOGLE_SHEET_BASE, gid: '751788076' },
  explore: { base: GOOGLE_SHEET_BASE, gid: '1733617634' },
  shop:    { base: GOOGLE_SHEET_BASE, gid: '2064242339' },
};