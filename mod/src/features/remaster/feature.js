// Studio Dashboard remasters: hooks the feature into the game. The action menu on an
// idle staff member offers "Remaster a game...", the work is registered as one of the game's
// staff activities, remasters are kept out of the Develop Sequel picker, and a weekly check
// cleans up abandoned work and tells the player once remasters become possible.
((SD) => {
	const R = (SD.remaster = SD.remaster || {});

	const guarded =
		(what, fn) =>
		(...args) => {
			try {
				return fn(...args);
			} catch (error) {
				SD.warn(`remaster ${what} failed`, error);
				return undefined;
			}
		};

	R.menuItem = (staff) => ({
		label: 'Remaster a game...',
		icon: `${SD.assetPath}/img/remaster.svg`,
		action: () => {
			Sound.click();
			R.window.open(staff.id);
		},
	});

	// Who a click on the office floor is about: the person under the cursor, or the
	// founder in the garage, where the game shows staff options for them.
	const staffForMenu = (company) => (company.currentLevel > 1 ? UI.getCharUnderCursor() : company.staff[0]);

	// Sequels continue from the series' latest new game, never from a remaster.
	const wrapSequelPicker = () => {
		const proto = typeof Company !== 'undefined' ? Company.prototype : null;
		const original = proto && proto.getPossibleGamesForSequel;
		if (typeof original !== 'function' || original.sdWrapped) return;
		const wrapped = function (...args) {
			return original.apply(this, args).filter((g) => !(g.flags && g.flags[R.project.FLAG]));
		};
		wrapped.sdWrapped = true;
		proto.getPossibleGamesForSequel = wrapped;
	};

	R.install = (keys) => {
		// The work must be findable by id whenever a save with a remaster underway loads, so it
		// is registered whether or not the feature is switched on.
		Training[R.project.TRAINING_ID] = R.project.trainingItem();
		wrapSequelPicker();
		GDT.on(
			keys.ui.contextMenuShowing,
			guarded('menu', (e) => {
				if (!e || e.type !== 'primary') return;
				const company = GameManager.company;
				const staff = company && staffForMenu(company);
				if (R.project.canOffer(company, staff)) e.items.push(R.menuItem(staff));
			}),
		);
		GDT.on(
			keys.gameplay.weekProceeded,
			guarded('weekly update', (e) => R.project.onWeek((e && e.company) || GameManager.company)),
		);
		// "Remaster: Star Quest Remastered" and friends are development spending.
		SD.classify.addRule((label) => {
			const names = Object.values(R.model.TUNING.tiers).map((t) => t.name);
			return names.some((name) => label.startsWith(`${name}: `)) ? 'development' : null;
		});
	};

	SD.features = SD.features || {};
	SD.features.remaster = { install: R.install };
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
