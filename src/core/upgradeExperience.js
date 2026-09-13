const EXPERIENCE_MULTIPLIERS = Object.freeze({
  equipment: 5,
  skill: 5,
  relic: 5,
  pet: 10,
});

// Supplemental Base/Slope ranges from upg_res_0.4.0.csv. Google Sheet values
// remain authoritative; these ranges supplement missing upgrade requirements.
const SEGMENTS = Object.freeze([
  { category: 'equipment', season: 's1', to: 10, base: 30, slope: 5, phase: 0 },
  { category: 'equipment', season: 's1', to: 20, base: -420, slope: 50, phase: 0 },
  { category: 'equipment', season: 's1', to: 30, base: -820, slope: 70, phase: 0 },
  { category: 'equipment', season: 's1', to: 40, base: -1120, slope: 80, phase: 0 },
  { category: 'equipment', season: 's1', to: 50, base: -1920, slope: 100, phase: 0 },
  { category: 'equipment', season: 's1', to: 60, base: -2420, slope: 110, phase: 0 },
  { category: 'equipment', season: 's1', to: 80, base: -3020, slope: 120, phase: 0 },
  { category: 'equipment', season: 's1', to: 90, base: -3820, slope: 130, phase: 0 },
  { category: 'equipment', season: 's1', to: 100, base: -4720, slope: 140, phase: 0 },
  { category: 'equipment', season: 's2', to: 110, base: -14720, slope: 240, phase: 0 },
  { category: 'equipment', season: 's2', to: 120, base: -15270, slope: 245, phase: 0 },
  { category: 'equipment', season: 's2', to: 130, base: -15870, slope: 250, phase: 0 },
  { category: 'equipment', season: 's3', to: 140, base: -5000, slope: 200, phase: 0 },
  { category: 'equipment', season: 's3', to: 160, base: 2000, slope: 150, phase: 0 },
  { category: 'equipment', season: 's4', to: 190, base: -38000, slope: 500, phase: 0 },
  { category: 'equipment', season: 's5', to: 220, base: 13000, slope: 400, phase: 0 },
  { category: 'equipment', season: 's1', to: 180, base: -92.8, slope: 92.8, phase: 1 },
  { category: 'equipment', season: 's2', to: 260, base: -5155.3, slope: 166.3, phase: 1 },
  { category: 'equipment', season: 's3', to: 310, base: -15860, slope: 260, phase: 1 },
  { category: 'equipment', season: 's3', to: 420, base: 64740, slope: 0, phase: 1 },
  { category: 'equipment', season: 's4', to: 340, base: -51870, slope: 570, phase: 1 },
  { category: 'equipment', season: 's4', to: 400, base: 141930, slope: 0, phase: 1 },
  { category: 'equipment', season: 's5', to: 370, base: -122210, slope: 1010, phase: 1 },
  { category: 'equipment', season: 's5', to: 380, base: 251490, slope: 0, phase: 1 },
  { category: 'skill', season: 's1', to: 20, base: 25, slope: 5, phase: 0 },
  { category: 'skill', season: 's1', to: 30, base: -875, slope: 50, phase: 0 },
  { category: 'skill', season: 's1', to: 80, base: -1175, slope: 60, phase: 0 },
  { category: 'skill', season: 's1', to: 100, base: -5975, slope: 120, phase: 0 },
  { category: 'skill', season: 's2', to: 110, base: -11975, slope: 180, phase: 0 },
  { category: 'skill', season: 's2', to: 120, base: -14175, slope: 200, phase: 0 },
  { category: 'skill', season: 's2', to: 130, base: -16575, slope: 220, phase: 0 },
  { category: 'skill', season: 's3', to: 160, base: -19175, slope: 240, phase: 0 },
  { category: 'skill', season: 's4', to: 190, base: -83175, slope: 640, phase: 0 },
  { category: 'skill', season: 's5', to: 220, base: -132575, slope: 900, phase: 0 },
  { category: 'skill', season: 's1', to: 150, base: -60.2, slope: 60.25, phase: 1 },
  { category: 'skill', season: 's2', to: 230, base: -3727.75, slope: 120.25, phase: 1 },
  { category: 'skill', season: 's3', to: 340, base: -11727, slope: 192.25, phase: 1 },
  { category: 'skill', season: 's4', to: 340, base: -34967, slope: 384.25, phase: 1 },
  { category: 'skill', season: 's5', to: 350, base: -79164, slope: 654.25, phase: 1 },
  { category: 'relic', season: 's1', to: 4, base: 0, slope: 500, phase: 0 },
  { category: 'relic', season: 's1', to: 7, base: -5000, slope: 1750, phase: 0 },
  { category: 'relic', season: 's1', to: 10, base: -9000, slope: 2500, phase: 0 },
  { category: 'relic', season: 's2', to: 13, base: -39375, slope: 5625, phase: 0 },
  { category: 'relic', season: 's3', to: 14, base: 40000, slope: 0, phase: 0 },
  { category: 'relic', season: 's3', to: 16, base: -62500, slope: 7500, phase: 0 },
  { category: 'relic', season: 's4', to: 19, base: -27500, slope: 7500, phase: 0 },
  { category: 'relic', season: 's5', to: 22, base: -75000, slope: 12500, phase: 0 },
  { category: 'relic', season: 's1', to: 15, base: -1600, slope: 1600, phase: 1 },
  { category: 'relic', season: 's2', to: 27, base: -13500, slope: 3375, phase: 1 },
  { category: 'relic', season: 's3', to: 34, base: -40250, slope: 5750, phase: 1 },
  { category: 'relic', season: 's4', to: 37, base: -115000, slope: 11500, phase: 1 },
  { category: 'relic', season: 's5', to: 38, base: -260000, slope: 20000, phase: 1 },
  { category: 'pet', season: 's1', to: 11, base: 465, slope: 5, phase: 0 },
  { category: 'pet', season: 's1', to: 21, base: 852, slope: 9, phase: 0 },
  { category: 'pet', season: 's1', to: 31, base: 1470, slope: 20, phase: 0 },
  { category: 'pet', season: 's1', to: 41, base: 1941, slope: 29, phase: 0 },
  { category: 'pet', season: 's1', to: 51, base: 5580, slope: 95, phase: 0 },
  { category: 'pet', season: 's1', to: 61, base: 5474, slope: 115.5, phase: 0 },
  { category: 'pet', season: 's1', to: 70, base: 5371, slope: 141.5, phase: 0 },
  { category: 'pet', season: 's1', to: 71, base: 17620, slope: 0, phase: 0 },
  { category: 'pet', season: 's1', to: 81, base: 4803, slope: 172.5, phase: 0 },
  { category: 'pet', season: 's1', to: 91, base: 3478, slope: 191, phase: 0 },
  { category: 'pet', season: 's1', to: 100, base: 1840, slope: 240, phase: 0 },
  { category: 'pet', season: 's2', to: 101, base: 26080, slope: 0, phase: 0 },
  { category: 'pet', season: 's2', to: 111, base: -735, slope: 368.4, phase: 0 },
  { category: 'pet', season: 's2', to: 121, base: -5165, slope: 430.6, phase: 0 },
  { category: 'pet', season: 's2', to: 130, base: -11577, slope: 526.3, phase: 0 },
  { category: 'pet', season: 's3', to: 131, base: 57370, slope: 0, phase: 0 },
  { category: 'pet', season: 's3', to: 141, base: -39806, slope: 1244, phase: 0 },
  { category: 'pet', season: 's3', to: 151, base: -60286, slope: 1435.4, phase: 0 },
  { category: 'pet', season: 's3', to: 160, base: -84594, slope: 1626.8, phase: 0 },
  { category: 'pet', season: 's4', to: 161, base: 177320, slope: 0, phase: 0 },
  { category: 'pet', season: 's4', to: 166, base: -163162, slope: 1631.6, phase: 0 },
  { category: 'pet', season: 's4', to: 190, base: null, slope: null, phase: 0 },
  { category: 'pet', season: 's5', to: 191, base: 741630, slope: 0, phase: 0 },
  { category: 'pet', season: 's5', to: 200, base: -374482, slope: 4115, phase: 0 },
  { category: 'pet', season: 's5', to: 209, base: -454257, slope: 4497.6, phase: 0 },
  { category: 'pet', season: 's5', to: 211, base: 26040, slope: 2200, phase: 0 },
  { category: 'pet', season: 's5', to: 220, base: -541726, slope: 4880.4, phase: 0 },
  { category: 'pet', season: 's1', to: 150, base: -26602, slope: 521.6, phase: 1 },
  { category: 'pet', season: 's2', to: 230, base: -92939, slope: 1147.4, phase: 1 },
  { category: 'pet', season: 's3', to: 210, base: -393650.5, slope: 3546.4, phase: 1 },
  { category: 'pet', season: 's3', to: 300, base: -19505.2, slope: 1773.2, phase: 1 },
  { category: 'pet', season: 's4', to: 240, base: -880686, slope: 6246, phase: 1 },
  { category: 'pet', season: 's4', to: 300, base: -128040.3, slope: 3122.99, phase: 1 },
  { category: 'pet', season: 's5', to: 271, base: -1819303.2, slope: 10639.2, phase: 1 },
  { category: 'pet', season: 's5', to: 350, base: -377691.5, slope: 5319.6, phase: 1 },
]);

function normalizeCategory(category) {
  const value = String(category || '').trim().toLowerCase();
  return value === 'equip' ? 'equipment' : value;
}

function getFormulaSegment(category, season, level) {
  const matches = SEGMENTS.filter((segment) => segment.category === category && segment.season === season);
  const phaseZero = matches.filter((segment) => segment.phase === 0);
  const phaseOne = matches.filter((segment) => segment.phase === 1);
  const phaseZeroMax = Math.max(...phaseZero.map((segment) => segment.to), -Infinity);
  // Normal-level segments continue across seasons; extensions are season-specific.
  const candidates = level <= phaseZeroMax
    ? SEGMENTS.filter((segment) => segment.category === category
      && segment.phase === 0 && segment.season <= season)
    : phaseOne;
  return candidates.find((segment) => level <= segment.to) || null;
}

export function calculateUpgradeExperience(category, season, level) {
  const normalizedCategory = normalizeCategory(category);
  const multiplier = EXPERIENCE_MULTIPLIERS[normalizedCategory];
  const numericLevel = Number(level);
  if (!multiplier || !Number.isInteger(numericLevel) || numericLevel < 1) return null;

  const normalizedSeason = String(season || '').trim().toLowerCase();
  const segment = getFormulaSegment(normalizedCategory, normalizedSeason, numericLevel);
  if (normalizedCategory === 'pet' && segment?.season === 's4' && S4_PET_EXP[numericLevel]) {
    return S4_PET_EXP[numericLevel];
  }
  if (!segment || segment.base === null || segment.slope === null) return null;

  const rawValue = segment.base + segment.slope * numericLevel;
  if (!Number.isFinite(rawValue)) return null;
  const value = multiplier * Math.round(rawValue / multiplier);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// User-supplied S4 screenshot: required EXP at each destination level.
const S4_PET_EXP = Object.freeze({
  167: 276320, 168: 277510, 169: 278950, 170: 280290,
  171: 281580, 172: 283060, 173: 284210, 174: 285840,
  175: 286840, 176: 288610, 177: 291390, 178: 291870,
  179: 294160, 180: 294780, 181: 296940, 182: 297700,
  183: 299710, 184: 300620, 185: 302490, 186: 303540,
  187: 306220, 188: 306460, 189: 309280, 190: 309380,
});

const REQUIREMENT_KEYS = Object.freeze({
  equipment: 'cost_stone_ore', skill: 'cost_essence', relic: 'cost_sand', pet: 'cost_exp',
});

function positive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

export function fillMissingUpgradeExperience(rows, category, season) {
  const normalizedCategory = normalizeCategory(category);
  const requirementKey = REQUIREMENT_KEYS[normalizedCategory];
  if (!requirementKey) return rows || [];
  const normalizedSeason = String(season || rows?.[0]?.season || '').trim().toLowerCase();
  const maxLevel = Math.max(0, ...SEGMENTS.filter((segment) => segment.category === normalizedCategory
    && segment.season === normalizedSeason).map((segment) => segment.to));
  const byLevel = new Map((rows || []).filter((row) => String(row.level ?? '').trim() !== ''
    && Number.isInteger(Number(row.level)) && Number(row.level) >= 0)
    .map((row) => [Number(row.level), { ...row, level: Number(row.level) }]));

  // CSV Level is the destination (100 describes 99 -> 100).
  // App rows use the starting level, so shift exactly once here.
  for (let level = 0; level < maxLevel; level += 1) {
    if (!byLevel.has(level)) byLevel.set(level, { season: normalizedSeason, category: normalizedCategory, level });
  }
  return [...byLevel.values()].sort((a, b) => a.level - b.level).map((row) => {
    const calculated = calculateUpgradeExperience(normalizedCategory, normalizedSeason, row.level + 1);
    if (!positive(row[requirementKey]) && calculated !== null) row[requirementKey] = calculated;
    if (!positive(row.cost_exp) && positive(row[requirementKey])) row.cost_exp = Number(row[requirementKey]);
    return row;
  });
}
