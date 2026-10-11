import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { makeCompany, makeGame } from '../../helpers/fixtures.js';
import { loadMod, plain } from '../../helpers/load-mod.js';

const FILES = [
	'src/core.js',
	'src/settings.js',
	'src/classify.js',
	'src/games.js',
	'src/franchises.js',
	'src/features/franchise/model.js',
	'src/features/franchise/store.js',
	'src/features/franchise/series.js',
	'src/features/franchise/effects.js',
	'src/features/franchise/events.js',
];

const SEQUELS = { name: 'Sequels' };

function setup() {
	const store = { data: {} };
	const events = {};
	class Notification {
		constructor(opts) {
			Object.assign(this, opts);
		}
		split() {
			return [this];
		}
	}
	const globals = {
		GDT: {
			getDataStore: () => store,
			on: () => {},
			addEvent: (e) => {
				events[e.id.replace('scc33-franchise-', '')] = e;
			},
		},
		GameManager: {},
		Notification,
		Research: { Sequels: SEQUELS },
	};
	const SD = loadMod(FILES, globals);
	SD.franchise.events.install();
	return { SD, store, events, globals };
}

const rpg = { genre: { name: 'RPG' }, topic: { name: 'Fantasy' } };
const quest = (extra = []) => [
	makeGame({ id: 'q1', title: 'Quest', releaseWeek: 0, score: 9, revenue: 2000000, ...rpg }),
	makeGame({ id: 'q2', title: 'Quest 2', sequelTo: 'q1', releaseWeek: 60, score: 9.5, revenue: 3000000, ...rpg }),
	...extra,
];
const studio = (week, games = quest(), overrides = {}) => {
	const company = makeCompany(games, {
		currentWeek: week,
		cash: 1000000,
		fans: 50000,
		researchCompleted: [SEQUELS],
		notifications: [],
		activeNotifications: {
			added: [],
			addRange(list) {
				this.added.push(...list);
			},
		},
		adjustCash(amount) {
			this.cash += amount;
		},
		adjustFans(amount) {
			this.fans += amount;
		},
		...overrides,
	});
	return company;
};

describe('fan events: fans want more', () => {
	let env;
	beforeEach(() => {
		env = setup();
	});

	it('fires 6 to 24 months after a great entry', () => {
		const V = env.SD.franchise.events;
		assert.equal(V.find(studio(110), 'tease').tail.title, 'Quest 2');
		assert.equal(V.find(studio(70), 'tease'), null);
		assert.equal(V.find(studio(170), 'tease'), null);
	});

	it('needs sequels to be researched and no sequel under way', () => {
		const V = env.SD.franchise.events;
		assert.equal(V.find(studio(110, quest(), { researchCompleted: [] }), 'tease'), null);
		const dev = makeGame({ id: 'q3', title: 'Quest 3', sequelTo: 'q2', releaseWeek: 0, ...rpg });
		assert.equal(V.find(studio(110, quest(), { currentGame: dev }), 'tease'), null);
	});

	it('offers a choice and remembers the offer in the save', () => {
		const company = studio(110);
		assert.equal(env.events.tease.trigger(company), true);
		const n = env.events.tease.getNotification(company);
		assert.equal(n.header, 'Fans want more');
		assert.deepEqual(plain(n.options), ['Tease a sequel', 'No comment']);
		assert.equal(n.sourceId, 'scc33-franchise-tease');
		assert.equal(env.store.data.franchise.offers.tease.series, 'q1');
		assert.equal(env.store.data.franchise.lastEventWeek, 110);
	});

	it('turns a tease into a promise the next entry collects', () => {
		const company = studio(110);
		env.events.tease.getNotification(company);
		env.globals.GameManager.company = company;
		env.events.tease.complete(0);
		const promise = env.SD.franchise.store.openPromise('q1');
		assert.equal(promise.hype, 50);
		assert.equal(promise.due, 214);
		assert.equal(company.activeNotifications.added.length, 1);

		company.currentGame = makeGame({
			id: 'q3',
			title: 'Quest 3',
			sequelTo: 'q2',
			releaseWeek: 0,
			hypePoints: 0,
			...rpg,
		});
		const record = env.SD.franchise.effects.launchHype(company);
		assert.equal(record.promised, 50);
		assert.equal(company.currentGame.hypePoints, record.hype + 50);
		assert.equal(promise.status, 'kept');
	});

	it('remembers a refusal and does not ask again about the same entry', () => {
		const company = studio(110);
		env.events.tease.getNotification(company);
		env.globals.GameManager.company = company;
		env.events.tease.complete(1);
		assert.equal(env.SD.franchise.store.openPromise('q1'), null);
		env.store.data.franchise.lastEventWeek = -100; // past the cooldown
		assert.equal(env.SD.franchise.events.find(company, 'tease'), null);
	});

	it('costs brand when the promise is broken', () => {
		const company = studio(110);
		env.events.tease.getNotification(company);
		env.globals.GameManager.company = company;
		env.events.tease.complete(0);
		const f = () => env.SD.franchises.all(company)[0];
		const before = env.SD.franchise.series.state(f(), 215).brand;
		company.currentWeek = 215;
		env.SD.franchise.events.onWeek(company);
		assert.equal(env.SD.franchise.store.events()[0].status, 'broken');
		assert.equal(Math.round((before - env.SD.franchise.series.state(f(), 215).brand) * 10) / 10, 5);
		assert.match(company.notifications[0].text, /promised a new Quest game/);
	});

	it('does not count a remaster as the promised new game', () => {
		const company = studio(110);
		env.events.tease.getNotification(company);
		env.globals.GameManager.company = company;
		env.events.tease.complete(0);
		company.gameLog.push(
			makeGame({
				id: 'q1r',
				title: 'Quest HD',
				releaseWeek: 150,
				score: 8,
				flags: { sdRemaster: { of: 'q1' } },
				...rpg,
			}),
		);
		company.currentWeek = 160;
		env.SD.franchise.events.onWeek(company);
		assert.equal(env.SD.franchise.store.events()[0].status, 'open');
	});

	it('keeps a promise once the next entry is under way', () => {
		const company = studio(110);
		env.events.tease.getNotification(company);
		env.globals.GameManager.company = company;
		env.events.tease.complete(0);
		company.currentGame = makeGame({ id: 'q3', title: 'Quest 3', sequelTo: 'q2', releaseWeek: 0, ...rpg });
		env.SD.settings.set('franchise.hype', false); // the weekly check keeps it even then
		env.SD.franchise.events.onWeek(company);
		assert.equal(env.SD.franchise.store.events()[0].status, 'kept');
	});
});

describe('fan events: pacing and settings', () => {
	let env;
	beforeEach(() => {
		env = setup();
	});

	it('waits a year between franchise events', () => {
		const company = studio(110);
		env.events.tease.getNotification(company);
		const V = env.SD.franchise.events;
		company.currentWeek = 150;
		assert.equal(V.find(company, 'revival'), null);
	});

	it('lets only one franchise event claim a week', () => {
		// Quest 2 qualifies for "fans want more"; a second series qualifies for the anniversary.
		const old = [
			makeGame({ id: 'r1', title: 'Racer', releaseWeek: 0, score: 9, ...rpg, topic: { name: 'Racing' } }),
			makeGame({
				id: 'r2',
				title: 'Racer 2',
				sequelTo: 'r1',
				releaseWeek: 440,
				score: 9,
				...rpg,
				topic: { name: 'Racing' },
			}),
		];
		const games = [
			...old,
			makeGame({ id: 'q1', title: 'Quest', releaseWeek: 400, score: 9, ...rpg }),
			makeGame({ id: 'q2', title: 'Quest 2', sequelTo: 'q1', releaseWeek: 440, score: 9.5, ...rpg }),
		];
		const company = studio(490, games);
		const fired = ['tease', 'anniversary', 'revival'].filter((type) => env.events[type].trigger(company));
		assert.equal(fired.length, 1);
	});

	it('stays quiet when fan events are switched off', () => {
		env.SD.settings.set('franchise.events', false);
		assert.equal(env.events.tease.trigger(studio(110)), false);
	});
});

describe('fan events: anniversary and revival', () => {
	let env;
	beforeEach(() => {
		env = setup();
	});

	const anniversaryStudio = () =>
		studio(
			490,
			quest([
				makeGame({ id: 'q3', title: 'Quest 3', sequelTo: 'q2', releaseWeek: 400, score: 8, revenue: 1000000, ...rpg }),
			]),
		);

	it('celebrates ten years of a well-loved series for 2% of its revenue', () => {
		const company = anniversaryStudio();
		const n = env.events.anniversary.getNotification(company);
		assert.equal(n.header, 'Quest turns 10');
		assert.deepEqual(plain(n.options), ['Celebrate (120K)', 'Let it pass']);
		env.globals.GameManager.company = company;
		env.events.anniversary.complete(0);
		assert.equal(company.cash, 1000000 - 120000);
		assert.equal(company.fans, 51000);
		assert.equal(env.SD.franchise.store.adjustments('q1')[0].brand, 10);
	});

	it('files the anniversary cost under marketing', () => {
		const parts = env.SD.classify.classify(
			'Quest anniversary',
			-120000,
			env.SD.classify.context(anniversaryStudio(), {}),
		);
		assert.equal(parts[0].cat, 'marketing');
	});

	it('asks for a revival of a loved series after four quiet years', () => {
		const company = studio(260);
		const V = env.SD.franchise.events;
		assert.equal(V.find(company, 'revival').series.name, 'Quest');
		env.events.revival.getNotification(company);
		env.globals.GameManager.company = company;
		env.events.revival.complete(0);
		assert.equal(env.SD.franchise.store.openPromise('q1').hype, 100);
	});

	it('includes standalone hits, if they stayed loved', () => {
		// A lone 10/10 starts at brand 75 and has faded to 61 after 200 weeks; a 9.5 would be at 55.
		const solo = makeGame({ id: 's1', title: 'Solo', releaseWeek: 0, score: 10, ...rpg });
		const company = studio(200, [solo]);
		assert.equal(env.SD.franchise.events.find(company, 'revival').series.name, 'Solo');
	});
});
