import { normalizeTool } from './router.js';
import { confirmationNotice, element, emptyState, featureTabs, navButton } from '../shared/components.js';

const COPY = {
  'zh-Hant': {
    product: '杖劍傳說計算機', menu: '功能選單', context: '玩家環境', contextHint: '賽季與玩家編號會套用到相關功能',
    season: '賽季', player: '玩家編號', server: '伺服器', realm: '界域', world: '世界', unknown: '尚未識別', expand: '編輯玩家環境',
    features: {
      primordial: ['原初養成', '設定目標並計算角色與素材需求'], equipment: ['裝備與碎片', '評分、交易與副本掉落資料'],
      gift: ['禮物與好感', '規劃好感需求與禮物購買'], 'world-rally': ['世界集結', '依界域查看伺服器與集結名單'],
      contribution: ['資料貢獻', '補充伺服器、目標時間與缺少資料'],
    },
    short: ['原初', '裝備', '禮物', '集結', '貢獻'],
    primordialTabs: ['原初目標推薦', '角色經驗計算', '完整素材計算'], characterTarget: '目標角色等級',
    equipmentTabs: ['裝備評分', '市場收益', '副本與資料'], giftTabs: ['好感計算', '禮物方案', '資料比較'],
    contributionTabs: ['伺服器與時間', '升級經驗', '其他資料'],
    applyCharacter: '套用角色目標', applyAll: '套用全部目標', characterApplied: '角色目標已帶入經驗計算。', allApplied: '全部目標已帶入素材計算。',
    unavailableTitle: '目前沒有可提交的表單', unavailableBody: '這個區段會在有已驗證的 Google 表單欄位後開放，不會建立假的提交資料。',
  },
  'zh-Hans': {
    product: '杖剑传说计算机', menu: '功能选单', context: '玩家环境', contextHint: '赛季与玩家编号会套用到相关功能',
    season: '赛季', player: '玩家编号', server: '服务器', realm: '界域', world: '世界', unknown: '尚未识别', expand: '编辑玩家环境',
    features: {
      primordial: ['原初养成', '设定目标并计算角色与素材需求'], equipment: ['装备与碎片', '评分、交易与副本掉落资料'],
      gift: ['礼物与好感', '规划好感需求与礼物购买'], 'world-rally': ['世界集结', '依界域查看服务器与集结名单'],
      contribution: ['资料贡献', '补充服务器、目标时间与缺少资料'],
    },
    short: ['原初', '装备', '礼物', '集结', '贡献'],
    primordialTabs: ['原初目标推荐', '角色经验计算', '完整素材计算'], characterTarget: '目标角色等级',
    equipmentTabs: ['装备评分', '市场收益', '副本与资料'], giftTabs: ['好感计算', '礼物方案', '资料比较'],
    contributionTabs: ['服务器与时间', '升级经验', '其他资料'],
    applyCharacter: '套用角色目标', applyAll: '套用全部目标', characterApplied: '角色目标已带入经验计算。', allApplied: '全部目标已带入素材計算。',
    unavailableTitle: '目前没有可提交的表单', unavailableBody: '这个区段会在有已验证的 Google 表单字段后开放，不会建立假的提交资料。',
  },
  en: {
    product: 'SxS Calculator', menu: 'Features', context: 'Player context', contextHint: 'Season and player number apply across relevant features',
    season: 'Season', player: 'Player number', server: 'Server', realm: 'Realm', world: 'World', unknown: 'Not identified', expand: 'Edit player context',
    features: {
      primordial: ['Primordial planning', 'Set targets and calculate experience and materials'], equipment: ['Equipment & fragments', 'Scores, market returns, and dungeon data'],
      gift: ['Gifts & bond', 'Plan affection requirements and gift purchases'], 'world-rally': ['World Rally', 'View realm servers and rally groups'],
      contribution: ['Contribute data', 'Submit server, target-time, and missing data'],
    },
    short: ['Plan', 'Gear', 'Gifts', 'Rally', 'Submit'],
    primordialTabs: ['Primordial target', 'Character experience', 'All resources'], characterTarget: 'Target character level', equipmentTabs: ['Equipment score', 'Market return', 'Dungeon data'],
    giftTabs: ['Bond calculator', 'Gift plan', 'Reference data'], contributionTabs: ['Server & time', 'Upgrade EXP', 'Other data'],
    applyCharacter: 'Apply character target', applyAll: 'Apply all targets', characterApplied: 'Character target applied to the experience calculator.', allApplied: 'All targets applied to the resource calculator.',
    unavailableTitle: 'No verified form is available', unavailableBody: 'This area will open when verified Google Form fields exist. No placeholder submission data is created.',
  },
};

Object.assign(COPY['zh-Hant'], {
  product: '杖劍傳說養成計算器', menu: '主要功能', context: '冒險者資訊', contextHint: '賽季與玩家編號會套用至相關功能',
  season: '賽季', player: '玩家編號', server: '伺服器', realm: '領域', world: '世界', unknown: '尚未辨識', expand: '編輯冒險者資訊',
  features: {
    primordial: ['原初計算機', '規劃養成目標、角色經驗與完整素材'], equipment: ['裝備與碎片', '查詢裝備評分、兌換與副本資料'],
    gift: ['禮物與羈絆', '規劃好感度需求與禮物採購'], 'world-rally': ['世界集結', '查看領域伺服器與集結分組'], contribution: ['資料貢獻', '提交伺服器、目標時間與缺漏資料'],
  },
  short: ['原初', '裝備', '禮物', '集結', '貢獻'],
  primordialTabs: ['原初目標', '角色經驗', '完整資源'], characterTarget: '目標角色等級',
  equipmentTabs: ['裝備評分', '市場兌換', '副本資料'], giftTabs: ['羈絆計算', '禮物規劃', '參考資料'], contributionTabs: ['伺服器與時間', '升級經驗', '其他資料'],
  applyCharacter: '套用角色目標', applyAll: '套用所有目標', characterApplied: '角色目標已套用至經驗計算機。', allApplied: '所有目標已套用至資源計算機。',
  unavailableTitle: '目前沒有可用的已驗證表單', unavailableBody: '取得已驗證的 Google 表單欄位後才會開放此區；系統不會建立虛構的提交資料。',
});
Object.assign(COPY['zh-Hans'], {
  product: '杖剑传说养成计算器', menu: '主要功能', context: '冒险者资讯', contextHint: '赛季与玩家编号会套用至相关功能',
  season: '赛季', player: '玩家编号', server: '服务器', realm: '领域', world: '世界', unknown: '尚未识别', expand: '编辑冒险者资讯',
  features: {
    primordial: ['原初计算机', '规划养成目标、角色经验与完整素材'], equipment: ['装备与碎片', '查询装备评分、兑换与副本资料'],
    gift: ['礼物与羁绊', '规划好感度需求与礼物采购'], 'world-rally': ['世界集结', '查看领域服务器与集结分组'], contribution: ['资料贡献', '提交服务器、目标时间与缺漏资料'],
  },
  short: ['原初', '装备', '礼物', '集结', '贡献'],
  primordialTabs: ['原初目标', '角色经验', '完整资源'], characterTarget: '目标角色等级', equipmentTabs: ['装备评分', '市场兑换', '副本资料'],
  giftTabs: ['羁绊计算', '礼物规划', '参考资料'], contributionTabs: ['服务器与时间', '升级经验', '其他资料'],
  applyCharacter: '套用角色目标', applyAll: '套用所有目标', characterApplied: '角色目标已套用至经验计算机。', allApplied: '所有目标已套用至资源计算机。',
  unavailableTitle: '目前没有可用的已验证表单', unavailableBody: '取得已验证的 Google 表单字段后才会开放此区；系统不会建立虚构的提交资料。',
});
const FEATURE_META = [
  ['primordial', 'primordial', 'primordial'], ['equipment', 'fragment', 'equipment'], ['gift', 'gift', 'gift'],
  ['world-rally', 'world-rally', 'rally'], ['contribution', 'target-time-form', 'contribution'],
];

function locale() {
  return COPY[document.documentElement.lang] ? document.documentElement.lang : 'zh-Hant';
}

function moveSelectorControl(id, destination) {
  const control = document.getElementById(id);
  const sourceBar = document.querySelector('.selector-bar');
  if (!control || !sourceBar || !destination) return null;
  let wrapper = control.parentElement;
  while (wrapper?.parentElement && wrapper.parentElement !== sourceBar) wrapper = wrapper.parentElement;
  if (wrapper) destination.appendChild(wrapper);
  return wrapper;
}

function preparePrimordialTabs(panel, copy) {
  const tabs = featureTabs({
    id: 'primordial-workspace',
    labels: [
      { id: 'target', label: copy.primordialTabs[0] }, { id: 'experience', label: copy.primordialTabs[1] }, { id: 'resources', label: copy.primordialTabs[2] },
    ],
    onChange: (tab) => localStorage.setItem('sxstx:primordial-tab', tab),
  });
  panel.prepend(tabs.tabList, ...tabs.panels);
  const byId = (id) => document.getElementById(id);
  ['primordial-star-card', 'target-levels-card'].forEach((id) => tabs.panels[0].append(byId(id)));
  const experienceTarget = element('label', { className: 'section-card independent-character-target' }, [
    element('span', { text: copy.characterTarget }),
    element('input', { id: 'character-exp-target', type: 'number', min: '0', step: '1', inputMode: 'numeric' }),
  ]);
  tabs.panels[1].append(experienceTarget, byId('character-exp-card'), byId('exp-required-inline-card'));
  const resourcePanel = tabs.panels[2];
  const resourceRow = (className, ids) => {
    const row = element('div', { className }, ids.map(byId).filter(Boolean));
    row.querySelectorAll(':scope > .card').forEach((card) => card.classList.add('resource-calculator-card'));
    return row;
  };
  resourcePanel.append(
    byId('target-time-card'),
    byId('relic-card'),
    resourceRow('resource-row-top', ['equipment-card', 'skill-card']),
    resourceRow('resource-row-pets', ['pet-card']),
    resourceRow('resource-row-summary', ['owned-materials-card', 'production-card', 'results-card']),
    byId('material-source-card'),
  );

  const actions = element('div', { className: 'transfer-actions' });
  const characterButton = element('button', { type: 'button', className: 'btn-secondary', text: copy.applyCharacter });
  const allButton = element('button', { type: 'button', className: 'btn-primary', text: copy.applyAll });
  actions.append(characterButton, allButton);
  tabs.panels[0].append(actions);
  const applyRecommendation = () => document.getElementById('target-recommendation-type')?.dispatchEvent(new Event('change', { bubbles: true }));
  characterButton.addEventListener('click', () => {
    applyRecommendation();
    const source = document.getElementById('target-character');
    const destination = document.getElementById('character-exp-target');
    if (source?.value && destination) destination.value = source.value;
    tabs.activate('experience');
    panel.prepend(confirmationNotice(copy.characterApplied));
  });
  allButton.addEventListener('click', () => {
    applyRecommendation();
    tabs.activate('resources');
    panel.prepend(confirmationNotice(copy.allApplied));
  });
  const saved = localStorage.getItem('sxstx:primordial-tab');
  if (['target', 'experience', 'resources'].includes(saved)) tabs.activate(saved);
  window.addEventListener('sxstx:open-primordial-tab', (event) => tabs.activate(event.detail?.tab || 'target'));
}

function prepareEquipmentTabs(panel, copy) {
  const body = panel.querySelector('.p-4.space-y-4');
  if (!body) return;
  const tabs = featureTabs({ id: 'equipment-workspace', labels: [
    { id: 'score', label: copy.equipmentTabs[0] }, { id: 'market', label: copy.equipmentTabs[1] }, { id: 'data', label: copy.equipmentTabs[2] },
  ]});
  body.prepend(tabs.tabList, ...tabs.panels);
  const original = Array.from(body.children).filter((node) => node !== tabs.tabList && !tabs.panels.includes(node));
  const score = original.find((node) => node.querySelector?.('#equipment-season-score-fields'));
  const market = original.find((node) => node.querySelector?.('#fragment-kind'));
  const dungeon = original.find((node) => node.querySelector?.('#fragment-dungeon-select'));
  const status = document.getElementById('fragment-calculator-status');
  if (score) tabs.panels[0].append(score);
  if (status) tabs.panels[1].append(status);
  if (market) tabs.panels[1].append(market);
  original.filter((node) => node !== score && node !== market && node !== dungeon && node !== status).forEach((node) => tabs.panels[1].append(node));
  if (dungeon) tabs.panels[2].append(dungeon);
}

function prepareGiftTabs(panel, copy) {
  const body = panel.querySelector('.p-4.space-y-4');
  if (!body) return;
  const tabs = featureTabs({ id: 'gift-workspace', labels: [
    { id: 'calculator', label: copy.giftTabs[0] }, { id: 'plan', label: copy.giftTabs[1] }, { id: 'reference', label: copy.giftTabs[2] },
  ]});
  body.prepend(tabs.tabList, ...tabs.panels);
  const nodes = Array.from(body.children).filter((node) => node !== tabs.tabList && !tabs.panels.includes(node));
  nodes.forEach((node) => {
    if (node.querySelector?.('#gift-comparison-table') || node.id === 'gift-comparison-table') tabs.panels[2].append(node);
    else if (node.querySelector?.('#gift-kingdom-coins, #gift-owned-gifts, #gift-purchase-table') || ['gift-kingdom-coins', 'gift-owned-gifts', 'gift-purchase-table'].includes(node.id)) tabs.panels[1].append(node);
    else tabs.panels[0].append(node);
  });
}

function prepareContributionTabs(panel, copy) {
  const cardBody = panel.querySelector('.p-4.space-y-4');
  if (!cardBody) return;
  const tabs = featureTabs({ id: 'contribution-workspace', labels: [
    { id: 'target-time', label: copy.contributionTabs[0] }, { id: 'experience', label: copy.contributionTabs[1] }, { id: 'other', label: copy.contributionTabs[2] },
  ]});
  const nodes = Array.from(cardBody.children);
  cardBody.replaceChildren(tabs.tabList, ...tabs.panels);
  tabs.panels[0].append(...nodes);
  tabs.panels[1].append(emptyState(copy.unavailableTitle, copy.unavailableBody));
  tabs.panels[2].append(emptyState(copy.unavailableTitle, copy.unavailableBody));
}

function updateLabels(root, tool) {
  const copy = COPY[locale()];
  const [title, description] = copy.features[tool] || copy.features.primordial;
  root.querySelector('#current-feature-title').textContent = title;
  root.querySelector('#current-feature-description').textContent = description;
  root.querySelectorAll('.sidebar-brand strong, .mobile-header strong').forEach((node) => { node.textContent = copy.product; });
  root.querySelectorAll('.desktop-feature-nav, .mobile-navigation').forEach((node) => node.setAttribute('aria-label', copy.menu));
  FEATURE_META.forEach(([feature, page], index) => {
    root.querySelectorAll(`.app-nav-item[data-page="${page}"]`).forEach((button) => {
      button.setAttribute('aria-label', copy.features[feature][0]);
      button.querySelector('.app-nav-label').textContent = copy.features[feature][0];
      button.querySelector('.app-nav-short-label').textContent = copy.short[index];
    });
  });
  const tabGroups = [
    ['primordial-workspace', copy.primordialTabs], ['equipment-workspace', copy.equipmentTabs],
    ['gift-workspace', copy.giftTabs], ['contribution-workspace', copy.contributionTabs],
  ];
  tabGroups.forEach(([prefix, labels]) => {
    root.querySelectorAll(`[id^="${prefix}-tab-"]`).forEach((tab, index) => { tab.textContent = labels[index]; });
  });
  const targetLabel = root.querySelector('.independent-character-target > span');
  if (targetLabel) targetLabel.textContent = copy.characterTarget;
  root.querySelector('.context-toggle strong').textContent = copy.context;
  root.querySelector('.context-toggle small').textContent = copy.contextHint;
  const summary = root.querySelector('.context-summary');
  summary.querySelector(':scope > span').textContent = copy.realm;
  const summaryLabels = summary.querySelectorAll('small span');
  if (summaryLabels[0]) summaryLabels[0].textContent = copy.world;
  root.querySelectorAll('.empty-state').forEach((state) => {
    state.querySelector('h3').textContent = copy.unavailableTitle;
    state.querySelector('p').textContent = copy.unavailableBody;
  });
  root.querySelectorAll('[data-feature-settings]').forEach((node) => {
    node.hidden = !['primordial', 'equipment'].includes(tool);
  });
}

function mountAppShell() {
  const legacyLayout = document.querySelector('.app-layout');
  const legacyShell = legacyLayout?.querySelector('.app-shell');
  if (!legacyLayout || !legacyShell || document.getElementById('calculator-app')) return;
  const copy = COPY[locale()];
  const root = element('div', { id: 'calculator-app', className: 'calculator-app' });
  const sidebar = element('aside', { className: 'desktop-sidebar' });
  const sidebarBrand = element('div', { className: 'sidebar-brand' }, [
    element('span', { className: 'brand-mark', text: '\u2726', ariaHidden: 'true' }),
    element('div', {}, [element('strong', { text: copy.product }), element('span', { text: 'Feiya Studio' })]),
  ]);
  const desktopNav = element('nav', { className: 'desktop-feature-nav', ariaLabel: copy.menu });
  const mobileNav = element('nav', { className: 'mobile-navigation', ariaLabel: copy.menu });
  FEATURE_META.forEach(([tool, page, iconName], index) => {
    const label = copy.features[tool][0];
    desktopNav.append(navButton({ label, shortLabel: copy.short[index], iconName, page }));
    mobileNav.append(navButton({ label, shortLabel: copy.short[index], iconName, page }));
  });
  sidebar.append(sidebarBrand, desktopNav, element('div', { className: 'sidebar-links', html: '<a href="https://feiyastudio.com/sxstx-calculator">Feiya Studio</a><a href="https://github.com/sophie8909/sxstx_calculator">GitHub</a>' }));

  const main = element('main', { className: 'application-main' });
  const mobileHeader = element('header', { className: 'mobile-header' }, [
    element('span', { className: 'brand-mark', text: '\u2726', ariaHidden: 'true' }), element('strong', { text: copy.product }),
  ]);
  const topbar = element('header', { className: 'top-bar' }, [
    element('div', { className: 'feature-heading' }, [
      element('h1', { id: 'current-feature-title', text: copy.features.primordial[0] }),
      element('p', { id: 'current-feature-description', text: copy.features.primordial[1] }),
    ]),
    element('div', { id: 'topbar-controls', className: 'topbar-controls' }),
  ]);
  const context = element('section', { className: 'global-context-panel', ariaLabel: copy.context });
  context.innerHTML = `
    <button type="button" class="context-toggle" aria-expanded="false"><span><strong>${copy.context}</strong><small>${copy.contextHint}</small></span><span aria-hidden="true">v</span></button>
    <div class="context-grid">
      <div id="context-season" class="context-field"></div><div id="context-player" class="context-field"></div>
      <div id="context-server" class="context-field"></div>
      <div class="context-summary readonly-field" role="status" aria-live="polite" aria-atomic="true"><span>${copy.realm}</span><strong id="context-realm-value">--</strong><small><span>${copy.world}</span> <b id="context-world-value">--</b></small></div>
      <div id="context-status" class="context-status"></div>
    </div>`;
  const featureHeader = element('div', { className: 'feature-toolbar' }, [element('div', { id: 'feature-settings', 'data-feature-settings': '' })]);
  const workspace = element('div', { id: 'feature-workspace', className: 'feature-workspace' });
  main.append(mobileHeader, topbar, context, featureHeader, workspace);
  root.append(sidebar, main, mobileNav);
  document.body.insertBefore(root, legacyLayout);

  const toolbar = legacyShell.querySelector('.app-toolbar');
  const language = document.getElementById('language-select');
  const theme = document.querySelector('[data-theme-select-wrap]');
  if (language) {
    const wrap = element('label', { className: 'topbar-control' }, [element('span', { text: 'A' }), language]);
    root.querySelector('#topbar-controls').append(wrap);
  }
  if (theme) root.querySelector('#topbar-controls').append(theme);
  toolbar?.querySelectorAll('.calculator-nav-btn').forEach((node) => node.remove());

  moveSelectorControl('season-select', root.querySelector('#context-season'));
  moveSelectorControl('player-code-input', root.querySelector('#context-player'));
  moveSelectorControl('job-select', root.querySelector('#feature-settings'));
  const serverSource = moveSelectorControl('server-select', root.querySelector('#context-server'));
  serverSource?.classList.add('context-server-source');
  const status = document.getElementById('global-data-status');
  if (status) root.querySelector('#context-status').prepend(status);

  const panels = [
    document.getElementById('calculator-page-content'), document.getElementById('fragment-calculator-panel'),
    document.getElementById('gift-calculator-panel'), document.getElementById('world-rally-panel'), document.getElementById('target-time-form-panel'),
  ].filter(Boolean);
  workspace.append(...panels);
  preparePrimordialTabs(document.getElementById('calculator-page-content'), copy);
  prepareEquipmentTabs(document.getElementById('fragment-calculator-panel'), copy);
  prepareGiftTabs(document.getElementById('gift-calculator-panel'), copy);
  prepareContributionTabs(document.getElementById('target-time-form-panel'), copy);

  legacyLayout.classList.add('legacy-layout-source');
  const toggle = root.querySelector('.context-toggle');
  toggle.addEventListener('click', () => {
    const expanded = context.classList.toggle('is-expanded');
    toggle.setAttribute('aria-expanded', String(expanded));
  });
  const renderContext = (context = {}) => {
    root.querySelector('#context-realm-value').textContent = context.realmCode || '--';
    root.querySelector('#context-world-value').textContent = context.world || '--';
  };
  window.addEventListener('sxstx:global-context-change', (event) => renderContext(event.detail || {}));
  renderContext();

  const initial = normalizeTool(new URLSearchParams(location.search).get('tool'));
  updateLabels(root, initial);
  window.addEventListener('sxstx:tool-change', (event) => updateLabels(root, event.detail?.tool || 'primordial'));
  window.addEventListener('languagechange', () => updateLabels(root, normalizeTool(new URLSearchParams(location.search).get('tool'))));
}

document.addEventListener('DOMContentLoaded', mountAppShell);
