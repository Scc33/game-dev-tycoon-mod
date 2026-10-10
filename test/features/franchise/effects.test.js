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

function setup() {
	const store = { data: {} };
	const handlers = {};
	const notes = [];
	class Notification {
		constructor(opts) {
			Object.assign(this, opts);
			notes.push(this);
		}
	}
	const SD = loadMod(FILES, {
		GDT: {
			getDataStore: () => store,
			on: (key, fn) => (handlers[key] = handlers[key] || []).push(fn),
			addEvent: () => {},
		},
		Notification,
	});
	return { SD, store, handlers, notes };
}

const rpg = { genre: { name: 'RPG' }, topic: { name: 'Fantasy' } };

// A two-game series (scores 8.5 and 9, 60 weeks apart) and a third entry in development.
const studio = (devOverrides = {}) => {
	const one = makeGame({ id: 'q1', title: 'Quest', releaseWeek: 0, score: 8.5, ...rpg });
	const two = makeGame({ id: 'q2', title: 'Quest 2', sequelTo: 'q1', releaseWeek: 60, score: 9, ...rpg });
	const dev = makeGame({
		id: 'q3',
		title: 'Quest 3',
		sequelTo: 'q2',
		releaseWeek: 0,
		hypePoints: 10,
		...rpg,
		...devOverrides,
	});
	return makeCompany([one, two], { currentWeek: 120, currentGame: dev, notifications: [] });
};

describe('franchise effects: launch hype', () => {
	let env;
	beforeEach(() => {
		env = setup();
	});

	it('adds hype from the series brand once the sequel concept is set', () => {
		const company = studio();
		const result = env.SD.franchise.effects.launchHype(company);
		assert.equal(result.hype, 140);
		assert.equal(company.currentGame.hypePoints, 150);
		assert.equal(result.kind, 'mainline');
		assert.equal(env.notes.length, 1);
		assert.match(env.notes[0].text, /Quest series.*Quest 3.*\+140 hype/s);
	});

	it('applies only once per game', () => {
		const company = studio();
		env.SD.franchise.effects.launchHype(company);
		env.SD.franchise.effects.launchHype(company);
		assert.equal(company.currentGame.hypePoints, 150);
		assert.equal(env.notes.length, 1);
	});

	it('records what it applied in the save data', () => {
		env.SD.franchise.effects.launchHype(studio());
		assert.deepEqual(plain(env.store.data.franchise.applied.q3), {
			kind: 'mainline',
			hype: 140,
			promised: 0,
			hypeWeek: 120,
			hypeBrand: 69.8,
			hypeFatigue: 0,
		});
	});

	it('gives a spin-off a share of the brand', () => {
		const result = env.SD.franchise.effects.launchHype(studio({ topic: { name: 'Space' } }));
		assert.equal(result.kind, 'spinoff');
		assert.equal(result.hype, 84);
	});

	it('waits until the concept is set', () => {
		const company = studio({ genre: undefined });
		assert.equal(env.SD.franchise.effects.launchHype(company), null);
		assert.equal(company.currentGame.hypePoints, 10);
	});

	it('skips expansion packs and standalone games', () => {
		assert.equal(env.SD.franchise.effects.launchHype(studio({ flags: { isExtensionPack: true } })), null);
		assert.equal(env.SD.franchise.effects.launchHype(studio({ sequelTo: null })), null);
	});

	it('respects the launch hype setting', () => {
		env.SD.settings.set('franchise.hype', false);
		const company = studio();
		assert.equal(env.SD.franchise.effects.launchHype(company), null);
		assert.equal(company.currentGame.hypePoints, 10);
	});

	it('ignores fatigue when it is switched off', () => {
		const tired = () => {
			const company = studio();
			company.currentWeek = 70; // ten weeks after Quest 2
			return company;
		};
		const withFatigue = env.SD.franchise.effects.launchHype(tired());
		const fresh = setup();
		fresh.SD.settings.set('franchise.fatigue', false);
		const without = fresh.SD.franchise.effects.launchHype(tired());
		assert.ok(withFatigue.hype < without.hype);
		assert.equal(without.hypeFatigue, 0);
	});

	it('runs every week once installed', () => {
		env.SD.franchise.effects.install({ gameplay: { weekProceeded: 'week', salesCalculated: 'sales' } });
		const company = studio();
		env.handlers.week.forEach((fn) => fn({ company }));
		assert.equal(company.currentGame.hypePoints, 150);
	});
});

describe('franchise effects: sales', () => {
	let env;
	beforeEach(() => {
		env = setup();
	});

	// The game has just released Quest 3: release week set, sales target calculated.
	const released = (overrides = {}) => {
		const company = studio({ releaseWeek: 121, totalSalesCash: 1000000, fansChangeTarget: 5000, ...overrides });
		return { company, game: company.currentGame };
	};

	it('scales the lifetime sales target and fan gain by brand and fatigue', () => {
		const { company, game } = released();
		const result = env.SD.franchise.effects.releaseSales(company, game);
		assert.equal(result.sales, 1.174);
		assert.equal(game.totalSalesCash, 1174479);
		assert.equal(game.fansChangeTarget, 5872);
		assert.equal(result.baseSales, 1000000);
	});

	it('leaves fan losses alone', () => {
		const { company, game } = released({ fansChangeTarget: -300 });
		env.SD.franchise.effects.releaseSales(company, game);
		assert.equal(game.fansChangeTarget, -300);
	});

	it('applies once, alongside the launch hype record', () => {
		const { company, game } = released();
		env.SD.franchise.effects.launchHype(company);
		env.SD.franchise.effects.releaseSales(company, game);
		env.SD.franchise.effects.releaseSales(company, game);
		assert.equal(game.totalSalesCash, 1174479);
		const record = plain(env.store.data.franchise.applied.q3);
		assert.equal(record.hype, 140);
		assert.equal(record.sales, 1.174);
	});

	it('only touches the company’s own release', () => {
		const { company } = released();
		const other = makeGame({ sequelTo: 'q2', totalSalesCash: 500 });
		assert.equal(env.SD.franchise.effects.releaseSales(company, other), null);
		assert.equal(env.SD.franchise.effects.releaseSales({ currentGame: other }, other), null);
		assert.equal(other.totalSalesCash, 500);
	});

	it('respects the sales setting', () => {
		env.SD.settings.set('franchise.sales', false);
		const { company, game } = released();
		assert.equal(env.SD.franchise.effects.releaseSales(company, game), null);
		assert.equal(game.totalSalesCash, 1000000);
	});

	it('runs on the game’s salesCalculated event', () => {
		env.SD.franchise.effects.install({ gameplay: { weekProceeded: 'week', salesCalculated: 'sales' } });
		const { company, game } = released();
		env.handlers.sales.forEach((fn) => fn({ company, game }));
		assert.equal(game.totalSalesCash, 1174479);
	});

	it('logs and skips a failure instead of breaking the release', () => {
		const warnings = [];
		env.SD.warn = (message) => warnings.push(message);
		env.SD.franchise.effects.install({ gameplay: { weekProceeded: 'week', salesCalculated: 'sales' } });
		env.handlers.sales.forEach((fn) =>
			fn({
				company: {
					get currentGame() {
						throw new Error('boom');
					},
				},
				game: {},
			}),
		);
		assert.equal(warnings.length, 1);
	});
});
