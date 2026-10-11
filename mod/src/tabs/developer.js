// Studio Dashboard tab: developer cheats for testing. Hidden unless "Developer tools" is on.
((SD) => {
	const render = (body, { company, state, refresh }) => {
		const { h, panel, withSound, note } = SD.dom;
		const dev = SD.dev;
		const fmt = SD.fmt;

		const button = (label, action, { disabled = false } = {}) =>
			h(
				'button',
				{
					class: 'sdDevButton',
					disabled: disabled ? 'disabled' : null,
					onclick: withSound(() => {
						try {
							state.last = action();
						} catch (error) {
							state.last = error.message;
						}
						refresh();
					}),
				},
				[label],
			);
		const row = (label, buttons, sub) =>
			h('div', { class: 'sdDevRow' }, [
				h('div', { class: 'sdDevLabel' }, [
					h('strong', { text: label }),
					sub ? h('span', { class: 'sdMuted', text: sub }) : null,
				]),
				h('div', { class: 'sdDevButtons' }, buttons),
			]);

		body.appendChild(
			note('warning-sign', ['Cheats change this save for good. Use them on a test save, or save first.']),
		);

		const speed = dev.currentSpeed();
		body.appendChild(
			panel('Studio', null, [
				row(
					'Cash',
					[button('+100K', () => dev.cash(100000)), button('+1M', () => dev.cash(1000000))],
					fmt.money(company.cash),
				),
				row(
					'Fans',
					[button('+10K', () => dev.fans(10000)), button('+100K', () => dev.fans(100000))],
					fmt.int(company.fans),
				),
				row(
					'Research',
					[
						button('Sequels & packs', () => dev.unlock('sequels'), { disabled: dev.unlocked('sequels') }),
						button('Game sizes', () => dev.unlock('sizes'), { disabled: dev.unlocked('sizes') }),
						button('MMO', () => dev.unlock('mmo'), { disabled: dev.unlocked('mmo') }),
					],
					'Unlock without researching',
				),
				row(
					'Game speed',
					[1, 4, 10, 30].map((f) => button(`${f}×`, () => dev.speed(f), { disabled: speed === f })),
					`Now ${speed}×. Applies when the game resumes.`,
				),
				row(
					'Skip ahead',
					[button('1 year', () => dev.skipWeeks(48)), button('5 years', () => dev.skipWeeks(240))],
					'Time passes when the game resumes. Best between games.',
				),
				row(
					'Game in development',
					[button('Finish now', () => dev.finish(), { disabled: !dev.canFinish() })],
					company.currentGame ? company.currentGame.title : 'None',
				),
				row(
					'Remaster underway',
					[button('Finish now', () => dev.finishRemaster(), { disabled: !dev.canFinishRemaster() })],
					dev.canFinishRemaster() ? 'Releases it at once' : 'None',
				),
			]),
		);

		const scores = h('input', {
			class: 'sdDevInput',
			value: state.scores || '8, 8.5, 9',
			title: 'Review scores, oldest first',
		});
		const gap = h('input', {
			class: 'sdDevInput sdDevShort',
			type: 'number',
			value: state.gap || 60,
			title: 'Weeks between entries',
		});
		const name = h('input', { class: 'sdDevInput', value: state.name || 'Test Saga', title: 'Series name' });
		body.appendChild(
			panel('Made-up history', 'Adds finished, sold-out games to the release history, ending 20 weeks ago', [
				h('div', { class: 'sdDevForm' }, [
					h('label', {}, ['Series ', name]),
					h('label', {}, ['Scores ', scores]),
					h('label', {}, ['Weeks apart ', gap]),
					button('Add series', () => {
						Object.assign(state, { name: name.value, scores: scores.value, gap: gap.value });
						const entries = scores.value
							.split(',')
							.map((s) => parseFloat(s))
							.filter((s) => s >= 1 && s <= 10)
							.map((score) => ({ score, gap: Number(gap.value) || 0 }));
						return entries.length ? dev.addSeries({ name: name.value || 'Test Saga', entries }) : [];
					}),
				]),
			]),
		);

		if (state.last !== undefined)
			body.appendChild(h('p', { class: 'sdMuted', text: `Last result: ${JSON.stringify(state.last)}` }));
	};

	SD.tabs = SD.tabs || {};
	SD.tabs.developer = {
		name: 'Developer',
		order: 95,
		visible: () => !!(SD.settings && SD.settings.get('dev.tools')),
		render,
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
