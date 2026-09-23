// ══════════════════════════════════════
//   Pixel Runner — runner_config.js  (módulo ES6)
// ══════════════════════════════════════
// Configuración del juego y caché del DOM, como clases:
//   - RunnerConfig → solo miembros static (no se instancia): constantes de
//                    tuning (física, economía, spawn, clima, victoria),
//                    rutas de assets y helpers puros.
//   - RunnerDOM    → busca UNA sola vez cada elemento del HTML del juego.
//
// El estado de la partida (lo que antes era el objeto global RUNNER) ya
// no vive acá: es de la clase PixelRunner (runner_loop.js).
//
// ─── Mecánica: movimiento izquierda/derecha acotado ───────────────────
// El jugador y los obstáculos viajan sobre el mismo eje X, así que
// moverse no te saca del "camino" del obstáculo. Retroceder = más frames
// de reacción; avanzar = te adelantás a un combo apretado. El corredor
// tiene paredes invisibles (corridorMinX/MaxX en PixelRunner).

export class RunnerConfig {
  static ASSET_BASE = 'src/motor2d/games/pixel-runner/';

  // Espacio LÓGICO del juego: todo se posiciona en 480x270. El canvas REAL
  // puede ser más chico según la calidad (ver PixelRunner.aplicarEscalaCanvas).
  static VIEW_W = 480;
  static VIEW_H = 270;

  static ASSETS = {
    junior:    RunnerConfig.ASSET_BASE + 'models/junior.webp',
    juniorAt:  RunnerConfig.ASSET_BASE + 'models/junior.atlas.json',
    bird:      RunnerConfig.ASSET_BASE + 'models/bird.webp',
    birdAt:    RunnerConfig.ASSET_BASE + 'models/bird.atlas.json',
    obst:      RunnerConfig.ASSET_BASE + 'models/obstaculo.webp',
    obstAt:    RunnerConfig.ASSET_BASE + 'models/obstaculo.atlas.json',
    mapa:      RunnerConfig.ASSET_BASE + 'models/mapa.webp',
    mapaAt:    RunnerConfig.ASSET_BASE + 'models/mapa.atlas.json',
    item:      RunnerConfig.ASSET_BASE + 'models/item.webp',
    itemAt:    RunnerConfig.ASSET_BASE + 'models/item.atlas.json',
    castillo:  RunnerConfig.ASSET_BASE + 'models/castillo.webp',
    rainSplash: RunnerConfig.ASSET_BASE + 'models/rain_splash.webp',
  };

  // Cómics del Modo Historia: al elegir el modo y al llegar a la meta.
  static COMICS = {
    intro: RunnerConfig.ASSET_BASE + 'comics/historia_intro.webp',
    final: RunnerConfig.ASSET_BASE + 'comics/historia_final.webp',
  };

  // ─── Sprites ───
  static TREE_VARIANTS = ['tree_small', 'tree_medium', 'tree_large'];
  static CACTUS_VARIANTS = ['cactus_small', 'cactus_medium', 'cactus_large'];
  static ROCK_VARIANTS = ['rock_small', 'rock_medium', 'rock_large'];
  static BIRD_FRAMES = ['flap_0', 'flap_1', 'flap_2', 'flap_3', 'flap_4', 'flap_5', 'flap_6', 'flap_7'];
  static RUN_FRAMES = ['run_0', 'run_1', 'run_2', 'run_3', 'run_4', 'run_5', 'run_6'];
  static SUN_FRAMES = ['sun_0', 'sun_1', 'sun_2', 'sun_3'];
  // Dos fases de luna: cada noche del ciclo elige una (ver RunnerRenderer.dibujarCielo).
  static MOON_PHASES = { half: ['moon_0', 'moon_1'], full: ['moon_2', 'moon_3'] };
  static FALL_FRAMES = ['fall_0', 'fall_1', 'fall_2', 'fall_3']; // animación de choque/caída
  static CLOUD_FRAMES = ['cloud_0', 'cloud_1', 'cloud_2', 'cloud_3'];
  // Mismas siluetas en tono de tormenta (mismo índice que CLOUD_FRAMES).
  static CLOUD_DARK_FRAMES = ['cloud_dark_0', 'cloud_dark_1', 'cloud_dark_2', 'cloud_dark_3'];
  static COIN_SPIN_FRAMES = ['coin_0', 'coin_1', 'coin_2', 'coin_3', 'coin_4'];
  static SHIELD_SHIMMER_FRAMES = ['shield_shimmer_0', 'shield_shimmer_1', 'shield_shimmer_2', 'shield_shimmer_3', 'shield_shimmer_4'];

  // ─── Monedas y power-ups ───
  static COIN_VALUE = 1;                 // monedas por moneda agarrada (moneda-juego, no puntaje)
  static PICKUP_GROUP_MIN = 3;
  static PICKUP_GROUP_MAX = 5;
  static POWERUP_CHANCE = 0.16;          // chance de que la tanda sea un power-up
  static DOUBLE_POINTS_DURATION = 900;   // "frames de 60fps" (~15s)
  static SHIELD_DURATION = 900;          // ~15s
  static SLOWFALL_DURATION = 600;        // 10s
  static SLOWSPEED_DURATION = 600;       // 10s
  static POWERUP_STACK_CAP = 900 * 2;    // tope al acumular duración (~30s)
  static SLOWFALL_DURATION_STEP = 120;   // +2s por nivel de mejora
  static SLOWFALL_GRAVITY_MULT = 0.55;   // gravedad durante caída lenta
  static SLOWSPEED_FACTOR_BASE = 0.75;   // -25% de velocidad
  static SLOWSPEED_FACTOR_STRONG = 0.50; // -50% con "Frenada Fuerte"
  static SLOWSPEED_RECOVER_STEP = 0.003; // recuperación gradual (~2.5s)

  // ─── Economía / tienda (ver runner_economy.js) ───
  static COINS_STORAGE_KEY = 'pixelRunnerCoins';
  static UPGRADES_STORAGE_KEY = 'pixelRunnerUpgrades';
  static UPGRADE_MAX_LEVEL = 10;
  static UPGRADE_LEVEL_COSTS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  static UPGRADE_DURATION_STEP = 60;     // +1s por nivel
  static UPGRADE_SHIELD_HITS_COST = 1000;
  static UPGRADE_X2_TRIPLE_COST = 1500;
  static UPGRADE_SLOWSPEED_STRONG_COST = 1200;

  // ─── Modo Historia ───
  static HISTORIA_GOAL = 2500;
  static HISTORIA_STORAGE_KEY = 'pixelRunnerHistoriaCompleta';

  // ─── Secuencia de victoria (castillo) ───
  static CASTLE_TARGET_H = 210;          // alto del sprite en el canvas
  static CASTLE_REST_MARGIN = 10;        // separación del borde derecho al asentarse
  static CASTLE_GROUND_OFFSET = 25;      // compensa el margen transparente del PNG
  static CASTLE_DOOR_WALK_GAP = 90;      // hasta dónde camina Junior antes de la puerta
  static CASTLE_WALK_SPEED_MULT = 5;     // velocidad caminando = moveSpeed x esto
  static WIN_APPROACH_PAUSE_MS = 550;    // pausa en la puerta antes del cómic final

  // Hundimiento visual del sprite de cada obstáculo (no toca la colisión).
  static GROUND_OBSTACLE_SINK = {
    tree_small: 5, tree_medium: 5, tree_large: 5,
    cactus_small: 5, cactus_medium: 5, cactus_large: 5,
    rock_small: 14, rock_medium: 14, rock_large: 14,
  };
  // Baja solo el DIBUJO de Junior para que los pies queden metidos en el pasto.
  static JUNIOR_GROUND_SINK = 6;

  // ─── Biomas y ciclo día/noche (en puntos) ───
  static BIOME_SEGMENT = 500;
  static DAY_HALF = 250;
  static GROUND_TRANSITION_RANGE = 18;   // puntos que dura el barrido de bioma

  static GRAVITY = 0.09;

  // ─── Lluvia (evento de clima) ───
  static RAIN_CHECK_INTERVAL = 250;
  static RAIN_CHANCE = 0.25;
  static RAIN_DURATION = 1200;           // 20s
  static RAIN_JUMP_MULT = 0.75;          // -25% de salto mientras llueve
  static RAIN_BASE_COUNT = 40;
  static RAIN_DENSITY = { low: 0.25, medium: 0.5, high: 1 };
  static RAIN_DROP_SPEED = 5.2;
  static RAIN_DROP_WIND = -0.6;
  static RAIN_SPLASH_LIFE = 14;
  static RAIN_SPLASH_GROUND_OFFSET = 1;

  // ─── Spawn ───
  static OBSTACLE_CLUSTER_MIN_SCORE = 1000;
  static OBSTACLE_CLUSTER_CHANCE = 0.25;
  static PICKUP_OBSTACLE_BUFFER = 18;

  // ─── Secuencia de muerte ───
  static FALL_FRAME_DELAY = 130;         // ms entre frames de la caída
  static FALL_HOLD_BEFORE_OVERLAY = 300; // ms en el último frame antes del cartel

  // Árboles solo en pasto, cactus solo en desierto; rocas en los dos.
  static groundVariantsForBiome(biome) {
    return biome === 'desert'
      ? RunnerConfig.CACTUS_VARIANTS.concat(RunnerConfig.ROCK_VARIANTS)
      : RunnerConfig.TREE_VARIANTS.concat(RunnerConfig.ROCK_VARIANTS);
  }

  static sinkForSprite(sprite) {
    const sink = RunnerConfig.GROUND_OBSTACLE_SINK[sprite];
    return sink != null ? sink : 5;
  }
}

// ═══════════════════════════════════════════════
//   Caché del DOM
// ═══════════════════════════════════════════════
export class RunnerDOM {
  constructor() {
    const $ = id => document.getElementById(id);
    this.overlay = $('runnerOverlay');
    this.overlayTitle = $('runnerOverlayTitle');
    this.overlaySub = $('runnerOverlaySub');
    this.restartBtn = $('runnerRestartBtn');
    this.comicOverlay = $('runnerComicOverlay');
    this.comicImg = $('runnerComicImg');
    this.best = $('runnerBest');
    this.scoreDisplay = $('runner-score-display');
    this.coinsRunDisplay = $('runner-coins-run-display');
    this.menuBtn = $('runnerMenuBtn');
    this.menu = $('runnerMenu');
    this.section = $('sec-runner');
    this.charPreviewCanvas = $('runnerCharPreviewCanvas');
    // HUD en HTML: multiplicador de puntos y power-ups activos
    this.multiplierDisplay = $('runner-multiplier-display');
    this.activePowerupDisplay = $('runner-active-powerup-display');
    this.pauseBtn = $('runnerHudPauseBtn');
  }

  overlayVisible() {
    return !!this.overlay && !this.overlay.classList.contains('hidden');
  }

  // Enter/Espacio sobre el cartel de game over = tocar "Reintentar".
  clickReintentar() {
    const btn = this.restartBtn;
    if (btn && btn.style.display !== 'none') btn.click();
  }
}
