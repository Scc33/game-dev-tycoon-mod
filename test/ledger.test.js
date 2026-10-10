import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { loadMod, plain } from './helpers/load-mod.js';

const store = { data: {} };
const SD = loadMod(['src/core.js', 'src/classify.js', 'src/ledger.js'], {
	GDT: { getDataStore: () => store },
});

const newCompany = (overrides = {}) => ({
	currentWeek: 10,
	cash: 50000,
	fans: 0,
	gameLog: [{ title: 'MacMan' }],
	staff: [{ salary: 0 }],
	booths: [],
	engines: [],
	cashLog: [],
	...overrides,
});

describe('ledger', () => {
	let company;
	beforeEach(() => {
		store.data = {};
		company = newCompany();
	});

	it('starts tracking from the current week and balance', () => {
		const d = SD.ledger.state(company);
		assert.equal(d.since, 10);
		assert.equal(d.lastCash, 50000);
		assert.deepEqual(plain(d.months), {});
	});

	it('aggregates movements per month and category', () => {
		SD.ledger.record(company, { amount: 1200, label: 'MacMan sales' });
		SD.ledger.record(company, { amount: 800, label: 'MacMan sales' });
		SD.ledger.record(company, { amount: -8000, label: 'monthly costs' });
		const d = SD.ledger.state(company);
		assert.deepEqual(plain(d.months[2]), { sales: [2000, 0], upkeep: [0, -8000] });
		assert.equal(d.pend, -6000);
		assert.equal(d.recent.length, 3);
	});

	it('ignores zero and non-numeric amounts', () => {
		SD.ledger.record(company, { amount: 0, label: 'nothing' });
		SD.ledger.record(company, { amount: 'abc', label: 'nothing' });
		SD.ledger.record(company, null);
		assert.equal(SD.ledger.state(company).recent.length, 0);
	});

	it('caps the recent transaction list', () => {
		for (let i = 0; i < SD.ledger.RECENT_MAX + 10; i++) SD.ledger.record(company, { amount: 1, label: `t${i}` });
		const recent = SD.ledger.state(company).recent;
		assert.equal(recent.length, SD.ledger.RECENT_MAX);
		assert.equal(recent[recent.length - 1][2], `t${SD.ledger.RECENT_MAX + 9}`);
	});

	it('books unexplained cash changes as untracked when the week ends', () => {
		SD.ledger.record(company, { amount: 1000, label: 'MacMan sales' });
		company.cash = 50000 + 1000 - 250; // 250 left without a label
		company.currentWeek = 11;
		SD.ledger.onWeek(company);
		const d = SD.ledger.state(company);
		const last = d.recent[d.recent.length - 1];
		assert.deepEqual(plain(last), [11, -250, 'Untracked change', 'other']);
		assert.equal(d.pend, 0);
		assert.equal(d.lastCash, 50750);
	});

	it('keeps one balance snapshot per week', () => {
		SD.ledger.onWeek(company);
		company.cash = 60000;
		company.currentWeek = 10.5;
		SD.ledger.onWeek(company);
		company.currentWeek = 11;
		SD.ledger.onWeek(company);
		assert.deepEqual(plain(SD.ledger.state(company).snaps), [
			[10, 60000, 0],
			[11, 60000, 0],
		]);
	});

	it('records pushes onto the company cash log without changing them', () => {
		SD.ledger.attach(company);
		SD.ledger.attach(company); // idempotent
		company.cashLog.push({ amount: 500, label: 'MacMan sales' });
		assert.equal(company.cashLog.length, 1);
		assert.equal(SD.ledger.state(company).recent.length, 1);
		assert.equal(JSON.stringify(company.cashLog), '[{"amount":500,"label":"MacMan sales"}]');
	});

	it('produces monthly rows including empty months', () => {
		SD.ledger.record(company, { amount: 1000, label: 'MacMan sales' });
		company.currentWeek = 18;
		SD.ledger.record(company, { amount: -400, label: 'Find Staff' });
		const rows = plain(SD.ledger.monthly(SD.ledger.state(company), 2, 4));
		assert.deepEqual(rows, [
			{ month: 2, income: 1000, expenses: 0, net: 1000 },
			{ month: 3, income: 0, expenses: 0, net: 0 },
			{ month: 4, income: 0, expenses: -400, net: -400 },
		]);
	});

	it('breaks totals down by category, largest first', () => {
		SD.ledger.record(company, { amount: 1000, label: 'MacMan sales' });
		SD.ledger.record(company, { amount: 5000, label: 'contract payment' });
		SD.ledger.record(company, { amount: -300, label: 'Find Staff' });
		SD.ledger.record(company, { amount: -9000, label: 'monthly costs' });
		const split = plain(SD.ledger.breakdown(SD.ledger.state(company), 0, 10));
		assert.deepEqual(
			split.income.map((r) => [r.cat, r.amount]),
			[
				['deals', 5000],
				['sales', 1000],
			],
		);
		assert.deepEqual(
			split.expenses.map((r) => [r.cat, r.amount]),
			[
				['upkeep', 9000],
				['staff', 300],
			],
		);
	});

	it('reports the tracked month range', () => {
		SD.ledger.onWeek(company);
		company.currentWeek = 30;
		SD.ledger.onWeek(company);
		assert.deepEqual(plain(SD.ledger.monthRange(SD.ledger.state(company))), { first: 2, last: 7 });
	});
});
