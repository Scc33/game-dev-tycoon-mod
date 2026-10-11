// Studio Dashboard remasters: a remaster from start to release. A staff member works on it
// like a training course (the game's own staff-activity system), and when the work is done
// the remaster is released through the game's own review and sales code.
// See docs/design/phase-2b-remasters.md.
((SD) => {
	const R = (SD.remaster = SD.remaster || {});
	const P = (R.project = {});

	P.TRAINING_ID = 'sdRemaster';
	P.FLAG = 'sdRemaster'; // game.flags key on a released remaster, read by SD.games
	const OPTION = 'remaster.enabled';

	SD.options = SD.options || {};
	SD.options[OPTION] = {
		group: 'Remasters',
		name: 'Remasters',
		description:
			'A staff member can bring a game from five or more years ago back as a port, remaster or remake, sold on today’s platforms.',
		default: true,
		order: 50,
	};

	// The review remarks a remaster can draw, alongside the game's own generic ones.
	const GOOD_REMARKS = [
		'A classic, lovingly restored.',
		'Still holds up after all these years.',
		'Better than I remembered!',
		'The definitive way to play it.',
		'Nostalgia done right.',
	];
	const BAD_REMARKS = [
		'A lazy cash grab.',
		'Some memories are best left alone.',
		"Nostalgia can't save this one.",
		'Should have stayed in the past.',
		'Barely touched since the original.',
	];

	const M = () => R.model;
	const T = () => R.model.TUNING;
	const tierName = (tier) => T().tiers[tier].name;
	const msPerWeek = () =>
		(typeof GameManager !== 'undefined' && GameManager.SECONDS_PER_WEEK ? GameManager.SECONDS_PER_WEEK : 4) * 1000;

	P.enabled = () => SD.settings.get(OPTION) !== false;

	const gameById = (company, id) => (company.gameLog || []).find((g) => g.id === id) || null;

	// The series a game belongs to, or a one-game series for a standalone game.
	P.series = (company, gameId) => {
		const found = SD.franchises.all(company).find((f) => f.entries.some((e) => e.id === gameId));
		if (found) return found;
		const game = gameById(company, gameId);
		return game ? { id: game.id, name: game.title, entries: [SD.games.stats(game)] } : null;
	};

	// The series' brand for remaster sales, or null when franchise sales effects are off.
	P.brand = (company, gameId) => {
		if (SD.settings.get('franchise.sales') === false || !SD.franchise || !SD.franchise.series) return null;
		const series = P.series(company, gameId);
		return series ? SD.franchise.series.state(series, company.currentWeek).brand : null;
	};

	// Every game that is or will be remasterable, with why not yet and its appeal.
	P.candidates = (company) => {
		const underway = {};
		R.store.projects().forEach((p) => {
			underway[p.originalId] = true;
		});
		return SD.games
			.all(company)
			.filter((g) => !g.isPack && !g.isRemaster)
			.map((g) => {
				const game = { ...g, remastered: g.remastered || !!underway[g.id] };
				const ageWeeks = company.currentWeek - g.releaseWeek;
				return {
					game,
					eligibility: M().eligibility(game, company.currentWeek),
					ageWeeks,
					nostalgia: M().nostalgia(ageWeeks),
					appeal: M().appeal(g.score, ageWeeks),
				};
			});
	};

	// Games that can be remastered now, most appealing first.
	P.eligible = (company) =>
		P.candidates(company)
			.filter((c) => c.eligibility.ok)
			.sort((a, b) => b.appeal - a.appeal);

	// Good games that only need to age a little more, soonest first.
	P.upcoming = (company) =>
		P.candidates(company)
			.filter((c) => c.eligibility.reason === 'age')
			.sort((a, b) => a.eligibility.fromWeek - b.eligibility.fromWeek);

	// Platforms on sale now that the studio holds a licence for, biggest market first.
	P.platforms = (company) => {
		const licensed = {};
		(company.licencedPlatforms || []).forEach((p) => {
			licensed[p.id] = true;
		});
		const share = (p) => Platforms.getTotalMarketSizePercent(p, company);
		return Platforms.getPlatformsOnMarket(company)
			.filter((p) => licensed[p.id])
			.sort((a, b) => share(b) - share(a));
	};

	P.maxPlatforms = (company) =>
		typeof company.canDevelopMultiPlatform === 'function' && company.canDevelopMultiPlatform() ? 3 : 1;

	// The numbers for one choice. `platforms` are platform objects, `staff` the person.
	P.plan = (company, { originalId, tier, staff, platforms = [] }) => {
		const original = gameById(company, originalId);
		return M().plan({
			original: {
				title: original.title,
				score: original.score,
				releaseWeek: original.releaseWeek,
				size: original.gameSize,
			},
			tier,
			staff,
			week: company.currentWeek,
			monthlyCosts: General.getMonthlyCosts(company),
			platformCosts: platforms.reduce((sum, p) => sum + (p.developmentCosts || 0), 0),
			brand: P.brand(company, originalId),
		});
	};

	P.busy = () => R.store.projects().length >= T().maxProjects;

	// Whether the right-click menu should offer a remaster to `staff`.
	P.canOffer = (company, staff) =>
		P.enabled() && !!staff && staff.canStartResearch() && !P.busy() && P.eligible(company).length > 0;

	// Starts a remaster. Throws with a player-readable message when the choice isn't valid.
	P.start = (company, { originalId, tier, staffId, platformIds = [], title }) => {
		const staff = (company.staff || []).find((s) => s.id === staffId);
		if (!staff || !staff.canStartResearch()) throw new Error('That person is busy.');
		if (P.busy()) throw new Error('A remaster is already underway.');
		if (!P.eligible(company).some((c) => c.game.id === originalId)) throw new Error('That game cannot be remastered.');
		if (!T().tiers[tier]) throw new Error(`Unknown kind of remaster: ${tier}`);
		const available = P.platforms(company);
		const platforms = platformIds.map((id) => available.find((p) => p.id === id)).filter(Boolean);
		if (!platforms.length || platforms.length !== platformIds.length) throw new Error('Pick at least one platform.');
		if (platforms.length > P.maxPlatforms(company)) throw new Error('Too many platforms.');
		const plan = P.plan(company, { originalId, tier, staff, platforms });
		if (company.cash < plan.budget) throw new Error('Not enough cash.');

		const name = (title || '').trim() || plan.title;
		// Put the person to work first: if the game refuses, nothing has been paid or recorded.
		const item = P.trainingItem();
		item.duration = plan.weeks * msPerWeek();
		GameManager.uiSettings.selectedChar = staffId;
		GameManager.research(item, 'training');
		const project = R.store.add({
			staffId,
			originalId,
			tier,
			platformIds: platforms.map((p) => p.id),
			title: name,
			budget: plan.budget,
			startWeek: company.currentWeek,
			weeks: plan.weeks,
			expected: plan.expected,
		});
		company.adjustCash(-plan.budget, `${tierName(tier)}: ${name}`);
		return project;
	};

	// gameLog is in release order, but the game reads its last entry as "our latest game"
	// (repeat-genre penalty, review window, bank offers, events). A remaster goes just before
	// the latest new game, so it never changes what that is.
	P.insert = (log, game) => {
		let i = log.length - 1;
		while (i >= 0 && log[i].flags && log[i].flags[P.FLAG]) i--;
		log.splice(Math.max(0, i), 0, game);
	};

	// Builds and releases the finished remaster. Returns the new game.
	P.release = (company, project) => {
		const original = gameById(company, project.originalId);
		if (!original) throw new Error(`original game ${project.originalId} is gone`);
		const ageWeeks = company.currentWeek - original.releaseWeek;
		const multiplier = M().salesMultiplier({ ageWeeks, brand: P.brand(company, original.id) });
		const score = M().rollScore(project.expected, company.getRandom());
		const onMarket = Platforms.getPlatformsOnMarket(company);
		const platforms = project.platformIds.map((id) => onMarket.find((p) => p.id === id)).filter(Boolean);

		// The Game constructor hands pending conference hype to the new game; keep it for the
		// next real one.
		const conferenceHype = company.conferenceHype;
		const game = new Game(company);
		company.conferenceHype = conferenceHype;
		Object.assign(game, {
			title: project.title,
			genre: original.genre,
			secondGenre: original.secondGenre,
			topic: original.topic,
			targetAudience: original.targetAudience,
			gameSize: original.gameSize,
			platforms: platforms.length ? platforms : original.platforms.slice(),
			hypePoints: 0,
			features: [],
			featureLog: [],
			state: GameState.released,
			releaseWeek: Math.floor(company.currentWeek) + 1,
			score,
			costs: project.budget,
		});
		game.flags.hasCustomName = true;
		game.flags[P.FLAG] = {
			of: original.id,
			tier: project.tier,
			originalScore: original.score,
			staffId: project.staffId,
			multiplier: Math.round(multiplier * 1000) / 1000,
		};
		game.reviews = Reviews.getReviews(game, score, GOOD_REMARKS, BAD_REMARKS);
		Sales.calculateSales(company, game);
		game.totalSalesCash = Math.floor(game.totalSalesCash * multiplier);
		game.fansChangeTarget = Math.floor(game.fansChangeTarget * multiplier);
		P.insert(company.gameLog, game);
		return game;
	};

	const notify = (company, header, text) => {
		if (company.notifications) company.notifications.push(new Notification({ header, text }));
	};

	const reviewLines = (game) => game.reviews.map((r) => `${r.reviewerName}: ${r.score}/10, "${r.message}"`).join('\n');

	// The staff member finished the work.
	P.complete = (staff) => {
		const company = GameManager.company;
		const project = R.store.projectFor(staff.id);
		if (!project) return null;
		R.store.remove(project);
		const game = P.release(company, project);
		const original = gameById(company, project.originalId);
		try {
			VisualsManager.getCharacterOverlay(staff).saySomething(`${tierName(project.tier)} done!`, 1500);
		} catch {
			// Speech bubbles are decoration; never let them stop a release.
		}
		notify(
			company,
			`${game.title} is out!`,
			`${staff.name} has finished ${game.title}, our ${tierName(project.tier).toLowerCase()} of ${original.title}. The first reviews are in:{n}${reviewLines(game)}`,
		);
		return game;
	};

	// Remasters whose staff member left (or that a reload lost) are dropped; the budget is gone.
	P.checkAbandoned = (company) => {
		R.store
			.projects()
			.slice()
			.forEach((project) => {
				const staff = (company.staff || []).find((s) => s.id === project.staffId);
				const working = staff && staff.currentResearch && staff.currentResearch.id === P.TRAINING_ID;
				if (working) return;
				R.store.remove(project);
				notify(company, 'Remaster cancelled', `Work on ${project.title} has stopped and the remaster is cancelled.`);
			});
	};

	// The first time a game is old enough, say what remasters are and where to start one.
	P.announce = (company) => {
		const data = R.store.data();
		if (data.announced || !P.enabled()) return;
		const best = P.eligible(company)[0];
		if (!best) return;
		data.announced = true;
		const years = Math.floor(best.ageWeeks / (SD.WEEKS_PER_MONTH * SD.MONTHS_PER_YEAR));
		notify(
			company,
			'Remasters',
			`Fans still talk about ${best.game.title}, ${years} years after it came out.{n}Right-click a staff member and choose "Remaster a game..." to bring an old hit back as a side project: a quick port, a remaster or a full remake for today's platforms. That person sits out of game development until it's done.`,
		);
	};

	P.onWeek = (company) => {
		P.checkAbandoned(company);
		P.announce(company);
	};

	// The game's staff activity the work runs as. It never shows in the Train menu.
	let item = null;
	P.trainingItem = () => {
		if (!item) {
			item = {
				id: P.TRAINING_ID,
				name: 'Remaster',
				duration: 12000,
				pointsCost: 0,
				isTraining: true,
				progressColor: '#d9822b',
				canUse: () => false,
				tick: () => {},
				complete: (staff) => {
					try {
						P.complete(staff);
					} catch (error) {
						SD.warn('remaster release failed', error);
					}
				},
			};
		}
		return item;
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
