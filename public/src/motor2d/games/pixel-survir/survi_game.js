// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_game.js
//   El juego en sí: loop, jugador (sprite de Junior), vida + daño de
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
  MOVE_SPEED, JUMP_VEL, REACH_TILES
} from './survi_config.js';
import { generateWorld, pickSpawn, autotileId } from './survi_world.js';
import { saveWorld, deleteWorld, fmtTime } from './survi_save.js';
import { showScreen } from './survi_ui.js';
import {
  ASSETS, PRELOAD, TILESET, JUNIOR, TOOLS_HELD, CRACKS, toolCell, drawSprite
} from './sprites.js';

const E2D = () => globalThis.Engine2D;

export class SurviGame {
  constructor(ui) {
    this.ui = ui;
    this.canvas = ui.canvas;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;   // pixel art: nada de blur

    this.running = false;
    this.paused = false;
    this.invOpen = false;
    this.dead = false;

    this.slot = 1;
    this.mode = 'normal';
    this.playedMs = 0;

    this.reachPx = REACH_TILES * TILE;
    this.hp = MAX_HP;
    this.enemies = [];

    this.pointer = { down: false, button: 0 };
    this.touchState = { left: false, right: false, jump: false };
    this.touchMode = 'break';
    this._mine = { col: -1, row: -1, progress: 0 };
    this._hoverTile = null;
    this._fallFromY = null;
    this._attackCd = 0; this._placeCd = 0; this._attackAnim = 0;
    this.invulnMs = 0;
    this._anim = { t: 0, i: 0 };

    this.onDeath = null;

    this._bindCanvas();
    this._bindTouch();
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

    // Todos los PNG de una: tileset, Junior, herramientas y grietas.
    // Si alguno falla igual se arranca: mejor el juego sin una textura que
    // la pantalla trabada esperando un PNG que no está.
    await E2D().loadAll(PRELOAD.map(src => ({ type: 'image', src })))
      .catch(err => console.warn('[pixel-survi] falta algún asset:', err));
    this.img = {
      tiles: E2D().getImage(ASSETS.tiles),
      junior: E2D().getImage(ASSETS.junior),
      held: E2D().getImage(ASSETS.toolsHeld),
      cracks: E2D().getImage(ASSETS.cracks)
    };

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
    this.inventory = save ? (save.inventory || {}) : {};
    this.hotbarSlots = save ? (save.hotbarSlots || new Array(HOTBAR_SIZE).fill(null))
                            : new Array(HOTBAR_SIZE).fill(null);
    this.selectedSlot = save ? (save.selectedSlot || 0) : 0;
    if (!save) this._giveStarterTools();

    this.enemies = [];
    this._enemyTimer = 4000;
    this._fallFromY = null;
    this.invulnMs = 0;

    this.camera = new (E2D().Camera)({
      width: VIEW_W, height: VIEW_H, worldWidth: WORLD_W, worldHeight: WORLD_H
    });
    this.camera.follow(this.player.x, this.player.y);

    this._fit();
    if (!this._onResize) {
      this._onResize = () => this._fit();
      window.addEventListener('resize', this._onResize);
    }

    this._attachInput();
    this._renderHotbar();
    this._renderHealth();
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
    E2D().fitCanvas(this.canvas, VIEW_W, VIEW_H);
    this.ctx.imageSmoothingEnabled = false;
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
      inventory: this.inventory,
      hotbarSlots: this.hotbarSlots,
      selectedSlot: this.selectedSlot
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
      Digit1: 'slot0', Digit2: 'slot1', Digit3: 'slot2', Digit4: 'slot3',
      Digit5: 'slot4', Digit6: 'slot5', Digit7: 'slot6', Digit8: 'slot7',
      KeyE: 'inv', Escape: 'pause'
    }, {
      activeCheck: () => this.running && !this.dead,
      preventDefaultFor: new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space']),
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

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this._blocked()) return;
      try { this.canvas.setPointerCapture(e.pointerId); } catch {}
      this._hoverTile = this._pointerToTile(e);
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
      this.ui.touchMode.textContent = this.touchMode === 'break' ? '⛏' : '🧱';
    });
  }

  _blocked() {
    return !this.running || this.paused || this.invOpen || this.dead || !this.tilemap;
  }

  _pointerToTile(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    const w = this.camera.screenToWorld(sx, sy);
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

    if (this._mine.progress >= 1) {
      const broken = this.tilemap.breakTile(col, row);
      this._addItem(DROPS[broken] || 0);
      this._retileAround(col, row);
      this._resetMine();
      this._attackAnim = 120;
    }
  }

  _tryPlace() {
    if (this._placeCd > 0 || !this._hoverTile) return;
    const { col, row } = this._hoverTile;
    if (!this._inReach(col, row) || this.tilemap.get(col, row) !== 0) return;

    const id = this.hotbarSlots[this.selectedSlot];
    const info = id ? ITEM_INFO[id] : null;
    if (!info || !info.place || (this.inventory[id] || 0) <= 0) return; // las herramientas no se colocan

    const bx = col * TILE, by = row * TILE;
    const overlapsPlayer = bx < this.player.x + this.player.w && bx + TILE > this.player.x &&
                           by < this.player.y + this.player.h && by + TILE > this.player.y;
    if (overlapsPlayer) return;

    if (this.tilemap.placeTile(col, row, info.place)) {
      this._removeItem(id);
      this._retileAround(col, row);
      this._placeCd = PLACE_COOLDOWN;
    }
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
  _retileAround(col, row) {
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

  _tryAttack() {
    if (this._attackCd > 0) return;
    this._attackCd = ATTACK_COOLDOWN;
    this._attackAnim = 160;
    const tool = this.heldTool;
    const dmg = ATTACK_DMG + (tool && tool.tool === 'sword' ? tool.power * 2 : 0);
    const reach = 20;
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

  // ═══════════ Inventario / hotbar ═══════════
  _addItem(id) {
    if (!id || !ITEM_INFO[id]) return;
    this.inventory[id] = (this.inventory[id] || 0) + 1;
    if (!this.hotbarSlots.includes(id)) {
      const free = this.hotbarSlots.indexOf(null);
      if (free !== -1) this.hotbarSlots[free] = id;
    }
    this._renderHotbar();
    if (this.invOpen) this._renderInventory();
  }

  _removeItem(id) {
    const left = Math.max(0, (this.inventory[id] || 0) - 1);
    if (left === 0) {
      delete this.inventory[id];
      const i = this.hotbarSlots.indexOf(id);
      if (i !== -1) this.hotbarSlots[i] = null;
    } else this.inventory[id] = left;
    this._renderHotbar();
    if (this.invOpen) this._renderInventory();
  }

  _renderHotbar() { this.ui.renderHotbar(this); }
  _renderInventory() { this.ui.renderInventory(this); }

  // ═══════════ Vida / muerte ═══════════
  _renderHealth() {
    const pct = Math.max(0, this.hp / MAX_HP) * 100;
    this.ui.hpBar.style.width = pct + '%';
    this.ui.hpBar.style.background = pct > 50 ? '#4caf50' : pct > 25 ? '#f5c518' : '#e0563a';
    this.ui.hpText.textContent = `${Math.max(0, Math.round(this.hp))}/${MAX_HP}`;
  }

  _damage(amount, { ignoreInvuln = false } = {}) {
    if (this.dead || amount <= 0) return;
    if (!ignoreInvuln && this.invulnMs > 0) return;
    this.hp -= amount;
    this.invulnMs = INVULN_MS;
    this._renderHealth();
    if (this.hp <= 0) this._die();
  }

  _die() {
    this.hp = 0;
    this.dead = true;
    this.pointer.down = false;
    this._resetMine();
    this._renderHealth();

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
    this.invulnMs = INVULN_MS;
    this.player.x = this.spawn.x;
    this.player.y = this.spawn.y;
    this.player.vx = 0; this.player.vy = 0;
    this._fallFromY = null;
    this.enemies.length = 0;
    this._renderHealth();
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
      E2D().Physics.resolveTileCollisions(en, this.tilemap);

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
    if (this.invulnMs > 0) this.invulnMs -= dt;

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
    E2D().Physics.resolveTileCollisions(this.player, this.tilemap);

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

    // animación de Junior
    this._anim.t += dt;
    if (Math.abs(this.player.vx) > 0.1 && this.player.grounded) {
      const period = 1000 / JUNIOR.walkFps;
      if (this._anim.t >= period) { this._anim.t = 0; this._anim.i = (this._anim.i + 1) % JUNIOR.frames.walk.length; }
    } else {
      this._anim.i = 0;
    }

    if (this.pointer.down) {
      if (this.pointer.button === 0) this._mineTick(dt);
      else if (this.pointer.button === 2) this._tryPlace();
    }

    this._updateEnemies(dt, step);

    this.camera.follow(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2);
    this.camera.update(dt);
  }

  _playerFrame() {
    if (this._attackAnim > 0) return JUNIOR.frames.swing;
    if (!this.player.grounded) return JUNIOR.frames.jump;
    if (Math.abs(this.player.vx) > 0.1) return JUNIOR.frames.walk[this._anim.i];
    return JUNIOR.frames.idle;
  }

  // ═══════════ Draw ═══════════
  _draw() {
    const ctx = this.ctx;
    if (!this.tilemap) { ctx.clearRect(0, 0, VIEW_W, VIEW_H); return; }

    const pcol = Math.max(0, Math.min(COLS - 1, Math.floor((this.player.x + this.player.w / 2) / TILE)));
    const prow = Math.floor((this.player.y + this.player.h / 2) / TILE);
    const underground = prow > this.world.surfaceByCol[pcol] + 6;
    ctx.fillStyle = underground ? '#0c0e14' : BIOMES[this.world.biomeByCol[pcol]].sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    this.tilemap.draw(ctx, this.camera);

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

    for (const en of this.enemies) {
      const s = this.camera.worldToScreen(en.x, en.y);
      ctx.fillStyle = en.hitMs > 0 ? '#ffffff' : '#5aa469';
      ctx.fillRect(s.x, s.y, en.w, en.h);
      ctx.fillStyle = '#12301b';
      ctx.fillRect(s.x + 2, s.y + 4, 2, 2);
      ctx.fillRect(s.x + en.w - 4, s.y + 4, 2, 2);
    }

    // ── Junior + herramienta en mano ──
    const blink = this.invulnMs > 0 && Math.floor(this.invulnMs / 80) % 2 === 0;
    if (!blink) {
      const p = this.camera.worldToScreen(this.player.x, this.player.y);
      const flip = this.player.facing < 0;   // los sprites originales miran a la derecha
      const f = this._playerFrame();
      const sx = (f % JUNIOR.cols) * JUNIOR.fw;
      const sy = Math.floor(f / JUNIOR.cols) * JUNIOR.fh;

      drawSprite(ctx, this.img.junior, sx, sy, JUNIOR.fw, JUNIOR.fh,
                 p.x + PLAYER_SPRITE.offX, p.y + PLAYER_SPRITE.offY,
                 PLAYER_SPRITE.w, PLAYER_SPRITE.h, flip);

      const tool = this.heldTool;
      if (tool && this.img.held) {
        const cell = toolCell(TOOLS_HELD, tool.tool, tool.mat);
        if (cell) {
          const swing = this._attackAnim > 0 ? -3 : 0;
          const hx = flip ? p.x - 11 : p.x + this.player.w - 5;
          drawSprite(ctx, this.img.held, cell.sx, cell.sy, cell.w, cell.h,
                     hx, p.y + 4 + swing, 16, 16, flip);
        }
      }
    }

    if (this.invulnMs > 0) {
      ctx.fillStyle = `rgba(200,30,30,${0.25 * (this.invulnMs / INVULN_MS)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }
}
