import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { loadMod } from './helpers/load-mod.js';

// A stand-in for the game's GDT event bus and the bits of game state hooks.js touches.
function setup() {
	const handlers = {};
	const store = { data: {} };
	const company = { currentWeek: 4, cash: 1000, fans: 0, gameLog: [], staff: [], booths: [], engines: [], cashLog: [] };
	const globals = {
		GDT: {
			eventKeys: {
				saves: { loading: 'saves.loading', loaded: 'saves.loaded', newGame: 'saves.newGame' },
				gameplay: { weekProceeded: 'gameplay.weekProceeded' },
				ui: { contextMenuShowing: 'ui.contextMenuShowing' },
			},
			on: (key, fn) => (handlers[key] = handlers[key] || []).push(fn),
			getDataStore: () => store,
		},
		GameManager: { company, createEngine: () => 'engine' },
		Sound: { click() {} },
	};
	const SD = loadMod(['src/core.js', 'src/classify.js', 'src/ledger.js', 'src/hooks.js'], globals);
	SD.assetPath = './mods/StudioDashboard';
	SD.dashboard = { open() {} };
	const fire = (key, data) => (handlers[key] || []).forEach((fn) => fn(data));
	return { SD, fire, store, company, globals };
}

describe('hooks', () => {
	let env;
	beforeEach(() => {
		env = setup();
		env.SD.hooks.install();
	});

	it('starts recording the running company straight away', () => {
		env.company.cashLog.push({ amount: 50, label: 'contract payment' });
		assert.equal(env.SD.ledger.state(env.company).recent.length, 1);
	});

	it('resets the ledger when loading a save without data for this mod', () => {
		env.store.data = { v: 1, since: 0, months: { 1: {} }, recent: [], snaps: [] };
		env.fire('saves.loading', { data: { modData: {} } });
		assert.deepEqual(Object.keys(env.store.data), []);
	});

	it('keeps the ledger when the save has data for this mod', () => {
		const saved = { v: 1, since: 0, months: {}, recent: [], snaps: [] };
		env.store.data = saved;
		env.fire('saves.loading', { data: { modData: { [env.SD.MOD_ID]: saved } } });
		assert.equal(env.store.data, saved);
	});

	it('reconciles and snapshots every week', () => {
		env.company.cash = 1500;
		env.fire('gameplay.weekProceeded', { company: env.company });
		const d = env.SD.ledger.state(env.company);
		assert.equal(d.snaps.length, 1);
		assert.equal(d.recent[d.recent.length - 1][2], 'Untracked change');
	});

	it('adds the dashboard to the office menus only', () => {
		const primary = { type: 'primary', items: [] };
		const sales = { type: 'salesContainer', items: [] };
		env.fire('ui.contextMenuShowing', primary);
		env.fire('ui.contextMenuShowing', sales);
		assert.equal(primary.items.length, 1);
		assert.equal(primary.items[0].label, 'Studio Dashboard...');
		assert.equal(primary.items[0].icon, './mods/StudioDashboard/img/icon.svg');
		assert.equal(sales.items.length, 0);
	});

	it('files new engine spending under research', () => {
		env.globals.GameManager.createEngine = function () {
			env.company.cashLog.push({ amount: -2000, label: 'Brand New Engine' });
		};
		// install() is idempotent, so wrap the replacement the way install() wraps the original
		env.SD.classify.wrapWithCategory(env.globals.GameManager, 'createEngine', 'research');
		env.globals.GameManager.createEngine();
		const d = env.SD.ledger.state(env.company);
		assert.equal(d.recent[d.recent.length - 1][3], 'research');
	});

	it('installs only once', () => {
		env.SD.hooks.install();
		const primary = { type: 'primary', items: [] };
		env.fire('ui.contextMenuShowing', primary);
		assert.equal(primary.items.length, 1);
	});
});

describe('hooks: gameplay features', () => {
	it('installs every feature, even when one fails', () => {
		const env = setup();
		const installed = [];
		const warnings = [];
		env.SD.warn = (message) => warnings.push(message);
		env.SD.features = {
			broken: {
				install() {
					throw new Error('boom');
				},
			},
			working: { install: (keys) => installed.push(keys.gameplay.weekProceeded) },
		};
		env.SD.hooks.install();
		assert.deepEqual(installed, ['gameplay.weekProceeded']);
		assert.equal(warnings.length, 1);
		assert.match(warnings[0], /broken/);
	});
});
