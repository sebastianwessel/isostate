export {
	AnimationEngine,
	type FrameUpdate,
	type LifecycleKey,
} from "./animation/animation-engine.ts";
export type {
	CameraGridArea,
	CameraState,
	CameraZoomOptions,
	ControllerConfig,
	ControllerEvents,
} from "./animation/controller.ts";
export { AnimationController } from "./animation/controller.ts";
export {
	buildSceneDOM,
	type RenderConfig,
} from "./rendering/rendering-engine.ts";
export { applyThemeToElement } from "./rendering/theme.ts";
export {
	exportScenePng,
	exportSceneSvg,
	type PngSnapshotOptions,
	type SnapshotOptions,
} from "./runtime/export.ts";
export type { ElementPointerEvent, MountedSceneEvents } from "./runtime/index.ts";
export {
	type MountedScene,
	type MountSceneOptions,
	mountScene,
	type ResolvedRuntimeConfig,
	type RuntimeBundle,
} from "./runtime/index.ts";
export {
	AssetRegistryImpl,
	composeTheme,
	createAssetRegistry,
	createDefaultRegistry,
	resolveTheme,
} from "./types/asset-registry.ts";
export {
	AnimationError,
	ControllerError,
	ParseError,
	RenderError,
	ValidationErrorClass,
} from "./types/errors.ts";

export type {
	AmbientAnimation,
	AssetCatalogEntry,
	AssetCategory,
	AssetDefinition,
	AssetRegistry,
	CameraEasing,
	CameraFocus,
	CameraTarget,
	CompiledAsset,
	CompiledFloor,
	CompiledLayer,
	CompiledLayout,
	ConnectionPatch,
	ConnectionPlacement,
	ConnectionRemoval,
	ElementPatch,
	ElementPlacement,
	ElementRemoval,
	EntryAnimation,
	ExitAnimation,
	FloorConfig,
	GridConfig,
	LayerDefinition,
	LayoutBounds,
	LayoutFit,
	LifecycleStatus,
	PrimitiveContent,
	ResolvedLayoutConfig,
	RuntimeElementState,
	RuntimeSceneStop,
	SceneDocument,
	SceneHeader,
	SceneStep,
	TextContent,
	Theme,
	ValidationError,
	ValidationReport,
	ValidationWarning,
} from "./types/index.ts";

export {
	guardEntryAnimation,
	guardExitAnimation,
	guardLifecycleStatus,
} from "./types/node.ts";
export {
	calculateTransform,
	calculateVisualSize,
	DEFAULT_CELL_SIZE,
	type EasingFn,
	type EasingType,
	easeInCubic,
	easeInOutCubic,
	easeOutCubic,
	linear,
	projectToScreen,
	resolveEasing,
} from "./utils/index.ts";
