// Studio Dashboard tab: series built from sequels and expansion packs, plus sequel ideas.
((SD) => {
	const sequelsResearched = (company) =>
		typeof Research === 'undefined' || !Research.Sequels || company.researchCompleted.indexOf(Research.Sequels) !== -1;

	const signedScore = (delta) => `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta).toFixed(1)}`;

	const render = (body, { company }) => {
		const { h, panel } = SD.dom;
		const franchises = SD.franchises.all(company);
		if (!franchises.length) {
			body.appendChild(
				panel('No franchises yet', null, [
					h('p', {
						text: 'Release a sequel or an expansion pack and its whole series shows up here: combined sales, how review scores changed, and when the next sequel can safely come out.',
					}),
					sequelsResearched(company)
						? null
						: h('p', {
								class: 'sdMuted',
								text: 'Sequels unlock through research once your studio has grown a little.',
							}),
				]),
			);
		}
		franchises.forEach((f) => body.appendChild(franchiseCard(f)));
		const candidates = SD.franchises.candidates(company, 5);
		if (candidates.length) body.appendChild(candidatesCard(candidates, sequelsResearched(company)));
	};

	const franchiseCard = (f) => {
		const { h, tile, tiles, table, badge, money, status } = SD.dom;
		const fmt = SD.fmt;
		const head = h('div', { class: 'sdFranchiseHead' }, [
			h('div', {}, [
				h('div', { class: 'sdCardTitle', text: `${f.name} series` }),
				h('div', {
					class: 'sdCardSub',
					text: `${f.entries.length} entries${f.inDevelopment ? ', one in development' : ''}`,
				}),
			]),
			tiles(
				[
					tile('Revenue', fmt.money(f.revenue)),
					tile('Profit', fmt.signedMoney(f.profit)),
					tile('Avg score', f.avgScore ? fmt.score(f.avgScore) : '–'),
				],
				{ small: true },
			),
			f.scores.length > 1
				? h('div', { class: 'sdSparkWrap' }, [
						SD.charts.spark(f.scores, { min: 0, max: 10 }),
						h('div', { class: 'sdSparkLabel', text: `Scores ${signedScore(f.scoreTrend)}` }),
					])
				: null,
		]);

		const released = (e, fn) => (e.inDevelopment ? '–' : fn(e));
		const entries = table(
			[
				{
					name: 'Title',
					value: (e) =>
						h('span', {}, [
							e.title,
							e.isPack ? badge('Pack') : null,
							e.inDevelopment ? badge('In development', 'live') : null,
						]),
				},
				{ name: 'Released', value: (e) => released(e, () => fmt.date(e.releaseWeek)) },
				{
					name: 'Gap',
					cls: 'sdNum',
					value: (e) => {
						if (e.gapWeeks === null) return '–';
						return e.tooClose ? status('warn', 'warning-sign', [`${e.gapWeeks} wk, too soon`]) : `${e.gapWeeks} wk`;
					},
				},
				{ name: 'Score', cls: 'sdNum', value: (e) => released(e, () => fmt.score(e.score)) },
				{ name: 'Revenue', cls: 'sdNum', value: (e) => released(e, () => fmt.money(e.revenue)) },
				{ name: 'Profit', cls: 'sdNum', value: (e) => released(e, () => money(e.profit, { signed: true })) },
				{
					name: 'Engine',
					value: (e) => {
						if (!e.engine) return '–';
						if (e.sameEngine) return status('warn', 'warning-sign', [`${e.engine} (reused)`]);
						if (e.betterEngine) return status('good', 'ok', [`${e.engine} (upgraded)`]);
						return e.engine;
					},
				},
			],
			f.entries,
		);
		return h('div', { class: 'sdCard' }, [head, entries, f.inDevelopment ? null : advice(f.next)]);
	};

	const advice = (next) => {
		if (!next) return null;
		const { h, status } = SD.dom;
		const fmt = SD.fmt;
		const name = h('strong', { text: next.basedOn });
		const timing =
			next.weeksUntilSafe > 0
				? status('warn', 'time', [
						'Release a sequel to ',
						name,
						` on or after ${fmt.date(next.safeFromWeek)} (${next.weeksUntilSafe} weeks) to avoid the "too soon" review penalty.`,
					])
				: status('good', 'ok', ['A sequel to ', name, ' can release any time without the "too soon" penalty.']);
		const engine = next.engine
			? `Build it on an engine newer than ${next.engine}: reusing the same engine halves the sequel hype bonus, and a better one raises it.`
			: null;
		return h('div', { class: 'sdAdvice' }, [timing, engine ? h('div', { class: 'sdMuted', text: engine }) : null]);
	};

	const candidatesCard = (candidates, researched) => {
		const { table, money, status, panel } = SD.dom;
		const fmt = SD.fmt;
		return panel(
			'Sequel candidates',
			researched
				? 'Standalone games that reviewed and sold well'
				: 'Standalone games that reviewed and sold well. Sequels are not researched yet.',
			[
				table(
					[
						{ name: 'Title', value: (g) => g.title },
						{ name: 'Released', value: (g) => fmt.date(g.releaseWeek) },
						{ name: 'Score', cls: 'sdNum', value: (g) => fmt.score(g.score) },
						{ name: 'Profit', cls: 'sdNum', value: (g) => money(g.profit, { signed: true }) },
						{
							name: 'Sequel timing',
							value: (g) =>
								g.next.weeksUntilSafe > 0
									? status('warn', 'time', [`after ${fmt.date(g.next.safeFromWeek)}`])
									: status('good', 'ok', ['ready']),
						},
					],
					candidates,
				),
			],
		);
	};

	// Registered by key; the dashboard reads SD.tabs when it renders, so load order does not matter.
	SD.tabs = SD.tabs || {};
	SD.tabs.franchises = { name: 'Franchises', order: 40, render };
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
