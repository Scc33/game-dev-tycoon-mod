import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeCompany, makeGame } from '../../helpers/fixtures.js';
import { loadMod, plain } from '../../helpers/load-mod.js';

const SD = loadMod([
	'src/core.js',
	'src/games.js',
	'src/franchises.js',
	'src/features/franchise/model.js',
	'src/features/franchise/series.js',
]);
const S = SD.franchise.series;

const rpg = { genre: { name: 'RPG' }, topic: { name: 'Fantasy' } };
const quest = (extra = []) => {
	const one = makeGame({ id: 'q1', title: 'Quest', releaseWeek: 0, score: 8.5, ...rpg });
	const two = makeGame({ id: 'q2', title: 'Quest 2', sequelTo: 'q1', releaseWeek: 60, score: 9, ...rpg });
	return [one, two, ...extra];
};
const seriesOf = (company) => SD.franchises.all(company)[0];

describe('franchise series', () => {
	it('classifies entries against their predecessor', () => {
		const spin = makeGame({
			id: 'q3',
			title: 'Quest Racing',
			sequelTo: 'q2',
			releaseWeek: 100,
			score: 7,
			genre: { name: 'Casual' },
			topic: { name: 'Fantasy' },
		});
		const f = seriesOf(makeCompany(quest([spin])));
		assert.deepEqual(plain(S.timeline(f).map((e) => e.kind)), ['mainline', 'mainline', 'spinoff']);
	});

	it('leaves the game in development out of the history', () => {
		const dev = makeGame({ id: 'q3', title: 'Quest 3', sequelTo: 'q2', releaseWeek: 0, ...rpg });
		const f = seriesOf(makeCompany(quest(), { currentGame: dev }));
		assert.equal(S.timeline(f).length, 2);
		const d = S.development(makeCompany(quest(), { currentGame: dev }));
		assert.equal(d.entry.title, 'Quest 3');
		assert.equal(d.kind, 'mainline');
	});

	it('outlines brand, fatigue and the next entry', () => {
		const o = S.outlook(seriesOf(makeCompany(quest())), 70);
		assert.equal(Math.round(o.brand), 70);
		assert.equal(o.brandLabel, 'Beloved');
		assert.equal(o.fatigue, 16.25);
		assert.equal(o.fatigueLabel, 'Fresh');
		assert.equal(o.restedInWeeks, 26);
		assert.equal(o.mainline.hype, 117);
		assert.equal(o.mainline.sales.toFixed(3), '1.079');
		assert.equal(o.spinoff.hype, 70);
		assert.deepEqual(plain(o.brandHistory.map(Math.round)), [56, 70]);
	});

	it('reads fatigue as zero when it is switched off', () => {
		const o = S.outlook(seriesOf(makeCompany(quest())), 70, { fatigue: false });
		assert.equal(o.fatigue, 0);
		assert.equal(o.restedInWeeks, 0);
		assert.equal(o.mainline.hype, 140);
	});
});
