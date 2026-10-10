#!/usr/bin/env node
// Render art/thumbnail.svg to mod/image.png (120x120, the size the Mods screen uses) with the
// running game's browser engine, so the output matches what players see.
//   node scripts/render-thumbnail.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { connect, evaluate, exitAfter } from './lib/cdp.mjs';

const SIZE = 120;
exitAfter(30000);
const svg = readFileSync(new URL('../art/thumbnail.svg', import.meta.url), 'utf8');
const cdp = await connect();
await evaluate(
	cdp,
	`(() => {
		const el = document.createElement('div');
		el.id = 'sdThumbRender';
		el.style.cssText = 'position:fixed;left:0;top:0;width:${SIZE}px;height:${SIZE}px;z-index:999999';
		el.innerHTML = ${JSON.stringify(svg)};
		document.body.appendChild(el);
		return true;
	})()`,
);
const dpr = await evaluate(cdp, 'window.devicePixelRatio');
const { data } = await cdp.send('Page.captureScreenshot', {
	format: 'png',
	clip: { x: 0, y: 0, width: SIZE, height: SIZE, scale: 1 / dpr },
});
await evaluate(cdp, "document.getElementById('sdThumbRender').remove(); true");
cdp.close();
writeFileSync(new URL('../mod/image.png', import.meta.url), Buffer.from(data, 'base64'));
console.log('wrote mod/image.png');
