export function calculateGiftCount(targetValue, giftValue) {
  const target = Number(targetValue);
  const gift = Number(giftValue);
  return Number.isFinite(target) && Number.isFinite(gift) && gift > 0
    ? Math.ceil(target / gift)
    : null;
}
