import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import type * as React from 'react';

import { cn } from '../lib/utils.ts';

function DropdownMenu({
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
	return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
	return (
		<DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
	);
}

function DropdownMenuTrigger({
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
	return (
		<DropdownMenuPrimitive.Trigger
			data-slot="dropdown-menu-trigger"
			{...props}
		/>
	);
}

function DropdownMenuContent({
	className,
	sideOffset = 4,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
	return (
		<DropdownMenuPrimitive.Portal>
			<DropdownMenuPrimitive.Content
				data-slot="dropdown-menu-content"
				sideOffset={sideOffset}
				className={cn(
					'iso:z-50 iso:max-h-(--radix-dropdown-menu-content-available-height) iso:min-w-[8rem] iso:origin-(--radix-dropdown-menu-content-transform-origin) iso:overflow-x-hidden iso:overflow-y-auto iso:rounded-md iso:border iso:bg-popover iso:p-1 iso:text-popover-foreground iso:shadow-md iso:data-[side=bottom]:slide-in-from-top-2 iso:data-[side=left]:slide-in-from-right-2 iso:data-[side=right]:slide-in-from-left-2 iso:data-[side=top]:slide-in-from-bottom-2 iso:data-[state=closed]:animate-out iso:data-[state=closed]:fade-out-0 iso:data-[state=closed]:zoom-out-95 iso:data-[state=open]:animate-in iso:data-[state=open]:fade-in-0 iso:data-[state=open]:zoom-in-95',
					className
				)}
				{...props}
			/>
		</DropdownMenuPrimitive.Portal>
	);
}

function DropdownMenuGroup({
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
	return (
		<DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
	);
}

function DropdownMenuItem({
	className,
	inset,
	variant = 'default',
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
	inset?: boolean;
	variant?: 'default' | 'destructive';
}) {
	return (
		<DropdownMenuPrimitive.Item
			data-slot="dropdown-menu-item"
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

function DropdownMenuCheckboxItem({
	className,
	children,
	checked,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
	return (
		<DropdownMenuPrimitive.CheckboxItem
			data-slot="dropdown-menu-checkbox-item"
			className={cn(
				'iso:relative iso:flex iso:cursor-default iso:items-center iso:gap-2 iso:rounded-sm iso:py-1.5 iso:pr-2 iso:pl-8 iso:text-sm iso:outline-hidden iso:select-none iso:focus:bg-accent iso:focus:text-accent-foreground iso:data-[disabled]:pointer-events-none iso:data-[disabled]:opacity-50 iso:[&_svg]:pointer-events-none iso:[&_svg]:shrink-0 iso:[&_svg:not([class*=size-])]:size-4',
				className
			)}
			checked={checked}
			{...props}
		>
			<span className="iso:pointer-events-none iso:absolute iso:left-2 iso:flex iso:size-3.5 iso:items-center iso:justify-center">
				<DropdownMenuPrimitive.ItemIndicator>
					<CheckIcon className="iso:size-4" />
				</DropdownMenuPrimitive.ItemIndicator>
			</span>
			{children}
		</DropdownMenuPrimitive.CheckboxItem>
	);
}

function DropdownMenuRadioGroup({
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
	return (
		<DropdownMenuPrimitive.RadioGroup
			data-slot="dropdown-menu-radio-group"
			{...props}
		/>
	);
}

function DropdownMenuRadioItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
	return (
		<DropdownMenuPrimitive.RadioItem
			data-slot="dropdown-menu-radio-item"
			className={cn(
				'iso:relative iso:flex iso:cursor-default iso:items-center iso:gap-2 iso:rounded-sm iso:py-1.5 iso:pr-2 iso:pl-8 iso:text-sm iso:outline-hidden iso:select-none iso:focus:bg-accent iso:focus:text-accent-foreground iso:data-[disabled]:pointer-events-none iso:data-[disabled]:opacity-50 iso:[&_svg]:pointer-events-none iso:[&_svg]:shrink-0 iso:[&_svg:not([class*=size-])]:size-4',
				className
			)}
			{...props}
		>
			<span className="iso:pointer-events-none iso:absolute iso:left-2 iso:flex iso:size-3.5 iso:items-center iso:justify-center">
				<DropdownMenuPrimitive.ItemIndicator>
					<CircleIcon className="iso:size-2 iso:fill-current" />
				</DropdownMenuPrimitive.ItemIndicator>
			</span>
			{children}
		</DropdownMenuPrimitive.RadioItem>
	);
}

function DropdownMenuLabel({
	className,
	inset,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
	inset?: boolean;
}) {
	return (
		<DropdownMenuPrimitive.Label
			data-slot="dropdown-menu-label"
			data-inset={inset}
			className={cn(
				'iso:px-2 iso:py-1.5 iso:text-sm iso:font-medium iso:data-[inset]:pl-8',
				className
			)}
			{...props}
		/>
	);
}

function DropdownMenuSeparator({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
	return (
		<DropdownMenuPrimitive.Separator
			data-slot="dropdown-menu-separator"
			className={cn('iso:-mx-1 iso:my-1 iso:h-px iso:bg-border', className)}
			{...props}
		/>
	);
}

function DropdownMenuShortcut({
	className,
	...props
}: React.ComponentProps<'span'>) {
	return (
		<span
			data-slot="dropdown-menu-shortcut"
			className={cn(
				'iso:ml-auto iso:text-xs iso:tracking-widest iso:text-muted-foreground',
				className
			)}
			{...props}
		/>
	);
}

function DropdownMenuSub({
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
	return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
	className,
	inset,
	children,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
	inset?: boolean;
}) {
	return (
		<DropdownMenuPrimitive.SubTrigger
			data-slot="dropdown-menu-sub-trigger"
			data-inset={inset}
			className={cn(
				'iso:flex iso:cursor-default iso:items-center iso:gap-2 iso:rounded-sm iso:px-2 iso:py-1.5 iso:text-sm iso:outline-hidden iso:select-none iso:focus:bg-accent iso:focus:text-accent-foreground iso:data-[inset]:pl-8 iso:data-[state=open]:bg-accent iso:data-[state=open]:text-accent-foreground iso:[&_svg]:pointer-events-none iso:[&_svg]:shrink-0 iso:[&_svg:not([class*=size-])]:size-4 iso:[&_svg:not([class*=text-])]:text-muted-foreground',
				className
			)}
			{...props}
		>
			{children}
			<ChevronRightIcon className="iso:ml-auto iso:size-4" />
		</DropdownMenuPrimitive.SubTrigger>
	);
}

function DropdownMenuSubContent({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
	return (
		<DropdownMenuPrimitive.SubContent
			data-slot="dropdown-menu-sub-content"
			className={cn(
				'iso:z-50 iso:min-w-[8rem] iso:origin-(--radix-dropdown-menu-content-transform-origin) iso:overflow-hidden iso:rounded-md iso:border iso:bg-popover iso:p-1 iso:text-popover-foreground iso:shadow-lg iso:data-[side=bottom]:slide-in-from-top-2 iso:data-[side=left]:slide-in-from-right-2 iso:data-[side=right]:slide-in-from-left-2 iso:data-[side=top]:slide-in-from-bottom-2 iso:data-[state=closed]:animate-out iso:data-[state=closed]:fade-out-0 iso:data-[state=closed]:zoom-out-95 iso:data-[state=open]:animate-in iso:data-[state=open]:fade-in-0 iso:data-[state=open]:zoom-in-95',
				className
			)}
			{...props}
		/>
	);
}

export {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger
};
