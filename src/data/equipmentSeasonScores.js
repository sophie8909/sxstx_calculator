export const EQUIPMENT_SLOT_IDS = [
  'main_weapon',
  'off_weapon',
  'helmet',
  'armor',
  'boots',
];

export const EQUIPMENT_CLASS_DISPLAY_KEYS = {
  sage: { main_weapon: 'staff', off_weapon: 'orb' },
  warlock: { main_weapon: 'staff', off_weapon: 'book' },
  fighter: { main_weapon: 'sword', off_weapon: 'knuckle' },
  knight: { main_weapon: 'sword', off_weapon: 'shield' },
};

export const EQUIPMENT_SEASON_SCORE_COLUMN_BY_SEASON = {
  s1: 'abyss',
  s2: 'abyss',
  s3: 'mythic',
  s4: 'miracle',
  s5: 'abyss',
};

export const EQUIPMENT_SEASON_SCORE_OPTIONS = [
  { id: 's1-zhurong', season: 's1', name: '鎔鑄', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's1-thunder', season: 's1', name: '雷電', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's1-red-soul', season: 's1', name: '赤魂', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's1-sakura', season: 's1', name: '神櫻', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's1-thunder-god', season: 's1', name: '雷神', source: 'abyss', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's2-jade', season: 's2', name: '玉石', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's2-ink', season: 's2', name: '玄墨', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's2-auspicious-cloud', season: 's2', name: '祥雲', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's2-red-tide', season: 's2', name: '赤潮', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's2-kirin', season: 's2', name: '麒麟', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's2-destiny', season: 's2', name: '天命', source: 'abyss', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's3-sacred-tree', season: 's3', name: '聖樹', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's3-pure-water', season: 's3', name: '淨水', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's3-shadow', season: 's3', name: '幽影', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's3-soul-lock', season: 's3', name: '魂鎖', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's3-oath', season: 's3', name: '誓約', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's3-sunfire', season: 's3', name: '陽炎', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's3-world-rift', season: 's3', name: '裂世', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's3-divine-seal', season: 's3', name: '神印', source: 'abyss', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's4-time', season: 's4', name: '時光', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  {
    id: 's4-voyage',
    season: 's4',
    name: '航海',
    source: 'normal',
    scores: { abyss: 0, mythic: 0, miracle: 0 },
    displayNames: {
      off_weapon: { orb: '航海船舵' },
    },
  },
  { id: 's4-sea-emperor', season: 's4', name: '海皇', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's4-kingdom', season: 's4', name: '王國', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  { id: 's4-celestial', season: 's4', name: '天象', source: 'normal', scores: { abyss: 0, mythic: 0, miracle: 0 } },
  {
    id: 's4-cloud',
    season: 's4',
    name: '雲朵',
    source: 'normal',
    scores: { abyss: 0, mythic: 0, miracle: 3810 },
    displayNames: {
      off_weapon: { knuckle: '星流月落', shield: '星天邀約' },
      boots: '雲朵星靴',
    },
  },
  {
    id: 's4-night-sky',
    season: 's4',
    name: '夜空',
    source: 'normal',
    scores: { abyss: 0, mythic: 4670, miracle: 0 },
    displayNames: {
      main_weapon: { staff: '午夜嘻笑', sword: '嗤嘲夜幕' },
      off_weapon: { orb: '星夜笑語', book: '月夜童話', knuckle: '迷夜星爪' },
      helmet: '夜宴笑靨',
      armor: '星夜禮服',
      boots: '夜空皮靴',
    },
  },
  {
    id: 's4-phantom-god',
    season: 's4',
    name: '幻神',
    source: 'abyss',
    scores: { abyss: 4870, mythic: 0, miracle: 0 },
    displayNames: {
      off_weapon: { knuckle: '繁瑣盛裝矯飾' },
      boots: '神眷遠征鐵靴',
    },
  },
  {
    id: 's5-frozen',
    season: 's5',
    name: '冰封',
    source: 'normal',
    scores: { abyss: 0, mythic: 0, miracle: 0 },
    displayNames: {
      main_weapon: { staff: '封凍咒杖', sword: '冰封古劍' },
      off_weapon: { orb: '冰凝核心', shield: '凍土衛護' },
      helmet: '冰稜鐵盔',
      armor: '冰晶甲冑',
      boots: '蝕冰護脛',
    },
  },
];

export const EQUIPMENT_RATING_THRESHOLDS = {
  s1: {},
  s2: {},
  s3: {},
  s4: { c: 5600, b: 7200, a: 10200, s: 12000, ss: 16800, sss: 21200 },
  s5: {},
};
