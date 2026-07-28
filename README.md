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

## Application architecture

The frontend is one persistent application workspace rather than a long calculator page:

- `src/app/shell.js` mounts the desktop sidebar, mobile header and bottom navigation, top bar, global player context, feature header, and active workspace.
- `src/shared/components.js` provides native-JavaScript navigation, tabs, empty states, transfer notices, and common element helpers without importing game calculations.
- `src/app/router.js` owns the five canonical query routes: `primordial`, `equipment`, `gift`, `world-rally`, and `contribution`. Legacy `progression` and `fragment` values map to `primordial` and `equipment`; invalid values fall back to `primordial`.
- `src/app/store.js` owns season, player number, parsed server context, language, theme, active tool, and global data status. Feature-specific inputs remain in feature state.
- `src/styles/index.css` is the only stylesheet entry imported by JavaScript. It loads Tailwind, tokens, base rules, layout, shared components, feature styles, and dark-theme overrides.

Primordial planning has three independently usable layouts:

1. Primordial target recommendations.
2. Character experience, with its own editable target level.
3. Complete resource requirements and shortage results.

Transfer actions copy target values into the destination layout without clearing current levels or owned-resource inputs. Internal tab state is persisted independently from the active query route.

Desktop navigation uses an approximately 272px fantasy sidebar. Tablet navigation removes the sidebar, and mobile uses five bottom navigation items plus a collapsible global-context card. The main workspace is capped at 1500px and uses one page scroll; ordinary cards do not create nested vertical scrolling.

### MVC and feature extension

- Models contain pure calculations and state transforms.
- Views render DOM/ViewModels and emit events.
- Controllers coordinate state, models, services, feature tabs, and transfer actions.
- Services own Google Sheets, cache, storage, and form submission.

To add a feature, register its canonical route, add one shell navigation entry, create a feature-owned controller/model/view, and add a scoped stylesheet under `src/styles/features/`. Do not add another top-level HTML application or put new fields into the global store unless they genuinely affect multiple features.

The shell renders before feature data settles. Each active feature loads independently and can show its own skeleton, cached-data notice, unavailable state, or targeted retry without hiding the shell. A failed Google request never activates a permanent full-screen overlay.
## Development

```bash

npm install
npm test
npm run build
npm run dev
```

The application remains a static Vite site compatible with GitHub Pages and the custom production domain. Canonical query routes are:

`/?tool=primordial`, `/?tool=equipment`, `/?tool=gift`, `/?tool=world-rally`, and `/?tool=contribution`.

Browser back/forward and in-app tool changes use the History API without reloading the page.

## Approved fantasy visual system

The production interface uses one pastel fantasy design system across all five features. Its canonical tokens live in `src/styles/tokens.css`: dreamy lavender and pink primary surfaces, sky-blue and warm-gold accents, translucent white cards, 44px controls, 16–22px radii, and restrained layered shadows. `src/styles/themes.css` provides the coordinated deep-plum dark mode; `src/styles/fantasy.css` is the final presentation layer for the shared shell, navigation, context panel, tabs, controls, cards, fantasy motifs, and responsive behavior.

The persistent shell contains the desktop sidebar, mobile header, top bar, five-section global context, data status, feature tabs, workspace, and mobile bottom navigation. At desktop widths, the Primordial resource calculator uses equipment/skill in Row 1, a full-width pet card in Row 2, and materials/cart/results as equal-height cards in Row 3. Tablet layouts reduce columns where controls need room; below 768px all six cards retain that sequence in one column.

Extend the interface through `src/shared/components.js`, the shell helpers in `src/app/shell.js`, and a feature-scoped stylesheet in `src/styles/features/`. Shared components must remain calculation-free, and feature code must continue to use Google Sheets through the existing service registry as the only production data source.

Development is Vite-only:

```bash
npm run dev
```

Do not use VS Code Live Server. `index.html` loads `/src/main.js` as its module entry, and `src/main.js` imports `./styles/index.css`. Never load a CSS file with a module-script tag or add a second stylesheet entrypoint.
