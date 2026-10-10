// Studio Dashboard tab: headline numbers, cash balance and sales history.
((SD) => {
	const render = (body, { company, card }) => {
		const { h, tile, tiles, table, empty, note } = SD.dom;
		const fmt = SD.fmt;
		const colors = SD.charts.colors;
		const d = SD.ledger.state(company);
		const summary = SD.games.summary(company);
		const currentMonth = SD.monthIndex(company.currentWeek);
		const net12 = SD.ledger.monthly(d, currentMonth - 11, currentMonth).reduce((s, r) => s + r.net, 0);
		const coversYear = d.since <= (currentMonth - 11) * SD.WEEKS_PER_MONTH;
		const hasLedger = Object.keys(d.months).length > 0;
		const games = summary.released === 1 ? 'game' : 'games';

		body.appendChild(
			tiles([
				tile('Cash', fmt.money(company.cash), `${fmt.int(company.fans)} fans`, { hero: true }),
				tile(
					'Net profit, last 12 months',
					hasLedger ? fmt.signedMoney(net12) : '–',
					coversYear ? 'All income minus all costs' : `Recording since ${fmt.date(d.since)}`,
				),
				tile(
					'Game revenue, all time',
					fmt.money(summary.revenue),
					`${fmt.signedMoney(summary.profit)} after dev costs`,
				),
				tile(
					'Average review score',
					summary.avgScore ? fmt.score(summary.avgScore) : '–',
					`${summary.released} ${games} released`,
				),
			]),
		);

		const snaps = d.snaps;
		body.appendChild(
			card({
				id: 'overview-cash',
				title: 'Cash balance',
				subtitle: `Weekly, since ${fmt.date(d.since)}`,
				chart: (el) => {
					if (snaps.length < 2) {
						el.appendChild(empty('Your cash history starts recording now. Check back after a few in-game weeks.'));
						return;
					}
					SD.charts.line(el, {
						points: snaps.map(([week, cash]) => ({ x: week, y: cash })),
						name: 'Cash',
						color: colors.income,
						format: fmt.money,
						xLabel: (w) => fmt.month(SD.monthIndex(w)),
						tooltipTitle: (p) => fmt.date(p.x),
					});
				},
				table: () =>
					table(
						[
							{ name: 'Week', value: (s) => fmt.date(s[0]) },
							{ name: 'Cash', cls: 'sdNum', value: (s) => fmt.money(s[1]) },
							{ name: 'Fans', cls: 'sdNum', value: (s) => fmt.int(s[2]) },
						],
						snaps.slice().reverse(),
					),
			}),
		);

		const sales = SD.games.salesByMonth(company);
		body.appendChild(
			card({
				id: 'overview-sales',
				title: 'Game sales per month',
				subtitle: 'All releases, whole save',
				chart: (el) => {
					if (!sales.length) {
						el.appendChild(empty('No sales yet. Release a game to see its earnings here.'));
						return;
					}
					SD.charts.columns(el, {
						rows: sales,
						label: (r) => fmt.month(r.month),
						tooltipTitle: (r) => fmt.month(r.month),
						bars: [{ name: 'Game sales', color: colors.income, value: (r) => r.sales }],
						format: fmt.money,
						height: 190,
					});
				},
				table: () =>
					table(
						[
							{ name: 'Month', value: (r) => fmt.month(r.month) },
							{ name: 'Game sales', cls: 'sdNum', value: (r) => fmt.money(r.sales) },
						],
						sales.filter((r) => r.sales).reverse(),
					),
			}),
		);

		if (summary.best) {
			body.appendChild(
				note('star', [
					'Most profitable game: ',
					h('strong', { text: summary.best.title }),
					` (${fmt.signedMoney(summary.best.profit)}, score ${fmt.score(summary.best.score)})`,
				]),
			);
		}
	};

	// Registered by key; the dashboard reads SD.tabs when it renders, so load order does not matter.
	SD.tabs = SD.tabs || {};
	SD.tabs.overview = { name: 'Overview', order: 10, render };
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
