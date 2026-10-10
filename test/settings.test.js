import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadMod, plain } from './helpers/load-mod.js';

const setup = (data) => {
	const store = { data };
	const SD = loadMod(['src/core.js', 'src/settings.js'], { GDT: { getDataStore: () => store } });
	SD.options.b = { group: 'G', name: 'B', default: true, order: 2 };
	SD.options.a = { group: 'G', name: 'A', default: false, order: 1 };
	return { SD, store };
};

describe('settings', () => {
	it('falls back to each option’s default', () => {
		const { SD } = setup({});
		assert.equal(SD.settings.get('a'), false);
		assert.equal(SD.settings.get('b'), true);
		assert.equal(SD.settings.get('unknown'), undefined);
	});

	it('stores choices in the save’s mod data', () => {
		const { SD, store } = setup({ v: 1 });
		SD.settings.set('b', false);
		assert.equal(SD.settings.get('b'), false);
		assert.deepEqual(plain(store.data), { v: 1, settings: { b: false } });
	});

	it('creates the data object on a fresh store', () => {
		const { SD, store } = setup(undefined);
		SD.settings.set('a', true);
		assert.deepEqual(plain(store.data), { settings: { a: true } });
	});

	it('lists options in their declared order', () => {
		const { SD } = setup({});
		assert.deepEqual(plain(SD.settings.list().map((o) => o.id)), ['a', 'b']);
	});
});
