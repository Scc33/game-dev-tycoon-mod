// Studio Dashboard: per-game numbers derived from the game's own records
// (company.gameLog), so they cover the whole save, not just the weeks since install.
((SD) => {
	const G = (SD.games = {});

	const genreName = (game) =>
		[game.genre && game.genre.name, game.secondGenre && game.secondGenre.name].filter(Boolean).join('-');

	G.stats = (game) => {
		const flags = game.flags || {};
		const revenue = game.revenue || 0;
		const costs = game.costs || 0;
		const weekly = game.salesCashLog || [];
		let cumulative = 0;
		let peak = 0;
		let breakEvenWeeks = null;
		weekly.forEach((cash, i) => {
			cumulative += cash;
			peak = Math.max(peak, cash);
			if (breakEvenWeeks === null && costs > 0 && cumulative >= costs) breakEvenWeeks = i + 1;
		});
		return {
			id: game.id,
			title: game.title,
			releaseWeek: game.releaseWeek,
			score: game.score || 0,
			revenue,
			costs,
			profit: revenue - costs,
			roi: costs > 0 ? (revenue - costs) / costs : null,
			units: game.unitsSold || 0,
			weekly,
			peakWeek: peak,
			breakEvenWeeks,
			topRank: game.topSalesRank > 0 ? game.topSalesRank : null,
			fans: game.fansChanged || 0,
			isPack: !!flags.isExtensionPack,
			isMMO: !!flags.mmo,
			isPublished: !!flags.royaltyRate, // made under a publishing deal
			onSale: !game.soldOut,
			sequelTo: game.sequelTo || null,
			genre: genreName(game),
			topic: game.topic ? game.topic.name : '',
			platforms: (game.platforms || []).map((p) => p.name),
			size: game.gameSize,
			engine: game.engine ? game.engine.name : null,
			engineTech: game.engine ? game.engine.techLevel : null,
			tooClose: !!flags.sequelsTooClose,
			sameEngine: !!flags.usesSameEngineAsSequel,
			betterEngine: !!flags.hasBetterEngineThanSequel,
		};
	};

	G.all = (company) => (company.gameLog || []).map(G.stats);

	// Game sales income per month across the whole save, rebuilt from each game's weekly
	// sales log (one entry per week on sale, starting the week after release).
	G.salesByMonth = (company) => {
		const months = {};
		let first = Infinity;
		let last = -Infinity;
		(company.gameLog || []).forEach((game) => {
			(game.salesCashLog || []).forEach((cash, i) => {
				const m = SD.monthIndex(game.releaseWeek + 1 + i);
				months[m] = (months[m] || 0) + cash;
				first = Math.min(first, m);
				last = Math.max(last, m);
			});
		});
		if (first === Infinity) return [];
		const rows = [];
		const end = Math.max(last, SD.monthIndex(company.currentWeek));
		for (let m = first; m <= end; m++) rows.push({ month: m, sales: months[m] || 0 });
		return rows;
	};

	// Studio-wide totals. Expansion packs are left out: the game folds pack sales into the
	// base game, so a pack on its own only shows costs.
	G.summary = (company) => {
		const games = G.all(company).filter((g) => !g.isPack);
		const scored = games.filter((g) => g.score > 0);
		const sum = (list, key) => list.reduce((s, g) => s + g[key], 0);
		return {
			released: games.length,
			revenue: sum(games, 'revenue'),
			costs: sum(games, 'costs'),
			profit: sum(games, 'profit'),
			avgScore: scored.length ? sum(scored, 'score') / scored.length : null,
			best: games.reduce((best, g) => (!best || g.profit > best.profit ? g : best), null),
		};
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
