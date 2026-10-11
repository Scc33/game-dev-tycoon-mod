import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { loadMod, plain } from './helpers/load-mod.js';

// Stand-ins for the game classes and lists the cheats use.
function setup() {
	const company = {
		currentWeek: 300.5,
		cash: 0,
		fans: 0,
		gameLog: [],
		researchCompleted: [],
		topics: [],
		conferenceHype: 40,
		adjustCash(amount) {
			this.cash += amount;
		},
		adjustFans(amount) {
			this.fans += amount;
		},
	};
	let id = 0;
	class Game {
		constructor(c) {
			this.id = `g${++id}`;
			this.flags = {};
			this.hypePoints = c.conferenceHype || 0;
			c.conferenceHype = 0;
		}
	}
	const genres = [{ name: 'Action' }, { name: 'RPG' }];
	const globals = {
		GameManager: {
			company,
			_timeModifier: 1,
			_oldTimeModifier: 1,
			isGamePaused: () => false,
			gameTime: 1000,
			SECONDS_PER_WEEK: 4,
			finishResearch: (staff) => {
				finished.push(staff.id);
			},
		},
		Game,
		GameGenre: { getAll: () => genres },
		Topics: { topics: [{ name: 'Space' }, { name: 'Fantasy' }] },
		Platforms: { allPlatforms: [{ id: 'PC', name: 'PC' }] },
		Sales: { getUnitPrice: () => 10 },
		GameState: { released: 4 },
		Research: { Sequels: { name: 'Sequels' }, expansionPack: { name: 'Expansion packs' } },
	};
	const finished = [];
	const SD = loadMod(['src/dev/cheats.js'], globals);
	return { SD, company, globals, finished };
}

describe('developer cheats', () => {
	let env;
	beforeEach(() => {
		env = setup();
	});

	it('adds money and fans', () => {
		assert.equal(env.SD.dev.cash(5000), 5000);
		assert.equal(env.SD.dev.fans(), 100000);
	});

	it('unlocks research once', () => {
		assert.deepEqual(plain(env.SD.dev.unlock('sequels')), ['Sequels', 'Expansion packs']);
		assert.deepEqual(plain(env.SD.dev.unlock('sequels')), []);
		assert.equal(env.SD.dev.unlocked('sequels'), true);
	});

	it('sets the game speed, or queues it while paused', () => {
		env.SD.dev.speed(10);
		assert.equal(env.globals.GameManager._timeModifier, 10);
		env.globals.GameManager.isGamePaused = () => true;
		env.SD.dev.speed(4);
		assert.equal(env.globals.GameManager._oldTimeModifier, 4);
		assert.equal(env.SD.dev.currentSpeed(), 4);
	});

	it('builds a released game the game can read', () => {
		const g = env.SD.dev.addGame({ title: 'Solo', score: 8, week: 100, genre: 'RPG', topic: 'Fantasy' });
		assert.equal(g.releaseWeek, 100);
		assert.equal(g.genre.name, 'RPG');
		assert.equal(g.topic.name, 'Fantasy');
		assert.equal(g.reviews.length, 4);
		assert.equal(g.soldOut, true);
		assert.equal(g.salesCashLog.length, 10);
		assert.equal(g.unitsSold, g.revenue / 10);
		assert.equal(env.company.gameLog.length, 1);
		assert.deepEqual(plain(env.company.topics.map((t) => t.name)), ['Fantasy']);
	});

	it('leaves pending conference hype with the company', () => {
		const g = env.SD.dev.addGame({ title: 'Solo' });
		assert.equal(g.hypePoints, 0);
		assert.equal(env.company.conferenceHype, 40);
	});

	it('chains a series ending the given number of weeks ago', () => {
		const titles = env.SD.dev.addSeries({
			name: 'Quest',
			entries: [{ score: 8 }, { score: 9, gap: 60 }, { score: 7, gap: 50 }],
			ago: 20,
		});
		assert.deepEqual(plain(titles), ['Quest', 'Quest 2', 'Quest 3']);
		const [a, b, c] = env.company.gameLog;
		assert.deepEqual(plain([a.releaseWeek, b.releaseWeek, c.releaseWeek]), [170, 230, 280]);
		assert.equal(b.sequelTo, a.id);
		assert.equal(c.sequelTo, b.id);
	});

	it('refuses history from before the company was founded', () => {
		assert.throws(() => env.SD.dev.addGame({ week: -5 }), /5 weeks before the company was founded/);
		assert.throws(
			() => env.SD.dev.addSeries({ entries: [{ score: 8 }, { score: 8, gap: 400 }], ago: 0 }),
			/100 weeks before/,
		);
		assert.equal(env.company.gameLog.length, 0);
	});

	it('keeps the release history in order', () => {
		env.SD.dev.addGame({ title: 'Later', week: 200 });
		env.SD.dev.addGame({ title: 'Earlier', week: 100 });
		assert.deepEqual(plain(env.company.gameLog.map((g) => g.title)), ['Earlier', 'Later']);
	});

	it('is hidden behind a setting that is off by default', () => {
		assert.equal(env.SD.options['dev.tools'].default, false);
	});

	it('skips time forward for the game to catch up on', () => {
		assert.equal(env.SD.dev.skipWeeks(48), 48);
		assert.equal(env.globals.GameManager.gameTime, 1000 + 48 * 4000);
		assert.throws(() => env.SD.dev.skipWeeks(0), /positive/);
	});

	it('finishes remaster work underway through the game', () => {
		assert.equal(env.SD.dev.canFinishRemaster(), false);
		env.SD.remaster = { project: { TRAINING_ID: 'sdRemaster' } };
		env.company.staff = [{ id: 'a' }, { id: 'b', currentResearch: { id: 'sdRemaster' } }];
		assert.equal(env.SD.dev.canFinishRemaster(), true);
		assert.equal(env.SD.dev.finishRemaster(), true);
		assert.deepEqual(env.finished, ['b']);
	});
});
