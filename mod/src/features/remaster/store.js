// Studio Dashboard remasters: what the feature keeps in the save's mod data.
//
//   remaster: {
//     v: 1,
//     projects: [{ staffId, originalId, tier, platformIds, title, budget, startWeek, weeks,
//                  expected }],   remasters underway
//     announced: boolean,        the one-off "you can remaster now" message was shown
//   }
//
// A released remaster keeps its details on the game itself (game.flags.sdRemaster), so the
// game's own records stay the single source for everything that has shipped.
((SD) => {
	const R = (SD.remaster = SD.remaster || {});
	const S = (R.store = {});

	S.data = () => {
		const store = SD.getStore();
		const data = store.data || (store.data = {});
		const d = data.remaster || (data.remaster = { v: 1 });
		if (!d.projects) d.projects = [];
		return d;
	};

	S.projects = () => S.data().projects;

	S.projectFor = (staffId) => S.projects().find((p) => p.staffId === staffId) || null;

	S.add = (project) => {
		S.projects().push(project);
		return project;
	};

	S.remove = (project) => {
		const list = S.projects();
		const i = list.indexOf(project);
		if (i !== -1) list.splice(i, 1);
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
