# Architecture

Studio Dashboard is plain JavaScript that runs inside the game's NW.js 0.49 page (Chromium 86), with
no build step: the files under `mod/` are exactly what ships.

## Modules

Everything hangs off one global namespace, `StudioDashboard` (`SD` inside each file).

| File                   | Namespace                 | Role                                                                | Game access           |
| ---------------------- | ------------------------- | ------------------------------------------------------------------- | --------------------- |
| `main.js`              | `SD.path`, `SD.assetPath` | Entry point: resolves paths, loads CSS and scripts, installs hooks  | `GDT`                 |
| `src/core.js`          | `SD`, `SD.fmt`            | Constants, calendar maths, formatting, mod data store access        | `GDT.getDataStore`    |
| `src/classify.js`      | `SD.classify`             | Cash label → category rules (ordered, extensible)                   | reads name lists      |
| `src/ledger.js`        | `SD.ledger`               | Captures cash movements, monthly aggregation, weekly reconciliation | `company.cashLog`     |
| `src/games.js`         | `SD.games`                | Per-game stats and sales history from `company.gameLog`             | none (pure)           |
| `src/franchises.js`    | `SD.franchises`           | Series grouping, release gaps, sequel advice and candidates         | none (pure)           |
| `src/charts.js`        | `SD.charts`               | SVG column, line and sparkline charts with tooltips                 | none                  |
| `src/ui/dom.js`        | `SD.dom`                  | Safe DOM components: tiles, tables, cards, legends, bar lists       | `Sound`               |
| `src/ui/dashboard.js`  | `SD.dashboard`            | The window, tab bar and per-tab state                               | `UI.showModalContent` |
| `src/tabs/*.js`        | `SD.tabs.<id>`            | One tab each; only composes the modules above                       | none                  |
| `src/hooks.js`         | `SD.hooks`                | Subscribes to game events and adds the context-menu entry           | `GDT.on`              |
| `src/features/<name>/` | `SD.<name>`               | A gameplay feature: its pure rules, settings and game hooks         | per feature           |

Logic modules never touch the DOM, and tabs never touch game internals directly, so the logic is unit
tested in Node (`test/`) and the UI stays a thin layer.

Gameplay features live in their own folder under `src/features/`, with tests under
`test/features/`. Each keeps its rules in a pure `model.js` with every balance number in one
`TUNING` table, and only its hooks file talks to the game. The franchise feature is
`SD.franchise` (brand, fatigue and their effects); `SD.franchises` is the read-only series
grouping the dashboard and the feature both build on. The remaster feature is `SD.remaster`: its
`model.js` holds the rules, `project.js` runs a remaster from start to release, `window.js` is the
Remaster window and `feature.js` holds the game hooks. Its stylesheet is `css/remaster.css`.
Features register themselves on `SD.features`, and `SD.hooks.install()` installs each one, so a
failing feature can't take the dashboard down.

## Load order

`main.js` loads every script in **one** `GDT.loadJs` batch. A second batch would complete separately
and fire the game's `mod.loaded` event again, which advances the game's mod-loading queue before
later mods are ready. Scripts in a batch load in parallel, so:

- modules only reference each other at call time, never at load time;
- tabs register by key (`SD.tabs.games = {...}`) instead of calling a registry function that might
  not exist yet;
- `SD.hooks.install()` runs from the batch's ready callback, when everything is loaded.

## Data flow

```
company.cashLog.push({amount, label})        (every labelled cash movement in the game)
        │  intercepted by ledger.attach
        ▼
classify.classify(label) → [{cat, amount}]   ("monthly costs" splits into salaries + upkeep)
        ▼
ledger state (save's modData)  months[m][cat] = [income, expenses]
                               recent  = last 250 transactions
gameplay.weekProceeded  ──►    reconcile: book unexplained cash change as "Untracked change"
                               snaps   = weekly [week, cash, fans]
```

Game history (`company.gameLog`) is read directly whenever a tab renders; nothing is copied.

## Persisted state

Stored per save through `GDT.getDataStore('scc33-studio-dashboard').data`:

```js
{
  v: 1,          // schema version
  since: 23.4,   // first week observed; earlier history is unknown
  lastCash: 0,   // balance at the last weekly reconciliation
  pend: 0,       // movements recorded since then
  months: { [monthIndex]: { [category]: [income, expenses] } },
  recent: [[week, amount, label, category], ...],   // capped at 250
  snaps:  [[week, cash, fans], ...]                 // one per week
}
```

Size grows by roughly one snapshot per week plus one month bucket per month, a few tens of KB over
a full game. Bump `SD.SCHEMA` and migrate in `ledger.state` if the shape changes.

## Testing

- `npm test` runs `test/**/*.test.js` with Node's built-in runner. `test/helpers/load-mod.js` runs mod
  files as classic scripts in a `vm` sandbox, the same way the game loads them, with stubbed game
  globals. Objects from the sandbox have their own prototypes, so compare them through `plain()`.
- In-game behaviour is checked with the CDP scripts (`scripts/reload.mjs`, `scripts/screenshots.mjs`)
  against a real save or the demo studio.
