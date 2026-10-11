// Studio Dashboard entry point. GDT.getRelativePath() and GDT.loadJs path resolution only
// work while this file is executing, so everything is kicked off synchronously here.
(() => {
	const SD = (globalThis.StudioDashboard = globalThis.StudioDashboard || {});
	SD.path = GDT.getRelativePath();
	// getRelativePath() prefixes "/" onto the page's chrome-extension:// URL, which is fine
	// for GDT.loadJs (it normalises paths) but breaks <img>/<link> URLs. Assets use the
	// page-relative form instead, e.g. "./mods/StudioDashboard".
	SD.assetPath = GDT.makeRelativeModPath(SD.path);

	// Loaded as one parallel batch (a second batch would advance the game's mod-loading
	// queue early), so execution order is not guaranteed: modules only use each other at
	// call time, and tabs register by key on SD.tabs.
	const scripts = [
		'src/core.js',
		'src/settings.js',
		'src/classify.js',
		'src/ledger.js',
		'src/games.js',
		'src/franchises.js',
		'src/features/franchise/model.js',
		'src/features/franchise/store.js',
		'src/features/franchise/series.js',
		'src/features/franchise/effects.js',
		'src/features/franchise/events.js',
		'src/features/remaster/model.js',
		'src/features/remaster/store.js',
		'src/features/remaster/project.js',
		'src/features/remaster/window.js',
		'src/features/remaster/feature.js',
		'src/charts.js',
		'src/ui/dom.js',
		'src/ui/dashboard.js',
		'src/tabs/overview.js',
		'src/tabs/cashflow.js',
		'src/tabs/games.js',
		'src/tabs/franchises.js',
		'src/tabs/remasters.js',
		'src/tabs/ledger.js',
		'src/tabs/settings.js',
		'src/dev/cheats.js',
		'src/tabs/developer.js',
		'src/hooks.js',
	];

	['dashboard.css', 'remaster.css'].forEach((file) => {
		const style = document.createElement('link');
		style.rel = 'stylesheet';
		style.href = `${SD.assetPath}/css/${file}`;
		document.head.appendChild(style);
	});

	GDT.loadJs(
		scripts.map((file) => `${SD.path}/${file}`),
		() => SD.hooks.install(),
		() => console.error('[StudioDashboard] failed to load one of its scripts'),
	);
})();
