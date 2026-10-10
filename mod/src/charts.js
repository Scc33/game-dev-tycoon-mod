// Studio Dashboard: small dependency-free SVG charts with hover tooltips.
// One mark spec everywhere: 2px lines, bars at most 24px wide with 4px rounded data-ends
// and square baselines, hairline gridlines, and text in ink colours, never series colours.
((SD) => {
	const C = (SD.charts = {});
	const NS = 'http://www.w3.org/2000/svg';
	const MARGIN = { top: 12, right: 16, bottom: 24, left: 52 };

	// Validated with the dataviz palette checker against the card surface (#fffdf7):
	// all pairs pass colour-vision-deficiency and contrast checks.
	C.colors = {
		income: '#2a78d6',
		expenses: '#e34948',
		net: '#4a3aa7',
		grid: '#ebe5d6',
		baseline: '#c9c2b0',
		muted: '#8a8478',
		surface: '#fffdf7',
	};

	// ---- Pure helpers ----

	// Round tick values: 0 / 2K / 4K rather than 0 / 1.7K / 3.4K. Always includes 0 when the
	// range spans it, so bars have a baseline.
	C.niceTicks = (min, max, count) => {
		if (min === max) max = min + 1;
		const raw = (max - min) / count;
		let step = 10 ** Math.floor(Math.log10(raw));
		const err = raw / step;
		if (err >= 7.5) step *= 10;
		else if (err >= 3.5) step *= 5;
		else if (err >= 1.5) step *= 2;
		const ticks = [];
		for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) {
			ticks.push(Math.round(v / step) * step);
		}
		return ticks;
	};

	// Path for a bar from the baseline to yEnd: rounded at the data end, square at the base.
	C.barPath = (x, w, yBase, yEnd) => {
		const h = Math.abs(yEnd - yBase);
		if (h < 0.5) return '';
		const r = Math.min(4, w / 2, h);
		const c = yEnd < yBase ? yEnd + r : yEnd - r;
		return `M${x},${yBase}V${c}Q${x},${yEnd} ${x + r},${yEnd}H${x + w - r}Q${x + w},${yEnd} ${x + w},${c}V${yBase}Z`;
	};

	// Show every nth label so labels at least minGap px apart never collide.
	C.labelStride = (count, plotWidth, minGap) => Math.max(1, Math.ceil(minGap / (plotWidth / Math.max(1, count))));

	// ---- SVG plumbing ----

	const svg = (tag, attrs, parent) => {
		const el = document.createElementNS(NS, tag);
		Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
		if (parent) parent.appendChild(el);
		return el;
	};

	const text = (parent, attrs, content) => {
		const el = svg('text', { class: 'sdAxisText', ...attrs }, parent);
		el.textContent = content;
		return el;
	};

	const frame = (el, height) => {
		el.innerHTML = '';
		el.classList.add('sdChart');
		const width = Math.max(320, el.clientWidth || 600);
		const root = svg('svg', { width, height, viewBox: `0 0 ${width} ${height}` }, el);
		const tooltip = document.createElement('div');
		tooltip.className = 'sdTooltip';
		el.appendChild(tooltip);
		return {
			root,
			tooltip,
			width,
			height,
			plotW: width - MARGIN.left - MARGIN.right,
			plotH: height - MARGIN.top - MARGIN.bottom,
		};
	};

	const yScale = (f, ticks) => {
		const lo = ticks[0];
		const hi = ticks[ticks.length - 1];
		return (v) => MARGIN.top + f.plotH * (1 - (v - lo) / (hi - lo));
	};

	const drawYAxis = (f, ticks, y, format) => {
		ticks.forEach((t) => {
			svg(
				'line',
				{
					x1: MARGIN.left,
					x2: f.width - MARGIN.right,
					y1: y(t),
					y2: y(t),
					stroke: t === 0 ? C.colors.baseline : C.colors.grid,
					'stroke-width': 1,
					'shape-rendering': 'crispEdges',
				},
				f.root,
			);
			text(f.root, { x: MARGIN.left - 8, y: y(t) + 4, 'text-anchor': 'end' }, format(t));
		});
	};

	const strokeLine = (points, color, parent) =>
		svg(
			'polyline',
			{
				points: points.join(' '),
				fill: 'none',
				stroke: color,
				'stroke-width': 2,
				'stroke-linejoin': 'round',
				'stroke-linecap': 'round',
			},
			parent,
		);

	const dot = (parent, color, attrs) =>
		svg('circle', { r: 4.5, fill: color, stroke: C.colors.surface, 'stroke-width': 2, ...attrs }, parent);

	// Tooltip rows lead with the value (strong), then the series name, keyed by a short line.
	const showTooltip = (f, x, title, rows) => {
		const tip = f.tooltip;
		tip.innerHTML = '';
		const head = document.createElement('div');
		head.className = 'sdTooltipTitle';
		head.textContent = title;
		tip.appendChild(head);
		rows.forEach((r) => {
			const row = document.createElement('div');
			row.className = 'sdTooltipRow';
			const key = document.createElement('span');
			key.className = 'sdKeyLine';
			key.style.background = r.color;
			const value = document.createElement('strong');
			value.textContent = r.value;
			const name = document.createElement('span');
			name.className = 'sdTooltipName';
			name.textContent = r.name;
			row.append(key, value, name);
			tip.appendChild(row);
		});
		tip.style.display = 'block';
		let left = x + 14;
		if (left + tip.offsetWidth > f.width) left = x - tip.offsetWidth - 14;
		tip.style.left = `${Math.max(0, left)}px`;
		tip.style.top = `${MARGIN.top}px`;
	};

	// Transparent layer over the plot that reports the hovered x position.
	const hoverLayer = (f, onMove, onLeave) => {
		const layer = svg(
			'rect',
			{ x: MARGIN.left, y: MARGIN.top, width: f.plotW, height: f.plotH, fill: 'transparent' },
			f.root,
		);
		layer.addEventListener('mousemove', (ev) => onMove(ev.clientX - f.root.getBoundingClientRect().left));
		layer.addEventListener('mouseleave', () => {
			f.tooltip.style.display = 'none';
			onLeave();
		});
	};

	// ---- Charts ----

	// Columns over evenly spaced categories, diverging around zero when values go
	// negative, with an optional overlay line on the same axis.
	// opts: { rows, label(row), tooltipTitle(row), bars: [{name, color, value(row), tooltipFormat?}],
	//         line?: {name, color, value(row), tooltipFormat?}, height?, format }
	C.columns = (el, opts) => {
		const f = frame(el, opts.height || 220);
		const { rows } = opts;
		const series = opts.bars.concat(opts.line ? [opts.line] : []);
		const values = rows.flatMap((r) => series.map((s) => s.value(r)));
		const ticks = C.niceTicks(Math.min(0, ...values), Math.max(0, ...values), 4);
		const y = yScale(f, ticks);
		const band = f.plotW / Math.max(1, rows.length);
		const xCenter = (i) => MARGIN.left + band * (i + 0.5);
		const barW = Math.max(2, Math.min(24, band * 0.62));

		drawYAxis(f, ticks, y, opts.format);
		const highlight = svg(
			'rect',
			{ x: 0, y: MARGIN.top, width: band, height: f.plotH, fill: '#000', opacity: 0 },
			f.root,
		);

		rows.forEach((r, i) => {
			opts.bars.forEach((s) => {
				const d = C.barPath(xCenter(i) - barW / 2, barW, y(0), y(s.value(r)));
				if (d) svg('path', { d, fill: s.color }, f.root);
			});
		});
		if (opts.line) {
			strokeLine(
				rows.map((r, i) => `${xCenter(i)},${y(opts.line.value(r))}`),
				opts.line.color,
				f.root,
			);
		}
		const marker = opts.line ? dot(f.root, opts.line.color, { opacity: 0 }) : null;

		const stride = C.labelStride(rows.length, f.plotW, 56);
		rows.forEach((r, i) => {
			if (i % stride === 0) text(f.root, { x: xCenter(i), y: f.height - 6, 'text-anchor': 'middle' }, opts.label(r));
		});

		hoverLayer(
			f,
			(px) => {
				const i = Math.min(rows.length - 1, Math.max(0, Math.floor((px - MARGIN.left) / band)));
				const r = rows[i];
				highlight.setAttribute('x', MARGIN.left + band * i);
				highlight.setAttribute('opacity', 0.05);
				if (marker) {
					marker.setAttribute('cx', xCenter(i));
					marker.setAttribute('cy', y(opts.line.value(r)));
					marker.setAttribute('opacity', 1);
				}
				showTooltip(
					f,
					xCenter(i),
					opts.tooltipTitle(r),
					series.map((s) => ({ name: s.name, color: s.color, value: (s.tooltipFormat || opts.format)(s.value(r)) })),
				);
			},
			() => {
				highlight.setAttribute('opacity', 0);
				if (marker) marker.setAttribute('opacity', 0);
			},
		);
	};

	// A single series line with a light area wash and crosshair tooltip, plus an optional
	// horizontal reference line (e.g. development cost) and an optional labelled point.
	// opts: { points: [{x, y}], name, color, height?, format, xLabel(x), tooltipTitle(point),
	//         reference?: {value, label}, marker?: {index, label} }
	C.line = (el, opts) => {
		const f = frame(el, opts.height || 200);
		const pts = opts.points;
		const ys = pts.map((p) => p.y).concat(opts.reference ? [opts.reference.value] : []);
		const ticks = C.niceTicks(Math.min(0, ...ys), Math.max(...ys), 4);
		const y = yScale(f, ticks);
		const x0 = pts[0].x;
		const x1 = pts[pts.length - 1].x;
		const x = (v) => MARGIN.left + (x1 === x0 ? f.plotW / 2 : (f.plotW * (v - x0)) / (x1 - x0));

		drawYAxis(f, ticks, y, opts.format);

		const coords = pts.map((p) => `${x(p.x)},${y(p.y)}`);
		const base = y(Math.max(ticks[0], 0));
		svg(
			'polygon',
			{ points: `${x(x0)},${base} ${coords.join(' ')} ${x(x1)},${base}`, fill: opts.color, opacity: 0.1 },
			f.root,
		);

		if (opts.reference) {
			const ry = y(opts.reference.value);
			svg(
				'line',
				{ x1: MARGIN.left, x2: f.width - MARGIN.right, y1: ry, y2: ry, stroke: C.colors.muted, 'stroke-width': 1 },
				f.root,
			);
			text(f.root, { x: f.width - MARGIN.right, y: ry - 5, 'text-anchor': 'end' }, opts.reference.label);
		}

		strokeLine(coords, opts.color, f.root);
		const end = pts[pts.length - 1];
		dot(f.root, opts.color, { cx: x(end.x), cy: y(end.y) });

		if (opts.marker) {
			const mp = pts[opts.marker.index];
			svg(
				'circle',
				{ cx: x(mp.x), cy: y(mp.y), r: 5, fill: C.colors.surface, stroke: opts.color, 'stroke-width': 2 },
				f.root,
			);
			text(f.root, { x: x(mp.x) + 8, y: y(mp.y) + 16 }, opts.marker.label);
		}

		const count = Math.min(6, pts.length);
		for (let k = 0; k < count; k++) {
			const idx = count === 1 ? 0 : Math.round((k * (pts.length - 1)) / (count - 1));
			const anchor = k === 0 ? 'start' : k === count - 1 ? 'end' : 'middle';
			text(f.root, { x: x(pts[idx].x), y: f.height - 6, 'text-anchor': anchor }, opts.xLabel(pts[idx].x));
		}

		const cross = svg(
			'line',
			{ y1: MARGIN.top, y2: MARGIN.top + f.plotH, stroke: C.colors.muted, 'stroke-width': 1, opacity: 0 },
			f.root,
		);
		const marker = dot(f.root, opts.color, { opacity: 0 });
		hoverLayer(
			f,
			(px) => {
				const p = pts.reduce((best, q) => (Math.abs(x(q.x) - px) < Math.abs(x(best.x) - px) ? q : best), pts[0]);
				cross.setAttribute('x1', x(p.x));
				cross.setAttribute('x2', x(p.x));
				cross.setAttribute('opacity', 0.6);
				marker.setAttribute('cx', x(p.x));
				marker.setAttribute('cy', y(p.y));
				marker.setAttribute('opacity', 1);
				showTooltip(f, x(p.x), opts.tooltipTitle(p), [{ name: opts.name, color: opts.color, value: opts.format(p.y) }]);
			},
			() => {
				cross.setAttribute('opacity', 0);
				marker.setAttribute('opacity', 0);
			},
		);
	};

	// Tiny inline trend (e.g. review scores across a series). Its values also appear in the
	// adjacent table, so it has no hover layer.
	C.spark = (values, { width = 90, height = 26, min, max, color = C.colors.income } = {}) => {
		const pad = 5;
		const lo = min !== undefined ? min : Math.min(...values);
		const hi = max !== undefined ? max : Math.max(...values);
		const root = svg('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'sdSpark' });
		const x = (i) => (values.length === 1 ? width / 2 : pad + ((width - pad * 2) * i) / (values.length - 1));
		const y = (v) => height - pad - (height - pad * 2) * (hi === lo ? 0.5 : (v - lo) / (hi - lo));
		strokeLine(
			values.map((v, i) => `${x(i)},${y(v)}`),
			color,
			root,
		);
		const last = values.length - 1;
		svg(
			'circle',
			{ cx: x(last), cy: y(values[last]), r: 3.5, fill: color, stroke: C.colors.surface, 'stroke-width': 1.5 },
			root,
		);
		return root;
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
