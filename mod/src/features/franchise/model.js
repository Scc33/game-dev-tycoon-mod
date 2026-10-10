// Studio Dashboard franchise gameplay: the pure rules. A series' brand (how much players
// love it) and fatigue (how tired they are of it) are worked out from its release history,
// and turn into launch hype and a sales multiplier for the next entry.
// No game objects here: entries are plain { week, score, kind } records, so everything is
// unit-testable and old saves get values from their existing history.
// See docs/design/phase-2-franchises.md.
((SD) => {
	const M = ((SD.franchise = SD.franchise || {}).model = {});

	// Every balance number in one place, for play testing.
	M.TUNING = {
		// Entry quality: score 4 or less → 0, score 10 → 100.
		qualityZeroScore: 4,
		qualityFullScore: 10,
		// Brand after an entry.
		firstEntryShare: 0.75, // one hit isn't a franchise yet
		mainlineWeight: 0.5, // share of the new entry's quality in the brand
		spinoffWeight: 0.3, // a spin-off moves the brand less, for better or worse
		// Brand fades only after a long silence, never below a share of its last value.
		dormantAfterWeeks: 144,
		dormantFadePerMonth: 1,
		dormantFloorShare: 0.5,
		// Fatigue added by an entry, then recovered over time.
		fatigueMainline: 40,
		fatigueSpinoff: 20,
		weakScore: 6, // below this an entry adds extra fatigue
		fatigueWeak: 20,
		greatScore: 9, // at or above this an entry refreshes the series
		fatigueGreat: -20,
		fatigueRecoveryPerMonth: 2.5,
		// Effects on the next entry.
		hypePerBrand: 2,
		spinoffBrandShare: 0.6,
		salesBrandBonus: 0.25, // brand 100 → +25% lifetime sales
		salesFatiguePenalty: 0.5, // fatigue 100 → −50% lifetime sales
		// Fan events (features/franchise/events.js).
		eventCooldownWeeks: 52, // at most one franchise event a year
		teaseMinScore: 8.5, // "Fans want more" after an entry this good...
		teaseFromWeeks: 24, // ...released between 6 months
		teaseToWeeks: 96, // ...and 2 years ago
		teaseHype: 50,
		teasePenalty: -5,
		promiseDueWeeks: 104, // a teased or promised entry must start within 2 years
		anniversaryWeeks: 480, // 10 years after the first entry
		anniversaryMinBrand: 40,
		anniversaryCostShare: 0.02, // of the series' lifetime revenue
		anniversaryMinCost: 10000,
		anniversaryBrand: 10,
		anniversaryFansShare: 0.02,
		revivalMinBrand: 60, // "Where's the sequel?" for a series this loved...
		revivalSilentWeeks: 192, // ...after 4 years without an entry
		revivalHype: 100,
		revivalPenalty: -15,
	};

	const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
	const months = (weeks) => weeks / SD.WEEKS_PER_MONTH;

	M.KINDS = { mainline: 'mainline', spinoff: 'spinoff', pack: 'pack', adjust: 'adjust' };

	// An entry is a spin-off when its genre or topic differs from its predecessor's.
	// `entry` and `predecessor` carry { isPack, genre, topic }, e.g. SD.games.stats().
	M.kindOf = (entry, predecessor) => {
		if (entry.isPack) return M.KINDS.pack;
		if (predecessor && (entry.genre !== predecessor.genre || entry.topic !== predecessor.topic)) return M.KINDS.spinoff;
		return M.KINDS.mainline;
	};

	M.quality = (score, t = M.TUNING) =>
		clamp(((score - t.qualityZeroScore) / (t.qualityFullScore - t.qualityZeroScore)) * 100, 0, 100);

	// Brand and fatigue `weeks` after the last release, before anything new happens.
	const age = (state, weeks, t) => {
		if (!state.released) return state;
		const silent = Math.max(0, weeks - t.dormantAfterWeeks);
		return {
			...state,
			brand: Math.max(state.lastBrand * t.dormantFloorShare, state.lastBrand - t.dormantFadePerMonth * months(silent)),
			fatigue: Math.max(0, state.lastFatigue - t.fatigueRecoveryPerMonth * months(weeks)),
		};
	};

	const release = (state, entry, t) => {
		const q = M.quality(entry.score, t);
		const spinoff = entry.kind === M.KINDS.spinoff;
		let brand;
		if (!state.released) brand = t.firstEntryShare * q;
		else {
			const w = spinoff ? t.spinoffWeight : t.mainlineWeight;
			brand = (1 - w) * state.brand + w * q;
		}
		let fatigue = state.fatigue + (spinoff ? t.fatigueSpinoff : t.fatigueMainline);
		if (entry.score < t.weakScore) fatigue += t.fatigueWeak;
		if (entry.score >= t.greatScore) fatigue += t.fatigueGreat;
		fatigue = clamp(fatigue, 0, 100);
		return { released: true, lastWeek: entry.week, brand, fatigue, lastBrand: brand, lastFatigue: fatigue };
	};

	// A fan event moved the brand by `delta`. The fade after a long silence is measured from
	// the last release, so the change is applied to the brand that fade starts from.
	const adjust = (state, delta) => {
		const lastBrand = clamp(state.lastBrand + delta, 0, 100);
		return { ...state, brand: clamp(state.brand + delta, 0, 100), lastBrand };
	};

	const EMPTY = { released: false, lastWeek: null, brand: 0, fatigue: 0, lastBrand: 0, lastFatigue: 0 };

	// The series as of `week`, from its timeline in any order: released entries
	// ({ week, score, kind }) and brand changes from fan events ({ week, kind: 'adjust',
	// brand }). Packs are skipped. `history` has one point per release, measured just
	// before and just after it, for charts.
	M.evolve = (entries, week, t = M.TUNING) => {
		const timeline = entries.filter((e) => e.kind !== M.KINDS.pack && e.week <= week).sort((a, b) => a.week - b.week);
		let state = EMPTY;
		const history = [];
		timeline.forEach((entry) => {
			if (entry.kind === M.KINDS.adjust) {
				if (state.released) state = adjust(state, entry.brand);
				return;
			}
			const before = state.released ? age(state, entry.week - state.lastWeek, t) : state;
			state = release(before, entry, t);
			history.push({ week: entry.week, before: snapshot(before), after: snapshot(state) });
		});
		const now = state.released ? age(state, week - state.lastWeek, t) : state;
		return { ...snapshot(now), released: now.released, lastWeek: now.lastWeek, history };
	};

	const snapshot = (s) => ({ brand: s.brand, fatigue: s.fatigue });

	// What a new entry of `kind` gets from a series in `state` ({ brand, fatigue }).
	M.effects = (state, kind = M.KINDS.mainline, t = M.TUNING) => {
		if (kind === M.KINDS.pack) return { hype: 0, sales: 1 };
		const share = kind === M.KINDS.spinoff ? t.spinoffBrandShare : 1;
		const fresh = 1 - state.fatigue / 100;
		return {
			hype: Math.round(t.hypePerBrand * state.brand * fresh * share),
			sales:
				(1 + (t.salesBrandBonus * state.brand * share) / 100) * (1 - (t.salesFatiguePenalty * state.fatigue) / 100),
		};
	};

	const label = (bands) => (value) => bands.find(([upTo]) => value < upTo)[1];
	M.brandLabel = label([
		[20, 'Unknown'],
		[40, 'Known'],
		[60, 'Popular'],
		[80, 'Beloved'],
		[Infinity, 'Legendary'],
	]);
	M.fatigueLabel = label([
		[25, 'Fresh'],
		[50, 'Familiar'],
		[75, 'Tired'],
		[Infinity, 'Worn out'],
	]);
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
