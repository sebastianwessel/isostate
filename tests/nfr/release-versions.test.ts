import { describe, expect, test } from 'bun:test';
import {
	checkReleaseSources,
	checkReleaseVersions,
	releaseManifestPaths
} from '../../scripts/check-release-versions.ts';

function manifests() {
	return {
		'package.json': { version: '0.6.0' },
		'packages/core/package.json': { version: '0.6.0' },
		'packages/cli/package.json': {
			version: '0.6.0',
			dependencies: { '@sebastianwessel/isostate': '0.6.0' }
		},
		'packages/editor/package.json': {
			version: '0.6.0',
			dependencies: { '@sebastianwessel/isostate': '0.6.0' }
		}
	};
}

describe('release version checks', () => {
	test('accepts synchronized versions and emits the matching release tag', () => {
		expect(checkReleaseVersions(manifests())).toEqual({
			version: '0.6.0',
			tag: 'v0.6.0'
		});
	});

	for (const path of releaseManifestPaths) {
		test(`rejects an out-of-sync ${path}`, () => {
			const input = manifests();
			input[path].version = '0.5.0';
			expect(() => checkReleaseVersions(input)).toThrow(
				'Package versions must match'
			);
		});
	}

	for (const path of [
		'packages/cli/package.json',
		'packages/editor/package.json'
	] as const) {
		test(`rejects a non-exact core dependency in ${path}`, () => {
			const input = manifests();
			input[path].dependencies['@sebastianwessel/isostate'] = '^0.6.0';
			expect(() => checkReleaseVersions(input)).toThrow(
				'dependency on @sebastianwessel/isostate must equal package version'
			);
		});
	}

	test('rejects missing core dependencies', () => {
		const input = manifests();
		expect(() =>
			checkReleaseVersions({
				...input,
				'packages/editor/package.json': { version: '0.6.0' }
			})
		).toThrow('dep=undefined');
	});

	for (const version of ['0.6.0-beta.1', 'v0.6.0', '00.6.0', '0.6', '']) {
		test(`rejects invalid stable release version ${JSON.stringify(version)}`, () => {
			const input = manifests();
			input['package.json'].version = version;
			expect(() => checkReleaseVersions(input)).toThrow(
				'Release version must be stable semver'
			);
		});
	}
});

describe('release source checks', () => {
	const sources = {
		DEFAULT_VERSION: 'const DEFAULT_VERSION = "0.6.0";',
		RUNTIME_VERSION: "const RUNTIME_VERSION = '0.6.0';"
	};
	const workflows = {
		'release.yml': 'bun-version: 1.4.2\npackage-manager: bun@1.4.2\n'
	};

	test('accepts matching source constants and workflow pins', () => {
		expect(() =>
			checkReleaseSources('0.6.0', 'bun@1.4.2', sources, workflows)
		).not.toThrow();
	});

	for (const constant of ['DEFAULT_VERSION', 'RUNTIME_VERSION'] as const) {
		test(`rejects a stale ${constant}`, () => {
			expect(() =>
				checkReleaseSources(
					'0.6.0',
					'bun@1.4.2',
					{
						...sources,
						[constant]: `const ${constant} = "0.5.0";`
					},
					workflows
				)
			).toThrow(`${constant} must match release version`);
		});
	}

	test('rejects a missing version constant', () => {
		expect(() =>
			checkReleaseSources(
				'0.6.0',
				'bun@1.4.2',
				{
					...sources,
					RUNTIME_VERSION: ''
				},
				workflows
			)
		).toThrow('RUNTIME_VERSION must match release version');
	});

	for (const pin of ['bun@latest', 'bun@^1.4.2', 'npm@11.6.0', undefined]) {
		test(`rejects unpinned packageManager ${pin}`, () => {
			expect(() =>
				checkReleaseSources('0.6.0', pin, sources, workflows)
			).toThrow('packageManager must pin an exact Bun release');
		});
	}

	for (const workflow of [
		'bun-version: latest',
		'package-manager: bun@1.3.0',
		'node-version: 24'
	]) {
		test(`rejects an absent or mismatched workflow pin: ${workflow}`, () => {
			expect(() =>
				checkReleaseSources('0.6.0', 'bun@1.4.2', sources, {
					'release.yml': workflow
				})
			).toThrow();
		});
	}
});
