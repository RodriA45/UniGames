// ══════════════════════════════════════
//   Pixel Runner — src/games/pixelrunner.js
// ══════════════════════════════════════
//
// Reescritura sobre Engine2D. Reemplaza el bloque RUNNER que vivía suelto
// en app.js (líneas ~948-1437 de la versión vieja). Mismas funciones
// públicas que ya usa index.html (initRunner, startRunner, stopRunner,
// restartRunner, toRunnerMenu, showRunnerMenu, startPixelRunnerGame,
// runnerJumpOrStart, runnerFastDrop) así el HTML no necesita tocarse.
//
// ─── Mecánica nueva: movimiento izquierda/derecha acotado ─────────────
// El jugador y los obstáculos viajan sobre el mismo eje X, así que
// moverse no te saca del "camino" del obstáculo (tarde o temprano barre
// cualquier X del corredor). Lo que SÍ hace moverte:
//   - Retroceder (izquierda) = el obstáculo tiene que recorrer más
//     distancia para llegarte = más frames de reacción para saltar/agachar.
//   - Avanzar (derecha) = menos margen, pero te deja "adelantarte" a un
//     combo apretado antes de que se solape con el siguiente.
// El corredor tiene paredes invisibles (CORRIDOR_MIN_X/MAX_X) — no podés
// escapar infinitamente hacia atrás. A velocidades altas, sin esto,
// ciertos combos de obstáculos son directamente imposibles de esquivar
// solo con salto/agache; con el margen que da moverte, vuelven a ser
// jugables.
// ══════════════════════════════════════

const RUNNER = {
  canvas: null, ctx: null,
  loop: null,
  input: null,
  touch: null,
  running: false,
  started: false, // false = esperando el primer input del jugador (personaje quieto, nada se mueve)
  mode: 'historia', // 'historia' (meta 2500 pts) | 'infinito' (sin límite, desbloqueado al completar historia)
  score: 0, bestScore: 0,
  speed: 5, baseSpeed: 5,
  frameCount: 0,
  obstacleTimer: 0, obstacleInterval: 90,

  // Corredor de movimiento lateral (coordenadas de mundo = canvas, 480x270)
  corridorMinX: 20,
  corridorMaxX: 190,
  moveSpeed: 2.6, // px por "step" (step = dt/16.6, ver Engine2D.GameLoop)

  // Personaje
  player: {
    x: 90, y: 0, w: 29, h: 34,
    vy: 0, jumps: 0, maxJumps: 2,
    dead: false, animFrame: 0, animTick: 0,
    groundY: 0,
    facing: 1, // 1 = mirando derecha (default), -1 = mirando izquierda
    shield: false, // true mientras el power-up de escudo está activo (ver shieldFrames)
    shieldFrames: 0, // frames restantes del escudo — 0 = apagado
    shieldHitsLeft: 0, // golpes que el escudo todavía puede absorber (1, o 2 con la mejora "Escudo reforzado")
  },

  groundH: 34, skyH: 30,
  obstacles: [],

  // Monedas + power-ups (escudo / x2). Separado de `obstacles` porque no
  // matan al tocarlos, al revés: suman monedas o dan un buff.
  pickups: [],
  pickupTimer: 0, pickupInterval: 130,
  doublePointsFrames: 0, // > 0 mientras el x2 está activo (ver updateRunner)
  coinsRun: 0,     // monedas juntadas en la partida actual
  totalCoins: 0,   // total acumulado histórico (persistido, ver loadTotalCoins/saveTotalCoins)
  upgrades: null,  // mejoras compradas en la tienda (persistidas, ver loadUpgrades/saveUpgrades/getRunnerUpgrades) — null hasta la primera carga

  // Bioma actual ('grass' | 'desert'). Se deriva del score en updateRunner;
  // este valor es solo el default antes de que arranque la partida.
  biome: 'grass',

  // Secuencia de victoria de Modo Historia (al llegar a HISTORIA_GOAL): el
  // castillo entra en cuadro y Junior camina hasta la puerta antes del
  // cómic final. null = no está pasando (juego normal); ver
  // startHistoriaWinApproach/updateWinApproach/finishHistoriaWin.
  winCastle: null,
  winArrived: false,
};

const RUNNER_ASSETS = {
  junior:    'assert/pixel runner/models/junior.png',
  juniorAt:  'assert/pixel runner/models/junior.atlas.json',
  bird:      'assert/pixel runner/models/bird.png',
  birdAt:    'assert/pixel runner/models/bird.atlas.json',
  obst:      'assert/pixel runner/models/obstaculo.png',
  obstAt:    'assert/pixel runner/models/obstaculo.atlas.json',
  mapa:      'assert/pixel runner/models/mapa.png',
  mapaAt:    'assert/pixel runner/models/mapa.atlas.json',
  item:      'assert/pixel runner/models/item.png',
  itemAt:    'assert/pixel runner/models/item.atlas.json',
  castillo:  'assert/pixel runner/castillo.png',
};

// Cómics del Modo Historia: uno al elegir el modo (antes de arrancar la
// partida) y otro al llegar a HISTORIA_GOAL (antes del cartel de victoria).
const RUNNER_COMICS = {
  intro: 'assert/pixel runner/comics/historia_intro.jpg',
  final: 'assert/pixel runner/comics/historia_final.jpg',
};

// Muestra un cómic a pantalla completa dentro del runner-container y
// ejecuta `onContinue` cuando el jugador toca "Continuar". Se guarda el
// callback en RUNNER para que runnerComicContinuar() (llamado desde el
// botón en el HTML) sepa qué hacer al cerrar.
function showRunnerComic(src, onContinue) {
  const overlay = document.getElementById('runnerComicOverlay');
  const img = document.getElementById('runnerComicImg');
  if (!overlay || !img) { onContinue(); return; }
  img.src = src;
  RUNNER.comicCallback = onContinue;
  overlay.classList.remove('hidden');
}

function runnerComicContinuar() {
  const overlay = document.getElementById('runnerComicOverlay');
  if (overlay) overlay.classList.add('hidden');
  const cb = RUNNER.comicCallback;
  RUNNER.comicCallback = null;
  if (typeof cb === 'function') cb();
}

const TREE_VARIANTS = ['tree_small', 'tree_medium', 'tree_large'];
const CACTUS_VARIANTS = ['cactus_small', 'cactus_medium', 'cactus_large'];
const ROCK_VARIANTS = ['rock_small', 'rock_medium', 'rock_large'];
const BIRD_FRAMES = ['flap_0','flap_1','flap_2','flap_3','flap_4','flap_5','flap_6','flap_7'];
const RUN_FRAMES = ['run_0','run_1','run_2','run_3','run_4','run_5','run_6'];
const SUN_FRAMES = ['sun_0','sun_1','sun_2','sun_3'];
const MOON_FRAMES = ['moon_0','moon_1','moon_2','moon_3'];
const FALL_FRAMES = ['fall_0','fall_1','fall_2','fall_3']; // animación de choque/caída al morir — usada en playDeathAnimation
const CLOUD_FRAMES = ['cloud_0','cloud_1','cloud_2','cloud_3'];

// ─── Items: monedas + power-ups (item.png / item.atlas.json) ──────────
const COIN_SPIN_FRAMES = ['coin_0','coin_1','coin_2','coin_3','coin_4','coin_5','coin_6','coin_7'];
const SHIELD_SHIMMER_FRAMES = ['shield_shimmer_0','shield_shimmer_1','shield_shimmer_2','shield_shimmer_3','shield_shimmer_4'];

const COIN_VALUE = 1;                     // monedas que suma cada moneda agarrada (moneda-juego, no puntaje)
const PICKUP_GROUP_MIN = 3, PICKUP_GROUP_MAX = 5; // cantidad de monedas por tanda
const POWERUP_CHANCE = 0.16;              // probabilidad de que la tanda sea un power-up en vez de monedas
const DOUBLE_POINTS_DURATION = 900;       // "frames" (step≈1/frame, ~15s) que dura el x2
const SHIELD_DURATION = 900;              // ídem para el escudo (~15s) — protege 1 solo golpe dentro de esa ventana
const POWERUP_STACK_CAP = 900 * 2;        // tope al acumular duración (no deja pasar de ~30s)

// Monedas: son una moneda de juego aparte del puntaje (pensadas para una
// futura tienda de mejoras), así que NO tocan RUNNER.score — se acumulan
// en RUNNER.coinsRun (la partida actual) y en RUNNER.totalCoins, que se
// persiste en localStorage y sobrevive a game overs / recargas de página.
const COINS_STORAGE_KEY = 'pixelRunnerCoins';
function loadTotalCoins() {
  const raw = localStorage.getItem(COINS_STORAGE_KEY);
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}
function saveTotalCoins(total) {
  localStorage.setItem(COINS_STORAGE_KEY, String(total));
}

// ─── Tienda de mejoras ──────────────────────────────────────────────────
// 4 mejoras permanentes, pagadas con las monedas juntadas (RUNNER.totalCoins),
// persistidas en localStorage igual que las monedas y el progreso de Historia.
//
//  - shieldLevel (0..10): +1 seg de duración del escudo por nivel.
//  - x2Level     (0..10): +1 seg de duración del x2 por nivel.
//  - shieldHits  (bool):  el escudo pasa de aguantar 1 golpe a 2.
//  - x2Triple    (bool):  el power-up de puntos pasa de x2 a x3.
//
// Las mejoras de nivel cuestan más cada vez (100,200,...,1000 = 5500 en
// total para llevar una al máximo); las de un solo golpe (shieldHits /
// x2Triple) son compras únicas.
const UPGRADE_MAX_LEVEL = 10;
const UPGRADE_LEVEL_COSTS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]; // costo del nivel N = UPGRADE_LEVEL_COSTS[N-1]
const UPGRADE_DURATION_STEP = 60; // frames por nivel — 60 steps ≈ 1s a 60fps (ver GameLoop en engine2d.js)
const UPGRADE_SHIELD_HITS_COST = 1000;
const UPGRADE_X2_TRIPLE_COST = 1500;

const UPGRADES_STORAGE_KEY = 'pixelRunnerUpgrades';

function defaultRunnerUpgrades() {
  return { shieldLevel: 0, x2Level: 0, shieldHits: false, x2Triple: false };
}

function loadUpgrades() {
  const def = defaultRunnerUpgrades();
  try {
    const raw = localStorage.getItem(UPGRADES_STORAGE_KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw);
    const clampLevel = (n) => Math.min(UPGRADE_MAX_LEVEL, Math.max(0, parseInt(n, 10) || 0));
    return {
      shieldLevel: clampLevel(parsed.shieldLevel),
      x2Level: clampLevel(parsed.x2Level),
      shieldHits: !!parsed.shieldHits,
      x2Triple: !!parsed.x2Triple,
    };
  } catch (e) {
    return def;
  }
}

function saveUpgrades(u) {
  localStorage.setItem(UPGRADES_STORAGE_KEY, JSON.stringify(u));
}

// Devuelve las mejoras ya cargadas (las cachea en RUNNER.upgrades la
// primera vez) — se usa en el loop del juego, donde no hace falta pegarle
// a localStorage en cada frame.
function getRunnerUpgrades() {
  if (!RUNNER.upgrades) RUNNER.upgrades = loadUpgrades();
  return RUNNER.upgrades;
}

// Fuerza una relectura desde localStorage. Se usa al abrir el panel de
// Mejoras (se puede abrir desde el menú antes de jugar, o después de
// comprar algo) para no mostrar datos viejos.
function refreshRunnerUpgrades() {
  RUNNER.upgrades = loadUpgrades();
  return RUNNER.upgrades;
}

// Costo para comprar el próximo nivel/mejora de `tipo`, o null si ya está
// al máximo (nivel 10, o ya comprada en el caso de las mejoras únicas).
function getUpgradeCost(tipo, upgrades) {
  const u = upgrades || getRunnerUpgrades();
  if (tipo === 'shieldDuration') return u.shieldLevel >= UPGRADE_MAX_LEVEL ? null : UPGRADE_LEVEL_COSTS[u.shieldLevel];
  if (tipo === 'x2Duration') return u.x2Level >= UPGRADE_MAX_LEVEL ? null : UPGRADE_LEVEL_COSTS[u.x2Level];
  if (tipo === 'shieldHits') return u.shieldHits ? null : UPGRADE_SHIELD_HITS_COST;
  if (tipo === 'x2Triple') return u.x2Triple ? null : UPGRADE_X2_TRIPLE_COST;
  return null;
}

// Intenta comprar una mejora. Devuelve true si se pudo pagar (y descuenta
// las monedas + persiste todo), false si estaba al máximo o no alcanzaba.
function buyRunnerUpgrade(tipo) {
  refreshRunnerUpgrades(); // relee de localStorage antes de tocar nada, por si se compró en otra pestaña/sesión
  RUNNER.totalCoins = loadTotalCoins();

  const cost = getUpgradeCost(tipo);
  if (cost === null || RUNNER.totalCoins < cost) return false;

  RUNNER.totalCoins -= cost;
  saveTotalCoins(RUNNER.totalCoins);

  const u = RUNNER.upgrades;
  if (tipo === 'shieldDuration') u.shieldLevel++;
  else if (tipo === 'x2Duration') u.x2Level++;
  else if (tipo === 'shieldHits') u.shieldHits = true;
  else if (tipo === 'x2Triple') u.x2Triple = true;
  saveUpgrades(u);
  return true;
}

// Duración efectiva (en frames) de cada power-up, ya con las mejoras de
// nivel aplicadas — reemplazan el uso directo de SHIELD_DURATION /
// DOUBLE_POINTS_DURATION al agarrar el pickup.
function shieldDurationFrames() {
  return SHIELD_DURATION + getRunnerUpgrades().shieldLevel * UPGRADE_DURATION_STEP;
}
function doublePointsDurationFrames() {
  return DOUBLE_POINTS_DURATION + getRunnerUpgrades().x2Level * UPGRADE_DURATION_STEP;
}
// Golpes que aguanta el escudo antes de romperse (1, o 2 con la mejora).
function shieldMaxHits() {
  return getRunnerUpgrades().shieldHits ? 2 : 1;
}
// Multiplicador de puntaje mientras el x2 está activo (2x, o 3x con la mejora).
function runnerScoreMultiplier() {
  return getRunnerUpgrades().x2Triple ? 3 : 2;
}

// ─── Progreso de campaña: Modo Historia ────────────────────────────────
// Modo Historia = llegar a HISTORIA_GOAL puntos. Al lograrlo una vez se
// desbloquea el Modo Infinito para siempre (persistido en localStorage,
// mismo patrón que las monedas).
const HISTORIA_GOAL = 2500;
const HISTORIA_STORAGE_KEY = 'pixelRunnerHistoriaCompleta';
function loadHistoriaCompleta() {
  return localStorage.getItem(HISTORIA_STORAGE_KEY) === '1';
}
function saveHistoriaCompleta() {
  localStorage.setItem(HISTORIA_STORAGE_KEY, '1');
}

// En Historia el HUD muestra "puntos / meta" para que se vea el progreso;
// en Infinito muestra solo el puntaje, como antes.
function runnerScoreText(score) {
  return RUNNER.mode === 'historia' ? (score + ' / ' + HISTORIA_GOAL) : String(score);
}

// ─── Secuencia de victoria de Modo Historia ────────────────────────────
// Al llegar a HISTORIA_GOAL no se corta directo al cómic: el castillo
// entra deslizándose desde la derecha y, ya asentado, Junior camina hasta
// la puerta. Recién ahí arranca el cómic final + cartel de victoria (ver
// startHistoriaWinApproach / updateWinApproach / finishHistoriaWin).
const CASTLE_TARGET_H = 210;          // alto del sprite dibujado en el canvas (270 de alto total)
const CASTLE_REST_MARGIN = 10;        // separación del castillo respecto al borde derecho del canvas al asentarse
const CASTLE_GROUND_OFFSET = 25;      // px que se hunde el sprite respecto a groundY, para compensar el margen transparente del PNG y que quede pegado al piso en vez de flotando — ajustar a ojo si no queda perfecto
const CASTLE_DOOR_WALK_GAP = 90;      // hasta cuándo camina Junior antes de "tocar" la puerta (subido para que la caminata final no se sienta instantánea con CASTLE_WALK_SPEED_MULT)
const CASTLE_WALK_SPEED_MULT = 5;     // velocidad de Junior caminando hacia la puerta = moveSpeed x este valor
const WIN_APPROACH_PAUSE_MS = 550;    // pausa breve al llegar a la puerta, antes de mostrar el cómic final

// Variantes de obstáculo "de piso" según bioma — árboles solo en pasto,
// cactus solo en desierto; las rocas son neutras y salen en los dos.
function groundVariantsForBiome(biome) {
  return biome === 'desert'
    ? CACTUS_VARIANTS.concat(ROCK_VARIANTS)
    : TREE_VARIANTS.concat(ROCK_VARIANTS);
}

// Cuántos px "hundir" el sprite del obstáculo respecto a su caja de
// colisión al dibujarlo, para que la base quede pisando el piso en vez de
// flotar sobre él (el padding transparente de cada frame del atlas es
// distinto por tipo, así que cada familia necesita su propio ajuste). Es
// puramente visual, no mueve la caja de colisión real.
const GROUND_OBSTACLE_SINK = {
  tree_small: 5, tree_medium: 5, tree_large: 5,
  cactus_small: 5, cactus_medium: 5, cactus_large: 5,
  rock_small: 14, rock_medium: 14, rock_large: 14,
};
function sinkForSprite(sprite) {
  return GROUND_OBSTACLE_SINK[sprite] != null ? GROUND_OBSTACLE_SINK[sprite] : 5;
}

// Duración (en puntos) de cada bioma y de cada mitad día/noche dentro de
// ese bioma — ver updateRunner para cómo se derivan de RUNNER.score.
const BIOME_SEGMENT = 500;
const DAY_HALF = 250;

// ─── Ciclo día/noche ────────────────────
// Un ciclo completo (día + noche) dura cycleLen frames. `t` avanza
// siempre; `phase` = t/cycleLen va de 0 a 1. 0..0.5 = día (sol cruza el
// cielo), 0.5..1 = noche (luna cruza el cielo + estrellas). El fondo
// interpola de color entre los dos extremos para que no haya un corte feo.
//
// IMPORTANTE: t se deriva de RUNNER.frameCount (ver updateRunner), NO se
// incrementa solo — así el día/noche queda 100% sincronizado con el score:
// el score sube 1 punto cada 6 frames, así que cycleLen = BIOME_SEGMENT*6
// hace que la noche arranque justo a los DAY_HALF (250) puntos.
RUNNER.sky = {
  t: 0,
  cycleLen: BIOME_SEGMENT * 6,
  clouds: [
    { x: 60,  y: 30, speed: 0.15, frame: 0 },
    { x: 260, y: 18, speed: 0.09, frame: 1 },
    { x: 400, y: 42, speed: 0.12, frame: 2 },
  ],
};

function initRunner() {
  RUNNER.canvas = document.getElementById('runnerCanvas');

  requestAnimationFrame(() => {
    const C = RUNNER.canvas;
    const W = 480, H = 270;
    C.width = W;
    C.height = H;
    RUNNER.ctx = C.getContext('2d');

    RUNNER.player.groundY = C.height - RUNNER.groundH - RUNNER.player.h;
    RUNNER.player.y = RUNNER.player.groundY;
    RUNNER.totalCoins = loadTotalCoins();
    refreshRunnerUpgrades(); // trae las mejoras compradas antes de que arranque la partida

    document.getElementById('runnerOverlay').classList.add('hidden');
    if (RUNNER.bestScore > 0) {
      document.getElementById('runnerBest').textContent = 'Mejor: ' + RUNNER.bestScore + ' pts';
    }

    setupRunnerInput();
    setupRunnerTouch();

    // Cargar sprites una sola vez (Engine2D cachea, así que si ya están
    // cargados de una sesión anterior esto resuelve al toque).
    Engine2D.loadAll([
      { type: 'image', src: RUNNER_ASSETS.junior },
      { type: 'atlas', src: RUNNER_ASSETS.juniorAt },
      { type: 'image', src: RUNNER_ASSETS.bird },
      { type: 'atlas', src: RUNNER_ASSETS.birdAt },
      { type: 'image', src: RUNNER_ASSETS.obst },
      { type: 'atlas', src: RUNNER_ASSETS.obstAt },
      { type: 'image', src: RUNNER_ASSETS.mapa },
      { type: 'atlas', src: RUNNER_ASSETS.mapaAt },
      { type: 'image', src: RUNNER_ASSETS.item },
      { type: 'atlas', src: RUNNER_ASSETS.itemAt },
      { type: 'image', src: RUNNER_ASSETS.castillo },
    ]).then(() => startRunner())
      .catch(err => {
        console.error('No se pudieron cargar los sprites de Pixel Runner', err);
        startRunner(); // arranca igual — drawRunner tiene fallback a rectángulos
      });
  });
}

// ─── Input ──────────────────────────────
function setupRunnerInput() {
  if (RUNNER.input) RUNNER.input.detach();

  RUNNER.input = new Engine2D.KeyboardInput(
    {
      ArrowUp: 'jump', Space: 'jump', KeyW: 'jump',
      ArrowDown: 'drop', KeyS: 'drop',
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
    },
    {
      activeCheck: () => document.getElementById('sec-runner').classList.contains('active'),
      preventDefaultFor: new Set(['ArrowUp', 'Space', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS']),
      onDown: (action) => {
        // Enter/Espacio en el overlay de game over = reintentar
        const overlay = document.getElementById('runnerOverlay');
        if (overlay && !overlay.classList.contains('hidden')) {
          if (action === 'jump') {
            const btn = document.getElementById('runnerRestartBtn');
            if (btn && btn.style.display !== 'none') btn.click();
          }
          return;
        }
        if (action === 'jump') runnerJumpOrStart();
        if (action === 'drop') runnerFastDrop();
      },
    }
  );
  RUNNER.input.attach();
}

// Llamadas desde los botones táctiles (index.html, mismo patrón que rpgMove)
function runnerMove(dir, isDown) {
  if (!RUNNER.input) return;
  RUNNER.input.state[dir] = isDown;
}

// Controles táctiles DENTRO del canvas (Engine2D.TouchControls) — reemplazan
// los viejos botones de Saltar/Bajar que vivían en HTML debajo del juego.
// Izquierda/derecha: par horizontal abajo a la izquierda.
// Saltar/bajar: par vertical abajo a la derecha.
// Chicos (radius 15) para no tapar mucha pantalla de juego.
function setupRunnerTouch() {
  if (RUNNER.touch) RUNNER.touch.detach();
  const C = RUNNER.canvas;
  // Solo se muestran/reaccionan en dispositivos táctiles — en PC el juego
  // se controla con teclado, así que acá no deben aparecer ni ser clickeables.
  const isTouchDevice = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  RUNNER.touch = new Engine2D.TouchControls(C, { visible: isTouchDevice });
  RUNNER.touch.addButton({ id: 'left', x: 34, y: 232, radius: 26, label: '◀' });
  RUNNER.touch.addButton({ id: 'right', x: 94, y: 232, radius: 26, label: '▶' });
  RUNNER.touch.addButton({ id: 'jump', x: 450, y: 182, radius: 26, label: '▲' });
  RUNNER.touch.addButton({ id: 'drop', x: 450, y: 242, radius: 26, label: '▼' });
  RUNNER.touch.attach();
  RUNNER._touchPrev = { left: false, right: false, jump: false, drop: false };
}

// Se llama UNA VEZ por frame desde updateRunner (antes que nada, incluso
// con el jugador muerto, para que Saltar reintente en la pantalla de game
// over igual que hace la tecla ↑/Espacio). Convierte el estado "sostenido"
// del engine en las mismas llamadas que ya usaba el teclado.
function syncRunnerTouch() {
  const t = RUNNER.touch;
  if (!t) return;
  const prev = RUNNER._touchPrev;

  if (t.state.left !== prev.left) { runnerMove('left', t.state.left); prev.left = t.state.left; }
  if (t.state.right !== prev.right) { runnerMove('right', t.state.right); prev.right = t.state.right; }

  const jumpPressed = t.state.jump && !prev.jump;
  const dropPressed = t.state.drop && !prev.drop;
  prev.jump = t.state.jump;
  prev.drop = t.state.drop;
  if (!jumpPressed && !dropPressed) return;

  // Mismo criterio que setupRunnerInput: si el cartel de game over está
  // abierto, Saltar reintenta en vez de saltar.
  const overlay = document.getElementById('runnerOverlay');
  if (overlay && !overlay.classList.contains('hidden')) {
    if (jumpPressed) {
      const btn = document.getElementById('runnerRestartBtn');
      if (btn && btn.style.display !== 'none') btn.click();
    }
    return;
  }
  if (jumpPressed) runnerJumpOrStart();
  if (dropPressed) runnerFastDrop();
}

function runnerFastDrop() {
  if (!RUNNER.running) return;
  RUNNER.started = true; // agacharse/caída rápida también cuenta como el primer input
  const p = RUNNER.player;
  if (p.dead || p.y >= p.groundY) return;
  p.vy = Math.abs(p.vy) * 0.5 + RUNNER.canvas.height * 0.04;
}

function runnerJumpOrStart() {
  const overlay = document.getElementById('runnerOverlay');
  if (overlay && !overlay.classList.contains('hidden')) return;
  if (!RUNNER.running) return;
  RUNNER.started = true; // primer input: arranca el juego (personaje deja de estar quieto)
  const p = RUNNER.player;
  if (p.dead) return;
  if (p.jumps < p.maxJumps) {
    p.vy = -RUNNER.canvas.height * 0.018;
    p.jumps++;
  }
}

// ─── Ciclo de vida ──────────────────────
function startRunner() {
  setMusic('assert/pixel runner/sounds/backplay.mp3');

  RUNNER.score = 0;
  RUNNER.speed = RUNNER.baseSpeed;
  RUNNER.frameCount = 0;
  RUNNER.obstacleTimer = 0;
  RUNNER.obstacleInterval = 90;
  RUNNER.obstacles = [];
  RUNNER.running = true;
  RUNNER.started = false; // arranca quieto — se activa con el primer input (ver updateRunner)
  RUNNER.pickups = [];
  RUNNER.pickupTimer = 0;
  RUNNER.doublePointsFrames = 0;
  RUNNER.coinsRun = 0; // totalCoins NO se resetea acá, es histórico
  RUNNER.winCastle = null;
  RUNNER.winArrived = false;

  const p = RUNNER.player;
  p.x = 90;
  p.y = p.groundY;
  p.vy = 0;
  p.jumps = 0;
  p.dead = false;
  p.animFrame = 0;
  p.animTick = 0;
  p.animFrameName = null;
  p.facing = 1;
  p.shield = false;
  p.shieldFrames = 0;
  p.shieldHitsLeft = 0;

  // Arranca siempre en el bioma de pasto y de día (frame 0 = fase 0 del
  // ciclo día/noche, que cae dentro del tramo de día).
  RUNNER.biome = 'grass';
  RUNNER.sky.t = 0;

  document.getElementById('runnerOverlay').classList.add('hidden');
  document.getElementById('runner-score-display').textContent = runnerScoreText(0);
  const coinsRunEl = document.getElementById('runner-coins-run-display');
  if (coinsRunEl) coinsRunEl.textContent = '0';
  document.getElementById('runnerRestartBtn').style.display = 'none';
  document.getElementById('runnerMenuBtn').style.display = 'none';

  if (RUNNER.loop) RUNNER.loop.stop();
  RUNNER.loop = new Engine2D.GameLoop({
    update: (dt, step) => updateRunner(step),
    draw: () => drawRunner(),
  });
  RUNNER.loop.start();
}

function stopRunner() {
  RUNNER.running = false;
  if (RUNNER.loop) RUNNER.loop.stop();
  if (RUNNER.input) RUNNER.input.detach();
  if (RUNNER.touch) RUNNER.touch.detach();
}

const GRAVITY = 0.09;

function updateRunner(step) {
  const C = RUNNER.canvas;
  const p = RUNNER.player;
  syncRunnerTouch();
  if (p.dead) return;

  // Esperando el primer input: el personaje queda quieto parado en el
  // piso y nada más se mueve (ni obstáculos, ni score, ni ciclo día/noche)
  // hasta que el jugador toca cualquier botón (salto, agache, izq o der).
  if (!RUNNER.started) {
    const waitingInput = RUNNER.input.state;
    if (waitingInput.left || waitingInput.right || waitingInput.jump || waitingInput.drop) {
      RUNNER.started = true;
    } else {
      return;
    }
  }

  // Secuencia de victoria de Historia en curso: el castillo entra en
  // cuadro / Junior camina hacia la puerta. Mientras dura esto no hay
  // spawns, colisiones ni más puntaje — ver updateWinApproach.
  if (RUNNER.winCastle) {
    updateWinApproach(step, C);
    return;
  }

  // Score + velocidad
  RUNNER.frameCount++;
  if (RUNNER.frameCount % 6 === 0) {
    RUNNER.score += RUNNER.doublePointsFrames > 0 ? runnerScoreMultiplier() : 1; // x2/x3 (según mejora) activo = puntaje multiplicado por tick
    if (RUNNER.mode === 'historia' && RUNNER.score >= HISTORIA_GOAL) {
      RUNNER.score = HISTORIA_GOAL; // no pasarse de la meta en el HUD
      document.getElementById('runner-score-display').textContent = runnerScoreText(RUNNER.score);
      startHistoriaWinApproach(C);
      return;
    }
    document.getElementById('runner-score-display').textContent = runnerScoreText(RUNNER.score);
    if (RUNNER.score % 250 === 0) {
      RUNNER.speed += 0.8;
      RUNNER.obstacleInterval = Math.max(45, RUNNER.obstacleInterval - 5);
    }
  }
  if (RUNNER.doublePointsFrames > 0) RUNNER.doublePointsFrames = Math.max(0, RUNNER.doublePointsFrames - step);
  if (p.shieldFrames > 0) {
    p.shieldFrames = Math.max(0, p.shieldFrames - step);
    p.shield = p.shieldFrames > 0;
  }

  // Bioma: alterna pasto/desierto cada BIOME_SEGMENT (500) puntos.
  const segmentIndex = Math.floor(RUNNER.score / BIOME_SEGMENT);
  RUNNER.biome = (segmentIndex % 2 === 0) ? 'grass' : 'desert';

  // Movimiento lateral (acotado al corredor). Junior siempre corre mirando
  // a la derecha — ir hacia la izquierda no lo hace "correr para atrás",
  // es simplemente perder terreno/velocidad relativa (el sprite no se da
  // vuelta), por eso facing nunca pasa a -1 acá.
  const input = RUNNER.input.state;
  let vx = 0;
  if (input.left) vx -= RUNNER.moveSpeed;
  if (input.right) vx += RUNNER.moveSpeed;
  p.x = Math.min(RUNNER.corridorMaxX, Math.max(RUNNER.corridorMinX, p.x + vx * step));

  // Física vertical (salto/gravedad) — sin cambios respecto a antes
  p.vy += GRAVITY * (C.height / 200) * step;
  p.y += p.vy * step;
  if (p.y >= p.groundY) {
    p.y = p.groundY;
    p.vy = 0;
    p.jumps = 0;
  }

  // Animación de correr (piernas) solo si está en el piso
  p.animTick += step;
  if (p.animTick >= 6) { p.animTick = 0; p.animFrame = (p.animFrame + 1) % RUN_FRAMES.length; }

  // Ciclo día/noche + nubes (las nubes van a su propia velocidad, más
  // lenta que el juego — no aceleran con RUNNER.speed, dan sensación de
  // fondo lejano / parallax). sky.t se deriva directo de frameCount (no se
  // acumula solo) para que quede perfectamente sincronizado con el score:
  // la noche arranca justo a los DAY_HALF puntos de cada bioma.
  RUNNER.sky.t = RUNNER.frameCount % RUNNER.sky.cycleLen;
  RUNNER.sky.clouds.forEach(c => {
    c.x -= c.speed * step;
    if (c.x < -100) c.x = C.width + 40 + Math.random() * 60;
  });

  // Spawn de obstáculos
  RUNNER.obstacleTimer += step;
  if (RUNNER.obstacleTimer >= RUNNER.obstacleInterval) {
    RUNNER.obstacleTimer = 0;
    spawnObstacle(C);
  }

  // Mover + colisionar obstáculos
  for (let i = RUNNER.obstacles.length - 1; i >= 0; i--) {
    const o = RUNNER.obstacles[i];
    o.x -= RUNNER.speed * step;
    o.animTick = (o.animTick || 0) + step;
    if (o.x + o.w < -20) { RUNNER.obstacles.splice(i, 1); continue; }

    const margin = 6;
    if (
      p.x + margin < o.x + o.w - margin &&
      p.x + p.w - margin > o.x + margin &&
      p.y + margin < o.y + o.h - margin &&
      p.y + p.h - margin > o.y + margin
    ) {
      if (p.shieldFrames > 0) {
        // El escudo protege golpes (1, o 2 con la mejora "Escudo
        // reforzado") sin importar cuánto timer le quedaba todavía; recién
        // se apaga del todo cuando se le acaban los golpes.
        p.shieldHitsLeft = Math.max(0, (p.shieldHitsLeft || 1) - 1);
        RUNNER.obstacles.splice(i, 1);
        if (p.shieldHitsLeft <= 0) {
          p.shieldFrames = 0;
          p.shield = false;
        }
        continue;
      }
      playerDie();
      return;
    }
  }

  // Spawn de monedas / power-ups
  RUNNER.pickupTimer += step;
  if (RUNNER.pickupTimer >= RUNNER.pickupInterval) {
    RUNNER.pickupTimer = 0;
    if (Math.random() < POWERUP_CHANCE) {
      spawnPowerup(C);
    } else {
      spawnPickupGroup(C);
    }
  }

  // Mover + colisionar monedas / power-ups (no matan, suman puntos o dan buff)
  for (let i = RUNNER.pickups.length - 1; i >= 0; i--) {
    const o = RUNNER.pickups[i];
    o.x -= RUNNER.speed * step;
    if (o.kind === 'coin') {
      o.spinTick = (o.spinTick || 0) + step;
      if (o.spinTick >= 4) { o.spinTick = 0; o.spinFrame = (o.spinFrame + 1) % COIN_SPIN_FRAMES.length; }
    }
    if (o.x + o.w < -20) { RUNNER.pickups.splice(i, 1); continue; }

    if (
      p.x < o.x + o.w &&
      p.x + p.w > o.x &&
      p.y < o.y + o.h &&
      p.y + p.h > o.y
    ) {
      collectPickup(o);
      RUNNER.pickups.splice(i, 1);
    }
  }
}

// Puntaje a partir del cual pueden aparecer obstáculos "en grupo" (varios
// árboles o varios cactus pegados uno al lado del otro).
const OBSTACLE_CLUSTER_MIN_SCORE = 1000;
const OBSTACLE_CLUSTER_CHANCE = 0.25;

function spawnObstacle(C) {
  const groundVariants = groundVariantsForBiome(RUNNER.biome);

  // Después de los 1000 puntos, a veces en vez de un obstáculo suelto sale
  // un grupo de 2 o 3 pegados (todos de la misma familia: árboles en
  // bioma grass, cactus en bioma desert — las rocas quedan afuera de los
  // grupos, van solas).
  if (RUNNER.score >= OBSTACLE_CLUSTER_MIN_SCORE && Math.random() < OBSTACLE_CLUSTER_CHANCE) {
    const family = RUNNER.biome === 'desert' ? CACTUS_VARIANTS : TREE_VARIANTS;
    spawnGroundCluster(C, family);
    return;
  }

  const type = Math.random();
  const groundY = C.height - RUNNER.groundH;
  const skyTop = RUNNER.skyH;

  if (type < 0.45) {
    const h = 36 + Math.floor(Math.random() * 34);
    const w = 20 + Math.floor(Math.random() * 18);
    const variant = groundVariants[Math.floor(Math.random() * groundVariants.length)];
    const y = groundY - h;
    const x = findClearXForObstacle(C.width + 20, y, w, h);
    if (x === null) return; // no había lugar libre de monedas, se salta este spawn
    RUNNER.obstacles.push({ x, y, w, h, kind: 'ground', sprite: variant });
  } else if (type < 0.75) {
    const h = 24 + Math.floor(Math.random() * 16);
    const w = 38 + Math.floor(Math.random() * 26);
    const minY = skyTop + 4;
    const maxY = C.height * 0.45;
    const y = minY + Math.random() * (maxY - minY);
    const x = findClearXForObstacle(C.width + 20, y, w, h);
    if (x === null) return;
    RUNNER.obstacles.push({ x, y, w, h, kind: 'air', animTick: Math.random() * 8 });
  } else {
    const h1 = 32 + Math.floor(Math.random() * 26);
    const variant1 = groundVariants[Math.floor(Math.random() * groundVariants.length)];
    const y1 = groundY - h1;
    const x1 = findClearXForObstacle(C.width + 20, y1, 18, h1);
    if (x1 === null) return;
    RUNNER.obstacles.push({ x: x1, y: y1, w: 18, h: h1, kind: 'ground', sprite: variant1 });
    const h2 = 22;
    const y2 = skyTop + 10 + Math.random() * (C.height * 0.3);
    const x2 = findClearXForObstacle(x1 + 40, y2, 34, h2);
    if (x2 === null) return;
    RUNNER.obstacles.push({ x: x2, y: y2, w: 34, h: h2, kind: 'air', animTick: Math.random() * 8 });
  }
}

// Grupo de obstáculos de piso pegados uno al lado del otro, todos de la
// misma familia (recibida en `familyVariants`: TREE_VARIANTS o
// CACTUS_VARIANTS). 2 o 3 al azar; cada uno con su propio tamaño para que
// no se vea repetido en fila, pero bien juntos entre sí.
function spawnGroundCluster(C, familyVariants) {
  const groundY = C.height - RUNNER.groundH;
  const count = Math.random() < 0.5 ? 2 : 3;
  let cx = C.width + 20;
  for (let i = 0; i < count; i++) {
    const variant = familyVariants[Math.floor(Math.random() * familyVariants.length)];
    const h = 34 + Math.floor(Math.random() * 28);
    const w = 20 + Math.floor(Math.random() * 16);
    const y = groundY - h;
    const x = findClearXForObstacle(cx, y, w, h);
    if (x === null) return; // cortamos el cluster acá, ya quedaron puestos los anteriores
    RUNNER.obstacles.push({ x, y, w, h, kind: 'ground', sprite: variant });
    cx = x + w + 4; // pegaditos, casi sin separación entre uno y el siguiente
  }
}

// Chequea que un rectángulo (con margen extra) no se pise con ningún
// obstáculo actual. Como items y obstáculos viajan siempre a la misma
// velocidad (RUNNER.speed), si están libres al momento de spawnear se
// mantienen libres para siempre — no hace falta re-chequear después.
const PICKUP_OBSTACLE_BUFFER = 18;
function isClearOfObstacles(x, y, w, h) {
  for (let i = 0; i < RUNNER.obstacles.length; i++) {
    const o = RUNNER.obstacles[i];
    if (
      x < o.x + o.w + PICKUP_OBSTACLE_BUFFER &&
      x + w > o.x - PICKUP_OBSTACLE_BUFFER &&
      y < o.y + o.h + PICKUP_OBSTACLE_BUFFER &&
      y + h > o.y - PICKUP_OBSTACLE_BUFFER
    ) return false;
  }
  return true;
}

// Chequeo simétrico al de arriba, pero para el lado de los obstáculos: un
// obstáculo nuevo no debe pisar ninguna moneda/power-up ya existente. Sin
// esto, una tanda de monedas que nació corrida (por el retry de
// spawnPickupGroup) podía terminar exactamente en el borde donde nace el
// próximo obstáculo, y como ambos viajan siempre a la misma velocidad
// quedaban pegados para siempre.
function isClearOfPickups(x, y, w, h) {
  for (let i = 0; i < RUNNER.pickups.length; i++) {
    const o = RUNNER.pickups[i];
    if (
      x < o.x + o.w + PICKUP_OBSTACLE_BUFFER &&
      x + w > o.x - PICKUP_OBSTACLE_BUFFER &&
      y < o.y + o.h + PICKUP_OBSTACLE_BUFFER &&
      y + h > o.y - PICKUP_OBSTACLE_BUFFER
    ) return false;
  }
  return true;
}

// Busca una x libre de monedas/power-ups para un obstáculo, arrancando en
// startX y corriéndose hacia la derecha si hace falta (mismo patrón que
// usan las monedas para evitar obstáculos). Devuelve null si no encontró
// lugar en los intentos permitidos — en ese caso el caller se salta el
// spawn de ese obstáculo puntual.
function findClearXForObstacle(startX, y, w, h) {
  let x = startX;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (isClearOfPickups(x, y, w, h)) return x;
    x += 45;
  }
  return null;
}

// Grupo de monedas (3 a 5) en el suelo o flotando en el cielo — 50/50 al
// azar cuál de las dos. Van en una leve curva (no una fila robótica) para
// que se sientan más naturales al recolectarlas.
function spawnPickupGroup(C) {
  const groundY = C.height - RUNNER.groundH;
  const count = PICKUP_GROUP_MIN + Math.floor(Math.random() * (PICKUP_GROUP_MAX - PICKUP_GROUP_MIN + 1));
  const onGround = Math.random() < 0.5;
  const spacing = 24;
  const itemSize = 15;
  // En el suelo: altura de un salto chico. En el cielo: banda alta, como
  // para tener que saltar a buscarlas.
  const baseY = onGround
    ? groundY - 30
    : RUNNER.skyH + 24 + Math.random() * 40;
  const maxArc = count > 1 ? 12 : 0;
  const groupW = (count - 1) * spacing + itemSize;
  const groupH = itemSize + maxArc;

  // Si el lugar recién generado se pisa con un obstáculo, corremos todo
  // el grupo un poco más a la derecha (más lejos en el spawn) y probamos
  // de nuevo; si después de varios intentos sigue sin haber lugar, mejor
  // no aparece nada esta vez (la próxima tanda lo intenta de nuevo).
  let startX = C.width + 20;
  let clear = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (isClearOfObstacles(startX, baseY - maxArc, groupW, groupH)) { clear = true; break; }
    startX += 45;
  }
  if (!clear) return;

  for (let i = 0; i < count; i++) {
    const arc = count > 1 ? Math.sin((i / (count - 1)) * Math.PI) * maxArc : 0;
    RUNNER.pickups.push({
      x: startX + i * spacing,
      y: baseY - arc,
      w: itemSize, h: itemSize,
      kind: 'coin',
      spinTick: Math.random() * 8,
      spinFrame: Math.floor(Math.random() * COIN_SPIN_FRAMES.length),
    });
  }
}

// Power-up suelto (escudo o x2), flotando en algún punto de la banda
// aérea — aparece solo, al azar, mucho menos seguido que las monedas.
function spawnPowerup(C) {
  const groundY = C.height - RUNNER.groundH;
  const minY = RUNNER.skyH + 10;
  const maxY = groundY - 40;
  const size = 22;
  const y = minY + Math.random() * (maxY - minY);

  let x = C.width + 20;
  let clear = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (isClearOfObstacles(x, y, size, size)) { clear = true; break; }
    x += 45;
  }
  if (!clear) return;

  const type = Math.random() < 0.5 ? 'shield' : 'x2';
  RUNNER.pickups.push({
    x, y, w: size, h: size,
    kind: 'powerup', type,
  });
}

// Efecto al agarrar una moneda o un power-up.
function collectPickup(o) {
  if (o.kind === 'coin') {
    // Las monedas NO suman puntaje — son una moneda de juego aparte,
    // pensada para una futura tienda de mejoras. Se acumulan y se
    // persisten en localStorage al toque (así no se pierden si cierra
    // la pestaña antes del game over).
    RUNNER.coinsRun += COIN_VALUE;
    RUNNER.totalCoins += COIN_VALUE;
    saveTotalCoins(RUNNER.totalCoins);
    // Mientras se juega solo se muestran las monedas de ESTA partida — el
    // total histórico recién se revela al perder (ver playDeathAnimation).
    const coinsEl = document.getElementById('runner-coins-run-display');
    if (coinsEl) coinsEl.textContent = RUNNER.coinsRun;
  } else if (o.kind === 'powerup') {
    if (o.type === 'shield') {
      // Si ya lo tenía activo, suma tiempo en vez de resetearlo (con un
      // tope para que no se vuelva infinito si se juntan muchos seguidos).
      // La duración ya viene con la mejora de nivel aplicada (shieldDurationFrames).
      const p = RUNNER.player;
      p.shieldFrames = Math.min(POWERUP_STACK_CAP, p.shieldFrames + shieldDurationFrames());
      p.shield = true;
      p.shieldHitsLeft = shieldMaxHits(); // agarrar el pickup también "recarga" los golpes que aguanta
    } else if (o.type === 'x2') {
      RUNNER.doublePointsFrames = Math.min(POWERUP_STACK_CAP, RUNNER.doublePointsFrames + doublePointsDurationFrames());
    }
  }
}


// Arranca la secuencia: limpia lo que haya en pantalla (no queremos que
// Junior choque justo cuando ya ganó) y hace aparecer el castillo
// deslizándose desde afuera del canvas.
function startHistoriaWinApproach(C) {
  RUNNER.obstacles = [];
  RUNNER.pickups = [];

  const p = RUNNER.player;
  const img = Engine2D.getImage(RUNNER_ASSETS.castillo);
  const h = CASTLE_TARGET_H;
  const aspect = (img && img.width && img.height) ? (img.width / img.height) : 0.85;
  const w = h * aspect;
  const groundY = C.height - RUNNER.groundH;
  const restX = C.width - w - CASTLE_REST_MARGIN;

  RUNNER.winCastle = {
    x: C.width + 30,
    y: groundY - h + CASTLE_GROUND_OFFSET,
    w, h,
    restX,
    settled: false, // true cuando termina de entrar en cuadro
  };
  RUNNER.winArrived = false;
  p.walkTargetX = restX - CASTLE_DOOR_WALK_GAP; // hasta acá camina Junior antes de "tocar" la puerta

  // Fuerza pasto para el final, sin importar en qué segmento (pasto/desierto)
  // haya caído el score al tocar la meta.
  RUNNER.biome = 'grass';
}

// Update especial mientras dura la secuencia de victoria — reemplaza por
// completo al updateRunner de siempre (sin spawns, sin colisiones, sin
// más puntaje). Primero entra el castillo, recién cuando ya está asentado
// Junior arranca a caminar hacia la puerta.
function updateWinApproach(step, C) {
  const p = RUNNER.player;
  const castle = RUNNER.winCastle;
  if (!castle) return;

  // El cielo/nubes siguen su curso para que la escena no se sienta
  // congelada mientras dura la secuencia.
  RUNNER.sky.t = RUNNER.frameCount % RUNNER.sky.cycleLen;
  RUNNER.sky.clouds.forEach(c => {
    c.x -= c.speed * step;
    if (c.x < -100) c.x = C.width + 40 + Math.random() * 60;
  });

  if (!castle.settled) {
    // Entra a la misma velocidad a la que venían viajando los obstáculos.
    castle.x -= RUNNER.speed * step;
    if (castle.x <= castle.restX) {
      castle.x = castle.restX;
      castle.settled = true;
    }
    // Junior sigue trotando en el lugar mientras tanto.
    p.animTick += step;
    if (p.animTick >= 6) { p.animTick = 0; p.animFrame = (p.animFrame + 1) % RUN_FRAMES.length; }
    return;
  }

  if (RUNNER.winArrived) return; // ya llegó, está esperando el timeout de finishHistoriaWin

  if (p.x < p.walkTargetX) {
    p.x = Math.min(p.walkTargetX, p.x + RUNNER.moveSpeed * CASTLE_WALK_SPEED_MULT * step);
    p.animTick += step;
    if (p.animTick >= 6) { p.animTick = 0; p.animFrame = (p.animFrame + 1) % RUN_FRAMES.length; }
  } else {
    RUNNER.winArrived = true;
    setTimeout(finishHistoriaWin, WIN_APPROACH_PAUSE_MS);
  }
}


const FALL_FRAME_DELAY = 130; // ms entre frames de la animación de choque
const FALL_HOLD_BEFORE_OVERLAY = 300; // ms que se queda en el último frame antes del cartel

function playerDie() {
  const p = RUNNER.player;
  p.dead = true;
  RUNNER.running = false;
  bgMusic.pause();
  if (typeof playDeathSound === 'function') playDeathSound();
  if (RUNNER.loop) RUNNER.loop.stop();

  if (RUNNER.score > RUNNER.bestScore) RUNNER.bestScore = RUNNER.score;
  guardarPuntaje(7, RUNNER.score);

  playDeathAnimation();
}

// Se llama al terminar la secuencia de acercamiento al castillo (ver
// updateWinApproach). A diferencia de playerDie() no hay choque/animación
// de caída: el personaje ya llegó caminando hasta la puerta, y de acá se
// pasa directo al cómic final + cartel de victoria, y de paso se
// desbloquea el Modo Infinito para siempre.
function finishHistoriaWin() {
  const p = RUNNER.player;
  RUNNER.running = false;
  if (RUNNER.loop) RUNNER.loop.stop();
  bgMusic.pause();

  if (RUNNER.score > RUNNER.bestScore) RUNNER.bestScore = RUNNER.score;
  guardarPuntaje(7, RUNNER.score);

  const yaEstabaCompleto = loadHistoriaCompleta();
  saveHistoriaCompleta();

  const sub = yaEstabaCompleto
    ? ('Puntos: ' + RUNNER.score + '  ·  Monedas totales: ' + RUNNER.totalCoins)
    : ('¡Modo Infinito desbloqueado! 🔓  ·  Monedas totales: ' + RUNNER.totalCoins);

  // Cómic final antes del cartel de victoria de siempre.
  showRunnerComic(RUNNER_COMICS.final, () => {
    showRunnerOverlay('🏆 ¡Historia completada!', sub, true, true);
  });
}

// Recorre fall_0..fall_3 a mano (el loop ya está parado) y recién cuando
// termina muestra el cartel de "Game Over" — así el choque se ve como un
// golpe/caída en vez de saltar directo al cartel.
function playDeathAnimation() {
  const p = RUNNER.player;
  let frame = 0;
  p.animFrameName = FALL_FRAMES[0];
  drawRunner(true);

  const step = () => {
    frame++;
    if (frame < FALL_FRAMES.length) {
      p.animFrameName = FALL_FRAMES[frame];
      drawRunner(true);
      setTimeout(step, FALL_FRAME_DELAY);
    } else {
      setTimeout(() => {
        document.getElementById('runnerBest').textContent = 'Mejor: ' + RUNNER.bestScore + ' pts';
        // Al perder recién ahí se muestra el total histórico de monedas
        // (durante la partida el HUD solo mostraba las de esa corrida).
        showRunnerOverlay('¡Game Over!', 'Puntos: ' + RUNNER.score + '  ·  Monedas totales: ' + RUNNER.totalCoins, true);
      }, FALL_HOLD_BEFORE_OVERLAY);
    }
  };
  setTimeout(step, FALL_FRAME_DELAY);
}

// Dibuja el sprite de derrota de Junior (último frame de la caída, ya
// cargado en el atlas) en el mini-canvas del overlay de game over, en vez
// del ícono genérico viejo que había ahí antes.
function drawRunnerCharPreview(victory) {
  const canvas = document.getElementById('runnerCharPreviewCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const juniorImg = Engine2D.getImage(RUNNER_ASSETS.junior);
  const juniorAtlas = Engine2D.getAtlas(RUNNER_ASSETS.juniorAt);
  if (juniorImg && juniorAtlas) {
    // Derrota = último frame de la caída; victoria = pose corriendo (no hay
    // sprite de "festejo" en el atlas, así que reusamos una de correr).
    const frameName = victory ? RUN_FRAMES[0] : FALL_FRAMES[FALL_FRAMES.length - 1];
    const targetH = canvas.height - 4; // margen chico para que no se recorte contra los bordes
    Engine2D.drawAtlasFrame(ctx, juniorImg, juniorAtlas, frameName, canvas.width / 2, canvas.height - 2, targetH, false, false);
  }
}

function showRunnerOverlay(title, sub, isGameover, victory) {
  const overlay = document.getElementById('runnerOverlay');
  overlay.classList.remove('hidden');
  document.getElementById('runnerOverlayTitle').textContent = title;
  document.getElementById('runnerOverlaySub').textContent = sub;
  if (RUNNER.bestScore > 0) {
    document.getElementById('runnerBest').textContent = 'Mejor: ' + RUNNER.bestScore + ' pts';
  }
  if (isGameover) drawRunnerCharPreview(victory);
  const goBtn = document.getElementById('runnerRestartBtn');
  const menuBtn = document.getElementById('runnerMenuBtn');
  if (goBtn) goBtn.style.display = isGameover ? 'inline-block' : 'none';
  if (menuBtn) menuBtn.style.display = isGameover ? 'inline-block' : 'none';
}

function restartRunner() {
  stopRunner();
  setupRunnerInput();
  setupRunnerTouch();
  startRunner();
}

function toRunnerMenu() {
  stopRunner();
  showRunnerMenu();
}

function showRunnerMenu() {
  const menu = document.getElementById('runnerMenu');
  const container = document.querySelector('#sec-runner .runner-container');
  if (menu) menu.classList.remove('hidden');
  if (container) container.classList.remove('hidden');
  const ov = document.getElementById('runnerOverlay');
  if (ov) ov.classList.add('hidden');
  const comicOv = document.getElementById('runnerComicOverlay');
  if (comicOv) comicOv.classList.add('hidden');
  // Por si quedó algún cartel (Mejoras/Ajustes/Cómo jugar) abierto de una
  // visita anterior al menú.
  if (typeof cerrarPanelesRunner === 'function') cerrarPanelesRunner();
  setMusic('assert/pixel runner/sounds/menu.mp3');
}

function startPixelRunnerGame(mode) {
  RUNNER.mode = (mode === 'infinito') ? 'infinito' : 'historia';
  const menu = document.getElementById('runnerMenu');
  if (menu) menu.classList.add('hidden');
  setMusic('assert/pixel runner/sounds/backplay.mp3');
  initRunner();
}

// ─── Dibujo ─────────────────────────────
function drawRunner(dead = false) {
  const C = RUNNER.canvas;
  const ctx = RUNNER.ctx;
  const W = C.width, H = C.height;
  const groundY = H - RUNNER.groundH;
  const skyH = RUNNER.skyH;

  drawSky(ctx, W, H, groundY, skyH);
  const segmentIndex = Math.floor(RUNNER.score / BIOME_SEGMENT);
  const posInSegment = RUNNER.score % BIOME_SEGMENT;
  // El blend solo tiene sentido a partir del 2do segmento en adelante —
  // en el primero (score 0) no hay "bioma anterior" real del que venir,
  // así que sin esta guarda se veía el desierto tapando el pasto al arrancar.
  // Tampoco tiene sentido durante la secuencia del castillo: ahí el bioma
  // queda forzado a pasto (ver startHistoriaWinApproach) y sin esta guarda
  // el degradé de transición pintaba desierto encima igual, calculado a
  // partir del score en vez del bioma real de la escena.
  const groundBlend = (!RUNNER.winCastle && segmentIndex > 0 && posInSegment < GROUND_TRANSITION_RANGE)
    ? 1 - (posInSegment / GROUND_TRANSITION_RANGE)
    : 0;
  drawGroundTexture(ctx, W, groundY, RUNNER.biome, groundBlend);

  // Castillo (secuencia de victoria de Historia) — se dibuja antes que
  // obstáculos/jugador para que quede "de fondo", como un escenario en el
  // que Junior entra caminando.
  if (RUNNER.winCastle) {
    const castleImg = Engine2D.getImage(RUNNER_ASSETS.castillo);
    const c = RUNNER.winCastle;
    if (castleImg) {
      ctx.drawImage(castleImg, c.x, c.y, c.w, c.h);
    } else {
      ctx.fillStyle = '#7a5c3e';
      ctx.fillRect(c.x, c.y, c.w, c.h);
    }
  }

  // Obstáculos
  const obstImg = Engine2D.getImage(RUNNER_ASSETS.obst);
  const obstAtlas = Engine2D.getAtlas(RUNNER_ASSETS.obstAt);
  const birdImg = Engine2D.getImage(RUNNER_ASSETS.bird);
  const birdAtlas = Engine2D.getAtlas(RUNNER_ASSETS.birdAt);

  RUNNER.obstacles.forEach(o => {
    if (o.kind === 'ground' && obstImg && obstAtlas) {
      // El sink es por tipo de sprite: solo visual, hunde el sprite en el
      // piso para que no parezca flotando; la caja de colisión (o.y/o.h)
      // no se toca.
      Engine2D.drawAtlasFrame(ctx, obstImg, obstAtlas, o.sprite, o.x + o.w / 2, o.y + o.h + sinkForSprite(o.sprite), o.h, false, false);
    } else if (o.kind === 'air' && birdImg && birdAtlas) {
      const frameIdx = Math.floor((o.animTick || 0) / 4) % BIRD_FRAMES.length;
      Engine2D.drawAtlasFrame(ctx, birdImg, birdAtlas, BIRD_FRAMES[frameIdx], o.x + o.w / 2, o.y + o.h / 2, o.h, true, true);
    } else {
      // Fallback si los sprites todavía no cargaron
      ctx.fillStyle = o.kind === 'ground' ? '#4b7a3f' : '#c0392b';
      ctx.fillRect(o.x, o.y, o.w, o.h);
    }
  });

  // Monedas y power-ups
  const itemImg = Engine2D.getImage(RUNNER_ASSETS.item);
  const itemAtlas = Engine2D.getAtlas(RUNNER_ASSETS.itemAt);
  RUNNER.pickups.forEach(o => {
    if (itemImg && itemAtlas) {
      if (o.kind === 'coin') {
        Engine2D.drawAtlasFrame(ctx, itemImg, itemAtlas, COIN_SPIN_FRAMES[o.spinFrame], o.x + o.w / 2, o.y + o.h, o.h, false, false);
      } else if (o.type === 'shield') {
        Engine2D.drawAtlasFrame(ctx, itemImg, itemAtlas, 'powerup_shield', o.x + o.w / 2, o.y + o.h, o.h, false, false);
      } else if (o.type === 'x2') {
        Engine2D.drawAtlasFrame(ctx, itemImg, itemAtlas, 'powerup_x2', o.x + o.w / 2, o.y + o.h, o.h, false, false);
      }
    } else {
      ctx.fillStyle = o.kind === 'coin' ? '#f4c430' : (o.type === 'shield' ? '#3b82f6' : '#f97316');
      ctx.beginPath();
      ctx.arc(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Jugador
  const p = RUNNER.player;

  // Aura del escudo: usa los frames de brillo del item.png como un pulso
  // detrás del personaje mientras el power-up está activo.
  if (p.shield && itemImg && itemAtlas) {
    const shimmerIdx = Math.floor(RUNNER.frameCount / 4) % SHIELD_SHIMMER_FRAMES.length;
    ctx.save();
    ctx.globalAlpha = 0.75;
    Engine2D.drawAtlasFrame(ctx, itemImg, itemAtlas, SHIELD_SHIMMER_FRAMES[shimmerIdx], p.x + p.w / 2, p.y + p.h / 2, p.h * 1.6, false, true);
    ctx.restore();
  }

  const juniorImg = Engine2D.getImage(RUNNER_ASSETS.junior);
  const juniorAtlas = Engine2D.getAtlas(RUNNER_ASSETS.juniorAt);
  if (juniorImg && juniorAtlas) {
    const onGround = p.y >= p.groundY - 0.5;
    const frameName = dead
      ? (p.animFrameName || 'fall_0')
      : (!RUNNER.started ? RUN_FRAMES[0] : (onGround ? RUN_FRAMES[p.animFrame] : 'action_2')); // action_2 ~ pose de salto
    Engine2D.drawAtlasFrame(ctx, juniorImg, juniorAtlas, frameName, p.x + p.w / 2, p.y + p.h, p.h, p.facing === -1, false);
  } else {
    ctx.fillStyle = dead ? '#7a2020' : '#2563eb';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }

  // Velocidad en pantalla (además del HTML de afuera). El contador de
  // monedas se sacó de acá — se ve pixeleado al dibujarse con fillText
  // dentro del canvas escalado; ahora vive como HTML debajo del contador
  // de puntos (.runner-coins-display, ver index.html).
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Vel: ' + RUNNER.speed.toFixed(1), 6, 16);

  // Indicador de x2 activo (arriba a la derecha)
  if (RUNNER.doublePointsFrames > 0) {
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('x' + runnerScoreMultiplier() + ' puntos', W - 6, 16);
  }

  // Controles táctiles — SIEMPRE al final, como overlay encima de todo.
  if (RUNNER.touch) RUNNER.touch.draw(ctx);
}

// ─── Cielo: fondo interpolado + sol/luna en arco + nubes + estrellas ───
function lerp(a, b, t) { return a + (b - a) * t; }

function lerpColorHex(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(lerp(ar, br, t)), g = Math.round(lerp(ag, bg, t)), bl = Math.round(lerp(ab, bb, t));
  return `rgb(${r},${g},${bl})`;
}

// Tilea horizontalmente un frame del atlas (usado para la franja de
// estrellas y para la textura del piso, que son mucho más angostos que
// el ancho del canvas).
function drawTiledFrame(ctx, img, atlas, frameName, x, y, width, height) {
  const f = atlas.frames[frameName];
  if (!f) return;
  if (!RUNNER._cachedTiles) RUNNER._cachedTiles = {};
  const cacheKey = frameName + '_' + Math.round(width) + '_' + Math.round(height);
  
  if (!RUNNER._cachedTiles[cacheKey]) {
    const cvs = document.createElement('canvas');
    cvs.width = Math.ceil(width);
    cvs.height = Math.ceil(height);
    const cctx = cvs.getContext('2d');
    const tileW = height * (f.w / f.h);
    let cx = 0;
    while (cx < width) {
      const w = Math.min(tileW, width - cx) + 1;
      cctx.drawImage(img, f.x, f.y, f.w * (w / tileW), f.h, Math.round(cx), 0, Math.ceil(w), height);
      cx += tileW;
    }
    RUNNER._cachedTiles[cacheKey] = cvs;
  }
  ctx.drawImage(RUNNER._cachedTiles[cacheKey], Math.round(x), Math.round(y));
}

function drawSky(ctx, W, H, groundY, skyH) {
  const sky = RUNNER.sky;
  const phase = sky.t / sky.cycleLen;         // 0..1, ciclo completo
  const dayProgress = (phase % 0.5) / 0.5;    // 0..1 dentro de la mitad actual (día o noche)
  const isDay = phase < 0.5;

  // Luz ambiente: 1 = pleno día, 0 = plena noche. Con esta única curva
  // continua el amanecer/atardecer sale gratis (no hay "corte" al cambiar
  // de mitad, todo es una interpolación suave).
  const L = (Math.cos(2 * Math.PI * (phase - 0.25)) + 1) / 2;

  // Fondo: 3 franjas interpoladas con offscreen canvas para no recrear gradientes cada frame
  const nightColors = ['#0d1b2a', '#162032', '#1a2a1a'];
  const dayColors   = ['#7ec8e3', '#bfe3e0', '#cfe8b0'];
  
  if (!RUNNER._bgNight) {
    RUNNER._bgNight = document.createElement('canvas');
    RUNNER._bgNight.width = W; RUNNER._bgNight.height = H;
    const nctx = RUNNER._bgNight.getContext('2d');
    const nbg = nctx.createLinearGradient(0, 0, 0, H);
    nbg.addColorStop(0, nightColors[0]); nbg.addColorStop(0.6, nightColors[1]); nbg.addColorStop(1, nightColors[2]);
    nctx.fillStyle = nbg; nctx.fillRect(0, 0, W, H);

    RUNNER._bgDay = document.createElement('canvas');
    RUNNER._bgDay.width = W; RUNNER._bgDay.height = H;
    const dctx = RUNNER._bgDay.getContext('2d');
    const dbg = dctx.createLinearGradient(0, 0, 0, H);
    dbg.addColorStop(0, dayColors[0]); dbg.addColorStop(0.6, dayColors[1]); dbg.addColorStop(1, dayColors[2]);
    dctx.fillStyle = dbg; dctx.fillRect(0, 0, W, H);
  }

  // Dibujar base de noche
  ctx.drawImage(RUNNER._bgNight, 0, 0);
  
  // Superponer día con alpha (muchísimo más rápido que lerpColorHex)
  if (L > 0.01) {
    ctx.save();
    ctx.globalAlpha = L;
    ctx.drawImage(RUNNER._bgDay, 0, 0);
    ctx.restore();
  }

  // Estrellas — solo de noche, se desvanecen con L (más L = más de día = menos visibles)
  const mapaImg = Engine2D.getImage(RUNNER_ASSETS.mapa);
  const mapaAtlas = Engine2D.getAtlas(RUNNER_ASSETS.mapaAt);
  if (mapaImg && mapaAtlas && L < 0.6) {
    ctx.save();
    ctx.globalAlpha = (0.6 - L) / 0.6; // 1 en plena noche, 0 apenas empieza a clarear
    // Eliminado el ctx.clip() porque consumía mucha CPU y las estrellas ya están acotadas a Y=50
    drawTiledFrame(ctx, mapaImg, mapaAtlas, 'stars_dense', 0, skyH + 4, W, 50);
    ctx.restore();
  }

  // Sol (mitad día) / Luna (mitad noche) — arco simple: más alto al
  // mediodía/medianoche, bajo cerca del horizonte al salir/ponerse.
  if (mapaImg && mapaAtlas) {
    const elevation = Math.sin(Math.PI * dayProgress); // 0 en los bordes, 1 en el punto más alto
    const arcX = lerp(30, W - 30, dayProgress);
    const arcY = lerp(skyH + 55, skyH + 8, elevation);
    const frames = isDay ? SUN_FRAMES : MOON_FRAMES;
    const frameIdx = Math.floor(sky.t / 40) % frames.length;
    ctx.save();
    ctx.globalAlpha = Math.max(0.15, elevation);
    Engine2D.drawAtlasFrame(ctx, mapaImg, mapaAtlas, frames[frameIdx], arcX, arcY, 26, false, true);
    ctx.restore();
  }

  // Nubes — parallax lento, un poco más tenues de noche
  if (mapaImg && mapaAtlas) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * L;
    sky.clouds.forEach(c => {
      Engine2D.drawAtlasFrame(ctx, mapaImg, mapaAtlas, CLOUD_FRAMES[c.frame % CLOUD_FRAMES.length], c.x, c.y, 20, false, false);
    });
    ctx.restore();
  }
}

// Los primeros GROUND_TRANSITION_RANGE puntos de cada bioma nuevo, el piso
// hace un crossfade del bioma anterior al nuevo en vez de cambiar de
// golpe — se dibuja el piso nuevo de base y se le superpone el viejo con
// alpha decreciente hasta que se termina de "desvanecer".
const GROUND_TRANSITION_RANGE = 60;

function drawGroundTexture(ctx, W, groundY, biome, blend) {
  const mapaImg = Engine2D.getImage(RUNNER_ASSETS.mapa);
  const mapaAtlas = Engine2D.getAtlas(RUNNER_ASSETS.mapaAt);
  const frameName = biome === 'desert' ? 'ground_desert' : 'ground_grass';
  const prevFrameName = biome === 'desert' ? 'ground_grass' : 'ground_desert';

  if (mapaImg && mapaAtlas) {
    drawTiledFrame(ctx, mapaImg, mapaAtlas, frameName, 0, groundY, W, RUNNER.groundH);
    if (blend > 0.001) {
      ctx.save();
      ctx.globalAlpha = blend;
      drawTiledFrame(ctx, mapaImg, mapaAtlas, prevFrameName, 0, groundY, W, RUNNER.groundH);
      ctx.restore();
    }
  } else {
    const currentColor = biome === 'desert' ? '#5a4a2f' : '#22331f';
    const prevColor = biome === 'desert' ? '#22331f' : '#5a4a2f';
    ctx.fillStyle = currentColor;
    ctx.fillRect(0, groundY, W, RUNNER.groundH);
    if (blend > 0.001) {
      ctx.save();
      ctx.globalAlpha = blend;
      ctx.fillStyle = prevColor;
      ctx.fillRect(0, groundY, W, RUNNER.groundH);
      ctx.restore();
    }
  }
}
