import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadMod, plain } from './helpers/load-mod.js';

const SD = loadMod(['src/core.js', 'src/classify.js']);

const gameGlobals = {
	Research: { getAllItems: () => [{ name: 'Multiplayer' }, { name: 'Custom Game Engine' }] },
	Training: { getAllTrainings: () => [{ name: 'Gameplay [Req. 720D/180T]' }] },
	Missions: { MarketingMissions: [{ name: 'Advertise in magazines' }, { name: 'Small Marketing Campaign' }] },
	GameManager: { currentEngineDev: { name: 'Engine 2' } },
};

const company = {
	gameLog: [{ title: 'MacMan' }, { title: 'Space Pals' }],
	currentGame: { title: 'Space Pals 2' },
	engines: [{ name: 'Engine 1' }],
	booths: [{ name: 'Small Booth' }],
	staff: [{ salary: 0 }, { salary: 3000 }, { salary: 2000 }],
};

const ctx = SD.classify.context(company, gameGlobals);
const categoryOf = (label, amount = -100) => SD.classify.classify(label, amount, ctx)[0].cat;

describe('classify', () => {
	it('separates game sales from console sales', () => {
		assert.equal(categoryOf('MacMan sales', 500), 'sales');
		assert.equal(categoryOf('Nova Station sales', 500), 'hardware');
	});

	it('splits monthly costs into salaries and office upkeep', () => {
		const parts = plain(SD.classify.classify('monthly costs', -13000, ctx));
		assert.deepEqual(parts, [
			{ cat: 'salaries', amount: -5000, label: 'Salaries' },
			{ cat: 'upkeep', amount: -8000, label: 'Office upkeep' },
		]);
	});

	it('books monthly costs as upkeep when nobody draws a salary', () => {
		const solo = SD.classify.context({ ...company, staff: [{ salary: 0 }] }, gameGlobals);
		assert.deepEqual(plain(SD.classify.classify('monthly costs', -8000, solo)), [
			{ cat: 'upkeep', amount: -8000, label: 'Office upkeep' },
		]);
	});

	it('recognises development spending', () => {
		assert.equal(categoryOf('Space Pals 2'), 'development');
		assert.equal(categoryOf('Dev. stage 2'), 'development');
		assert.equal(categoryOf('Galaxy Online maintenance'), 'development');
	});

	it('recognises marketing, research, engines, training and licenses', () => {
		assert.equal(categoryOf('Advertise in magazines'), 'marketing');
		assert.equal(categoryOf('Small Booth'), 'marketing');
		assert.equal(categoryOf('Multiplayer'), 'research');
		assert.equal(categoryOf('Engine 2'), 'research');
		assert.equal(categoryOf('Gameplay [Req. 720D/180T]'), 'staff');
		assert.equal(categoryOf('Govodore 64 dev. license'), 'licenses');
	});

	it('uses the fixed label table', () => {
		assert.equal(categoryOf('contract payment', 20000), 'deals');
		assert.equal(categoryOf('Bailout', 50000), 'finance');
		assert.equal(categoryOf('Grid income', 90000), 'hardware');
		assert.equal(categoryOf('New office'), 'facilities');
		assert.equal(categoryOf('Find Staff'), 'staff');
	});

	it('recognises console project costs, SDK sales and refunds', () => {
		assert.equal(categoryOf('Nova Station costs'), 'hardware');
		assert.equal(categoryOf('Nova Station SDK', 300000), 'hardware');
		assert.equal(categoryOf('Nova Station refund', 300000), 'hardware');
	});

	it('falls back to other for unknown labels', () => {
		assert.equal(categoryOf('Something unexpected'), 'other');
		assert.equal(categoryOf(''), 'other');
	});

	it('honours a forced category while a wrapped call runs', () => {
		const owner = {
			createEngine() {
				return SD.classify.context(company, gameGlobals).forced;
			},
		};
		SD.classify.wrapWithCategory(owner, 'createEngine', 'research');
		assert.equal(owner.createEngine(), 'research');
		assert.equal(SD.classify.context(company, gameGlobals).forced, null);
	});

	it('lets callers add rules', () => {
		SD.classify.addRule((label) => (label === 'Lemonade stand' ? 'sales' : null));
		assert.equal(categoryOf('Lemonade stand', 5), 'sales');
	});

	it('names categories', () => {
		assert.equal(SD.classify.categoryName('upkeep'), 'Office upkeep');
		assert.equal(SD.classify.categoryName('mystery'), 'mystery');
	});
});
