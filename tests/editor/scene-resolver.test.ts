import { describe, expect, test } from 'bun:test';
import { parseScene } from '@sebastianwessel/isostate/dsl/browser';
import {
	resolveSceneConnections,
	resolveSceneElements
} from '../../packages/editor/src/scene-resolver.ts';

describe('resolveSceneElements', () => {
	test('deep-merges a text patch, preserving unpatched sub-fields', () => {
		const yaml = `header:
  version: "1"
  assets: []
  layers:
    - name: default
scenes:
  - id: scene-1
    elements:
      - id: label-1
        asset: text
        at: [0, 0]
        text:
          value: Hello
          fontSize: 24
          fill: "#ff0000"
  - id: scene-2
    update:
      elements:
        - id: label-1
          text:
            align: middle
`;
		const doc = parseScene(yaml);
		const resolved = resolveSceneElements(doc, 1);
		const label = resolved.get('label-1');
		expect(label?.text).toEqual({
			value: 'Hello',
			fontSize: 24,
			fill: '#ff0000',
			align: 'middle'
		});
	});

	test('deep-merges a primitive patch, preserving unpatched style fields', () => {
		const yaml = `header:
  version: "1"
  assets: []
  layers:
    - name: default
scenes:
  - id: scene-1
    elements:
      - id: rect-1
        asset: rectangle
        at: [0, 0]
        primitive:
          rectangle:
            fill: red
            stroke: blue
            strokeWidth: 2
  - id: scene-2
    update:
      elements:
        - id: rect-1
          primitive:
            rectangle:
              fill: green
`;
		const doc = parseScene(yaml);
		const resolved = resolveSceneElements(doc, 1);
		const rect = resolved.get('rect-1');
		expect(rect?.primitive?.rectangle).toEqual({
			fill: 'green',
			stroke: 'blue',
			strokeWidth: 2
		});
	});

	test('still applies non-nested field patches (e.g. at) alongside preserved text', () => {
		const yaml = `header:
  version: "1"
  assets: []
  layers:
    - name: default
scenes:
  - id: scene-1
    elements:
      - id: label-1
        asset: text
        at: [0, 0]
        text:
          value: Hello
          fontSize: 24
  - id: scene-2
    update:
      elements:
        - id: label-1
          at: [2, 3]
`;
		const doc = parseScene(yaml);
		const resolved = resolveSceneElements(doc, 1);
		const label = resolved.get('label-1');
		expect(label?.at).toEqual([2, 3]);
		expect(label?.text).toEqual({ value: 'Hello', fontSize: 24 });
	});
});

describe('resolveSceneConnections', () => {
	test('deep-merges style and routing patches', () => {
		const yaml = `header:
  version: "1"
  assets: []
  layers:
    - name: default
scenes:
  - id: scene-1
    elements:
      - id: a
        asset: rectangle
        at: [0, 0]
      - id: b
        asset: rectangle
        at: [2, 2]
    connections:
      - id: c1
        from:
          element: a
        to:
          element: b
        style:
          stroke: "#000000"
          strokeWidth: 2
        routing:
          mode: orthogonal
          clearance: 0.5
  - id: scene-2
    update:
      connections:
        - id: c1
          style:
            stroke: "#ff0000"
          routing:
            clearance: 1
`;
		const doc = parseScene(yaml);
		const resolved = resolveSceneConnections(doc, 1);
		const conn = resolved.get('c1');
		expect(conn?.style).toEqual({ stroke: '#ff0000', strokeWidth: 2 });
		expect(conn?.routing).toEqual({ mode: 'orthogonal', clearance: 1 });
	});
});
