const THEME_STORAGE_KEY = 'sxstx_ui_theme';
const DARK_THEME = 'dark';
const LIGHT_THEME = 'light';
const SYSTEM_THEME = 'system';

const THEME_LABELS = {
  'zh-Hant': {
    dark: '\u591c\u9593\u6a21\u5f0f',
    light: '\u65e5\u9593\u6a21\u5f0f',
    system: '\u7cfb\u7d71\u8a2d\u5b9a',
  },
  'zh-Hans': {
    dark: '\u591c\u95f4\u6a21\u5f0f',
    light: '\u65e5\u95f4\u6a21\u5f0f',
    system: '\u7cfb\u7edf\u8bbe\u5b9a',
  },
  en: { dark: 'Dark mode', light: 'Light mode', system: 'System settings' },
};

const THEME_EMOJIS = {
  dark: '\ud83c\udf19',
  light: '\u2600\ufe0f',
  system: '\u2699\ufe0f',
};

function getStoredPreference() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  return [DARK_THEME, LIGHT_THEME, SYSTEM_THEME].includes(saved) ? saved : SYSTEM_THEME;
}

function getSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? DARK_THEME : LIGHT_THEME;
}

function getEffectiveTheme(preference) {
  return preference === SYSTEM_THEME ? getSystemTheme() : preference;
}

function updateThemeControl(preference) {
  const language = document.documentElement.lang || 'zh-Hant';
  const labels = THEME_LABELS[language] ?? THEME_LABELS['zh-Hant'];
  document.querySelectorAll('[data-theme-select]').forEach((select) => {
    select.value = preference;
    select.setAttribute('aria-label', labels[preference]);
    Array.from(select.options).forEach((option) => {
      option.textContent = THEME_EMOJIS[option.value] + ' ' + labels[option.value];
    });
  });
}

function applyEffectiveTheme(preference) {
  const theme = getEffectiveTheme(preference);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  updateThemeControl(preference);
}

export function applyThemePreference(preference) {
  const normalized = [DARK_THEME, LIGHT_THEME, SYSTEM_THEME].includes(preference)
    ? preference
    : SYSTEM_THEME;
  localStorage.setItem(THEME_STORAGE_KEY, normalized);
  applyEffectiveTheme(normalized);
}

function initTheme() {
  const preference = getStoredPreference();
  applyEffectiveTheme(preference);

  document.querySelectorAll('[data-theme-select]').forEach((select) => {
    if (select.dataset.themeBound) return;
    select.dataset.themeBound = '1';
    select.addEventListener('change', () => applyThemePreference(select.value));
  });

  const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
  mediaQuery?.addEventListener?.('change', () => {
    if (getStoredPreference() === SYSTEM_THEME) applyEffectiveTheme(SYSTEM_THEME);
  });
}

window.addEventListener('languagechange', () => updateThemeControl(getStoredPreference()));

initTheme();