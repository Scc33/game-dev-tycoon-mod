// Evaluate in the running game (node scripts/cdp.mjs evalfile scripts/sandbox-saves.js) before
// automated testing. Redirects save-slot writes/reads to memory for this session only, so
// test runs never overwrite real save slots or Steam Cloud. Undone by restarting the game.
(function () {
	if (window.__sdSandbox) return 'already sandboxed';
	const slots = {};
	const realSave = DataStore.saveToSlotAsync;
	const realLoad = DataStore.loadSlotAsync;
	DataStore.saveToSlotAsync = function (slot, data, done) {
		slots[slot] = data;
		if (done) done();
	};
	DataStore.loadSlotAsync = function (slot, done) {
		if (slot in slots) done(slots[slot]);
		else realLoad.apply(this, arguments);
	};
	window.__sdSandbox = { slots, realSave, realLoad };
	return 'save slots sandboxed';
})();
