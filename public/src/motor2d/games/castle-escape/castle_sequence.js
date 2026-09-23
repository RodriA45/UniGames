// ══════════════════════════════════════
//   Castle Escape — castle_sequence.js  (módulo ES6)
// ══════════════════════════════════════
// Clase SecuenciasNivel: lo que pasa al terminar un intento — morir,
// completar el nivel y el overlay de empezar / continuar / reiniciar.
import { CastleConfig as C } from './castle_config.js';

export class SecuenciasNivel {
  static PUNTOS_BASE = 100;
  static PUNTOS_POR_ESTRELLA = 50;
  static ID_JUEGO_PUNTAJE = 8; // id de Castle Escape en la tabla de puntajes

  constructor(juego) {
    this.juego = juego;
    this.dom = juego.dom;
  }

  morirJugador() {
    const juego = this.juego;
    const p = juego.jugador;
    p.dead = true;
    juego.deathsThisLevel++;
    juego.totalDeaths++;
    juego.levelDeaths++;
    if (this.dom.hudDeaths) this.dom.hudDeaths.textContent = 'Muertes: ' + juego.totalDeaths;
    juego.explosiones.crear(p.x + p.w / 2, p.y + p.h / 2);

    // Recorre fall_0..3 mientras dura el respawn. El loop sigue dibujando
    // (el update corta al toque por p.dead), así que alcanza con ir
    // cambiando animFrameName.
    p.animFrameName = C.FALL_FRAMES[0];

    let fallFrame = 0;
    const fallTimer = setInterval(() => {
      fallFrame++;
      if (fallFrame < C.FALL_FRAMES.length) p.animFrameName = C.FALL_FRAMES[fallFrame];
    }, C.FALL_FRAME_DELAY);

    setTimeout(() => {
      clearInterval(fallTimer);
      juego.cargarNivel(juego.levelIndex);
    }, C.DEATH_DELAY);
  }

  completarNivel() {
    const juego = this.juego;
    juego.running = false;
    juego.loop.stop();

    const stars = juego.calcularEstrellas();
    juego.progreso.guardarEstrellas(juego.levelIndex, stars);

    const levelScore = SecuenciasNivel.PUNTOS_BASE + stars * SecuenciasNivel.PUNTOS_POR_ESTRELLA;
    juego.totalScore += levelScore;

    const starsText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    const timeLimit = C.TIME_LIMITS[juego.levelIndex] || 60;
    const deathLimit = C.DEATH_LIMITS[juego.levelIndex] || 5;
    const condiciones = '★ Completar el nivel\n★★ En ' + timeLimit + 's o menos\n★★★ Con ' + deathLimit + ' muerte' + (deathLimit === 1 ? '' : 's') + ' o menos';

    this.dom.hudDeaths.textContent = 'Muertes: 0';

    // Reiniciar contadores para que el próximo nivel empiece en 0
    juego.totalDeaths = 0;
    juego.levelDeaths = 0;

    const esUltimo = juego.levelIndex >= juego.levels.length - 1;
    if (esUltimo) {
      if (typeof guardarPuntaje === 'function') guardarPuntaje(SecuenciasNivel.ID_JUEGO_PUNTAJE, juego.totalScore, null);
      this.mostrarOverlay('¡Completaste todo!', starsText + '  +' + levelScore + ' pts — Total: ' + juego.totalScore + '\n\n' + condiciones, true);
    } else {
      juego.levelIndex++;
      juego.levelStartTime = performance.now();
      juego.cargarNivel(juego.levelIndex);
      this.mostrarOverlay('¡Nivel superado!', starsText + '  +' + levelScore + ' pts\n\n' + condiciones, false, '▶ Continuar');
    }
  }

  mostrarOverlay(title, sub, isEnd, btnLabel) {
    const dom = this.dom;
    dom.overlay.classList.remove('hidden');
    dom.overlayTitle.textContent = title;
    dom.overlaySub.textContent = sub;
    dom.startBtn.textContent = isEnd ? 'Jugar de nuevo' : (btnLabel || '▶ Empezar');
    dom.startBtn.onclick = isEnd ? () => this.reiniciar() : () => this.juego.empezar();
  }

  reiniciar() {
    this.juego.menu.volverASeleccionNivel();
  }
}
