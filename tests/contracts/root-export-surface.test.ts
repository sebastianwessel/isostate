import { describe, expect, test } from 'bun:test';
import type {
	AmbientAnimation,
	AssetCatalogEntry,
	AssetCategory,
	AssetDefinition,
	AssetRegistry,
	CameraEasing,
	CameraFocus,
	CameraGridArea,
	CameraState,
	CameraTarget,
	CameraZoomOptions,
	CompiledAsset,
	CompiledFloor,
	CompiledLayer,
	CompiledLayout,
	ConnectionPatch,
	ConnectionPlacement,
	ConnectionRemoval,
	ControllerConfig,
	ControllerEvents,
	EasingFn,
	EasingType,
	ElementPatch,
	ElementPlacement,
	ElementRemoval,
	EntryAnimation,
	ExitAnimation,
	FloorConfig,
	FrameUpdate,
	GridConfig,
	LayerDefinition,
	LayoutBounds,
	LayoutFit,
	LifecycleKey,
	LifecycleStatus,
	MountedScene,
	MountSceneOptions,
	PrimitiveContent,
	RenderConfig,
	ResolvedLayoutConfig,
	ResolvedRuntimeConfig,
	RuntimeBundle,
	RuntimeElementState,
	RuntimeSceneStop,
	SceneDocument,
	SceneHeader,
	SceneStep,
	TextContent,
	Theme,
	ValidationError,
	ValidationReport,
	ValidationWarning
} from '@sebastianwessel/isostate';
import {
	AnimationController,
	AnimationEngine,
	AnimationError,
	AssetRegistryImpl,
	applyThemeToElement,
	buildSceneDOM,
	ControllerError,
	calculateTransform,
	calculateVisualSize,
	composeTheme,
	createAssetRegistry,
	createDefaultRegistry,
	DEFAULT_CELL_SIZE,
	easeInCubic,
	easeInOutCubic,
	easeOutCubic,
	guardEntryAnimation,
	guardExitAnimation,
	guardLifecycleStatus,
	linear,
	mountScene,
	ParseError,
	projectToScreen,
	RenderError,
	resolveEasing,
	resolveTheme,
	ValidationErrorClass
} from '@sebastianwessel/isostate';

/**
 * Pins the documented root entrypoint export surface described in
 * `specs/03-contracts/public-api.md`, `docs/reference/public-api.md`, and
 * `docs/reference/types.md`. If a documented export is removed or renamed
 * from `packages/core/src/index.ts`, this file fails to typecheck and
 * `bun run typecheck` catches the drift.
 */
describe('root entrypoint export surface', () => {
	test('documented runtime values are exported from @sebastianwessel/isostate', () => {
		expect(typeof mountScene).toBe('function');
		expect(typeof buildSceneDOM).toBe('function');
		expect(typeof applyThemeToElement).toBe('function');
		expect(typeof AnimationEngine).toBe('function');
		expect(typeof AnimationController).toBe('function');
		expect(typeof AssetRegistryImpl).toBe('function');
		expect(typeof createAssetRegistry).toBe('function');
		expect(typeof createDefaultRegistry).toBe('function');
		expect(typeof resolveTheme).toBe('function');
		expect(typeof composeTheme).toBe('function');
		expect(typeof AnimationError).toBe('function');
		expect(typeof ControllerError).toBe('function');
		expect(typeof ParseError).toBe('function');
		expect(typeof RenderError).toBe('function');
		expect(typeof ValidationErrorClass).toBe('function');
		expect(typeof guardEntryAnimation).toBe('function');
		expect(typeof guardExitAnimation).toBe('function');
		expect(typeof guardLifecycleStatus).toBe('function');
		expect(typeof calculateTransform).toBe('function');
		expect(typeof calculateVisualSize).toBe('function');
		expect(typeof projectToScreen).toBe('function');
		expect(typeof resolveEasing).toBe('function');
		expect(typeof linear).toBe('function');
		expect(typeof easeInCubic).toBe('function');
		expect(typeof easeInOutCubic).toBe('function');
		expect(typeof easeOutCubic).toBe('function');
		expect(DEFAULT_CELL_SIZE).toBeGreaterThan(0);
	});

	test('documented public types import cleanly from @sebastianwessel/isostate', () => {
		// Type-only compile-time assertions; presence of this block passing
		// typecheck is the actual contract being pinned.
		const typeGuard = <T>(_value: T): void => undefined;
		typeGuard<MountSceneOptions>({} as MountSceneOptions);
		typeGuard<MountedScene>({} as MountedScene);
		typeGuard<ResolvedRuntimeConfig>({} as ResolvedRuntimeConfig);
		typeGuard<RuntimeBundle>({} as RuntimeBundle);
		typeGuard<RenderConfig>({} as RenderConfig);
		typeGuard<ControllerConfig>({} as ControllerConfig);
		typeGuard<ControllerEvents>({} as ControllerEvents);
		typeGuard<FrameUpdate>({} as FrameUpdate);
		typeGuard<LifecycleKey>({} as LifecycleKey);
		typeGuard<CameraEasing>({} as CameraEasing);
		typeGuard<CameraFocus>({} as CameraFocus);
		typeGuard<CameraGridArea>({} as CameraGridArea);
		typeGuard<CameraState>({} as CameraState);
		typeGuard<CameraTarget>({} as CameraTarget);
		typeGuard<CameraZoomOptions>({} as CameraZoomOptions);
		typeGuard<AmbientAnimation>({} as AmbientAnimation);
		typeGuard<AssetCatalogEntry>({} as AssetCatalogEntry);
		typeGuard<AssetCategory>({} as AssetCategory);
		typeGuard<AssetDefinition>({} as AssetDefinition);
		typeGuard<AssetRegistry>({} as AssetRegistry);
		typeGuard<CompiledAsset>({} as CompiledAsset);
		typeGuard<CompiledFloor>({} as CompiledFloor);
		typeGuard<CompiledLayer>({} as CompiledLayer);
		typeGuard<CompiledLayout>({} as CompiledLayout);
		typeGuard<ConnectionPatch>({} as ConnectionPatch);
		typeGuard<ConnectionPlacement>({} as ConnectionPlacement);
		typeGuard<ConnectionRemoval>({} as ConnectionRemoval);
		typeGuard<ElementPatch>({} as ElementPatch);
		typeGuard<ElementPlacement>({} as ElementPlacement);
		typeGuard<ElementRemoval>({} as ElementRemoval);
		typeGuard<EntryAnimation>({} as EntryAnimation);
		typeGuard<ExitAnimation>({} as ExitAnimation);
		typeGuard<EasingFn>({} as EasingFn);
		typeGuard<EasingType>({} as EasingType);
		typeGuard<FloorConfig>({} as FloorConfig);
		typeGuard<GridConfig>({} as GridConfig);
		typeGuard<LayerDefinition>({} as LayerDefinition);
		typeGuard<LayoutBounds>({} as LayoutBounds);
		typeGuard<LayoutFit>({} as LayoutFit);
		typeGuard<LifecycleStatus>({} as LifecycleStatus);
		typeGuard<PrimitiveContent>({} as PrimitiveContent);
		typeGuard<ResolvedLayoutConfig>({} as ResolvedLayoutConfig);
		typeGuard<RuntimeElementState>({} as RuntimeElementState);
		typeGuard<RuntimeSceneStop>({} as RuntimeSceneStop);
		typeGuard<SceneDocument>({} as SceneDocument);
		typeGuard<SceneHeader>({} as SceneHeader);
		typeGuard<SceneStep>({} as SceneStep);
		typeGuard<TextContent>({} as TextContent);
		typeGuard<Theme>({} as Theme);
		typeGuard<ValidationError>({} as ValidationError);
		typeGuard<ValidationReport>({} as ValidationReport);
		typeGuard<ValidationWarning>({} as ValidationWarning);

		expect(true).toBe(true);
	});
});
