// --- 核心應用程式設定 (Core Application Settings) ---
const MAX_LEVEL = 200; // 最高等級上限
let notificationTimerId = null; // 用於存放通知的計時器ID

// 定義所有需要輸入目前等級的項目，用於生成左側欄位
export const categories = [
    { id: 'character', name: '角色等級' },
    { id: 'equipment_main_weapon', name: '主武器', group: '裝備等級' },
    { id: 'equipment_off_weapon', name: '副武器', group: '裝備等級' },
    { id: 'equipment_helmet', name: '頭盔', group: '裝備等級' },
    { id: 'equipment_armor', name: '鎧甲', group: '裝備等級' },
    { id: 'equipment_boots', name: '戰靴', group: '裝備等級' },
    { id: 'skill_combat1', name: '戰技一', group: '技能等級' },
    { id: 'skill_combat2', name: '戰技二', group: '技能等級' },
    { id: 'skill_combat3', name: '戰技三', group: '技能等級' },
    { id: 'skill_combat4', name: '戰技四', group: '技能等級' },
    { id: 'skill_arcane1', name: '祕法一', group: '技能等級' },
    { id: 'skill_arcane2', name: '祕法二', group: '技能等級' },
    { id: 'skill_arcane3', name: '祕法三', group: '技能等級' },
    { id: 'skill_arcane4', name: '祕法四', group: '技能等級' },
    { id: 'pet1', name: '幻獸一', group: '幻獸等級' },
    { id: 'pet2', name: '幻獸二', group: '幻獸等級' },
    { id: 'pet3', name: '幻獸三', group: '幻獸等級' },
    { id: 'pet4', name: '幻獸四', group: '幻獸等級' },
];

// 定義頂部的目標等級設定欄位
export const targetLevelConfig = [
    { id: 'character', name: '角色等級' },
    { id: 'equipment_resonance', name: '裝備共鳴' },
    { id: 'skill_resonance', name: '技能共鳴' },
    { id: 'pet_resonance', name: '幻獸共鳴' },
    { id: 'relic_resonance', name: '遺物共鳴' },
];

// 定義所有遊戲內的素材及其圖示
export const materials = {
    exp: { name: '角色經驗', icon: '📖' },
    rola: { name: '羅拉幣', icon: '💰' },
    wood: { name: '木頭', icon: '🪵' },
    stoneMat: { name: '石頭', icon: '🪨' },
    essence: { name: '歷戰精華', icon: '✨' },
    sand: { name: '時之砂', icon: '⏳' },
    stoneOre: { name: '粗煉石', icon: '💎' },
    refiningStone: { name: '精煉石', icon: '🔨' },
    freezeDried: { name: '幻獸凍乾', icon: '🍖' },
};

// 定義推車可生產的資源及其基礎產量公式
const productionSources = {
    // TODO: [遊戲數據] 此處為各資源的基礎產量公式，請根據遊戲實際情況修改
    rola: { materialId: 'rola', baseProd: (lv) => 100 * Math.pow(lv, 1.5) },
    wood: { materialId: 'wood', baseProd: (lv) => 120 * Math.pow(lv, 1.45) },
    stoneMat: { materialId: 'stoneMat', baseProd: (lv) => 110 * Math.pow(lv, 1.48) },
    essence: { materialId: 'essence', baseProd: (lv) => 50 * Math.pow(lv, 1.6) },
    stoneOre: { materialId: 'stoneOre', baseProd: (lv) => 40 * Math.pow(lv, 1.65) },
    sand: { materialId: 'sand', baseProd: (lv) => 20 * Math.pow(lv, 1.3) },
    freezeDried: { materialId: 'freezeDried', baseProd: (lv) => 30 * Math.pow(lv, 1.4) }
};

// 定義全域加成的項目
export const globalBonuses = {
    map: { name: '推圖進度' },
    relic: { name: '古遺物' },
    pass: { name: '月卡' }
};

// 用於儲存預處理後的累積成本數據
const cumulativeCostData = {};

// 內建的備用模擬數據，當 CSV 檔案載入失敗時使用
const MOCK_GAME_DATA = {
    // TODO: [模擬數據] 以下為 CSV 讀取失敗時的備用數據
    productionUpgradeCosts: [ { level: 1, cost_wood: 100, cost_stone: 100, cost_rola: 500 }, { level: 2, cost_wood: 200, cost_stone: 200, cost_rola: 1000 }, { level: 3, cost_wood: 400, cost_stone: 400, cost_rola: 2000 }, ],
    equipmentUpgradeCosts: [ { level: 1, cost_stone_ore: 10, cost_rola: 100, cost_refining_stone: 0 }, { level: 2, cost_stone_ore: 20, cost_rola: 200, cost_refining_stone: 0 }, { level: 30, cost_stone_ore: 500, cost_rola: 5000, cost_refining_stone: 1 }, ],
    skillUpgradeCosts: [ { level: 1, cost_essence: 50 }, { level: 2, cost_essence: 75 }, { level: 3, cost_essence: 100 }, ],
    petUpgradeCosts: [ { level: 1, cost_freeze_dried: 30 }, { level: 2, cost_freeze_dried: 45 }, { level: 3, cost_freeze_dried: 60 }, ],
    relicUpgradeCosts: [ { level: 1, cost_sand: 100, cost_rola: 1000 }, { level: 2, cost_sand: 150, cost_rola: 1500 }, { level: 3, cost_sand: 200, cost_rola: 2000 }, ],
    characterUpgradeCosts: Array.from({ length: MAX_LEVEL }, (_, i) => ({ level: i + 1, cost_exp: Math.floor(200 * Math.pow(i + 1, 2.2)) })),
};

/**
 * @description 從指定的 URL 獲取並解析 CSV 檔案。
 * @param {string} url - CSV 檔案的路徑。
 * @returns {Promise<Array<Object>>} - 解析後的物件陣列。
 */
async function fetchAndParseCsv(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`無法載入 CSV 檔案: ${url}`);
    }
    const csvText = await response.text();
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((header, i) => {
            const value = parseFloat(values[i]);
            obj[header] = isNaN(value) ? 0 : value;
        });
        return obj;
    });
}

/**
 * @description 預處理 GAME_DATA 中的成本數據，轉換為累積成本表。
 * @param {Object} GAME_DATA - 包含所有從 CSV 或模擬數據來的成本資料。
 */
function preprocessCostData(GAME_DATA) {
    const dataSources = {
        equipment: GAME_DATA.equipmentUpgradeCosts, skill: GAME_DATA.skillUpgradeCosts, pet: GAME_DATA.petUpgradeCosts,
        relic: GAME_DATA.relicUpgradeCosts, production: GAME_DATA.productionUpgradeCosts,
        character: GAME_DATA.characterUpgradeCosts,
    };
    // TODO: [計算] 此迴圈處理所有從 CSV 讀取的數據，將其轉換為計算機內部使用的「累積成本」格式。
    for (const type in dataSources) {
        const source = dataSources[type];
        cumulativeCostData[type] = [];
        let cumulative = {};
        if (source && source.length > 0) { Object.keys(source[0]).forEach(key => { if (key.startsWith('cost_')) cumulative[key] = 0; }); }
        for (let i = 0; i < source.length; i++) {
            const levelData = source[i];
            Object.keys(cumulative).forEach(key => { cumulative[key] += (levelData[key] || 0); });
            cumulativeCostData[type].push({ level: levelData.level, ...cumulative });
        }
    }
}

/**
 * @description 從指定的累積成本表中，獲取某個等級的總成本。
 * @param {Array} costTable - 預處理過的累積成本表。
 * @param {number} level - 想要查詢的等級。
 * @returns {Object} 包含該等級所有累積成本的物件。
 */
function getCumulativeCost(costTable, level) {
    // TODO: [計算] 這是獲取累積經驗/資源的核心邏輯。
    const emptyCost = {};
    if (!costTable || costTable.length === 0) return emptyCost;
    costTable.forEach(row => {
        Object.keys(row).forEach(key => emptyCost[key] = 0);
    });
    delete emptyCost.level;
    if (level <= 0) return emptyCost;
    const index = costTable.findLastIndex(d => d.level <= level);
    const data = (index !== -1) ? costTable[index] : null;
    return { ...emptyCost, ...data };
}

/**
 * @description 將 CSV 標頭中的成本鍵名 (如 cost_stone_ore) 轉換為 materials 物件中的鍵名 (stoneOre)。
 * @param {string} costKey - 成本鍵名。
 * @returns {string} 轉換後的材料 ID。
 */
function getMaterialIdFromCostKey(costKey) {
    let matId = costKey.replace('cost_', '');
    if (matId === 'stone') return 'stoneMat';
    return matId.replace(/_([a-z])/g, g => g[1].toUpperCase());
}

/**
 * @description 載入所有遊戲數據
 * @returns {Promise<{loadedGameData: Object, missingFiles: Array<string>}>}
 */
export async function loadGameData() {
    const dataFiles = {
        productionUpgradeCosts: 'production_upgrade_costs.csv',
        equipmentUpgradeCosts: 'equipment_upgrade_costs.csv',
        skillUpgradeCosts: 'skill_upgrade_costs.csv',
        petUpgradeCosts: 'pet_upgrade_costs.csv',
        relicUpgradeCosts: 'relic_upgrade_costs.csv',
        characterUpgradeCosts: 'character_upgrade_costs.csv'
    };
    const loadedGameData = {};
    const missingFiles = [];
    // 嘗試載入所有 CSV，若失敗則使用模擬數據並記錄檔名
    for (const key in dataFiles) {
        try {
            loadedGameData[key] = await fetchAndParseCsv(dataFiles[key]);
        } catch (error) {
            console.warn(`無法載入 ${dataFiles[key]}，將使用模擬數據。`, error);
            loadedGameData[key] = MOCK_GAME_DATA[key];
            missingFiles.push(dataFiles[key]);
        }
    }
    preprocessCostData(loadedGameData);
    return { loadedGameData, missingFiles };
}

/**
 * @description 主計算函式
 * @param {Object} inputs - 從 View 獲取的所有使用者輸入值
 * @param {Object} GAME_DATA - 載入的遊戲數據
 * @returns {Object} - 計算結果
 */
export function performCalculations(inputs, GAME_DATA) {
    let required = {}, prodUpgradeCost = {}, hasError = false;
    const missingDataErrors = [];
    const { targets, currentLevels, owned, relicDistribution, bedExpHourly, targetTimeStr } = inputs;
    let hasInput = Object.values(currentLevels).some(v => v > 0) || Object.values(targets).some(v => v > 0);

    // ... (將 calculate 函式內的所有計算邏輯移到此處) ...

    // --- 計算並更新「最低可達等級」 ---
    let reachableCharLevel = currentLevels.character || 0;
    if (targetTimeStr && cumulativeCostData['character']) {
        const hours = Math.max(0, (new Date(targetTimeStr).getTime() - new Date().getTime()) / 36e5);
        const currentInvestedExp = getCumulativeCost(cumulativeCostData['character'], currentLevels.character - 1).cost_exp;
        const totalExpPool = currentInvestedExp + owned.exp + (bedExpHourly * hours);
        const foundIndex = cumulativeCostData['character'].findLastIndex(d => d.cost_exp <= totalExpPool);
        reachableCharLevel = (foundIndex !== -1) ? cumulativeCostData['character'][foundIndex].level : currentLevels.character;
    }

    // --- 遺物成本計算 ---
    const targetRelicResonance = targets.relic_resonance;
    let relicCount = Object.values(relicDistribution).reduce((sum, count) => sum + count, 0);
    if (relicCount > 0) hasInput = true;
    
    for (let i = 10; i <= 20; i++) {
        const count = relicDistribution[i] || 0;
        for (let j = 0; j < count; j++) {
            const current = i;
            const finalTarget = Math.max(current, targetRelicResonance);
            if (finalTarget > current) {
                // ... 遺物成本計算 ...
            }
        }
    }
    if (relicCount > 0 && relicCount !== 20) { hasError = true; }

    // --- 其他項目成本計算 ---
    categories.forEach(cat => {
        // ... 其他項目成本計算 ...
    });

    // --- 生產建築升級成本計算 ---
    for (const srcId in productionSources) {
        // ... 生產升級成本計算 ...
    }

    const uniqueMissingDataErrors = [...new Set(missingDataErrors)];
    if (hasError || uniqueMissingDataErrors.length > 0) {
        return { error: { hasError, uniqueMissingDataErrors } };
    }
    if (!hasInput) { return { empty: true }; }
    
    // --- 掛機收益計算 ---
    let gainsFromTime = {};
    if (targetTimeStr) {
        const hours = Math.max(0, (new Date(targetTimeStr).getTime() - new Date().getTime()) / 36e5);
        for (const srcId in productionSources) {
            const manual = inputs.production[srcId].manual || 0;
            const theoretical = inputs.production[srcId].theoretical || 0;
            const hourlyGain = manual > 0 ? manual : theoretical;
            gainsFromTime[productionSources[srcId].materialId] = (gainsFromTime[productionSources[srcId].materialId] || 0) + Math.floor(hourlyGain * hours);
        }
        if (bedExpHourly > 0) { gainsFromTime['exp'] = (gainsFromTime['exp'] || 0) + Math.floor(bedExpHourly * hours); }
    }

    // --- 最終資源缺口計算 ---
    let deficit = {};
    for (const matId in materials) {
        const totalRequired = (required[matId] || 0) + (prodUpgradeCost[matId] || 0);
        const ownedValue = owned[matId] || 0;
        const gained = gainsFromTime[matId] || 0;
        deficit[matId] = Math.max(0, totalRequired - ownedValue - gained);
    }
    
    return { required, prodUpgradeCost, gainsFromTime, deficit, reachableCharLevel, empty: false };
}


/**
 * @description 將所有本地儲存的資料儲存起來
 */
export function saveData(inputs) {
    localStorage.setItem('sxstxCalculatorData', JSON.stringify(inputs));
}

/**
 * @description 從本地儲存讀取資料
 * @returns {Object | null}
 */
export function loadData() {
    const savedData = localStorage.getItem('sxstxCalculatorData');
    return savedData ? JSON.parse(savedData) : null;
}

export function clearData() {
    localStorage.removeItem('sxstxCalculatorData');
}

export { productionSources, MAX_LEVEL, notificationTimerId };
