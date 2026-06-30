const CACHE_PREFIX = 'sxstxRemoteDataCache:';
const CACHE_VERSION = 'v1';
const CACHE_FALLBACK_EVENT = 'sxstx:data-cache-fallback';
const CACHE_UPDATED_EVENT = 'sxstx:data-cache-updated';

const pendingRefreshes = new Map();

function getStorageKey(cacheKey) {
  return `${CACHE_PREFIX}${cacheKey}`;
}

function canUseStorage() {
  return typeof localStorage !== 'undefined';
}

function emitCacheEvent(name, detail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function readCache(cacheKey) {
  if (!canUseStorage()) return null;

  try {
    const raw = localStorage.getItem(getStorageKey(cacheKey));
    if (!raw) return null;

    const entry = JSON.parse(raw);
    if (!entry || entry.version !== CACHE_VERSION || typeof entry.data !== 'string') return null;
    return entry;
  } catch (error) {
    console.warn('[data cache] failed to read cache', cacheKey, error);
    return null;
  }
}

function writeCache(cacheKey, data) {
  if (!canUseStorage()) return null;

  const entry = {
    version: CACHE_VERSION,
    updatedAt: new Date().toISOString(),
    data,
  };

  try {
    localStorage.setItem(getStorageKey(cacheKey), JSON.stringify(entry));
    return entry;
  } catch (error) {
    console.warn('[data cache] failed to write cache', cacheKey, error);
    return null;
  }
}

async function fetchRemoteText(cacheKey, url) {
  const previous = readCache(cacheKey);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`fetch failed: ${response.status}`);

  const text = await response.text();
  writeCache(cacheKey, text);
  return {
    text,
    changed: previous ? previous.data !== text : false,
  };
}

function refreshInBackground(cacheKey, url) {
  if (pendingRefreshes.has(cacheKey)) return pendingRefreshes.get(cacheKey);

  const refresh = fetchRemoteText(cacheKey, url)
    .then((result) => {
      if (result.changed) emitCacheEvent(CACHE_UPDATED_EVENT, { cacheKey, url });
      return result.text;
    })
    .catch((error) => {
      emitCacheEvent(CACHE_FALLBACK_EVENT, { cacheKey, url, error: error.message });
      throw error;
    })
    .finally(() => {
      pendingRefreshes.delete(cacheKey);
    });

  pendingRefreshes.set(cacheKey, refresh);
  return refresh;
}

export async function fetchTextWithCache(cacheKey, url) {
  const cached = readCache(cacheKey);

  if (cached) {
    refreshInBackground(cacheKey, url).catch(() => {});
    return cached.data;
  }

  const result = await fetchRemoteText(cacheKey, url);
  return result.text;
}

export async function fetchJsonWithCache(cacheKey, url) {
  const text = await fetchTextWithCache(cacheKey, url);
  return JSON.parse(text);
}

export function clearPendingDataCacheRefreshes() {
  pendingRefreshes.clear();
}

export {
  CACHE_FALLBACK_EVENT,
  CACHE_UPDATED_EVENT,
  CACHE_VERSION,
};
