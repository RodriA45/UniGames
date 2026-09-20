// ══════════════════════════════════════
//   Castle Escape — castle_config.js  (módulo ES6)
// ══════════════════════════════════════
// Estado global (TRAMPAS), assets, referencias al DOM (TR_EL), el loop y
// el input (Engine2D.GameLoop/KeyboardInput) y todas las constantes de
// tuning. Ahora es un módulo: en vez de "se carga primero y todos asumen
// que esto ya existe" gracias al orden de los <script>, cada archivo
// castle_*.js que necesita algo de acá lo pide explícitamente con import.
//
// updateTrampas/drawTrampas se importan solo para que trLoop pueda
// llamarlos — es un import circular (loop.js y render.js a su vez
// importan cosas de este archivo) pero funciona sin problema: ninguno de
// los dos se ejecuta durante la carga de los módulos, recién se invocan
// más tarde cuando arranca trLoop.start().
import { updateTrampas, trJump } from './castle_loop.js';
import { drawTrampas } from './castle_render.js';

export const TR_ASSET_BASE = 'src/motor2d/games/castle-escape/';

//
// Migrado desde app.js a su propio archivo, usando Engine2D para el loop
// y el teclado. Lo que NO se migró a piezas de Engine2D (y por qué):
//
//   - Colisión de plataformas: sigue siendo código propio (trRectsOverlap +
//     el chequeo de "aterrizar desde arriba" en updateTrampas). Engine2D.TileMap
//     /Physics asumen un mundo en GRILLA UNIFORME (filas/columnas de un
//     mismo tamaño de celda); acá las plataformas son rectángulos sueltos
//     de tamaño y posición libres (igual que Terraria necesitaría tiles,
//     esto es más parecido a plataformas flotantes tipo Mario). Forzarlo
//     a tiles hubiera significado rehacer los 11 niveles a mano.
//
// Lo que SÍ se migró:
//   - El loop manual (trampasLoop + raf a mano) → Engine2D.GameLoop, que
//     además normaliza el movimiento a "frames de 60fps" (step) — antes
//     la velocidad dependía del refresh rate real de la pantalla.
//   - El bloque de teclado (if e.code === ...) → Engine2D.KeyboardInput.
//
// Toda la API pública (trShowMainMenu, trMove, trJump, startTrampas, etc)
// se mantiene con el mismo nombre — index.html y el goTo() de app.js que
// llaman a estas funciones no necesitan ningún cambio.
// ══════════════════════════════════════

// Resolución lógica fija (el canvas se escala por CSS al ancho del contenedor)
export const TR_W = 480, TR_H = 270;
// Grilla fija del editor y del juego: TODO se coloca en cuadrados de 30px.
// 480/30 = 16 columnas y 270/30 = 9 filas exactas en pantalla (los niveles
// más grandes sumán filas/columnas). Es el tamaño de una celda del
// autotile de mapa.png y queda un poco más grande que Junior (24x27),
// igual que un bloque de Geometry Dash.
export const TR_TILE = 30;
export const TR_GRAVITY = 0.42;
export const TR_JUMP_VY = -7.4;
export const TR_MOVE_SPEED = 2.7;

// ─── Sprite del jugador (reutilizado de Pixel Runner: junior.png/atlas) ───
export const TR_RUN_FRAMES = ['run_0', 'run_1', 'run_2', 'run_3', 'run_4', 'run_5', 'run_6'];
export const TR_JUMP_FRAME = 'action_2'; // mismo frame que usa Pixel Runner como pose de salto
export const TR_FALL_FRAMES = ['fall_0', 'fall_1', 'fall_2', 'fall_3']; // animación de morir
export const TR_FALL_FRAME_DELAY = 110; // ms entre frames — 4 frames caben en TR_DEATH_DELAY (450ms)
export const TR_DEATH_DELAY = 450; // ms antes de reiniciar el nivel tras morir (ver trPlayerDie)

// ─── SISTEMA DE ESTRELLAS ───
export const TR_TIME_LIMITS = [30, 35, 35, 40, 40, 45, 45, 50, 50, 55, 60, 55, 55, 60, 60, 65, 65, 70, 70, 75];
export const TR_DEATH_LIMITS = [5, 5, 5, 4, 4, 3, 3, 3, 2, 2, 1, 3, 3, 2, 2, 2, 1, 1, 1, 1];

// ─── NIVELES: se cargan dinámicamente desde el Editor de Niveles ───
// Ya no hay niveles "oficiales" fijos acá — el juego siempre usa los
// niveles creados/editados en level-editor.html. Prioridad de carga:
//   1) Datos en vivo del editor guardados en localStorage (mismo origen
//      y mismo navegador: cualquier cambio en el editor se refleja acá
//      apenas se recarga esta pantalla, sin pasos manuales).
//   2) El archivo estático exportado con "💾 Descargar .js" desde el
//      editor (src/games/castle_escape_levels.js), incluido en index.html
//      con un <script> ANTES de este archivo. Sirve para que el juego
//      funcione en otra máquina/navegador donde no existe el
//      localStorage del editor (por ejemplo, al publicar el sitio) — y es
//      la fuente que termina usándose siempre que jugás sin haber tocado
//      el editor en ESE mismo navegador.
//   3) Si no hay nada en ninguno de los dos lugares, arranca con un
//      array vacío — el menú de niveles muestra un aviso en vez de
//      romperse (ver trUpdateLevelCard).
const TR_CUSTOM_LEVELS_LS_KEY = 'castleEscapeLevelEditorData_v3';

// ═══════════════════════════════════════════════
//   Caché del DOM
// ═══════════════════════════════════════════════
// Mismo criterio que RPG_EL (rpg.js) y RUNNER_EL (pixelrunner.js): buscar
// cada elemento UNA sola vez (el script carga al final del <body>, con
// el HTML ya presente) en vez de llamar document.getElementById(...) en
// cada muerte, cada frame del HUD, etc.
export const TR_EL = {
  overlay: document.getElementById('trampasOverlay'),
  overlayTitle: document.getElementById('trampasOverlayTitle'),
  overlaySub: document.getElementById('trampasOverlaySub'),
  pauseMenu: document.getElementById('trampasPauseMenu'),
  startBtn: document.getElementById('trampasStartBtn'),
  settings: document.getElementById('trampasSettings'),
  mainMenu: document.getElementById('trampasMainMenu'),
  levelSelect: document.getElementById('trampasLevelSelect'),
  howToPlay: document.getElementById('trampasHowToPlay'),
  canvas: document.getElementById('trampasCanvas'),
  section: document.getElementById('sec-castle_escape'),
  hudDeaths: document.getElementById('trampas-hud-deaths'),
  hudStars: document.getElementById('trampas-hud-stars'),
  controlsSign: document.getElementById('trampasControlsSign'),
  sfxVolumeValue: document.getElementById('trSfxVolumeValue'),
  sfxVolume: document.getElementById('trSfxVolume'),
  musicVolumeValue: document.getElementById('trMusicVolumeValue'),
  musicVolume: document.getElementById('trMusicVolume'),
  navRight: document.getElementById('trNavRight'),
  navLeft: document.getElementById('trNavLeft'),
  levelPlayBtn: document.getElementById('trLevelPlayBtn'),
  bigLevelNum: document.getElementById('trBigLevelNum'),
  bigLevelName: document.getElementById('trBigLevelName'),
  levelDots: document.getElementById('trLevelDots'),
  fullscreenRow: document.getElementById('trFullscreenRow'),
  fullscreenBtn: document.getElementById('trFullscreenBtn'),
};

function trLoadCustomLevels() {
  try {
    const raw = localStorage.getItem(TR_CUSTOM_LEVELS_LS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.levels) && data.levels.length) {
        return data.levels;
      }
    }
  } catch (e) {}
  if (typeof CASTLE_ESCAPE_CUSTOM_LEVELS !== 'undefined' &&
      Array.isArray(CASTLE_ESCAPE_CUSTOM_LEVELS) && CASTLE_ESCAPE_CUSTOM_LEVELS.length) {
    return CASTLE_ESCAPE_CUSTOM_LEVELS;
  }
  return [];
}

export let TR_LEVELS = trLoadCustomLevels();

export const TRAMPAS = {
  canvas: null, ctx: null,
  running: false,
  levelIndex: 0,
  deathsThisLevel: 0,
  totalDeaths: 0,
  totalScore: 0,
  levelStartTime: 0,
  levelDeaths: 0,
  explosions: [],
  floorY: 0,

  // w/h en proporción 32:36 (la misma que usa drawTrampasPlayer para el
  // fallback dibujado a mano), así ese sprite llega exactamente hasta el
  // borde inferior del hitbox y no queda "flotando" sobre las plataformas.
  // El sprite de junior.png se ancla igual (borde inferior = piso del
  // hitbox), aunque su ancho real varíe según el frame (ver drawTrampasPlayer).
  player: {
    x: 20, y: 200, w: 24, h: 27, vx: 0, vy: 0, onGround: false, dead: false, ridingPlatform: null,
    facing: 1,          // 1 = mirando derecha, -1 = mirando izquierda
    animFrame: 0,       // índice dentro de TR_RUN_FRAMES mientras corre
    animTick: 0,        // contador para el ritmo del ciclo de correr
    animFrameName: null // frame de la animación de morir (fall_0..3), ver trPlayerDie
  },

  // Estado dinámico del nivel actual (copias mutables de plataformas/flechas)
  platforms: [],
  hazards: [],
  arrows: [],

  // Cámara + tamaño del nivel en world-space. Si el nivel es más grande que
  // la vista (TR_W×TR_H) la cámara sigue al jugador y se recorta a los
  // bordes del nivel; si cabe entero, queda en (0,0) y no hay scroll.
  camera: { x: 0, y: 0 },
  levelW: TR_W,
  levelH: TR_H,

  // Capa estática horneada del nivel actual (piso/paredes/pinchos fijos)
  // — ver trLoadLevel/drawTrampas y Engine2D.StaticLayer.
  staticLayer: null,

  // true recién cuando terminó Engine2D.loadAllWithProgress sobre
  // TR_ASSETS (ver initTrampas) — trPlaySelectedLevel no deja arrancar un
  // nivel hasta entonces, para no jugar con sprites a medio cargar.
  assetsReady: false,

  // Campo de visión del nivel actual (definido en el editor). 1 = vista
  // normal (se ve exactamente el área de TR_W×TR_H). Mayor a 1 = la cámara
  // se aleja y se ve MÁS mapa comprimido en el mismo canvas de 480x270.
  // Menor a 1 = la cámara se acerca (zoom in) y se ve MENOS mapa, más
  // grande. Ver trLoadLevel (de dónde sale) y drawTrampas/updateTrampas
  // (dónde se aplica el scale y el clamp de cámara).
  fov: 1,

  // Antes eran 'let trSelectedLevel'/'let trEnterHandler' sueltos acá
  // mismo, reasignados directamente desde castle_menu_flow.js y
  // castle_loop.js. Con módulos ES6 eso ya no se puede: un binding que
  // entra por 'import' es de solo lectura en el módulo que lo importa
  // (se puede LEER TRAMPAS y mutar sus propiedades, pero no hacer
  // "TR_LEVELS = otraCosa" desde afuera de config.js). Por eso pasan a
  // ser propiedades de este objeto — mutar TRAMPAS.selectedLevel = x sí
  // funciona desde cualquier módulo que importe TRAMPAS.
  selectedLevel: 0,
  enterHandler: null,
};

// ─── Loop y teclado — ahora con Engine2D en vez de raf/keydown a mano ───
export const trLoop = new Engine2D.GameLoop({
  update: (dt, step) => updateTrampas(step),
  draw: () => drawTrampas()
});

export const trInput = new Engine2D.KeyboardInput(
  { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump' },
  {
    activeCheck: () => TR_EL.section.classList.contains('active'),
    preventDefaultFor: new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space']),
    onDown: (action) => {
      // Si el overlay (empezar / nivel superado / completado) está visible,
      // Espacio equivale a tocar el botón en vez de saltar.
      const overlay = TR_EL.overlay;
      if (overlay && !overlay.classList.contains('hidden')) {
        if (action === 'jump') TR_EL.startBtn?.click();
        return;
      }
      if (action === 'left') TRAMPAS.keys.left = true;
      if (action === 'right') TRAMPAS.keys.right = true;
      if (action === 'jump') trJump();
    },
    onUp: (action) => {
      if (action === 'left') TRAMPAS.keys.left = false;
      if (action === 'right') TRAMPAS.keys.right = false;
    }
  }
);
TRAMPAS.keys = { left: false, right: false, jump: false };

// Enter también cierra el overlay (además de Espacio) — queda aparte
// porque Enter no es una acción de movimiento, KeyboardInput solo mapea
// acciones que el juego usa en el gameplay en sí.
// (el handler en sí vive en TRAMPAS.enterHandler, ver comentario arriba)

export const TR_MENU_VIEWS = [TR_EL.mainMenu, TR_EL.levelSelect, TR_EL.settings, TR_EL.howToPlay];

export const TR_ASSETS = [
  { type: 'image', src: TR_ASSET_BASE + 'models/mapa.webp' },
  { type: 'atlas', src: TR_ASSET_BASE + 'models/mapa_atlas.json' },
  // Texturas nuevas: bloques (autotile 3x3 + plataformas de madera) y
  // obstáculos (flechas + sierra animada). Ver trDrawBlockRect/trDrawSaw.
  { type: 'image', src: TR_ASSET_BASE + 'models/mapa_tiles.png' },
  { type: 'atlas', src: TR_ASSET_BASE + 'models/mapa_tiles_atlas.json' },
  { type: 'image', src: TR_ASSET_BASE + 'models/obstaculo.webp' },
  { type: 'atlas', src: TR_ASSET_BASE + 'models/obstaculo_atlas.json' },
  { type: 'image', src: TR_ASSET_BASE + 'models/deco.webp' },
  { type: 'atlas', src: TR_ASSET_BASE + 'models/deco_atlas.json' },
  { type: 'image', src: TR_ASSET_BASE + 'models/junior.webp' },
  { type: 'atlas', src: TR_ASSET_BASE + 'models/junior.atlas.json' },
];

export const TR_STONE_MORTAR = '#232025';
export function trRectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Mueve `obj` (plataforma 'moving' o peligro 'saw') ida y vuelta entre
// obj.move.from y obj.move.to sobre el eje obj.move.axis ('x' o 'y'), a
// obj.move.speed píxeles por step. Devuelve cuánto se desplazó este frame
// (lo usa updateTrampas para arrastrar al jugador si está parado encima).
export function trOscillate(obj, step) {
  if (!obj.move) return 0;
  const axis = obj.move.axis;
  const prev = obj[axis];
  obj[axis] += (obj._dir || 1) * obj.move.speed * step;
  if (obj[axis] >= obj.move.to) { obj[axis] = obj.move.to; obj._dir = -1; }
  else if (obj[axis] <= obj.move.from) { obj[axis] = obj.move.from; obj._dir = 1; }
  return obj[axis] - prev;
}

// step: "frames de 60fps" que da Engine2D.GameLoop — a 60fps step≈1, igual
// que antes; en pantallas de otro refresh rate el movimiento ahora se
// mantiene igual de rápido (antes dependía del framerate real).
