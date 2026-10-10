# Phase 2 design: franchise gameplay

Status: **approved 2026-10-10, in progress.** Numbers are first guesses for play testing. Mechanics are
based on the research in [GAME-INTERNALS.md](../GAME-INTERNALS.md).

## What the base game does today

A sequel gets only two benefits: +20% hype from each marketing campaign and +20% review quality
for a better engine. Releasing within 40 weeks of its predecessor costs −40% review quality and
turns fan growth into fan loss. There is no lasting value in a series: a sequel to a 10/10 classic
sells like any new game with the same marketing.

There's also an unannounced trap. Making a sequel straight after its predecessor, with no other
game in between, triggers the "Another X/Y game?" −40% penalty, because the genre and topic match
the previous release.

## Goals

1. Strong series build lasting value that pays off in later entries.
2. Milking a series, with releases too often or several weak entries, wears it out. A good cadence
   or a great entry keeps it healthy.
3. Spin-offs are a lower-risk way to use a brand.
4. Everything shows in the Franchises tab, so players can plan around it.
5. Pure, testable rules. Save-safe. Every feature can be switched off per save.

## The model

Each series (a chain of `sequelTo` links, MMO expansion packs excluded) has two values from 0 to
100: **brand** and **fatigue**. Both are recalculated from the series' release history (scores
and release weeks) plus any fan-event adjustments. Nothing accumulates in hidden state, so old
saves get sensible values from their existing history, and removing the mod leaves nothing
behind.

An entry is a **spin-off** if its genre or topic differs from its predecessor's.

### Brand

| Rule                 | Value                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| Entry quality _q_    | (score − 4) / 6, clamped to 0–100%: 10 → 100, 8.5 → 75, 7 → 50, ≤4 → 0 |
| First entry          | brand = 0.75 × q (one hit isn't a franchise yet)                       |
| Later mainline entry | brand = ½ × brand + ½ × q                                              |
| Spin-off             | brand = 0.7 × brand + 0.3 × q (a weak spin-off hurts less)             |
| Dormancy             | after 3 years with no entry, −1 per month, down to half its last value |

### Fatigue

| Rule                    | Value                                                            |
| ----------------------- | ---------------------------------------------------------------- |
| Mainline entry          | +40                                                              |
| Spin-off                | +20                                                              |
| Weak entry (score < 6)  | an extra +20                                                     |
| Great entry (score ≥ 9) | −20                                                              |
| Recovery                | −2.5 per month, so one entry's fatigue clears in about 16 months |

### Effects on a new entry

Values are taken at the time each effect applies. Fatigue only counts earlier entries.

| Effect                                                                                   | Formula                                                                                 | Range                                 |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------- |
| **Launch hype**, added once when the sequel's concept is set and shown in the status bar | 2 × brand × (1 − fatigue/100), ×0.6 for a spin-off                                      | 0 to +200 (the game counts up to 500) |
| **Lifetime sales**, applied to `totalSalesCash` in `salesCalculated`                     | (1 + 0.25 × brand/100) × (1 − 0.5 × fatigue/100); the brand part is ×0.6 for a spin-off | ×0.5 to ×1.25                         |
| **Fan gain**, applied to a positive `fansChangeTarget`                                   | the same multiplier as sales                                                            | fan losses unchanged                  |

The base game's rules stay as they are: the 40-week penalty, the engine modifiers and the "hyped
flop" effect. Brand hype therefore raises the stakes. A beloved series that ships a game scoring
under 5 sells _worse_, because the game turns hype into lost reach below that score.

### Simulated series

These come from the formulas above, with brand and fatigue measured just before each release.

| Scenario                                                 | Entry 2          | Entry 3     | Entry 4     | Entry 6    |
| -------------------------------------------------------- | ---------------- | ----------- | ----------- | ---------- |
| Healthy: scores 8.5, 9, 8.5, 8.5, every 60 weeks         | +110 hype, ×1.13 | +140, ×1.17 | +141, ×1.17 | —          |
| Yearly release, all 8.0, every 48 weeks                  | +90, ×1.07       | +93, ×1.03  | +87, ×0.98  | +66, ×0.87 |
| Weak streak: 8, 5.5, 5.5, 8, every 52 weeks              | +92, ×1.08       | +49, ×0.90  | +23, ×0.74  | —          |
| Revival: 9, 9, then 8 years later an 8                   | +125, ×1.16      | +73, ×1.09  | —           | —          |
| Spin-off between two mainline entries (9, spin-off 8, 9) | +75, ×1.09       | +128, ×1.16 | —           | —          |

In practice: release roughly every 15 months or more, keep scores up, and use spin-offs to stay
in the market between mainline entries.

## Fan events

These are non-random events (`GDT.addEvent`) with our own triggers. At most one franchise event
fires per year, so they stay occasional.

| Event                   | Trigger                                                                       | Choices                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fans want more**      | latest entry scored ≥ 8.5, released 6–24 months ago, no sequel in development | _Tease a sequel_: the next entry gets +50 hype, but brand −5 if none ships within 2 years. _No comment_: nothing happens.                                 |
| **Anniversary**         | 10 years since the series began, brand ≥ 40                                   | _Celebrate_ (costs 2% of the series' lifetime revenue): brand +10, fans +2%. _Let it pass_: nothing happens.                                              |
| **Where's the sequel?** | brand ≥ 60, no entry for 4 years                                              | _Promise a return_: the next entry gets +100 hype and dormancy fade pauses for 2 years; breaking the promise costs brand −15. _Move on_: nothing happens. |

## Settings

The modAPI has no settings API, so a **Settings** tab in the dashboard toggles each feature
(brand and hype, sales effects, fatigue, fan events) **per save**. The settings are stored with
the save's mod data. Turning a feature off stops future effects; anything already applied stays.

## Hooks

| Moment             | Hook                                                                                | Action                                                                             |
| ------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Sequel concept set | `weekProceeded`: the game in development has `sequelTo` and isn't in our record yet | Add launch hype, record it, show a short notification ("Fans of X are excited…")   |
| Release            | `salesCalculated`                                                                   | Multiply `totalSalesCash` and a positive `fansChangeTarget`; record the multiplier |
| Weekly             | `weekProceeded`                                                                     | Check fan-event triggers and expire broken promises                                |

## Save data

```js
modData['scc33-studio-dashboard'].franchise = {
  v: 1,
  settings: { hype: true, sales: true, fatigue: true, events: true },
  applied: { [gameId]: { kind: 'sequel' | 'spinoff', hype, sales, brand, fatigue } },
  events: [{ week, seriesId, type, brand, hype, dueWeek }],
};
```

`applied` makes every effect idempotent (each one is applied once) and lets the dashboard show
what each entry received.

## Dashboard

The Franchises tab adds, for each series:

- brand and fatigue tiles with a label (Unknown, Known, Popular, Beloved, Legendary);
- a brand-over-time line;
- per-entry hype and sales effects in the entries table;
- a forecast for the next entry: hype, sales multiplier, safe-from week;
- a warning when the previous release has the same genre and topic.

## Build order (small commits)

1. Information only: the same-genre/topic warning in the sequel advice.
2. Pure model (`franchise/model.js`): brand, fatigue and effects, with the scenarios above as tests.
3. Settings tab and per-save settings store.
4. Launch hype hook and notification.
5. Sales and fans hook.
6. Franchises tab: tiles, forecast, per-entry effects.
7. Fan events.
8. Phase 2b: remasters. They need a new option in the game-creation screen, so they get their own
   research pass.

## Decisions

1. Gameplay features are **on by default**, for new and existing saves; each can be switched off
   per save.
2. Strengths will be tuned by play testing. Every constant lives in one tuning table in the model.
3. Fatigue sits on top of the 40-week penalty for now; whether it should replace it will be
   decided after play testing.
