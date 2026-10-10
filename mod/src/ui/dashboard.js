// Studio Dashboard: the dashboard window.
// Tabs live in src/tabs/ and declare themselves by key, in any load order:
//   SD.tabs.myTab = { name, order, render(body, ctx) }
// render() appends content to body. ctx gives it the company, a per-tab state object that
// survives re-renders, refresh(), and card(opts), which wires up chart/table toggles.
((SD) => {
	const D = (SD.dashboard = {});
	const WINDOW_ID = 'sdDashboard';
	const view = { tab: null, tables: {}, tabState: {} };

	D.tabs = () =>
		Object.entries(SD.tabs || {})
			.map(([id, tab]) => ({ id, ...tab }))
			.sort((a, b) => a.order - b.order);

	const root = () => document.getElementById(WINDOW_ID);

	D.install = () => {
		if (root()) return;
		const { h } = SD.dom;
		const win = h('div', { id: WINDOW_ID, class: 'windowBorder sdWindow' }, [
			h('div', { class: 'windowTitle smallerWindowTitle', text: 'Studio Dashboard' }),
			h('div', { class: 'sdTabs', role: 'tablist' }),
			h('div', { class: 'sdBody' }),
		]);
		// Hidden template container the game keeps its own windows in.
		(document.getElementById('resources') || document.body).appendChild(win);
	};

	D.open = (tabId) => {
		D.install();
		if (tabId) view.tab = tabId;
		// showModalContent waits for pending notifications, pauses the game while open and
		// adds the standard close button.
		UI.showModalContent(`#${WINDOW_ID}`, {
			close: true,
			onOpen: () => {
				renderTabs();
				D.refresh();
			},
		});
	};

	const activeTab = () => {
		const tabs = D.tabs();
		return tabs.find((t) => t.id === view.tab) || tabs[0];
	};

	const renderTabs = () => {
		const { h, withSound } = SD.dom;
		const bar = root().querySelector('.sdTabs');
		const current = activeTab();
		bar.innerHTML = '';
		D.tabs().forEach((t) => {
			const selected = t.id === current.id;
			bar.appendChild(
				h('button', {
					class: `sdTab${selected ? ' sdTabActive' : ''}`,
					role: 'tab',
					'aria-selected': selected ? 'true' : 'false',
					text: t.name,
					onclick: withSound(() => {
						if (t.id === activeTab().id) return;
						view.tab = t.id;
						renderTabs();
						D.refresh({ resetScroll: true });
					}),
				}),
			);
		});
	};

	D.refresh = ({ resetScroll = false } = {}) => {
		const body = root() && root().querySelector('.sdBody');
		if (!body || !GameManager.company) return;
		const tab = activeTab();
		const scroll = resetScroll ? 0 : body.scrollTop;
		const cards = [];
		const ctx = {
			company: GameManager.company,
			state: view.tabState[tab.id] || (view.tabState[tab.id] = {}),
			refresh: () => D.refresh(),
			card: (opts) => {
				const el = SD.dom.card({
					...opts,
					showTable: !!view.tables[opts.id],
					onToggle: () => {
						view.tables[opts.id] = !view.tables[opts.id];
						D.refresh();
					},
				});
				cards.push(el);
				return el;
			},
		};
		body.innerHTML = '';
		try {
			tab.render(body, ctx);
			cards.forEach((c) => c.draw());
		} catch (e) {
			SD.warn(`could not draw the ${tab.id} tab`, e);
			body.appendChild(SD.dom.empty('Something went wrong drawing this tab. Details are in the developer console.'));
		}
		body.scrollTop = scroll;
	};

	// Shared footnote for anything built from the ledger, which only starts at install.
	D.trackedNote = (d) => `Tracked since ${SD.fmt.date(d.since)}. Earlier cash history was not recorded.`;
})((globalThis.StudioDashboard = globalThis.StudioDashboard || {}));
