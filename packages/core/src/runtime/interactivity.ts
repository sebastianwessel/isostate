import { getElementState } from "../rendering/rendering-engine.ts";
import { RenderError } from "../types/errors.ts";

/** Payload for element pointer events. */
export interface ElementPointerEvent {
	/** Element id from the scene definition. */
	id: string;
	/** The native DOM event that triggered this notification. */
	originalEvent: Event;
}

/** Events emitted by `MountedScene.on()`. */
export interface MountedSceneEvents {
	"element-click": (event: ElementPointerEvent) => void;
	"element-enter": (event: ElementPointerEvent) => void;
	"element-leave": (event: ElementPointerEvent) => void;
}

type EventKey = keyof MountedSceneEvents;
type AnyEventListener = (event: ElementPointerEvent) => void;

const CSS_CLASS_INTERACTIVE_ROOT = "iso-interactive";
const CSS_CLASS_HOVER = "iso-hover";

/**
 * Owns delegated pointer listeners and event subscriptions for one mounted
 * scene. Created unconditionally by `mountScene()`; the three DOM listeners
 * are only attached when `interactive: true`.
 */
export class SceneInteractivity {
	private readonly svg: SVGSVGElement;
	private readonly listeners = new Map<EventKey, Set<AnyEventListener>>();
	private destroyed = false;
	private attached = false;
	private readonly onClick = (event: Event): void => this.handleClick(event);
	private readonly onPointerOver = (event: Event): void => this.handlePointerOver(event as PointerEvent);
	private readonly onPointerOut = (event: Event): void => this.handlePointerOut(event as PointerEvent);

	constructor(svg: SVGSVGElement, interactive: boolean) {
		this.svg = svg;
		if (interactive) {
			svg.classList.add(CSS_CLASS_INTERACTIVE_ROOT);
			svg.addEventListener("click", this.onClick);
			svg.addEventListener("pointerover", this.onPointerOver);
			svg.addEventListener("pointerout", this.onPointerOut);
			this.attached = true;
		}
	}

	/** Subscribe to interactivity events. Returns an unsubscribe function. */
	on<K extends EventKey>(event: K, listener: MountedSceneEvents[K]): () => void {
		if (this.destroyed) {
			throw new RenderError("MOUNT_DESTROYED", "Cannot call on() after destroy()");
		}
		const set = this.listeners.get(event) ?? new Set();
		set.add(listener as AnyEventListener);
		this.listeners.set(event, set);
		return () => {
			set.delete(listener as AnyEventListener);
		};
	}

	/** Remove the three delegated listeners and all subscriptions. Safe to call more than once. */
	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		if (this.attached) {
			this.svg.removeEventListener("click", this.onClick);
			this.svg.removeEventListener("pointerover", this.onPointerOver);
			this.svg.removeEventListener("pointerout", this.onPointerOut);
			this.attached = false;
		}
		this.listeners.clear();
	}

	private handleClick(event: Event): void {
		const id = this.resolveVisibleElementId(event.target);
		if (!id) return;
		this.emit("element-click", { id, originalEvent: event });
	}

	private handlePointerOver(event: PointerEvent): void {
		const enteredId = this.resolveVisibleElementId(event.target);
		if (!enteredId) return;
		const previousId = this.resolveVisibleElementId(event.relatedTarget);
		if (enteredId === previousId) return;
		this.toggleHoverClass(enteredId, true);
		this.emit("element-enter", { id: enteredId, originalEvent: event });
	}

	private handlePointerOut(event: PointerEvent): void {
		const leftId = this.resolveVisibleElementId(event.target);
		if (!leftId) return;
		const nextId = this.resolveVisibleElementId(event.relatedTarget);
		if (leftId === nextId) return;
		this.toggleHoverClass(leftId, false);
		this.emit("element-leave", { id: leftId, originalEvent: event });
	}

	private toggleHoverClass(id: string, hovered: boolean): void {
		const state = getElementState(this.svg, id);
		if (!state) return;
		state.node.classList.toggle(CSS_CLASS_HOVER, hovered);
	}

	/**
	 * Resolve the scene element id for a pointer event target: walk up
	 * `parentNode` from the event target until the root SVG, looking for the
	 * first ancestor `<g>` that is a member of the engine's element state map
	 * (connector groups also carry `data-id` but are never members of this
	 * map, and floor/defs/diagnostics nodes carry no `data-id` at all). An
	 * element whose current presence is `removed` never resolves.
	 */
	private resolveVisibleElementId(target: EventTarget | null): string | undefined {
		let node = target as Node | null;
		while (node && node !== this.svg) {
			const id = (node as Element).getAttribute?.("data-id");
			if (id) {
				const state = getElementState(this.svg, id);
				if (state && state.current.presence !== "removed") return id;
				return undefined;
			}
			node = node.parentNode;
		}
		return undefined;
	}

	/**
	 * Invoke every listener for `event`. Exceptions are not caught: consistent
	 * with `AnimationController`'s event system, a throwing listener is
	 * rethrown asynchronously (via `queueMicrotask`) rather than swallowed, so
	 * it surfaces as an unhandled error without breaking delivery to sibling
	 * listeners in the same `Set`.
	 */
	private emit<K extends EventKey>(event: K, payload: ElementPointerEvent): void {
		const set = this.listeners.get(event);
		if (!set) return;
		for (const listener of set) {
			try {
				listener(payload);
			} catch (error) {
				queueMicrotask(() => {
					throw error;
				});
			}
		}
	}
}
