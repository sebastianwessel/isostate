import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui';
import type * as React from 'react';

import { cn } from '../lib/utils.ts';

function ScrollArea({
	className,
	children,
	...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
	return (
		<ScrollAreaPrimitive.Root
			data-slot="scroll-area"
			className={cn('iso:relative', className)}
			{...props}
		>
			<ScrollAreaPrimitive.Viewport
				data-slot="scroll-area-viewport"
				className="iso:size-full iso:rounded-[inherit] iso:transition-[color,box-shadow] iso:outline-none iso:focus-visible:ring-[3px] iso:focus-visible:ring-ring/50 iso:focus-visible:outline-1"
			>
				{children}
			</ScrollAreaPrimitive.Viewport>
			<ScrollBar />
			<ScrollAreaPrimitive.Corner />
		</ScrollAreaPrimitive.Root>
	);
}

function ScrollBar({
	className,
	orientation = 'vertical',
	...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
	return (
		<ScrollAreaPrimitive.ScrollAreaScrollbar
			data-slot="scroll-area-scrollbar"
			orientation={orientation}
			className={cn(
				'iso:flex iso:touch-none iso:p-px iso:transition-colors iso:select-none',
				orientation === 'vertical' &&
					'iso:h-full iso:w-2.5 iso:border-l iso:border-l-transparent',
				orientation === 'horizontal' &&
					'iso:h-2.5 iso:flex-col iso:border-t iso:border-t-transparent',
				className
			)}
			{...props}
		>
			<ScrollAreaPrimitive.ScrollAreaThumb
				data-slot="scroll-area-thumb"
				className="iso:relative iso:flex-1 iso:rounded-full iso:bg-border"
			/>
		</ScrollAreaPrimitive.ScrollAreaScrollbar>
	);
}

export { ScrollArea, ScrollBar };
