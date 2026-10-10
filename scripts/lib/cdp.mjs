// Minimal Chrome DevTools Protocol client for a running Game Dev Tycoon started with
// scripts/launch-debug.sh (NW.js SDK build + --remote-debugging-port).
import { writeFileSync } from 'node:fs';

export const PORT = process.env.GDT_DEBUG_PORT || 9222;

async function pageTarget() {
	let targets;
	try {
		targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
	} catch {
		throw new Error(`Nothing listening on port ${PORT}. Start the game with scripts/launch-debug.sh first.`);
	}
	// NW.js reports the game window as type "app" with a chrome-extension:// URL.
	const page = targets.find((t) => t.url.includes('defaultBrowser.html'));
	if (!page) throw new Error('No game page found.');
	return page;
}

export async function connect() {
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

export async function evaluate(cdp, expression) {
	const res = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
	if (res.exceptionDetails) {
		const ex = res.exceptionDetails;
		throw new Error(ex.exception?.description || ex.text);
	}
	return res.result.value;
}

// clipSelector crops the capture to one element (e.g. just the dashboard window).
export async function screenshot(cdp, file, { clipSelector, scale = 1 } = {}) {
	const params = { format: 'png' };
	if (clipSelector) {
		const rect = await evaluate(
			cdp,
			`(() => { const r = document.querySelector(${JSON.stringify(clipSelector)}).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`,
		);
		params.clip = { ...rect, scale };
	}
	const { data } = await cdp.send('Page.captureScreenshot', params);
	writeFileSync(file, Buffer.from(data, 'base64'));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Poll an expression until it returns something truthy.
export async function waitFor(cdp, expression, { timeout = 30000, interval = 500 } = {}) {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		try {
			const value = await evaluate(cdp, expression);
			if (value) return value;
		} catch {
			// the page may be mid-reload
		}
		await sleep(interval);
	}
	throw new Error(`Timed out waiting for: ${expression}`);
}

// Exit instead of hanging when the game stops responding.
export function exitAfter(ms) {
	setTimeout(() => {
		console.error(`Timed out after ${ms}ms`);
		process.exit(1);
	}, ms).unref();
}
