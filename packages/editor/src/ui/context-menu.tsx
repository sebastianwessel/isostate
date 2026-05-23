import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react';
import { ContextMenu as ContextMenuPrimitive } from 'radix-ui';
import type * as React from 'react';

import { cn } from '../lib/utils.ts';

function ContextMenu({
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
	return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger({
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
	return (
		<ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
	);
}

function ContextMenuGroup({
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Group>) {
	return (
		<ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
	);
}

function ContextMenuPortal({
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Portal>) {
	return (
		<ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
	);
}

function ContextMenuSub({
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Sub>) {
	return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />;
}

function ContextMenuRadioGroup({
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioGroup>) {
	return (
		<ContextMenuPrimitive.RadioGroup
			data-slot="context-menu-radio-group"
			{...props}
		/>
	);
}

function ContextMenuSubTrigger({
	className,
	inset,
	children,
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubTrigger> & {
	inset?: boolean;
}) {
	return (
		<ContextMenuPrimitive.SubTrigger
			data-slot="context-menu-sub-trigger"
			data-inset={inset}
			className={cn(
				'iso:flex iso:cursor-default iso:items-center iso:rounded-sm iso:px-2 iso:py-1.5 iso:text-sm iso:outline-hidden iso:select-none iso:focus:bg-accent iso:focus:text-accent-foreground iso:data-[inset]:pl-8 iso:data-[state=open]:bg-accent iso:data-[state=open]:text-accent-foreground iso:[&_svg]:pointer-events-none iso:[&_svg]:shrink-0 iso:[&_svg:not([class*=size-])]:size-4 iso:[&_svg:not([class*=text-])]:text-muted-foreground',
				className
			)}
			{...props}
		>
			{children}
			<ChevronRightIcon className="iso:ml-auto" />
		</ContextMenuPrimitive.SubTrigger>
	);
}

function ContextMenuSubContent({
	className,
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
	return (
		<ContextMenuPrimitive.SubContent
			data-slot="context-menu-sub-content"
			className={cn(
				'iso:z-50 iso:min-w-[8rem] iso:origin-(--radix-context-menu-content-transform-origin) iso:overflow-hidden iso:rounded-md iso:border iso:bg-popover iso:p-1 iso:text-popover-foreground iso:shadow-lg iso:data-[side=bottom]:slide-in-from-top-2 iso:data-[side=left]:slide-in-from-right-2 iso:data-[side=right]:slide-in-from-left-2 iso:data-[side=top]:slide-in-from-bottom-2 iso:data-[state=closed]:animate-out iso:data-[state=closed]:fade-out-0 iso:data-[state=closed]:zoom-out-95 iso:data-[state=open]:animate-in iso:data-[state=open]:fade-in-0 iso:data-[state=open]:zoom-in-95',
				className
			)}
			{...props}
		/>
	);
}

function ContextMenuContent({
	className,
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
	return (
		<ContextMenuPrimitive.Portal>
			<ContextMenuPrimitive.Content
				data-slot="context-menu-content"
				className={cn(
					'iso:z-50 iso:max-h-(--radix-context-menu-content-available-height) iso:min-w-[8rem] iso:origin-(--radix-context-menu-content-transform-origin) iso:overflow-x-hidden iso:overflow-y-auto iso:rounded-md iso:border iso:bg-popover iso:p-1 iso:text-popover-foreground iso:shadow-md iso:data-[side=bottom]:slide-in-from-top-2 iso:data-[side=left]:slide-in-from-right-2 iso:data-[side=right]:slide-in-from-left-2 iso:data-[side=top]:slide-in-from-bottom-2 iso:data-[state=closed]:animate-out iso:data-[state=closed]:fade-out-0 iso:data-[state=closed]:zoom-out-95 iso:data-[state=open]:animate-in iso:data-[state=open]:fade-in-0 iso:data-[state=open]:zoom-in-95',
					className
				)}
				{...props}
			/>
		</ContextMenuPrimitive.Portal>
	);
}

function ContextMenuItem({
	className,
	inset,
	variant = 'default',
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
	inset?: boolean;
	variant?: 'default' | 'destructive';
}) {
	return (
		<ContextMenuPrimitive.Item
			data-slot="context-menu-item"
			data-inset={inset}
			data-variant={variant}
			className={cn(
				'iso:relative iso:flex iso:cursor-default iso:items-center iso:gap-2 iso:rounded-sm iso:px-2 iso:py-1.5 iso:text-sm iso:outline-hidden iso:select-none iso:focus:bg-accent iso:focus:text-accent-foreground iso:data-[disabled]:pointer-events-none iso:data-[disabled]:opacity-50 iso:data-[inset]:pl-8 iso:data-[variant=destructive]:text-destructive iso:data-[variant=destructive]:focus:bg-destructive/10 iso:data-[variant=destructive]:focus:text-destructive iso:dark:data-[variant=destructive]:focus:bg-destructive/20 iso:[&_svg]:pointer-events-none iso:[&_svg]:shrink-0 iso:[&_svg:not([class*=size-])]:size-4 iso:[&_svg:not([class*=text-])]:text-muted-foreground iso:data-[variant=destructive]:*:[svg]:text-destructive!',
				className
			)}
			{...props}
		/>
	);
}

function ContextMenuCheckboxItem({
	className,
	children,
	checked,
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
	return (
		<ContextMenuPrimitive.CheckboxItem
			data-slot="context-menu-checkbox-item"
			className={cn(
				'iso:relative iso:flex iso:cursor-default iso:items-center iso:gap-2 iso:rounded-sm iso:py-1.5 iso:pr-2 iso:pl-8 iso:text-sm iso:outline-hidden iso:select-none iso:focus:bg-accent iso:focus:text-accent-foreground iso:data-[disabled]:pointer-events-none iso:data-[disabled]:opacity-50 iso:[&_svg]:pointer-events-none iso:[&_svg]:shrink-0 iso:[&_svg:not([class*=size-])]:size-4',
				className
			)}
			checked={checked}
			{...props}
		>
			<span className="iso:pointer-events-none iso:absolute iso:left-2 iso:flex iso:size-3.5 iso:items-center iso:justify-center">
				<ContextMenuPrimitive.ItemIndicator>
					<CheckIcon className="iso:size-4" />
				</ContextMenuPrimitive.ItemIndicator>
			</span>
			{children}
		</ContextMenuPrimitive.CheckboxItem>
	);
}

function ContextMenuRadioItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioItem>) {
	return (
		<ContextMenuPrimitive.RadioItem
			data-slot="context-menu-radio-item"
			className={cn(
				'iso:relative iso:flex iso:cursor-default iso:items-center iso:gap-2 iso:rounded-sm iso:py-1.5 iso:pr-2 iso:pl-8 iso:text-sm iso:outline-hidden iso:select-none iso:focus:bg-accent iso:focus:text-accent-foreground iso:data-[disabled]:pointer-events-none iso:data-[disabled]:opacity-50 iso:[&_svg]:pointer-events-none iso:[&_svg]:shrink-0 iso:[&_svg:not([class*=size-])]:size-4',
				className
			)}
			{...props}
		>
			<span className="iso:pointer-events-none iso:absolute iso:left-2 iso:flex iso:size-3.5 iso:items-center iso:justify-center">
				<ContextMenuPrimitive.ItemIndicator>
					<CircleIcon className="iso:size-2 iso:fill-current" />
				</ContextMenuPrimitive.ItemIndicator>
			</span>
			{children}
		</ContextMenuPrimitive.RadioItem>
	);
}

function ContextMenuLabel({
	className,
	inset,
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Label> & {
	inset?: boolean;
}) {
	return (
		<ContextMenuPrimitive.Label
			data-slot="context-menu-label"
			data-inset={inset}
			className={cn(
				'iso:px-2 iso:py-1.5 iso:text-sm iso:font-medium iso:text-foreground iso:data-[inset]:pl-8',
				className
			)}
			{...props}
		/>
	);
}

function ContextMenuSeparator({
	className,
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
	return (
		<ContextMenuPrimitive.Separator
			data-slot="context-menu-separator"
			className={cn('iso:-mx-1 iso:my-1 iso:h-px iso:bg-border', className)}
			{...props}
		/>
	);
}

function ContextMenuShortcut({
	className,
	...props
}: React.ComponentProps<'span'>) {
	return (
		<span
			data-slot="context-menu-shortcut"
			className={cn(
				'iso:ml-auto iso:text-xs iso:tracking-widest iso:text-muted-foreground',
				className
			)}
			{...props}
		/>
	);
}

export {
	ContextMenu,
	ContextMenuCheckboxItem,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuPortal,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger
};
