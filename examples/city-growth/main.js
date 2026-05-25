import { mountScene } from '../../packages/core/dist/index.js';
import sceneBundle from './scene.isostate.js';

const target = document.querySelector('#scene');
const progress = document.querySelector('#progress');
const stateLabel = document.querySelector('#state-label');
const configLabel = document.querySelector('#config-label');

const mounted = mountScene(target, sceneBundle, {
  label: 'City growth isometric preview scene',
  controller: {},
});

const scenes = mounted.getResolvedConfig().scenes;
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

requestAnimationFrame(() => setSceneProgress(Number(progress.value) / 100));
window.addEventListener('pagehide', () => mounted.destroy(), { once: true });
