import { runCli } from '../../packages/cli/src/index.ts';

const result = await runCli([
	'bundle',
	'examples/city-growth/source.isostate.yaml',
	'--out',
	'examples/city-growth/static-bundle',
	'--asset-dir',
	'examples/city-growth/assets',
	'--public-asset-base',
	'./assets'
]);

if (result.exitCode !== 0) {
	process.exitCode = result.exitCode;
}
