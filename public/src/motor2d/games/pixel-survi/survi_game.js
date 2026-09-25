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
import { Jugador, Enemigo, Animal, Flecha } from './survi_entidades.js';
import { Desgaste } from './survi_durabilidad.js';
import { CapaFluidos } from './survi_fluidos.js';
import { Iconos } from './survi_icons.js';
import { LightMap } from './survi_light.js';
import { TilesetProcedural } from './survi_proc_tiles.js';
import { GestorGuardado } from './survi_save.js';
import { GeneradorMundo } from './survi_world.js';

export class SurviGame {
  static E2D = () => (typeof Engine2D !== 'undefined' ? Engine2D : undefined);
  // ─── Zoom: tecla Z, 3 modos (Normal → Cerca → Lejos → Normal…) ───
  // Niveles fijos (no continuo) para que el pixel art no quede con escalas
  // raras. <1 = alejar (ves más mundo), >1 = acercar. El modo se recuerda
  // entre partidas en localStorage.
  static ZOOM_LEVELS = [0.75, 1, 1.25, 1.5, 2];
  static ZOOM_MODOS = [
    { nombre: 'Lejos', nivel: 0 }, // índice en ZOOM_LEVELS
    { nombre: 'Normal', nivel: 1 },
    { nombre: 'Cerca', nivel: 3 },
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

  constructor(ui, guardado) {
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
    this.mode = 'normal';
    this.playedMs = 0;
    this.reachPx = SurviConfig.REACH_TILES * SurviConfig.TILE;
    this.hp = SurviConfig.MAX_HP;
    this.hunger = SurviConfig.MAX_HUNGER;
    this._starveTimer = 0;
    this._regenTimer = 0;
    this._lastHungerShown = -1;
    this._hitFlashMs = 0;
    this.enemies = [];
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
    this.touchMode = 'break';
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
    this._bindTouch();
    this._bindHudButtons();
  }

  // Los botones ⏸ e "I" del HUD no tenían data-act ni listener propio —
  // el delegado de clicks de survi_main.js solo escucha [data-act], así
  // que tocarlos no hacía nada. Acá replican exactamente lo mismo que
  // Esc / I en _attachInput().
  _bindHudButtons() {
    this.ui.pauseBtn.addEventListener('click', () => {
      if (!this.running || this.dead) return;
      if (this.invOpen) this.toggleInventory(false);
      else this.setPaused(!this.paused);
    });
    this.ui.invBtn.addEventListener('click', () => {
      if (!this.running || this.dead || this.paused) return;
      this.toggleInventory();
    });
  }

  // ═══════════ Arranque / parada ═══════════
  async start({ slot, mode, save = null }) {
    this.stop();
    this.slot = slot;
    this.mode = mode;
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
    this.hp = save && save.hp ? Math.min(SurviConfig.MAX_HP, save.hp) : SurviConfig.MAX_HP;
    this.hunger = save && save.hunger != null ? Math.min(SurviConfig.MAX_HUNGER, save.hunger) : SurviConfig.MAX_HUNGER;
    this.timeOfDay = save && save.timeOfDay != null ? save.timeOfDay : SurviConfig.START_TIME_OF_DAY;
    // hornos y cofres colocados: estado por posición "col,row"
    const st = (save && save.stations) || {};
    this.furnaces = st.furnaces || {};
    this.chests = st.chests || {};
    this.station = null; // estación abierta: { type: 'furnace'|'chest', key }
    this.craftStation = 'hand'; // 'hand' (inventario) o 'table' (mesa de crafteo)
    this._stationUiT = 0;
    this.light = new LightMap();
    this.light.rebuildSky((c, r) => this.tilemap.get(c, r));
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
    this._arcoCd = 0;
    // Agua y lava: las guardadas, o las del mundo recién generado. Un mundo
    // guardado antes de que existieran arranca sin fluidos (sus tiles no
    // tienen los lagos cavados).
    this.fluidos = save ? new CapaFluidos(save.fluidos) : this.world.fluidos || new CapaFluidos();
    this.aireMs = SurviConfig.AIRE_MAX_MS;
    this.quemaduraMs = 0;
    if (!save) this._giveStarterTools();
    // Enemigos: si la partida tenía enemigos en el mapa al guardar, vuelven
    // donde estaban (con su vida). Si no, se arranca sin ninguno.
    this.enemies = save && Array.isArray(save.enemies) ? save.enemies.map((d) => this._crearEnemigo(d)) : [];
    this._enemyTimer = save && Number.isFinite(save.enemyTimer) ? save.enemyTimer : 4000;
    // Animales: los guardados vuelven donde estaban (con su vida). Un tipo
    // que ya no exista se descarta en vez de romper la carga.
    this.animals = save && Array.isArray(save.animals) ? save.animals.map((d) => Animal.crear(d)).filter(Boolean) : [];
    this._animalTimer = save && Number.isFinite(save.animalTimer) ? save.animalTimer : 1500;
    this._fallFromY = null;
    this.invulnMs = 0;
    this.camera = new (SurviGame.E2D().Camera)({
      width: SurviConfig.VIEW_W,
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
    SurviGame.E2D().fitCanvas(this.canvas, SurviConfig.VIEW_W, SurviConfig.VIEW_H); // tamaño CSS (encaja en el contenedor)
    this.canvas.width = SurviConfig.VIEW_W * this.renderScale; // backing store según el nivel gráfico
    this.canvas.height = SurviConfig.VIEW_H * this.renderScale;
    this.ctx.imageSmoothingEnabled = false; // (cambiar width resetea el contexto)
  }

  // ═══════════ Guardado ═══════════
  save() {
    if (!this.tilemap) return false;
    const col = Math.max(0, Math.min(SurviConfig.COLS - 1, Math.floor(this.player.x / SurviConfig.TILE)));
    return this.guardado.guardarMundo(this.slot, {
      seed: this.seed,
      mode: this.mode,
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
    });
  }

  // ═══════════ Pausa / inventario ═══════════
  setPaused(v) {
    if (this.dead || !this.running) return;
    this.paused = v;
    this.pointer.down = false;
    this._resetMine();
    if (v) {
      const biome = SurviConfig.BIOMES[this.world.biomeByCol[Math.floor(this.player.x / SurviConfig.TILE)]];
      this.ui.pauseInfo.textContent =
        `Mundo ${this.slot} · ${this.mode === 'hardcore' ? 'Hardcore' : 'Normal'} · ${GestorGuardado.fmtTime(this.playedMs)}` +
        (biome ? ` · ${biome.label}` : '');
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
        KeyZ: 'zoom',
        Escape: 'pause',
      },
      {
        activeCheck: () => this.running && !this.dead,
        preventDefaultFor: new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']),
        onDown: (action) => {
          if (action === 'inv') {
            if (!this.paused) this.toggleInventory();
            return;
          }
          if (action === 'pause') {
            if (this.invOpen) this.toggleInventory(false);
            else this.setPaused(!this.paused);
            return;
          }
          if (this.paused || this.invOpen) return;
          if (action === 'zoom') {
            this.cambiarZoom();
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
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this._blocked()) return;
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {}
      this._hoverTile = this._pointerToTile(e, true);
      this.pointer.down = true;
      this.pointer.button = e.pointerType === 'touch' ? (this.touchMode === 'place' ? 2 : 0) : e.button;
      if (this.pointer.button === 2) {
        this._placeCd = 0;
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
      if (this._blocked()) {
        this._hoverTile = null;
        return;
      }
      this._hoverTile = this._pointerToTile(e);
    });
  }

  _bindTouch() {
    this.ui.touch.querySelectorAll('button[data-touch]').forEach((btn) => {
      const act = btn.dataset.touch;
      const on = (v) => (e) => {
        e.preventDefault();
        this.touchState[act] = v;
      };
      btn.addEventListener('pointerdown', on(true));
      btn.addEventListener('pointerup', on(false));
      btn.addEventListener('pointerleave', on(false));
      btn.addEventListener('pointercancel', on(false));
    });
    this.ui.touchMode.addEventListener('click', () => {
      this.touchMode = this.touchMode === 'break' ? 'place' : 'break';
      this.ui.touchMode.innerHTML = Iconos.icon(this.touchMode === 'break' ? 'pickaxe' : 'box');
    });
  }

  // ═══════════ Calidad gráfica ═══════════
  _readQuality() {
    const Q = SurviGame.E2D() && SurviGame.E2D().Quality;
    this.quality = Q && Q.get ? Q.get() : 'high';
    this.renderScale = SurviGame.RENDER_BY_QUALITY[this.quality] || SurviGame.RENDER_SCALE;
    this.lightEvery = SurviGame.LIGHT_EVERY_BY_QUALITY[this.quality] || 1;
    // zooms que dan pixeles enteros con esta escala
    this._zoomOk = SurviGame.ZOOM_LEVELS.map((z, i) => i).filter((i) =>
      Number.isInteger(SurviGame.ZOOM_LEVELS[i] * this.renderScale),
    );
    this._zoomIdx = this.#nivelValido(SurviGame.ZOOM_MODOS[this._zoomModo].nivel);
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
    this._zoomIdx = this.#nivelValido(SurviGame.ZOOM_MODOS[this._zoomModo].nivel);
    try {
      localStorage.setItem(SurviGame.ZOOM_KEY, String(this._zoomModo));
    } catch {}
    if (this.ui.showToast) this.ui.showToast(`Zoom: ${this.zoomModo}`);
  }

  // El nivel más cercano a `idx` que da pixeles enteros con la calidad actual.
  #nivelValido(idx) {
    const ok = this._zoomOk || [idx];
    if (ok.includes(idx)) return idx;
    const L = SurviGame.ZOOM_LEVELS;
    return ok.reduce((best, i) => (Math.abs(L[i] - L[idx]) < Math.abs(L[best] - L[idx]) ? i : best), ok[0]);
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
    const w = SurviConfig.VIEW_W / this._zoom,
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
    return !this.running || this.paused || this.invOpen || this.dead || !this.tilemap;
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
    const id = this.tilemap.get(col, row);
    if (id === 0 || !this._inReach(col, row)) {
      this._resetMine();
      this._tryAttack();
      return;
    }
    if (id === SurviConfig.T.BEDROCK) {
      this._resetMine();
      return;
    }
    if (this._mine.col !== col || this._mine.row !== row) {
      this._mine.col = col;
      this._mine.row = row;
      this._mine.progress = 0;
    }
    const hard = SurviConfig.HARDNESS[id] || 0.6;
    const tool = this.heldTool;
    const speed = tool && tool.tool === SurviConfig.TOOL_FOR[id] ? 1 + tool.power : 1;
    this._mine.progress += (dt / 1000 / hard) * speed;
    this._attackAnim = Math.max(this._attackAnim, 60);
    // mira hacia el bloque que pica (como en Terraria) y encadena golpes
    this.player.facing = col * SurviConfig.TILE + SurviConfig.TILE / 2 >= this.player.x + this.player.w / 2 ? 1 : -1;
    this._startSwing(SurviGame.SWING_MINE_MS);
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
      // Con el inventario lleno de tipos distintos, _addItem devuelve false
      // y el drop se perdía: el bloque quedaba roto y no te llevabas nada.
      // Mejor no romperlo y avisar.
      let dropId = SurviConfig.DROPS[id] || 0;
      // Minerales: si el pico no alcanza el tier, se rompe igual pero no suelta nada.
      const ore = SurviConfig.ORE_DROPS[id];
      if (ore && !(tool && tool.tool === 'pickaxe' && tool.tier >= ore.tier)) {
        dropId = 0;
        if (this.ui.showToast) this.ui.showToast('Necesitás un pico mejor para sacar este mineral');
      }
      if (dropId && !this._hasRoomFor(dropId)) {
        this._resetMine();
        if (this.ui.showToast) this.ui.showToast('Inventario lleno');
        return;
      }
      const broken = this.tilemap.breakTile(col, row);
      if (dropId) this._addItem(dropId);
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
      if (foodDrop && Math.random() < foodDrop.chance) this._addItem(foodDrop.id);
      this._retileAround(col, row);
      this._resetMine();
      this._attackAnim = 120;
    }
  }

  _tryPlace() {
    if (this._placeCd > 0) return;
    // Clic derecho sobre una mesa / horno / cofre al alcance: se abre.
    if (this._hoverTile) {
      const { col: hc, row: hr } = this._hoverTile;
      if (SurviConfig.STATION_IDS.has(this.tilemap.get(hc, hr)) && this._inReach(hc, hr)) {
        this.openStation(hc, hr);
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
    if (heldInfo && heldInfo.food) {
      this._eat(heldId, heldInfo);
      return;
    }
    if (!this._hoverTile) return;
    const { col, row } = this._hoverTile;
    if (!this._inReach(col, row) || this.tilemap.get(col, row) !== 0) return;
    const id = this.hotbarSlots[this.selectedSlot];
    const info = id ? SurviConfig.ITEM_INFO[id] : null;
    if (!info || !info.place || (this.inventory[id] || 0) <= 0) return; // las herramientas no se colocan

    if (info.place === SurviConfig.T.TORCH && !this._torchSupported(col, row)) return;
    if (info.place === SurviConfig.T.TORCH && this.fluidos.tipo(col, row)) return; // no se prende bajo el agua
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
    if (this.tilemap.placeTile(col, row, info.place)) {
      this._removeItem(id);
      this.fluidos.quitar(col, row); // el bloque desplaza el agua/lava que había
      this._retileAround(col, row);
      this._placeCd = SurviConfig.PLACE_COOLDOWN;
    }
  }

  _eat(id, info) {
    if ((this.inventory[id] || 0) <= 0) return;
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
  // Antorcha: se apoya en un sólido de abajo o de los costados (en la pared).
  _torchSupported(col, row) {
    const tm = this.tilemap;
    const solid = (c, r) =>
      c >= 0 && c < SurviConfig.COLS && r >= 0 && r < SurviConfig.ROWS && SurviConfig.SOLID_IDS.has(tm.get(c, r));
    return solid(col, row + 1) || solid(col - 1, row) || solid(col + 1, row);
  }

  // Si se rompió el bloque que sostenía una antorcha vecina, se cae (vuelve al inventario).
  _dropUnsupportedTorches(col, row) {
    for (const [c, r] of [
      [col, row - 1],
      [col - 1, row],
      [col + 1, row],
    ]) {
      if (c < 0 || c >= SurviConfig.COLS || r < 0 || r >= SurviConfig.ROWS) continue;
      if (this.tilemap.get(c, r) === SurviConfig.T.TORCH && !this._torchSupported(c, r)) {
        this.tilemap.breakTile(c, r);
        if (this._hasRoomFor(SurviConfig.T.TORCH)) this._addItem(SurviConfig.T.TORCH);
      }
    }
  }

  _retileAround(col, row) {
    if (this.light) this.light.updateColumn((c, r) => this.tilemap.get(c, r), col);
    this._lightDirty = true;
    this._dropUnsupportedTorches(col, row);
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
    if (this._attackCd > 0) return;
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
    for (const c of [...this.enemies, ...this.animals]) {
      if (c.estaMuerto() || g.golpeados.has(c) || !this._tocaArco(c, g.arco)) continue;
      g.golpeados.add(c);
      this._golpearCriatura(c, g.dmg, this.player.facing);
      if (g.herramienta) this._usarHerramienta(g.herramienta); // cada mob golpeado gasta el arma
    }
  }

  // Un golpe del jugador (cuerpo a cuerpo o flecha) a una criatura.
  _golpearCriatura(c, dmg, dir) {
    c.recibirGolpe(dmg, dir);
    if (c instanceof Animal) {
      // Pánico: los de su especie que están cerca también salen corriendo.
      for (const o of this.animals) {
        if (o !== c && o.tipo === c.tipo && Math.abs(o.x - c.x) < 6 * SurviConfig.TILE) o.asustar(this.player.x);
      }
      if (c.estaMuerto()) this._cosechar(c);
    }
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
    if (!id || !(this.inventory[id] > 0) || !Desgaste.tieneDurabilidad(id)) return;
    if (this.desgaste.gastar(id)) {
      this._removeItem(id, 1);
      if (this.ui.showToast) this.ui.showToast(`Se rompió: ${SurviConfig.ITEM_INFO[id].name}`);
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
    return {
      ok: true,
    };
  }

  // ═══════════ Vida / muerte ═══════════
  _renderHealth() {
    const pct = Math.max(0, this.hp / SurviConfig.MAX_HP) * 100;
    this.ui.hpBar.style.width = pct + '%';
    this.ui.hpBar.style.background = pct > 50 ? '#4caf50' : pct > 25 ? '#f5c518' : '#e0563a';
    this.ui.hpText.textContent = `${Math.max(0, Math.round(this.hp))}/${SurviConfig.MAX_HP}`;
  }

  _renderHunger() {
    const pct = Math.max(0, this.hunger / SurviConfig.MAX_HUNGER) * 100;
    this.ui.hungerBar.style.width = pct + '%';
    this.ui.hungerBar.style.background = pct > 50 ? '#caa24a' : pct > 20 ? '#d98a3d' : '#c0392b';
    this.ui.hungerText.textContent = `${Math.max(0, Math.round(this.hunger))}/${SurviConfig.MAX_HUNGER}`;
  }

  // origen: 'golpe' (mob, lo que se toma por defecto), 'caida' o 'hambre'.
  _damage(amount, { ignoreInvuln = false, origen = ignoreInvuln ? 'otro' : 'golpe' } = {}) {
    if (this.dead || amount <= 0) return;
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
    // Durabilidad: un golpe gasta toda la armadura puesta; una caída, solo las
    // botas (una caída fuerte las gasta más). El hambre no gasta nada.
    if (origen === 'golpe') this._gastarArmadura(['head', 'chest', 'legs', 'boots']);
    else if (origen === 'caida') this._gastarArmadura(['boots'], Math.max(1, amount));
    // Feedback aparte del parpadeo largo de invulnerabilidad: un flash
    // rojo corto sobre el personaje y un temblor de cámara breve, así el
    // golpe se siente aunque el parpadeo por invulnerabilidad no aplique
    // (ignoreInvuln=true, como el daño de caída o el de hambre).
    this._hitFlashMs = SurviConfig.HIT_FLASH_MS;
    if (this.camera) this.camera.shake(SurviConfig.HIT_SHAKE_INTENSITY, SurviConfig.HIT_SHAKE_MS);
    this._renderHealth();
    if (this.hp <= 0) this._die();
  }

  _die() {
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
    const hardcore = this.mode === 'hardcore';
    this.ui.deathTime.textContent =
      `Sobreviviste ${GestorGuardado.fmtTime(this.playedMs)} en el Mundo ${this.slot}` +
      (hardcore ? '.\nEra hardcore: el mundo se borró.' : '.');
    this.ui.deathRespawn.classList.toggle('hidden', hardcore);
    if (hardcore) this.guardado.borrarMundo(this.slot);
    else this.save();
    this.ui.showScreen('death');
    if (typeof this.onDeath === 'function') this.onDeath(this.mode);
  }

  respawn() {
    if (this.mode === 'hardcore') return;
    this.dead = false;
    this.hp = SurviConfig.MAX_HP;
    // Sin esto, si morías con el hambre en 0 (la causa más común de morir
    // sin enemigos cerca) reaparecías con vida llena pero el hambre seguía
    // en 0 — el _starveTimer te volvía a pegar en STARVE_INTERVAL_MS casi
    // de inmediato, como si el respawn no hubiera hecho nada.
    this.hunger = SurviConfig.MAX_HUNGER;
    this._starveTimer = 0;
    this.invulnMs = SurviConfig.INVULN_MS;
    this.player.reaparecer(this.spawn.x, this.spawn.y);
    this.aireMs = SurviConfig.AIRE_MAX_MS;
    this.quemaduraMs = 0;
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
  _spawnEnemy() {
    const pcol = Math.floor(this.player.x / SurviConfig.TILE);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const col = pcol + dir * (14 + Math.floor(Math.random() * 6));
    if (col < 2 || col >= SurviConfig.COLS - 2) return;
    const row = this.world.surfaceByCol[col] - 1;
    if (this.tilemap.get(col, row) !== 0 || this.fluidos.tipo(col, row)) return;
    this.enemies.push(
      this._crearEnemigo({
        x: col * SurviConfig.TILE + 2,
        y: (row - 1) * SurviConfig.TILE,
        vx: 0.7 * -dir,
        vy: 0,
        hp: 6,
      }),
    );
  }

  // Un solo lugar donde se arma un enemigo: lo usan el spawn y la carga del
  // save. Lo que no se guarda (tamaño, estado de física, parpadeo del
  // golpe) sale de acá con su valor inicial.
  // Cuando haya varios tipos de enemigo: agregar `tipo` acá y en
  // _serializarEnemigo, y decidir w/h/hp según el tipo.
  _crearEnemigo(d) {
    return new Enemigo(d);
  }

  // Lo mínimo para volver a crearlo igual (ver _crearEnemigo).
  _serializarEnemigo(en) {
    return en.serializar();
  }

  _updateEnemies(dt, step) {
    this._enemyTimer -= dt;
    if (this._enemyTimer <= 0) {
      this._enemyTimer = SurviConfig.ENEMIGO_SPAWN_MS;
      const dia = LightMap.sunAt(this.timeOfDay, SurviConfig.NIGHT_SUN) >= 0.5;
      const sale = !dia || Math.random() < SurviConfig.ENEMIGO_CHANCE_DIA;
      if (sale && this.enemies.length < SurviConfig.ENEMIGO_MAX) this._spawnEnemy();
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      // muerto, o quedó demasiado lejos del jugador: se saca de la lista
      if (en.estaMuerto() || !en.actualizar(dt, step, this)) this.enemies.splice(i, 1);
    }
  }

  // ═══════════ Animales ═══════════
  _updateAnimals(dt, step) {
    this._animalTimer -= dt;
    if (this._animalTimer <= 0) {
      this._animalTimer = SurviConfig.ANIMAL_SPAWN_MS;
      this._spawnAnimal();
    }
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      // muerto, o quedó demasiado lejos del jugador: se saca de la lista
      if (a.estaMuerto() || !a.actualizar(dt, step, this)) this.animals.splice(i, 1);
    }
  }

  // Intenta hacer aparecer 1 animal (a veces 2 del mismo tipo, en grupo)
  // sobre la superficie, fuera de la vista y según el bioma de esa columna.
  _spawnAnimal() {
    const T = SurviConfig.TILE;
    if (LightMap.sunAt(this.timeOfDay, SurviConfig.NIGHT_SUN) < SurviConfig.ANIMAL_SOL_MIN) return;
    const cerca = this.animals.filter((a) => Math.abs(a.x - this.player.x) < 40 * T).length;
    if (cerca >= SurviConfig.ANIMAL_MAX_CERCA) return;
    const pcol = Math.floor(this.player.x / T);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const col = pcol + dir * (12 + Math.floor(Math.random() * 19));
    if (col < 2 || col >= SurviConfig.COLS - 2) return;
    const tipo = this._elegirAnimal(this.world.biomeByCol[col]);
    if (!tipo) return;
    const row = this.world.surfaceByCol[col] - 1; // la celda de aire justo arriba del suelo
    if (this.tilemap.get(col, row) !== 0 || this.tilemap.get(col, row - 1) !== 0) return;
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

  // Lo que suelta un animal al morir va directo al inventario. Si no entra
  // algún tipo de ítem nuevo (inventario lleno) se pierde y se avisa.
  _cosechar(animal) {
    const ganado = [];
    let lleno = false;
    for (const { id, qty } of animal.drops()) {
      if (!this._hasRoomFor(id)) {
        lleno = true;
        continue;
      }
      if (this._addItem(id, qty)) ganado.push(`+${qty} ${SurviConfig.ITEM_INFO[id].name}`);
    }
    if (!this.ui.showToast) return;
    if (ganado.length) this.ui.showToast(ganado.join('  ·  ') + (lleno ? '  (inventario lleno)' : ''));
    else if (lleno) this.ui.showToast('Inventario lleno');
  }

  // ═══════════ Update ═══════════
  _update(dt, step) {
    // los hornos siguen cocinando aunque tengas abierta su pantalla (o el inventario)
    if (this.player && !this.paused && !this.dead && this.furnaces) this._tickFurnaces(dt);
    if (!this.player || this.paused || this.invOpen || this.dead) return;
    this.playedMs += dt;
    if (this._attackCd > 0) this._attackCd -= dt;
    if (this._placeCd > 0) this._placeCd -= dt;
    if (this._attackAnim > 0) this._attackAnim -= dt;
    if (this._swing.t < this._swing.dur) this._swing.t += dt;
    this._aplicarGolpe();
    this.timeOfDay = (this.timeOfDay + dt / SurviConfig.DAY_CYCLE_MS) % 1;
    if (this.invulnMs > 0) this.invulnMs -= dt;
    if (this._hitFlashMs > 0) this._hitFlashMs -= dt;
    // Hambre: se vacía sola con el tiempo jugado. En 0 pega daño cada
    // tanto (ignora invulnerabilidad, como la caída); bien alimentado
    // (arriba del umbral) regenera vida de a poco como premio por comer.
    this.hunger = Math.max(0, this.hunger - SurviConfig.HUNGER_DRAIN_PER_MS * dt);
    if (this.hunger <= 0) {
      this._starveTimer += dt;
      if (this._starveTimer >= SurviConfig.STARVE_INTERVAL_MS) {
        this._starveTimer = 0;
        this._damage(SurviConfig.STARVE_DAMAGE, {
          ignoreInvuln: true,
          origen: 'hambre',
        });
      }
    } else {
      this._starveTimer = 0;
    }
    if (this.hunger >= SurviConfig.HUNGER_REGEN_THRESHOLD && this.hp < SurviConfig.MAX_HP) {
      this._regenTimer += dt;
      if (this._regenTimer >= SurviConfig.HP_REGEN_INTERVAL_MS) {
        this._regenTimer = 0;
        this.hp = Math.min(SurviConfig.MAX_HP, this.hp + SurviConfig.HP_REGEN_AMOUNT);
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
    this.player.vx = 0;
    if (left) {
      this.player.vx = -SurviConfig.MOVE_SPEED;
      this.player.facing = -1;
    }
    if (right) {
      this.player.vx = SurviConfig.MOVE_SPEED;
      this.player.facing = 1;
    }
    // Agua y lava: nadando la gravedad y la velocidad bajan, y mantener
    // saltar te hace subir. Caer al agua no lastima.
    const fl = this.fluidos.enCaja(this.player);
    this._enFluido = fl;
    const nado = fl.agua || fl.lava ? SurviConfig.NADO[fl.lava ? 'lava' : 'agua'] : null;
    if (nado) this.player.vx *= nado.velX;
    else if (jump && this.player.grounded) this.player.vy = SurviConfig.JUMP_VEL;
    const wasGrounded = this.player.grounded;
    const quiere = this.player.vx;
    if (nado) {
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
    if (this.pointer.down) {
      if (this.pointer.button === 0) this._mineTick(dt);
      else if (this.pointer.button === 2) this._tryPlace();
    }
    this._updateEnemies(dt, step);
    this._updateAnimals(dt, step);
    if (this._arcoCd > 0) this._arcoCd -= dt;
    if (this._avisoFlechasMs > 0) this._avisoFlechasMs -= dt;
    for (let i = this.flechas.length - 1; i >= 0; i--) {
      if (!this.flechas[i].actualizar(dt, step, this)) this.flechas.splice(i, 1);
    }
    this.fluidos.actualizar(
      dt,
      (c, r) => this.tilemap.get(c, r) === 0,
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
      ctx.clearRect(0, 0, SurviConfig.VIEW_W, SurviConfig.VIEW_H);
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
    ctx.fillStyle = underground
      ? '#0c0e14'
      : LightMap.mixHex(SurviConfig.BIOMES[this.world.biomeByCol[pcol]].sky, SurviConfig.NIGHT_SKY, nightK);
    ctx.fillRect(0, 0, SurviConfig.VIEW_W, SurviConfig.VIEW_H);
    ctx.save();
    ctx.scale(this._zoom, this._zoom);
    this.tilemap.draw(ctx, this.camera);
    for (const en of this.enemies) {
      const s = this.camera.worldToScreen(en.x, en.y);
      en.dibujar(ctx, s.x, s.y);
    }
    // ── Animales (cada uno se dibuja a sí mismo; se saltean los de fuera de la vista) ──
    for (const a of this.animals) {
      const s = this.camera.worldToScreen(a.x, a.y);
      if (s.x < -a.w || s.y < -a.h || s.x > this.camera.width || s.y > this.camera.height) continue;
      a.dibujar(ctx, s.x, s.y);
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
    // ── Personaje + herramienta en mano ──
    const blink = this.invulnMs > 0 && Math.floor(this.invulnMs / 80) % 2 === 0;
    if (!blink) {
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
    // Flash corto sobre el propio personaje al recibir un golpe — aparte
    // del parpadeo largo de invulnerabilidad, para que el impacto se
    // sienta también cuando ese parpadeo no se dispara (daño de hambre,
    // de caída).
    if (this._hitFlashMs > 0) {
      const p = this.camera.worldToScreen(this.player.x, this.player.y);
      ctx.fillStyle = `rgba(255,60,60,${0.5 * (this._hitFlashMs / SurviConfig.HIT_FLASH_MS)})`;
      ctx.fillRect(p.x - 2, p.y - 2, this.player.w + 4, this.player.h + 4);
    }
    // ── Agua y lava: encima de todo (lo que está adentro se ve sumergido) ──
    this.fluidos.dibujar(ctx, this.camera, this.playedMs);
    // quemándote: el personaje titila en naranja
    if (this.quemaduraMs > 0 && !this.dead) {
      const p = this.camera.worldToScreen(this.player.x, this.player.y);
      ctx.fillStyle = `rgba(255,${120 + Math.round(60 * Math.sin(this.playedMs / 60))},30,0.45)`;
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
        sun,
        [
          {
            x: this.player.x + this.player.w / 2,
            y: this.player.y + this.player.h / 2,
            power: SurviConfig.PLAYER_VISION,
          },
        ],
        (c, r) => this.fluidos.luz(c, r), // la lava ilumina
      );
    }
    this.light.draw(ctx, this.camera);
    // el recuadro del bloque apuntado va arriba de la oscuridad: si no, en
    // una cueva oscura no sabrías qué estás picando
    // tile apuntado + grietas de picado (textura de particle/broken.png)
    if (this._hoverTile && !this._blocked()) {
      const { col, row } = this._hoverTile;
      const s = this.camera.worldToScreen(col * SurviConfig.TILE, row * SurviConfig.TILE);
      ctx.strokeStyle = this._inReach(col, row) ? 'rgba(255,255,255,0.85)' : 'rgba(255,80,80,0.6)';
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

    if (this.invulnMs > 0) {
      ctx.fillStyle = `rgba(200,30,30,${0.25 * (this.invulnMs / SurviConfig.INVULN_MS)})`;
      ctx.fillRect(0, 0, SurviConfig.VIEW_W, SurviConfig.VIEW_H);
    }
    // Deshacer el corrimiento de shake del principio de _draw(): camera.x/y
    // tienen que quedar como los dejó camera.update() para el próximo
    // frame (clamp, deadzone, etc).
    this.camera.x += shakeX + snapDX;
    this.camera.y += shakeY + snapDY;
  }
}
