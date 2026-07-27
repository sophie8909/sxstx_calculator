# 杖劍傳說計算機

Production: https://sxstx.feiyastudio.com/

## Canonical data source

The only production source of calculator and mutable game data is the Google spreadsheet [杖劍傳說 素材數據整合檔](https://docs.google.com/spreadsheets/d/1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E/edit).

| Dataset | Sheet | gid | Canonical key |
| --- | --- | ---: | --- |
| Servers | 伺服器 | 1981289603 | 伺服器編號 |
| Character upgrade costs | 角色等級 | 314585849 | season + level |
| Equipment upgrade costs | 裝備 | 1205841685 | season + level |
| Skill upgrade costs | 技能 | 682954597 | season + level |
| Relic upgrade costs | 遺物等級 | 1548103854 | season + level |
| Pet upgrade costs | 寵物 | 1910677696 | season + level |
| Season score | 賽季分數 | 1012321192 | season |
| Dungeons | 副本 | 2044399102 | season + dungeon |
| Resources | 資源 | 751788076 | season + type + resource |
| Gifts | 禮物 | 547650001 | level |
| World Rally rules | 世界集會規則 | 1438213065 | season |
| Shared game settings | 遊戲設定 | 107367349 | key + season |

`src/services/sheetRegistry.js` records integration metadata, required headers, aliases, and canonical keys. It contains no game values. `src/services/dataService.js` validates headers and reads public CSV exports lazily by feature.

Existing non-empty Google values and formulas always win. Blank canonical fields may be completed from verified source material. The `伺服器時間`, `等級回覆`, and `資源紀錄` sheets are append-only observations/history and must not be replaced by derived data.

## Cache and offline behavior

Successful Google CSV responses are cached in `localStorage` as an ephemeral browser cache. A cached response renders immediately while a background refresh runs. If refresh fails, the application shows a stale/offline status. With no Google response and no previous cache, affected calculations remain unavailable; the application never substitutes bundled or invented game values.

Reload the page to refresh all active feature data. Code can explicitly refresh an individual sheet with `refreshSheet(sheetKey)`.

## Updating data

1. Edit or append the canonical row in the appropriate Google sheet.
2. Preserve the documented canonical key, header spelling, formulas, validation, notes, and formatting.
3. For servers, submit the Google Form or add a row to `伺服器`. The Apps Script in `scripts/sync-servers.gs` normalizes valid form submissions into blank canonical fields without overwriting existing non-empty values.
4. Reload the site and confirm the shared data status reports current Google data.

Production CSV/JSON datasets must not be committed to Git. UI translations, icons/images, CSS tokens, and small inline test fixtures are not production game datasets and remain in the repository.

## Development

```bash
npm install
npm test
npm run build
npm run dev
```

The application remains a static Vite site compatible with GitHub Pages and the custom production domain. Query routes use `/?tool=progression`, `fragment`, `gift`, `world-rally`, or `contribution`.
