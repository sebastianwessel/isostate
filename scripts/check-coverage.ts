import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const threshold = 80;
const lcov = readFileSync(join(process.cwd(), 'coverage/lcov.info'), 'utf8');
let covered = 0;
let total = 0;

for (const line of lcov.split('\n')) {
	if (!line.startsWith('DA:')) continue;
	const count = Number(line.split(',')[1]);
	if (!Number.isFinite(count)) continue;
	total += 1;
	if (count > 0) covered += 1;
}

const percent = total === 0 ? 0 : (covered / total) * 100;
if (percent < threshold) {
	console.error(
		`Coverage is ${percent.toFixed(2)}%; required minimum is ${threshold}%.`
	);
	process.exit(1);
}

console.log(`Coverage is ${percent.toFixed(2)}% (>= ${threshold}%).`);
