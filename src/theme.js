const THEME_STORAGE_KEY = 'sxstx_ui_theme';
const DARK_THEME = 'dark';
const LIGHT_THEME = 'light';
const THEME_LABELS = {
  'zh-Hant': { dark: '\u591c\u9593\u6a21\u5f0f', light: '\u65e5\u9593\u6a21\u5f0f' },
  'zh-Hans': { dark: '\u591c\u95f4\u6a21\u5f0f', light: '\u65e5\u95f4\u6a21\u5f0f' },
  en: { dark: 'Dark mode', light: 'Light mode' },
};

function getInitialTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === DARK_THEME || savedTheme === LIGHT_THEME) return savedTheme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? DARK_THEME : LIGHT_THEME;
}

function updateThemeButton(theme) {
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    const isDark = theme === DARK_THEME;
    button.setAttribute('aria-pressed', String(isDark));
    button.dataset.theme = theme;
    button.querySelector('[data-theme-icon]')?.replaceChildren(document.createTextNode(isDark ? '\u2600\ufe0f' : '\ud83c\udf19'));
    button.querySelector('[data-theme-label]')?.replaceChildren(
      document.createTextNode(THEME_LABELS[document.documentElement.lang]?.[isDark ? 'light' : 'dark'] ?? (isDark ? button.dataset.lightLabel : button.dataset.darkLabel))
    );
  });
}

export function applyTheme(theme = getInitialTheme()) {
  const normalizedTheme = theme === DARK_THEME ? DARK_THEME : LIGHT_THEME;
  document.documentElement.dataset.theme = normalizedTheme;
  document.documentElement.style.colorScheme = normalizedTheme;
  localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
  updateThemeButton(normalizedTheme);
}

export function initTheme() {
  applyTheme(getInitialTheme());
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    if (button.dataset.themeBound) return;
    button.dataset.themeBound = '1';
    button.addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === DARK_THEME ? LIGHT_THEME : DARK_THEME);
    });
  });
}

window.addEventListener('languagechange', () => updateThemeButton(document.documentElement.dataset.theme || LIGHT_THEME));

initTheme();