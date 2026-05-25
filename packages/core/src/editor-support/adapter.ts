import {
	getConnectorState,
	getCurrentElementBounds,
	getElementState,
	getResolvedViewBox,
	hideElementAfterExit,
	unhideElementOnReadd,
	updateElementTransforms,
	type ViewBoxRect,
} from "../rendering/rendering-engine.ts";
import type { MountedScene } from "../runtime/mount-scene.ts";
import type { RuntimeConnectorState, RuntimeElementState } from "../types/node.ts";
import type { EditorClientPoint, EditorScreenPoint } from "./geometry.ts";
import {
	clientPointToSvgPoint as geometryClientPointToSvgPoint,
	getGridCellPolygon as geometryGetGridCellPolygon,
	projectGridPoint as geometryProjectGridPoint,
	unprojectScreenPoint as geometryUnprojectScreenPoint,
} from "./geometry.ts";
import type { HitTestOptions, RuntimeObjectHit } from "./hit-test.ts";
import { getConnectionBounds, getRuntimeObjectAtPoint, getRuntimeSelectionBounds } from "./hit-test.ts";

/** Metadata for a runtime object as seen by the editor. */
export interface RuntimeObjectMetadata {
	id: string;
	kind: "element" | "connection";
	sceneId: string;
	layer: string;
	present: boolean;
	bounds: ViewBoxRect;
	grid: { kind: "element"; at: [number, number]; size: number } | { kind: "connection"; route: [number, number][] };
}

/** Adapter wrapping a mounted scene for editor introspection. */
export interface EditorRuntimeAdapter {
	mounted: MountedScene;
	setActiveScene(sceneId: string): boolean;
	setProgress(progress: number): void;
	getObjects(sceneId: string): RuntimeObjectMetadata[];
	getObject(id: string): RuntimeObjectMetadata | undefined;
	getLayerOrder(): Array<{ name: string; order: number }>;
	getResolvedViewBox(): ViewBoxRect;
	projectGridPoint(point: [number, number]): EditorScreenPoint;
	unprojectScreenPoint(point: EditorScreenPoint): [number, number];
	clientPointToSvgPoint(point: EditorClientPoint): EditorScreenPoint;
	getGridCellPolygon(cell: [number, number]): EditorScreenPoint[];
	getObjectAtPoint(point: EditorScreenPoint, options?: HitTestOptions): RuntimeObjectHit | undefined;
	getSelectionBounds(ids: string[]): ViewBoxRect | undefined;
	destroy(): void;
}

/**
 * Create an editor runtime adapter around an already mounted scene.
 * The adapter does not mutate the mounted scene or create editor UI.
 */
export function createEditorRuntimeAdapter(mounted: MountedScene): EditorRuntimeAdapter {
	const bundle = mounted.engine.bundle;
	if (!bundle) {
		throw new Error("EditorRuntimeAdapter requires an initialized mounted scene");
	}

	// Cache layer order since it is static for the bundle
	const layerOrder = bundle.layers
		.map((layer) => ({ name: layer.name, order: layer.order }))
		.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

	return {
		mounted,

		setActiveScene(sceneId: string): boolean {
			const scene = bundle.scenes.find((candidate) => candidate.id === sceneId);
			if (!scene) return false;
			this.setProgress(scene.progress);
			return true;
		},

		setProgress(progress: number): void {
			mounted.engine.setProgress(progress);
			applyEditorFrame(mounted);
		},

		getObjects(sceneId: string): RuntimeObjectMetadata[] {
			const currentState = mounted.engine.getCurrentState();
			if (!currentState || currentState.id !== sceneId) return [];

			const result: RuntimeObjectMetadata[] = [];

			// Elements from current engine frame
			for (const update of mounted.engine.getFrameUpdates()) {
				const bounds = getCurrentElementBounds(mounted.svg, update.id);
				result.push({
					id: update.id,
					kind: "element",
					sceneId: currentState.id,
					layer: update.layer,
					present: update.lifecycle !== "removed",
					bounds: bounds ?? { minX: 0, minY: 0, width: 0, height: 0 },
					grid: { kind: "element", at: update.pos, size: update.size },
				});
			}

			// Connections from current engine frame
			for (const update of mounted.engine.getConnectorFrameUpdates()) {
				const bounds = getConnectionBounds(update.route, bundle);
				result.push({
					id: update.id,
					kind: "connection",
					sceneId: currentState.id,
					layer: update.layer,
					present: update.lifecycle !== "removed",
					bounds,
					grid: { kind: "connection", route: update.route },
				});
			}

			return result;
		},

		getObject(id: string): RuntimeObjectMetadata | undefined {
			const currentState = mounted.engine.getCurrentState();
			if (!currentState) return undefined;

			const elementUpdate = mounted.engine.getElementUpdate(id);
			if (elementUpdate && elementUpdate.asset !== "") {
				const bounds = getCurrentElementBounds(mounted.svg, id);
				return {
					id: elementUpdate.id,
					kind: "element",
					sceneId: currentState.id,
					layer: elementUpdate.layer,
					present: elementUpdate.lifecycle !== "removed",
					bounds: bounds ?? { minX: 0, minY: 0, width: 0, height: 0 },
					grid: { kind: "element", at: elementUpdate.pos, size: elementUpdate.size },
				};
			}

			const connectorUpdate = mounted.engine.getConnectorUpdate(id);
			if (connectorUpdate && connectorUpdate.route.length > 0) {
				const bounds = getConnectionBounds(connectorUpdate.route, bundle);
				return {
					id: connectorUpdate.id,
					kind: "connection",
					sceneId: currentState.id,
					layer: connectorUpdate.layer,
					present: connectorUpdate.lifecycle !== "removed",
					bounds,
					grid: { kind: "connection", route: connectorUpdate.route },
				};
			}

			return undefined;
		},

		getLayerOrder() {
			return layerOrder.slice();
		},

		getResolvedViewBox() {
			return getResolvedViewBox(bundle);
		},

		projectGridPoint(point: [number, number]): EditorScreenPoint {
			return geometryProjectGridPoint(bundle, point);
		},

		unprojectScreenPoint(point: EditorScreenPoint): [number, number] {
			return geometryUnprojectScreenPoint(bundle, point);
		},

		clientPointToSvgPoint(point: EditorClientPoint): EditorScreenPoint {
			return geometryClientPointToSvgPoint(mounted.svg, point);
		},

		getGridCellPolygon(cell: [number, number]): EditorScreenPoint[] {
			return geometryGetGridCellPolygon(bundle, cell);
		},

		getObjectAtPoint(point: EditorScreenPoint, options?: HitTestOptions): RuntimeObjectHit | undefined {
			return getRuntimeObjectAtPoint(this, point, options);
		},

		getSelectionBounds(ids: string[]): ViewBoxRect | undefined {
			return getRuntimeSelectionBounds(this, ids);
		},

		destroy() {
			// Adapter owns no listeners or caches that outlive this call.
			// The editor is responsible for mounted scene cleanup.
		},
	};
}

function applyEditorFrame(mounted: MountedScene): void {
	const elements: RuntimeElementState[] = mounted.engine.getFrameUpdates().map((update) => ({
		id: update.id,
		asset: update.asset,
		pos: update.pos,
		size: update.size,
		layer: update.layer,
		presence: update.lifecycle,
		enter: update.entry as RuntimeElementState["enter"],
		exit: update.exit as RuntimeElementState["exit"],
		ambient: update.ambient,
		text: update.text,
		primitive: update.primitive,
	}));
	const connectors: RuntimeConnectorState[] = mounted.engine.getConnectorFrameUpdates().map((update) => ({
		id: update.id,
		route: update.route,
		layer: update.layer,
		presence: update.lifecycle,
		style: update.style,
		start: update.start,
		end: update.end,
		direction: update.direction,
		enter: update.entry as RuntimeConnectorState["enter"],
		exit: update.exit as RuntimeConnectorState["exit"],
		ambient: update.ambient,
	}));

	for (const element of elements) {
		const state = getElementState(mounted.svg, element.id);
		if (!state) continue;
		if (element.presence === "removed") {
			state.isHidden = true;
			hideElementAfterExit(state.node);
		} else {
			state.isHidden = false;
			unhideElementOnReadd(state.node);
		}
	}

	for (const connector of connectors) {
		const state = getConnectorState(mounted.svg, connector.id);
		if (!state) continue;
		if (connector.presence === "removed") {
			state.isHidden = true;
			hideElementAfterExit(state.node);
		} else {
			state.isHidden = false;
			unhideElementOnReadd(state.node);
		}
	}

	updateElementTransforms(mounted.svg, elements, connectors);
}
