import { Content as DocsReadme } from '../../docs/README.md';
import { Content as GettingStarted } from '../../docs/getting-started.md';
import { Content as InstallAuthoringSkill } from '../../docs/guides/install-authoring-skill.md';
import { Content as AuthorSceneDeltas } from '../../docs/guides/author-scene-deltas.md';
import { Content as UseTheCli } from '../../docs/guides/use-the-cli.md';
import { Content as DeployStaticBundle } from '../../docs/guides/deploy-static-bundle.md';
import { Content as ExamplesReadme } from '../../docs/examples/README.md';
import { Content as RuntimeBasic } from '../../docs/examples/runtime-basic.md';
import { Content as ControllerScroll } from '../../docs/examples/controller-scroll.md';
import { Content as CompileYaml } from '../../docs/examples/compile-yaml.md';
import { Content as CustomAssets } from '../../docs/examples/custom-assets.md';
import { Content as CustomTheme } from '../../docs/examples/custom-theme.md';
import { Content as InspectBundle } from '../../docs/examples/inspect-bundle.md';
import { Content as LowLevelRendering } from '../../docs/examples/low-level-rendering.md';
import { Content as PublicApi } from '../../docs/reference/public-api.md';
import { Content as RuntimeBundle } from '../../docs/reference/runtime-bundle.md';
import { Content as Errors } from '../../docs/reference/errors.md';
import { Content as Types } from '../../docs/reference/types.md';

export type DocEntry = {
	slug: string;
	title: string;
	group: 'Start' | 'Guides' | 'Examples' | 'Reference';
	Content: AstroComponentFactory;
};

type AstroComponentFactory = (_props: Record<string, unknown>) => unknown;

export const docs: DocEntry[] = [
	{ slug: 'README.md', title: 'Documentation', group: 'Start', Content: DocsReadme },
	{
		slug: 'guides/install-authoring-skill.md',
		title: 'Install Authoring Skill',
		group: 'Start',
		Content: InstallAuthoringSkill
	},
	{ slug: 'getting-started.md', title: 'Getting Started', group: 'Start', Content: GettingStarted },
	{
		slug: 'guides/author-scene-deltas.md',
		title: 'Author Scene Deltas',
		group: 'Guides',
		Content: AuthorSceneDeltas
	},
	{
		slug: 'guides/use-the-cli.md',
		title: 'Use The CLI',
		group: 'Guides',
		Content: UseTheCli
	},
	{
		slug: 'guides/deploy-static-bundle.md',
		title: 'Deploy Static Bundle',
		group: 'Guides',
		Content: DeployStaticBundle
	},
	{ slug: 'examples/README.md', title: 'Examples', group: 'Examples', Content: ExamplesReadme },
	{ slug: 'examples/runtime-basic.md', title: 'Runtime Basic', group: 'Examples', Content: RuntimeBasic },
	{
		slug: 'examples/controller-scroll.md',
		title: 'Controller Scroll',
		group: 'Examples',
		Content: ControllerScroll
	},
	{ slug: 'examples/compile-yaml.md', title: 'Compile YAML', group: 'Examples', Content: CompileYaml },
	{ slug: 'examples/custom-assets.md', title: 'Custom Assets', group: 'Examples', Content: CustomAssets },
	{ slug: 'examples/custom-theme.md', title: 'Custom Theme', group: 'Examples', Content: CustomTheme },
	{ slug: 'examples/inspect-bundle.md', title: 'Inspect Bundle', group: 'Examples', Content: InspectBundle },
	{
		slug: 'examples/low-level-rendering.md',
		title: 'Low-Level Rendering',
		group: 'Examples',
		Content: LowLevelRendering
	},
	{ slug: 'reference/public-api.md', title: 'Public API', group: 'Reference', Content: PublicApi },
	{ slug: 'reference/runtime-bundle.md', title: 'Runtime Bundle', group: 'Reference', Content: RuntimeBundle },
	{ slug: 'reference/errors.md', title: 'Errors', group: 'Reference', Content: Errors },
	{ slug: 'reference/types.md', title: 'Types', group: 'Reference', Content: Types }
];

export const docGroups = ['Start', 'Guides', 'Examples', 'Reference'] as const;
