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

// Espacio LÓGICO del juego: todas las constantes de abajo (player.w/h,
// corridorMinX/MaxX, groundH, skyH, posiciones de spawn…) son píxeles
// pensados para este tamaño fijo. El canvas REAL puede ser más chico
// (calidad Baja/Media bajan la resolución con un ctx.scale — ver
// applyRunnerCanvasScale en runner_loop.js); nada del juego se entera.
export const VIEW_W = 480;
export const VIEW_H = 270;

export const RUNNER = {
  canvas: null, ctx: null,
  // Lo que antes se leía como RUNNER.canvas (C.width/C.height) para
  // posicionar cosas: ahora es el espacio lógico, no el canvas real.
  view: { width: VIEW_W, height: VIEW_H },
  loop: null,
  input: null,
  touch: null,
  running: false,
  started: false, // false = esperando el primer input del jugador (personaje quieto, nada se mueve)
  mode: 'historia', // 'historia' (meta 2500 pts) | 'infinito' (sin límite, desbloqueado al completar historia)
  score: 0, bestScore: 0,
  speed: 5, baseSpeed: 5,
  // naturalSpeed = la velocidad "de verdad" según el puntaje (sube +0.8
  // cada 250 pts). RUNNER.speed es la velocidad EFECTIVA a la que scrollea
  // todo — normalmente igual a naturalSpeed, pero el power-up de "reducir
  // velocidad" la baja mientras dura y, al acabarse, no vuelve de golpe:
  // sube solita hasta empatar con naturalSpeed (ver SLOWSPEED_RECOVER_STEP
  // en updateRunner).
  naturalSpeed: 5,
  slowSpeedFrames: 0, // > 0 mientras el power-up de velocidad reducida está activo
  frameCount: 0,
  obstacleTimer: 0, obstacleInterval: 90,

  // Corredor de movimiento lateral (coordenadas de mundo = canvas, 480x270)
  corridorMinX: 20,
  corridorMaxX: 190,
  moveSpeed: 2.6, // px por "step" (step = dt/16.6, ver Engine2D.GameLoop)

  // Personaje
  // JUNIOR_GROUND_SINK: puramente visual — el sprite de junior.webp tiene
  // un margen de aire debajo de los pies dentro de su propio recorte
  // (así viene el atlas), así que anclado 1:1 al hitbox se veía flotando
  // sobre el piso. Esto baja SOLO el dibujo unos píxeles; el hitbox
  // (p.y/p.h, colisiones, groundY) queda intacto. Si en el juego real
  // todavía se ve un pelín despegado o ya clavado en el piso, este es el
  // único número a tocar.
  player: {
    x: 90, y: 0, w: 29, h: 34,
    vy: 0, jumps: 0, maxJumps: 2,
    dead: false, animFrame: 0, animTick: 0,
    groundY: 0,
    facing: 1, // 1 = mirando derecha (default), -1 = mirando izquierda
    shield: false, // true mientras el power-up de escudo está activo (ver shieldFrames)
    shieldFrames: 0, // frames restantes del escudo — 0 = apagado
    shieldHitsLeft: 0, // golpes que el escudo todavía puede absorber (1, o 2 con la mejora "Escudo reforzado")
    slowFallFrames: 0, // > 0 mientras el power-up de caída lenta está activo (gravedad reducida, ver SLOWFALL_GRAVITY_MULT)
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
  // Lluvia: rainActive/rainTimer siguen el mismo patrón que los power-ups
  // (frames restantes, 0 = apagado). rainNextCheck es el próximo puntaje
  // donde se vuelve a tirar el dado.
  rainActive: false,
  rainTimer: 0,
  rainNextCheck: 250,
  rainDrops: [],
  rainSplashes: [],

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
  rainSplash: RUNNER_ASSET_BASE + 'models/rain_splash.webp',
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
  // HUD: multiplicador de puntos (al lado de Puntos) y power-up activo
  // (debajo de Monedas) — ver runnerUpdateHudBadges() en runner_loop.js.
  multiplierDisplay: document.getElementById('runner-multiplier-display'),
  activePowerupDisplay: document.getElementById('runner-active-powerup-display'),
  pauseBtn: document.getElementById('runnerHudPauseBtn'),
};

// El botón de pausa (arriba a la derecha del canvas) tiene que verse SOLO
// mientras hay una partida en curso — antes su z-index quedaba por encima
// de los menús/paneles (que tienen el suyo más bajo) y terminaba
// clickeable incluso parado en el menú principal, Mejoras, Ajustes o Cómo
// jugar. Se llama en cada transición de RUNNER.running (ver startRunner,
// stopRunner, playerDie, finishHistoriaWin).
export function runnerSyncPauseBtn() {
  const btn = RUNNER_EL.pauseBtn;
  if (btn) btn.classList.toggle('hidden', !RUNNER.running);
}


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
// Antes moon_0..3 eran 4 variantes de la MISMA fase (como sun_0..3, un
// shimmer sutil). El spritesheet nuevo trae dos fases distintas: 0/1 =
// media luna, 2/3 = luna llena. Cada noche del ciclo día/noche elige una
// fase al azar (ver drawSky) y anima dentro de ese par de 2 frames — así
// hay variedad entre una noche y otra sin complicar el resto del código.
export const MOON_PHASES = {
  half: ['moon_0', 'moon_1'],
  full: ['moon_2', 'moon_3'],
};
export const FALL_FRAMES = ['fall_0','fall_1','fall_2','fall_3']; // animación de choque/caída al morir — usada en playDeathAnimation
export const CLOUD_FRAMES = ['cloud_0','cloud_1','cloud_2','cloud_3'];
// Nubes oscuras (mismas siluetas, tono de tormenta) para la noche — cada
// índice combina con el CLOUD_FRAMES del mismo número, así que cambiar de
// array no le mueve el piso a las nubes que ya están en pantalla.
export const CLOUD_DARK_FRAMES = ['cloud_dark_0','cloud_dark_1','cloud_dark_2','cloud_dark_3'];

// ─── Items: monedas + power-ups (item.webp / item.atlas.json) ──────────
// Spritesheet nuevo: la moneda ahora gira en 5 frames (antes 8) y hay 2
// power-ups nuevos (caída lenta / velocidad reducida), más un ícono propio
// para el x2 y otro para cuando ya está mejorado a x3 (ver
// trGetRunnerUpgrades().x2Triple en runner_render.js).
export const COIN_SPIN_FRAMES = ['coin_0','coin_1','coin_2','coin_3','coin_4'];
export const SHIELD_SHIMMER_FRAMES = ['shield_shimmer_0','shield_shimmer_1','shield_shimmer_2','shield_shimmer_3','shield_shimmer_4'];

export const COIN_VALUE = 1;                     // monedas que suma cada moneda agarrada (moneda-juego, no puntaje)
export const PICKUP_GROUP_MIN = 3, PICKUP_GROUP_MAX = 5; // cantidad de monedas por tanda
export const POWERUP_CHANCE = 0.16;              // probabilidad de que la tanda sea un power-up en vez de monedas
export const DOUBLE_POINTS_DURATION = 900;       // "frames" (step≈1/frame, ~15s) que dura el x2
export const SHIELD_DURATION = 900;              // ídem para el escudo (~15s) — protege 1 solo golpe dentro de esa ventana
// Duración base (sin mejoras) de los dos power-ups nuevos, en "frames de
// 60fps" — mismo criterio que el resto (60 unidades ≈ 1 segundo real).
export const SLOWFALL_DURATION = 600;   // 10s
export const SLOWSPEED_DURATION = 600;  // 10s
export const POWERUP_STACK_CAP = 900 * 2;        // tope al acumular duración (no deja pasar de ~30s)

// Cuánto suma cada nivel de mejora a la duración (ver runner_economy.js):
// caída lenta sube 2s por nivel (10 niveles → hasta 30s), velocidad
// reducida sube 1s por nivel (10 niveles → hasta 20s, reusa
// UPGRADE_DURATION_STEP porque es el mismo +1s/nivel que escudo y x2).
export const SLOWFALL_DURATION_STEP = 120; // 2s

// Caída lenta: multiplica la gravedad mientras dura (0.55 = cae bastante
// más despacio, sin llegar a flotar del todo).
export const SLOWFALL_GRAVITY_MULT = 0.55;

// Velocidad reducida: mientras dura, RUNNER.speed queda en este % de
// naturalSpeed. Base = -25% (queda al 75%); con la mejora especial
// "Frenada Fuerte" comprada, pasa a -50% (queda al 50%) — ver
// slowSpeedFactor() en runner_economy.js.
export const SLOWSPEED_FACTOR_BASE = 0.75;
export const SLOWSPEED_FACTOR_STRONG = 0.50;
// Al acabarse el power-up, sube de a este paso por step hasta volver a
// empatar con naturalSpeed — "sube lentamente", no de golpe.
export const SLOWSPEED_RECOVER_STEP = 0.003; // ~2.5s en volver a la velocidad normal

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
export const UPGRADE_SLOWSPEED_STRONG_COST = 1200; // "Frenada Fuerte": -25% -> -50%

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

// Ver el comentario en RUNNER.player más arriba — ajuste puramente visual.
// Con el sprite viejo esto era una adivinanza (no tenía el .png a mano
// para medir el recorte real). Con el sprite nuevo (junior.webp
// reempaquetado con recorte ajustado — sin aire de sobra debajo de los
// pies) medí que en 0 los pies ya tocan justo el borde del pasto; este
// valor es el "un poco más abajo" que se pidió a propósito, para que
// queden levemente metidos en el pasto en vez de apenas rozándolo.
export const JUNIOR_GROUND_SINK = 6;

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

// ─── Lluvia (evento de clima, no es un power-up) ───────────────────────
// Cada RAIN_CHECK_INTERVAL puntos (250, 500, 750...) hay RAIN_CHANCE de
// que empiece a llover, PERO solo se tira el dado en los checkpoints
// donde todavía no llovió — si sale que no, se reintenta en el próximo
// checkpoint (no se vuelve a tirar en el medio). Mientras llueve: el
// salto rinde menos (RAIN_JUMP_MULT) y las nubes pasan a la variante
// oscura aunque sea de día.
export const RAIN_CHECK_INTERVAL = 250;
export const RAIN_CHANCE = 0.25;
export const RAIN_DURATION = 1200; // 20s (60 unidades ≈ 1s, mismo criterio que el resto)
export const RAIN_JUMP_MULT = 0.75; // -25% de altura de salto mientras llueve

// Densidad de gotas por calidad gráfica — fracción de RAIN_BASE_COUNT que
// se dibuja. En medio/bajo además se apaga el splash contra el piso (la
// textura RainOnFloor), no solo hay menos gotas.
export const RAIN_BASE_COUNT = 40;
export const RAIN_DENSITY = { low: 0.25, medium: 0.5, high: 1 };
export const RAIN_DROP_SPEED = 5.2;   // px por step, caída
export const RAIN_DROP_WIND = -0.6;   // deriva lateral (lluvia en diagonal)
export const RAIN_SPLASH_LIFE = 14;   // "steps" (≈0.23s a 60fps) que dura el splash contra el piso
// Antes quedaba 4px por ARRIBA del punto de impacto (se veía flotando
// sobre el pasto en vez de pegado al piso) — bajado a 1px.
export const RAIN_SPLASH_GROUND_OFFSET = 1;

export const OBSTACLE_CLUSTER_MIN_SCORE = 1000;
export const OBSTACLE_CLUSTER_CHANCE = 0.25;

export const PICKUP_OBSTACLE_BUFFER = 18;
export const FALL_FRAME_DELAY = 130; // ms entre frames de la animación de choque
export const FALL_HOLD_BEFORE_OVERLAY = 300; // ms que se queda en el último frame antes del cartel

// Antes 60 (~6 segundos reales a la velocidad de arranque) — se sentía
// lentísimo para un juego de correr. El barrido de bioma ahora se
// completa en esta ventana de puntos; a la velocidad base son ~1.5s.
export const GROUND_TRANSITION_RANGE = 18;

