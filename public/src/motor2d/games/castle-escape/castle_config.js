// ══════════════════════════════════════
//   Castle Escape — castle_config.js  (módulo ES6)
// ══════════════════════════════════════

export class CastleConfig {
  static ASSET_BASE = 'src/motor2d/games/castle-escape/';

  // Resolución lógica fija (el canvas se escala por CSS al ancho del contenedor)
  static W = 480;
  static H = 270;
  // Grilla fija del editor y del juego: 480/30 = 16 columnas y 270/30 = 9 filas.
  static TILE = 30;
  static GRAVITY = 0.42;
  static JUMP_VY = -7.4;
  static MOVE_SPEED = 2.7;
  // Velocidad máxima de caída (px por step). Sin tope, en una caída larga
  // la velocidad crecía sin límite y se atravesaban las plataformas finas.
  static MAX_FALL_SPEED = 9;
  // Desplazamiento vertical máximo por sub-paso de colisión: menos de la
  // mitad de la plataforma más fina (15px), así no se la saltea ni con un
  // frame lento (step grande).
  static MAX_SUBPASO_Y = 7;
  // Duración de un step en ms (el GameLoop normaliza a "frames de 60fps").
  static MS_POR_STEP = 1000 / 60;

  // ─── Sprite del jugador (reutilizado de Pixel Runner: junior.png/atlas) ───
  static RUN_FRAMES = ['run_0', 'run_1', 'run_2', 'run_3', 'run_4', 'run_5', 'run_6'];
  static JUMP_FRAME = 'action_2'; // mismo frame que usa Pixel Runner como pose de salto
  static FALL_FRAMES = ['fall_0', 'fall_1', 'fall_2', 'fall_3']; // animación de morir
  static FALL_FRAME_DELAY = 110; // ms entre frames — 4 frames caben en DEATH_DELAY
  static DEATH_DELAY = 450; // ms antes de reiniciar el nivel tras morir

  // ─── Sistema de estrellas ───
  static TIME_LIMITS = [30, 35, 35, 40, 40, 45, 45, 50, 50, 55, 60, 55, 55, 60, 60, 65, 65, 70, 70, 75];
  static DEATH_LIMITS = [5, 5, 5, 4, 4, 3, 3, 3, 2, 2, 1, 3, 3, 2, 2, 2, 1, 1, 1, 1];

  static STONE_MORTAR = '#232025';

  // ─── Niveles: los exporta el Editor de Niveles ───
  // Salen SOLO del archivo castle_escape_levels.js (CASTLE_ESCAPE_CUSTOM_LEVELS).
  // Antes también se leía una clave de localStorage que tenía prioridad: el
  // editor ya no la escribe, pero cualquiera podía cargarla desde la consola
  // con un nivel trivial y jugar eso en vez de los niveles oficiales.
  // Sin niveles → array vacío (el menú muestra un aviso en vez de romperse).

  static ASSETS = [
    { type: 'image', src: CastleConfig.ASSET_BASE + 'models/mapa.webp' },
    { type: 'atlas', src: CastleConfig.ASSET_BASE + 'models/mapa_atlas.json' },
    // Texturas nuevas: bloques (autotile 3x3 + plataformas de madera) y
    // obstáculos (flechas + sierra animada).
    { type: 'image', src: CastleConfig.ASSET_BASE + 'models/mapa_tiles.png' },
    { type: 'atlas', src: CastleConfig.ASSET_BASE + 'models/mapa_tiles_atlas.json' },
    { type: 'image', src: CastleConfig.ASSET_BASE + 'models/obstaculo.webp' },
    { type: 'atlas', src: CastleConfig.ASSET_BASE + 'models/obstaculo_atlas.json' },
    { type: 'image', src: CastleConfig.ASSET_BASE + 'models/deco.webp' },
    { type: 'atlas', src: CastleConfig.ASSET_BASE + 'models/deco_atlas.json' },
    { type: 'image', src: CastleConfig.ASSET_BASE + 'models/junior.webp' },
    { type: 'atlas', src: CastleConfig.ASSET_BASE + 'models/junior.atlas.json' },
  ];

  static cargarNiveles() {
    if (typeof CASTLE_ESCAPE_CUSTOM_LEVELS !== 'undefined' &&
        Array.isArray(CASTLE_ESCAPE_CUSTOM_LEVELS) && CASTLE_ESCAPE_CUSTOM_LEVELS.length) {
      return CASTLE_ESCAPE_CUSTOM_LEVELS;
    }
    return [];
  }

  static rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
}

// ═══════════════════════════════════════════════
//   Caché del DOM
// ═══════════════════════════════════════════════
export class CastleDOM {
  constructor() {
    const $ = id => document.getElementById(id);
    this.overlay = $('trampasOverlay');
    this.overlayTitle = $('trampasOverlayTitle');
    this.overlaySub = $('trampasOverlaySub');
    this.pauseMenu = $('trampasPauseMenu');
    this.startBtn = $('trampasStartBtn');
    this.settings = $('trampasSettings');
    this.mainMenu = $('trampasMainMenu');
    this.levelSelect = $('trampasLevelSelect');
    this.howToPlay = $('trampasHowToPlay');
    this.canvas = $('trampasCanvas');
    this.section = $('sec-castle_escape');
    this.hudDeaths = $('trampas-hud-deaths');
    this.hudStars = $('trampas-hud-stars');
    this.controlsSign = $('trampasControlsSign');
    this.sfxVolumeValue = $('trSfxVolumeValue');
    this.sfxVolume = $('trSfxVolume');
    this.musicVolumeValue = $('trMusicVolumeValue');
    this.musicVolume = $('trMusicVolume');
    this.navRight = $('trNavRight');
    this.navLeft = $('trNavLeft');
    this.levelPlayBtn = $('trLevelPlayBtn');
    this.bigLevelNum = $('trBigLevelNum');
    this.bigLevelName = $('trBigLevelName');
    this.levelDots = $('trLevelDots');
    this.fullscreenRow = $('trFullscreenRow');
    this.fullscreenBtn = $('trFullscreenBtn');
  }

  // Pantallas de menú que se ocultan juntas (ver CastleMenu.ocultarTodo)
  get menuViews() {
    return [this.mainMenu, this.levelSelect, this.settings, this.howToPlay];
  }

  get container() {
    return document.querySelector('.trampas-container');
  }

  overlayVisible() {
    return !!this.overlay && !this.overlay.classList.contains('hidden');
  }
}
