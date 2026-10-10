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

	// The series' released entries as model records.
	S.timeline = (series) => {
		const ids = byId(series);
		return series.entries
			.filter((e) => !e.inDevelopment)
			.map((e) => ({
				id: e.id,
				week: e.releaseWeek,
				score: e.score,
				kind: F.model.kindOf(e, ids[e.sequelTo] || null),
			}));
	};

	// Brand and fatigue at `week`. With fatigue switched off it reads as zero.
	S.state = (series, week, { fatigue = true } = {}) => {
		const state = F.model.evolve(S.timeline(series), week);
		return fatigue ? state : { ...state, fatigue: 0 };
	};

	// The game in development, if it continues a series: { series, entry, kind }.
	S.development = (company) => {
		const series = SD.franchises.all(company).find((f) => f.inDevelopment);
		if (!series) return null;
		const entry = series.entries.find((e) => e.inDevelopment);
		return { series, entry, kind: S.kindOf(series, entry) };
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
