// Studio Dashboard franchise gameplay: fan events. Now and then fans ask for more of a
// series, celebrate its tenth anniversary or petition for a dormant one; the choices trade
// money or promises for brand. They are the game's own (non-random) decision events with
// our triggers, which keep them to at most one a year. See docs/design/phase-2-franchises.md.
((SD) => {
	const F = (SD.franchise = SD.franchise || {});
	const V = (F.events = {});
	const ID_PREFIX = 'scc33-franchise-';

	const T = () => F.model.TUNING;
	const enabled = (id) => SD.settings.get(id) !== false;
	const week = (company) => Math.floor(company.currentWeek);
	const fmt = () => SD.fmt;

	const sequelsResearched = (company) =>
		typeof Research === 'undefined' ||
		!Research.Sequels ||
		(company.researchCompleted || []).indexOf(Research.Sequels) !== -1;

	// Every series the player could continue: franchises plus standalone games, each with
	// its first and latest released entry and its brand now.
	V.candidates = (company) => {
		const groups = SD.franchises.all(company);
		const grouped = {};
		groups.forEach((f) =>
			f.entries.forEach((e) => {
				grouped[e.id] = true;
			}),
		);
		const singles = SD.games
			.all(company)
			.filter((g) => !grouped[g.id] && !g.isPack)
			.map((g) => ({ id: g.id, name: g.title, entries: [g], inDevelopment: false, revenue: g.revenue }));
		return groups
			.concat(singles)
			.map((series) => {
				const released = series.entries.filter((e) => !e.inDevelopment && !e.isPack);
				return {
					series,
					first: released[0],
					tail: released[released.length - 1],
					brand: F.series.state(series, company.currentWeek).brand,
				};
			})
			.filter((c) => c.tail);
	};

	const asked = (type, key) => F.store.events().some((e) => e.type === type && e.key === key);
	const best = (list, score) => list.sort((a, b) => score(b) - score(a))[0] || null;
	const since = (company, w) => company.currentWeek - w;

	const anniversaryCost = (c) =>
		Math.max(T().anniversaryMinCost, Math.round(T().anniversaryCostShare * (c.series.revenue || 0)));

	// Each type: find the best candidate (or null), describe the decision, apply a choice.
	// complete() returns the follow-up message, if any.
	V.TYPES = {
		tease: {
			find: (company, all) => {
				if (!sequelsResearched(company)) return null;
				const t = T();
				return best(
					all.filter(
						(c) =>
							!c.series.inDevelopment &&
							c.tail.score >= t.teaseMinScore &&
							since(company, c.tail.releaseWeek) >= t.teaseFromWeeks &&
							since(company, c.tail.releaseWeek) <= t.teaseToWeeks &&
							!F.store.openPromise(c.series.id) &&
							!asked('tease', c.tail.id),
					),
					(c) => c.tail.score,
				);
			},
			key: (c) => c.tail.id,
			header: () => 'Fans want more',
			text: (c) =>
				`Ever since ${c.tail.title} came out, fans have been flooding forums and our inbox asking for another ${c.series.name} game.{n}We could drop a hint that one is on the way. The next ${c.series.name} game would start with extra hype, but if none is under way within two years, fans will feel let down.`,
			options: () => ['Tease a sequel', 'No comment'],
			complete: (company, offer, decision) => {
				if (decision !== 0) return null;
				const t = T();
				F.store.addEvent({
					...base(offer, company),
					status: 'open',
					hype: t.teaseHype,
					penalty: t.teasePenalty,
					due: week(company) + t.promiseDueWeeks,
				});
				return `Fans are buzzing about a new ${offer.name} game. Start it before ${fmt().date(week(company) + t.promiseDueWeeks)} and it gets +${t.teaseHype} hype.`;
			},
		},

		anniversary: {
			find: (company, all) => {
				const t = T();
				return best(
					all.filter(
						(c) =>
							c.brand >= t.anniversaryMinBrand &&
							since(company, c.first.releaseWeek) >= t.anniversaryWeeks &&
							since(company, c.first.releaseWeek) < t.anniversaryWeeks + 52 &&
							company.cash >= 2 * anniversaryCost(c) &&
							!asked('anniversary', c.series.id),
					),
					(c) => c.brand,
				);
			},
			key: (c) => c.series.id,
			extra: (c) => ({ cost: anniversaryCost(c) }),
			header: (c) => `${c.series.name} turns 10`,
			text: (c) =>
				`It has been ten years since ${c.first.title} came out, and fans are planning celebrations.{n}We could join in with an anniversary event and special merchandise for ${fmt().money(anniversaryCost(c))}. It would remind everyone why they love ${c.series.name}.`,
			options: (c) => [`Celebrate (${fmt().money(anniversaryCost(c))})`, 'Let it pass'],
			complete: (company, offer, decision) => {
				if (decision !== 0) return null;
				const t = T();
				const fans = Math.round(company.fans * t.anniversaryFansShare);
				company.adjustCash(-offer.cost, `${offer.name} anniversary`);
				company.adjustFans(fans);
				F.store.addEvent({ ...base(offer, company), brand: t.anniversaryBrand, cost: offer.cost, fans });
				return `The ${offer.name} anniversary was a hit: brand +${t.anniversaryBrand} and ${fmt().int(fans)} new fans.`;
			},
		},

		revival: {
			find: (company, all) => {
				if (!sequelsResearched(company)) return null;
				const t = T();
				return best(
					all.filter(
						(c) =>
							!c.series.inDevelopment &&
							c.brand >= t.revivalMinBrand &&
							since(company, c.tail.releaseWeek) >= t.revivalSilentWeeks &&
							!F.store.openPromise(c.series.id) &&
							!asked('revival', c.tail.id),
					),
					(c) => c.brand,
				);
			},
			key: (c) => c.tail.id,
			header: () => "Where's the sequel?",
			text: (c, company) =>
				`It has been ${Math.floor(since(company, c.tail.releaseWeek) / 48)} years since the last ${c.series.name} game and fans have not forgotten: a petition for a new one has gathered thousands of signatures.{n}We could promise a return. The next ${c.series.name} game would start with a big boost of hype, but breaking the promise would hurt the series badly.`,
			options: () => ['Promise a return', 'Move on'],
			complete: (company, offer, decision) => {
				if (decision !== 0) return null;
				const t = T();
				F.store.addEvent({
					...base(offer, company),
					status: 'open',
					hype: t.revivalHype,
					penalty: t.revivalPenalty,
					due: week(company) + t.promiseDueWeeks,
				});
				return `Fans are celebrating the return of ${offer.name}. Start the new game before ${fmt().date(week(company) + t.promiseDueWeeks)} and it gets +${t.revivalHype} hype.`;
			},
		},
	};

	const base = (offer, company) => ({
		type: offer.type,
		series: offer.series,
		key: offer.key,
		week: week(company),
		choice: 0,
	});

	// The player chose `decision` (an option index) for a pending offer.
	V.complete = (company, type, decision) => {
		const offers = F.store.data().offers || {};
		const offer = offers[type];
		delete offers[type];
		if (!offer) return null;
		const message = V.TYPES[type].complete(company, offer, decision);
		if (message === null) F.store.addEvent({ ...base(offer, company), choice: decision });
		return message;
	};

	// The first franchise event whose trigger passes in a week claims that week, so two never
	// show together (the game checks every trigger before building any notification).
	let claimed = null;

	V.find = (company, type) => {
		if (!enabled('franchise.events')) return null;
		const data = F.store.data();
		if (data.lastEventWeek !== undefined && company.currentWeek - data.lastEventWeek < T().eventCooldownWeeks)
			return null;
		if (claimed && claimed.week === week(company) && claimed.type !== type) return null;
		return V.TYPES[type].find(company, V.candidates(company));
	};

	// Keeps or breaks open promises: kept once a new entry is under way, broken (brand
	// penalty) when the due week passes first.
	V.checkPromises = (company) => {
		const now = week(company);
		const broken = [];
		F.store
			.events()
			.filter((e) => e.status === 'open')
			.forEach((promise) => {
				const series = V.candidates(company).find((c) => c.series.id === promise.series);
				const started =
					series &&
					(series.series.inDevelopment ||
						series.series.entries.some((e) => e.releaseWeek > promise.week && !e.isPack && !e.isRemaster));
				if (started) promise.status = 'kept';
				else if (now > promise.due) {
					promise.status = 'broken';
					F.store.addEvent({
						type: 'brokenPromise',
						series: promise.series,
						week: promise.due,
						brand: promise.penalty,
					});
					broken.push({ promise, name: series ? series.series.name : 'the series' });
				}
			});
		return broken;
	};

	const note = (header, text, extra = {}) => new Notification({ header, text, ...extra });

	V.install = () => {
		Object.keys(V.TYPES).forEach((type) => {
			const def = V.TYPES[type];
			const id = ID_PREFIX + type;
			GDT.addEvent({
				id,
				isRandomEvent: false,
				trigger: (company) => {
					try {
						const found = !!V.find(company, type);
						if (found) claimed = { type, week: week(company) };
						return found;
					} catch (error) {
						SD.warn(`franchise event ${type} trigger failed`, error);
						return false;
					}
				},
				getNotification: (company) => {
					const c = V.find(company, type);
					const data = F.store.data();
					data.offers = data.offers || {};
					data.offers[type] = {
						type,
						series: c.series.id,
						name: c.series.name,
						key: def.key(c),
						week: week(company),
						...(def.extra ? def.extra(c) : {}),
					};
					data.lastEventWeek = company.currentWeek;
					return note(def.header(c), def.text(c, company), {
						sourceId: id,
						options: def.options(c),
					});
				},
				complete: (decision) => {
					const company = GameManager.company;
					try {
						const message = V.complete(company, type, decision);
						if (message) company.activeNotifications.addRange(note('Franchise', message).split());
					} catch (error) {
						SD.warn(`franchise event ${type} failed`, error);
					}
				},
			});
		});
		SD.classify.addRule((label) => (/ anniversary$/.test(label) ? 'marketing' : null));
	};

	V.onWeek = (company) => {
		if (!enabled('franchise.events')) return;
		V.checkPromises(company).forEach(({ promise, name }) => {
			if (company.notifications)
				company.notifications.push(
					note(
						'Franchise',
						`Fans feel let down: we promised a new ${name} game and none came. The series' brand suffered (${promise.penalty}).`,
					),
				);
		});
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
