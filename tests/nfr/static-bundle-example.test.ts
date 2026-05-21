import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();

describe('basic static bundle example', () => {
	test('example generation command produces documented output shape', async () => {
		const outputRoot = await mkdtemp(join(tmpdir(), 'isostate-basic-bundle-'));
		const output = join(outputRoot, 'scene');

		try {
			const result = spawnSync(
				'bun',
				[
					'run',
					'isostate',
					'bundle',
					'examples/basic/source.isostate.yaml',
					'--out',
					output,
					'--asset-dir',
					'assets/aws-3d',
					'--public-asset-base',
					'./assets'
				],
				{ cwd: root, encoding: 'utf8' }
			);

			expect(result.stderr).not.toContain('ERROR');
			expect(result.status).toBe(0);
			expect(existsSync(join(output, 'isostate.runtime.js'))).toBe(true);
			expect(existsSync(join(output, 'scene.isostate.js'))).toBe(true);
			expect(existsSync(join(output, 'manifest.json'))).toBe(true);
			expect(existsSync(join(output, 'assets'))).toBe(true);
		} finally {
			await rm(outputRoot, { force: true, recursive: true });
		}
	});
});
