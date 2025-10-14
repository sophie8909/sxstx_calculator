import { categories, targetLevelConfig, materials, productionSources, globalBonuses } from './model.js';

let containers;

/**
 * @description 初始化 View，儲存所有 DOM 容器的參照。
 * @param {Object} domContainers - 包含所有 DOM 元素的物件。
 */
export function init(domContainers) {
    containers = domContainers;
}

/**
 * @description 根據設定檔，動態生成整個計算機的 HTML 介面。
 */
export function render() {
    // --- 清空所有容器 ---
    Object.values(containers).forEach(container => { if (container) container.innerHTML = ''; });

    // --- 輔助函式：創建帶有 class 的元素 ---
    const createElement = (tag, classes = []) => {
        const el = document.createElement(tag);
        if (classes.length > 0) el.classList.add(...classes);
        return el;
    };

    // --- 輔助函式：創建一個完整的輸入框群組 ---
    const createInputGroup = (id, labelText, placeholder, isSub = false, additionalHtml = '') => {
        const wrapper = createElement('div', isSub ? ['mb-4'] : []);
        const label = createElement('label', ['block', 'text-sm', 'font-bold', 'mb-2']);
        label.htmlFor = id;
        label.textContent = labelText;
        
        const input = createElement('input', ['input-field', 'rounded', 'w-full', 'p-2']);
        input.type = 'number';
        input.id = id;
        input.placeholder = placeholder;
        
        wrapper.appendChild(label);
        wrapper.appendChild(input);
        if (additionalHtml) {
            const div = createElement('div');
            div.innerHTML = additionalHtml;
            wrapper.appendChild(div);
        }
        return wrapper;
    };

    // --- 渲染左側「角色目前等級」區塊 ---
    const renderLevelInputs = () => {
        const fragment = document.createDocumentFragment();
        const charPetWrapper = createElement('div', ['grid', 'grid-cols-2', 'sm:grid-cols-5', 'gap-4', 'mb-4', 'border-b', 'border-[#e5eff1]', 'pb-6']);
        const charCat = categories.find(c => c.id === 'character');
        if(charCat) charPetWrapper.appendChild(createInputGroup(`${charCat.id}-current`, charCat.name, '目前'));
        categories.filter(c => c.id.startsWith('pet')).forEach(cat => {
            charPetWrapper.appendChild(createInputGroup(`${cat.id}-current`, cat.name, '目前'));
        });
        fragment.appendChild(charPetWrapper);
        const equipTitle = createElement('h3', ['text-lg', 'font-semibold', 'text-accent', 'pb-2', 'mb-3']);
        equipTitle.textContent = '裝備等級';
        fragment.appendChild(equipTitle);
        const equipWrapper = createElement('div', ['grid', 'grid-cols-2', 'gap-x-6', 'mb-4', 'border-b', 'border-[#e5eff1]', 'pb-6']);
        const equipCol1 = createElement('div');
        const equipCol2 = createElement('div');
        categories.filter(c => c.group === '裝備等級').forEach((cat, i) => {
            (i < 2 ? equipCol1 : equipCol2).appendChild(createInputGroup(`${cat.id}-current`, cat.name, '目前', true));
        });
        equipWrapper.append(equipCol1, equipCol2);
        fragment.appendChild(equipWrapper);
        const skillTitle = createElement('h3', ['text-lg', 'font-semibold', 'text-accent', 'pb-2', 'mb-3']);
        skillTitle.textContent = '技能等級';
        fragment.appendChild(skillTitle);
        const skillWrapper = createElement('div', ['grid', 'grid-cols-2', 'gap-x-6', 'mb-4', 'border-b', 'border-[#e5eff1]', 'pb-6']);
        const skillCol1 = createElement('div');
        const skillCol2 = createElement('div');
        categories.filter(c => c.id.startsWith('skill_combat')).forEach(cat => skillCol1.appendChild(createInputGroup(`${cat.id}-current`, cat.name, '目前', true)));
        categories.filter(c => c.id.startsWith('skill_arcane')).forEach(cat => skillCol2.appendChild(createInputGroup(`${cat.id}-current`, cat.name, '目前', true)));
        skillWrapper.append(skillCol1, skillCol2);
        fragment.appendChild(skillWrapper);
        containers.levelInputs.appendChild(fragment);
    };

    // --- 渲染頂部「目標等級」區塊 ---
    const renderTargetLevels = () => {
        targetLevelConfig.forEach(t => {
            let reachableHtml = (t.id === 'character') ? `<div id="target-char-reachable-level" class="text-xs text-gray-500 mt-1">最低可達: --</div>` : '';
            containers.targetLevels.appendChild(createInputGroup(`target-${t.id}`, t.name, '目標', false, reachableHtml));
        });
    };

    // --- 渲染「遺物等級分佈」區塊 ---
    const renderRelicDistribution = () => {
        for (let i = 10; i <= 20; i++) {
            const group = createInputGroup(`relic-level-${i}`, `等級 ${i}`, '數量');
            group.querySelector('input').classList.add('relic-dist-input');
            containers.relicDistributionInputs.appendChild(group);
        }
    };
    
    // --- 渲染右側「素材資訊」區塊 ---
    const renderMaterials = () => {
        Object.entries(materials).forEach(([matId, mat]) => {
            const wrapper = createElement('div', ['flex', 'items-center']);
            const label = createElement('label', ['w-full', 'block', 'text-sm', 'font-bold']);
            label.htmlFor = `owned-${matId}`;
            label.textContent = `${mat.icon} ${mat.name}`;
            const input = createElement('input', ['input-field', 'rounded', 'w-full', 'p-2']);
            input.type = 'number';
            input.id = `owned-${matId}`;
            input.placeholder = '0';
            wrapper.append(label, input);
            containers.ownedMaterials.appendChild(wrapper);
        });
    };
    
    // --- 渲染中間「推車產量」區塊 ---
    const renderProduction = () => {
        Object.entries(productionSources).forEach(([srcId, src]) => {
            const mat = materials[src.materialId];
            const wrapper = createElement('div');
            const mainLabel = createElement('label', ['block', 'text-sm', 'font-bold', 'mb-2']);
            mainLabel.textContent = `${mat.icon} ${mat.name}`;
            wrapper.appendChild(mainLabel);
            const grid = createElement('div', ['grid', 'grid-cols-2', 'gap-2']);
            const levelDiv = createElement('div');
            const levelLabel = createElement('label', ['text-xs', 'text-gray-500']);
            levelLabel.textContent = '生產等級';
            const levelGrid = createElement('div', ['grid', 'grid-cols-2', 'gap-1']);
            const currentLevelInput = createInputGroup(`prod-level-current-${srcId}`, '', '目前').querySelector('input');
            currentLevelInput.classList.add('production-related-input', 'text-sm');
            const targetLevelInput = createInputGroup(`prod-level-target-${srcId}`, '', '目標').querySelector('input');
            targetLevelInput.classList.add('production-related-input', 'text-sm');
            levelGrid.append(currentLevelInput.parentElement, targetLevelInput.parentElement);
            levelDiv.append(levelLabel, levelGrid);
            const hourlyDiv = createElement('div');
            const hourlyLabel = createElement('label', ['text-xs', 'text-gray-500']);
            hourlyLabel.textContent = '時產量 (理論/手動)';
            const hourlyGrid = createElement('div', ['grid', 'grid-cols-2', 'gap-1']);
            const theoreticalInput = createInputGroup(`theoretical-hourly-${srcId}`, '', '理論').querySelector('input');
            theoreticalInput.classList.add('text-sm');
            theoreticalInput.disabled = true;
            const manualInput = createInputGroup(`manual-hourly-${srcId}`, '', '手動').querySelector('input');
            manualInput.classList.add('text-sm');
            hourlyGrid.append(theoreticalInput.parentElement, manualInput.parentElement);
            hourlyDiv.append(hourlyLabel, hourlyGrid);
            grid.append(levelDiv, hourlyDiv);
            wrapper.appendChild(grid);
            containers.productionInputs.appendChild(wrapper);
        });

        Object.entries(globalBonuses).forEach(([bonusId, bonus]) => {
             const group = createInputGroup(`bonus-${bonusId}`, bonus.name, '0');
             group.querySelector('input').classList.add('production-related-input');
             containers.globalBonuses.appendChild(group);
        });
    };

    // --- 執行所有渲染函式 ---
    renderLevelInputs();
    renderTargetLevels();
    renderRelicDistribution();
    renderMaterials();
    renderProduction();
}


/**
 * @description 更新「現在時間」的顯示。
 */
export function updateCurrentTime() {
    if (containers.currentTimeDisplay) {
        const now = new Date();
        const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        containers.currentTimeDisplay.textContent = now.toLocaleString('sv-SE', options);
    }
}

/**
 * @description 更新遺物分佈區塊的總數顯示。
 */
export function updateRelicTotal() {
    let total = 0;
    document.querySelectorAll('.relic-dist-input').forEach(el => { total += parseInt(el.value) || 0; });
    const display = document.getElementById('relic-total-display');
    display.textContent = `(${total}/20)`;
    if (total !== 20 && total > 0) { display.classList.add('text-warning'); display.classList.remove('text-gray-400'); } 
    else { display.classList.remove('text-warning'); display.classList.add('text-gray-400'); }
}

/**
 * @description 更新理論時產量顯示。
 */
export function updateTheoreticalProduction(productionSourcesModel) {
    const totalBonus = 1 +
        (parseFloat(document.getElementById('bonus-map').value) || 0) / 100 +
        (parseFloat(document.getElementById('bonus-relic').value) || 0) / 100 +
        (parseFloat(document.getElementById('bonus-pass').value) || 0) / 100;
    for (const srcId in productionSourcesModel) {
        const level = parseInt(document.getElementById(`prod-level-current-${srcId}`).value) || 0;
        const baseProd = level > 0 ? productionSourcesModel[srcId].baseProd(level) : 0;
        document.getElementById(`theoretical-hourly-${srcId}`).value = Math.floor(baseProd * totalBonus);
    }
}

/**
 * @description 將計算結果渲染到右側的「計算總覽」區塊。
 */
export function renderResults(results, missingFiles) {
    let html = '';
    if (missingFiles.length > 0) {
        html += `<div class="bg-yellow-900/50 border-l-4 border-yellow-400 text-yellow-300 p-3 rounded-lg mb-4 text-sm"><h4 class="font-bold">注意</h4><p>無法載入以下數據檔案，目前正使用模擬數據：<br>${missingFiles.join(', ')}</p></div>`;
    }
    
    if (results.error) {
        let errorHtml = '';
        if (results.error.hasError) { errorHtml += '<p class="text-warning text-center py-4">輸入有誤 (例如遺物總數不為20)，請檢查。</p>'; }
        if (results.error.uniqueMissingDataErrors.length > 0) {
            errorHtml += `<div class="bg-red-900/50 border-l-4 border-red-400 text-red-300 p-3 rounded-lg mb-4 text-sm"><h4 class="font-bold">數據缺失</h4><p>CSV檔案中缺少以下等級的數據，計算無法完成：<br>${results.error.uniqueMissingDataErrors.join('<br>')}</div>`;
        }
        containers.results.innerHTML = errorHtml;
        return;
    }
    
    if (results.empty) {
        containers.results.innerHTML = '<p class="text-gray-500 text-center py-8">請輸入資料以自動計算。</p>';
        return;
    }

    const { req, prodCost, gains, deficit, reachableCharLevel } = results;

    document.getElementById('target-char-reachable-level').textContent = `最低可達: ${reachableCharLevel > 0 ? reachableCharLevel : '--'}`;

    const formatNum = (n) => n.toLocaleString();
    let costHtml = '';
    for (const matId in req) { if (req[matId] > 0) { costHtml += `<div class="flex justify-between items-center text-sm"><span>${materials[matId].icon} ${materials[matId].name}</span><strong>${formatNum(req[matId])}</strong></div>`; } }
    if (costHtml) { html += `<div class="cost-item p-3 rounded-lg space-y-1"><h4 class="font-bold text-gold">角色養成所需</h4>${costHtml}</div>`; }
    let prodCostHtml = '';
    for (const matId in prodCost) { if (prodCost[matId] > 0) { prodCostHtml += `<div class="flex justify-between items-center text-sm"><span>${materials[matId].icon} ${materials[matId].name}</span><strong>${formatNum(prodCost[matId])}</strong></div>`; } }
    if (prodCostHtml) { html += `<div class="cost-item p-3 rounded-lg space-y-1"><h4 class="font-bold text-gold">生產等級升級所需</h4>${prodCostHtml}</div>`; }
    let gainsHtml = '';
    for (const matId in gains) { if (gains[matId] > 0) { gainsHtml += `<div class="flex justify-between items-center text-sm"><span>${materials[matId].icon} ${materials[matId].name}</span><strong class="text-accent">+${formatNum(gains[matId])}</strong></div>`; } }
    if (gainsHtml) { html += `<div class="info-item p-3 rounded-lg space-y-1"><h4 class="font-bold text-accent">預計掛機獲得</h4>${gainsHtml}</div>`; }
    let deficitHtml = '';
    for (const matId in deficit) {
        if (deficit[matId] > 0) {
            deficitHtml += `<div class="result-item p-4 rounded-lg flex justify-between items-center"><div class="flex items-center"><span class="text-2xl mr-3">${materials[matId].icon}</span><span class="font-bold text-lg">${materials[matId].name}</span></div><strong class="text-xl font-semibold text-warning">-${formatNum(deficit[matId])}</strong></div>`;
        }
    }
    if (deficitHtml) { html += `<h3 class="text-xl font-bold text-warning border-t border-[#e5eff1] pt-4 mt-4">最終資源缺口</h3>` + deficitHtml; } 
    else if (costHtml || prodCostHtml) { html += '<p class="text-green-400 text-center py-6 font-bold text-lg">恭喜！根據計算，你的資源已完全足夠！</p>'; }
    containers.results.innerHTML = html || '<p class="text-gray-500 text-center py-8">請輸入資料以自動計算。</p>';
}

/**
 * @description 將本地儲存的資料填入所有輸入框
 * @param {Object} data - 從 localStorage 讀取的資料
 */
export function populateInputs(data) {
    if (data) {
        Object.keys(data).forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.value = data[id];
            }
        });
    }
}

/**
 * @description 從所有輸入框獲取當前的值
 * @returns {Object} 包含所有輸入值的物件
 */
export function getAllInputValues() {
    const values = {
        targets: {},
        currentLevels: {},
        owned: {},
        relicDistribution: {},
        production: {},
        globalBonuses: {},
        bedExpHourly: 0,
        targetTimeStr: ''
    };

    targetLevelConfig.forEach(t => { values.targets[t.id] = parseInt(document.getElementById(`target-${t.id}`).value) || 0; });
    categories.forEach(c => { values.currentLevels[c.id] = parseInt(document.getElementById(`${c.id}-current`).value) || 0; });
    Object.keys(materials).forEach(matId => { values.owned[matId] = parseInt(document.getElementById(`owned-${matId}`).value) || 0; });
    for(let i=10; i<=20; i++) { values.relicDistribution[i] = parseInt(document.getElementById(`relic-level-${i}`).value) || 0; }
    Object.keys(productionSources).forEach(srcId => {
        values.production[srcId] = {
            current: parseInt(document.getElementById(`prod-level-current-${srcId}`).value) || 0,
            target: parseInt(document.getElementById(`prod-level-target-${srcId}`).value) || 0,
            manual: parseFloat(document.getElementById(`manual-hourly-${srcId}`).value) || 0,
            theoretical: parseFloat(document.getElementById(`theoretical-hourly-${srcId}`).value) || 0,
        };
    });
    Object.keys(globalBonuses).forEach(bonusId => { values.globalBonuses[bonusId] = parseFloat(document.getElementById(`bonus-${bonusId}`).value) || 0; });

    values.bedExpHourly = parseFloat(document.getElementById('bed-exp-hourly').value) || 0;
    values.targetTimeStr = document.getElementById('target-time').value;

    return values;
}
