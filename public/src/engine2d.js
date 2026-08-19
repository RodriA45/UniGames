// ══════════════════════════════════════
//   Engine2D — engine2d.js
// ══════════════════════════════════════
//
// Motor 2D chico para canvas, sacado de lo genérico que ya vivía adentro
// de rpg.js (loop con dt normalizado, cache de imágenes/atlas, helpers de
// dibujo con drawImage, manejo de teclado, entidades/escenas). La idea es
// que cada minijuego nuevo NO reescriba esto: solo define su config de
// niveles, sus entidades (con update/draw) y listo.
//
// No depende de nada del resto del proyecto — no toca DOM de HUD/overlay
// específico ni sabe nada de "secciones" (sec-rpg_pixel, etc). Cada juego
// sigue siendo dueño de su propio HTML/CSS/overlay, como ya vienen siendo
// Pixel Runner y RPG Pixel. Este archivo se carga UNA vez en index.html
// (antes que los .js de cada juego) y expone el objeto global `Engine2D`.
//
// Uso típico de un minijuego nuevo:
//
//   const loop = new Engine2D.GameLoop({
//     update: (dt, step) => scene.update(dt, step),
//     draw:   () => { ctx.clearRect(0,0,C.width,C.height); scene.draw(ctx); }
//   });
//   Engine2D.loadAll([{type:'image', src:'foo.png'}]).then(() => loop.start());
//
// ══════════════════════════════════════

const Engine2D = (function () {

  // ─────────────────────────────────────
  // Assets: cache de imágenes y atlas JSON
  // ─────────────────────────────────────
  const images = {};
  const atlases = {};

  function loadImage(src) {
    if (images[src] && images[src].complete) return Promise.resolve(images[src]);
    return new Promise((resolve, reject) => {
      const img = images[src] || new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      images[src] = img;
      if (!img.src) img.src = src;
    });
  }

  function loadAtlas(src) {
    if (atlases[src]) return Promise.resolve(atlases[src]);
    return fetch(src)
      .then(r => r.json())
      .then(data => { atlases[src] = data; return data; });
  }

  // manifest: [{type:'image', src}, {type:'atlas', src}, ...]
  // Devuelve Promise.all — usar .catch() en el que llama para mostrar
  // el mensaje de "no se pudieron cargar los recursos" propio del juego.
  function loadAll(manifest) {
    return Promise.all(manifest.map(item =>
      item.type === 'atlas' ? loadAtlas(item.src) : loadImage(item.src)
    ));
  }

  function getImage(src) { return images[src]; }
  function getAtlas(src) { return atlases[src]; }

  // ─────────────────────────────────────
  // Utilidades numéricas
  // ─────────────────────────────────────
  function randRange(range) {
    if (!range) return 0;
    return range[0] + Math.random() * (range[1] - range[0]);
  }

  // Zona jugable: piso = mitad inferior del canvas (u otro ratio), con
  // margen inferior. Mismo criterio que usaban rpg.js/Pixel Runner a mano.
  function floorBounds(canvas, topRatio = 0.5, bottomMargin = 0.06) {
    return {
      top: canvas.height * topRatio,
      bottom: canvas.height * (1 - bottomMargin)
    };
  }

  // ─────────────────────────────────────
  // Dibujo — helpers con drawImage
  // ─────────────────────────────────────

  // Dibuja un frame de spritesheet de grilla uniforme (como sprites.js),
  // anclado en (x,y) = punto de los pies, escalado a targetH manteniendo
  // el aspect ratio de la celda.
  function drawFrame(ctx, img, rowData, frameIndex, x, y, targetH, flip) {
    const sx = frameIndex * rowData.cellWidth;
    const sy = rowData.y;
    const sw = rowData.cellWidth;
    const sh = rowData.cellHeight;
    const dh = targetH;
    const dw = dh * (sw / sh);
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh, dw, dh);
    ctx.restore();
  }

  // Dibuja un frame por NOMBRE desde un atlas JSON
  // ({frameSize, frames:{nombre:{x,y,w,h}}}) — para sheets con poses
  // discretas (dash, ataques) en vez de un ciclo de caminata uniforme.
  function drawAtlasFrame(ctx, img, atlas, frameName, x, y, targetH, flip, centered) {
    const f = atlas.frames[frameName];
    if (!f) return;
    const dh = targetH;
    const dw = dh * (f.w / f.h);
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    if (centered) {
      ctx.drawImage(img, f.x, f.y, f.w, f.h, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.drawImage(img, f.x, f.y, f.w, f.h, -dw / 2, -dh, dw, dh);
    }
    ctx.restore();
  }

  // Dibuja un ícono recortado a mano por coordenadas fijas {x,y,w,h}
  // (balas, pociones, proyectiles sueltos en una hoja compartida).
  // opts: { rotation, flip, centered }
  function drawIconRect(ctx, img, rect, x, y, targetH, opts = {}) {
    const dh = targetH;
    const dw = dh * (rect.w / rect.h);
    ctx.save();
    ctx.translate(x, y);
    if (opts.rotation) ctx.rotate(opts.rotation);
    if (opts.flip) ctx.scale(-1, 1);
    if (opts.centered) {
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, -dw / 2, -dh, dw, dh);
    }
    ctx.restore();
  }

  // Dibuja `img` cubriendo todo el rect destino (equivalente a
  // background-size: cover) — para fondos de zona/escena.
  function drawCover(ctx, img, dx, dy, dw, dh) {
    const ir = img.width / img.height;
    const dr = dw / dh;
    let sx, sy, sw, sh;
    if (ir > dr) {
      sh = img.height; sw = sh * dr; sx = (img.width - sw) / 2; sy = 0;
    } else {
      sw = img.width; sh = sw / dr; sx = 0; sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  // ─────────────────────────────────────
  // GameLoop — requestAnimationFrame con dt normalizado a "frames" de 60fps
  // ─────────────────────────────────────
  class GameLoop {
    // opts: { update(dt, step), draw(), maxDt=50 }
    // step = dt/16.6, para mover cosas en unidades "por frame a 60fps"
    // sin depender del refresh rate real de la pantalla (mismo criterio
    // que ya usaba rpgUpdate).
    constructor({ update, draw, maxDt = 50 }) {
      this.updateFn = update;
      this.drawFn = draw;
      this.maxDt = maxDt;
      this.running = false;
      this.raf = null;
      this.lastTs = 0;
      this._tick = this._tick.bind(this);
    }
    start() {
      // OJO: stop() antes de prender running=true — si se llama al revés,
      // un start() inmediatamente seguido de lógica que llame stop() apaga
      // el loop recién prendido y nunca vuelve a correr (bug real que tuvo
      // rpg.js con rpgBeginCombat/rpgStopLoop).
      this.stop();
      this.running = true;
      this.lastTs = 0;
      this.raf = requestAnimationFrame(this._tick);
    }
    stop() {
      this.running = false;
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
    }
    _tick(ts) {
      if (!this.running) return;
      const dt = this.lastTs ? Math.min(ts - this.lastTs, this.maxDt) : 16;
      this.lastTs = ts;
      const step = dt / 16.6;
      this.updateFn(dt, step);
      this.drawFn();
      this.raf = requestAnimationFrame(this._tick);
    }
  }

  // ─────────────────────────────────────
  // Input — teclado
  // ─────────────────────────────────────
  // keyMap: { ArrowUp:'up', KeyW:'up', Space:'fire', ... } → nombres de
  // acción, no códigos de tecla, así el juego no vuelve a repetir el if
  // gigante de e.code === 'ArrowUp' || e.code === 'KeyW' que tenía rpg.js.
  //
  // opts:
  //   activeCheck: () => boolean   — para no reaccionar si la sección/juego
  //                                  no está visible (RPG usaba esto para
  //                                  chequear .classList.contains('active'))
  //   onDown(action, e), onUp(action, e) — callbacks opcionales, ej. para
  //                                  recalcular "facing" o disparar
  //   preventDefaultFor: Set(['ArrowUp',...]) — códigos a los que hacerles
  //                                  preventDefault (evita scroll de página)
  class KeyboardInput {
    constructor(keyMap, opts = {}) {
      this.keyMap = keyMap;
      this.state = {}; // { up:true, fire:false, ... } — ya normalizado por acción
      this.opts = opts;
      this._down = this._down.bind(this);
      this._up = this._up.bind(this);
    }
    attach() {
      this.detach();
      document.addEventListener('keydown', this._down);
      document.addEventListener('keyup', this._up);
    }
    detach() {
      document.removeEventListener('keydown', this._down);
      document.removeEventListener('keyup', this._up);
    }
    _down(e) {
      if (this.opts.activeCheck && !this.opts.activeCheck()) return;
      const action = this.keyMap[e.code];
      if (!action) return;
      this.state[action] = true;
      if (this.opts.preventDefaultFor && this.opts.preventDefaultFor.has(e.code)) e.preventDefault();
      if (this.opts.onDown) this.opts.onDown(action, e);
    }
    _up(e) {
      const action = this.keyMap[e.code];
      if (!action) return;
      this.state[action] = false;
      if (this.opts.onUp) this.opts.onUp(action, e);
    }
  }

  // Nota sobre controles táctiles: en este proyecto los botones táctiles
  // se cablean directo en el HTML con onpointerdown/onpointerup llamando
  // funciones globales del juego (ver rpgMove/rpgBlock/rpgFire en
  // rpg.js + index.html). El motor no fuerza otra convención encima de
  // eso — cada juego simplemente hace que esas funciones globales toquen
  // el mismo `KeyboardInput.state` (o su propio estado) que ya usa para
  // teclado, para no duplicar lógica de movimiento entre los dos modos.

  // ─────────────────────────────────────
  // Entidad / Escena
  // ─────────────────────────────────────
  // Clase base opcional — un juego puede usar objetos planos si prefiere
  // el estilo que ya tenía rpg.js (RPG.player como objeto suelto). Sirve
  // sobre todo para juegos con varios enemigos/proyectiles a la vez, donde
  // antes había arrays sueltos (RPG.bullets, RPG.potions, ...) cada uno
  // con su propio forEach de update y de draw.
  class Entity {
    constructor(props = {}) { Object.assign(this, props); }
    update(dt, step, scene) {}
    draw(ctx, scene) {}
    // Poner en true para que Scene.update() la saque sola del array
    // (reemplaza los "RPG.bullets = RPG.bullets.filter(...)" a mano).
    dead = false;
  }

  class Scene {
    constructor() { this.entities = []; }
    add(entity) { this.entities.push(entity); return entity; }
    remove(entity) {
      const i = this.entities.indexOf(entity);
      if (i >= 0) this.entities.splice(i, 1);
    }
    clear() { this.entities.length = 0; }
    update(dt, step) {
      this.entities.forEach(e => e.update(dt, step, this));
      // Limpieza de entidades muertas (bala que salió de pantalla,
      // proyectil que impactó, etc) — un solo lugar en vez de repetirlo
      // por cada array como pasaba en rpg.js.
      this.entities = this.entities.filter(e => !e.dead);
    }
    draw(ctx) { this.entities.forEach(e => e.draw(ctx, this)); }
    // Filtra por un campo, ej: scene.byType('bullet')
    byType(type) { return this.entities.filter(e => e.type === type); }
  }

  // ─────────────────────────────────────
  // TileMap — mundo en grilla (tipo Terraria/plataformas)
  // ─────────────────────────────────────
  // data: array plano de largo cols*rows, un id numérico por celda.
  // 0 = aire (vacío) por convención — cualquier otro id se busca en el
  // tileset. solidIds: Set de ids que bloquean movimiento (ej. tierra,
  // piedra sí; una antorcha de fondo no).
  class TileMap {
    constructor({ cols, rows, tileSize, tilesetSrc, tilesetCols, solidIds = new Set(), data = null }) {
      this.cols = cols;
      this.rows = rows;
      this.tileSize = tileSize;
      this.tilesetSrc = tilesetSrc;   // src ya cargado con Engine2D.loadImage
      this.tilesetCols = tilesetCols; // columnas del tileset (grilla uniforme, id-1 = índice)
      this.solidIds = solidIds;
      this.data = data || new Uint16Array(cols * rows); // 0 = aire
    }

    inBounds(col, row) {
      return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
    }

    get(col, row) {
      if (!this.inBounds(col, row)) return 0;
      return this.data[row * this.cols + col];
    }

    set(col, row, id) {
      if (!this.inBounds(col, row)) return;
      this.data[row * this.cols + col] = id;
    }

    isSolidAt(col, row) {
      return this.solidIds.has(this.get(col, row));
    }

    // Coordenadas de mundo (px) → celda de la grilla.
    worldToTile(x, y) {
      return { col: Math.floor(x / this.tileSize), row: Math.floor(y / this.tileSize) };
    }

    // Celda → esquina superior-izquierda en coordenadas de mundo (px).
    tileToWorld(col, row) {
      return { x: col * this.tileSize, y: row * this.tileSize };
    }

    // AABB en mundo de una celda — usado por la física para resolver colisiones.
    tileWorldBox(col, row) {
      return { x: col * this.tileSize, y: row * this.tileSize, w: this.tileSize, h: this.tileSize };
    }

    // Picar: vacía la celda y devuelve el id que había (para sumarlo al
    // inventario). Si ya estaba vacía devuelve 0.
    breakTile(col, row) {
      const id = this.get(col, row);
      if (id !== 0) this.set(col, row, 0);
      return id;
    }

    // Colocar: solo si la celda está vacía (no pisa un bloque existente).
    // Devuelve true si colocó.
    placeTile(col, row, id) {
      if (!this.inBounds(col, row)) return false;
      if (this.get(col, row) !== 0) return false;
      this.set(col, row, id);
      return true;
    }

    // Dibuja solo los tiles visibles dentro del viewport de la cámara
    // (nunca el mundo entero) — clave para que un mundo grande no reviente
    // el rendimiento. Requiere el tileset ya cargado (Engine2D.getImage).
    draw(ctx, camera) {
      const img = getImage(this.tilesetSrc);
      if (!img) return;
      const ts = this.tileSize;
      const colStart = Math.max(0, Math.floor(camera.x / ts));
      const colEnd = Math.min(this.cols - 1, Math.ceil((camera.x + camera.width) / ts));
      const rowStart = Math.max(0, Math.floor(camera.y / ts));
      const rowEnd = Math.min(this.rows - 1, Math.ceil((camera.y + camera.height) / ts));

      for (let row = rowStart; row <= rowEnd; row++) {
        for (let col = colStart; col <= colEnd; col++) {
          const id = this.get(col, row);
          if (id === 0) continue; // aire, no dibuja nada
          const tileIndex = id - 1; // id 1 = primer tile del tileset
          const sx = (tileIndex % this.tilesetCols) * ts;
          const sy = Math.floor(tileIndex / this.tilesetCols) * ts;
          const dx = col * ts - camera.x;
          const dy = row * ts - camera.y;
          ctx.drawImage(img, sx, sy, ts, ts, Math.round(dx), Math.round(dy), ts, ts);
        }
      }
    }
  }

  // ─────────────────────────────────────
  // Camera — sigue a un objetivo y traduce mundo → pantalla
  // ─────────────────────────────────────
  // x,y = esquina superior-izquierda del viewport, en coordenadas de mundo.
  // width,height = tamaño del viewport (normalmente C.width / C.height).
  // worldWidth/worldHeight = límites del mundo, para no mostrar "fuera del
  // mapa" en los bordes (clamp automático).
  class Camera {
    constructor({ x = 0, y = 0, width, height, worldWidth = Infinity, worldHeight = Infinity }) {
      this.x = x; this.y = y;
      this.width = width; this.height = height;
      this.worldWidth = worldWidth; this.worldHeight = worldHeight;
      // Zoom (1 = normal, >1 = acercar). Se anima solo con zoomTo().
      this.zoom = 1;
      this._zoomTarget = 1;
      this._zoomSpeed = 0; // por ms — 0 = sin animación en curso
      // Shake (temblor). Se dispara con shake() y decae solo.
      this._shakeIntensity = 0;
      this._shakeElapsed = 0;
      this._shakeDuration = 0;
      this._shakeOffsetX = 0;
      this._shakeOffsetY = 0;
    }

    // Centra la cámara en (targetX, targetY) — normalmente el centro del
    // jugador — y la clampea para que no muestre fuera del mundo.
    follow(targetX, targetY) {
      this.x = targetX - this.width / 2;
      this.y = targetY - this.height / 2;
      const maxX = Math.max(0, this.worldWidth - this.width);
      const maxY = Math.max(0, this.worldHeight - this.height);
      this.x = Math.max(0, Math.min(this.x, maxX));
      this.y = Math.max(0, Math.min(this.y, maxY));
    }

    worldToScreen(x, y) { return { x: x - this.x, y: y - this.y }; }
    screenToWorld(x, y) { return { x: x + this.x, y: y + this.y }; }

    // Sacudida: un golpe de jefe, un impacto, un dash que conecta. Se
    // llama una vez al momento del golpe (ej. en rpg.js sería en el punto
    // donde hoy se activa `hitFlash`). La intensidad decae sola con el
    // tiempo, no hace falta apagarla a mano.
    // intensity: desplazamiento máximo en px. durationMs: cuánto dura.
    shake(intensity, durationMs) {
      this._shakeIntensity = intensity;
      this._shakeDuration = durationMs;
      this._shakeElapsed = 0;
    }

    // Zoom animado hacia `targetZoom` (1 = normal, 1.4 = 40% más cerca).
    // durationMs: cuánto tarda en llegar. Útil para el golpe final de un
    // jefe, o para "entrar" a una cinemática con un acercamiento lento.
    zoomTo(targetZoom, durationMs = 400) {
      this._zoomTarget = targetZoom;
      // velocidad constante en "unidades de zoom por ms" para llegar en durationMs
      const diff = targetZoom - this.zoom;
      this._zoomSpeed = durationMs > 0 ? diff / durationMs : diff;
    }

    // Llamar UNA VEZ por frame (con el dt del GameLoop) antes de dibujar —
    // hace avanzar el shake y el zoom. Sin esto, shake()/zoomTo() no hacen nada.
    update(dt) {
      // shake: decae linealmente de intensity a 0 a lo largo de duration
      if (this._shakeDuration > 0) {
        this._shakeElapsed += dt;
        if (this._shakeElapsed >= this._shakeDuration) {
          this._shakeDuration = 0;
          this._shakeOffsetX = 0; this._shakeOffsetY = 0;
        } else {
          const remaining = 1 - (this._shakeElapsed / this._shakeDuration);
          const mag = this._shakeIntensity * remaining;
          this._shakeOffsetX = (Math.random() * 2 - 1) * mag;
          this._shakeOffsetY = (Math.random() * 2 - 1) * mag;
        }
      }
      // zoom: avanza hacia el target a velocidad constante, sin pasarse
      if (this.zoom !== this._zoomTarget) {
        this.zoom += this._zoomSpeed * dt;
        const overshot = this._zoomSpeed > 0 ? this.zoom >= this._zoomTarget : this.zoom <= this._zoomTarget;
        if (overshot) this.zoom = this._zoomTarget;
      }
    }

    // Atajo para dibujar entidades (que ya asumen coordenadas de mundo)
    // sin que cada una tenga que restar camera.x/y a mano: envolvé el
    // dibujo de la escena entre begin()/end(). Aplica zoom (centrado en
    // el viewport) y el offset de shake, además del desplazamiento normal.
    begin(ctx) {
      ctx.save();
      if (this.zoom !== 1) {
        const cx = this.width / 2, cy = this.height / 2;
        ctx.translate(cx, cy);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-cx, -cy);
      }
      ctx.translate(
        -Math.round(this.x - this._shakeOffsetX),
        -Math.round(this.y - this._shakeOffsetY)
      );
    }
    end(ctx) { ctx.restore(); }
  }

  // ─────────────────────────────────────
  // Physics — gravedad + colisión AABB contra el TileMap
  // ─────────────────────────────────────
  // Convención: la entidad usa x,y como esquina superior-izquierda de su
  // caja de colisión (no "pies" como en drawFrame) — w,h su tamaño, y
  // vx,vy su velocidad en px/step. Es la convención estándar para física
  // de plataformas; si tu sprite se dibuja anclado en los pies, restale
  // el offset al dibujar (no acá).
  const Physics = {
    gravity: 0.6,       // px/step² — ajustar según qué tan "flotante" se sienta el salto
    maxFallSpeed: 12,    // px/step — terminal velocity, evita atravesar tiles finos a alta velocidad

    applyGravity(entity, step) {
      entity.vy = Math.min(entity.vy + this.gravity * step, this.maxFallSpeed);
    },

    // Mueve la entidad y resuelve colisión contra tilemap, eje por eje
    // (primero X, después Y) — separar los ejes evita que se "trabe" en
    // esquinas, que es el bug clásico de resolver todo junto.
    // Al terminar, entity.grounded queda en true si tocó piso este step
    // (usalo para permitir saltar solo si está parado).
    resolveTileCollisions(entity, tilemap) {
      const ts = tilemap.tileSize;

      // ── Eje X ──
      entity.x += entity.vx;
      this._forEachOverlappingSolid(entity, tilemap, (tileBox) => {
        if (entity.vx > 0) entity.x = tileBox.x - entity.w;
        else if (entity.vx < 0) entity.x = tileBox.x + tileBox.w;
        entity.vx = 0;
      });

      // ── Eje Y ──
      entity.y += entity.vy;
      entity.grounded = false;
      this._forEachOverlappingSolid(entity, tilemap, (tileBox) => {
        if (entity.vy > 0) { entity.y = tileBox.y - entity.h; entity.grounded = true; }
        else if (entity.vy < 0) { entity.y = tileBox.y + tileBox.h; }
        entity.vy = 0;
      });
    },

    // Recorre las celdas sólidas que se superponen con la caja actual de
    // la entidad y llama cb(tileBox) por cada una, re-chequeando la caja
    // después de cada corrección (para no dejar overlap residual).
    _forEachOverlappingSolid(entity, tilemap, cb) {
      const ts = tilemap.tileSize;
      let changed = true;
      let guard = 0; // corta si algo queda inconsistente, nunca debería llegar
      while (changed && guard < 8) {
        changed = false;
        guard++;
        const colStart = Math.floor(entity.x / ts);
        const colEnd = Math.floor((entity.x + entity.w - 0.01) / ts);
        const rowStart = Math.floor(entity.y / ts);
        const rowEnd = Math.floor((entity.y + entity.h - 0.01) / ts);
        for (let row = rowStart; row <= rowEnd && !changed; row++) {
          for (let col = colStart; col <= colEnd && !changed; col++) {
            if (!tilemap.isSolidAt(col, row)) continue;
            cb(tilemap.tileWorldBox(col, row));
            changed = true; // recalcula rango de celdas con la posición ya corregida
          }
        }
      }
    }
  };

  // ─────────────────────────────────────
  // TouchControls — joystick/botones DENTRO del canvas (no HTML aparte)
  // ─────────────────────────────────────
  // A diferencia de los controles de RPG Pixel/Pixel Runner (botones HTML
  // reales, afuera del canvas, con onpointerdown en el markup), esto dibuja
  // los controles como parte de la escena — para juegos donde el mundo
  // ocupa toda la pantalla y no hay lugar (o no queda bien) tener HTML
  // superpuesto. Van fijos en coordenadas del canvas (no de mundo — no se
  // mueven con la cámara).
  //
  // Uso:
  //   const touch = new Engine2D.TouchControls(canvas);
  //   touch.addJoystick({ id: 'move', x: 55, y: 210, radius: 32 });
  //   touch.addButton({ id: 'jump', x: 430, y: 210, radius: 22, label: '⬆' });
  //   touch.attach();
  //   // en el update: const dir = touch.state.move; // {x,y} entre -1 y 1
  //   //               if (touch.state.jump) { ... }
  //   // en el draw (después de dibujar el mundo, encima de todo):
  //   touch.draw(ctx);
  class TouchControls {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.zones = [];      // [{id,type,x,y,radius,label}]
      this.state = {};      // { move:{x,y}, jump:true/false, ... }
      this.visible = opts.visible !== false; // por si querés ocultarlos en desktop
      this._active = new Map(); // pointerId → zone
      this._onDown = this._onDown.bind(this);
      this._onMove = this._onMove.bind(this);
      this._onUp = this._onUp.bind(this);
    }

    addButton({ id, x, y, radius = 24, label = '' }) {
      this.zones.push({ id, type: 'button', x, y, radius, label });
      this.state[id] = false;
    }

    addJoystick({ id, x, y, radius = 32 }) {
      this.zones.push({ id, type: 'joystick', x, y, radius });
      this.state[id] = { x: 0, y: 0 };
    }

    attach() {
      this.detach();
      // pointer events en vez de touch events: cubre mouse+touch+pen igual,
      // y ya es lo que usa el resto del proyecto (onpointerdown en el HTML).
      this.canvas.addEventListener('pointerdown', this._onDown);
      this.canvas.addEventListener('pointermove', this._onMove);
      this.canvas.addEventListener('pointerup', this._onUp);
      this.canvas.addEventListener('pointercancel', this._onUp);
      this.canvas.addEventListener('pointerleave', this._onUp);
    }

    detach() {
      this.canvas.removeEventListener('pointerdown', this._onDown);
      this.canvas.removeEventListener('pointermove', this._onMove);
      this.canvas.removeEventListener('pointerup', this._onUp);
      this.canvas.removeEventListener('pointercancel', this._onUp);
      this.canvas.removeEventListener('pointerleave', this._onUp);
    }

    // El canvas se muestra escalado por CSS (ej. 480x270 interno, más
    // grande en pantalla) — hay que convertir la posición del evento a
    // coordenadas internas del canvas, si no el joystick queda desalineado
    // en cualquier pantalla que no sea exactamente la resolución interna.
    _canvasPos(e) {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    }

    _onDown(e) {
      if (!this.visible) return;
      const pos = this._canvasPos(e);
      for (const zone of this.zones) {
        if (this._active.has(zone.id)) continue; // ya usado por otro dedo
        const dx = pos.x - zone.x, dy = pos.y - zone.y;
        // Radio de toque más grande que el dibujado (más fácil de acertar en celular)
        if (dx * dx + dy * dy <= (zone.radius * 1.6) ** 2) {
          e.preventDefault();
          this._active.set(zone.id, { pointerId: e.pointerId, zone });
          this._updateZone(zone, pos);
          break; // un dedo activa una sola zona
        }
      }
    }

    _onMove(e) {
      for (const [id, entry] of this._active) {
        if (entry.pointerId !== e.pointerId) continue;
        e.preventDefault();
        this._updateZone(entry.zone, this._canvasPos(e));
      }
    }

    _onUp(e) {
      for (const [id, entry] of this._active) {
        if (entry.pointerId !== e.pointerId) continue;
        this._resetZone(entry.zone);
        this._active.delete(id);
      }
    }

    _updateZone(zone, pos) {
      if (zone.type === 'button') {
        this.state[zone.id] = true;
      } else if (zone.type === 'joystick') {
        let dx = pos.x - zone.x, dy = pos.y - zone.y;
        const dist = Math.hypot(dx, dy);
        if (dist > zone.radius) { dx = (dx / dist) * zone.radius; dy = (dy / dist) * zone.radius; }
        this.state[zone.id] = { x: dx / zone.radius, y: dy / zone.radius }; // normalizado -1..1
        zone._stickX = dx; zone._stickY = dy; // para dibujar
      }
    }

    _resetZone(zone) {
      if (zone.type === 'button') this.state[zone.id] = false;
      else { this.state[zone.id] = { x: 0, y: 0 }; zone._stickX = 0; zone._stickY = 0; }
    }

    // Dibujar SIEMPRE al final, después del mundo/entidades, para que
    // quede como overlay encima de todo.
    draw(ctx) {
      if (!this.visible) return;
      ctx.save();
      this.zones.forEach(zone => {
        const active = this._isZoneActive(zone);
        if (zone.type === 'button') {
          ctx.beginPath();
          ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
          ctx.fillStyle = active ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.stroke();
          if (zone.label) {
            ctx.fillStyle = '#fff';
            ctx.font = `${Math.round(zone.radius)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(zone.label, zone.x, zone.y);
          }
        } else {
          // Base fija del joystick
          ctx.beginPath();
          ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.stroke();
          // Stick — se mueve dentro de la base según el dedo
          const sx = zone.x + (zone._stickX || 0);
          const sy = zone.y + (zone._stickY || 0);
          ctx.beginPath();
          ctx.arc(sx, sy, zone.radius * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = active ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)';
          ctx.fill();
        }
      });
      ctx.restore();
    }

    _isZoneActive(zone) {
      for (const entry of this._active.values()) if (entry.zone === zone) return true;
      return false;
    }
  }

  // ─────────────────────────────────────
  // Fullscreen — helper chico sobre la Fullscreen API del navegador
  // ─────────────────────────────────────
  // Pedile fullscreen al contenedor del juego (ej. .rpg-container), no al
  // canvas solo — así el HUD/overlay que están afuera del canvas pero
  // adentro del contenedor siguen viéndose.
  const Fullscreen = {
    isSupported() {
      return !!(document.fullscreenEnabled ||
        document.webkitFullscreenEnabled ||
        document.msFullscreenEnabled);
    },
    isActive() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    },
    // Si ya está en fullscreen, sale; si no, entra en `el`.
    toggle(el) {
      if (this.isActive()) {
        (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)
          .call(document);
      } else {
        (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)
          .call(el);
      }
    },
    // cb() se llama cada vez que se entra o sale de fullscreen (por ejemplo
    // para cambiar el ícono del botón, o para recalcular tamaño del canvas).
    onChange(cb) {
      document.addEventListener('fullscreenchange', cb);
      document.addEventListener('webkitfullscreenchange', cb);
      document.addEventListener('MSFullscreenChange', cb);
    }
  };

  // ─────────────────────────────────────
  // DialogueBox — cinemática con retrato + texto (estilo Deltarune/Undertale)
  // ─────────────────────────────────────
  // Rectángulo fijo (en coordenadas de canvas, no de mundo) con un
  // retrato del personaje a la izquierda/arriba y texto a la derecha que
  // aparece letra por letra. Se avanza a mano llamando advance() — el
  // motor no decide con qué tecla/botón se avanza, eso lo cablea cada
  // juego (igual que ya hace con el resto del input).
  //
  // Uso:
  //   const box = new Engine2D.DialogueBox({ x: 20, y: 190, width: 440, height: 70 });
  //   box.say([
  //     { speaker: 'Junior', portraitSrc: 'assert/rpg pixel/models/junior/cara.png', text: 'Esto es peligroso...' },
  //     { speaker: 'Junior', portraitSrc: 'assert/rpg pixel/models/junior/cara.png', text: 'Pero tengo que seguir.' }
  //   ]);
  //   // en el update: box.update(dt);
  //   // en el draw, AL FINAL (encima de todo): if (box.active) box.draw(ctx);
  //   // en el input (tecla/click/botón táctil): box.advance();
  class DialogueBox {
    constructor({ x, y, width, height, portraitSize = 56, charsPerSecond = 40, font = '12px sans-serif', padding = 10 }) {
      this.x = x; this.y = y; this.width = width; this.height = height;
      this.portraitSize = portraitSize;
      this.charsPerSecond = charsPerSecond;
      this.font = font;
      this.padding = padding;

      this.queue = [];       // líneas pendientes, cada una {text, speaker, portraitSrc}
      this.current = null;   // línea que se está mostrando ahora
      this.visibleChars = 0; // cuántos caracteres del texto ya se revelaron (typewriter)
      this.active = false;   // false = la cinemática terminó / no empezó

      this._wrapped = null;      // líneas de `text` ya cortadas al ancho de la caja
      this._totalChars = 0;      // suma de caracteres de _wrapped (para saber cuándo terminó de tipear)
    }

    // Arranca (o reemplaza) la cola de diálogo. `lines` puede ser un solo
    // objeto {text, speaker, portraitSrc} o un array de varios, para una
    // cinemática con más de una línea seguida.
    say(lines) {
      this.queue = Array.isArray(lines) ? lines.slice() : [lines];
      this.active = true;
      this._nextLine();
    }

    _nextLine() {
      this.current = this.queue.shift() || null;
      this.visibleChars = 0;
      this._wrapped = null; // se recalcula en el próximo draw() (necesita ctx para medir texto)
      if (!this.current) this.active = false;
    }

    // Si la línea actual todavía se está tipeando, la completa de una
    // (para cuando el jugador toca "avanzar" impaciente). Si ya terminó
    // de tipearse, pasa a la siguiente línea de la cola.
    advance() {
      if (!this.active || !this.current) return;
      if (this.visibleChars < this._totalChars) {
        this.visibleChars = this._totalChars; // mostrar todo el texto ya
        return;
      }
      this._nextLine();
    }

    isTyping() {
      return this.active && this.current && this.visibleChars < this._totalChars;
    }

    update(dt) {
      if (!this.active || !this.current) return;
      if (this.visibleChars < this._totalChars) {
        this.visibleChars = Math.min(this._totalChars, this.visibleChars + (this.charsPerSecond * dt) / 1000);
      }
    }

    // Corta `text` en líneas que entren en el ancho disponible (el ancho
    // de la caja menos el retrato y el padding) — se calcula una sola vez
    // por línea de diálogo y se cachea, no en cada frame.
    _wrapText(ctx, text, maxWidth) {
      ctx.font = this.font;
      const words = text.split(' ');
      const lines = [];
      let line = '';
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      return lines;
    }

    draw(ctx) {
      if (!this.active || !this.current) return;
      const { x, y, width, height, padding, portraitSize } = this;

      // Caja de fondo
      ctx.save();
      ctx.fillStyle = 'rgba(10,10,15,0.88)';
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);

      // Retrato — arriba a la izquierda adentro de la caja, como el
      // recuadro de cara en Deltarune. Si no hay portraitSrc o todavía no
      // cargó la imagen, se deja el espacio vacío (no rompe el layout).
      const textX = x + padding + (this.current.portraitSrc ? portraitSize + padding : 0);
      if (this.current.portraitSrc) {
        const img = getImage(this.current.portraitSrc);
        if (img && img.complete) {
          ctx.drawImage(img, x + padding, y + padding, portraitSize, portraitSize);
        }
      }

      // Nombre del que habla, arriba del texto
      let textY = y + padding;
      if (this.current.speaker) {
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold ' + this.font;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(this.current.speaker, textX, textY);
        textY += 16;
      }

      // Texto — se envuelve una sola vez (cacheado) y se revela letra por
      // letra según visibleChars.
      const maxTextWidth = x + width - padding - textX;
      if (!this._wrapped) {
        this._wrapped = this._wrapText(ctx, this.current.text, maxTextWidth);
        this._totalChars = this._wrapped.reduce((n, l) => n + l.length, 0);
      }
      ctx.fillStyle = '#fff';
      ctx.font = this.font;
      let remaining = Math.floor(this.visibleChars);
      for (const line of this._wrapped) {
        if (remaining <= 0) break;
        const shown = remaining >= line.length ? line : line.slice(0, remaining);
        ctx.fillText(shown, textX, textY);
        remaining -= line.length;
        textY += 16;
      }

      // Indicador de "seguir" — parpadea solo cuando ya terminó de tipear,
      // así el jugador sabe que puede avanzar (y no que está trabado).
      if (!this.isTyping()) {
        const blink = Math.sin(performance.now() / 250) > 0;
        if (blink) {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(x + width - 16, y + height - 14);
          ctx.lineTo(x + width - 8, y + height - 14);
          ctx.lineTo(x + width - 12, y + height - 8);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  return {
    // assets
    loadImage, loadAtlas, loadAll, getImage, getAtlas,
    // utils
    randRange, floorBounds,
    // dibujo
    drawFrame, drawAtlasFrame, drawIconRect, drawCover,
    // loop / input / entidades
    GameLoop, KeyboardInput, Entity, Scene,
    // mundo tipo Terraria: tiles, cámara y física
    TileMap, Camera, Physics,
    // controles táctiles dentro del canvas + pantalla completa
    TouchControls, Fullscreen,
    // cinemáticas con retrato + texto
    DialogueBox
  };
})();
