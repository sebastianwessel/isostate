export {
	DEFAULT_CELL_SIZE,
	projectToScreen,
	calculateVisualSize,
	calculateTransform,
	linear,
	easeInCubic,
	easeOutCubic,
	easeInOutCubic,
	resolveEasing,
	type EasingFn,
	type EasingType
} from './utils/index.ts';

export { applyThemeToElement } from './rendering/theme.ts';

export {
	buildSceneDOM,
	type RenderConfig
} from './rendering/rendering-engine.ts';

export {
	AnimationEngine,
	type LifecycleKey,
	type FrameUpdate
} from './animation/animation-engine.ts';

export { AnimationController } from './animation/controller.ts';
export type {
	ControllerConfig,
	ControllerEvents
} from './animation/controller.ts';

export {
	mountScene,
	type MountSceneOptions,
	type MountedScene,
	type ResolvedRuntimeConfig,
	type RuntimeBundle
} from './runtime/index.ts';

export {
	AssetRegistryImpl,
	createAssetRegistry,
	createDefaultRegistry,
	resolveTheme,
	composeTheme
} from './types/asset-registry.ts';

export type {
	AssetDefinition,
	AssetCategory,
	AssetRegistry,
	Theme,
	EntryAnimation,
	ExitAnimation,
	LifecycleStatus,
	AmbientAnimation,
	ElementPlacement,
	ElementPatch,
	ElementRemoval,
	RuntimeElementState,
	AssetCatalogEntry,
	FloorConfig,
	GridConfig,
	LayoutFit,
	LayoutBounds,
	ResolvedLayoutConfig,
	LayerDefinition,
	SceneHeader,
	SceneStep,
	SceneDocument,
	RuntimeSceneStop,
	CompiledAsset,
	CompiledFloor,
	CompiledLayout,
	CompiledLayer,
	ValidationError,
	ValidationWarning,
	ValidationReport
} from './types/index.ts';

export {
	guardEntryAnimation,
	guardExitAnimation,
	guardLifecycleStatus
} from './types/node.ts';

export {
	ParseError,
	ValidationErrorClass,
	RenderError,
	AnimationError,
	ControllerError
} from './types/errors.ts';
