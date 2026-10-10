#!/usr/bin/env node
// Drive a running Game Dev Tycoon from the command line (see scripts/lib/cdp.mjs).
//
//   node scripts/cdp.mjs eval "<js expression>"   evaluate in the game page, print JSON result
//   node scripts/cdp.mjs evalfile <file.js>        evaluate a file's contents
//   node scripts/cdp.mjs screenshot <out.png>      capture the game window
//   node scripts/cdp.mjs console [seconds]         print live console output
//   node scripts/cdp.mjs reload                    reload the game page (re-reads mods)
import { readFileSync } from 'node:fs';
import { connect, evaluate, exitAfter, screenshot } from './lib/cdp.mjs';

const [cmd, arg] = process.argv.slice(2);
const seconds = Number(arg) || 1;
exitAfter((Number(process.env.GDT_CDP_TIMEOUT_MS) || 30000) + (cmd === 'console' ? seconds * 1000 : 0));

const formatArg = (a) =>
	a.value !== undefined ? (typeof a.value === 'string' ? a.value : JSON.stringify(a.value)) : a.description || a.type;

const cdp = await connect();
try {
	if (cmd === 'eval' || cmd === 'evalfile') {
		const value = await evaluate(cdp, cmd === 'eval' ? arg : readFileSync(arg, 'utf8'));
		console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
	} else if (cmd === 'screenshot') {
		await screenshot(cdp, arg);
		console.log(`saved ${arg}`);
	} else if (cmd === 'console') {
		cdp.on((msg) => {
			if (msg.method === 'Runtime.consoleAPICalled') {
				console.log(`[${msg.params.type}] ${msg.params.args.map(formatArg).join(' ')}`);
			} else if (msg.method === 'Runtime.exceptionThrown') {
				const d = msg.params.exceptionDetails;
				console.log(`[exception] ${d.exception?.description || d.text}`);
			}
		});
		await cdp.send('Runtime.enable');
		await new Promise((r) => setTimeout(r, seconds * 1000));
	} else if (cmd === 'reload') {
		await cdp.send('Page.reload', { ignoreCache: true });
		console.log('reloaded');
	} else {
		console.error('usage: cdp.mjs eval|evalfile|screenshot|console|reload [arg]');
		process.exitCode = 2;
	}
} catch (e) {
	console.error(e.message);
	process.exitCode = 1;
} finally {
	cdp.close();
}
