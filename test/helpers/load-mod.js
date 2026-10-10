import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const MOD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../mod');

// Runs mod source files as classic scripts in a fresh sandbox, the way the game loads
// them, and returns the StudioDashboard namespace they build. `globals` stubs game objects.
export function loadMod(files, globals = {}) {
	const context = vm.createContext({ console, ...globals });
	for (const file of files) {
		const filename = path.join(MOD_DIR, file);
		vm.runInContext(readFileSync(filename, 'utf8'), context, { filename });
	}
	return context.StudioDashboard;
}

// Values built inside the sandbox have the sandbox's prototypes; normalise them before
// deepStrictEqual comparisons.
export const plain = (value) => JSON.parse(JSON.stringify(value));
