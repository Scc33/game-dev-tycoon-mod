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
	'src/features/remaster/model.js',
	'src/features/remaster/store.js',
	'src/features/remaster/project.js',
	'src/features/remaster/feature.js',
];

const YEAR = 48;
const PC = { id: 'PC', name: 'PC', developmentCosts: 20000, share: 0.3 };
const BOX = { id: 'BOX', name: 'Box', developmentCosts: 80000, share: 0.5 };
const OLD = { id: 'OLD', name: 'Old', developmentCosts: 5000, share: 0.2 }; // licensed, off the market
const NEW = { id: 'NEW', name: 'New', developmentCosts: 100000, share: 0.6 }; // on sale, not licensed

function setup() {
	const store = { data: {} };
	const handlers = {};
	const researched = [];
	const said = [];
	class Notification {
		constructor(opts) {
			Object.assign(this, opts);
		}
	}
	class Game {
		constructor(company) {
			this.id = `new-${company.gameLog.length}`;
			this.flags = {};
			this.salesCashLog = [];
			this.reviews = [];
			if (company.conferenceHype) {
				this.hypePoints = company.conferenceHype;
				company.conferenceHype = 0;
			}
		}
	}
	class Company {
		getPossibleGamesForSequel() {
			return this.gameLog;
		}
	}
	const globals = {
		GDT: {
			getDataStore: () => store,
			on: (key, fn) => (handlers[key] = handlers[key] || []).push(fn),
			addEvent: () => {},
		},
		GDTKeys: null,
		GameManager: {
			SECONDS_PER_WEEK: 4,
			uiSettings: {},
			research: (item, type) => {
				const staff = globals.GameManager.company.staff.find(
					(s) => s.id === globals.GameManager.uiSettings.selectedChar,
				);
				staff.currentResearch = { id: item.id, duration: item.duration, type };
				researched.push({ id: item.id, duration: item.duration, type, staffId: staff.id });
			},
		},
		General: { getMonthlyCosts: () => 50000 },
		Platforms: {
			getPlatformsOnMarket: () => [PC, BOX, NEW],
			getTotalMarketSizePercent: (p) => p.share,
		},
		Game,
		GameState: { released: 'released' },
		Reviews: {
			getReviews: (game, score, good, bad) =>
				['A', 'B', 'C', 'D'].map((reviewerName) => ({
					reviewerName,
					score: Math.floor(score),
					message: good[0],
					bad: bad[0],
				})),
		},
		Sales: {
			calculateSales: (company, game) => {
				game.totalSalesCash = 1000000;
				game.fansChangeTarget = 2000;
			},
		},
		Notification,
		VisualsManager: { getCharacterOverlay: (staff) => ({ saySomething: (text) => said.push([staff.id, text]) }) },
		Training: {},
		Company,
		Sound: { click: () => {} },
		UI: { getCharUnderCursor: () => null },
	};
	const SD = loadMod(FILES, globals);
	return { SD, store, handlers, researched, said, globals };
}

const staffMember = (id, extra = {}) => ({
	id,
	name: id === 'boss' ? 'Pat' : 'Sam',
	designFactor: 0.5,
	technologyFactor: 0.5,
	state: 'Idle',
	canStartResearch() {
		return !this.currentResearch;
	},
	...extra,
});

// A studio in year 15 with an old hit, an old flop, a recent game and an expansion pack.
const studio = (globals, overrides = {}) => {
	const games = [
		makeGame({ id: 'hit', title: 'Star Quest', releaseWeek: 2 * YEAR, score: 9, gameSize: 'medium' }),
		makeGame({ id: 'flop', title: 'Mud', releaseWeek: 3 * YEAR, score: 4 }),
		makeGame({ id: 'fine', title: 'Fine Racer', releaseWeek: 8 * YEAR, score: 7.5 }),
		makeGame({
			id: 'pack',
			title: 'Star Quest: More',
			releaseWeek: 4 * YEAR,
			score: 8,
			flags: { isExtensionPack: true },
		}),
		makeGame({ id: 'new', title: 'Brand New', releaseWeek: 14 * YEAR, score: 8 }),
	];
	const company = makeCompany(games, {
		currentWeek: 14 * YEAR + 10,
		cash: 1000000,
		currentLevel: 2,
		staff: [staffMember('boss'), staffMember('sam', { designFactor: 0.9, technologyFactor: 0.7 })],
		licencedPlatforms: [PC, BOX, OLD],
		notifications: [],
		conferenceHype: 30,
		adjustCash(amount, label) {
			this.cash += amount;
			(this.cashLog = this.cashLog || []).push({ amount, label });
		},
		getRandom: () => 0.5,
		canDevelopMultiPlatform: () => true,
		...overrides,
	});
	globals.GameManager.company = company;
	return company;
};

const startHit = (env, company, extra = {}) =>
	env.SD.remaster.project.start(company, {
		originalId: 'hit',
		tier: 'remaster',
		staffId: 'sam',
		platformIds: ['BOX'],
		...extra,
	});

describe('remaster project: candidates', () => {
	let env;
	beforeEach(() => {
		env = setup();
	});

	it('lists old hits that can be remastered now, most appealing first', () => {
		const company = studio(env.globals);
		const eligible = env.SD.remaster.project.eligible(company);
		assert.deepEqual(plain(eligible.map((c) => c.game.id)), ['hit', 'fine']);
		assert.equal(Math.round(eligible[0].nostalgia * 100) / 100, 0.72);
	});

	it('lists good games that are still too young, soonest first', () => {
		const company = studio(env.globals);
		const upcoming = env.SD.remaster.project.upcoming(company);
		assert.deepEqual(plain(upcoming.map((c) => [c.game.id, c.eligibility.fromWeek])), [['new', 19 * YEAR]]);
	});

	it('drops a game once a remaster of it is underway or released', () => {
		const company = studio(env.globals);
		startHit(env, company);
		assert.deepEqual(plain(env.SD.remaster.project.eligible(company).map((c) => c.game.id)), ['fine']);
	});

	it('offers only licensed platforms that are still on sale, biggest first', () => {
		const company = studio(env.globals);
		assert.deepEqual(plain(env.SD.remaster.project.platforms(company).map((p) => p.id)), ['BOX', 'PC']);
	});
});

describe('remaster project: planning and starting', () => {
	let env;
	beforeEach(() => {
		env = setup();
	});

	it('budgets from the studio running costs plus platform costs', () => {
		const company = studio(env.globals);
		const sam = company.staff[1];
		const plan = env.SD.remaster.project.plan(company, {
			originalId: 'hit',
			tier: 'remaster',
			staff: sam,
			platforms: [BOX, PC],
		});
		assert.equal(plan.budget, 2 * 50000 + 100000);
		assert.equal(plan.weeks, 6);
		assert.equal(plan.title, 'Star Quest Remastered');
	});

	it('only uses the series brand while franchise sales effects are on', () => {
		const company = studio(env.globals);
		const P = env.SD.remaster.project;
		assert.ok(P.brand(company, 'hit') > 0);
		env.SD.settings.set('franchise.sales', false);
		assert.equal(P.brand(company, 'hit'), null);
	});

	it('puts the staff member to work, pays the budget and records the project', () => {
		const company = studio(env.globals);
		const project = startHit(env, company, { title: '  Star Quest Forever ' });
		assert.deepEqual(env.researched, [{ id: 'sdRemaster', duration: 6 * 4000, type: 'training', staffId: 'sam' }]);
		assert.equal(company.cash, 1000000 - 180000);
		assert.deepEqual(plain(company.cashLog), [{ amount: -180000, label: 'Remaster: Star Quest Forever' }]);
		assert.equal(project.title, 'Star Quest Forever');
		assert.deepEqual(plain(env.SD.remaster.store.projects()), [plain(project)]);
	});

	it('refuses choices that are not possible, without charging anything', () => {
		const company = studio(env.globals);
		const P = env.SD.remaster.project;
		const attempt = (extra) => assert.throws(() => startHit(env, company, extra));
		attempt({ originalId: 'flop' });
		attempt({ originalId: 'pack' });
		attempt({ tier: 'reboot' });
		attempt({ platformIds: [] });
		attempt({ platformIds: ['OLD'] });
		attempt({ platformIds: ['NEW'] });
		attempt({ staffId: 'nobody' });
		company.canDevelopMultiPlatform = () => false;
		attempt({ platformIds: ['BOX', 'PC'] });
		company.cash = 1000;
		attempt({});
		assert.equal(company.cashLog, undefined);
		assert.equal(P.busy(), false);
	});

	it('allows one remaster at a time', () => {
		const company = studio(env.globals);
		startHit(env, company);
		assert.throws(() => startHit(env, company, { originalId: 'fine', staffId: 'boss' }), /already underway/);
	});

	it('offers the menu entry only when someone could start one', () => {
		const company = studio(env.globals);
		const P = env.SD.remaster.project;
		const [boss, sam] = company.staff;
		assert.equal(P.canOffer(company, sam), true);
		assert.equal(P.canOffer(company, null), false);
		startHit(env, company);
		assert.equal(P.canOffer(company, sam), false); // busy
		assert.equal(P.canOffer(company, boss), false); // one at a time
		env.SD.remaster.store.projects().length = 0;
		env.SD.settings.set('remaster.enabled', false);
		assert.equal(P.canOffer(company, boss), false);
	});
});

describe('remaster project: release', () => {
	let env;
	beforeEach(() => {
		env = setup();
	});

	const finish = (company) => {
		const sam = company.staff[1];
		return env.SD.remaster.project.trainingItem().complete(sam);
	};

	it('registers its work with the game when the feature installs', () => {
		env.SD.remaster.install({ ui: { contextMenuShowing: 'menu' }, gameplay: { weekProceeded: 'week' } });
		const item = env.globals.Training.sdRemaster;
		assert.equal(item.id, 'sdRemaster');
		assert.equal(item.pointsCost, 0);
		assert.equal(item.canUse(), false);
	});

	it('releases the remaster as a new game in the original series', () => {
		env.SD.remaster.install({ ui: { contextMenuShowing: 'menu' }, gameplay: { weekProceeded: 'week' } });
		const company = studio(env.globals);
		startHit(env, company);
		company.currentWeek += 6;
		finish(company);
		const game = company.gameLog.find((g) => g.flags.sdRemaster);
		assert.equal(game.title, 'Star Quest Remastered');
		assert.equal(game.genre, company.gameLog.find((g) => g.id === 'hit').genre);
		assert.equal(game.gameSize, 'medium');
		assert.deepEqual(plain(game.platforms.map((p) => p.id)), ['BOX']);
		assert.equal(game.releaseWeek, 14 * YEAR + 17);
		assert.equal(game.costs, 180000);
		assert.equal(game.flags.hasCustomName, true);
		assert.equal(game.flags.sdRemaster.of, 'hit');
		assert.equal(game.flags.sdRemaster.tier, 'remaster');
		assert.equal(game.hypePoints, 0);
		assert.equal(company.conferenceHype, 30); // left for the next real game
		assert.equal(game.reviews.length, 4);
		assert.equal(game.reviews[0].message, 'A classic, lovingly restored.');
		assert.equal(env.SD.remaster.store.projects().length, 0);
	});

	it('scores the remaster from the plan, with luck in the middle here', () => {
		const company = studio(env.globals);
		const project = startHit(env, company);
		finish(company);
		const game = company.gameLog.find((g) => g.flags.sdRemaster);
		assert.equal(game.score, project.expected);
	});

	it('scales lifetime sales and fan change by nostalgia and brand', () => {
		const company = studio(env.globals);
		startHit(env, company);
		finish(company);
		const game = company.gameLog.find((g) => g.flags.sdRemaster);
		const m = game.flags.sdRemaster.multiplier;
		assert.ok(m > 0.2 && m < 0.5);
		assert.ok(Math.abs(game.totalSalesCash - 1000000 * m) < 1000);
		assert.ok(Math.abs(game.fansChangeTarget - 2000 * m) < 5);
	});

	it('goes in just before the latest new game, which stays last', () => {
		const company = studio(env.globals);
		startHit(env, company);
		finish(company);
		assert.deepEqual(plain(company.gameLog.map((g) => g.id)), [
			'hit',
			'flop',
			'fine',
			'pack',
			company.gameLog[4].id,
			'new',
		]);
		assert.equal(company.gameLog[company.gameLog.length - 1].id, 'new');
	});

	it('keeps remasters together ahead of the latest new game', () => {
		const P = env.SD.remaster.project;
		const log = [{ id: 'a', flags: {} }];
		P.insert(log, { id: 'r1', flags: { sdRemaster: {} } });
		P.insert(log, { id: 'r2', flags: { sdRemaster: {} } });
		log.push({ id: 'b', flags: {} });
		P.insert(log, { id: 'r3', flags: { sdRemaster: {} } });
		assert.deepEqual(
			log.map((g) => g.id),
			['r1', 'r2', 'a', 'r3', 'b'],
		);
	});

	it('announces the release with its reviews, and the developer says so', () => {
		const company = studio(env.globals);
		startHit(env, company);
		finish(company);
		const note = company.notifications[company.notifications.length - 1];
		assert.equal(note.header, 'Star Quest Remastered is out!');
		assert.match(note.text, /Sam has finished Star Quest Remastered, our remaster of Star Quest/);
		assert.match(note.text, /A: 8\/10, "A classic, lovingly restored."/);
		assert.deepEqual(env.said, [['sam', 'Remaster done!']]);
	});

	it('keeps remasters out of the Develop Sequel picker', () => {
		env.SD.remaster.install({ ui: { contextMenuShowing: 'menu' }, gameplay: { weekProceeded: 'week' } });
		const company = studio(env.globals);
		startHit(env, company);
		finish(company);
		const picker = env.globals.Company.prototype.getPossibleGamesForSequel.call(company);
		assert.equal(picker.length, company.gameLog.length - 1);
		assert.ok(picker.every((g) => !g.flags.sdRemaster));
	});
});

describe('remaster project: menu, upkeep and the first message', () => {
	let env;
	const keys = { ui: { contextMenuShowing: 'menu' }, gameplay: { weekProceeded: 'week' } };
	beforeEach(() => {
		env = setup();
		env.SD.remaster.install(keys);
	});

	it('adds the menu entry for the person right-clicked', () => {
		const company = studio(env.globals);
		env.globals.UI.getCharUnderCursor = () => company.staff[1];
		const items = [];
		env.handlers.menu[0]({ type: 'primary', items });
		assert.equal(items.length, 1);
		assert.equal(items[0].label, 'Remaster a game...');
		env.handlers.menu[0]({ type: 'secondary', items });
		assert.equal(items.length, 1);
	});

	it('uses the founder in the garage', () => {
		const company = studio(env.globals, { currentLevel: 1 });
		company.staff[0].currentResearch = { id: 'Something' };
		const items = [];
		env.handlers.menu[0]({ type: 'primary', items });
		assert.equal(items.length, 0);
	});

	it('cancels a remaster whose developer left', () => {
		const company = studio(env.globals);
		startHit(env, company);
		company.staff.pop();
		env.handlers.week[0]({ company });
		assert.equal(env.SD.remaster.store.projects().length, 0);
		assert.match(company.notifications.find((n) => n.header === 'Remaster cancelled').text, /Star Quest Remastered/);
	});

	it('keeps a remaster that is still being worked on', () => {
		const company = studio(env.globals);
		startHit(env, company);
		env.handlers.week[0]({ company });
		assert.equal(env.SD.remaster.store.projects().length, 1);
	});

	it('explains remasters once, when the first game is old enough', () => {
		const company = studio(env.globals);
		env.handlers.week[0]({ company });
		env.handlers.week[0]({ company });
		const notes = company.notifications.filter((n) => n.header === 'Remasters');
		assert.equal(notes.length, 1);
		assert.match(notes[0].text, /Fans still talk about Star Quest, 12 years after/);
	});

	it('stays quiet while nothing is old enough or the feature is off', () => {
		const young = studio(env.globals, { currentWeek: 3 * YEAR });
		env.handlers.week[0]({ company: young });
		assert.equal(young.notifications.length, 0);
		env.SD.settings.set('remaster.enabled', false);
		const company = studio(env.globals);
		env.handlers.week[0]({ company });
		assert.equal(company.notifications.length, 0);
	});

	it('files the budget under game development', () => {
		const ctx = env.SD.classify.context({ gameLog: [] }, {});
		assert.equal(env.SD.classify.classify('Remake: Star Quest Remake', -5000, ctx)[0].cat, 'development');
		assert.equal(env.SD.classify.classify('Remastered things', -5000, ctx)[0].cat, 'other');
	});
});
