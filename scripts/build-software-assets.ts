import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { regenerateSoftwareManifest } from './regenerate-software-manifest.ts';
import { softwareCatalogFiles } from './software-catalog-files.ts';

await regenerateSoftwareManifest();

const source = resolve(import.meta.dirname, '../assets/software-architecture');
const destination = resolve(
	import.meta.dirname,
	'../packages/core/dist/assets/software-architecture'
);
const manifest = JSON.parse(
	await readFile(join(source, 'manifest.json'), 'utf8')
) as {
	assets: Array<{ path: string }>;
};

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const file of softwareCatalogFiles(manifest.assets)) {
	const target = join(destination, file);
	await mkdir(dirname(target), { recursive: true });
	await copyFile(join(source, file), target);
}

console.log(
	`Packaged ${manifest.assets.length} software architecture sprite sheets.`
);
