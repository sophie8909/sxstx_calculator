import * as Model from './model.js';
import * as View from './view.js';

// 當整個網頁文件（DOM）載入完成後，開始執行主程式
document.addEventListener('DOMContentLoaded', async () => {
    // 獲取所有需要操作的介面元素容器
    const containers = {
        levelInputs: document.getElementById('level-inputs'),
        ownedMaterials: document.getElementById('owned-materials'),
        productionInputs: document.getElementById('production-inputs'),
        globalBonuses: document.getElementById('global-bonuses'),
        results: document.getElementById('results'),
        targetLevels: document.getElementById('target-levels'),
        relicDistributionInputs: document.getElementById('relic-distribution-inputs'),
        currentTimeDisplay: document.getElementById('current-time-display'),
    };

    // 初始化 View，並傳入 DOM 容器
    View.init(containers);
    
    // 載入遊戲數據（從 CSV 或備用數據）
    const { loadedGameData, missingFiles } = await Model.loadGameData();

    // 初始化應用程式
    main(loadedGameData, missingFiles);
});

/**
 * @description 主應用程式邏輯，在數據載入後執行。
 * @param {Object} GAME_DATA - 載入或模擬的遊戲數據。
 * @param {Array<string>} missingFiles - 載入失敗的 CSV 檔名列表。
 */
function main(GAME_DATA, missingFiles) {
    
    // TODO: [設定] 將目標時間寫死為台灣時間 2025/11/15 上午八點，並轉換為使用者的本地時區
    const TAIWAN_TARGET_TIME_STRING = "2025-11-15T08:00:00+08:00";
    const targetDate = new Date(TAIWAN_TARGET_TIME_STRING);

    // 將 Date 物件轉換為 <input type="datetime-local"> 所需的 YYYY-MM-DDTHH:MM 格式
    const toLocalISOString = (date) => {
        const pad = (num) => num.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };
    const localTargetTimeString = toLocalISOString(targetDate);


    /**
     * @description 主計算函式，會被所有輸入框的 'input' 事件觸發。
     */
    function calculate() {
        const allInputs = View.getAllInputValues();
        // **強制覆蓋目標時間為寫死的值 (已轉換為本地時區)**
        allInputs.targetTimeStr = localTargetTimeString; 

        const results = Model.performCalculations(allInputs, GAME_DATA);
        View.renderResults(results, missingFiles);
        updateLevelUpTimeAndNotification(allInputs);
    }

    /**
     * @description 計算並更新下次升級所需時間及設定通知。
     */
    function updateLevelUpTimeAndNotification(inputs) {
        // inputs 物件已經在 calculate() 中被修改，所以這裡直接使用即可
        const { currentLevels, owned, bedExpHourly } = inputs;
        const currentLevel = currentLevels.character || 0;
        const ownedExp = owned.exp || 0;
        
        const levelUpTimeDisplay = document.getElementById('bed-levelup-time');
        if (Model.notificationTimerId) { clearTimeout(Model.notificationTimerId); Model.notificationTimerId = null; }
        if (bedExpHourly <= 0 || currentLevel >= Model.MAX_LEVEL) { levelUpTimeDisplay.textContent = '預計升級時間: --'; return; }
        
        const nextData = GAME_DATA.characterUpgradeCosts.find(d => d.level === currentLevel);
        if (!nextData) { levelUpTimeDisplay.textContent = '已達最高等級'; return; }
        
        const expNeeded = Math.max(0, nextData.cost_exp - ownedExp);
        
        if (expNeeded <= 0) {
            levelUpTimeDisplay.textContent = '預計升級時間: 可立即升級';
        } else {
            if (bedExpHourly <= 0) {
                levelUpTimeDisplay.textContent = '預計升級時間: 請先輸入床的每小時經驗產量';
            } else {
                const hoursNeeded = expNeeded / bedExpHourly;
                const levelUpTimestamp = new Date().getTime() + hoursNeeded * 3600 * 1000;
                const levelUpDate = new Date(levelUpTimestamp);
                const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
                levelUpTimeDisplay.textContent = `預計升級時間: ${levelUpDate.toLocaleString('sv-SE', options)}`;
                
                if ('Notification' in window && Notification.permission === 'granted') {
                    const delay = (levelUpTimestamp - 5 * 60 * 1000) - Date.now();
                    if (delay > 0) {
                        Model.notificationTimerId = setTimeout(() => {
                            new Notification('杖劍傳說提醒', {
                                body: `您的角色即將在約 5 分鐘後升級至 ${currentLevel + 1} 級！`,
                                icon: 'https://placehold.co/192x192/31c9be/ffffff?text=LV'
                            });
                        }, delay);
                    }
                }
            }
        }
    }

    /**
     * @description 綁定所有事件監聽器。
     */
    function setupEventListeners() {
        document.body.addEventListener('input', (event) => {
            const target = event.target;
            // 忽略被禁用的目標時間輸入框
            if (target.matches('input[type=number], input[type=datetime-local]') && target.id !== 'target-time') {
                if (target.classList.contains('production-related-input')) { View.updateTheoreticalProduction(Model.productionSources); }
                if (target.classList.contains('relic-dist-input')) { View.updateRelicTotal(); }
                
                const allInputs = View.getAllInputValues();
                Model.saveData(allInputs); // 每次輸入都儲存
                calculate();
            }
        });

        const notificationBtn = document.getElementById('enable-notifications-btn');
        if ('Notification' in window) {
            notificationBtn.addEventListener('click', () => {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        notificationBtn.textContent = '通知已啟用';
                        notificationBtn.disabled = true;
                        new Notification('通知已啟用', { body: '將在角色升級前 5 分鐘提醒您！' });
                    } else {
                        notificationBtn.textContent = '通知被拒絕';
                        notificationBtn.disabled = true;
                    }
                });
            });
        } else {
            notificationBtn.textContent = '瀏覽器不支援通知';
            notificationBtn.disabled = true;
        }

        const clearDataBtn = document.getElementById('clear-data-btn');
        clearDataBtn.addEventListener('click', () => {
            if (confirm('確定要清除所有已儲存的本地紀錄嗎？此操作無法復原。')) {
                Model.clearData();
                location.reload();
            }
        });
    }

    // --- 應用程式啟動流程 ---
    View.render();
    
    // **將目標時間輸入框的值設定為轉換後的本地時間並禁用它**
    const targetTimeInput = document.getElementById('target-time');
    if (targetTimeInput) {
        targetTimeInput.value = localTargetTimeString;
        targetTimeInput.disabled = true;
    }

    setupEventListeners();
    
    const savedData = Model.loadData();
    if (savedData) {
        // 從本地儲存中刪除舊的目標時間，確保總是使用寫死的值
        delete savedData['target-time'];
        View.populateInputs(savedData);
    }

    View.updateTheoreticalProduction(Model.productionSources);
    View.updateRelicTotal();
    setInterval(View.updateCurrentTime, 1000);
    View.updateCurrentTime();
    calculate(); // 初始計算一次
}

