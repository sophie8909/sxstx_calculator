const ADS_CLIENT = 'ca-pub-2263683088830621';
const ADS_SCRIPT_ID = 'sxstx-adsbygoogle-script';
const DISABLED_PLAYER_PREFIX = '6001509';
const PLAYER_CODE_INPUT_ID = 'player-code-input';
const PLAYER_CODE_PATTERN = /^\d{12}$/;
const STORAGE_KEY = 'sxstxCalculatorData';

function normalizePlayerCode(value) {
  return String(value || '').trim();
}

function isAdsDisabledPlayer(playerCode) {
  const normalized = normalizePlayerCode(playerCode);
  return PLAYER_CODE_PATTERN.test(normalized) && normalized.startsWith(DISABLED_PLAYER_PREFIX);
}

function getSavedPlayerCode() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return normalizePlayerCode(data[PLAYER_CODE_INPUT_ID]);
  } catch {
    return '';
  }
}

function getCurrentPlayerCode() {
  const input = document.getElementById(PLAYER_CODE_INPUT_ID);
  return normalizePlayerCode(input?.value || getSavedPlayerCode());
}

function removeAdsScript() {
  document.getElementById(ADS_SCRIPT_ID)?.remove();
}

function injectAdsScript() {
  if (document.getElementById(ADS_SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = ADS_SCRIPT_ID;
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}`;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}

function syncAdsScript(playerCode = getCurrentPlayerCode()) {
  if (isAdsDisabledPlayer(playerCode)) {
    removeAdsScript();
    return;
  }

  injectAdsScript();
}

function bindPlayerCodeInput() {
  const input = document.getElementById(PLAYER_CODE_INPUT_ID);
  if (!input || input.dataset.adsBound === '1') return;

  input.dataset.adsBound = '1';
  input.addEventListener('input', () => {
    syncAdsScript(input.value);
  });
}

syncAdsScript(getSavedPlayerCode());

document.addEventListener('DOMContentLoaded', () => {
  bindPlayerCodeInput();
  syncAdsScript();
});

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) syncAdsScript(getSavedPlayerCode());
});
