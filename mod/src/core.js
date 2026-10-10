// Studio Dashboard: shared namespace, persistence access and formatting helpers.
// Every file attaches to the same global namespace and only touches other modules at
// call time, because GDT.loadJs does not guarantee script execution order.
((SD) => {
	SD.MOD_ID = 'scc33-studio-dashboard';
	SD.SCHEMA = 1;
	SD.WEEKS_PER_MONTH = 4;
	SD.MONTHS_PER_YEAR = 12;
	// Releasing a sequel within this many weeks of its predecessor triggers the game's
	// "sequelsTooClose" review and hype penalty.
	SD.SEQUEL_GAP_WEEKS = 40;

	// The modAPI swaps store.data on load and resets it on new game, so never cache it.
	SD.getStore = () => GDT.getDataStore(SD.MOD_ID);

	SD.warn = (message, error) => {
		if (typeof Logger !== 'undefined' && Logger.LogWarning) Logger.LogWarning(`[StudioDashboard] ${message}`, error);
		else console.warn(`[StudioDashboard] ${message}`, error);
	};

	// Game time: 4 weeks per month, 12 months per year, year 1 starts at week 0.
	// Mirrors Company.getDate in the game code.
	SD.dateOf = (week) => {
		const w = Math.floor(week);
		const m = Math.floor(w / SD.WEEKS_PER_MONTH);
		return {
			year: Math.floor(m / SD.MONTHS_PER_YEAR) + 1,
			month: (m % SD.MONTHS_PER_YEAR) + 1,
			week: (w % SD.WEEKS_PER_MONTH) + 1,
		};
	};

	SD.monthIndex = (week) => Math.floor(Math.floor(week) / SD.WEEKS_PER_MONTH);

	const oneDecimal = (v) => {
		const r = Math.round(v * 10) / 10;
		return r % 1 === 0 ? r.toFixed(0) : r.toFixed(1);
	};

	SD.fmt = {
		date(week) {
			const d = SD.dateOf(week);
			return `Y${d.year} M${d.month} W${d.week}`;
		},

		month(monthIndex) {
			return `Y${Math.floor(monthIndex / SD.MONTHS_PER_YEAR) + 1} M${(monthIndex % SD.MONTHS_PER_YEAR) + 1}`;
		},

		// Compact money in the game's own style (41.1K, 2.5M); no currency symbol, like the HUD.
		money(n) {
			if (n === null || n === undefined || Number.isNaN(n)) return '–';
			const abs = Math.abs(n);
			const sign = n < 0 ? '−' : '';
			if (abs >= 1e9) return `${sign}${oneDecimal(abs / 1e9)}B`;
			if (abs >= 1e6) return `${sign}${oneDecimal(abs / 1e6)}M`;
			if (abs >= 1e3) return `${sign}${oneDecimal(abs / 1e3)}K`;
			return `${sign}${Math.round(abs)}`;
		},

		signedMoney(n) {
			return (n > 0 ? '+' : '') + SD.fmt.money(n);
		},

		int(n) {
			return Math.round(n).toLocaleString('en-US');
		},

		percent(ratio) {
			if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return '–';
			return `${Math.round(ratio * 100).toLocaleString('en-US')}%`;
		},

		score(score) {
			return score ? (Math.round(score * 10) / 10).toFixed(1) : '–';
		},
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
