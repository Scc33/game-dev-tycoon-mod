// Evaluate in the running game (node scripts/cheat.mjs sandbox) before automated testing.
// Keeps this session's saves in memory, so test runs never touch real save slots or Steam
// Cloud. Undone by reloading or restarting the game.
//
// A save writes two things: the game data (DataStore.saveToSlotAsync) and, once that
// finishes, a small header shown in the load menu (DataStore.setValue under the slot's
// name, e.g. "auto", "2" or "2L1"). Both are redirected here.
(function () {
	if (window.__sdSandbox) return 'already sandboxed';
	const SLOT = /^(auto|\d+)(L\d+)?$/;
	const slots = {};
	const headers = {};
	const real = {
		saveToSlotAsync: DataStore.saveToSlotAsync,
		loadSlotAsync: DataStore.loadSlotAsync,
		setValue: DataStore.setValue,
		getValue: DataStore.getValue,
	};
	DataStore.saveToSlotAsync = function (slot, data, done) {
		slots[slot] = data;
		if (done) done();
	};
	DataStore.loadSlotAsync = function (slot, done) {
		if (slot in slots) done(slots[slot]);
		else real.loadSlotAsync.apply(this, arguments);
	};
	DataStore.setValue = function (key, value) {
		if (SLOT.test(key)) headers[key] = value;
		else real.setValue.apply(this, arguments);
	};
	DataStore.getValue = function (key) {
		return key in headers ? headers[key] : real.getValue.apply(this, arguments);
	};
	window.__sdSandbox = { slots, headers, real };
	return 'save slots sandboxed';
})();
