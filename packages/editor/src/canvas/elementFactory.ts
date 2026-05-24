import type { ElementPlacement } from '@sebastianwessel/isostate/types';

export function createPlacedElement(
	assetId: string,
	at: [number, number],
	layer: string
): ElementPlacement {
	const base: ElementPlacement = {
		id: `el-${Math.random().toString(36).slice(2, 7)}`,
		asset: assetId,
		at,
		layer,
		size: 1
	};

	switch (assetId) {
		case 'text':
			return {
				...base,
				text: {
					value: 'Text',
					align: 'middle',
					fontSize: 12
				}
			};
		case 'rectangle':
			return {
				...base,
				primitive: {
					rectangle: {
						fill: 'var(--color-top)',
						stroke: 'var(--color-back)',
						strokeWidth: 1
					}
				}
			};
		case 'circle':
			return {
				...base,
				primitive: {
					circle: {
						fill: 'var(--color-top)',
						stroke: 'var(--color-back)',
						strokeWidth: 1
					}
				}
			};
		case 'polygon':
			return {
				...base,
				primitive: {
					polygon: {
						points: [
							[0.5, 0],
							[1, 0.5],
							[0.5, 1],
							[0, 0.5]
						],
						fill: 'var(--color-top)',
						stroke: 'var(--color-back)',
						strokeWidth: 1
					}
				}
			};
		case 'line':
			return {
				...base,
				primitive: {
					line: {
						points: [
							[0, 0],
							[1, 1]
						],
						stroke: 'var(--color-back)',
						strokeWidth: 1
					}
				}
			};
		default:
			return base;
	}
}
