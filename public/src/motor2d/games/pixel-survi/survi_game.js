// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_game.js
//   El juego en sí: loop, jugador (sprite del personaje), vida + daño de
//   caída, picado progresivo con herramientas, colocar bloques,
//   inventario, enemigos y muerte.
//   Se apoya en Engine2D (script clásico global) y en los módulos de
//   config / mundo / guardado / sprites / UI.
// ══════════════════════════════════════════════════════════════

import { SpritesSurvi } from './models/sprites-survi.js';
import { SurviConfig } from './survi_config.js';
import { Jugador, Enemigo, Animal, Ave, Flecha, ItemSuelto, Boya, TntEncendida } from './survi_entidades.js';
import { Clima } from './survi_clima.js';
import { SonidoSurvi } from './survi_sonido.js';
import { Particulas, Llamas } from './survi_particulas.js';
import { Cielo } from './survi_cielo.js';
import { Desgaste } from './survi_durabilidad.js';
import { CapaFluidos } from './survi_fluidos.js';
import { Iconos } from './survi_icons.js';
import { LightMap } from './survi_light.js';
import { MapaMundo, VistaMapa } from './survi_mapa.js';
import { TilesetProcedural } from './survi_proc_tiles.js';
import { GestorGuardado } from './survi_save.js';
import { GeneradorMundo } from './survi_world.js';

export class SurviGame {
  static E2D = () => (typeof Engine2D !== 'undefined' ? Engine2D : undefined);
  // ─── Zoom: tecla Z, 3 modos (Normal → Cerca → Lejos → Normal…) ───
  // Niveles fijos (no continuo) para que el pixel art no quede con escalas
  // raras. <1 = alejar (ves más mundo), >1 = acercar. El modo se recuerda
  // entre partidas en localStorage.
  static ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  // nivel = índice en ZOOM_LEVELS. dir: si ese nivel no da pixeles enteros
  // con la calidad actual, hacia dónde buscar otro (Lejos siempre < 1,
  // Cerca siempre > 1, así los 3 modos nunca quedan iguales).
  static ZOOM_MODOS = [
    { nombre: 'Lejos', nivel: 1, dir: -1 },
    { nombre: 'Normal', nivel: 2, dir: 0 },
    { nombre: 'Cerca', nivel: 4, dir: 1 },
  ];
  static ZOOM_CICLO = [1, 2, 0]; // orden al apretar Z: Normal → Cerca → Lejos
  static ZOOM_MODO_DEFAULT = 1;
  static ZOOM_KEY = 'juefriv.survi.zoomModo';
  // El canvas se dibuja a RENDER_SCALE veces la resolución lógica (480x288).
  // Con 4, todos los niveles de ZOOM_LEVELS dan un tamaño de pixel ENTERO
  // en pantalla (0.75→3, 1→4, 1.25→5, 1.5→6, 2→8): el pixel art queda
  // parejo y el scroll se mueve en pasos chicos (suave), no de a 1 pixel
  // de mundo. Si se cambian los niveles, RENDER_SCALE * zoom tiene que
  // seguir dando entero.
  static RENDER_SCALE = 4; // (nivel Alto — ver RENDER_BY_QUALITY)
  // Optimización por nivel gráfico (Engine2D.Quality): menos resolución
  // interna y luz recalculada más espaciado. Con 2 se dibujan 4 veces
  // menos pixeles que con 4; con 1, 16 veces menos.
  static RENDER_BY_QUALITY = {
    high: 4,
    medium: 2,
    low: 1,
  };
  static LIGHT_EVERY_BY_QUALITY = {
    high: 1,
    medium: 2,
    low: 3,
  }; // cada cuántos frames
  // Cámara: sigue al personaje en X siempre. En Y se "ancla" a la altura
  // del piso donde está parado, así saltar no la mueve; si cae por debajo
  // del ancla la sigue al toque, y si sube muy alto (más de esta fracción
  // de la vista) también, para que nunca se salga de pantalla.
  static CAM_MAX_ABOVE_ANCHOR = 0.32;
  // Golpe estilo Terraria: el brazo (sprite aparte) gira ~180° desde arriba
  // hacia adelante, hacia el lado que mira el personaje, con el ítem en la mano.
  static SWING_MINE_MS = 260; // cada golpe de picado (se repite mientras mantenés el clic)
  static SWING_ATTACK_MS = 200; // golpe de ataque
  static SWING_FROM = -Math.PI - 0.25; // brazo apuntando arriba (un poco para atrás)
  static SWING_TO = -0.15; // brazo abajo, un poco adelante
  // ui: SurviUI (DOM del juego) · guardado: GestorGuardado (localStorage).
  // Se reciben por constructor (inyección de dependencias): el juego no
  // arma su propia UI ni sabe en qué claves se guarda.
  // Preferencia del jugador (vale para todos los mundos): salto automático.
  static PREF_AUTOSALTO = 'juefriv.survi.autosalto';
  #autoSalto = true;

  get autoSalto() {
    return this.#autoSalto;
  }

  set autoSalto(activo) {
    this.#autoSalto = !!activo;
    try {
      localStorage.setItem(SurviGame.PREF_AUTOSALTO, this.#autoSalto ? '1' : '0');
    } catch {
      /* localStorage bloqueado: vale solo para esta sesión */
    }
  }

  // movil: celular / tablet (joysticks). La pantalla completa es opcional (Ajustes).
  constructor(ui, guardado, { movil = false } = {}) {
    this.tactil = movil;
    // Ancho de la vista en px de mundo: 480 en PC; en celular se ensancha
    // según la pantalla (ver _fit), así no quedan franjas negras.
    this.vistaW = SurviConfig.VIEW_W;
    // Mira táctil: desplazamiento desde el centro del personaje (px de
    // mundo), dentro del círculo de alcance (el mismo que en PC). null en PC.
    this._miraOffset = movil ? { x: SurviConfig.TILE * 1.5, y: 0 } : null;
    this._colocandoTactil = false;
    try {
      this.#autoSalto = localStorage.getItem(SurviGame.PREF_AUTOSALTO) !== '0'; // activado por defecto
    } catch {
      this.#autoSalto = true;
    }
    this.ui = ui;
    this.guardado = guardado;
    this.canvas = ui.canvas;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false; // pixel art: nada de blur

    let modo = SurviGame.ZOOM_MODO_DEFAULT;
    try {
      const saved = localStorage.getItem(SurviGame.ZOOM_KEY);
      if (saved !== null && SurviGame.ZOOM_MODOS[Number(saved)]) modo = Number(saved);
    } catch {}
    this._zoomModo = modo;
    this._zoomIdx = SurviGame.ZOOM_MODOS[modo].nivel;
    this._zoom = SurviGame.ZOOM_LEVELS[this._zoomIdx];
    this._lightDirty = true;
    this._lightFrame = 0;
    this._readQuality();
    const Q = SurviGame.E2D() && SurviGame.E2D().Quality;
    if (Q && Q.onChange)
      Q.onChange(() => {
        this._readQuality();
        this._fit();
      });
    this.running = false;
    this.paused = false;
    this.invOpen = false;
    this.dead = false;
    this.slot = 1;
    this.modo = 'supervivencia'; // 'supervivencia' | 'creativo'
    this.dificultad = 'normal'; // facil | normal | dificil | hardcore
    this.nombre = 'Mundo 1';
    this.espectador = false; // atravesás todo, ves todo iluminado, nadie te ve
    this.volando = false; // creativo / espectador
    this.durmiendo = null; // { col, row } de la cama donde estás acostado
    this.lunaSangre = false; // esta noche es luna de sangre
    this._eraNoche = false;
    this._saltoPrev = false; // para detectar cada vez que se APRIETA saltar
    this._ultimoSaltoMs = -1e9; // (doble salto = volar, en creativo)
    this.muertoHardcore = false; // hardcore que ya murió: espectador para siempre
    this.playedMs = 0;
    this.reachPx = SurviConfig.REACH_TILES * SurviConfig.TILE;
    this.hp = this.maxHp;
    this.hunger = SurviConfig.MAX_HUNGER;
    this._starveTimer = 0;
    this._regenTimer = 0;
    this._lastHungerShown = -1;
    this._hitFlashMs = 0;
    this.enemies = [];
    this.sueltos = []; // ítems tirados en el suelo
    this.boya = null; // pesca: la boya tirada (o null)
    this.sonido = new SonidoSurvi(); // efectos generados por código (sin archivos)
    this.cultivos = new Map(); // "col,row" → { tipo, ms }
    this._cultivoMs = 0;
    this._gotas = []; // salpicaduras de la pesca
    this.particulas = new Particulas(this); // pedacitos, gotas, brasas, humo
    this.cielo = null; // sol, luna, nubes y color del cielo (se crea con el mundo)
    this._cieloT = 0;
    this._avisoLlenoMs = 0;
    this.animals = [];
    this.pointer = {
      down: false,
      button: 0,
    };
    this.touchState = {
      left: false,
      right: false,
      jump: false,
    };
    this._mine = {
      col: -1,
      row: -1,
      progress: 0,
    };
    this._hoverTile = null;
    this._fallFromY = null;
    this._attackCd = 0;
    this._placeCd = 0;
    this._attackAnim = 0;
    this._swing = {
      t: 0,
      dur: 0,
    }; // activo mientras t < dur
    // Golpe en curso: pega a cada criatura UNA vez por animación (a varias
    // distintas sí). null cuando no hay golpe.
    this._golpe = null;
    // Arco: flechas en vuelo (o clavadas) y la espera entre tiros.
    this.flechas = [];
    this.tnts = []; // TNT prendidas (a punto de explotar)
    this._arcoCd = 0;
    this._avisoFlechasMs = 0;
    this._pointerWorld = null; // dónde apunta el mouse, en px de mundo
    // Durabilidad (ver survi_durabilidad.js): inventario, equipo puesto y cofres.
    this.desgaste = new Desgaste();
    this.desgasteEquipo = new Desgaste();
    this.desgasteCofres = {}; // "col,row" → Desgaste
    // Agua y lava (ver survi_fluidos.js) y lo que le hacen al jugador.
    this.fluidos = new CapaFluidos();
    this._enFluido = { agua: false, lava: false, cabeza: 0 };
    this.aireMs = SurviConfig.AIRE_MAX_MS;
    this.quemaduraMs = 0;
    this._lavaMs = 0;
    this._quemTick = 0;
    this._ahogoMs = 0;
    this.invulnMs = 0;
    this._anim = {
      t: 0,
      i: 0,
    };
    this.onDeath = null;
    this._bindCanvas();
    this._bindHudButtons();
  }

  // Los botones ⏸ e "I" del HUD no tenían data-act ni listener propio —
  // el delegado de clicks de survi_main.js solo escucha [data-act], así
  // que tocarlos no hacía nada. Acá replican exactamente lo mismo que
  // Esc / I en _attachInput().
  _bindHudButtons() {
    this.ui.pauseBtn.addEventListener('click', () => {
      if (!this.running || this.dead) return;
      if (this.mapaOpen) this.toggleMapa(false);
      else if (this.invOpen) this.toggleInventory(false);
      else this.setPaused(!this.paused);
    });
    this.ui.invBtn.addEventListener('click', () => {
      if (!this.running || this.dead || this.paused || this.mapaOpen) return;
      this.toggleInventory();
    });
    // Mapa: botón del HUD, la X de su pantalla y la vista (zoom / arrastrar)
    this.vistaMapa = new VistaMapa(this.ui);
    this.ui.mapaBtn.addEventListener('click', () => this.toggleMapa());
    this.ui.mapaCerrar.addEventListener('click', () => this.toggleMapa(false));
  }

  // ═══════════ Arranque / parada ═══════════
  async start({ slot, save = null, nombre = null, modo = 'supervivencia', dificultad = 'normal' }) {
    this.stop();
    this.slot = slot;
    this.nombre = nombre || `Mundo ${slot}`;
    this.modo = modo === 'creativo' ? 'creativo' : 'supervivencia';
    this.dificultad = SurviConfig.DIFICULTADES[dificultad] ? dificultad : 'normal';
    this.muertoHardcore = !!(save && save.muerto);
    this.espectador = this.muertoHardcore || !!(save && save.espectador && this.modo === 'creativo');
    this.volando = this.espectador || !!(save && save.volando && this.modo === 'creativo');
    this.playedMs = save ? save.playedMs || 0 : 0;
    this.dead = false;
    this.paused = false;
    this.invOpen = false;
    const seed = save ? save.seed : Date.now();
    // El mundo se regenera SIEMPRE desde el seed (biomas y alturas salen
    // de ahí y no se guardan). Los tiles, si hay partida, vienen del save.
    this.world = new GeneradorMundo(seed).generar();
    this.seed = seed;
    this.spawn = GeneradorMundo.elegirSpawn(this.world, Math.random);
    this._spawnMundo = this.spawn; // el de siempre (si rompés la cama, se vuelve a este)
    // Todos los PNG de una: personaje, herramientas y grietas.
    // Si alguno falla igual se arranca: mejor el juego sin una textura que
    // la pantalla trabada esperando un PNG que no está.
    //
    // OJO: antes esto usaba E2D().loadAll(), que por dentro hace
    // Promise.all — si UNA sola imagen fallaba, la promesa general
    // rechazaba al toque sin esperar a que las demás terminaran de cargar.
    // Podíamos terminar acá leyendo con getImage() una imagen que todavía
    // estaba a mitad de descargar (ni lista ni descartada del caché
    // todavía); un instante después esa misma imagen fallaba de verdad y
    // quedaba en estado "broken" — y el primer drawImage() con esa
    // referencia tiraba InvalidStateError. Promise.allSettled() espera a
    // que TODAS terminen (bien o mal) antes de seguir.
    await Promise.allSettled(SpritesSurvi.PRELOAD.map((src) => SurviGame.E2D().loadImage(src)));
    // Nos quedamos solo con imágenes realmente usables: si getImage() no
    // tiene nada (falló y Engine2D la sacó del caché) o todavía no está
    // decodificada, mejor null que arrastrar un HTMLImageElement roto
    // hasta el draw() — drawSprite()/drawImage() ya saben saltearse un
    // null, pero no una imagen "broken".
    const readyImg = (src) => {
      const img = SurviGame.E2D().getImage(src);
      return img && img.complete && img.naturalWidth > 0 ? img : null;
    };
    this.img = {
      tiles: null,
      // se completa abajo con el tileset generado por código
      player: readyImg(SpritesSurvi.ASSETS.player),
      cracks: readyImg(SpritesSurvi.ASSETS.cracks),
      items: readyImg(SpritesSurvi.ASSETS.items),
    };
    if (!this.img.player) {
      console.warn(
        '[pixel-survi] el sprite del personaje no cargó — revisá las rutas de ASSETS/BASE en models/sprites-survi.js',
      );
    }
    // Tileset 100% por código (ver survi_proc_tiles.js) — ya no existe
    // tiles.png. Se registra bajo TILESET.src para que el TileMap lo
    // dibuje con drawImage como siempre, y como data URL para los íconos
    // DOM del hotbar/inventario (tileIconStyle usa background-image).
    if (!this._tilesetCanvas) {
      this._tilesetCanvas = new TilesetProcedural(SurviConfig.TILESET_COLS, SurviConfig.TILE).construir();
      SpritesSurvi.setTilesetUrl(this._tilesetCanvas.toDataURL());
    }
    this.img.tiles = this._tilesetCanvas;
    SurviGame.E2D().setImage(SpritesSurvi.TILESET.src, this._tilesetCanvas);
    this.tilemap = new (SurviGame.E2D().TileMap)({
      cols: SurviConfig.COLS,
      rows: SurviConfig.ROWS,
      tileSize: SurviConfig.TILE,
      tilesetSrc: SpritesSurvi.TILESET.src,
      tilesetCols: SurviConfig.TILESET_COLS,
      solidIds: SurviConfig.SOLID_IDS,
      data: save ? Uint16Array.from(save.tiles) : this.world.data,
    });
    this.player = new Jugador(save ? save.px : this.spawn.x, save ? save.py : this.spawn.y);
    // corazones de vida usados (cada uno suma vida máxima para siempre)
    this.corazones = save && Number.isFinite(save.corazones) ? Math.max(0, Math.min(SurviConfig.CORAZON_VIDA.max, save.corazones)) : 0;
    this.hp = save && save.hp ? Math.min(this.maxHp, save.hp) : this.maxHp;
    this.hunger = save && save.hunger != null ? Math.min(SurviConfig.MAX_HUNGER, save.hunger) : SurviConfig.MAX_HUNGER;
    this.timeOfDay = save && save.timeOfDay != null ? save.timeOfDay : SurviConfig.START_TIME_OF_DAY;
    // hornos y cofres colocados: estado por posición "col,row"
    const st = (save && save.stations) || {};
    this.furnaces = st.furnaces || {};
    // Mundo nuevo: los cofres de las minas vienen con su botín desde el generador.
    this.chests = save ? st.chests || {} : { ...(this.world.cofres || {}) };
    this.station = null; // estación abierta: { type: 'furnace'|'chest', key }
    this.craftStation = 'hand'; // 'hand' (inventario) o 'table' (mesa de crafteo)
    this._stationUiT = 0;
    this.light = new LightMap();
    this.light.margen = this.quality === 'low' ? 7 : LightMap.MARGIN;
    this.light.rebuildSky((c, r) => this.tilemap.get(c, r));
    // Mapa: lo ya explorado (un mundo de antes arranca en negro)
    this.mapa = MapaMundo.desde(save && save.explorado);
    this.mapaOpen = false;
    this._mapaFrame = 0;
    this._starveTimer = 0;
    this._regenTimer = 0;
    this._lastHungerShown = -1;
    this._hitFlashMs = 0;
    this.inventory = save ? save.inventory || {} : {};
    this.hotbarSlots = save
      ? save.hotbarSlots || new Array(SurviConfig.HOTBAR_SIZE).fill(null)
      : new Array(SurviConfig.HOTBAR_SIZE).fill(null);
    this.selectedSlot = save ? save.selectedSlot || 0 : 0;
    // { ...emptyEquipment(), ...save.equipment }: si el save es de antes de
    // que existiera este sistema (o le falta algún slot nuevo que se
    // agregue más adelante), se completa con null en vez de romper.
    this.equipment = SurviConfig.emptyEquipment();
    if (save && save.equipment) Object.assign(this.equipment, save.equipment);
    this.desgaste = Desgaste.desde(save && save.desgaste);
    this.desgasteEquipo = Desgaste.desde(save && save.desgasteEquipo);
    this.desgasteCofres = {};
    const dc = save && save.stations && save.stations.desgasteCofres;
    if (dc) for (const k of Object.keys(dc)) this.desgasteCofres[k] = Desgaste.desde(dc[k]);
    this._golpe = null;
    this.flechas = [];
    this.tnts = []; // TNT prendidas (a punto de explotar)
    this._arcoCd = 0;
    // Agua y lava: las guardadas, o las del mundo recién generado. Un mundo
    // guardado antes de que existieran arranca sin fluidos (sus tiles no
    // tienen los lagos cavados).
    this.fluidos = save ? new CapaFluidos(save.fluidos) : this.world.fluidos || new CapaFluidos();
    // Capa de FONDO (paredes y ventanas): una por celda, detrás de los bloques.
    const nCeldas = SurviConfig.COLS * SurviConfig.ROWS;
    this.fondo = save && save.fondo && save.fondo.length === nCeldas ? Uint16Array.from(save.fondo) : new Uint16Array(nCeldas);
    // Cama = punto de reaparición (si sigue en su lugar).
    this.cama = save && save.cama && this.tilemap.get(save.cama.col, save.cama.row) === SurviConfig.TID.bed_l ? save.cama : null;
    if (this.cama) this.spawn = this._spawnDeCama(this.cama);
    this._puertasAuto = new Map(); // "col,row" (abajo) → abierta sola al pasar
    this._fundidoMs = 0; // pantalla a negro al dormir
    // Días vividos (los ojos voladores salen desde OJOS_DESDE_DIA). Un mundo
    // de antes lo estima por el tiempo jugado.
    this.dias = save && Number.isFinite(save.dias) ? save.dias : save ? 1 + Math.floor((save.playedMs || 0) / SurviConfig.DAY_CYCLE_MS) : 1;
    this._fondoN = 0;
    for (let i = 0; i < this.fondo.length; i++) if (this.fondo[i]) this._fondoN++;
    this.aireMs = SurviConfig.AIRE_MAX_MS;
    this.quemaduraMs = 0;
    if (!save) this._giveStarterTools();
    // Enemigos: si la partida tenía enemigos en el mapa al guardar, vuelven
    // donde estaban (con su vida). Si no, se arranca sin ninguno.
    this.enemies = save && Array.isArray(save.enemies) ? save.enemies.map((d) => this._crearEnemigo(d)).filter(Boolean) : [];
    this._enemyTimer = save && Number.isFinite(save.enemyTimer) ? save.enemyTimer : 4000;
    // Animales: los guardados vuelven donde estaban (con su vida). Un tipo
    // que ya no exista se descarta en vez de romper la carga.
    this.animals = save && Array.isArray(save.animals) ? save.animals.map((d) => Animal.crear(d)).filter(Boolean) : [];
    this._animalTimer = save && Number.isFinite(save.animalTimer) ? save.animalTimer : 1500;
    this._aveTimer = 2000;
    this.boya = null;
    // cultivos plantados: { "col,row": { tipo, ms } }
    this.cultivos = new Map(save && save.cultivos ? Object.entries(save.cultivos) : []);
    this._cultivoMs = 0;
    this._gotas = [];
    this.particulas.vaciar();
    this.cielo = new Cielo(Number(this.seed) || 1);
    this._cieloT = 0;
    // ítems tirados en el suelo (los de tu última muerte, por ejemplo)
    this.sueltos = save && Array.isArray(save.sueltos) ? save.sueltos.filter((d) => d && SurviConfig.ITEM_INFO[d.id]).map((d) => new ItemSuelto(d)) : [];
    this.venenoMs = 0; // envenenado (serpiente)
    this._venenoTick = 0;
    this.enredadoMs = 0; // telaraña de araña: casi no te podés mover
    this.congeladoMs = 0; // bola de nieve del yeti: más lento
    this._ruido = null; // último ruido fuerte (picar / romper): despierta murciélagos
    // Clima (lluvia / lluvia ácida, ver survi_clima.js). Un mundo de antes arranca despejado.
    this.clima = new Clima(save && save.clima);
    this._acidoMs = 0;
    this._sangreMs = 0;
    // Luna de sangre: sigue si guardaste en medio de una (y todavía es de noche).
    this._eraNoche = this.esNoche;
    this.lunaSangre = !!(save && save.lunaSangre) && this._eraNoche;
    this.durmiendo = null;
    this._saltoPrev = false;
    this._ultimoSaltoMs = -1e9;
    this._aplicarLunaSangre();
    this._fallFromY = null;
    this.invulnMs = 0;
    this.camera = new (SurviGame.E2D().Camera)({
      width: this.vistaW,
      height: SurviConfig.VIEW_H,
      worldWidth: SurviConfig.WORLD_W,
      worldHeight: SurviConfig.WORLD_H,
    });
    // followSmooth() + deadzone en vez de follow(): así saltar (movimiento
    // vertical chico y momentáneo) no mueve la cámara y no arruina la
    // puntería al colocar bloques. El primer follow() es un snap instantáneo
    // para arrancar ya centrado, sin que se vea la cámara "viajando" desde
    // el (0,0) inicial.
    this.camera.smoothing = SurviConfig.CAMERA_SMOOTHING;
    // Sin deadzone del motor: el seguimiento lo decide _cameraTarget().
    this.camera.deadzone = null;
    this._camAnchorY = this.player.y + this.player.h / 2;
    this._applyZoom(0, true);
    this.camera.follow(this.player.x, this.player.y);
    // El canvas se oculta en el menú (ver stop): se muestra recién al jugar.
    this.canvas.classList.remove('hidden');
    this._fit();
    if (!this._onResize) {
      this._onResize = () => this._fit();
      window.addEventListener('resize', this._onResize);
    }
    this._attachInput();
    this._renderHotbar();
    this._renderHealth();
    this._renderHunger();
    this._renderModo();
    this.ui.showScreen(null);
    this._autosave = setInterval(() => {
      if (!this.paused && !this.dead) this.save();
    }, 30000);
    if (!this._beforeUnload) {
      this._beforeUnload = () => {
        if (this.running && !this.dead) this.save();
      };
      window.addEventListener('beforeunload', this._beforeUnload);
    }
    this.loop = new (SurviGame.E2D().GameLoop)({
      update: (dt, step) => this._update(dt, step),
      draw: () => this._draw(),
    });
    this.loop.start();
    this.running = true;
  }

  // Herramientas de cobre en los primeros slots: sin esto la partida
  // nueva arranca sin nada con qué picar.
  _giveStarterTools() {
    SurviConfig.STARTER_TOOLS.forEach((id, i) => {
      this.inventory[id] = 1;
      if (i < SurviConfig.HOTBAR_SIZE) this.hotbarSlots[i] = id;
    });
    // unas antorchas para la primera cueva / primera noche
    this.inventory[SurviConfig.T.TORCH] = SurviConfig.STARTER_TORCHES;
    if (SurviConfig.STARTER_TOOLS.length < SurviConfig.HOTBAR_SIZE)
      this.hotbarSlots[SurviConfig.STARTER_TOOLS.length] = SurviConfig.T.TORCH;
  }

  stop({ save = true } = {}) {
    if (this.sonido) this.sonido.silenciar();
    if (this.running && save && !this.dead) this.save();
    if (this.loop) {
      this.loop.stop();
      this.loop = null;
    }
    if (this.input) {
      this.input.detach();
      this.input = null;
    }
    if (this._autosave) {
      clearInterval(this._autosave);
      this._autosave = null;
    }
    this.pointer.down = false;
    this._resetMine();
    this.running = false;
    this._liberarMundo();
  }

  // Al salir al menú el juego no sigue "atrás": el loop ya está parado, y
  // acá se borra el último frame del canvas (antes quedaba visible detrás
  // del menú) y se sueltan las estructuras pesadas del mundo para que el
  // recolector de basura las libere. start() las vuelve a armar todas.
  // El tileset generado (_tilesetCanvas) se conserva: es chico y así no hay
  // que redibujar los 139 tiles cada vez que se entra a un mundo.
  _liberarMundo() {
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.classList.add('hidden');
    this.tilemap = null;
    this.world = null;
    this.light = null;
    if (this.mapaOpen && this.vistaMapa) this.vistaMapa.cerrar(); // salir con el mapa abierto
    this.mapa = null;
    this.mapaOpen = false;
    this.camera = null;
    this.enemies = [];
    this.animals = [];
    this.station = null;
  }

  destroy() {
    this.stop();
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (this._beforeUnload) window.removeEventListener('beforeunload', this._beforeUnload);
  }

  // Engine2D.fitCanvas mide el contenedor: si todavía no tiene tamaño
  // (CSS recién inyectado, sección oculta) dejaría el canvas en 1x1 y no
  // se vería NADA. Por eso reintenta al frame siguiente.
  // Ojo: Engine2D.fitCanvas, NO Engine2D.Quality.fitCanvas — este deja el
  // backing store en VIEW_W x VIEW_H, que es lo que asume _draw.
  _fit() {
    const p = this.canvas.parentElement;
    if (!p || !p.clientWidth || !p.clientHeight) {
      requestAnimationFrame(() => this._fit());
      return;
    }
    // En pantalla completa (PC o celular) la vista se ensancha para llenar
    // la pantalla sin deformar: el alto sigue siendo 288 y se ve más mundo
    // de costado. Dentro de la sección, la vista normal de 480.
    if (this.pantallaCompleta) {
      const aspecto = p.clientWidth / p.clientHeight;
      // 384..720 px de mundo: una tablet (4:3) usa menos ancho en vez de
      // dejar franjas negras; un celular (≈2:1) ve más mundo de costado.
      this.vistaW = Math.max(384, Math.min(720, Math.round(SurviConfig.VIEW_H * aspecto)));
    } else this.vistaW = SurviConfig.VIEW_W;
    // la escala máxima del celular depende del tamaño: se recalcula siempre (al entrar y al salir)
    if (this.tactil) this._readQuality();
    SurviGame.E2D().fitCanvas(this.canvas, this.vistaW, SurviConfig.VIEW_H); // tamaño CSS (encaja en el contenedor)
    this.canvas.width = this.vistaW * this.renderScale; // backing store según el nivel gráfico
    this.canvas.height = SurviConfig.VIEW_H * this.renderScale;
    this.ctx.imageSmoothingEnabled = false; // (cambiar width resetea el contexto)
  }

  // ═══════════ Guardado ═══════════
  save() {
    if (!this.tilemap) return false;
    const col = Math.max(0, Math.min(SurviConfig.COLS - 1, Math.floor(this.player.x / SurviConfig.TILE)));
    return this.guardado.guardarMundo(this.slot, {
      seed: this.seed,
      nombre: this.nombre,
      modo: this.modo,
      dificultad: this.dificultad,
      muerto: this.muertoHardcore,
      espectador: this.espectador,
      volando: this.volando,
      playedMs: this.playedMs,
      biome: this.world.biomeByCol[col],
      tiles: Array.from(this.tilemap.data),
      px: this.player.x,
      py: this.player.y,
      hp: this.hp,
      hunger: this.hunger,
      timeOfDay: this.timeOfDay,
      stations: {
        furnaces: this.furnaces,
        chests: this.chests,
        desgasteCofres: Object.fromEntries(Object.entries(this.desgasteCofres).map(([k, d]) => [k, d.toJSON()])),
      },
      desgaste: this.desgaste.toJSON(),
      fluidos: this.fluidos.celdas,
      desgasteEquipo: this.desgasteEquipo.toJSON(),
      inventory: this.inventory,
      hotbarSlots: this.hotbarSlots,
      selectedSlot: this.selectedSlot,
      equipment: this.equipment,
      // Enemigos vivos en el mapa: sin esto, guardar y salir era una forma
      // de sacarse de encima a los que te estaban persiguiendo.
      enemies: this.enemies.filter((en) => en.hp > 0).map((en) => this._serializarEnemigo(en)),
      enemyTimer: this._enemyTimer,
      animals: this.animals.filter((a) => !a.estaMuerto()).map((a) => a.serializar()),
      animalTimer: this._animalTimer,
      clima: this.clima ? this.clima.serializar() : null,
      fondo: this.fondo, // paredes y ventanas
      cama: this.cama, // { col, row } de la mitad izquierda, o null
      dias: this.dias,
      sueltos: this.sueltos.map((s) => s.serializar()),
      cultivos: Object.fromEntries(this.cultivos),
      explorado: this.mapa ? this.mapa.serializar() : null,
      lunaSangre: this.lunaSangre,
      corazones: this.corazones,
    });
  }

  // ═══════════ Pausa / inventario ═══════════
  setPaused(v) {
    if (this.dead || !this.running) return;
    this.paused = v;
    this.pointer.down = false;
    this._resetMine();
    if (v) {
      this.sonido.silenciar();
      const T = SurviConfig.TILE, pc = Math.floor((this.player.x + this.player.w / 2) / T), pr = Math.floor((this.player.y + this.player.h / 2) / T);
      const biome = SurviConfig.BIOMES[this.world.biomeByCol[pc]];
      const bajoTierra = pr > this.world.surfaceByCol[pc] + 6;
      const lugar = bajoTierra ? SurviConfig.CUEVA_INFO[this._regionCueva(pc, pr)].label : biome && biome.label;
      this.ui.pauseInfo.textContent =
        `${this.nombre} · ${this.creativo ? 'Creativo' : this.dif.label}${this.espectador ? ' · Espectador' : ''} · Día ${this.dias} · ${GestorGuardado.fmtTime(this.playedMs)}` +
        (lugar ? ` · ${lugar}` : '') +
        (this.lunaSangre ? ' · Luna de sangre' : '');
      this.save();
      this.ui.showScreen('pause');
    } else {
      this.ui.showScreen(null);
    }
  }

  toggleInventory(force) {
    if (this.dead || !this.running) return;
    const v = force === undefined ? !this.invOpen : force;
    this.invOpen = v;
    // abrir o cerrar el inventario siempre deja la mesa/horno/cofre cerrados
    this.station = null;
    this.craftStation = 'hand';
    this.pointer.down = false;
    this._resetMine();
    if (v) {
      this._renderInventory();
      this.ui.showScreen('inv');
    } else this.ui.showScreen(null);
  }

  // Mapa (tecla M / botón del HUD). Mientras está abierto el mundo se frena,
  // igual que con el inventario.
  toggleMapa(force) {
    if (this.dead || !this.running || !this.mapa) return;
    const v = force === undefined ? !this.mapaOpen : force;
    if (v && (this.paused || this.invOpen)) return;
    this.mapaOpen = v;
    this.pointer.down = false;
    this._resetMine();
    if (v) {
      this.ui.showScreen('mapa');
      this.vistaMapa.abrir(this);
    } else {
      this.vistaMapa.cerrar();
      this.ui.showScreen(null);
    }
  }

  // ═══════════ Input ═══════════
  _attachInput() {
    if (this.input) this.input.detach();
    this.input = new (SurviGame.E2D().KeyboardInput)(
      {
        ArrowLeft: 'left',
        KeyA: 'left',
        ArrowRight: 'right',
        KeyD: 'right',
        ArrowUp: 'jump',
        KeyW: 'jump',
        Space: 'jump',
        // Por ahora no hace nada en el juego: está mapeada para que el
        // navegador no scrollee la página hacia abajo al apretarla.
        ArrowDown: 'down',
        KeyS: 'down',
        Digit1: 'slot0',
        Digit2: 'slot1',
        Digit3: 'slot2',
        Digit4: 'slot3',
        Digit5: 'slot4',
        Digit6: 'slot5',
        Digit7: 'slot6',
        Digit8: 'slot7',
        KeyI: 'inv',
        KeyM: 'mapa',
        KeyZ: 'zoom',
        KeyF: 'volar', // creativo / espectador
        KeyV: 'espectador', // creativo ⇄ espectador
        Escape: 'pause',
      },
      {
        activeCheck: () => this.running && !this.dead,
        preventDefaultFor: new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']),
        onDown: (action) => {
          if (action === 'inv') {
            if (!this.paused && !this.mapaOpen) this.toggleInventory();
            return;
          }
          if (action === 'mapa') {
            this.toggleMapa();
            return;
          }
          if (action === 'pause') {
            if (this.mapaOpen) this.toggleMapa(false);
            else if (this.invOpen) this.toggleInventory(false);
            else this.setPaused(!this.paused);
            return;
          }
          if (this.paused || this.invOpen || this.mapaOpen) return;
          if (action === 'zoom') {
            this.cambiarZoom();
            return;
          }
          if (action === 'volar') {
            this.alternarVuelo();
            return;
          }
          if (action === 'espectador') {
            this.alternarEspectador();
            return;
          }
          if (action.startsWith('slot')) {
            this.selectedSlot = Number(action.slice(4));
            this._renderHotbar();
          }
        },
      },
    );
    this.input.attach();
  }

  _bindCanvas() {
    // Clic derecho = colocar, así que el menú contextual del navegador se
    // anula en todo el contenedor del juego.
    this.ui.root.addEventListener('contextmenu', (e) => e.preventDefault());
    // Rueda del mouse: cambia el ítem de la mano (abajo = siguiente, arriba =
    // anterior, dando la vuelta). Se acumula el delta para que un trackpad
    // (muchos eventos chiquitos) no pase 10 slots de un saque.
    this._ruedaAcum = 0;
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        if (!this.running || this._blocked()) return;
        e.preventDefault(); // que no scrollee la página
        this._ruedaAcum += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY; // deltaMode 1 = líneas
        if (Math.abs(this._ruedaAcum) < SurviGame.RUEDA_UMBRAL) return;
        const paso = Math.sign(this._ruedaAcum);
        this._ruedaAcum = 0;
        const n = SurviConfig.HOTBAR_SIZE;
        this.seleccionarSlot((this.selectedSlot + paso + n) % n);
      },
      { passive: false },
    );
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this._blocked()) return;
      if (this.tactil && e.pointerType === 'touch') return; // en celular se juega con los joysticks
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {}
      this._hoverTile = this._pointerToTile(e, true);
      this.pointer.down = true;
      this.pointer.button = e.button;
      if (this.pointer.button === 2) {
        this._placeCd = 0;
        this._usoPulsacion = false; // pulsación nueva: puede volver a usar cama / puerta
        this._tryPlace();
      } else this._resetMine();
      e.preventDefault();
    });
    const stop = (e) => {
      this.pointer.down = false;
      this._resetMine();
      try {
        if (e && e.pointerId != null) this.canvas.releasePointerCapture(e.pointerId);
      } catch {}
    };
    this.canvas.addEventListener('pointerup', stop);
    this.canvas.addEventListener('pointercancel', stop);
    this.canvas.addEventListener('pointerleave', (e) => {
      this._hoverTile = null;
      stop(e);
    });
    window.addEventListener('blur', () => {
      this.pointer.down = false;
      this._resetMine();
    });
    const dropRect = () => {
      this._canvasRect = null;
    };
    window.addEventListener('resize', dropRect);
    window.addEventListener('scroll', dropRect, {
      passive: true,
      capture: true,
    });
    this.canvas.addEventListener('pointerenter', dropRect);
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.tactil && e.pointerType === 'touch') return;
      if (this._blocked()) {
        this._hoverTile = null;
        return;
      }
      this._hoverTile = this._pointerToTile(e);
    });
  }

  // ═══════════ Controles táctiles (ver survi_tactil.js) ═══════════
  // Joystick izquierdo: caminar; hacia arriba (recto o en diagonal) salta.
  moverTactil(x, y) {
    this.touchState.left = x < -0.35;
    this.touchState.right = x > 0.35;
    this.touchState.jump = y < -0.5;
    this.touchState.down = y > 0.5; // (en una escalera: bajar)
  }

  // Joystick derecho: mueve la mira dentro del círculo de alcance alrededor
  // del personaje (REACH_TILES, igual que con el mouse en PC). Es RELATIVO:
  // al apoyar el dedo se toma la posición actual de la mira como punto de
  // partida y el joystick la corre desde ahí (empujarlo hasta el borde la
  // mueve MIRA_SENSIBILIDAD veces el alcance). Así, al soltar y volver a
  // tocar, la mira no salta: sigue desde donde quedó. Mientras está
  // empujado, pega / rompe / dispara.
  // Con la palanca al tope (más de MIRA_BORDE) la mira SIGUE avanzando sola
  // hacia ese lado (MIRA_VEL_BORDE alcances por segundo), así no hay que
  // soltar y volver a tocar para cruzar todo el círculo.
  static MIRA_SENSIBILIDAD = 0.8;
  static MIRA_BORDE = 0.85;
  static MIRA_VEL_BORDE = 1.6;

  empezarMiraTactil() {
    this._miraBase = this._miraOffset ? { ...this._miraOffset } : { x: 0, y: 0 };
  }

  apuntarTactil(x, y, activo) {
    if (!activo) {
      this._miraStick = null;
      if (this.pointer.down && this.pointer.button === 0) {
        this.pointer.down = false;
        this._resetMine();
      }
      return;
    }
    this._miraStick = { x, y };
    if (!this._miraBase) this._miraBase = this._miraOffset ? { ...this._miraOffset } : { x: 0, y: 0 };
    this._aplicarMira();
    if (!this._blocked()) {
      this.pointer.down = true;
      this.pointer.button = 0;
    }
  }

  // offset = base + palanca * k, dentro del círculo de alcance. Si el círculo
  // la frena, la base se corre para que la mira quede ahí mismo: así, al
  // mover la palanca para el otro lado, responde al instante (sin "zona
  // muerta" hasta volver a entrar al círculo).
  _aplicarMira() {
    const s = this._miraStick, base = this._miraBase;
    if (!s || !base) return;
    const k = this.reachPx * SurviGame.MIRA_SENSIBILIDAD;
    let ox = base.x + s.x * k,
      oy = base.y + s.y * k;
    const largo = Math.hypot(ox, oy);
    if (largo > this.reachPx) {
      ox *= this.reachPx / largo;
      oy *= this.reachPx / largo;
      base.x = ox - s.x * k;
      base.y = oy - s.y * k;
    }
    this._miraOffset = { x: ox, y: oy };
    this._actualizarMira();
  }

  // Por frame: con la palanca al tope, la base avanza hacia ese lado.
  _empujarMiraBorde(dt) {
    const s = this._miraStick;
    if (!s || !this._miraBase) return;
    const l = Math.hypot(s.x, s.y);
    if (l <= SurviGame.MIRA_BORDE) return;
    const f = ((l - SurviGame.MIRA_BORDE) / (1 - SurviGame.MIRA_BORDE)) * SurviGame.MIRA_VEL_BORDE * this.reachPx * (dt / 1000);
    this._miraBase.x += (s.x / l) * f;
    this._miraBase.y += (s.y / l) * f;
    this._aplicarMira();
  }

  // Botón chico: colocar / interactuar. Mantenerlo apretado coloca seguido.
  colocarTactil(apretado) {
    this._colocandoTactil = apretado;
    if (!apretado || this._blocked()) return;
    this._actualizarMira();
    this._placeCd = 0;
    this._usoPulsacion = false;
    this._tryPlace();
  }

  // La mira sigue al personaje: se recalcula cada frame desde su centro.
  _actualizarMira() {
    if (!this._miraOffset || !this.player || !this.tilemap) return;
    const x = this.player.x + this.player.w / 2 + this._miraOffset.x;
    const y = this.player.y + this.player.h / 2 + this._miraOffset.y;
    this._pointerWorld = { x, y };
    this._hoverTile = this.tilemap.worldToTile(x, y);
  }

  // ¿Celular (no tablet) en vertical? Ahí se pide girarlo y el juego no avanza.
  get enVertical() {
    // (en tablet se puede jugar en vertical: la pantalla alcanza)
    // Solo en pantalla completa: jugando dentro de la sección se juega como venga.
    return (
      this.tactil &&
      this.pantallaCompleta &&
      typeof window !== 'undefined' &&
      window.innerHeight > window.innerWidth &&
      window.innerWidth < 600
    );
  }

  // ¿Está en pantalla completa? (la clase la pone SurviApp, ver survi_main.js)
  get pantallaCompleta() {
    return this.ui.root.classList.contains('survi-fs');
  }

  // ═══════════ Calidad gráfica ═══════════
  _readQuality() {
    const Q = SurviGame.E2D() && SurviGame.E2D().Quality;
    this.quality = Q && Q.get ? Q.get() : 'high';
    // gama baja: el mapa de luz calcula menos margen afuera de la vista
    if (this.light) this.light.margen = this.quality === 'low' ? 7 : LightMap.MARGIN;
    this.renderScale = SurviGame.RENDER_BY_QUALITY[this.quality] || SurviGame.RENDER_SCALE;
    // En celular: nunca más resolución interna que pixeles tiene la pantalla
    // (con 4 se dibujaban ~3 veces más pixeles de los que se ven: en un
    // celular de gama baja bajaba de 60 a 12 fps).
    const cont = this.canvas && this.canvas.parentElement;
    if (this.tactil && cont && cont.clientWidth) {
      const fisicos = Math.min(cont.clientWidth, cont.clientHeight * (this.vistaW / SurviConfig.VIEW_H)) * (globalThis.devicePixelRatio || 1);
      this.renderScale = Math.max(1, Math.min(this.renderScale, Math.floor(fisicos / this.vistaW)));
    }
    this.lightEvery = SurviGame.LIGHT_EVERY_BY_QUALITY[this.quality] || 1;
    // zooms que dan pixeles enteros con esta escala
    this._zoomOk = SurviGame.ZOOM_LEVELS.map((z, i) => i).filter((i) =>
      Number.isInteger(SurviGame.ZOOM_LEVELS[i] * this.renderScale),
    );
    this._zoomIdx = this.#nivelDelModo();
    this._lightDirty = true;
  }

  // ═══════════ Zoom ═══════════
  get zoomModo() {
    return SurviGame.ZOOM_MODOS[this._zoomModo].nombre;
  }

  // Tecla Z: pasa al modo siguiente (Normal → Cerca → Lejos → Normal).
  cambiarZoom() {
    const ciclo = SurviGame.ZOOM_CICLO;
    this._zoomModo = ciclo[(ciclo.indexOf(this._zoomModo) + 1) % ciclo.length];
    this._zoomIdx = this.#nivelDelModo();
    try {
      localStorage.setItem(SurviGame.ZOOM_KEY, String(this._zoomModo));
    } catch {}
    if (this.ui.showToast) this.ui.showToast(`Zoom: ${this.zoomModo}`);
  }

  // El nivel del modo actual que da pixeles enteros con la calidad actual:
  // el suyo si se puede; si no, el más cercano hacia el lado del modo
  // (Lejos: < 1, Cerca: > 1).
  #nivelDelModo() {
    const { nivel, dir } = SurviGame.ZOOM_MODOS[this._zoomModo];
    const ok = this._zoomOk || [nivel];
    if (ok.includes(nivel)) return nivel;
    const L = SurviGame.ZOOM_LEVELS;
    const lado = ok.filter((i) => (dir < 0 ? L[i] < 1 : dir > 0 ? L[i] > 1 : true));
    // Ninguno de ese lado da pixeles enteros (calidad Baja): se usa igual el
    // del modo — un pixel apenas desparejo es mejor que un zoom que no cambia.
    if (!lado.length && dir !== 0) return nivel;
    const opciones = lado.length ? lado : ok;
    return opciones.reduce((best, i) => (Math.abs(L[i] - L[nivel]) < Math.abs(L[best] - L[nivel]) ? i : best), opciones[0]);
  }

  // El zoom se implementa achicando/agrandando la "ventana" de la cámara
  // (camera.width/height en px de mundo) y escalando el dibujo en _draw:
  // con zoom 2 la cámara ve la mitad de mundo y se dibuja al doble. Así
  // TileMap, follow, deadzone y clamp siguen funcionando sin tocarlos.
  // El cambio es animado (se acerca al nivel pedido cuadro a cuadro) y
  // mantiene centrado el mismo punto del mundo.
  _applyZoom(dt, instant = false) {
    if (!this.camera) return;
    const target = SurviGame.ZOOM_LEVELS[this._zoomIdx];
    if (instant) this._zoom = target;
    else if (this._zoom !== target) {
      this._zoom += (target - this._zoom) * Math.min(1, dt / 90);
      if (Math.abs(target - this._zoom) < 0.002) this._zoom = target;
    }
    const cam = this.camera;
    const w = this.vistaW / this._zoom,
      h = SurviConfig.VIEW_H / this._zoom;
    if (cam.width === w && cam.height === h) return;
    const cx = cam.x + cam.width / 2,
      cy = cam.y + cam.height / 2;
    cam.width = w;
    cam.height = h;
    cam.x = cx - w / 2;
    cam.y = cy - h / 2;
    cam._clamp();
  }

  _cameraTarget() {
    const px = this.player.x + this.player.w / 2;
    const py = this.player.y + this.player.h / 2;
    const maxAbove = (SurviConfig.VIEW_H / this._zoom) * SurviGame.CAM_MAX_ABOVE_ANCHOR;
    if (this.player.grounded || py > this._camAnchorY) this._camAnchorY = py;
    else if (py < this._camAnchorY - maxAbove) this._camAnchorY = py + maxAbove;
    return {
      x: px,
      y: this._camAnchorY,
    };
  }

  // ═══════════ Mesa / horno / cofre ═══════════
  _stationEmpty(col, row) {
    const k = `${col},${row}`;
    const f = this.furnaces[k],
      c = this.chests[k];
    if (f && (f.in || f.fuel || f.out)) return false;
    if (c && Object.keys(c).length) return false;
    return true;
  }

  openStation(col, row) {
    const id = this.tilemap.get(col, row),
      key = `${col},${row}`;
    this.pointer.down = false;
    this._resetMine();
    this.invOpen = true;
    if (id === SurviConfig.T.CRAFT_TABLE) {
      this.station = null;
      this.craftStation = 'table';
      this.ui.renderCraft(this);
      this.ui.showScreen('craft');
    } else if (id === SurviConfig.T.FURNACE || id === SurviConfig.T.FURNACE_ON) {
      if (!this.furnaces[key])
        this.furnaces[key] = {
          in: null,
          fuel: null,
          out: null,
          burn: 0,
          burnMax: 0,
          prog: 0,
        };
      this.station = {
        type: 'furnace',
        key,
      };
      this.craftStation = 'hand';
      this.ui.renderFurnace(this);
      this.ui.showScreen('furnace');
    } else if (id === SurviConfig.T.CHEST) {
      if (!this.chests[key]) this.chests[key] = {};
      this.station = {
        type: 'chest',
        key,
      };
      this.craftStation = 'hand';
      this.ui.renderChest(this);
      this.ui.showScreen('chest');
    }
  }

  closeStation() {
    this.toggleInventory(false);
  }

  get openFurnace() {
    return this.station && this.station.type === 'furnace' ? this.furnaces[this.station.key] : null;
  }

  get openChest() {
    return this.station && this.station.type === 'chest' ? this.chests[this.station.key] : null;
  }

  // Horno: mete TODO el stack del inventario en el lugar que le toca
  // (lo que se cocina arriba, el combustible abajo). Si ya había otra cosa
  // ahí, vuelve al inventario.
  furnaceInsert(id) {
    const f = this.openFurnace,
      qty = this.inventory[id] || 0;
    if (!f || !qty) return;
    const slot = SurviConfig.SMELT[id] ? 'in' : SurviConfig.FUEL[id] ? 'fuel' : null;
    if (!slot) return;
    if (f[slot] && f[slot].id !== id) {
      if (!this.furnaceTake(slot)) return;
    }
    f[slot] = {
      id,
      qty: (f[slot] ? f[slot].qty : 0) + qty,
    };
    this._removeItem(id, qty);
    this.ui.renderFurnace(this);
  }

  furnaceTake(slot) {
    const f = this.openFurnace;
    if (!f || !f[slot]) return true;
    if (!this._hasRoomFor(f[slot].id)) {
      if (this.ui.showToast) this.ui.showToast('Inventario lleno');
      return false;
    }
    this._addItem(f[slot].id, f[slot].qty);
    f[slot] = null;
    if (slot === 'in') f.prog = 0;
    this.ui.renderFurnace(this);
    return true;
  }

  // Cofre: un clic pasa el stack entero de un lado al otro.
  chestPut(id) {
    const c = this.openChest,
      qty = this.inventory[id] || 0;
    if (!c || !qty) return;
    if (!(id in c) && Object.keys(c).length >= SurviConfig.CHEST_SLOTS) {
      if (this.ui.showToast) this.ui.showToast('El cofre está lleno');
      return;
    }
    c[id] = (c[id] || 0) + qty;
    this.desgaste.moverA(this._desgasteCofre(), id);
    this._removeItem(id, qty);
    this.ui.renderChest(this);
  }

  chestTake(id) {
    const c = this.openChest;
    if (!c || !c[id]) return;
    if (!this._hasRoomFor(id)) {
      if (this.ui.showToast) this.ui.showToast('Inventario lleno');
      return;
    }
    this._addItem(id, c[id]);
    this._desgasteCofre().moverA(this.desgaste, id);
    delete c[id];
    this.ui.renderChest(this);
  }

  // Todos los hornos avanzan siempre (aunque no estén en pantalla).
  _tickFurnaces(dt) {
    for (const [key, f] of Object.entries(this.furnaces)) {
      const target = f.in ? SurviConfig.SMELT[f.in.id] : null;
      const canSmelt = !!target && (!f.out || f.out.id === target);
      if (f.burn <= 0 && canSmelt && f.fuel) {
        f.burnMax = f.burn = SurviConfig.FUEL[f.fuel.id] * SurviConfig.SMELT_MS;
        if (--f.fuel.qty <= 0) f.fuel = null;
      }
      if (f.burn > 0) {
        f.burn = Math.max(0, f.burn - dt);
        if (canSmelt) {
          f.prog += dt;
          if (f.prog >= SurviConfig.SMELT_MS) {
            f.prog = 0;
            if (--f.in.qty <= 0) f.in = null;
            f.out = f.out
              ? {
                  id: target,
                  qty: f.out.qty + 1,
                }
              : {
                  id: target,
                  qty: 1,
                };
          }
        } else f.prog = 0;
      } else if (f.prog > 0) f.prog = Math.max(0, f.prog - dt * 2); // sin fuego se enfría

      // dibujo prendido/apagado (y la luz, que sale del tile prendido)
      const [c, r] = key.split(',').map(Number);
      const cur = this.tilemap.get(c, r),
        lit = f.burn > 0;
      if (lit && cur === SurviConfig.T.FURNACE) {
        this.tilemap.set(c, r, SurviConfig.T.FURNACE_ON);
        this._lightDirty = true;
      } else if (!lit && cur === SurviConfig.T.FURNACE_ON) {
        this.tilemap.set(c, r, SurviConfig.T.FURNACE);
        this._lightDirty = true;
      }
    }
    // pantalla del horno abierta: refrescar barras ~6 veces por segundo
    if (this.openFurnace) {
      this._stationUiT -= dt;
      if (this._stationUiT <= 0) {
        this._stationUiT = 160;
        this.ui.renderFurnace(this, true);
      }
    }
  }

  _blocked() {
    return !this.running || this.paused || this.invOpen || this.mapaOpen || this.dead || !!this.durmiendo || !this.tilemap;
  }

  // ═══════════ Modo de juego / dificultad ═══════════
  get creativo() {
    return this.modo === 'creativo';
  }

  // Los monstruos no te ven ni te pegan (creativo o espectador).
  get invisible() {
    return this.creativo || this.espectador;
  }

  get dif() {
    return SurviConfig.DIFICULTADES[this.dificultad] || SurviConfig.DIFICULTADES.normal;
  }

  // Botones del HUD (espectador / volar) y clases del contenedor.
  _renderModo() {
    this.ui.mostrarModo({
      creativo: this.creativo,
      espectador: this.espectador,
      volando: this.volando,
      puedeCambiar: this.creativo && !this.muertoHardcore,
    });
  }

  alternarVuelo() {
    if ((!this.invisible && !this.tieneAlas) || this.dead) return;
    this.volando = !this.volando;
    this.player.vy = 0;
    this._fallFromY = null;
    this._renderModo();
    if (this.ui.showToast) this.ui.showToast(this.volando ? 'Volando (saltar sube, abajo baja)' : 'Vuelo desactivado');
  }

  // Creativo ↔ espectador (solo en creativo).
  alternarEspectador() {
    if (!this.creativo || this.muertoHardcore || this.dead) return;
    this.espectador = !this.espectador;
    if (this.espectador) {
      this._despertar();
      this.volando = true; // espectador arranca volando
    } else {
      // de vuelta a creativo: caminando (para volar, doble salto o F). Si
      // quedaste adentro de los bloques, subís hasta el primer hueco libre.
      this.volando = false;
      const p = this.player, T = SurviConfig.TILE;
      for (let i = 0; i < SurviConfig.ROWS && p.y > 0 && this._cajaEnSolido(p.x, p.y); i++) p.y -= T;
      p.vy = 0;
      this._fallFromY = null;
    }
    this.pointer.down = false;
    this._resetMine();
    this._lightDirty = true;
    this._renderModo();
    if (this.ui.showToast) this.ui.showToast(this.espectador ? 'Modo espectador' : 'Modo creativo');
  }

  // Catálogo del creativo: te da una pila del ítem (1 si no se apila).
  darItemCreativo(id) {
    if (!this.creativo) return false;
    const info = SurviConfig.ITEM_INFO[id];
    if (!info) return false;
    const qty = info.tool || info.arco || info.equip || info.cubo !== undefined ? 1 : SurviConfig.CREATIVO_PILA;
    return this._addItem(id, qty);
  }

  vaciarInventario() {
    if (!this.creativo) return;
    this.inventory = {};
    this.hotbarSlots = this.hotbarSlots.map(() => null);
    this._renderHotbar();
    this._renderInventory();
  }

  // Hardcore: después de morir, seguís mirando el mundo como espectador.
  verComoEspectador() {
    if (!this.muertoHardcore) return;
    this.dead = false;
    this.hp = this.maxHp;
    this.espectador = true;
    this.volando = true;
    this._renderHealth();
    this._renderModo();
    this.ui.showScreen(null);
  }

  // getBoundingClientRect() fuerza layout y pointermove llega decenas de
  // veces por segundo: se mide una vez y se invalida en resize/scroll/down.
  _pointerToTile(e, fresh = false) {
    if (fresh || !this._canvasRect) this._canvasRect = this.canvas.getBoundingClientRect();
    const rect = this._canvasRect;
    const sx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    const k = this.renderScale * this._zoom;
    const w = this.camera.screenToWorld(sx / k, sy / k);
    this._pointerWorld = { x: w.x, y: w.y }; // para apuntar el arco
    return this.tilemap.worldToTile(w.x, w.y);
  }

  _inReach(col, row) {
    const cx = col * SurviConfig.TILE + SurviConfig.TILE / 2,
      cy = row * SurviConfig.TILE + SurviConfig.TILE / 2;
    const pcx = this.player.x + this.player.w / 2,
      pcy = this.player.y + this.player.h / 2;
    return Math.hypot(cx - pcx, cy - pcy) <= this.reachPx;
  }

  // ¿Se ve el bloque desde el personaje, sin otro bloque sólido en el medio?
  // Rayos desde los ojos al centro del bloque y a sus 4 esquinas (un poco
  // hacia adentro): con que llegue uno alcanza. Así no se pica "a través"
  // de una pared.
  static #PUNTOS_VISTA = [
    [0.5, 0.5],
    [0.2, 0.2],
    [0.8, 0.2],
    [0.2, 0.8],
    [0.8, 0.8],
  ];

  _bloqueVisible(col, row) {
    const T = SurviConfig.TILE, p = this.player, map = this.tilemap;
    const ox = p.x + p.w / 2, oy = p.y + p.h * 0.3;
    if (Math.floor(ox / T) === col && Math.floor(oy / T) === row) return true;
    for (const [ax, ay] of SurviGame.#PUNTOS_VISTA) {
      const tx = (col + ax) * T, ty = (row + ay) * T;
      const n = Math.ceil(Math.hypot(tx - ox, ty - oy) / 2); // un paso cada 2 px
      let libre = true;
      for (let i = 1; i < n; i++) {
        const k = i / n;
        const c = Math.floor((ox + (tx - ox) * k) / T), r = Math.floor((oy + (ty - oy) * k) / T);
        if (c === col && r === row) break; // llegó al bloque
        if (map.isSolidAt(c, r)) {
          libre = false;
          break;
        }
      }
      if (libre) return true;
    }
    return false;
  }

  // Se puede picar: al alcance y a la vista.
  _puedePicar(col, row) {
    return this._inReach(col, row) && this._bloqueVisible(col, row);
  }

  _resetMine() {
    this._mine.col = -1;
    this._mine.row = -1;
    this._mine.progress = 0;
  }

  // Herramienta que tiene en la mano (la del slot elegido), o null.
  get heldTool() {
    const id = this.hotbarSlots[this.selectedSlot];
    const info = id ? SurviConfig.ITEM_INFO[id] : null;
    return info && info.tool ? info : null;
  }

  // Picado progresivo: se acumula sobre el MISMO tile mientras siga
  // apretado el botón; si el puntero se corre, arranca de cero. La
  // herramienta correcta (pico/hacha/pala) acelera según su material.
  _mineTick(dt) {
    if (this.espectador) return; // el espectador solo mira
    const armaId = this.hotbarSlots[this.selectedSlot];
    const arma = armaId ? SurviConfig.ITEM_INFO[armaId] : null;
    if (arma && arma.arco) {
      // con un arco en la mano, el clic izquierdo dispara (no pica)
      this._resetMine();
      this._dispararArco(armaId, arma.arco);
      return;
    }
    const hov = this._hoverTile;
    if (!hov) {
      this._resetMine();
      return;
    }
    const { col, row } = hov;
    let id = this.tilemap.get(col, row);
    // Pared / ventana del fondo: solo con pico o hacha (con la espada o a
    // mano se pelea, no se rompe la casa).
    let capa = 'bloque';
    const fondoId = this.fondo ? this.fondo[row * SurviConfig.COLS + col] : 0;
    const t0 = this.heldTool;
    if (id === 0 && fondoId && t0 && (t0.tool === 'pickaxe' || t0.tool === 'axe') && this._puedePicar(col, row)) {
      id = fondoId;
      capa = 'fondo';
    }
    if (id === 0 || !this._puedePicar(col, row)) {
      this._resetMine();
      this._tryAttack();
      return;
    }
    if (id === SurviConfig.T.BEDROCK) {
      this._resetMine();
      return;
    }
    if (this._mine.col !== col || this._mine.row !== row || this._mine.capa !== capa) {
      this._mine.col = col;
      this._mine.row = row;
      this._mine.capa = capa;
      this._mine.progress = 0;
    }
    const hard = SurviConfig.HARDNESS[id] || 0.6;
    const tool = this.heldTool;
    // herramienta correcta: más rápido cuanto mejor el material; a mano (o con otra cosa), lento
    const speed = SurviConfig.velocidadPicado(id, tool);
    this._mine.progress += (dt / 1000 / hard) * speed;
    if (this.creativo) this._mine.progress = 1; // creativo: rompe al toque (y no suelta nada)
    this._attackAnim = Math.max(this._attackAnim, 60);
    // mira hacia el bloque que pica (como en Terraria) y encadena golpes
    this.player.facing = col * SurviConfig.TILE + SurviConfig.TILE / 2 >= this.player.x + this.player.w / 2 ? 1 : -1;
    this._startSwing(SurviGame.SWING_MINE_MS);
    // golpecito de picado (cada tanto, mientras picás)
    this._sonPicarMs = (this._sonPicarMs || 0) - dt;
    if (this._sonPicarMs <= 0) {
      this._sonPicarMs = 230;
      this.sonar('picar', col * SurviConfig.TILE + 8, row * SurviConfig.TILE + 8, { material: SurviGame.materialDe(id) });
      this.particulas.picar(col, row, id);
      this.hacerRuido(col * SurviConfig.TILE + 8, row * SurviConfig.TILE + 8);
    }
    if (this._mine.progress >= 1 && capa === 'fondo') {
      this.fondo[row * SurviConfig.COLS + col] = 0;
      this._fondoN--;
      if (!this.creativo) this._soltarEnCelda(SurviConfig.DROPS[id] || id, 1, col, row);
      if (tool) this._usarHerramienta(this.hotbarSlots[this.selectedSlot]);
      this._resetMine();
      this._attackAnim = 120;
      return;
    }
    if (this._mine.progress >= 1) {
      if (SurviConfig.STATION_IDS.has(id) && !this._stationEmpty(col, row)) {
        this._resetMine();
        if (this.ui.showToast)
          this.ui.showToast(
            id === SurviConfig.T.CHEST
              ? 'Vaciá el cofre antes de romperlo'
              : 'Sacá lo que hay en el horno antes de romperlo',
          );
        return;
      }
      // Lo que suelta cae al suelo (ItemSuelto) y se junta pasando cerca.
      let dropId = SurviConfig.DROPS[id] || 0;
      let dropQty = 1;
      // sandía → varias rodajas, telaraña → hilo, …
      const varios = SurviConfig.DROP_VARIOS[id];
      if (varios) {
        dropId = varios.id;
        dropQty = varios.min + Math.floor(Math.random() * (varios.max - varios.min + 1));
      }
      // Minerales: si el pico no alcanza el tier, se rompe igual pero no suelta nada.
      const ore = SurviConfig.ORE_DROPS[id];
      if (ore && !(tool && tool.tool === 'pickaxe' && tool.tier >= ore.tier)) {
        dropId = 0;
        if (this.ui.showToast) this.ui.showToast('Necesitás un pico mejor para sacar este mineral');
      }
      const broken = this.tilemap.breakTile(col, row);
      this.sonar('romper', col * SurviConfig.TILE + 8, row * SurviConfig.TILE + 8, { material: SurviGame.materialDe(broken) });
      this.hacerRuido(col * SurviConfig.TILE + 8, row * SurviConfig.TILE + 8);
      this.particulas.romper(col, row, broken, SurviConfig.CULTIVO_DE.has(broken) || SurviConfig.DECO_IDS.has(broken) ? 5 : 10);
      // cultivo: cosecha (madura) o te devuelve lo plantado (verde)
      if (SurviConfig.CULTIVO_DE.has(broken)) this._cosechar_cultivo(col, row, broken);
      // pasto alto: a veces semillas (y muy rara vez zanahoria o papa)
      if ((broken === SurviConfig.TID.tallgrass || broken === SurviConfig.TID.tallgrass2) && !this.creativo) {
        for (const [item, p] of SurviConfig.DROP_PASTO) if (Math.random() < p) this._soltarEnCelda(item, 1, col, row);
      }
      if (dropId && !this.creativo) this._soltarEnCelda(dropId, dropQty, col, row);
      // drops extra (sandía → también semillas)
      const extra = SurviConfig.DROP_EXTRA[broken];
      if (extra && !this.creativo)
        for (const [item, min, max] of extra) this._soltarEnCelda(item, min + Math.floor(Math.random() * (max - min + 1)), col, row);
      this._romperCompanero(col, row, broken); // la otra mitad de la cama / puerta
      if (SurviConfig.NEST_IDS.has(broken)) {
        this.tilemap.set(col, row, SurviConfig.NIDO_A_RAMA[broken]); // el nido sale, la rama queda
        if (!this.creativo && Math.random() < SurviConfig.NIDO_PLUMA) this._soltarEnCelda(SurviConfig.ESPECIAL.pluma, 1, col, row);
      }
      if (tool) this._usarHerramienta(this.hotbarSlots[this.selectedSlot]);
      this.fluidos.activar(col, row); // si había agua/lava al lado, ahora entra
      if (SurviConfig.STATION_IDS.has(id)) {
        const k = `${col},${row}`;
        delete this.furnaces[k];
        delete this.chests[k];
        delete this.desgasteCofres[k];
      }
      const pal = SurviConfig.leafPalette(broken);
      const foodDrop = pal ? SurviConfig.LEAF_FOOD_DROP[pal] : null;
      if (foodDrop && !this.creativo && Math.random() < foodDrop.chance) this._soltarEnCelda(foodDrop.id, 1, col, row);
      this._retileAround(col, row);
      this._resetMine();
      this._attackAnim = 120;
    }
  }

  _tryPlace() {
    if (this._placeCd > 0 || this.espectador) return; // el espectador no toca nada
    // Clic derecho sobre una mesa / horno / cofre al alcance: se abre.
    if (this._hoverTile) {
      const { col: hc, row: hr } = this._hoverTile;
      const hid = this.tilemap.get(hc, hr);
      if (SurviConfig.STATION_IDS.has(hid) && this._inReach(hc, hr)) {
        this.openStation(hc, hr);
        return;
      }
      // cama (dormir / guardar el punto de reaparición) y puerta (abrir /
      // cerrar): una vez por pulsación, aunque mantengas apretado
      // TNT + flint en la mano: se prende
      const enMano = this.hotbarSlots[this.selectedSlot];
      if (hid === SurviConfig.TID.tnt && enMano === SurviConfig.MAT.flint && this._inReach(hc, hr)) {
        if (this._usoPulsacion) return;
        this._usoPulsacion = true;
        this.encenderTnt(hc, hr);
        return;
      }
      if ((SurviConfig.BED_IDS.has(hid) || SurviConfig.DOOR_IDS.has(hid)) && this._inReach(hc, hr)) {
        if (this._usoPulsacion) return;
        this._usoPulsacion = true;
        if (SurviConfig.BED_IDS.has(hid)) this._usarCama(hid === SurviConfig.TID.bed_l ? hc : hc - 1, hr);
        else this._alternarPuerta(hc, hr, true);
        return;
      }
    }
    // Comida: no es colocable, así que el mismo botón (clic derecho) la
    // come en vez de intentar plantarla en el mundo. No depende de estar
    // apuntando a un tile — comer no necesita puntería.
    const heldId = this.hotbarSlots[this.selectedSlot];
    const heldInfo = heldId ? SurviConfig.ITEM_INFO[heldId] : null;
    if (heldInfo && heldInfo.cubo !== undefined) {
      this._usarCubo(heldId, heldInfo);
      return;
    }
    // Caña: tira o recoge la boya (una vez por pulsación)
    if (heldInfo && heldInfo.cana) {
      if (this._usoPulsacion) return;
      this._usoPulsacion = true;
      this._usarCana(heldId);
      return;
    }
    // Comida de un animal apuntando a ese animal: le das de comer (crianza)
    if (heldInfo && this._alimentarAnimal(heldId)) return;
    // Azada: arar la tierra / el pasto apuntado
    if (heldInfo && heldInfo.azada) {
      this._usarAzada(heldId);
      return;
    }
    // Semillas / zanahoria / papa: si apuntás arriba de tierra arada, se planta
    // (la zanahoria y la papa, si no, se comen)
    if (heldInfo && heldInfo.planta && this._plantar(heldId, heldInfo.planta)) return;
    if (heldInfo && heldInfo.vidaExtra) {
      if (this._usoPulsacion) return; // uno por clic
      this._usoPulsacion = true;
      this._usarCorazon(heldId);
      return;
    }
    if (heldInfo && heldInfo.food) {
      this._eat(heldId, heldInfo);
      return;
    }
    if (!this._hoverTile) return;
    const { col, row } = this._hoverTile;
    // Pared / ventana: van a la capa de fondo (detrás de lo que haya, si no es sólido)
    if (heldInfo && heldInfo.fondo) {
      const i = row * SurviConfig.COLS + col;
      if (!this._inReach(col, row) || this.fondo[i] || this._solidoEn(col, row) || (this.inventory[heldId] || 0) <= 0) return;
      this.fondo[i] = heldInfo.fondo;
      this._fondoN++;
      if (!this.creativo) this._removeItem(heldId); // creativo: no se gasta
      this._placeCd = SurviConfig.PLACE_COOLDOWN;
      this.sonar('colocar', col * SurviConfig.TILE + 8, row * SurviConfig.TILE + 8, { material: SurviGame.materialDe(heldInfo.fondo) });
      return;
    }
    if (heldInfo && heldInfo.place === SurviConfig.TID.bed_l) {
      this._colocarCama(col, row, heldId);
      return;
    }
    if (heldInfo && heldInfo.place === SurviConfig.TID.door_bot) {
      this._colocarPuerta(col, row, heldId);
      return;
    }
    // (el pasto y las flores se reemplazan, como en Minecraft)
    if (!this._inReach(col, row) || !SurviConfig.esAire(this.tilemap.get(col, row))) return;
    const id = this.hotbarSlots[this.selectedSlot];
    const info = id ? SurviConfig.ITEM_INFO[id] : null;
    if (!info || !info.place || (this.inventory[id] || 0) <= 0) return; // las herramientas no se colocan

    if (info.place === SurviConfig.TID.ladder && !this._apoyoEscalera(col, row)) return; // escalera en el aire no
    // Antorcha: se elige la forma según dónde se apoya (piso o pared)
    let colocar = info.place;
    if (info.place === SurviConfig.T.TORCH) {
      colocar = this._varianteAntorcha(col, row);
      if (!colocar) return; // en el aire no
      if (this.fluidos.tipo(col, row)) return; // no se prende bajo el agua
    }
    // mesa/horno/cofre: se apoyan sobre un bloque sólido
    if (
      SurviConfig.STATION_IDS.has(info.place) &&
      !(row + 1 < SurviConfig.ROWS && SurviConfig.SOLID_IDS.has(this.tilemap.get(col, row + 1)))
    )
      return;
    const bx = col * SurviConfig.TILE,
      by = row * SurviConfig.TILE;
    const overlapsPlayer =
      SurviConfig.SOLID_IDS.has(info.place) &&
      bx < this.player.x + this.player.w &&
      bx + SurviConfig.TILE > this.player.x &&
      by < this.player.y + this.player.h &&
      by + SurviConfig.TILE > this.player.y;
    if (overlapsPlayer) return;
    const antes = this.tilemap.get(col, row);
    if (antes && SurviConfig.DECO_IDS.has(antes)) this.tilemap.breakTile(col, row); // se pisa el pasto
    if (this.tilemap.placeTile(col, row, colocar)) {
      if (!this.creativo) this._removeItem(id); // creativo: los bloques no se gastan
      this.fluidos.quitar(col, row); // el bloque desplaza el agua/lava que había
      this._retileAround(col, row);
      this._placeCd = SurviConfig.PLACE_COOLDOWN;
      this.sonar('colocar', col * SurviConfig.TILE + 8, row * SurviConfig.TILE + 8, { material: SurviGame.materialDe(colocar) });
      this.particulas.polvo(col, row);
    }
  }

  _eat(id, info) {
    if ((this.inventory[id] || 0) <= 0) return;
    this.sonar('comer');
    this.hunger = Math.min(SurviConfig.MAX_HUNGER, this.hunger + info.food);
    this._removeItem(id);
    this._placeCd = SurviConfig.PLACE_COOLDOWN;
    this._renderHunger();
  }

  // ═══════════ Autotile en caliente ═══════════
  // Al romper o colocar un bloque cambian los bordes del tile y de sus 4
  // vecinos: la tierra que estaba tapada pasa a tener pasto arriba, la
  // pared del túnel se cierra, la copa del árbol se recorta. Es la misma
  // función que usa el generador (survi_world.js), así que el resultado
  // es idéntico al de un mundo recién creado.
  //
  // Solo el propio tile y los 4 vecinos: las diagonales no entran en la
  // máscara, así que recalcularlas sería trabajo al aire.
  // ¿La caja de una criatura no toca ningún bloque sólido?
  _cajaLibre(c) {
    const T = SurviConfig.TILE;
    for (let col = Math.floor(c.x / T); col <= Math.floor((c.x + c.w - 1) / T); col++)
      for (let row = Math.floor(c.y / T); row <= Math.floor((c.y + c.h - 1) / T); row++) if (this.tilemap.isSolidAt(col, row)) return false;
    return true;
  }

  // ¿La caja (x, y, w, h del jugador) toca algún bloque sólido?
  _cajaEnSolido(x, y) {
    const T = SurviConfig.TILE, p = this.player;
    const c0 = Math.floor(x / T), c1 = Math.floor((x + p.w - 1) / T);
    const r0 = Math.floor(y / T), r1 = Math.floor((y + p.h - 1) / T);
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) if (this.tilemap.isSolidAt(c, r)) return true;
    return false;
  }

  // Movimiento de creativo volando y de espectador:
  //  • volando: saltar sube, abajo baja; en creativo chocás con los bloques,
  //    como espectador atravesás todo.
  //  • espectador caminando: atravesás las paredes, pero te parás en el piso
  //    (si estás metido adentro de un bloque, flotás a esa altura; saltar sube).
  _moverEspecial(left, right, jump, abajo, step) {
    const p = this.player, T = SurviConfig.TILE, V = SurviConfig.VUELO_VEL;
    const E = SurviGame.E2D();
    this._enFluido = { agua: false, lava: false, cabeza: 0 };
    this._fallFromY = null;
    if (this.volando) {
      p.vx = ((right ? 1 : 0) - (left ? 1 : 0)) * V;
      p.vy = jump ? -V : abajo ? V : 0;
      if (this.espectador) {
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.grounded = false;
      } else E.Physics.resolveTileCollisions(p, this.tilemap, step);
    } else {
      // (vx ya viene de caminar)
      p.x += p.vx * step;
      if (this._cajaEnSolido(p.x, p.y)) {
        p.vy = jump ? -V * 0.6 : abajo ? V * 0.6 : 0;
        p.y += p.vy * step;
        p.grounded = false;
      } else {
        if (jump && p.grounded) p.vy = SurviConfig.JUMP_VEL;
        E.Physics.applyGravity(p, step);
        let ny = p.y + p.vy * step;
        p.grounded = false;
        if (p.vy > 0) {
          // aterriza si los pies entran a un bloque viniendo desde el aire
          const antes = Math.floor((p.y + p.h - 1) / T), despues = Math.floor((ny + p.h - 1) / T);
          const c0 = Math.floor(p.x / T), c1 = Math.floor((p.x + p.w - 1) / T);
          for (let r = antes + 1; r <= despues && !p.grounded; r++) {
            for (let c = c0; c <= c1; c++) {
              if (!this.tilemap.isSolidAt(c, r)) continue;
              ny = r * T - p.h;
              p.vy = 0;
              p.grounded = true;
              break;
            }
          }
        }
        p.y = ny;
      }
    }
    p.y = Math.max(-T * 4, Math.min(SurviConfig.WORLD_H - p.h - T * 3, p.y));
  }

  // ¿El jugador está tocando una escalera? (columna del centro, de la cabeza a los pies)
  _enEscalera() {
    const T = SurviConfig.TILE, p = this.player;
    const c = Math.floor((p.x + p.w / 2) / T);
    const r0 = Math.floor(p.y / T), r1 = Math.floor((p.y + p.h - 1) / T);
    for (let r = r0; r <= r1; r++) if (this.tilemap.get(c, r) === SurviConfig.TID.ladder) return true;
    return false;
  }

  // Escalera: se apoya en el piso, en otra escalera (arriba o abajo), en un
  // bloque de al lado o en una pared de fondo.
  _apoyoEscalera(c, r) {
    const L = SurviConfig.TID.ladder;
    return (
      this._solidoEn(c, r + 1) ||
      this.tilemap.get(c, r + 1) === L ||
      this.tilemap.get(c, r - 1) === L ||
      this._solidoEn(c - 1, r) ||
      this._solidoEn(c + 1, r) ||
      !!(this.fondo && this.fondo[r * SurviConfig.COLS + c])
    );
  }

  _solidoEn(c, r) {
    return c >= 0 && c < SurviConfig.COLS && r >= 0 && r < SurviConfig.ROWS && SurviConfig.SOLID_IDS.has(this.tilemap.get(c, r));
  }

  // Antorcha: qué forma lleva en (col, row). Primero el piso; si no hay,
  // agarrada de la pared de la izquierda o de la derecha. 0 = no se puede.
  _varianteAntorcha(col, row) {
    if (this._solidoEn(col, row + 1)) return SurviConfig.TID.torch;
    if (this._solidoEn(col - 1, row)) return SurviConfig.TID.torch_wl;
    if (this._solidoEn(col + 1, row)) return SurviConfig.TID.torch_wr;
    return 0;
  }

  // ¿Lo que hay en (c, r) sigue apoyado? (antorchas según su forma; pasto y
  // flores necesitan el bloque de abajo). Lo demás no se cae.
  _tieneApoyo(c, r) {
    const id = this.tilemap.get(c, r);
    // colgantes (enredadera, carámbano, estalactita): de lo de arriba
    if (SurviConfig.COLGANTES.has(id)) return this._solidoEn(c, r - 1) || SurviConfig.COLGANTES.has(this.tilemap.get(c, r - 1));
    if (id === SurviConfig.TID.stalagmite_tip && this.tilemap.get(c, r + 1) === SurviConfig.TID.stalagmite_base) return true;
    if (id === SurviConfig.TID.torch || SurviConfig.DECO_IDS.has(id)) return this._solidoEn(c, r + 1);
    if (id === SurviConfig.TID.torch_wl) return this._solidoEn(c - 1, r);
    if (id === SurviConfig.TID.torch_wr) return this._solidoEn(c + 1, r);
    if (SurviConfig.BED_IDS.has(id)) return this._solidoEn(c, r + 1);
    if (id === SurviConfig.TID.ladder) return this._apoyoEscalera(c, r);
    if (SurviConfig.CULTIVO_DE.has(id)) return SurviConfig.FARMLAND_IDS.has(this.tilemap.get(c, r + 1));
    if (id === SurviConfig.TID.door_bot || id === SurviConfig.TID.door_bot_o) return this._solidoEn(c, r + 1);
    if (id === SurviConfig.TID.door_top || id === SurviConfig.TID.door_top_o) return this._esPuertaAbajo(c, r + 1);
    return true;
  }

  _esPuertaAbajo(c, r) {
    const id = this.tilemap.get(c, r);
    return id === SurviConfig.TID.door_bot || id === SurviConfig.TID.door_bot_o;
  }

  // Se rompió un bloque: la antorcha que colgaba de él se cae (vuelve al
  // inventario) y el pasto/las flores de arriba desaparecen.
  _soltarSinApoyo(col, row) {
    for (const [c, r] of [
      [col, row - 1],
      [col, row + 1],
      [col - 1, row],
      [col + 1, row],
    ]) {
      if (c < 0 || c >= SurviConfig.COLS || r < 0 || r >= SurviConfig.ROWS || this._tieneApoyo(c, r)) continue;
      const id = this.tilemap.breakTile(c, r);
      // lo que se cae suelta su ítem al suelo
      if (SurviConfig.TORCH_IDS.has(id)) this._soltarEnCelda(SurviConfig.T.TORCH, 1, c, r);
      if (SurviConfig.CULTIVO_DE.has(id)) this._cosechar_cultivo(c, r, id); // se quedó sin tierra arada
      if (SurviConfig.DROPS[id] === id && SurviConfig.DECO_IDS.has(id)) this._soltarEnCelda(id, 1, c, r); // hongo brillante
      // una enredadera / estalactita / estalagmita arrastra a lo que tenía pegado
      if (SurviConfig.COLGANTES.has(id) || id === SurviConfig.TID.stalagmite_base) this._soltarSinApoyo(c, r);
      if (id === SurviConfig.TID.ladder) {
        this._soltarEnCelda(id, 1, c, r);
        this._soltarSinApoyo(c, r); // la escalera de arriba/abajo puede quedar colgando
      }
      // cama / puerta sin apoyo: se desarma entera
      if (SurviConfig.BED_IDS.has(id) || SurviConfig.DOOR_IDS.has(id)) {
        this._romperCompanero(c, r, id);
        this._soltarEnCelda(SurviConfig.DROPS[id], 1, c, r);
      }
    }
  }

  // ═══════════ Cama y puerta (muebles de 2 bloques) ═══════════
  // Se rompió una mitad: se saca la otra (sin soltar nada: el ítem ya salió).
  _romperCompanero(col, row, id) {
    const T = SurviConfig.TID;
    let otro = null;
    if (id === T.bed_l) otro = [col + 1, row, T.bed_r];
    else if (id === T.bed_r) otro = [col - 1, row, T.bed_l];
    else if (id === T.door_bot || id === T.door_bot_o) otro = [col, row - 1, id === T.door_bot ? T.door_top : T.door_top_o];
    else if (id === T.door_top || id === T.door_top_o) otro = [col, row + 1, id === T.door_top ? T.door_bot : T.door_bot_o];
    if (!otro) return;
    const [c, r, esperado] = otro;
    if (this.tilemap.get(c, r) === esperado) {
      this.tilemap.breakTile(c, r);
      this._retileAround(c, r);
    }
    if (SurviConfig.DOOR_IDS.has(id)) this._puertasAuto.delete(`${col},${id === T.door_top || id === T.door_top_o ? row + 1 : row}`);
    if (this.cama && SurviConfig.BED_IDS.has(id) && this.tilemap.get(this.cama.col, this.cama.row) !== T.bed_l) {
      this.cama = null;
      this.spawn = this._spawnMundo || this.spawn;
      if (this.ui.showToast) this.ui.showToast('Rompiste tu cama: perdiste el punto de reaparición');
    }
  }

  // Cama: 2 bloques de aire lado a lado, con piso sólido abajo de los dos.
  // Se intenta con la celda apuntada a la izquierda y, si no entra, a la derecha.
  _colocarCama(col, row, itemId) {
    if (!this._inReach(col, row) || (this.inventory[itemId] || 0) <= 0) return;
    const entra = (c) =>
      SurviConfig.esAire(this.tilemap.get(c, row)) &&
      SurviConfig.esAire(this.tilemap.get(c + 1, row)) &&
      this._solidoEn(c, row + 1) &&
      this._solidoEn(c + 1, row + 1) &&
      !this.fluidos.tipo(c, row) &&
      !this.fluidos.tipo(c + 1, row);
    const c = entra(col) ? col : entra(col - 1) ? col - 1 : null;
    if (c === null) {
      if (this.ui.showToast) this.ui.showToast('La cama necesita 2 bloques libres con piso');
      this._placeCd = 600; // que no repita el aviso mientras mantenés apretado
      return;
    }
    for (const cc of [c, c + 1]) if (SurviConfig.DECO_IDS.has(this.tilemap.get(cc, row))) this.tilemap.breakTile(cc, row);
    this.tilemap.placeTile(c, row, SurviConfig.TID.bed_l);
    this.tilemap.placeTile(c + 1, row, SurviConfig.TID.bed_r);
    if (!this.creativo) this._removeItem(itemId);
    this._retileAround(c, row);
    this._retileAround(c + 1, row);
    this._placeCd = SurviConfig.PLACE_COOLDOWN;
    this._usoPulsacion = true; // el mismo clic no la usa
  }

  // Puerta: 2 de alto (la celda apuntada es la de abajo; si no entra, la de
  // arriba), con piso sólido. No se coloca encima tuyo (cerrada es sólida).
  _colocarPuerta(col, row, itemId) {
    if (!this._inReach(col, row) || (this.inventory[itemId] || 0) <= 0) return;
    const entra = (r) =>
      SurviConfig.esAire(this.tilemap.get(col, r)) &&
      SurviConfig.esAire(this.tilemap.get(col, r - 1)) &&
      this._solidoEn(col, r + 1) &&
      !this.fluidos.tipo(col, r) &&
      !this.fluidos.tipo(col, r - 1);
    const abajo = entra(row) ? row : entra(row + 1) ? row + 1 : null;
    if (abajo === null) {
      if (this.ui.showToast) this.ui.showToast('La puerta necesita 2 bloques libres de alto con piso');
      this._placeCd = 600;
      return;
    }
    const T = SurviConfig.TILE;
    const toca = (e) => e.x < (col + 1) * T && e.x + e.w > col * T && e.y < (abajo + 1) * T && e.y + e.h > (abajo - 1) * T;
    if (toca(this.player)) return;
    for (const r of [abajo, abajo - 1]) if (SurviConfig.DECO_IDS.has(this.tilemap.get(col, r))) this.tilemap.breakTile(col, r);
    this.tilemap.placeTile(col, abajo, SurviConfig.TID.door_bot);
    this.tilemap.placeTile(col, abajo - 1, SurviConfig.TID.door_top);
    if (!this.creativo) this._removeItem(itemId);
    this._retileAround(col, abajo);
    this._retileAround(col, abajo - 1);
    this._placeCd = SurviConfig.PLACE_COOLDOWN;
    this._usoPulsacion = true; // el mismo clic no la usa
  }

  // Abre o cierra la puerta que tiene una parte en (col, row).
  // manual: con el botón de interactuar (queda así hasta que la vuelvas a tocar).
  // Devuelve true si cambió.
  _alternarPuerta(col, row, manual) {
    const T = SurviConfig.TID;
    const id = this.tilemap.get(col, row);
    const abajo = id === T.door_top || id === T.door_top_o ? row + 1 : row;
    const cerrada = this.tilemap.get(col, abajo) === T.door_bot;
    if (!cerrada && !this._puertaLibre(col, abajo)) {
      if (manual && this.ui.showToast) this.ui.showToast('Hay algo en la puerta');
      return false;
    }
    this.tilemap.set(col, abajo, cerrada ? T.door_bot_o : T.door_bot);
    this.tilemap.set(col, abajo - 1, cerrada ? T.door_top_o : T.door_top);
    if (manual || !cerrada) this._puertasAuto.delete(`${col},${abajo}`);
    this.light.updateColumn((c, r) => this.tilemap.get(c, r), col);
    this._lightDirty = true;
    this.fluidos.activar(col, abajo);
    this.fluidos.activar(col, abajo - 1);
    this.sonar('puerta', col * SurviConfig.TILE + 8, abajo * SurviConfig.TILE, { abrir: cerrada });
    return true;
  }

  // ¿Nadie está parado adentro de la puerta? (si no, cerrarla lo trabaría)
  _puertaLibre(col, abajo) {
    const T = SurviConfig.TILE;
    const toca = (e) => e.x < (col + 1) * T && e.x + e.w > col * T && e.y < (abajo + 1) * T && e.y + e.h > (abajo - 1) * T;
    return !toca(this.player) && !this.enemies.some(toca) && !this.animals.some(toca);
  }

  // Puertas automáticas: caminando contra una puerta cerrada, se abre sola;
  // cuando te alejás, se cierra sola. (Las que abriste a mano no se tocan.)
  _puertasAutomaticas(dir) {
    const T = SurviConfig.TILE, TID = SurviConfig.TID, p = this.player;
    if (dir) {
      const c = Math.floor((dir > 0 ? p.x + p.w + 1 : p.x - 1) / T);
      const r0 = Math.floor(p.y / T), r1 = Math.floor((p.y + p.h - 1) / T);
      for (let r = r0; r <= r1; r++) {
        const id = this.tilemap.get(c, r);
        if (id !== TID.door_bot && id !== TID.door_top) continue;
        const abajo = id === TID.door_top ? r + 1 : r;
        if (this._alternarPuerta(c, abajo, false)) this._puertasAuto.set(`${c},${abajo}`, true);
        break;
      }
    }
    for (const k of this._puertasAuto.keys()) {
      const [c, abajo] = k.split(',').map(Number);
      if (this.tilemap.get(c, abajo) !== TID.door_bot_o) {
        this._puertasAuto.delete(k);
        continue;
      }
      const lejos = Math.abs(p.x + p.w / 2 - (c * T + T / 2)) > T * 1.4 || Math.abs(p.y + p.h / 2 - abajo * T) > T * 2.5;
      if (lejos && this._puertaLibre(c, abajo)) {
        this._alternarPuerta(c, abajo, false);
        this._puertasAuto.delete(k);
      }
    }
  }

  // Punto de reaparición parado al lado de la cama (encima de la mitad izquierda).
  _spawnDeCama(cama) {
    return { col: cama.col, row: cama.row, x: cama.col * SurviConfig.TILE + 2, y: (cama.row + 1) * SurviConfig.TILE - 24 };
  }

  // Tocar la cama: guarda el punto de reaparición y te acostás (a cualquier
  // hora). Acostado, el tiempo pasa SUENO_VELOCIDAD veces más rápido; te
  // levantás con saltar o moviéndote (o si te pegan / rompen la cama).
  _usarCama(col, row) {
    if (this.durmiendo) return;
    this.cama = { col, row };
    this.spawn = this._spawnDeCama(this.cama);
    const toast = (m) => this.ui.showToast && this.ui.showToast(m);
    if (this.invisible) {
      toast('Punto de reaparición guardado');
      return;
    }
    const T = SurviConfig.TILE;
    const cerca = this.enemies.some(
      (e) => !e.estaMuerto() && e.esAgresivo(this) && Math.abs(e.x - this.player.x) < 10 * T && Math.abs(e.y - this.player.y) < 6 * T,
    );
    if (cerca) {
      toast('No podés dormir: hay monstruos cerca · punto de reaparición guardado');
      return;
    }
    if (this.lunaSangre) {
      toast('No podés dormir en luna de sangre · punto de reaparición guardado');
      return;
    }
    this.durmiendo = { col, row };
    const p = this.player;
    p.vx = p.vy = 0;
    p.x = (col + 1) * T - p.w / 2; // al medio de la cama (2 de ancho)
    p.y = (row + 1) * T - p.h;
    this._fallFromY = null;
    this.pointer.down = false;
    this._resetMine();
    toast(`Durmiendo (el tiempo pasa x${SurviConfig.SUENO_VELOCIDAD}) · saltá o movete para levantarte`);
    this.sonar('dormir');
  }

  // Levantarse: quedás parado al lado de la cama.
  _despertar() {
    if (!this.durmiendo) return;
    this.durmiendo = null;
    const p = this.player;
    p.x = this.spawn.x;
    p.y = this.spawn.y;
    p.vx = p.vy = 0;
    this._fallFromY = null;
    this.save();
  }

  static FUNDIDO_MS = 1400;

  // Al anochecer se sortea la luna de sangre; al amanecer se termina.
  _cambioNoche() {
    const noche = this.esNoche;
    if (noche === this._eraNoche) return;
    this._eraNoche = noche;
    const LS = SurviConfig.LUNA_SANGRE, toast = (m) => this.ui.showToast && this.ui.showToast(m);
    if (noche && this.dias >= LS.desdeDia && Math.random() < LS.chance) {
      this.lunaSangre = true;
      if (this.durmiendo) this._despertar(); // te despierta
      toast('¡Luna de sangre! Los monstruos están más fuertes esta noche');
      this.sonar('zombie');
    } else if (!noche && this.lunaSangre) {
      this.lunaSangre = false;
      toast('Terminó la luna de sangre');
    }
    this._aplicarLunaSangre();
  }

  // Lo que cambia a la vista con la luna de sangre: lluvia roja y oscuridad rojiza.
  _aplicarLunaSangre() {
    if (this.clima) this.clima.sangre = this.lunaSangre;
    if (this.light) this.light.colorOscuro = this.lunaSangre ? SurviConfig.LUNA_SANGRE.oscuridad : null;
    this._lightDirty = true;
  }

  // Luz propia del personaje: más grande con una antorcha en la mano.
  get _luzPropia() {
    const id = Number(this.hotbarSlots[this.selectedSlot]);
    const casco = this.equipment && this.equipment.head ? SurviConfig.ITEM_INFO[this.equipment.head] : null;
    let luz = SurviConfig.PLAYER_VISION;
    if (casco && casco.luz) luz = Math.max(luz, casco.luz); // casco de minero
    if (id === SurviConfig.TID.torch && !this.durmiendo) luz = Math.max(luz, SurviConfig.ANTORCHA_MANO_LUZ);
    return luz;
  }

  // Vida máxima: la base + lo que sumaron los corazones de vida.
  get maxHp() {
    return SurviConfig.MAX_HP + (this.corazones || 0) * SurviConfig.CORAZON_VIDA.vida;
  }

  // ¿Tenés alas? (en el inventario / la barra): se puede volar en supervivencia.
  get tieneAlas() {
    return (this.inventory && this.inventory[SurviConfig.ESPECIAL.alas]) > 0;
  }

  // Corazón de vida (clic derecho): +vida máxima para siempre, hasta el tope.
  _usarCorazon(id) {
    const C = SurviConfig.CORAZON_VIDA, toast = (m) => this.ui.showToast && this.ui.showToast(m);
    if ((this.inventory[id] || 0) <= 0) return;
    if (this.corazones >= C.max) {
      toast(`Ya tenés la vida máxima (${this.maxHp})`);
      return;
    }
    this.corazones++;
    this._removeItem(id);
    this.hp = Math.min(this.maxHp, this.hp + C.vida);
    this._renderHealth();
    this.sonar('craftear');
    this.particulas.chispas(this.player.x + this.player.w / 2, this.player.y + 4, ['#ff4a55', '#ff9aa0', '#ffffff'], 10);
    toast(`Vida máxima: ${this.maxHp} (${this.corazones}/${C.max})`);
  }

  _nuevoDia() {
    this.dias++;
    if (this.dias === this.dif.ojosDesde && !this.creativo && this.ui.showToast) this.ui.showToast(`Día ${this.dias}: de noche empiezan a aparecer ojos voladores…`);
  }

  _retileAround(col, row) {
    if (this.light) this.light.updateColumn((c, r) => this.tilemap.get(c, r), col);
    this._lightDirty = true;
    this._soltarSinApoyo(col, row);
    const tm = this.tilemap;
    // Afuera del mapa se devuelve el tile del borde (y aire arriba del
    // cielo), igual que en el generador: si no, los laterales del mundo
    // dibujarían pasto contra la nada.
    const get = (c, r) => {
      if (r < 0) return 0;
      const cc = c < 0 ? 0 : c >= SurviConfig.COLS ? SurviConfig.COLS - 1 : c;
      const rr = r >= SurviConfig.ROWS ? SurviConfig.ROWS - 1 : r;
      return tm.get(cc, rr);
    };
    for (const [c, r] of [
      [col, row],
      [col, row - 1],
      [col, row + 1],
      [col - 1, row],
      [col + 1, row],
    ]) {
      if (c < 0 || c >= SurviConfig.COLS || r < 0 || r >= SurviConfig.ROWS) continue;
      const id = tm.get(c, r);
      if (id === 0) continue;
      const next = GeneradorMundo.autotileId(get, c, r);
      if (next !== id) tm.set(c, r, next);
    }
  }

  // Con cualquier cosa en la mano (o la mano vacía) se puede pegar, pero
  // no todas pegan igual: la espada es la única pensada para pelear (más
  // rápida, más alcance, daño completo + su power); el resto de las
  // herramientas golpea peor, y a mano limpia es lo más flojo.
  _tryAttack() {
    if (this._attackCd > 0 || this.espectador) return;
    const tool = this.heldTool;
    const stats = (tool && SurviConfig.WEAPON_STATS[tool.tool]) || SurviConfig.BARE_HAND_ATTACK;
    // Nunca arranca otro golpe antes de que termine la animación del anterior.
    this._attackCd = Math.max(stats.cooldown, SurviGame.SWING_ATTACK_MS);
    this._attackAnim = 160;
    this._startSwing(SurviGame.SWING_ATTACK_MS, true);
    this._golpe = {
      dmg: SurviConfig.ATTACK_DMG * stats.dmgMult + (tool && tool.tool === 'sword' ? tool.power * 2 : 0),
      herramienta: tool ? this.hotbarSlots[this.selectedSlot] : null,
      arco: SurviConfig.GOLPE_ARCO[tool && tool.tool === 'sword' ? 'espada' : 'normal'],
      golpeados: new Set(), // a quién ya le pegó esta animación
    };
    this._aplicarGolpe();
  }

  // Centro del arco: el medio del sprite (los pies están en el borde de abajo de la caja).
  _centroGolpe() {
    const p = this.player;
    return { x: p.x + p.w / 2, y: p.y + p.h - SurviConfig.PLAYER_SPRITE.h / 2 };
  }

  // ¿El rectángulo r toca el arco? El arco es media elipse hacia donde mira el
  // jugador: se toma el punto del rectángulo más cercano al centro y se chequea
  // que caiga adentro de la elipse y del lado de adelante.
  _tocaArco(r, arco) {
    const T = SurviConfig.TILE, f = this.player.facing;
    const c = this._centroGolpe();
    const rx = arco.adelante * T, ry = arco.vertical * T, atras = arco.atras * T;
    // del lado de adelante: alguna parte del rectángulo pasa el borde recto
    if (f > 0 ? r.x + r.w < c.x - atras : r.x > c.x + atras) return false;
    const px = Math.max(r.x, Math.min(c.x, r.x + r.w));
    const py = Math.max(r.y, Math.min(c.y, r.y + r.h));
    const dx = (px - c.x) / rx, dy = (py - c.y) / ry;
    return dx * dx + dy * dy <= 1;
  }

  // Se llama cada frame mientras dura la animación del golpe: le pega a toda
  // criatura que entre en el arco, pero a cada una UNA sola vez por animación.
  _aplicarGolpe() {
    const g = this._golpe;
    if (!g) return;
    if (this._swing.t >= this._swing.dur) {
      this._golpe = null; // terminó la animación
      return;
    }
    // Enemigos y animales son Criaturas: reciben el golpe igual (cada una
    // reacciona a su manera, ej. los animales huyen).
    for (const lista of [this.enemies, this.animals]) {
      for (const c of lista) {
        if (c.estaMuerto() || g.golpeados.has(c) || !this._tocaArco(c, g.arco)) continue;
        g.golpeados.add(c);
        this._golpearCriatura(c, g.dmg, this.player.facing);
        if (g.herramienta) this._usarHerramienta(g.herramienta); // cada mob golpeado gasta el arma
      }
    }
  }

  // Un golpe del jugador (cuerpo a cuerpo o flecha) a una criatura.
  _golpearCriatura(c, dmg, dir) {
    this.sonar('pegar', c.x + c.w / 2, c.y);
    this.sonar(SurviGame.VOZ[c.tipo] || '', c.x + c.w / 2, c.y); // su quejido
    c.recibirGolpe(dmg, dir);
    if (c instanceof Animal) {
      // Pánico: los de su especie que están cerca también salen corriendo.
      for (const o of this.animals) {
        if (o !== c && o.tipo === c.tipo && Math.abs(o.x - c.x) < 6 * SurviConfig.TILE) o.asustar(this.player.x);
      }
    }
    // animales y enemigos sueltan lo suyo al morir por tu golpe
    if (c.estaMuerto()) this._cosechar(c);
  }

  // ═══════════ Arco ═══════════
  // Dispara hacia el mouse. Cada tiro gasta 1 flecha y 1 uso del arco; la
  // cadencia depende del arco.
  _dispararArco(id, stats) {
    if (this._arcoCd > 0) return;
    const flecha = SurviConfig.MAT.arrow;
    if (!(this.inventory[flecha] > 0)) {
      if (this._avisoFlechasMs <= 0 && this.ui.showToast) this.ui.showToast('No tenés flechas');
      this._avisoFlechasMs = 1500;
      return;
    }
    const p = this.player;
    const ox = p.x + p.w / 2, oy = p.y + 6; // desde el hombro
    let dx = this.player.facing, dy = 0;
    if (this._pointerWorld) {
      dx = this._pointerWorld.x - ox;
      dy = this._pointerWorld.y - oy;
    }
    const largo = Math.hypot(dx, dy) || 1;
    dx /= largo;
    dy /= largo;
    if (dx !== 0) p.facing = Math.sign(dx);
    this.flechas.push(new Flecha(ox + dx * 8, oy + dy * 8, dx * stats.velocidad, dy * stats.velocidad, stats.danio));
    this._arcoCd = stats.cadenciaMs;
    this.sonar('arco');
    this._attackAnim = 120;
    this._removeItem(flecha, 1);
    this._usarHerramienta(id);
  }

  // Juntar una flecha clavada. false si no entra en el inventario.
  _recogerFlecha() {
    const flecha = SurviConfig.MAT.arrow;
    if (!this._hasRoomFor(flecha)) return false;
    this._addItem(flecha, 1);
    return true;
  }

  // ═══════════ Agua y lava ═══════════
  // Lava: quema mientras la tocás y te deja quemándote un rato (el agua la
  // apaga). Aire: con la cabeza abajo del agua se gasta; sin aire te ahogás.
  _efectosFluidos(dt) {
    const fl = this._enFluido;
    if (fl.lava) {
      this._lavaMs += dt;
      if (this._lavaMs >= SurviConfig.LAVA_DANIO_MS) {
        this._lavaMs = 0;
        this._damage(SurviConfig.LAVA_DANIO, { ignoreInvuln: true, origen: 'fuego' });
      }
      this.quemaduraMs = SurviConfig.QUEMADURA_MS;
    } else {
      this._lavaMs = SurviConfig.LAVA_DANIO_MS; // al volver a tocarla, quema al instante
      if (fl.agua) this.quemaduraMs = 0; // el agua apaga el fuego
      if (this.quemaduraMs > 0) {
        this.quemaduraMs -= dt;
        this._quemTick += dt;
        if (this._quemTick >= SurviConfig.QUEMADURA_TICK_MS) {
          this._quemTick = 0;
          this._damage(SurviConfig.QUEMADURA_DANIO, { ignoreInvuln: true, origen: 'fuego' });
        }
      } else this._quemTick = 0;
    }
    if (fl.cabeza) {
      this.aireMs = Math.max(0, this.aireMs - dt);
      if (this.aireMs <= 0) {
        this._ahogoMs += dt;
        if (this._ahogoMs >= SurviConfig.AHOGO_TICK_MS) {
          this._ahogoMs = 0;
          this._damage(SurviConfig.AHOGO_DANIO, { ignoreInvuln: true, origen: 'ahogo' });
        }
      }
    } else {
      this.aireMs = Math.min(SurviConfig.AIRE_MAX_MS, this.aireMs + dt * 4); // se recupera rápido
      this._ahogoMs = 0;
    }
    this._renderAire();
  }

  // Burbujas de aire en el HUD: se ven solo mientras te falta aire.
  _renderAire() {
    const burbujas = Math.ceil((this.aireMs / SurviConfig.AIRE_MAX_MS) * 10);
    if (burbujas === this._burbujasShown) return;
    this._burbujasShown = burbujas;
    if (this.ui.mostrarAire) this.ui.mostrarAire(burbujas, 10);
  }

  // La lava tocó agua: esa celda se vuelve piedra.
  _solidificarLava(c, r) {
    if (this.tilemap.get(c, r) !== 0) return;
    this.tilemap.placeTile(c, r, SurviConfig.T.STONE);
    this._retileAround(c, r);
  }

  // Cubo vacío: junta agua/lava. Cubo lleno: la vuelca en una celda de aire.
  _usarCubo(id, info) {
    if (!this._hoverTile || (this.inventory[id] || 0) <= 0) return;
    const { col, row } = this._hoverTile;
    if (!this._inReach(col, row)) return;
    let nuevo;
    if (info.cubo === 0) {
      const tipo = this.fluidos.tipo(col, row);
      if (!tipo) return;
      nuevo = tipo === CapaFluidos.AGUA ? SurviConfig.CUBO.agua : SurviConfig.CUBO.lava;
      if (this.inventory[id] > 1 && !this._hasRoomFor(nuevo)) {
        if (this.ui.showToast) this.ui.showToast('Inventario lleno');
        return;
      }
      if (!this.fluidos.juntar(col, row)) {
        if (this.ui.showToast) this.ui.showToast(`Hay muy poca ${tipo === CapaFluidos.AGUA ? 'agua' : 'lava'} para llenar el cubo`);
        return;
      }
    } else {
      if (this.tilemap.get(col, row) !== 0) return;
      const t = this.fluidos.tipo(col, row);
      if (t && t !== info.cubo) return;
      this.fluidos.poner(col, row, info.cubo);
      nuevo = SurviConfig.CUBO.vacio;
    }
    this._removeItem(id, 1);
    this._addItem(nuevo, 1);
    // el cubo nuevo queda en la mano (en el mismo hueco de la hotbar)
    const sel = this.selectedSlot, i = this.hotbarSlots.indexOf(nuevo);
    if (this.hotbarSlots[sel] === null && i !== sel) {
      if (i !== -1) this.hotbarSlots[i] = null;
      this.hotbarSlots[sel] = nuevo;
    }
    this._renderHotbar();
    this._placeCd = SurviConfig.PLACE_COOLDOWN;
  }

  // ═══════════ Durabilidad ═══════════
  // Usar una herramienta (romper un bloque o pegarle a un mob) la gasta; al
  // llegar a 0 se rompe y se saca 1 del inventario.
  _usarHerramienta(id) {
    if (this.creativo) return; // en creativo nada se gasta
    if (!id || !(this.inventory[id] > 0) || !Desgaste.tieneDurabilidad(id)) return;
    if (this.desgaste.gastar(id)) {
      this._removeItem(id, 1);
      if (this.ui.showToast) this.ui.showToast(`Se rompió: ${SurviConfig.ITEM_INFO[id].name}`);
      this.sonar('rota');
    }
    this._renderHotbar();
    if (this.invOpen) this._renderInventory();
  }

  // Gasta las piezas de armadura puestas en esos slots. Una que se rompe se
  // saca del equipo (no vuelve al inventario).
  _gastarArmadura(slots, n = 1) {
    const rotas = [];
    for (const slot of slots) {
      const id = this.equipment[slot];
      if (!id || !Desgaste.tieneDurabilidad(id)) continue;
      if (this.desgasteEquipo.gastar(id, n)) {
        this.equipment[slot] = null;
        rotas.push(SurviConfig.ITEM_INFO[id].name);
      }
    }
    if (rotas.length && this.ui.showToast) this.ui.showToast(`Se rompió: ${rotas.join(', ')}`);
  }

  // Desgaste del cofre abierto (se crea la primera vez que hace falta).
  _desgasteCofre() {
    const k = this.station.key;
    return (this.desgasteCofres[k] ||= new Desgaste());
  }

  // Para la UI: 0..1 (o null si no se gasta).
  durabilidadInventario(id) {
    return this.desgaste.fraccion(id);
  }

  durabilidadEquipo(id) {
    return this.desgasteEquipo.fraccion(id);
  }

  durabilidadCofre(id) {
    const d = this.station && this.desgasteCofres[this.station.key];
    return d ? d.fraccion(id) : Desgaste.tieneDurabilidad(id) ? 1 : null;
  }

  // ═══════════ Inventario / hotbar / equipamiento / crafteo ═══════════

  // Cupo total de ítems distintos: 8 de hotbar + 10 generales (14 con
  // mochila puesta). Cada TIPO de ítem ocupa un solo "hueco" acá adentro
  // sin importar cuánto stock tenga — lo mismo que ya hacía la hotbar
  // (`hotbarSlots.indexOf(null)`), solo que ahora también se aplica al
  // inventario general en vez de dejarlo sin límite.
  get invSlotCap() {
    if (this.creativo) return SurviConfig.CREATIVO_CUPO; // creativo: inventario más grande
    return SurviConfig.totalInvSlots(this.equipment);
  }

  // Cupo del inventario GENERAL solo (sin contar los 8 de la hotbar) —
  // lo usa la UI para el contador "X/10" (o "X/14" con mochila puesta).
  // ═══ Hotbar ⇄ inventario (arrastrar y soltar, ver survi_arrastre.js) ═══
  // Pone `id` en el hueco `slot` de la hotbar. Si `id` ya estaba en otro
  // hueco, los dos se intercambian. Si no, lo que había en `slot` vuelve al
  // inventario general, al lugar que deja libre `id` (así que siempre entra).
  ponerEnHotbar(id, slot) {
    if (!(this.inventory[id] > 0) || !(slot >= 0 && slot < SurviConfig.HOTBAR_SIZE)) return false;
    const antes = this.hotbarSlots.indexOf(id);
    if (antes !== -1) this.hotbarSlots[antes] = this.hotbarSlots[slot];
    this.hotbarSlots[slot] = id;
    this.#refrescarInventario();
    return true;
  }

  // Saca lo que hay en el hueco `slot` al inventario general. false si el
  // general está lleno (no hay dónde ponerlo).
  sacarDeHotbar(slot) {
    const id = this.hotbarSlots[slot];
    if (!id) return false;
    const enGeneral = Object.keys(this.inventory).filter((k) => !this.hotbarSlots.includes(Number(k))).length;
    if (enGeneral >= this.generalSlotCap) return false;
    this.hotbarSlots[slot] = null;
    this.#refrescarInventario();
    return true;
  }

  // Tocar un ítem del inventario: va al hueco seleccionado si está vacío,
  // si no al primer hueco libre; con la barra llena, reemplaza al
  // seleccionado (que vuelve al inventario).
  mandarAHotbar(id) {
    let slot = this.selectedSlot;
    if (this.hotbarSlots[slot] !== null) {
      const libre = this.hotbarSlots.indexOf(null);
      if (libre !== -1) slot = libre;
    }
    return this.ponerEnHotbar(id, slot);
  }

  static RUEDA_UMBRAL = 40; // px de rueda por slot

  seleccionarSlot(slot) {
    if (!(slot >= 0 && slot < SurviConfig.HOTBAR_SIZE)) return;
    this.selectedSlot = slot;
    this.#refrescarInventario();
  }

  #refrescarInventario() {
    this._renderHotbar();
    if (this.invOpen) this._renderInventory();
  }

  get generalSlotCap() {
    if (this.creativo) return SurviConfig.CREATIVO_CUPO - SurviConfig.HOTBAR_SIZE;
    return SurviConfig.totalGeneralSlots(this.equipment);
  }

  // Defensa total de la armadura puesta — se aplica en _damage().
  get armorDefense() {
    return SurviConfig.totalDefense(this.equipment);
  }

  // qty por defecto 1 (picar/comida sueltan de a uno); craftItem() puede
  // pedir más de una unidad de una sola vez si algún día una receta da
  // resultQty > 1. Devuelve true/false: false = no entró (inventario
  // lleno de tipos distintos) y el drop/resultado se pierde.
  _addItem(id, qty = 1) {
    if (!id || !SurviConfig.ITEM_INFO[id] || qty <= 0) return false;
    const isNew = !(id in this.inventory);
    if (isNew && Object.keys(this.inventory).length >= this.invSlotCap) {
      if (this.ui.showToast) this.ui.showToast('Inventario lleno');
      return false;
    }
    this.inventory[id] = (this.inventory[id] || 0) + qty;
    const info = SurviConfig.ITEM_INFO[id];
    // Los ítems de equipo (armadura, mochila…) no tienen sentido en la
    // hotbar — se equipan desde la pantalla de Equipamiento, no
    // clickeando 1-8, así que no les reservamos un slot ahí.
    if (!info.equip && !this.hotbarSlots.includes(id)) {
      const free = this.hotbarSlots.indexOf(null);
      if (free !== -1) this.hotbarSlots[free] = id;
    }
    this._renderHotbar();
    if (this.invOpen) this._renderInventory();
    return true;
  }

  _removeItem(id, qty = 1) {
    const left = Math.max(0, (this.inventory[id] || 0) - qty);
    if (left === 0) {
      delete this.inventory[id];
      this.desgaste.olvidar(id);
      const i = this.hotbarSlots.indexOf(id);
      if (i !== -1) this.hotbarSlots[i] = null;
    } else this.inventory[id] = left;
    this._renderHotbar();
    if (this.invOpen) this._renderInventory();
  }

  // ¿Entra este ítem? (true si no ocupa hueco nuevo o si todavía hay cupo)
  _hasRoomFor(id) {
    if (!id || !SurviConfig.ITEM_INFO[id]) return true; // nada que guardar
    if (id in this.inventory) return true; // ya tenés de ese tipo: solo suma stock
    return Object.keys(this.inventory).length < this.invSlotCap;
  }

  _renderHotbar() {
    this.ui.renderHotbar(this);
  }

  _renderInventory() {
    this.ui.renderInventory(this);
  }

  // ── Equipar / desequipar ──
  // Devuelve true/false (para que la UI sepa si hizo falta avisar algo).
  equipItem(id) {
    const info = SurviConfig.ITEM_INFO[id];
    if (!info || !info.equip || (this.inventory[id] || 0) <= 0) return false;
    const slotType = info.equip;
    const prev = this.equipment[slotType];
    if (prev === id) return true; // ya está puesto, no hay nada que hacer

    // Sacamos el nuevo del inventario primero: así, si había algo puesto
    // en ese slot, el hueco que libera este item es justo el que
    // necesita el que vuelve.
    const gastadoNuevo = this.desgaste.tomar(id); // la unidad gastada es la que se pone
    this._removeItem(id, 1);
    if (prev) {
      if (!this._addItem(prev, 1)) {
        // No entró de vuelta (caso límite: inventario lleno con 18 tipos
        // distintos Y el que tenías puesto era, para colmo, un tipo que
        // ya no está en tu inventario). Revertimos todo — nadie se queda
        // sin su equipo puesto por un slot que no alcanzó.
        this._addItem(id, 1); // esto sí entra seguro: acabamos de liberarlo
        this.desgaste.poner(id, gastadoNuevo);
        return false;
      }
      this.desgasteEquipo.moverA(this.desgaste, prev);
    }
    this.equipment[slotType] = id;
    this.desgasteEquipo.poner(id, gastadoNuevo);
    if (this.invOpen) this._renderInventory();
    return true;
  }

  unequipItem(slotType) {
    const id = this.equipment[slotType];
    if (!id) return false;
    if (!this._addItem(id, 1)) return false; // inventario lleno, no se puede sacar
    this.equipment[slotType] = null;
    this.desgasteEquipo.moverA(this.desgaste, id);
    if (this.invOpen) this._renderInventory();
    return true;
  }

  // ── Crafteo ──
  // Devuelve { ok, reason } en vez de solo boolean, así la UI puede
  // mostrar un mensaje distinto según por qué no se pudo craftear.
  craftItem(recipeId) {
    const recipe = SurviConfig.RECIPES.find((r) => r.id === recipeId);
    if (!recipe)
      return {
        ok: false,
        reason: 'not_found',
      };
    if (recipe.station === 'table' && this.craftStation !== 'table')
      return {
        ok: false,
        reason: 'station',
      };
    if (!SurviConfig.canCraft(this.inventory, recipe))
      return {
        ok: false,
        reason: 'missing',
      };
    // Chequeamos el cupo ANTES de descontar nada: así, si el resultado no
    // va a entrar, no perdés los materiales de arriba.
    if (!SurviConfig.craftWouldFit(this.inventory, recipe, this.invSlotCap))
      return {
        ok: false,
        reason: 'full',
      };
    SurviConfig.consumeRecipe(this.inventory, recipe);
    this._addItem(recipe.result, recipe.resultQty || 1); // ahora sí entra seguro
    this.sonar('craftear');
    return {
      ok: true,
    };
  }

  // ═══════════ Vida / muerte ═══════════
  // Coordenadas arriba a la izquierda (al lado de la pausa), en bloques:
  // X = 0 en el medio del mundo (-250 izquierda, 249 derecha); Y = 0 más o
  // menos al nivel del suelo (COORD_Y0_FILA): arriba positivo, en las cuevas
  // negativo. Solo se toca el DOM si cambiaron.
  _mostrarCoords() {
    const T = SurviConfig.TILE;
    const x = Math.floor((this.player.x + this.player.w / 2) / T) - SurviConfig.COLS / 2;
    const y = SurviConfig.COORD_Y0_FILA - Math.floor((this.player.y + this.player.h - 1) / T);
    if (x === this._coordX && y === this._coordY) return;
    this._coordX = x;
    this._coordY = y;
    if (this.ui.coordsX) this.ui.coordsX.textContent = x;
    if (this.ui.coordsY) this.ui.coordsY.textContent = y;
  }

  _renderHealth() {
    const pct = Math.max(0, this.hp / this.maxHp) * 100;
    // scaleX en vez de width: no recalcula el layout del HUD en cada frame de la transición
    this.ui.hpBar.style.transform = `scaleX(${pct / 100})`;
    // envenenado: la barra se pone verde oliva (como en Minecraft)
    this.ui.hpBar.style.background = this.venenoMs > 0 ? '#8fa82c' : pct > 50 ? '#4caf50' : pct > 25 ? '#f5c518' : '#e0563a';
    this.ui.hpText.textContent = `${Math.max(0, Math.round(this.hp))}/${this.maxHp}`;
  }

  _renderHunger() {
    const pct = Math.max(0, this.hunger / SurviConfig.MAX_HUNGER) * 100;
    this.ui.hungerBar.style.transform = `scaleX(${pct / 100})`;
    this.ui.hungerBar.style.background = pct > 50 ? '#caa24a' : pct > 20 ? '#d98a3d' : '#c0392b';
    this.ui.hungerText.textContent = `${Math.max(0, Math.round(this.hunger))}/${SurviConfig.MAX_HUNGER}`;
  }

  // origen: 'golpe' (mob, lo que se toma por defecto), 'caida' o 'hambre'.
  _damage(amount, { ignoreInvuln = false, origen = ignoreInvuln ? 'otro' : 'golpe' } = {}) {
    if (this.dead || amount <= 0 || this.invisible) return; // creativo / espectador: inmortal
    if (origen === 'golpe') amount = Math.max(1, Math.round(amount * this.dif.danio * (this.lunaSangre ? SurviConfig.LUNA_SANGRE.danio : 1))); // dificultad (y luna de sangre)
    if (!ignoreInvuln && this.invulnMs > 0) return;
    // La armadura amortigua los golpes cuerpo a cuerpo — ignoreInvuln=false
    // es justo la marca que ya usan esos golpes (ver _updateEnemies) — pero
    // NO el daño de caída ni el de hambre (ignoreInvuln=true): la
    // armadura no evita romperte una pierna cayendo ni evita pasar hambre.
    if (!ignoreInvuln) {
      // la defensa reduce un % del golpe (con tope), nunca lo anula del todo
      amount = Math.max(1, Math.round(amount * (1 - SurviConfig.armorReduction(this.armorDefense))));
    }
    this.hp -= amount;
    this.invulnMs = SurviConfig.INVULN_MS;
    this._despertar(); // si estabas durmiendo, te despierta
    // Durabilidad: un golpe gasta toda la armadura puesta; una caída, solo las
    // botas (una caída fuerte las gasta más). El hambre no gasta nada.
    if (origen === 'golpe') this._gastarArmadura(['head', 'chest', 'legs', 'boots']);
    else if (origen === 'caida') this._gastarArmadura(['boots'], Math.max(1, amount));
    else if (origen === 'acido') this._gastarArmadura(['head', 'chest', 'legs', 'boots'], SurviConfig.ACIDO_DESGASTE); // x3
    // Feedback aparte del parpadeo largo de invulnerabilidad: un flash
    // rojo corto sobre el personaje y un temblor de cámara breve, así el
    // golpe se siente aunque el parpadeo por invulnerabilidad no aplique
    // (ignoreInvuln=true, como el daño de caída o el de hambre).
    this._hitFlashMs = SurviConfig.HIT_FLASH_MS;
    if (this.camera) this.camera.shake(SurviConfig.HIT_SHAKE_INTENSITY, SurviConfig.HIT_SHAKE_MS);
    this._renderHealth();
    if (this.hp <= 0) this._die();
    else this.sonar('dano');
  }

  _die() {
    this.sonar('morir');
    this.hp = 0;
    this.dead = true;
    this.pointer.down = false;
    this._resetMine();
    this._renderHealth();
    // El hambre vuelve al máximo apenas morís (no recién al respawnear):
    // así el HUD de la pantalla de muerte no se queda mostrando el 0 que
    // probablemente te mató, y si es partida normal, save() de acá abajo
    // ya persiste el mundo con el hambre llena.
    this.hunger = SurviConfig.MAX_HUNGER;
    this._starveTimer = 0;
    this._renderHunger();
    // Según la dificultad: en Fácil conservás todo; en Normal / Difícil tus
    // cosas quedan tiradas donde moriste; en Hardcore no hay revivir: pasás
    // a espectador para siempre (el mundo no se borra, lo podés seguir mirando).
    const hardcore = !!this.dif.unaVida;
    const conserva = !!this.dif.conserva;
    const tenia = Object.keys(this.inventory).length || Object.values(this.equipment).some(Boolean);
    if (!conserva) this._soltarTodo();
    if (hardcore) this.muertoHardcore = true;
    this.ui.deathTime.textContent =
      `Sobreviviste ${GestorGuardado.fmtTime(this.playedMs)} en ${this.nombre}` +
      (hardcore
        ? '.\nEra hardcore: no podés revivir, pero podés seguir mirando tu mundo como espectador.'
        : conserva
          ? '.\nEn Fácil conservás tus cosas.'
          : tenia
            ? '.\nTus cosas quedaron donde moriste: tenés 10 minutos para ir a buscarlas.'
            : '.');
    this.ui.deathRespawn.classList.toggle('hidden', hardcore);
    if (this.ui.deathEspectar) this.ui.deathEspectar.classList.toggle('hidden', !hardcore);
    this.save();
    this.ui.showScreen('death');
    if (typeof this.onDeath === 'function') this.onDeath(this.dificultad);
  }

  respawn() {
    if (this.muertoHardcore) return; // hardcore: una sola vida
    this.dead = false;
    this.hp = this.maxHp;
    // Sin esto, si morías con el hambre en 0 (la causa más común de morir
    // sin enemigos cerca) reaparecías con vida llena pero el hambre seguía
    // en 0 — el _starveTimer te volvía a pegar en STARVE_INTERVAL_MS casi
    // de inmediato, como si el respawn no hubiera hecho nada.
    this.hunger = SurviConfig.MAX_HUNGER;
    this._starveTimer = 0;
    this.invulnMs = SurviConfig.INVULN_MS;
    // la cama pudo haberse roto mientras estabas muerto
    if (this.cama && this.tilemap.get(this.cama.col, this.cama.row) !== SurviConfig.TID.bed_l) {
      this.cama = null;
      this.spawn = this._spawnMundo || this.spawn;
    }
    this.player.reaparecer(this.spawn.x, this.spawn.y);
    this.aireMs = SurviConfig.AIRE_MAX_MS;
    this.quemaduraMs = 0;
    this.venenoMs = 0;
    this.enredadoMs = this.congeladoMs = 0;
    this._fallFromY = null;
    this.enemies.length = 0;
    this._renderHealth();
    this._renderHunger();
    this._camAnchorY = this.player.y + this.player.h / 2;
    this._applyZoom(0, true);
    this.camera.follow(this.player.x, this.player.y);
    this.ui.showScreen(null);
  }

  // ═══════════ Enemigos ═══════════
  // Cada ENEMIGO_SPAWN_MS se intenta uno. Qué sale depende de dónde estás:
  //   bajo tierra → zombie o esqueleto (a cualquier hora, en la cueva)
  //   superficie  → de noche zombie o slime; de día solo a veces un slime
  _intentarSpawnEnemigo() {
    const T = SurviConfig.TILE;
    const topes = this.dif.topes * (this.lunaSangre ? SurviConfig.LUNA_SANGRE.topes : 1); // dificultad (y luna de sangre): más o menos monstruos a la vez
    if (this.enemies.length >= Math.max(1, Math.round(SurviConfig.ENEMIGO_MAX_TOTAL * topes))) return;
    const pcol = Math.max(0, Math.min(SurviConfig.COLS - 1, Math.floor((this.player.x + this.player.w / 2) / T)));
    const prow = Math.floor((this.player.y + this.player.h / 2) / T);
    const bajoTierra = prow > this.world.surfaceByCol[pcol] + SurviConfig.CUEVA_FILAS;
    let tipo;
    const desierto = this.world.biomeByCol[pcol] === 'desierto';
    let regionMob = null; // los mobs de bioma de cueva solo aparecen en su región
    const LS = SurviConfig.LUNA_SANGRE, rs = Math.random();
    if (bajoTierra) {
      const m = this._elegirMobCueva(this._regionCueva(pcol, prow));
      tipo = m.tipo;
      regionMob = m.regiones;
    }
    // luna de sangre: en la superficie también salen esqueletos y ojos (sin esperar al día 10)
    else if (this.lunaSangre && rs < LS.superficie.esqueleto) tipo = 'esqueleto';
    else if (this.lunaSangre && rs < LS.superficie.esqueleto + LS.superficie.ojo) tipo = Math.random() < 0.6 ? 'ojo' : 'ojo_boca';
    else if (desierto && Math.random() < SurviConfig.SERPIENTE_CHANCE) tipo = 'serpiente'; // de día o de noche
    else if (this.esNoche && this.dias >= this.dif.ojosDesde && Math.random() < SurviConfig.OJO_CHANCE_NOCHE)
      tipo = Math.random() < 0.7 ? 'ojo' : 'ojo_boca'; // ojos voladores (desde el día 10)
    else if (this.esNoche && !desierto && Math.random() < SurviConfig.HONGO_CHANCE_NOCHE) tipo = 'hongo'; // hongo explosivo
    else if (this.esNoche)
      tipo = Math.random() < SurviConfig.ZOMBIE_CHANCE_NOCHE ? (desierto ? 'momia' : 'zombie') : 'slime'; // en el desierto, momias
    else if (this.clima.lloviendo && Math.random() < SurviConfig.ZOMBIE_CHANCE_LLUVIA) tipo = 'zombie'; // de día con lluvia
    else if (Math.random() < SurviConfig.ENEMIGO_CHANCE_DIA) tipo = 'slime';
    if (!tipo) return;
    const max = Math.max(1, Math.round((SurviConfig.ENEMIGO_MAX[tipo] || 0) * topes));
    if (this.enemies.filter((e) => e.tipo === tipo).length >= max) return;
    // Zombies y esqueletos no aparecen donde hay luz (antorchas, horno o sol de día).
    const evitaLuz = tipo === 'zombie' || tipo === 'esqueleto' || tipo === 'hongo' || tipo === 'momia' || bajoTierra;
    const sirve = (c, r) =>
      (!evitaLuz || !this._zonaIluminada(c, r)) &&
      ((tipo !== 'serpiente' && tipo !== 'momia') || this.world.biomeByCol[c] === 'desierto') &&
      (!regionMob || regionMob.includes(this._regionCueva(c, r)));
    const vuela = tipo === 'ojo' || tipo === 'ojo_boca';
    const lugar =
      tipo === 'murcielago'
        ? this._lugarEnTecho(pcol, prow, sirve)
        : vuela
          ? this._lugarEnCielo(pcol, prow)
          : bajoTierra
            ? this._lugarEnCueva(pcol, prow, sirve)
            : this._lugarEnSuperficie(pcol, sirve);
    if (!lugar) return;
    const dir = Math.sign(pcol - lugar.col) || 1; // arranca caminando hacia vos
    const en = this._crearEnemigo({ tipo, x: 0, y: 0, vx: 0.5 * dir });
    if (!en) return;
    en.x = lugar.col * T + (T - en.w) / 2;
    en.y = tipo === 'murcielago' ? lugar.row * T : (lugar.row + 1) * T - en.h - 1; // colgado del techo / parado sobre el piso
    // los grandes (zombie, esqueleto, yeti) necesitan lugar: no aparecen adentro de un techo bajo
    if (tipo !== 'murcielago' && !vuela && !this._cajaLibre(en)) return;
    this.enemies.push(en);
  }

  // Qué sale en una cueva según su región. regiones: dónde puede aparecer
  // (null = en cualquiera).
  _elegirMobCueva(region) {
    const R = SurviConfig.REGION_CUEVA, K = SurviConfig.MOBS_CUEVA, x = Math.random();
    const comun = () => ({ tipo: Math.random() < SurviConfig.ZOMBIE_CHANCE_CUEVA ? 'zombie' : 'esqueleto', regiones: null });
    if (region === R.musgo && x < K.arana) return { tipo: 'arana', regiones: [R.musgo] };
    if (region === R.hielo && x < K.yeti) return { tipo: 'yeti', regiones: [R.hielo] };
    if (region === R.goteo && x < K.murcielagoGoteo) return { tipo: 'murcielago', regiones: [R.goteo, R.normal] };
    if (region === R.normal && x < K.murcielago) return { tipo: 'murcielago', regiones: [R.goteo, R.normal] };
    return comun();
  }

  // Un techo de cueva cerca (fuera de la vista) para colgar un murciélago:
  // aire en la celda y abajo, sólido arriba, sin agua.
  _lugarEnTecho(pcol, prow, sirve = () => true) {
    const map = this.tilemap;
    for (let intento = 0; intento < 14; intento++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const col = pcol + dir * (8 + Math.floor(Math.random() * 16));
      if (col < 2 || col >= SurviConfig.COLS - 2) continue;
      let row = prow + 4 - Math.floor(Math.random() * 12);
      if (map.isSolidAt(col, row)) continue;
      for (let k = 0; k < 10 && row > 2 && !map.isSolidAt(col, row - 1); k++) row--;
      if (!map.isSolidAt(col, row - 1) || row <= this.world.surfaceByCol[col] + SurviConfig.CUEVA_FILAS) continue;
      if (map.get(col, row) || map.get(col, row + 1) || this.fluidos.tipo(col, row) || this.fluidos.tipo(col, row + 1)) continue;
      if (!this._tileEnVista(col, row) && sirve(col, row)) return { col, row };
    }
    return null;
  }

  // ¿Hay lugar para un bicho de 2 bloques de alto parado en (col, row)?
  // (aire en row y row-1, piso sólido abajo, sin agua ni lava)
  _hayLugar(col, row) {
    if (col < 2 || col >= SurviConfig.COLS - 2 || row < 2 || row >= SurviConfig.ROWS - 3) return false;
    const map = this.tilemap;
    if (!SurviConfig.esAire(map.get(col, row)) || !SurviConfig.esAire(map.get(col, row - 1))) return false;
    // adentro de tu casa (con pared de fondo) no aparecen monstruos
    if (this.fondo && (this.fondo[row * SurviConfig.COLS + col] || this.fondo[(row - 1) * SurviConfig.COLS + col])) return false;
    if (!map.isSolidAt(col, row + 1)) return false;
    return !this.fluidos.tipo(col, row) && !this.fluidos.tipo(col, row - 1);
  }

  // ¿El punto (en bloques) se ve en pantalla? (con un bloque de margen)
  _tileEnVista(col, row) {
    const T = SurviConfig.TILE, cam = this.camera;
    const x = col * T, y = row * T;
    return x > cam.x - 2 * T && x < cam.x + cam.width + T && y > cam.y - 3 * T && y < cam.y + cam.height + T;
  }

  _lugarEnSuperficie(pcol, sirve = () => true) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    const col = pcol + dir * (14 + Math.floor(Math.random() * 8));
    if (col < 2 || col >= SurviConfig.COLS - 2) return null;
    const row = this.world.surfaceByCol[col] - 1;
    if (!this._hayLugar(col, row) || this._tileEnVista(col, row) || !sirve(col, row)) return null;
    return { col, row };
  }

  // Lugar en el aire para los ojos: a un costado y más arriba que vos, fuera de la vista.
  _lugarEnCielo(pcol, prow) {
    for (let i = 0; i < 8; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const col = pcol + dir * (14 + Math.floor(Math.random() * 9));
      const row = prow - 3 - Math.floor(Math.random() * 7);
      if (col < 2 || col >= SurviConfig.COLS - 2 || row < 2) continue;
      if (this.tilemap.get(col, row) !== 0 || this.tilemap.get(col, row + 1) !== 0 || this.fluidos.tipo(col, row)) continue;
      if (!this._tileEnVista(col, row)) return { col, row };
    }
    return null;
  }

  // ¿Hay luz en (col, row) como para que no aparezcan zombies/esqueletos?
  // Sol: de día, a cielo abierto y sin lluvia. Antorchas y hornos prendidos:
  // a menos de SIN_SPAWN_RADIO_LUZ bloques.
  _zonaIluminada(col, row) {
    if (!this.esNoche && !this.clima.lloviendo && row < this.light.skyRow[col]) return true;
    const R = SurviConfig.SIN_SPAWN_RADIO_LUZ;
    for (let r = row - R; r <= row + R; r++) {
      for (let c = col - R; c <= col + R; c++) {
        if ((c - col) ** 2 + (r - row) ** 2 > R * R) continue;
        const id = this.tilemap.get(c, r);
        if (SurviConfig.TORCH_IDS.has(id) || id === SurviConfig.T.FURNACE_ON) return true;
      }
    }
    return false;
  }

  // Un hueco de cueva cerca del jugador (fuera de la vista y lejos de la
  // superficie): se prueban unos lugares al azar y se busca el piso bajando.
  _lugarEnCueva(pcol, prow, sirve = () => true) {
    for (let intento = 0; intento < 14; intento++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const col = pcol + dir * (9 + Math.floor(Math.random() * 16));
      if (col < 2 || col >= SurviConfig.COLS - 2) continue;
      let row = prow - 8 + Math.floor(Math.random() * 17);
      for (let k = 0; k < 8 && row + 1 < SurviConfig.ROWS && !this.tilemap.isSolidAt(col, row + 1); k++) row++;
      if (row <= this.world.surfaceByCol[col] + SurviConfig.CUEVA_FILAS) continue;
      if (this._hayLugar(col, row) && !this._tileEnVista(col, row) && sirve(col, row)) return { col, row };
    }
    return null;
  }

  get esNoche() {
    return LightMap.sunAt(this.timeOfDay, SurviConfig.NIGHT_SUN) < 0.5;
  }

  // ¿Tiene cielo abierto arriba de la cabeza? (ningún bloque sólido encima;
  // skyRow = primer sólido de cada columna, ver survi_light.js)
  alCielo(ent) {
    if (!this.light) return false;
    const T = SurviConfig.TILE;
    const col = Math.floor((ent.x + ent.w / 2) / T), row = Math.floor(ent.y / T);
    if (col < 0 || col >= SurviConfig.COLS) return false;
    return row < this.light.skyRow[col];
  }

  // ¿Le da el sol de lleno? De día, a cielo abierto, sin lluvia y sin
  // estar bajo el agua. Solo el sol: las antorchas no queman.
  alSolDirecto(ent) {
    if (this.esNoche || (this.clima && this.clima.lloviendo)) return false;
    const T = SurviConfig.TILE;
    if (this.fluidos && this.fluidos.tipo(Math.floor((ent.x + ent.w / 2) / T), Math.floor(ent.y / T)) === 1) return false;
    return this.alCielo(ent);
  }

  // Mordida de serpiente: envenenado VENENO_MS (cada mordida lo vuelve a llenar).
  envenenar() {
    if (this.dead || this.invisible) return;
    if (this.venenoMs <= 0) this._venenoTick = 0;
    this.venenoMs = SurviConfig.VENENO_MS;
    this._renderEfectos();
    this._renderHealth(); // barra en verde oliva
  }

  // Telaraña (araña): muy lento y casi sin salto.
  enredar(ms = SurviConfig.ENREDADO_MS) {
    if (this.dead || this.invisible) return;
    this.enredadoMs = Math.max(this.enredadoMs, ms);
    this._renderEfectos();
  }

  // Bola de nieve / abrazo del yeti: más lento un rato.
  congelar(ms = SurviConfig.CONGELADO_MS) {
    if (this.dead || this.invisible) return;
    this.congeladoMs = Math.max(this.congeladoMs, ms);
    this._renderEfectos();
  }

  // Cuánto te frenan los efectos (1 = nada).
  get factorLento() {
    if (this.enredadoMs > 0) return SurviConfig.ENREDADO_VEL;
    if (this.congeladoMs > 0) return SurviConfig.CONGELADO_VEL;
    return 1;
  }

  // Picar / romper hace ruido: los murciélagos dormidos cerca se despiertan.
  hacerRuido(x, y) {
    this._ruido = { x, y, ms: this.playedMs };
  }

  // ¿Hubo ruido hace poco a menos de `radio` px de (x, y)?
  ruidoCerca(x, y, radio) {
    const r = this._ruido;
    return !!r && this.playedMs - r.ms < 400 && Math.hypot(r.x - x, r.y - y) < radio;
  }

  _actualizarLentitud(dt) {
    if (this.enredadoMs <= 0 && this.congeladoMs <= 0) return;
    if (this.enredadoMs > 0) this.enredadoMs = Math.max(0, this.enredadoMs - dt);
    if (this.congeladoMs > 0) this.congeladoMs = Math.max(0, this.congeladoMs - dt);
    // el agua y el fuego te sacan la telaraña / te descongelan
    if (this._enFluido && this._enFluido.agua) this.enredadoMs = 0;
    if (this.quemaduraMs > 0 || (this._enFluido && this._enFluido.lava)) this.congeladoMs = this.enredadoMs = 0;
    this._renderEfectos();
  }

  _actualizarVeneno(dt) {
    if (this.venenoMs <= 0) return;
    this.venenoMs -= dt;
    this._venenoTick += dt;
    if (this._venenoTick >= SurviConfig.VENENO_TICK_MS) {
      this._venenoTick = 0;
      // si no mata, te deja en 1 como mínimo
      // (solo mata en Difícil / Hardcore, o si VENENO_MATA está prendido)
      const dmg = SurviConfig.VENENO_MATA || this.dif.mataHambre ? SurviConfig.VENENO_DANIO : Math.min(SurviConfig.VENENO_DANIO, this.hp - 1);
      if (dmg > 0) this._damage(dmg, { ignoreInvuln: true, origen: 'veneno' });
    }
    if (this.venenoMs <= 0) {
      this.venenoMs = 0;
      this._renderHealth(); // vuelve el color normal de la barra
    }
    this._renderEfectos(); // (solo toca el DOM si cambió el segundo)
  }

  // Pastilla de efectos arriba de la vida (por ahora, el veneno con sus segundos).
  _renderEfectos() {
    for (const [el, ms] of [
      [this.ui.efectoVeneno, this.venenoMs],
      [this.ui.efectoEnredado, this.enredadoMs],
      [this.ui.efectoCongelado, this.congeladoMs],
    ]) {
      if (!el) continue;
      const seg = Math.ceil(Math.max(0, ms) / 1000);
      if (el._seg === seg) continue; // solo toca el DOM si cambió el segundo
      el._seg = seg;
      el.classList.toggle('hidden', seg <= 0);
      el.querySelector('b').textContent = `${seg}s`;
    }
  }

  // Un mob quemándose te pegó (o una flecha en llamas): te prende fuego.
  prenderFuego() {
    if (this.dead || this.invisible || (this._enFluido && this._enFluido.agua)) return;
    this.quemaduraMs = Math.max(this.quemaduraMs, SurviConfig.QUEMADURA_CONTAGIO_MS);
  }

  // ═══════════ Clima ═══════════
  _actualizarClima(dt, step) {
    const cambio = this.clima.actualizar(dt);
    if (cambio && this.ui.showToast) {
      this.ui.showToast(
        cambio === 'acida'
          ? '¡Lluvia ácida! Buscá techo o metete al agua'
          : cambio === 'lluvia'
            ? this.clima.sangre
              ? '¡Lluvia de sangre! Cura a los monstruos que estén a cielo abierto'
              : 'Empezó a llover'
            : 'Paró de llover',
      );
    }
    if (this.camera) {
      this.clima.actualizarGotas(dt, step, this.camera, (c) => (c >= 0 && c < SurviConfig.COLS ? this.light.skyRow[c] : 0), SurviConfig.TILE, this.quality);
      // sonido de lluvia: más apagado bajo techo o bajo tierra
      this.sonido.lluvia(this.clima.intensidad, !this.alCielo(this.player));
    }
    if (!this.clima.lloviendo) {
      this._acidoMs = 0;
      return;
    }
    // la lluvia apaga el fuego (a cielo abierto)
    if (this.quemaduraMs > 0 && this.alCielo(this.player) && !this._enFluido.lava) this.quemaduraMs = 0;
    // Lluvia de sangre (luna de sangre + lluvia): cura a los enemigos a cielo abierto.
    if (this.clima.sangrienta && this.clima.intensidad >= 0.5) {
      const L = SurviConfig.LUNA_SANGRE.lluvia;
      this._sangreMs += dt;
      if (this._sangreMs >= L.tickMs) {
        this._sangreMs = 0;
        for (const en of this.enemies) {
          const max = en.constructor.VIDA;
          if (en.estaMuerto() || en.hp >= max || !this.alCielo(en)) continue;
          en.hp = Math.min(max, en.hp + L.cura);
          this.particulas.chispas(en.x + en.w / 2, en.y, ['#ff4a55', '#ff8a8a', '#c81e2c'], 3);
        }
      }
    } else this._sangreMs = 0;
    if (!this.clima.acida || this.clima.intensidad < 0.5) return;
    // Lluvia ácida: cada ACIDO_TICK_MS lastima a todo lo que esté a cielo
    // abierto, menos a los slimes y a lo que tenga la cabeza bajo el agua.
    this._acidoMs += dt;
    if (this._acidoMs < SurviConfig.ACIDO_TICK_MS) return;
    this._acidoMs = 0;
    const bajoAgua = (fl) => fl && fl.cabeza === CapaFluidos.AGUA;
    if (!this.dead && this.alCielo(this.player) && !bajoAgua(this._enFluido)) {
      this._damage(SurviConfig.ACIDO_DANIO, { ignoreInvuln: true, origen: 'acido' });
    }
    for (const c of [...this.enemies, ...this.animals]) {
      if (c.tipo === 'slime' || c.estaMuerto() || !this.alCielo(c) || bajoAgua(c.fluido)) continue;
      c.hp -= SurviConfig.ACIDO_DANIO;
      c.hitMs = 150;
    }
  }

  // Un solo lugar donde se arma un enemigo: lo usan el spawn y la carga del
  // save (el tipo decide la clase; un save viejo sin tipo es un slime).
  _crearEnemigo(d) {
    return Enemigo.crear(d);
  }

  // Lo mínimo para volver a crearlo igual (ver _crearEnemigo).
  _serializarEnemigo(en) {
    return en.serializar();
  }

  _updateEnemies(dt, step) {
    this._enemyTimer -= dt;
    if (this._enemyTimer <= 0) {
      this._enemyTimer = SurviConfig.ENEMIGO_SPAWN_MS * this.dif.spawn * (this.lunaSangre ? SurviConfig.LUNA_SANGRE.spawn : 1); // dificultad (y luna de sangre): más o menos seguido
      this._intentarSpawnEnemigo();
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      // muerto, o quedó demasiado lejos del jugador: se saca de la lista
      if (en.estaMuerto() || !en.actualizar(dt, step, this)) {
        if (en.estaMuerto()) this.particulas.muerte(en.x, en.y, en.w, en.h); // nubecita
        this.enemies.splice(i, 1);
      }
    }
  }

  // ═══════════ Animales ═══════════
  // Aves: de día, arriba de un árbol (o del suelo) en los biomas con árboles.
  _spawnAve() {
    const T = SurviConfig.TILE;
    if (LightMap.sunAt(this.timeOfDay, SurviConfig.NIGHT_SUN) < SurviConfig.ANIMAL_SOL_MIN || this.clima.lloviendo) return;
    const aves = this.animals.filter((a) => a instanceof Ave && Math.abs(a.x - this.player.x) < 40 * T).length;
    if (aves >= SurviConfig.AVE_MAX_CERCA) return;
    const pcol = Math.floor(this.player.x / T);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const col = pcol + dir * (14 + Math.floor(Math.random() * 16));
    const pesos = SurviConfig.AVES_POR_BIOMA[this.world.biomeByCol[col]];
    if (!pesos) return;
    const lugar = Ave.lugarEnColumna(this, col);
    if (!lugar || this._tileEnVista(lugar.col, lugar.row)) return;
    const total = Object.values(pesos).reduce((a, b) => a + b, 0);
    let r = Math.random() * total, tipo = null;
    for (const [t, p] of Object.entries(pesos)) if ((r -= p) < 0 && !tipo) tipo = t;
    const a = Animal.crear({ tipo, x: 0, y: 0, facing: -dir });
    if (!a) return;
    a.x = lugar.col * T + (T - a.w) / 2;
    a.y = (lugar.row + 1) * T - a.h;
    this.animals.push(a);
  }

  _updateAnimals(dt, step) {
    this._aveTimer -= dt;
    if (this._aveTimer <= 0) {
      this._aveTimer = SurviConfig.AVE_SPAWN_MS;
      this._spawnAve();
    }
    this._animalTimer -= dt;
    if (this._animalTimer <= 0) {
      this._animalTimer = SurviConfig.ANIMAL_SPAWN_MS;
      this._spawnAnimal();
    }
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      // muerto, o quedó demasiado lejos del jugador: se saca de la lista
      if (a.estaMuerto() || !a.actualizar(dt, step, this)) {
        if (a.estaMuerto()) this.particulas.muerte(a.x, a.y, a.w, a.h);
        this.animals.splice(i, 1);
      }
    }
  }

  // Intenta hacer aparecer 1 animal (a veces 2 del mismo tipo, en grupo)
  // sobre la superficie, fuera de la vista y según el bioma de esa columna.
  _spawnAnimal() {
    const T = SurviConfig.TILE;
    if (LightMap.sunAt(this.timeOfDay, SurviConfig.NIGHT_SUN) < SurviConfig.ANIMAL_SOL_MIN) return;
    // (los domesticados no cuentan: son tuyos, no del mundo)
    const cerca = this.animals.filter((a) => !(a instanceof Ave) && !a.domestico && Math.abs(a.x - this.player.x) < 40 * T).length;
    if (cerca >= SurviConfig.ANIMAL_MAX_CERCA) return;
    const pcol = Math.floor(this.player.x / T);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const col = pcol + dir * (12 + Math.floor(Math.random() * 19));
    if (col < 2 || col >= SurviConfig.COLS - 2) return;
    const tipo = this._elegirAnimal(this.world.biomeByCol[col]);
    if (!tipo) return;
    const row = this.world.surfaceByCol[col] - 1; // la celda de aire justo arriba del suelo
    if (!SurviConfig.esAire(this.tilemap.get(col, row)) || !SurviConfig.esAire(this.tilemap.get(col, row - 1))) return;
    if (this.fluidos.tipo(col, row) || this.fluidos.tipo(col, row - 1)) return; // ni en un lago
    const cantidad = Math.random() < 0.35 ? 2 : 1;
    for (let i = 0; i < cantidad && cerca + i < SurviConfig.ANIMAL_MAX_CERCA; i++) {
      const a = Animal.crear({ tipo, x: col * T + 1 + i * 6, y: (row - 1) * T });
      if (a) this.animals.push(a);
    }
  }

  // Sorteo con pesos según el bioma (ver SurviConfig.ANIMALES_POR_BIOMA).
  _elegirAnimal(bioma) {
    const pesos = SurviConfig.ANIMALES_POR_BIOMA[bioma] || {};
    const total = Object.values(pesos).reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (const [tipo, peso] of Object.entries(pesos)) {
      r -= peso;
      if (r < 0) return tipo;
    }
    return null;
  }

  // Lo que suelta una criatura (animal o enemigo) al morir por tu golpe:
  // cae al suelo donde murió (se junta pasando cerca).
  _cosechar(c) {
    if (c.esCria) return; // las crías no sueltan nada
    const x = c.x + c.w / 2, y = c.y + c.h / 2;
    for (const { id, qty } of c.drops()) this.soltarItem(id, qty, x, y);
    // drops especiales con chance (bola de slime, pluma, ojo mutante, llaves…)
    const extra = SurviConfig.DROPS_ESPECIALES[c instanceof Ave ? 'ave' : c.tipo];
    if (extra) for (const [id, chance] of extra) if (Math.random() < chance) this.soltarItem(id, 1, x, y);
  }

  // ═══════════ Crianza ═══════════
  // Clic derecho con comida sobre un animal que la acepta: le das de comer.
  // true si el clic fue para eso (aunque no la haya querido).
  _alimentarAnimal(id) {
    const pw = this._pointerWorld;
    if (!pw || this.espectador) return false;
    const m = 3; // margen para no tener que apuntar al pixel
    const bajo = this.animals.filter(
      (o) => !o.estaMuerto() && o.comida.includes(id) && pw.x >= o.x - m && pw.x <= o.x + o.w + m && pw.y >= o.y - m && pw.y <= o.y + o.h + m,
    );
    if (!bajo.length) return false;
    // si hay varios encimados, primero el que la aprovecha: cría > listo para criar > salvaje
    const prioridad = (o) => (o.esCria ? 0 : o.celoMs <= 0 && o.esperaMs <= 0 ? 1 : !o.domestico ? 2 : 3);
    const a = bajo.reduce((mejor, o) => (prioridad(o) < prioridad(mejor) ? o : mejor));
    const p = this.player;
    if (Math.hypot(a.x + a.w / 2 - (p.x + p.w / 2), a.y + a.h / 2 - (p.y + p.h / 2)) > this.reachPx) return false;
    if (this._usoPulsacion) return true;
    this._usoPulsacion = true;
    const eraSuyo = a.domestico;
    const r = a.alimentar();
    if (!r) {
      if (this.ui.showToast) this.ui.showToast(a.esperaMs > 0 ? 'Todavía no puede tener otra cría' : 'Ya está en celo');
      return true;
    }
    if (!this.creativo) this._removeItem(id);
    this.sonar('comer', a.x + a.w / 2, a.y);
    this.sonar(SurviGame.VOZ[a.tipo], a.x + a.w / 2, a.y);
    if (!eraSuyo && this.ui.showToast) this.ui.showToast('¡Domesticado! Ya no va a desaparecer');
    return true;
  }

  // Nace una cría (la llama el animal cuando encuentra pareja).
  nacerCria(tipo, x, y) {
    const T = SurviConfig.TILE, K = SurviConfig.CRIANZA;
    const suyos = this.animals.filter((a) => a.domestico && Math.abs(a.x - x) < 40 * T).length;
    if (suyos >= K.maxCerca) return;
    const c = Animal.crear({ tipo, x, y, domestico: true, edadMs: K.creceMs, facing: Math.random() < 0.5 ? -1 : 1 });
    if (!c) return;
    this.animals.push(c);
    this.sonar(SurviGame.VOZ[tipo], x, y);
  }

  // ═══════════ Sonido ═══════════
  // Sonido en (x, y) px de mundo: más bajo cuanto más lejos y paneado hacia
  // el lado donde pasa. Sin posición: suena "encima tuyo".
  sonar(nombre, x = null, y = null, opts = {}) {
    if (!nombre || !this.sonido || !this.player) return;
    let dist = 0, pan = 0;
    if (x !== null) {
      const T = SurviConfig.TILE, p = this.player;
      const dx = x - (p.x + p.w / 2), dy = (y ?? p.y) - (p.y + p.h / 2);
      dist = Math.min(1, Math.hypot(dx, dy) / (24 * T));
      pan = Math.max(-1, Math.min(1, dx / (14 * T)));
    }
    this.sonido.play(nombre, { dist, pan, ...opts });
  }

  // Voz de cada criatura (al pegarle o de vez en cuando).
  static VOZ = {
    zombie: 'zombie', esqueleto: 'esqueleto', slime: 'slime', serpiente: 'serpiente',
    ojo: 'ojo', ojo_boca: 'ojo', momia: 'zombie', arana: 'arana', murcielago: 'murcielago', yeti: 'yeti', vaca: 'vaca', cerdo: 'cerdo', gallina: 'gallina', gorrion: 'ave', cardenal: 'ave',
  };

  // Qué suena al picar / romper / colocar un bloque.
  static #materiales = new Map();
  static materialDe(id) {
    if (!id) return 'tierra';
    let m = SurviGame.#materiales.get(id);
    if (m) return m;
    const S = SurviConfig;
    if (id === S.TID.window || id === S.T.ICE || id === S.TID.hielo_azul || id === S.TID.icicle) m = 'vidrio';
    else if (S.FAMILIES.sand.ids.has(id) || id === S.T.GRAVEL) m = 'arena';
    else if (S.TOOL_FOR[id] === 'pickaxe') m = 'piedra';
    else if (S.TOOL_FOR[id] === 'axe') m = 'madera';
    else if (S.TOOL_FOR[id] === 'shovel') m = 'tierra';
    else m = 'hojas'; // hojas, pasto, flores, cultivos, antorchas…
    SurviGame.#materiales.set(id, m);
    return m;
  }

  // Sonidos de ambiente de los mobs cercanos (cada tanto, al azar).
  _vocesAmbiente(dt) {
    this._vozMs = (this._vozMs || 0) - dt;
    if (this._vozMs > 0) return;
    this._vozMs = 900;
    const T = SurviConfig.TILE, p = this.player;
    for (const lista of [this.enemies, this.animals]) {
      for (const c of lista) {
        if (Math.abs(c.x - p.x) > 18 * T || Math.abs(c.y - p.y) > 12 * T || c.estado === 'duerme') continue;
        const prob = lista === this.enemies ? (c.estado === 'persigue' || c.estado === 'dispara' ? 0.22 : 0.08) : 0.05;
        if (Math.random() < prob) {
          this.sonar(SurviGame.VOZ[c.tipo], c.x + c.w / 2, c.y);
          return; // de a una voz por vez
        }
      }
    }
  }

  // ═══════════ Cultivos ═══════════
  // ¿Hay agua cerca de la tierra arada de (col, row)? (misma fila o una arriba)
  _regada(col, row) {
    const D = SurviConfig.CULTIVO.aguaDistancia;
    for (let r = row - 1; r <= row; r++) for (let c = col - D; c <= col + D; c++) if (this.fluidos.tipo(c, r) === 1) return true;
    return false;
  }

  // Azada: tierra, pasto o nieve (con aire o pasto encima) → tierra arada.
  _usarAzada(id) {
    if (!this._hoverTile || this._usoPulsacion) return;
    const { col, row } = this._hoverTile;
    if (!this._inReach(col, row)) return;
    const tile = this.tilemap.get(col, row);
    const S = SurviConfig;
    const arable = tile === S.T.DIRT || ['grass', 'jgrass', 'snow'].some((f) => S.FAMILIES[f].ids.has(tile));
    if (!arable || !S.esAire(this.tilemap.get(col, row - 1))) return;
    this._usoPulsacion = true;
    if (S.DECO_IDS.has(this.tilemap.get(col, row - 1))) this.tilemap.breakTile(col, row - 1); // saca el pasto
    this.tilemap.set(col, row, this._regada(col, row) ? S.TID.farmland_wet : S.TID.farmland);
    this._retileAround(col, row);
    this._usarHerramienta(id);
    this._attackAnim = 120;
    this.sonar('arar', col * S.TILE + 8, row * S.TILE);
  }

  // Planta en la celda apuntada si abajo hay tierra arada. true si plantó.
  _plantar(id, tipo) {
    if (!this._hoverTile || (this.inventory[id] || 0) <= 0) return false;
    let { col, row } = this._hoverTile;
    // si apuntás a la tierra arada misma, se planta arriba
    if (SurviConfig.FARMLAND_IDS.has(this.tilemap.get(col, row))) row--;
    if (!this._inReach(col, row) || !SurviConfig.FARMLAND_IDS.has(this.tilemap.get(col, row + 1))) return false;
    if (!SurviConfig.esAire(this.tilemap.get(col, row)) || this.fluidos.tipo(col, row)) return false;
    if (this.tilemap.get(col, row)) this.tilemap.breakTile(col, row);
    this.tilemap.set(col, row, SurviConfig.CULTIVOS[tipo][0]);
    this.cultivos.set(`${col},${row}`, { tipo, ms: 0 });
    if (!this.creativo) this._removeItem(id);
    this._placeCd = SurviConfig.PLACE_COOLDOWN;
    this.sonar('colocar', col * SurviConfig.TILE + 8, row * SurviConfig.TILE + 8, { material: 'hojas' });
    return true;
  }

  // Suelta lo que da un cultivo al romperse (maduro: cosecha; verde: lo plantado).
  _cosechar_cultivo(col, row, tileId) {
    this.cultivos.delete(`${col},${row}`);
    if (this.creativo) return;
    const { tipo, etapa } = SurviConfig.CULTIVO_DE.get(tileId);
    const tabla = SurviConfig.COSECHA[tipo][etapa >= 3 ? 'madura' : 'verde'];
    for (const [item, min, max] of tabla) this._soltarEnCelda(item, min + Math.floor(Math.random() * (max - min + 1)), col, row);
  }

  // Crecen solos: cada CULTIVO.tickMs se revisan todos los plantados.
  _updateCultivos(dt) {
    this._cultivoMs += dt;
    const C = SurviConfig.CULTIVO;
    if (this._cultivoMs < C.tickMs || !this.cultivos.size) return;
    const paso = this._cultivoMs;
    this._cultivoMs = 0;
    const lluvia = this.clima && this.clima.lloviendo;
    for (const [k, cu] of this.cultivos) {
      const [col, row] = k.split(',').map(Number);
      const tile = this.tilemap.get(col, row);
      const info = SurviConfig.CULTIVO_DE.get(tile);
      if (!info || info.tipo !== cu.tipo) {
        this.cultivos.delete(k); // ya no está (se rompió)
        continue;
      }
      // la tierra de abajo se moja o se seca según el agua cerca
      const regada = this._regada(col, row + 1);
      const tierra = this.tilemap.get(col, row + 1);
      if (SurviConfig.FARMLAND_IDS.has(tierra)) {
        const debe = regada ? SurviConfig.TID.farmland_wet : SurviConfig.TID.farmland;
        if (tierra !== debe) this.tilemap.set(col, row + 1, debe);
      }
      if (info.etapa >= 3 && cu.tipo !== 'melon') continue; // maduro: listo para cosechar
      cu.ms += paso;
      const umbral = C.etapaMs * (regada ? C.factorRegado : 1) * (lluvia ? C.factorLluvia : 1);
      if (cu.ms >= umbral) {
        cu.ms = 0;
        if (info.etapa < 3) this.tilemap.set(col, row, SurviConfig.CULTIVOS[cu.tipo][info.etapa + 1]);
        else this._brotarSandia(col, row); // tallo maduro: da una sandía al costado
      }
    }
  }

  // Tallo de sandía maduro: pone un bloque de sandía a la izquierda o a la
  // derecha (en el aire, con suelo firme abajo). Si ya tiene una al lado, espera.
  _brotarSandia(col, row) {
    const S = SurviConfig, melon = S.TID.melon;
    if (this.tilemap.get(col - 1, row) === melon || this.tilemap.get(col + 1, row) === melon) return;
    const lados = Math.random() < 0.5 ? [-1, 1] : [1, -1];
    for (const d of lados) {
      const c = col + d;
      if (!S.esAire(this.tilemap.get(c, row)) || this.fluidos.tipo(c, row)) continue;
      const abajo = this.tilemap.get(c, row + 1);
      if (!S.TERRAIN_IDS.has(abajo) || abajo === melon) continue;
      if (this.tilemap.get(c, row)) this.tilemap.breakTile(c, row); // saca el pasto
      this.tilemap.set(c, row, melon);
      this._retileAround(c, row);
      return;
    }
  }

  // ═══════════ Pesca ═══════════
  // Punta de la caña (px de mundo), según hacia dónde mirás.
  _puntaCana() {
    const p = this.player, f = p.facing >= 0 ? 1 : -1;
    return { x: p.x + p.w / 2 + f * 16, y: p.y - 1 };
  }

  _usarCana(id) {
    if (this.boya) {
      // recoger: si estaba picando, sale algo
      if (this.boya.picando) {
        const { x, y } = this.boya.centro;
        const { id: pez, qty } = SurviConfig.sortearPesca(this.esNoche);
        const p = this.player;
        // sale volando hacia vos (y el imán lo junta)
        const vx = (p.x + p.w / 2 - x) / 38, vy = -3.4;
        this.soltarItem(pez, qty, x, y, { vx, vy, esperaMs: 250, atraido: true });
        this.salpicar(x, y);
        this.sonar('chapuzon', x, y);
        if (this.ui.showToast) this.ui.showToast(`¡Pescaste: ${SurviConfig.ITEM_INFO[pez].name}${qty > 1 ? ' x' + qty : ''}!`);
        this._usarHerramienta(id); // la caña se gasta
      }
      this.boya = null;
      this._attackAnim = 120;
      return;
    }
    // tirar hacia donde apuntás
    const o = this._puntaCana();
    let dx = this.player.facing, dy = -0.6;
    if (this._pointerWorld) {
      dx = this._pointerWorld.x - o.x;
      dy = this._pointerWorld.y - o.y - 20; // un poco hacia arriba: sale en arco
    }
    const l = Math.hypot(dx, dy) || 1;
    const v = SurviConfig.PESCA.velocidadTiro;
    if (dx) this.player.facing = Math.sign(dx);
    this.boya = new Boya(o.x, o.y, (dx / l) * v, (dy / l) * v);
    this._attackAnim = 120;
  }

  // Cuánto tarda en picar en (col, row): al azar, más rápido en agua
  // profunda (mucha agua alrededor) y con lluvia.
  tiempoPique(col, row) {
    const P = SurviConfig.PESCA;
    let ms = P.esperaMinMs + Math.random() * (P.esperaMaxMs - P.esperaMinMs);
    let agua = 0;
    for (let r = row; r <= row + 5; r++) for (let c = col - 5; c <= col + 5; c++) if (this.fluidos.tipo(c, r) === 1) agua++;
    if (agua >= P.aguaGrande) ms *= P.factorAguaGrande;
    if (this.clima && this.clima.lloviendo) ms *= P.factorLluvia;
    return ms;
  }

  // Algo (caja x, y, w, h con vy) cayó a un fluido: gotas (1 = agua) o
  // brasas y humo (2 = lava) en la superficie de esa columna.
  salpicarEn(o, tipo) {
    const T = SurviConfig.TILE, x = o.x + o.w / 2, c = Math.floor(x / T);
    let r = Math.floor((o.y + o.h - 1) / T);
    while (r > 0 && this.fluidos.tipo(c, r - 1) === tipo) r--;
    const sup = (r + 1) * T - (this.fluidos.nivel(c, r) / 8) * T;
    const fuerza = Math.max(1, Math.abs(o.vy || 0));
    if (tipo === 2) this.particulas.lava(x, sup, fuerza);
    else this.particulas.agua(x, sup, fuerza);
  }

  // Región de cueva de una celda (0 = normal). Mira un poco alrededor: en
  // el aire de una cueva cuenta la región de la roca de al lado.
  _regionCueva(c, r) {
    const reg = this.world.regionCueva;
    if (!reg || c < 0 || c >= SurviConfig.COLS || r < 0 || r >= SurviConfig.ROWS) return 0;
    return reg[r * SurviConfig.COLS + c] || 0;
  }

  // ═══════════ Explosivos ═══════════
  // Prende la TNT de (col, row): el bloque se vuelve una TNT encendida.
  encenderTnt(col, row, ms = SurviConfig.TNT_MECHA_MS) {
    if (this.tilemap.get(col, row) !== SurviConfig.TID.tnt) return;
    this.tilemap.breakTile(col, row);
    this._retileAround(col, row);
    this._soltarSinApoyo(col, row);
    this.fluidos.activar(col, row);
    this._lightDirty = true;
    this.tnts.push(new TntEncendida(col, row, ms));
    this.sonar('mecha', col * SurviConfig.TILE + 8, row * SurviConfig.TILE + 8);
  }

  // Explosión en (x, y) px de mundo. clave: 'hongo' | 'tnt' (SurviConfig.EXPLOSION).
  // Rompe bloques en un círculo (menos roca madre y estaciones; el hongo en
  // Fácil no rompe), lastima según la distancia a vos y a los mobs, y prende
  // otras TNT que alcance.
  explotar(x, y, clave, fuente = null) {
    const E = SurviConfig.EXPLOSION, D = E[clave] || E.hongo, T = SurviConfig.TILE;
    const radio = D.radio;
    this.sonar('explosion', x, y);
    if (this.camera) this.camera.shake(clave === 'tnt' ? 9 : 6, clave === 'tnt' ? 450 : 320);
    // partículas: fogonazo, humo y pedazos
    for (let i = 0; i < 14; i++) this.particulas.brasa(x + (Math.random() - 0.5) * radio * T, y + (Math.random() - 0.5) * radio * T, true);
    this.particulas.muerte(x - radio * T * 0.6, y - radio * T * 0.6, radio * T * 1.2, radio * T * 1.2);
    for (let i = 0; i < 6; i++) this.particulas.humo(x + (Math.random() - 0.5) * radio * T, y + (Math.random() - 0.5) * radio * T);
    // bloques
    const rompe = !(clave === 'hongo' && this.dif.sinRomperExplosion);
    if (rompe) {
      const c0 = Math.floor(x / T), r0 = Math.floor(y / T), R = Math.ceil(radio);
      const rotos = [];
      for (let r = r0 - R; r <= r0 + R; r++) {
        for (let c = c0 - R; c <= c0 + R; c++) {
          if (c < 0 || c >= SurviConfig.COLS || r < 0 || r >= SurviConfig.ROWS) continue;
          const d = Math.hypot(c + 0.5 - x / T, r + 0.5 - y / T);
          if (d > radio + (Math.random() - 0.5) * 0.6) continue; // borde irregular
          const id = this.tilemap.get(c, r);
          if (!id) continue;
          if (id === SurviConfig.TID.tnt) {
            this.encenderTnt(c, r, SurviConfig.TNT_CADENA_MS); // reacción en cadena
            continue;
          }
          if (SurviConfig.NO_EXPLOTA.has(id)) continue;
          if (this._romperPorExplosion(c, r, id)) rotos.push([c, r]);
        }
      }
      for (const [c, r] of rotos) {
        this._retileAround(c, r);
        this._soltarSinApoyo(c, r);
        this.fluidos.activar(c, r);
      }
      if (rotos.length) this._lightDirty = true;
    }
    // daño: más cerca, más daño
    const alcance = (radio + 1.5) * T;
    const danio = (o) => {
      const d = Math.hypot(o.x + o.w / 2 - x, o.y + o.h / 2 - y);
      return d >= alcance ? 0 : Math.max(1, Math.round(D.danio * (1 - d / alcance)));
    };
    const p = this.player;
    const dp = this.dead || this.invisible ? 0 : danio(p);
    if (dp > 0) {
      this._damage(dp, { origen: 'explosion' });
      p.empujar(x);
      p.vy = Math.min(p.vy, -4);
    }
    for (const lista of [this.enemies, this.animals]) {
      for (const c of lista) {
        if (c === fuente || c.estaMuerto()) continue;
        const dc = danio(c);
        if (dc <= 0) continue;
        c.recibirGolpe(dc, Math.sign(c.x + c.w / 2 - x) || 1);
        if (c.estaMuerto()) this._cosechar(c);
      }
    }
  }

  // Un bloque que rompe una explosión: a veces suelta su ítem. true si se rompió.
  _romperPorExplosion(c, r, id) {
    const S = SurviConfig;
    const broken = this.tilemap.breakTile(c, r);
    if (!broken) return false;
    if (S.CULTIVO_DE.has(broken)) this.cultivos.delete(`${c},${r}`);
    if (!this.creativo && Math.random() < S.EXPLOSION.dropChance) {
      const drop = S.DROPS[broken];
      if (drop && !S.ORE_DROPS[broken]) this._soltarEnCelda(drop, 1, c, r);
      else if (S.ORE_DROPS[broken]) this._soltarEnCelda(S.ORE_DROPS[broken].drop, 1, c, r); // los minerales siempre sirven
    }
    if (S.BED_IDS.has(broken) || S.DOOR_IDS.has(broken)) this._romperCompanero(c, r, broken);
    if (S.NEST_IDS.has(broken)) this.tilemap.set(c, r, 0);
    return true;
  }

  // Te saca hambre (golpe de momia).
  darHambre(n) {
    if (this.dead || this.invisible) return;
    this.hunger = Math.max(0, this.hunger - n);
    this._renderHunger();
  }

  _updateTnts(dt, step) {
    for (let i = this.tnts.length - 1; i >= 0; i--) if (!this.tnts[i].actualizar(dt, step, this)) this.tnts.splice(i, 1);
  }

  // ¿El jugador se está quemando? (fuego o lava)
  get jugadorEnFuego() {
    return !this.dead && !this.invisible && (this.quemaduraMs > 0 || !!(this._enFluido && this._enFluido.lava));
  }

  // ¿En ese punto de la PANTALLA se ve el cielo? (para la luna y las estrellas)
  _cieloAbierto(sx, sy) {
    const T = SurviConfig.TILE, z = this._zoom;
    const c = Math.floor((this.camera.x + sx / z) / T), r = Math.floor((this.camera.y + sy / z) / T);
    if (c < 0 || c >= SurviConfig.COLS) return false;
    if (r < 0) return true;
    if (r >= this.light.skyRow[c] || this.tilemap.get(c, r) || this.fluidos.tipo(c, r)) return false;
    return !(this.fondo && this.fondo[r * SurviConfig.COLS + c]);
  }

  // Datos del cielo para este frame.
  // Acostado en la cama: el sprite girado 90° sobre el colchón y unas "z" que suben.
  static SUENO_DY = 1; // px: bajar / subir el cuerpo sobre la cama
  _dibujarDurmiendo(ctx) {
    const T = SurviConfig.TILE, PS = SurviConfig.PLAYER_SPRITE, c = SpritesSurvi.PLAYER.cell;
    const { col, row } = this.durmiendo;
    const s = this.camera.worldToScreen((col + 1) * T, row * T + T / 2);
    const x = Math.round(s.x), y = Math.round(s.y + SurviGame.SUENO_DY);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2); // la cabeza hacia la izquierda
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = this.quality === 'high' ? 'high' : 'low';
    SpritesSurvi.drawSprite(ctx, this.img.player, 0, 0, c, c, -PS.w / 2, -PS.h / 2, PS.w, PS.h, false);
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
    // "z" pixeladas que suben y se desvanecen
    const a0 = ctx.globalAlpha;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 2; i++) {
      const f = (this.playedMs / 1100 + i * 0.5) % 1;
      const zx = Math.round(x - T + f * 5), zy = Math.round(y - 7 - f * 10);
      ctx.globalAlpha = a0 * (1 - f);
      ctx.fillRect(zx, zy, 3, 1);
      ctx.fillRect(zx + 1, zy + 1, 1, 1);
      ctx.fillRect(zx, zy + 2, 3, 1);
    }
    ctx.globalAlpha = a0;
  }

  _datosCielo(nightK) {
    return {
      W: this.vistaW,
      H: SurviConfig.VIEW_H,
      hora: this.timeOfDay,
      noche: nightK,
      lluvia: this.clima.intensidad,
      colorLluvia: this.clima.datosVisuales.cielo,
      camX: this.camera.x,
      dias: this.dias,
      t: this.playedMs,
      sangre: this.lunaSangre,
    };
  }

  // Salpicadura chiquita (al caer la boya, cuando pica y al sacar algo).
  salpicar(x, y) {
    for (let i = 0; i < 6; i++) {
      this._gotas.push({ x, y, vx: (Math.random() - 0.5) * 1.6, vy: -1 - Math.random() * 1.5, ms: 400 });
    }
  }

  _updatePesca(dt, step) {
    if (this.boya) {
      const id = this.hotbarSlots[this.selectedSlot];
      const info = id ? SurviConfig.ITEM_INFO[id] : null;
      // cambiaste de ítem, sos espectador o se cortó la línea: se recoge sola
      if (!info || !info.cana || this.espectador || !this.boya.actualizar(dt, step, this)) this.boya = null;
    }
    const G = this._gotas;
    for (let i = G.length - 1; i >= 0; i--) {
      const g = G[i];
      g.ms -= dt;
      g.vy += 0.12 * step;
      g.x += g.vx * step;
      g.y += g.vy * step;
      if (g.ms <= 0) {
        G[i] = G[G.length - 1];
        G.pop();
      }
    }
  }

  // Llamas pixeladas sobre todo lo que se está quemando (mobs y vos).
  _dibujarFuegos(ctx) {
    const cam = this.camera;
    for (const lista of [this.enemies, this.animals]) {
      for (const c of lista) {
        if (!c.enFuego) continue;
        const s = cam.worldToScreen(c.x, c.y);
        if (s.x < -c.w - 8 || s.y < -c.h - 8 || s.x > cam.width + 8 || s.y > cam.height + 8) continue;
        Llamas.dibujar(ctx, s.x, s.y, c.w, c.h, this.playedMs + c.w * 37);
      }
    }
    if (this.jugadorEnFuego) {
      const p = this.player, s = cam.worldToScreen(p.x, p.y);
      Llamas.dibujar(ctx, s.x, s.y, p.w, p.h, this.playedMs);
    }
  }

  // Caña en la mano, hilo hasta la boya, boya y salpicaduras.
  _dibujarPesca(ctx) {
    const id = this.hotbarSlots[this.selectedSlot];
    const info = id ? SurviConfig.ITEM_INFO[id] : null;
    const cam = this.camera;
    if (info && info.cana && !this.dead && !this.espectador) {
      const p = this.player, f = p.facing >= 0 ? 1 : -1;
      const mano = cam.worldToScreen(p.x + p.w / 2 + f * 4, p.y + 12);
      const punta = cam.worldToScreen(this._puntaCana().x, this._puntaCana().y);
      ctx.strokeStyle = '#8a5e32';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mano.x, mano.y);
      ctx.lineTo(punta.x, punta.y);
      ctx.stroke();
      if (this.boya) {
        // hilo con un poco de panza
        const b = cam.worldToScreen(this.boya.centro.x, this.boya.centro.y);
        const panza = this.boya.estado === 'vuela' ? 0 : Math.min(18, Math.abs(b.x - punta.x) * 0.25);
        ctx.strokeStyle = 'rgba(235,235,235,0.8)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(punta.x, punta.y);
        ctx.quadraticCurveTo((punta.x + b.x) / 2, Math.max(punta.y, b.y) + panza, b.x, b.y - 2);
        ctx.stroke();
        const s = cam.worldToScreen(this.boya.x, this.boya.y);
        this.boya.dibujar(ctx, s.x, s.y);
      }
    }
    ctx.fillStyle = 'rgba(200,230,255,0.9)';
    for (const g of this._gotas) {
      const s = cam.worldToScreen(g.x, g.y);
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }
  }

  // ═══════════ Ítems tirados en el suelo (ItemSuelto) ═══════════
  // Tira `qty` de `id` en (x, y) px de mundo. Si hay otro igual muy cerca
  // (y sin desgaste), se suman en uno solo.
  soltarItem(id, qty, x, y, opts = {}) {
    if (!id || !SurviConfig.ITEM_INFO[id] || qty <= 0) return;
    if (!opts.gastado) {
      for (const o of this.sueltos) {
        if (o.id === id && !o.gastado && Math.abs(o.x + o.w / 2 - x) < 14 && Math.abs(o.y + o.h / 2 - y) < 14) {
          o.qty += qty;
          o.vidaMs = SurviConfig.SUELTO_VIDA_MS;
          return;
        }
      }
    }
    this.sueltos.push(new ItemSuelto({ id, qty, x, y, ...opts }));
    if (this.sueltos.length > SurviConfig.SUELTO_MAX) this.sueltos.shift(); // se va el más viejo
  }

  _soltarEnCelda(id, qty, col, row) {
    const T = SurviConfig.TILE;
    this.soltarItem(id, qty, col * T + T / 2, row * T + T / 2);
  }

  // Drops con cantidad al azar (sandía, telaraña, nido…)
  _soltarDropVarios(blockId, col, row) {
    const v = SurviConfig.DROP_VARIOS[blockId];
    if (v) this._soltarEnCelda(v.id, v.min + Math.floor(Math.random() * (v.max - v.min + 1)), col, row);
  }

  // Nido roto por una flecha: suelta los huevos.
  // (queda la rama sola, sin el nido)
  romperNido(col, row) {
    const id = this.tilemap.get(col, row);
    if (!SurviConfig.NEST_IDS.has(id)) return;
    this.tilemap.set(col, row, SurviConfig.NIDO_A_RAMA[id]);
    this._soltarDropVarios(id, col, row);
    if (Math.random() < SurviConfig.NIDO_PLUMA) this._soltarEnCelda(SurviConfig.ESPECIAL.pluma, 1, col, row);
    this._retileAround(col, row);
  }

  hayLugarPara(id) {
    if (this.espectador) return false; // el espectador no junta nada
    if (this._hasRoomFor(id)) return true;
    if (this._avisoLlenoMs <= 0 && this.ui.showToast) {
      this.ui.showToast('Inventario lleno');
      this._avisoLlenoMs = 4000;
    }
    return false;
  }

  // Un ítem del suelo llegó al jugador. true si entró.
  recogerSuelto(s) {
    if (!this._hasRoomFor(s.id)) return false;
    if (!this._addItem(s.id, s.qty)) return false;
    this.sonar('recoger');
    if (s.gastado) this.desgaste.poner(s.id, s.gastado);
    return true;
  }

  _updateSueltos(dt, step) {
    const S = this.sueltos, T = SurviConfig.TILE, lejos = 60 * T, p = this.player;
    for (let i = S.length - 1; i >= 0; i--) {
      const s = S[i];
      let sigue;
      if (Math.abs(s.x - p.x) > lejos || Math.abs(s.y - p.y) > lejos) {
        s.vidaMs -= dt; // lejos: solo envejece (no gasta física)
        sigue = s.vidaMs > 0;
      } else sigue = s.actualizar(dt, step, this);
      if (!sigue) {
        S[i] = S[S.length - 1];
        S.pop();
      }
    }
  }

  // Tirar un ítem (arrastrado afuera del inventario): sale toda la pila hacia
  // donde mirás y no se junta por TIRADO_ESPERA_MS (así no vuelve solo).
  tirarItem(id) {
    id = Number(id);
    const qty = this.inventory[id] || 0;
    if (this.espectador || qty <= 0) return false;
    const p = this.player, dir = p.facing || 1;
    this.sueltos.push(
      new ItemSuelto({
        id,
        qty,
        x: p.x + p.w / 2 + dir * 6,
        y: p.y + p.h * 0.35,
        gastado: this.desgaste.tomar(id),
        vx: dir * 2.4,
        vy: -2,
        esperaMs: SurviConfig.TIRADO_ESPERA_MS,
      }),
    );
    if (this.sueltos.length > SurviConfig.SUELTO_MAX) this.sueltos.shift();
    delete this.inventory[id];
    this.hotbarSlots = this.hotbarSlots.map((s) => (Number(s) === id ? null : s));
    this._renderHotbar();
    this._renderInventory();
    return true;
  }

  // Al morir: todo el inventario y el equipo quedan tirados donde moriste
  // (hay que ir a buscarlos antes de que pasen 10 minutos).
  _soltarTodo() {
    const p = this.player, x = p.x + p.w / 2, y = p.y + p.h / 2;
    const tirar = (id, qty, gastado) =>
      this.sueltos.push(
        new ItemSuelto({ id, qty, x, y, gastado, vx: (Math.random() - 0.5) * 4, vy: -1.5 - Math.random() * 2.5, esperaMs: 1500 }),
      );
    for (const [k, qty] of Object.entries(this.inventory)) {
      const id = Number(k);
      if (qty > 0) tirar(id, qty, this.desgaste.tomar(id));
    }
    for (const slot of Object.keys(this.equipment)) {
      const id = this.equipment[slot];
      if (!id) continue;
      tirar(id, 1, this.desgasteEquipo.tomar(id));
      this.equipment[slot] = null;
    }
    this.inventory = {};
    this.hotbarSlots = this.hotbarSlots.map(() => null);
    this._renderHotbar();
  }

  // Ícono de un ítem en el canvas (ítems tirados). Bloques e íconos propios
  // salen del tileset; herramientas, comida y materiales del atlas de ítems.
  dibujarIcono(ctx, id, x, y, tam) {
    const info = SurviConfig.ITEM_INFO[id];
    if (!info) return;
    const T = SurviConfig.TILE, tc = SurviConfig.TILESET_COLS;
    const tile = info.icono || (id < 1000 ? info.place || id : 0);
    if (tile && this._tilesetCanvas) {
      const i = tile - 1;
      ctx.drawImage(this._tilesetCanvas, (i % tc) * T, Math.floor(i / tc) * T, T, T, x, y, tam, tam);
      return;
    }
    const cell = info.sprite && this.img.items ? SpritesSurvi.itemCell(info.sprite) : null;
    if (cell) {
      const k = tam / Math.max(cell.w, cell.h);
      ctx.drawImage(this.img.items, cell.sx, cell.sy, cell.w, cell.h, x, y, cell.w * k, cell.h * k);
      return;
    }
    ctx.fillStyle = '#c9a36a'; // sin dibujo: cuadradito
    ctx.fillRect(x + 1, y + 1, tam - 2, tam - 2);
  }

  // ═══════════ Update ═══════════
  // Paredes y ventanas (capa de fondo): solo las celdas que se ven, con el
  // ctx ya escalado por el zoom. Donde hay un bloque sólido adelante, se tapa.
  _dibujarFondo(ctx) {
    if (!this.fondo || !this._tilesetCanvas || !this._fondoN) return; // sin paredes en el mundo: nada que recorrer
    const T = SurviConfig.TILE, COLS = SurviConfig.COLS, cam = this.camera, img = this._tilesetCanvas;
    const c0 = Math.max(0, Math.floor(cam.x / T)), c1 = Math.min(COLS - 1, Math.floor((cam.x + cam.width) / T));
    const r0 = Math.max(0, Math.floor(cam.y / T)), r1 = Math.min(SurviConfig.ROWS - 1, Math.floor((cam.y + cam.height) / T));
    const tc = SurviConfig.TILESET_COLS;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const id = this.fondo[r * COLS + c];
        if (!id || SurviConfig.SOLID_IDS.has(this.tilemap.get(c, r))) continue;
        const i = id - 1;
        ctx.drawImage(img, (i % tc) * T, Math.floor(i / tc) * T, T, T, Math.round(c * T - cam.x), Math.round(r * T - cam.y), T, T);
      }
    }
  }

  _update(dt, step) {
    // los hornos siguen cocinando aunque tengas abierta su pantalla (o el inventario)
    if (this.player && !this.paused && !this.dead && this.furnaces) this._tickFurnaces(dt);
    if (!this.player || this.paused || this.invOpen || this.mapaOpen || this.dead) return;
    if (this.enVertical) return; // celular en vertical: esperando que lo giren
    this.playedMs += dt;
    if (this._attackCd > 0) this._attackCd -= dt;
    if (this._placeCd > 0) this._placeCd -= dt;
    if (this._attackAnim > 0) this._attackAnim -= dt;
    if (this._swing.t < this._swing.dur) this._swing.t += dt;
    this._aplicarGolpe();
    const antes = this.timeOfDay;
    const velTiempo = this.durmiendo ? SurviConfig.SUENO_VELOCIDAD : 1; // durmiendo, el día pasa más rápido
    this.timeOfDay = (this.timeOfDay + (dt * velTiempo) / SurviConfig.DAY_CYCLE_MS) % 1;
    if (this.timeOfDay < antes) this._nuevoDia(); // dio la vuelta: amaneció otro día
    this._cambioNoche();
    this._actualizarClima(dt, step);
    if (this.invulnMs > 0) this.invulnMs -= dt;
    if (this._hitFlashMs > 0) this._hitFlashMs -= dt;
    // Hambre: se vacía sola con el tiempo jugado. En 0 pega daño cada
    // tanto (ignora invulnerabilidad, como la caída); bien alimentado
    // (arriba del umbral) regenera vida de a poco como premio por comer.
    if (!this.invisible) this.hunger = Math.max(0, this.hunger - SurviConfig.HUNGER_DRAIN_PER_MS * this.dif.hambre * dt);
    if (this.hunger <= 0) {
      this._starveTimer += dt;
      if (this._starveTimer >= SurviConfig.STARVE_INTERVAL_MS) {
        this._starveTimer = 0;
        // en Fácil / Normal el hambre no mata: te deja en 1 de vida
        const dmg = this.dif.mataHambre ? SurviConfig.STARVE_DAMAGE : Math.min(SurviConfig.STARVE_DAMAGE, this.hp - 1);
        if (dmg > 0)
          this._damage(dmg, {
            ignoreInvuln: true,
            origen: 'hambre',
          });
      }
    } else {
      this._starveTimer = 0;
    }
    if (this.hunger >= SurviConfig.HUNGER_REGEN_THRESHOLD && this.hp < this.maxHp) {
      this._regenTimer += dt;
      if (this._regenTimer >= SurviConfig.HP_REGEN_INTERVAL_MS) {
        this._regenTimer = 0;
        this.hp = Math.min(this.maxHp, this.hp + SurviConfig.HP_REGEN_AMOUNT);
        this._renderHealth();
      }
    } else {
      this._regenTimer = 0;
    }
    const hungerShown = Math.round(this.hunger);
    if (hungerShown !== this._lastHungerShown) {
      this._lastHungerShown = hungerShown;
      this._renderHunger();
    }
    const st = this.input.state;
    const left = st.left || this.touchState.left;
    const right = st.right || this.touchState.right;
    const jump = st.jump || this.touchState.jump;
    const abajo = st.down || this.touchState.down;
    // Creativo: dos saltos seguidos prenden / apagan el vuelo (como en Minecraft).
    const saltoNuevo = jump && !this._saltoPrev;
    this._saltoPrev = jump;
    if (saltoNuevo && (this.creativo || this.tieneAlas) && !this.espectador && !this.durmiendo) {
      if (this.playedMs - this._ultimoSaltoMs < SurviConfig.DOBLE_SALTO_MS) {
        this._ultimoSaltoMs = -1e9;
        this.alternarVuelo();
      } else this._ultimoSaltoMs = this.playedMs;
    }
    // Durmiendo: saltar o moverse te levanta; si rompieron la cama, también.
    if (this.durmiendo) {
      const { col, row } = this.durmiendo;
      if (saltoNuevo || left || right || this.tilemap.get(col, row) !== SurviConfig.TID.bed_l) this._despertar();
    }
    this.player.vx = 0;
    if (left) {
      this.player.vx = -SurviConfig.MOVE_SPEED;
      this.player.facing = -1;
    }
    if (right) {
      this.player.vx = SurviConfig.MOVE_SPEED;
      this.player.facing = 1;
    }
    // Creativo volando o espectador: movimiento propio (sin agua, sin caída).
    // (con alas en el inventario también se vuela en supervivencia; si ya no las tenés, caés)
    if (this.volando && !this.invisible && !this.tieneAlas) this.volando = false;
    const especial = (this.invisible && (this.volando || this.espectador)) || this.volando;
    const wasGrounded = this.player.grounded;
    if (this.durmiendo) {
      this.player.vx = this.player.vy = 0; // acostado: no se mueve
      this._fallFromY = null;
    } else if (especial) this._moverEspecial(left, right, jump, abajo, step);
    else {
    // Agua y lava: nadando la gravedad y la velocidad bajan, y mantener
    // saltar te hace subir. Caer al agua no lastima.
    const fl = this.fluidos.enCaja(this.player);
    if (fl.agua && !this._enFluido.agua && this.player.vy > 1.5) {
      this.sonar('chapuzon'); // caíste al agua
      this.salpicarEn(this.player, 1);
    }
    if (fl.lava && !this._enFluido.lava) this.salpicarEn(this.player, 2); // brasas y humo
    this._enFluido = fl;
    const nado = fl.agua || fl.lava ? SurviConfig.NADO[fl.lava ? 'lava' : 'agua'] : null;
    this.player.vx *= this.factorLento; // enredado / congelado
    if (nado) this.player.vx *= nado.velX;
    else if (jump && this.player.grounded) this.player.vy = SurviConfig.JUMP_VEL * (this.enredadoMs > 0 ? SurviConfig.ENREDADO_SALTO : 1);
    const quiere = this.player.vx;
    const escalera = this._enEscalera();
    if (escalera) {
      // Escalera (como en Minecraft): arriba sube, abajo baja, si no te quedás
      // agarrado. Sin gravedad y sin daño de caída.
      this.player.vy = jump ? -SurviConfig.ESCALERA_VEL : abajo ? SurviConfig.ESCALERA_VEL : 0;
      this._fallFromY = null;
    } else if (nado) {
      this.player.vy = Math.min(this.player.vy + 0.6 * nado.grav * step, nado.caidaMax);
      if (jump) this.player.vy = Math.max(this.player.vy - 0.55 * step, -nado.subir);
      this._fallFromY = null;
    } else SurviGame.E2D().Physics.applyGravity(this.player, step);
    // step: sin esto la velocidad dependía de los FPS (a 30fps, mitad de
    // velocidad; en monitores de 144Hz, más del doble).
    SurviGame.E2D().Physics.resolveTileCollisions(this.player, this.tilemap, step);
    // Salto automático: caminando contra un bloque de 1 de alto, lo sube solo.
    if (this.autoSalto && quiere !== 0 && this.player.vx === 0 && this.player.grounded) {
      if (this.player.escalonAdelante(this.tilemap, Math.sign(quiere))) this.player.vy = SurviConfig.AUTOSALTO_VEL;
    }
    // Salir del agua: en la superficie, nadando contra la orilla, salta afuera.
    if (nado && jump && !fl.cabeza && quiere !== 0 && this.player.vx === 0) this.player.vy = SurviConfig.JUMP_VEL * 0.75;
    this._efectosFluidos(dt);
    }
    if (!this.espectador) this._puertasAutomaticas(right && !left ? 1 : left && !right ? -1 : 0);
    if (this._fundidoMs > 0) this._fundidoMs -= dt;
    // Daño de caída
    if (!this.player.grounded) {
      this._fallFromY = this._fallFromY === null ? this.player.y : Math.min(this._fallFromY, this.player.y);
    } else {
      if (!wasGrounded && this._fallFromY !== null) {
        const tiles = (this.player.y - this._fallFromY) / SurviConfig.TILE;
        if (tiles > SurviConfig.FALL_SAFE_TILES) {
          this._damage(Math.round((tiles - SurviConfig.FALL_SAFE_TILES) * SurviConfig.FALL_DMG_PER_TILE), {
            ignoreInvuln: true,
            origen: 'caida',
          });
        }
      }
      this._fallFromY = null;
    }
    this.player.x = Math.max(0, Math.min(this.player.x, SurviConfig.WORLD_W - this.player.w));
    if (this.player.y > SurviConfig.WORLD_H + 100) {
      this.player.x = this.spawn.x;
      this.player.y = this.spawn.y;
      this.player.vy = 0;
      this._fallFromY = null;
    }
    // animación del personaje: 2 frames de caminar o 2 de idle, cada uno
    // con su propia velocidad; saltar/morir son 1 frame fijo.
    this._anim.t += dt;
    const walking = Math.abs(this.player.vx) > 0.1 && this.player.grounded;
    if (walking !== this._anim.walking) {
      this._anim.walking = walking;
      this._anim.t = 0;
      this._anim.i = 0;
    }
    const period = 1000 / (walking ? SpritesSurvi.PLAYER.walkFps : SpritesSurvi.PLAYER.idleFps);
    if (this._anim.t >= period) {
      this._anim.t = 0;
      this._anim.i = (this._anim.i + 1) % 2;
    }
    if (this.tactil) {
      this._empujarMiraBorde(dt);
      this._actualizarMira();
    }
    if (this.pointer.down) {
      if (this.pointer.button === 0) this._mineTick(dt);
      else if (this.pointer.button === 2) this._tryPlace();
    }
    if (this._colocandoTactil) this._tryPlace();
    this._updateEnemies(dt, step);
    this._mostrarCoords();
    this._updateAnimals(dt, step);
    this._updateSueltos(dt, step);
    this._updatePesca(dt, step);
    this.particulas.actualizar(dt, step);
    this._updateTnts(dt, step);
    this._updateCultivos(dt * (this.durmiendo ? SurviConfig.SUENO_VELOCIDAD : 1));
    this._vocesAmbiente(dt);
    if (this._avisoLlenoMs > 0) this._avisoLlenoMs -= dt;
    this._actualizarVeneno(dt);
    this._actualizarLentitud(dt);
    if (this._arcoCd > 0) this._arcoCd -= dt;
    if (this._avisoFlechasMs > 0) this._avisoFlechasMs -= dt;
    for (let i = this.flechas.length - 1; i >= 0; i--) {
      if (!this.flechas[i].actualizar(dt, step, this)) this.flechas.splice(i, 1);
    }
    this.fluidos.actualizar(
      dt,
      (c, r) => SurviConfig.esAire(this.tilemap.get(c, r)), // el agua pasa por el pasto
      (c, r) => this._solidificarLava(c, r),
    );
    this._applyZoom(dt);
    const t = this._cameraTarget();
    this.camera.followSmooth(t.x, t.y);
    this.camera.update(dt);
  }

  // Devuelve el índice de celda y si hay que espejarlo. Caminar y saltar
  // tienen frames propios para cada lado; idle y muerte miran a la derecha
  // y se espejan para la izquierda.
  _playerFrame() {
    const F = SpritesSurvi.PLAYER.frames,
      right = this.player.facing >= 0;
    if (this.dead)
      return {
        f: F.death,
        flip: false,
      };
    if (!this.player.grounded)
      return {
        f: right ? F.jumpR : F.jumpL,
        flip: false,
      };
    if (Math.abs(this.player.vx) > 0.1)
      return {
        f: (right ? F.walkR : F.walkL)[this._anim.i],
        flip: false,
      };
    return {
      f: F.idle[this._anim.i % F.idle.length],
      flip: !right,
    };
  }

  _startSwing(dur, restart = false) {
    if (!restart && this._swing.t < this._swing.dur) return; // deja terminar el golpe en curso
    this._swing.t = 0;
    this._swing.dur = dur;
  }

  // Brazo + ítem girando alrededor del hombro. Se dibuja en coordenadas
  // lógicas de pantalla (ya dentro del ctx escalado por el zoom).
  _drawSwingArm(ctx, cellX, cellY) {
    const sw = this._swing;
    if (sw.t >= sw.dur) return;
    if (!this.img.player) return; // sprite sin cargar (ej. mala conexión): sin brazo, pero sin romper el frame
    const right = this.player.facing >= 0;
    const u = Math.min(1, sw.t / sw.dur);
    const e = 1 - (1 - u) * (1 - u); // arranca rápido, frena al final
    const ang = SurviGame.SWING_FROM + (SurviGame.SWING_TO - SurviGame.SWING_FROM) * e;
    const A = SpritesSurvi.PLAYER.arm,
      S = SpritesSurvi.PLAYER.shoulder,
      cs = SpritesSurvi.PLAYER.fw;
    const shx = cellX + (right ? S.x : cs - S.x);
    const shy = cellY + S.y;
    ctx.save();
    ctx.translate(shx, shy);
    if (!right) ctx.scale(-1, 1); // mismo giro, espejado
    ctx.rotate(ang);
    // ítem en la mano: se dibuja ANTES del brazo, así la mano lo tapa
    const tool = this.heldTool;
    if (tool && tool.sprite && this.img.items) {
      // atlas de ítems: tamaño real del dibujo (1 px del dibujo = 1 px del mundo)
      const cell = SpritesSurvi.itemCell(tool.sprite),
        hold = SpritesSurvi.itemHold(tool.sprite);
      if (cell && hold) {
        ctx.save();
        ctx.translate(0, A.handY - A.pivotY);
        ctx.rotate(hold.rot);
        if (hold.scale !== 1) ctx.scale(hold.scale, hold.scale);
        ctx.imageSmoothingEnabled = hold.scale !== 1; // tamaño exacto: sin suavizar
        ctx.drawImage(this.img.items, cell.sx, cell.sy, cell.w, cell.h, -hold.ax, -hold.ay, cell.w, cell.h);
        ctx.imageSmoothingEnabled = true;
        ctx.restore();
      }
    }
    const c = SpritesSurvi.PLAYER.cell;
    ctx.drawImage(this.img.player, SpritesSurvi.PLAYER.frames.arm * c, 0, c, c, -A.pivotX, -A.pivotY, cs, cs);
    ctx.restore();
  }

  // ═══════════ Draw ═══════════
  _draw() {
    const ctx = this.ctx;
    // Todo el dibujo trabaja en unidades lógicas (480x288); esto lo lleva
    // al backing store de alta resolución.
    ctx.setTransform(this.renderScale, 0, 0, this.renderScale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (!this.tilemap) {
      ctx.clearRect(0, 0, this.vistaW, SurviConfig.VIEW_H);
      return;
    }
    // El shake de la cámara (camera.shake()) solo se ve solo si se dibuja
    // con camera.begin()/end() — acá se arma el frame a mano con
    // worldToScreen/tilemap.draw(camera), que leen camera.x/y directo y no
    // saben nada de shake. Se corre la cámara el offset de este frame,
    // se dibuja todo con ella corrida, y se devuelve al final: mismo
    // resultado que begin()/end() pero sin tocar el resto del dibujo.
    const shakeX = this.camera._shakeOffsetX || 0;
    const shakeY = this.camera._shakeOffsetY || 0;
    this.camera.x -= shakeX;
    this.camera.y -= shakeY;
    // Alinear la cámara a pixeles REALES de pantalla (no de mundo): sin
    // esto cada frame caía en posiciones fraccionarias distintas y el
    // mapa "temblaba". Se deshace al final junto con el shake.
    const snapStep = 1 / (this.renderScale * this._zoom);
    const snapDX = this.camera.x - Math.round(this.camera.x / snapStep) * snapStep;
    const snapDY = this.camera.y - Math.round(this.camera.y / snapStep) * snapStep;
    this.camera.x -= snapDX;
    this.camera.y -= snapDY;
    const pcol = Math.max(
      0,
      Math.min(SurviConfig.COLS - 1, Math.floor((this.player.x + this.player.w / 2) / SurviConfig.TILE)),
    );
    const prow = Math.floor((this.player.y + this.player.h / 2) / SurviConfig.TILE);
    const underground = prow > this.world.surfaceByCol[pcol] + 6;
    const sun = LightMap.sunAt(this.timeOfDay, SurviConfig.NIGHT_SUN);
    const nightK = (1 - sun) / (1 - SurviConfig.NIGHT_SUN); // 0 = día, 1 = noche cerrada
    // Cielo: el color se mezcla de a poco (cambio de bioma, entrar a una cueva)
    const ahora = performance.now();
    const dtCielo = this._cieloT ? Math.min(100, ahora - this._cieloT) : 0;
    this._cieloT = ahora;
    const viento = this.clima.lloviendo ? 2.2 : 1;
    if (!this.cielo) this.cielo = new Cielo(Number(this.seed) || 1);
    const regCueva = this._regionCueva(pcol, prow);
    this.cielo.actualizar(
      dtCielo,
      LightMap.mixHex(SurviConfig.BIOMES[this.world.biomeByCol[pcol]].sky, SurviConfig.NIGHT_SKY, nightK),
      underground,
      viento,
      SurviConfig.CUEVA_INFO[regCueva].fondo, // cada tipo de cueva tiene su color de fondo
    );
    const datosCielo = this._datosCielo(nightK);
    this.cielo.dibujarFondo(ctx, datosCielo); // color, sol, nubes
    ctx.save();
    ctx.scale(this._zoom, this._zoom);
    this._dibujarFondo(ctx);
    this.tilemap.draw(ctx, this.camera);
    for (const en of this.enemies) {
      const s = this.camera.worldToScreen(en.x, en.y);
      if (s.x < -en.w - 16 || s.y < -en.h - 16 || s.x > this.camera.width + 16 || s.y > this.camera.height + 16) continue;
      en.dibujar(ctx, s.x, s.y);
    }
    // ── Animales (cada uno se dibuja a sí mismo; se saltean los de fuera de la vista) ──
    for (const a of this.animals) {
      const s = this.camera.worldToScreen(a.x, a.y);
      if (s.x < -a.w || s.y < -a.h || s.x > this.camera.width || s.y > this.camera.height) continue;
      a.dibujar(ctx, s.x, s.y);
    }
    // ── Ítems tirados (solo los que se ven) ──
    for (const it of this.sueltos) {
      const s = this.camera.worldToScreen(it.x, it.y);
      if (s.x < -10 || s.y < -10 || s.x > this.camera.width + 10 || s.y > this.camera.height + 10) continue;
      it.dibujar(ctx, s.x, s.y, this);
    }
    // ── Flechas (en vuelo o clavadas) ──
    for (const f of this.flechas) {
      const s = this.camera.worldToScreen(f.x, f.y);
      f.dibujar(ctx, s.x, s.y);
    }
    // Arco del golpe (solo con SurviConfig.DEBUG_GOLPE, para ajustar el alcance)
    if (SurviConfig.DEBUG_GOLPE && this._golpe) {
      const T = SurviConfig.TILE, a = this._golpe.arco, f = this.player.facing;
      const c = this._centroGolpe();
      const s = this.camera.worldToScreen(c.x, c.y);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,60,60,0.9)';
      ctx.beginPath();
      ctx.ellipse(s.x - f * 0, s.y, a.adelante * T, a.vertical * T, 0, f > 0 ? -Math.PI / 2 : Math.PI / 2, f > 0 ? Math.PI / 2 : (3 * Math.PI) / 2);
      ctx.moveTo(s.x - f * a.atras * T, s.y - a.vertical * T);
      ctx.lineTo(s.x - f * a.atras * T, s.y + a.vertical * T);
      ctx.stroke();
      ctx.restore();
    }
    // ── Personaje + herramienta en mano ── (espectador: transparente)
    const alfaAntes = ctx.globalAlpha;
    if (this.espectador) ctx.globalAlpha = 0.4;
    const blink = this.invulnMs > 0 && Math.floor(this.invulnMs / 80) % 2 === 0;
    if (!blink && !this.img.player) {
      // el sprite no cargó: al menos un rectángulo para saber dónde estás
      const p = this.camera.worldToScreen(this.player.x, this.player.y);
      ctx.fillStyle = this.dead ? '#7a2020' : '#3f7ad9';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), this.player.w, this.player.h);
    } else if (!blink && this.durmiendo) {
      this._dibujarDurmiendo(ctx);
    } else if (!blink) {
      const p = this.camera.worldToScreen(this.player.x, this.player.y);
      const { f, flip } = this._playerFrame();
      const c = SpritesSurvi.PLAYER.cell;
      const swinging = !this.dead && this._swing.t < this._swing.dur;
      const row = swinging ? SpritesSurvi.PLAYER.armlessRow : 0;
      const cellX = p.x + SurviConfig.PLAYER_SPRITE.offX,
        cellY = p.y + SurviConfig.PLAYER_SPRITE.offY;
      // El sprite está en su resolución original (más grande que en
      // pantalla): se achica con suavizado de alta calidad para no perder
      // detalle ni dejar pixeles desparejos. Los bloques siguen sin suavizar.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = this.quality === 'high' ? 'high' : 'low';
      SpritesSurvi.drawSprite(
        ctx,
        this.img.player,
        f * c,
        row * c,
        c,
        c,
        cellX,
        cellY,
        SurviConfig.PLAYER_SPRITE.w,
        SurviConfig.PLAYER_SPRITE.h,
        flip,
      );
      if (swinging) this._drawSwingArm(ctx, cellX, cellY);
      ctx.imageSmoothingEnabled = false;
    }
    ctx.globalAlpha = alfaAntes;
    // Flash corto sobre el propio personaje al recibir un golpe — aparte
    // del parpadeo largo de invulnerabilidad, para que el impacto se
    // sienta también cuando ese parpadeo no se dispara (daño de hambre,
    // de caída).
    if (this._hitFlashMs > 0) {
      const p = this.camera.worldToScreen(this.player.x, this.player.y);
      ctx.fillStyle = `rgba(255,60,60,${0.5 * (this._hitFlashMs / SurviConfig.HIT_FLASH_MS)})`;
      ctx.fillRect(p.x - 2, p.y - 2, this.player.w + 4, this.player.h + 4);
    }
    this.particulas.dibujar(ctx, this.camera, false); // pedacitos, gotas, humo
    // ── Agua y lava: encima de todo (lo que está adentro se ve sumergido) ──
    this.fluidos.dibujar(ctx, this.camera, this.playedMs);
    // envenenado: tinte verde que late
    if (this.venenoMs > 0 && !this.dead) {
      const p = this.camera.worldToScreen(this.player.x, this.player.y);
      ctx.fillStyle = `rgba(110,200,60,${0.22 + 0.12 * Math.sin(this.playedMs / 180)})`;
      ctx.fillRect(p.x - 2, p.y - 6, this.player.w + 4, this.player.h + 6);
    }
    // ── Iluminación: oscuridad sobre todo el mundo (bloques, minerales,
    // enemigos, personaje). Luz = sol a cielo abierto + antorchas +
    // círculo de visión propio. Ver survi_light.js. ──
    if (this._lightDirty || ++this._lightFrame >= this.lightEvery) {
      this._lightFrame = 0;
      this._lightDirty = false;
      this.light.compute(
        (c, r) => this.tilemap.get(c, r),
        this.camera,
        sun * this.clima.factorSol, // con lluvia hay menos sol
        [
          {
            x: this.player.x + this.player.w / 2,
            y: this.player.y + this.player.h / 2,
            power: this._luzPropia, // más grande con una antorcha en la mano
          },
        ],
        (c, r) => this.fluidos.luz(c, r), // la lava ilumina
      );
      // mapa: lo que se ve con luz queda explorado (cada ~8 cálculos de luz)
      if (++this._mapaFrame >= 8 && this.mapa) {
        this._mapaFrame = 0;
        this.mapa.revelarLuz(this.light, this.camera, this.espectador);
      }
    }
    if (!this.espectador) this.light.draw(ctx, this.camera); // espectador: ve todo iluminado
    // luna y estrellas: arriba de la oscuridad (si no, de noche no se verían)
    ctx.save();
    ctx.setTransform(this.renderScale, 0, 0, this.renderScale, 0, 0);
    this.cielo.dibujarNoche(ctx, datosCielo, (sx, sy) => this._cieloAbierto(sx, sy));
    ctx.restore();
    // TNT prendidas: arriba de la oscuridad, así se ven parpadear de noche
    for (const t of this.tnts) {
      const s = this.camera.worldToScreen(t.x, t.y);
      t.dibujar(ctx, s.x, s.y, this);
    }
    // fuego y brasas: también arriba de la oscuridad (brillan)
    this._dibujarFuegos(ctx);
    this.particulas.dibujar(ctx, this.camera, true);
    this._dibujarPesca(ctx); // arriba de la oscuridad: la boya y el "!" se ven de noche
    // lluvia: encima de la oscuridad (de noche se ve igual, más tenue)
    this.clima.dibujar(ctx, this.camera);
    // el recuadro del bloque apuntado va arriba de la oscuridad: si no, en
    // una cueva oscura no sabrías qué estás picando
    // mira táctil: el círculo de alcance (mientras apuntás) y una cruz en el punto
    if (this.tactil && this._pointerWorld && !this._blocked()) {
      if (this.pointer.down) {
        const c = this.camera.worldToScreen(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(c.x, c.y, this.reachPx, 0, Math.PI * 2);
        ctx.stroke();
      }
      const m = this.camera.worldToScreen(this._pointerWorld.x, this._pointerWorld.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.x - 5, m.y);
      ctx.lineTo(m.x - 2, m.y);
      ctx.moveTo(m.x + 2, m.y);
      ctx.lineTo(m.x + 5, m.y);
      ctx.moveTo(m.x, m.y - 5);
      ctx.lineTo(m.x, m.y - 2);
      ctx.moveTo(m.x, m.y + 2);
      ctx.lineTo(m.x, m.y + 5);
      ctx.stroke();
    }
    // tile apuntado + grietas de picado (textura de particle/broken.png)
    if (this._hoverTile && !this._blocked()) {
      const { col, row } = this._hoverTile;
      const s = this.camera.worldToScreen(col * SurviConfig.TILE, row * SurviConfig.TILE);
      ctx.strokeStyle = this._puedePicar(col, row) ? 'rgba(255,255,255,0.85)' : 'rgba(255,80,80,0.6)'; // rojo: lejos o tapado
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x + 1, s.y + 1, SurviConfig.TILE - 2, SurviConfig.TILE - 2);
      if (this._mine.col === col && this._mine.row === row && this._mine.progress > 0 && this.img.cracks) {
        const stage = Math.min(
          SpritesSurvi.CRACKS.stages - 1,
          Math.floor(this._mine.progress * SpritesSurvi.CRACKS.stages),
        );
        ctx.drawImage(
          this.img.cracks,
          stage * SpritesSurvi.CRACKS.cell,
          0,
          SpritesSurvi.CRACKS.cell,
          SpritesSurvi.CRACKS.cell,
          s.x,
          s.y,
          SurviConfig.TILE,
          SurviConfig.TILE,
        );
      }
    }
    ctx.restore(); // fin del mundo escalado: lo de abajo cubre toda la pantalla

    // tinte rojo de toda la pantalla al recibir daño: en calidad baja no (es
    // una mezcla de toda la pantalla por frame; ya está el flash del personaje
    // y el parpadeo)
    if (this.invulnMs > 0 && this.quality !== 'low') {
      ctx.fillStyle = `rgba(200,30,30,${0.25 * (this.invulnMs / SurviConfig.INVULN_MS)})`;
      ctx.fillRect(0, 0, this.vistaW, SurviConfig.VIEW_H);
    }
    // dormir: la pantalla arranca negra y se aclara
    if (this._fundidoMs > 0) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this._fundidoMs / (SurviGame.FUNDIDO_MS * 0.6))})`;
      ctx.fillRect(0, 0, this.vistaW, SurviConfig.VIEW_H);
    }
    // Deshacer el corrimiento de shake del principio de _draw(): camera.x/y
    // tienen que quedar como los dejó camera.update() para el próximo
    // frame (clamp, deadzone, etc).
    this.camera.x += shakeX + snapDX;
    this.camera.y += shakeY + snapDY;
  }
}
