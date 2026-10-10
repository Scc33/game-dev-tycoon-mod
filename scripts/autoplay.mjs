#!/usr/bin/env node
// Plays the running game forward for testing: dismisses informational popups, confirms
// development-stage choices with their defaults, presses Finish when a game is ready, and
// stops when the goal is reached. It never answers a decision (anything with choices other
// than OK/Close/Continue): it stops and prints it instead. It also stops on an error alert
// or when the game stops moving. Pauses the game when done.
//
//   node scripts/autoplay.mjs --until release            until the game in development is out
//   node scripts/autoplay.mjs --until week:120 --speed 10
//
// Run `node scripts/cheat.mjs sandbox` first so the release autosave stays out of real slots.
import { parseArgs } from 'node:util';
import { connect, evaluate, exitAfter, sleep } from './lib/cdp.mjs';

const { values: args } = parseArgs({
	options: {
		until: { type: 'string', default: 'release' },
		speed: { type: 'string', default: '10' },
		'max-seconds': { type: 'string', default: '240' },
	},
});
const maxMs = Number(args['max-seconds']) * 1000;
exitAfter(maxMs + 30000);

// One step in the page: returns what it saw and did. Clicks use the DOM's own click(),
// because jQuery 1.7's .click() runs inline onclick handlers twice. The one choice it makes
// is "Release Game", and only when the goal is a release.
const allowed = args.until === 'release' ? ['Release Game'] : [];
const STEP = `(() => {
	const SD = StudioDashboard, c = GameManager.company;
	const leaves = (root) => $(root).find(':visible').filter(function () {
		return $(this).children().length === 0 && $(this).text().trim().length > 0;
	});
	const error = $('.errorMessage:visible').first().text().trim();
	if (error) return { stop: 'error alert: ' + error };
	let did = '';
	const modal = $('.simplemodal-container:visible');
	if (modal.length) {
		const buttons = modal.find('.selectorButton:visible, .okButton:visible, .button:visible, button:visible');
		const labels = buttons.map(function () { return $(this).text().trim(); }).get().filter(Boolean);
		const choices = labels.filter((l) => ['OK', 'Close', 'Continue'].indexOf(l) === -1);
		const ok = buttons.filter(function () { return ['OK', 'Close', 'Continue'].indexOf($(this).text().trim()) !== -1; }).first();
		const go = buttons.filter(function () { return ${JSON.stringify(allowed)}.indexOf($(this).text().trim()) !== -1; }).first();
		if (go.length) { go[0].click(); return { did: 'chose ' + go.text().trim(), week: c.currentWeek }; }
		if (choices.length > 1) {
			const header = modal.find('.windowTitle, h1, h2').first().text().trim();
			return { stop: 'decision needed: ' + header + ' [' + choices.join(' | ') + ']' };
		}
		if (ok.length) { ok[0].click(); did = 'clicked ' + ok.text().trim(); }
		else return { waiting: leaves(modal).first().text().trim().slice(0, 40) };
	}
	if (!did && SD.dev.canFinish()) { SD.dev.finish(); did = 'pressed Finish'; }
	if (!modal.length && GameManager.isPaused(true)) GameManager.resume(true);
	if (!modal.length && GameManager.isPaused()) GameManager.resume();
	const g = c.currentGame;
	return {
		week: c.currentWeek,
		released: c.gameLog.length,
		dev: g ? g.title + ' ' + Math.round(GameManager.getCurrentGameProgress() * 100) + '%' : null,
		did,
	};
})()`;

const cdp = await connect();
const start = await evaluate(cdp, 'GameManager.company.gameLog.length');
await evaluate(cdp, `StudioDashboard.dev.speed(${Number(args.speed)}); true`);
const goal = args.until.startsWith('week:') ? { week: Number(args.until.slice(5)) } : { release: true };

const t0 = Date.now();
let lastWeek = -1;
let still = 0;
let outcome = 'timed out';
while (Date.now() - t0 < maxMs) {
	const s = await evaluate(cdp, STEP);
	if (s.stop) {
		outcome = s.stop;
		break;
	}
	if (s.did) console.log(`week ${Math.floor(s.week)}: ${s.did}${s.dev ? ` (${s.dev})` : ''}`);
	if (goal.release && s.released > start) {
		outcome = 'released';
		break;
	}
	if (goal.week && s.week >= goal.week) {
		outcome = `reached week ${goal.week}`;
		break;
	}
	// Typing popups and dialogs legitimately hold time still; a long stall means something
	// needs a human (or a new rule here).
	still = s.week === lastWeek && !s.did ? still + 1 : 0;
	lastWeek = s.week ?? lastWeek;
	if (still > 40) {
		outcome = `stalled at week ${Math.floor(lastWeek)}${s.waiting ? ` on "${s.waiting}"` : ''}`;
		break;
	}
	await sleep(500);
}
await evaluate(cdp, 'StudioDashboard.dev.speed(1); GameManager.pause(true); true');
console.log(`stopped: ${outcome}`);
cdp.close();
