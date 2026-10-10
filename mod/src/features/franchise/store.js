// Studio Dashboard franchise gameplay: what the feature keeps in the save's mod data.
//
//   franchise: {
//     v: 1,
//     applied: { [gameId]: { kind, hype, promised, hypeWeek, hypeBrand, hypeFatigue,
//                            sales, baseSales, salesBrand, salesFatigue } },
//     events: [{ type, series, week, ...details }],   fan events and their consequences
//     offer: { type, series, week, ... } | null,      a fan event waiting for the player
//     lastEventWeek: number,
//   }
//
// Brand and fatigue themselves are never stored: they are recalculated from the release
// history plus the brand changes recorded in `events`.
((SD) => {
	const F = (SD.franchise = SD.franchise || {});
	const S = (F.store = {});

	S.data = () => {
		const store = SD.getStore();
		const data = store.data || (store.data = {});
		const d = data.franchise || (data.franchise = { v: 1, applied: {} });
		if (!d.events) d.events = [];
		return d;
	};

	S.applied = (gameId) => S.data().applied[gameId] || null;

	S.record = (gameId, fields) => {
		const applied = S.data().applied;
		applied[gameId] = { ...applied[gameId], ...fields };
		return applied[gameId];
	};

	S.events = (seriesId) => S.data().events.filter((e) => !seriesId || e.series === seriesId);

	S.addEvent = (event) => {
		S.data().events.push(event);
		return event;
	};

	// Brand changes from fan events, as model timeline entries.
	S.adjustments = (seriesId) =>
		S.events(seriesId)
			.filter((e) => e.brand)
			.map((e) => ({ week: e.week, kind: 'adjust', brand: e.brand }));

	// A promise of a new entry the studio has not kept yet: { hype, due, ... }.
	S.openPromise = (seriesId) => S.events(seriesId).find((e) => e.status === 'open') || null;
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
