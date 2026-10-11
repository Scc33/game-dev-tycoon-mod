// Studio Dashboard remasters: the pure rules. Which games can be remastered, and what a
// port, remaster or remake of one costs, takes and returns. Plain values in and out, no
// game objects, so everything is unit-testable. See docs/design/phase-2b-remasters.md.
((SD) => {
	const M = ((SD.remaster = SD.remaster || {}).model = {});

	const WEEKS_PER_YEAR = 48;

	// Every balance number in one place, for play testing.
	M.TUNING = {
		minAgeWeeks: 5 * WEEKS_PER_YEAR, // old enough to be missed
		minScore: 6, // fans have to remember it fondly
		maxProjects: 1, // remasters underway at once
		// Standards rise: a game reviews this much worse per year since it came out, up to a cap.
		datingPerYear: 0.15,
		datingMax: 3,
		// Who does the work: (average of design and technology skill − 0.5) × this.
		skillWeight: 1,
		luck: 0.5, // the review lands within ± this of the expected score
		// Lifetime sales, as a share of what a new game with the same score would sell today.
		salesShare: 0.2,
		nostalgiaFullWeeks: 15 * WEEKS_PER_YEAR, // nostalgia grows from minAgeWeeks to here...
		nostalgiaBonus: 1, // ...and at its height multiplies sales by 1 + this
		brandSalesBonus: 0.25, // brand 100 → +25%, as for sequels
		// Work in weeks and budget in months of running costs, per size step.
		sizeSteps: { small: 1, medium: 2, large: 3, aaa: 6 },
		tiers: {
			port: { name: 'Port', weeks: 1.5, months: 0.5, dating: 1, bonus: 0, suffix: ' HD' },
			remaster: { name: 'Remaster', weeks: 3, months: 1, dating: 1 / 3, bonus: 0, suffix: ' Remastered' },
			remake: { name: 'Remake', weeks: 6, months: 2, dating: 0, bonus: 0.5, suffix: ' Remake' },
		},
	};

	M.TIERS = Object.keys(M.TUNING.tiers);

	const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
	const tierOf = (tier, t) => {
		const def = t.tiers[tier];
		if (!def) throw new Error(`unknown remaster tier: ${tier}`);
		return def;
	};

	// Whether `game` can be remastered at `week`. `game` carries { releaseWeek, score,
	// isPack, isMMO, isRemaster, remastered } (SD.games.stats() plus remaster fields).
	// Returns { ok, reason, fromWeek }: reason is why not, fromWeek when age allows it.
	M.eligibility = (game, week, t = M.TUNING) => {
		const fromWeek = game.releaseWeek + t.minAgeWeeks;
		const no = (reason) => ({ ok: false, reason, fromWeek });
		if (game.isPack) return no('pack');
		if (game.isMMO) return no('mmo');
		if (game.isRemaster) return no('remaster');
		if (game.remastered) return no('remastered');
		if (!(game.score >= t.minScore)) return no('score');
		if (week < fromWeek) return no('age');
		return { ok: true, reason: null, fromWeek };
	};

	// 0 when a game is just old enough, 1 at full nostalgia.
	M.nostalgia = (ageWeeks, t = M.TUNING) =>
		clamp((ageWeeks - t.minAgeWeeks) / (t.nostalgiaFullWeeks - t.minAgeWeeks), 0, 1);

	// How much a game's review has dated since it came out.
	M.dating = (ageWeeks, t = M.TUNING) =>
		Math.min(t.datingMax, (t.datingPerYear * Math.max(0, ageWeeks)) / WEEKS_PER_YEAR);

	// A staff member's fit for the work, 0 to 1, from { designFactor, technologyFactor }.
	M.skill = (staff) => clamp(((staff.designFactor || 0) + (staff.technologyFactor || 0)) / 2, 0, 1);

	M.skillBonus = (skill, t = M.TUNING) => (skill - 0.5) * t.skillWeight;

	// The review score to expect, before luck, and the range luck can move it across.
	M.score = ({ originalScore, ageWeeks, tier, skill }, t = M.TUNING) => {
		const def = tierOf(tier, t);
		const expected = clamp(
			originalScore - def.dating * M.dating(ageWeeks, t) + def.bonus + M.skillBonus(skill, t),
			1,
			10,
		);
		return { expected, low: clamp(expected - t.luck, 1, 10), high: clamp(expected + t.luck, 1, 10) };
	};

	// The actual score, given a random number in [0, 1).
	M.rollScore = (expected, random, t = M.TUNING) => clamp(expected + (2 * random - 1) * t.luck, 1, 10);

	M.workWeeks = (size, tier, t = M.TUNING) => tierOf(tier, t).weeks * (t.sizeSteps[size] || 1);

	// Rounded to the thousand, like the game's own development costs.
	M.budget = ({ size, tier, monthlyCosts, platformCosts = 0 }, t = M.TUNING) =>
		Math.round((monthlyCosts * tierOf(tier, t).months * (t.sizeSteps[size] || 1) + platformCosts) / 1000) * 1000;

	// Lifetime sales (and fan change) as a multiple of a new game's with the same score.
	// `brand` is the series' brand, or null when brand doesn't apply.
	M.salesMultiplier = ({ ageWeeks, brand = null }, t = M.TUNING) =>
		t.salesShare *
		(1 + t.nostalgiaBonus * M.nostalgia(ageWeeks, t)) *
		(brand === null ? 1 : 1 + (t.brandSalesBonus * brand) / 100);

	M.title = (originalTitle, tier, t = M.TUNING) => `${originalTitle}${tierOf(tier, t).suffix}`;

	// For ranking candidates: good games fans have missed longest first.
	M.appeal = (score, ageWeeks, t = M.TUNING) => score * (1 + t.nostalgiaBonus * M.nostalgia(ageWeeks, t));

	// Everything the Remaster window shows for one choice.
	// original: { title, score, releaseWeek, size }; staff: { designFactor, technologyFactor }.
	M.plan = ({ original, tier, staff, week, monthlyCosts, platformCosts = 0, brand = null }, t = M.TUNING) => {
		const ageWeeks = week - original.releaseWeek;
		const skill = M.skill(staff);
		return {
			tier,
			title: M.title(original.title, tier, t),
			ageWeeks,
			weeks: M.workWeeks(original.size, tier, t),
			budget: M.budget({ size: original.size, tier, monthlyCosts, platformCosts }, t),
			nostalgia: M.nostalgia(ageWeeks, t),
			dating: tierOf(tier, t).dating * M.dating(ageWeeks, t),
			skillBonus: M.skillBonus(skill, t),
			...M.score({ originalScore: original.score, ageWeeks, tier, skill }, t),
			multiplier: M.salesMultiplier({ ageWeeks, brand }, t),
		};
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
