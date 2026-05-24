import type {
	ConnectionPlacement,
	ElementPlacement,
	SceneDocument
} from '@sebastianwessel/isostate/types';

function mergeConnection(
	existing: ConnectionPlacement,
	patch: Partial<ConnectionPlacement>
): ConnectionPlacement {
	return {
		...existing,
		...patch,
		style: patch.style ? { ...existing.style, ...patch.style } : existing.style,
		routing: patch.routing
			? { ...existing.routing, ...patch.routing }
			: existing.routing
	};
}

export function resolveSceneElements(
	document: SceneDocument,
	sceneIndex: number
): Map<string, ElementPlacement> {
	const elements = new Map<string, ElementPlacement>();
	for (let i = 0; i <= sceneIndex; i++) {
		const scene = document.scenes[i];
		if (i === 0) {
			for (const element of scene.elements ?? []) {
				elements.set(element.id, element);
			}
			continue;
		}
		for (const patch of scene.update?.elements ?? []) {
			const existing = elements.get(patch.id);
			if (existing) {
				elements.set(patch.id, { ...existing, ...patch } as ElementPlacement);
			}
		}
		for (const element of scene.add?.elements ?? []) {
			elements.set(element.id, element);
		}
		for (const removal of scene.remove?.elements ?? []) {
			elements.delete(removal.id);
		}
	}
	return elements;
}

export function resolveSceneConnections(
	document: SceneDocument,
	sceneIndex: number
): Map<string, ConnectionPlacement> {
	const connections = new Map<string, ConnectionPlacement>();
	for (let i = 0; i <= sceneIndex; i++) {
		const scene = document.scenes[i];
		if (i === 0) {
			for (const connection of scene.connections ?? []) {
				connections.set(connection.id, connection);
			}
			continue;
		}
		for (const patch of scene.update?.connections ?? []) {
			const existing = connections.get(patch.id);
			if (existing) {
				connections.set(patch.id, mergeConnection(existing, patch));
			}
		}
		for (const connection of scene.add?.connections ?? []) {
			connections.set(connection.id, connection);
		}
		for (const removal of scene.remove?.connections ?? []) {
			connections.delete(removal.id);
		}
	}
	return connections;
}
