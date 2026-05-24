import { Content as HowIsostateWorks } from '../../docs/concepts/how-isostate-works.md';
import { Content as AssetManifest } from '../../docs/examples/asset-manifest.md';
import { Content as CameraFocus } from '../../docs/examples/camera-focus.md';
import { Content as CompileYaml } from '../../docs/examples/compile-yaml.md';
import { Content as ControllerScroll } from '../../docs/examples/controller-scroll.md';
import { Content as CustomAssets } from '../../docs/examples/custom-assets.md';
import { Content as CustomTheme } from '../../docs/examples/custom-theme.md';
import { Content as EditorBasic } from '../../docs/examples/editor-basic.md';
import { Content as EditorExport } from '../../docs/examples/editor-export.md';
import { Content as EditorReact } from '../../docs/examples/editor-react.md';
import { Content as InspectBundle } from '../../docs/examples/inspect-bundle.md';
import { Content as LowLevelRendering } from '../../docs/examples/low-level-rendering.md';
import { Content as ExamplesReadme } from '../../docs/examples/README.md';
import { Content as RuntimeBasic } from '../../docs/examples/runtime-basic.md';
import { Content as GettingStarted } from '../../docs/getting-started.md';
import { Content as AnimationAndConnections } from '../../docs/guides/animation-and-connections.md';
import { Content as AssetsWorkflow } from '../../docs/guides/assets-workflow.md';
import { Content as AuthorSceneDeltas } from '../../docs/guides/author-scene-deltas.md';
import { Content as DeployStaticBundle } from '../../docs/guides/deploy-static-bundle.md';
import { Content as InstallAuthoringSkill } from '../../docs/guides/install-authoring-skill.md';
import { Content as PlanAScene } from '../../docs/guides/plan-a-scene.md';
import { Content as UseEditorInAstro } from '../../docs/guides/use-editor-in-astro.md';
import { Content as UseTheCli } from '../../docs/guides/use-the-cli.md';
import { Content as DocsReadme } from '../../docs/README.md';
import { Content as EditorReference } from '../../docs/reference/editor.md';
import { Content as Errors } from '../../docs/reference/errors.md';
import { Content as PublicApi } from '../../docs/reference/public-api.md';
import { Content as RuntimeBundle } from '../../docs/reference/runtime-bundle.md';
import { Content as Types } from '../../docs/reference/types.md';

export type DocEntry = {
	slug: string;
	title: string;
	Content: AstroComponentFactory;
};

type AstroComponentFactory = (_props: Record<string, unknown>) => unknown;

export type DocNavSection = {
	title: string;
	items: DocNavItem[];
};

type DocNavItem =
	| {
			type: 'doc';
			slug: string;
	  }
	| {
			type: 'group';
			title: string;
			items: string[];
	  };

export const docs: DocEntry[] = [
	{
		slug: 'README.md',
		title: 'Documentation',
		Content: DocsReadme
	},
	{
		slug: 'concepts/how-isostate-works.md',
		title: 'How isostate Works',
		Content: HowIsostateWorks
	},
	{
		slug: 'getting-started.md',
		title: 'Getting Started',
		Content: GettingStarted
	},
	{
		slug: 'guides/plan-a-scene.md',
		title: 'Plan A Scene',
		Content: PlanAScene
	},
	{
		slug: 'guides/author-scene-deltas.md',
		title: 'Author Scene Deltas',
		Content: AuthorSceneDeltas
	},
	{
		slug: 'guides/assets-workflow.md',
		title: 'Assets Workflow',
		Content: AssetsWorkflow
	},
	{
		slug: 'guides/animation-and-connections.md',
		title: 'Animation And Connections',
		Content: AnimationAndConnections
	},
	{
		slug: 'guides/use-editor-in-astro.md',
		title: 'Use The Editor',
		Content: UseEditorInAstro
	},
	{
		slug: 'guides/install-authoring-skill.md',
		title: 'AI Authoring Skill',
		Content: InstallAuthoringSkill
	},
	{
		slug: 'guides/use-the-cli.md',
		title: 'Use The CLI',
		Content: UseTheCli
	},
	{
		slug: 'guides/deploy-static-bundle.md',
		title: 'Deploy Static Bundle',
		Content: DeployStaticBundle
	},
	{
		slug: 'examples/README.md',
		title: 'Examples',
		Content: ExamplesReadme
	},
	{
		slug: 'examples/runtime-basic.md',
		title: 'Runtime Basic',
		Content: RuntimeBasic
	},
	{
		slug: 'examples/controller-scroll.md',
		title: 'Controller Scroll',
		Content: ControllerScroll
	},
	{
		slug: 'examples/camera-focus.md',
		title: 'Camera Focus',
		Content: CameraFocus
	},
	{
		slug: 'examples/compile-yaml.md',
		title: 'Compile YAML',
		Content: CompileYaml
	},
	{
		slug: 'examples/custom-assets.md',
		title: 'Custom Assets',
		Content: CustomAssets
	},
	{
		slug: 'examples/custom-theme.md',
		title: 'Custom Theme',
		Content: CustomTheme
	},
	{
		slug: 'examples/inspect-bundle.md',
		title: 'Inspect Bundle',
		Content: InspectBundle
	},
	{
		slug: 'examples/editor-basic.md',
		title: 'Editor Basic',
		Content: EditorBasic
	},
	{
		slug: 'examples/editor-react.md',
		title: 'Editor React',
		Content: EditorReact
	},
	{
		slug: 'examples/editor-export.md',
		title: 'Editor Export',
		Content: EditorExport
	},
	{
		slug: 'examples/asset-manifest.md',
		title: 'Asset Manifest',
		Content: AssetManifest
	},
	{
		slug: 'examples/low-level-rendering.md',
		title: 'Low-Level Rendering',
		Content: LowLevelRendering
	},
	{
		slug: 'reference/public-api.md',
		title: 'Public API',
		Content: PublicApi
	},
	{
		slug: 'reference/editor.md',
		title: 'Editor',
		Content: EditorReference
	},
	{
		slug: 'reference/runtime-bundle.md',
		title: 'Runtime Bundle',
		Content: RuntimeBundle
	},
	{
		slug: 'reference/errors.md',
		title: 'Errors',
		Content: Errors
	},
	{
		slug: 'reference/types.md',
		title: 'Types',
		Content: Types
	}
];

export const docNav: DocNavSection[] = [
	{
		title: 'Start',
		items: [
			{ type: 'doc', slug: 'README.md' },
			{ type: 'doc', slug: 'concepts/how-isostate-works.md' },
			{ type: 'doc', slug: 'getting-started.md' }
		]
	},
	{
		title: 'Create',
		items: [
			{
				type: 'group',
				title: 'Plan',
				items: ['guides/plan-a-scene.md']
			},
			{
				type: 'group',
				title: 'Author',
				items: [
					'guides/use-editor-in-astro.md',
					'guides/author-scene-deltas.md',
					'guides/install-authoring-skill.md'
				]
			},
			{
				type: 'group',
				title: 'Visual Language',
				items: [
					'guides/assets-workflow.md',
					'guides/animation-and-connections.md'
				]
			}
		]
	},
	{
		title: 'Ship',
		items: [
			{
				type: 'group',
				title: 'Verify',
				items: ['guides/use-the-cli.md', 'examples/inspect-bundle.md']
			},
			{
				type: 'group',
				title: 'Publish',
				items: ['guides/deploy-static-bundle.md', 'examples/asset-manifest.md']
			}
		]
	},
	{
		title: 'Examples',
		items: [
			{ type: 'doc', slug: 'examples/README.md' },
			{
				type: 'group',
				title: 'Runtime',
				items: [
					'examples/runtime-basic.md',
					'examples/controller-scroll.md',
					'examples/camera-focus.md'
				]
			},
			{
				type: 'group',
				title: 'Authoring',
				items: [
					'examples/compile-yaml.md',
					'examples/custom-assets.md',
					'examples/custom-theme.md',
					'examples/low-level-rendering.md'
				]
			},
			{
				type: 'group',
				title: 'Editor',
				items: [
					'examples/editor-basic.md',
					'examples/editor-react.md',
					'examples/editor-export.md'
				]
			}
		]
	},
	{
		title: 'Reference',
		items: [
			{ type: 'doc', slug: 'reference/public-api.md' },
			{ type: 'doc', slug: 'reference/editor.md' },
			{ type: 'doc', slug: 'reference/runtime-bundle.md' },
			{ type: 'doc', slug: 'reference/types.md' },
			{ type: 'doc', slug: 'reference/errors.md' }
		]
	}
];
