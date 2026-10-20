import { createLocalRecord, initializeLocalRecords, renameLocalRecord, switchLocalRecord } from '../../services/localRecords.js';
import { t } from '../../i18n-inline.js';
import { element } from '../../shared/components.js';

export function mountLocalRecordControls(container, { beforeSwitch, reload = () => location.reload() } = {}) {
  const controls = element('fieldset', { className: 'local-record-controls__fields' });
  const selectLabel = element('label', { className: 'local-record-controls__field' }, [
    element('span', { 'data-i18n': 'local_record_select', text: t('local_record_select') }),
  ]);
  const select = element('select', { className: 'input-field' });
  selectLabel.append(select);
  const nameLabel = element('label', { className: 'local-record-controls__field local-record-controls__name' }, [
    element('span', { 'data-i18n': 'local_record_name', text: t('local_record_name') }),
  ]);
  const nameInput = element('input', {
    className: 'input-field', type: 'text', maxLength: 60,
  });
  nameLabel.append(nameInput);
  const addButton = element('button', {
    type: 'button', className: 'btn-secondary', 'data-i18n': 'local_record_add', text: t('local_record_add'),
  });
  const status = element('span', { className: 'local-record-controls__status', role: 'status', ariaLive: 'polite' });
  controls.append(selectLabel, nameLabel, addButton, status);
  container.replaceChildren(controls);

  let state;
  let savedName = '';
  const renderRecords = () => {
    select.replaceChildren(...state.records.map((record) => element('option', {
      value: record.id, text: record.name,
    })));
    select.value = state.activeId;
    savedName = state.records.find((record) => record.id === state.activeId)?.name || '';
    nameInput.value = savedName;
  };
  const showError = () => { status.textContent = t('local_record_error'); };

  try {
    state = initializeLocalRecords(t('local_record_default', { number: 1 }));
    renderRecords();
  } catch {
    showError();
  }
  if (!state) {
    select.disabled = true;
    nameInput.disabled = true;
    addButton.disabled = true;
  }

  nameInput.addEventListener('input', () => {
    if (!state || !nameInput.value.trim()) return;
    try {
      state = renameLocalRecord(nameInput.value);
      const option = select.selectedOptions[0];
      if (option) option.textContent = nameInput.value.trim();
      savedName = nameInput.value.trim();
      status.textContent = '';
    } catch {
      nameInput.value = savedName;
      showError();
    }
  });
  nameInput.addEventListener('change', () => {
    if (!nameInput.value.trim()) nameInput.value = savedName;
  });
  select.addEventListener('change', () => {
    if (!state || select.value === state.activeId) return;
    try {
      beforeSwitch?.();
      state = switchLocalRecord(select.value);
      reload();
    } catch {
      select.value = state.activeId;
      showError();
    }
  });
  addButton.addEventListener('click', () => {
    if (!state) return;
    try {
      beforeSwitch?.();
      state = createLocalRecord(t('local_record_default', { number: state.records.length + 1 }));
      reload();
    } catch {
      showError();
    }
  });
  return controls;
}
