// ══════════════════════════════════════
//   Pixel Runner — runner_loop.js  (módulo ES6)
// ══════════════════════════════════════
// Clase PixelRunner: el juego en sí. Es dueña del estado de la partida
// (lo que antes era el objeto global RUNNER) y se COMPONE de las demás
// clases, cada una con una sola responsabilidad:
//
//   PixelRunner
//    ├── dom          : RunnerDOM         (caché del HTML)
//    ├── economia     : Economia          (monedas, tienda, progreso)
//    ├── renderer     : RunnerRenderer    (todo el dibujo)
//    ├── spawner      : Spawner           (genera obstáculos y pickups)
//    ├── secuencias   : Secuencias        (muerte / victoria / cartel)
//    ├── menu         : RunnerMenu        (menú y cómics)
//    ├── jugador      : Jugador
//    ├── obstacles[]  : ObstaculoSuelo / Pajaro
//    ├── pickups[]    : Moneda / PowerUp*
//    ├── cielo        : Cielo
//    ├── lluvia       : Lluvia
//    ├── loop         : Engine2D.GameLoop
//    └── input/touch  : Engine2D.KeyboardInput / TouchControls
import { RunnerConfig as RC, RunnerDOM } from './runner_config.js';
import { Jugador, Cielo, Lluvia } from './runner_entities.js';
import { Economia } from './runner_economy.js';
import { Spawner } from './runner_spawn.js';
import { Secuencias } from './runner_sequence.js';
import { RunnerRenderer } from './runner_render.js';
import { RunnerMenu } from './runner_menu_flow.js';

export class PixelRunner {
  constructor() {
    this.dom = new RunnerDOM();

    this.canvas = null;
    this.ctx = null;
    // Espacio lógico (480x270): TODO se posiciona acá, no en el canvas real.
    this.view = { width: RC.VIEW_W, height: RC.VIEW_H };
    this.renderScale = 1;
    this.calidadEnganchada = false;
    this.loop = null;
    this.input = null;
    this.touch = null;
    this.touchPrev = { left: false, right: false, jump: false, drop: false };

    // ─── Estado de la partida ───
    this.running = false;
    this.paused = false;
    this.started = false;   // false = esperando el primer input (nada se mueve)
    this.mode = 'historia'; // 'historia' (meta HISTORIA_GOAL) | 'infinito'
    this.score = 0;
    this.bestScore = 0;
    // naturalSpeed = la velocidad según el puntaje; speed = la efectiva
    // (baja con el power-up de velocidad reducida y se recupera de a poco).
    this.baseSpeed = 5;
    this.speed = 5;
    this.naturalSpeed = 5;
    this.slowSpeedFrames = 0;
    this.doublePointsFrames = 0;
    this.frameCount = 0;
    this.frameAcc = 0;
    this.obstacleTimer = 0;
    this.obstacleInterval = 90;
    this.pickupTimer = 0;
    this.pickupInterval = 130;
    this.coinsRun = 0;      // monedas de esta partida (el total vive en economia)
    this.biome = 'grass';   // 'grass' | 'desert', se deriva del score

    // Corredor de movimiento lateral
    this.corridorMinX = 20;
    this.corridorMaxX = 190;
    this.moveSpeed = 2.6;
    this.groundH = 34;
    this.skyH = 30;

    // Secuencia de victoria (null = juego normal)
    this.winCastle = null;
    this.winArrived = false;

    // ─── Composición ───
    this.jugador = new Jugador();
    this.obstacles = [];
    this.pickups = [];
    this.cielo = new Cielo();
    this.lluvia = new Lluvia(RC.VIEW_W, RC.VIEW_H, this.groundH);
    this.economia = new Economia();
    this.renderer = new RunnerRenderer(this);
    this.spawner = new Spawner(this);
    this.secuencias = new Secuencias(this);
    this.menu = new RunnerMenu(this);
  }

  // ─── Calidad gráfica ───
  // El juego siempre se programa en 480x270; la calidad solo cambia la
  // resolución REAL del canvas (Alto 1, Medio 0.85, Bajo 0.6) y un
  // ctx.scale hace que todo caiga donde corresponde.
  aplicarEscalaCanvas() {
    const C = this.canvas;
    if (!C) return;
    const s = (typeof Engine2D !== 'undefined' && Engine2D.Quality) ? Engine2D.Quality.renderScale : 1;
    this.renderScale = s;
    const w = Math.max(1, Math.round(RC.VIEW_W * s));
    const h = Math.max(1, Math.round(RC.VIEW_H * s));
    if (C.width !== w || C.height !== h) { C.width = w; C.height = h; }
    // Tocar width/height resetea el contexto: se vuelve a aplicar todo.
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.setTransform(s, 0, 0, s, 0, 0);
    }
  }

  // ─── Arranque: canvas, input y carga de sprites ───
  iniciar() {
    this.canvas = document.getElementById('runnerCanvas');

    requestAnimationFrame(() => {
      // Engine2D.getContext marca el canvas como pixel-art.
      this.ctx = Engine2D.getContext(this.canvas);
      this.aplicarEscalaCanvas();
      // Cambiar la calidad mientras se juega re-escala al toque (una sola suscripción).
      if (!this.calidadEnganchada && typeof Engine2D !== 'undefined' && Engine2D.Quality) {
        Engine2D.Quality.onChange(() => this.aplicarEscalaCanvas());
        this.calidadEnganchada = true;
      }

      const p = this.jugador;
      p.groundY = RC.VIEW_H - this.groundH - p.h;
      p.y = p.groundY;
      this.economia.totalCoins = this.economia.cargarMonedas();
      this.economia.refrescarMejoras();

      this.dom.overlay.classList.add('hidden');
      if (this.bestScore > 0) this.dom.best.textContent = 'Mejor: ' + this.bestScore + ' pts';

      this.configurarTeclado();
      this.configurarTactil();

      // castillo.webp NO va acá: se carga bajo demanda al ganar Historia.
      const A = RC.ASSETS;
      const barra = new Engine2D.LoadingBar({
        container: document.querySelector('.runner-container') || document.body,
        label: 'Cargando Pixel Runner…'
      });
      Engine2D.loadAllWithProgress([
        { type: 'image', src: A.junior }, { type: 'atlas', src: A.juniorAt },
        { type: 'image', src: A.bird }, { type: 'atlas', src: A.birdAt },
        { type: 'image', src: A.obst }, { type: 'atlas', src: A.obstAt },
        { type: 'image', src: A.mapa }, { type: 'atlas', src: A.mapaAt },
        { type: 'image', src: A.item }, { type: 'atlas', src: A.itemAt },
        { type: 'image', src: A.rainSplash }, // llueve seguido: conviene tenerla lista
      ], (loaded, total) => barra.update(loaded / total))
        .then(() => {
          barra.destroy();
          this.empezar();
        }).catch(err => {
          barra.destroy();
          console.error('No se pudieron cargar los sprites de Pixel Runner', err);
          this.empezar(); // arranca igual: el renderer tiene dibujos de respaldo
        });
    });
  }

  // ─── Input ───
  configurarTeclado() {
    if (this.input) this.input.detach();
    this.input = new Engine2D.KeyboardInput(
      {
        ArrowUp: 'jump', Space: 'jump', KeyW: 'jump',
        ArrowDown: 'drop', KeyS: 'drop',
        ArrowLeft: 'left', KeyA: 'left',
        ArrowRight: 'right', KeyD: 'right',
      },
      {
        activeCheck: () => this.dom.section.classList.contains('active'),
        preventDefaultFor: new Set(['ArrowUp', 'Space', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS']),
        onDown: (action) => {
          // Con el cartel de game over abierto, Saltar = reintentar.
          if (this.dom.overlayVisible()) {
            if (action === 'jump') this.dom.clickReintentar();
            return;
          }
          if (action === 'jump') this.saltarOEmpezar();
          if (action === 'drop') this.caidaRapida();
        },
      }
    );
    this.input.attach();
  }

  mover(dir, isDown) {
    if (!this.input) return;
    this.input.state[dir] = isDown;
  }

  // Controles táctiles dentro del canvas (solo en dispositivos táctiles).
  configurarTactil() {
    if (this.touch) this.touch.detach();
    const isTouchDevice = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
      || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    // Botones en coordenadas lógicas: siguen andando con cualquier calidad.
    this.touch = new Engine2D.TouchControls(this.canvas, {
      visible: isTouchDevice,
      logicalWidth: RC.VIEW_W,
      logicalHeight: RC.VIEW_H
    });
    this.touch.addButton({ id: 'left', x: 34, y: 232, radius: 26, label: '◀' });
    this.touch.addButton({ id: 'right', x: 94, y: 232, radius: 26, label: '▶' });
    this.touch.addButton({ id: 'jump', x: 450, y: 182, radius: 26, label: '▲' });
    this.touch.addButton({ id: 'drop', x: 450, y: 242, radius: 26, label: '▼' });
    this.touch.attach();
    this.touchPrev = { left: false, right: false, jump: false, drop: false };
  }

  // Una vez por frame: convierte el estado táctil en las mismas acciones del teclado.
  sincronizarTactil() {
    const t = this.touch;
    if (!t) return;
    const prev = this.touchPrev;

    if (t.state.left !== prev.left) { this.mover('left', t.state.left); prev.left = t.state.left; }
    if (t.state.right !== prev.right) { this.mover('right', t.state.right); prev.right = t.state.right; }

    const jumpPressed = t.state.jump && !prev.jump;
    const dropPressed = t.state.drop && !prev.drop;
    prev.jump = t.state.jump;
    prev.drop = t.state.drop;
    if (!jumpPressed && !dropPressed) return;

    if (this.dom.overlayVisible()) {
      if (jumpPressed) this.dom.clickReintentar();
      return;
    }
    if (jumpPressed) this.saltarOEmpezar();
    if (dropPressed) this.caidaRapida();
  }

  caidaRapida() {
    if (!this.running) return;
    this.started = true; // también cuenta como primer input
    const p = this.jugador;
    if (p.dead) return;
    p.caidaRapida(RC.VIEW_H);
  }

  saltarOEmpezar() {
    if (this.dom.overlayVisible()) return;
    if (!this.running) return;
    this.started = true; // primer input: arranca el juego
    const p = this.jugador;
    if (p.dead) return;
    p.saltar(RC.VIEW_H, this.lluvia.active);
  }

  // ─── Ciclo de vida ───
  empezar() {
    setMusic(RC.ASSET_BASE + 'sounds/backplay.mp3');

    this.score = 0;
    this.speed = this.baseSpeed;
    this.naturalSpeed = this.baseSpeed;
    this.slowSpeedFrames = 0;
    this.frameCount = 0;
    this.lluvia.reiniciar();
    this.actualizarHud(); // limpia los badges de una corrida anterior
    this.frameAcc = 0;
    this.obstacleTimer = 0;
    this.obstacleInterval = 90;
    this.obstacles = [];
    this.running = true;
    this.started = false;
    this.pickups = [];
    this.pickupTimer = 0;
    this.doublePointsFrames = 0;
    this.coinsRun = 0; // el total histórico NO se resetea
    this.winCastle = null;
    this.winArrived = false;

    this.jugador.reiniciar();

    // Siempre arranca en pasto y de día.
    this.biome = 'grass';
    this.cielo.t = 0;

    const dom = this.dom;
    dom.overlay.classList.add('hidden');
    dom.scoreDisplay.textContent = this.textoPuntaje(0);
    if (dom.coinsRunDisplay) dom.coinsRunDisplay.textContent = '0';
    dom.restartBtn.style.display = 'none';
    dom.menuBtn.style.display = 'none';

    if (this.loop) this.loop.stop();
    this.loop = new Engine2D.GameLoop({
      update: (dt, step) => this.update(step),
      draw: () => this.renderer.dibujar(),
    });
    this.loop.start();
    this.sincronizarBotonPausa();
  }

  detener() {
    this.running = false;
    this.paused = false;
    if (this.loop) this.loop.stop();
    if (this.input) this.input.detach();
    if (this.touch) this.touch.detach();
    this.sincronizarBotonPausa();
  }

  pausar() {
    if (!this.running || this.paused || this.jugador.dead) return;
    this.paused = true;
    if (this.loop) this.loop.stop();
  }

  reanudar() {
    if (!this.running || !this.paused || this.jugador.dead) return;
    this.paused = false;
    if (this.loop) this.loop.start();
  }

  // ─── Update por frame ───
  update(step) {
    const C = this.view;
    const p = this.jugador;
    this.sincronizarTactil();
    if (p.dead) return;

    // Esperando el primer input: nada se mueve hasta que toque algo.
    if (!this.started) {
      const s = this.input.state;
      if (s.left || s.right || s.jump || s.drop) this.started = true;
      else return;
    }

    // Secuencia de victoria en curso: reemplaza al update normal.
    if (this.winCastle) {
      this.secuencias.actualizarVictoria(step);
      return;
    }

    if (this.avanzarPuntaje(step)) return; // llegó a la meta de Historia

    if (this.doublePointsFrames > 0) this.doublePointsFrames = Math.max(0, this.doublePointsFrames - step);
    p.actualizarPowerUps(step);
    this.actualizarVelocidad(step);

    // Bioma: alterna pasto/desierto cada BIOME_SEGMENT puntos.
    this.biome = (Math.floor(this.score / RC.BIOME_SEGMENT) % 2 === 0) ? 'grass' : 'desert';

    this.lluvia.actualizarClima(this.score, step);
    this.lluvia.actualizar(step);

    p.moverLateral(step, this.input.state, this.corridorMinX, this.corridorMaxX, this.moveSpeed);
    p.aplicarFisica(step, C.height);
    p.animarCarrera(step);

    this.cielo.sincronizar(this.frameCount);
    this.cielo.moverNubes(step, C.width);

    if (this.actualizarObstaculos(step)) return; // murió
    this.actualizarPickups(step);
    this.actualizarHud();
  }

  // frameCount cuenta "frames de 60fps" acumulando step: el puntaje, el
  // ciclo día/noche y los biomas avanzan igual con cualquier FPS.
  // Devuelve true si se llegó a la meta del Modo Historia.
  avanzarPuntaje(step) {
    this.frameAcc = (this.frameAcc || 0) + step;
    let scoreChanged = false;
    while (this.frameAcc >= 1) {
      this.frameAcc -= 1;
      this.frameCount++;
      if (this.frameCount % 6 !== 0) continue;
      this.score += this.doublePointsFrames > 0 ? this.economia.multiplicadorPuntos() : 1;
      scoreChanged = true;
      if (this.mode === 'historia' && this.score >= RC.HISTORIA_GOAL) {
        this.score = RC.HISTORIA_GOAL; // no pasarse de la meta en el HUD
        this.dom.scoreDisplay.textContent = this.textoPuntaje(this.score);
        this.secuencias.iniciarVictoria();
        return true;
      }
      if (this.score % 250 === 0) {
        // naturalSpeed: si hay velocidad reducida activa, el aumento se nota al terminar.
        this.naturalSpeed += 0.8;
        this.obstacleInterval = Math.max(45, this.obstacleInterval - 5);
      }
    }
    if (scoreChanged) this.dom.scoreDisplay.textContent = this.textoPuntaje(this.score);
    return false;
  }

  // Con "velocidad reducida" queda en un % de naturalSpeed; al terminar,
  // sube de a poco hasta volver a empatar.
  actualizarVelocidad(step) {
    if (this.slowSpeedFrames > 0) {
      this.slowSpeedFrames = Math.max(0, this.slowSpeedFrames - step);
      this.speed = this.naturalSpeed * this.economia.factorVelocidadReducida();
    } else if (this.speed < this.naturalSpeed) {
      this.speed = Math.min(this.naturalSpeed, this.speed + RC.SLOWSPEED_RECOVER_STEP * this.naturalSpeed * step);
    } else {
      this.speed = this.naturalSpeed;
    }
  }

  // Spawn + mover + colisionar. Devuelve true si el jugador murió.
  actualizarObstaculos(step) {
    const p = this.jugador;
    this.obstacleTimer += step;
    if (this.obstacleTimer >= this.obstacleInterval) {
      this.obstacleTimer = 0;
      this.spawner.generarObstaculo();
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.mover(step, this.speed);
      if (o.fueraDePantalla()) { this.obstacles.splice(i, 1); continue; }
      if (!o.golpea(p)) continue;

      if (p.absorberGolpe()) {
        this.obstacles.splice(i, 1);
        continue;
      }
      // Duelo de Pixel Runner en curso (lo pone app2.js): se captura el
      // puntaje en el momento exacto de morir.
      const duelo = window.dueloActivo && window.dueloActivo.juego === 'runner' ? window.dueloActivo : null;
      const scoreFinalDuelo = this.score;
      this.secuencias.morir();
      if (duelo && typeof window.finalizarDueloConPuntaje === 'function') {
        window.finalizarDueloConPuntaje(duelo.id, scoreFinalDuelo);
      }
      return true;
    }
    return false;
  }

  actualizarPickups(step) {
    const p = this.jugador;
    this.pickupTimer += step;
    if (this.pickupTimer >= this.pickupInterval) {
      this.pickupTimer = 0;
      if (Math.random() < RC.POWERUP_CHANCE) this.spawner.generarPowerUp();
      else this.spawner.generarGrupoMonedas();
    }

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const o = this.pickups[i];
      o.mover(step, this.speed);
      if (o.fueraDePantalla()) { this.pickups.splice(i, 1); continue; }
      if (o.tocaA(p)) {
        o.recolectar(this); // polimorfismo: cada pickup sabe qué efecto da
        this.pickups.splice(i, 1);
      }
    }
  }

  // ─── HUD (HTML, fuera del canvas) ───
  textoPuntaje(score) {
    return this.mode === 'historia' ? (score + ' / ' + RC.HISTORIA_GOAL) : String(score);
  }

  // El botón de pausa se ve SOLO mientras hay una partida en curso.
  sincronizarBotonPausa() {
    const btn = this.dom.pauseBtn;
    if (btn) btn.classList.toggle('hidden', !this.running);
  }

  // Multiplicador de puntos y power-ups activos, recalculado cada frame.
  actualizarHud() {
    const p = this.jugador;

    const mEl = this.dom.multiplierDisplay;
    if (mEl) {
      if (this.doublePointsFrames > 0) {
        mEl.textContent = 'x' + this.economia.multiplicadorPuntos();
        mEl.classList.remove('hidden');
      } else {
        mEl.classList.add('hidden');
      }
    }

    const pEl = this.dom.activePowerupDisplay;
    if (pEl) {
      const badges = [];
      if (p.shield) badges.push('<span class="runner-hud-icon runner-hud-icon-shield" title="Escudo"></span>');
      if (p.slowFallFrames > 0) badges.push('<span class="runner-hud-icon runner-hud-icon-slowfall" title="Caída lenta"></span>');
      if (this.slowSpeedFrames > 0) badges.push('<span class="runner-hud-icon runner-hud-icon-slowspeed" title="Velocidad reducida"></span>');
      if (badges.length) {
        pEl.innerHTML = badges.join('');
        pEl.classList.remove('hidden');
      } else {
        pEl.classList.add('hidden');
        pEl.innerHTML = '';
      }
    }
  }
}
