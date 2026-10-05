import type {
	AssetCatalogEntry,
	ElementPatch,
	ElementPlacement
} from '@sebastianwessel/isostate/types';
import { Input } from '../ui/input.tsx';
import { EffectColorInput } from './EffectInputs.tsx';
import {
	FormRow,
	InspectorSelect,
	SectionHeader,
	selectOptions
} from './fields.tsx';

const GENERATED_ASSETS = new Set([
	'text',
	'rectangle',
	'circle',
	'polygon',
	'line'
]);

/** List URL assets and logical sprite ids, excluding sprite sheet namespaces. */
export function getSwappableAssetIds(assets: AssetCatalogEntry[]): string[] {
	return assets.flatMap((asset) =>
		'sprites' in asset ? Object.keys(asset.sprites) : [asset.id]
	);
}

/** Activity metadata and registered image/sprite swaps for the selected node. */
export function ElementActivityFields({
	element,
	assets,
	onUpdate
}: {
	element: ElementPlacement;
	assets: AssetCatalogEntry[];
	onUpdate: (patch: ElementPatch) => void;
}) {
	const generated = GENERATED_ASSETS.has(element.asset);
	const activity = element.activity;
	const updateActivity = (
		patch: Partial<NonNullable<ElementPlacement['activity']>>
	) =>
		onUpdate({
			id: element.id,
			activity: { state: 'idle', ...activity, ...patch }
		});
	return (
		<>
			<FormRow label="Asset">
				{generated ? (
					<Input
						aria-label="Element asset"
						value={element.asset}
						readOnly
						className="isostate-input isostate-input--readonly"
					/>
				) : (
					<InspectorSelect
						ariaLabel="Element asset"
						value={element.asset}
						options={selectOptions(getSwappableAssetIds(assets))}
						onChange={(asset) => onUpdate({ id: element.id, asset })}
					/>
				)}
			</FormRow>
			<SectionHeader title="Node activity" />
			<FormRow label="Activity state">
				<InspectorSelect
					ariaLabel="Activity state"
					value={activity?.state ?? 'idle'}
					options={selectOptions([
						'idle',
						'processing',
						'waiting',
						'complete',
						'error'
					])}
					onChange={(state) =>
						updateActivity({
							state: state as NonNullable<ElementPlacement['activity']>['state']
						})
					}
				/>
			</FormRow>
			<EffectColorInput
				label="Activity color"
				value={activity?.color ?? ''}
				onChange={(color) => updateActivity({ color: color || undefined })}
			/>
		</>
	);
}
