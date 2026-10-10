// Studio Dashboard tab: series built from sequels and expansion packs, plus sequel ideas.
((SD) => {
	const sequelsResearched = (company) =>
		typeof Research === 'undefined' || !Research.Sequels || company.researchCompleted.indexOf(Research.Sequels) !== -1;

	const signedScore = (delta) => `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta).toFixed(1)}`;

	// Franchise gameplay (src/features/franchise) and its per-save switches.
	const on = (id) => SD.settings.get(id) !== false;
	const gameplayOn = () => on('franchise.hype') || on('franchise.sales');

	// "+117 hype, sales ×1.08", leaving out effects that are switched off.
	const effectText = (fx) =>
		[
			on('franchise.hype') && fx.hype !== undefined ? `+${fx.hype} hype` : null,
			on('franchise.sales') && fx.sales !== undefined ? `sales ×${fx.sales.toFixed(2)}` : null,
		]
			.filter(Boolean)
			.join(', ');

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
		franchises.forEach((f) => body.appendChild(franchiseCard(f, company)));
		const candidates = SD.franchises.candidates(company, 5);
		if (candidates.length) body.appendChild(candidatesCard(candidates, sequelsResearched(company)));
	};

	const franchiseCard = (f, company) => {
		const { h, tile, tiles, table, badge, money, status } = SD.dom;
		const fmt = SD.fmt;
		const kindOf = (e) => SD.franchise.series.kindOf(f, e);
		const applied = (e) => SD.franchise.effects.applied(e.id);
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
							!e.isPack && kindOf(e) === 'spinoff' ? badge('Spin-off') : null,
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
				gameplayOn()
					? {
							name: 'Franchise effect',
							value: (e) => {
								const fx = applied(e);
								return (fx && effectText(fx)) || '–';
							},
						}
					: null,
			].filter(Boolean),
			f.entries,
		);
		return h('div', { class: 'sdCard' }, [
			head,
			health(f, company),
			entries,
			f.inDevelopment ? devWarning(f) : advice(f.next),
		]);
	};

	// Brand, fatigue and what the next entry would get, when franchise gameplay is on.
	const health = (f, company) => {
		if (!gameplayOn()) return null;
		const { h, meter } = SD.dom;
		const colors = SD.charts.colors;
		const fatigueOn = on('franchise.fatigue');
		const o = SD.franchise.series.outlook(f, company.currentWeek, { fatigue: fatigueOn });

		const lines = [];
		const dev = f.entries.find((e) => e.inDevelopment);
		if (dev) {
			const kind = SD.franchise.series.kindOf(f, dev);
			const fx = SD.franchise.effects.applied(dev.id);
			if (fx && fx.hype !== undefined && on('franchise.hype'))
				lines.push(`${dev.title} started development with +${fx.hype} hype from the series.`);
			if (on('franchise.sales') && kind !== 'pack')
				lines.push(`Released now, it would sell ×${o[kind].sales.toFixed(2)}.`);
		} else {
			lines.push(`A sequel released now: ${effectText(o.mainline)}.`);
			lines.push(`A spin-off (new genre or topic): ${effectText(o.spinoff)}.`);
		}
		if (fatigueOn && o.restedInWeeks > 0)
			lines.push(`Fatigue wears off by ${SD.fmt.date(company.currentWeek + o.restedInWeeks)}.`);

		return h('div', { class: 'sdHealth' }, [
			meter('Brand', o.brand, o.brandLabel, colors.income),
			fatigueOn ? meter('Fatigue', o.fatigue, o.fatigueLabel, colors.expenses) : null,
			o.brandHistory.length > 1
				? h('div', { class: 'sdSparkWrap' }, [
						SD.charts.spark(o.brandHistory, { min: 0, max: 100 }),
						h('div', { class: 'sdSparkLabel', text: 'Brand by release' }),
					])
				: null,
			h(
				'div',
				{ class: 'sdOutlook' },
				lines.map((text) => h('div', { text })),
			),
		]);
	};

	const penaltyName = (combo) => `"Another ${combo} game?"`;

	// The game compares every new release with the studio's latest one, not with the series.
	const repeatWarning = (next) => {
		if (!next.repeatsLastRelease) return null;
		const { h, status } = SD.dom;
		const lead =
			next.lastRelease === next.basedOn
				? [h('strong', { text: next.basedOn }), ' is your latest release, so']
				: ['Your latest release, ', h('strong', { text: next.lastRelease }), `, is also ${next.combo}, so`];
		return status('warn', 'warning-sign', [
			...lead,
			` a sequel with the same genre and topic released next gets the ${penaltyName(next.combo)} review penalty. Release a different game first, or change the genre or topic.`,
		]);
	};

	const devWarning = (f) => {
		const dev = f.entries.find((e) => e.inDevelopment && e.repeatsLastRelease);
		if (!dev) return null;
		const { h, status } = SD.dom;
		return h('div', { class: 'sdAdvice' }, [
			status('warn', 'warning-sign', [
				h('strong', { text: dev.title }),
				` has the same genre and topic as your latest release, so its reviews will take the ${penaltyName(SD.franchises.combo(dev))} penalty.`,
			]),
		]);
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
		return h('div', { class: 'sdAdvice' }, [
			timing,
			repeatWarning(next),
			engine ? h('div', { class: 'sdMuted', text: engine }) : null,
		]);
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
							value: (g) => {
								const waits = [
									g.next.weeksUntilSafe > 0 ? `after ${fmt.date(g.next.safeFromWeek)}` : null,
									g.next.repeatsLastRelease ? 'after a different game' : null,
								].filter(Boolean);
								return waits.length ? status('warn', 'time', [waits.join(' and ')]) : status('good', 'ok', ['ready']);
							},
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
