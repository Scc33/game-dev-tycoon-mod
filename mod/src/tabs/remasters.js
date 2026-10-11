// Studio Dashboard tab: remasters underway, games ready for one, and how past ones did.
((SD) => {
	const SIZES = { small: 'Small', medium: 'Medium', large: 'Large', aaa: 'AAA' };
	const YEAR = SD.WEEKS_PER_MONTH * SD.MONTHS_PER_YEAR;

	const render = (body, { company }) => {
		const { note } = SD.dom;
		const P = SD.remaster.project;
		const enabled = P.enabled();
		const underway = P.underway(company);
		const released = P.released(company);

		if (!enabled) {
			body.appendChild(
				note('info-sign', [
					'Remasters are switched off for this save in the Settings tab. Work already underway still finishes.',
				]),
			);
		}
		if (enabled && !underway.length && !released.length) body.appendChild(howItWorks());
		underway.forEach((u) => body.appendChild(underwayCard(u)));
		if (enabled) body.appendChild(readyCard(company, P.eligible(company)));
		const upcoming = P.upcoming(company).slice(0, 5);
		if (enabled && upcoming.length) body.appendChild(upcomingCard(upcoming));
		if (released.length) body.appendChild(releasedCard(released));
	};

	const howItWorks = () => {
		const { h, panel } = SD.dom;
		const T = SD.remaster.model.TUNING;
		return panel('How remasters work', null, [
			h('ul', { class: 'sdList' }, [
				h('li', {
					text: `Any game that scored ${T.minScore} or more can be remastered once, ${T.minAgeWeeks / YEAR} years after release.`,
				}),
				h('li', {
					text: 'Click an idle staff member and choose "Remaster a game...". They work on it alone, like a training course, while the rest of the studio carries on.',
				}),
				h('li', {
					text: "A port is quick and cheap, a remaster is polished for today, and a remake is rebuilt from scratch and can beat the original's reviews.",
				}),
				h('li', {
					text: 'Remasters sell to nostalgic fans on today’s platforms, and refresh the brand of the series they belong to.',
				}),
			]),
		]);
	};

	const underwayCard = (u) => {
		const { h, panel, meter } = SD.dom;
		const fmt = SD.fmt;
		const M = SD.remaster.model;
		const who = u.staff ? u.staff.name : 'Nobody';
		return panel(
			`${M.tierName(u.project.tier)} underway: ${u.project.title}`,
			`${who} has been on it since ${fmt.date(u.project.startWeek)}.`,
			[
				meter('Progress', u.progress * 100, `about ${u.weeksLeft} weeks to go`, '#d9822b'),
				h('div', {
					class: 'sdMuted',
					text: `Budget ${fmt.money(u.project.budget)}. Reviews expected around ${fmt.score(u.project.expected)}.`,
				}),
			],
		);
	};

	const readyCard = (company, eligible) => {
		const { h, panel, table, empty } = SD.dom;
		const fmt = SD.fmt;
		const P = SD.remaster.project;
		if (!eligible.length) {
			return panel('Ready to remaster', null, [
				empty(
					P.busy()
						? 'One remaster at a time: the next can start when this one is out.'
						: 'Nothing yet: a game needs a few years behind it and fond memories (a score of 6 or more).',
				),
			]);
		}
		const brand = (c) => {
			const value = P.brand(company, c.game.id);
			return value === null ? '–' : String(Math.round(value));
		};
		return panel(
			'Ready to remaster',
			P.busy()
				? 'One remaster at a time: the next can start when the one underway is out.'
				: 'Click an idle staff member and choose "Remaster a game..." to start one.',
			[
				table(
					[
						{ name: 'Game', value: (c) => c.game.title },
						{ name: 'Released', value: (c) => fmt.date(c.game.releaseWeek) },
						{ name: 'Score', cls: 'sdNum', value: (c) => fmt.score(c.game.score) },
						{ name: 'Size', value: (c) => SIZES[c.game.size] || c.game.size || '–' },
						{ name: 'Age', cls: 'sdNum', value: (c) => `${Math.floor(c.ageWeeks / YEAR)} yr` },
						{ name: 'Nostalgia', cls: 'sdNum', value: (c) => fmt.percent(c.nostalgia) },
						{ name: 'Series brand', cls: 'sdNum', value: brand },
					],
					eligible,
				),
				h('div', {
					class: 'sdNote',
					text: 'Nostalgia grows from 5 to 15 years after release and raises sales. A loved series sells more too.',
				}),
			],
		);
	};

	const upcomingCard = (upcoming) => {
		const { panel, table } = SD.dom;
		const fmt = SD.fmt;
		return panel('Coming up', 'Good games that need a little longer.', [
			table(
				[
					{ name: 'Game', value: (c) => c.game.title },
					{ name: 'Score', cls: 'sdNum', value: (c) => fmt.score(c.game.score) },
					{ name: 'Can be remastered from', value: (c) => fmt.date(c.eligibility.fromWeek) },
				],
				upcoming,
			),
		]);
	};

	const releasedCard = (released) => {
		const { h, panel, table, badge, money } = SD.dom;
		const fmt = SD.fmt;
		const M = SD.remaster.model;
		const versus = (r) => {
			if (!r.original) return fmt.score(r.game.score);
			const delta = r.game.score - r.original.score;
			const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
			return `${fmt.score(r.game.score)} (${sign}${Math.abs(delta).toFixed(1)})`;
		};
		return panel('Released remasters', null, [
			table(
				[
					{
						name: 'Title',
						value: (r) => h('span', {}, [r.game.title, badge(M.tierName(r.game.remasterTier))]),
					},
					{
						name: 'Original',
						value: (r) => (r.original ? `${r.original.title} (${fmt.score(r.original.score)})` : '–'),
					},
					{ name: 'Released', value: (r) => fmt.date(r.game.releaseWeek) },
					{ name: 'Score', cls: 'sdNum', value: versus },
					{
						name: 'Sales',
						cls: 'sdNum',
						value: (r) => (r.multiplier ? `${fmt.percent(r.multiplier)} of new` : '–'),
					},
					{ name: 'Revenue', cls: 'sdNum', value: (r) => fmt.money(r.game.revenue) },
					{ name: 'Profit', cls: 'sdNum', value: (r) => money(r.game.profit, { signed: true }) },
				],
				released,
			),
		]);
	};

	SD.tabs = SD.tabs || {};
	SD.tabs.remasters = { name: 'Remasters', order: 45, render };
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
