// ══════════════════════════════════════
//   RPG Pixel — rpg.js
// ══════════════════════════════════════
//
// Minijuego de arenas fijas: Junior (jugador) se mueve dentro de una
// escena fija (assert/rpg pixel/models/nivelX/zoneX.*) y se enfrenta a
// un enemigo por nivel. Usa el objeto global SPRITES (definido en
// assert/rpg pixel/models/sprites.js) para recortar cada frame del
// spritesheet con drawImage.
//
// Convención elegida para las filas de SPRITES.junior (documentada acá
// porque no viene indicada en sprites.js — si al ver el juego corriendo
// alguna fila queda mal asignada, se cambia únicamente este objeto):
//   fila 0 = mirando hacia abajo (frente)
//   fila 1 = mirando hacia arriba (espalda)
//   fila 2 = mirando hacia la izquierda
//   fila 3 = mirando hacia la derecha
const RPG_FACING_ROW = { down: 0, up: 1, left: 2, right: 3 };

const RPG_ASSET_BASE = 'assert/rpg pixel/';

// ─── Zona jugable ─────
// El piso es la mitad inferior del canvas; la mitad de arriba es "cielo"
// (fondo/decorado) y no se puede pisar. Se usa tanto para Junior como
// para el jefe (para que ninguno "vuele").
const RPG_FLOOR_TOP_RATIO = 0.5;     // % del alto donde empieza el piso
const RPG_FLOOR_BOTTOM_MARGIN = 0.06; // margen inferior (paredes/piso)

// ─── Junior: tamaño y velocidad ─────
const RPG_PLAYER_DRAW_H = 42;   // antes 56 — más chico, así no "flota" al pisar el borde superior de la zona
const RPG_PLAYER_SPEED = 2.3;   // antes 1.6 — más rápido
const RPG_PLAYER_HITBOX = { w: 27, h: 38, yOff: -17 }; // escalado junto con RPG_PLAYER_DRAW_H
const RPG_PLAYER_MUZZLE_Y_OFF = -17;

// ─── Íconos reutilizados desde objeto.png (balas / pociones / proyectiles) ─────
// Coordenadas recortadas a mano sobre el spritesheet models/objeto.png.
const RPG_ITEM_SHEET = RPG_ASSET_BASE + 'models/objeto.png';
const RPG_ITEM_ICONS = {
  bullet:      { x: 78,  y: 29,  w: 55,  h: 130 }, // bala dorada (disparo de Junior)
  potionHp:    { x: 39,  y: 348, w: 102, h: 155 }, // poción roja (cura)
  potionSpeed: { x: 39,  y: 558, w: 102, h: 147 }, // poción naranja (velocidad)
  projSmall:   { x: 72,  y: 231, w: 98,  h: 105 }, // orbe azul chico — fallback si un nivel no tiene bossProjectileSheet propio
  projBig:     { x: 258, y: 204, w: 223, h: 136 }  // orbe azul grande — ídem
};

// Config por nivel. Para sumar el "jefe secreto" el día que tenga sprite:
// agregar la entrada acá (RPG_LEVELS[4] = {...}) y un botón en el menú
// (index.html, #rpgLevelButtons) — el resto del código ya es genérico.
const RPG_LEVELS = {
  1: {
    name: 'Nivel 1 · Patio del Castillo',
    zoneImage: RPG_ASSET_BASE + 'models/nivel1/zone1.jfif',
    // Dark Knight: sheet con poses nombradas (idle_front/back/left/right,
    // dash_left/right, attack1/attack2), NO un ciclo de caminata numérico.
    // Por eso usa su propio atlas (enemyAtlas) en vez de SPRITES[enemyKey].
    enemySheet: RPG_ASSET_BASE + 'models/nivel1/dark_knight.png',
    enemyAtlas: RPG_ASSET_BASE + 'models/nivel1/dark_knight.json',
    enemyKey: 'dark_knight',
    enemyName: 'Dark Knight',
    music: RPG_ASSET_BASE + 'sound/dark_knight_boss.mp3',
    enemyMaxHp: 300,
    enemySpeed: 0.95, // velocidad vertical con la que sigue a Junior

    // ── Patrón "sides": el jefe vive pegado a los costados del mapa,
    // mirando al centro. Se mueve arriba/abajo para alinearse con Junior
    // y dispara proyectiles horizontales; cada tanto hace un dash recto
    // de lado a lado (así cambia de costado). Tiene 3 fases según su HP.
    attackPattern: 'sides',
    sideMarginRatio: 0.14,

    dashDamage: 15,          // daño del dash (100% bloqueable)
    dashTelegraphMs: 550,    // aviso antes de largar el dash
    dashSpeedPhase1: 6,      // fase 1: dash más lento
    dashSpeedPhase2: 9,      // fase 2 y 3: dash más rápido
    dashCooldownMs: [2200, 3200],

    projectileSmallDmg: 5,
    projectileSmallSpeed: 3.1,
    projectileBigDmg: 10,
    projectileBigSpeed: 2.2,
    fireCooldownPhase1: [1100, 1700], // fase 1: solo proyectil chico
    fireCooldownPhase2: [850, 1300],  // fase 2: mezcla chico/grande
    fireCooldownPhase3: [650, 1000],  // fase 3: solo proyectil grande

    // Sprite propio del ataque del jefe (antes usaba por error los íconos
    // de objeto.png, que son las balas de Junior). Tiene 2 variantes
    // (large/small) con 2 frames cada una para una animación simple.
    bossProjectileSheet: RPG_ASSET_BASE + 'models/nivel1/dark_slash.png',
    bossProjectileAtlas: RPG_ASSET_BASE + 'models/nivel1/dark_slash.json',

    playerBulletDamage: 5, // daño del disparo de Junior contra este jefe

    // El combate dura lo que dura el tema del jefe: si no lo matás antes
    // de que la música termine (o vuelva a arrancar), perdés.
    timeLimitMs: 'music',

    potionHpAmount: 25,
    potionSpeedMult: 1.6,
    potionSpeedDurationMs: 5000,
    potionSpawnIntervalMs: [5000, 8500]
  },
  2: {
    name: 'Nivel 2 · Cripta Encantada',
    zoneImage: RPG_ASSET_BASE + 'models/nivel2/zone2.jfif',
    enemySheet: RPG_ASSET_BASE + 'models/nivel2/ghost.png',
    enemyKey: 'ghost',
    enemyName: 'Fantasma',
    music: RPG_ASSET_BASE + 'sound/terror_boss.mp3',
    enemyMaxHp: 90,
    enemySpeed: 0.8,
    contactDamage: 10,
    potionHpAmount: 25,
    potionSpeedMult: 1.6,
    potionSpeedDurationMs: 5000,
    potionSpawnIntervalMs: [5000, 8500]
  },
  3: {
    name: 'Nivel 3 · Trono del Vampiro',
    zoneImage: RPG_ASSET_BASE + 'models/nivel3/zone3.jpg',
    enemySheet: RPG_ASSET_BASE + 'models/nivel3/vampire_king.png',
    enemyKey: 'vampire_king',
    enemyName: 'Rey Vampiro',
    music: RPG_ASSET_BASE + 'sound/vampire_boss.mp3',
    enemyMaxHp: 140,
    enemySpeed: 1.0,
    contactDamage: 14,
    potionHpAmount: 25,
    potionSpeedMult: 1.6,
    potionSpeedDurationMs: 5000,
    potionSpawnIntervalMs: [5000, 8500]
  }
};

const RPG = {
  canvas: null,
  ctx: null,
  running: false,
  raf: null,
  level: 1,
  keys: { up: false, down: false, left: false, right: false },
  facing: 'down', // última dirección caminada; define hacia dónde se dispara
  player: {
    x: 0, y: 0,
    hp: 100, maxHp: 100,
    speed: RPG_PLAYER_SPEED,
    animFrame: 0, animTick: 0,
    moving: false,
    blocking: false,
    blockCooldown: 0, // ms restantes hasta poder volver a bloquear (tras absorber un golpe)
    blockAnimFrame: 0, blockAnimTick: 0,
    fireCooldown: 0,
    hitFlash: 0,
    speedBoostTimer: 0
  },
  enemy: {
    x: 0, y: 0,
    hp: 60, maxHp: 60,
    speed: 0.6,
    animFrame: 0, animTick: 0,
    contactCooldown: 0,
    hitFlash: 0,
    alive: true,
    side: 'left',
    phase: 1,
    // Estado del patrón de ataque especial (charge / sides).
    attack: { state: 'idle', timer: 1500, vx: 0, vy: 0, hit: false }
  },
  bullets: [],           // disparos de Junior
  enemyProjectiles: [],  // proyectiles del jefe (patrón "sides")
  potions: [],           // pociones en el suelo
  potionSpawnTimer: 0,
  combatElapsed: 0,
  timeLimitMs: null,
  images: {}, // cache de HTMLImageElement por src
  atlases: {}, // cache de atlas JSON (dark_knight.json) por src
  keyHandlerDown: null,
  keyHandlerUp: null
};

// ─── Utilidades ─────
function rpgRandRange(range) {
  if (!range) return 0;
  return range[0] + Math.random() * (range[1] - range[0]);
}

function rpgFloorBounds(C) {
  return {
    top: C.height * RPG_FLOOR_TOP_RATIO,
    bottom: C.height * (1 - RPG_FLOOR_BOTTOM_MARGIN)
  };
}

// ─── Carga de imágenes (con cache) ─────
function rpgLoadImage(src) {
  if (RPG.images[src] && RPG.images[src].complete) {
    return Promise.resolve(RPG.images[src]);
  }
  return new Promise((resolve, reject) => {
    const img = RPG.images[src] || new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    RPG.images[src] = img;
    if (!img.src) img.src = src;
  });
}

// ─── Carga de atlas JSON (con cache) ─────
function rpgLoadAtlas(src) {
  if (RPG.atlases[src]) return Promise.resolve(RPG.atlases[src]);
  return fetch(src)
    .then(r => r.json())
    .then(data => { RPG.atlases[src] = data; return data; });
}

// ─── Entrada a la sección (llamado desde goTo en app.js) ─────
function rpgInit() {
  RPG.canvas = document.getElementById('rpgCanvas');
  RPG.ctx = RPG.canvas.getContext('2d');
  rpgStopLoop();
  rpgShowMenu();
}

function rpgShowMenu() {
  rpgStopLoop();
  document.getElementById('rpgMenu').classList.remove('hidden');
  document.getElementById('rpgHud').classList.add('hidden');
  document.getElementById('rpgOverlay').classList.add('hidden');
  if (typeof setMusic === 'function') setMusic(RPG_ASSET_BASE + 'menu_song.mp3');
}

function rpgExitToHub() {
  rpgStopLoop();
  goTo('juegos');
}

// ─── Posiciones de costado (para el patrón "sides") ─────
function rpgSideX(side, cfg, C) {
  const m = C.width * cfg.sideMarginRatio;
  return side === 'left' ? m : C.width - m;
}

// ─── Arrancar un nivel ─────
function rpgStartLevel(levelIndex) {
  const cfg = RPG_LEVELS[levelIndex];
  if (!cfg) return;
  RPG.level = levelIndex;

  document.getElementById('rpgMenu').classList.add('hidden');
  document.getElementById('rpgHud').classList.remove('hidden');

  rpgSetOverlay(
    cfg.name,
    'Cargando…',
    '<button class="btn-play" id="rpgOverlayMainBtn" disabled>Cargando…</button>'
  );
  document.getElementById('rpgOverlay').classList.remove('hidden');

  const timeEl = document.getElementById('rpgTimeLeft');
  if (timeEl) { timeEl.textContent = ''; timeEl.classList.remove('rpg-timer-warn'); }

  requestAnimationFrame(() => {
    const C = RPG.canvas;
    // Resolución interna fija (mismo criterio que Pixel Runner / Castle
    // Escape) para que el contenedor no estire la imagen.
    C.width = 480;
    C.height = 270;

    // Reset de estado
    RPG.bullets = [];
    RPG.enemyProjectiles = [];
    RPG.potions = [];
    RPG.potionSpawnTimer = rpgRandRange(cfg.potionSpawnIntervalMs || [5000, 8500]);
    RPG.combatElapsed = 0;
    RPG.timeLimitMs = null;
    RPG.facing = 'down';
    RPG.keys = { up: false, down: false, left: false, right: false };
    RPG.player.x = C.width * 0.28;
    RPG.player.y = C.height * 0.78;
    RPG.player.hp = RPG.player.maxHp = 100;
    RPG.player.speed = RPG_PLAYER_SPEED;
    RPG.player.blocking = false;
    RPG.player.blockCooldown = 0;
    RPG.player.fireCooldown = 0;
    RPG.player.hitFlash = 0;
    RPG.player.speedBoostTimer = 0;
    RPG.enemy.hp = RPG.enemy.maxHp = cfg.enemyMaxHp;
    RPG.enemy.speed = cfg.enemySpeed;
    RPG.enemy.contactCooldown = 0;
    RPG.enemy.hitFlash = 0;
    RPG.enemy.alive = true;
    RPG.enemy.phase = 1;

    if (cfg.attackPattern === 'sides') {
      RPG.enemy.side = 'right';
      RPG.enemy.x = rpgSideX('right', cfg, C);
      RPG.enemy.y = C.height * 0.72;
      RPG.enemy.attack = {
        state: 'tracking',
        timer: 0,
        vx: 0, vy: 0, hit: false,
        fireTimer: rpgRandRange(cfg.fireCooldownPhase1),
        dashTimer: rpgRandRange(cfg.dashCooldownMs)
      };
    } else {
      RPG.enemy.x = C.width * 0.74;
      RPG.enemy.y = C.height * 0.55;
      RPG.enemy.attack = { state: 'idle', timer: 1200, vx: 0, vy: 0, hit: false };
    }

    rpgUpdateHudBars();
    document.getElementById('rpgEnemyName').textContent = cfg.enemyName;

    setupRpgEvents();

    const loaders = [
      rpgLoadImage(cfg.zoneImage),
      rpgLoadImage(cfg.enemySheet),
      rpgLoadImage(RPG_ASSET_BASE + 'models/junior/junior.png'),
      rpgLoadImage(RPG_ASSET_BASE + 'models/junior/bloquear.png'),
      rpgLoadImage(RPG_ITEM_SHEET)
    ];
    // Assets con atlas nombrado (por ahora solo el Dark Knight de nivel 1)
    if (cfg.enemyAtlas) loaders.push(rpgLoadAtlas(cfg.enemyAtlas));
    // Sprite del ataque a distancia del jefe (dark_slash, nivel 1 por ahora)
    if (cfg.bossProjectileSheet) loaders.push(rpgLoadImage(cfg.bossProjectileSheet));
    if (cfg.bossProjectileAtlas) loaders.push(rpgLoadAtlas(cfg.bossProjectileAtlas));

    Promise.all(loaders).then(() => {
      // forceRestart=true: si es el mismo nivel que se acaba de perder,
      // la música tiene que arrancar desde 0, no seguir donde iba.
      if (typeof setMusic === 'function') setMusic(cfg.music, true);
      rpgSetOverlay(
        cfg.name,
        'Flechas / WASD para moverte · Espacio o 🔫 para disparar en la dirección que caminaste · Shift o 🛡️ para bloquear',
        '<button class="btn-play" id="rpgOverlayMainBtn" onclick="rpgBeginCombat()">▶ Empezar</button>'
      );
      rpgDraw(); // primer frame estático mientras se ve el overlay
    }).catch(() => {
      rpgSetOverlay(cfg.name, 'No se pudieron cargar los recursos del nivel.', '<button class="btn-play" onclick="rpgShowMenu()">← Volver</button>');
    });
  });
}

function rpgBeginCombat() {
  document.getElementById('rpgOverlay').classList.add('hidden');
  // OJO: rpgStopLoop() pone RPG.running en false y cancela el raf pendiente.
  // Hay que llamarlo ANTES de activar running = true (si se llama después,
  // apaga el juego que recién se había prendido y el loop nunca vuelve a
  // correr — por eso nada se movía).
  rpgStopLoop();

  const cfg = RPG_LEVELS[RPG.level];
  RPG.combatElapsed = 0;
  RPG.timeLimitMs = cfg.timeLimitMs === 'music'
    ? rpgGetTrackDurationMs(133500)
    : (cfg.timeLimitMs || null);

  RPG.running = true;
  RPG.raf = requestAnimationFrame(rpgLoop);
}

// Duración del tema actual (bgMusic vive en app.js, cargado después de
// este archivo — por eso se referencia en tiempo de ejecución, no acá
// arriba). Si todavía no cargó metadata, se usa el fallback.
function rpgGetTrackDurationMs(fallbackMs) {
  if (typeof bgMusic !== 'undefined' && bgMusic && isFinite(bgMusic.duration) && bgMusic.duration > 0) {
    return bgMusic.duration * 1000;
  }
  return fallbackMs;
}

function rpgStopLoop() {
  RPG.running = false;
  if (RPG.raf) { cancelAnimationFrame(RPG.raf); RPG.raf = null; }
}

// ─── Overlay genérico (empezar / pausa / victoria / derrota) ─────
function rpgSetOverlay(title, sub, buttonsHtml) {
  document.getElementById('rpgOverlayTitle').textContent = title;
  document.getElementById('rpgOverlaySub').textContent = sub;
  document.getElementById('rpgOverlayButtons').innerHTML = buttonsHtml;
}

// ─── Pausa ─────
function rpgPauseGame() {
  if (!RPG.running) return;
  rpgStopLoop();
  rpgSetOverlay(
    '⏸ Pausa',
    '',
    '<button class="btn-play" onclick="rpgResumeGame()">▶ Continuar</button>' +
    '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgShowMenu()">✖ Salir al menú</button>'
  );
  document.getElementById('rpgOverlay').classList.remove('hidden');
}

function rpgResumeGame() {
  document.getElementById('rpgOverlay').classList.add('hidden');
  RPG.running = true;
  RPG.raf = requestAnimationFrame(rpgLoop);
}

// ─── Entradas: teclado ─────
function setupRpgEvents() {
  if (RPG.keyHandlerDown) document.removeEventListener('keydown', RPG.keyHandlerDown);
  if (RPG.keyHandlerUp)   document.removeEventListener('keyup', RPG.keyHandlerUp);

  RPG.keyHandlerDown = function(e) {
    if (!document.getElementById('sec-rpg_pixel').classList.contains('active')) return;

    if (e.code === 'ArrowUp' || e.code === 'KeyW')    RPG.keys.up = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS')  RPG.keys.down = true;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA')  RPG.keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') RPG.keys.right = true;
    rpgUpdateFacing();
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'Space') rpgFire();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') rpgBlock(true);
  };
  RPG.keyHandlerUp = function(e) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW')    RPG.keys.up = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS')  RPG.keys.down = false;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA')  RPG.keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') RPG.keys.right = false;
    rpgUpdateFacing();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') rpgBlock(false);
  };
  document.addEventListener('keydown', RPG.keyHandlerDown);
  document.addEventListener('keyup', RPG.keyHandlerUp);
}

// Recalcula RPG.facing según qué teclas de movimiento siguen apretadas en
// este instante (se llama en keydown Y en keyup — antes solo se pisaba el
// facing con la última tecla presionada y nunca se recalculaba al soltar,
// por eso quedaba "pegado" mirando arriba/abajo). Izquierda/derecha pisan
// a arriba/abajo cuando se combinan (ej: mantener Arriba y tocar Izquierda
// muestra el sprite de izquierda, no el de arriba). Si no queda ninguna
// tecla de movimiento apretada, se mantiene la última dirección mostrada.
function rpgUpdateFacing() {
  if (RPG.keys.left) { RPG.facing = 'left'; return; }
  if (RPG.keys.right) { RPG.facing = 'right'; return; }
  if (RPG.keys.up) { RPG.facing = 'up'; return; }
  if (RPG.keys.down) { RPG.facing = 'down'; return; }
}

// ─── Entradas: controles táctiles (llamados desde index.html) ─────
function rpgMove(dir, on) {
  RPG.keys[dir] = on;
  rpgUpdateFacing();
}

function rpgBlock(on) {
  const p = RPG.player;
  // Mientras el bloqueo está en cooldown (después de absorber un golpe)
  // no se puede volver a activar, aunque se mantenga apretado el botón.
  if (on && p.blockCooldown > 0) return;
  p.blocking = on;
}

function rpgFire() {
  if (!RPG.running) return;
  if (RPG.player.fireCooldown > 0) return;
  if (RPG.player.blocking) return; // no se dispara mientras se bloquea

  const dir = RPG_DIR_VECTOR[RPG.facing];
  const speed = 4.6;
  RPG.bullets.push({
    x: RPG.player.x,
    y: RPG.player.y + RPG_PLAYER_MUZZLE_Y_OFF, // sale a la altura del arma, no de los pies
    vx: dir.x * speed,
    vy: dir.y * speed,
    w: 6, h: 6
  });
  RPG.player.fireCooldown = 260; // ms entre disparos
}

const RPG_DIR_VECTOR = {
  up:    { x: 0, y: -1 },
  down:  { x: 0, y: 1 },
  left:  { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

// ─── Update ─────
let rpgLastTs = 0;
function rpgLoop(ts) {
  if (!RPG.running) return;
  const dt = rpgLastTs ? Math.min(ts - rpgLastTs, 50) : 16;
  rpgLastTs = ts;
  rpgUpdate(dt);
  rpgDraw();
  RPG.raf = requestAnimationFrame(rpgLoop);
}

function rpgUpdate(dt) {
  const C = RPG.canvas;
  const cfg = RPG_LEVELS[RPG.level];
  const p = RPG.player;
  const step = dt / 16.6; // normaliza a "frames" de 60fps para no depender del refresh rate

  // ── Reloj del combate (si el nivel tiene límite de tiempo) ──
  if (RPG.timeLimitMs != null && RPG.enemy.alive) {
    RPG.combatElapsed += dt;
    rpgUpdateHudTimer();
    if (RPG.combatElapsed >= RPG.timeLimitMs) {
      rpgGameOver(
        '⏱ Se acabó el tiempo',
        RPG_LEVELS[RPG.level].enemyName + ' resistió hasta el final de la canción.'
      );
      return;
    }
  }

  // ── Movimiento del jugador ──
  if (p.speedBoostTimer > 0) p.speedBoostTimer -= dt;
  const speedMult = p.speedBoostTimer > 0 ? (cfg.potionSpeedMult || 1.6) : 1;

  let dx = 0, dy = 0;
  if (RPG.keys.up) dy -= 1;
  if (RPG.keys.down) dy += 1;
  if (RPG.keys.left) dx -= 1;
  if (RPG.keys.right) dx += 1;
  p.moving = (dx !== 0 || dy !== 0) && !p.blocking;

  if (p.moving) {
    const len = Math.hypot(dx, dy) || 1;
    const spd = p.blocking ? 0 : p.speed * speedMult * step;
    p.x += (dx / len) * spd;
    p.y += (dy / len) * spd;

    // Límites de la arena: solo se puede pisar la mitad de abajo (piso);
    // la mitad de arriba es cielo/fondo y queda fuera de la zona jugable.
    const marginX = C.width * 0.08;
    const floor = rpgFloorBounds(C);
    p.x = Math.max(marginX, Math.min(C.width - marginX, p.x));
    p.y = Math.max(floor.top, Math.min(floor.bottom, p.y));

    p.animTick += step;
    if (p.animTick >= 7) { p.animTick = 0; p.animFrame = (p.animFrame + 1) % 3; }
  } else {
    p.animFrame = 0;
    p.animTick = 0;
  }

  if (!p.blocking) {
    p.blockAnimFrame = 0;
    p.blockAnimTick = 0;
  }

  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (p.blockCooldown > 0) p.blockCooldown -= dt;
  if (p.hitFlash > 0) p.hitFlash -= dt;

  // ── Balas de Junior ──
  for (let i = RPG.bullets.length - 1; i >= 0; i--) {
    const b = RPG.bullets[i];
    b.x += b.vx * step;
    b.y += b.vy * step;
    if (b.x < -20 || b.x > C.width + 20 || b.y < -20 || b.y > C.height + 20) {
      RPG.bullets.splice(i, 1);
      continue;
    }
    if (RPG.enemy.alive && rpgOverlap(b.x, b.y, b.w, b.h, RPG.enemy.x, RPG.enemy.y - 40, 60, 80)) {
      RPG.bullets.splice(i, 1);
      rpgEnemyHit(cfg.playerBulletDamage || 12);
    }
  }

  // ── Proyectiles del jefe ──
  rpgUpdateEnemyProjectiles(dt, step);

  // ── Pociones ──
  rpgUpdatePotions(dt, step);

  // ── Enemigo ──
  const e = RPG.enemy;
  if (e.alive && cfg.attackPattern === 'sides') {
    rpgUpdateSidesBoss(e, p, cfg, C, dt, step);
  } else if (e.alive) {
    rpgUpdateSimpleChase(e, p, cfg, dt, step);
  }
}

// Comportamiento base (nivel 2 y 3): perseguir al jugador y golpear por
// contacto con cooldown. También respeta la zona de piso.
function rpgUpdateSimpleChase(e, p, cfg, dt, step) {
  const distX = p.x - e.x;
  const distY = p.y - e.y;
  const dist = Math.hypot(distX, distY);
  const stopDistance = 42;

  if (dist > stopDistance) {
    e.x += (distX / dist) * e.speed * step;
    e.y += (distY / dist) * e.speed * step;
    e.animTick += step;
    if (e.animTick >= 8) { e.animTick = 0; e.animFrame = (e.animFrame + 1) % 4; }
  } else {
    e.animFrame = 0;
    e.animTick = 0;
  }

  if (e.contactCooldown > 0) e.contactCooldown -= dt;
  if (dist <= stopDistance + 10 && e.contactCooldown <= 0) {
    rpgPlayerHit(cfg.contactDamage);
    e.contactCooldown = 900;
  }
  if (e.hitFlash > 0) e.hitFlash -= dt;
}

// ─── Patrón "sides" (Dark Knight, nivel 1) ─────
// El jefe vive en los costados del mapa mirando al centro. Se mueve
// verticalmente para alinearse con Junior (así apunta al disparar) y
// cada tanto hace un dash recto hacia el otro costado (100% bloqueable,
// y es también su forma de cambiar de lado). Tiene 3 fases según su HP:
//   fase 1 (>50% HP): solo proyectiles chicos, dash lento
//   fase 2 (<=50% HP): proyectiles chicos y grandes, dash rápido
//   fase 3 (<=25% HP): solo proyectiles grandes, dash rápido, sin pociones
function rpgGetSidesPhase(e) {
  const ratio = e.hp / e.maxHp;
  if (ratio <= 0.25) return 3;
  if (ratio <= 0.5) return 2;
  return 1;
}

function rpgFireRangeForPhase(cfg, phase) {
  if (phase === 1) return cfg.fireCooldownPhase1;
  if (phase === 2) return cfg.fireCooldownPhase2;
  return cfg.fireCooldownPhase3;
}

function rpgOnSidesPhaseChange(e, cfg, phase) {
  const label = document.getElementById('rpgEnemyName');
  if (label) label.textContent = RPG_LEVELS[RPG.level].enemyName + (phase > 1 ? ' · Fase ' + phase : '');
  e.hitFlash = 250;
}

function rpgUpdateSidesBoss(e, p, cfg, C, dt, step) {
  const atk = e.attack;
  const phase = rpgGetSidesPhase(e);
  if (phase !== e.phase) {
    e.phase = phase;
    rpgOnSidesPhaseChange(e, cfg, phase);
  }

  if (e.hitFlash > 0) e.hitFlash -= dt;

  const floor = rpgFloorBounds(C);
  const yTop = floor.top + 25;
  const yBottom = floor.bottom - 15;

  if (atk.state === 'tracking') {
    // Se alinea verticalmente con Junior para poder apuntarle.
    const targetY = Math.max(yTop, Math.min(yBottom, p.y));
    const dy = targetY - e.y;
    if (Math.abs(dy) > 2) {
      const move = Math.sign(dy) * Math.min(Math.abs(dy), cfg.enemySpeed * step * 3);
      e.y += move;
    }
    e.animTick += step;
    if (e.animTick >= 9) { e.animTick = 0; e.animFrame = (e.animFrame + 1) % 2; }

    atk.fireTimer -= dt;
    if (atk.fireTimer <= 0) {
      rpgFireBossProjectile(e, cfg, phase);
      atk.fireTimer = rpgRandRange(rpgFireRangeForPhase(cfg, phase));
    }

    atk.dashTimer -= dt;
    if (atk.dashTimer <= 0) {
      atk.state = 'telegraph';
      atk.timer = cfg.dashTelegraphMs;
    }
    return;
  }

  if (atk.state === 'telegraph') {
    atk.timer -= dt;
    if (atk.timer <= 0) {
      const dir = e.side === 'left' ? 1 : -1;
      const spd = phase === 1 ? cfg.dashSpeedPhase1 : cfg.dashSpeedPhase2;
      atk.vx = dir * spd;
      atk.state = 'dashing';
      atk.hit = false;
    }
    return;
  }

  if (atk.state === 'dashing') {
    e.x += atk.vx * step;
    e.y = Math.max(yTop, Math.min(yBottom, e.y));

    if (!atk.hit && rpgOverlap(
      e.x, e.y - 40, 80, 90,
      p.x, p.y + RPG_PLAYER_HITBOX.yOff, RPG_PLAYER_HITBOX.w, RPG_PLAYER_HITBOX.h
    )) {
      rpgPlayerHit(cfg.dashDamage, { fullyBlockable: true });
      atk.hit = true;
    }

    const otherSide = e.side === 'left' ? 'right' : 'left';
    const targetX = rpgSideX(otherSide, cfg, C);
    const reached = e.side === 'left' ? e.x >= targetX : e.x <= targetX;
    if (reached) {
      e.x = targetX;
      e.side = otherSide;
      atk.state = 'tracking';
      atk.dashTimer = rpgRandRange(cfg.dashCooldownMs);
      atk.fireTimer = rpgRandRange(rpgFireRangeForPhase(cfg, e.phase));
    }
  }
}

function rpgFireBossProjectile(e, cfg, phase) {
  let size;
  if (phase === 1) size = 'small';
  else if (phase === 3) size = 'big';
  else size = Math.random() < 0.5 ? 'small' : 'big';

  const dir = e.side === 'left' ? 1 : -1;
  const speed = size === 'small' ? cfg.projectileSmallSpeed : cfg.projectileBigSpeed;
  const dmg = size === 'small' ? cfg.projectileSmallDmg : cfg.projectileBigDmg;

  RPG.enemyProjectiles.push({
    x: e.x + dir * 34,
    y: e.y - 45,
    vx: dir * speed,
    vy: 0,
    dir, // 1 = viaja a la derecha (sprite normal), -1 = izquierda (sprite espejado)
    size,
    dmg,
    w: size === 'small' ? 16 : 30,
    h: size === 'small' ? 16 : 24,
    animFrame: 1, // dark_slash tiene frames "_1" y "_2" por variante
    animTick: 0
  });
}

function rpgUpdateEnemyProjectiles(dt, step) {
  const C = RPG.canvas;
  const p = RPG.player;
  for (let i = RPG.enemyProjectiles.length - 1; i >= 0; i--) {
    const pr = RPG.enemyProjectiles[i];
    pr.x += pr.vx * step;
    pr.y += pr.vy * step;
    pr.animTick += step;
    if (pr.animTick >= 6) { pr.animTick = 0; pr.animFrame = pr.animFrame === 1 ? 2 : 1; }
    if (pr.x < -40 || pr.x > C.width + 40) {
      RPG.enemyProjectiles.splice(i, 1);
      continue;
    }
    if (rpgOverlap(
      pr.x, pr.y, pr.w, pr.h,
      p.x, p.y + RPG_PLAYER_HITBOX.yOff, RPG_PLAYER_HITBOX.w, RPG_PLAYER_HITBOX.h
    )) {
      rpgPlayerHit(pr.dmg, { fullyBlockable: true });
      RPG.enemyProjectiles.splice(i, 1);
    }
  }
}

// ─── Pociones ─────
function rpgUpdatePotions(dt, step) {
  const cfg = RPG_LEVELS[RPG.level];
  const C = RPG.canvas;
  const p = RPG.player;

  // En la fase 3 del jefe de costados no aparecen pociones nuevas.
  const suppressed = cfg.attackPattern === 'sides' && RPG.enemy.alive && RPG.enemy.phase >= 3;

  RPG.potionSpawnTimer -= dt;
  if (!suppressed && RPG.potionSpawnTimer <= 0 && RPG.potions.length < 2) {
    rpgSpawnPotion(cfg, C);
    RPG.potionSpawnTimer = rpgRandRange(cfg.potionSpawnIntervalMs || [5000, 8500]);
  }

  for (let i = RPG.potions.length - 1; i >= 0; i--) {
    const pot = RPG.potions[i];
    pot.life -= dt;
    if (pot.life <= 0) { RPG.potions.splice(i, 1); continue; }
    if (rpgOverlap(
      pot.x, pot.y, pot.w, pot.h,
      p.x, p.y + RPG_PLAYER_HITBOX.yOff, RPG_PLAYER_HITBOX.w, RPG_PLAYER_HITBOX.h
    )) {
      rpgApplyPotion(pot, cfg);
      RPG.potions.splice(i, 1);
    }
  }
}

function rpgSpawnPotion(cfg, C) {
  const floor = rpgFloorBounds(C);
  const marginX = C.width * 0.12;
  const type = Math.random() < 0.5 ? 'hp' : 'speed';
  RPG.potions.push({
    type,
    x: marginX + Math.random() * (C.width - marginX * 2),
    y: floor.top + 20 + Math.random() * (floor.bottom - floor.top - 30),
    w: 24, h: 28,
    life: 9000
  });
}

function rpgApplyPotion(pot, cfg) {
  const p = RPG.player;
  if (pot.type === 'hp') {
    p.hp = Math.min(p.maxHp, p.hp + (cfg.potionHpAmount || 25));
  } else {
    p.speedBoostTimer = cfg.potionSpeedDurationMs || 5000;
  }
  rpgUpdateHudBars();
}

function rpgOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;
}

function rpgPlayerHit(dmg, opts) {
  const p = RPG.player;
  const fullyBlockable = opts && opts.fullyBlockable;
  let finalDmg = dmg;
  if (p.blocking) {
    finalDmg = fullyBlockable ? 0 : Math.round(dmg * 0.25);
    // El bloqueo solo absorbe un golpe: después se desactiva y queda
    // en cooldown 3s antes de poder volver a usarse.
    p.blocking = false;
    p.blockCooldown = 3000;
  }
  p.hp = Math.max(0, p.hp - finalDmg);
  p.hitFlash = 200;
  rpgUpdateHudBars();
  if (p.hp <= 0) rpgGameOver();
}

function rpgEnemyHit(dmg) {
  const e = RPG.enemy;
  if (!e.alive) return;
  e.hp = Math.max(0, e.hp - dmg);
  e.hitFlash = 150;
  rpgUpdateHudBars();
  if (e.hp <= 0) {
    e.alive = false;
    rpgVictory();
  }
}

function rpgUpdateHudBars() {
  const pFill = document.getElementById('rpgPlayerHpFill');
  const eFill = document.getElementById('rpgEnemyHpFill');
  if (pFill) pFill.style.width = Math.max(0, (RPG.player.hp / RPG.player.maxHp) * 100) + '%';
  if (eFill) eFill.style.width = Math.max(0, (RPG.enemy.hp / RPG.enemy.maxHp) * 100) + '%';
}

function rpgUpdateHudTimer() {
  const el = document.getElementById('rpgTimeLeft');
  if (!el) return;
  if (RPG.timeLimitMs == null) { el.textContent = ''; return; }
  const remainMs = Math.max(0, RPG.timeLimitMs - RPG.combatElapsed);
  const totalSec = Math.ceil(remainMs / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  el.textContent = '⏱ ' + mm + ':' + String(ss).padStart(2, '0');
  el.classList.toggle('rpg-timer-warn', remainMs <= 15000);
}

function rpgGameOver(title, sub) {
  rpgStopLoop();
  rpgSetOverlay(
    title || '💀 Derrota',
    sub || (RPG_LEVELS[RPG.level].enemyName + ' fue más fuerte esta vez.'),
    '<button class="btn-play" onclick="rpgStartLevel(' + RPG.level + ')">↻ Reintentar</button>' +
    '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgShowMenu()">← Volver al menú</button>'
  );
  document.getElementById('rpgOverlay').classList.remove('hidden');
}

function rpgVictory() {
  rpgStopLoop();
  const nextLevel = RPG.level + 1;
  const hasNext = !!RPG_LEVELS[nextLevel];
  rpgSetOverlay(
    '🏆 ¡Victoria!',
    'Derrotaste a ' + RPG_LEVELS[RPG.level].enemyName + '.',
    (hasNext ? '<button class="btn-play" onclick="rpgStartLevel(' + nextLevel + ')">▶ Siguiente nivel</button>' : '') +
    '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgShowMenu()">← Volver al menú</button>'
  );
  document.getElementById('rpgOverlay').classList.remove('hidden');
}

// ─── Draw ─────
function rpgDraw() {
  const ctx = RPG.ctx;
  const C = RPG.canvas;
  if (!ctx) return;
  ctx.clearRect(0, 0, C.width, C.height);

  const cfg = RPG_LEVELS[RPG.level];
  const bg = RPG.images[cfg.zoneImage];
  if (bg && bg.complete) {
    rpgDrawCover(ctx, bg, 0, 0, C.width, C.height);
  } else {
    ctx.fillStyle = '#0a0f0a';
    ctx.fillRect(0, 0, C.width, C.height);
  }

  const itemImg = RPG.images[RPG_ITEM_SHEET];

  // Pociones (en el piso, debajo de los personajes)
  if (itemImg) {
    RPG.potions.forEach(pot => {
      const rect = pot.type === 'hp' ? RPG_ITEM_ICONS.potionHp : RPG_ITEM_ICONS.potionSpeed;
      const bob = Math.sin((performance.now() / 260) + pot.x) * 2;
      rpgDrawIconRect(ctx, itemImg, rect, pot.x, pot.y + bob, 30, { centered: true });
    });
  }

  // Enemigo
  const e = RPG.enemy;
  if (e.alive) {
    ctx.save();

    // Aviso visual de un ataque especial a punto de salir (telegraph):
    // círculo rojo pulsante mientras el jefe "carga" antes del dash.
    if (e.attack.state === 'telegraph') {
      const pulse = 0.5 + 0.5 * Math.sin(e.attack.timer * 0.03);
      ctx.globalAlpha = 0.35 + pulse * 0.3;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(e.x, e.y - 45, 55 + pulse * 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (e.hitFlash > 0) ctx.globalAlpha = 0.55;
    const flip = e.x > RPG.player.x;

    if (cfg.enemyAtlas) {
      // Dark Knight: poses nombradas, no ciclo de frames. La pose se elige
      // según el estado del ataque especial en vez de animFrame.
      const atlas = RPG.atlases[cfg.enemyAtlas];
      const img = RPG.images[cfg.enemySheet];
      let frameName = 'idle_front';
      if (e.attack.state === 'telegraph') frameName = 'attack1';
      else if (e.attack.state === 'charging' || e.attack.state === 'dashing') frameName = 'attack2';
      if (atlas && img) rpgDrawAtlasFrame(ctx, img, atlas, frameName, e.x, e.y, 92, flip); // antes 110 — un poco más chico
    } else {
      const sheet = SPRITES[cfg.enemyKey];
      const img = RPG.images[cfg.enemySheet];
      if (sheet && img) {
        const row = sheet.rows[0];
        rpgDrawFrame(ctx, img, row, e.animFrame, e.x, e.y, 110, flip);
      }
    }
    ctx.restore();
  }

  // Jugador
  const p = RPG.player;
  ctx.save();
  if (p.hitFlash > 0) ctx.globalAlpha = 0.55;
  if (p.blocking) {
    const sheet = SPRITES.bloquear;
    const img = RPG.images[RPG_ASSET_BASE + 'models/junior/bloquear.png'];
    // Las 4 columnas de bloquear.png son 4 poses direccionales fijas
    // (frente/atrás/izq/der, mismo orden que junior.png) — no cuadros de
    // una animación. Se elige por RPG.facing, no por un contador de tiempo.
    if (sheet && img) rpgDrawFrame(ctx, img, sheet.rows[0], RPG_FACING_ROW[RPG.facing], p.x, p.y, RPG_PLAYER_DRAW_H, false);
  } else {
    const sheet = SPRITES.junior;
    const img = RPG.images[RPG_ASSET_BASE + 'models/junior/junior.png'];
    if (sheet && img) {
      const rowIdx = RPG_FACING_ROW[RPG.facing];
      rpgDrawFrame(ctx, img, sheet.rows[rowIdx], p.animFrame, p.x, p.y, RPG_PLAYER_DRAW_H, false);
    }
  }
  // Aura sutil mientras dura el boost de velocidad de la poción naranja.
  if (p.speedBoostTimer > 0) {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -RPG_PLAYER_DRAW_H * 0.35, RPG_PLAYER_DRAW_H * 0.42, RPG_PLAYER_DRAW_H * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Balas de Junior (sprite real, rotado según la dirección del disparo)
  if (itemImg) {
    RPG.bullets.forEach(b => {
      const angle = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      rpgDrawIconRect(ctx, itemImg, RPG_ITEM_ICONS.bullet, b.x, b.y, 12, { rotation: angle, centered: true });
    });
  }

  // Proyectiles del jefe (sprite dark_slash del nivel; si un nivel futuro
  // todavía no tiene el suyo, cae al ícono genérico de objeto.png)
  const slashImg = cfg.bossProjectileSheet ? RPG.images[cfg.bossProjectileSheet] : null;
  const slashAtlas = cfg.bossProjectileAtlas ? RPG.atlases[cfg.bossProjectileAtlas] : null;
  if (slashImg && slashAtlas) {
    RPG.enemyProjectiles.forEach(pr => {
      const frameName = (pr.size === 'small' ? 'slash_small_' : 'slash_large_') + pr.animFrame;
      const targetH = pr.size === 'small' ? 20 : 32;
      // El sprite apunta hacia la derecha por defecto; si el proyectil
      // viaja hacia la izquierda se invierte para que la estela "tenga
      // sentido" con la dirección de vuelo.
      rpgDrawAtlasFrame(ctx, slashImg, slashAtlas, frameName, pr.x, pr.y, targetH, pr.dir === -1, true);
    });
  } else if (itemImg) {
    RPG.enemyProjectiles.forEach(pr => {
      const rect = pr.size === 'small' ? RPG_ITEM_ICONS.projSmall : RPG_ITEM_ICONS.projBig;
      const targetH = pr.size === 'small' ? 20 : 32;
      rpgDrawIconRect(ctx, itemImg, rect, pr.x, pr.y, targetH, { centered: true });
    });
  }
}

// Dibuja un frame de spritesheet anclado en (x, y) = punto de los pies,
// escalado a una altura fija `targetH` manteniendo el aspect ratio de la
// celda (los anchos de celda varían entre filas, así que si se estirara
// todo al mismo cuadro el personaje se vería deformado).
function rpgDrawFrame(ctx, img, rowData, frameIndex, x, y, targetH, flip) {
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

// Dibuja un frame por NOMBRE desde un atlas JSON ({frameSize, frames:{nombre:{x,y,w,h}}}).
// Se usa para dark_knight, que tiene poses/efectos discretos en vez de un
// ciclo de caminata uniforme (ver rpgDrawFrame para ese caso).
function rpgDrawAtlasFrame(ctx, img, atlas, frameName, x, y, targetH, flip, centered) {
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

// Dibuja un ícono recortado directamente por coordenadas (RPG_ITEM_ICONS),
// usado para balas / pociones / proyectiles que viven todos en objeto.png.
// opts: { rotation, flip, centered }
function rpgDrawIconRect(ctx, img, rect, x, y, targetH, opts) {
  opts = opts || {};
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

// Dibuja `img` cubriendo todo el rect destino (equivalente a background-size: cover)
function rpgDrawCover(ctx, img, dx, dy, dw, dh) {
  const ir = img.width / img.height;
  const dr = dw / dh;
  let sx, sy, sw, sh;
  if (ir > dr) {
    sh = img.height;
    sw = sh * dr;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / dr;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}
