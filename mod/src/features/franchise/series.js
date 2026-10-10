// Studio Dashboard franchise gameplay: connects the pure model to the series that
// SD.franchises builds from the save (sequelTo chains, plus a sequel in development).
((SD) => {
	const F = (SD.franchise = SD.franchise || {});
	const S = (F.series = {});

	const byId = (series) => {
		const ids = {};
		series.entries.forEach((e) => {
			ids[e.id] = e;
		});
		return ids;
	};

	// Mainline, spin-off or pack, judged against the entry it follows.
	S.kindOf = (series, entry) => F.model.kindOf(entry, byId(series)[entry.sequelTo] || null);

	// The series' released entries as model records, plus brand changes from fan events.
	S.timeline = (series) => {
		const ids = byId(series);
		const releases = series.entries
			.filter((e) => !e.inDevelopment)
			.map((e) => ({
				id: e.id,
				week: e.releaseWeek,
				score: e.score,
				kind: F.model.kindOf(e, ids[e.sequelTo] || null),
			}));
		return releases.concat(F.store ? F.store.adjustments(series.id) : []);
	};

	// Brand and fatigue at `week`. With fatigue switched off it reads as zero.
	S.state = (series, week, { fatigue = true } = {}) => {
		const state = F.model.evolve(S.timeline(series), week);
		return fatigue ? state : { ...state, fatigue: 0 };
	};

	// What the dashboard shows for a series at `week`: brand and fatigue with their labels,
	// how long until fatigue has worn off, and what a mainline sequel or a spin-off released
	// then would get.
	S.outlook = (series, week, { fatigue = true } = {}) => {
		const M = F.model;
		const state = S.state(series, week, { fatigue });
		return {
			brand: state.brand,
			fatigue: state.fatigue,
			brandLabel: M.brandLabel(state.brand),
			fatigueLabel: M.fatigueLabel(state.fatigue),
			restedInWeeks: Math.ceil((state.fatigue / M.TUNING.fatigueRecoveryPerMonth) * SD.WEEKS_PER_MONTH),
			mainline: M.effects(state, M.KINDS.mainline),
			spinoff: M.effects(state, M.KINDS.spinoff),
			brandHistory: state.history.map((point) => point.after.brand),
		};
	};

	// The game in development, if it continues a series: { series, entry, kind }.
	S.development = (company) => {
		const series = SD.franchises.all(company).find((f) => f.inDevelopment);
		if (!series) return null;
		const entry = series.entries.find((e) => e.inDevelopment);
		return { series, entry, kind: S.kindOf(series, entry) };
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
