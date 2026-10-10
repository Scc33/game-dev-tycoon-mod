// Studio Dashboard: small DOM components shared by every tab.
// All text goes in through textContent: game titles and labels are player-entered.
((SD) => {
	const fmt = SD.fmt;

	// h('div', {class, text, onclick, ...attrs}, [children])
	const h = (tag, props = {}, children = []) => {
		const el = document.createElement(tag);
		Object.entries(props || {}).forEach(([k, v]) => {
			if (v === undefined || v === null || v === false) return;
			if (k === 'text') el.textContent = v;
			else if (k === 'class') el.className = v;
			else if (k === 'onclick') el.addEventListener('click', v);
			else el.setAttribute(k, v);
		});
		children.forEach((c) => {
			if (c === null || c === undefined || c === false) return;
			el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
		});
		return el;
	};

	// Play the game's click sound before running a handler, like native buttons do.
	const withSound = (fn) => (ev) => {
		if (typeof Sound !== 'undefined') Sound.click();
		fn(ev);
	};

	// Font Awesome 3 ships with the game (icon-ok, icon-warning-sign, icon-time, ...).
	const icon = (name) => h('i', { class: `icon-${name} sdIcon`, 'aria-hidden': 'true' });

	const empty = (message) => h('div', { class: 'sdEmpty', text: message });

	const note = (iconName, children) => h('div', { class: 'sdNote' }, [icon(iconName), ' ', ...children]);

	const badge = (label, kind) => h('span', { class: `sdBadge${kind ? ` sdBadge-${kind}` : ''}`, text: label });

	// Status text always pairs its colour with an icon and words.
	const status = (kind, iconName, children) =>
		h('span', { class: kind === 'good' ? 'sdGood' : 'sdWarn' }, [icon(iconName), ' ', ...children]);

	const tile = (label, value, sub, { hero = false } = {}) =>
		h('div', { class: `sdTile${hero ? ' sdTileHero' : ''}` }, [
			h('div', { class: 'sdTileLabel', text: label }),
			h('div', { class: 'sdTileValue', text: value }),
			sub ? h('div', { class: 'sdTileSub', text: sub }) : null,
		]);

	const tiles = (items, { small = false } = {}) => h('div', { class: `sdTiles${small ? ' sdTilesSmall' : ''}` }, items);

	const legend = (items) =>
		h(
			'div',
			{ class: 'sdLegend' },
			items.map((it) =>
				h('span', { class: 'sdLegendItem' }, [
					h('span', { class: it.line ? 'sdKeyLine' : 'sdKeySwatch', style: `background:${it.color}` }),
					it.name,
				]),
			),
		);

	const money = (n, { signed = false } = {}) =>
		h('span', {
			class: n < 0 ? 'sdNeg' : signed && n > 0 ? 'sdPos' : '',
			text: signed ? fmt.signedMoney(n) : fmt.money(n),
		});

	// columns: [{name, value(row) -> string | Node, cls?, sortKey?}]
	// opts: { sort?: {key, dir}, onSort?(key), onRow?(row), rowClass?(row) }
	const table = (columns, rows, opts = {}) => {
		const head = h(
			'tr',
			{},
			columns.map((c) => {
				const sortable = opts.onSort && c.sortKey;
				const active = sortable && opts.sort && opts.sort.key === c.sortKey;
				return h(
					'th',
					{
						class: [c.cls, sortable && 'sdSortable', active && 'sdSorted'].filter(Boolean).join(' '),
						onclick: sortable ? withSound(() => opts.onSort(c.sortKey)) : null,
					},
					[c.name, active ? (opts.sort.dir < 0 ? ' ▾' : ' ▴') : null],
				);
			}),
		);
		const body = rows.map((row) =>
			h(
				'tr',
				{
					class: [opts.rowClass && opts.rowClass(row), opts.onRow && 'sdClickable'].filter(Boolean).join(' '),
					onclick: opts.onRow ? withSound(() => opts.onRow(row)) : null,
				},
				columns.map((c) => {
					const v = c.value(row);
					return h('td', { class: c.cls }, [
						v === null || v === undefined ? '–' : typeof v === 'object' ? v : String(v),
					]);
				}),
			),
		);
		return h('table', { class: 'sdTable' }, [h('thead', {}, [head]), h('tbody', {}, body)]);
	};

	// Horizontal bars for category breakdowns, value and share printed at the bar tip.
	const barList = (items, color) => {
		const max = Math.max(1, ...items.map((it) => it.amount));
		const total = items.reduce((s, it) => s + it.amount, 0) || 1;
		return h(
			'div',
			{ class: 'sdBarList' },
			items.map((it) =>
				h('div', { class: 'sdBarRow' }, [
					h('div', { class: 'sdBarName', text: it.name }),
					h('div', { class: 'sdBarTrack' }, [
						h('div', {
							class: 'sdBarFill',
							style: `width:${Math.max(1, (it.amount / max) * 100)}%;background:${color}`,
						}),
						h('span', { class: 'sdBarValue', text: `${fmt.money(it.amount)} · ${fmt.percent(it.amount / total)}` }),
					]),
				]),
			),
		);
	};

	// A titled card holding a chart. With a table builder, a toggle swaps the chart for a
	// table so every value can be read without hovering. Charts measure their container,
	// so drawing is deferred until the card is in the document: call card.draw().
	// opts: { title, subtitle?, legend?, chart(el), table?(): Node, showTable, onToggle }
	const card = (opts) => {
		const body = h('div', { class: 'sdCardBody' });
		const toggle = opts.table
			? h('button', {
					class: 'sdLinkButton',
					text: opts.showTable ? 'Show chart' : 'Show table',
					onclick: withSound(opts.onToggle),
				})
			: null;
		const el = h('div', { class: 'sdCard' }, [
			h('div', { class: 'sdCardHead' }, [
				h('div', {}, [
					h('div', { class: 'sdCardTitle', text: opts.title }),
					opts.subtitle ? h('div', { class: 'sdCardSub', text: opts.subtitle }) : null,
				]),
				toggle,
			]),
			opts.legend && !opts.showTable ? opts.legend : null,
			body,
		]);
		el.draw = () => {
			if (opts.showTable && opts.table) body.appendChild(opts.table());
			else opts.chart(body);
		};
		return el;
	};

	// A plain titled card around existing content.
	const panel = (title, subtitle, children) =>
		h('div', { class: 'sdCard' }, [
			h('div', { class: 'sdCardTitle', text: title }),
			subtitle ? h('div', { class: 'sdCardSub', text: subtitle }) : null,
			...children,
		]);

	// A 0–100 gauge with its value and a word for it; the words carry the meaning, the bar
	// colour only identifies which gauge it is.
	const meter = (label, value, words, color) =>
		h('div', { class: 'sdMeter' }, [
			h('div', { class: 'sdMeterHead' }, [
				h('span', { class: 'sdTileLabel', text: label }),
				h('span', { class: 'sdMeterValue', text: `${Math.round(value)} · ${words}` }),
			]),
			h('div', { class: 'sdMeterTrack' }, [
				h('div', {
					class: 'sdMeterFill',
					style: `width:${Math.max(0, Math.min(100, value))}%;background:${color}`,
				}),
			]),
		]);

	SD.dom = {
		h,
		withSound,
		icon,
		empty,
		note,
		badge,
		status,
		tile,
		tiles,
		legend,
		money,
		table,
		barList,
		card,
		panel,
		meter,
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
