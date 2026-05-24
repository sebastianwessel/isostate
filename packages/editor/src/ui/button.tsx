import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '../lib/utils.ts';

const buttonVariants = cva(
	'iso:inline-flex iso:shrink-0 iso:items-center iso:justify-center iso:gap-2 iso:rounded-md iso:text-sm iso:font-medium iso:whitespace-nowrap iso:transition-all iso:outline-none iso:focus-visible:border-ring iso:focus-visible:ring-[3px] iso:focus-visible:ring-ring/50 iso:disabled:pointer-events-none iso:disabled:opacity-50 iso:aria-invalid:border-destructive iso:aria-invalid:ring-destructive/20 iso:dark:aria-invalid:ring-destructive/40 iso:[&_svg]:pointer-events-none iso:[&_svg]:shrink-0 iso:[&_svg:not([class*=size-])]:size-4',
	{
		variants: {
			variant: {
				default:
					'iso:bg-primary iso:text-primary-foreground iso:hover:bg-primary/90',
				destructive:
					'iso:bg-destructive iso:text-white iso:hover:bg-destructive/90 iso:focus-visible:ring-destructive/20 iso:dark:bg-destructive/60 iso:dark:focus-visible:ring-destructive/40',
				outline:
					'iso:border iso:bg-background iso:shadow-xs iso:hover:bg-accent iso:hover:text-accent-foreground iso:dark:border-input iso:dark:bg-input/30 iso:dark:hover:bg-input/50',
				secondary:
					'iso:bg-secondary iso:text-secondary-foreground iso:hover:bg-secondary/80',
				ghost:
					'iso:hover:bg-accent iso:hover:text-accent-foreground iso:dark:hover:bg-accent/50',
				link: 'iso:text-primary iso:underline-offset-4 iso:hover:underline'
			},
			size: {
				default: 'iso:h-9 iso:px-4 iso:py-2 iso:has-[>svg]:px-3',
				xs: 'iso:h-6 iso:gap-1 iso:rounded-md iso:px-2 iso:text-xs iso:has-[>svg]:px-1.5 iso:[&_svg:not([class*=size-])]:size-3',
				sm: 'iso:h-8 iso:gap-1.5 iso:rounded-md iso:px-3 iso:has-[>svg]:px-2.5',
				lg: 'iso:h-10 iso:rounded-md iso:px-6 iso:has-[>svg]:px-4',
				icon: 'iso:size-9',
				'icon-xs':
					'iso:size-6 iso:rounded-md iso:[&_svg:not([class*=size-])]:size-3',
				'icon-sm': 'iso:size-8',
				'icon-lg': 'iso:size-10'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	}
);

function Button({
	className,
	variant = 'default',
	size = 'default',
	asChild = false,
	...props
}: React.ComponentProps<'button'> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : 'button';

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
