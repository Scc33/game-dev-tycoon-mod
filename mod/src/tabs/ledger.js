// Studio Dashboard tab: the most recent individual transactions.
((SD) => {
	const render = (body, { company, state, refresh }) => {
		const { h, table, money, empty } = SD.dom;
		const fmt = SD.fmt;
		const d = SD.ledger.state(company);
		const filter = state.filter || 'all';

		const present = new Set(d.recent.map((r) => r[3]));
		const select = h('select', { class: 'sdSelect', 'aria-label': 'Category' }, [
			h('option', { value: 'all', text: 'All categories' }),
			...SD.classify.CATEGORIES.filter((c) => present.has(c.id)).map((c) =>
				h('option', { value: c.id, text: c.name, selected: filter === c.id ? 'selected' : null }),
			),
		]);
		select.addEventListener('change', () => {
			state.filter = select.value;
			refresh();
		});
		body.appendChild(
			h('div', { class: 'sdFilters' }, [
				select,
				h('span', {
					class: 'sdMuted',
					text: `Latest ${SD.ledger.RECENT_MAX} transactions. ${SD.dashboard.trackedNote(d)}`,
				}),
			]),
		);

		const rows = d.recent.filter((r) => filter === 'all' || r[3] === filter).reverse();
		if (!rows.length) {
			body.appendChild(empty('No transactions recorded yet. Let a few in-game weeks pass.'));
			return;
		}
		body.appendChild(
			table(
				[
					{ name: 'Date', value: (r) => fmt.date(r[0]) },
					{ name: 'Description', value: (r) => r[2] },
					{ name: 'Category', value: (r) => SD.classify.categoryName(r[3]) },
					{ name: 'Amount', cls: 'sdNum', value: (r) => money(r[1], { signed: true }) },
				],
				rows,
			),
		);
	};

	// Registered by key; the dashboard reads SD.tabs when it renders, so load order does not matter.
	SD.tabs = SD.tabs || {};
	SD.tabs.ledger = { name: 'Ledger', order: 50, render };
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
