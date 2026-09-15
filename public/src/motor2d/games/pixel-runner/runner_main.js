// ══════════════════════════════════════
//   Pixel Runner — runner_main.js  (entry point, módulo ES6)
// ══════════════════════════════════════
// Único archivo de Pixel Runner que index.html carga con
// <script type="module">. Importa el resto de los runner_*.js y expone en
// window SOLAMENTE lo que se llama desde fuera del módulo:
//   - los onclick="..."/oninput="..." de index.html
//   - lo que app2.js usa de pixelrunner (el panel de Modo Historia/Infinito
//     y el panel de Mejoras/tienda). OJO: a diferencia de Castle Escape,
//     app2.js llama a getUpgradeCost(...) SIN typeof-guard (mejoraCardHtml,
//     línea ~520) — si falta en este Object.assign, el panel de Mejoras
//     tira ReferenceError apenas se abre. El resto de las llamadas de
//     app2.js sí están guardadas con "typeof X === 'function'", pero las
//     dejamos expuestas igual para que esos guards se cumplan y el modo
//     Historia/Infinito y la tienda funcionen de verdad (no solo no rompan).
import { stopRunner, pauseRunner, resumeRunner } from './runner_loop.js';
import { restartRunner, toRunnerMenu, showRunnerMenu, startPixelRunnerGame } from './runner_menu_flow.js';
import { runnerComicContinuar, showRunnerComic, RUNNER_COMICS } from './runner_config.js';
import { loadHistoriaCompleta, refreshRunnerUpgrades, loadTotalCoins, buyRunnerUpgrade, getUpgradeCost } from './runner_economy.js';

Object.assign(window, {
  // index.html (onclick/oninput)
  stopRunner,
  pauseRunner,
  resumeRunner,
  restartRunner,
  toRunnerMenu,
  runnerComicContinuar,
  // app2.js (modo Historia/Infinito + panel de Mejoras)
  loadHistoriaCompleta,
  RUNNER_COMICS,
  showRunnerComic,
  startPixelRunnerGame,
  showRunnerMenu,
  refreshRunnerUpgrades,
  loadTotalCoins,
  buyRunnerUpgrade,
  getUpgradeCost,
});
