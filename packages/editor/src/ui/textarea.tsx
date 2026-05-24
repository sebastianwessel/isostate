import type * as React from 'react';

import { cn } from '../lib/utils.ts';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				'iso:flex iso:field-sizing-content iso:min-h-16 iso:w-full iso:rounded-md iso:border iso:border-input iso:bg-transparent iso:px-3 iso:py-2 iso:text-base iso:shadow-xs iso:transition-[color,box-shadow] iso:outline-none iso:placeholder:text-muted-foreground iso:focus-visible:border-ring iso:focus-visible:ring-[3px] iso:focus-visible:ring-ring/50 iso:disabled:cursor-not-allowed iso:disabled:opacity-50 iso:aria-invalid:border-destructive iso:aria-invalid:ring-destructive/20 iso:md:text-sm iso:dark:bg-input/30 iso:dark:aria-invalid:ring-destructive/40',
				className
			)}
			{...props}
		/>
	);
}

export { Textarea };
