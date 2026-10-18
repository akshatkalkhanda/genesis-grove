import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
let failed = false;
for (const directory of ['src', 'scripts', 'tests']) {
    for (const file of await readdir(new URL(`../${directory}/`, import.meta.url))) {
        if (!/\.(js|mjs|cjs)$/.test(file)) continue;
        const result = spawnSync(process.execPath, ['--check', `${directory}/${file}`], { stdio: 'inherit' });
        if (result.status !== 0) failed = true;
    }
}
if (failed) process.exit(1);
console.log('All JavaScript syntax checks passed.');
