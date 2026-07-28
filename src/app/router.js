export const TOOL_IDS = Object.freeze([
  'primordial',
  'equipment',
  'gift',
  'world-rally',
  'contribution',
]);

export const LEGACY_TOOL_ALIASES = Object.freeze({
  progression: 'primordial',
  fragment: 'equipment',
});

export function normalizeTool(value) {
  const tool = String(value || '').trim().toLowerCase();
  const canonical = LEGACY_TOOL_ALIASES[tool] || tool;
  return TOOL_IDS.includes(canonical) ? canonical : 'primordial';
}

export function readToolFromLocation(locationLike = window.location) {
  return normalizeTool(new URLSearchParams(locationLike.search).get('tool'));
}

export function buildToolUrl(tool, locationLike = window.location) {
  const url = new URL(locationLike.href);
  url.searchParams.set('tool', normalizeTool(tool));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function navigateToTool(tool, { replace = false } = {}) {
  const normalized = normalizeTool(tool);
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method]({ tool: normalized }, '', buildToolUrl(normalized));
  window.dispatchEvent(new CustomEvent('sxstx:tool-change', { detail: { tool: normalized } }));
  return normalized;
}
