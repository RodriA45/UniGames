// ══════════════════════════════════════
//   Pixel Runner — runner_config.js  (módulo ES6)
// ══════════════════════════════════════
// Estado global (RUNNER), assets, referencias al DOM (RUNNER_EL) y todas
// las constantes de tuning del juego (economía, spawn, física, secuencia
// de victoria). A diferencia de castle_config.js, acá no hace falta
// ningún import circular: el GameLoop de Pixel Runner se arma recién
// adentro de startRunner() (runner_loop.js), no a nivel de módulo.

export const RUNNER_ASSET_BASE = 'src/motor2d/games/pixel-runner/';

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

export const RUNNER = {
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

export const RUNNER_ASSETS = {
  junior:    RUNNER_ASSET_BASE + 'models/junior.webp',
  juniorAt:  RUNNER_ASSET_BASE + 'models/junior.atlas.json',
  bird:      RUNNER_ASSET_BASE + 'models/bird.webp',
  birdAt:    RUNNER_ASSET_BASE + 'models/bird.atlas.json',
  obst:      RUNNER_ASSET_BASE + 'models/obstaculo.webp',
  obstAt:    RUNNER_ASSET_BASE + 'models/obstaculo.atlas.json',
  mapa:      RUNNER_ASSET_BASE + 'models/mapa.webp',
  mapaAt:    RUNNER_ASSET_BASE + 'models/mapa.atlas.json',
  item:      RUNNER_ASSET_BASE + 'models/item.webp',
  itemAt:    RUNNER_ASSET_BASE + 'models/item.atlas.json',
  castillo:  RUNNER_ASSET_BASE + 'models/castillo.webp',
};

// Cómics del Modo Historia: uno al elegir el modo (antes de arrancar la
// partida) y otro al llegar a HISTORIA_GOAL (antes del cartel de victoria).
export const RUNNER_COMICS = {
  intro: RUNNER_ASSET_BASE + 'comics/historia_intro.webp',
  final: RUNNER_ASSET_BASE + 'comics/historia_final.webp',
};

// ═══════════════════════════════════════════════
//   Caché del DOM
// ═══════════════════════════════════════════════
// Mismo criterio que RPG_EL en rpg.js: buscar cada elemento UNA sola vez
// (el script carga al final del <body>, con el HTML ya presente) en vez
// de llamar document.getElementById(...) cada vez que se actualiza el
// overlay, el score, etc. RUNNER.canvas/ctx quedan como estaban (se
// asignan en runnerInit, no hace falta moverlos).
export const RUNNER_EL = {
  overlay: document.getElementById('runnerOverlay'),
  overlayTitle: document.getElementById('runnerOverlayTitle'),
  overlaySub: document.getElementById('runnerOverlaySub'),
  restartBtn: document.getElementById('runnerRestartBtn'),
  comicOverlay: document.getElementById('runnerComicOverlay'),
  comicImg: document.getElementById('runnerComicImg'),
  best: document.getElementById('runnerBest'),
  scoreDisplay: document.getElementById('runner-score-display'),
  coinsRunDisplay: document.getElementById('runner-coins-run-display'),
  menuBtn: document.getElementById('runnerMenuBtn'),
  menu: document.getElementById('runnerMenu'),
  section: document.getElementById('sec-runner'),
  charPreviewCanvas: document.getElementById('runnerCharPreviewCanvas'),
};


// Muestra un cómic a pantalla completa dentro del runner-container y
// ejecuta `onContinue` cuando el jugador toca "Continuar". Se guarda el
// callback en RUNNER para que runnerComicContinuar() (llamado desde el
// botón en el HTML) sepa qué hacer al cerrar.
export function showRunnerComic(src, onContinue) {
  const overlay = RUNNER_EL.comicOverlay;
  const img = RUNNER_EL.comicImg;
  if (!overlay || !img) { onContinue(); return; }
  img.src = src;
  RUNNER.comicCallback = onContinue;
  overlay.classList.remove('hidden');
}

export function runnerComicContinuar() {
  const overlay = RUNNER_EL.comicOverlay;
  if (overlay) overlay.classList.add('hidden');
  const cb = RUNNER.comicCallback;
  RUNNER.comicCallback = null;
  if (typeof cb === 'function') cb();
}

export const TREE_VARIANTS = ['tree_small', 'tree_medium', 'tree_large'];
export const CACTUS_VARIANTS = ['cactus_small', 'cactus_medium', 'cactus_large'];
export const ROCK_VARIANTS = ['rock_small', 'rock_medium', 'rock_large'];
export const BIRD_FRAMES = ['flap_0','flap_1','flap_2','flap_3','flap_4','flap_5','flap_6','flap_7'];
export const RUN_FRAMES = ['run_0','run_1','run_2','run_3','run_4','run_5','run_6'];
export const SUN_FRAMES = ['sun_0','sun_1','sun_2','sun_3'];
export const MOON_FRAMES = ['moon_0','moon_1','moon_2','moon_3'];
export const FALL_FRAMES = ['fall_0','fall_1','fall_2','fall_3']; // animación de choque/caída al morir — usada en playDeathAnimation
export const CLOUD_FRAMES = ['cloud_0','cloud_1','cloud_2','cloud_3'];

// ─── Items: monedas + power-ups (item.png / item.atlas.json) ──────────
export const COIN_SPIN_FRAMES = ['coin_0','coin_1','coin_2','coin_3','coin_4','coin_5','coin_6','coin_7'];
export const SHIELD_SHIMMER_FRAMES = ['shield_shimmer_0','shield_shimmer_1','shield_shimmer_2','shield_shimmer_3','shield_shimmer_4'];

export const COIN_VALUE = 1;                     // monedas que suma cada moneda agarrada (moneda-juego, no puntaje)
export const PICKUP_GROUP_MIN = 3, PICKUP_GROUP_MAX = 5; // cantidad de monedas por tanda
export const POWERUP_CHANCE = 0.16;              // probabilidad de que la tanda sea un power-up en vez de monedas
export const DOUBLE_POINTS_DURATION = 900;       // "frames" (step≈1/frame, ~15s) que dura el x2
export const SHIELD_DURATION = 900;              // ídem para el escudo (~15s) — protege 1 solo golpe dentro de esa ventana
export const POWERUP_STACK_CAP = 900 * 2;        // tope al acumular duración (no deja pasar de ~30s)

// Monedas: son una moneda de juego aparte del puntaje (pensadas para una
// futura tienda de mejoras), así que NO tocan RUNNER.score — se acumulan
// en RUNNER.coinsRun (la partida actual) y en RUNNER.totalCoins, que se
// persiste en localStorage y sobrevive a game overs / recargas de página.
export const COINS_STORAGE_KEY = 'pixelRunnerCoins';
export const UPGRADE_MAX_LEVEL = 10;
export const UPGRADE_LEVEL_COSTS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]; // costo del nivel N = UPGRADE_LEVEL_COSTS[N-1]
export const UPGRADE_DURATION_STEP = 60; // frames por nivel — 60 steps ≈ 1s a 60fps (ver GameLoop en engine2d.js)
export const UPGRADE_SHIELD_HITS_COST = 1000;
export const UPGRADE_X2_TRIPLE_COST = 1500;

export const UPGRADES_STORAGE_KEY = 'pixelRunnerUpgrades';

export const HISTORIA_GOAL = 2500;
export const HISTORIA_STORAGE_KEY = 'pixelRunnerHistoriaCompleta';
export function runnerScoreText(score) {
  return RUNNER.mode === 'historia' ? (score + ' / ' + HISTORIA_GOAL) : String(score);
}

// ─── Secuencia de victoria de Modo Historia ────────────────────────────
// Al llegar a HISTORIA_GOAL no se corta directo al cómic: el castillo
// entra deslizándose desde la derecha y, ya asentado, Junior camina hasta
// la puerta. Recién ahí arranca el cómic final + cartel de victoria (ver
// startHistoriaWinApproach / updateWinApproach / finishHistoriaWin).
export const CASTLE_TARGET_H = 210;          // alto del sprite dibujado en el canvas (270 de alto total)
export const CASTLE_REST_MARGIN = 10;        // separación del castillo respecto al borde derecho del canvas al asentarse
export const CASTLE_GROUND_OFFSET = 25;      // px que se hunde el sprite respecto a groundY, para compensar el margen transparente del PNG y que quede pegado al piso en vez de flotando — ajustar a ojo si no queda perfecto
export const CASTLE_DOOR_WALK_GAP = 90;      // hasta cuándo camina Junior antes de "tocar" la puerta (subido para que la caminata final no se sienta instantánea con CASTLE_WALK_SPEED_MULT)
export const CASTLE_WALK_SPEED_MULT = 5;     // velocidad de Junior caminando hacia la puerta = moveSpeed x este valor
export const WIN_APPROACH_PAUSE_MS = 550;    // pausa breve al llegar a la puerta, antes de mostrar el cómic final

// Variantes de obstáculo "de piso" según bioma — árboles solo en pasto,
// cactus solo en desierto; las rocas son neutras y salen en los dos.
export function groundVariantsForBiome(biome) {
  return biome === 'desert'
    ? CACTUS_VARIANTS.concat(ROCK_VARIANTS)
    : TREE_VARIANTS.concat(ROCK_VARIANTS);
}

// Cuántos px "hundir" el sprite del obstáculo respecto a su caja de
// colisión al dibujarlo, para que la base quede pisando el piso en vez de
// flotar sobre él (el padding transparente de cada frame del atlas es
// distinto por tipo, así que cada familia necesita su propio ajuste). Es
// puramente visual, no mueve la caja de colisión real.
export const GROUND_OBSTACLE_SINK = {
  tree_small: 5, tree_medium: 5, tree_large: 5,
  cactus_small: 5, cactus_medium: 5, cactus_large: 5,
  rock_small: 14, rock_medium: 14, rock_large: 14,
};
export function sinkForSprite(sprite) {
  return GROUND_OBSTACLE_SINK[sprite] != null ? GROUND_OBSTACLE_SINK[sprite] : 5;
}

// Duración (en puntos) de cada bioma y de cada mitad día/noche dentro de
// ese bioma — ver updateRunner para cómo se derivan de RUNNER.score.
export const BIOME_SEGMENT = 500;
export const DAY_HALF = 250;

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

export const GRAVITY = 0.09;

export const OBSTACLE_CLUSTER_MIN_SCORE = 1000;
export const OBSTACLE_CLUSTER_CHANCE = 0.25;

export const PICKUP_OBSTACLE_BUFFER = 18;
export const FALL_FRAME_DELAY = 130; // ms entre frames de la animación de choque
export const FALL_HOLD_BEFORE_OVERLAY = 300; // ms que se queda en el último frame antes del cartel

export const GROUND_TRANSITION_RANGE = 60;

