// ══════════════════════════════════════
//   Castle Escape — castle_loop.js  (módulo ES6)
// ══════════════════════════════════════

import { CastleConfig as C, CastleDOM } from './castle_config.js';
import { Jugador, Plataforma, Peligro, Flecha, Explosiones } from './castle_entities.js';
import { Progreso } from './castle_progress.js';
import { CastleRenderer } from './castle_render.js';
import { CastleMenu } from './castle_menu_flow.js';
import { SecuenciasNivel } from './castle_sequence.js';

export class CastleEscape {
  // servicios: ServiciosApp (../servicios_app.js) — música, volumen,
  // puntajes, duelos y navegación del sitio. Se recibe por constructor
  // (inyección de dependencias): el juego no toca globals de app2.js.
  constructor(servicios) {
    this.servicios = servicios;
    this.dom = new CastleDOM();
    this.levels = C.cargarNiveles();

    // ─── Estado de la partida ───
    this.canvas = null;
    this.ctx = null;
    this.running = false;
    this.levelIndex = 0;
    this.totalDeaths = 0;
    // ms de juego en el nivel actual: se suma en update(), así la pausa y
    // los menús no cuentan para la estrella de tiempo.
    this.tiempoNivelMs = 0;
    this.levelDeaths = 0;
    // Índice del nivel cuya capa estática está horneada (ver cargarNivel).
    this.nivelHorneado = null;
    this.floorY = 0;
    this.selectedLevel = 0;
    // true recién cuando terminaron de cargar sprites/atlas (ver iniciar)
    this.assetsReady = false;

    // ─── Contenido del nivel actual (instancias de castle_entities.js) ───
    this.jugador = new Jugador();
    this.platforms = [];
    this.hazards = [];
    this.arrows = [];
    this.explosiones = new Explosiones();

    // Cámara + tamaño del nivel en world-space. Si el nivel es más grande que
    // la vista la cámara sigue al jugador; si cabe entero, queda en (0,0).
    this.camera = { x: 0, y: 0 };
    this.levelW = C.W;
    this.levelH = C.H;
    // Campo de visión del nivel (definido en el editor). 1 = vista normal,
    // >1 = la cámara se aleja, <1 = zoom in.
    this.fov = 1;
    // Capa horneada con lo que no cambia durante el nivel (Engine2D.StaticLayer)
    this.staticLayer = null;

    this.keys = { left: false, right: false, jump: false };
    this.touch = null;
    this.touchPrev = { left: false, right: false, jump: false };

    // ─── Composición ───
    // Estrellas por usuario (ver ServiciosApp.claveUsuario).
    this.progreso = new Progreso(undefined, (base) => this.servicios.claveUsuario(base));
    this.renderer = new CastleRenderer(this);
    this.menu = new CastleMenu(this);
    this.secuencias = new SecuenciasNivel(this);

    this.loop = new Engine2D.GameLoop({
      update: (dt, step) => this.update(step),
      draw: () => this.renderer.dibujar()
    });

    this.input = new Engine2D.KeyboardInput(
      { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump' },
      {
        activeCheck: () => this.dom.section.classList.contains('active'),
        preventDefaultFor: new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space']),
        onDown: (action) => {
          // Con el overlay visible, Espacio equivale a tocar el botón en vez de saltar.
          if (this.dom.overlayVisible()) {
            if (action === 'jump') this.dom.startBtn?.click();
            return;
          }
          if (action === 'left') this.keys.left = true;
          if (action === 'right') this.keys.right = true;
          if (action === 'jump') this.saltar();
        },
        onUp: (action) => {
          if (action === 'left') this.keys.left = false;
          if (action === 'right') this.keys.right = false;
        }
      }
    );
  }

  get nivelActual() {
    return this.levels[this.levelIndex];
  }

  // ─── Arranque (al entrar a la sección del juego) ───
  iniciar() {
    this.canvas = this.dom.canvas;
    this.canvas.width = C.W;
    this.canvas.height = C.H;
    this.ctx = this.canvas.getContext('2d');

    // Barra de carga con progreso real: no se deja jugar hasta el 100%.
    // Las texturas nuevas (bloques/obstáculos) también se esperan, porque
    // cargarNivel() hornea la capa estática una sola vez.
    this.assetsReady = false;
    const barra = new Engine2D.LoadingBar({
      container: this.dom.container || document.body,
      label: 'Cargando Castle Escape…'
    });
    Promise.all([
      Engine2D.loadAllWithProgress(C.ASSETS, (loaded, total) => barra.update(loaded / total)),
      this.renderer.resolverTexturasNuevas(),
    ]).then(() => {
      this.assetsReady = true;
      barra.destroy();
    }).catch(err => {
      console.error('Castle Escape: no se pudieron cargar los sprites', err);
      // No trabar el juego entero por un solo asset que falló.
      this.assetsReady = true;
      barra.destroy();
    });

    this.menu.crearPuntosNiveles();
    this.selectedLevel = 0;
    this.menu.mostrarMenuPrincipal();
    this.configurarEventos();
  }

  configurarEventos() {
    this.input.attach();
    this.menu.engancharEnter();
    this.configurarTactil();
  }

  configurarTactil() {
    if (this.touch) this.touch.detach();
    const isTouchDevice = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
      || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.touch = new Engine2D.TouchControls(this.canvas, { visible: isTouchDevice });
    this.touch.addButton({ id: 'left', x: 40, y: 230, radius: 24, label: '◀' });
    this.touch.addButton({ id: 'right', x: 100, y: 230, radius: 24, label: '▶' });
    this.touch.addButton({ id: 'jump', x: 430, y: 230, radius: 30, label: '↑' });
    this.touch.attach();
    this.touchPrev = { left: false, right: false, jump: false };
  }

  sincronizarTactil() {
    const t = this.touch;
    if (!t) return;
    const prev = this.touchPrev;

    if (t.state.left !== prev.left) { this.keys.left = t.state.left; prev.left = t.state.left; }
    if (t.state.right !== prev.right) { this.keys.right = t.state.right; prev.right = t.state.right; }

    const jumpPressed = t.state.jump && !prev.jump;
    prev.jump = t.state.jump;

    this.keys.jump = t.state.jump;
    if (jumpPressed) this.saltar();
  }

  // ─── Ciclo de vida de un nivel ───
  empezarNivel(i) {
    if (!this.levels.length || !this.levels[i]) return;
    this.levelIndex = i;
    this.totalDeaths = 0;
    this.tiempoNivelMs = 0;
    this.levelDeaths = 0;
    this.explosiones.limpiar();
    this.cargarNivel(i);
    this.menu.mostrarPantallaJuego();
    this.dom.pauseMenu.classList.add('hidden');
    this.dom.controlsSign.classList.add('hidden');
    this.secuencias.mostrarOverlay(this.levels[i].nombre, this.levels[i].hint, false);
    this.dom.hudDeaths.textContent = 'Muertes: 0';
    this.configurarEventos();
    this.renderer.dibujar();
  }

  cargarNivel(index) {
    const lvl = this.levels[index];
    if (!lvl) return;
    // Todo opcional menos las plataformas: un nivel recién creado en el
    // editor puede venir sin hazards/arrows/decor.
    if (!lvl.platforms) lvl.platforms = [];
    if (!lvl.hazards) lvl.hazards = [];
    if (!lvl.arrows) lvl.arrows = [];
    if (!lvl.decor) lvl.decor = [];
    if (!lvl.exit) lvl.exit = { x: (lvl.width || C.W) - 50, y: 200, w: 26, h: 40 };
    if (!lvl.start) lvl.start = { x: 20, y: 200 };

    // Cada definición del editor pasa a ser una instancia de su clase
    this.platforms = lvl.platforms.map(def => Plataforma.desde(def));
    this.hazards = lvl.hazards.map(def => Peligro.desde(def));
    this.arrows = lvl.arrows.map(def => new Flecha(def));

    this.levelW = lvl.width || C.W;
    this.levelH = lvl.height || C.H;
    this.fov = lvl.fov || 1;
    this.camera.x = 0;
    this.camera.y = 0;

    // Las paredes verticales no cuentan como "piso" para la altura del suelo.
    const floorCandidates = lvl.platforms.filter(p => (p.type === 'normal' && !p.vertical) || p.type === 'fake');
    const floorSet = floorCandidates.length ? floorCandidates : lvl.platforms;
    this.floorY = floorSet.length ? Math.max(...floorSet.map(p => p.y)) : this.levelH;

    // Capa estática: piso/paredes fijas + pinchos de pozo, pre-pintados UNA
    // sola vez en vez de en cada frame. El orden pincho-antes-que-plataforma
    // hace falta para el truco de "piso falso con pinchos escondidos".
    // Se hornea una vez por nivel: al morir se recarga el MISMO nivel y lo
    // estático (piso, paredes, pinchos) no cambió, así que se reusa.
    if (this.nivelHorneado !== index || !this.staticLayer) {
      this.nivelHorneado = index;
      this.staticLayer = new Engine2D.StaticLayer(this.levelW, this.levelH);
      this.staticLayer.bake(bctx => {
        for (const hz of this.hazards) {
          if (hz.type === 'spike') this.renderer.dibujarPinchos(bctx, hz.x, hz.y, hz.w, hz.h, hz);
        }
        for (const plat of this.platforms) {
          if (!plat.esEstatica()) continue;
          this.renderer.dibujarPlataforma(bctx, plat);
          if (plat.decor === 'spike') this.renderer.dibujarPinchos(bctx, plat.x, plat.y - 20, plat.w, 20);
        }
      });
    }

    this.jugador.reiniciar(lvl.start);

    if (this.dom.hudStars) this.dom.hudStars.textContent = (index + 1) + '/' + this.levels.length + ' - ' + lvl.nombre;

    const cont = this.dom.container;
    if (cont) cont.style.background = `#150620 url('${C.ASSET_BASE}models/back.webp') center/cover no-repeat`;
  }

  // ★ completar · ★★ además en tiempo · ★★★ además con pocas muertes.
  // Acumulativas: antes la tercera solo miraba las muertes, así que se
  // podían sacar 3 estrellas tardando el triple del tiempo límite.
  calcularEstrellas() {
    const elapsed = this.tiempoNivelMs / 1000;
    const timeLimit = C.TIME_LIMITS[this.levelIndex] || 60;
    const deathLimit = C.DEATH_LIMITS[this.levelIndex] || 5;
    let stars = 1;
    if (elapsed <= timeLimit) {
      stars = 2;
      if (this.levelDeaths <= deathLimit) stars = 3;
    }
    return stars;
  }

  empezar() {
    this.dom.overlay.classList.add('hidden');
    this.tiempoNivelMs = 0;
    this.levelDeaths = 0;
    this.running = true;
    this.loop.start();
    if (this.touch) this.touch.attach();
    this.ponerMusica('backsong.mp3');
  }

  detener() {
    this.running = false;
    this.loop.stop();
    // Si se sale durante la animación de muerte, que el nivel no se
    // recargue después (pisaba el fondo del menú con el del castillo).
    this.secuencias.cancelarTimers();
    this.input.detach();
    if (this.touch) this.touch.detach();
    this.keys.left = false;
    this.keys.right = false;
    this.keys.jump = false;
    this.menu.soltarEnter();
  }

  pausar() {
    if (!this.running) return;
    this.running = false;
    this.loop.stop();
    this.dom.pauseMenu.classList.remove('hidden');
  }

  reanudar() {
    this.dom.pauseMenu.classList.add('hidden');
    this.running = true;
    this.loop.start();
  }

  salirANiveles() {
    this.dom.pauseMenu.classList.add('hidden');
    this.detener();
    this.ponerMusica('menu_song.mp3');
    this.menu.mostrarSeleccionNivel();
  }

  saltar() {
    if (!this.running) return;
    this.jugador.saltar();
  }

  // ─── Audio (a través de los servicios del sitio) ───
  ponerMusica(nombre) {
    this.servicios.ponerMusica(C.ASSET_BASE + 'sounds/' + nombre);
  }

  alternarMusica() {
    this.servicios.alternarSilencioMusica();
  }

  // ─── Update por frame ───
  // step: "frames de 60fps" que da Engine2D.GameLoop (≈1 a 60fps).
  update(step) {
    this.sincronizarTactil();
    const p = this.jugador;
    if (p.dead) return;
    this.tiempoNivelMs += step * C.MS_POR_STEP;

    // Plataformas móviles y sierras (polimorfismo: cada una sabe si se mueve)
    for (const plat of this.platforms) plat.actualizar(step, p);
    for (const hz of this.hazards) hz.actualizar(step);

    p.moverHorizontal(step, this.keys, this.levelW, this.platforms);
    p.animar(step);
    p.aplicarGravedad(step, this.platforms);

    // Derrumbe de plataformas 'crumble' 400ms después de pisarlas
    for (const plat of this.platforms) plat.actualizarDerrumbe(step);

    // Salto continuo táctil: con el botón mantenido, salta apenas aterriza.
    if (this.keys.jump && p.onGround) p.saltar();

    // Flechas: primero ver si alguna se dispara, después moverlas
    for (const a of this.arrows) a.intentarDisparar(p);
    for (const a of this.arrows) {
      if (!a.active) continue;
      a.actualizar(step, this.levelW, this.levelH);
      if (p.colisionaCon(a)) { this.secuencias.morirJugador(); return; }
    }

    // Peligros: estáticos (pinchos, estrella) y móviles (sierra)
    for (const hz of this.hazards) {
      if (!hz.esLetal()) continue;
      if (p.colisionaCon(hz)) { this.secuencias.morirJugador(); return; }
    }

    // Caerse del mapa
    if (p.y > this.levelH + 20) { this.secuencias.morirJugador(); return; }

    this.actualizarCamara();

    // Llegar a la salida
    if (p.colisionaCon(this.nivelActual.exit)) this.secuencias.completarNivel();
  }

  // La cámara sigue al jugador y se recorta al tamaño del nivel. El área
  // visible se escala según el fov (ver CastleRenderer.dibujar).
  actualizarCamara() {
    const p = this.jugador;
    const cam = this.camera;
    const fov = this.fov || 1;
    const viewW = C.W * fov, viewH = C.H * fov;
    const maxX = Math.max(0, this.levelW - viewW);
    const maxY = Math.max(0, this.levelH - viewH);
    cam.x = Math.max(0, Math.min(maxX, p.x + p.w / 2 - viewW / 2));
    cam.y = Math.max(0, Math.min(maxY, p.y + p.h / 2 - viewH / 2));
  }
}
