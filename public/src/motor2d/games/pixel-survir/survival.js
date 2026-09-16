// ══════════════════════════════════════════════════════════════
//   JueFriv — survival.js
//   Minijuego de supervivencia tipo Terraria simple, armado
//   ARRIBA de Engine2D (no lo modifica). Usa:
//     - Engine2D.TileMap   → mundo, romper/colocar bloque
//     - Engine2D.Physics   → gravedad + colisión contra el tilemap
//     - Engine2D.Camera    → seguimiento del jugador
//     - Engine2D.GameLoop  → loop con dt normalizado
//     - Engine2D.KeyboardInput
//     - Engine2D.Fullscreen
//
//   Lo que el motor NO traía y se resuelve acá (capa de juego, no
//   de motor): generación de biomas, inventario, hotbar, guardado
//   de partida en localStorage.
//
//   Uso:
//     <div id="survival-root"></div>
//     <script src="engine2d.js"></script>
//     <script src="survival.js"></script>
//     <script>
//       SurvivalGame.mount(document.getElementById('survival-root'));
//     </script>
//
//   mount() arma TODO el DOM interno (canvas, hotbar, cartel de
//   menú/pausa) con las clases de ui-components.css, así que ese
//   CSS + su archivo deben estar cargados en la página. No hace
//   falta escribir HTML a mano — se puede restylear/reordenar
//   después tocando survival.css.
// ══════════════════════════════════════════════════════════════

const SurvivalGame = (function () {

  // ───────────────────────────────
  // Config del mundo
  // ───────────────────────────────
  const TILE = 16;
  const COLS = 200;
  const ROWS = 200;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;
  const VIEW_W = 480;   // resolución interna del canvas (30 tiles de ancho)
  const VIEW_H = 288;   // 18 tiles de alto
  const SAVE_KEY = 'juefriv.survival.save.v1';

  // IDs de tile (0 = aire, por convención del motor)
  const T = {
    GRASS: 1, DIRT: 2, SAND: 3, STONE: 4, WOOD: 5,
    LEAVES: 6, CACTUS: 7, CAVESTONE: 8, COAL: 9, IRON: 10, BEDROCK: 11
  };
  const SOLID_IDS = new Set([T.GRASS, T.DIRT, T.SAND, T.STONE, T.WOOD, T.CACTUS, T.CAVESTONE, T.COAL, T.IRON, T.BEDROCK]);
  const TILESET_COLS = 4;

  // Info de cada item (nombre + color para el ícono del hotbar).
  // BEDROCK a propósito no está: no se puede picar ni tener en inventario.
  const ITEM_INFO = {
    [T.GRASS]:     { name: 'Pasto',        color: '#4caf50' },
    [T.DIRT]:      { name: 'Tierra',       color: '#8a5a34' },
    [T.SAND]:      { name: 'Arena',        color: '#e3c98a' },
    [T.STONE]:     { name: 'Piedra',       color: '#9a9a9a' },
    [T.WOOD]:      { name: 'Madera',       color: '#7a4a26' },
    [T.LEAVES]:    { name: 'Hojas',        color: '#2e8b3a' },
    [T.CACTUS]:    { name: 'Cactus',       color: '#4a8c6b' },
    [T.CAVESTONE]: { name: 'Roca de cueva',color: '#565667' },
    [T.COAL]:      { name: 'Carbón',       color: '#2a2a2e' },
    [T.IRON]:      { name: 'Hierro',       color: '#c9a27a' },
  };
  const HOTBAR_SIZE = 8;

  // ───────────────────────────────
  // PRNG determinístico (mulberry32) — mismo seed = mismo mundo
  // ───────────────────────────────
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ───────────────────────────────
  // Tileset: se dibuja en un canvas propio (no hay sprites), colores
  // planos + un par de motitas para que no se vea totalmente liso.
  // Se arma UNA vez al mount() y se registra en Engine2D.loadImage
  // como un data URL — así TileMap lo usa igual que si fuera un PNG.
  // ───────────────────────────────
  function buildTilesetDataURL() {
    const rows = Math.ceil(Object.keys(T).length / TILESET_COLS);
    const cv = document.createElement('canvas');
    cv.width = TILESET_COLS * TILE;
    cv.height = rows * TILE;
    const c = cv.getContext('2d');

    const order = [T.GRASS, T.DIRT, T.SAND, T.STONE, T.WOOD, T.LEAVES, T.CACTUS, T.CAVESTONE, T.COAL, T.IRON, T.BEDROCK];
    const baseColor = {
      [T.GRASS]: '#4caf50', [T.DIRT]: '#8a5a34', [T.SAND]: '#e3c98a',
      [T.STONE]: '#9a9a9a', [T.WOOD]: '#7a4a26', [T.LEAVES]: '#2e8b3a',
      [T.CACTUS]: '#4a8c6b', [T.CAVESTONE]: '#565667', [T.COAL]: '#2a2a2e',
      [T.IRON]: '#c9a27a', [T.BEDROCK]: '#1c1c22'
    };
    const speckle = {
      [T.GRASS]: '#3d8b40', [T.STONE]: '#7d7d7d', [T.CAVESTONE]: '#3f3f4a',
      [T.COAL]: '#000000', [T.IRON]: '#e8b98a', [T.SAND]: '#cdb072',
      [T.WOOD]: '#5c371c', [T.LEAVES]: '#1f6b28'
    };

    order.forEach((id, i) => {
      const col = i % TILESET_COLS, row = Math.floor(i / TILESET_COLS);
      const x = col * TILE, y = row * TILE;
      c.fillStyle = baseColor[id];
      c.fillRect(x, y, TILE, TILE);
      // pasto: franja más clara arriba
      if (id === T.GRASS) {
        c.fillStyle = '#6fcf73';
        c.fillRect(x, y, TILE, 3);
      }
      // motitas de textura, siempre en las mismas posiciones (determinístico)
      if (speckle[id]) {
        c.fillStyle = speckle[id];
        const dots = [[2,5],[9,3],[5,10],[12,12],[3,13]];
        for (const [dx, dy] of dots) c.fillRect(x + dx, y + dy, 2, 2);
      }
      // borde sutil para separar tiles a simple vista
      c.strokeStyle = 'rgba(0,0,0,0.15)';
      c.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    });

    return cv.toDataURL('image/png');
  }

  // ───────────────────────────────
  // Generación del mundo: 3 biomas de superficie por franjas de
  // columna (bosque / pradera / desierto) + una capa de cueva bajo
  // tierra en todo el mundo (el 4to bioma pedido).
  // ───────────────────────────────
  function biomeAt(col) {
    if (col < COLS * 0.33) return 'bosque';
    if (col < COLS * 0.66) return 'pradera';
    return 'desierto';
  }

  function generateWorld(seed) {
    const rnd = mulberry32(seed);
    const data = new Uint16Array(COLS * ROWS);
    const surfaceByCol = new Int16Array(COLS);
    const surfaceBase = 40;
    const phaseX = rnd() * 1000;
    const caveSeedA = rnd() * 1000;
    const caveSeedB = rnd() * 1000;

    const idx = (col, row) => row * COLS + col;

    // ── Pasada 1: terreno por columna (superficie, subsuelo, piedra, cueva) ──
    for (let col = 0; col < COLS; col++) {
      const biome = biomeAt(col);
      const amp = biome === 'desierto' ? 1.5 : biome === 'pradera' ? 3 : 5;
      const noise = Math.sin((col + phaseX) * 0.15) * 0.6 + Math.sin((col + phaseX) * 0.045 + 2) * 0.4;
      const surfaceRow = Math.round(surfaceBase + noise * amp);
      surfaceByCol[col] = surfaceRow;

      const topTile = biome === 'desierto' ? T.SAND : T.GRASS;
      const subTile = biome === 'desierto' ? T.SAND : T.DIRT;
      const stoneStart = surfaceRow + 5;
      const caveStart = stoneStart + 25;

      for (let row = 0; row < ROWS; row++) {
        let id = 0;
        if (row < surfaceRow) {
          id = 0; // cielo
        } else if (row === surfaceRow) {
          id = topTile;
        } else if (row < stoneStart) {
          id = subTile;
        } else if (row >= ROWS - 3) {
          id = T.BEDROCK; // piso indestructible del mundo
        } else if (row < caveStart) {
          id = T.STONE;
        } else {
          // zona de cueva: ruido 2D simple para tallar túneles + vetas
          const n = Math.sin((col + caveSeedA) * 0.35 + row * 0.5) *
                    Math.sin((row + caveSeedB) * 0.28 - col * 0.2);
          if (n > 0.3) {
            id = 0; // túnel hueco
          } else {
            const r = rnd();
            if (r < 0.025) id = T.COAL;
            else if (r < 0.045) id = T.IRON;
            else id = T.CAVESTONE;
          }
        }
        data[idx(col, row)] = id;
      }
    }

    // ── Pasada 2: árboles (bosque) y cactus (desierto) ──
    for (let col = 2; col < COLS - 2; col++) {
      const biome = biomeAt(col);
      const surfaceRow = surfaceByCol[col];
      if (biome === 'bosque' && data[idx(col, surfaceRow)] === T.GRASS && rnd() < 0.12) {
        const trunkH = 3;
        for (let k = 1; k <= trunkH; k++) data[idx(col, surfaceRow - k)] = T.WOOD;
        const topRow = surfaceRow - trunkH;
        for (const dc of [-1, 0, 1]) {
          const c2 = col + dc;
          if (data[idx(c2, topRow - 1)] === 0) data[idx(c2, topRow - 1)] = T.LEAVES;
          if (data[idx(c2, topRow)] === 0) data[idx(c2, topRow)] = T.LEAVES;
        }
      } else if (biome === 'desierto' && data[idx(col, surfaceRow)] === T.SAND && rnd() < 0.05) {
        const h = rnd() < 0.4 ? 2 : 1;
        for (let k = 1; k <= h; k++) data[idx(col, surfaceRow - k)] = T.CACTUS;
      }
    }

    // Spawn: en el bosque, cerca del borde izquierdo, arriba del pasto.
    const spawnCol = 20;
    const spawnRow = surfaceByCol[spawnCol] - 4;

    return { data, spawnCol, spawnRow };
  }

  // ───────────────────────────────
  // Clase principal
  // ───────────────────────────────
  class Game {
    constructor(root) {
      this.root = root;
      this.inventory = {};          // id -> cantidad
      this.hotbarSlots = new Array(HOTBAR_SIZE).fill(null);
      this.selectedSlot = 0;
      this.reachPx = 5.5 * TILE;
      this.moveSpeed = 2.2;
      this.jumpVel = -7.6;
      this.paused = false;
      this._lastActionTs = 0;
      this._buildDOM();
    }

    // ── DOM: canvas + HUD + carteles, todo con clases de ui-components.css ──
    _buildDOM() {
      this.root.classList.add('surv-root');
      this.root.innerHTML = `
        <canvas class="surv-canvas"></canvas>
        <div class="surv-hud">
          <button class="game-icon-btn surv-pause-btn" title="Pausa">⏸</button>
          <div class="surv-hotbar"></div>
        </div>
        <div class="surv-touch">
          <div class="surv-touch-move">
            <button class="game-icon-btn" data-act="left">◀</button>
            <button class="game-icon-btn" data-act="right">▶</button>
          </div>
          <button class="game-icon-btn surv-touch-jump" data-act="jump">⤒</button>
        </div>
        <div class="modal-game surv-menu">
          <div class="modal-game-box">
            <h2 class="modal-game-title">Supervivencia</h2>
            <p class="modal-game-sub">Bosque, pradera, desierto y cuevas.\nExplorá, rompé y construí.</p>
            <button class="btn-game-primary" data-act="continue">Continuar partida</button>
            <button class="btn-game-secondary" data-act="new">Nueva partida</button>
          </div>
        </div>
        <div class="modal-game surv-pause hidden">
          <div class="modal-game-box">
            <h2 class="modal-game-title">Pausa</h2>
            <button class="btn-game-primary" data-act="resume">Continuar</button>
            <button class="btn-game-secondary" data-act="save">Guardar partida</button>
            <button class="btn-game-secondary" data-act="fullscreen">Pantalla completa</button>
            <button class="btn-game-secondary" data-act="restart">Nueva partida (borra guardado)</button>
          </div>
        </div>
      `;
      this.canvas = this.root.querySelector('.surv-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.hotbarEl = this.root.querySelector('.surv-hotbar');
      this.menuEl = this.root.querySelector('.surv-menu');
      this.pauseEl = this.root.querySelector('.surv-pause');
      this.touchEl = this.root.querySelector('.surv-touch');

      Engine2D.fitCanvas(this.canvas, VIEW_W, VIEW_H);
      window.addEventListener('resize', () => Engine2D.fitCanvas(this.canvas, VIEW_W, VIEW_H));

      // Menú inicial: si hay guardado, ofrece continuar; si no, arranca directo.
      const hasSave = this._hasSave();
      this.menuEl.querySelector('[data-act="continue"]').style.display = hasSave ? '' : 'none';
      this.menuEl.querySelector('[data-act="new"]').textContent = hasSave ? 'Nueva partida' : 'Empezar';
      this.menuEl.addEventListener('click', (e) => {
        const act = e.target.dataset.act;
        if (act === 'continue') this._startGame(this._loadSave());
        else if (act === 'new') this._startGame(null);
      });

      this.pauseEl.addEventListener('click', (e) => {
        const act = e.target.dataset.act;
        if (act === 'resume') this._setPaused(false);
        else if (act === 'save') { this.save(); this._flashSaved(); }
        else if (act === 'fullscreen') Engine2D.Fullscreen.toggle(this.root);
        else if (act === 'restart') {
          this._deleteSave();
          this._setPaused(false);
          this._startGame(null);
        }
      });
      this.root.querySelector('.surv-pause-btn').addEventListener('click', () => this._setPaused(!this.paused));

      // Táctil: mové/saltá tocando los botones (además del teclado).
      this.touchState = { left: false, right: false, jump: false };
      this.touchEl.querySelectorAll('button').forEach(btn => {
        const act = btn.dataset.act;
        const on = (v) => (e) => { e.preventDefault(); this.touchState[act] = v; };
        btn.addEventListener('pointerdown', on(true));
        btn.addEventListener('pointerup', on(false));
        btn.addEventListener('pointerleave', on(false));
        btn.addEventListener('pointercancel', on(false));
      });

      // Romper / colocar: un click/tap sobre el canvas.
      this.canvas.addEventListener('pointerdown', (e) => this._handlePointer(e));
      this._hoverTile = null;
      this.canvas.addEventListener('pointermove', (e) => { this._hoverTile = this._pointerToTile(e); });
      this.canvas.addEventListener('pointerleave', () => { this._hoverTile = null; });
    }

    _flashSaved() {
      const btn = this.pauseEl.querySelector('[data-act="save"]');
      const original = btn.textContent;
      btn.textContent = 'Guardado ✓';
      setTimeout(() => { btn.textContent = original; }, 900);
    }

    _setPaused(v) {
      this.paused = v;
      this.pauseEl.classList.toggle('hidden', !v);
      if (v) this.save();
    }

    // ── Guardado ──
    _hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
    _loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } }
    _deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} }

    save() {
      if (!this.tilemap) return;
      const payload = {
        v: 1,
        seed: this.seed,
        tiles: Array.from(this.tilemap.data),
        px: this.player.x, py: this.player.y,
        inventory: this.inventory,
        hotbarSlots: this.hotbarSlots,
        selectedSlot: this.selectedSlot
      };
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(payload)); } catch (e) { /* localStorage lleno o bloqueado */ }
    }

    // ── Arranque de partida (nueva o desde guardado) ──
    async _startGame(saveData) {
      this.menuEl.classList.add('hidden');
      this.seed = saveData ? saveData.seed : Date.now();
      const { data, spawnCol, spawnRow } = generateWorld(this.seed);
      const tileData = saveData ? Uint16Array.from(saveData.tiles) : data;

      const tilesetSrc = buildTilesetDataURL();
      await Engine2D.loadImage(tilesetSrc);

      this.tilemap = new Engine2D.TileMap({
        cols: COLS, rows: ROWS, tileSize: TILE,
        tilesetSrc, tilesetCols: TILESET_COLS,
        solidIds: SOLID_IDS, data: tileData
      });

      this.player = {
        x: saveData ? saveData.px : spawnCol * TILE,
        y: saveData ? saveData.py : (spawnRow - 3) * TILE,
        w: 12, h: 22, vx: 0, vy: 0, grounded: false, facing: 1
      };

      this.inventory = saveData ? (saveData.inventory || {}) : {};
      this.hotbarSlots = saveData ? (saveData.hotbarSlots || new Array(HOTBAR_SIZE).fill(null)) : new Array(HOTBAR_SIZE).fill(null);
      this.selectedSlot = saveData ? (saveData.selectedSlot || 0) : 0;

      this.camera = new Engine2D.Camera({
        width: VIEW_W, height: VIEW_H, worldWidth: WORLD_W, worldHeight: WORLD_H
      });
      this.camera.follow(this.player.x, this.player.y);

      this.input = new Engine2D.KeyboardInput({
        ArrowLeft: 'left', KeyA: 'left',
        ArrowRight: 'right', KeyD: 'right',
        ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
        Digit1: 'slot0', Digit2: 'slot1', Digit3: 'slot2', Digit4: 'slot3',
        Digit5: 'slot4', Digit6: 'slot5', Digit7: 'slot6', Digit8: 'slot7',
        Escape: 'pause'
      }, {
        activeCheck: () => !this.paused,
        preventDefaultFor: new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space']),
        onDown: (action) => {
          if (action.startsWith('slot')) this.selectedSlot = Number(action.slice(4));
          else if (action === 'pause') this._setPaused(!this.paused);
        }
      });
      this.input.attach();

      this._renderHotbar();
      this._autosaveTimer = setInterval(() => { if (!this.paused) this.save(); }, 30000);
      window.addEventListener('beforeunload', () => this.save());

      this.loop = new Engine2D.GameLoop({
        update: (dt, step) => this._update(dt, step),
        draw: () => this._draw()
      });
      this.loop.start();
    }

    // ── Input: convierte un click/tap en coordenadas de tile ──
    _pointerToTile(e) {
      const rect = this.canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      const world = this.camera.screenToWorld(sx, sy);
      return this.tilemap.worldToTile(world.x, world.y);
    }

    _handlePointer(e) {
      if (this.paused || !this.tilemap) return;
      const { col, row } = this._pointerToTile(e);
      const tileCenterX = col * TILE + TILE / 2, tileCenterY = row * TILE + TILE / 2;
      const playerCenterX = this.player.x + this.player.w / 2, playerCenterY = this.player.y + this.player.h / 2;
      const dist = Math.hypot(tileCenterX - playerCenterX, tileCenterY - playerCenterY);
      if (dist > this.reachPx) return; // fuera de alcance

      const current = this.tilemap.get(col, row);
      if (current !== 0) {
        if (current === T.BEDROCK) return; // indestructible
        const id = this.tilemap.breakTile(col, row);
        this._addItem(id);
      } else {
        const selectedId = this.hotbarSlots[this.selectedSlot];
        if (selectedId && (this.inventory[selectedId] || 0) > 0) {
          // no dejar colocar bloque encima del propio jugador
          const overlapsPlayer = !(tileCenterX + TILE / 2 < this.player.x || tileCenterX - TILE / 2 > this.player.x + this.player.w ||
                                    tileCenterY + TILE / 2 < this.player.y || tileCenterY - TILE / 2 > this.player.y + this.player.h);
          if (!overlapsPlayer && this.tilemap.placeTile(col, row, selectedId)) {
            this._removeItem(selectedId);
          }
        }
      }
    }

    _addItem(id) {
      if (!ITEM_INFO[id]) return; // bedrock u otro id no coleccionable
      this.inventory[id] = (this.inventory[id] || 0) + 1;
      if (!this.hotbarSlots.includes(id)) {
        const freeIdx = this.hotbarSlots.indexOf(null);
        if (freeIdx !== -1) this.hotbarSlots[freeIdx] = id;
      }
      this._renderHotbar();
    }

    _removeItem(id) {
      this.inventory[id] = Math.max(0, (this.inventory[id] || 0) - 1);
      this._renderHotbar();
    }

    // ── Hotbar (DOM) ──
    _renderHotbar() {
      this.hotbarEl.innerHTML = '';
      for (let i = 0; i < HOTBAR_SIZE; i++) {
        const id = this.hotbarSlots[i];
        const info = id ? ITEM_INFO[id] : null;
        const count = id ? (this.inventory[id] || 0) : 0;
        const slot = document.createElement('div');
        slot.className = 'surv-slot' + (i === this.selectedSlot ? ' selected' : '');
        slot.innerHTML = `
          <span class="surv-slot-key">${i + 1}</span>
          ${info ? `<span class="surv-slot-icon" style="background:${info.color}"></span><span class="surv-slot-count">${count}</span>` : ''}
        `;
        slot.title = info ? info.name : '';
        slot.addEventListener('click', () => { this.selectedSlot = i; this._renderHotbar(); });
        this.hotbarEl.appendChild(slot);
      }
    }

    // ── Update ──
    _update(dt, step) {
      if (this.paused || !this.player) return;
      const st = this.input.state;
      const left = st.left || this.touchState.left;
      const right = st.right || this.touchState.right;
      const jump = st.jump || this.touchState.jump;

      this.player.vx = 0;
      if (left) { this.player.vx = -this.moveSpeed; this.player.facing = -1; }
      if (right) { this.player.vx = this.moveSpeed; this.player.facing = 1; }
      if (jump && this.player.grounded) this.player.vy = this.jumpVel;

      Engine2D.Physics.applyGravity(this.player, step);
      Engine2D.Physics.resolveTileCollisions(this.player, this.tilemap);

      // límites del mundo (a los costados; abajo lo tapa el bedrock)
      this.player.x = Math.max(0, Math.min(this.player.x, WORLD_W - this.player.w));
      if (this.player.y > WORLD_H + 100) { // red de seguridad por si algo raro pasa
        this.player.x = 20 * TILE; this.player.y = 0; this.player.vy = 0;
      }

      this.camera.follow(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2);
      this.camera.update(dt);
    }

    // ── Draw ──
    _draw() {
      const ctx = this.ctx;
      if (!this.tilemap) { ctx.clearRect(0, 0, VIEW_W, VIEW_H); return; }

      const playerRow = Math.floor((this.player.y + this.player.h / 2) / TILE);
      const underground = playerRow > 45;
      ctx.fillStyle = underground ? '#0c0e14' : '#7ec8e3';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      this.tilemap.draw(ctx, this.camera);

      // resaltado del tile apuntado
      if (this._hoverTile) {
        const { col, row } = this._hoverTile;
        const cx = col * TILE + TILE / 2, cy = row * TILE + TILE / 2;
        const pcx = this.player.x + this.player.w / 2, pcy = this.player.y + this.player.h / 2;
        const inReach = Math.hypot(cx - pcx, cy - pcy) <= this.reachPx;
        const screen = this.camera.worldToScreen(col * TILE, row * TILE);
        ctx.strokeStyle = inReach ? 'rgba(255,255,255,0.85)' : 'rgba(255,80,80,0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(screen.x + 1, screen.y + 1, TILE - 2, TILE - 2);
      }

      // jugador (rectángulo simple con "cara" según hacia dónde mira)
      const p = this.camera.worldToScreen(this.player.x, this.player.y);
      ctx.fillStyle = '#e0563a';
      ctx.fillRect(p.x, p.y, this.player.w, this.player.h);
      ctx.fillStyle = '#2b1a12';
      const eyeX = this.player.facing > 0 ? p.x + this.player.w - 4 : p.x + 2;
      ctx.fillRect(eyeX, p.y + 5, 2, 2);
    }

    destroy() {
      if (this.loop) this.loop.stop();
      if (this.input) this.input.detach();
      if (this._autosaveTimer) clearInterval(this._autosaveTimer);
    }
  }

  // API pública
  function mount(rootEl) {
    return new Game(rootEl);
  }

  return { mount };
})();
