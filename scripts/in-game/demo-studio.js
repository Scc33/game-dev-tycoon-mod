// Loads a made-up studio with several years of history into the RUNNING game's memory, for
// UI testing and screenshots. Keep the game paused while it is loaded (the fake games are
// not complete enough for the simulation), never save, and reload the game to discard it.
//   node scripts/cdp.mjs evalfile scripts/in-game/demo-studio.js
(function () {
	const SD = window.StudioDashboard;
	const company = GameManager.company;
	GameManager.pause(true);

	// Deterministic pseudo-random numbers so screenshots are repeatable.
	let seed = 42;
	const rand = () => {
		seed = (seed * 16807) % 2147483647;
		return (seed - 1) / 2147483646;
	};

	const engines = [
		{ id: 'e1', name: 'Garage Engine', techLevel: 1 },
		{ id: 'e2', name: 'Pixel Forge', techLevel: 2 },
		{ id: 'e3', name: 'Pixel Forge 2', techLevel: 3 },
	];

	let n = 0;
	const game = (title, releaseWeek, score, costs, peak, opts = {}) => {
		const weeks = Math.round(8 + score * 2);
		const salesCashLog = [];
		for (let i = 0; i < weeks; i++)
			salesCashLog.push(Math.round(peak * Math.exp(-i / (weeks / 3)) * (0.85 + rand() * 0.3)));
		const revenue = salesCashLog.reduce((a, b) => a + b, 0);
		return {
			id: `demo-${++n}`,
			title,
			releaseWeek,
			score,
			costs,
			revenue,
			salesCashLog,
			unitsSold: Math.round(revenue / 12),
			topSalesRank: Math.max(1, Math.round(40 - score * 4)),
			fansChanged: Math.round(revenue / 400),
			soldOut: true,
			gameSize: opts.size || 'medium',
			genre: { name: opts.genre || 'Action' },
			topic: { name: opts.topic || 'Space' },
			platforms: [{ name: 'PC' }, { name: 'G64' }],
			engine: opts.engine || engines[0],
			sequelTo: opts.sequelTo || null,
			flags: opts.flags || {},
			// Fields the game's own code reads from released games.
			reviews: [1, 2, 3, 4].map(() => ({ score: Math.round(score), message: 'Demo review.', reviewerName: 'Demo' })),
			missionLog: [],
			featureLog: [],
			features: [],
			state: 4,
			targetAudience: 'everyone',
		};
	};

	const pals1 = game('Star Pals', 60, 8.1, 180000, 90000, { engine: engines[0] });
	const pals2 = game('Star Pals 2', 90, 6.4, 260000, 70000, {
		sequelTo: pals1.id,
		engine: engines[0],
		flags: { sequelsTooClose: true, usesSameEngineAsSequel: true },
	});
	const pals3 = game('Star Pals 3', 175, 9.2, 520000, 260000, {
		sequelTo: pals2.id,
		engine: engines[2],
		size: 'large',
		flags: { hasBetterEngineThanSequel: true },
	});
	const dq1 = game('Dungeon Quest', 110, 7.6, 220000, 110000, { genre: 'RPG', topic: 'Fantasy', engine: engines[1] });
	const dq2 = game('Dungeon Quest II', 200, 8.4, 400000, 190000, {
		genre: 'RPG',
		topic: 'Fantasy',
		sequelTo: dq1.id,
		engine: engines[2],
		flags: { hasBetterEngineThanSequel: true },
	});
	const extras = [
		game('Ninja Cats', 130, 9.0, 300000, 210000, { genre: 'Action', topic: 'Ninja', engine: engines[1] }),
		game('Tax Simulator', 150, 3.2, 150000, 20000, { genre: 'Simulation', topic: 'Business', engine: engines[1] }),
		game('Racing Moms', 160, 7.2, 240000, 95000, { genre: 'Casual', topic: 'Racing', engine: engines[2] }),
	];
	company.gameLog = company.gameLog.concat([pals1, pals2, dq1, ...extras, pals3, dq2]);
	company.engines = engines;
	company.currentWeek = 222.5;
	company.cash = 2450000;
	company.fans = 182000;

	// Ledger: 36 months of categorised history plus weekly cash snapshots.
	const months = {};
	const from = SD.monthIndex(company.currentWeek) - 35;
	const to = SD.monthIndex(company.currentWeek);
	let cash = 300000;
	const snaps = [];
	for (let m = from; m <= to; m++) {
		const t = (m - from) / 35;
		const sales = 120000 + 380000 * t * (0.7 + rand() * 0.6);
		const bucket = {
			sales: [sales, 0],
			salaries: [0, -(40000 + 90000 * t)],
			upkeep: [0, -32000],
			development: [0, -(60000 + rand() * 90000)],
			marketing: [0, rand() > 0.6 ? -150000 : -50000 * rand()],
			research: [0, -(20000 + rand() * 60000)],
		};
		if (rand() > 0.7) bucket.deals = [60000 + rand() * 90000, 0];
		if (m === from + 12) bucket.facilities = [0, -150000];
		if (rand() > 0.85) bucket.staff = [0, -30000];
		if (rand() > 0.8) bucket.licenses = [0, -100000];
		months[m] = bucket;
		const net = Object.values(bucket).reduce((s, [a, b]) => s + a + b, 0);
		for (let w = 0; w < 4; w++) {
			cash += net / 4 + (rand() - 0.5) * 20000;
			snaps.push([m * 4 + w, Math.round(cash), Math.round(1000 + 180000 * t)]);
		}
	}
	// Shift the made-up cash path so it ends at the company's actual balance.
	const offset = company.cash - snaps[snaps.length - 1][1];
	snaps.forEach((snap) => {
		snap[1] += offset;
	});
	const recent = [];
	for (let i = 0; i < 40; i++) {
		const week = company.currentWeek - i * 0.9;
		const picks = [
			[Math.round(30000 + rand() * 40000), 'Star Pals 3 sales', 'sales'],
			[-48000, 'Salaries', 'salaries'],
			[-32000, 'Office upkeep', 'upkeep'],
			[-50000, 'Advertise in magazines', 'marketing'],
			[-24000, 'Multiplayer', 'research'],
			[85000, 'contract payment', 'deals'],
		];
		const p = picks[Math.floor(rand() * picks.length)];
		recent.unshift([Math.round(week * 10) / 10, p[0], p[1], p[2]]);
	}
	SD.getStore().data = {
		v: SD.SCHEMA,
		since: from * 4,
		lastCash: company.cash,
		pend: 0,
		months,
		recent,
		snaps,
	};
	return `demo studio loaded: ${company.gameLog.length} games, ${Object.keys(months).length} months of ledger`;
})();
