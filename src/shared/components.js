export function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(options).forEach(([key, value]) => {
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('data-')) node.setAttribute(key, value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  });
  node.append(...children.filter(Boolean));
  return node;
}

export function icon(name) {
  const icons = {
    primordial: 'P', equipment: 'E', gift: 'G', rally: 'W', contribution: '+', menu: 'M', status: '*',
  };
  return element('span', { className: 'app-icon', text: icons[name] || '*', ariaHidden: 'true' });
}

export function navButton({ label, shortLabel, iconName, page }) {
  const button = element('button', {
    type: 'button', className: 'calculator-nav-btn app-nav-item', 'data-page': page, ariaLabel: label,
  }, [icon(iconName)]);
  button.append(
    element('span', { className: 'app-nav-label', text: label }),
    element('span', { className: 'app-nav-short-label', text: shortLabel || label })
  );
  return button;
}

export function featureTabs({ id, labels, onChange }) {
  const tabList = element('div', {
    className: 'feature-tabs', role: 'tablist', ariaLabel: labels.map((item) => item.label).join(' / '),
  });
  const panels = [];

  labels.forEach((item, index) => {
    const tabId = `${id}-tab-${item.id}`;
    const panelId = `${id}-panel-${item.id}`;
    const button = element('button', {
      type: 'button', className: 'feature-tab', text: item.label, id: tabId, role: 'tab',
      ariaControls: panelId, ariaSelected: String(index === 0), tabIndex: index === 0 ? 0 : -1,
      'data-tab': item.id,
    });
    const panel = element('section', {
      className: 'feature-tab-panel', id: panelId, role: 'tabpanel', ariaLabelledby: tabId, hidden: index !== 0,
    });
    panels.push(panel);
    tabList.appendChild(button);
  });

  const activate = (tabId, { focus = false } = {}) => {
    const buttons = Array.from(tabList.querySelectorAll('[role="tab"]'));
    buttons.forEach((button, index) => {
      const active = button.dataset.tab === tabId;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      panels[index].hidden = !active;
      if (active && focus) button.focus();
    });
    onChange?.(tabId);
  };

  tabList.addEventListener('click', (event) => {
    const button = event.target.closest('[role="tab"]');
    if (button) activate(button.dataset.tab);
  });
  tabList.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(tabList.querySelectorAll('[role="tab"]'));
    const current = buttons.indexOf(document.activeElement);
    let next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : current;
    if (event.key === 'ArrowRight') next = (current + 1) % buttons.length;
    if (event.key === 'ArrowLeft') next = (current - 1 + buttons.length) % buttons.length;
    activate(buttons[next].dataset.tab, { focus: true });
  });

  return { tabList, panels, activate };
}

export function emptyState(title, description) {
  return element('div', { className: 'empty-state' }, [
    element('span', { className: 'empty-state-icon', text: '--', ariaHidden: 'true' }),
    element('h3', { text: title }),
    element('p', { text: description }),
  ]);
}

export function confirmationNotice(message) {
  const notice = element('div', { className: 'transfer-notice', role: 'status', text: message });
  window.setTimeout(() => notice.remove(), 3200);
  return notice;
}
