#!/usr/bin/env node
// Minimal Chrome DevTools Protocol client for driving a running Game Dev Tycoon
// started with scripts/launch-debug.sh (NW.js SDK build + --remote-debugging-port).
//
//   node scripts/cdp.mjs eval "<js expression>"   evaluate in the game page, print JSON result
//   node scripts/cdp.mjs evalfile <file.js>        evaluate a file's contents
//   node scripts/cdp.mjs screenshot <out.png>      capture the game window
//   node scripts/cdp.mjs console [seconds]         dump buffered + live console output
//   node scripts/cdp.mjs reload                    reload the game page (re-reads mods)
import { readFileSync, writeFileSync } from 'node:fs';

const PORT = process.env.GDT_DEBUG_PORT || 9222;

async function pageTarget() {
	let targets;
	try {
		targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
	} catch {
		throw new Error(`Nothing listening on port ${PORT}. Start the game with scripts/launch-debug.sh first.`);
	}
	// NW.js reports the game window as type "app" with a chrome-extension:// URL.
	const page = targets.find((t) => t.url.includes('defaultBrowser.html'));
	if (!page) throw new Error('No page target found.');
	return page;
}

async function connect() {
	const ws = new WebSocket((await pageTarget()).webSocketDebuggerUrl);
	await new Promise((resolve, reject) => {
		ws.onopen = resolve;
		ws.onerror = reject;
	});
	let nextId = 0;
	const pending = new Map();
	const listeners = [];
	ws.onmessage = (ev) => {
		const msg = JSON.parse(ev.data);
		if (msg.id && pending.has(msg.id)) {
			const { resolve, reject } = pending.get(msg.id);
			pending.delete(msg.id);
			if (msg.error) reject(new Error(msg.error.message));
			else resolve(msg.result);
		} else {
			listeners.forEach((fn) => fn(msg));
		}
	};
	const send = (method, params = {}) =>
		new Promise((resolve, reject) => {
			const id = ++nextId;
			pending.set(id, { resolve, reject });
			ws.send(JSON.stringify({ id, method, params }));
		});
	return { send, on: (fn) => listeners.push(fn), close: () => ws.close() };
}

async function evaluate(cdp, expression) {
	const res = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
	if (res.exceptionDetails) {
		const ex = res.exceptionDetails;
		throw new Error(ex.exception?.description || ex.text);
	}
	return res.result.value;
}

const formatArg = (a) =>
	a.value !== undefined ? (typeof a.value === 'string' ? a.value : JSON.stringify(a.value)) : a.description || a.type;

const [cmd, arg] = process.argv.slice(2);
const cdp = await connect();
try {
	if (cmd === 'eval' || cmd === 'evalfile') {
		const value = await evaluate(cdp, cmd === 'eval' ? arg : readFileSync(arg, 'utf8'));
		console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
	} else if (cmd === 'screenshot') {
		const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
		writeFileSync(arg, Buffer.from(data, 'base64'));
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
		await new Promise((r) => setTimeout(r, (Number(arg) || 1) * 1000));
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
