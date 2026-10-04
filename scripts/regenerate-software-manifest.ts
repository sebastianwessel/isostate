import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** Refresh catalog metadata without changing its timestamp on unchanged builds. */
export async function regenerateSoftwareManifest(): Promise<void> {
	const root = resolve(import.meta.dirname, '..');
	const source = join(root, 'assets/software-architecture');
	const destination = join(source, 'manifest.json');
	const directory = await mkdtemp(join(tmpdir(), 'isostate-catalog-'));
	try {
		const generatedPath = join(directory, 'manifest.json');
		const command = Bun.spawn(
			[
				process.execPath,
				join(root, 'packages/cli/src/bin.ts'),
				'assets',
				'manifest',
				source,
				'--out',
				generatedPath,
				'--asset-base-url',
				'./'
			],
			{ stdout: 'ignore', stderr: 'pipe' }
		);
		const [status, error] = await Promise.all([
			command.exited,
			new Response(command.stderr).text()
		]);
		if (status !== 0) throw new Error(`Catalog generation failed: ${error}`);
		const generated = await readFile(generatedPath, 'utf8');
		const current = await readFile(destination, 'utf8').catch(() => '{}');
		const normalize = (text: string) =>
			JSON.stringify({
				...JSON.parse(text),
				generatedAt: ''
			});
		if (normalize(current) !== normalize(generated)) {
			await writeFile(destination, generated);
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}
