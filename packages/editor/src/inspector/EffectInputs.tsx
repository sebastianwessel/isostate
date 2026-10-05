import { useEffect, useState } from 'react';
import { Input } from '../ui/input.tsx';
import { FormRow } from './fields.tsx';

/** Commit complete CSS colors on blur so intermediate typing stays editable. */
export function EffectColorInput({
	label,
	value,
	onChange
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	const [draft, setDraft] = useState(value);
	useEffect(() => setDraft(value), [value]);
	return (
		<FormRow label={label}>
			<Input
				type="text"
				aria-label={label}
				className="isostate-input"
				value={draft}
				placeholder="#38bdf8"
				onChange={(event) => setDraft(event.target.value)}
				onBlur={(event) => {
					const next = event.currentTarget.value.trim();
					if (next !== value) onChange(next);
					setDraft(value);
				}}
				onKeyDown={(event) => {
					if (event.key === 'Enter') event.currentTarget.blur();
					if (event.key === 'Escape') setDraft(value);
				}}
			/>
		</FormRow>
	);
}

/** Keep intermediate typing local and commit a valid effect number on blur. */
export function EffectNumberInput({
	label,
	value,
	min,
	max,
	step = 1,
	integer = false,
	onChange
}: {
	label: string;
	value: number;
	min: number;
	max?: number;
	step?: number;
	integer?: boolean;
	onChange: (value: number) => void;
}) {
	const [draft, setDraft] = useState(String(value));
	useEffect(() => setDraft(String(value)), [value]);
	const commit = (raw: string) => {
		const next = Number(raw);
		const valid =
			raw.trim() !== '' &&
			Number.isFinite(next) &&
			next >= min &&
			(max === undefined || next <= max) &&
			(!integer || Number.isInteger(next));
		if (valid && next !== value) onChange(next);
		setDraft(String(valid ? next : value));
	};
	return (
		<FormRow label={label}>
			<Input
				type="number"
				aria-label={label}
				className="isostate-input"
				value={draft}
				min={min}
				max={max}
				step={step}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={(event) => commit(event.currentTarget.value)}
				onKeyDown={(event) => {
					if (event.key === 'Enter') event.currentTarget.blur();
					if (event.key === 'Escape') setDraft(String(value));
				}}
			/>
		</FormRow>
	);
}
