import { afterEach } from 'bun:test';
import { Window } from 'happy-dom';

function installHappyDom() {
	const window = new Window();
	const g = globalThis as unknown as Record<string, unknown>;
	g.document = window.document;
	g.window = window;
	g.HTMLElement = window.HTMLElement;
	g.SVGElement = window.SVGElement;
	g.Element = window.Element;
	g.Node = window.Node;
	g.DocumentFragment = window.DocumentFragment;
	g.DOMRect =
		window.DOMRect ??
		class DOMRect {
			x = 0;
			y = 0;
			width = 0;
			height = 0;
			top = 0;
			right = 0;
			bottom = 0;
			left = 0;
		};
	g.MutationObserver = window.MutationObserver;
	g.DOMParser = window.DOMParser;
	g.XMLSerializer = window.XMLSerializer;
	g.getComputedStyle = window.getComputedStyle.bind(window);
	g.ResizeObserver =
		window.ResizeObserver ??
		class ResizeObserver {
			observe() {}
			unobserve() {}
			disconnect() {}
		};
	const htmlPrototype = window.HTMLElement.prototype as HTMLElement & {
		setPointerCapture?: (pointerId: number) => void;
		releasePointerCapture?: (pointerId: number) => void;
		hasPointerCapture?: (pointerId: number) => boolean;
	};
	htmlPrototype.setPointerCapture ??= () => {};
	htmlPrototype.releasePointerCapture ??= () => {};
	htmlPrototype.hasPointerCapture ??= () => false;
	g.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 16);
	g.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

installHappyDom();

afterEach(() => {
	installHappyDom();
});
