import type * as React from 'react';

import { cn } from '../lib/utils.ts';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				'iso:h-9 iso:w-full iso:min-w-0 iso:rounded-md iso:border iso:border-input iso:bg-transparent iso:px-3 iso:py-1 iso:text-base iso:shadow-xs iso:transition-[color,box-shadow] iso:outline-none iso:selection:bg-primary iso:selection:text-primary-foreground iso:file:inline-flex iso:file:h-7 iso:file:border-0 iso:file:bg-transparent iso:file:text-sm iso:file:font-medium iso:file:text-foreground iso:placeholder:text-muted-foreground iso:disabled:pointer-events-none iso:disabled:cursor-not-allowed iso:disabled:opacity-50 iso:md:text-sm iso:dark:bg-input/30',
				'iso:focus-visible:border-ring iso:focus-visible:ring-[3px] iso:focus-visible:ring-ring/50',
				'iso:aria-invalid:border-destructive iso:aria-invalid:ring-destructive/20 iso:dark:aria-invalid:ring-destructive/40',
				className
			)}
			{...props}
		/>
	);
}

export { Input };
