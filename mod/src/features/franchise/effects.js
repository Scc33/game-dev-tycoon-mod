// Studio Dashboard franchise gameplay: applies the model's effects to the game. Each effect
// is applied once per game and recorded through F.store, so the dashboard can show what
// every entry received and a reload never applies anything twice.
((SD) => {
	const F = (SD.franchise = SD.franchise || {});
	const E = (F.effects = {});

	const GROUP = 'Franchises';
	SD.options = SD.options || {};
	SD.options['franchise.hype'] = {
		group: GROUP,
		name: 'Launch hype',
		description: "A sequel starts development with hype from its series' brand.",
		default: true,
		order: 10,
	};
	SD.options['franchise.sales'] = {
		group: GROUP,
		name: 'Sales effects',
		description:
			'A loved series sells up to 25% more and a worn-out one up to 50% less. Fan growth changes the same way.',
		default: true,
		order: 20,
	};
	SD.options['franchise.fatigue'] = {
		group: GROUP,
		name: 'Series fatigue',
		description:
			'Releasing entries too often, or weak ones, tires players out and lowers hype and sales. Recovers over time.',
		default: true,
		order: 30,
	};

	const enabled = (id) => SD.settings.get(id) !== false;
	const round1 = (v) => Math.round(v * 10) / 10;
	const round3 = (v) => Math.round(v * 1000) / 1000;

	SD.options['franchise.events'] = {
		group: GROUP,
		name: 'Fan events',
		description:
			'Now and then fans ask for a sequel, celebrate an anniversary or miss a dormant series, with choices that trade money or promises for brand.',
		default: true,
		order: 40,
	};

	const record = (gameId, fields) => F.store.record(gameId, fields);

	const notify = (company, text) => {
		if (typeof Notification !== 'function' || !company.notifications) return;
		company.notifications.push(new Notification({ header: 'Franchise', text, type: 'GameReports' }));
	};

	// Once the concept of a sequel is set (it has a genre and topic), add hype from its
	// series' brand, once.
	E.launchHype = (company) => {
		const game = company && company.currentGame;
		if (!game || !game.sequelTo || !game.genre || !game.topic) return null;
		if (!enabled('franchise.hype')) return null;
		const done = F.store.applied(game.id);
		if (done && done.hype !== undefined) return null;
		const dev = F.series.development(company);
		if (!dev || dev.kind === F.model.KINDS.pack) return null;

		const state = F.series.state(dev.series, company.currentWeek, { fatigue: enabled('franchise.fatigue') });
		const { hype } = F.model.effects(state, dev.kind);
		game.hypePoints = (game.hypePoints || 0) + hype;
		if (hype > 0) {
			const kind = dev.kind === F.model.KINDS.spinoff ? 'spin-off' : 'sequel';
			notify(
				company,
				`Fans of the ${dev.series.name} series are excited about the new ${kind}, ${game.title}.\n(+${hype} hype)`,
			);
		}
		return record(game.id, {
			kind: dev.kind,
			hype,
			hypeWeek: company.currentWeek,
			hypeBrand: round1(state.brand),
			hypeFatigue: round1(state.fatigue),
		});
	};

	// At release the game sets a sequel's lifetime sales target once (totalSalesCash, paid out
	// over the following weeks) and its fan change; scale both by brand and fatigue. Fan
	// losses are left alone. Only the company's own release counts: the game also runs the
	// sales maths on throwaway companies in some debug tools.
	E.releaseSales = (company, game) => {
		if (!company || !game || game !== company.currentGame || !game.sequelTo) return null;
		if (!enabled('franchise.sales')) return null;
		const done = F.store.applied(game.id);
		if (done && done.sales !== undefined) return null;
		const dev = F.series.development(company);
		if (!dev || dev.entry.id !== game.id || dev.kind === F.model.KINDS.pack) return null;

		const state = F.series.state(dev.series, game.releaseWeek, { fatigue: enabled('franchise.fatigue') });
		const { sales } = F.model.effects(state, dev.kind);
		const baseSales = game.totalSalesCash || 0;
		game.totalSalesCash = Math.floor(baseSales * sales);
		if (game.fansChangeTarget > 0) game.fansChangeTarget = Math.floor(game.fansChangeTarget * sales);
		return record(game.id, {
			kind: dev.kind,
			sales: round3(sales),
			baseSales,
			salesBrand: round1(state.brand),
			salesFatigue: round1(state.fatigue),
		});
	};

	E.onWeek = (company) => {
		E.launchHype(company);
	};

	// A failing effect is logged and skipped; it must never break the game's own flow.
	const guarded = (what, fn) => (e) => {
		try {
			fn(e || {});
		} catch (error) {
			SD.warn(`franchise ${what} failed`, error);
		}
	};

	E.install = (keys) => {
		GDT.on(
			keys.gameplay.weekProceeded,
			guarded('weekly update', (e) => E.onWeek(e.company || GameManager.company)),
		);
		GDT.on(
			keys.gameplay.salesCalculated,
			guarded('sales effect', (e) => E.releaseSales(e.company, e.game)),
		);
	};

	SD.features = SD.features || {};
	SD.features.franchise = { install: E.install };
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
