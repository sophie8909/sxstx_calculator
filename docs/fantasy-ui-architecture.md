# Fantasy UI architecture

## Visual contract

The application follows the approved anniversary-castle direction: lavender, pink, sky blue, cream, warm gold, translucent white surfaces, soft gradients, rounded cards, pill controls, and restrained sparkles/crystal/castle motifs. The system avoids character artwork and implements decoration with CSS and original inline SVG paths.

- `tokens.css` owns light palette, spacing, radii, control height, shadows, and compatibility aliases.
- `themes.css` owns the coordinated deep-plum dark fantasy palette.
- `fantasy.css` is the final shared presentation layer and overrides legacy utility styling without changing calculator field IDs or event hooks.
- `features/*.css` owns layout details unique to Primordial, equipment, gift, World Rally, and contribution.

## Persistent application shell

`src/app/shell.js` mounts one shell around the existing feature DOM:

1. Desktop sidebar or mobile header.
2. Sticky top bar with language and theme pills.
3. Global context for season, player number, server, realm/world, and data status.
4. Internal feature tabs and active feature content.
5. Mobile bottom navigation.

The five query routes are `primordial`, `equipment`, `gift`, `world-rally`, and `contribution`. `progression` and `fragment` remain supported aliases. History navigation is owned by `src/app/router.js`.

## Primordial resource layout

At 1280px and above:

- Row 1: equipment and skill, equal width and height.
- Row 2: pet, full width.
- Row 3: current materials, cart production, and results using `1.15fr / minmax(280px, .9fr) / minmax(300px, 1fr)` and equal-height stretch.

Tablet collapses Row 1 and lets Row 3 use two columns with results full width. Below 768px the cards stack equipment, skill, pet, materials, cart, results.

## Data and behavior boundaries

Google Sheets remains the only canonical production game-data source. The visual layer does not introduce local production datasets, calculation logic, or feature state. Player/server synchronization preserves the seven-digit server prefix and five-digit player suffix, retains leading zeroes, represents unknown valid servers, and never fabricates a `00000` suffix.

## Development and extension

Run `npm run dev`, `npm test`, and `npm run build`. Do not use VS Code Live Server. HTML loads `/src/main.js`; JavaScript imports `./styles/index.css`; CSS is never loaded as a module script.

New shared controls belong in `src/shared/components.js` and must remain calculation-free. New feature-specific rendering belongs in the feature MVC folder with styles under `src/styles/features/`.
