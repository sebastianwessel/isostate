import { Slider as SliderPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '../lib/utils.ts';

function Slider({
	className,
	defaultValue,
	value,
	min = 0,
	max = 100,
	...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
	const _values = React.useMemo(
		() =>
			Array.isArray(value)
				? value
				: Array.isArray(defaultValue)
					? defaultValue
					: [min, max],
		[value, defaultValue, min, max]
	);

	return (
		<SliderPrimitive.Root
			data-slot="slider"
			defaultValue={defaultValue}
			value={value}
			min={min}
			max={max}
			className={cn(
				'iso:relative iso:flex iso:w-full iso:touch-none iso:items-center iso:select-none iso:data-[disabled]:opacity-50 iso:data-[orientation=vertical]:h-full iso:data-[orientation=vertical]:min-h-44 iso:data-[orientation=vertical]:w-auto iso:data-[orientation=vertical]:flex-col',
				className
			)}
			{...props}
		>
			<SliderPrimitive.Track
				data-slot="slider-track"
				className={cn(
					'iso:relative iso:grow iso:overflow-hidden iso:rounded-full iso:bg-muted iso:data-[orientation=horizontal]:h-1.5 iso:data-[orientation=horizontal]:w-full iso:data-[orientation=vertical]:h-full iso:data-[orientation=vertical]:w-1.5'
				)}
			>
				<SliderPrimitive.Range
					data-slot="slider-range"
					className={cn(
						'iso:absolute iso:bg-primary iso:data-[orientation=horizontal]:h-full iso:data-[orientation=vertical]:w-full'
					)}
				/>
			</SliderPrimitive.Track>
			{_values.map((value) => (
				<SliderPrimitive.Thumb
					data-slot="slider-thumb"
					key={`thumb-${value}`}
					className="iso:block iso:size-4 iso:shrink-0 iso:rounded-full iso:border iso:border-primary iso:bg-white iso:shadow-sm iso:ring-ring/50 iso:transition-[color,box-shadow] iso:hover:ring-4 iso:focus-visible:ring-4 iso:focus-visible:outline-hidden iso:disabled:pointer-events-none iso:disabled:opacity-50"
				/>
			))}
		</SliderPrimitive.Root>
	);
}

export { Slider };
