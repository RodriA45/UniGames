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

  // ─── Niveles: se cargan dinámicamente desde el Editor de Niveles ───
  // Prioridad: 1) datos en vivo del editor en localStorage, 2) el archivo
  // exportado castle_escape_levels.js (CASTLE_ESCAPE_CUSTOM_LEVELS),
  // 3) array vacío (el menú muestra un aviso en vez de romperse).
  static CUSTOM_LEVELS_LS_KEY = 'castleEscapeLevelEditorData_v3';

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
    try {
      const raw = localStorage.getItem(CastleConfig.CUSTOM_LEVELS_LS_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.levels) && data.levels.length) return data.levels;
      }
    } catch (e) {}
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
