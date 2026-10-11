// Studio Dashboard remasters: the Remaster window, opened from a staff member's action
// menu. The player picks a game, a kind of remaster, platforms and a title, sees what it will
// cost and earn, and starts the work.
((SD) => {
	const R = (SD.remaster = SD.remaster || {});
	const W = (R.window = {});
	const WINDOW_ID = 'sdRemaster';

	const SIZES = { small: 'Small', medium: 'Medium', large: 'Large', aaa: 'AAA' };
	const BLURBS = {
		port: 'Quick and cheap. Plays as it always did, so reviews show its age.',
		remaster: 'Polished for today. Reviews forgive most of its age.',
		remake: 'Rebuilt from scratch. Takes longest, and can beat the original.',
	};

	// What the player has chosen so far; reset each time the window opens.
	let view = null;

	const root = () => document.getElementById(WINDOW_ID);
	const P = () => R.project;
	const company = () => GameManager.company;
	const staffOf = (c) => (c.staff || []).find((s) => s.id === view.staffId) || null;

	const install = () => {
		if (root()) return;
		const { h } = SD.dom;
		const win = h('div', { id: WINDOW_ID, class: 'windowBorder sdWindow' }, [
			h('div', { class: 'windowTitle smallerWindowTitle', text: 'Remaster a game' }),
			h('div', { class: 'sdBody' }),
		]);
		(document.getElementById('resources') || document.body).appendChild(win);
	};

	W.open = (staffId) => {
		const c = company();
		const first = P().eligible(c)[0];
		const platform = P().platforms(c)[0];
		view = {
			staffId,
			originalId: first ? first.game.id : null,
			tier: 'remaster',
			platformIds: platform ? [platform.id] : [],
			title: null, // null: follow the suggested title for the chosen game and tier
			error: null,
		};
		install();
		UI.showModalContent(`#${WINDOW_ID}`, {
			close: true,
			disableCheckForNotifications: true,
			onOpen: () => W.refresh(),
		});
	};

	const update = (changes) => {
		Object.assign(view, changes, { error: null });
		W.refresh();
	};

	// One selectable row per eligible game.
	const gameList = (c) => {
		const { h, withSound } = SD.dom;
		const rows = P()
			.eligible(c)
			.map((cand) => {
				const g = cand.game;
				const selected = g.id === view.originalId;
				return h(
					'button',
					{
						class: `sdRmGame${selected ? ' sdRmSelected' : ''}`,
						'aria-pressed': selected ? 'true' : 'false',
						onclick: withSound(() => update({ originalId: g.id, title: null })),
					},
					[
						h('span', { class: 'sdRmGameTitle', text: g.title }),
						h('span', {
							class: 'sdRmGameMeta',
							text: `Y${SD.dateOf(g.releaseWeek).year} · ${SD.fmt.score(g.score)} · ${SIZES[g.size] || g.size} · ${g.genre}/${g.topic}`,
						}),
						h('span', { class: 'sdRmNostalgia', title: 'Nostalgia' }, [
							h('span', { class: 'sdRmNostalgiaFill', style: `width:${Math.round(cand.nostalgia * 100)}%` }),
						]),
					],
				);
			});
		return h('div', { class: 'sdRmSection' }, [
			h('div', { class: 'sdRmHeading', text: 'Game' }),
			h('div', { class: 'sdRmHint', text: 'Bar: nostalgia, which grows from 5 to 15 years after release.' }),
			h('div', { class: 'sdRmGames' }, rows),
		]);
	};

	const tierPicker = () => {
		const { h, withSound } = SD.dom;
		const tiers = R.model.TUNING.tiers;
		return h('div', { class: 'sdRmSection' }, [
			h('div', { class: 'sdRmHeading', text: 'Kind' }),
			h(
				'div',
				{ class: 'sdRmChoices' },
				R.model.TIERS.map((tier) =>
					h('button', {
						class: `sdRmChoice${tier === view.tier ? ' sdRmSelected' : ''}`,
						'aria-pressed': tier === view.tier ? 'true' : 'false',
						text: tiers[tier].name,
						onclick: withSound(() => update({ tier, title: null })),
					}),
				),
			),
			h('div', { class: 'sdRmHint', text: BLURBS[view.tier] }),
		]);
	};

	const platformPicker = (c) => {
		const { h, withSound } = SD.dom;
		const max = P().maxPlatforms(c);
		const toggle = (id) => {
			const on = view.platformIds.indexOf(id) !== -1;
			let ids = on ? view.platformIds.filter((x) => x !== id) : view.platformIds.concat(id);
			if (max === 1 && !on) ids = [id];
			if (ids.length > max) return;
			update({ platformIds: ids });
		};
		return h('div', { class: 'sdRmSection' }, [
			h('div', { class: 'sdRmHeading', text: max > 1 ? `Platforms (up to ${max})` : 'Platform' }),
			h(
				'div',
				{ class: 'sdRmChoices sdRmWrap' },
				P()
					.platforms(c)
					.map((p) => {
						const on = view.platformIds.indexOf(p.id) !== -1;
						return h(
							'button',
							{
								class: `sdRmChoice${on ? ' sdRmSelected' : ''}`,
								'aria-pressed': on ? 'true' : 'false',
								onclick: withSound(() => toggle(p.id)),
							},
							[
								p.name,
								h('span', {
									class: 'sdRmChoiceSub',
									// The game reports market share in percent.
									text: `${SD.fmt.percent(Platforms.getTotalMarketSizePercent(p, c) / 100)} · ${SD.fmt.money(p.developmentCosts)}`,
								}),
							],
						);
					}),
			),
			h('div', { class: 'sdRmHint', text: 'Market share · per-game platform cost. Only licensed platforms on sale.' }),
		]);
	};

	const titleField = (plan) => {
		const { h } = SD.dom;
		const input = h('input', {
			class: 'sdRmTitle',
			type: 'text',
			maxlength: '40',
			value: view.title === null ? plan.title : view.title,
			'aria-label': 'Title',
		});
		// Typing must not redraw the window, or the field would lose focus.
		input.addEventListener('input', () => {
			view.title = input.value;
		});
		return h('div', { class: 'sdRmSection' }, [h('div', { class: 'sdRmHeading', text: 'Title' }), input]);
	};

	const line = (label, value, sub) => {
		const { h } = SD.dom;
		return h('div', { class: 'sdRmLine' }, [
			h('span', { class: 'sdRmLabel', text: label }),
			h('span', { class: 'sdRmValue' }, [value, sub ? h('span', { class: 'sdRmSub', text: sub }) : null]),
		]);
	};

	const signed = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`;

	const summary = (c, staff, plan, original) => {
		const { h, icon } = SD.dom;
		const fmt = SD.fmt;
		const effect = P().seriesEffect(c, view.originalId, plan.expected);
		const short = c.cash < plan.budget;
		const parts = [`original ${fmt.score(original.score)}`];
		if (plan.dating) parts.push(`dated ${signed(-plan.dating)}`);
		const bonus = R.model.TUNING.tiers[view.tier].bonus;
		if (bonus) parts.push(`remake ${signed(bonus)}`);
		parts.push(`${staff.name} ${signed(plan.skillBonus)}`);
		return h('div', { class: 'sdRmSummary' }, [
			line(
				'Time',
				`${plan.weeks % 1 ? plan.weeks.toFixed(1) : plan.weeks} weeks`,
				`${staff.name} sits out of game development until it's done`,
			),
			line(
				'Budget',
				h('span', { class: short ? 'sdNeg' : '', text: fmt.money(plan.budget) }),
				short ? `more than the ${fmt.money(c.cash)} in the bank` : null,
			),
			line('Reviews', `${fmt.score(plan.low)} to ${fmt.score(plan.high)}`, parts.join(', ')),
			line(
				'Sales',
				`${fmt.percent(plan.multiplier)} of a new game`,
				`with the same score on today's market (nostalgia ${fmt.percent(plan.nostalgia)}). The original earned ${fmt.money(original.revenue || 0)}.`,
			),
			effect
				? line(
						'Series',
						`brand ${Math.round(effect.brandBefore)} → ${Math.round(effect.brandAfter)}`,
						effect.fatigueAfter > effect.fatigueBefore
							? `fatigue ${Math.round(effect.fatigueBefore)} → ${Math.round(effect.fatigueAfter)}`
							: null,
					)
				: null,
			view.error ? h('div', { class: 'sdRmError' }, [icon('warning-sign'), ' ', view.error]) : null,
		]);
	};

	const start = () => {
		const c = company();
		const plan = current(c);
		try {
			P().start(c, {
				originalId: view.originalId,
				tier: view.tier,
				staffId: view.staffId,
				platformIds: view.platformIds,
				title: view.title === null ? plan.title : view.title,
			});
		} catch (error) {
			view.error = error.message;
			W.refresh();
			return;
		}
		UI.closeModal();
	};

	const current = (c) => {
		const platforms = P()
			.platforms(c)
			.filter((p) => view.platformIds.indexOf(p.id) !== -1);
		return P().plan(c, { originalId: view.originalId, tier: view.tier, staff: staffOf(c), platforms });
	};

	W.refresh = () => {
		const body = root() && root().querySelector('.sdBody');
		const c = company();
		if (!body || !c || !view) return;
		const { h, withSound, empty } = SD.dom;
		body.innerHTML = '';
		const staff = staffOf(c);
		const original = (c.gameLog || []).find((g) => g.id === view.originalId);
		if (!staff || !original) {
			body.appendChild(empty('There is nothing to remaster right now.'));
			return;
		}
		try {
			const plan = current(c);
			const ready = view.platformIds.length > 0 && c.cash >= plan.budget;
			body.appendChild(
				h('div', { class: 'sdRmIntro', text: `${staff.name} will bring an old game back for today's platforms.` }),
			);
			body.appendChild(
				h('div', { class: 'sdRmColumns' }, [
					gameList(c),
					h('div', { class: 'sdRmPlan' }, [
						tierPicker(),
						platformPicker(c),
						titleField(plan),
						summary(c, staff, plan, original),
						h('button', {
							class: 'sdRmStart',
							disabled: ready ? null : 'disabled',
							text: `Start ${R.model.TUNING.tiers[view.tier].name.toLowerCase()}`,
							onclick: withSound(start),
						}),
					]),
				]),
			);
		} catch (error) {
			SD.warn('could not draw the Remaster window', error);
			body.appendChild(empty('Something went wrong drawing this window. Details are in the developer console.'));
		}
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
