import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadMod, plain } from '../../helpers/load-mod.js';

const SD = loadMod(['src/core.js', 'src/features/franchise/model.js']);
const M = SD.franchise.model;

const mainline = (week, score) => ({ week, score, kind: 'mainline' });
const spinoff = (week, score) => ({ week, score, kind: 'spinoff' });

// Effects each entry after the first received, as [hype, sales rounded to 2 places].
const effectsPerEntry = (entries) => {
	const { history } = M.evolve(entries, entries[entries.length - 1].week);
	return plain(
		history.slice(1).map((point, i) => {
			const fx = M.effects(point.before, entries[i + 1].kind);
			return [fx.hype, Math.round(fx.sales * 100) / 100];
		}),
	);
};

describe('franchise model: scenarios from the design doc', () => {
	it('rewards a healthy series', () => {
		const entries = [mainline(0, 8.5), mainline(60, 9), mainline(120, 8.5), mainline(180, 8.5)];
		assert.deepEqual(effectsPerEntry(entries), [
			[110, 1.13],
			[140, 1.17],
			[141, 1.17],
		]);
	});

	it('wears out a yearly release', () => {
		const entries = [0, 48, 96, 144, 192, 240].map((w) => mainline(w, 8));
		assert.deepEqual(effectsPerEntry(entries), [
			[90, 1.07],
			[93, 1.03],
			[87, 0.98],
			[77, 0.93],
			[66, 0.87],
		]);
	});

	it('punishes a weak streak', () => {
		const entries = [mainline(0, 8), mainline(52, 5.5), mainline(104, 5.5), mainline(156, 8)];
		assert.deepEqual(effectsPerEntry(entries), [
			[92, 1.08],
			[49, 0.9],
			[23, 0.74],
		]);
	});

	it('keeps half the brand through a long silence', () => {
		const entries = [mainline(0, 9), mainline(60, 9), mainline(60 + 384, 8)];
		assert.deepEqual(effectsPerEntry(entries), [
			[125, 1.16],
			[73, 1.09],
		]);
	});

	it('lets a spin-off fill the gap between mainline entries', () => {
		const entries = [mainline(0, 9), spinoff(40, 8), mainline(90, 9)];
		assert.deepEqual(effectsPerEntry(entries), [
			[75, 1.09],
			[128, 1.16],
		]);
	});
});

describe('franchise model: rules', () => {
	it('maps scores to quality between 4 and 10', () => {
		assert.equal(M.quality(10), 100);
		assert.equal(M.quality(7), 50);
		assert.equal(M.quality(4), 0);
		assert.equal(M.quality(2), 0);
		assert.equal(M.quality(11), 100);
	});

	it('starts a series at three quarters of its first entry', () => {
		const s = M.evolve([mainline(0, 10)], 0);
		assert.equal(s.brand, 75);
		assert.equal(s.fatigue, 20); // +40, −20 for a great entry
	});

	it('recovers fatigue at 2.5 a month', () => {
		const s = M.evolve([mainline(0, 8)], 32);
		assert.equal(s.fatigue, 20);
		assert.equal(M.evolve([mainline(0, 8)], 200).fatigue, 0);
	});

	it('fades the brand only after three years, down to half', () => {
		const brandAt = (week) => M.evolve([mainline(0, 10)], week).brand;
		assert.equal(brandAt(144), 75);
		assert.equal(brandAt(144 + 40), 65);
		assert.equal(brandAt(144 + 4000), 37.5);
	});

	it('ignores expansion packs and future entries', () => {
		const s = M.evolve([mainline(0, 10), { week: 20, score: 3, kind: 'pack' }, mainline(500, 3)], 100);
		assert.equal(s.history.length, 1);
		assert.equal(s.brand, 75);
	});

	it('applies brand changes from fan events in time order', () => {
		const boost = { week: 50, kind: 'adjust', brand: 10 };
		assert.equal(M.evolve([mainline(0, 10), boost], 60).brand, 85);
		assert.equal(M.evolve([mainline(0, 10), boost], 40).brand, 75); // not yet
		assert.equal(M.evolve([mainline(0, 10), { week: 50, kind: 'adjust', brand: 40 }], 60).brand, 100);
		assert.equal(M.evolve([mainline(0, 10), { week: 50, kind: 'adjust', brand: -90 }], 60).brand, 0);
	});

	it('ignores brand changes before the first release and keeps them out of the history', () => {
		const s = M.evolve(
			[{ week: 0, kind: 'adjust', brand: 30 }, mainline(10, 10), { week: 20, kind: 'adjust', brand: -5 }],
			30,
		);
		assert.equal(s.brand, 70);
		assert.equal(s.history.length, 1);
	});

	it('lets a later fade start from the adjusted brand', () => {
		const s = M.evolve([mainline(0, 10), { week: 10, kind: 'adjust', brand: 10 }], 144 + 40);
		assert.equal(s.brand, 75);
	});

	it('sorts entries by release week', () => {
		const a = M.evolve([mainline(60, 9), mainline(0, 8.5)], 60);
		const b = M.evolve([mainline(0, 8.5), mainline(60, 9)], 60);
		assert.deepEqual(plain(a), plain(b));
	});

	it('gives nothing to an empty series or a pack', () => {
		assert.deepEqual({ ...M.effects(M.evolve([], 10)) }, { hype: 0, sales: 1 });
		assert.deepEqual({ ...M.effects({ brand: 80, fatigue: 0 }, 'pack') }, { hype: 0, sales: 1 });
	});

	it('bounds the effects', () => {
		const best = M.effects({ brand: 100, fatigue: 0 });
		const worst = M.effects({ brand: 0, fatigue: 100 });
		assert.deepEqual({ ...best }, { hype: 200, sales: 1.25 });
		assert.deepEqual({ ...worst }, { hype: 0, sales: 0.5 });
	});

	it('accepts tuning overrides', () => {
		const t = { ...M.TUNING, hypePerBrand: 1 };
		assert.equal(M.effects({ brand: 50, fatigue: 0 }, 'mainline', t).hype, 50);
	});
});

describe('franchise model: classification and labels', () => {
	const stats = (genre, topic, isPack = false) => ({ genre, topic, isPack });

	it('tells mainline entries, spin-offs and packs apart', () => {
		const original = stats('RPG', 'Fantasy');
		assert.equal(M.kindOf(stats('RPG', 'Fantasy'), original), 'mainline');
		assert.equal(M.kindOf(stats('Action-RPG', 'Fantasy'), original), 'spinoff');
		assert.equal(M.kindOf(stats('RPG', 'Space'), original), 'spinoff');
		assert.equal(M.kindOf(stats('RPG', 'Space', true), original), 'pack');
		assert.equal(M.kindOf(original, null), 'mainline');
	});

	it('names brand and fatigue levels', () => {
		assert.equal(M.brandLabel(0), 'Unknown');
		assert.equal(M.brandLabel(59.9), 'Popular');
		assert.equal(M.brandLabel(100), 'Legendary');
		assert.equal(M.fatigueLabel(10), 'Fresh');
		assert.equal(M.fatigueLabel(100), 'Worn out');
	});
});

describe('franchise model: remasters', () => {
	const remaster = (week, score) => ({ week, score, kind: 'remaster' });
	const r1 = (v) => Math.round(v * 10) / 10;

	it('is its own kind of entry', () => {
		assert.equal(M.kindOf({ isRemaster: true, genre: 'RPG', topic: 'Space' }, null), 'remaster');
	});

	it('pulls the brand 30% of the way to its quality and adds a little fatigue', () => {
		const state = M.evolve([mainline(0, 10), remaster(400, 7)], 400);
		// brand 75, faded to 50% after a long silence → 37.5; then 0.7 × 37.5 + 0.3 × 50
		assert.equal(r1(state.brand), 41.3);
		assert.equal(state.fatigue, 10);
	});

	it('can drag a strong brand down', () => {
		const state = M.evolve([mainline(0, 10), mainline(60, 10), remaster(100, 5)], 100);
		assert.ok(state.brand < M.evolve([mainline(0, 10), mainline(60, 10)], 100).brand);
	});

	it('restarts the dormancy clock', () => {
		const quiet = M.evolve([mainline(0, 9)], 300);
		const kept = M.evolve([mainline(0, 9), remaster(140, 9)], 300);
		assert.ok(quiet.brand < kept.brand);
		assert.equal(kept.lastWeek, 140);
	});
});
