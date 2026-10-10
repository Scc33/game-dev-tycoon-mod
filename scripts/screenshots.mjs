#!/usr/bin/env node
// Capture every dashboard tab from the running game into a folder, for visual review.
// Switches tabs inside the open window rather than reopening it, so the game stays paused.
//   node scripts/screenshots.mjs <out-dir>          full game window
//   node scripts/screenshots.mjs <out-dir> --crop   just the dashboard (used for docs/images)
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { connect, evaluate, exitAfter, screenshot, sleep, waitFor } from './lib/cdp.mjs';

const [outDir, flag] = process.argv.slice(2);
const crop = flag === '--crop';
if (!outDir) {
	console.error('usage: screenshots.mjs <out-dir>');
	process.exit(2);
}
mkdirSync(outDir, { recursive: true });
exitAfter(120000);

const cdp = await connect();
await evaluate(cdp, 'GameManager.pause(true); StudioDashboard.dashboard.open(); true');
await waitFor(cdp, "!!document.querySelector('.simplemodal-container #sdDashboard')");
const tabs = await evaluate(cdp, 'StudioDashboard.dashboard.tabs().map((t) => t.id)');
for (const id of tabs) {
	await evaluate(
		cdp,
		`$('#sdDashboard .sdTab').eq(StudioDashboard.dashboard.tabs().findIndex((t) => t.id === ${JSON.stringify(id)})).click(); true`,
	);
	await sleep(700);
	const file = path.join(outDir, `${id}.png`);
	await screenshot(cdp, file, crop ? { clipSelector: '#sdDashboard', scale: 0.6 } : {});
	console.log(`saved ${file}`);
}
cdp.close();
