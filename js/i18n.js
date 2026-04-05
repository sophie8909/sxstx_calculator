export const LANGUAGE_STORAGE_KEY = 'sxstx_ui_language';

let dictionaries = {};
let currentLanguage = 'zh-Hant';
const FALLBACK_LANGUAGE = 'zh-Hant';

function detectDefaultLanguage() {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved) return saved;

  const locale = (navigator.language || '').toLowerCase();
  if (locale.startsWith('zh-cn') || locale.startsWith('zh-sg')) return 'zh-Hans';
  return 'zh-Hant';
}

async function loadDictionaries() {
  if (Object.keys(dictionaries).length > 0) return dictionaries;

  const dictionaryUrl = new URL('../data/i18n.json', import.meta.url);
  const response = await fetch(dictionaryUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load i18n.json: ${response.status}`);
  dictionaries = await response.json();
  return dictionaries;
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function t(key, vars = {}) {
  const entry = dictionaries[key] || {};
  const template = entry[currentLanguage] ?? entry[FALLBACK_LANGUAGE] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));
}

export function setLanguage(language) {
  const hasLanguage = Object.values(dictionaries).some(
    (entry) => entry && Object.prototype.hasOwnProperty.call(entry, language)
  );
  if (!hasLanguage) return;
  currentLanguage = language;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  document.documentElement.lang = language;
  applyStaticTranslations();
  window.dispatchEvent(new CustomEvent('languagechange', { detail: { language } }));
}

export function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.dataset.i18n;
    if (key) node.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    const key = node.dataset.i18nPlaceholder;
    if (key) node.placeholder = t(key);
  });

  const clearButton = document.getElementById('clear-local-data-btn');
  if (clearButton) clearButton.textContent = t('clear_local_data');

  const languageSelect = document.getElementById('language-select');
  if (languageSelect) languageSelect.value = currentLanguage;
}

export async function initLanguage() {
  await loadDictionaries();
  currentLanguage = detectDefaultLanguage();
  const hasLanguage = Object.values(dictionaries).some(
    (entry) => entry && Object.prototype.hasOwnProperty.call(entry, currentLanguage)
  );
  if (!hasLanguage) currentLanguage = FALLBACK_LANGUAGE;
  document.documentElement.lang = currentLanguage;
  applyStaticTranslations();

  const languageSelect = document.getElementById('language-select');
  if (languageSelect && !languageSelect.dataset.bound) {
    languageSelect.dataset.bound = '1';
    languageSelect.value = currentLanguage;
    languageSelect.addEventListener('change', () => setLanguage(languageSelect.value));
  }
}
