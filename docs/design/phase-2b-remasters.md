# Phase 2b design: remasters

Status: **in progress (2026-10-11).** Numbers are first guesses for play testing. The mechanics are
based on the research in [GAME-INTERNALS.md](../GAME-INTERNALS.md).

## The idea

Old hits become assets. Once a game is a few years old, a staff member can bring it back as a
side project while the rest of the studio keeps making new games. The remaster ships on today's
platforms, sells to nostalgic fans and newcomers, and refreshes the series' brand. It is cheaper
and faster than a new game, and earns less.

## Goals

1. **A real choice, not free money.** The cost is a staff member taken off the main game for
   weeks, plus a budget. Which game, which tier, who works on it and when all matter.
2. **Reward a good back catalogue.** Great old games with loyal fans make the best remasters.
3. **Fit the franchise systems.** A remaster keeps a dormant series alive, can rebuild its brand
   before a sequel, and a botched one can hurt it.
4. **Feel like part of the game.** Start it from the staff member's right-click menu like
   research or training. Release it with reviews, a sales card and a first-week report, like any
   other game.
5. **Visible and tunable.** Every number lives in one table, and the dashboard shows the
   candidates, the project underway and how past remasters did.

## How it plays

1. When a game first becomes old enough to remaster, a one-off message tells the player what a
   remaster is and where to start one.
2. Right-click an idle staff member and choose **Remaster a game...** (in the garage this is the
   founder). It is hidden while a remaster is already underway or when there is nothing to
   remaster.
3. The **Remaster** window lists every eligible game with its score, age and nostalgia. The player
   picks a game, a tier and up to three licensed platforms (one without the Multi-platform
   research), and can edit the title. The window shows the budget, time, expected reviews and
   what the remaster will do to the series. Start is disabled without enough cash.
4. The staff member works on it like a training course: a progress bar over their head, and no
   part in the game in development until it is done.
5. On completion the remaster is released at once, with four reviews in a news message. It sells
   through the game's own sales system: a sales card, a first-week report, Game History, and the
   Games and Franchises tabs.

## Eligibility

| Rule      | Value                                                                    |
| --------- | ------------------------------------------------------------------------ |
| Age       | released at least 5 years (240 weeks) ago                                |
| Quality   | score 6 or better: fans have to remember it fondly                       |
| Kind      | not an expansion pack, MMO or remaster; each game can be remastered once |
| At a time | one remaster project per studio                                          |
| Staff     | any idle staff member, including the founder                             |

## Tiers

A size step is 1 for small, 2 medium, 3 large and 6 AAA, the game's own duration factors.
_Dating_ is how much standards have risen since the original came out: 0.15 per year, at most 3.

|        | Port                                 | Remaster              | Remake               |
| ------ | ------------------------------------ | --------------------- | -------------------- |
| Work   | 1.5 weeks × size step                | 3 weeks × size step   | 6 weeks × size step  |
| Budget | ½ month of running costs × size step | 1 month × size step   | 2 months × size step |
| Review | original − dating                    | original − ⅓ × dating | original + 0.5       |
| Title  | "X HD"                               | "X Remastered"        | "X Remake"           |

Running costs are the studio's monthly costs (office plus salaries), so budgets grow with the
studio and stay meaningful in every era. Each platform also adds its per-game development cost.
At week 400 a four-person studio pays about $60K a month: a medium remaster costs about $120K
plus platform costs and takes one person 6 weeks.

The review is also moved by:

- **Who does it:** (average of the person's design and technology skills − 0.5) × 1, so −0.5 to
  +0.5.
- **Luck:** ±0.5.

The result is clamped to 1–10 and turned into four review scores by the game's own reviewer
code, with some remaster-specific remarks mixed in ("Still holds up." or "A lazy cash grab.").

## Sales

The remaster's lifetime sales come from the game's own sales formula: today's market for the
chosen platforms, the original's size and audience, the studio's fans and the remaster's score.
There is no hype, because a remaster gets no marketing. That total is then scaled:

| Factor    | Formula                                                                  | Range       |
| --------- | ------------------------------------------------------------------------ | ----------- |
| Base      | 0.2: a re-release reaches a fraction of a new game's audience            |             |
| Nostalgia | × (1 + n), where n = (age in years − 5) / 10, clamped to 0–1             | ×1 to ×2    |
| Brand     | × (1 + 0.25 × brand / 100), as for sequels (when franchise sales are on) | ×1 to ×1.25 |

So a remaster earns 20–50% of what a new game with the same score would earn today. The fan
change from release is scaled the same way.

Examples, using the game's own sales formula without fans:

- A year-25 AAA remake of a 9.5 from year 8 (score 10, full nostalgia) earns about $40M × 0.4 =
  $16M, for about $2.4M and one person for 36 weeks.
- A year-8 small remaster of a 7 from year 2 earns about $60K plus its fans' share, for about
  $47K and three weeks.

## The franchise model

A remaster is a new kind of series entry, alongside mainline, spin-off and pack.

| Rule     | Value                                                                                 |
| -------- | ------------------------------------------------------------------------------------- |
| Brand    | brand = 0.7 × brand + 0.3 × q: a great remaster lifts the series, a weak one drags it |
| Dormancy | the series counts as active again: the 3-year dormancy clock restarts                 |
| Fatigue  | +10, so remastering everything isn't free                                             |

A standalone game that gets a remaster becomes a two-entry series on the Franchises tab.

Remasters stay out of the sequel rules:

- They can't be the base of a sequel and are hidden from the game's Develop Sequel picker; sequels
  continue from the series' latest new game.
- A remaster doesn't keep a promise of a new game made in a fan event.
- The 40-week rule still compares a sequel with its predecessor, not with a remaster.

## Fitting into the game

- **The work** is a training item the staff member carries out, registered on the game's
  `Training` object with `canUse` false so it never appears in the Train menu. Its `complete`
  releases the remaster. Its duration is set per project.
- **The release** builds a `Game` with the original's genres, topic, audience and size, the chosen
  platforms and the new title. It gets reviews from `Reviews.getReviews` and sales from
  `Sales.calculateSales`, which also fires `salesCalculated`. Then our scaling is applied and the
  remaster goes into `gameLog`.
- **Where in `gameLog`:** just before the latest new game, not at the end. Lots of the game's code
  reads the last entry as "our latest game": the "Another X/Y game?" review penalty, the review
  window, achievements and bank offers. A remaster released while a new game is in development
  must not give that new game a repeat-genre penalty. The only side effect is that Game History
  lists the remaster one place earlier.
- **Saved on the game itself:** `game.flags.sdRemaster = { of, tier, originalScore, staffId,
multiplier }`. The project underway lives in the mod's data store.
- **Cost:** paid at the start through `adjustCash` with the label "X remaster", which the ledger
  files under development. It is also recorded as the remaster's `costs`, so the Games tab shows
  its profit.

## Settings

| Setting   | Default | Effect when off                                                     |
| --------- | ------- | ------------------------------------------------------------------- |
| Remasters | on      | no menu entry or message; a project already underway still finishes |

## Dashboard

- **Remasters tab:** the project underway (who, progress, expected release), the eligible games
  ranked by appeal with the ones becoming eligible next, and every past remaster against its
  original (score, revenue, profit, brand change).
- **Games tab:** a Remaster badge.
- **Franchises tab:** remaster entries with a badge, and their effect on brand and fatigue.

## Limits

- Removing the mod while a remaster is underway breaks that save when the work finishes, because
  the game can no longer find the training item. Turning the setting off is safe.
- Firing the staff member abandons the remaster; the budget is not refunded.

## Build order (small commits)

1. This design and the research notes.
2. The pure model (eligibility, tiers, score, sales multiplier) with tests.
3. Remasters in `SD.games`, `SD.franchises` and the franchise model, with tests.
4. The project lifecycle: start, the training item, release; tested against stubs.
5. The Remaster window and right-click menu entry; the sequel picker filter.
6. The Remasters tab, badges, the discovery message and developer cheats.
7. Play test in the real game, then tune.
