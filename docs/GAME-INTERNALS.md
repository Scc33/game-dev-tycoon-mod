# Game internals notes

Things learned about Game Dev Tycoon (Steam, v1.8.7, NW.js 0.49) while building this mod. These are
observations in our own words; no game code is reproduced. The game's code ships as
`compressed/codeNw.js` and the official wiki suggests reading it through a beautifier when modding.

## Runtime

- NW.js 0.49.0 (Chromium 86.0.4240.75, Node 14.12). ES2020 syntax is safe.
- On macOS the binary is x86_64 and runs under Rosetta on Apple Silicon.
- The page is `defaultBrowser.html`, served from a `chrome-extension://` origin. Over remote
  debugging it appears as target type `app`, not `page`.
- The game replaces `Number.prototype.toLocaleString` with a version that always prints two decimals.
  Format numbers yourself or with `Intl.NumberFormat`.

## Mod loading

- Mods live in `mods/` (manual) and `mods_ws/` (Steam Workshop, synced on every launch from the
  player's subscriptions; unsubscribed items are deleted). Symlinked mod folders work.
- Enabled mods are a JSON list in the game's settings. On Steam, settings only persist after
  `DataStore.commit()`; the Mods screen does this when it closes.
- `GDT.loadJs` fires the `mod.loaded` event whenever its count of pending scripts reaches zero, and the
  game uses that event to load the next mod. Load all of a mod's scripts in one batch.
- `GDT.getRelativePath()` only works while a script is executing (it uses `document.currentScript`)
  and returns `/chrome-extension://...`: fine for `GDT.loadJs`, broken for `<img>`/`<link>` URLs.
  `GDT.makeRelativeModPath()` turns it into a page-relative `./mods/<folder>` path.
- Saves record the active mods, but the list is written after the save data is serialised, so it
  lags one save behind. Loading a save whose mod list differs shows a "mod mismatch" prompt.

## Persistence

- `GDT.getDataStore(id).data` is written into each save under `modData[id]`. On load the modAPI only
  replaces `data` when the save contains an entry for that id, so reset it yourself on
  `saves.loading` if the entry is missing, or data from the previously loaded game leaks in.
- `saves.newGame` fires after the first week has already been processed, so a `weekProceeded`
  handler sees the new company before `newGame` does.

## Money

- Every labelled cash change is pushed onto `company.cashLog` as `{amount, label}`. The UI drains that
  array each frame to show the floating "+12K" popups and then empties it in place (the array object
  survives; it is replaced only when a save loads).
- A handful of changes use `adjustCash` without a label and never reach `cashLog`; reconcile against
  `company.cash` to account for them.
- Labels are localised. Useful ones: `"{0} sales"` (game or custom console), `"monthly costs"`
  (rent plus salaries, charged in week 1 of each month), `"Dev. stage {0}"`, `"{0} maintenance"`
  (MMOs), `"<platform> dev. license"`, `"<console> SDK"`, research and marketing item names, and the
  game title itself for the upfront development cost.
- Monthly costs: a base office cost by office level (×0.8 with solar panels) plus every staff salary.
- Per game: `costs` (includes monthly costs during development), `revenue` (cash actually received),
  `salesCashLog` (one entry per week on sale, starting the week after release), `unitsSold`,
  `topSalesRank`, `fansChanged`, `score`, `reviews`.

## Sequels and expansion packs

- `game.sequelTo` holds the id of the game it follows (for sequels and expansion packs alike). Only a
  game that nothing follows yet can get a sequel, so sequels form chains; an MMO can take several
  packs, but once it has one, further sequels build on the pack.
- Expansion packs exist only for MMOs still on sale. Their sales are folded into the base game, so a
  pack's own `revenue` stays at zero.
- A sequel released within 40 weeks of its predecessor gets `flags.sequelsTooClose`: a review score
  penalty and negative sequel hype.
- Reusing the predecessor's engine sets `flags.usesSameEngineAsSequel` (sequel hype bonus halved or
  penalty doubled); a higher-tech engine sets `flags.hasBetterEngineThanSequel` (bonus ×1.2, penalty
  turned positive).

## UI

- Right-click menus fire `ui.contextMenuShowing` with `{type, items}`; push `{label, icon, action}` to
  add an entry. Office menus have type `primary` or `secondary`.
- `UI.showModalContent(selector, {close: true, disableCheckForNotifications: true})` opens a window in
  the game's style, pauses the game, and resumes it on close. Without `disableCheckForNotifications`
  it waits for pending notifications, which do not appear while the player has paused.
- Hidden window templates live in `#resources`. Font Awesome 3 (`icon-*` classes) is available.
