import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadMod, plain } from '../../helpers/load-mod.js';

const SD = loadMod(['src/core.js', 'src/features/remaster/model.js']);
const M = SD.remaster.model;

const YEAR = 48;
const round = (v, places = 2) => Math.round(v * 10 ** places) / 10 ** places;
const hit = (overrides = {}) => ({ releaseWeek: 100, score: 8, ...overrides });

describe('remaster model: eligibility', () => {
	it('allows a good game once it is five years old', () => {
		assert.deepEqual(plain(M.eligibility(hit(), 100 + 5 * YEAR)), { ok: true, reason: null, fromWeek: 340 });
	});

	it('says when a game that is too young becomes eligible', () => {
		assert.deepEqual(plain(M.eligibility(hit(), 200)), { ok: false, reason: 'age', fromWeek: 340 });
	});

	it('turns away games fans would not miss', () => {
		assert.equal(M.eligibility(hit({ score: 5.9 }), 1000).reason, 'score');
		assert.equal(M.eligibility(hit({ score: undefined }), 1000).reason, 'score');
	});

	it('turns away packs, MMOs, remasters and games already remastered', () => {
		assert.equal(M.eligibility(hit({ isPack: true }), 1000).reason, 'pack');
		assert.equal(M.eligibility(hit({ isMMO: true }), 1000).reason, 'mmo');
		assert.equal(M.eligibility(hit({ isRemaster: true }), 1000).reason, 'remaster');
		assert.equal(M.eligibility(hit({ remastered: true }), 1000).reason, 'remastered');
	});
});

describe('remaster model: nostalgia and dating', () => {
	it('grows nostalgia from five to fifteen years', () => {
		assert.equal(M.nostalgia(4 * YEAR), 0);
		assert.equal(M.nostalgia(5 * YEAR), 0);
		assert.equal(M.nostalgia(10 * YEAR), 0.5);
		assert.equal(M.nostalgia(15 * YEAR), 1);
		assert.equal(M.nostalgia(30 * YEAR), 1);
	});

	it('dates a review by 0.15 a year, at most 3', () => {
		assert.equal(round(M.dating(10 * YEAR)), 1.5);
		assert.equal(M.dating(40 * YEAR), 3);
		assert.equal(M.dating(-5), 0);
	});
});

describe('remaster model: review score', () => {
	const age = 12 * YEAR; // dating 1.8
	const average = 0.5; // a staff member with average skills adds nothing

	it('drops a port by the full dating, a remaster by a third, and lifts a remake', () => {
		const score = (tier) => round(M.score({ originalScore: 9, ageWeeks: age, tier, skill: average }).expected);
		assert.equal(score('port'), 7.2);
		assert.equal(score('remaster'), 8.4);
		assert.equal(score('remake'), 9.5);
	});

	it('moves with the skill of the person doing it', () => {
		const score = (skill) => round(M.score({ originalScore: 8, ageWeeks: 0, tier: 'remaster', skill }).expected);
		assert.equal(score(1), 8.5);
		assert.equal(score(0), 7.5);
	});

	it('gives the range luck can reach, inside 1 to 10', () => {
		const top = plain(M.score({ originalScore: 10, ageWeeks: 0, tier: 'remake', skill: 1 }));
		assert.deepEqual(top, { expected: 10, low: 9.5, high: 10 });
		assert.equal(M.rollScore(8, 0), 7.5);
		assert.equal(M.rollScore(8, 0.5), 8);
		assert.equal(M.rollScore(9.8, 0.99), 10);
	});

	it('reads skill from the staff member', () => {
		assert.equal(M.skill({ designFactor: 0.6, technologyFactor: 0.8 }), 0.7);
		assert.equal(M.skill({ designFactor: 1.4, technologyFactor: 1.2 }), 1);
		assert.equal(M.skill({}), 0);
	});

	it('rejects an unknown tier', () => {
		assert.throws(
			() => M.score({ originalScore: 8, ageWeeks: 0, tier: 'reboot', skill: 0.5 }),
			/unknown remaster tier/,
		);
	});
});

describe('remaster model: cost, time and sales', () => {
	it('scales work with size and tier', () => {
		assert.equal(M.workWeeks('small', 'port'), 1.5);
		assert.equal(M.workWeeks('medium', 'remaster'), 6);
		assert.equal(M.workWeeks('aaa', 'remake'), 36);
	});

	it('budgets months of running costs plus platform costs, to the thousand', () => {
		assert.equal(M.budget({ size: 'medium', tier: 'remaster', monthlyCosts: 60000, platformCosts: 80000 }), 200000);
		assert.equal(M.budget({ size: 'small', tier: 'port', monthlyCosts: 8000 }), 4000);
		assert.equal(M.budget({ size: 'aaa', tier: 'remake', monthlyCosts: 201300 }), 2416000);
	});

	it('sells 20% of a new game, up to twice that with nostalgia, more for a loved brand', () => {
		assert.equal(round(M.salesMultiplier({ ageWeeks: 5 * YEAR })), 0.2);
		assert.equal(round(M.salesMultiplier({ ageWeeks: 10 * YEAR })), 0.3);
		assert.equal(round(M.salesMultiplier({ ageWeeks: 20 * YEAR })), 0.4);
		assert.equal(round(M.salesMultiplier({ ageWeeks: 20 * YEAR, brand: 100 })), 0.5);
	});

	it('names each tier', () => {
		assert.equal(M.title('Star Quest', 'port'), 'Star Quest HD');
		assert.equal(M.title('Star Quest', 'remaster'), 'Star Quest Remastered');
		assert.equal(M.title('Star Quest', 'remake'), 'Star Quest Remake');
	});

	it('ranks older hits higher', () => {
		assert.ok(M.appeal(8, 15 * YEAR) > M.appeal(9, 5 * YEAR));
	});
});

describe('remaster model: a full plan', () => {
	it('brings the numbers together for the Remaster window', () => {
		const plan = M.plan({
			original: { title: 'Star Quest', score: 9, releaseWeek: 0, size: 'large' },
			tier: 'remaster',
			staff: { designFactor: 0.7, technologyFactor: 0.9 },
			week: 12 * YEAR,
			monthlyCosts: 100000,
			platformCosts: 150000,
			brand: 60,
		});
		assert.deepEqual(
			plain({
				...plan,
				dating: round(plan.dating),
				skillBonus: round(plan.skillBonus),
				expected: round(plan.expected),
				low: round(plan.low),
				high: round(plan.high),
				multiplier: round(plan.multiplier, 3),
				nostalgia: round(plan.nostalgia),
			}),
			{
				tier: 'remaster',
				title: 'Star Quest Remastered',
				ageWeeks: 576,
				weeks: 9,
				budget: 450000,
				nostalgia: 0.7,
				dating: 0.6,
				skillBonus: 0.3,
				expected: 8.7,
				low: 8.2,
				high: 9.2,
				multiplier: 0.391,
			},
		);
	});
});
