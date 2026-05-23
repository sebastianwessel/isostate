import { beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { mountEditor } from '../../packages/editor/src/index.ts';

beforeEach(() => {
	const w = new Window();
	const g = globalThis as unknown as Record<string, unknown>;
	g.document = w.document;
	g.window = w;
	g.HTMLElement = w.HTMLElement;
	g.Element = w.Element;
	g.Node = w.Node;
});

describe('mountEditor', () => {
	test('creates an editor in a target element and destroy leaves it empty', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);

		const editor = mountEditor(container, { initialYaml: 'header:\n  assets: []\n  layers:\n    - name: default\nscenes:\n  - id: scene-1\n' });

		await new Promise((r) => setTimeout(r, 10));

		expect(container.querySelector('.isostate-editor')).toBeTruthy();

		editor.destroy();

		expect(container.innerHTML).toBe('');

		container.remove();
	});

	test('returns a MountedEditor API shell', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);

		const editor = mountEditor(container, {
			initialYaml: 'header:\n  assets: []\n  layers:\n    - name: default\nscenes:\n  - id: scene-1\n',
			theme: 'dark',
		});

		expect(editor.element).toBe(container);
		expect(typeof editor.getWorkspace).toBe('function');
		expect(typeof editor.setYaml).toBe('function');
		expect(typeof editor.setTheme).toBe('function');
		expect(typeof editor.validate).toBe('function');
		expect(typeof editor.formatYaml).toBe('function');
		expect(typeof editor.exportYaml).toBe('function');
		expect(typeof editor.exportRuntimeBundle).toBe('function');
		expect(typeof editor.destroy).toBe('function');

		const workspace = editor.getWorkspace();
		expect(workspace.name).toBe('Untitled');
		expect(workspace.uiState.theme).toBe('dark');

		editor.destroy();
		container.remove();
	});

	test('setYaml updates value and setTheme updates theme', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);

		const editor = mountEditor(container, {
			initialYaml: 'header:\n  assets: []\n  layers:\n    - name: default\nscenes:\n  - id: scene-1\n',
		});

		editor.setYaml('header:\n  assets: []\n  layers:\n    - name: default\nscenes:\n  - id: scene-2\n');
		expect(editor.getWorkspace().sourceYaml).toContain('scene-2');

		editor.setTheme('light');
		expect(editor.getWorkspace().uiState.theme).toBe('light');

		editor.destroy();
		container.remove();
	});

	test('mounted layout orders canvas, attributes, and editor panes', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);

		const editor = mountEditor(container);

		await new Promise((r) => setTimeout(r, 10));

		const body = container.querySelector('.isostate-editor-body');
		expect(body).toBeTruthy();
		const main = body?.querySelector('.isostate-editor-main');
		expect(main).toBeTruthy();
		expect(main?.querySelector('.isostate-editor-canvas')).toBeTruthy();
		expect(main?.querySelector('.isostate-editor-sidebar')).toBeTruthy();
		expect(main?.querySelector('.isostate-editor-yaml')).toBeTruthy();
		expect(container.querySelector('[role="tablist"]')).toBeTruthy();
		expect(container.querySelector('[role="separator"]')).toBeTruthy();
		expect(container.querySelector('.isostate-attributes-panel')).toBeTruthy();

		editor.destroy();
		container.remove();
	});

	test('formatYaml updates mounted state and emits a change event', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const changes: string[] = [];

		const editor = mountEditor(container, {
			initialYaml:
				'header:\n  layers:\n    - name: default\n  assets: []\nscenes:\n  - id: scene-1\n    elements:\n      - id: title\n        asset: text\n        at: [1, 1]\n        layer: default\n        text:\n          value: Start building\n',
			onChange(event) {
				changes.push(event.operation.type);
			}
		});

		expect(editor.formatYaml()).toBe(true);
		expect(editor.getWorkspace().sourceYaml.indexOf('assets:')).toBeLessThan(
			editor.getWorkspace().sourceYaml.indexOf('layers:')
		);
		expect(changes).toEqual(['yaml.format']);

		editor.destroy();
		container.remove();
	});

	test('exportYaml and exportRuntimeBundle return artifacts and trigger onExport', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const exports: string[] = [];

		const editor = mountEditor(container, {
			initialYaml:
				'header:\n  assets: []\n  layers:\n    - name: default\nscenes:\n  - id: scene-1\n    elements:\n      - id: title\n        asset: text\n        at: [1, 1]\n        layer: default\n        text:\n          value: Start building\n',
			onExport(artifact) {
				exports.push(`${artifact.kind}:${artifact.filename}`);
			}
		});

		expect(editor.exportYaml()).toContain('scenes:');
		expect(editor.exportRuntimeBundle('js').startsWith('export default ')).toBe(
			true
		);
		expect(editor.exportRuntimeBundle('json')).toContain(
			'"_format": "isostate-runtime-bundle"'
		);
		expect(exports).toEqual([
			'yaml:scene.isostate.yaml',
			'runtime-js:scene.isostate.js',
			'runtime-json:scene.isostate.json'
		]);

		editor.destroy();
		container.remove();
	});

	test('exportRuntimeBundle rejects invalid YAML through the editor error code', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);

		const editor = mountEditor(container, {
			initialYaml: 'header:\n  assets: []\nscenes: nope\n'
		});

		expect(() => editor.exportRuntimeBundle('js')).toThrow(
			'EDITOR_INVALID_SOURCE'
		);

		editor.destroy();
		container.remove();
	});

	test('throws EDITOR_DESTROYED after destroy', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);

		const editor = mountEditor(container);
		editor.destroy();

		expect(() => editor.getWorkspace()).toThrow('EDITOR_DESTROYED');
		expect(() => editor.setYaml('')).toThrow('EDITOR_DESTROYED');
		expect(() => editor.setTheme('light')).toThrow('EDITOR_DESTROYED');
		expect(() => editor.validate()).toThrow('EDITOR_DESTROYED');
		expect(() => editor.formatYaml()).toThrow('EDITOR_DESTROYED');
		expect(() => editor.exportYaml()).toThrow('EDITOR_DESTROYED');
		expect(() => editor.exportRuntimeBundle('js')).toThrow('EDITOR_DESTROYED');

		container.remove();
	});
});
