// ══════════════════════════════════════
//   Castle Escape — castle_main.js  (entry point, módulo ES6)
// ══════════════════════════════════════
// Único archivo de Castle Escape que se carga desde app2.js (import()).
// Crea LA instancia del juego y expone en window solo lo que se llama
// desde afuera del módulo, con los mismos nombres de siempre:

import { CastleEscape } from './castle_loop.js';
import { ServiciosApp } from '../servicios_app.js';

// Acá se arman las dependencias y se le pasan al juego (el juego no las crea).
export const juego = new CastleEscape(new ServiciosApp());

Object.assign(window, {
  initTrampas: () => juego.iniciar(),
  startTrampas: () => juego.empezar(),
  stopTrampas: () => juego.detener(),
  toggleCastleMusic: () => juego.alternarMusica(),
  trPauseGame: () => juego.pausar(),
  trResumeGame: () => juego.reanudar(),
  trExitToLevels: () => juego.salirANiveles(),
  trShowMainMenu: () => juego.menu.mostrarMenuPrincipal(),
  trShowLevelSelect: () => juego.menu.mostrarSeleccionNivel(),
  trShowSettings: () => juego.menu.mostrarAjustes(),
  trShowHowToPlay: () => juego.menu.mostrarComoJugar(),
  trToggleControlsSign: () => juego.menu.alternarCartelControles(),
  trToggleFullscreen: () => juego.menu.alternarPantallaCompleta(),
  trNavLevel: (dir) => juego.menu.navegarNivel(dir),
  trPlaySelectedLevel: () => juego.menu.jugarNivelSeleccionado(),
  trOnMusicVolumeChange: (v) => juego.menu.cambiarVolumenMusica(v),
  trOnSfxVolumeChange: (v) => juego.menu.cambiarVolumenSfx(v),
});
