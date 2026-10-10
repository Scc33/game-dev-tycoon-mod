// Studio Dashboard tab: switches for the mod's gameplay features, saved with each save.
((SD) => {
	const render = (body, { refresh }) => {
		const { h, panel, empty, withSound } = SD.dom;
		const options = SD.settings.list();
		if (!options.length) {
			body.appendChild(empty('No gameplay features to configure.'));
			return;
		}

		const groups = {};
		options.forEach((o) => (groups[o.group] = groups[o.group] || []).push(o));

		Object.entries(groups).forEach(([group, list]) => {
			const rows = list.map((o) => {
				const input = h('input', { type: 'checkbox', id: `sdOpt-${o.id}` });
				input.checked = !!SD.settings.get(o.id);
				input.addEventListener(
					'change',
					withSound(() => {
						SD.settings.set(o.id, input.checked);
						refresh();
					}),
				);
				return h('label', { class: 'sdToggle', for: `sdOpt-${o.id}` }, [
					input,
					h('span', {}, [
						h('strong', { text: o.name }),
						o.description ? h('span', { class: 'sdMuted', text: o.description }) : null,
					]),
				]);
			});
			body.appendChild(panel(group, null, rows));
		});

		body.appendChild(
			h('p', {
				class: 'sdMuted',
				text: 'These settings belong to the current save and are stored when you save the game. Switching a feature off stops its future effects; anything it already did stays.',
			}),
		);
	};

	SD.tabs = SD.tabs || {};
	SD.tabs.settings = { name: 'Settings', order: 90, render };
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
