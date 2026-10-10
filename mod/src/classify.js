// Studio Dashboard: sorts cash movements into categories from the label the game gives
// them (e.g. "MacMan sales", "monthly costs", "Small Marketing Campaign").
((SD) => {
	const K = (SD.classify = {});

	// Display order. Amounts keep their sign, so a category can hold both income and
	// expenses (a contract pays out, a missed deadline costs a penalty).
	K.CATEGORIES = [
		{ id: 'sales', name: 'Game sales' },
		{ id: 'deals', name: 'Contracts & publishing' },
		{ id: 'hardware', name: 'Consoles & platform' },
		{ id: 'finance', name: 'Investors & loans' },
		{ id: 'salaries', name: 'Salaries' },
		{ id: 'upkeep', name: 'Office upkeep' },
		{ id: 'development', name: 'Game development' },
		{ id: 'marketing', name: 'Marketing & conventions' },
		{ id: 'research', name: 'Research & engines' },
		{ id: 'staff', name: 'Hiring & training' },
		{ id: 'facilities', name: 'Office & facilities' },
		{ id: 'licenses', name: 'Platform licenses' },
		{ id: 'other', name: 'Events & other' },
	];

	K.categoryName = (id) => (K.CATEGORIES.find((c) => c.id === id) || { name: id }).name;

	// Fixed labels as [english text, localisation context, category]. They go through the
	// game's .localize() with the same context the game uses, so matching works in every
	// language. A context of false means the game never localises that label.
	const EXACT = [
		['monthly costs', 'heading', 'monthly'],
		['Up-front payment', 'heading', 'deals'],
		['Contract Refund', 'heading', 'deals'],
		['contract payment', 'heading', 'deals'],
		['contract penalty', 'heading', 'deals'],
		['Dividends', 'heading', 'finance'],
		['Bailout', 'heading', 'finance'],
		['Bailout payback', 'heading', 'finance'],
		['Share Offer', 'heading', 'finance'],
		['Grid income', 'heading', 'hardware'],
		['Hardware lab', null, 'research'],
		['R&D lab', null, 'research'],
		['New Office', null, 'facilities'],
		['New office', null, 'facilities'],
		['New equipment', null, 'facilities'],
		['solar panels', 'heading', 'facilities'],
		['air conditioner', 'heading', 'facilities'],
		['security upgrades', false, 'facilities'],
		['Find Staff', 'heading', 'staff'],
		['Sponsorship', 'heading', 'other'],
		['legal claims', 'expense label', 'other'],
		['Gullibility Tax', 'name of expense when player falls into the scam trap.', 'other'],
		['Departure Science', 'see Portal 2 reference hint', 'other'],
		['All Your IP Belongs To US', null, 'other'],
	];

	const localize = (text, context) => {
		if (context === false || typeof text.localize !== 'function') return text;
		return context ? text.localize(context) : text.localize();
	};

	const templateRegex = (template) =>
		new RegExp(`^${template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\{0\\}', '(.+)')}$`);

	const nameSet = (list) => {
		const set = {};
		(list || []).forEach((item) => {
			if (item && item.name) set[item.name] = true;
		});
		return set;
	};

	const endsWith = (s, suffix) => !!suffix && s.length > suffix.length && s.endsWith(suffix);

	// Everything classification needs, read from the game. Tests build their own.
	K.context = (company, game = globalThis) => {
		const exact = {};
		EXACT.forEach(([text, context, category]) => {
			exact[localize(text, context)] = category;
		});
		const titles = {};
		(company.gameLog || []).forEach((g) => {
			titles[g.title] = true;
		});
		const engines = nameSet(company.engines);
		if (game.GameManager && game.GameManager.currentEngineDev) engines[game.GameManager.currentEngineDev.name] = true;
		return {
			exact,
			sales: templateRegex(localize('{0} sales')),
			maintenance: templateRegex(localize('{0} maintenance')),
			projectCosts: templateRegex(localize('{0} costs')),
			devStage: templateRegex(localize('Dev. stage {0}')),
			sdkSuffix: localize(' SDK', 'short for Software Development Kit'),
			licenseSuffix: ` ${localize('dev. license', ' used as {platformname} dev. license')}`,
			refundSuffix: ' refund',
			gameTitles: titles,
			currentGameTitle: company.currentGame ? company.currentGame.title : null,
			research: game.Research && game.Research.getAllItems ? nameSet(game.Research.getAllItems()) : {},
			training: game.Training && game.Training.getAllTrainings ? nameSet(game.Training.getAllTrainings()) : {},
			marketing: game.Missions && game.Missions.MarketingMissions ? nameSet(game.Missions.MarketingMissions) : {},
			booths: nameSet(company.booths),
			engines,
			salaries: (company.staff || []).reduce((sum, s) => sum + (s.salary || 0), 0),
			forced: K.forcedCategory || null,
		};
	};

	// Ordered rules; the first to return a category wins. Add new ones with K.addRule.
	const RULES = [
		(label, ctx) => ctx.forced,
		(label, ctx) => {
			const m = ctx.sales.exec(label);
			return m && (ctx.gameTitles[m[1]] ? 'sales' : 'hardware');
		},
		(label, ctx) => (ctx.maintenance.test(label) || ctx.devStage.test(label) ? 'development' : null),
		(label, ctx) => (ctx.currentGameTitle !== null && label === ctx.currentGameTitle ? 'development' : null),
		(label, ctx) => (ctx.marketing[label] || ctx.booths[label] ? 'marketing' : null),
		(label, ctx) => (ctx.research[label] || ctx.engines[label] ? 'research' : null),
		(label, ctx) => (ctx.training[label] ? 'staff' : null),
		(label, ctx) => (endsWith(label, ctx.licenseSuffix) ? 'licenses' : null),
		(label, ctx) =>
			endsWith(label, ctx.sdkSuffix) || endsWith(label, ctx.refundSuffix) || ctx.projectCosts.test(label)
				? 'hardware'
				: null,
	];

	K.addRule = (rule) => RULES.push(rule);

	// Returns one or more {cat, amount, label} parts for a cash movement.
	K.classify = (label, amount, ctx) => {
		const exact = ctx.exact[label];
		if (exact === 'monthly') return splitMonthlyCosts(amount, ctx.salaries);
		if (exact) return [{ cat: exact, amount, label }];
		for (const rule of RULES) {
			const cat = rule(label, ctx);
			if (cat) return [{ cat, amount, label }];
		}
		return [{ cat: 'other', amount, label }];
	};

	// Rent and salaries arrive as one "monthly costs" payment; split them so the cost of
	// your team is visible on its own.
	const splitMonthlyCosts = (amount, salaryTotal) => {
		const salaries = Math.min(salaryTotal, -amount);
		const parts = [];
		if (salaries > 0) parts.push({ cat: 'salaries', amount: -salaries, label: 'Salaries' });
		if (amount + salaries < 0) parts.push({ cat: 'upkeep', amount: amount + salaries, label: 'Office upkeep' });
		return parts.length ? parts : [{ cat: 'upkeep', amount, label: 'Office upkeep' }];
	};

	// Some spending carries a label we cannot recognise yet (a new engine's name exists only
	// inside the call that pays for it). Wrap such calls to force a category.
	K.wrapWithCategory = (owner, method, category) => {
		const original = owner && owner[method];
		if (typeof original !== 'function' || original.sdWrapped) return;
		const wrapped = function (...args) {
			const previous = K.forcedCategory;
			K.forcedCategory = category;
			try {
				return original.apply(this, args);
			} finally {
				K.forcedCategory = previous;
			}
		};
		wrapped.sdWrapped = true;
		owner[method] = wrapped;
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
