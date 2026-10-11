#!/usr/bin/env node
// Developer cheats for the running game, over remote debugging. Same functions as the
// dashboard's Developer tab (mod/src/dev/cheats.js). Arguments are parsed as JSON when
// they can be, so numbers and objects work.
//
//   node scripts/cheat.mjs sandbox                 keep test runs out of the real save slots
//   node scripts/cheat.mjs cash 1000000
//   node scripts/cheat.mjs fans 50000
//   node scripts/cheat.mjs unlock sequels          sequels | sizes | mmo
//   node scripts/cheat.mjs speed 10                multiple of normal game speed
//   node scripts/cheat.mjs finish                  press Finish on the game in development
//   node scripts/cheat.mjs skipWeeks 240           let five years pass (best between games)
//   node scripts/cheat.mjs finishRemaster          release the remaster underway now
//   node scripts/cheat.mjs addSeries '{"name":"Quest","entries":[{"score":8},{"score":9,"gap":60}],"ago":30}'
import { readFileSync } from 'node:fs';
import { connect, evaluate, exitAfter } from './lib/cdp.mjs';

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd) {
	console.error(
		'usage: cheat.mjs <sandbox|cash|fans|unlock|speed|skipWeeks|finish|finishRemaster|addGame|addSeries> [args]',
	);
	process.exit(1);
}
exitAfter(30000);

const parse = (arg) => {
	try {
		return JSON.parse(arg);
	} catch {
		return arg;
	}
};

const cdp = await connect();
const expression =
	cmd === 'sandbox'
		? readFileSync(new URL('./in-game/sandbox-saves.js', import.meta.url), 'utf8')
		: `(() => {
			const dev = StudioDashboard.dev;
			if (typeof dev[${JSON.stringify(cmd)}] !== 'function') throw new Error('unknown cheat: ' + ${JSON.stringify(cmd)});
			const result = dev[${JSON.stringify(cmd)}](...${JSON.stringify(rest.map(parse))});
			if (StudioDashboard.dashboard.refresh) StudioDashboard.dashboard.refresh();
			// Game objects are large; report which one was made.
			return result && result.id && result.title ? { id: result.id, title: result.title } : result;
		})()`;
const result = await evaluate(cdp, expression);
console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
cdp.close();
