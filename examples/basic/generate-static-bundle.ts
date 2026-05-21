import { runCli } from '../../packages/cli/src/index.ts';

const result = await runCli([
	'bundle',
	'examples/basic/source.isostate.yaml',
	'--out',
	'examples/basic/static-bundle',
	'--asset-dir',
	'assets/aws-3d',
	'--public-asset-base',
	'./assets'
]);

if (result.exitCode !== 0) {
	process.exitCode = result.exitCode;
}
