// Studio Dashboard: groups sequels and expansion packs into franchises and works out
// when the next sequel can release without the game's "too soon" penalty.
((SD) => {
	const F = (SD.franchises = {});

	// Ids of games something already builds on. The game only allows a sequel to a game
	// with no follow-up yet, so series grow as chains.
	const followedUp = (games, company) => {
		const ids = {};
		games.forEach((g) => {
			if (g.sequelTo) ids[g.sequelTo] = true;
		});
		if (company.currentGame && company.currentGame.sequelTo) ids[company.currentGame.sequelTo] = true;
		return ids;
	};

	F.combo = (stats) => `${stats.genre}/${stats.topic}`;

	// The studio's most recent release. The game docks a big review penalty from any new
	// game (except an expansion pack) with the same genre and topic as this one.
	F.lastRelease = (company) => {
		const log = company.gameLog || [];
		return log.length ? SD.games.stats(log[log.length - 1]) : null;
	};

	const repeats = (stats, last) => !!last && !stats.isPack && F.combo(stats) === F.combo(last);

	// When a sequel to this game can release penalty-free, its engine (reusing the same
	// engine halves the sequel hype bonus; a higher-tech one raises it), and whether a
	// same-genre/topic sequel released next would repeat the studio's latest release.
	F.sequelAdvice = (stats, currentWeek, last = null) => {
		const safeFromWeek = stats.releaseWeek + SD.SEQUEL_GAP_WEEKS;
		return {
			basedOn: stats.title,
			safeFromWeek,
			weeksUntilSafe: Math.max(0, Math.ceil(safeFromWeek - currentWeek)),
			engine: stats.engine,
			engineTech: stats.engineTech,
			combo: F.combo(stats),
			repeatsLastRelease: !!last && F.combo(stats) === F.combo(last),
			lastRelease: last ? last.title : null,
		};
	};

	// Follow sequelTo (and remaster) links back to the original game. Entries are in release
	// order; a sequel in development is appended with inDevelopment = true.
	F.all = (company) => {
		const games = SD.games.all(company);
		const current = company.currentGame;
		if (current && current.sequelTo) games.push({ ...SD.games.stats(current), inDevelopment: true });

		const byId = {};
		games.forEach((g) => {
			byId[g.id] = g;
		});
		const parentOf = (g) => byId[g.sequelTo] || byId[g.remasterOf] || null;
		const rootOf = (g) => {
			const seen = {};
			while (parentOf(g) && !seen[g.id]) {
				seen[g.id] = true;
				g = parentOf(g);
			}
			return g;
		};
		const groups = {};
		games.forEach((g) => {
			const root = rootOf(g);
			(groups[root.id] = groups[root.id] || []).push(g);
		});
		const hasFollowUp = followedUp(games, company);
		const last = F.lastRelease(company);

		return Object.values(groups)
			.filter((entries) => entries.length > 1)
			.map((entries) => describe(entries, byId, hasFollowUp, company.currentWeek, last))
			.sort((a, b) => b.revenue - a.revenue);
	};

	const describe = (entries, byId, hasFollowUp, currentWeek, last) => {
		entries.sort((a, b) => !!a.inDevelopment - !!b.inDevelopment || a.releaseWeek - b.releaseWeek);
		const withGaps = entries.map((e) => {
			const prev = e.sequelTo ? byId[e.sequelTo] : null;
			const original = e.remasterOf ? byId[e.remasterOf] : null;
			return {
				...e,
				predecessor: prev ? prev.title : null,
				original: original ? original.title : null,
				gapWeeks: prev && !e.inDevelopment ? e.releaseWeek - prev.releaseWeek : null,
				repeatsLastRelease: !!e.inDevelopment && repeats(e, last),
			};
		});
		const released = withGaps.filter((e) => !e.inDevelopment);
		// Remasters count towards the series' money, but its scores and its next sequel come
		// from the new games.
		const scored = released.filter((e) => e.score > 0 && !e.isPack && !e.isRemaster);
		const sum = (key) => released.reduce((s, e) => s + e[key], 0);
		const tail = released.filter((e) => !hasFollowUp[e.id] && !e.isRemaster).pop() || null;
		return {
			id: withGaps[0].id,
			name: withGaps[0].title,
			entries: withGaps,
			revenue: sum('revenue'),
			costs: sum('costs'),
			profit: sum('profit'),
			avgScore: scored.length ? scored.reduce((s, e) => s + e.score, 0) / scored.length : null,
			scores: scored.map((e) => e.score),
			scoreTrend: scored.length > 1 ? scored[scored.length - 1].score - scored[0].score : null,
			inDevelopment: withGaps.some((e) => e.inDevelopment),
			next: tail ? F.sequelAdvice(tail, currentWeek, last) : null,
		};
	};

	// Standalone hits that would make good sequel material: reviewed well, made money,
	// and nothing builds on them yet.
	F.candidates = (company, limit = 5) => {
		const games = SD.games.all(company);
		const hasFollowUp = followedUp(games, company);
		const last = F.lastRelease(company);
		return games
			.filter((g) => !g.isPack && !g.isRemaster && !g.sequelTo && !hasFollowUp[g.id] && g.score >= 7 && g.profit > 0)
			.sort((a, b) => b.score - a.score || b.revenue - a.revenue)
			.slice(0, limit)
			.map((g) => ({ ...g, next: F.sequelAdvice(g, company.currentWeek, last) }));
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
