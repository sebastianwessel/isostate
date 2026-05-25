import type {
	AmbientAnimation,
	AssetCatalogEntry,
	CameraFocus,
	ConnectionPatch,
	ConnectionPlacement,
	ConnectionRemoval,
	ConnectorEndpointRef,
	ConnectorRouting,
	ConnectorStyle,
	ElementPatch,
	ElementPlacement,
	ElementRemoval,
	LayerDefinition,
	PrimitiveContent,
	PrimitiveContentPatch,
	SceneAddDelta,
	SceneDocument,
	SceneHeader,
	SceneRemoveDelta,
	SceneStep,
	SceneUpdateDelta,
	TextContent
} from '@sebastianwessel/isostate/types';
import type { EditorWorkspace } from './types.ts';

const INDENT = '  ';

function repeatIndent(level: number): string {
	return INDENT.repeat(level);
}

function needsQuotes(str: string): boolean {
	if (str.length === 0) return true;
	if (/^(true|false|null|undefined|yes|no|on|off|~)$/i.test(str)) return true;
	if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(str)) return true;
	if (/^[+-]?(?:0x[0-9a-fA-F]+|0o[0-7]+|0b[01]+)$/.test(str)) return true;
	if (/^[+-]?\.(?:inf|Inf|INF|nan|NaN|NAN)$/.test(str)) return true;
	if (/^\s|\s$/.test(str)) return true;
	if (/[:\s#,[\]{}&*!|>'"%@`]/.test(str)) return true;
	return false;
}

function serializeScalarString(str: string): string {
	if (needsQuotes(str)) {
		return JSON.stringify(str);
	}
	return str;
}

function serializeTuple(t: [number, number]): string {
	return `[${t[0]}, ${t[1]}]`;
}

function serializeNumberTuple(t: number[]): string {
	return `[${t.join(', ')}]`;
}

function serializeTupleArray(arr: [number, number][]): string {
	if (arr.length === 0) return '[]';
	return `[${arr.map((t) => `[${t[0]}, ${t[1]}]`).join(', ')}]`;
}

function emitNestedObjectArrayToBuf<T>(
	buf: string[],
	key: string,
	items: T[],
	emitItem: (itemBuf: string[], item: T) => void,
	indent = 0
): void {
	buf.push(`${repeatIndent(indent)}${key}:`);
	for (const item of items) {
		const itemBuf: string[] = [];
		emitItem(itemBuf, item);
		if (itemBuf.length === 0) {
			buf.push(`${repeatIndent(indent + 1)}-`);
		} else {
			buf.push(`${repeatIndent(indent + 1)}- ${itemBuf[0]}`);
			for (let i = 1; i < itemBuf.length; i++) {
				buf.push(`${repeatIndent(indent + 2)}${itemBuf[i]}`);
			}
		}
	}
}

function serializeAmbientItem(buf: string[], anim: AmbientAnimation): void {
	buf.push(`name: ${serializeScalarString(anim.name)}`);
	if (anim.infinite !== undefined) buf.push(`infinite: ${anim.infinite}`);
	if (anim.iterations !== undefined) buf.push(`iterations: ${anim.iterations}`);
}

function serializeTextToBuf(
	buf: string[],
	text: TextContent | Partial<TextContent>
): void {
	buf.push('text:');
	const value = text.value;
	if (value !== undefined) {
		if (value.includes('\n')) {
			buf.push('  value: |');
			for (const line of value.split('\n')) {
				buf.push(`    ${line}`);
			}
		} else {
			buf.push(`  value: ${serializeScalarString(value)}`);
		}
	}
	if (text.align !== undefined)
		buf.push(`  align: ${serializeScalarString(text.align)}`);
	if (text.placement !== undefined)
		buf.push(`  placement: ${serializeScalarString(text.placement)}`);
	if (text.fontSize !== undefined) buf.push(`  fontSize: ${text.fontSize}`);
	if (text.fontWeight !== undefined) {
		buf.push(
			`  fontWeight: ${typeof text.fontWeight === 'string' ? serializeScalarString(text.fontWeight) : text.fontWeight}`
		);
	}
	if (text.lineHeight !== undefined)
		buf.push(`  lineHeight: ${text.lineHeight}`);
	if (text.fill !== undefined)
		buf.push(`  fill: ${serializeScalarString(text.fill)}`);
}

function serializePrimitiveToBuf(
	buf: string[],
	primitive: PrimitiveContent | PrimitiveContentPatch,
	_isPatch: boolean
): void {
	buf.push('primitive:');
	if (primitive.rectangle !== undefined) {
		buf.push('  rectangle:');
		const style = primitive.rectangle;
		if (style.fill !== undefined)
			buf.push(`    fill: ${serializeScalarString(style.fill)}`);
		if (style.stroke !== undefined)
			buf.push(`    stroke: ${serializeScalarString(style.stroke)}`);
		if (style.strokeWidth !== undefined)
			buf.push(`    strokeWidth: ${style.strokeWidth}`);
		if (style.opacity !== undefined) buf.push(`    opacity: ${style.opacity}`);
		if (style.dash !== undefined)
			buf.push(`    dash: ${serializeTuple(style.dash)}`);
		if ('rx' in style && style.rx !== undefined)
			buf.push(`    rx: ${style.rx}`);
	} else if (primitive.circle !== undefined) {
		buf.push('  circle:');
		const style = primitive.circle;
		if (style.fill !== undefined)
			buf.push(`    fill: ${serializeScalarString(style.fill)}`);
		if (style.stroke !== undefined)
			buf.push(`    stroke: ${serializeScalarString(style.stroke)}`);
		if (style.strokeWidth !== undefined)
			buf.push(`    strokeWidth: ${style.strokeWidth}`);
		if (style.opacity !== undefined) buf.push(`    opacity: ${style.opacity}`);
		if (style.dash !== undefined)
			buf.push(`    dash: ${serializeTuple(style.dash)}`);
	} else if (primitive.polygon !== undefined) {
		buf.push('  polygon:');
		const style = primitive.polygon;
		if (style.fill !== undefined)
			buf.push(`    fill: ${serializeScalarString(style.fill)}`);
		if (style.stroke !== undefined)
			buf.push(`    stroke: ${serializeScalarString(style.stroke)}`);
		if (style.strokeWidth !== undefined)
			buf.push(`    strokeWidth: ${style.strokeWidth}`);
		if (style.opacity !== undefined) buf.push(`    opacity: ${style.opacity}`);
		if (style.dash !== undefined)
			buf.push(`    dash: ${serializeTuple(style.dash)}`);
		if (style.points !== undefined)
			buf.push(`    points: ${serializeTupleArray(style.points)}`);
	} else if (primitive.line !== undefined) {
		buf.push('  line:');
		const style = primitive.line;
		if (style.stroke !== undefined)
			buf.push(`    stroke: ${serializeScalarString(style.stroke)}`);
		if (style.strokeWidth !== undefined)
			buf.push(`    strokeWidth: ${style.strokeWidth}`);
		if (style.opacity !== undefined) buf.push(`    opacity: ${style.opacity}`);
		if (style.dash !== undefined)
			buf.push(`    dash: ${serializeTuple(style.dash)}`);
		if (style.points !== undefined)
			buf.push(`    points: ${serializeTupleArray(style.points)}`);
		if (style.lineCap !== undefined)
			buf.push(`    lineCap: ${serializeScalarString(style.lineCap)}`);
		if (style.lineJoin !== undefined)
			buf.push(`    lineJoin: ${serializeScalarString(style.lineJoin)}`);
	}
}

function serializeElementItem(
	buf: string[],
	element: ElementPlacement | ElementPatch,
	isPatch: boolean
): void {
	buf.push(`id: ${serializeScalarString(element.id)}`);
	if ('asset' in element && element.asset !== undefined) {
		buf.push(`asset: ${serializeScalarString(element.asset)}`);
	}
	if (element.at !== undefined) buf.push(`at: ${serializeTuple(element.at)}`);
	if (element.size !== undefined) buf.push(`size: ${element.size}`);
	if (element.layer !== undefined)
		buf.push(`layer: ${serializeScalarString(element.layer)}`);
	if (element.enter !== undefined)
		buf.push(`enter: ${serializeScalarString(element.enter)}`);
	if (element.exit !== undefined)
		buf.push(`exit: ${serializeScalarString(element.exit)}`);
	if (element.ambient !== undefined && element.ambient.length > 0) {
		emitNestedObjectArrayToBuf(
			buf,
			'ambient',
			element.ambient,
			serializeAmbientItem
		);
	}
	if (element.text !== undefined) {
		serializeTextToBuf(buf, element.text);
	}
	if (element.primitive !== undefined) {
		serializePrimitiveToBuf(buf, element.primitive, isPatch);
	}
}

function serializeElementRemovalItem(
	buf: string[],
	removal: ElementRemoval
): void {
	buf.push(`id: ${serializeScalarString(removal.id)}`);
	if (removal.exit !== undefined)
		buf.push(`exit: ${serializeScalarString(removal.exit)}`);
}

function serializeEndpointRefToBuf(
	buf: string[],
	key: string,
	ref: ConnectorEndpointRef
): void {
	buf.push(`${key}:`);
	if (ref.element !== undefined)
		buf.push(`  element: ${serializeScalarString(ref.element)}`);
	if (ref.at !== undefined) buf.push(`  at: ${serializeTuple(ref.at)}`);
	if (ref.side !== undefined)
		buf.push(`  side: ${serializeScalarString(ref.side)}`);
	if (ref.offset !== undefined) buf.push(`  offset: ${ref.offset}`);
}

function serializeRoutingToBuf(buf: string[], routing: ConnectorRouting): void {
	buf.push('routing:');
	if (routing.mode !== undefined)
		buf.push(`  mode: ${serializeScalarString(routing.mode)}`);
	if (routing.avoid !== undefined) {
		if (Array.isArray(routing.avoid)) {
			buf.push(
				`  avoid: [${(routing.avoid as string[]).map((v) => serializeScalarString(v)).join(', ')}]`
			);
		} else {
			buf.push(`  avoid: ${serializeScalarString(routing.avoid)}`);
		}
	}
	if (routing.clearance !== undefined)
		buf.push(`  clearance: ${routing.clearance}`);
	if (routing.gridStep !== undefined)
		buf.push(`  gridStep: ${routing.gridStep}`);
	if (routing.maxBends !== undefined)
		buf.push(`  maxBends: ${routing.maxBends}`);
	if (routing.prefer !== undefined)
		buf.push(`  prefer: ${serializeScalarString(routing.prefer)}`);
}

function serializeStyleToBuf(buf: string[], style: ConnectorStyle): void {
	buf.push('style:');
	if (style.variant !== undefined)
		buf.push(`  variant: ${serializeScalarString(style.variant)}`);
	if (style.pattern !== undefined)
		buf.push(`  pattern: ${serializeScalarString(style.pattern)}`);
	if (style.stroke !== undefined)
		buf.push(`  stroke: ${serializeScalarString(style.stroke)}`);
	if (style.strokeWidth !== undefined)
		buf.push(`  strokeWidth: ${style.strokeWidth}`);
	if (style.opacity !== undefined) buf.push(`  opacity: ${style.opacity}`);
	if (style.dash !== undefined)
		buf.push(`  dash: ${serializeTuple(style.dash)}`);
	if (style.outline !== undefined)
		buf.push(`  outline: ${serializeScalarString(style.outline)}`);
	if (style.outlineWidth !== undefined)
		buf.push(`  outlineWidth: ${style.outlineWidth}`);
	if (style.lane !== undefined)
		buf.push(`  lane: ${serializeScalarString(style.lane)}`);
}

function serializeConnectionItem(
	buf: string[],
	conn: ConnectionPlacement | ConnectionPatch
): void {
	buf.push(`id: ${serializeScalarString(conn.id)}`);
	if (conn.route !== undefined) {
		buf.push(`route: ${serializeTupleArray(conn.route)}`);
	}
	if (conn.from !== undefined) {
		serializeEndpointRefToBuf(buf, 'from', conn.from);
	}
	if (conn.to !== undefined) {
		serializeEndpointRefToBuf(buf, 'to', conn.to);
	}
	if (conn.routing !== undefined) {
		serializeRoutingToBuf(buf, conn.routing);
	}
	if (conn.layer !== undefined) {
		buf.push(`layer: ${serializeScalarString(conn.layer)}`);
	}
	if (conn.style !== undefined) {
		serializeStyleToBuf(buf, conn.style);
	}
	if (conn.start !== undefined) {
		buf.push(`start: ${serializeScalarString(conn.start)}`);
	}
	if (conn.end !== undefined) {
		buf.push(`end: ${serializeScalarString(conn.end)}`);
	}
	if (conn.direction !== undefined) {
		buf.push(`direction: ${serializeScalarString(conn.direction)}`);
	}
	if (conn.enter !== undefined) {
		buf.push(`enter: ${serializeScalarString(conn.enter)}`);
	}
	if (conn.exit !== undefined) {
		buf.push(`exit: ${serializeScalarString(conn.exit)}`);
	}
	if (conn.ambient !== undefined && conn.ambient.length > 0) {
		emitNestedObjectArrayToBuf(
			buf,
			'ambient',
			conn.ambient,
			serializeAmbientItem
		);
	}
}

function serializeConnectionRemovalItem(
	buf: string[],
	removal: ConnectionRemoval
): void {
	buf.push(`id: ${serializeScalarString(removal.id)}`);
	if (removal.exit !== undefined)
		buf.push(`exit: ${serializeScalarString(removal.exit)}`);
}

function serializeCameraToBuf(buf: string[], camera: CameraFocus): void {
	buf.push('camera:');
	buf.push('  target:');
	if ('element' in camera.target && camera.target.element !== undefined) {
		buf.push(`    element: ${serializeScalarString(camera.target.element)}`);
	} else if ('area' in camera.target && camera.target.area !== undefined) {
		buf.push('    area:');
		buf.push(`      at: ${serializeTuple(camera.target.area.at)}`);
		buf.push(`      size: ${serializeTuple(camera.target.area.size)}`);
	} else if ('reset' in camera.target && camera.target.reset !== undefined) {
		buf.push(`    reset: ${camera.target.reset}`);
	}
	if (camera.padding !== undefined) buf.push(`  padding: ${camera.padding}`);
	if (camera.duration !== undefined) buf.push(`  duration: ${camera.duration}`);
	if (camera.easing !== undefined)
		buf.push(`  easing: ${serializeScalarString(camera.easing)}`);
}

function isEmptyDelta(
	delta: SceneAddDelta | SceneUpdateDelta | SceneRemoveDelta
): boolean {
	const hasElements = delta.elements !== undefined && delta.elements.length > 0;
	const hasConnections =
		delta.connections !== undefined && delta.connections.length > 0;
	return !hasElements && !hasConnections;
}

function serializeDeltaToBuf(
	buf: string[],
	key: string,
	delta: SceneAddDelta | SceneUpdateDelta | SceneRemoveDelta
): void {
	buf.push(`${key}:`);
	if (delta.elements !== undefined && delta.elements.length > 0) {
		if (key === 'remove') {
			emitNestedObjectArrayToBuf(
				buf,
				'elements',
				delta.elements as ElementRemoval[],
				serializeElementRemovalItem,
				1
			);
		} else if (key === 'update') {
			emitNestedObjectArrayToBuf(
				buf,
				'elements',
				delta.elements as ElementPatch[],
				(eBuf, e) => serializeElementItem(eBuf, e, true),
				1
			);
		} else {
			emitNestedObjectArrayToBuf(
				buf,
				'elements',
				delta.elements as ElementPlacement[],
				(eBuf, e) => serializeElementItem(eBuf, e, false),
				1
			);
		}
	}
	if (delta.connections !== undefined && delta.connections.length > 0) {
		if (key === 'remove') {
			emitNestedObjectArrayToBuf(
				buf,
				'connections',
				delta.connections as ConnectionRemoval[],
				serializeConnectionRemovalItem,
				1
			);
		} else if (key === 'update') {
			emitNestedObjectArrayToBuf(
				buf,
				'connections',
				delta.connections as ConnectionPatch[],
				(cBuf, c) => serializeConnectionItem(cBuf, c),
				1
			);
		} else {
			emitNestedObjectArrayToBuf(
				buf,
				'connections',
				delta.connections as ConnectionPlacement[],
				(cBuf, c) => serializeConnectionItem(cBuf, c),
				1
			);
		}
	}
}

function serializeSceneItem(buf: string[], scene: SceneStep): void {
	buf.push(`id: ${serializeScalarString(scene.id)}`);
	if (scene.elements !== undefined) {
		if (scene.elements.length === 0) {
			buf.push('elements: []');
		} else {
			emitNestedObjectArrayToBuf(buf, 'elements', scene.elements, (eBuf, e) =>
				serializeElementItem(eBuf, e, false)
			);
		}
	}
	if (scene.connections !== undefined && scene.connections.length > 0) {
		emitNestedObjectArrayToBuf(
			buf,
			'connections',
			scene.connections,
			(cBuf, c) => serializeConnectionItem(cBuf, c)
		);
	}
	if (scene.add !== undefined && !isEmptyDelta(scene.add)) {
		serializeDeltaToBuf(buf, 'add', scene.add);
	}
	if (scene.update !== undefined && !isEmptyDelta(scene.update)) {
		serializeDeltaToBuf(buf, 'update', scene.update);
	}
	if (scene.remove !== undefined && !isEmptyDelta(scene.remove)) {
		serializeDeltaToBuf(buf, 'remove', scene.remove);
	}
	if (scene.camera !== undefined) {
		serializeCameraToBuf(buf, scene.camera);
	}
}

function serializeAssetItem(buf: string[], asset: AssetCatalogEntry): void {
	buf.push(`id: ${serializeScalarString(asset.id)}`);
	if ('type' in asset && asset.type !== undefined) {
		buf.push(`type: ${serializeScalarString(asset.type)}`);
	}
	if (asset.path !== undefined)
		buf.push(`path: ${serializeScalarString(asset.path)}`);
	if ('sheetSize' in asset && asset.sheetSize !== undefined)
		buf.push(`sheetSize: ${serializeTuple(asset.sheetSize)}`);
	if ('tileSize' in asset && asset.tileSize !== undefined)
		buf.push(`tileSize: ${serializeTuple(asset.tileSize)}`);
	if (asset.anchor !== undefined)
		buf.push(`anchor: ${serializeTuple(asset.anchor)}`);
	if ('sprites' in asset && asset.sprites !== undefined) {
		buf.push('sprites:');
		for (const [id, sprite] of Object.entries(asset.sprites)) {
			if (Array.isArray(sprite)) {
				buf.push(`  ${serializeScalarString(id)}: ${serializeTuple(sprite)}`);
			} else {
				buf.push(`  ${serializeScalarString(id)}:`);
				if (sprite.at !== undefined)
					buf.push(`    at: ${serializeTuple(sprite.at)}`);
				if (sprite.rect !== undefined)
					buf.push(`    rect: ${serializeNumberTuple(sprite.rect)}`);
				if (sprite.anchor !== undefined)
					buf.push(`    anchor: ${serializeTuple(sprite.anchor)}`);
			}
		}
	}
}

function serializeLayerItem(buf: string[], layer: LayerDefinition): void {
	buf.push(`name: ${serializeScalarString(layer.name)}`);
	if (layer.order !== undefined) buf.push(`order: ${layer.order}`);
}

function serializeHeader(
	lines: string[],
	header: SceneHeader,
	level: number
): void {
	const indent = repeatIndent(level);
	if (header.version !== undefined)
		lines.push(`${indent}version: ${serializeScalarString(header.version)}`);
	if (header.name !== undefined)
		lines.push(`${indent}name: ${serializeScalarString(header.name)}`);
	if (header.className !== undefined)
		lines.push(
			`${indent}className: ${serializeScalarString(header.className)}`
		);
	if (header.assetBaseUrl !== undefined)
		lines.push(
			`${indent}assetBaseUrl: ${serializeScalarString(header.assetBaseUrl)}`
		);
	if (header.assets.length === 0) {
		lines.push(`${indent}assets: []`);
	} else {
		emitNestedObjectArrayToBuf(
			lines,
			'assets',
			header.assets,
			serializeAssetItem,
			level
		);
	}
	if (header.grid !== undefined) {
		lines.push(`${indent}grid:`);
		if (header.grid.cellSize !== undefined)
			lines.push(`${indent}  cellSize: ${header.grid.cellSize}`);
	}
	if (header.floor !== undefined) {
		lines.push(`${indent}floor:`);
		if (header.floor.size !== undefined)
			lines.push(`${indent}  size: ${serializeTuple(header.floor.size)}`);
		if (header.floor.origin !== undefined)
			lines.push(`${indent}  origin: ${serializeTuple(header.floor.origin)}`);
		if (header.floor.layer !== undefined)
			lines.push(
				`${indent}  layer: ${serializeScalarString(header.floor.layer)}`
			);
		if (header.floor.visible !== undefined)
			lines.push(`${indent}  visible: ${header.floor.visible}`);
		if (header.floor.asset !== undefined)
			lines.push(
				`${indent}  asset: ${serializeScalarString(header.floor.asset)}`
			);
	}
	if (header.theme !== undefined)
		lines.push(`${indent}theme: ${serializeScalarString(header.theme)}`);
	if (header.layers.length === 0) {
		lines.push(`${indent}layers: []`);
	} else {
		emitNestedObjectArrayToBuf(
			lines,
			'layers',
			header.layers,
			serializeLayerItem,
			level
		);
	}
}

export function serializeSceneDocument(document: SceneDocument): string {
	const lines: string[] = [];
	lines.push('header:');
	serializeHeader(lines, document.header, 1);
	lines.push('scenes:');
	const scenesItemPrefix = `${repeatIndent(1)}- `;
	const scenesContentPrefix = repeatIndent(2);
	for (const scene of document.scenes) {
		const buf: string[] = [];
		serializeSceneItem(buf, scene);
		lines.push(`${scenesItemPrefix}${buf[0]}`);
		for (let i = 1; i < buf.length; i++) {
			lines.push(`${scenesContentPrefix}${buf[i]}`);
		}
	}
	return `${lines.join('\n')}\n`;
}

export function serializeEditorWorkspace(workspace: EditorWorkspace): string {
	if (!workspace.document) {
		return workspace.sourceYaml;
	}
	return serializeSceneDocument(workspace.document);
}
