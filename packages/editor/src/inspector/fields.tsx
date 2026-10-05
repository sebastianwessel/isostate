import type { ReactNode } from 'react';
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '../ui/select.tsx';

export const SELECT_NONE_VALUE = '__none';

export function FormRow({
	label,
	children
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="isostate-inspector-row">
			<span className="isostate-inspector-label">{label}</span>
			<div className="isostate-inspector-control">{children}</div>
		</div>
	);
}

export function SectionHeader({ title }: { title: string }) {
	return <div className="isostate-inspector-section">{title}</div>;
}

export function InspectorSelect({
	value,
	options,
	placeholder,
	ariaLabel,
	onChange
}: {
	value: string | undefined;
	options: Array<{ value: string; label: string }>;
	placeholder?: string;
	ariaLabel?: string;
	onChange: (value: string) => void;
}) {
	const selectValue =
		value === undefined || value === '' ? SELECT_NONE_VALUE : value;

	return (
		<Select
			value={selectValue}
			onValueChange={(nextValue) =>
				onChange(nextValue === SELECT_NONE_VALUE ? '' : nextValue)
			}
		>
			<SelectTrigger className="isostate-select" aria-label={ariaLabel}>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent position="popper">
				<SelectGroup>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}

export function selectOptions(values: string[]) {
	return values.map((value) => ({ value, label: value }));
}
