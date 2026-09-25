// ══════════════════════════════════════
//   Pixel Runner — runner_menu_flow.js  (módulo ES6)
// ══════════════════════════════════════
// Clase RunnerMenu: menú del runner, reiniciar/arrancar partida y los
// cómics del Modo Historia. Recibe el juego por constructor (composición).
import { RunnerConfig as RC } from './runner_config.js';

export class RunnerMenu {
  constructor(juego) {
    this.juego = juego;
    this.dom = juego.dom;
    this.comicCallback = null; // qué hacer al tocar "Continuar" en el cómic
  }

  reiniciar() {
    const juego = this.juego;
    juego.detener();
    juego.configurarTeclado();
    juego.configurarTactil();
    juego.empezar();
  }

  irAlMenu() {
    this.juego.detener();
    this.mostrar();
  }

  mostrar() {
    const dom = this.dom;
    const container = document.querySelector('#sec-runner .runner-container');
    if (dom.menu) dom.menu.classList.remove('hidden');
    if (container) container.classList.remove('hidden');
    if (dom.overlay) dom.overlay.classList.add('hidden');
    if (dom.comicOverlay) dom.comicOverlay.classList.add('hidden');
    // Por si quedó algún cartel (Mejoras/Ajustes/Cómo jugar) abierto.
    this.juego.servicios.cerrarPanelesRunner();
    this.juego.servicios.ponerMusica(RC.ASSET_BASE + 'sounds/menu.mp3');
  }

  empezarPartida(mode) {
    this.juego.mode = (mode === 'infinito') ? 'infinito' : 'historia';
    if (this.dom.menu) this.dom.menu.classList.add('hidden');
    this.juego.servicios.ponerMusica(RC.ASSET_BASE + 'sounds/backplay.mp3');
    this.juego.iniciar();
  }

  // ─── Cómics a pantalla completa ───
  mostrarComic(src, onContinue) {
    const overlay = this.dom.comicOverlay;
    const img = this.dom.comicImg;
    if (!overlay || !img) { onContinue(); return; }
    img.src = src;
    this.comicCallback = onContinue;
    overlay.classList.remove('hidden');
  }

  continuarComic() {
    if (this.dom.comicOverlay) this.dom.comicOverlay.classList.add('hidden');
    const cb = this.comicCallback;
    this.comicCallback = null;
    if (typeof cb === 'function') cb();
  }
}
