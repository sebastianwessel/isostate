import { Grid2X2, Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button.tsx';
import { Slider } from '../ui/slider.tsx';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '../ui/tooltip.tsx';

interface CanvasControlsProps {
	zoom: number;
	gridOpacity: number;
	zoomBy: (factor: number) => void;
	resetView: () => void;
	updateGridOpacity: (value: number) => void;
}

export function CanvasControls({
	zoom,
	gridOpacity,
	zoomBy,
	resetView,
	updateGridOpacity
}: CanvasControlsProps) {
	return (
		<div
			className="isostate-canvas-controls"
			role="toolbar"
			aria-label="Canvas controls"
		>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="secondary"
							size="icon-sm"
							onClick={() => zoomBy(1.15)}
							aria-label="Zoom in"
						>
							<Plus aria-hidden="true" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Zoom in</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="secondary"
							size="icon-sm"
							onClick={() => zoomBy(0.85)}
							aria-label="Zoom out"
						>
							<Minus aria-hidden="true" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Zoom out</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="secondary"
							size="icon-sm"
							onClick={resetView}
							aria-label="Reset view"
						>
							<RotateCcw aria-hidden="true" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Reset view</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			<span className="isostate-canvas-zoom">{Math.round(zoom * 100)}%</span>
			<div className="isostate-grid-opacity-control">
				<Grid2X2 aria-hidden="true" />
				<input
					type="range"
					className="isostate-grid-opacity isostate-grid-opacity-native"
					min="0"
					max="1"
					step="0.01"
					value={gridOpacity}
					onInput={(event) =>
						updateGridOpacity(Number(event.currentTarget.value))
					}
					onPointerUp={(event) =>
						updateGridOpacity(Number(event.currentTarget.value))
					}
					onKeyUp={(event) =>
						updateGridOpacity(Number(event.currentTarget.value))
					}
					aria-label="Grid opacity"
				/>
				<Slider
					className="isostate-grid-opacity-slider"
					min={0}
					max={1}
					step={0.01}
					value={[gridOpacity]}
					onValueChange={([value]) => updateGridOpacity(value ?? gridOpacity)}
					aria-label="Grid opacity"
				/>
			</div>
		</div>
	);
}
