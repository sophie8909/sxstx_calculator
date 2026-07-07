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

export const EQUIPMENT_SCORE_COLUMNS = {
  abyss: { label: '深淵', scoreKey: 'abyss' },
  mythic: { label: '神話', scoreKey: 'mythic' },
  miracle: { label: '奇蹟', scoreKey: 'miracle' },
};

export const EQUIPMENT_SEASON_SCORE_ROWS = [
  { season: 's1', normalKey: '鎔鑄', scores: {} },
  { season: 's1', normalKey: '雷電', scores: {} },
  { season: 's1', normalKey: '赤魂', scores: {} },
  { season: 's1', normalKey: '神櫻', abyssKey: '雷神', scores: {} },
  { season: 's2', normalKey: '玉石', scores: {} },
  { season: 's2', normalKey: '玄墨', scores: {} },
  { season: 's2', normalKey: '祥雲', scores: {} },
  { season: 's2', normalKey: '赤潮', scores: {} },
  { season: 's2', normalKey: '麒麟', abyssKey: '天命', scores: {} },
  { season: 's3', normalKey: '聖樹', scores: {} },
  { season: 's3', normalKey: '淨水', scores: {} },
  { season: 's3', normalKey: '幽影', scores: {} },
  { season: 's3', normalKey: '魂鎖', scores: {} },
  { season: 's3', normalKey: '誓約', scores: {} },
  { season: 's3', normalKey: '陽炎', scores: {} },
  { season: 's3', normalKey: '裂世', abyssKey: '神印', scores: {} },
  { season: 's4', normalKey: '時光', scores: {} },
  {
    season: 's4',
    normalKey: '航海',
    scores: {},
    displayNames: {
      normal: {
        off_weapon: { orb: '航海船舵' },
      },
    },
  },
  { season: 's4', normalKey: '海皇', scores: {} },
  { season: 's4', normalKey: '王國', scores: {} },
  { season: 's4', normalKey: '天象', scores: {} },
  {
    season: 's4',
    normalKey: '雲朵',
    scores: { miracle: 3810 },
    displayNames: {
      normal: {
        off_weapon: { knuckle: '星流月落', shield: '星天邀約' },
        boots: '雲朵星靴',
      },
    },
  },
  {
    season: 's4',
    normalKey: '夜空',
    abyssKey: '幻神',
    scores: { abyss: 4870, mythic: 4670 },
    displayNames: {
      normal: {
        main_weapon: { staff: '午夜嘻笑', sword: '嗤嘲夜幕' },
        off_weapon: { orb: '星夜笑語', book: '月夜童話', knuckle: '迷夜星爪' },
        helmet: '夜宴笑靨',
        armor: '星夜禮服',
        boots: '夜空皮靴',
      },
      abyss: {
        off_weapon: { knuckle: '繁瑣盛裝矯飾' },
        boots: '神眷遠征鐵靴',
      },
    },
  },
  {
    season: 's5',
    normalKey: '冰封',
    scores: {},
    displayNames: {
      normal: {
        main_weapon: { staff: '封凍咒杖', sword: '冰封古劍' },
        off_weapon: { orb: '冰凝核心', shield: '凍土衛護' },
        helmet: '冰稜鐵盔',
        armor: '冰晶甲冑',
        boots: '蝕冰護脛',
      },
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
