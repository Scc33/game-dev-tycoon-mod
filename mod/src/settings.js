// Studio Dashboard: per-save on/off settings for gameplay features. The modAPI has no
// settings screen, so the dashboard's Settings tab lists them. Values live in the save's
// mod data, so each save keeps its own choices; an option never set uses its default.
//
// Features declare options by key, in any load order:
//   SD.options['franchise.hype'] = { group, name, description, default, order }
((SD) => {
	const S = (SD.settings = {});
	SD.options = SD.options || {};

	const values = () => {
		const store = SD.getStore();
		const data = store.data || (store.data = {});
		return data.settings || (data.settings = {});
	};

	S.list = () =>
		Object.entries(SD.options)
			.map(([id, option]) => ({ id, ...option }))
			.sort((a, b) => (a.order || 0) - (b.order || 0) || a.id.localeCompare(b.id));

	S.get = (id) => {
		const value = values()[id];
		if (value !== undefined) return value;
		const option = SD.options[id];
		return option ? option.default : undefined;
	};

	S.set = (id, value) => {
		values()[id] = value;
	};
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
