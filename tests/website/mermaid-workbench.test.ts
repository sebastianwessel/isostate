import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import {
	parseScene,
	validateScene
} from '../../packages/core/src/dsl/index.ts';
import {
	MERMAID_HANDOFF_KEY,
	readMermaidHandoff,
	saveMermaidHandoff
} from '../../website/src/lib/mermaid-handoff.ts';
import {
	initializeMermaidWorkbench,
	mermaidExamples
} from '../../website/src/lib/mermaid-workbench.ts';

let browser: Window;
beforeEach(() => {
	browser = new Window({ url: 'http://localhost/isostate/mermaid/' });
	Object.assign(globalThis, {
		window: browser,
		document: browser.document,
		navigator: browser.navigator,
		AbortController: browser.AbortController
	});
	document.body.innerHTML = `<section class="mermaid-workbench" data-editor-url="/isostate/editor/">
		<form id="mermaid-convert-form"><textarea id="mermaid-input"></textarea></form>
		<textarea id="mermaid-output"></textarea><span id="mermaid-output-state"></span>
		<input id="mermaid-file" type="file" /><select id="mermaid-example"><option value="request">Request</option><option value="cycle">Cycle</option></select>
		<button id="mermaid-copy"></button><button id="mermaid-download"></button><button id="mermaid-editor"></button>
		<div id="mermaid-diagnostics" hidden><p id="mermaid-result-status"></p><ul id="mermaid-warnings"></ul><button id="mermaid-error-line"></button></div>
	</section>`;
	input().value = mermaidExamples.request;
});
afterEach(() => {
	browser.dispatchEvent(new browser.Event('pagehide'));
	browser.happyDOM.abort();
});
function input(): HTMLTextAreaElement {
	return document.querySelector<HTMLTextAreaElement>(
		'#mermaid-input'
	) as HTMLTextAreaElement;
}
function output(): HTMLTextAreaElement {
	return document.querySelector<HTMLTextAreaElement>(
		'#mermaid-output'
	) as HTMLTextAreaElement;
}
function button(id: string): HTMLButtonElement {
	return document.querySelector<HTMLButtonElement>(
		`#mermaid-${id}`
	) as HTMLButtonElement;
}
function convert(): void {
	document
		.querySelector('#mermaid-convert-form')
		?.dispatchEvent(new browser.Event('submit', { cancelable: true }));
}

describe('Mermaid authoring workbench', () => {
	test('converts the full request example to valid YAML with branch and async labels', () => {
		initializeMermaidWorkbench();
		const scene = parseScene(output().value);
		expect(validateScene(scene).errors).toEqual([]);
		expect(output().value).toContain('value: async');
		expect(output().value).toContain('pattern: dotted');
		expect(button('editor').disabled).toBe(false);
	});
	test('editing invalidates exports so stale YAML cannot be copied or opened', () => {
		initializeMermaidWorkbench();
		input().value = 'flowchart TD\n A --> C';
		input().dispatchEvent(new browser.Event('input'));
		expect(output().value).toBe('');
		for (const action of ['copy', 'download', 'editor'])
			expect(button(action).disabled).toBe(true);
		convert();
		expect(output().value).toContain('id: c');
		expect(button('editor').disabled).toBe(false);
	});
	test('unsupported syntax clears output and selects the reported source line', () => {
		initializeMermaidWorkbench();
		input().value = 'flowchart TD\n A --> B\n subgraph test';
		convert();
		expect(output().value).toBe('');
		expect(input().getAttribute('aria-invalid')).toBe('true');
		expect(
			document.querySelector('#mermaid-result-status')?.textContent
		).toContain('(line 3)');
		button('error-line').click();
		expect(
			input().value.slice(input().selectionStart, input().selectionEnd)
		).toBe(' subgraph test');
	});
	test('example switching replaces the source and exposes cycle layout warnings', () => {
		initializeMermaidWorkbench();
		const picker = document.querySelector<HTMLSelectElement>(
			'#mermaid-example'
		) as HTMLSelectElement;
		picker.value = 'cycle';
		picker.dispatchEvent(new browser.Event('change'));
		expect(input().value).toBe(mermaidExamples.cycle);
		expect(document.querySelectorAll('#mermaid-warnings li')).toHaveLength(1);
		expect(button('editor').disabled).toBe(false);
		expect(validateScene(parseScene(output().value)).errors).toEqual([]);
	});
	test('unsupported source text appears as plain text in diagnostics', () => {
		initializeMermaidWorkbench();
		input().value = 'flowchart TD\n <img src=x onerror=alert(1)>';
		convert();
		expect(document.querySelector('#mermaid-diagnostics img')).toBeNull();
		expect(
			document.querySelector('#mermaid-result-status')?.textContent
		).toContain('<img');
	});
	test('failed file reads disable the previous result instead of exporting stale YAML', async () => {
		initializeMermaidWorkbench();
		const picker = document.querySelector<HTMLInputElement>(
			'#mermaid-file'
		) as HTMLInputElement;
		Object.defineProperty(picker, 'files', {
			value: [
				{
					size: 25,
					text: async () => {
						throw new Error('Read failed');
					}
				}
			]
		});
		picker.dispatchEvent(new browser.Event('change'));
		await Promise.resolve();
		await Promise.resolve();
		expect(output().value).toBe('');
		expect(button('download').disabled).toBe(true);
		expect(button('editor').disabled).toBe(true);
		expect(document.querySelector('#mermaid-result-status')?.textContent).toBe(
			'Read failed'
		);
	});
	test('back-forward cache pagehide keeps the conversion controls available', () => {
		initializeMermaidWorkbench();
		const hidden = new browser.Event('pagehide');
		Object.defineProperty(hidden, 'persisted', { value: true });
		browser.dispatchEvent(hidden);
		input().value = 'flowchart TD\n A --> Cached';
		convert();
		expect(output().value).toContain('id: cached');
	});
	test('page teardown removes conversion handlers', () => {
		initializeMermaidWorkbench();
		const initial = output().value;
		browser.dispatchEvent(new browser.Event('pagehide'));
		input().value = 'flowchart TD\n A --> Different';
		convert();
		expect(output().value).toBe(initial);
	});
});

describe('same-tab Mermaid editor handoff', () => {
	test('retains exact YAML in session storage', () => {
		saveMermaidHandoff(browser.sessionStorage, 'header:\n  name: sample\n');
		expect(readMermaidHandoff(browser.sessionStorage)).toBe(
			'header:\n  name: sample\n'
		);
		browser.sessionStorage.removeItem(MERMAID_HANDOFF_KEY);
		expect(readMermaidHandoff(browser.sessionStorage)).toBeNull();
	});
	test('rejects empty or oversized handoffs and safely ignores invalid stored payloads', () => {
		expect(() => saveMermaidHandoff(browser.sessionStorage, ' ')).toThrow();
		expect(() =>
			saveMermaidHandoff(browser.sessionStorage, 'x'.repeat(1_000_001))
		).toThrow();
		browser.sessionStorage.setItem(MERMAID_HANDOFF_KEY, ' ');
		expect(readMermaidHandoff(browser.sessionStorage)).toBeNull();
	});
});
