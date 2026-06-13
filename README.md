# 杖劍傳說 素材計算機
♥　如果這個工具有幫到你，[buymeacoffee.com/sophie8909](https://buymeacoffee.com/sophie8909)，可以請我喝杯奶茶　♥

## 原初計算機

1. 計算到達目標時間的所需素材量與推車、商車產量
2. 計算原初之星分數
3. 計算角色經驗
  - 到達目標時間最低可達等級、下一等級
  - 可將預計升等時間匯入 Google 日曆通知

## 碎片計算機

1. 計算裝備碎片分解神鑄石數量
2. 交易行碎片與神鑄石買賣價格計算
3. 各副本可得碎片與神鑄石數量顯示

## 資料

- 素材數據整合檔：https://docs.google.com/spreadsheets/d/1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E
- 各伺服器目標時間表單（當前推薦使用網站內介面填寫更方便）：https://forms.gle/9kH8GbNuaJ3VdJau9

## Development

- Install dependencies: `npm ci`
- Run locally: `npm run dev`
- Build raw CSV data into generated JSON: `npm run build:data`
- Build the static site: `npm run build`
- Preview the production build: `npm run preview`

Raw CSV files live in `data/raw/`. The build-data script writes generated JSON to `data/generated/upgrade-costs.json`.

GitHub Pages deployment uses `.github/workflows/deploy.yml`. The workflow runs `npm ci`, `npm run build:data`, `npm run build`, and publishes `dist/`.
