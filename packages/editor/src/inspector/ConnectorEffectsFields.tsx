import type {
	ConnectionPatch,
	ConnectionPlacement
} from '@sebastianwessel/isostate/types';
import { Button } from '../ui/button.tsx';
import { Switch } from '../ui/switch.tsx';
import { EffectColorInput, EffectNumberInput } from './EffectInputs.tsx';
import {
	FormRow,
	InspectorSelect,
	SectionHeader,
	selectOptions
} from './fields.tsx';

type Message = NonNullable<ConnectionPlacement['message']>;

/** Connector lighting and discrete message controls shared by all variants. */
export function ConnectorEffectsFields({
	connection,
	onUpdate
}: {
	connection: ConnectionPlacement;
	onUpdate: (patch: ConnectionPatch) => void;
}) {
	const style = connection.style;
	const updateStyle = (patch: ConnectionPatch['style']) =>
		onUpdate({
			id: connection.id,
			style: { ...style, ...patch }
		});
	const message = connection.message;
	const updateMessage = (patch: Partial<Message>) =>
		onUpdate({
			id: connection.id,
			message: { ...message, ...patch }
		});
	return (
		<>
			<SectionHeader title="Lighting & messages" />
			<FormRow label="Preset">
				<div className="isostate-toggle-row">
					<Button
						size="sm"
						variant="secondary"
						onClick={() =>
							onUpdate({
								id: connection.id,
								style: {
									...style,
									variant: 'beam',
									stroke: '#38bdf8',
									strokeWidth: 2,
									cornerRadius: 12,
									glow: '#38bdf8',
									glowWidth: 8
								},
								message: {
									kind: 'orb',
									color: '#e0f2fe',
									size: 10,
									duration: 1800,
									count: 2,
									enabled: true
								}
							})
						}
					>
						Glowing beam
					</Button>
					<Button
						size="sm"
						variant="secondary"
						onClick={() =>
							onUpdate({
								id: connection.id,
								style: {
									...style,
									variant: 'line',
									stroke: '#a78bfa',
									strokeWidth: 2,
									cornerRadius: 10,
									glow: 'transparent'
								},
								message: {
									kind: 'envelope',
									color: '#c4b5fd',
									size: 12,
									duration: 2400,
									count: 1,
									enabled: true
								}
							})
						}
					>
						Message link
					</Button>
				</div>
			</FormRow>
			<EffectNumberInput
				label="Corner radius"
				value={style?.cornerRadius ?? 0}
				min={0}
				step={0.5}
				onChange={(cornerRadius) => updateStyle({ cornerRadius })}
			/>
			<EffectColorInput
				label="Glow color"
				value={style?.glow ?? ''}
				onChange={(glow) => updateStyle({ glow: glow || 'transparent' })}
			/>
			<EffectNumberInput
				label="Glow width"
				value={style?.glowWidth ?? 8}
				min={0.1}
				step={0.1}
				onChange={(glowWidth) => updateStyle({ glowWidth })}
			/>
			<FormRow label="Messages">
				<Switch
					aria-label="Enable messages"
					checked={message !== undefined && message.enabled !== false}
					onCheckedChange={(enabled) => updateMessage({ enabled })}
				/>
			</FormRow>
			{message !== undefined && (
				<>
					<FormRow label="Message kind">
						<InspectorSelect
							ariaLabel="Message kind"
							value={message.kind ?? 'packet'}
							options={selectOptions(['packet', 'orb', 'envelope'])}
							onChange={(kind) =>
								updateMessage({ kind: kind as Message['kind'] })
							}
						/>
					</FormRow>
					<EffectColorInput
						label="Message color"
						value={message.color ?? ''}
						onChange={(color) => updateMessage({ color: color || undefined })}
					/>
					<EffectNumberInput
						label="Message size"
						value={message.size ?? 10}
						min={2}
						max={32}
						onChange={(size) => updateMessage({ size })}
					/>
					<EffectNumberInput
						label="Message duration (ms)"
						value={message.duration ?? 1800}
						min={200}
						max={30000}
						onChange={(duration) => updateMessage({ duration })}
					/>
					<EffectNumberInput
						label="Message count"
						integer
						value={message.count ?? 1}
						min={1}
						max={4}
						onChange={(count) => updateMessage({ count })}
					/>
					<p className="isostate-inspector-label">
						Messages follow the connection direction.
					</p>
				</>
			)}
		</>
	);
}
