// Studio Dashboard franchise gameplay: applies the model's effects to the game. Each effect
// is applied once per game and recorded in the save's mod data, so the dashboard can show
// what every entry received and a reload never applies anything twice.
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

	E.store = () => {
		const store = SD.getStore();
		const data = store.data || (store.data = {});
		return data.franchise || (data.franchise = { v: 1, applied: {} });
	};

	E.applied = (gameId) => E.store().applied[gameId] || null;

	const record = (gameId, fields) => {
		const applied = E.store().applied;
		applied[gameId] = { ...applied[gameId], ...fields };
		return applied[gameId];
	};

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
		const done = E.applied(game.id);
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

	E.onWeek = (company) => {
		E.launchHype(company);
	};

	E.install = (keys) => {
		GDT.on(keys.gameplay.weekProceeded, (e) => {
			const company = (e && e.company) || GameManager.company;
			try {
				E.onWeek(company);
			} catch (error) {
				SD.warn('franchise effects failed this week', error);
			}
		});
	};

	SD.features = SD.features || {};
	SD.features.franchise = { install: E.install };
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
