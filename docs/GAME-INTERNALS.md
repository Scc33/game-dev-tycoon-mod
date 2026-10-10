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

## Development and release flow

- A finished game waits for the player: the **Finish** button (`#releaseButton`) appears once the
  game is ready, and a "… is ready!" decision then offers Release Game or Trash Game. Until then
  the game sits in its finishing phase indefinitely, slowly **losing hype** (a point at a time)
  while monthly costs keep coming.
- Picking a sequel fills in the predecessor's genre, topic, audience and size before the concept
  window opens. The concept is only valid if the studio owns the topic.
- Time does not advance while a modal window is open, so a `weekProceeded` handler never sees a
  half-finished concept.
- The game autosaves (slot `auto`) after a release, a finished research, training or engine, and
  when the window closes.
- A save writes the game data with `DataStore.saveToSlotAsync(slot, json, done)` and then, in
  `done`, a small header for the load menu (name, cash, fans, week, mods, date) with
  `DataStore.setValue(slot, json)`. Level restarts use slots like `2L1`.
- Game speed is `GameManager._timeModifier` (1 = normal; the settings use 0.5, 1 and 2.5, and
  debug builds also allow 10 and 100).
- Sudden wealth triggers the "New Office?" decision; running out of money triggers bank offers and
  then bankruptcy, which ends the game.
- jQuery 1.7's `.click()` runs inline `onclick` handlers twice (once itself, once through the
  native click it triggers). Automation should call the element's own `click()` for buttons with
  side effects.

## Release order

Releasing a game runs, in order: `beforeReleaseGame`, the release week is set, the review
(`beforeGameReview` … `afterGameReview`), the sales calculation (`salesCalculated`), the game is
appended to `gameLog`, then `afterReleaseGame`.

## Hype

- Each game has `hypePoints`. Sources: marketing campaigns during development, game conferences,
  interviews and some random events, `company.flags.nextGameHypeBonus` (added when the next game is
  created), and `company.adjustHype(n)`, which adds to the game in development.
- A marketing campaign's hype grows with the campaign's strength and the genre/topic fit, is best
  run near 70% progress, and drops to 70% and then 30% when the same campaign is repeated.
- Sequels get +20% hype from each marketing campaign: +10% with the predecessor's engine, +24% with
  a better one. The code also has a negative branch for sequels released too soon, but that flag is
  only set at review time, after marketing has already happened, so in practice it never applies.
- Hype is only read once, when sales are calculated, and counts up to 500. With a review score of 5
  or more (8 or more if the player talked the game up in an interview), it adds reach worth up to 5%
  of the platform market, scaled by (score − 5) / 5. Below that score it _removes_ reach: a hyped
  flop sells worse than a quiet one.
- The status bar shows hype multiplied by development progress, so it appears to grow as the game
  is built.

## Review score

- The game's quality comes from its design and technology points relative to its size. It is
  scaled by a sum of percentage modifiers, by genre/topic, platform and audience fit, by bugs and
  by the current trend. Then it is divided by a moving "top score" target that rises each time the
  player sets a new best. Ten times that ratio, clamped to 1–10, is roughly the score. After that,
  streak protection, a technology cap for large and AAA games, and an early-years cap apply.
- The modifiers that matter for series:
  - −40% if the genre, second genre and topic match the _previous release_. This doesn't apply to
    expansion packs. A sequel released straight after its predecessor, with no other game in
    between, almost always takes this hit.
  - −40% for a sequel released within 40 weeks of its predecessor (`flags.sequelsTooClose`).
  - −10% when reusing the predecessor's engine (not for packs), or +20% for a better engine.
  - Smaller modifiers: ±10% golden ratio, up to +20% for good focus, −15% per neglected area.
- These modifiers are local to the review function, so a mod can't add to them.
  `beforeGameReview` fires before scoring; `afterGameReview` fires with the final `game.score` and
  the generated review cards. A mod that changes the score afterwards must also change the cards.

## Sales

- At release the game computes a lifetime revenue target once, as `game.totalSalesCash`, along with
  the lifetime fan change `game.fansChangeTarget` and the starting chart rank. Then it fires
  `salesCalculated`. Scaling `totalSalesCash` in that handler scales everything downstream: weekly
  payouts, units and revenue.
- Reach is made of three parts:
  - The platform market size, weighted per platform for multi-platform games and by game size
    (small ×1, medium ×2, large ×2.2, AAA ×2.5), times a score curve and the audience fit.
  - Hype, as described above.
  - Existing fans × score / 10. Fans count in full up to 1.5M, and at 10% beyond that.
- Units ≈ reach × score / 10, with up to 20% randomness. Unit prices by size are 7, 11, 14 and 18.
- With a publishing deal, reach is ×10, fans only count up to the size's target fan count, and the
  studio receives the royalty share of each payout.
- Each week pays out 20–40% of the remaining target (less for bigger games), and sales end when
  under about 1% remains. Sales events can add or remove up to 30%.
- Fan changes:
  - Score 7 or more: +5–10% of current fans.
  - Score 5 or more: also +0.5–1% of units sold.
  - Below 5, _or any sequel released too soon_: up to 25% × (1 − score/10) of fans are lost. So a
    rushed sequel loses fans even when it reviews well.
  - Fan changes are paid out alongside weekly sales.

## Decision events

- Events registered with `GDT.addEvent` sit alongside the game's own. Events whose
  `isRandomEvent` is false fire whenever `trigger(company)` returns true. Random events are drawn
  one at a time every 36–84 weeks from the eligible pool, and the same one is never drawn twice in
  a row.
- The official modAPI example sets `isRandom`, but the game reads `isRandomEvent`, so that example
  actually behaves as a non-random event.
- `maxTriggers` is enforced through `company.eventTriggerCounts`, which is saved.
- The game evaluates every event's `trigger` before building any notification, so two events can
  fire in the same pass. `{n}` in a notification's text splits it into screens; the options belong
  to the last one. A decision's buttons only respond once its text has finished typing out.
- `complete(decision)` gets the option index. Show a follow-up at once with
  `company.activeNotifications.addRange(new Notification({...}).split())`.
- The modAPI has no settings-tab API (`GDT.addEvent`, `addPlatform`, `addResearchItem`,
  `addTopics` and `getDataStore` are the whole surface besides events and loading).
- `game.flags` is saved as-is, but per-save mod state belongs in the data store.

## UI

- Right-click menus fire `ui.contextMenuShowing` with `{type, items}`; push `{label, icon, action}` to
  add an entry. Office menus have type `primary` or `secondary`.
- `UI.showModalContent(selector, {close: true, disableCheckForNotifications: true})` opens a window in
  the game's style, pauses the game, and resumes it on close. Without `disableCheckForNotifications`
  it waits for pending notifications, which do not appear while the player has paused.
- Hidden window templates live in `#resources`. Font Awesome 3 (`icon-*` classes) is available.
