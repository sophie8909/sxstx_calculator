const SMALL_EXP_UNIT = 10000;
const LARGE_EXP_UNIT = 100000000;

export function parseExperienceInput(rawInput) {
  const raw = String(rawInput ?? '').trim();
  if (raw === '') return NaN;

  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, value) : NaN;
}

export function convertExperienceToAbsolute(parsedValue, useLargeUnit, unitDivisor = null) {
  if (!Number.isFinite(parsedValue)) return NaN;
  const multiplier = Number.isFinite(unitDivisor)
    ? unitDivisor
    : useLargeUnit
      ? LARGE_EXP_UNIT
      : SMALL_EXP_UNIT;
  return Math.round(Math.max(0, parsedValue) * multiplier);
}

export function calculateRemainingExperience(requiredExp, currentExp) {
  const required = Number(requiredExp);
  const current = Math.max(0, Number(currentExp) || 0);
  return Number.isFinite(required) ? Math.max(required - current, 0) : NaN;
}
