import type {
	AssetCatalogEntry,
	SceneDocument
} from '@sebastianwessel/isostate';

/** Asset entry from an external manifest. */
export type SpriteManifestDefinition =
	| [number, number]
	| {
			at?: [number, number];
			rect?: [number, number, number, number];
			anchor?: [number, number];
			label?: string;
			tags?: string[];
	  };

export interface UrlAssetManifestEntry {
	id: string;
	type?: 'url';
	path: string;
	group: string;
	name: string;
	label?: string;
	anchor?: [number, number];
	tags?: string[];
	width?: number;
	height?: number;
	digest: string;
}

export interface SpriteSheetAssetManifestEntry
	extends Omit<UrlAssetManifestEntry, 'type'> {
	type: 'sprite-sheet';
	sheetSize: [number, number];
	tileSize?: [number, number];
	sprites: Record<string, SpriteManifestDefinition>;
}

export interface SpriteAssetManifestEntry {
	id: string;
	type: 'sprite';
	path: string;
	group: string;
	name: string;
	label?: string;
	anchor?: [number, number];
	tags?: string[];
	width?: number;
	height?: number;
	digest: string;
	sheetId: string;
	sheetSize: [number, number];
	tileSize?: [number, number];
	sheetAnchor?: [number, number];
	sprites: Record<string, SpriteManifestDefinition>;
	sprite: SpriteManifestDefinition;
}

export type AssetManifestEntry =
	| UrlAssetManifestEntry
	| SpriteSheetAssetManifestEntry;

export type PlaceableAssetManifestEntry =
	| UrlAssetManifestEntry
	| SpriteAssetManifestEntry;

/** Editor workspace state. */
export interface EditorWorkspace {
	name: string;
	sourceYaml: string;
	document?: SceneDocument;
	activeSceneId?: string;
	selection: EditorSelection;
	viewport: EditorViewport;
	editState: EditorEditState;
	uiState: EditorUiState;
	history: EditorCommandResult[];
	diagnostics: EditorDiagnostic[];
	lockedLayers?: string[];
}

/** Current selection state. */
export interface EditorSelection {
	sceneId?: string;
	objectIds: string[];
	connectionIds: string[];
	layerNames: string[];
}

/** Viewport state for canvas. */
export interface EditorViewport {
	pan: { x: number; y: number };
	zoom: number;
	showGrid: boolean;
	showFloor: boolean;
	gridOpacity: number;
}

/** Transient edit state. */
export interface EditorEditState {
	readonly: boolean;
	dragging: boolean;
	dragPayload?:
		| { kind: 'asset'; assetId: string }
		| { kind: 'move'; objectId: string };
}

/** Asset browser UI state. */
export interface EditorAssetBrowserState {
	recentAssetIds: string[];
	searchQuery: string;
	selectedGroup?: string;
	selectedTag?: string;
}

/** UI visibility and layout state. */
export interface EditorUiState {
	sidebarWidth: number;
	sidebarCollapsed: boolean;
	sidebarTab: 'assets' | 'attributes' | 'general';
	theme: 'light' | 'dark' | 'system';
	previewMode: 'edit' | 'runtime';
	assetBrowser: EditorAssetBrowserState;
	hiddenLayers?: string[];
}

/** Structured diagnostic message. */
export interface EditorDiagnostic {
	code: string;
	message: string;
	severity: 'error' | 'warning' | 'info';
	line?: number;
	column?: number;
	sceneId?: string;
	objectId?: string;
}

/** Semantic editor command. */
export interface EditorCommand {
	id: string;
	label: string;
	apply(workspace: EditorWorkspace): EditorCommandResult;
}

/** Result of applying a command. */
export interface EditorCommandResult {
	workspace: EditorWorkspace;
	inverse?: EditorCommand;
	diagnostics: EditorDiagnostic[];
	changed: boolean;
}

/** Change event emitted by the editor. */
export interface EditorChangeEvent {
	sourceYaml: string;
	document?: SceneDocument;
	diagnostics: EditorDiagnostic[];
	operation: EditorOperation;
}

/** Describes what kind of edit occurred. */
export type EditorOperation =
	| { type: 'yaml.edit' }
	| { type: 'yaml.format' }
	| {
			type: 'scene.add' | 'scene.update' | 'scene.remove' | 'scene.reorder';
			sceneId: string;
	  }
	| {
			type: 'object.add' | 'object.update' | 'object.remove' | 'object.reorder';
			sceneId: string;
			objectId: string;
	  }
	| {
			type: 'connection.add' | 'connection.update' | 'connection.remove';
			sceneId: string;
			connectionId: string;
	  }
	| {
			type: 'layer.add' | 'layer.update' | 'layer.remove' | 'layer.reorder';
			layer: string;
	  }
	| { type: 'asset.add' | 'asset.update' | 'asset.remove'; assetId: string }
	| { type: 'camera.update' | 'camera.remove'; sceneId: string };

/** Asset provider for the editor asset browser. */
export interface EditorAssetProvider {
	listAssets(): Promise<EditorAssetCatalog>;
	resolveAssetPreview(
		asset: AssetManifestEntry | AssetCatalogEntry
	): Promise<EditorAssetPreview>;
}

/** Asset catalog returned by a provider. */
export interface EditorAssetCatalog {
	assetBaseUrl: string;
	assets: AssetManifestEntry[];
}

/** Resolved asset preview info. */
export interface EditorAssetPreview {
	url: string;
	width?: number;
	height?: number;
}

/** Export artifact returned by the editor. */
export interface EditorExportArtifact {
	kind: 'yaml' | 'runtime-js' | 'runtime-json';
	filename: string;
	content: string;
	diagnostics: EditorDiagnostic[];
}

/** Input used to initialize a workspace. */
export interface EditorWorkspaceInput {
	name?: string;
	sourceYaml: string;
	activeSceneId?: string;
}

/** Options for mounting the editor. */
export interface MountEditorOptions {
	initialYaml?: string;
	initialWorkspace?: EditorWorkspaceInput;
	assetManifestUrl?: string;
	assetProvider?: EditorAssetProvider;
	theme?: 'light' | 'dark' | 'system';
	readonly?: boolean;
	onChange?: (event: EditorChangeEvent) => void;
	onValidate?: (diagnostics: EditorDiagnostic[]) => void;
	onExport?: (artifact: EditorExportArtifact) => void;
}

/** API returned after mounting an editor instance. */
export interface MountedEditor {
	element: HTMLElement;
	getWorkspace(): EditorWorkspace;
	setYaml(sourceYaml: string): void;
	setTheme(theme: 'light' | 'dark' | 'system'): void;
	validate(): EditorDiagnostic[];
	formatYaml(): boolean;
	exportYaml(): string;
	exportRuntimeBundle(format: 'js' | 'json'): string;
	destroy(): void;
}

/** React props for the IsostateEditor component. */
export interface IsostateEditorProps {
	value?: string;
	defaultValue?: string;
	assetManifestUrl?: string;
	assetProvider?: EditorAssetProvider;
	theme?: 'light' | 'dark' | 'system';
	readonly?: boolean;
	onChange?: (event: EditorChangeEvent) => void;
	onValidate?: (diagnostics: EditorDiagnostic[]) => void;
	onExport?: (artifact: EditorExportArtifact) => void;
	onWorkspaceChange?: (workspace: EditorWorkspace) => void;
}
