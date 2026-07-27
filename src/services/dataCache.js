const CACHE_PREFIX = 'sxstxRemoteDataCache:';
const CACHE_VERSION = 'v2';
const CACHE_FALLBACK_EVENT = 'sxstx:data-cache-fallback';
const CACHE_UPDATED_EVENT = 'sxstx:data-cache-updated';
export const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;

const pendingRequests = new Map();

export class RemoteDataError extends Error {
  constructor(message, metadata = {}, options = {}) {
    super(message, options);
    this.name = 'RemoteDataError';
    Object.assign(this, metadata);
  }
}

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
    if (!entry || !['v1', CACHE_VERSION].includes(entry.version) || typeof entry.data !== 'string') return null;
    return entry;
  } catch (error) {
    console.warn('[data cache] failed to read cache', cacheKey, error);
    return null;
  }
}

function removeCache(cacheKey) {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(getStorageKey(cacheKey));
  } catch (error) {
    console.warn('[data cache] failed to remove invalid cache', cacheKey, error);
  }
}

function writeCache(cacheKey, data, signature) {
  if (!canUseStorage()) return null;
  const entry = {
    version: CACHE_VERSION,
    updatedAt: new Date().toISOString(),
    signature: signature || data,
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

function createError(code, message, metadata, cause) {
  return new RemoteDataError(message, { code, ...metadata }, cause ? { cause } : undefined);
}

function inferGid(url) {
  try {
    return new URL(url).searchParams.get('gid') || undefined;
  } catch {
    return undefined;
  }
}

function validateGenericResponse(text, contentType, metadata) {
  const trimmed = String(text || '').trim();
  const lowerContentType = String(contentType || '').toLowerCase();
  if (!trimmed) {
    throw createError('sheet_empty', `${metadata.sheet || 'Google Sheet'} returned an empty response`, metadata);
  }
  if (
    lowerContentType.includes('text/html')
    || /^\s*<!doctype html/i.test(trimmed)
    || /^\s*<html[\s>]/i.test(trimmed)
    || /accounts\.google\.com\/servicelogin/i.test(trimmed)
  ) {
    throw createError('sheet_invalid_content_type', `${metadata.sheet || 'Google Sheet'} returned HTML instead of CSV`, {
      ...metadata,
      contentType,
    });
  }
}

async function fetchRemoteText(cacheKey, url, options) {
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);

  const {
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    validate,
    metadata: suppliedMetadata = {},
  } = options;
  const metadata = { gid: inferGid(url), ...suppliedMetadata, url };
  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response;
      try {
        response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) {
          throw createError('sheet_timeout', `${metadata.sheet || 'Google Sheet'} timed out after ${timeoutMs}ms`, {
            ...metadata,
            timeoutMs,
          }, error);
        }
        throw createError('sheet_network_failure', `${metadata.sheet || 'Google Sheet'} could not be reached`, metadata, error);
      }

      if (!response.ok) {
        throw createError('sheet_http_failure', `${metadata.sheet || 'Google Sheet'} returned HTTP ${response.status}`, {
          ...metadata,
          status: response.status,
        });
      }

      const contentType = response.headers?.get?.('content-type') || '';
      let text;
      try {
        text = await response.text();
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) {
          throw createError('sheet_timeout', `${metadata.sheet || 'Google Sheet'} timed out after ${timeoutMs}ms`, {
            ...metadata,
            timeoutMs,
          }, error);
        }
        throw createError('sheet_network_failure', `${metadata.sheet || 'Google Sheet'} response was interrupted`, metadata, error);
      }
      validateGenericResponse(text, contentType, metadata);

      let validation = null;
      if (validate) {
        try {
          validation = await validate(text, { contentType, response, metadata });
        } catch (error) {
          if (error?.code) throw error;
          throw createError('sheet_invalid_csv', `${metadata.sheet || 'Google Sheet'} returned invalid CSV`, metadata, error);
        }
      }

      const previous = readCache(cacheKey);
      const signature = validation?.signature || text;
      const previousSignature = previous?.signature || previous?.data;
      writeCache(cacheKey, text, signature);
      return {
        text,
        changed: Boolean(previous && previousSignature !== signature),
      };
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => pendingRequests.delete(cacheKey));

  pendingRequests.set(cacheKey, request);
  return request;
}

function refreshInBackground(cacheKey, url, options) {
  return fetchRemoteText(cacheKey, url, options)
    .then((result) => {
      if (result.changed) {
        emitCacheEvent(CACHE_UPDATED_EVENT, { cacheKey, url, ...options.metadata });
      }
      return result.text;
    })
    .catch((error) => {
      emitCacheEvent(CACHE_FALLBACK_EVENT, {
        cacheKey,
        url,
        ...options.metadata,
        code: error.code,
        error: error.message,
      });
      throw error;
    });
}

export async function fetchTextWithCache(cacheKey, url, options = {}) {
  const { refresh = false, validate, ...requestOptions } = options;
  const cached = readCache(cacheKey);

  if (cached && !refresh) {
    try {
      if (validate) await validate(cached.data, { cached: true, metadata: requestOptions.metadata || {} });
      else validateGenericResponse(cached.data, '', requestOptions.metadata || {});
      refreshInBackground(cacheKey, url, { ...requestOptions, validate }).catch(() => {});
      return cached.data;
    } catch {
      removeCache(cacheKey);
    }
  }

  const result = await fetchRemoteText(cacheKey, url, { ...requestOptions, validate });
  return result.text;
}

export async function fetchJsonWithCache(cacheKey, url, options) {
  const text = await fetchTextWithCache(cacheKey, url, options);
  return JSON.parse(text);
}

export function getCachedDataState(cacheKey) {
  const entry = readCache(cacheKey);
  return entry
    ? { available: true, updatedAt: entry.updatedAt }
    : { available: false, updatedAt: null };
}

export function clearPendingDataCacheRefreshes() {
  pendingRequests.clear();
}

export function getPendingDataRequestCount() {
  return pendingRequests.size;
}

export {
  CACHE_FALLBACK_EVENT,
  CACHE_UPDATED_EVENT,
  CACHE_VERSION,
};
