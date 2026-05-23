import { Label as LabelPrimitive } from 'radix-ui';
import type * as React from 'react';

import { cn } from '../lib/utils.ts';

function Label({
	className,
	...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
	return (
		<LabelPrimitive.Root
			data-slot="label"
			className={cn(
				'iso:flex iso:items-center iso:gap-2 iso:text-sm iso:leading-none iso:font-medium iso:select-none iso:group-data-[disabled=true]:pointer-events-none iso:group-data-[disabled=true]:opacity-50 iso:peer-disabled:cursor-not-allowed iso:peer-disabled:opacity-50',
				className
			)}
			{...props}
		/>
	);
}

export { Label };
