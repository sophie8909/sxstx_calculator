export const BOOTSTRAP_TIMEOUT_MS = 20_000;
const LOADING_DISABLED_ATTR = 'data-loading-disabled';

export function setDocumentLoading(documentLike, loading, message = '') {
  const body = documentLike?.body;
  if (!body) return;

  body.classList.toggle('app-loading', Boolean(loading));
  body.setAttribute('aria-busy', loading ? 'true' : 'false');

  const loadingMessage = documentLike.getElementById('app-loading-message');
  if (loadingMessage && message) loadingMessage.textContent = message;

  const appShell = documentLike.querySelector('.app-shell');
  if (appShell) {
    appShell.inert = Boolean(loading);
    appShell.setAttribute('aria-hidden', loading ? 'true' : 'false');
  }

  documentLike.querySelectorAll('button, input, select, textarea').forEach((control) => {
    if (loading) {
      if (!control.disabled) {
        control.disabled = true;
        control.setAttribute(LOADING_DISABLED_ATTR, '1');
      }
      return;
    }
    if (control.getAttribute(LOADING_DISABLED_ATTR) === '1') {
      control.disabled = false;
      control.removeAttribute(LOADING_DISABLED_ATTR);
    }
  });
}

export function renderBootstrapError(documentLike, error, retry) {
  const status = documentLike?.getElementById('global-data-status');
  if (!status) return;
  status.dataset.status = 'unavailable';
  status.replaceChildren();

  const message = documentLike.createElement('span');
  message.textContent = error?.message || 'Google data is unavailable.';
  status.appendChild(message);

  if (typeof retry === 'function') {
    const button = documentLike.createElement('button');
    button.type = 'button';
    button.className = 'data-retry-button';
    button.textContent = 'Retry';
    button.addEventListener('click', retry, { once: true });
    status.appendChild(button);
  }
}

export async function runShellBootstrap({
  documentLike = document,
  mountShell,
  restorePreferences,
  initializeGlobalContext,
  onError,
  onTimeout,
  loadingMessage = 'Loading Google data...',
  timeoutMs = BOOTSTRAP_TIMEOUT_MS,
  timers = {
    setTimeout: (...args) => globalThis.setTimeout(...args),
    clearTimeout: (...args) => globalThis.clearTimeout(...args),
  },
  onLoadingChange,
}) {
  let stage = 'mount-shell';
  let settled = false;
  const updateLoading = (loading) => {
    setDocumentLoading(documentLike, loading, loadingMessage);
    onLoadingChange?.(loading);
  };
  updateLoading(true);

  const watchdog = timers.setTimeout(() => {
    if (settled) return;
    const error = Object.assign(
      new Error(`Application initialization timed out during ${stage}`),
      { code: 'bootstrap_timeout', stage }
    );
    updateLoading(false);
    onTimeout?.(error);
  }, timeoutMs);

  try {
    await mountShell?.();
    stage = 'restore-preferences';
    await restorePreferences?.();
    stage = 'initialize-global-context';
    await initializeGlobalContext?.();
    return { ok: true, stage: 'complete' };
  } catch (error) {
    onError?.(error, stage);
    return { ok: false, error, stage };
  } finally {
    settled = true;
    timers.clearTimeout(watchdog);
    updateLoading(false);
  }
}
