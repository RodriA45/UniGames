// ══════════════════════════════════════
//   Pixel Runner — runner_main.js  (entry point, módulo ES6)
// ══════════════════════════════════════
// Único archivo de Pixel Runner que se carga desde app2.js (import()).
// Crea LA instancia del juego y expone en window solo lo que se llama
// desde afuera del módulo, con los mismos nombres de siempre:
//   - los onclick="..."/oninput="..." de index.html
//   - lo que usa app2.js (modo Historia/Infinito y el panel de Mejoras).
//     OJO: app2.js llama a getUpgradeCost(...) SIN typeof-guard, así que
//     tiene que estar siempre expuesto.
import { PixelRunner } from './runner_loop.js';
import { RunnerConfig } from './runner_config.js';
import { ServiciosApp } from '../servicios_app.js';

// Acá se arman las dependencias y se le pasan al juego (el juego no las crea).
export const juego = new PixelRunner(new ServiciosApp());

Object.assign(window, {
  // index.html (onclick/oninput)
  stopRunner: () => juego.detener(),
  pauseRunner: () => juego.pausar(),
  resumeRunner: () => juego.reanudar(),
  restartRunner: () => juego.menu.reiniciar(),
  toRunnerMenu: () => juego.menu.irAlMenu(),
  runnerComicContinuar: () => juego.menu.continuarComic(),
  // app2.js (modo Historia/Infinito + panel de Mejoras)
  loadHistoriaCompleta: () => juego.economia.historiaCompleta(),
  RUNNER_COMICS: RunnerConfig.COMICS,
  showRunnerComic: (src, onContinue) => juego.menu.mostrarComic(src, onContinue),
  startPixelRunnerGame: (mode) => juego.menu.empezarPartida(mode),
  showRunnerMenu: () => juego.menu.mostrar(),
  refreshRunnerUpgrades: () => juego.economia.refrescarMejoras(),
  loadTotalCoins: () => juego.economia.cargarMonedas(),
  buyRunnerUpgrade: (tipo) => juego.economia.comprarMejora(tipo),
  getUpgradeCost: (tipo, upgrades) => juego.economia.costoMejora(tipo, upgrades),
});
