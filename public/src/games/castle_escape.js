// ══════════════════════════════════════
//   Castle Escape — castle_escape.js
// ══════════════════════════════════════
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
const TR_W = 480, TR_H = 270;
const TR_GRAVITY = 0.42;
const TR_JUMP_VY = -7.4;
const TR_MOVE_SPEED = 2.7;

// ─── Sprite del jugador (reutilizado de Pixel Runner: junior.png/atlas) ───
const TR_RUN_FRAMES = ['run_0', 'run_1', 'run_2', 'run_3', 'run_4', 'run_5', 'run_6'];
const TR_JUMP_FRAME = 'action_2'; // mismo frame que usa Pixel Runner como pose de salto
const TR_FALL_FRAMES = ['fall_0', 'fall_1', 'fall_2', 'fall_3']; // animación de morir
const TR_FALL_FRAME_DELAY = 110; // ms entre frames — 4 frames caben en TR_DEATH_DELAY (450ms)
const TR_DEATH_DELAY = 450; // ms antes de reiniciar el nivel tras morir (ver trPlayerDie)

// ─── SISTEMA DE ESTRELLAS ───
const TR_TIME_LIMITS = [30, 35, 35, 40, 40, 45, 45, 50, 50, 55, 60, 55, 55, 60, 60, 65, 65, 70, 70, 75];
const TR_DEATH_LIMITS = [5, 5, 5, 4, 4, 3, 3, 3, 2, 2, 1, 3, 3, 2, 2, 2, 1, 1, 1, 1];

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

let TR_LEVELS = trLoadCustomLevels();

const TRAMPAS = {
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

  // Campo de visión del nivel actual (definido en el editor). 1 = vista
  // normal (se ve exactamente el área de TR_W×TR_H). Mayor a 1 = la cámara
  // se aleja y se ve MÁS mapa comprimido en el mismo canvas de 480x270.
  // Menor a 1 = la cámara se acerca (zoom in) y se ve MENOS mapa, más
  // grande. Ver trLoadLevel (de dónde sale) y drawTrampas/updateTrampas
  // (dónde se aplica el scale y el clamp de cámara).
  fov: 1,
};

// ─── Loop y teclado — ahora con Engine2D en vez de raf/keydown a mano ───
const trLoop = new Engine2D.GameLoop({
  update: (dt, step) => updateTrampas(step),
  draw: () => drawTrampas()
});

const trInput = new Engine2D.KeyboardInput(
  { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump' },
  {
    activeCheck: () => document.getElementById('sec-castle_escape').classList.contains('active'),
    preventDefaultFor: new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space']),
    onDown: (action) => {
      // Si el overlay (empezar / nivel superado / completado) está visible,
      // Espacio equivale a tocar el botón en vez de saltar.
      const overlay = document.getElementById('trampasOverlay');
      if (overlay && !overlay.classList.contains('hidden')) {
        if (action === 'jump') document.getElementById('trampasStartBtn')?.click();
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
TRAMPAS.keys = { left: false, right: false };

// Enter también cierra el overlay (además de Espacio) — queda aparte
// porque Enter no es una acción de movimiento, KeyboardInput solo mapea
// acciones que el juego usa en el gameplay en sí.
let trEnterHandler = null;
function trAttachEnterHandler() {
  if (trEnterHandler) document.removeEventListener('keydown', trEnterHandler);
  trEnterHandler = (e) => {
    if (!document.getElementById('sec-castle_escape').classList.contains('active')) return;
    if (e.code !== 'Enter') return;
    const overlay = document.getElementById('trampasOverlay');
    if (overlay && !overlay.classList.contains('hidden')) {
      e.preventDefault();
      document.getElementById('trampasStartBtn')?.click();
    }
  };
  document.addEventListener('keydown', trEnterHandler);
}

// ─── Estrellas (persistencia en localStorage) ───
function trGetStars() {
  try { return JSON.parse(localStorage.getItem('trampasStars')) || {}; }
  catch { return {}; }
}
function trSaveStars(stars) {
  localStorage.setItem('trampasStars', JSON.stringify(stars));
}
function trGetLevelStars(i) {
  return trGetStars()[i] || 0;
}
function trSaveLevelStars(i, stars) {
  const all = trGetStars();
  if (stars > (all[i] || 0)) { all[i] = stars; trSaveStars(all); }
}
function trIsUnlocked(i) {
  if (i === 0) return true;
  return trGetLevelStars(i - 1) >= 1;
}

// ─── Navegación de menús ───
let trSelectedLevel = 0;

function trHideAll() {
  ['trampasMainMenu', 'trampasLevelSelect', 'trampasSettings', 'trampasHowToPlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}
// trLoadLevel() pinta el fondo del castillo (back.png) directo en
// .trampas-container vía style.background inline — y ese inline se queda
// pegado ahí para siempre (un inline style le gana al CSS) aunque
// volvamos al menú. Por eso, después de jugar un nivel, "Ajustes",
// "Cómo jugar" y "Ver niveles" mostraban el fondo del juego en vez de la
// imagen de menú del CSS. Esta función saca ese inline y deja que el CSS
// (la foto de menú) se vea de nuevo — se llama desde toda pantalla que
// NO sea el juego en sí.
function trResetMenuBackground() {
  const cont = document.querySelector('.trampas-container');
  if (cont) cont.style.background = '';
}
function trShowMainMenu() {
  trHideAll();
  trResetMenuBackground();
  document.getElementById('trampasMainMenu').classList.remove('hidden');
  document.getElementById('trampasPauseMenu').classList.add('hidden');
  stopTrampas();
  if (typeof setMusic === 'function') setMusic('assert/Castle Escape/sounds/menu_song.mp3');
}
function trShowLevelSelect() {
  trHideAll();
  trResetMenuBackground();
  document.getElementById('trampasLevelSelect').classList.remove('hidden');
  trUpdateLevelCard();
}
function trShowSettings() {
  trHideAll();
  trResetMenuBackground();
  document.getElementById('trampasSettings').classList.remove('hidden');
  // Sincronizar los sliders con el volumen global actual
  const musicPct = Math.round((typeof getGlobalMusicVolume === 'function' ? getGlobalMusicVolume() : 0.5) * 100);
  const sfxPct = Math.round((typeof getGlobalSfxVolume === 'function' ? getGlobalSfxVolume() : 0.8) * 100);
  const musicSlider = document.getElementById('trMusicVolume');
  const sfxSlider = document.getElementById('trSfxVolume');
  if (musicSlider) musicSlider.value = musicPct;
  if (sfxSlider) sfxSlider.value = sfxPct;
  document.getElementById('trMusicVolumeValue').textContent = musicPct + '%';
  document.getElementById('trSfxVolumeValue').textContent = sfxPct + '%';
  trSyncFullscreenBtn();
}
function trOnMusicVolumeChange(v) {
  document.getElementById('trMusicVolumeValue').textContent = v + '%';
  if (typeof setGlobalMusicVolume === 'function') setGlobalMusicVolume(v / 100);
}
function trOnSfxVolumeChange(v) {
  document.getElementById('trSfxVolumeValue').textContent = v + '%';
  if (typeof setGlobalSfxVolume === 'function') setGlobalSfxVolume(v / 100);
}

// ─── Pantalla completa (exactamente igual a Pixel Runner) ───
function trGetFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
}

function trFullscreenSupported() {
  const el = document.querySelector('.trampas-container');
  return !!(el && (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen));
}

function trToggleFullscreen() {
  const el = document.querySelector('.trampas-container');
  if (!el) return;
  if (!trGetFullscreenElement()) {
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  }
  trSyncFullscreenBtn();
}

function trSyncFullscreenBtn() {
  const row = document.getElementById('trFullscreenRow');
  if (row) row.classList.toggle('unsupported', !trFullscreenSupported());
  const btn = document.getElementById('trFullscreenBtn');
  if (!btn) return;
  btn.textContent = trGetFullscreenElement() ? 'Salir' : 'Activar';
}

document.addEventListener('fullscreenchange', trSyncFullscreenBtn);
document.addEventListener('webkitfullscreenchange', trSyncFullscreenBtn);

function trShowHowToPlay() {
  trHideAll();
  trResetMenuBackground();
  document.getElementById('trampasHowToPlay').classList.remove('hidden');
}

function trShowGameScreen() {
  trHideAll();
}
// Cartel de controles dentro del juego (no es un alert, es un panel que
// se muestra/oculta sobre el canvas con el botón ❓ del HUD).
function trToggleControlsSign() {
  const el = document.getElementById('trampasControlsSign');
  if (el) el.classList.toggle('hidden');
}
function trBackToLevelSelect() {
  stopTrampas();
  if (typeof setMusic === 'function') setMusic('assert/Castle Escape/sounds/menu_song.mp3');
  trShowLevelSelect();
}

function trUpdateLevelCard() {
  // Sin niveles cargados (todavía no se creó ninguno en el editor): en vez
  // de romper (lvl sería undefined), mostramos un aviso y deshabilitamos
  // todo lo que dependa de un nivel real.
  if (!TR_LEVELS.length) {
    document.getElementById('trBigLevelNum').textContent = '–';
    document.getElementById('trBigLevelName').textContent = 'Sin niveles — creá uno en el Editor de Niveles';
    const starEls0 = document.querySelectorAll('#trBigStars .star');
    starEls0.forEach(el => el.classList.remove('earned'));
    const card0 = document.querySelector('.trampas-level-card-big');
    if (card0) card0.classList.add('locked');
    const navLeft0 = document.getElementById('trNavLeft');
    const navRight0 = document.getElementById('trNavRight');
    const playBtn0 = document.getElementById('trLevelPlayBtn');
    if (navLeft0) navLeft0.disabled = true;
    if (navRight0) navRight0.disabled = true;
    if (playBtn0) playBtn0.disabled = true;
    document.querySelectorAll('.trampas-level-dot').forEach(d => d.classList.remove('active'));
    return;
  }

  const i = trSelectedLevel;
  const lvl = TR_LEVELS[i];
  const stars = trGetLevelStars(i);
  const unlocked = trIsUnlocked(i);

  document.getElementById('trBigLevelNum').textContent = (i + 1);
  document.getElementById('trBigLevelName').textContent = lvl.nombre;

  const starEls = document.querySelectorAll('#trBigStars .star');
  starEls.forEach((el, j) => {
    el.classList.toggle('earned', stars >= j + 1);
  });

  const card = document.querySelector('.trampas-level-card-big');
  card.classList.toggle('locked', !unlocked);

  document.getElementById('trNavLeft').disabled = (i === 0);
  document.getElementById('trNavRight').disabled = (i >= TR_LEVELS.length - 1);
  document.getElementById('trLevelPlayBtn').disabled = !unlocked;

  const dots = document.querySelectorAll('.trampas-level-dot');
  dots.forEach((d, j) => d.classList.toggle('active', j === i));
}

function trNavLevel(dir) {
  if (!TR_LEVELS.length) return;
  trSelectedLevel = Math.max(0, Math.min(TR_LEVELS.length - 1, trSelectedLevel + dir));
  trUpdateLevelCard();
}

function trPlaySelectedLevel() {
  if (!TR_LEVELS.length) return;
  if (!trIsUnlocked(trSelectedLevel)) return;
  trStartLevel(trSelectedLevel);
}

function trStartLevel(i) {
  if (!TR_LEVELS.length || !TR_LEVELS[i]) return;
  TRAMPAS.levelIndex = i;
  TRAMPAS.totalScore = 0;
  TRAMPAS.totalDeaths = 0;
  TRAMPAS.levelStartTime = performance.now();
  TRAMPAS.levelDeaths = 0;
  TRAMPAS.explosions = [];
  trLoadLevel(i);
  trShowGameScreen();
  document.getElementById('trampasPauseMenu').classList.add('hidden');
  document.getElementById('trampasControlsSign').classList.add('hidden');
  showTrampasOverlay(TR_LEVELS[i].nombre, TR_LEVELS[i].hint, false);
  document.getElementById('trampas-hud-deaths').textContent = '💀 0';
  setupTrampasEvents();
  drawTrampas();
}

function trCalculateStars() {
  const elapsed = (performance.now() - TRAMPAS.levelStartTime) / 1000;
  const timeLimit = TR_TIME_LIMITS[TRAMPAS.levelIndex] || 60;
  const deathLimit = TR_DEATH_LIMITS[TRAMPAS.levelIndex] || 5;
  let stars = 1;
  if (elapsed <= timeLimit) stars = 2;
  if (TRAMPAS.levelDeaths <= deathLimit) stars = 3;
  return stars;
}

// ─── Pausa ───
function trPauseGame() {
  TRAMPAS.running = false;
  trLoop.stop();
  document.getElementById('trampasPauseMenu').classList.remove('hidden');
}
function trResumeGame() {
  document.getElementById('trampasPauseMenu').classList.add('hidden');
  TRAMPAS.running = true;
  trLoop.start();
}
function trExitToLevels() {
  document.getElementById('trampasPauseMenu').classList.add('hidden');
  stopTrampas();
  if (typeof setMusic === 'function') setMusic('assert/Castle Escape/sounds/menu_song.mp3');
  trShowLevelSelect();
}

function trLoadLevel(index) {
  const lvl = TR_LEVELS[index];
  TRAMPAS.platforms = lvl.platforms.map(p => ({ ...p, touchedAt: null, gone: false }));
  TRAMPAS.hazards    = lvl.hazards.map(h => ({ ...h }));
  TRAMPAS.arrows     = lvl.arrows.map(a => ({ ...a, active: false, fired: false }));
  TRAMPAS.deathsThisLevel = 0;

  // Tamaño del nivel en world-space (por defecto la vista fija si el nivel
  // no declara width/height, así los niveles viejos siguen funcionando).
  TRAMPAS.levelW = lvl.width  || TR_W;
  TRAMPAS.levelH = lvl.height || TR_H;
  TRAMPAS.fov = lvl.fov || 1;
  TRAMPAS.camera.x = 0;
  TRAMPAS.camera.y = 0;

  // Y del "piso base" del nivel: la fila más baja (mayor y) entre las
  // plataformas normales/falsas (el suelo real). No se cuentan 'crumble'
  // ni 'moving' acá — son islas sueltas por definición y si están más
  // abajo que el piso (ver nivel 20) no deben "correr" el piso hacia
  // abajo y hacer que el piso real se dibuje con textura de isla.
  const floorCandidates = lvl.platforms.filter(p => p.type === 'normal' || p.type === 'fake');
  TRAMPAS.floorY = Math.max(...(floorCandidates.length ? floorCandidates : lvl.platforms).map(p => p.y));

  const p = TRAMPAS.player;
  p.x = lvl.start.x; p.y = lvl.start.y;
  p.vx = 0; p.vy = 0; p.dead = false; p.onGround = false; p.ridingPlatform = null;
  p.facing = 1; p.animFrame = 0; p.animTick = 0; p.animFrameName = null;

  const starsEl = document.getElementById('trampas-hud-stars');
  if (starsEl) starsEl.textContent = (index + 1) + '/' + TR_LEVELS.length + ' - ' + lvl.nombre;

  // Imagen de fondo del castillo (capa 0): una sola imagen (back.png) para
  // todos los niveles.
  const cont = document.querySelector('.trampas-container');
  if (cont) cont.style.background = "#150620 url('assert/Castle Escape/back.png') center/cover no-repeat";
}

// ─── Spritesheets (mapa.png / deco.png) ───
// Se cargan una sola vez, la primera vez que se entra a Castle Escape.
// El dibujo (drawTrampas) chequea si ya están listos antes de usarlos —
// si todavía no cargaron (primer frame o conexión lenta), cae al dibujo
// vectorial de siempre en vez de romper, así que no hace falta await acá.
const TR_ASSETS = [
  { type: 'image', src: 'assert/Castle Escape/mapa.png' },
  { type: 'atlas', src: 'assert/Castle Escape/mapa_atlas.json' },
  { type: 'image', src: 'assert/Castle Escape/deco.png' },
  { type: 'atlas', src: 'assert/Castle Escape/deco_atlas.json' },
  // Personaje — reutiliza el spritesheet de Pixel Runner (junior.png):
  // trae run_0..6 (correr), action_0..6 (acá se usa action_2 como pose de
  // salto, igual que en Pixel Runner) y fall_0..3 (animación de morir).
  { type: 'image', src: 'assert/Castle Escape/models/junior.png' },
  { type: 'atlas', src: 'assert/Castle Escape/models/junior.atlas.json' },
];

function initTrampas() {
  TRAMPAS.canvas = document.getElementById('trampasCanvas');
  const C = TRAMPAS.canvas;
  C.width = TR_W;
  C.height = TR_H;
  TRAMPAS.ctx = C.getContext('2d');

  Engine2D.loadAll(TR_ASSETS).catch(err => console.error('Castle Escape: no se pudieron cargar los sprites', err));

  const dotsEl = document.getElementById('trLevelDots');
  dotsEl.innerHTML = '';
  TR_LEVELS.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'trampas-level-dot';
    dot.onclick = () => { trSelectedLevel = i; trUpdateLevelCard(); };
    dotsEl.appendChild(dot);
  });

  trSelectedLevel = 0;
  trShowMainMenu();
  setupTrampasEvents();
}

function setupTrampasEvents() {
  trInput.attach();
  trAttachEnterHandler();
}

function trMove(dir, on) {
  if (dir === 'left')  TRAMPAS.keys.left  = on;
  if (dir === 'right') TRAMPAS.keys.right = on;
}

function trJump() {
  if (!TRAMPAS.running) return;
  const p = TRAMPAS.player;
  if (p.dead || !p.onGround) return;
  p.vy = TR_JUMP_VY;
  p.onGround = false;
}

function startTrampas() {
  document.getElementById('trampasOverlay').classList.add('hidden');
  TRAMPAS.levelStartTime = performance.now();
  TRAMPAS.levelDeaths = 0;
  TRAMPAS.running = true;
  trLoop.start();
  if (typeof setMusic === 'function') setMusic('assert/Castle Escape/sounds/backsong.mp3');
}

function stopTrampas() {
  TRAMPAS.running = false;
  trLoop.stop();
  trInput.detach();
  if (trEnterHandler) { document.removeEventListener('keydown', trEnterHandler); trEnterHandler = null; }
}

function toggleCastleMusic() {
  if (typeof bgMusic !== 'undefined' && bgMusic) bgMusic.muted = !bgMusic.muted;
}

// ─── Helpers de sprites (mapa.png / deco.png) ───
function trGetMapaAssets() {
  const img = Engine2D.getImage('assert/Castle Escape/mapa.png');
  const atlas = Engine2D.getAtlas('assert/Castle Escape/mapa_atlas.json');
  return (img && img.complete && atlas) ? { img, atlas } : null;
}
function trGetDecoAssets() {
  const img = Engine2D.getImage('assert/Castle Escape/deco.png');
  const atlas = Engine2D.getAtlas('assert/Castle Escape/deco_atlas.json');
  return (img && img.complete && atlas) ? { img, atlas } : null;
}
function trGetJuniorAssets() {
  const img = Engine2D.getImage('assert/Castle Escape/models/junior.png');
  const atlas = Engine2D.getAtlas('assert/Castle Escape/models/junior.atlas.json');
  return (img && img.complete && atlas) ? { img, atlas } : null;
}

// Dibuja una plataforma. El sprite de "isla flotante" (mapa.png) se usa
// SOLO para lo que realmente flota/se mueve/se rompe: plataformas
// 'moving', 'crumble', y las 'normal'/'fake' que están elevadas por
// encima del piso base del nivel (no forman parte de la fila de suelo).
// El "suelo" — los segmentos que están a la misma altura que el resto
// del piso, angostos o anchos — usa la textura de piso "wall" tileada.
// 'fake' siempre se dibuja IGUAL que 'normal' de su misma altura — esa
// es la trampa, no debe notarse cuál es cuál a simple vista.
function trIsFloatingPlatform(plat) {
  return plat.type === 'moving' || plat.type === 'crumble' || plat.y < TRAMPAS.floorY;
}

function trDrawPlatform(ctx, plat) {
  // Todas las plataformas (piso normal/fake y también islas flotantes,
  // crumble y moving) usan la piedra dibujada a mano — mapa.png ya no se
  // usa acá, solo queda para flechas y la puerta de salida.
  trDrawStoneFloor(ctx, plat);
  // Tinte por encima para distinguir estado — el de 'moving' se sacó
  // (tapaba la textura de la plataforma flotante con un rectángulo azul).
  if (plat.type === 'crumble' && plat.touchedAt !== null) {
    ctx.fillStyle = 'rgba(232,84,63,0.45)';
    ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
  }
}

// Piso de piedra gris oscuro dibujado a mano (reemplaza al sprite "wall"
// tileado y al viejo rectángulo morado plano). No es un gris fijo: cada
// bloque tiene un tono levemente distinto (variación tipo mampostería) y
// hay líneas de "argamasa" más oscuras entre bloques. La variación sale de
// un hash determinístico por posición (seno de x/y), no de Math.random,
// así el patrón queda fijo — no titila ni cambia de frame a frame.
const TR_STONE_MORTAR = '#232025';
function trStoneShade(bx, by) {
  const n = Math.sin(bx * 12.9898 + by * 78.233) * 43758.5453;
  return n - Math.floor(n); // 0..1 determinístico para este bloque
}
function trDrawStoneFloor(ctx, plat) {
  const x = plat.x, y = plat.y, w = plat.w, h = plat.h;

  // Argamasa de fondo — se ve en las líneas finas entre bloques.
  ctx.fillStyle = TR_STONE_MORTAR;
  ctx.fillRect(x, y, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Bloques tipo mampostería, filas al tresbolillo (offset alternado).
  const blockH = Math.max(9, Math.round(h / 2));
  const blockW = blockH * 1.7;
  let row = 0;
  for (let by = y; by < y + h; by += blockH) {
    const offset = (row % 2 === 0) ? 0 : -blockW / 2;
    for (let bx = x + offset; bx < x + w; bx += blockW) {
      const t = trStoneShade(Math.round(bx), Math.round(by)); // 0..1
      const g = Math.round(46 + t * 26); // gris oscuro, variación ~46-72
      ctx.fillStyle = `rgb(${g},${g - 2},${g + 3})`; // toque frío, no gris puro
      ctx.fillRect(bx + 1, by + 1, blockW - 2, blockH - 2);
    }
    row++;
  }
  ctx.restore();

  // Borde superior más claro (da sensación de piso sólido/luz de arriba)
  // y sombra fina abajo — mismo criterio visual que tenía el morado plano.
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(x, y + h - 2, w, 2);
}
// Puramente visual — no colisiona, no importa el orden, se dibuja detrás
// de todo lo jugable. 'torch' anima sola (parpadeo, 4 frames de deco.png)
// sin que updateTrampas tenga que saber nada de esto.
function trDrawDecor(ctx) {
  const assets = trGetDecoAssets();
  if (!assets) return;
  const lvl = TR_LEVELS[TRAMPAS.levelIndex];
  const decor = lvl.decor;
  if (!decor || !decor.length) return;
  const F = assets.atlas.frames;
  decor.forEach(d => {
    let f;
    if (d.type === 'torch') {
      const frame = Math.floor(performance.now() / 150) % 4;
      f = F['torch_' + (frame + 1)];
    } else if (d.type === 'ivy') {
      f = F.ivy_1;
    } else if (d.type === 'ivy_2') {
      f = F.ivy_2;
    } else if (d.type === 'chain') {
      f = F.chain_straight;
    } else if (d.type === 'chain_hook') {
      f = F.chain_hook;
    } else if (d.type === 'banner') {
      f = F.banner;
    } else if (d.type === 'banner_tattered') {
      f = F.banner_tattered;
    } else if (d.type === 'rat') {
      f = F.rat;
    }
    if (!f) return;
    const h = d.h || 40;
    const w = h * (f.w / f.h);
    ctx.drawImage(assets.img, f.x, f.y, f.w, f.h, d.x, d.y, w, h);
  });
}

// Sprite de pincho más chico, repetido para llenar un ancho — reemplaza
// los triángulos dibujados a mano, tanto para el peligro 'spike' (pozo)
// como para la decoración decor:'spike' arriba de una plataforma.
// Pinchos dibujados a mano (triángulos) — ya no usa el sprite spike_1a/b/c
// de mapa.png, ese atlas ahora solo se usa para flechas y puerta.
function trDrawSpikeRow(ctx, x, y, w, h) {
  const n = Math.max(1, Math.floor(w / 14));
  const step = w / n;
  for (let i = 0; i < n; i++) {
    const sx = x + i * step;
    // Cuerpo del pincho — degradé simple (más claro en la punta) para
    // que no quede un triángulo de color plano.
    const grad = ctx.createLinearGradient(sx, y + h, sx, y);
    grad.addColorStop(0, '#7f1d1d');
    grad.addColorStop(1, '#f87171');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx, y + h);
    ctx.lineTo(sx + step / 2, y);
    ctx.lineTo(sx + step, y + h);
    ctx.closePath();
    ctx.fill();
    // Filo/brillo en un borde para dar volumen.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + step / 2, y);
    ctx.lineTo(sx + step, y + h);
    ctx.stroke();
  }
}

function trRectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Mueve `obj` (plataforma 'moving' o peligro 'saw') ida y vuelta entre
// obj.move.from y obj.move.to sobre el eje obj.move.axis ('x' o 'y'), a
// obj.move.speed píxeles por step. Devuelve cuánto se desplazó este frame
// (lo usa updateTrampas para arrastrar al jugador si está parado encima).
function trOscillate(obj, step) {
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
function updateTrampas(step) {
  const p = TRAMPAS.player;
  if (p.dead) return;

  // Plataformas 'moving' (van y vienen entre move.from/move.to en un eje) y
  // sierras 'saw' (mismo movimiento, pero son un peligro, no algo pisable).
  // Si el jugador estaba parado arriba de una plataforma móvil, se mueve
  // junto con ella (si no, se le escaparía de abajo de los pies).
  for (const plat of TRAMPAS.platforms) {
    if (plat.type !== 'moving' || plat.gone) continue;
    const delta = trOscillate(plat, step);
    if (delta !== 0 && p.ridingPlatform === plat) p[plat.move.axis] += delta;
  }
  for (const hz of TRAMPAS.hazards) {
    if (hz.type === 'saw') trOscillate(hz, step);
  }

  // Movimiento horizontal
  p.vx = 0;
  if (TRAMPAS.keys.left)  p.vx = -TR_MOVE_SPEED;
  if (TRAMPAS.keys.right) p.vx =  TR_MOVE_SPEED;
  p.x += p.vx * step;
  p.x = Math.max(0, Math.min(p.x, TRAMPAS.levelW - p.w));

  // Animación / dirección del sprite (junior.png) — se actualiza acá,
  // drawTrampasPlayer solo lee p.animFrame/p.facing, no los calcula.
  if (p.vx > 0) p.facing = 1;
  else if (p.vx < 0) p.facing = -1;
  if (p.onGround && p.vx !== 0) {
    p.animTick += step;
    if (p.animTick >= 6) { p.animTick = 0; p.animFrame = (p.animFrame + 1) % TR_RUN_FRAMES.length; }
  } else if (p.onGround) {
    p.animFrame = 0; p.animTick = 0; // quieto = primer frame de correr (pose de parado)
  }

  // Gravedad
  p.vy += TR_GRAVITY * step;
  p.y  += p.vy * step;
  p.onGround = false;
  p.ridingPlatform = null;

  // Colisión con plataformas (todo menos 'fake' —y 'fake' como flag de
  // plataforma móvil falsa— que nunca colisionan). Sigue siendo código
  // propio: son rectángulos sueltos, no una grilla de tiles pareja, así que
  // Engine2D.Physics (pensado para TileMap) no aplica acá.
  for (const plat of TRAMPAS.platforms) {
    if (plat.type === 'fake' || plat.gone || plat.fake) continue;
    const feetPrev = p.y + p.h - p.vy * step;
    const withinX = p.x + p.w > plat.x && p.x < plat.x + plat.w;
    if (withinX && p.vy >= 0 && feetPrev <= plat.y + 1 && p.y + p.h >= plat.y) {
      p.y = plat.y - p.h;
      p.vy = 0;
      p.onGround = true;
      if (plat.type === 'crumble' && plat.touchedAt === null) {
        plat.touchedAt = performance.now();
      }
      if (plat.type === 'moving') p.ridingPlatform = plat;
    }
  }

  // Derrumbe de plataformas 'crumble' 400ms después de pisarlas
  for (const plat of TRAMPAS.platforms) {
    if (plat.type === 'crumble' && plat.touchedAt !== null && !plat.gone) {
      if (performance.now() - plat.touchedAt > 400) plat.gone = true;
    }
  }

  // Flechas de pared: se activan al cruzar triggerX (en las verticales el
  // triggerX sigue siendo el umbral horizontal del jugador; la flecha sale
  // desde su posición y se mueve en y).
  const lvl = TR_LEVELS[TRAMPAS.levelIndex];
  lvl.arrows.forEach((def, i) => {
    const a = TRAMPAS.arrows[i];
    if (!a.fired && p.x >= def.triggerX) {
      a.fired = true;
      a.active = true;
      a.x = def.x;
      a.y = def.y;
    }
  });
  TRAMPAS.arrows.forEach(a => {
    if (a.active) {
      // Movimiento según dirección: -1/1 = horizontal, 'up'/'down' = vertical.
      if (a.dir === 'up')        a.y -= a.speed * step;
      else if (a.dir === 'down') a.y += a.speed * step;
      else                       a.x += a.dir * a.speed * step;
      const outX = a.x < -40 || a.x > TRAMPAS.levelW + 40;
      const outY = a.y < -40 || a.y > TRAMPAS.levelH + 40;
      if (outX || outY) a.active = false;
      if (trRectsOverlap(p, a)) { trPlayerDie(); return; }
    }
  });

  if (p.dead) return;

  // Peligros: estáticos (picos, estrella) y móviles (sierra) — misma
  // comprobación, la sierra ya se movió arriba antes de llegar acá. Los
  // pinchos "falsos" (fake) se ven idénticos pero no matan.
  for (const hz of TRAMPAS.hazards) {
    if (hz.fake) continue;
    if (trRectsOverlap(p, hz)) { trPlayerDie(); return; }
  }

  // Caerse del mapa
  if (p.y > TRAMPAS.levelH + 20) { trPlayerDie(); return; }

  // Cámara: sigue al jugador y se recorta al tamaño del nivel. El área
  // visible (viewW×viewH) no es siempre TR_W×TR_H: se escala según el
  // "campo de visión" del nivel (TRAMPAS.fov) — ver drawTrampas, donde se
  // aplica el ctx.scale correspondiente para que esta misma área encaje
  // en el canvas físico de 480x270.
  const cam = TRAMPAS.camera;
  const fov = TRAMPAS.fov || 1;
  const viewW = TR_W * fov, viewH = TR_H * fov;
  const maxX = Math.max(0, TRAMPAS.levelW - viewW);
  const maxY = Math.max(0, TRAMPAS.levelH - viewH);
  cam.x = Math.max(0, Math.min(maxX, p.x + p.w / 2 - viewW / 2));
  cam.y = Math.max(0, Math.min(maxY, p.y + p.h / 2 - viewH / 2));

  // Llegar a la salida
  if (trRectsOverlap(p, lvl.exit)) { trLevelComplete(); }
}

function drawTrampasPlayer(ctx, p) {
  // Sprite real (junior.png, reutilizado de Pixel Runner) — si ya cargó,
  // se usa esto y no el dibujo a mano de abajo (que queda de fallback
  // por si los assets todavía no terminaron de cargar).
  const junior = trGetJuniorAssets();
  if (junior) {
    const frameName = p.dead
      ? (p.animFrameName || TR_FALL_FRAMES[0])
      : (!p.onGround ? TR_JUMP_FRAME : TR_RUN_FRAMES[p.animFrame]);
    ctx.save();
    if (p.dead) ctx.globalAlpha = 0.85;
    // Ancla: centro-x del hitbox, borde inferior — mismo criterio que ya
    // usa Pixel Runner con este mismo sprite (targetH = altura del hitbox,
    // drawAtlasFrame centra el ancho solo y sube desde `y`).
    Engine2D.drawAtlasFrame(ctx, junior.img, junior.atlas, frameName, p.x + p.w / 2, p.y + p.h, p.h, p.facing === -1, false);
    ctx.restore();
    return;
  }

  const x = Math.round(p.x), y = Math.round(p.y);
  const W = p.w, H = p.h;

  if (p.dead) {
    ctx.save();
    ctx.globalAlpha = 0.7;
  }

  const S = W / 32;

  const legColors = ['#1e3a5f', '#1e3a5f'];
  const shoeColor = '#f5c518';

  if (!p.dead) {
    ctx.fillStyle = legColors[0];
    ctx.fillRect(x + 8*S, y + 25*S, 7*S, 8*S);
    ctx.fillStyle = shoeColor;
    ctx.fillRect(x + 6*S, y + 33*S, 9*S, 3*S);
    ctx.fillStyle = legColors[1];
    ctx.fillRect(x + 17*S, y + 25*S, 7*S, 8*S);
    ctx.fillStyle = shoeColor;
    ctx.fillRect(x + 17*S, y + 33*S, 9*S, 3*S);
  } else {
    ctx.fillStyle = legColors[0];
    ctx.fillRect(x + 8*S, y + 25*S, 7*S, 8*S);
    ctx.fillRect(x + 17*S, y + 25*S, 7*S, 8*S);
    ctx.fillStyle = shoeColor;
    ctx.fillRect(x + 6*S, y + 33*S, 9*S, 3*S);
    ctx.fillRect(x + 17*S, y + 33*S, 9*S, 3*S);
  }

  ctx.fillStyle = '#2563eb';
  ctx.fillRect(x + 8*S, y + 14*S, 16*S, 11*S);

  ctx.fillStyle = '#fbbf7a';
  ctx.fillRect(x + 12*S, y + 14*S, 8*S, 3*S);

  ctx.fillStyle = '#fbbf7a';
  ctx.fillRect(x + 3*S,  y + 16*S, 5*S, 3*S);
  ctx.fillRect(x + 24*S, y + 16*S, 5*S, 3*S);

  ctx.fillStyle = '#fbbf7a';
  ctx.fillRect(x + 8*S, y + 2*S, 16*S, 13*S);

  ctx.fillStyle = '#3b2506';
  ctx.fillRect(x + 8*S,  y,       16*S, 3*S);
  ctx.fillRect(x + 7*S,  y + 1*S, 2*S,  2*S);
  ctx.fillRect(x + 23*S, y + 1*S, 2*S,  2*S);

  ctx.strokeStyle = '#1a3a6b';
  ctx.lineWidth = Math.max(1, S * 1.5);
  ctx.strokeRect(x + 8*S,  y + 8*S, 7*S, 5*S);
  ctx.strokeRect(x + 17*S, y + 8*S, 7*S, 5*S);

  ctx.fillStyle = '#1a3a6b';
  ctx.fillRect(x + 15*S, y + 10*S, 2*S, 1.5*S);

  ctx.fillStyle = 'rgba(147,197,253,0.55)';
  ctx.fillRect(x + 9*S,  y + 9*S, 5*S, 3*S);
  ctx.fillRect(x + 18*S, y + 9*S, 5*S, 3*S);

  ctx.fillStyle = p.dead ? '#ef4444' : '#d97706';
  ctx.fillRect(x + 12*S, y + 12*S, 8*S, 2*S);

  if (!p.dead) {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(x + 10*S, y + 9.5*S, 2*S, 1.5*S);
    ctx.fillRect(x + 20*S, y + 9.5*S, 2*S, 1.5*S);
  } else {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = S;
    ctx.beginPath();
    ctx.moveTo(x + 9*S,  y + 9*S); ctx.lineTo(x + 14*S, y + 13*S);
    ctx.moveTo(x + 14*S, y + 9*S); ctx.lineTo(x + 9*S,  y + 13*S);
    ctx.moveTo(x + 18*S, y + 9*S); ctx.lineTo(x + 23*S, y + 13*S);
    ctx.moveTo(x + 23*S, y + 9*S); ctx.lineTo(x + 18*S, y + 13*S);
    ctx.stroke();
  }

  if (p.dead) ctx.restore();
}

function spawnExplosion(cx, cy) {
  const colors = ['#ef4444', '#f97316', '#facc15', '#fbbf24', '#fff'];
  for (let i = 0; i < 18; i++) {
    const angle = (Math.PI * 2 / 18) * i + (Math.random() - 0.5) * 0.4;
    const speed = 2 + Math.random() * 4;
    TRAMPAS.explosions.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 2 + Math.random() * 3,
      life: 1,
      decay: 0.02 + Math.random() * 0.03,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

function updateExplosions() {
  for (let i = TRAMPAS.explosions.length - 1; i >= 0; i--) {
    const e = TRAMPAS.explosions[i];
    e.x += e.vx;
    e.y += e.vy;
    e.vy += 0.1;
    e.life -= e.decay;
    if (e.life <= 0) TRAMPAS.explosions.splice(i, 1);
  }
}

function drawExplosions(ctx) {
  for (const e of TRAMPAS.explosions) {
    ctx.globalAlpha = e.life;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * e.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function trPlayerDie() {
  const p = TRAMPAS.player;
  p.dead = true;
  TRAMPAS.deathsThisLevel++;
  TRAMPAS.totalDeaths++;
  TRAMPAS.levelDeaths++;
  const deathsEl = document.getElementById('trampas-hud-deaths');
  if (deathsEl) deathsEl.textContent = '💀 ' + TRAMPAS.totalDeaths;
  spawnExplosion(p.x + p.w / 2, p.y + p.h / 2);

  // Recorre fall_0..3 (junior.png) mientras dura el respawn, en vez de
  // quedarse en un solo frame — mismo criterio que playDeathAnimation en
  // Pixel Runner. El loop del juego (trLoop) sigue dibujando solo (updateTrampas
  // corta al toque por p.dead, pero el draw() del loop sigue en pie), así que acá
  // alcanza con ir cambiando animFrameName; no hace falta llamar drawTrampas() de nuevo.
  p.animFrameName = TR_FALL_FRAMES[0];

  let fallFrame = 0;
  const fallTimer = setInterval(() => {
    fallFrame++;
    if (fallFrame < TR_FALL_FRAMES.length) p.animFrameName = TR_FALL_FRAMES[fallFrame];
  }, TR_FALL_FRAME_DELAY);

  setTimeout(() => {
    clearInterval(fallTimer);
    trLoadLevel(TRAMPAS.levelIndex);
  }, TR_DEATH_DELAY);
}

function trLevelComplete() {
  TRAMPAS.running = false;
  trLoop.stop();

  const stars = trCalculateStars();
  trSaveLevelStars(TRAMPAS.levelIndex, stars);

  const basePoints = 100;
  const starPoints = stars * 50;
  const levelScore = basePoints + starPoints;
  TRAMPAS.totalScore += levelScore;

  const starsText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  const timeLimit = TR_TIME_LIMITS[TRAMPAS.levelIndex] || 60;
  const deathLimit = TR_DEATH_LIMITS[TRAMPAS.levelIndex] || 5;
  const condiciones = '★ Completar el nivel\n★★ En ' + timeLimit + 's o menos\n★★★ Con ' + deathLimit + ' muerte' + (deathLimit === 1 ? '' : 's') + ' o menos';

  document.getElementById('trampas-hud-deaths').textContent = '💀 0';

  // Reiniciar contadores para que el próximo nivel empiece en 0
  TRAMPAS.totalDeaths = 0;
  TRAMPAS.levelDeaths = 0;

  const esUltimo = TRAMPAS.levelIndex >= TR_LEVELS.length - 1;
  if (esUltimo) {
    if (typeof guardarPuntaje === 'function') guardarPuntaje(8, TRAMPAS.totalScore, null);
    showTrampasOverlay('🏆 ¡Completaste todo!', starsText + '  +' + levelScore + ' pts — Total: ' + TRAMPAS.totalScore + '\n\n' + condiciones, true);
  } else {
    TRAMPAS.levelIndex++;
    TRAMPAS.levelStartTime = performance.now();
    trLoadLevel(TRAMPAS.levelIndex);
    showTrampasOverlay('✅ ¡Nivel superado!', starsText + '  +' + levelScore + ' pts\n\n' + condiciones, false, '▶ Continuar');
  }
}

function showTrampasOverlay(title, sub, isEnd, btnLabel) {
  const overlay = document.getElementById('trampasOverlay');
  overlay.classList.remove('hidden');
  document.getElementById('trampasOverlayTitle').textContent = title;
  document.getElementById('trampasOverlaySub').textContent = sub;
  document.getElementById('trampasStartBtn').textContent = isEnd ? '🔄 Jugar de nuevo' : (btnLabel || '▶ Empezar');
  document.getElementById('trampasStartBtn').onclick = isEnd ? restartTrampas : startTrampas;
}

function restartTrampas() {
  trBackToLevelSelect();
}

function drawTrampas() {
  const ctx = TRAMPAS.ctx;
  if (!ctx) return;
  const p = TRAMPAS.player;

  // Fondo transparente: el contenedor muestra la imagen del castillo (capa 0).
  // Todo el dibujo de world-space va dentro del translate de la cámara.
  ctx.clearRect(0, 0, TR_W, TR_H);
  ctx.save();
  // Escala inversa al fov: fov>1 (ve más mapa) => escala <1 (todo se dibuja
  // más chico); fov<1 (ve menos mapa) => escala >1 (todo se dibuja más
  // grande/zoom in). Con fov=1 esto es un scale(1,1), o sea no cambia nada
  // respecto al comportamiento original.
  const trFovScale = 1 / (TRAMPAS.fov || 1);
  ctx.scale(trFovScale, trFovScale);
  ctx.translate(-TRAMPAS.camera.x, -TRAMPAS.camera.y);

  // Decoración de fondo (antorchas/hiedra/cadenas/estandartes) — va antes
  // que las plataformas para quedar detrás de todo lo jugable.
  trDrawDecor(ctx);

  // Peligros tipo 'spike' — van ANTES que las plataformas. En la mayoría
  // de los niveles el pincho está a y:255 y ninguna plataforma baja de
  // y:250, así que este orden no cambia nada visualmente. Pero en los
  // niveles 7 y 15 hay una plataforma 'fake' que ocupa el MISMO rectángulo
  // que un pincho (el diseño es "piso falso con pinchos escondidos
  // debajo"): si el pincho se dibuja después, se pinta encima de la
  // textura de piedra y la trampa se nota a simple vista. Dibujándolo
  // antes, la fake lo tapa como cualquier plataforma normal.
  for (const hz of TRAMPAS.hazards) {
    if (hz.type === 'spike') {
      trDrawSpikeRow(ctx, hz.x, hz.y, hz.w, hz.h);
    }
  }

  // Plataformas
  for (const plat of TRAMPAS.platforms) {
    if (plat.gone) continue;
    trDrawPlatform(ctx, plat);
    if (plat.decor === 'spike') {
      trDrawSpikeRow(ctx, plat.x, plat.y - 20, plat.w, 20);
    }
  }

  // Resto de los peligros (star, saw) — estos SÍ están pensados para
  // verse (señuelo visible o peligro en movimiento), así que se quedan
  // dibujándose después de las plataformas como antes.
  for (const hz of TRAMPAS.hazards) {
    if (hz.type === 'star') {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      const cx = hz.x + hz.w / 2, cy = hz.y + hz.h / 2, r = hz.w / 2;
      for (let i = 0; i < 5; i++) {
        const ang = (Math.PI * 2 / 5) * i - Math.PI / 2;
        const angIn = ang + Math.PI / 5;
        ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
        ctx.lineTo(cx + Math.cos(angIn) * r * 0.45, cy + Math.sin(angIn) * r * 0.45);
      }
      ctx.closePath();
      ctx.fill();
    } else if (hz.type === 'saw') {
      // Sierra circular con dientes — el ángulo gira en función de la
      // posición (obj[axis]) así que la rotación va acorde a cómo se mueve,
      // no es una animación aparte que haya que actualizar por su cuenta.
      const cx = hz.x + hz.w / 2, cy = hz.y + hz.h / 2, r = hz.w / 2;
      const angle = (hz[hz.move.axis] || 0) * 0.15;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const teeth = 8;
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const rr = i % 2 === 0 ? r : r * 0.7;
        const a = (Math.PI * 2 / (teeth * 2)) * i;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Flechas activas (horizontales: sprites arrow_left/right; verticales:
  // mismo sprite arrow_right rotado 90° para que apunte arriba/abajo).
  {
    const assets = trGetMapaAssets();
    TRAMPAS.arrows.forEach(a => {
      if (!a.active) return;
      if (assets) {
        let f, rot = 0;
        if (a.dir === 'up')        { f = assets.atlas.frames.arrow_right; rot = -Math.PI / 2; }
        else if (a.dir === 'down') { f = assets.atlas.frames.arrow_right; rot =  Math.PI / 2; }
        else                       { f = a.dir < 0 ? assets.atlas.frames.arrow_left : assets.atlas.frames.arrow_right; }
        if (f) {
          ctx.save();
          ctx.translate(a.x + a.w / 2, a.y + a.h / 2);
          if (rot) ctx.rotate(rot);
          ctx.drawImage(assets.img, f.x, f.y, f.w, f.h, -a.w / 2, -a.h / 2, a.w, a.h);
          ctx.restore();
          return;
        }
      }
      // Fallback vectorial (sin assets): triángulo según dirección.
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      if (a.dir === 'up')        { ctx.moveTo(a.x + a.w/2, a.y); ctx.lineTo(a.x, a.y + a.h); ctx.lineTo(a.x + a.w, a.y + a.h); }
      else if (a.dir === 'down') { ctx.moveTo(a.x + a.w/2, a.y + a.h); ctx.lineTo(a.x, a.y); ctx.lineTo(a.x + a.w, a.y); }
      else if (a.dir < 0)        { ctx.moveTo(a.x, a.y + a.h/2); ctx.lineTo(a.x + a.w, a.y); ctx.lineTo(a.x + a.w, a.y + a.h); }
      else                       { ctx.moveTo(a.x + a.w, a.y + a.h/2); ctx.lineTo(a.x, a.y); ctx.lineTo(a.x, a.y + a.h); }
      ctx.closePath();
      ctx.fill();
    });
  }

  // Salida
  const lvl = TR_LEVELS[TRAMPAS.levelIndex];
  {
    const assets = trGetMapaAssets();
    const f = assets && assets.atlas.frames.door;
    if (f) {
      ctx.drawImage(assets.img, f.x, f.y, f.w, f.h, lvl.exit.x, lvl.exit.y, lvl.exit.w, lvl.exit.h);
    } else {
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(lvl.exit.x, lvl.exit.y, lvl.exit.w, lvl.exit.h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(lvl.exit.x, lvl.exit.y, lvl.exit.w, 5);
    }
  }

  // Jugador — sprite dibujado a mano
  drawTrampasPlayer(ctx, p);

  // Explosiones
  updateExplosions();
  drawExplosions(ctx);

  // Salir del espacio de world (cámara)
  ctx.restore();
}
