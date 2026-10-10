// Studio Dashboard tab: monthly income vs expenses and where the money goes.
((SD) => {
	const RANGES = [
		{ months: 12, label: 'Last 12 months' },
		{ months: 36, label: 'Last 3 years' },
		{ months: 0, label: 'All tracked' },
	];

	const render = (body, { company, state, refresh, card }) => {
		const { h, withSound, tile, tiles, table, legend, money, barList, panel, empty } = SD.dom;
		const fmt = SD.fmt;
		const colors = SD.charts.colors;
		if (state.months === undefined) state.months = 12;

		const d = SD.ledger.state(company);
		const to = SD.monthIndex(company.currentWeek);
		const first = SD.ledger.monthRange(d).first;
		const from = state.months ? Math.max(first, to - state.months + 1) : first;
		const rows = SD.ledger.monthly(d, from, to);
		const income = rows.reduce((s, r) => s + r.income, 0);
		const expenses = rows.reduce((s, r) => s + r.expenses, 0);

		body.appendChild(
			h(
				'div',
				{ class: 'sdFilters' },
				RANGES.map((range) =>
					h('button', {
						class: `sdChip${state.months === range.months ? ' sdChipActive' : ''}`,
						text: range.label,
						onclick: withSound(() => {
							state.months = range.months;
							refresh();
						}),
					}),
				),
			),
		);

		body.appendChild(
			tiles([
				tile('Income', fmt.money(income)),
				tile('Expenses', fmt.money(-expenses)),
				tile('Net', fmt.signedMoney(income + expenses), `${fmt.month(from)} – ${fmt.month(to)}`),
			]),
		);

		body.appendChild(
			card({
				id: 'cashflow-monthly',
				title: 'Income and expenses per month',
				subtitle: SD.dashboard.trackedNote(d),
				legend: legend([
					{ name: 'Income', color: colors.income },
					{ name: 'Expenses', color: colors.expenses },
					{ name: 'Net', color: colors.net, line: true },
				]),
				chart: (el) =>
					SD.charts.columns(el, {
						rows,
						label: (r) => fmt.month(r.month),
						tooltipTitle: (r) => fmt.month(r.month),
						bars: [
							{ name: 'Income', color: colors.income, value: (r) => r.income },
							{
								name: 'Expenses',
								color: colors.expenses,
								value: (r) => r.expenses,
								tooltipFormat: (v) => fmt.money(-v),
							},
						],
						line: { name: 'Net', color: colors.net, value: (r) => r.net, tooltipFormat: fmt.signedMoney },
						format: fmt.money,
						height: 230,
					}),
				table: () =>
					table(
						[
							{ name: 'Month', value: (r) => fmt.month(r.month) },
							{ name: 'Income', cls: 'sdNum', value: (r) => fmt.money(r.income) },
							{ name: 'Expenses', cls: 'sdNum', value: (r) => fmt.money(-r.expenses) },
							{ name: 'Net', cls: 'sdNum', value: (r) => money(r.net, { signed: true }) },
						],
						rows.slice().reverse(),
					),
			}),
		);

		const split = SD.ledger.breakdown(d, from, to);
		body.appendChild(
			h('div', { class: 'sdColumns' }, [
				panel('Where the money came from', null, [
					split.income.length ? barList(split.income, colors.income) : empty('No income in this period.'),
				]),
				panel('Where the money went', null, [
					split.expenses.length ? barList(split.expenses, colors.expenses) : empty('No expenses in this period.'),
				]),
			]),
		);
	};

	// Registered by key; the dashboard reads SD.tabs when it renders, so load order does not matter.
	SD.tabs = SD.tabs || {};
	SD.tabs.cashflow = { name: 'Cash flow', order: 20, render };
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
