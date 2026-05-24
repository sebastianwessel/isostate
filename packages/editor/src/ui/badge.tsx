import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '../lib/utils.ts';

const badgeVariants = cva(
	'iso:inline-flex iso:w-fit iso:shrink-0 iso:items-center iso:justify-center iso:gap-1 iso:overflow-hidden iso:rounded-full iso:border iso:border-transparent iso:px-2 iso:py-0.5 iso:text-xs iso:font-medium iso:whitespace-nowrap iso:transition-[color,box-shadow] iso:focus-visible:border-ring iso:focus-visible:ring-[3px] iso:focus-visible:ring-ring/50 iso:aria-invalid:border-destructive iso:aria-invalid:ring-destructive/20 iso:dark:aria-invalid:ring-destructive/40 iso:[&>svg]:pointer-events-none iso:[&>svg]:size-3',
	{
		variants: {
			variant: {
				default:
					'iso:bg-primary iso:text-primary-foreground iso:[a&]:hover:bg-primary/90',
				secondary:
					'iso:bg-secondary iso:text-secondary-foreground iso:[a&]:hover:bg-secondary/90',
				destructive:
					'iso:bg-destructive iso:text-white iso:focus-visible:ring-destructive/20 iso:dark:bg-destructive/60 iso:dark:focus-visible:ring-destructive/40 iso:[a&]:hover:bg-destructive/90',
				outline:
					'iso:border-border iso:text-foreground iso:[a&]:hover:bg-accent iso:[a&]:hover:text-accent-foreground',
				ghost: 'iso:[a&]:hover:bg-accent iso:[a&]:hover:text-accent-foreground',
				link: 'iso:text-primary iso:underline-offset-4 iso:[a&]:hover:underline'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	}
);

function Badge({
	className,
	variant = 'default',
	asChild = false,
	...props
}: React.ComponentProps<'span'> &
	VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot.Root : 'span';

	return (
		<Comp
			data-slot="badge"
			data-variant={variant}
			className={cn(badgeVariants({ variant }), className)}
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
