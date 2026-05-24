import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import type * as React from 'react';

import { cn } from '../lib/utils.ts';
import { Button } from './button.tsx';

function AlertDialog({
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
	return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
	return (
		<AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
	);
}

function AlertDialogPortal({
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
	return (
		<AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
	);
}

function AlertDialogOverlay({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
	return (
		<AlertDialogPrimitive.Overlay
			data-slot="alert-dialog-overlay"
			className={cn(
				'iso:fixed iso:inset-0 iso:z-50 iso:bg-black/50 iso:data-[state=closed]:animate-out iso:data-[state=closed]:fade-out-0 iso:data-[state=open]:animate-in iso:data-[state=open]:fade-in-0',
				className
			)}
			{...props}
		/>
	);
}

function AlertDialogContent({
	className,
	size = 'default',
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content> & {
	size?: 'default' | 'sm';
}) {
	return (
		<AlertDialogPortal>
			<AlertDialogOverlay />
			<AlertDialogPrimitive.Content
				data-slot="alert-dialog-content"
				data-size={size}
				className={cn(
					'iso:group/alert-dialog-content iso:fixed iso:top-[50%] iso:left-[50%] iso:z-50 iso:grid iso:w-full iso:max-w-[calc(100%-2rem)] iso:translate-x-[-50%] iso:translate-y-[-50%] iso:gap-4 iso:rounded-lg iso:border iso:bg-background iso:p-6 iso:shadow-lg iso:duration-200 iso:data-[size=sm]:max-w-xs iso:data-[state=closed]:animate-out iso:data-[state=closed]:fade-out-0 iso:data-[state=closed]:zoom-out-95 iso:data-[state=open]:animate-in iso:data-[state=open]:fade-in-0 iso:data-[state=open]:zoom-in-95 iso:data-[size=default]:sm:max-w-lg',
					className
				)}
				{...props}
			/>
		</AlertDialogPortal>
	);
}

function AlertDialogHeader({
	className,
	...props
}: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="alert-dialog-header"
			className={cn(
				'iso:grid iso:grid-rows-[auto_1fr] iso:place-items-center iso:gap-1.5 iso:text-center iso:has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] iso:has-data-[slot=alert-dialog-media]:gap-x-6 iso:sm:group-data-[size=default]/alert-dialog-content:place-items-start iso:sm:group-data-[size=default]/alert-dialog-content:text-left iso:sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]',
				className
			)}
			{...props}
		/>
	);
}

function AlertDialogFooter({
	className,
	...props
}: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="alert-dialog-footer"
			className={cn(
				'iso:flex iso:flex-col-reverse iso:gap-2 iso:group-data-[size=sm]/alert-dialog-content:grid iso:group-data-[size=sm]/alert-dialog-content:grid-cols-2 iso:sm:flex-row iso:sm:justify-end',
				className
			)}
			{...props}
		/>
	);
}

function AlertDialogTitle({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
	return (
		<AlertDialogPrimitive.Title
			data-slot="alert-dialog-title"
			className={cn(
				'iso:text-lg iso:font-semibold iso:sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2',
				className
			)}
			{...props}
		/>
	);
}

function AlertDialogDescription({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
	return (
		<AlertDialogPrimitive.Description
			data-slot="alert-dialog-description"
			className={cn('iso:text-sm iso:text-muted-foreground', className)}
			{...props}
		/>
	);
}

function AlertDialogMedia({
	className,
	...props
}: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="alert-dialog-media"
			className={cn(
				'iso:mb-2 iso:inline-flex iso:size-16 iso:items-center iso:justify-center iso:rounded-md iso:bg-muted iso:sm:group-data-[size=default]/alert-dialog-content:row-span-2 iso:*:[svg:not([class*=size-])]:size-8',
				className
			)}
			{...props}
		/>
	);
}

function AlertDialogAction({
	className,
	variant = 'default',
	size = 'default',
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> &
	Pick<React.ComponentProps<typeof Button>, 'variant' | 'size'>) {
	return (
		<Button variant={variant} size={size} asChild>
			<AlertDialogPrimitive.Action
				data-slot="alert-dialog-action"
				className={cn(className)}
				{...props}
			/>
		</Button>
	);
}

function AlertDialogCancel({
	className,
	variant = 'outline',
	size = 'default',
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel> &
	Pick<React.ComponentProps<typeof Button>, 'variant' | 'size'>) {
	return (
		<Button variant={variant} size={size} asChild>
			<AlertDialogPrimitive.Cancel
				data-slot="alert-dialog-cancel"
				className={cn(className)}
				{...props}
			/>
		</Button>
	);
}

export {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogOverlay,
	AlertDialogPortal,
	AlertDialogTitle,
	AlertDialogTrigger
};
