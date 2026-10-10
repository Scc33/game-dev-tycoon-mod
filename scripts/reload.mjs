#!/usr/bin/env node
// Dev loop: reload the running game so it re-reads the mod, continue the most recent save,
// pause, and optionally open a dashboard tab and screenshot it.
//
//   node scripts/reload.mjs                          reload and continue
//   node scripts/reload.mjs --tab games --shot a.png also open the Games tab and capture it
//   node scripts/reload.mjs --no-reload --tab ledger --shot b.png
import { parseArgs } from 'node:util';
import { connect, evaluate, exitAfter, screenshot, sleep, waitFor } from './lib/cdp.mjs';

const { values: args } = parseArgs({
	options: {
		tab: { type: 'string' },
		shot: { type: 'string' },
		'no-reload': { type: 'boolean', default: false },
	},
});
exitAfter(120000);

// Clicks the first visible leaf element whose text matches exactly.
const clickText = (text) =>
	`(() => { const b = $('*:visible').filter(function () { return $(this).children().length === 0 && $(this).text().trim() === ${JSON.stringify(text)}; }).first(); b.click(); return b.length; })()`;

let cdp = await connect();
if (!args['no-reload']) {
	await cdp.send('Page.reload', { ignoreCache: true });
	cdp.close();
	await sleep(3000);
	cdp = await connect();
	await waitFor(cdp, "typeof $ !== 'undefined' && $('#splashScreen').is(':visible')");
	await evaluate(cdp, "$('#splashScreen').click(); true");
	// Saves made without this mod (or with another version) show a mismatch warning first.
	await waitFor(
		cdp,
		`GameManager.company && GameManager.company.gameLog ? true : ${clickText('Load Anyway')} && false`,
	);
	console.log('save loaded');
}

// Click through pending notifications so the game reaches an idle, paused state.
for (let i = 0; i < 10; i++) {
	const busy = await evaluate(
		cdp,
		`(() => { const b = $('.simplemodal-container').find('.okButton:visible').first(); b.click(); return b.length; })()`,
	);
	if (!busy) break;
	await sleep(1500);
}
await evaluate(cdp, 'GameManager.pause(true); true');

if (args.tab) {
	await evaluate(cdp, `StudioDashboard.dashboard.open(${JSON.stringify(args.tab)}); true`);
	await waitFor(cdp, "!!document.querySelector('.simplemodal-container #sdDashboard')");
	await sleep(800);
}
if (args.shot) {
	await screenshot(cdp, args.shot);
	console.log(`saved ${args.shot}`);
}
cdp.close();
