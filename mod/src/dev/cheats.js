// Studio Dashboard developer cheats, for testing the mod and play-testing its balance.
// Players only see them after switching on "Developer tools" in the Settings tab (which
// adds a Developer tab); scripts/cheat.mjs calls the same functions over remote debugging.
((SD) => {
	const D = (SD.dev = {});

	SD.options = SD.options || {};
	SD.options['dev.tools'] = {
		group: 'Developer',
		name: 'Developer tools',
		description:
			'Adds a Developer tab with cheats for testing: money, fans, research, game speed, skipping time, finishing a game or remaster and made-up release history. Using them changes this save.',
		default: false,
		order: 1000,
	};

	const company = () => GameManager.company;

	D.cash = (amount = 1000000) => {
		company().adjustCash(amount, 'Developer cheat');
		return company().cash;
	};

	D.fans = (amount = 100000) => {
		company().adjustFans(amount);
		return company().fans;
	};

	// Research items by group, using the game's own Research keys.
	D.UNLOCKS = {
		sequels: ['Sequels', 'expansionPack'],
		sizes: ['MediumSizeGames', 'LargeSizeGames', 'AAA'],
		mmo: ['MMOSupport', 'MMO'],
	};

	D.unlock = (group = 'sequels') => {
		const done = company().researchCompleted;
		const added = (D.UNLOCKS[group] || [])
			.map((key) => Research[key])
			.filter((item) => item && done.indexOf(item) === -1);
		added.forEach((item) => done.push(item));
		return added.map((item) => item.name);
	};

	D.unlocked = (group) =>
		(D.UNLOCKS[group] || []).every((key) => company().researchCompleted.indexOf(Research[key]) !== -1);

	// Game speed as a multiple of normal (the game's own settings use 0.5, 1 and 2.5). Same
	// mechanism as GameManager.setGameSpeed, without its debug-build limit.
	D.speed = (factor = 1) => {
		if (GameManager.isGamePaused()) GameManager._oldTimeModifier = factor;
		else GameManager._timeModifier = factor;
		return factor;
	};

	D.currentSpeed = () => (GameManager.isGamePaused() ? GameManager._oldTimeModifier : GameManager._timeModifier) || 1;

	// Press the game's Finish button for the game in development, once it offers it.
	D.canFinish = () => {
		const game = company().currentGame;
		return !!(game && game.flags.releaseReady && !game.flags.devCompleted && !game.flags.finished);
	};

	D.finish = () => {
		if (!D.canFinish()) return false;
		const button = $('#releaseButton');
		if (button.length) button.click();
		else {
			if (GameManager.currentFeature) GameManager.currentFeature.progress = 1;
			company().currentGame.flags.finished = true;
		}
		return true;
	};

	// Moves the clock forward. The game catches up week by week as soon as it runs again:
	// sales, monthly costs, new platforms and events all happen as if the time had passed.
	// Best used between games: a game in development would finish its current stage at once.
	D.skipWeeks = (weeks = 48) => {
		if (!(weeks > 0)) throw new Error('Skip a positive number of weeks.');
		GameManager.gameTime += weeks * GameManager.SECONDS_PER_WEEK * 1000;
		return weeks;
	};

	// Completes remaster work underway now, through the game's own finishing step.
	const remastering = () =>
		(company().staff || []).find(
			(s) => s.currentResearch && SD.remaster && s.currentResearch.id === SD.remaster.project.TRAINING_ID,
		) || null;

	D.canFinishRemaster = () => !!remastering();

	D.finishRemaster = () => {
		const staff = remastering();
		if (!staff) return false;
		GameManager.finishResearch(staff);
		return true;
	};

	const byName = (list, name, fallback) => list.find((x) => x.name === name) || fallback;

	const tooEarly = (week) =>
		`That history would start ${-week} weeks before the company was founded. Use smaller gaps, a shorter "ago", or a later save.`;

	// A finished, sold-out game added to the release history, for testing anything that reads
	// history (franchises, reviews, charts) without playing it. Built from the game's own
	// Game class so every field the game expects is present.
	D.addGame = ({ title, score = 7, week, sequelTo = null, genre, topic, size = 'small', revenue, costs } = {}) => {
		const c = company();
		if (week !== undefined && week < 0) throw new Error(tooEarly(week));
		// The Game constructor hands any pending conference hype to the new game; keep it.
		const conferenceHype = c.conferenceHype;
		const game = new Game(c);
		c.conferenceHype = conferenceHype;
		game.hypePoints = 0;
		const weeks = { small: 10, medium: 15, large: 20, aaa: 25 }[size] || 10;
		game.title = title || `Test game ${c.gameLog.length + 1}`;
		game.genre = byName(GameGenre.getAll(), genre, GameGenre.getAll()[0]);
		game.topic = byName(Topics.topics, topic, Topics.topics[0]);
		// Having made a game on a topic, the studio knows it (sequels need an owned topic).
		if (c.topics && c.topics.indexOf(game.topic) === -1) c.topics.push(game.topic);
		game.platforms = [Platforms.allPlatforms.find((p) => p.id === 'PC')];
		game.gameSize = size;
		game.targetAudience = 'everyone';
		game.score = score;
		game.reviews = ['Star Games', 'Informed Gamer', 'Game Hero', 'All Games'].map((reviewerName) => ({
			score: Math.round(score),
			message: 'Test review.',
			reviewerName,
		}));
		game.releaseWeek = week === undefined ? Math.floor(c.currentWeek) - weeks : week;
		game.state = GameState.released;
		game.sequelTo = sequelTo;
		game.costs = costs === undefined ? 50000 : costs;
		game.revenue = revenue === undefined ? Math.round(20000 * score * score) : revenue;
		game.totalSalesCash = game.currentSalesCash = game.revenue;
		game.salesCashLog = Array.from({ length: weeks }, () => Math.round(game.revenue / weeks));
		game.unitPrice = Sales.getUnitPrice(game);
		game.unitsSold = Math.round(game.revenue / game.unitPrice);
		game.featureLog = [];
		game.features = [];
		game.soldOut = true;
		game.flags.devCompleted = true;
		c.gameLog.push(game);
		c.gameLog.sort((a, b) => a.releaseWeek - b.releaseWeek);
		return game;
	};

	// A whole series: entries [{ score, gap }] in order, each `gap` weeks after the previous
	// one, with the last released `ago` weeks before now. Same genre and topic throughout
	// unless an entry names its own.
	D.addSeries = ({
		name = 'Test Saga',
		entries = [{ score: 8 }, { score: 8.5, gap: 60 }],
		ago = 20,
		genre,
		topic,
	} = {}) => {
		const span = entries.slice(1).reduce((sum, e) => sum + (e.gap || 0), 0);
		let week = Math.floor(company().currentWeek) - ago - span;
		if (week < 0) throw new Error(tooEarly(week));
		let previous = null;
		return entries.map((entry, i) => {
			if (i > 0) week += entry.gap || 0;
			const game = D.addGame({
				title: i === 0 ? name : `${name} ${i + 1}`,
				score: entry.score,
				week,
				sequelTo: previous ? previous.id : null,
				genre: entry.genre || genre,
				topic: entry.topic || topic,
				size: entry.size,
			});
			previous = game;
			return game.title;
		});
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
