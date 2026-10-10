import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadMod, plain } from '../../helpers/load-mod.js';

const setup = (data = {}) => {
	const store = { data };
	const SD = loadMod(['src/core.js', 'src/features/franchise/store.js'], { GDT: { getDataStore: () => store } });
	return { S: SD.franchise.store, store };
};

describe('franchise store', () => {
	it('creates its data under the mod data, next to other features', () => {
		const { S, store } = setup({ v: 1, settings: {} });
		S.record('g1', { hype: 40 });
		assert.deepEqual(plain(store.data.franchise), { v: 1, applied: { g1: { hype: 40 } }, events: [] });
		assert.deepEqual(plain(store.data.settings), {});
	});

	it('merges records per game', () => {
		const { S } = setup();
		S.record('g1', { hype: 40 });
		S.record('g1', { sales: 1.1 });
		assert.deepEqual(plain(S.applied('g1')), { hype: 40, sales: 1.1 });
		assert.equal(S.applied('nope'), null);
	});

	it('turns fan events with a brand change into model adjustments', () => {
		const { S } = setup();
		S.addEvent({ type: 'anniversary', series: 'a', week: 500, brand: 10 });
		S.addEvent({ type: 'tease', series: 'a', week: 520, status: 'open', hype: 50 });
		S.addEvent({ type: 'anniversary', series: 'b', week: 510, brand: 10 });
		assert.deepEqual(plain(S.adjustments('a')), [{ week: 500, kind: 'adjust', brand: 10 }]);
		assert.equal(S.openPromise('a').hype, 50);
		assert.equal(S.openPromise('b'), null);
	});

	it('upgrades data saved before events existed', () => {
		const { S } = setup({ franchise: { v: 1, applied: { g1: { hype: 1 } } } });
		assert.deepEqual(plain(S.events()), []);
		assert.equal(S.applied('g1').hype, 1);
	});
});
