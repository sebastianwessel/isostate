import { Tooltip as TooltipPrimitive } from 'radix-ui';
import type * as React from 'react';

import { cn } from '../lib/utils.ts';

function TooltipProvider({
	delayDuration = 0,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
	return (
		<TooltipPrimitive.Provider
			data-slot="tooltip-provider"
			delayDuration={delayDuration}
			{...props}
		/>
	);
}

function Tooltip({
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
	return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
	className,
	sideOffset = 0,
	children,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				data-slot="tooltip-content"
				sideOffset={sideOffset}
				className={cn(
					'iso:z-50 iso:w-fit iso:origin-(--radix-tooltip-content-transform-origin) iso:animate-in iso:rounded-md iso:bg-foreground iso:px-3 iso:py-1.5 iso:text-xs iso:text-balance iso:text-background iso:fade-in-0 iso:zoom-in-95 iso:data-[side=bottom]:slide-in-from-top-2 iso:data-[side=left]:slide-in-from-right-2 iso:data-[side=right]:slide-in-from-left-2 iso:data-[side=top]:slide-in-from-bottom-2 iso:data-[state=closed]:animate-out iso:data-[state=closed]:fade-out-0 iso:data-[state=closed]:zoom-out-95',
					className
				)}
				{...props}
			>
				{children}
				<TooltipPrimitive.Arrow className="iso:z-50 iso:size-2.5 iso:translate-y-[calc(-50%_-_2px)] iso:rotate-45 iso:rounded-[2px] iso:bg-foreground iso:fill-foreground" />
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	);
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
