import { Switch as SwitchPrimitive } from 'radix-ui';
import type * as React from 'react';

import { cn } from '../lib/utils.ts';

function Switch({
	className,
	size = 'default',
	...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
	size?: 'sm' | 'default';
}) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			data-size={size}
			className={cn(
				'iso:peer iso:group/switch iso:inline-flex iso:shrink-0 iso:items-center iso:rounded-full iso:border iso:border-transparent iso:shadow-xs iso:transition-all iso:outline-none iso:focus-visible:border-ring iso:focus-visible:ring-[3px] iso:focus-visible:ring-ring/50 iso:disabled:cursor-not-allowed iso:disabled:opacity-50 iso:data-[size=default]:h-[1.15rem] iso:data-[size=default]:w-8 iso:data-[size=sm]:h-3.5 iso:data-[size=sm]:w-6 iso:data-[state=checked]:bg-primary iso:data-[state=unchecked]:bg-input iso:dark:data-[state=unchecked]:bg-input/80',
				className
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className={cn(
					'iso:pointer-events-none iso:block iso:rounded-full iso:bg-background iso:ring-0 iso:transition-transform iso:group-data-[size=default]/switch:size-4 iso:group-data-[size=sm]/switch:size-3 iso:data-[state=checked]:translate-x-[calc(100%-2px)] iso:data-[state=unchecked]:translate-x-0 iso:dark:data-[state=checked]:bg-primary-foreground iso:dark:data-[state=unchecked]:bg-foreground'
				)}
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
