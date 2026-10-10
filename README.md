# Studio Dashboard: a Game Dev Tycoon mod

Finance tracking, charts, per-game profitability and franchise (sequel) tracking for
[Game Dev Tycoon](https://www.greenheartgames.com/app/game-dev-tycoon/).

Work in progress.

## Repository layout

| Path       | What it is                                                                |
| ---------- | ------------------------------------------------------------------------- |
| `mod/`     | The mod itself. This folder is what gets installed or uploaded.           |
| `test/`    | Unit tests (Node's built-in test runner) for the mod's game-free logic.   |
| `scripts/` | Dev helpers: link the mod into the game, launch with DevTools, drive CDP. |

## Development

```bash
npm install
npm run check      # lint + format check + tests
npm run link       # symlink mod/ into the game's mods folder
```

The Modding Agreement forbids redistributing any game code or assets, so this repo
contains only original code.
