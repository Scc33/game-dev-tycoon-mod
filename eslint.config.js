import js from '@eslint/js';
import globals from 'globals';

// Globals the game page provides to mods. Kept explicit so a typo is still caught.
const gameGlobals = {
	$: 'readonly',
	Company: 'readonly',
	DataStore: 'readonly',
	Game: 'readonly',
	GameGenre: 'readonly',
	GameManager: 'readonly',
	GameState: 'readonly',
	GDT: 'readonly',
	General: 'readonly',
	Logger: 'readonly',
	Missions: 'readonly',
	Platforms: 'readonly',
	Research: 'readonly',
	Reviews: 'readonly',
	Sales: 'readonly',
	Sound: 'readonly',
	Topics: 'readonly',
	Training: 'readonly',
	UI: 'readonly',
	VisualsManager: 'readonly',
};

export default [
	{ ignores: ['node_modules/'] },
	js.configs.recommended,
	{
		rules: {
			eqeqeq: ['error', 'always'],
			'no-var': 'error',
			'prefer-const': 'error',
			'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
		},
	},
	{
		// The mod, and dev snippets evaluated in the game, run as classic scripts inside the
		// game's NW.js 0.49 (Chromium 86).
		files: ['mod/**/*.js', 'scripts/in-game/**/*.js'],
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: 'script',
			globals: { ...globals.browser, ...gameGlobals },
		},
	},
	{
		files: ['scripts/**/*.mjs', 'test/**/*.js', '*.js'],
		languageOptions: {
			ecmaVersion: 2024,
			sourceType: 'module',
			globals: globals.node,
		},
	},
];
