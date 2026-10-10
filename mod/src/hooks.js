// Studio Dashboard: connects the mod to game events. Installed once all scripts load.
((SD) => {
	const H = (SD.hooks = {});
	let installed = false;

	// Hook the company's cash log and start the ledger now, so the reconciliation baseline is
	// the balance at attach time rather than at the first recorded movement.
	const track = (company) => {
		if (!company) return;
		SD.ledger.attach(company);
		SD.ledger.state(company);
	};

	H.menuItem = () => ({
		label: 'Studio Dashboard...',
		icon: `${SD.assetPath}/img/icon.svg`,
		action: () => {
			Sound.click();
			SD.dashboard.open();
		},
	});

	H.install = () => {
		if (installed) return;
		installed = true;
		const keys = GDT.eventKeys;

		// The modAPI only replaces our store when the save contains data for this mod, so a
		// save from before the mod was installed would otherwise inherit the previous game's.
		GDT.on(keys.saves.loading, (e) => {
			const modData = e && e.data && e.data.modData;
			if (!modData || !modData[SD.MOD_ID]) SD.getStore().data = {};
		});
		GDT.on(keys.saves.loaded, () => track(GameManager.company));
		GDT.on(keys.saves.newGame, () => track(GameManager.company));
		GDT.on(keys.gameplay.weekProceeded, (e) => {
			const company = (e && e.company) || GameManager.company;
			track(company);
			SD.ledger.onWeek(company);
		});
		GDT.on(keys.ui.contextMenuShowing, (e) => {
			if (e && (e.type === 'primary' || e.type === 'secondary')) e.items.push(H.menuItem());
		});

		// A new engine is paid for under its not-yet-known name.
		SD.classify.wrapWithCategory(GameManager, 'createEngine', 'research');

		// Enabled while a company is already running: start tracking straight away.
		track(GameManager.company);
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
