// Studio Dashboard tab: every released game with its profitability, plus a detail view.
((SD) => {
	const compare = (key, dir) => (a, b) => {
		const av = a[key];
		const bv = b[key];
		if (av === null) return 1;
		if (bv === null) return -1;
		return typeof av === 'string' ? dir * av.localeCompare(bv) : dir * (av - bv);
	};

	const render = (body, { company, state, refresh, card }) => {
		const { h, table, badge, money, empty } = SD.dom;
		const fmt = SD.fmt;
		const games = SD.games.all(company);
		if (!games.length) {
			body.appendChild(empty('No released games yet.'));
			return;
		}
		const sort = state.sort || (state.sort = { key: 'releaseWeek', dir: -1 });
		games.sort(compare(sort.key, sort.dir));
		const newest = games.reduce((a, b) => (b.releaseWeek > a.releaseWeek ? b : a));
		const selected = games.find((g) => g.id === state.selected) || newest;

		const list = table(
			[
				{
					name: 'Title',
					sortKey: 'title',
					value: (g) =>
						h('span', {}, [
							g.title,
							g.isPack ? badge('Pack') : null,
							g.isMMO ? badge('MMO') : null,
							g.isPublished ? badge('Published') : null,
							g.onSale ? badge('On sale', 'live') : null,
						]),
				},
				{ name: 'Released', sortKey: 'releaseWeek', value: (g) => fmt.date(g.releaseWeek) },
				{ name: 'Score', sortKey: 'score', cls: 'sdNum', value: (g) => fmt.score(g.score) },
				{ name: 'Revenue', sortKey: 'revenue', cls: 'sdNum', value: (g) => fmt.money(g.revenue) },
				{ name: 'Costs', sortKey: 'costs', cls: 'sdNum', value: (g) => fmt.money(g.costs) },
				{ name: 'Profit', sortKey: 'profit', cls: 'sdNum', value: (g) => money(g.profit, { signed: true }) },
				{ name: 'ROI', sortKey: 'roi', cls: 'sdNum', value: (g) => (g.isPack ? '–' : fmt.percent(g.roi)) },
				{
					name: 'Paid off',
					sortKey: 'breakEvenWeeks',
					cls: 'sdNum',
					value: (g) => (g.breakEvenWeeks ? `${g.breakEvenWeeks} wk` : '–'),
				},
			],
			games,
			{
				sort,
				onSort: (key) => {
					state.sort = { key, dir: sort.key === key ? -sort.dir : key === 'title' ? 1 : -1 };
					refresh();
				},
				onRow: (g) => {
					state.selected = g.id;
					refresh();
				},
				rowClass: (g) => (g.id === selected.id ? 'sdSelected' : ''),
			},
		);
		body.appendChild(h('div', { class: 'sdTableScroll' }, [list]));
		body.appendChild(detail(selected, card));
	};

	const detail = (g, card) => {
		const { h, table, empty, note } = SD.dom;
		const fmt = SD.fmt;
		const stat = (label, value) =>
			h('div', { class: 'sdStat' }, [
				h('div', { class: 'sdStatValue', text: value }),
				h('div', { class: 'sdStatLabel', text: label }),
			]);
		const meta = [
			g.genre,
			g.topic,
			g.platforms.join(', '),
			g.size && g.size.toUpperCase(),
			g.engine && `Engine: ${g.engine}`,
		]
			.filter(Boolean)
			.join(' · ');

		let running = 0;
		const cumulative = g.weekly.map((cash, i) => {
			running += cash;
			return { x: i + 1, y: running };
		});

		return card({
			id: `game-${g.id}`,
			title: g.title,
			subtitle: meta,
			legend: g.isPack
				? note('info-sign', [
						'The game adds expansion pack sales to the base game, so a pack only shows its own costs here.',
					])
				: null,
			chart: (el) => {
				el.appendChild(
					h('div', { class: 'sdStatRow' }, [
						stat('Units sold', fmt.int(g.units)),
						stat('Best week', fmt.money(g.peakWeek)),
						stat('Top chart rank', g.topRank ? `#${g.topRank}` : '–'),
						stat('Fans gained', fmt.int(g.fans)),
						stat('Weeks on sale', String(g.weekly.length)),
					]),
				);
				if (cumulative.length < 2) {
					el.appendChild(empty('Sales data appears after the first weeks on sale.'));
					return;
				}
				const chart = h('div');
				el.appendChild(chart);
				SD.charts.line(chart, {
					points: cumulative,
					name: 'Total earned',
					color: SD.charts.colors.income,
					format: fmt.money,
					height: 190,
					xLabel: (w) => `Week ${w}`,
					tooltipTitle: (p) => `Week ${p.x} on sale`,
					reference: g.costs > 0 ? { value: g.costs, label: `Development cost ${fmt.money(g.costs)}` } : null,
					marker: g.breakEvenWeeks ? { index: g.breakEvenWeeks - 1, label: 'Paid off' } : null,
				});
			},
			table: () =>
				table(
					[
						{ name: 'Week on sale', value: (p) => String(p.x) },
						{ name: 'Sales that week', cls: 'sdNum', value: (p) => fmt.money(g.weekly[p.x - 1]) },
						{ name: 'Total earned', cls: 'sdNum', value: (p) => fmt.money(p.y) },
					],
					cumulative,
				),
		});
	};

	// Registered by key; the dashboard reads SD.tabs when it renders, so load order does not matter.
	SD.tabs = SD.tabs || {};
	SD.tabs.games = { name: 'Games', order: 30, render };
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
