import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadMod, plain } from './helpers/load-mod.js';

const SD = loadMod(['src/core.js']);

describe('dateOf', () => {
	it('matches the game calendar (4 weeks/month, 12 months/year)', () => {
		assert.deepEqual(plain(SD.dateOf(0)), { year: 1, month: 1, week: 1 });
		assert.deepEqual(plain(SD.dateOf(23.4)), { year: 1, month: 6, week: 4 });
		assert.deepEqual(plain(SD.dateOf(48)), { year: 2, month: 1, week: 1 });
	});

	it('maps weeks to month indexes', () => {
		assert.equal(SD.monthIndex(3.9), 0);
		assert.equal(SD.monthIndex(4), 1);
		assert.equal(SD.monthIndex(95), 23);
	});
});

describe('fmt', () => {
	it('formats money compactly like the game HUD', () => {
		assert.equal(SD.fmt.money(850), '850');
		assert.equal(SD.fmt.money(41055), '41.1K');
		assert.equal(SD.fmt.money(2000000), '2M');
		assert.equal(SD.fmt.money(-2500000), '−2.5M');
		assert.equal(SD.fmt.money(NaN), '–');
	});

	it('signs positive amounts only when asked', () => {
		assert.equal(SD.fmt.signedMoney(1200), '+1.2K');
		assert.equal(SD.fmt.signedMoney(-1200), '−1.2K');
		assert.equal(SD.fmt.signedMoney(0), '0');
	});

	it('formats dates, months, scores and percentages', () => {
		assert.equal(SD.fmt.date(23), 'Y1 M6 W4');
		assert.equal(SD.fmt.month(13), 'Y2 M2');
		assert.equal(SD.fmt.score(4.29), '4.3');
		assert.equal(SD.fmt.score(0), '–');
		assert.equal(SD.fmt.percent(0.584), '58%');
		assert.equal(SD.fmt.percent(-1), '−100%');
		assert.equal(SD.fmt.int(1234567.4), '1,234,567');
		assert.equal(SD.fmt.percent(null), '–');
	});
});

describe('fmt inside the game', () => {
	// The game replaces toLocaleString with one that always prints two decimals.
	const inGame = loadMod(
		['src/core.js'],
		{},
		{
			prelude: 'Number.prototype.toLocaleString = function () { return this.toFixed(2); };',
		},
	);

	it('does not depend on Number.prototype.toLocaleString', () => {
		assert.equal(inGame.fmt.int(1234), '1,234');
		assert.equal(inGame.fmt.percent(0.58), '58%');
	});
});
