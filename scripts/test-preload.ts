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
	g.MutationObserver = window.MutationObserver;
	g.DOMParser = window.DOMParser;
	g.XMLSerializer = window.XMLSerializer;
	g.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 16);
	g.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

installHappyDom();

afterEach(() => {
	installHappyDom();
});
