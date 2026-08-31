// ══════════════════════════════════════
//   Pixel Runner — runner_menu_flow.js  (módulo ES6)
// ══════════════════════════════════════
// Pantallas de menú: mostrar/ocultar el menú del runner, reiniciar y
// arrancar una partida nueva.
import { RUNNER, RUNNER_EL, RUNNER_ASSET_BASE } from './runner_config.js';
import { stopRunner, setupRunnerInput, setupRunnerTouch, startRunner, initRunner } from './runner_loop.js';

export function restartRunner() {
  stopRunner();
  setupRunnerInput();
  setupRunnerTouch();
  startRunner();
}

export function toRunnerMenu() {
  stopRunner();
  showRunnerMenu();
}

export function showRunnerMenu() {
  const menu = RUNNER_EL.menu;
  const container = document.querySelector('#sec-runner .runner-container');
  if (menu) menu.classList.remove('hidden');
  if (container) container.classList.remove('hidden');
  const ov = RUNNER_EL.overlay;
  if (ov) ov.classList.add('hidden');
  const comicOv = RUNNER_EL.comicOverlay;
  if (comicOv) comicOv.classList.add('hidden');
  // Por si quedó algún cartel (Mejoras/Ajustes/Cómo jugar) abierto de una
  // visita anterior al menú.
  if (typeof cerrarPanelesRunner === 'function') cerrarPanelesRunner();
  setMusic(RUNNER_ASSET_BASE + 'sounds/menu.mp3');
}

export function startPixelRunnerGame(mode) {
  RUNNER.mode = (mode === 'infinito') ? 'infinito' : 'historia';
  const menu = RUNNER_EL.menu;
  if (menu) menu.classList.add('hidden');
  setMusic(RUNNER_ASSET_BASE + 'sounds/backplay.mp3');
  initRunner();
}

// ─── Dibujo ─────────────────────────────
