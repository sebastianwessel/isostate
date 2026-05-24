import { cva, type VariantProps } from 'class-variance-authority';
import { Tabs as TabsPrimitive } from 'radix-ui';
import type * as React from 'react';

import { cn } from '../lib/utils.ts';

function Tabs({
	className,
	orientation = 'horizontal',
	...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return (
		<TabsPrimitive.Root
			data-slot="tabs"
			data-orientation={orientation}
			orientation={orientation}
			className={cn(
				'iso:group/tabs iso:flex iso:gap-2 iso:data-[orientation=horizontal]:flex-col',
				className
			)}
			{...props}
		/>
	);
}

const tabsListVariants = cva(
	'iso:group/tabs-list iso:inline-flex iso:w-fit iso:items-center iso:justify-center iso:rounded-lg iso:p-[3px] iso:text-muted-foreground iso:group-data-[orientation=horizontal]/tabs:h-9 iso:group-data-[orientation=vertical]/tabs:h-fit iso:group-data-[orientation=vertical]/tabs:flex-col iso:data-[variant=line]:rounded-none',
	{
		variants: {
			variant: {
				default: 'iso:bg-muted',
				line: 'iso:gap-1 iso:bg-transparent'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	}
);

function TabsList({
	className,
	variant = 'default',
	...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
	VariantProps<typeof tabsListVariants>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			data-variant={variant}
			className={cn(tabsListVariants({ variant }), className)}
			{...props}
		/>
	);
}

function TabsTrigger({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
	return (
		<TabsPrimitive.Trigger
			data-slot="tabs-trigger"
			className={cn(
				'iso:relative iso:inline-flex iso:h-[calc(100%-1px)] iso:flex-1 iso:items-center iso:justify-center iso:gap-1.5 iso:rounded-md iso:border iso:border-transparent iso:px-2 iso:py-1 iso:text-sm iso:font-medium iso:whitespace-nowrap iso:text-foreground/60 iso:transition-all iso:group-data-[orientation=vertical]/tabs:w-full iso:group-data-[orientation=vertical]/tabs:justify-start iso:hover:text-foreground iso:focus-visible:border-ring iso:focus-visible:ring-[3px] iso:focus-visible:ring-ring/50 iso:focus-visible:outline-1 iso:focus-visible:outline-ring iso:disabled:pointer-events-none iso:disabled:opacity-50 iso:group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm iso:group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none iso:dark:text-muted-foreground iso:dark:hover:text-foreground iso:[&_svg]:pointer-events-none iso:[&_svg]:shrink-0 iso:[&_svg:not([class*=size-])]:size-4',
				'iso:group-data-[variant=line]/tabs-list:bg-transparent iso:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent iso:dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent iso:dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent',
				'iso:data-[state=active]:bg-background iso:data-[state=active]:text-foreground iso:dark:data-[state=active]:border-input iso:dark:data-[state=active]:bg-input/30 iso:dark:data-[state=active]:text-foreground',
				'iso:after:absolute iso:after:bg-foreground iso:after:opacity-0 iso:after:transition-opacity iso:group-data-[orientation=horizontal]/tabs:after:inset-x-0 iso:group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] iso:group-data-[orientation=horizontal]/tabs:after:h-0.5 iso:group-data-[orientation=vertical]/tabs:after:inset-y-0 iso:group-data-[orientation=vertical]/tabs:after:-right-1 iso:group-data-[orientation=vertical]/tabs:after:w-0.5 iso:group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100',
				className
			)}
			{...props}
		/>
	);
}

function TabsContent({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
	return (
		<TabsPrimitive.Content
			data-slot="tabs-content"
			className={cn('iso:flex-1 iso:outline-none', className)}
			{...props}
		/>
	);
}

export { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants };
