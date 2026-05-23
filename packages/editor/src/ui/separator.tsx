import { Separator as SeparatorPrimitive } from 'radix-ui';
import type * as React from 'react';

import { cn } from '../lib/utils.ts';

function Separator({
	className,
	orientation = 'horizontal',
	decorative = true,
	...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
	return (
		<SeparatorPrimitive.Root
			data-slot="separator"
			decorative={decorative}
			orientation={orientation}
			className={cn(
				'iso:shrink-0 iso:bg-border iso:data-[orientation=horizontal]:h-px iso:data-[orientation=horizontal]:w-full iso:data-[orientation=vertical]:h-full iso:data-[orientation=vertical]:w-px',
				className
			)}
			{...props}
		/>
	);
}

export { Separator };
