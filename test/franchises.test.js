import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeCompany, makeGame } from './helpers/fixtures.js';
import { loadMod, plain } from './helpers/load-mod.js';

const SD = loadMod(['src/core.js', 'src/games.js', 'src/franchises.js']);

const series = () => {
	const one = makeGame({ id: 'p1', title: 'Pals', releaseWeek: 20, score: 7, revenue: 200000, costs: 50000 });
	const two = makeGame({
		id: 'p2',
		title: 'Pals 2',
		sequelTo: 'p1',
		releaseWeek: 50,
		score: 8.5,
		revenue: 400000,
		costs: 100000,
		flags: { sequelsTooClose: true },
	});
	const pack = makeGame({
		id: 'p2x',
		title: 'Pals 2: Extra',
		sequelTo: 'p2',
		releaseWeek: 100,
		score: 6,
		revenue: 0,
		costs: 30000,
		flags: { isExtensionPack: true },
	});
	const solo = makeGame({ id: 's1', title: 'Solo', releaseWeek: 30, score: 9, revenue: 300000, costs: 80000 });
	return [one, two, pack, solo];
};

describe('franchises.all', () => {
	it('groups sequels and packs under the original game, in release order', () => {
		const [f] = SD.franchises.all(makeCompany(series(), { currentWeek: 120 }));
		assert.equal(f.name, 'Pals');
		assert.deepEqual(plain(f.entries.map((e) => e.title)), ['Pals', 'Pals 2', 'Pals 2: Extra']);
		assert.equal(f.revenue, 600000);
		assert.equal(f.profit, 420000);
	});

	it('measures release gaps and flags sequels that came too soon', () => {
		const [f] = SD.franchises.all(makeCompany(series(), { currentWeek: 120 }));
		assert.equal(f.entries[0].gapWeeks, null);
		assert.equal(f.entries[1].gapWeeks, 30);
		assert.equal(f.entries[1].tooClose, true);
		assert.equal(f.entries[1].predecessor, 'Pals');
	});

	it('averages scores and tracks their trend, ignoring packs', () => {
		const [f] = SD.franchises.all(makeCompany(series(), { currentWeek: 120 }));
		assert.equal(f.avgScore, 7.75);
		assert.equal(f.scoreTrend, 1.5);
		assert.deepEqual([...f.scores], [7, 8.5]);
	});

	it('advises when the next sequel can release without the penalty', () => {
		const [f] = SD.franchises.all(makeCompany(series(), { currentWeek: 120 }));
		assert.equal(f.next.basedOn, 'Pals 2: Extra');
		assert.equal(f.next.safeFromWeek, 140);
		assert.equal(f.next.weeksUntilSafe, 20);
	});

	it('includes a sequel in development', () => {
		const current = makeGame({ id: 'p3', title: 'Pals 3', sequelTo: 'p2x', releaseWeek: 0 });
		const [f] = SD.franchises.all(makeCompany(series(), { currentWeek: 160, currentGame: current }));
		assert.equal(f.inDevelopment, true);
		assert.equal(f.entries[f.entries.length - 1].title, 'Pals 3');
		assert.equal(f.revenue, 600000);
	});

	it('ignores standalone games and survives broken links', () => {
		const orphan = makeGame({ id: 'o2', title: 'Orphan 2', sequelTo: 'missing' });
		assert.equal(SD.franchises.all(makeCompany([makeGame(), orphan])).length, 0);
	});
});

describe('repeat genre/topic warning', () => {
	const rpg = { genre: { name: 'RPG' }, topic: { name: 'Fantasy' } };

	it('warns when the series tail is also the latest release', () => {
		const one = makeGame({ id: 'q1', title: 'Quest', releaseWeek: 10, ...rpg });
		const two = makeGame({ id: 'q2', title: 'Quest 2', sequelTo: 'q1', releaseWeek: 70, ...rpg });
		const [f] = SD.franchises.all(makeCompany([one, two], { currentWeek: 120 }));
		assert.equal(f.next.repeatsLastRelease, true);
		assert.equal(f.next.combo, 'RPG/Fantasy');
	});

	it('clears once a different game has released since', () => {
		const one = makeGame({ id: 'q1', title: 'Quest', releaseWeek: 10, ...rpg });
		const two = makeGame({ id: 'q2', title: 'Quest 2', sequelTo: 'q1', releaseWeek: 70, ...rpg });
		const other = makeGame({ id: 'x', title: 'Racer', releaseWeek: 90 });
		const [f] = SD.franchises.all(makeCompany([one, two, other], { currentWeek: 120 }));
		assert.equal(f.next.repeatsLastRelease, false);
	});

	it('flags a sequel in development that repeats the latest release', () => {
		const one = makeGame({ id: 'q1', title: 'Quest', releaseWeek: 10, ...rpg });
		const dev = makeGame({ id: 'q2', title: 'Quest 2', sequelTo: 'q1', releaseWeek: 0, ...rpg });
		const [f] = SD.franchises.all(makeCompany([one], { currentGame: dev }));
		assert.equal(f.entries[1].repeatsLastRelease, true);
	});

	it('never flags an expansion pack, which the game exempts', () => {
		const one = makeGame({ id: 'q1', title: 'Quest', releaseWeek: 10, ...rpg });
		const dev = makeGame({
			id: 'q1x',
			title: 'Quest: More',
			sequelTo: 'q1',
			releaseWeek: 0,
			flags: { isExtensionPack: true },
			...rpg,
		});
		const [f] = SD.franchises.all(makeCompany([one], { currentGame: dev }));
		assert.equal(f.entries[1].repeatsLastRelease, false);
	});

	it('also checks sequel candidates', () => {
		const solo = makeGame({ id: 's', title: 'Solo', releaseWeek: 10, score: 9, revenue: 300000, ...rpg });
		const [pick] = SD.franchises.candidates(makeCompany([solo], { currentWeek: 100 }));
		assert.equal(pick.next.repeatsLastRelease, true);
	});
});

describe('franchises.candidates', () => {
	it('suggests well-reviewed, profitable standalone games', () => {
		const picks = SD.franchises.candidates(makeCompany(series(), { currentWeek: 60 }));
		assert.deepEqual(plain(picks.map((g) => g.title)), ['Solo']);
		assert.equal(picks[0].next.weeksUntilSafe, 10);
	});

	it('drops a game once a sequel is in development', () => {
		const current = makeGame({ id: 's2', title: 'Solo 2', sequelTo: 's1' });
		const picks = SD.franchises.candidates(makeCompany(series(), { currentGame: current }));
		assert.equal(picks.length, 0);
	});
});

describe('franchises: remasters', () => {
	const remasterOf = (id, overrides = {}) =>
		makeGame({
			id: `${id}r`,
			releaseWeek: 400,
			score: 9.5,
			flags: { sdRemaster: { of: id, tier: 'remaster' } },
			...overrides,
		});

	it('turns a remastered standalone game into a series', () => {
		const games = [...series(), remasterOf('s1', { title: 'Solo Remastered', revenue: 100000, costs: 20000 })];
		const solo = SD.franchises.all(makeCompany(games, { currentWeek: 420 })).find((f) => f.name === 'Solo');
		assert.deepEqual(plain(solo.entries.map((e) => e.title)), ['Solo', 'Solo Remastered']);
		assert.equal(solo.entries[1].original, 'Solo');
		assert.equal(solo.entries[1].gapWeeks, null);
		assert.equal(solo.revenue, 400000);
	});

	it('leaves remasters out of the scores and the next sequel', () => {
		const games = [...series(), remasterOf('p1', { title: 'Pals HD' })];
		const pals = SD.franchises.all(makeCompany(games, { currentWeek: 420 })).find((f) => f.name === 'Pals');
		assert.deepEqual([...pals.scores], [7, 8.5]);
		assert.equal(pals.next.basedOn, 'Pals 2: Extra');
	});

	it('never suggests a remaster as sequel material', () => {
		const games = [makeGame({ id: 'a', score: 6, revenue: 1000 }), remasterOf('a', { title: 'A HD' })];
		assert.equal(SD.franchises.candidates(makeCompany(games, { currentWeek: 420 })).length, 0);
	});
});
