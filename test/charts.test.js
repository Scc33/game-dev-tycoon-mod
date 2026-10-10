import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadMod, plain } from './helpers/load-mod.js';

const SD = loadMod(['src/core.js', 'src/charts.js']);

describe('charts.niceTicks', () => {
	it('rounds to clean steps that cover the range', () => {
		assert.deepEqual(plain(SD.charts.niceTicks(0, 41055, 4)), [0, 10000, 20000, 30000, 40000, 50000]);
		assert.deepEqual(plain(SD.charts.niceTicks(0, 7, 4)), [0, 2, 4, 6, 8]);
	});

	it('spans zero for diverging data', () => {
		const ticks = SD.charts.niceTicks(-30000, 90000, 4);
		assert.ok(ticks.includes(0));
		assert.ok(ticks[0] <= -30000);
		assert.ok(ticks[ticks.length - 1] >= 90000);
	});

	it('copes with a flat range', () => {
		const ticks = SD.charts.niceTicks(5, 5, 4);
		assert.ok(ticks.length >= 2);
		assert.ok(ticks[0] <= 5 && ticks[ticks.length - 1] >= 6);
	});
});

describe('charts.barPath', () => {
	it('rounds the data end and keeps the baseline square', () => {
		assert.equal(SD.charts.barPath(10, 20, 100, 40), 'M10,100V44Q10,40 14,40H26Q30,40 30,44V100Z');
	});

	it('grows downward for negative values', () => {
		assert.equal(SD.charts.barPath(10, 20, 100, 160), 'M10,100V156Q10,160 14,160H26Q30,160 30,156V100Z');
	});

	it('draws nothing for zero-height bars', () => {
		assert.equal(SD.charts.barPath(10, 20, 100, 100.2), '');
	});
});

describe('charts.labelStride', () => {
	it('skips labels that would collide', () => {
		assert.equal(SD.charts.labelStride(12, 600, 56), 2);
		assert.equal(SD.charts.labelStride(4, 600, 56), 1);
		assert.equal(SD.charts.labelStride(0, 600, 56), 1);
	});
});
