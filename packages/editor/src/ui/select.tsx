import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import type * as React from 'react';

import { cn } from '../lib/utils.ts';

function Select({
	...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
	return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({
	...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
	return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({
	...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
	return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
	className,
	size = 'default',
	children,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
	size?: 'sm' | 'default';
}) {
	return (
		<SelectPrimitive.Trigger
			data-slot="select-trigger"
			data-size={size}
			className={cn(
				'iso:flex iso:w-fit iso:items-center iso:justify-between iso:gap-2 iso:rounded-md iso:border iso:border-input iso:bg-transparent iso:px-3 iso:py-2 iso:text-sm iso:whitespace-nowrap iso:shadow-xs iso:transition-[color,box-shadow] iso:outline-none iso:focus-visible:border-ring iso:focus-visible:ring-[3px] iso:focus-visible:ring-ring/50 iso:disabled:cursor-not-allowed iso:disabled:opacity-50 iso:aria-invalid:border-destructive iso:aria-invalid:ring-destructive/20 iso:data-[placeholder]:text-muted-foreground iso:data-[size=default]:h-9 iso:data-[size=sm]:h-8 iso:*:data-[slot=select-value]:line-clamp-1 iso:*:data-[slot=select-value]:flex iso:*:data-[slot=select-value]:items-center iso:*:data-[slot=select-value]:gap-2 iso:dark:bg-input/30 iso:dark:hover:bg-input/50 iso:dark:aria-invalid:ring-destructive/40 iso:[&_svg]:pointer-events-none iso:[&_svg]:shrink-0 iso:[&_svg:not([class*=size-])]:size-4 iso:[&_svg:not([class*=text-])]:text-muted-foreground',
				className
			)}
			{...props}
		>
			{children}
			<SelectPrimitive.Icon asChild>
				<ChevronDownIcon className="iso:size-4 iso:opacity-50" />
			</SelectPrimitive.Icon>
		</SelectPrimitive.Trigger>
	);
}

function SelectContent({
	className,
	children,
	position = 'item-aligned',
	align = 'center',
	...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Content
				data-slot="select-content"
				className={cn(
					'iso:relative iso:z-50 iso:max-h-(--radix-select-content-available-height) iso:min-w-[8rem] iso:origin-(--radix-select-content-transform-origin) iso:overflow-x-hidden iso:overflow-y-auto iso:rounded-md iso:border iso:bg-popover iso:text-popover-foreground iso:shadow-md iso:data-[side=bottom]:slide-in-from-top-2 iso:data-[side=left]:slide-in-from-right-2 iso:data-[side=right]:slide-in-from-left-2 iso:data-[side=top]:slide-in-from-bottom-2 iso:data-[state=closed]:animate-out iso:data-[state=closed]:fade-out-0 iso:data-[state=closed]:zoom-out-95 iso:data-[state=open]:animate-in iso:data-[state=open]:fade-in-0 iso:data-[state=open]:zoom-in-95',
					position === 'popper' &&
						'iso:data-[side=bottom]:translate-y-1 iso:data-[side=left]:-translate-x-1 iso:data-[side=right]:translate-x-1 iso:data-[side=top]:-translate-y-1',
					className
				)}
				position={position}
				align={align}
				{...props}
			>
				<SelectScrollUpButton />
				<SelectPrimitive.Viewport
					className={cn(
						'iso:p-1',
						position === 'popper' &&
							'iso:h-[var(--radix-select-trigger-height)] iso:w-full iso:min-w-[var(--radix-select-trigger-width)] iso:scroll-my-1'
					)}
				>
					{children}
				</SelectPrimitive.Viewport>
				<SelectScrollDownButton />
			</SelectPrimitive.Content>
		</SelectPrimitive.Portal>
	);
}

function SelectLabel({
	className,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
	return (
		<SelectPrimitive.Label
			data-slot="select-label"
			className={cn(
				'iso:px-2 iso:py-1.5 iso:text-xs iso:text-muted-foreground',
				className
			)}
			{...props}
		/>
	);
}

function SelectItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
	return (
		<SelectPrimitive.Item
			data-slot="select-item"
			className={cn(
				'iso:relative iso:flex iso:w-full iso:cursor-default iso:items-center iso:gap-2 iso:rounded-sm iso:py-1.5 iso:pr-8 iso:pl-2 iso:text-sm iso:outline-hidden iso:select-none iso:focus:bg-accent iso:focus:text-accent-foreground iso:data-[disabled]:pointer-events-none iso:data-[disabled]:opacity-50 iso:[&_svg]:pointer-events-none iso:[&_svg]:shrink-0 iso:[&_svg:not([class*=size-])]:size-4 iso:[&_svg:not([class*=text-])]:text-muted-foreground iso:*:[span]:last:flex iso:*:[span]:last:items-center iso:*:[span]:last:gap-2',
				className
			)}
			{...props}
		>
			<span
				data-slot="select-item-indicator"
				className="iso:absolute iso:right-2 iso:flex iso:size-3.5 iso:items-center iso:justify-center"
			>
				<SelectPrimitive.ItemIndicator>
					<CheckIcon className="iso:size-4" />
				</SelectPrimitive.ItemIndicator>
			</span>
			<SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
		</SelectPrimitive.Item>
	);
}

function SelectSeparator({
	className,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
	return (
		<SelectPrimitive.Separator
			data-slot="select-separator"
			className={cn(
				'iso:pointer-events-none iso:-mx-1 iso:my-1 iso:h-px iso:bg-border',
				className
			)}
			{...props}
		/>
	);
}

function SelectScrollUpButton({
	className,
	...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
	return (
		<SelectPrimitive.ScrollUpButton
			data-slot="select-scroll-up-button"
			className={cn(
				'iso:flex iso:cursor-default iso:items-center iso:justify-center iso:py-1',
				className
			)}
			{...props}
		>
			<ChevronUpIcon className="iso:size-4" />
		</SelectPrimitive.ScrollUpButton>
	);
}

function SelectScrollDownButton({
	className,
	...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
	return (
		<SelectPrimitive.ScrollDownButton
			data-slot="select-scroll-down-button"
			className={cn(
				'iso:flex iso:cursor-default iso:items-center iso:justify-center iso:py-1',
				className
			)}
			{...props}
		>
			<ChevronDownIcon className="iso:size-4" />
		</SelectPrimitive.ScrollDownButton>
	);
}

export {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectScrollDownButton,
	SelectScrollUpButton,
	SelectSeparator,
	SelectTrigger,
	SelectValue
};
