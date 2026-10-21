// ══════════════════════════════════════
//   Pixel Runner — runner_sequence.js  (módulo ES6)
// ══════════════════════════════════════
// Clase Secuencias: fin de partida — muerte con animación de caída,
// secuencia de victoria del Modo Historia (el castillo entra en cuadro y
// Junior camina hasta la puerta) y el cartel de Game Over / victoria.
import { RunnerConfig as RC } from './runner_config.js';

export class Secuencias {
  static ID_JUEGO_PUNTAJE = 7; // id de Pixel Runner en la tabla de puntajes

  constructor(juego) {
    this.juego = juego;
    this.dom = juego.dom;
    this.timers = new Set(); // setTimeout pendientes (caída, pausa en la puerta)
  }

  // setTimeout que se puede cancelar en bloque (ver cancelarTimers).
  programar(fn, ms) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  // Lo llaman detener() y empezar(): si se sale al menú o se reinicia en
  // medio de la caída o de la victoria, los timeouts viejos no deben pintar
  // el cartel de fin encima de lo que se esté mostrando ahora.
  cancelarTimers() {
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
  }

  // ─── Victoria (Modo Historia) ───
  // Limpia la pantalla (que no choque justo al ganar) y prepara el castillo
  // afuera del canvas. castillo.webp es pesada y solo se ve acá, por eso
  // se carga recién ahora y no en el arranque.
  async iniciarVictoria() {
    const juego = this.juego, C = juego.view;
    // Sincrónico, ANTES del await: desde este frame el update normal deja de
    // correr (ver PixelRunner.update). Y si se vuelve a llamar mientras
    // carga la imagen, no hace nada.
    if (juego.ganando) return;
    juego.ganando = true;
    const partida = juego.partidaId;
    juego.obstacles = [];
    juego.pickups = [];

    const img = await Engine2D.loadImage(RC.ASSETS.castillo).catch(() => null);
    // Mientras cargaba, el jugador pudo salir al menú o reiniciar.
    if (juego.partidaId !== partida || !juego.ganando) return;

    const p = juego.jugador;
    const h = RC.CASTLE_TARGET_H;
    const aspect = (img && img.width && img.height) ? (img.width / img.height) : 0.85;
    const w = h * aspect;
    const groundY = C.height - juego.groundH;
    const restX = C.width - w - RC.CASTLE_REST_MARGIN;

    juego.winCastle = {
      x: C.width + 30,
      y: groundY - h + RC.CASTLE_GROUND_OFFSET,
      w, h,
      restX,
      settled: false, // true cuando termina de entrar en cuadro
    };
    juego.winArrived = false;
    p.walkTargetX = restX - RC.CASTLE_DOOR_WALK_GAP; // hasta acá camina Junior

    juego.biome = 'grass'; // el final siempre en pasto
  }

  // Reemplaza al update normal mientras dura la victoria (sin spawns,
  // colisiones ni puntaje). Primero entra el castillo; ya asentado, Junior
  // camina hasta la puerta.
  actualizarVictoria(step) {
    const juego = this.juego, C = juego.view;
    const p = juego.jugador;
    const castle = juego.winCastle;

    // El cielo sigue su curso para que la escena no se congele.
    juego.cielo.sincronizar(juego.frameCount);
    juego.cielo.moverNubes(step, C.width);
    // Si llegó a la meta en el aire, que termine de caer (antes quedaba
    // flotando mientras entraba el castillo).
    p.aplicarFisica(step, C.height);

    // Todavía cargando castillo.webp: trota en el lugar.
    if (!castle) {
      p.animarCarrera(step);
      return;
    }

    if (!castle.settled) {
      castle.x -= juego.speed * step;
      if (castle.x <= castle.restX) {
        castle.x = castle.restX;
        castle.settled = true;
      }
      p.animarCarrera(step); // trota en el lugar mientras tanto
      return;
    }

    if (juego.winArrived) return; // esperando el timeout de terminarVictoria

    if (p.x < p.walkTargetX) {
      p.x = Math.min(p.walkTargetX, p.x + juego.moveSpeed * RC.CASTLE_WALK_SPEED_MULT * step);
      p.animarCarrera(step);
    } else {
      juego.winArrived = true;
      this.programar(() => this.terminarVictoria(), RC.WIN_APPROACH_PAUSE_MS);
    }
  }

  // Junior llegó a la puerta: cómic final + cartel de victoria, y se
  // desbloquea el Modo Infinito para siempre.
  terminarVictoria() {
    const juego = this.juego;
    juego.running = false;
    juego.sincronizarBotonPausa();
    if (juego.loop) juego.loop.stop();
    juego.servicios.pausarMusica();

    this.guardarRecord();

    const yaEstabaCompleto = juego.economia.historiaCompleta();
    juego.economia.guardarHistoriaCompleta();

    const total = juego.economia.totalCoins;
    const sub = yaEstabaCompleto
      ? ('Puntos: ' + juego.score + '  ·  Monedas totales: ' + total)
      : ('¡Modo Infinito desbloqueado!  ·  Monedas totales: ' + total);

    juego.menu.mostrarComic(RC.COMICS.final, () => {
      this.mostrarOverlay('¡Historia completada!', sub, true, true);
    });
  }

  // ─── Muerte ───
  morir() {
    const juego = this.juego;
    juego.jugador.dead = true;
    juego.running = false;
    juego.sincronizarBotonPausa();
    juego.servicios.pausarMusica();
    juego.servicios.sonidoMuerte();
    if (juego.loop) juego.loop.stop();

    this.guardarRecord();
    this.animacionMuerte();
  }

  guardarRecord() {
    const juego = this.juego;
    if (juego.score > juego.bestScore) juego.bestScore = juego.score;
    juego.servicios.guardarPuntaje(Secuencias.ID_JUEGO_PUNTAJE, juego.score);
  }

  // Recorre fall_0..fall_3 a mano (el loop ya está parado) y recién al
  // terminar muestra el Game Over, así el choque se ve como una caída.
  animacionMuerte() {
    const juego = this.juego;
    const p = juego.jugador;
    let frame = 0;
    p.animFrameName = RC.FALL_FRAMES[0];
    juego.renderer.dibujar(true);

    const step = () => {
      frame++;
      if (frame < RC.FALL_FRAMES.length) {
        p.animFrameName = RC.FALL_FRAMES[frame];
        juego.renderer.dibujar(true);
        this.programar(step, RC.FALL_FRAME_DELAY);
      } else {
        this.programar(() => {
          this.dom.best.textContent = 'Mejor: ' + juego.bestScore + ' pts';
          // Recién al perder se muestra el total histórico de monedas.
          this.mostrarOverlay('¡Game Over!', 'Puntos: ' + juego.score + '  ·  Monedas totales: ' + juego.economia.totalCoins, true);
        }, RC.FALL_HOLD_BEFORE_OVERLAY);
      }
    };
    this.programar(step, RC.FALL_FRAME_DELAY);
  }

  // ─── Cartel de fin de partida ───
  // Mini-canvas del cartel: derrota = último frame de la caída; victoria =
  // pose corriendo (no hay sprite de festejo).
  dibujarPreviewPersonaje(victory) {
    const canvas = this.dom.charPreviewCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const juniorImg = Engine2D.getImage(RC.ASSETS.junior);
    const juniorAtlas = Engine2D.getAtlas(RC.ASSETS.juniorAt);
    if (juniorImg && juniorAtlas) {
      const frameName = victory ? RC.RUN_FRAMES[0] : RC.FALL_FRAMES[RC.FALL_FRAMES.length - 1];
      const targetH = canvas.height - 4;
      ctx.imageSmoothingEnabled = true;
      Engine2D.drawAtlasFrame(ctx, juniorImg, juniorAtlas, frameName, canvas.width / 2, canvas.height - 2, targetH, false, false);
      ctx.imageSmoothingEnabled = false;
    }
  }

  mostrarOverlay(title, sub, isGameover, victory) {
    const dom = this.dom;
    dom.overlay.classList.remove('hidden');
    dom.overlayTitle.textContent = title;
    dom.overlaySub.textContent = sub;
    if (this.juego.bestScore > 0) {
      dom.best.textContent = 'Mejor: ' + this.juego.bestScore + ' pts';
    }
    if (isGameover) this.dibujarPreviewPersonaje(victory);
    if (dom.restartBtn) dom.restartBtn.style.display = isGameover ? 'inline-block' : 'none';
    if (dom.menuBtn) dom.menuBtn.style.display = isGameover ? 'inline-block' : 'none';
  }
}
