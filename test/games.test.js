import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeCompany, makeGame } from './helpers/fixtures.js';
import { loadMod, plain } from './helpers/load-mod.js';

const SD = loadMod(['src/core.js', 'src/games.js']);

describe('games.stats', () => {
	it('computes profit, ROI, peak week and break-even point', () => {
		const s = SD.games.stats(makeGame({ costs: 40000, revenue: 100000, salesCashLog: [20000, 30000, 30000] }));
		assert.equal(s.profit, 60000);
		assert.equal(s.roi, 1.5);
		assert.equal(s.peakWeek, 30000);
		assert.equal(s.breakEvenWeeks, 2);
	});

	it('leaves ROI and break-even empty when they do not apply', () => {
		const free = SD.games.stats(makeGame({ costs: 0 }));
		assert.equal(free.roi, null);
		assert.equal(free.breakEvenWeeks, null);
		const flop = SD.games.stats(makeGame({ costs: 500000, revenue: 1000, salesCashLog: [1000] }));
		assert.equal(flop.breakEvenWeeks, null);
		assert.ok(flop.roi < 0);
	});

	it('reads flags, names and the second genre', () => {
		const s = SD.games.stats(
			makeGame({
				genre: { name: 'RPG' },
				secondGenre: { name: 'Adventure' },
				topScoreRank: 3,
				topSalesRank: 3,
				soldOut: false,
				flags: { isExtensionPack: true, royaltyRate: 0.4, sequelsTooClose: true, usesSameEngineAsSequel: true },
			}),
		);
		assert.equal(s.genre, 'RPG-Adventure');
		assert.equal(s.topRank, 3);
		assert.equal(s.onSale, true);
		assert.equal(s.isPack, true);
		assert.equal(s.isPublished, true);
		assert.equal(s.tooClose, true);
		assert.equal(s.sameEngine, true);
	});
});

describe('games.salesByMonth', () => {
	it('places weekly sales in the months after release and fills gaps', () => {
		const company = makeCompany(
			[
				makeGame({ releaseWeek: 3, salesCashLog: [100, 200, 300] }), // weeks 4,5,6 -> month 1
				makeGame({ releaseWeek: 14, salesCashLog: [50] }), // week 15 -> month 3
			],
			{ currentWeek: 20 },
		);
		assert.deepEqual(plain(SD.games.salesByMonth(company)), [
			{ month: 1, sales: 600 },
			{ month: 2, sales: 0 },
			{ month: 3, sales: 50 },
			{ month: 4, sales: 0 },
			{ month: 5, sales: 0 },
		]);
	});

	it('is empty before the first sale', () => {
		assert.deepEqual(plain(SD.games.salesByMonth(makeCompany([]))), []);
	});
});

describe('games.summary', () => {
	it('totals released games, leaving expansion packs out', () => {
		const company = makeCompany([
			makeGame({ title: 'Hit', score: 9, revenue: 500000, costs: 100000 }),
			makeGame({ title: 'Flop', score: 3, revenue: 10000, costs: 60000 }),
			makeGame({ title: 'Pack', score: 8, revenue: 0, costs: 30000, flags: { isExtensionPack: true } }),
		]);
		const s = SD.games.summary(company);
		assert.equal(s.released, 2);
		assert.equal(s.revenue, 510000);
		assert.equal(s.profit, 350000);
		assert.equal(s.avgScore, 6);
		assert.equal(s.best.title, 'Hit');
	});

	it('handles a studio with no releases', () => {
		const s = SD.games.summary(makeCompany([]));
		assert.equal(s.released, 0);
		assert.equal(s.avgScore, null);
		assert.equal(s.best, null);
	});
});
