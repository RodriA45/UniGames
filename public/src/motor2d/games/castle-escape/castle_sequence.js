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
    this.fallTimer = null;   // setInterval de los frames de caída
    this.respawnTimer = null; // setTimeout que recarga el nivel
  }

  // Lo llama CastleEscape.detener(): salir al menú durante la caída no
  // tiene que recargar el nivel 450ms después.
  cancelarTimers() {
    clearInterval(this.fallTimer);
    clearTimeout(this.respawnTimer);
    this.fallTimer = null;
    this.respawnTimer = null;
  }

  morirJugador() {
    const juego = this.juego;
    const p = juego.jugador;
    // Dos peligros en el mismo frame (ej. dos flechas) contaban 2 muertes y
    // programaban 2 recargas del nivel.
    if (p.dead) return;
    p.dead = true;
    juego.totalDeaths++;
    juego.levelDeaths++;
    if (this.dom.hudDeaths) this.dom.hudDeaths.textContent = 'Muertes: ' + juego.totalDeaths;
    juego.explosiones.crear(p.x + p.w / 2, p.y + p.h / 2);

    // Recorre fall_0..3 mientras dura el respawn. El loop sigue dibujando
    // (el update corta al toque por p.dead), así que alcanza con ir
    // cambiando animFrameName.
    p.animFrameName = C.FALL_FRAMES[0];

    let fallFrame = 0;
    this.cancelarTimers();
    this.fallTimer = setInterval(() => {
      fallFrame++;
      if (fallFrame < C.FALL_FRAMES.length) p.animFrameName = C.FALL_FRAMES[fallFrame];
    }, C.FALL_FRAME_DELAY);

    this.respawnTimer = setTimeout(() => {
      this.cancelarTimers();
      juego.cargarNivel(juego.levelIndex);
    }, C.DEATH_DELAY);
  }

  completarNivel() {
    const juego = this.juego;
    juego.running = false;
    juego.loop.stop();

    const stars = juego.calcularEstrellas();
    juego.progreso.guardarEstrellas(juego.levelIndex, stars);

    const levelScore = SecuenciasNivel.puntosNivel(stars);
    // Puntaje del ranking: la suma de los MEJORES resultados guardados de
    // todos los niveles. No depende de desde qué nivel arrancaste ni de
    // jugarlos todos seguidos, y se manda en cada nivel superado (el
    // backend solo lo guarda si supera el récord).
    const total = this.puntajeTotal();
    juego.servicios.guardarPuntaje(SecuenciasNivel.ID_JUEGO_PUNTAJE, total, null);

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
      this.mostrarOverlay('¡Completaste todo!', starsText + '  +' + levelScore + ' pts — Total: ' + total + '\n\n' + condiciones, true);
    } else {
      juego.levelIndex++;
      juego.cargarNivel(juego.levelIndex);
      this.mostrarOverlay('¡Nivel superado!', starsText + '  +' + levelScore + ' pts — Total: ' + total + '\n\n' + condiciones, false, '▶ Continuar');
    }
  }

  static puntosNivel(stars) {
    return SecuenciasNivel.PUNTOS_BASE + stars * SecuenciasNivel.PUNTOS_POR_ESTRELLA;
  }

  // Suma de los mejores puntos de cada nivel (0 si nunca se completó).
  puntajeTotal() {
    const juego = this.juego;
    let total = 0;
    for (let i = 0; i < juego.levels.length; i++) {
      const stars = juego.progreso.estrellasDe(i);
      if (stars > 0) total += SecuenciasNivel.puntosNivel(stars);
    }
    return total;
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
