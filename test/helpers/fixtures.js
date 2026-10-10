// Minimal stand-ins for the game's Game and Company objects, with only the fields the
// mod reads. Override anything per test.
let nextId = 1;

export function makeGame(overrides = {}) {
	const id = overrides.id || `game-${nextId++}`;
	return {
		id,
		title: `Game ${id}`,
		releaseWeek: 10,
		score: 7,
		revenue: 100000,
		costs: 40000,
		unitsSold: 10000,
		salesCashLog: [20000, 30000, 30000, 20000],
		topSalesRank: -1,
		fansChanged: 500,
		soldOut: true,
		gameSize: 'small',
		genre: { name: 'Action' },
		topic: { name: 'Space' },
		platforms: [{ name: 'PC' }],
		engine: { name: 'Engine 1', techLevel: 1 },
		flags: {},
		...overrides,
	};
}

export function makeCompany(games = [], overrides = {}) {
	return {
		currentWeek: 200,
		cash: 100000,
		fans: 1000,
		gameLog: games,
		currentGame: undefined,
		...overrides,
	};
}
