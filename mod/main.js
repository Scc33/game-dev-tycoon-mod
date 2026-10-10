// Studio Dashboard entry point. GDT.getRelativePath() only works while this file is
// executing, so capture the mod's folder before loading anything asynchronously.
(() => {
	const SD = (globalThis.StudioDashboard = globalThis.StudioDashboard || {});
	SD.path = GDT.getRelativePath();

	const files = ['src/core.js'];

	GDT.loadJs(
		files.map((f) => `${SD.path}/${f}`),
		() => console.log('[StudioDashboard] loaded'),
		() => console.error('[StudioDashboard] failed to load one of its scripts'),
	);
})();
