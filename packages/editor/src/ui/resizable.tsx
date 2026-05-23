import { GripVerticalIcon } from 'lucide-react';
import * as ResizablePrimitive from 'react-resizable-panels';

import { cn } from '../lib/utils.ts';

function ResizablePanelGroup({
	className,
	direction,
	orientation,
	...props
}: ResizablePrimitive.GroupProps & {
	direction?: ResizablePrimitive.GroupProps['orientation'];
}) {
	return (
		<ResizablePrimitive.Group
			data-slot="resizable-panel-group"
			orientation={orientation ?? direction}
			className={cn(
				'iso:flex iso:h-full iso:w-full iso:aria-[orientation=vertical]:flex-col',
				className
			)}
			{...props}
		/>
	);
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
	return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
	withHandle,
	className,
	...props
}: ResizablePrimitive.SeparatorProps & {
	withHandle?: boolean;
}) {
	return (
		<ResizablePrimitive.Separator
			data-slot="resizable-handle"
			className={cn(
				'iso:relative iso:flex iso:w-px iso:items-center iso:justify-center iso:bg-border iso:after:absolute iso:after:inset-y-0 iso:after:left-1/2 iso:after:w-1 iso:after:-translate-x-1/2 iso:focus-visible:ring-1 iso:focus-visible:ring-ring iso:focus-visible:ring-offset-1 iso:focus-visible:outline-hidden iso:aria-[orientation=horizontal]:h-px iso:aria-[orientation=horizontal]:w-full iso:aria-[orientation=horizontal]:after:left-0 iso:aria-[orientation=horizontal]:after:h-1 iso:aria-[orientation=horizontal]:after:w-full iso:aria-[orientation=horizontal]:after:translate-x-0 iso:aria-[orientation=horizontal]:after:-translate-y-1/2 iso:[&[aria-orientation=horizontal]>div]:rotate-90',
				className
			)}
			{...props}
		>
			{withHandle && (
				<div className="iso:z-10 iso:flex iso:h-4 iso:w-3 iso:items-center iso:justify-center iso:rounded-xs iso:border iso:bg-border">
					<GripVerticalIcon className="iso:size-2.5" />
				</div>
			)}
		</ResizablePrimitive.Separator>
	);
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
