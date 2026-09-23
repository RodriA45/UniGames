// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_game.js
//   El juego en sí: loop, jugador (sprite del personaje), vida + daño de
//   caída, picado progresivo con herramientas, colocar bloques,
//   inventario, enemigos y muerte.
//   Se apoya en Engine2D (script clásico global) y en los módulos de
//   config / mundo / guardado / sprites / UI.
// ══════════════════════════════════════════════════════════════

import {
  TILE, COLS, ROWS, WORLD_W, WORLD_H, VIEW_W, VIEW_H,
  T, SOLID_IDS, TILESET_COLS, TILE_COUNT, ITEM_INFO, HOTBAR_SIZE, BIOMES,
  HARDNESS, TOOL_FOR, DROPS, STARTER_TOOLS, PLAYER_BOX, PLAYER_SPRITE,
  MAX_HP, FALL_SAFE_TILES, FALL_DMG_PER_TILE, INVULN_MS,
  ATTACK_COOLDOWN, ATTACK_DMG, PLACE_COOLDOWN,
  MOVE_SPEED, JUMP_VEL, REACH_TILES,
  MAX_HUNGER, HUNGER_DRAIN_PER_MS, HUNGER_REGEN_THRESHOLD,
  STARVE_DAMAGE, STARVE_INTERVAL_MS, HP_REGEN_INTERVAL_MS, HP_REGEN_AMOUNT,
  LEAF_FOOD_DROP, leafPalette, ORE_DROPS, armorReduction,
  WEAPON_STATS, BARE_HAND_ATTACK,
  HIT_FLASH_MS, HIT_SHAKE_INTENSITY, HIT_SHAKE_MS,
  CAMERA_DEADZONE_W, CAMERA_DEADZONE_H, CAMERA_SMOOTHING,
  RECIPES, emptyEquipment, totalDefense, totalGeneralSlots, totalInvSlots,
  canCraft, consumeRecipe, craftWouldFit,
  DAY_CYCLE_MS, NIGHT_SUN, NIGHT_SKY, START_TIME_OF_DAY, PLAYER_VISION, STARTER_TORCHES
} from './survi_config.js';
import { LightMap, sunAt, mixHex } from './survi_light.js';
import { icon } from './survi_icons.js';
import { generateWorld, pickSpawn, autotileId } from './survi_world.js';
import { buildProceduralTileset } from './survi_proc_tiles.js';
import { saveWorld, deleteWorld, fmtTime } from './survi_save.js';
import { showScreen } from './survi_ui.js';
import {
  ASSETS, PRELOAD, TILESET, PLAYER, CRACKS, drawSprite, setTilesetUrl, itemCell, itemHold
} from './models/sprites.js';

const E2D = () => (typeof Engine2D !== 'undefined' ? Engine2D : undefined);

// ─── Zoom con la rueda del mouse ───
// Niveles fijos (no continuo) para que el pixel art no quede con escalas
// raras. <1 = alejar (ves más mundo), >1 = acercar. Se recuerda entre
// partidas en localStorage.
const ZOOM_LEVELS = [0.75, 1, 1.25, 1.5, 2];
const ZOOM_DEFAULT_IDX = 1;
const ZOOM_KEY = 'juefriv.survi.zoom';
const ZOOM_WHEEL_COOLDOWN_MS = 120; // los trackpads mandan decenas de eventos por gesto

// El canvas se dibuja a RENDER_SCALE veces la resolución lógica (480x288).
// Con 4, todos los niveles de ZOOM_LEVELS dan un tamaño de pixel ENTERO
// en pantalla (0.75→3, 1→4, 1.25→5, 1.5→6, 2→8): el pixel art queda
// parejo y el scroll se mueve en pasos chicos (suave), no de a 1 pixel
// de mundo. Si se cambian los niveles, RENDER_SCALE * zoom tiene que
// seguir dando entero.
const RENDER_SCALE = 4;

// Cámara: sigue al personaje en X siempre. En Y se "ancla" a la altura
// del piso donde está parado, así saltar no la mueve; si cae por debajo
// del ancla la sigue al toque, y si sube muy alto (más de esta fracción
// de la vista) también, para que nunca se salga de pantalla.
const CAM_MAX_ABOVE_ANCHOR = 0.32;

// Golpe estilo Terraria: el brazo (sprite aparte) gira ~180° desde arriba
// hacia adelante, hacia el lado que mira el personaje, con el ítem en la mano.
const SWING_MINE_MS = 260;    // cada golpe de picado (se repite mientras mantenés el clic)
const SWING_ATTACK_MS = 200;  // golpe de ataque
const SWING_FROM = -Math.PI - 0.25;  // brazo apuntando arriba (un poco para atrás)
const SWING_TO = -0.15;              // brazo abajo, un poco adelante

export class SurviGame {
  constructor(ui) {
    this.ui = ui;
    this.canvas = ui.canvas;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;   // pixel art: nada de blur

    let zi = ZOOM_DEFAULT_IDX;
    try {
      const saved = Number(localStorage.getItem(ZOOM_KEY));
      if (Number.isInteger(saved) && saved >= 0 && saved < ZOOM_LEVELS.length) zi = saved;
    } catch {}
    this._zoomIdx = zi;
    this._zoom = ZOOM_LEVELS[zi];
    this._lastWheelAt = 0;

    this.running = false;
    this.paused = false;
    this.invOpen = false;
    this.dead = false;

    this.slot = 1;
    this.mode = 'normal';
    this.playedMs = 0;

    this.reachPx = REACH_TILES * TILE;
    this.hp = MAX_HP;
    this.hunger = MAX_HUNGER;
    this._starveTimer = 0;
    this._regenTimer = 0;
    this._lastHungerShown = -1;
    this._hitFlashMs = 0;
    this.enemies = [];

    this.pointer = { down: false, button: 0 };
    this.touchState = { left: false, right: false, jump: false };
    this.touchMode = 'break';
    this._mine = { col: -1, row: -1, progress: 0 };
    this._hoverTile = null;
    this._fallFromY = null;
    this._attackCd = 0; this._placeCd = 0; this._attackAnim = 0;
    this._swing = { t: 0, dur: 0 }; // activo mientras t < dur
    this.invulnMs = 0;
    this._anim = { t: 0, i: 0 };

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
    this.playedMs = save ? (save.playedMs || 0) : 0;
    this.dead = false;
    this.paused = false;
    this.invOpen = false;

    const seed = save ? save.seed : Date.now();
    // El mundo se regenera SIEMPRE desde el seed (biomas y alturas salen
    // de ahí y no se guardan). Los tiles, si hay partida, vienen del save.
    this.world = generateWorld(seed);
    this.seed = seed;
    this.spawn = pickSpawn(this.world, Math.random);

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
    await Promise.allSettled(PRELOAD.map(src => E2D().loadImage(src)));

    // Nos quedamos solo con imágenes realmente usables: si getImage() no
    // tiene nada (falló y Engine2D la sacó del caché) o todavía no está
    // decodificada, mejor null que arrastrar un HTMLImageElement roto
    // hasta el draw() — drawSprite()/drawImage() ya saben saltearse un
    // null, pero no una imagen "broken".
    const readyImg = (src) => {
      const img = E2D().getImage(src);
      return (img && img.complete && img.naturalWidth > 0) ? img : null;
    };
    this.img = {
      tiles: null, // se completa abajo con el tileset generado por código
      player: readyImg(ASSETS.player),
      cracks: readyImg(ASSETS.cracks),
      items: readyImg(ASSETS.items)
    };
    if (!this.img.player) {
      console.warn('[pixel-survi] el sprite del personaje no cargó — revisá las rutas de ASSETS/BASE en models/sprites.js');
    }
    // Tileset 100% por código (ver survi_proc_tiles.js) — ya no existe
    // tiles.png. Se registra bajo TILESET.src para que el TileMap lo
    // dibuje con drawImage como siempre, y como data URL para los íconos
    // DOM del hotbar/inventario (tileIconStyle usa background-image).
    if (!this._tilesetCanvas) {
      this._tilesetCanvas = buildProceduralTileset(TILESET_COLS, TILE);
      setTilesetUrl(this._tilesetCanvas.toDataURL());
    }
    this.img.tiles = this._tilesetCanvas;
    E2D().setImage(TILESET.src, this._tilesetCanvas);

    this.tilemap = new (E2D().TileMap)({
      cols: COLS, rows: ROWS, tileSize: TILE,
      tilesetSrc: TILESET.src, tilesetCols: TILESET_COLS,
      solidIds: SOLID_IDS,
      data: save ? Uint16Array.from(save.tiles) : this.world.data
    });

    this.player = {
      x: save ? save.px : this.spawn.x,
      y: save ? save.py : this.spawn.y,
      w: PLAYER_BOX.w, h: PLAYER_BOX.h,
      vx: 0, vy: 0, grounded: false, facing: 1
    };
    this.hp = save && save.hp ? Math.min(MAX_HP, save.hp) : MAX_HP;
    this.hunger = save && save.hunger != null ? Math.min(MAX_HUNGER, save.hunger) : MAX_HUNGER;
    this.timeOfDay = save && save.timeOfDay != null ? save.timeOfDay : START_TIME_OF_DAY;
    this.light = new LightMap();
    this.light.rebuildSky((c, r) => this.tilemap.get(c, r));
    this._starveTimer = 0;
    this._regenTimer = 0;
    this._lastHungerShown = -1;
    this._hitFlashMs = 0;
    this.inventory = save ? (save.inventory || {}) : {};
    this.hotbarSlots = save ? (save.hotbarSlots || new Array(HOTBAR_SIZE).fill(null))
                            : new Array(HOTBAR_SIZE).fill(null);
    this.selectedSlot = save ? (save.selectedSlot || 0) : 0;
    // { ...emptyEquipment(), ...save.equipment }: si el save es de antes de
    // que existiera este sistema (o le falta algún slot nuevo que se
    // agregue más adelante), se completa con null en vez de romper.
    this.equipment = emptyEquipment();
    if (save && save.equipment) Object.assign(this.equipment, save.equipment);
    if (!save) this._giveStarterTools();

    this.enemies = [];
    this._enemyTimer = 4000;
    this._fallFromY = null;
    this.invulnMs = 0;

    this.camera = new (E2D().Camera)({
      width: VIEW_W, height: VIEW_H, worldWidth: WORLD_W, worldHeight: WORLD_H
    });
    // followSmooth() + deadzone en vez de follow(): así saltar (movimiento
    // vertical chico y momentáneo) no mueve la cámara y no arruina la
    // puntería al colocar bloques. El primer follow() es un snap instantáneo
    // para arrancar ya centrado, sin que se vea la cámara "viajando" desde
    // el (0,0) inicial.
    this.camera.smoothing = CAMERA_SMOOTHING;
    // Sin deadzone del motor: el seguimiento lo decide _cameraTarget().
    this.camera.deadzone = null;
    this._camAnchorY = this.player.y + this.player.h / 2;
    this._applyZoom(0, true);
    this.camera.follow(this.player.x, this.player.y);

    this._fit();
    if (!this._onResize) {
      this._onResize = () => this._fit();
      window.addEventListener('resize', this._onResize);
    }

    this._attachInput();
    this._renderHotbar();
    this._renderHealth();
    this._renderHunger();
    showScreen(this.ui, null);

    this._autosave = setInterval(() => { if (!this.paused && !this.dead) this.save(); }, 30000);
    if (!this._beforeUnload) {
      this._beforeUnload = () => { if (this.running && !this.dead) this.save(); };
      window.addEventListener('beforeunload', this._beforeUnload);
    }

    this.loop = new (E2D().GameLoop)({
      update: (dt, step) => this._update(dt, step),
      draw: () => this._draw()
    });
    this.loop.start();
    this.running = true;
  }

  // Herramientas de cobre en los primeros slots: sin esto la partida
  // nueva arranca sin nada con qué picar.
  _giveStarterTools() {
    STARTER_TOOLS.forEach((id, i) => {
      this.inventory[id] = 1;
      if (i < HOTBAR_SIZE) this.hotbarSlots[i] = id;
    });
    // unas antorchas para la primera cueva / primera noche
    this.inventory[T.TORCH] = STARTER_TORCHES;
    if (STARTER_TOOLS.length < HOTBAR_SIZE) this.hotbarSlots[STARTER_TOOLS.length] = T.TORCH;
  }

  stop({ save = true } = {}) {
    if (this.running && save && !this.dead) this.save();
    if (this.loop) { this.loop.stop(); this.loop = null; }
    if (this.input) { this.input.detach(); this.input = null; }
    if (this._autosave) { clearInterval(this._autosave); this._autosave = null; }
    this.pointer.down = false;
    this._resetMine();
    this.running = false;
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
    E2D().fitCanvas(this.canvas, VIEW_W, VIEW_H);   // tamaño CSS (encaja en el contenedor)
    this.canvas.width = VIEW_W * RENDER_SCALE;       // backing store en alta resolución
    this.canvas.height = VIEW_H * RENDER_SCALE;
    this.ctx.imageSmoothingEnabled = false;         // (cambiar width resetea el contexto)
  }

  // ═══════════ Guardado ═══════════
  save() {
    if (!this.tilemap) return false;
    const col = Math.max(0, Math.min(COLS - 1, Math.floor(this.player.x / TILE)));
    return saveWorld(this.slot, {
      seed: this.seed,
      mode: this.mode,
      playedMs: this.playedMs,
      biome: this.world.biomeByCol[col],
      tiles: Array.from(this.tilemap.data),
      px: this.player.x, py: this.player.y,
      hp: this.hp,
      hunger: this.hunger,
      timeOfDay: this.timeOfDay,
      inventory: this.inventory,
      hotbarSlots: this.hotbarSlots,
      selectedSlot: this.selectedSlot,
      equipment: this.equipment
    });
  }

  // ═══════════ Pausa / inventario ═══════════
  setPaused(v) {
    if (this.dead || !this.running) return;
    this.paused = v;
    this.pointer.down = false;
    this._resetMine();
    if (v) {
      const biome = BIOMES[this.world.biomeByCol[Math.floor(this.player.x / TILE)]];
      this.ui.pauseInfo.textContent =
        `Mundo ${this.slot} · ${this.mode === 'hardcore' ? 'Hardcore' : 'Normal'} · ${fmtTime(this.playedMs)}` +
        (biome ? ` · ${biome.label}` : '');
      this.save();
      showScreen(this.ui, 'pause');
    } else {
      showScreen(this.ui, null);
    }
  }

  toggleInventory(force) {
    if (this.dead || !this.running) return;
    const v = force === undefined ? !this.invOpen : force;
    this.invOpen = v;
    this.pointer.down = false;
    this._resetMine();
    if (v) { this._renderInventory(); showScreen(this.ui, 'inv'); }
    else showScreen(this.ui, null);
  }

  // ═══════════ Input ═══════════
  _attachInput() {
    if (this.input) this.input.detach();
    this.input = new (E2D().KeyboardInput)({
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
      // Por ahora no hace nada en el juego: está mapeada para que el
      // navegador no scrollee la página hacia abajo al apretarla.
      ArrowDown: 'down', KeyS: 'down',
      Digit1: 'slot0', Digit2: 'slot1', Digit3: 'slot2', Digit4: 'slot3',
      Digit5: 'slot4', Digit6: 'slot5', Digit7: 'slot6', Digit8: 'slot7',
      KeyI: 'inv', Escape: 'pause'
    }, {
      activeCheck: () => this.running && !this.dead,
      preventDefaultFor: new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']),
      onDown: (action) => {
        if (action === 'inv') { if (!this.paused) this.toggleInventory(); return; }
        if (action === 'pause') {
          if (this.invOpen) this.toggleInventory(false);
          else this.setPaused(!this.paused);
          return;
        }
        if (this.paused || this.invOpen) return;
        if (action.startsWith('slot')) {
          this.selectedSlot = Number(action.slice(4));
          this._renderHotbar();
        }
      }
    });
    this.input.attach();
  }

  _bindCanvas() {
    // Clic derecho = colocar, así que el menú contextual del navegador se
    // anula en todo el contenedor del juego.
    this.ui.root.addEventListener('contextmenu', (e) => e.preventDefault());

    // Rueda = zoom. passive:false para poder cortar el scroll de la página.
    this.canvas.addEventListener('wheel', (e) => {
      if (!this.running || this.dead) return;
      e.preventDefault();
      if (this.paused || this.invOpen || e.deltaY === 0) return;
      const now = performance.now();
      if (now - this._lastWheelAt < ZOOM_WHEEL_COOLDOWN_MS) return;
      this._lastWheelAt = now;
      this.setZoomLevel(this._zoomIdx + (e.deltaY < 0 ? 1 : -1));
    }, { passive: false });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this._blocked()) return;
      try { this.canvas.setPointerCapture(e.pointerId); } catch {}
      this._hoverTile = this._pointerToTile(e, true);
      this.pointer.down = true;
      this.pointer.button = e.pointerType === 'touch'
        ? (this.touchMode === 'place' ? 2 : 0)
        : e.button;
      if (this.pointer.button === 2) { this._placeCd = 0; this._tryPlace(); }
      else this._resetMine();
      e.preventDefault();
    });

    const stop = (e) => {
      this.pointer.down = false;
      this._resetMine();
      try { if (e && e.pointerId != null) this.canvas.releasePointerCapture(e.pointerId); } catch {}
    };
    this.canvas.addEventListener('pointerup', stop);
    this.canvas.addEventListener('pointercancel', stop);
    this.canvas.addEventListener('pointerleave', (e) => { this._hoverTile = null; stop(e); });
    window.addEventListener('blur', () => { this.pointer.down = false; this._resetMine(); });
    const dropRect = () => { this._canvasRect = null; };
    window.addEventListener('resize', dropRect);
    window.addEventListener('scroll', dropRect, { passive: true, capture: true });
    this.canvas.addEventListener('pointerenter', dropRect);
    this.canvas.addEventListener('pointermove', (e) => {
      if (this._blocked()) { this._hoverTile = null; return; }
      this._hoverTile = this._pointerToTile(e);
    });
  }

  _bindTouch() {
    this.ui.touch.querySelectorAll('button[data-touch]').forEach(btn => {
      const act = btn.dataset.touch;
      const on = (v) => (e) => { e.preventDefault(); this.touchState[act] = v; };
      btn.addEventListener('pointerdown', on(true));
      btn.addEventListener('pointerup', on(false));
      btn.addEventListener('pointerleave', on(false));
      btn.addEventListener('pointercancel', on(false));
    });
    this.ui.touchMode.addEventListener('click', () => {
      this.touchMode = this.touchMode === 'break' ? 'place' : 'break';
      this.ui.touchMode.innerHTML = icon(this.touchMode === 'break' ? 'pickaxe' : 'box');
    });
  }

  // ═══════════ Zoom ═══════════
  setZoomLevel(idx) {
    const next = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, idx));
    if (next === this._zoomIdx) return;
    this._zoomIdx = next;
    try { localStorage.setItem(ZOOM_KEY, String(next)); } catch {}
  }

  // El zoom se implementa achicando/agrandando la "ventana" de la cámara
  // (camera.width/height en px de mundo) y escalando el dibujo en _draw:
  // con zoom 2 la cámara ve la mitad de mundo y se dibuja al doble. Así
  // TileMap, follow, deadzone y clamp siguen funcionando sin tocarlos.
  // El cambio es animado (se acerca al nivel pedido cuadro a cuadro) y
  // mantiene centrado el mismo punto del mundo.
  _applyZoom(dt, instant = false) {
    if (!this.camera) return;
    const target = ZOOM_LEVELS[this._zoomIdx];
    if (instant) this._zoom = target;
    else if (this._zoom !== target) {
      this._zoom += (target - this._zoom) * Math.min(1, dt / 90);
      if (Math.abs(target - this._zoom) < 0.002) this._zoom = target;
    }
    const cam = this.camera;
    const w = VIEW_W / this._zoom, h = VIEW_H / this._zoom;
    if (cam.width === w && cam.height === h) return;
    const cx = cam.x + cam.width / 2, cy = cam.y + cam.height / 2;
    cam.width = w; cam.height = h;
    cam.x = cx - w / 2; cam.y = cy - h / 2;
    cam._clamp();
  }

  _cameraTarget() {
    const px = this.player.x + this.player.w / 2;
    const py = this.player.y + this.player.h / 2;
    const maxAbove = (VIEW_H / this._zoom) * CAM_MAX_ABOVE_ANCHOR;
    if (this.player.grounded || py > this._camAnchorY) this._camAnchorY = py;
    else if (py < this._camAnchorY - maxAbove) this._camAnchorY = py + maxAbove;
    return { x: px, y: this._camAnchorY };
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
    const k = RENDER_SCALE * this._zoom;
    const w = this.camera.screenToWorld(sx / k, sy / k);
    return this.tilemap.worldToTile(w.x, w.y);
  }

  _inReach(col, row) {
    const cx = col * TILE + TILE / 2, cy = row * TILE + TILE / 2;
    const pcx = this.player.x + this.player.w / 2, pcy = this.player.y + this.player.h / 2;
    return Math.hypot(cx - pcx, cy - pcy) <= this.reachPx;
  }

  _resetMine() { this._mine.col = -1; this._mine.row = -1; this._mine.progress = 0; }

  // Herramienta que tiene en la mano (la del slot elegido), o null.
  get heldTool() {
    const id = this.hotbarSlots[this.selectedSlot];
    const info = id ? ITEM_INFO[id] : null;
    return info && info.tool ? info : null;
  }

  // Picado progresivo: se acumula sobre el MISMO tile mientras siga
  // apretado el botón; si el puntero se corre, arranca de cero. La
  // herramienta correcta (pico/hacha/pala) acelera según su material.
  _mineTick(dt) {
    const hov = this._hoverTile;
    if (!hov) { this._resetMine(); return; }
    const { col, row } = hov;
    const id = this.tilemap.get(col, row);

    if (id === 0 || !this._inReach(col, row)) { this._resetMine(); this._tryAttack(); return; }
    if (id === T.BEDROCK) { this._resetMine(); return; }

    if (this._mine.col !== col || this._mine.row !== row) {
      this._mine.col = col; this._mine.row = row; this._mine.progress = 0;
    }

    const hard = HARDNESS[id] || 0.6;
    const tool = this.heldTool;
    const speed = (tool && tool.tool === TOOL_FOR[id]) ? (1 + tool.power) : 1;
    this._mine.progress += ((dt / 1000) / hard) * speed;
    this._attackAnim = Math.max(this._attackAnim, 60);
    // mira hacia el bloque que pica (como en Terraria) y encadena golpes
    this.player.facing = (col * TILE + TILE / 2) >= (this.player.x + this.player.w / 2) ? 1 : -1;
    this._startSwing(SWING_MINE_MS);

    if (this._mine.progress >= 1) {
      // Con el inventario lleno de tipos distintos, _addItem devuelve false
      // y el drop se perdía: el bloque quedaba roto y no te llevabas nada.
      // Mejor no romperlo y avisar.
      let dropId = DROPS[id] || 0;
      // Minerales: si el pico no alcanza el tier, se rompe igual pero no suelta nada.
      const ore = ORE_DROPS[id];
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
      const pal = leafPalette(broken);
      const foodDrop = pal ? LEAF_FOOD_DROP[pal] : null;
      if (foodDrop && Math.random() < foodDrop.chance) this._addItem(foodDrop.id);
      this._retileAround(col, row);
      this._resetMine();
      this._attackAnim = 120;
    }
  }

  _tryPlace() {
    if (this._placeCd > 0) return;

    // Comida: no es colocable, así que el mismo botón (clic derecho) la
    // come en vez de intentar plantarla en el mundo. No depende de estar
    // apuntando a un tile — comer no necesita puntería.
    const heldId = this.hotbarSlots[this.selectedSlot];
    const heldInfo = heldId ? ITEM_INFO[heldId] : null;
    if (heldInfo && heldInfo.food) { this._eat(heldId, heldInfo); return; }

    if (!this._hoverTile) return;
    const { col, row } = this._hoverTile;
    if (!this._inReach(col, row) || this.tilemap.get(col, row) !== 0) return;

    const id = this.hotbarSlots[this.selectedSlot];
    const info = id ? ITEM_INFO[id] : null;
    if (!info || !info.place || (this.inventory[id] || 0) <= 0) return; // las herramientas no se colocan

    if (info.place === T.TORCH && !this._torchSupported(col, row)) return;
    const bx = col * TILE, by = row * TILE;
    const overlapsPlayer = SOLID_IDS.has(info.place) && bx < this.player.x + this.player.w && bx + TILE > this.player.x &&
                           by < this.player.y + this.player.h && by + TILE > this.player.y;
    if (overlapsPlayer) return;

    if (this.tilemap.placeTile(col, row, info.place)) {
      this._removeItem(id);
      this._retileAround(col, row);
      this._placeCd = PLACE_COOLDOWN;
    }
  }

  _eat(id, info) {
    if ((this.inventory[id] || 0) <= 0) return;
    this.hunger = Math.min(MAX_HUNGER, this.hunger + info.food);
    this._removeItem(id);
    this._placeCd = PLACE_COOLDOWN;
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
    const solid = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS && SOLID_IDS.has(tm.get(c, r));
    return solid(col, row + 1) || solid(col - 1, row) || solid(col + 1, row);
  }

  // Si se rompió el bloque que sostenía una antorcha vecina, se cae (vuelve al inventario).
  _dropUnsupportedTorches(col, row) {
    for (const [c, r] of [[col, row - 1], [col - 1, row], [col + 1, row]]) {
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      if (this.tilemap.get(c, r) === T.TORCH && !this._torchSupported(c, r)) {
        this.tilemap.breakTile(c, r);
        if (this._hasRoomFor(T.TORCH)) this._addItem(T.TORCH);
      }
    }
  }

  _retileAround(col, row) {
    if (this.light) this.light.updateColumn((c, r) => this.tilemap.get(c, r), col);
    this._dropUnsupportedTorches(col, row);
    const tm = this.tilemap;
    // Afuera del mapa se devuelve el tile del borde (y aire arriba del
    // cielo), igual que en el generador: si no, los laterales del mundo
    // dibujarían pasto contra la nada.
    const get = (c, r) => {
      if (r < 0) return 0;
      const cc = c < 0 ? 0 : (c >= COLS ? COLS - 1 : c);
      const rr = r >= ROWS ? ROWS - 1 : r;
      return tm.get(cc, rr);
    };
    for (const [c, r] of [[col, row], [col, row - 1], [col, row + 1], [col - 1, row], [col + 1, row]]) {
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      const id = tm.get(c, r);
      if (id === 0) continue;
      const next = autotileId(get, c, r);
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
    const stats = (tool && WEAPON_STATS[tool.tool]) || BARE_HAND_ATTACK;
    this._attackCd = stats.cooldown;
    this._attackAnim = 160;
    this._startSwing(SWING_ATTACK_MS, true);
    const dmg = ATTACK_DMG * stats.dmgMult + (tool && tool.tool === 'sword' ? tool.power * 2 : 0);
    const reach = stats.reach;
    const box = {
      x: this.player.facing > 0 ? this.player.x + this.player.w : this.player.x - reach,
      y: this.player.y + 2, w: reach, h: this.player.h - 4
    };
    for (const en of this.enemies) {
      if (en.hp > 0 && E2D().Collisions.rectOverlap(box, en)) {
        en.hp -= dmg;
        en.vx = this.player.facing * 3;
        en.vy = -3;
        en.hitMs = 150;
      }
    }
  }

  // ═══════════ Inventario / hotbar / equipamiento / crafteo ═══════════

  // Cupo total de ítems distintos: 8 de hotbar + 10 generales (14 con
  // mochila puesta). Cada TIPO de ítem ocupa un solo "hueco" acá adentro
  // sin importar cuánto stock tenga — lo mismo que ya hacía la hotbar
  // (`hotbarSlots.indexOf(null)`), solo que ahora también se aplica al
  // inventario general en vez de dejarlo sin límite.
  get invSlotCap() { return totalInvSlots(this.equipment); }
  // Cupo del inventario GENERAL solo (sin contar los 8 de la hotbar) —
  // lo usa la UI para el contador "X/10" (o "X/14" con mochila puesta).
  get generalSlotCap() { return totalGeneralSlots(this.equipment); }
  // Defensa total de la armadura puesta — se aplica en _damage().
  get armorDefense() { return totalDefense(this.equipment); }

  // qty por defecto 1 (picar/comida sueltan de a uno); craftItem() puede
  // pedir más de una unidad de una sola vez si algún día una receta da
  // resultQty > 1. Devuelve true/false: false = no entró (inventario
  // lleno de tipos distintos) y el drop/resultado se pierde.
  _addItem(id, qty = 1) {
    if (!id || !ITEM_INFO[id] || qty <= 0) return false;
    const isNew = !(id in this.inventory);
    if (isNew && Object.keys(this.inventory).length >= this.invSlotCap) {
      if (this.ui.showToast) this.ui.showToast('Inventario lleno');
      return false;
    }
    this.inventory[id] = (this.inventory[id] || 0) + qty;
    const info = ITEM_INFO[id];
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
      const i = this.hotbarSlots.indexOf(id);
      if (i !== -1) this.hotbarSlots[i] = null;
    } else this.inventory[id] = left;
    this._renderHotbar();
    if (this.invOpen) this._renderInventory();
  }

  // ¿Entra este ítem? (true si no ocupa hueco nuevo o si todavía hay cupo)
  _hasRoomFor(id) {
    if (!id || !ITEM_INFO[id]) return true; // nada que guardar
    if (id in this.inventory) return true;  // ya tenés de ese tipo: solo suma stock
    return Object.keys(this.inventory).length < this.invSlotCap;
  }

  _renderHotbar() { this.ui.renderHotbar(this); }
  _renderInventory() { this.ui.renderInventory(this); }

  // ── Equipar / desequipar ──
  // Devuelve true/false (para que la UI sepa si hizo falta avisar algo).
  equipItem(id) {
    const info = ITEM_INFO[id];
    if (!info || !info.equip || (this.inventory[id] || 0) <= 0) return false;
    const slotType = info.equip;
    const prev = this.equipment[slotType];
    if (prev === id) return true; // ya está puesto, no hay nada que hacer

    // Sacamos el nuevo del inventario primero: así, si había algo puesto
    // en ese slot, el hueco que libera este item es justo el que
    // necesita el que vuelve.
    this._removeItem(id, 1);
    if (prev) {
      if (!this._addItem(prev, 1)) {
        // No entró de vuelta (caso límite: inventario lleno con 18 tipos
        // distintos Y el que tenías puesto era, para colmo, un tipo que
        // ya no está en tu inventario). Revertimos todo — nadie se queda
        // sin su equipo puesto por un slot que no alcanzó.
        this._addItem(id, 1); // esto sí entra seguro: acabamos de liberarlo
        return false;
      }
    }
    this.equipment[slotType] = id;
    if (this.invOpen) this._renderInventory();
    return true;
  }

  unequipItem(slotType) {
    const id = this.equipment[slotType];
    if (!id) return false;
    if (!this._addItem(id, 1)) return false; // inventario lleno, no se puede sacar
    this.equipment[slotType] = null;
    if (this.invOpen) this._renderInventory();
    return true;
  }

  // ── Crafteo ──
  // Devuelve { ok, reason } en vez de solo boolean, así la UI puede
  // mostrar un mensaje distinto según por qué no se pudo craftear.
  craftItem(recipeId) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return { ok: false, reason: 'not_found' };
    if (!canCraft(this.inventory, recipe)) return { ok: false, reason: 'missing' };
    // Chequeamos el cupo ANTES de descontar nada: así, si el resultado no
    // va a entrar, no perdés los materiales de arriba.
    if (!craftWouldFit(this.inventory, recipe, this.invSlotCap)) return { ok: false, reason: 'full' };
    consumeRecipe(this.inventory, recipe);
    this._addItem(recipe.result, recipe.resultQty || 1); // ahora sí entra seguro
    return { ok: true };
  }

  // ═══════════ Vida / muerte ═══════════
  _renderHealth() {
    const pct = Math.max(0, this.hp / MAX_HP) * 100;
    this.ui.hpBar.style.width = pct + '%';
    this.ui.hpBar.style.background = pct > 50 ? '#4caf50' : pct > 25 ? '#f5c518' : '#e0563a';
    this.ui.hpText.textContent = `${Math.max(0, Math.round(this.hp))}/${MAX_HP}`;
  }

  _renderHunger() {
    const pct = Math.max(0, this.hunger / MAX_HUNGER) * 100;
    this.ui.hungerBar.style.width = pct + '%';
    this.ui.hungerBar.style.background = pct > 50 ? '#caa24a' : pct > 20 ? '#d98a3d' : '#c0392b';
    this.ui.hungerText.textContent = `${Math.max(0, Math.round(this.hunger))}/${MAX_HUNGER}`;
  }

  _damage(amount, { ignoreInvuln = false } = {}) {
    if (this.dead || amount <= 0) return;
    if (!ignoreInvuln && this.invulnMs > 0) return;
    // La armadura amortigua los golpes cuerpo a cuerpo — ignoreInvuln=false
    // es justo la marca que ya usan esos golpes (ver _updateEnemies) — pero
    // NO el daño de caída ni el de hambre (ignoreInvuln=true): la
    // armadura no evita romperte una pierna cayendo ni evita pasar hambre.
    if (!ignoreInvuln) {
      // la defensa reduce un % del golpe (con tope), nunca lo anula del todo
      amount = Math.max(1, Math.round(amount * (1 - armorReduction(this.armorDefense))));
    }
    this.hp -= amount;
    this.invulnMs = INVULN_MS;
    // Feedback aparte del parpadeo largo de invulnerabilidad: un flash
    // rojo corto sobre el personaje y un temblor de cámara breve, así el
    // golpe se siente aunque el parpadeo por invulnerabilidad no aplique
    // (ignoreInvuln=true, como el daño de caída o el de hambre).
    this._hitFlashMs = HIT_FLASH_MS;
    if (this.camera) this.camera.shake(HIT_SHAKE_INTENSITY, HIT_SHAKE_MS);
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
    this.hunger = MAX_HUNGER;
    this._starveTimer = 0;
    this._renderHunger();

    const hardcore = this.mode === 'hardcore';
    this.ui.deathTime.textContent =
      `Sobreviviste ${fmtTime(this.playedMs)} en el Mundo ${this.slot}` +
      (hardcore ? '.\nEra hardcore: el mundo se borró.' : '.');
    this.ui.deathRespawn.classList.toggle('hidden', hardcore);
    if (hardcore) deleteWorld(this.slot);
    else this.save();

    showScreen(this.ui, 'death');
    if (typeof this.onDeath === 'function') this.onDeath(this.mode);
  }

  respawn() {
    if (this.mode === 'hardcore') return;
    this.dead = false;
    this.hp = MAX_HP;
    // Sin esto, si morías con el hambre en 0 (la causa más común de morir
    // sin enemigos cerca) reaparecías con vida llena pero el hambre seguía
    // en 0 — el _starveTimer te volvía a pegar en STARVE_INTERVAL_MS casi
    // de inmediato, como si el respawn no hubiera hecho nada.
    this.hunger = MAX_HUNGER;
    this._starveTimer = 0;
    this.invulnMs = INVULN_MS;
    this.player.x = this.spawn.x;
    this.player.y = this.spawn.y;
    this.player.vx = 0; this.player.vy = 0;
    this._fallFromY = null;
    this.enemies.length = 0;
    this._renderHealth();
    this._renderHunger();
    this._camAnchorY = this.player.y + this.player.h / 2;
    this._applyZoom(0, true);
    this.camera.follow(this.player.x, this.player.y);
    showScreen(this.ui, null);
  }

  // ═══════════ Enemigos ═══════════
  _spawnEnemy() {
    const pcol = Math.floor(this.player.x / TILE);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const col = pcol + dir * (14 + Math.floor(Math.random() * 6));
    if (col < 2 || col >= COLS - 2) return;
    const row = this.world.surfaceByCol[col] - 1;
    if (this.tilemap.get(col, row) !== 0) return;
    this.enemies.push({
      x: col * TILE + 2, y: (row - 1) * TILE,
      w: 12, h: 12, vx: 0.7 * -dir, vy: 0,
      grounded: false, hp: 6, hitMs: 0
    });
  }

  _updateEnemies(dt, step) {
    this._enemyTimer -= dt;
    if (this._enemyTimer <= 0) {
      this._enemyTimer = 4000;
      if (this.enemies.length < 4) this._spawnEnemy();
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      if (en.hp <= 0) { this.enemies.splice(i, 1); continue; }
      if (en.hitMs > 0) en.hitMs -= dt;

      const before = en.vx;
      E2D().Physics.applyGravity(en, step);
      E2D().Physics.resolveTileCollisions(en, this.tilemap, step);

      const ahead = Math.floor((en.x + (before > 0 ? en.w + 2 : -2)) / TILE);
      const below = Math.floor((en.y + en.h + 2) / TILE);
      const flip = en.vx === 0 || (en.grounded && !this.tilemap.isSolidAt(ahead, below));
      en.vx = (flip ? -Math.sign(before || 1) : Math.sign(before || 1)) * 0.7;

      if (E2D().Collisions.rectOverlap(en, this.player)) {
        this._damage(2);
        this.player.vx = Math.sign(this.player.x - en.x || 1) * 3;
        this.player.vy = -3;
      }
      if (Math.abs(en.x - this.player.x) > 45 * TILE) this.enemies.splice(i, 1);
    }
  }

  // ═══════════ Update ═══════════
  _update(dt, step) {
    if (!this.player || this.paused || this.invOpen || this.dead) return;

    this.playedMs += dt;
    if (this._attackCd > 0) this._attackCd -= dt;
    if (this._placeCd > 0) this._placeCd -= dt;
    if (this._attackAnim > 0) this._attackAnim -= dt;
    if (this._swing.t < this._swing.dur) this._swing.t += dt;
    this.timeOfDay = (this.timeOfDay + dt / DAY_CYCLE_MS) % 1;
    if (this.invulnMs > 0) this.invulnMs -= dt;
    if (this._hitFlashMs > 0) this._hitFlashMs -= dt;

    // Hambre: se vacía sola con el tiempo jugado. En 0 pega daño cada
    // tanto (ignora invulnerabilidad, como la caída); bien alimentado
    // (arriba del umbral) regenera vida de a poco como premio por comer.
    this.hunger = Math.max(0, this.hunger - HUNGER_DRAIN_PER_MS * dt);
    if (this.hunger <= 0) {
      this._starveTimer += dt;
      if (this._starveTimer >= STARVE_INTERVAL_MS) {
        this._starveTimer = 0;
        this._damage(STARVE_DAMAGE, { ignoreInvuln: true });
      }
    } else {
      this._starveTimer = 0;
    }
    if (this.hunger >= HUNGER_REGEN_THRESHOLD && this.hp < MAX_HP) {
      this._regenTimer += dt;
      if (this._regenTimer >= HP_REGEN_INTERVAL_MS) {
        this._regenTimer = 0;
        this.hp = Math.min(MAX_HP, this.hp + HP_REGEN_AMOUNT);
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
    if (left) { this.player.vx = -MOVE_SPEED; this.player.facing = -1; }
    if (right) { this.player.vx = MOVE_SPEED; this.player.facing = 1; }
    if (jump && this.player.grounded) this.player.vy = JUMP_VEL;

    const wasGrounded = this.player.grounded;
    E2D().Physics.applyGravity(this.player, step);
    // step: sin esto la velocidad dependía de los FPS (a 30fps, mitad de
    // velocidad; en monitores de 144Hz, más del doble).
    E2D().Physics.resolveTileCollisions(this.player, this.tilemap, step);

    // Daño de caída
    if (!this.player.grounded) {
      this._fallFromY = this._fallFromY === null
        ? this.player.y : Math.min(this._fallFromY, this.player.y);
    } else {
      if (!wasGrounded && this._fallFromY !== null) {
        const tiles = (this.player.y - this._fallFromY) / TILE;
        if (tiles > FALL_SAFE_TILES) {
          this._damage(Math.round((tiles - FALL_SAFE_TILES) * FALL_DMG_PER_TILE), { ignoreInvuln: true });
        }
      }
      this._fallFromY = null;
    }

    this.player.x = Math.max(0, Math.min(this.player.x, WORLD_W - this.player.w));
    if (this.player.y > WORLD_H + 100) {
      this.player.x = this.spawn.x; this.player.y = this.spawn.y;
      this.player.vy = 0; this._fallFromY = null;
    }

    // animación del personaje: 2 frames de caminar o 2 de idle, cada uno
    // con su propia velocidad; saltar/morir son 1 frame fijo.
    this._anim.t += dt;
    const walking = Math.abs(this.player.vx) > 0.1 && this.player.grounded;
    if (walking !== this._anim.walking) { this._anim.walking = walking; this._anim.t = 0; this._anim.i = 0; }
    const period = 1000 / (walking ? PLAYER.walkFps : PLAYER.idleFps);
    if (this._anim.t >= period) { this._anim.t = 0; this._anim.i = (this._anim.i + 1) % 2; }

    if (this.pointer.down) {
      if (this.pointer.button === 0) this._mineTick(dt);
      else if (this.pointer.button === 2) this._tryPlace();
    }

    this._updateEnemies(dt, step);

    this._applyZoom(dt);
    const t = this._cameraTarget();
    this.camera.followSmooth(t.x, t.y);
    this.camera.update(dt);
  }

  // Devuelve el índice de celda y si hay que espejarlo. Caminar y saltar
  // tienen frames propios para cada lado; idle y muerte miran a la derecha
  // y se espejan para la izquierda.
  _playerFrame() {
    const F = PLAYER.frames, right = this.player.facing >= 0;
    if (this.dead) return { f: F.death, flip: false };
    if (!this.player.grounded) return { f: right ? F.jumpR : F.jumpL, flip: false };
    if (Math.abs(this.player.vx) > 0.1) return { f: (right ? F.walkR : F.walkL)[this._anim.i], flip: false };
    return { f: F.idle[this._anim.i % F.idle.length], flip: !right };
  }

  _startSwing(dur, restart = false) {
    if (!restart && this._swing.t < this._swing.dur) return; // deja terminar el golpe en curso
    this._swing.t = 0; this._swing.dur = dur;
  }

  // Brazo + ítem girando alrededor del hombro. Se dibuja en coordenadas
  // lógicas de pantalla (ya dentro del ctx escalado por el zoom).
  _drawSwingArm(ctx, cellX, cellY) {
    const sw = this._swing;
    if (sw.t >= sw.dur) return;
    const right = this.player.facing >= 0;
    const u = Math.min(1, sw.t / sw.dur);
    const e = 1 - (1 - u) * (1 - u);                // arranca rápido, frena al final
    const ang = SWING_FROM + (SWING_TO - SWING_FROM) * e;
    const A = PLAYER.arm, S = PLAYER.shoulder, cs = PLAYER.fw;
    const shx = cellX + (right ? S.x : cs - S.x);
    const shy = cellY + S.y;
    ctx.save();
    ctx.translate(shx, shy);
    if (!right) ctx.scale(-1, 1);                 // mismo giro, espejado
    ctx.rotate(ang);
    // ítem en la mano: se dibuja ANTES del brazo, así la mano lo tapa
    const tool = this.heldTool;
    if (tool && tool.sprite && this.img.items) {
      // atlas de ítems: tamaño real del dibujo (1 px del dibujo = 1 px del mundo)
      const cell = itemCell(tool.sprite), hold = itemHold(tool.sprite);
      if (cell && hold) {
        ctx.save();
        ctx.translate(0, A.handY - A.pivotY);
        ctx.rotate(hold.rot);
        if (hold.scale !== 1) ctx.scale(hold.scale, hold.scale);
        ctx.imageSmoothingEnabled = hold.scale !== 1;   // tamaño exacto: sin suavizar
        ctx.drawImage(this.img.items, cell.sx, cell.sy, cell.w, cell.h, -hold.ax, -hold.ay, cell.w, cell.h);
        ctx.imageSmoothingEnabled = true;
        ctx.restore();
      }
    }
    const c = PLAYER.cell;
    ctx.drawImage(this.img.player, PLAYER.frames.arm * c, 0, c, c,
                  -A.pivotX, -A.pivotY, cs, cs);
    ctx.restore();
  }

  // ═══════════ Draw ═══════════
  _draw() {
    const ctx = this.ctx;
    // Todo el dibujo trabaja en unidades lógicas (480x288); esto lo lleva
    // al backing store de alta resolución.
    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (!this.tilemap) { ctx.clearRect(0, 0, VIEW_W, VIEW_H); return; }

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
    const snapStep = 1 / (RENDER_SCALE * this._zoom);
    const snapDX = this.camera.x - Math.round(this.camera.x / snapStep) * snapStep;
    const snapDY = this.camera.y - Math.round(this.camera.y / snapStep) * snapStep;
    this.camera.x -= snapDX;
    this.camera.y -= snapDY;

    const pcol = Math.max(0, Math.min(COLS - 1, Math.floor((this.player.x + this.player.w / 2) / TILE)));
    const prow = Math.floor((this.player.y + this.player.h / 2) / TILE);
    const underground = prow > this.world.surfaceByCol[pcol] + 6;
    const sun = sunAt(this.timeOfDay, NIGHT_SUN);
    const nightK = (1 - sun) / (1 - NIGHT_SUN);   // 0 = día, 1 = noche cerrada
    ctx.fillStyle = underground ? '#0c0e14' : mixHex(BIOMES[this.world.biomeByCol[pcol]].sky, NIGHT_SKY, nightK);
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.scale(this._zoom, this._zoom);
    this.tilemap.draw(ctx, this.camera);

    for (const en of this.enemies) {
      const s = this.camera.worldToScreen(en.x, en.y);
      ctx.fillStyle = en.hitMs > 0 ? '#ffffff' : '#5aa469';
      ctx.fillRect(s.x, s.y, en.w, en.h);
      ctx.fillStyle = '#12301b';
      ctx.fillRect(s.x + 2, s.y + 4, 2, 2);
      ctx.fillRect(s.x + en.w - 4, s.y + 4, 2, 2);
    }

    // ── Personaje + herramienta en mano ──
    const blink = this.invulnMs > 0 && Math.floor(this.invulnMs / 80) % 2 === 0;
    if (!blink) {
      const p = this.camera.worldToScreen(this.player.x, this.player.y);
      const { f, flip } = this._playerFrame();
      const c = PLAYER.cell;
      const swinging = !this.dead && this._swing.t < this._swing.dur;
      const row = swinging ? PLAYER.armlessRow : 0;
      const cellX = p.x + PLAYER_SPRITE.offX, cellY = p.y + PLAYER_SPRITE.offY;
      // El sprite está en su resolución original (más grande que en
      // pantalla): se achica con suavizado de alta calidad para no perder
      // detalle ni dejar pixeles desparejos. Los bloques siguen sin suavizar.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      drawSprite(ctx, this.img.player, f * c, row * c, c, c,
                 cellX, cellY, PLAYER_SPRITE.w, PLAYER_SPRITE.h, flip);
      if (swinging) this._drawSwingArm(ctx, cellX, cellY);
      ctx.imageSmoothingEnabled = false;
    }

    // Flash corto sobre el propio personaje al recibir un golpe — aparte
    // del parpadeo largo de invulnerabilidad, para que el impacto se
    // sienta también cuando ese parpadeo no se dispara (daño de hambre,
    // de caída).
    if (this._hitFlashMs > 0) {
      const p = this.camera.worldToScreen(this.player.x, this.player.y);
      ctx.fillStyle = `rgba(255,60,60,${0.5 * (this._hitFlashMs / HIT_FLASH_MS)})`;
      ctx.fillRect(p.x - 2, p.y - 2, this.player.w + 4, this.player.h + 4);
    }

    // ── Iluminación: oscuridad sobre todo el mundo (bloques, minerales,
    // enemigos, personaje). Luz = sol a cielo abierto + antorchas +
    // círculo de visión propio. Ver survi_light.js. ──
    this.light.compute((c, r) => this.tilemap.get(c, r), this.camera, sun, [{
      x: this.player.x + this.player.w / 2,
      y: this.player.y + this.player.h / 2,
      power: PLAYER_VISION
    }]);
    this.light.draw(ctx, this.camera);

    // el recuadro del bloque apuntado va arriba de la oscuridad: si no, en
    // una cueva oscura no sabrías qué estás picando
    // tile apuntado + grietas de picado (textura de particle/broken.png)
    if (this._hoverTile && !this._blocked()) {
      const { col, row } = this._hoverTile;
      const s = this.camera.worldToScreen(col * TILE, row * TILE);
      ctx.strokeStyle = this._inReach(col, row) ? 'rgba(255,255,255,0.85)' : 'rgba(255,80,80,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x + 1, s.y + 1, TILE - 2, TILE - 2);

      if (this._mine.col === col && this._mine.row === row && this._mine.progress > 0 && this.img.cracks) {
        const stage = Math.min(CRACKS.stages - 1, Math.floor(this._mine.progress * CRACKS.stages));
        ctx.drawImage(this.img.cracks, stage * CRACKS.cell, 0, CRACKS.cell, CRACKS.cell,
                      s.x, s.y, TILE, TILE);
      }
    }

    ctx.restore(); // fin del mundo escalado: lo de abajo cubre toda la pantalla

    if (this.invulnMs > 0) {
      ctx.fillStyle = `rgba(200,30,30,${0.25 * (this.invulnMs / INVULN_MS)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    // Deshacer el corrimiento de shake del principio de _draw(): camera.x/y
    // tienen que quedar como los dejó camera.update() para el próximo
    // frame (clamp, deadzone, etc).
    this.camera.x += shakeX + snapDX;
    this.camera.y += shakeY + snapDY;
  }
}
