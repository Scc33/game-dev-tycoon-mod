// Studio Dashboard: the cash ledger.
// The game reports each labelled cash movement by pushing {amount, label} onto
// company.cashLog, shows it as a floating "+12K" popup, then empties the array. Nothing
// keeps that history, so we intercept the pushes, categorise them and aggregate them per
// month into the save's mod data. A weekly reconciliation against the real balance books
// the few movements the game makes without a label, so the ledger always adds up.
((SD) => {
	const L = (SD.ledger = {});

	L.RECENT_MAX = 250;

	L.emptyState = (company) => ({
		v: SD.SCHEMA,
		since: company.currentWeek, // first week observed; earlier history is unknown
		lastCash: company.cash,
		pend: 0, // sum of movements recorded since the last weekly reconciliation
		months: {}, // monthIndex -> { category: [income, expenses] }, expenses negative
		recent: [], // [week, amount, label, category], newest last
		snaps: [], // [week, cash, fans], one per week
	});

	// The ledger owns the top level of the mod data; other features keep their own keys in
	// it (settings, franchise), which survive the ledger starting up.
	L.state = (company) => {
		const store = SD.getStore();
		if (!store.data || !store.data.v) store.data = { ...store.data, ...L.emptyState(company) };
		return store.data;
	};

	const addPart = (d, week, part) => {
		const m = SD.monthIndex(week);
		const bucket = d.months[m] || (d.months[m] = {});
		const cell = bucket[part.cat] || (bucket[part.cat] = [0, 0]);
		cell[part.amount >= 0 ? 0 : 1] += part.amount;
		d.recent.push([Math.round(week * 10) / 10, Math.round(part.amount), part.label, part.cat]);
		if (d.recent.length > L.RECENT_MAX) d.recent.splice(0, d.recent.length - L.RECENT_MAX);
	};

	L.record = (company, entry, ctx) => {
		const amount = Number(entry && entry.amount);
		if (!Number.isFinite(amount) || amount === 0) return;
		const label = entry.label === undefined || entry.label === null ? '' : String(entry.label);
		const d = L.state(company);
		SD.classify
			.classify(label, amount, ctx || SD.classify.context(company))
			.forEach((part) => addPart(d, company.currentWeek, part));
		d.pend += amount;
	};

	// Once per in-game week: book any unexplained cash change, then snapshot the balance.
	L.onWeek = (company) => {
		const d = L.state(company);
		const diff = company.cash - d.lastCash - d.pend;
		if (Math.abs(diff) >= 1) addPart(d, company.currentWeek, { cat: 'other', amount: diff, label: 'Untracked change' });
		d.pend = 0;
		d.lastCash = company.cash;
		const week = Math.floor(company.currentWeek);
		const snap = [week, Math.round(company.cash), company.fans || 0];
		const last = d.snaps[d.snaps.length - 1];
		if (last && last[0] === week) d.snaps[d.snaps.length - 1] = snap;
		else d.snaps.push(snap);
	};

	// Intercept pushes onto this company's cashLog. The array survives the UI emptying it
	// but is replaced when a save loads, so callers re-attach on load and new game.
	L.attach = (company) => {
		if (!company || !company.cashLog || company.cashLog.sdHooked) return;
		const log = company.cashLog;
		const push = log.push;
		Object.defineProperty(log, 'push', {
			configurable: true,
			writable: true,
			value(...entries) {
				entries.forEach((entry) => {
					try {
						L.record(company, entry);
					} catch (e) {
						SD.warn('could not record cash movement', e);
					}
				});
				return push.apply(this, entries);
			},
		});
		Object.defineProperty(log, 'sdHooked', { value: true });
	};

	// ---- Queries over a ledger state (pure) ----

	L.monthRange = (d) => {
		let first = SD.monthIndex(d.since);
		let last = d.snaps.length ? SD.monthIndex(d.snaps[d.snaps.length - 1][0]) : first;
		Object.keys(d.months).forEach((k) => {
			first = Math.min(first, Number(k));
			last = Math.max(last, Number(k));
		});
		return { first, last };
	};

	// One row per month in [from, to], including empty months so charts keep their spacing.
	L.monthly = (d, from, to) => {
		const rows = [];
		for (let m = from; m <= to; m++) {
			const bucket = d.months[m] || {};
			let income = 0;
			let expenses = 0;
			Object.values(bucket).forEach(([inc, exp]) => {
				income += inc;
				expenses += exp;
			});
			rows.push({ month: m, income, expenses, net: income + expenses });
		}
		return rows;
	};

	// Income and expense totals per category over [from, to], largest first. Expenses are
	// returned as positive amounts.
	L.breakdown = (d, from, to) => {
		const income = {};
		const expenses = {};
		for (let m = from; m <= to; m++) {
			Object.entries(d.months[m] || {}).forEach(([cat, [inc, exp]]) => {
				income[cat] = (income[cat] || 0) + inc;
				expenses[cat] = (expenses[cat] || 0) + exp;
			});
		}
		const list = (totals, sign) =>
			Object.keys(totals)
				.filter((cat) => Math.abs(totals[cat]) >= 1)
				.map((cat) => ({ cat, name: SD.classify.categoryName(cat), amount: totals[cat] * sign }))
				.sort((a, b) => b.amount - a.amount);
		return { income: list(income, 1), expenses: list(expenses, -1) };
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
