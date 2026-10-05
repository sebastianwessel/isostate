import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const releaseManifestPaths = [
	'package.json',
	'packages/core/package.json',
	'packages/cli/package.json',
	'packages/editor/package.json'
] as const;

type ManifestPath = (typeof releaseManifestPaths)[number];

interface ReleaseManifest {
	version: string;
	packageManager?: string;
	dependencies?: Record<string, string>;
}

const releaseSourcePaths = {
	DEFAULT_VERSION: 'packages/core/src/dsl/compiler.ts',
	RUNTIME_VERSION: 'packages/core/src/runtime/mount-scene.ts'
} as const;

/** Check emitted bundle versions and each workflow's explicit Bun pin. */
export function checkReleaseSources(
	version: string,
	packageManager: string | undefined,
	sources: Record<keyof typeof releaseSourcePaths, string>,
	workflows: Record<string, string>
): void {
	const bunVersion = packageManager?.match(/^bun@(\d+\.\d+\.\d+)$/)?.[1];
	if (!bunVersion)
		throw new Error('packageManager must pin an exact Bun release');
	for (const [constant, source] of Object.entries(sources)) {
		const found = source.match(
			new RegExp(`\\bconst ${constant} = ["']([^"']+)["']`)
		)?.[1];
		if (found !== version) {
			throw new Error(
				`${constant} must match release version: ${found} != ${version}`
			);
		}
	}
	for (const [path, workflow] of Object.entries(workflows)) {
		const pins = [
			...workflow.matchAll(/\b(?:bun-version|package-manager):\s*(\S+)/g)
		];
		if (!pins.length) throw new Error(`${path} must pin Bun`);
		for (const [, pin] of pins) {
			if (pin.replace(/^bun@/, '') !== bunVersion) {
				throw new Error(`${path} Bun pin ${pin} must match ${packageManager}`);
			}
		}
	}
}

/** Verify synchronized workspace versions before CI or a release. */
export function checkReleaseVersions(
	manifests: Record<ManifestPath, ReleaseManifest>
): { version: string; tag: string } {
	const version = manifests['package.json'].version;
	if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
		throw new Error(`Release version must be stable semver: ${version}`);
	}
	for (const path of releaseManifestPaths) {
		if (manifests[path].version !== version) {
			throw new Error(
				`Package versions must match: root=${version} ${path}=${manifests[path].version}`
			);
		}
	}
	for (const path of [
		'packages/cli/package.json',
		'packages/editor/package.json'
	] as const) {
		const dependency =
			manifests[path].dependencies?.['@sebastianwessel/isostate'];
		if (dependency !== version) {
			throw new Error(
				`${path} dependency on @sebastianwessel/isostate must equal package version: dep=${dependency} version=${version}`
			);
		}
	}
	return { version, tag: `v${version}` };
}

if (import.meta.main) {
	const root = resolve(import.meta.dirname, '..');
	const entries = await Promise.all(
		releaseManifestPaths.map(async (path) => [
			path,
			JSON.parse(await readFile(resolve(root, path), 'utf8')) as ReleaseManifest
		])
	);
	const result = checkReleaseVersions(
		Object.fromEntries(entries) as Record<ManifestPath, ReleaseManifest>
	);
	const sources = Object.fromEntries(
		await Promise.all(
			Object.entries(releaseSourcePaths).map(async ([constant, path]) => [
				constant,
				await readFile(resolve(root, path), 'utf8')
			])
		)
	) as Record<keyof typeof releaseSourcePaths, string>;
	const workflows = Object.fromEntries(
		await Promise.all(
			['pr.yml', 'release.yml', 'deploy-website.yml'].map(async (file) => [
				file,
				await readFile(resolve(root, '.github/workflows', file), 'utf8')
			])
		)
	);
	checkReleaseSources(
		result.version,
		(Object.fromEntries(entries) as Record<ManifestPath, ReleaseManifest>)[
			'package.json'
		].packageManager,
		sources,
		workflows
	);
	console.log(`version=${result.version}\ntag=${result.tag}`);
}
