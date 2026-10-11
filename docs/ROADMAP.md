# Roadmap

The long-term goal is the definitive Game Dev Tycoon mod: deeper systems, better information, and
more reasons to keep a studio going for decades, without breaking saves or the game's balance.

## Principles

- **Feature modules.** Each feature lives in its own folder with its own tests and can be switched
  off in the game's settings. Turning a feature off never breaks a save.
- **Information first, gameplay opt-in.** Read-only insight ships on by default. Anything that
  changes balance is clearly described and can be disabled.
- **Work with the game, not against it.** Hook documented events and wrap game functions rather
  than replacing them; record every hook in `docs/GAME-INTERNALS.md`.
- **No save baggage.** Per-save state goes through the mod data store. The mod isn't published, so
  data shapes change freely; no migrations until there are players to protect.
- **Tested and observable.** Pure logic is unit-tested; gameplay changes get in-game verification
  through the CDP scripts, plus a dashboard view of what the feature is doing.

## Phase 1: Studio Dashboard (done, v0.1)

Finance ledger, cash flow, per-game profitability and a read-only franchise view.

## Phase 2: Franchise gameplay (built, v0.2; in play testing)

Make series a real strategic choice instead of a naming convention. The proposed rules and numbers
are in [design/phase-2-franchises.md](design/phase-2-franchises.md). Candidate features:

- **Franchise reputation.** Each series builds brand value from review scores, sales and fans, and
  it fades while the series is dormant. New entries start with hype based on that reputation.
- **Fatigue.** Releasing entries too often, or several weak ones in a row, wears the audience out
  and lowers sales; time away and a strong entry recover it. This generalises the game's fixed
  40-week rule.
- **Spin-offs.** A sequel in a different genre or topic keeps part of the brand at lower risk of
  fatigue.
- **Remasters.** Re-release an old hit on newer platforms for a cheaper, smaller return that also
  refreshes the brand (Phase 2b).
- **Fan expectations.** Events where fans demand a sequel, react to a long silence, or celebrate an
  anniversary, with choices that trade money for reputation.
- **Dashboard support.** The Franchises tab shows reputation, fatigue and the expected hype for the
  next entry, so players can plan around the new systems.

Built: brand, fatigue, spin-offs, launch hype, sales effects, fan events, dashboard support and a
Settings tab. The numbers are being tuned through play testing (the Developer tab's cheats help).

## Phase 2b: Remasters (built, v0.3; in play testing)

A staff member brings an old hit back as a side project: port, remaster or remake, on today's
platforms, with nostalgia sales and a brand refresh for its series. Design and numbers:
[design/phase-2b-remasters.md](design/phase-2b-remasters.md).

## Later ideas (unordered)

- Rival studios that release competing games and react to your hits
- A yearly industry awards show
- Going public: share price, investors and dividends
- Platform market-share history charts and forecasts
- Staff morale, burnout and crunch
- Live-service games and paid DLC
- Achievements and long-term studio milestones
