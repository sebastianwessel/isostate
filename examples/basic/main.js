import { mountScene } from '../../packages/core/dist/index.js?example=side-port-stubs-v4';
import sceneBundle from './scene.isostate.js?example=side-port-stubs-v4';

const target = document.querySelector('#scene');
const progress = document.querySelector('#progress');
const stateLabel = document.querySelector('#state-label');
const configLabel = document.querySelector('#config-label');

const mounted = mountScene(target, sceneBundle, {
  label: 'Example isometric deployment scene',
  controller: {},
});
const params = new URLSearchParams(window.location.search);
if (params.get('grid') === '1') {
  addGridOverlay(mounted.svg, sceneBundle);
}

const scenes = mounted.getResolvedConfig().scenes;
const initialProgress = clampProgress(
  Number(params.get('progress') ?? 0),
);
const elementCount = Math.max(
  ...sceneBundle.scenes.map((scene) => scene.elements.length),
);
configLabel.textContent = `${scenes.length} scenes, ${elementCount} elements`;

function nearestScene(value) {
  return scenes.reduce((best, scene) => {
    const currentDistance = Math.abs(scene.progress - value);
    const bestDistance = Math.abs(best.progress - value);
    return currentDistance < bestDistance ? scene : best;
  }, scenes[0]);
}

function setSceneProgress(value) {
  mounted.controller?.setProgress(value);
  stateLabel.textContent = nearestScene(value).id;
}

progress.addEventListener('input', () => {
  setSceneProgress(Number(progress.value) / 100);
});

progress.value = String(Math.round(initialProgress * 100));
requestAnimationFrame(() => setSceneProgress(initialProgress));

window.addEventListener('pagehide', () => mounted.destroy(), { once: true });

function clampProgress(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function addGridOverlay(svg, bundle) {
  const layout = resolveExampleLayout(bundle);
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.classList.add('iso-grid-overlay');

  const [originX, originY] = bundle.floor.origin;
  const [width, height] = bundle.floor.size;
  const corners = [
    projectToScreen(originX, originY, layout),
    projectToScreen(originX + width, originY, layout),
    projectToScreen(originX + width, originY + height, layout),
    projectToScreen(originX, originY + height, layout),
  ];

  const slab = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  slab.classList.add('iso-floor-slab');
  slab.setAttribute('points', corners.map((point) => `${point.x},${point.y}`).join(' '));
  group.appendChild(slab);

  for (let x = 0; x <= width; x++) {
    group.appendChild(
      gridLine(
        projectToScreen(originX + x, originY, layout),
        projectToScreen(originX + x, originY + height, layout),
      ),
    );
  }

  for (let y = 0; y <= height; y++) {
    group.appendChild(
      gridLine(
        projectToScreen(originX, originY + y, layout),
        projectToScreen(originX + width, originY + y, layout),
      ),
    );
  }

  for (let x = 0; x <= width; x++) {
    for (let y = 0; y <= height; y++) {
      const point = projectToScreen(originX + x, originY + y, layout);
      group.appendChild(anchorPoint(point));
    }
  }

  const depthLayer = svg.querySelector('.iso-depth-layer');
  svg.insertBefore(group, depthLayer);
}

function gridLine(start, end) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', start.x);
  line.setAttribute('y1', start.y);
  line.setAttribute('x2', end.x);
  line.setAttribute('y2', end.y);
  return line;
}

function anchorPoint(point) {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', point.x);
  circle.setAttribute('cy', point.y);
  circle.setAttribute('r', '2.5');
  return circle;
}

function resolveExampleLayout(bundle) {
  const cellSize = bundle.grid.cellSize;
  const content = emptyBounds();
  for (const scene of bundle.scenes) {
    for (const element of scene.elements) {
      if (element.presence === 'removed') continue;
      const visualSize = cellSize * element.size;
      const asset = bundle.assets?.[element.asset];
      const [anchorX, anchorY] = asset?.anchor ?? [0.5, 1];
      const raw = projectToRaw(
        element.pos[0] + element.size,
        element.pos[1] + element.size,
        cellSize,
      );
      includeBounds(content, {
        minX: raw.x - visualSize * anchorX,
        minY: raw.y - visualSize * anchorY,
        maxX: raw.x + visualSize * (1 - anchorX),
        maxY: raw.y + visualSize * (1 - anchorY),
      });
    }
    for (const connector of scene.connectors ?? []) {
      if (connector.presence === 'removed') continue;
      for (const point of connector.route) {
        const raw = projectToRaw(point[0], point[1], cellSize);
        includePoint(content, raw.x, raw.y);
      }
    }
  }

  const floor = emptyBounds();
  const [originX, originY] = bundle.floor.origin;
  const [width, height] = bundle.floor.size;
  for (const point of [
    [originX, originY],
    [originX + width, originY],
    [originX, originY + height],
    [originX + width, originY + height],
  ]) {
    const raw = projectToRaw(point[0], point[1], cellSize);
    includePoint(floor, raw.x, raw.y);
  }

  const selected =
    bundle.layout.bounds === 'content'
      ? content
      : bundle.layout.bounds === 'floor'
        ? floor
        : includeBounds(content, floor);

  return {
    cellSize,
    bounds: selected,
    padding: bundle.layout.padding,
  };
}

function projectToRaw(x, y, cellSize) {
  return {
    x: cellSize * (x - y) * 0.5,
    y: cellSize * (x + y) * 0.25,
  };
}

function projectToScreen(x, y, layout) {
  const raw = projectToRaw(x, y, layout.cellSize);
  return {
    x: String(raw.x - layout.bounds.minX + layout.padding.x),
    y: String(raw.y - layout.bounds.minY + layout.padding.y),
  };
}

function emptyBounds() {
  return {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
}

function includePoint(bounds, x, y) {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
  return bounds;
}

function includeBounds(bounds, next) {
  bounds.minX = Math.min(bounds.minX, next.minX);
  bounds.minY = Math.min(bounds.minY, next.minY);
  bounds.maxX = Math.max(bounds.maxX, next.maxX);
  bounds.maxY = Math.max(bounds.maxY, next.maxY);
  return bounds;
}
