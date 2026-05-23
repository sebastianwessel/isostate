import { describe, expect, test } from 'bun:test';
import { parseScene } from '@sebastianwessel/isostate/dsl/browser';
import {
	serializeEditorWorkspace,
	serializeSceneDocument
} from '../../packages/editor/src/serialization.ts';
import type { EditorWorkspace } from '../../packages/editor/src/types.ts';

const FULL_YAML = `header:
  version: "1"
  name: test-doc
  className: my-class
  assetBaseUrl: https://example.com/assets
  assets:
    - id: server
      path: server.svg
      anchor: [0.5, 1]
    - id: client
      path: client.svg
  grid:
    cellSize: 64
  floor:
    size: [10, 10]
    origin: [0, 0]
    layer: default
    visible: true
  theme: dark
  layers:
    - name: default
      order: 0
    - name: overlay
      order: 1
scenes:
  - id: scene-1
    elements:
      - id: e1
        asset: server
        at: [1, 2]
        size: 2
        layer: default
        enter: fade-in
        exit: fade-out
        ambient:
          - name: pulse
            infinite: false
            iterations: 3
        text:
          value: |
            Hello
            World
          align: middle
          fontSize: 14
      - id: e2
        asset: rectangle
        at: [3, 4]
        primitive:
          rectangle:
            fill: red
            stroke: blue
            strokeWidth: 2
            opacity: 0.8
            dash: [4, 2]
            rx: 0.1
    connections:
      - id: c1
        from:
          element: e1
          side: right
          offset: 0.2
        to:
          element: e2
          side: left
        routing:
          mode: orthogonal
          avoid: objects
          clearance: 0.5
          gridStep: 1
          maxBends: 3
          prefer: fewest-bends
        layer: default
        style:
          variant: line
          pattern: dashed
          stroke: "#2563eb"
          strokeWidth: 3
          opacity: 0.9
          dash: [12, 8]
          outline: "#ffffff"
          outlineWidth: 2
          lane: none
        start: none
        end: arrow
        direction: route
        enter: fade-in
        exit: fade-out
        ambient:
          - name: flow
    camera:
      target:
        area:
          at: [0, 0]
          size: [5, 5]
      padding: 32
      duration: 500
      easing: ease-in-out
  - id: scene-2
    add:
      elements:
        - id: e3
          asset: client
          at: [5, 5]
    update:
      elements:
        - id: e1
          at: [2, 3]
    remove:
      elements:
        - id: e2
          exit: fade-out-shrink
`;

describe('serializeSceneDocument', () => {
	test('round-trips through parseScene', () => {
		const doc = parseScene(FULL_YAML);
		const serialized = serializeSceneDocument(doc);
		const reparsed = parseScene(serialized);
		expect(JSON.stringify(reparsed)).toBe(JSON.stringify(doc));
	});

	test('emits header before scenes', () => {
		const doc = parseScene(FULL_YAML);
		const serialized = serializeSceneDocument(doc);
		const headerIndex = serialized.indexOf('header:');
		const scenesIndex = serialized.indexOf('scenes:');
		expect(headerIndex).toBeGreaterThanOrEqual(0);
		expect(scenesIndex).toBeGreaterThanOrEqual(0);
		expect(headerIndex).toBeLessThan(scenesIndex);
	});

	test('uses flow style for tuples', () => {
		const doc = parseScene(FULL_YAML);
		const serialized = serializeSceneDocument(doc);
		expect(serialized).toContain('at: [1, 2]');
		expect(serialized).toContain('anchor: [0.5, 1]');
		expect(serialized).toContain('size: [10, 10]');
		expect(serialized).toContain('dash: [4, 2]');
	});

	test('uses block scalar for text value with line breaks', () => {
		const doc = parseScene(FULL_YAML);
		const serialized = serializeSceneDocument(doc);
		expect(serialized).toContain('value: |');
		expect(serialized).toContain('  Hello');
		expect(serialized).toContain('  World');
	});

	test('omits empty optional arrays and objects', () => {
		const doc = parseScene(FULL_YAML);
		const serialized = serializeSceneDocument(doc);
		// scene-2 should not have connections or camera
		const scene2Match = serialized.match(
			/id: scene-2[\s\S]*?(?=\n {2}- id:|$)/
		);
		expect(scene2Match).toBeDefined();
		expect(scene2Match?.[0]).not.toContain('connections:');
		expect(scene2Match?.[0]).not.toContain('camera:');
	});

	test('header field order is deterministic', () => {
		const doc = parseScene(FULL_YAML);
		const serialized = serializeSceneDocument(doc);
		const headerBlock = serialized.match(/header:\n([\s\S]*?)\nscenes:/)?.[1];
		expect(headerBlock).toBeDefined();
		const keys = headerBlock
			?.split('\n')
			.filter((line) => /^ {2}\w+:/.test(line))
			.map((line) => line.trim().split(':')[0]);
		expect(keys).toEqual([
			'version',
			'name',
			'className',
			'assetBaseUrl',
			'assets',
			'grid',
			'floor',
			'theme',
			'layers'
		]);
	});

	test('scene field order is deterministic', () => {
		const doc = parseScene(FULL_YAML);
		const serialized = serializeSceneDocument(doc);
		const sceneBlock = serialized.match(
			/id: scene-1\n([\s\S]*?)\n {2}- id: scene-2/
		)?.[1];
		expect(sceneBlock).toBeDefined();
		const keys = sceneBlock
			?.split('\n')
			.filter((line) => /^ {4}\w+:/.test(line))
			.map((line) => line.trim().split(':')[0]);
		expect(keys).toEqual(['elements', 'connections', 'camera']);
	});

	test('deterministic output for identical documents', () => {
		const doc = parseScene(FULL_YAML);
		const a = serializeSceneDocument(doc);
		const b = serializeSceneDocument(doc);
		expect(a).toBe(b);
	});
});

describe('serializeEditorWorkspace', () => {
	test('delegates to serializeSceneDocument when document exists', () => {
		const doc = parseScene(FULL_YAML);
		const workspace = {
			sourceYaml: FULL_YAML,
			document: doc
		} as EditorWorkspace;
		const serialized = serializeEditorWorkspace(workspace);
		expect(serialized).toContain('header:');
		expect(serialized).toContain('scenes:');
	});

	test('returns sourceYaml when document is undefined', () => {
		const workspace = { sourceYaml: 'some yaml' } as EditorWorkspace;
		expect(serializeEditorWorkspace(workspace)).toBe('some yaml');
	});
});
