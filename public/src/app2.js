window.onerror = function(msg, url, line, col, err) {
  alert("Error: " + msg + " at line " + line);
  return false;
};
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   UniGames â€” app.js
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let currentUser = null;

// === AUTO-LOGIN DEV ===
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('dev_token') && urlParams.has('dev_user')) {
  localStorage.setItem('unigames_token', urlParams.get('dev_token'));
  localStorage.setItem('unigames_user', decodeURIComponent(urlParams.get('dev_user')));
  window.history.replaceState({}, document.title, "/");
  // Refrescar para aplicar los cambios de sesiÃ³n de inmediato
  window.location.reload();
}
// ======================

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   CachÃ© del DOM
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Mismo criterio que en rpg.js/pixelrunner.js/castle_escape.js: buscar
// una sola vez, al cargar el script, los elementos que YA existen en el
// HTML (el script va al final del <body>). Ojo: acÃ¡ quedaron afuera los
// elementos que NO estÃ¡n en index.html porque se arman con innerHTML
// reciÃ©n cuando se abre esa pantalla (panel de admin, dashboard,
// input/timer de Termina y Preguntados, banner de aviso) â€” esos se
// tienen que seguir buscando en el momento, cachearlos darÃ­a null para
// siempre.
const APP_EL = {
  accountDrawer: document.getElementById('accountDrawer'),
  accountDrawerBody: document.getElementById('accountDrawerBody'),
  actionGrid: document.getElementById('actionGrid'),
  adivinaBtnPista: document.getElementById('adivinaBtnPista'),
  adivinaBtnRendirse: document.getElementById('adivinaBtnRendirse'),
  adivinaCanvas: document.getElementById('adivinaCanvas'),
  adivinaFeedback: document.getElementById('adivinaFeedback'),
  adivinaGame: document.getElementById('adivinaGame'),
  adivinaInput: document.getElementById('adivinaInput'),
  adivinaItemNum: document.getElementById('adivinaItemNum'),
  adivinaItemTotal: document.getElementById('adivinaItemTotal'),
  adivinaOverlay: document.getElementById('adivinaOverlay'),
  adivinaOverlayBtn: document.getElementById('adivinaOverlayBtn'),
  adivinaOverlayDesc: document.getElementById('adivinaOverlayDesc'),
  adivinaOverlayEmoji: document.getElementById('adivinaOverlayEmoji'),
  adivinaOverlayTitle: document.getElementById('adivinaOverlayTitle'),
  adivinaPistaCosto: document.getElementById('adivinaPistaCosto'),
  adivinaPistasList: document.getElementById('adivinaPistasList'),
  adivinaPistasUsed: document.getElementById('adivinaPistasUsed'),
  adivinaScore: document.getElementById('adivinaScore'),
  ahorcadoKeyboard: document.getElementById('ahorcado-keyboard'),
  ahorcadoStatus: document.getElementById('ahorcado-status'),
  ahorcadoWord: document.getElementById('ahorcado-word'),
  authSectionLogin: document.getElementById('auth-section-login'),
  authSectionRegister: document.getElementById('auth-section-register'),
  drawerBackdrop: document.getElementById('drawerBackdrop'),
  featuredGrid: document.getElementById('featuredGrid'),
  globalAudioBtn: document.getElementById('globalAudioBtn'),
  hamburger: document.getElementById('hamburger'),
  infoOverlay: document.getElementById('infoOverlay'),
  lbGlobalGrids: document.getElementById('lb-global-grids'),
  lbPanelAll: document.getElementById('lb-panel-all'),
  lbPanelSingle: document.getElementById('lb-panel-single'),
  leaderboardBody: document.getElementById('leaderboardBody'),
  loginIdentity: document.getElementById('loginIdentity'),
  loginPassword: document.getElementById('loginPassword'),
  modalOverlay: document.getElementById('modalOverlay'),
  navMenu: document.getElementById('navMenu'),
  preguntadosThemeLabel: document.getElementById('preguntados-theme-label'),
  regConfirm: document.getElementById('regConfirm'),
  regEmail: document.getElementById('regEmail'),
  regPassword: document.getElementById('regPassword'),
  regUsername: document.getElementById('regUsername'),
  runnerAjustesPanel: document.getElementById('runnerAjustesPanel'),
  runnerComoJugarPanel: document.getElementById('runnerComoJugarPanel'),
  runnerFullscreenBtn: document.getElementById('runnerFullscreenBtn'),
  runnerFullscreenRow: document.getElementById('runnerFullscreenRow'),
  runnerHudFullscreenBtn: document.getElementById('runnerHudFullscreenBtn'),
  runnerMejorasCoinsTotal: document.getElementById('runnerMejorasCoinsTotal'),
  runnerMejorasGrid: document.getElementById('runnerMejorasGrid'),
  runnerMejorasPanel: document.getElementById('runnerMejorasPanel'),
  runnerModePanel: document.getElementById('runnerModePanel'),
  runnerModoInfinitoBtn: document.getElementById('runnerModoInfinitoBtn'),
  runnerModoInfinitoDesc: document.getElementById('runnerModoInfinitoDesc'),
  runnerMusicVolume: document.getElementById('runnerMusicVolume'),
  runnerMusicVolumeValue: document.getElementById('runnerMusicVolumeValue'),
  runnerSfxVolume: document.getElementById('runnerSfxVolume'),
  runnerSfxVolumeValue: document.getElementById('runnerSfxVolumeValue'),
  secAhorcado: document.getElementById('sec-ahorcado'),
  secJuegos: document.getElementById('sec-juegos'),
  secPreguntados: document.getElementById('sec-preguntados'),
  secSopa: document.getElementById('sec-sopa'),
  secTermina: document.getElementById('sec-termina'),
  secWordle: document.getElementById('sec-wordle'),
  simpleGrid: document.getElementById('simpleGrid'),
  sopaThemeLabel: document.getElementById('sopa-theme-label'),
  tabLogin: document.getElementById('tabLogin'),
  tabRegister: document.getElementById('tabRegister'),
  terminaThemeLabel: document.getElementById('termina-theme-label'),
  wordleBoard: document.getElementById('wordle-board'),
  wordleHint: document.getElementById('wordle-hint'),
  wordleKeyboard: document.getElementById('wordle-keyboard'),
  wordleStatus: document.getElementById('wordle-status'),
  wordleThemeLabel: document.getElementById('wordle-theme-label'),
  year: document.getElementById('year'),
};

// â”€â”€â”€ Audio Manager â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let globalAudioEnabled = true;
let pageMusicMuted = false;

// Volumen de mÃºsica/efectos â€” 0 a 1, persistido en localStorage para que
// se recuerde entre sesiones. Cualquier juego (no solo Castle Escape)
// puede leer/cambiar esto con getGlobalMusicVolume()/setGlobalMusicVolume().
function loadStoredVolume(key, fallback) {
  const raw = localStorage.getItem(key);
  const n = raw !== null ? parseFloat(raw) : NaN;
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}
let musicVolume = loadStoredVolume('musicVolume', 0.5);
let sfxVolume = loadStoredVolume('sfxVolume', 0.8);

function setGlobalMusicVolume(v) {
  musicVolume = Math.min(1, Math.max(0, v));
  bgMusic.volume = musicVolume;
  localStorage.setItem('musicVolume', musicVolume);
}
function setGlobalSfxVolume(v) {
  sfxVolume = Math.min(1, Math.max(0, v));
  deathSound.volume = sfxVolume;
  localStorage.setItem('sfxVolume', sfxVolume);
}
function getGlobalMusicVolume() { return musicVolume; }
function getGlobalSfxVolume() { return sfxVolume; }

const bgMusic = new Audio('assert/menu.mp3');
bgMusic.loop = true;
bgMusic.volume = musicVolume;

const deathSound = new Audio('sounds/muerte.mp3');
deathSound.volume = sfxVolume;

const gameMusicMap = {
  runner: 'pixel-runner.mp3',
  castle_escape: 'backsong.mp3',
  sopa: null,
  ahorcado: null,
  wordle: null,
  trampas: null,
  adivina: null,
  termina: null,
  preguntados: null
};

// El audio arranca "activado" por defecto (icono ðŸ”Š) e intenta reproducirse
// apenas carga la pÃ¡gina.
function initAudio() {
  const btn = APP_EL.globalAudioBtn;
  if (btn) btn.innerHTML = '<svg style="width:1.8rem;height:1.8rem;fill:#FFF;filter:drop-shadow(0 0 2px rgba(255,255,255,0.8));" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
  attemptPlayMusic();
}

// Los navegadores bloquean bgMusic.play() si no hay un gesto del usuario
// (click/tap/tecla) todavÃ­a. Por eso al entrar a la pÃ¡gina la mÃºsica no
// se escuchaba: play() fallaba en silencio (solo el console.log del catch).
// attemptPlayMusic() intenta reproducir y, si el navegador lo bloquea,
// arma un listener para arrancar apenas el usuario interactÃºe con la
// pÃ¡gina por primera vez (no hace falta que toque el botÃ³n de audio).
function attemptPlayMusic() {
  if (!globalAudioEnabled || pageMusicMuted) return;
  const playPromise = bgMusic.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => armFirstInteractionUnlock());
  }
}

let firstInteractionArmed = false;
function armFirstInteractionUnlock() {
  if (firstInteractionArmed) return;
  firstInteractionArmed = true;
  const unlock = () => {
    document.removeEventListener('click', unlock);
    document.removeEventListener('touchstart', unlock);
    document.removeEventListener('keydown', unlock);
    firstInteractionArmed = false;
    attemptPlayMusic();
  };
  document.addEventListener('click', unlock, { once: true });
  document.addEventListener('touchstart', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
}

function toggleGlobalAudio() {
  globalAudioEnabled = !globalAudioEnabled;
  if (globalAudioEnabled) {
    APP_EL.globalAudioBtn.innerHTML = '<svg style="width:1.8rem;height:1.8rem;fill:#FFF;filter:drop-shadow(0 0 2px rgba(255,255,255,0.8));" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
    unmutepageMusic();
  } else {
    APP_EL.globalAudioBtn.innerHTML = '<svg style="width:1.8rem;height:1.8rem;fill:#FFF;filter:drop-shadow(0 0 2px rgba(255,255,255,0.8));" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
    bgMusic.pause();
  }
}

function changeBgMusic(trackName) {
  // trackName puede venir con o sin ruta
  // Si ya tiene assert/ o sounds/, usarlo tal cual, si no, prefijo assert/
  let newSrc;
  if (trackName.startsWith('assert/')) {
    newSrc = trackName;
  } else if (trackName.startsWith('sounds/')) {
    newSrc = 'assert/' + trackName;
  } else {
    newSrc = 'assert/' + trackName;
  }
  setMusic(newSrc);
}

// Reproduce una pista de mÃºsica de fondo (menÃº o juego).
// Solo cambia el src si es distinto para no reiniciar la reproducciÃ³n,
// y siempre intenta reproducir (dentro de un gesto del usuario).
let currentMusicSrc = null;
function setMusic(src, forceRestart) {
  if (currentMusicSrc !== src) {
    currentMusicSrc = src;
    bgMusic.src = src;
  } else if (forceRestart) {
    // Mismo track, pero se pide arrancar desde 0 (ej: reintentar un nivel
    // despuÃ©s de perder, en vez de seguir donde habÃ­a quedado sonando).
    bgMusic.currentTime = 0;
  }
  bgMusic.loop = true;
  bgMusic.volume = musicVolume;
  attemptPlayMusic();
}

function mutePageMusic() {
  pageMusicMuted = true;
  bgMusic.pause();
}

function unmutepageMusic() {
  pageMusicMuted = false;
  attemptPlayMusic();
}

function playDeathSound() {
  if (globalAudioEnabled) {
    deathSound.currentTime = 0;
    deathSound.play().catch(e => console.log("Audio play prevented:", e));
  }
}

// â”€â”€â”€ Datos de juegos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const allGames = [
  { id: 'sopa', title: 'Sopa de Letras',    desc: 'EncontrÃ¡ palabras ocultas en la grilla. Mientras mÃ¡s rÃ¡pido, mÃ¡s puntos ganÃ¡s.', tag: 'Velocidad' },
  { id: 'preguntados', title: 'Preguntados',        desc: 'Trivia de mÃºltiple opciÃ³n. RespondÃ© preguntas sobre tu temÃ¡tica favorita.',       tag: 'Trivia'    },
  { id: 'termina', title: 'Termina la Palabra', desc: 'AdivinÃ¡ la palabra incompleta. TenÃ©s solo 5 intentos. Â¡PensÃ¡ bien!',             tag: '5 intentos' },
  { id: 'ahorcado', title: 'Ahorcado',           desc: 'El clÃ¡sico de siempre, ahora con temÃ¡ticas. Letra por letra antes de que se complete el dibujo.', tag: 'ClÃ¡sico'   },
  { id: 'adivina', title: 'Adivina la Cosa',   desc: 'Pistas progresivas para adivinar un juego, pelÃ­cula, actor o anime.',           tag: 'Pistas'    },
  { id: 'wordle', title: 'Adivina la Palabra', desc: 'Modo difÃ­cil estilo Wordle. 5 intentos, colores que te dan pistas letra por letra.', tag: 'Hard'     },
];

// Los juegos de acciÃ³n (jugables con el motor 2D): Pixel Runner, Castle
// Escape y RPG Pixel. Se usan en "Juegos Destacados" y "Juegos de AcciÃ³n".
const actionGames = [
  { id: 'runner', title: 'Pixel Runner',     desc: 'CorrÃ© sin parar, esquivÃ¡ obstÃ¡culos del suelo y del cielo. Doble salto y velocidad creciente.', tag: 'AcciÃ³n'   },
  { id: 'castle_escape', title: 'Castle Escape',    desc: 'SaltÃ¡ plataformas, esquivÃ¡ trampas y llegÃ¡ a la salida de los 20 niveles del castillo.',   tag: 'Aventura' },
  { id: 'rpg_pixel', title: 'RPG Pixel',         desc: 'CombatÃ­ contra jefes pixel art: disparÃ¡ y bloqueÃ¡ con el escudo en arenas fijas.',         tag: 'Combate'  },
];

// Los 3 juegos sencillos fijos que se muestran siempre en el inicio.
const SIMPLE_GAME_IDS = ['sopa', 'ahorcado', 'preguntados'];

// â”€â”€â”€ Utilidades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// Ãconos de lÃ­nea (mismo estilo que el menÃº lateral: trazo simple,
// sin relleno) para cada minijuego, usados en las tarjetas de Inicio/
// Juegos, las pestaÃ±as de PuntuaciÃ³n/Logros y la lista de logros.
// TODO (backend): sin relaciÃ³n con backend, es solo presentaciÃ³n.
function gameIconSVG(id, size = 22) {
  const paths = {
    sopa: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>',
    preguntados: '<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    termina: '<polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line>',
    ahorcado: '<line x1="4" y1="21" x2="16" y2="21"></line><line x1="7" y1="21" x2="7" y2="3"></line><line x1="7" y1="3" x2="17" y2="3"></line><line x1="17" y1="3" x2="17" y2="7"></line><circle cx="17" cy="10" r="3"></circle>',
    adivina: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
    wordle: '<rect x="2" y="8" width="6" height="8" rx="1.5"></rect><rect x="9" y="8" width="6" height="8" rx="1.5"></rect><rect x="16" y="8" width="6" height="8" rx="1.5"></rect>',
    runner: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
    castle_escape: '<rect x="4" y="10" width="16" height="11"></rect><rect x="4" y="6" width="3" height="4"></rect><rect x="10.5" y="4" width="3" height="6"></rect><rect x="17" y="6" width="3" height="4"></rect><path d="M10 21v-5a2 2 0 0 1 4 0v5"></path>',
    rpg_pixel: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
    general: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
    todos: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
  };
  const inner = paths[id] || paths.general;
  return `<svg class="game-icon-svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

// Ãconos de lÃ­nea chicos para textos/botones sueltos (chequear, agregar,
// advertencia, persona, papelera, duelo, etc.) â€” mismo estilo que el
// resto de los Ã­conos de la app.
function uiIconSVG(name, size = 14) {
  const paths = {
    check: '<polyline points="20 6 9 17 4 12"></polyline>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
    warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    trash: '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>',
    target: '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1"></circle>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>',
    crown: '<path d="M3 19h18"></path><path d="M5 19l-1.5-10L9 13l3-7 3 7 5.5-4L19 19"></path>',
    handshake: '<path d="M8.5 14.5 4 10l3.5-3.5a2 2 0 0 1 2.83 0l1.17 1.17"></path><path d="M15.5 14.5 20 10l-3.5-3.5a2 2 0 0 0-2.83 0l-1.17 1.17"></path><path d="M8.5 14.5l2 2a2 2 0 0 0 2.83 0l.34-.34a2 2 0 0 1 2.83 0L18 17.66"></path><path d="M9.5 13.5l1.79-1.79a2 2 0 0 1 2.83 0L15.5 13"></path>',
    maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"></path><path d="M21 8V5a2 2 0 0 0-2-2h-3"></path><path d="M3 16v3a2 2 0 0 0 2 2h3"></path><path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>',
    minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3"></path><path d="M21 8h-3a2 2 0 0 1-2-2V3"></path><path d="M3 16h3a2 2 0 0 1 2 2v3"></path><path d="M16 21v-3a2 2 0 0 1 2-2h3"></path>',
  };
  const inner = paths[name] || '';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}


// â”€â”€â”€ Inicio: juegos destacados aleatorios â”€â”€â”€
function gameCardHTML(g) {
  return `
    <div class="game-card" onclick="launchGame('${g.id}', this)">
      <div class="card-emoji">${gameIconSVG(g.id, 32)}</div>
      <div class="card-title">${g.title}</div>
      <p class="card-desc">${g.desc}</p>
      <span class="card-tag">${g.tag}</span>
      <button class="btn-play">â–¶ Jugar ahora</button>
    </div>
  `;
}

// Destacados: 3 al azar de TODOS los juegos (clÃ¡sicos + de acciÃ³n).
function renderFeatured() {
  const pool = [...allGames, ...actionGames];
  const three = shuffle(pool).slice(0, 3);
  APP_EL.featuredGrid.innerHTML = three.map(gameCardHTML).join('');
}

// Juegos sencillos: 3 fijos (definidos en SIMPLE_GAME_IDS).
function renderSimple() {
  const list = SIMPLE_GAME_IDS.map(id => allGames.find(g => g.id === id)).filter(Boolean);
  APP_EL.simpleGrid.innerHTML = list.map(gameCardHTML).join('');
}

// Juegos de acciÃ³n: los jugables con el motor 2D.
function renderAction() {
  APP_EL.actionGrid.innerHTML = actionGames.map(gameCardHTML).join('');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   AMIGOS
//   Conectado al backend: routes/amigos.js expone
//   GET /api/amigos, GET/POST /api/amigos/solicitudes,
//   POST /api/amigos/solicitudes/:id/(aceptar|rechazar) y
//   DELETE /api/amigos/:id. La bÃºsqueda de usuarios usa
//   GET /api/usuarios/buscar?nombre=...
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Helper chico para no repetir el armado de headers en cada fetch
// autenticado. Devuelve el JSON parseado; si la respuesta no es ok,
// tira un Error con el mensaje que mandÃ³ el backend (o uno genÃ©rico).
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('unigames_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(url, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch { /* respuesta sin body */ }
  if (!res.ok) throw new Error((data && data.error) || 'Error de red');
  return data;
}

// Amigos aceptados del usuario logueado (se llena con fetchAmigos()).
let amigosList = [];

// MÃ¡ximo de amigos permitidos (debe coincidir con MAX_AMIGOS en routes/amigos.js,
// que es quien realmente lo hace cumplir).
const MAX_AMIGOS = 50;

// Controla quÃ© vista de la pantalla "Amigos" estÃ¡ activa (lista propia o
// buscador). Se resetea a 'mios' cada vez que se entra a la secciÃ³n.
let friendsTabActual = 'mios';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   DUELOS 1v1
// Conectado a routes/duelos.js: GET/POST /api/duelos, POST .../aceptar,
// .../rechazar, .../resultado, .../revancha.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Juegos habilitados para duelo (debe reflejar JUEGOS_DUELO de routes/duelos.js).
// El Ã­cono de cada uno se resuelve con gameIconSVG(key), el mismo set de
// Ã­conos de lÃ­nea que ya se usa en Inicio/Juegos â€” nada de emojis acÃ¡.
const JUEGOS_DUELO_INFO = {
  ahorcado:    { nombre: 'Ahorcado' },
  sopa:        { nombre: 'Sopa de Letras' },
  wordle:      { nombre: 'Adivina la Palabra' },
  runner:      { nombre: 'Pixel Runner' },
  preguntados: { nombre: 'Preguntados' },
  termina:     { nombre: 'Termina la Palabra' },
  adivina:     { nombre: 'Adivina la Cosa' },
};

// Juegos que, al retar, ademÃ¡s piden elegir temÃ¡tica (debe reflejar
// JUEGOS_CON_TEMATICA de routes/duelos.js). Runner no tiene temÃ¡ticas,
// asÃ­ que va directo.
const DUELO_REQUIERE_TEMATICA = {
  sopa: true, wordle: true, ahorcado: true,
  preguntados: true, termina: true, adivina: true,
};

// De los que piden temÃ¡tica, cuÃ¡les ademÃ¡s aceptan "Normal" (sin
// temÃ¡tica) como opciÃ³n, igual que en modo libre (debe reflejar
// JUEGOS_TEMATICA_NORMAL de routes/duelos.js). Por ahora solo Ahorcado.
const DUELO_TEMATICA_NORMAL = { ahorcado: true };

// De los que piden temÃ¡tica, cuÃ¡les ademÃ¡s piden elegir la duraciÃ³n
// (debe reflejar JUEGOS_CON_DURACION de routes/duelos.js).
const DUELO_REQUIERE_DURACION = { sopa: true };

// Duraciones ofrecidas para Sopa de Letras al retar (en segundos), deben
// coincidir con DURACIONES_VALIDAS_SOPA de routes/duelos.js.
const DUELO_SOPA_DURACIONES = [
  { valor: 120, label: '2 min' },
  { valor: 180, label: '3 min' },
  { valor: 240, label: '4 min' },
  { valor: 300, label: '5 min' },
];

// Duelo que se estÃ¡ jugando ahora mismo (null si no hay ninguno en curso).
// { id, juego: 'ahorcado' | 'runner' }. Se declara con "var" (no "let") a
// propÃ³sito: asÃ­ queda colgado de window y el mÃ³dulo ES6 de Pixel Runner
// (runner_loop.js) puede leer window.dueloActivo para saber si hay que
// reportar el puntaje al terminar la partida.
var dueloActivo = null;

// Ãšltimos duelos traÃ­dos del backend (se llena con fetchDuelos()).
let duelosList = [];

// Id del amigo elegido para retar, mientras se elige el minijuego en el
// selector (ver abrirSelectorJuegoDuelo).
let dueloAmigoIdSeleccionado = null;

async function fetchDuelos() {
  const box = document.getElementById('friendsDuelosBox');
  if (box) box.innerHTML = `<div class="friends-empty"><p>Cargando duelos...</p></div>`;
  try {
    duelosList = await apiFetch('/api/duelos');
  } catch (error) {
    console.error('Error al obtener duelos:', error);
    duelosList = [];
  }
  renderDuelos();
}

function renderDuelos() {
  const box = document.getElementById('friendsDuelosBox');
  if (!box) return;

  if (duelosList.length === 0) {
    box.innerHTML = `
      <div class="friends-empty">
        <p>TodavÃ­a no tenÃ©s duelos. Â¡RetÃ¡ a un amigo desde la pestaÃ±a "Tus amigos"!</p>
      </div>`;
    return;
  }

  box.innerHTML = duelosList.map(d => {
    const juegoInfo = JUEGOS_DUELO_INFO[d.juego] || { nombre: d.juegoNombre };
    const tematicaTxt = d.tematicaId
      ? ` Â· ${TEMATICA_NAMES[d.tematicaId] || ''}`
      : (d.juego === 'ahorcado' ? ' Â· Normal' : '');
    let cuerpo = '';

    if (d.estado === 'pendiente') {
      cuerpo = d.soyRetador
        ? `<span class="friend-status">${uiIconSVG('clock')} Esperando respuesta</span>
           <button class="friend-btn friend-btn-remove" onclick="rechazarDuelo(${d.id})">Cancelar</button>`
        : `<button class="friend-btn friend-btn-duel" onclick="aceptarDuelo(${d.id})">${uiIconSVG('check')} Aceptar</button>
           <button class="friend-btn friend-btn-remove" onclick="rechazarDuelo(${d.id})">Rechazar</button>`;
    } else if (d.estado === 'en_curso') {
      cuerpo = d.yaJugue
        ? `<span class="friend-status">${uiIconSVG('clock')} Ya jugaste, esperando al rival</span>`
        : `<button class="friend-btn friend-btn-duel" onclick="jugarDuelo(${d.id}, '${d.juego}')">â–¶ Jugar</button>`;
    } else if (d.estado === 'finalizado') {
      const etiqueta = d.resultado === 'gano' ? 'ðŸ† Ganaste' : d.resultado === 'perdio' ? 'ðŸ’€ Perdiste' : 'ðŸ¤ Empate';
      cuerpo = `
        <span class="friend-status">${etiqueta} (${d.misPuntos ?? 0} vs ${d.puntosOponente ?? 0})</span>
        <button class="friend-btn friend-btn-duel" onclick="revanchaDuelo(${d.id})">Revancha</button>`;
    }

    return `
      <div class="friend-row" id="dueloRow-${d.id}">
        <div class="friend-info">
          <span class="friend-avatar">${avatarValueHTML(d.oponente.avatar, d.oponente.username)}</span>
          <div>
            <div class="friend-name">${sanitizeHTML(d.oponente.username)}</div>
            <span class="friend-status">${gameIconSVG(d.juego, 14)} ${juegoInfo.nombre}${tematicaTxt}</span>
          </div>
        </div>
        <div class="friend-actions">${cuerpo}</div>
      </div>`;
  }).join('');
}

async function aceptarDuelo(id) {
  try {
    await apiFetch(`/api/duelos/${id}/aceptar`, { method: 'POST' });
    mostrarToast('Â¡Duelo aceptado! AndÃ¡ a la pestaÃ±a Duelos cuando quieras jugarlo.');
    fetchDuelos();
    actualizarBadgeNotificaciones();
  } catch (error) {
    mostrarToast(error.message || 'No se pudo aceptar el duelo', 'error');
  }
}

async function rechazarDuelo(id) {
  try {
    await apiFetch(`/api/duelos/${id}/rechazar`, { method: 'POST' });
    fetchDuelos();
  } catch (error) {
    mostrarToast(error.message || 'No se pudo actualizar el duelo', 'error');
  }
}

async function revanchaDuelo(id) {
  try {
    await apiFetch(`/api/duelos/${id}/revancha`, { method: 'POST' });
    mostrarToast('Â¡Revancha enviada!');
    fetchDuelos();
  } catch (error) {
    mostrarToast(error.message || 'No se pudo enviar la revancha', 'error');
  }
}

// Juego elegido en el paso 1 del selector, mientras se decide si hace
// falta pedir temÃ¡tica/duraciÃ³n (paso 2) antes de mandar el reto.
let dueloJuegoSeleccionado = null;

// Abre el selector de "Â¿a quÃ© lo retÃ¡s?" para el amigo elegido, siempre
// arrancando en el paso 1 (elegir juego). Se llena dinÃ¡micamente por si en
// el futuro se agregan mÃ¡s juegos a JUEGOS_DUELO_INFO, sin tocar el HTML.
function abrirSelectorJuegoDuelo(amigoId) {
  dueloAmigoIdSeleccionado = amigoId;
  dueloJuegoSeleccionado = null;

  const box = document.getElementById('dueloJuegoOpciones');
  if (box) {
    box.innerHTML = Object.entries(JUEGOS_DUELO_INFO).map(([key, info]) => `
      <button class="duelo-juego-btn" onclick="elegirJuegoDuelo('${key}')">
        <span class="duelo-juego-icon">${gameIconSVG(key, 26)}</span>
        <span>${info.nombre}</span>
      </button>
    `).join('');
  }
  mostrarPasoJuegoDuelo();
  const overlay = document.getElementById('dueloSelectorOverlay');
  if (overlay) overlay.classList.add('show');
}

function cerrarSelectorJuegoDuelo() {
  const overlay = document.getElementById('dueloSelectorOverlay');
  if (overlay) overlay.classList.remove('show');
  dueloAmigoIdSeleccionado = null;
  dueloJuegoSeleccionado = null;
}

// Se llama al elegir un juego en el paso 1. Si ese juego necesita
// temÃ¡tica (y opcionalmente duraciÃ³n), pasa al paso 2; si no, manda el
// reto directo (comportamiento anterior, para Ahorcado y Runner).
function elegirJuegoDuelo(juego) {
  dueloJuegoSeleccionado = juego;
  if (DUELO_REQUIERE_TEMATICA[juego]) {
    mostrarPasoOpcionesDuelo(juego);
  } else {
    enviarRetoDuelo(juego, null, null);
  }
}

// Paso 1: elegir el juego.
function mostrarPasoJuegoDuelo() {
  const t1 = document.getElementById('dueloJuegoTitle');
  const p1 = document.getElementById('dueloJuegoOpciones');
  const t2 = document.getElementById('dueloOpcionesTitle');
  const p2 = document.getElementById('dueloOpcionesStep');
  if (t1) t1.style.display = '';
  if (p1) p1.style.display = '';
  if (t2) t2.style.display = 'none';
  if (p2) p2.style.display = 'none';
}

// Paso 2: elegir temÃ¡tica (y duraciÃ³n si corresponde) para el juego ya
// elegido. Reutiliza las mismas 4 temÃ¡ticas que se usan jugando solo
// (TEMATICA_NAMES, definido mÃ¡s abajo en este archivo).
function mostrarPasoOpcionesDuelo(juego) {
  const t1 = document.getElementById('dueloJuegoTitle');
  const p1 = document.getElementById('dueloJuegoOpciones');
  const t2 = document.getElementById('dueloOpcionesTitle');
  const p2 = document.getElementById('dueloOpcionesStep');
  if (t1) t1.style.display = 'none';
  if (p1) p1.style.display = 'none';
  if (t2) t2.style.display = '';
  if (p2) p2.style.display = '';

  const tematicaBox = document.getElementById('dueloTematicaOpciones');
  if (tematicaBox) {
    // Si el juego acepta "Normal" (sin temÃ¡tica, como Ahorcado en modo
    // libre), esa opciÃ³n va primero y queda seleccionada por defecto.
    const normalBtn = DUELO_TEMATICA_NORMAL[juego]
      ? `<button class="theme-btn selected" data-tematica="normal" onclick="selectTheme(this)">Normal</button>`
      : '';
    const temasBtn = Object.entries(TEMATICA_NAMES).map(([id, nombre], i) => `
      <button class="theme-btn${(i === 0 && !normalBtn) ? ' selected' : ''}" data-tematica="${id}" onclick="selectTheme(this)">${nombre}</button>
    `).join('');
    tematicaBox.innerHTML = normalBtn + temasBtn;
  }

  const requiereDuracion = !!DUELO_REQUIERE_DURACION[juego];
  const duracionWrap = document.getElementById('dueloDuracionWrap');
  if (duracionWrap) duracionWrap.style.display = requiereDuracion ? '' : 'none';
  if (requiereDuracion) {
    const duracionBox = document.getElementById('dueloDuracionOpciones');
    if (duracionBox) {
      duracionBox.innerHTML = DUELO_SOPA_DURACIONES.map((d, i) => `
        <button class="theme-btn${i === 0 ? ' selected' : ''}" data-duracion="${d.valor}" onclick="selectTheme(this)">${d.label}</button>
      `).join('');
    }
  }
}

function volverAPasoJuegoDuelo() {
  dueloJuegoSeleccionado = null;
  mostrarPasoJuegoDuelo();
}

// Lee lo elegido en el paso 2 (temÃ¡tica + duraciÃ³n si aplica) y manda el reto.
function confirmarDueloConOpciones() {
  const juego = dueloJuegoSeleccionado;
  if (!juego) return;

  const tematicaBtn = document.querySelector('#dueloTematicaOpciones .theme-btn.selected');
  const tematicaRaw = tematicaBtn ? tematicaBtn.dataset.tematica : '1';
  const tematicaId = tematicaRaw === 'normal' ? 'normal' : Number(tematicaRaw);

  let duracionSegundos = null;
  if (DUELO_REQUIERE_DURACION[juego]) {
    const duracionBtn = document.querySelector('#dueloDuracionOpciones .theme-btn.selected');
    duracionSegundos = duracionBtn ? Number(duracionBtn.dataset.duracion) : DUELO_SOPA_DURACIONES[0].valor;
  }

  enviarRetoDuelo(juego, tematicaId, duracionSegundos);
}

async function enviarRetoDuelo(juego, tematicaId, duracionSegundos) {
  const amigoId = dueloAmigoIdSeleccionado;
  cerrarSelectorJuegoDuelo();
  if (!amigoId) return;
  const amigo = amigosList.find(a => a.id === amigoId);
  const body = { amigo_id: amigoId, juego };
  if (tematicaId) body.tematica_id = tematicaId;
  if (duracionSegundos) body.duracion_segundos = duracionSegundos;
  try {
    await apiFetch('/api/duelos', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    mostrarToast(`Reto de duelo enviado a ${amigo ? amigo.username : 'tu amigo'}.`);
  } catch (error) {
    mostrarToast(error.message || 'No se pudo enviar el reto de duelo', 'error');
  }
}

// Punto de entrada al tocar "â–¶ Jugar" en un duelo en curso: manda al
// minijuego correspondiente en modo duelo, con la temÃ¡tica/duraciÃ³n que
// se haya elegido al mandar el reto (guardadas en el duelo en el backend).
function jugarDuelo(dueloId, juego) {
  const duelo = duelosList.find(d => d.id === dueloId);
  if (juego === 'ahorcado') {
    iniciarAhorcadoDuelo(dueloId, duelo && duelo.tematicaId);
  } else if (juego === 'runner') {
    iniciarRunnerDuelo(dueloId);
  } else if (juego === 'sopa') {
    iniciarSopaDuelo(dueloId, duelo && duelo.tematicaId, duelo && duelo.duracionSegundos);
  } else if (juego === 'wordle') {
    iniciarWordleDuelo(dueloId, duelo && duelo.tematicaId);
  } else if (juego === 'preguntados') {
    iniciarPreguntadosDuelo(dueloId, duelo && duelo.tematicaId);
  } else if (juego === 'termina') {
    iniciarTerminaDuelo(dueloId, duelo && duelo.tematicaId);
  } else if (juego === 'adivina') {
    iniciarAdivinaDuelo(dueloId, duelo && duelo.tematicaId);
  } else {
    mostrarToast('Ese juego todavÃ­a no tiene modo duelo.', 'error');
  }
}

// Manda el puntaje final de un duelo al backend y muestra el resultado
// (o un aviso de "esperando al rival" si todavÃ­a no jugÃ³ su parte).
async function finalizarDueloConPuntaje(dueloId, puntos) {
  dueloActivo = null;
  try {
    const resultado = await apiFetch(`/api/duelos/${dueloId}/resultado`, {
      method: 'POST',
      body: JSON.stringify({ puntos: Math.round(puntos) }),
    });
    mostrarResultadoDuelo(resultado);
  } catch (error) {
    mostrarToast(error.message || 'No se pudo guardar el resultado del duelo', 'error');
  }
}

// Arma un "lado" del VS (avatar + nombre + puntos), resaltado con un
// borde dorado y una corona si es el ganador.
function ladoVsDuelo(avatar, nombre, puntos, esGanador) {
  return `
    <div class="duelo-vs-lado${esGanador ? ' es-ganador' : ''}">
      ${esGanador ? `<span class="duelo-vs-corona">${uiIconSVG('crown', 18)}</span>` : ''}
      <span class="duelo-vs-avatar">${avatarValueHTML(avatar, nombre)}</span>
      <span class="duelo-vs-nombre">${sanitizeHTML(nombre || '')}</span>
      <span class="duelo-vs-puntos">${puntos}</span>
    </div>`;
}

// Cartel final del duelo: arriba quiÃ©n ganÃ³/perdiÃ³, y abajo un VS con el
// Ã­cono de perfil, nombre y puntaje de cada uno + "Revancha"/"Volver".
// Si el rival todavÃ­a no jugÃ³, muestra en cambio un aviso de espera (con
// el puntaje del rival como "?" hasta que juegue su parte).
function mostrarResultadoDuelo(d) {
  const overlay = document.getElementById('duelResultOverlay');
  const title = document.getElementById('duelResultTitle');
  const vsBox = document.getElementById('duelResultVs');
  const desc = document.getElementById('duelResultDesc');
  const btnRevancha = document.getElementById('duelResultRevanchaBtn');
  if (!overlay) return;

  const yo = d.yo || { username: 'Vos' };
  const oponente = d.oponente || {};

  if (d.estado !== 'finalizado') {
    if (title) title.textContent = 'Â¡Puntaje enviado!';
    if (vsBox) {
      vsBox.innerHTML =
        ladoVsDuelo(yo.avatar, yo.username, d.misPuntos ?? 0, false) +
        `<div class="duelo-vs-centro">VS</div>` +
        ladoVsDuelo(oponente.avatar, oponente.username, '?', false);
    }
    if (desc) desc.textContent = `Apenas ${sanitizeHTML(oponente.username || '')} juegue su parte vas a ver quiÃ©n ganÃ³.`;
    if (btnRevancha) btnRevancha.style.display = 'none';
  } else {
    const gano = d.resultado === 'gano';
    const empato = d.resultado === 'empate';
    if (title) title.textContent = empato ? 'Â¡Empate!' : (gano ? 'Â¡Ganaste el duelo!' : 'Perdiste el duelo');
    if (vsBox) {
      vsBox.innerHTML =
        ladoVsDuelo(yo.avatar, yo.username, d.misPuntos ?? 0, gano) +
        `<div class="duelo-vs-centro">VS</div>` +
        ladoVsDuelo(oponente.avatar, oponente.username, d.puntosOponente ?? 0, !gano && !empato);
    }
    if (desc) desc.textContent = 'Â¿QuerÃ©s revancha?';
    if (gano) actualizarProgresoParcial('general', { duelosGanados: 1 });
    if (btnRevancha) {
      btnRevancha.style.display = '';
      btnRevancha.onclick = () => cerrarResultadoDuelo(true, d.id);
    }
  }

  overlay.classList.add('show');
}

function cerrarResultadoDuelo(revancha, dueloId) {
  const overlay = document.getElementById('duelResultOverlay');
  if (overlay) overlay.classList.remove('show');
  if (revancha && dueloId) revanchaDuelo(dueloId);
  goTo('amigos');
  mostrarTabAmigos('duelos');
}

// Trae la lista de amigos desde el backend y refresca la vista.
async function fetchAmigos() {
  const box = document.getElementById('friendsListBox');
  if (box) box.innerHTML = `<div class="friends-empty"><p>Cargando amigos...</p></div>`;
  try {
    amigosList = await apiFetch('/api/amigos');
  } catch (error) {
    console.error('Error al obtener amigos:', error);
    amigosList = [];
  }
  renderAmigos();
}

// Se llama al entrar a la secciÃ³n "Amigos" (desde goTo()). Sin cuenta no
// tiene sentido mostrar la lista/buscador (no se pueden agregar amigos),
// asÃ­ que mostramos el cartel de "creÃ¡ una cuenta" en su lugar.
function initAmigosScreen() {
  const banner = document.getElementById('amigosGuestBanner');
  const content = document.getElementById('amigosLoggedContent');
  if (!currentUser) {
    if (banner) banner.classList.remove('hidden');
    if (content) content.classList.add('hidden');
    return;
  }
  if (banner) banner.classList.add('hidden');
  if (content) content.classList.remove('hidden');
  mostrarTabAmigos('mios');
  actualizarBadgeSolicitudes();
}

// Alterna entre las 3 vistas de la pantalla "Amigos": tus amigos,
// solicitudes recibidas/enviadas y buscador.
function mostrarTabAmigos(tab) {
  friendsTabActual = tab;

  const tabs = {
    mios:        document.getElementById('friendsTabMios'),
    solicitudes: document.getElementById('friendsTabSolicitudes'),
    duelos:      document.getElementById('friendsTabDuelos'),
    buscar:      document.getElementById('friendsTabBuscar'),
  };
  const views = {
    mios:        document.getElementById('friendsViewMios'),
    solicitudes: document.getElementById('friendsViewSolicitudes'),
    duelos:      document.getElementById('friendsViewDuelos'),
    buscar:      document.getElementById('friendsViewBuscar'),
  };
  if (!tabs.mios || !tabs.solicitudes || !tabs.duelos || !tabs.buscar) return;

  Object.keys(tabs).forEach(key => {
    tabs[key].classList.toggle('active', key === tab);
    views[key].classList.toggle('hidden', key !== tab);
  });

  if (tab === 'mios') {
    fetchAmigos();
  } else if (tab === 'solicitudes') {
    fetchSolicitudes();
  } else if (tab === 'duelos') {
    fetchDuelos();
  } else {
    // Al abrir el buscador arrancamos limpio, sin resultados de una
    // bÃºsqueda anterior.
    const input = document.getElementById('buscarAmigoInput');
    const resultsBox = document.getElementById('buscarAmigoResultados');
    if (input) input.value = '';
    if (resultsBox) { resultsBox.innerHTML = ''; resultsBox.classList.add('hidden'); }
  }
}

// Arma el HTML de un avatar a partir de su valor guardado: si es una ruta
// de imagen (termina en extensiÃ³n de archivo) se renderiza como <img>,
// si es un emoji (dato viejo / de respaldo) se muestra tal cual.
function avatarValueHTML(valor, altText) {
  if (valor && /\.(webp|png|jpe?g|gif|svg)$/i.test(valor)) {
    return `<img src="${valor}" alt="${sanitizeHTML(altText || '')}">`;
  }
  return valor || 'ðŸ™‚';
}

// Ids a los que ya se les mandÃ³ solicitud en esta sesiÃ³n (evita doble
// click mientras el backend confirma; el estado real lo devuelve
// GET /api/usuarios/:id/perfil vÃ­a el campo `amistad`).
let solicitudesAmistadEnviadas = new Set();

// Debounce simple para no pegarle al backend en cada tecla.
let buscarUsuariosTimeout = null;
function buscarUsuarios() {
  clearTimeout(buscarUsuariosTimeout);
  buscarUsuariosTimeout = setTimeout(ejecutarBusquedaUsuarios, 300);
}

// Busca usuarios por nombre en GET /api/usuarios/buscar y pinta los
// resultados con el botÃ³n correspondiente segÃºn el estado con cada uno
// (ya son amigos / solicitud enviada / agregar).
async function ejecutarBusquedaUsuarios() {
  const input = document.getElementById('buscarAmigoInput');
  const resultsBox = document.getElementById('buscarAmigoResultados');
  if (!input || !resultsBox) return;
  const q = input.value.trim();

  if (!q) {
    resultsBox.innerHTML = '';
    resultsBox.classList.add('hidden');
    return;
  }

  resultsBox.classList.remove('hidden');
  resultsBox.innerHTML = `<div class="friends-empty"><p>Buscando...</p></div>`;

  let resultados = [];
  try {
    resultados = await apiFetch('/api/usuarios/buscar?nombre=' + encodeURIComponent(q));
  } catch (error) {
    resultsBox.innerHTML = `<div class="friends-empty"><p>No se pudo buscar usuarios.</p></div>`;
    return;
  }

  if (resultados.length === 0) {
    resultsBox.innerHTML = `<div class="friends-empty"><p>No se encontraron usuarios con ese nombre.</p></div>`;
    return;
  }

  const limiteAlcanzado = amigosList.length >= MAX_AMIGOS;

  resultsBox.innerHTML = resultados.map(u => {
    const esAmigo = amigosList.some(a => a.id === u.id);
    const yaEnviada = solicitudesAmistadEnviadas.has(u.id);
    let accion;
    if (esAmigo) {
      accion = `<span class="friend-search-status">${uiIconSVG('users')} Ya son amigos</span>`;
    } else if (yaEnviada) {
      accion = `<span class="friend-search-status">${uiIconSVG('check')} Solicitud enviada</span>`;
    } else if (limiteAlcanzado) {
      accion = `<span class="friend-search-status">${uiIconSVG('warning')} LÃ­mite de amigos alcanzado</span>`;
    } else {
      accion = `<button class="friend-btn friend-btn-add" onclick="enviarSolicitudAmistad(${u.id}, '${sanitizeHTML(u.username)}')">${uiIconSVG('plus')} Agregar</button>`;
    }
    return `
      <div class="friend-row friend-search-row">
        <div class="friend-info">
          <span class="friend-avatar">${avatarValueHTML(u.avatar, u.username)}</span>
          <div class="friend-name">${sanitizeHTML(u.username)}</div>
        </div>
        <div class="friend-actions">
          ${accion}
          <button class="friend-btn friend-btn-profile" onclick="verPerfilUsuarioBuscado(${u.id})" title="Ver perfil">${uiIconSVG('user')} Perfil</button>
        </div>
      </div>`;
  }).join('');
}

// Ver el perfil de un usuario a partir de su nombre (usado desde la tabla
// de PuntuaciÃ³n, que solo trae el nombre del jugador, sin id).
async function verPerfilPorUsername(username) {
  if (!username) return;

  // Si es el propio nombre, abrir directo: el buscador excluye al usuario
  // logueado de sus resultados (GET /api/usuarios/buscar no se busca a sÃ­ mismo).
  if (currentUser && username.toLowerCase() === currentUser.username.toLowerCase()) {
    abrirPerfilPropio();
    return;
  }

  try {
    const resultados = await apiFetch('/api/usuarios/buscar?nombre=' + encodeURIComponent(username));
    const usuario = resultados.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!usuario) { mostrarToast('No se encontrÃ³ ese usuario.', 'error'); return; }
    abrirPerfilDeUsuario(usuario.id);
  } catch (error) {
    console.error('Error al buscar usuario:', error);
  }
}

// Ver el perfil de un usuario encontrado por el buscador (sea o no amigo).
function verPerfilUsuarioBuscado(id) {
  abrirPerfilDeUsuario(id);
}

function renderAmigos() {
  const box = document.getElementById('friendsListBox');
  const contador = document.getElementById('friendsTabMiosCount');
  if (contador) contador.textContent = `(${amigosList.length}/${MAX_AMIGOS})`;
  if (!box) return;

  if (amigosList.length === 0) {
    box.innerHTML = `
      <div class="friends-empty">
        <p>TodavÃ­a no agregaste amigos.</p>
      </div>`;
    return;
  }

  box.innerHTML = amigosList.map(a => `
    <div class="friend-row" id="friendRow-${a.id}">
      <div class="friend-info">
        <span class="friend-avatar">${avatarValueHTML(a.avatar, a.username)}</span>
        <div>
          <div class="friend-name">${sanitizeHTML(a.username)}</div>
        </div>
      </div>
      <div class="friend-actions">
        <button class="friend-btn friend-btn-remove" onclick="eliminarAmigo(${a.id})" title="Eliminar amigo">${uiIconSVG('trash')} Eliminar</button>
        <button class="friend-btn friend-btn-duel" onclick="abrirSelectorJuegoDuelo(${a.id})" title="Retar a duelo">${uiIconSVG('target')} Duelo</button>
        <button class="friend-btn friend-btn-profile" onclick="verPerfilAmigo(${a.id})" title="Ver perfil">${uiIconSVG('user')} Perfil</button>
      </div>
    </div>
  `).join('');
}

async function eliminarAmigo(id) {
  const amigo = amigosList.find(a => a.id === id);
  if (!amigo) return;
  if (!confirm(`Â¿Eliminar a ${amigo.username} de tu lista de amigos?`)) return;
  try {
    await apiFetch('/api/amigos/' + id, { method: 'DELETE' });
    amigosList = amigosList.filter(a => a.id !== id);
    renderAmigos();
  } catch (error) {
    alert(error.message || 'No se pudo eliminar al amigo.');
  }
}

// Abre el perfil de un amigo (solo lectura + botÃ³n de solicitud de amistad).
function verPerfilAmigo(id) {
  abrirPerfilDeUsuario(id);
}

// Cartel flotante genÃ©rico (mismo estilo visual que el toast de logros)
// para avisos cortos como "Solicitud enviada" en vez de usar alert().
function mostrarToast(mensaje, tipo = 'info') {
  const toast = document.createElement('div');
  toast.className = 'app-toast' + (tipo === 'error' ? ' error' : '');
  toast.textContent = mensaje;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

// EnvÃ­a la solicitud de amistad al backend y refresca la vista que
// corresponda (perfil abierto y/o resultados del buscador), mostrando
// un cartel en vez de un alert().
async function enviarSolicitudAmistad(id, nombre) {
  if (amigosList.length >= MAX_AMIGOS) {
    mostrarToast(`Llegaste al lÃ­mite de ${MAX_AMIGOS} amigos.`, 'error');
    return;
  }
  try {
    await apiFetch('/api/amigos/solicitudes', {
      method: 'POST',
      body: JSON.stringify({ receptor_id: id })
    });
    solicitudesAmistadEnviadas.add(id);
    mostrarToast('Solicitud de amistad enviada');
    if (document.getElementById('sec-perfil')?.classList.contains('active')) renderPerfil();
    if (friendsTabActual === 'buscar') ejecutarBusquedaUsuarios();
  } catch (error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('ya existe una solicitud')) {
      solicitudesAmistadEnviadas.add(id);
      mostrarToast('La solicitud ya fue enviada');
      if (document.getElementById('sec-perfil')?.classList.contains('active')) renderPerfil();
    } else {
      mostrarToast(error.message || `No se pudo enviar la solicitud a ${nombre}.`, 'error');
    }
  }
}

// â”€â”€â”€ Solicitudes de amistad (recibidas y enviadas) â”€â”€â”€

// Trae las solicitudes pendientes desde el backend y refresca la vista +
// el contador de la pestaÃ±a.
async function fetchSolicitudes() {
  const box = document.getElementById('friendsSolicitudesBox');
  if (box) box.innerHTML = `<div class="friends-empty"><p>Cargando solicitudes...</p></div>`;
  try {
    const data = await apiFetch('/api/amigos/solicitudes');
    renderSolicitudes(data.recibidas || [], data.enviadas || []);
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    if (box) box.innerHTML = `<div class="friends-empty"><p>No se pudieron cargar las solicitudes.</p></div>`;
  }
}

// Actualiza solo el nÃºmero del badge de la pestaÃ±a "Solicitudes" (se
// llama al entrar a la secciÃ³n Amigos, sin importar quÃ© pestaÃ±a quede
// activa), para que se note que llegÃ³ algo sin tener que entrar a mirar.
async function actualizarBadgeSolicitudes() {
  const badge = document.getElementById('friendsTabSolicitudesCount');
  if (!badge || !localStorage.getItem('unigames_token')) return;
  try {
    const data = await apiFetch('/api/amigos/solicitudes');
    const recibidas = data.recibidas || [];
    badge.innerHTML = recibidas.length > 0 ? `<span class="lb-tab-badge">${recibidas.length}</span>` : '';
  } catch (error) {
    // silencioso: es solo un indicador, no bloquea nada
  }
}

function renderSolicitudes(recibidas, enviadas) {
  const box = document.getElementById('friendsSolicitudesBox');
  const badge = document.getElementById('friendsTabSolicitudesCount');
  if (badge) {
    badge.innerHTML = recibidas.length > 0 ? `<span class="lb-tab-badge">${recibidas.length}</span>` : '';
  }
  if (!box) return;

  if (recibidas.length === 0 && enviadas.length === 0) {
    box.innerHTML = `<div class="friends-empty"><p>No tenÃ©s solicitudes de amistad pendientes.</p></div>`;
    return;
  }

  const recibidasHTML = recibidas.length === 0 ? '' : `
    <div class="section-title" style="font-size:12px;">Solicitudes recibidas</div>
    ${recibidas.map(s => `
      <div class="friend-row" id="solicitudRow-${s.id}">
        <div class="friend-info">
          <span class="friend-avatar">${avatarValueHTML(s.avatar, s.username)}</span>
          <div class="friend-name">${sanitizeHTML(s.username)}</div>
        </div>
        <div class="friend-actions">
          <button class="friend-btn friend-btn-add" onclick="aceptarSolicitud(${s.id})">${uiIconSVG('check')} Aceptar</button>
          <button class="friend-btn friend-btn-remove" onclick="rechazarSolicitud(${s.id})">${uiIconSVG('trash')} Rechazar</button>
          <button class="friend-btn friend-btn-profile" onclick="verPerfilUsuarioBuscado(${s.usuario_id})" title="Ver perfil">${uiIconSVG('user')} Perfil</button>
        </div>
      </div>
    `).join('')}
  `;

  const enviadasHTML = enviadas.length === 0 ? '' : `
    <div class="section-title" style="font-size:12px;margin-top:1.5rem;">Solicitudes enviadas</div>
    ${enviadas.map(s => `
      <div class="friend-row" id="solicitudRow-${s.id}">
        <div class="friend-info">
          <span class="friend-avatar">${avatarValueHTML(s.avatar, s.username)}</span>
          <div class="friend-name">${sanitizeHTML(s.username)}</div>
        </div>
        <div class="friend-actions">
          <span class="friend-search-status">${uiIconSVG('check')} Esperando respuesta</span>
          <button class="friend-btn friend-btn-remove" onclick="rechazarSolicitud(${s.id})" title="Cancelar solicitud">${uiIconSVG('trash')} Cancelar</button>
        </div>
      </div>
    `).join('')}
  `;

  box.innerHTML = recibidasHTML + enviadasHTML;
}

async function aceptarSolicitud(id) {
  try {
    await apiFetch(`/api/amigos/solicitudes/${id}/aceptar`, { method: 'POST' });
    mostrarToast('Ahora son amigos');
    fetchSolicitudes();
  } catch (error) {
    mostrarToast(error.message || 'No se pudo aceptar la solicitud.', 'error');
  }
}

async function rechazarSolicitud(id) {
  try {
    await apiFetch(`/api/amigos/solicitudes/${id}/rechazar`, { method: 'POST' });
    fetchSolicitudes();
  } catch (error) {
    mostrarToast(error.message || 'No se pudo rechazar la solicitud.', 'error');
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   LOGROS
//   Sistema de logros: definiciÃ³n de los 50 logros, guardado local
//   (localStorage, provisorio hasta que exista el backend) y la
//   lÃ³gica que revisa y desbloquea automÃ¡ticamente cada logro a
//   medida que se juega.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Juegos disponibles para filtrar la lista de logros.
const LOGROS_JUEGOS = [
  { id: 'sopa',          nombre: 'Sopa de Letras' },
  { id: 'preguntados',   nombre: 'Preguntados' },
  { id: 'termina',       nombre: 'Termina la Palabra' },
  { id: 'ahorcado',      nombre: 'Ahorcado' },
  { id: 'wordle',        nombre: 'Adivina la Palabra' },
  { id: 'adivina',       nombre: 'Adivina la Cosa' },
  { id: 'runner',        nombre: 'Pixel Runner' },
  { id: 'castle_escape', nombre: 'Castle Escape' },
  { id: 'rpg_pixel',     nombre: 'RPG Pixel' },
  { id: 'general',       nombre: 'Generales' },
];

// Los 50 logros. `check(stats)` recibe las estadÃ­sticas acumuladas del
// jugador (ver getLogrosStats) y devuelve true/false segÃºn si ya se
// cumpliÃ³ la condiciÃ³n del logro.
const ACHIEVEMENTS = [
  // â”€â”€ Generales (5) â”€â”€
  { id: 'general_primer_juego',  juego: 'general', icon: 'ðŸŽ®', nombre: 'Primeros pasos',   desc: 'JugÃ¡ tu primer minijuego.',                    check: s => (s.partidasJugadas || 0) >= 1 },
  { id: 'general_los_9',         juego: 'general', icon: 'ðŸ•¹ï¸', nombre: 'Explorador',        desc: 'JugÃ¡ los 9 minijuegos al menos una vez.',      check: s => (s.juegosJugados || []).length >= 9 },
  { id: 'general_primer_amigo',  juego: 'general', icon: 'ðŸ¤', nombre: 'Nuevo amigo',       desc: 'AgregÃ¡ tu primer amigo.',                      check: s => (s.amigosAgregados || 0) >= 1 },
  { id: 'general_primer_duelo',  juego: 'general', icon: 'âš”ï¸', nombre: 'Primer duelo',      desc: 'GanÃ¡ tu primer duelo contra un amigo.',        check: s => (s.duelosGanados || 0) >= 1 },
  { id: 'general_racha_semanal', juego: 'general', icon: 'ðŸ”¥', nombre: 'Jugador constante', desc: 'IniciÃ¡ sesiÃ³n 7 dÃ­as seguidos.',               check: s => (s.diasSeguidos || 0) >= 7 },

  // â”€â”€ Sopa de Letras (5) â”€â”€
  { id: 'sopa_primera',   juego: 'sopa', icon: 'ðŸ”', nombre: 'Primera sopa',       desc: 'CompletÃ¡ tu primera Sopa de Letras.',                                  check: s => (s.sopa_completadas || 0) >= 1 },
  { id: 'sopa_veloz',     juego: 'sopa', icon: 'â±ï¸', nombre: 'Rayo veloz',         desc: 'EncontrÃ¡ todas las palabras con mÃ¡s de la mitad del tiempo restante.', check: s => (s.sopa_veloz || 0) >= 1 },
  { id: 'sopa_5',         juego: 'sopa', icon: 'ðŸ§©', nombre: 'Buscador',           desc: 'CompletÃ¡ 5 Sopas de Letras.',                                          check: s => (s.sopa_completadas || 0) >= 5 },
  { id: 'sopa_20',        juego: 'sopa', icon: 'ðŸ†', nombre: 'Maestro de la sopa', desc: 'CompletÃ¡ 20 Sopas de Letras.',                                         check: s => (s.sopa_completadas || 0) >= 20 },
  { id: 'sopa_tematicas', juego: 'sopa', icon: 'ðŸŽ­', nombre: 'Todo terreno',       desc: 'CompletÃ¡ una Sopa en cada temÃ¡tica.',                                  check: s => (s.sopa_tematicas || []).length >= 4 },
  { id: 'sopa_racha3',    juego: 'sopa', icon: 'ðŸ”¥', nombre: 'Racha ganadora',     desc: 'CompletÃ¡ 3 Sopas seguidas antes de que se acabe el tiempo.',          check: s => (s.sopa_racha_max || 0) >= 3 },
  { id: 'sopa_sinerrores',juego: 'sopa', icon: 'âœ¨', nombre: 'Mano firme',         desc: 'CompletÃ¡ una Sopa sin marcar ninguna selecciÃ³n incorrecta.',          check: s => (s.sopa_sinerrores || 0) >= 1 },
  { id: 'sopa_1000',      juego: 'sopa', icon: 'ðŸ’Ž', nombre: 'Puntaje alto',       desc: 'ConseguÃ­ 1000 puntos o mÃ¡s en una sola partida.',                      check: s => (s.sopa_maxScore_best || 0) >= 1000 },
  { id: 'sopa_50',        juego: 'sopa', icon: 'ðŸŒŸ', nombre: 'Leyenda de la sopa', desc: 'CompletÃ¡ 50 Sopas de Letras.',                                         check: s => (s.sopa_completadas || 0) >= 50 },
  { id: 'sopa_relampago', juego: 'sopa', icon: 'âš¡', nombre: 'RelÃ¡mpago',          desc: 'EncontrÃ¡ todas las palabras con 90 segundos o mÃ¡s de sobra.',         check: s => (s.sopa_relampago || 0) >= 1 },

  // â”€â”€ Preguntados (5) â”€â”€
  { id: 'preg_primera',   juego: 'preguntados', icon: 'â“', nombre: 'Primera trivia', desc: 'CompletÃ¡ tu primera ronda de Preguntados.',            check: s => (s.preg_completadas || 0) >= 1 },
  { id: 'preg_perfecta',  juego: 'preguntados', icon: 'ðŸ’¯', nombre: 'Ronda perfecta', desc: 'ContestÃ¡ todas las preguntas correctas en una ronda.', check: s => (s.preg_perfectas || 0) >= 1 },
  { id: 'preg_50',        juego: 'preguntados', icon: 'ðŸ§ ', nombre: 'Cerebrito',      desc: 'AcumulÃ¡ 50 respuestas correctas en total.',            check: s => (s.preg_correctas || 0) >= 50 },
  { id: 'preg_racha',     juego: 'preguntados', icon: 'ðŸ”¥', nombre: 'Racha ganadora', desc: 'EncadenÃ¡ 10 respuestas correctas seguidas.',           check: s => (s.preg_racha_max || 0) >= 10 },
  { id: 'preg_tematicas', juego: 'preguntados', icon: 'ðŸŽ­', nombre: 'Todo terreno',   desc: 'JugÃ¡ Preguntados en las 4 temÃ¡ticas.',                 check: s => (s.preg_tematicas || []).length >= 4 },
  { id: 'preg_100',       juego: 'preguntados', icon: 'ðŸ§ ', nombre: 'Enciclopedia',   desc: 'AcumulÃ¡ 100 respuestas correctas en total.',           check: s => (s.preg_correctas || 0) >= 100 },
  { id: 'preg_racha15',   juego: 'preguntados', icon: 'ðŸ”¥', nombre: 'Imparable',      desc: 'EncadenÃ¡ 15 respuestas correctas seguidas.',           check: s => (s.preg_racha_max || 0) >= 15 },
  { id: 'preg_10rondas',  juego: 'preguntados', icon: 'ðŸ“Š', nombre: 'Veterano',       desc: 'CompletÃ¡ 10 rondas de Preguntados.',                   check: s => (s.preg_completadas || 0) >= 10 },
  { id: 'preg_perfectas5',juego: 'preguntados', icon: 'ðŸ…', nombre: 'Sin fallar',     desc: 'ConseguÃ­ 5 rondas perfectas.',                         check: s => (s.preg_perfectas || 0) >= 5 },
  { id: 'preg_veloz',     juego: 'preguntados', icon: 'âš¡', nombre: 'Reflejos rÃ¡pidos',desc: 'ContestÃ¡ correctamente apenas empieza el tiempo.',    check: s => (s.preg_veloz || 0) >= 1 },

  // â”€â”€ Termina la Palabra (5) â”€â”€
  { id: 'termina_primera',   juego: 'termina', icon: 'ðŸ”¤', nombre: 'Primera palabra',  desc: 'CompletÃ¡ tu primera palabra.',                            check: s => (s.termina_completadas || 0) >= 1 },
  { id: 'termina_1intento',  juego: 'termina', icon: 'ðŸŽ¯', nombre: 'PunterÃ­a',         desc: 'AdivinÃ¡ una palabra en el primer intento.',               check: s => (s.termina_1intento || 0) >= 1 },
  { id: 'termina_10',        juego: 'termina', icon: 'ðŸ“š', nombre: 'Buen vocabulario', desc: 'CompletÃ¡ 10 palabras.',                                    check: s => (s.termina_completadas || 0) >= 10 },
  { id: 'termina_racha',     juego: 'termina', icon: 'ðŸ”¥', nombre: 'Racha ganadora',   desc: 'CompletÃ¡ 5 palabras seguidas sin agotar los intentos.',   check: s => (s.termina_racha_max || 0) >= 5 },
  { id: 'termina_tematicas', juego: 'termina', icon: 'ðŸŽ­', nombre: 'Todo terreno',     desc: 'JugÃ¡ en las 4 temÃ¡ticas.',                                 check: s => (s.termina_tematicas || []).length >= 4 },
  { id: 'termina_25',        juego: 'termina', icon: 'ðŸŒŸ', nombre: 'Erudito',          desc: 'CompletÃ¡ 25 palabras.',                                    check: s => (s.termina_completadas || 0) >= 25 },
  { id: 'termina_racha10',   juego: 'termina', icon: 'ðŸ”¥', nombre: 'Imparable',        desc: 'CompletÃ¡ 10 palabras seguidas sin agotar los intentos.',   check: s => (s.termina_racha_max || 0) >= 10 },
  { id: 'termina_eficiente', juego: 'termina', icon: 'ðŸŽ¯', nombre: 'Eficiente',        desc: 'AdivinÃ¡ 5 palabras usando como mÃ¡ximo 2 intentos.',        check: s => (s.termina_eficientes || 0) >= 5 },
  { id: 'termina_larga',     juego: 'termina', icon: 'ðŸ“', nombre: 'Palabra larga',    desc: 'AdivinÃ¡ una palabra de 10 letras o mÃ¡s.',                  check: s => (s.termina_palabraLarga || 0) >= 1 },
  { id: 'termina_ultimomomento', juego: 'termina', icon: 'ðŸ˜…', nombre: 'Al filo',      desc: 'AdivinÃ¡ una palabra en tu Ãºltimo intento disponible.',     check: s => (s.termina_ultimoMomento || 0) >= 1 },

  // â”€â”€ Ahorcado (5) â”€â”€
  { id: 'ahorcado_primera',   juego: 'ahorcado', icon: 'ðŸ’€', nombre: 'Primera horca',   desc: 'GanÃ¡ tu primera partida de Ahorcado.',        check: s => (s.ahorcado_ganadas || 0) >= 1 },
  { id: 'ahorcado_perfecto',  juego: 'ahorcado', icon: 'âœ¨', nombre: 'Sin errores',      desc: 'GanÃ¡ una partida sin cometer ningÃºn error.',  check: s => (s.ahorcado_perfectas || 0) >= 1 },
  { id: 'ahorcado_10',        juego: 'ahorcado', icon: 'ðŸ†', nombre: 'Verdugo experto',  desc: 'GanÃ¡ 10 partidas.',                            check: s => (s.ahorcado_ganadas || 0) >= 10 },
  { id: 'ahorcado_tematicas', juego: 'ahorcado', icon: 'ðŸŽ­', nombre: 'Todo terreno',     desc: 'GanÃ¡ en las 4 temÃ¡ticas (o Normal).',          check: s => (s.ahorcado_tematicas || []).length >= 4 },
  { id: 'ahorcado_racha',     juego: 'ahorcado', icon: 'ðŸ”¥', nombre: 'Racha ganadora',   desc: 'GanÃ¡ 5 partidas seguidas.',                    check: s => (s.ahorcado_racha_max || 0) >= 5 },
  { id: 'ahorcado_25',        juego: 'ahorcado', icon: 'ðŸŒŸ', nombre: 'Verdugo legendario',desc: 'GanÃ¡ 25 partidas.',                           check: s => (s.ahorcado_ganadas || 0) >= 25 },
  { id: 'ahorcado_racha10',   juego: 'ahorcado', icon: 'ðŸ”¥', nombre: 'Imparable',       desc: 'GanÃ¡ 10 partidas seguidas.',                   check: s => (s.ahorcado_racha_max || 0) >= 10 },
  { id: 'ahorcado_perfectas5',juego: 'ahorcado', icon: 'ðŸ’¯', nombre: 'PrecisiÃ³n total', desc: 'GanÃ¡ 5 partidas sin cometer ningÃºn error.',    check: s => (s.ahorcado_perfectas || 0) >= 5 },
  { id: 'ahorcado_casiperfecto', juego: 'ahorcado', icon: 'ðŸŽ¯', nombre: 'Casi perfecto', desc: 'GanÃ¡ una partida cometiendo como mÃ¡ximo 1 error.', check: s => (s.ahorcado_casiPerfectas || 0) >= 1 },
  { id: 'ahorcado_maratonista', juego: 'ahorcado', icon: 'ðŸƒ', nombre: 'Maratonista',   desc: 'JugÃ¡ 15 partidas de Ahorcado.',                check: s => (s.ahorcado_partidas || 0) >= 15 },

  // â”€â”€ Adivina la Palabra / Wordle (5) â”€â”€
  { id: 'wordle_primera',  juego: 'wordle', icon: 'ðŸŸ©', nombre: 'Primera palabra',    desc: 'AdivinÃ¡ tu primera palabra.',           check: s => (s.wordle_ganadas || 0) >= 1 },
  { id: 'wordle_1intento', juego: 'wordle', icon: 'ðŸŽ¯', nombre: 'De un solo tiro',    desc: 'AdivinÃ¡ una palabra en el primer intento.', check: s => (s.wordle_1intento || 0) >= 1 },
  { id: 'wordle_10',       juego: 'wordle', icon: 'ðŸ“š', nombre: 'Letrado',            desc: 'AdivinÃ¡ 10 palabras.',                   check: s => (s.wordle_ganadas || 0) >= 10 },
  { id: 'wordle_racha',    juego: 'wordle', icon: 'ðŸ”¥', nombre: 'Racha ganadora',     desc: 'GanÃ¡ 5 partidas seguidas.',              check: s => (s.wordle_racha_max || 0) >= 5 },
  { id: 'wordle_25',       juego: 'wordle', icon: 'ðŸ†', nombre: 'Maestro del wordle', desc: 'AdivinÃ¡ 25 palabras en total.',          check: s => (s.wordle_ganadas || 0) >= 25 },
  { id: 'wordle_50',       juego: 'wordle', icon: 'ðŸŒŸ', nombre: 'Leyenda del wordle', desc: 'AdivinÃ¡ 50 palabras en total.',          check: s => (s.wordle_ganadas || 0) >= 50 },
  { id: 'wordle_racha10',  juego: 'wordle', icon: 'ðŸ”¥', nombre: 'Imparable',         desc: 'GanÃ¡ 10 partidas seguidas.',             check: s => (s.wordle_racha_max || 0) >= 10 },
  { id: 'wordle_eficiente',juego: 'wordle', icon: 'ðŸŽ¯', nombre: 'Eficiente',         desc: 'AdivinÃ¡ 5 palabras en 2 intentos o menos.', check: s => (s.wordle_eficientes || 0) >= 5 },
  { id: 'wordle_larga',    juego: 'wordle', icon: 'ðŸ“', nombre: 'Palabra larga',     desc: 'AdivinÃ¡ una palabra de 8 letras o mÃ¡s.',  check: s => (s.wordle_palabraLarga || 0) >= 1 },
  { id: 'wordle_tematicas',juego: 'wordle', icon: 'ðŸŽ­', nombre: 'Todo terreno',      desc: 'JugÃ¡ Adivina la Palabra en las 4 temÃ¡ticas.', check: s => (s.wordle_tematicas || []).length >= 4 },

  // â”€â”€ Adivina la Cosa (5) â”€â”€
  { id: 'adivina_primera',   juego: 'adivina', icon: 'ðŸ•µï¸', nombre: 'Primer acierto', desc: 'AcertÃ¡ tu primera respuesta.',        check: s => (s.adivina_aciertos || 0) >= 1 },
  { id: 'adivina_sinpistas', juego: 'adivina', icon: 'ðŸ§', nombre: 'Ojo clÃ­nico',     desc: 'AcertÃ¡ sin usar ninguna pista.',      check: s => (s.adivina_sinpistas || 0) >= 1 },
  { id: 'adivina_10',        juego: 'adivina', icon: 'ðŸ”Ž', nombre: 'Detective',       desc: 'AcertÃ¡ 10 veces.',                    check: s => (s.adivina_aciertos || 0) >= 10 },
  { id: 'adivina_1pista',    juego: 'adivina', icon: 'ðŸŽ¯', nombre: 'Pista certera',   desc: 'AcertÃ¡ usando una sola pista.',       check: s => (s.adivina_1pista || 0) >= 1 },
  { id: 'adivina_25',        juego: 'adivina', icon: 'ðŸ†', nombre: 'Sabelotodo',      desc: 'AcertÃ¡ 25 veces en total.',           check: s => (s.adivina_aciertos || 0) >= 25 },
  { id: 'adivina_50',        juego: 'adivina', icon: 'ðŸŒŸ', nombre: 'Leyenda',         desc: 'AcertÃ¡ 50 veces en total.',           check: s => (s.adivina_aciertos || 0) >= 50 },
  { id: 'adivina_racha5',    juego: 'adivina', icon: 'ðŸ”¥', nombre: 'Racha ganadora',  desc: 'AcertÃ¡ 5 veces seguidas sin rendirte.', check: s => (s.adivina_racha_max || 0) >= 5 },
  { id: 'adivina_rondaperfecta', juego: 'adivina', icon: 'âœ¨', nombre: 'Ronda perfecta', desc: 'CompletÃ¡ una ronda entera sin usar ninguna pista.', check: s => (s.adivina_rondasPerfectas || 0) >= 1 },
  { id: 'adivina_tematicas', juego: 'adivina', icon: 'ðŸŽ­', nombre: 'Todo terreno',    desc: 'JugÃ¡ Adivina la Cosa en las 4 temÃ¡ticas.', check: s => (s.adivina_tematicas || []).length >= 4 },
  { id: 'adivina_10rondas',  juego: 'adivina', icon: 'ðŸ“Š', nombre: 'Veterano',        desc: 'CompletÃ¡ 10 rondas de Adivina la Cosa.', check: s => (s.adivina_rondasCompletadas || 0) >= 10 },

  // â”€â”€ Pixel Runner (5) â”€â”€
  { id: 'runner_500',      juego: 'runner', icon: 'ðŸƒ', nombre: 'Primeros pasos',    desc: 'AlcanzÃ¡ los 500 puntos en una carrera.',       check: s => (s.runner_maxScore_best || 0) >= 500 },
  { id: 'runner_historia', juego: 'runner', icon: 'ðŸ“–', nombre: 'Fin de la historia', desc: 'CompletÃ¡ el modo Historia (2500 puntos).',     check: s => !!s.runner_historiaCompleta },
  { id: 'runner_infinito', juego: 'runner', icon: 'â™¾ï¸', nombre: 'Sin lÃ­mites',        desc: 'DesbloqueÃ¡ el modo Infinito.',                 check: s => !!s.runner_infinitoDesbloqueado },
  { id: 'runner_10000',    juego: 'runner', icon: 'ðŸš€', nombre: 'Imparable',          desc: 'AlcanzÃ¡ los 10.000 puntos en modo Infinito.',  check: s => (s.runner_maxScoreInfinito_best || 0) >= 10000 },
  { id: 'runner_monedas',  juego: 'runner', icon: 'ðŸª™', nombre: 'Coleccionista',      desc: 'JuntÃ¡ 100 monedas en total.',                  check: s => (s.runner_monedasTotal || 0) >= 100 },

  // â”€â”€ Castle Escape (5) â”€â”€
  { id: 'castle_nivel1',     juego: 'castle_escape', icon: 'ðŸ°', nombre: 'Primer paso',        desc: 'CompletÃ¡ el nivel 1.',           check: s => (s.castle_nivelesCompletados || []).includes(1) },
  { id: 'castle_3estrellas', juego: 'castle_escape', icon: 'â­', nombre: 'PerfecciÃ³n',         desc: 'ConseguÃ­ 3 estrellas en un nivel.', check: s => (s.castle_3estrellas || 0) >= 1 },
  { id: 'castle_10niveles',  juego: 'castle_escape', icon: 'ðŸ—ï¸', nombre: 'A mitad de camino', desc: 'CompletÃ¡ 10 niveles.',            check: s => (s.castle_nivelesCompletados || []).length >= 10 },
  { id: 'castle_20niveles',  juego: 'castle_escape', icon: 'ðŸ†', nombre: 'Fuera del castillo', desc: 'CompletÃ¡ los 20 niveles.',        check: s => (s.castle_nivelesCompletados || []).length >= 20 },
  { id: 'castle_sinmuertes', juego: 'castle_escape', icon: 'âœ¨', nombre: 'Intacto',            desc: 'CompletÃ¡ un nivel sin morir.',    check: s => (s.castle_sinMuertes || 0) >= 1 },

  // â”€â”€ RPG Pixel (5) â”€â”€
  { id: 'rpg_primerjefe', juego: 'rpg_pixel', icon: 'ðŸ—¡ï¸', nombre: 'Primer jefe caÃ­do', desc: 'VencÃ© a tu primer jefe.',                check: s => (s.rpg_jefesVencidos || 0) >= 1 },
  { id: 'rpg_capitulo1',  juego: 'rpg_pixel', icon: 'ðŸ“œ', nombre: 'CapÃ­tulo 1',        desc: 'CompletÃ¡ el CapÃ­tulo 1.',                 check: s => (s.rpg_capitulosCompletados || []).includes(1) },
  { id: 'rpg_cofreoro',   juego: 'rpg_pixel', icon: 'ðŸ’°', nombre: 'Fortuna',           desc: 'AbrÃ­ tu primer cofre de oro.',            check: s => (s.rpg_cofresOro || 0) >= 1 },
  { id: 'rpg_elite',      juego: 'rpg_pixel', icon: 'ðŸ‘‘', nombre: 'Modo Elite',        desc: 'CompletÃ¡ una partida en dificultad Elite.', check: s => !!s.rpg_eliteCompletado },
  { id: 'rpg_powerups',   juego: 'rpg_pixel', icon: 'ðŸ§ª', nombre: 'Alquimista',        desc: 'DesbloqueÃ¡ los 8 power-ups distintos.',    check: s => (s.rpg_powerupsUnicos || []).length >= 8 },
];

// â”€â”€â”€ Guardado de logros obtenidos â”€â”€â”€
// La lista de ids desbloqueados se guarda en localStorage (funciona
// tambiÃ©n sin sesiÃ³n iniciada) y se sincroniza con el backend
// (GET/POST /api/logros) cuando hay un usuario logueado.
function getLogrosObtenidos() {
  try { return JSON.parse(localStorage.getItem('unigames_logros')) || []; }
  catch { return []; }
}
function guardarLogrosObtenidos(lista) {
  localStorage.setItem('unigames_logros', JSON.stringify(lista));
}

// Se llama al iniciar sesiÃ³n (o al cargar la app con un token guardado):
// trae los logros ya desbloqueados en el servidor y los mezcla con los
// que hubiera localmente (por si se jugÃ³ sin conexiÃ³n), sin perder ninguno.
async function sincronizarLogrosConBackend() {
  if (!localStorage.getItem('unigames_token')) return;
  try {
    const remotos = await apiFetch('/api/logros');
    const idsRemotos = remotos.map(l => l.logro_id);
    const locales = getLogrosObtenidos();
    const combinados = Array.from(new Set([...locales, ...idsRemotos]));
    guardarLogrosObtenidos(combinados);

    // Si habÃ­a logros locales que el servidor todavÃ­a no tenÃ­a (jugados
    // sin conexiÃ³n), los subimos.
    const faltantesEnServidor = locales.filter(id => !idsRemotos.includes(id));
    for (const id of faltantesEnServidor) {
      enviarLogroBackend(id);
    }

    if (document.getElementById('sec-logros')?.classList.contains('active')) {
      renderLogros(logrosFiltroActivo);
    }
  } catch (error) {
    console.error('Error al sincronizar logros:', error);
  }
}

// Avisa al backend que se desbloqueÃ³ un logro. Se llama "en segundo
// plano": si falla (sin conexiÃ³n, sin sesiÃ³n) no interrumpe el juego,
// el logro ya quedÃ³ guardado localmente.
async function enviarLogroBackend(id) {
  if (!localStorage.getItem('unigames_token')) return;
  try {
    await apiFetch('/api/logros', { method: 'POST', body: JSON.stringify({ logro_id: id }) });
  } catch (error) {
    console.error('Error al guardar el logro en el servidor:', error);
  }
}

function getLogrosStats() {
  try { return JSON.parse(localStorage.getItem('unigames_logros_stats')) || {}; }
  catch { return {}; }
}
function guardarLogrosStats(stats) {
  localStorage.setItem('unigames_logros_stats', JSON.stringify(stats));
}

// Combina un "patch" de progreso con las stats ya guardadas: los
// nÃºmeros se suman, los que terminan en "_best" se quedan con el
// mÃ¡ximo, los arrays se mezclan sin duplicar, y los que terminan en
// "_racha" arman un contador de racha actual + racha mÃ¡xima (el
// valor del patch debe ser true para sumar 1, o false para cortarla).
function aplicarPatchLogros(patch) {
  const stats = getLogrosStats();
  Object.entries(patch).forEach(([key, val]) => {
    if (key.endsWith('_racha')) {
      const actualKey = key + '_actual';
      const maxKey = key + '_max';
      stats[actualKey] = val ? (stats[actualKey] || 0) + 1 : 0;
      stats[maxKey] = Math.max(stats[maxKey] || 0, stats[actualKey]);
    } else if (Array.isArray(val)) {
      stats[key] = Array.from(new Set([...(stats[key] || []), ...val]));
    } else if (key.endsWith('_best') && typeof val === 'number') {
      stats[key] = Math.max(stats[key] || 0, val);
    } else if (typeof val === 'number') {
      stats[key] = (stats[key] || 0) + val;
    } else {
      stats[key] = val;
    }
  });
  guardarLogrosStats(stats);
  return stats;
}

// Revisa los logros de un juego (+ los generales) contra las stats
// actuales y desbloquea los que ya se cumplen.
function revisarLogros(juegoId) {
  const stats = getLogrosStats();
  ACHIEVEMENTS.filter(a => a.juego === juegoId || a.juego === 'general')
    .forEach(a => { if (a.check(stats)) desbloquearLogro(a.id); });
}

// Punto central: cada minijuego llama a esto una vez por partida
// terminada, pasando un "patch" con lo que corresponda actualizar
// (ver ejemplos de uso en initAhorcado/initWordle/etc. mÃ¡s abajo).
// Sin cuenta no se trackea ni se guarda progreso de logros (se exige
// estar logueado para "conseguir y guardar logros").
function registrarProgresoJuego(juegoId, patch = {}) {
  if (!currentUser) return;
  const stats = getLogrosStats();
  stats.partidasJugadas = (stats.partidasJugadas || 0) + 1;
  stats.juegosJugados = stats.juegosJugados || [];
  if (!stats.juegosJugados.includes(juegoId)) stats.juegosJugados.push(juegoId);
  guardarLogrosStats(stats);

  aplicarPatchLogros(patch);
  revisarLogros(juegoId);
}

// Para logros de racha que se actualizan a mitad de partida (por
// ejemplo, cada pregunta de Preguntados), sin contar una "partida"
// nueva cada vez.
function actualizarRachaLogro(juegoId, campo, continua) {
  if (!currentUser) return;
  aplicarPatchLogros({ [campo]: continua });
  revisarLogros(juegoId);
}

// Igual que registrarProgresoJuego pero para actualizar stats a mitad de
// partida (por ejemplo, cada acierto de Preguntados o cada item de Adivina
// la Cosa) sin sumar una "partida jugada" extra por cada actualizaciÃ³n.
function actualizarProgresoParcial(juegoId, patch = {}) {
  if (!currentUser) return;
  aplicarPatchLogros(patch);
  revisarLogros(juegoId);
}

// Marca un logro como obtenido (si no lo estaba) y avisa al usuario.
// Requiere cuenta: sin sesiÃ³n no se guarda nada (ver banner de la
// secciÃ³n Logros).
function desbloquearLogro(id) {
  if (!currentUser) return;
  const obtenidos = getLogrosObtenidos();
  if (obtenidos.includes(id)) return;
  obtenidos.push(id);
  guardarLogrosObtenidos(obtenidos);
  enviarLogroBackend(id);
  const def = ACHIEVEMENTS.find(a => a.id === id);
  if (def) mostrarToastLogro(def);
  if (document.getElementById('sec-logros')?.classList.contains('active')) {
    renderLogros(logrosFiltroActivo);
  }
}

// PequeÃ±o aviso no bloqueante cuando se desbloquea un logro.
function mostrarToastLogro(def) {
  const toast = document.createElement('div');
  toast.className = 'logro-toast';
  toast.innerHTML = `<span class="logro-toast-icon">${def.icon}</span>
    <div><div class="logro-toast-title">Â¡Logro desbloqueado!</div><div class="logro-toast-name">${sanitizeHTML(def.nombre)}</div></div>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// â”€â”€â”€ Render de la pantalla de Logros â”€â”€â”€
function renderLogrosProgreso() {
  const obtenidos = getLogrosObtenidos();
  const total = ACHIEVEMENTS.length;
  const countEl = document.getElementById('logrosProgressCount');
  if (countEl) countEl.textContent = String(obtenidos.length).padStart(2, '0') + '/' + total;
  const fill = document.getElementById('logrosProgressFill');
  if (fill) fill.style.width = (total ? (obtenidos.length / total * 100) : 0) + '%';
}

function renderLogrosTabs() {
  const wrap = document.getElementById('logrosGameTabs');
  if (!wrap) return;
  wrap.innerHTML = `<button class="logro-tab active" data-juego="todos" onclick="renderLogros('todos', this)">${gameIconSVG('todos', 15)} Todos</button>` +
    LOGROS_JUEGOS.map(j => `<button class="logro-tab" data-juego="${j.id}" onclick="renderLogros('${j.id}', this)">${gameIconSVG(j.id, 15)} ${j.nombre}</button>`).join('');
}

let logrosFiltroActivo = 'todos';

function renderLogros(filtro, btn) {
  logrosFiltroActivo = filtro || 'todos';
  if (btn) {
    document.querySelectorAll('.logro-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  const obtenidos = getLogrosObtenidos();
  const lista = logrosFiltroActivo === 'todos' ? ACHIEVEMENTS : ACHIEVEMENTS.filter(a => a.juego === logrosFiltroActivo);
  const box = document.getElementById('logrosList');
  if (!box) return;
  box.innerHTML = lista.map(a => {
    const obtenido = obtenidos.includes(a.id);
    return `
      <div class="achievement-card ${obtenido ? 'obtained' : 'locked'}">
        <div class="achievement-icon">${a.icon}</div>
        <div class="achievement-info">
          <div class="achievement-name">${a.nombre}</div>
          <div class="achievement-desc">${a.desc}</div>
        </div>
        <div class="achievement-status">${obtenido
          ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Obtenido'
          : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> No obtenido'}</div>
      </div>`;
  }).join('');
}

// Se llama al entrar a la pantalla de Logros (desde goTo()). Sin cuenta
// no se guarda progreso, asÃ­ que mostramos el cartel de "creÃ¡ una cuenta"
// en vez de la lista de logros.
function initLogrosScreen() {
  const banner = document.getElementById('logrosGuestBanner');
  const content = document.getElementById('logrosLoggedContent');
  if (!currentUser) {
    if (banner) banner.classList.remove('hidden');
    if (content) content.classList.add('hidden');
    return;
  }
  if (banner) banner.classList.add('hidden');
  if (content) content.classList.remove('hidden');
  renderLogrosProgreso();
  renderLogrosTabs();
  renderLogros('todos');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   PERFIL
//   Conectado al backend (routes/perfil.js):
//     - perfil propio       -> GET /api/perfil
//     - perfil de otro user -> GET /api/usuarios/:id/perfil
//     - guardar descripciÃ³n -> PATCH /api/perfil { descripcion }
//     - cambiar Ã­cono       -> PATCH /api/perfil { icono }
//   Los puntajes mÃ¡ximos por minijuego siguen siendo de ejemplo hasta
//   que exista ese endpoint (no forma parte del sistema de amigos/logros).
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// { modo: 'propio' | 'otro', id: number, data: {...} | null }
let perfilContexto = { modo: 'propio', id: null, data: null };

// Los 30 Ã­conos de perfil reales (public/assert/perfil_icons/icon_01.webp
// ... icon_30.webp), recortados de la spritesheet que pasÃ³ Santiago.
const PERFIL_ICONOS = Array.from({ length: 30 }, (_, i) =>
  'assert/perfil_icons/icon_' + String(i + 1).padStart(2, '0') + '.webp'
);

// Ãcono por defecto para cuentas que todavÃ­a no eligieron uno.
const PERFIL_ICONO_DEFAULT = 'assert/perfil_icons/icon_01.webp';

// PRNG simple y determinÃ­stico (mismo id/seed siempre da el mismo resultado),
// asÃ­ los datos de ejemplo no cambian en cada render.
function seededRandom(seed) {
  const x = Math.sin(seed * 999.7) * 10000;
  return x - Math.floor(x);
}

// Puntaje mÃ¡ximo "de ejemplo" por juego. TODO (backend): reemplazar por
// GET /api/usuarios/:id/puntajes-maximos cuando exista ese endpoint.
function getPuntajesMaximosMock(seedBase) {
  const juegos = LOGROS_JUEGOS.filter(j => j.id !== 'general');
  const map = {};
  juegos.forEach((j, i) => {
    map[j.id] = Math.floor(seededRandom(seedBase + i * 13.3) * 900) + 100;
  });
  return map;
}

function togglePerfilIconPicker() {
  const picker = document.getElementById('perfilIconPicker');
  if (picker) picker.classList.toggle('hidden');
}

// PATCH /api/perfil { icono }
async function elegirPerfilIcono(icono) {
  try {
    await apiFetch('/api/perfil', { method: 'PATCH', body: JSON.stringify({ icono }) });
    if (perfilContexto.data) perfilContexto.data.icono = icono;
    togglePerfilIconPicker();
    renderPerfil();
  } catch (error) {
    alert(error.message || 'No se pudo cambiar el Ã­cono.');
  }
}

// PATCH /api/perfil { descripcion }
async function guardarPerfilDescripcion() {
  const input = document.getElementById('perfilDescInput');
  const btn = document.getElementById('perfilDescGuardarBtn');
  if (!input) return;
  const descripcion = input.value.trim();

  try {
    await apiFetch('/api/perfil', { method: 'PATCH', body: JSON.stringify({ descripcion }) });
    if (perfilContexto.data) perfilContexto.data.descripcion = descripcion;
    if (btn) {
      const original = btn.textContent;
      btn.textContent = 'âœ… Guardado';
      setTimeout(() => { btn.textContent = original; }, 1500);
    }
  } catch (error) {
    alert(error.message || 'No se pudo guardar la descripciÃ³n.');
  }
}

// Abre el perfil propio (botÃ³n "Perfil" del menÃº de cuenta).
function abrirPerfilPropio() {
  if (!currentUser) { openModal('login'); return; }
  perfilContexto = { modo: 'propio', id: currentUser.id, data: null };
  goTo('perfil');
}

// Abre el perfil de cualquier usuario por id (propio o de un tercero, el
// backend decide quÃ© tan detallada es la respuesta segÃºn quiÃ©n pregunta).
function abrirPerfilDeUsuario(id) {
  const esPropio = currentUser && Number(id) === currentUser.id;
  perfilContexto = { modo: esPropio ? 'propio' : 'otro', id: Number(id), data: null };
  goTo('perfil');
}

// Etiqueta y acciÃ³n del botÃ³n de amistad segÃºn el estado que devuelve el
// backend en el campo `amistad` del perfil. Un invitado (sin cuenta) puede
// ver el perfil, pero no mandar solicitud: se le ofrece iniciar sesiÃ³n.
function botonAmistadHTML(data) {
  if (!currentUser) {
    return `<button class="profile-friend-request-btn" onclick="openModal('login')">${uiIconSVG('plus', 14)} IniciÃ¡ sesiÃ³n para agregar</button>`;
  }
  switch (data.amistad) {
    case 'amigos':
      return `<span class="profile-friend-request-btn" style="cursor:default;opacity:.8;">${uiIconSVG('users', 14)} Ya son amigos</span>`;
    case 'solicitud_enviada':
      return `<span class="profile-friend-request-btn" style="cursor:default;opacity:.8;">${uiIconSVG('check', 14)} Solicitud enviada</span>`;
    case 'solicitud_recibida':
      return `<span class="profile-friend-request-btn" style="cursor:default;opacity:.8;">Te enviÃ³ una solicitud â€” revisala en Amigos</span>`;
    default:
      return `<button class="profile-friend-request-btn" onclick="enviarSolicitudAmistad(${data.id}, '${sanitizeHTML(data.username)}')">${uiIconSVG('plus', 14)} Solicitud de amistad</button>`;
  }
}

// Render de la pantalla de Perfil, sirve tanto para el propio como para
// el de otro usuario. Usa perfilContexto.data, que llena initPerfilScreen().
function renderPerfil() {
  const box = document.getElementById('perfilBox');
  if (!box) return;
  const u = perfilContexto.data;
  if (!u) {
    box.innerHTML = '<p style="text-align:center;color:#94A3B8;padding:2rem;">No se encontrÃ³ el perfil.</p>';
    return;
  }

  const esPropio = perfilContexto.modo === 'propio';
  const iconoAMostrar = u.icono || PERFIL_ICONO_DEFAULT;
  const avatarHTML = avatarValueHTML(iconoAMostrar, u.username);

  // â”€ Puntajes mÃ¡ximos por juego (mock, sin endpoint propio todavÃ­a) â”€
  const scores = getPuntajesMaximosMock(u.id || 1);
  const juegos = LOGROS_JUEGOS.filter(j => j.id !== 'general');

  box.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar-wrap">
        <div class="profile-avatar" id="profileAvatarDisplay">${avatarHTML}</div>
        ${esPropio ? `<button class="profile-avatar-edit-btn" onclick="togglePerfilIconPicker()" title="Cambiar Ã­cono"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"></path></svg></button>` : ''}
      </div>
      <div class="profile-header-main">
        <div class="profile-header-info">
          <div class="profile-name">${sanitizeHTML(u.username)}</div>
          <div class="profile-name-tag">${esPropio ? 'Tu perfil' : 'Perfil de otro usuario'}</div>
        </div>
        <div class="profile-header-stat">
          <span class="profile-header-stat-value">${u.amigosCount}</span>
          <span class="profile-header-stat-label">${uiIconSVG('users', 13)} Amigos</span>
        </div>
        <div class="profile-header-stat">
          <span class="profile-header-stat-value">${String(u.logrosCount).padStart(2, '0')}/${ACHIEVEMENTS.length}</span>
          <span class="profile-header-stat-label">${gameIconSVG('general', 13)} Logros</span>
        </div>
      </div>
      ${!esPropio ? botonAmistadHTML(u) : ''}
    </div>

    ${esPropio ? `
    <div class="profile-icon-picker hidden" id="perfilIconPicker">
      ${PERFIL_ICONOS.map(ic => `<button class="profile-icon-option ${ic === iconoAMostrar ? 'selected' : ''}" onclick="elegirPerfilIcono('${ic}')"><img src="${ic}" alt="Ãcono"></button>`).join('')}
    </div>
    ` : ''}

    <div class="profile-desc-box">
      ${esPropio ? `
        <textarea class="profile-desc-textarea" id="perfilDescInput" maxlength="180" placeholder="EscribÃ­ algo sobre vos... (lo van a ver tus amigos)">${sanitizeHTML(u.descripcion || '')}</textarea>
        <button class="profile-desc-save-btn" id="perfilDescGuardarBtn" onclick="guardarPerfilDescripcion()">Guardar descripciÃ³n</button>
      ` : `<p class="profile-desc-text">${sanitizeHTML(u.descripcion || 'TodavÃ­a no escribiÃ³ una descripciÃ³n.')}</p>`}
    </div>

    ${esPropio || u.amigos === undefined ? '' : `
    <div class="section-title" style="font-size:12px;margin-top:1.75rem;">Amigos en comÃºn / lista de amigos</div>
    <div class="profile-scores-grid">${(u.amigos || []).map(a => `<div class="profile-score-card">${a.username}</div>`).join('')}</div>
    `}

    <div class="section-title" style="font-size:12px;margin-top:1.75rem;">Logros completados</div>
    <div class="achievements-mini-grid" style="display:flex;flex-wrap:wrap;gap:8px;">
      ${u.logros.length === 0
        ? '<p style="color:#94A3B8;">TodavÃ­a no desbloqueÃ³ logros.</p>'
        : u.logros.map(id => {
            const def = ACHIEVEMENTS.find(a => a.id === id);
            return def ? `<span class="achievement-icon" title="${sanitizeHTML(def.nombre)}" style="font-size:22px;">${def.icon}</span>` : '';
          }).join('')}
    </div>

    <div class="section-title" style="font-size:12px;margin-top:1.75rem;">PuntuaciÃ³n mÃ¡xima por minijuego</div>
    <div class="profile-scores-grid">
      ${juegos.map(j => `
        <div class="profile-score-card">
          <div class="profile-score-emoji">${gameIconSVG(j.id, 26)}</div>
          <div class="profile-score-name">${j.nombre}</div>
          <div class="profile-score-value">${scores[j.id]}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// Se llama al entrar a la pantalla de Perfil (desde goTo()): trae los
// datos reales del backend y reciÃ©n ahÃ­ renderiza.
async function initPerfilScreen() {
  const box = document.getElementById('perfilBox');
  if (box) box.innerHTML = '<p style="text-align:center;color:#94A3B8;padding:2rem;">Cargando perfil...</p>';

  if (!perfilContexto.id) {
    perfilContexto.data = null;
    renderPerfil();
    return;
  }

  try {
    const url = perfilContexto.modo === 'propio' ? '/api/perfil' : `/api/usuarios/${perfilContexto.id}/perfil`;
    perfilContexto.data = await apiFetch(url);
  } catch (error) {
    console.error('Error al cargar el perfil:', error);
    perfilContexto.data = null;
  }
  renderPerfil();
}

// â”€â”€â”€ Juegos recomendados (dentro de cada pantalla de minijuego) â”€â”€â”€
// Se muestran 3 juegos al azar de los 9 totales, sin repetir el que
// se estÃ¡ jugando en ese momento.
const GAME_SCREEN_IDS = ['sopa', 'preguntados', 'termina', 'ahorcado', 'wordle', 'adivina', 'runner', 'castle_escape', 'rpg_pixel'];

function renderRecommendedGames(currentGameId) {
  const container = document.getElementById('recBox-' + currentGameId);
  if (!container) return;
  const pool = [...allGames, ...actionGames].filter(g => g.id !== currentGameId);
  const three = shuffle(pool).slice(0, 3);
  container.innerHTML = three.map(gameCardHTML).join('');
}

function scrollToGame(gameId) {
  // Cambiar a la pestaÃ±a de juegos manualmente para evitar conflicto de scroll
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const target = APP_EL.secJuegos;
  if (target) target.classList.add('active');

  setTimeout(() => {
    const card = document.getElementById('card-' + gameId);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.transition = 'transform 0.3s, box-shadow 0.3s';
      card.style.transform = 'scale(1.02)';
      card.style.boxShadow = '0 0 20px rgba(255,255,255,0.2)';
      setTimeout(() => {
        card.style.transform = 'none';
        card.style.boxShadow = 'none';
      }, 1500);
    }
  }, 50);
}

// â”€â”€â”€ Guardar HTML original de secciones que reemplazan su contenido â”€â”€â”€
const originalSectionHTML = {};

function saveOriginalSections() {
  ['preguntados', 'sopa', 'termina'].forEach(id => {
    const sec = document.getElementById('sec-' + id);
    if (sec) originalSectionHTML[id] = sec.innerHTML;
  });
}

function restoreOriginalSection(id) {
  if (originalSectionHTML[id]) {
    const sec = document.getElementById('sec-' + id);
    if (sec) sec.innerHTML = originalSectionHTML[id];
  }
}

// â”€â”€â”€ NavegaciÃ³n entre secciones â”€â”€â”€â”€â”€â”€â”€â”€
function goTo(section) {
  // Ocultar todas las secciones
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  // Mostrar la secciÃ³n solicitada
  document.getElementById('sec-' + section).classList.add('active');

  // Actualizar link activo en el menÃº (solo para las secciones del nav)
  const links = document.querySelectorAll('.nav-menu a');
  const map = { inicio: 0, juegos: 1, puntuacion: 2 };
  links.forEach(a => a.classList.remove('active'));
  // Para pantallas de juego, mantener "Juegos" activo
  const navIdx = map[section] !== undefined ? map[section] : map['juegos'];
  if (links[navIdx]) links[navIdx].classList.add('active');

  // Refrescar leaderboard al navegar a la secciÃ³n de puntuaciÃ³n
  if (section === 'puntuacion') fetchLeaderboard();

  // Refrescar amigos / logros / perfil al navegar a esas secciones
  if (section === 'amigos') initAmigosScreen();
  if (section === 'logros') initLogrosScreen();
  if (section === 'perfil') initPerfilScreen();

  // Restaurar HTML original de secciones de juego al volver a la grilla
  if (section === 'juegos') {
    ['preguntados', 'sopa', 'termina'].forEach(restoreOriginalSection);
  }

if (section === 'runner' || section === 'castle_escape' || section === 'rpg_pixel') {
    // Estos juegos manejan su propia mÃºsica (la ponen ellos mismos vÃ­a
    // setMusic al mostrar su menÃº). Ojo: NO llamar a mutePageMusic() acÃ¡,
    // porque deja pageMusicMuted = true y el setMusic() que viene justo
    // despuÃ©s (showRunnerMenu / initTrampas / rpgInit) queda bloqueado hasta
    // que el usuario mutea y desmutea manualmente.
    unmutepageMusic();
    if (section === 'castle_escape' && typeof initTrampas === 'function') initTrampas();
    if (section === 'rpg_pixel' && typeof rpgInit === 'function') rpgInit();
  } else {
    // Cualquier otra secciÃ³n usa la mÃºsica ambiente del sitio: la reactivamos
    unmutepageMusic();
    if (typeof changeBgMusic === 'function') changeBgMusic('menu.mp3');
  }

  // Al entrar a la pantalla de un minijuego, mostrar 3 recomendados al azar
  if (GAME_SCREEN_IDS.includes(section)) {
    renderRecommendedGames(section);
  }

  closeNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// â”€â”€â”€ MenÃº hamburguesa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const hamburger = APP_EL.hamburger;
const navMenu   = APP_EL.navMenu;

// Los dos menÃºs laterales (nav izquierdo y cuenta derecha) comparten el
// mismo fondo oscuro y nunca deben quedar abiertos los dos a la vez: al
// abrir uno, se cierra el otro primero.
hamburger.addEventListener('click', () => {
  const abriendo = !navMenu.classList.contains('open');
  closeAccountDrawer();
  if (abriendo) {
    hamburger.classList.add('open');
    navMenu.classList.add('open');
    const backdrop = APP_EL.drawerBackdrop;
    if (backdrop) backdrop.classList.add('open');
  } else {
    closeNav();
  }
});

function closeNav() {
  hamburger.classList.remove('open');
  navMenu.classList.remove('open');
  const backdrop = APP_EL.drawerBackdrop;
  if (backdrop && !APP_EL.accountDrawer?.classList.contains('open')) backdrop.classList.remove('open');
}

function toggleAccountDrawer() {
  const drawer = APP_EL.accountDrawer;
  if (!drawer) return;
  const abriendo = !drawer.classList.contains('open');
  closeNav();
  if (abriendo) {
    drawer.classList.add('open');
    const backdrop = APP_EL.drawerBackdrop;
    if (backdrop) backdrop.classList.add('open');
  } else {
    closeAccountDrawer();
  }
}

function closeAccountDrawer() {
  const drawer = APP_EL.accountDrawer;
  const backdrop = APP_EL.drawerBackdrop;
  if (drawer) drawer.classList.remove('open');
  if (backdrop && !navMenu.classList.contains('open')) backdrop.classList.remove('open');
}

function iniciarJuego(gameKey) {
  launchGame(gameKey, null);
}

// â”€â”€â”€ Carteles internos del Pixel Runner (Mejoras / Ajustes / CÃ³mo jugar) â”€â”€â”€
// Reemplazan los alert() del navegador: son paneles que se muestran arriba
// del menÃº del juego, dentro del mismo recuadro. Todos comparten
// cerrarPanelesRunner() para volver al menÃº.
function cerrarPanelesRunner() {
  ['runnerMejorasPanel', 'runnerAjustesPanel', 'runnerComoJugarPanel', 'runnerModePanel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

// â”€â”€â”€ SelecciÃ³n de modo (Historia / Infinito) â”€â”€â”€
// Se muestra al tocar "Jugar" en el menÃº de Pixel Runner. Infinito arranca
// bloqueado hasta completar Historia (llegar a los 2500 pts), estado que
// persiste en localStorage (ver loadHistoriaCompleta/saveHistoriaCompleta
// en pixelrunner.js).
function mostrarModoRunner() {
  const desbloqueado = typeof loadHistoriaCompleta === 'function' && loadHistoriaCompleta();
  const btnInfinito = APP_EL.runnerModoInfinitoBtn;
  const descInfinito = APP_EL.runnerModoInfinitoDesc;
  if (btnInfinito) btnInfinito.classList.toggle('locked', !desbloqueado);
  if (descInfinito) {
    descInfinito.textContent = desbloqueado
      ? 'Sin lÃ­mite de puntos, Â¡aguantÃ¡ lo mÃ¡s que puedas!'
      : 'ðŸ”’ CompletÃ¡ Historia para desbloquear';
  }
  const panel = APP_EL.runnerModePanel;
  if (panel) panel.classList.remove('hidden');
}

// â”€â”€â”€ Modo Duelo de Pixel Runner â”€â”€â”€
// Usa el modo Infinito ya existente (el que mÃ¡s puntos haga gana), pero
// arranca directo sin pasar por el menÃº ni por el candado de "CompletÃ¡
// Historia primero" (los duelos siempre habilitan Infinito).
// El puntaje final se reporta desde runner_loop.js (updateRunner), en el
// momento exacto en que el jugador choca: ahÃ­ se lee window.dueloActivo
// y, si corresponde, se llama a window.finalizarDueloConPuntaje(...) con
// el RUNNER.score de ese instante. Ver el comentario en runner_loop.js.
function iniciarRunnerDuelo(dueloId) {
  dueloActivo = { id: dueloId, juego: 'runner' };
  goTo('runner');
  cerrarPanelesRunner();
  const menu = document.getElementById('runnerMenu');
  if (menu) menu.style.display = 'none';
  mostrarToast('Â¡ArrancÃ³ el duelo! Modo Infinito.');
  runnerSyncFullscreenBtn();
  if (typeof startPixelRunnerGame === 'function') {
    startPixelRunnerGame('infinito');
  }
}

function elegirModoRunner(mode) {
  if (mode === 'infinito' && !(typeof loadHistoriaCompleta === 'function' && loadHistoriaCompleta())) {
    return; // sigue bloqueado, no hace nada
  }
  cerrarPanelesRunner();
  runnerSyncFullscreenBtn();
  if (mode === 'historia' && typeof RUNNER_COMICS !== 'undefined') {
    // Historia arranca con un cÃ³mic de intro; reciÃ©n al tocar "Continuar"
    // se inicializa el juego de verdad.
    showRunnerComic(RUNNER_COMICS.intro, () => startPixelRunnerGame('historia'));
  } else {
    startPixelRunnerGame(mode);
  }
}

// â”€â”€â”€ Panel de Mejoras (tienda de mejoras permanentes con monedas) â”€â”€â”€
// El estado real (niveles, compradas, monedas) vive en pixelrunner.js
// (RUNNER.upgrades / RUNNER.totalCoins + localStorage). AcÃ¡ solo se arma
// el HTML del panel a partir de ese estado, cada vez que se abre o se
// compra algo â€” asÃ­ siempre se ve al dÃ­a.
const RUNNER_UPGRADE_DEFS = [
  {
    tipo: 'shieldDuration',
    icon: 'ðŸ›¡ï¸',
    nombre: 'DuraciÃ³n del Escudo',
    tipoNivel: true,
    formatEfecto: (nivel) => `Dura ${15 + nivel} seg`,
  },
  {
    tipo: 'x2Duration',
    icon: 'âš¡',
    nombre: 'DuraciÃ³n del x2',
    tipoNivel: true,
    formatEfecto: (nivel) => `Dura ${15 + nivel} seg`,
  },
  {
    tipo: 'shieldHits',
    icon: 'ðŸ›¡ï¸âœ¨',
    nombre: 'Escudo Reforzado',
    tipoNivel: false,
    costo: 1000,
    descripcion: 'El escudo aguanta 2 golpes en vez de 1',
  },
  {
    tipo: 'x2Triple',
    icon: 'ðŸ”¥',
    nombre: 'Triple Puntos',
    tipoNivel: false,
    costo: 1500,
    descripcion: 'El power-up de puntos pasa de x2 a x3',
  },
];

function mejoraCardHtml(def, upgrades, coins) {
  if (def.tipoNivel) {
    const nivel = def.tipo === 'shieldDuration' ? upgrades.shieldLevel : upgrades.x2Level;
    const maxed = nivel >= 10;
    const costo = maxed ? null : getUpgradeCost(def.tipo, upgrades);
    const puedeComprar = !maxed && coins >= costo;
    const efectoActual = def.formatEfecto(nivel);
    const efectoSiguiente = maxed ? '' : def.formatEfecto(nivel + 1);
    return `
      <div class="runner-mejora-card${maxed ? ' maxed' : ''}">
        <div class="runner-mejora-icon">${def.icon}</div>
        <div class="runner-mejora-info">
          <div class="runner-mejora-nombre">${def.nombre}</div>
          <div class="runner-mejora-nivel">Nivel ${nivel}/10</div>
          <div class="runner-mejora-efecto">${maxed ? efectoActual : (efectoActual + ' â†’ ' + efectoSiguiente)}</div>
        </div>
        <button class="runner-mejora-btn" ${maxed || !puedeComprar ? 'disabled' : ''} onclick="comprarMejora('${def.tipo}')">
          ${maxed ? 'MÃX' : ('ðŸª™ ' + costo)}
        </button>
      </div>`;
  } else {
    const comprado = def.tipo === 'shieldHits' ? upgrades.shieldHits : upgrades.x2Triple;
    const puedeComprar = !comprado && coins >= def.costo;
    return `
      <div class="runner-mejora-card${comprado ? ' maxed' : ''}">
        <div class="runner-mejora-icon">${def.icon}</div>
        <div class="runner-mejora-info">
          <div class="runner-mejora-nombre">${def.nombre}</div>
          <div class="runner-mejora-efecto">${def.descripcion}</div>
        </div>
        <button class="runner-mejora-btn" ${comprado || !puedeComprar ? 'disabled' : ''} onclick="comprarMejora('${def.tipo}')">
          ${comprado ? 'âœ” Comprado' : ('ðŸª™ ' + def.costo)}
        </button>
      </div>`;
  }
}

function renderMejoras() {
  const grid = APP_EL.runnerMejorasGrid;
  if (!grid || typeof refreshRunnerUpgrades !== 'function') return;
  const upgrades = refreshRunnerUpgrades();
  const coins = typeof loadTotalCoins === 'function' ? loadTotalCoins() : 0;
  grid.innerHTML = RUNNER_UPGRADE_DEFS.map(def => mejoraCardHtml(def, upgrades, coins)).join('');
}

function comprarMejora(tipo) {
  if (typeof buyRunnerUpgrade !== 'function') return;
  buyRunnerUpgrade(tipo); // ya valida costo/mÃ¡ximo adentro; si no se pudo, simplemente no cambia nada
  mostrarMejoras(); // re-renderiza con las monedas y niveles actualizados
}

function mostrarMejoras() {
  // RUNNER / loadTotalCoins vienen de pixelrunner.js (mismo scope global).
  // Se relee siempre de localStorage para no mostrar datos viejos si el
  // panel se abre antes de que arranque una partida en esta sesiÃ³n.
  const coinsEl = APP_EL.runnerMejorasCoinsTotal;
  const total = typeof loadTotalCoins === 'function' ? loadTotalCoins() : 0;
  if (coinsEl) coinsEl.textContent = total;
  renderMejoras();
  const panel = APP_EL.runnerMejorasPanel;
  if (panel) panel.classList.remove('hidden');
}

function mostrarAjustes() {
  const musicSlider = APP_EL.runnerMusicVolume;
  const sfxSlider   = APP_EL.runnerSfxVolume;
  const musicValue  = APP_EL.runnerMusicVolumeValue;
  const sfxValue    = APP_EL.runnerSfxVolumeValue;
  const musicPct = Math.round(getGlobalMusicVolume() * 100);
  const sfxPct   = Math.round(getGlobalSfxVolume() * 100);
  if (musicSlider) musicSlider.value = musicPct;
  if (sfxSlider)   sfxSlider.value = sfxPct;
  if (musicValue)  musicValue.textContent = musicPct + '%';
  if (sfxValue)    sfxValue.textContent = sfxPct + '%';
  runnerSyncFullscreenBtn();
  const panel = APP_EL.runnerAjustesPanel;
  if (panel) panel.classList.remove('hidden');
}

function runnerOnMusicVolumeChange(value) {
  const pct = parseInt(value, 10) || 0;
  setGlobalMusicVolume(pct / 100);
  const label = APP_EL.runnerMusicVolumeValue;
  if (label) label.textContent = pct + '%';
}

function runnerOnSfxVolumeChange(value) {
  const pct = parseInt(value, 10) || 0;
  setGlobalSfxVolume(pct / 100);
  const label = APP_EL.runnerSfxVolumeValue;
  if (label) label.textContent = pct + '%';
}

// â”€â”€â”€ Pantalla completa (panel de Ajustes) â”€â”€â”€
// Pone en fullscreen el .runner-container (canvas + HUD + overlays), no
// toda la pÃ¡gina, para no perder los carteles/menÃºs que viven dentro de
// ese mismo contenedor. runnerSyncFullscreenBtn() mantiene el texto del
// botÃ³n al dÃ­a tanto si el cambio lo dispara este botÃ³n como si el
// usuario sale con Esc (evento fullscreenchange).
function runnerGetFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function runnerFullscreenSupported() {
  const el = document.querySelector('#sec-runner .runner-container');
  return !!(el && (el.requestFullscreen || el.webkitRequestFullscreen));
}

function runnerToggleFullscreen() {
  const el = document.querySelector('#sec-runner .runner-container');
  if (!el) return;
  if (!runnerGetFullscreenElement()) {
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
}

function runnerSyncFullscreenBtn() {
  const soportado = runnerFullscreenSupported();
  const enFullscreen = !!runnerGetFullscreenElement();

  const row = APP_EL.runnerFullscreenRow;
  if (row) row.classList.toggle('unsupported', !soportado);
  const btn = APP_EL.runnerFullscreenBtn;
  if (btn) btn.textContent = enFullscreen ? 'Salir' : 'Activar';

  // BotÃ³n dentro del HUD del juego (arriba a la derecha): mismo estado,
  // pero con Ã­cono en vez de texto (maximize / minimize) para no ocupar
  // espacio sobre el canvas.
  const hudBtn = APP_EL.runnerHudFullscreenBtn;
  if (hudBtn) {
    hudBtn.classList.toggle('unsupported', !soportado);
    hudBtn.title = enFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa';
    hudBtn.innerHTML = uiIconSVG(enFullscreen ? 'minimize' : 'maximize', 18);
  }
}

document.addEventListener('fullscreenchange', runnerSyncFullscreenBtn);
document.addEventListener('webkitfullscreenchange', runnerSyncFullscreenBtn);

function mostrarComoJugar() {
  const panel = APP_EL.runnerComoJugarPanel;
  if (panel) panel.classList.remove('hidden');
}

// â”€â”€â”€ Modal login / registro â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openModal(tab) {
  APP_EL.modalOverlay.classList.add('open');
  switchTab(tab || 'login');
}

function closeModal() {
  APP_EL.modalOverlay.classList.remove('open');
  // Limpiar inputs al cerrar
  const inputs = ['loginIdentity', 'loginPassword', 'regUsername', 'regEmail', 'regPassword'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function switchTab(tab) {
  const isLogin = tab === 'login';
  APP_EL.tabLogin.classList.toggle('active', isLogin);
  APP_EL.tabRegister.classList.toggle('active', !isLogin);
  APP_EL.authSectionLogin.classList.toggle('active', isLogin);
  APP_EL.authSectionRegister.classList.toggle('active', !isLogin);
}

function showAuthAlert(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'auth-alert ' + type + ' show';
  setTimeout(() => el.classList.remove('show'), 4000);
}

// Medidor de fuerza de contraseÃ±a del formulario de registro. Se llama
// desde el oninput del input #regPassword (index.html); antes no estaba
// definida en ningÃºn lado y tiraba ReferenceError apenas se tipeaba algo.
// No es una validaciÃ³n real (esa la hace registerSchema en el backend) â€”
// es solo el feedback visual de la barrita + etiqueta.
function checkPasswordStrength(value) {
  const wrap = document.getElementById('pwdStrengthWrap');
  const fill = document.getElementById('pwdStrengthFill');
  const label = document.getElementById('pwdStrengthLabel');
  if (!wrap || !fill || !label) return;

  if (!value) {
    wrap.classList.remove('show');
    return;
  }
  wrap.classList.add('show');

  let score = 0;
  if (value.length >= 6) score++;
  if (value.length >= 10) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;

  const niveles = [
    { min: 0, width: '20%', color: '#ef4444', texto: 'Muy dÃ©bil' },
    { min: 2, width: '40%', color: '#f97316', texto: 'DÃ©bil' },
    { min: 3, width: '65%', color: '#eab308', texto: 'Media' },
    { min: 4, width: '85%', color: '#22c55e', texto: 'Buena' },
    { min: 5, width: '100%', color: '#16a34a', texto: 'Fuerte' },
  ];
  const nivel = [...niveles].reverse().find(n => score >= n.min) || niveles[0];

  fill.style.width = nivel.width;
  fill.style.background = nivel.color;
  label.textContent = nivel.texto;
  label.style.color = nivel.color;
}

// â”€â”€â”€ Selector de temÃ¡tica â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function selectTheme(btn) {
  const parent = btn.closest('.theme-selector');
  parent.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

// â”€â”€â”€ Juegos: prÃ³ximamente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function proximamente() {
  alert('ðŸš§ Â¡PrÃ³ximamente!\n\nEste juego estÃ¡ en desarrollo. IniciÃ¡ sesiÃ³n para ser notificado cuando estÃ© listo.');
}

// Los 6 minijuegos "clÃ¡sicos" (los que usan el cartel de elegir temÃ¡tica +
// jugar al entrar). Los juegos de acciÃ³n (runner, castle_escape, rpg_pixel)
// manejan su propio menÃº y no pasan por este flujo.
const CLASSIC_GAME_IDS = ['ahorcado', 'wordle', 'sopa', 'preguntados', 'termina', 'adivina'];

// â”€â”€â”€ Lanzar juego desde la card (inicio o juegos) â”€â”€
// Ya no se elige la temÃ¡tica acÃ¡: solo navega a la pantalla del juego.
// AhÃ­ aparece el cartel (tÃ­tulo + elegir temÃ¡tica + botÃ³n Jugar) y reciÃ©n
// cuando se confirma arranca el juego de verdad â€” esto le da tiempo al
// jugador antes de que la partida empiece.
function launchGame(gameKey, btn) {
  goTo(gameKey);

  if (gameKey === 'runner') {
    // Entrada normal (no duelo): si habÃ­a quedado un duelo colgado de una
    // visita anterior sin terminar, lo soltamos para no reportar mal un
    // puntaje de una partida libre como si fuera de duelo.
    if (dueloActivo && dueloActivo.juego === 'runner') dueloActivo = null;
    showRunnerMenu();
    return;
  }

  if (CLASSIC_GAME_IDS.includes(gameKey)) {
    resetGameStartMenu(gameKey);
  }
}

// Deja la pantalla del minijuego lista para arrancar: muestra el cartel de
// inicio (con la temÃ¡tica por defecto seleccionada) y oculta/limpia lo que
// haya quedado de una partida anterior.
function resetGameStartMenu(gameKey) {
  if (gameKey === 'adivina') {
    stopAdivina();
    adivinaDuelo = null;
    if (dueloActivo && dueloActivo.juego === 'adivina') dueloActivo = null;
    const ov = document.getElementById('adivinaOverlay');
    const themesWrap = document.getElementById('adivinaOverlayThemes');
    const emoji = document.getElementById('adivinaOverlayEmoji');
    const title = document.getElementById('adivinaOverlayTitle');
    const desc  = document.getElementById('adivinaOverlayDesc');
    const btn   = document.getElementById('adivinaOverlayBtn');
    if (emoji) emoji.textContent = 'ðŸ•µï¸';
    if (title) title.textContent = 'Adivina la Cosa';
    if (desc)  desc.innerHTML = 'Se muestran pistas una por una.<br>Â¡Cuantas menos uses, mÃ¡s puntos ganÃ¡s!';
    if (btn) { btn.textContent = 'â–¶ Jugar'; btn.onclick = () => confirmGameStart('adivina'); }
    if (themesWrap) themesWrap.style.display = '';
    if (ov) ov.style.display = 'flex';
    const game = document.getElementById('adivinaGame');
    if (game) game.style.display = 'none';
    return;
  }

  const overlay = document.getElementById(gameKey + 'StartOverlay');
  if (overlay) overlay.style.display = 'flex';

  if (gameKey === 'ahorcado' || gameKey === 'wordle') {
    const gameEl = document.getElementById(gameKey + 'Game');
    if (gameEl) gameEl.style.display = 'none';
  }
  if (gameKey === 'ahorcado') {
    // Si se abandonÃ³ un duelo a mitad de camino, no lo dejamos colgado.
    ahorcadoDuelo = null;
    if (dueloActivo && dueloActivo.juego === 'ahorcado') dueloActivo = null;
  }
  if (gameKey === 'wordle') {
    wordleDuelo = null;
    if (dueloActivo && dueloActivo.juego === 'wordle') dueloActivo = null;
  }
  if (gameKey === 'sopa') {
    clearInterval(sopaState.timer);
    sopaDuelo = null;
    if (dueloActivo && dueloActivo.juego === 'sopa') dueloActivo = null;
    const area = document.getElementById('sopaGameArea');
    if (area) area.innerHTML = '';
  }
  if (gameKey === 'preguntados') {
    clearInterval(pregState.timer);
    pregDuelo = null;
    if (dueloActivo && dueloActivo.juego === 'preguntados') dueloActivo = null;
    const area = document.getElementById('preguntadosGameArea');
    if (area) area.innerHTML = '';
  }
  if (gameKey === 'termina') {
    terminaDuelo = null;
    if (dueloActivo && dueloActivo.juego === 'termina') dueloActivo = null;
    const area = document.getElementById('terminaGameArea');
    if (area) area.innerHTML = '';
  }
}

// Se ejecuta al tocar "â–¶ Jugar" en el cartel de inicio de cada minijuego:
// lee la temÃ¡tica elegida, oculta el cartel y arranca el juego.
function confirmGameStart(gameKey) {
  if (gameKey === 'adivina') {
    const overlay  = document.getElementById('adivinaOverlay');
    const selected = overlay ? overlay.querySelector('.theme-btn.selected') : null;
    const raw      = selected ? selected.dataset.tematica : null;
    const tId      = raw && /^\d+$/.test(raw) ? Number(raw) : 1;
    initAdivina(tId);
    return;
  }

  const overlay  = document.getElementById(gameKey + 'StartOverlay');
  const selected = overlay ? overlay.querySelector('.theme-btn.selected') : null;
  const theme    = selected ? selected.textContent.trim() : null;
  const raw      = selected ? selected.dataset.tematica : null;

  if (overlay) overlay.style.display = 'none';

  const labelEl = document.getElementById(gameKey + '-theme-label');
  if (labelEl) labelEl.textContent = theme || '';

  if (gameKey === 'ahorcado') {
    const gameEl = document.getElementById('ahorcadoGame');
    if (gameEl) gameEl.style.display = 'flex';
    initAhorcado(raw || 'normal');
  }
  if (gameKey === 'wordle') {
    const gameEl = document.getElementById('wordleGame');
    if (gameEl) gameEl.style.display = 'flex';
    initWordle(raw);
  }
  if (gameKey === 'sopa') {
    const tId = raw && /^\d+$/.test(raw) ? Number(raw) : TEMATICA_MAP[theme] || 1;
    initSopa(tId);
  }
  if (gameKey === 'preguntados') {
    const tId = raw && /^\d+$/.test(raw) ? Number(raw) : TEMATICA_MAP[theme] || 1;
    initPreguntados(tId);
  }
  if (gameKey === 'termina') {
    const tId = raw && /^\d+$/.test(raw) ? Number(raw) : TEMATICA_MAP[theme] || 1;
    initTermina(tId);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   AHORCADO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// (Palabras borradas, ahora vienen del backend)

const PARTES_HANG = ['h-head', 'h-body', 'h-arm-l', 'h-arm-r', 'h-leg-l', 'h-leg-r'];

let ahorcadoState = {
  word: '',
  revealed: [],
  wrong: [],
  maxErrors: 6,
  finished: false,
  tematicaId: 'normal'
};

// â”€â”€â”€ Modo Duelo de Ahorcado â”€â”€â”€
// null si no hay un duelo en curso. Mientras estÃ© activo, guessLetter()
// no guarda puntaje normal ni suma logros: acumula puntos de cada una de
// las 5 palabras y al final manda el total a /api/duelos/:id/resultado.
let ahorcadoDuelo = null;

function iniciarAhorcadoDuelo(dueloId, tematicaId) {
  dueloActivo = { id: dueloId, juego: 'ahorcado' };
  // tematicaId llega en null cuando el reto se mandÃ³ con "Normal" (sin
  // temÃ¡tica), que es como se guarda tematica_id en la BD para ese caso.
  const tematicaDuelo = tematicaId ? tematicaId : 'normal';
  ahorcadoDuelo = { activo: true, dueloId, ronda: 0, totalRondas: 5, puntosTotal: 0, tematicaId: tematicaDuelo };
  goTo('ahorcado');
  const overlay = document.getElementById('ahorcadoStartOverlay');
  if (overlay) overlay.style.display = 'none';
  const gameEl = document.getElementById('ahorcadoGame');
  if (gameEl) gameEl.style.display = 'flex';
  siguienteRondaAhorcadoDuelo();
}

function siguienteRondaAhorcadoDuelo() {
  ahorcadoDuelo.ronda += 1;
  if (ahorcadoDuelo.ronda > ahorcadoDuelo.totalRondas) {
    const dueloId = ahorcadoDuelo.dueloId;
    const puntos = ahorcadoDuelo.puntosTotal;
    ahorcadoDuelo = null;
    finalizarDueloConPuntaje(dueloId, puntos);
    return;
  }
  initAhorcado(ahorcadoDuelo.tematicaId);
}

async function initAhorcado(tematicaId) {
  // Si no se pasa temÃ¡tica (ej. botÃ³n "Nueva palabra"), se reusa la Ãºltima usada
  tematicaId = tematicaId || ahorcadoState.tematicaId || 'normal';

  let word = 'cargando';
  try {
    const res = await fetch('/api/ahorcado/palabra?tematica=' + encodeURIComponent(tematicaId), { cache: 'no-store' });
    const data = await res.json();
    if (data.palabra) word = data.palabra.toLowerCase();
  } catch (e) {
    console.error(e);
  }

  if (word === 'cargando' || !word) {
    const sec = APP_EL.secAhorcado;
    if (sec) {
      sec.innerHTML = `
        <div class="game-screen-header">
          <button class="btn-back" onclick="goTo('juegos')">â† Volver a Juegos</button>
          <div class="game-screen-title"><span>${gameIconSVG('ahorcado', 22)}</span> Ahorcado</div>
          <div class="game-screen-theme">${TEMATICA_NAMES[tematicaId]||'Normal'}</div>
        </div>
        <div class="coming-soon-box" style="margin-top:2rem;">
          <h2>Sin palabras</h2>
          <p>AÃºn no hay palabras cargadas para esta temÃ¡tica. (RecordÃ¡ correr python crear_bd.py)</p>
          <button class="btn-play" style="margin-top:20px" onclick="goTo('juegos')">â† Volver a Juegos</button>
        </div>`;
    }
    return;
  }

  ahorcadoState = { word, revealed: [], wrong: [], maxErrors: 6, finished: false, tematicaId };

  // Reset SVG
  PARTES_HANG.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  renderAhorcadoWord();
  renderAhorcadoKeyboard();
  APP_EL.ahorcadoStatus.textContent = '';
  APP_EL.ahorcadoStatus.className = 'ahorcado-status';

  const labelEl = document.getElementById('ahorcado-theme-label');
  if (labelEl) {
    labelEl.textContent = (ahorcadoDuelo && ahorcadoDuelo.activo)
      ? `âš”ï¸ Duelo Â· Palabra ${ahorcadoDuelo.ronda}/${ahorcadoDuelo.totalRondas} Â· ${ahorcadoDuelo.puntosTotal} pts`
      : (TEMATICA_NAMES[tematicaId] || 'Normal');
  }
}

function renderAhorcadoWord() {
  const { word, revealed } = ahorcadoState;
  APP_EL.ahorcadoWord.innerHTML = word.split('').map(l => {
    const show = revealed.includes(l);
    return `<div class="letter-box">${show ? l.toUpperCase() : ''}</div>`;
  }).join('');
}

function renderAhorcadoKeyboard() {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  APP_EL.ahorcadoKeyboard.innerHTML = letters.map(l => {
    const isHit  = ahorcadoState.revealed.includes(l);
    const isMiss = ahorcadoState.wrong.includes(l);
    const cls    = isHit ? 'hit' : isMiss ? 'miss' : '';
    const dis    = (isHit || isMiss || ahorcadoState.finished) ? 'disabled' : '';
    return `<button class="key-btn ${cls}" ${dis} onclick="guessLetter('${l}')">${l.toUpperCase()}</button>`;
  }).join('');
}

function guessLetter(letter) {
  if (ahorcadoState.finished) return;
  const { word } = ahorcadoState;

  if (word.includes(letter)) {
    ahorcadoState.revealed.push(letter);
  } else {
    ahorcadoState.wrong.push(letter);
    const parte = PARTES_HANG[ahorcadoState.wrong.length - 1];
    if (parte) {
      const el = document.getElementById(parte);
      if (el) el.style.display = 'block';
    }
  }

  const won  = word.split('').every(l => ahorcadoState.revealed.includes(l));
  const lost = ahorcadoState.wrong.length >= ahorcadoState.maxErrors;

  if (won || lost) {
    ahorcadoState.finished = true;
    const statusEl = APP_EL.ahorcadoStatus;
    const tIdRaw = ahorcadoState.tematicaId;
    const tId = (tIdRaw && tIdRaw !== 'normal') ? Number(tIdRaw) : null;
    const enDuelo = ahorcadoDuelo && ahorcadoDuelo.activo;

    if (won) {
      statusEl.textContent = 'ðŸŽ‰ Â¡Ganaste! La palabra era: ' + word.toUpperCase();
      statusEl.className = 'ahorcado-status win';
      // Cada error resta puntos: la primera palabra sin errores vale 200,
      // y cada fallo descuenta 30 (piso de 20 puntos por palabra ganada).
      const puntosPalabra = enDuelo
        ? Math.max(20, 200 - (ahorcadoState.wrong.length * 30))
        : (1000 - (ahorcadoState.wrong.length * 150));
      if (enDuelo) {
        ahorcadoDuelo.puntosTotal += puntosPalabra;
      } else {
        guardarPuntaje(4, puntosPalabra, tId); // juego_id = 4 (Ahorcado)
        registrarProgresoJuego('ahorcado', {
          ahorcado_ganadas: 1,
          ahorcado_tematicas: [tIdRaw],
          ahorcado_racha: true,
          ahorcado_partidas: 1,
          ...(ahorcadoState.wrong.length === 0 ? { ahorcado_perfectas: 1 } : {}),
          ...(ahorcadoState.wrong.length <= 1 ? { ahorcado_casiPerfectas: 1 } : {})
        });
      }
    } else {
      // Revelar todas las letras al perder
      ahorcadoState.revealed = word.split('');
      statusEl.textContent = 'ðŸ’€ Â¡Perdiste! La palabra era: ' + word.toUpperCase();
      statusEl.className = 'ahorcado-status lose';
      if (typeof playDeathSound === 'function') playDeathSound();
      if (!enDuelo) {
        guardarPuntaje(4, 50, tId); // 50 puntos consuelo
        registrarProgresoJuego('ahorcado', { ahorcado_racha: false, ahorcado_partidas: 1 });
      }
      // En duelo, perder una palabra no suma puntos (pero tampoco resta).
    }

    if (enDuelo) {
      const labelEl = document.getElementById('ahorcado-theme-label');
      if (labelEl) labelEl.textContent = `âš”ï¸ Duelo Â· Palabra ${ahorcadoDuelo.ronda}/${ahorcadoDuelo.totalRondas} Â· ${ahorcadoDuelo.puntosTotal} pts`;
      // Pausa breve para que se alcance a leer la palabra, y pasa sola a
      // la siguiente (o cierra el duelo si era la Ãºltima de las 5).
      setTimeout(siguienteRondaAhorcadoDuelo, 1600);
    }
  }

  renderAhorcadoWord();
  renderAhorcadoKeyboard();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   ADIVINA LA PALABRA (estilo Wordle, hard, con temÃ¡tica)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const WORDLE_MAX_ATTEMPTS = 5;
const WORDLE_TEMATICAS = { 1: 'Videojuegos', 2: 'PelÃ­culas', 3: 'Anime', 4: 'ProgramaciÃ³n' };

// â”€â”€â”€ Modo Duelo de Adivina la Palabra â”€â”€â”€
// null si no hay un duelo en curso. Una sola palabra con la temÃ¡tica
// elegida al mandar el reto; al resolverla (ganada o perdida) se manda el
// puntaje directo a /api/duelos/:id/resultado en vez de guardar puntaje
// normal o sumar logros (igual criterio que ahorcadoDuelo).
let wordleDuelo = null;

function iniciarWordleDuelo(dueloId, tematicaId) {
  dueloActivo = { id: dueloId, juego: 'wordle' };
  wordleDuelo = { activo: true, dueloId };
  goTo('wordle');
  const overlay = document.getElementById('wordleStartOverlay');
  if (overlay) overlay.style.display = 'none';
  const gameEl = document.getElementById('wordleGame');
  if (gameEl) gameEl.style.display = 'flex';
  initWordle(tematicaId || 1);
}

let wordleState = {
  word: '',
  length: 0,
  tematicaId: 1,
  currentRow: 0,
  currentGuess: '',
  rows: [],       // cada fila terminada: { letters: [...], colors: [...] }
  keyColors: {},  // estado acumulado de cada letra del teclado: 'correct' | 'present' | 'absent'
  finished: false
};

function wordleKeydownHandler(e) {
  const sec = APP_EL.secWordle;
  if (!sec || !sec.classList.contains('active')) return;
  if (wordleState.finished) return;
  const key = e.key;
  if (key === 'Enter') { wordleSubmit(); return; }
  if (key === 'Backspace') { wordleBackspace(); return; }
  if (/^[a-zA-ZÃ±Ã‘]$/.test(key)) { wordleAddLetter(key.toLowerCase()); }
}

async function initWordle(tematicaId) {
  tematicaId = tematicaId && /^\d+$/.test(tematicaId) ? Number(tematicaId) : (wordleState.tematicaId || 1);

  let word = null;
  try {
    const res = await fetch('/api/wordle/palabra?tematica=' + encodeURIComponent(tematicaId), { cache: 'no-store' });
    const data = await res.json();
    if (data.palabra) word = data.palabra.toLowerCase();
  } catch (e) {
    console.error(e);
  }

  if (!word) {
    const sec = APP_EL.secWordle;
    if (sec) {
      sec.innerHTML = `
        <div class="game-screen-header">
          <button class="btn-back" onclick="goTo('juegos')">â† Volver a Juegos</button>
          <div class="game-screen-title"><span>${gameIconSVG('wordle', 22)}</span> Adivina la Palabra</div>
          <div class="game-screen-theme">${TEMATICA_NAMES[tematicaId]||''}</div>
        </div>
        <div class="coming-soon-box" style="margin-top:2rem;">
          <h2>Sin palabras</h2>
          <p>AÃºn no hay palabras cargadas para esta temÃ¡tica. (RecordÃ¡ correr python crear_bd.py)</p>
          <button class="btn-play" style="margin-top:20px" onclick="goTo('juegos')">â† Volver a Juegos</button>
        </div>`;
    }
    return;
  }

  wordleState = {
    word,
    length: word.length,
    tematicaId,
    currentRow: 0,
    currentGuess: '',
    rows: [],
    keyColors: {},
    finished: false
  };

  const labelEl = APP_EL.wordleThemeLabel;
  if (labelEl) {
    labelEl.textContent = (wordleDuelo && wordleDuelo.activo)
      ? `âš”ï¸ Duelo Â· ${WORDLE_TEMATICAS[tematicaId] || ''}`
      : (WORDLE_TEMATICAS[tematicaId] || '');
  }

  APP_EL.wordleHint.textContent =
    word === 'error'
      ? 'No se pudo cargar la palabra. ProbÃ¡ de nuevo.'
      : `La palabra tiene ${word.length} letras. TenÃ©s ${WORDLE_MAX_ATTEMPTS} intentos.`;
  APP_EL.wordleStatus.textContent = '';
  APP_EL.wordleStatus.className = 'wordle-status';

  renderWordleBoard();
  renderWordleKeyboard();

  document.removeEventListener('keydown', wordleKeydownHandler);
  document.addEventListener('keydown', wordleKeydownHandler);
}

function stopWordle() {
  document.removeEventListener('keydown', wordleKeydownHandler);
}

function renderWordleBoard() {
  const { length, rows, currentRow, currentGuess } = wordleState;
  let html = '';

  for (let r = 0; r < WORDLE_MAX_ATTEMPTS; r++) {
    html += '<div class="wordle-row">';
    for (let c = 0; c < length; c++) {
      let letter = '';
      let cls = 'wordle-tile';

      if (r < rows.length) {
        // Fila ya confirmada: mostrar letra + color
        letter = rows[r].letters[c];
        cls += ' ' + rows[r].colors[c];
      } else if (r === currentRow) {
        // Fila en curso: mostrar letras que se van tipeando
        letter = currentGuess[c] || '';
        if (letter) cls += ' filled';
      }

      html += `<div class="${cls}">${letter ? letter.toUpperCase() : ''}</div>`;
    }
    html += '</div>';
  }

  APP_EL.wordleBoard.innerHTML = html;
}

function renderWordleKeyboard() {
  const letters = 'qwertyuiopasdfghjklzxcvbnm'.split('');
  const { keyColors, finished } = wordleState;
  APP_EL.wordleKeyboard.innerHTML = letters.map(l => {
    const state = keyColors[l];
    const cls = state ? ' ' + state : '';
    const dis = finished ? 'disabled' : '';
    return `<button class="key-btn${cls}" ${dis} onclick="wordleAddLetter('${l}')">${l.toUpperCase()}</button>`;
  }).join('');
}

function wordleAddLetter(letter) {
  if (wordleState.finished) return;
  if (wordleState.currentGuess.length >= wordleState.length) return;
  wordleState.currentGuess += letter;
  renderWordleBoard();
}

function wordleBackspace() {
  if (wordleState.finished) return;
  wordleState.currentGuess = wordleState.currentGuess.slice(0, -1);
  renderWordleBoard();
}

function wordleSubmit() {
  if (wordleState.finished) return;
  const { word, length, currentGuess } = wordleState;
  const statusEl = APP_EL.wordleStatus;

  if (currentGuess.length < length) {
    statusEl.textContent = `CompletÃ¡ la palabra (${length} letras).`;
    statusEl.className = 'wordle-status warn';
    return;
  }

  // â”€â”€ Algoritmo de colores estilo Wordle (maneja letras repetidas) â”€â”€
  const guessLetters = currentGuess.split('');
  const wordLetters = word.split('');
  const colors = new Array(length).fill('absent');
  const remaining = {};

  wordLetters.forEach(l => { remaining[l] = (remaining[l] || 0) + 1; });

  // 1Â° pasada: verdes (posiciÃ³n exacta)
  for (let i = 0; i < length; i++) {
    if (guessLetters[i] === wordLetters[i]) {
      colors[i] = 'correct';
      remaining[guessLetters[i]]--;
    }
  }
  // 2Â° pasada: amarillos (la letra estÃ¡, en otro lugar)
  for (let i = 0; i < length; i++) {
    if (colors[i] === 'correct') continue;
    const l = guessLetters[i];
    if (remaining[l] > 0) {
      colors[i] = 'present';
      remaining[l]--;
    }
  }

  // Actualizar estado acumulado del teclado (sin "degradar" una letra ya verde)
  const priority = { absent: 0, present: 1, correct: 2 };
  guessLetters.forEach((l, i) => {
    const prev = wordleState.keyColors[l];
    if (!prev || priority[colors[i]] > priority[prev]) {
      wordleState.keyColors[l] = colors[i];
    }
  });

  wordleState.rows.push({ letters: guessLetters, colors });
  wordleState.currentRow++;

  const won = currentGuess === word;
  const lost = !won && wordleState.currentRow >= WORDLE_MAX_ATTEMPTS;
  const tId = wordleState.tematicaId;
  const enDuelo = wordleDuelo && wordleDuelo.activo;

  if (won) {
    wordleState.finished = true;
    statusEl.textContent = 'ðŸŽ‰ Â¡La adivinaste! Era: ' + word.toUpperCase();
    statusEl.className = 'wordle-status win';
    const intentosUsados = wordleState.currentRow;
    const puntos = Math.max(1500 - (intentosUsados - 1) * 250, 250);
    if (enDuelo) {
      const dueloId = wordleDuelo.dueloId;
      wordleDuelo = null;
      setTimeout(() => finalizarDueloConPuntaje(dueloId, puntos), 1200);
    } else {
      guardarPuntaje(6, puntos, tId); // juego_id = 6 (Adivina la Palabra)
      registrarProgresoJuego('wordle', {
        wordle_ganadas: 1,
        wordle_racha: true,
        wordle_tematicas: [tId],
        ...(intentosUsados === 1 ? { wordle_1intento: 1 } : {}),
        ...(intentosUsados <= 2 ? { wordle_eficientes: 1 } : {}),
        ...(word.length >= 8 ? { wordle_palabraLarga: 1 } : {})
      });
    }
  } else if (lost) {
    wordleState.finished = true;
    statusEl.textContent = 'ðŸ’€ Â¡Se acabaron los intentos! Era: ' + word.toUpperCase();
    statusEl.className = 'wordle-status lose';
    if (enDuelo) {
      const dueloId = wordleDuelo.dueloId;
      wordleDuelo = null;
      setTimeout(() => finalizarDueloConPuntaje(dueloId, 50), 1200); // 50 puntos consuelo, igual que fuera de duelo
    } else {
      guardarPuntaje(6, 50, tId); // puntos consuelo
      registrarProgresoJuego('wordle', { wordle_racha: false, wordle_tematicas: [tId] });
    }
  } else {
    statusEl.textContent = '';
  }

  wordleState.currentGuess = '';
  renderWordleBoard();
  renderWordleKeyboard();
}

// â”€â”€â”€ InicializaciÃ³n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.addEventListener('DOMContentLoaded', () => {
  // AÃ±o dinÃ¡mico en el footer
  APP_EL.year.textContent = new Date().getFullYear();

  // Restaurar sesiÃ³n desde localStorage
  try {
    const savedUser = localStorage.getItem('unigames_user');
    const savedToken = localStorage.getItem('unigames_token');
    if (savedUser && savedToken) {
      currentUser = JSON.parse(savedUser);
      sincronizarLogrosConBackend();
    }
  } catch (e) {
    localStorage.removeItem('unigames_user');
    localStorage.removeItem('unigames_token');
  }
  // Se llama siempre (haya o no sesiÃ³n guardada): si no hay currentUser,
  // esto es lo que pinta el botÃ³n de "Iniciar sesiÃ³n" en el menÃº lateral.
  // Antes solo se llamaba dentro del if de arriba, por eso en una visita
  // nueva (sin nada en localStorage) el panel quedaba vacÃ­o.
  updateAuthUI();

  const params = new URLSearchParams(window.location.search);
  const dToken = params.get('dev_token');
  const dUserStr = params.get('dev_user');
  const openAdmin = params.get('open_admin');
  
  if (dToken && dUserStr) {
    try {
      const u = JSON.parse(decodeURIComponent(dUserStr));
      localStorage.setItem('unigames_token', dToken);
      localStorage.setItem('unigames_user', JSON.stringify(u));
      currentUser = u;
      updateAuthUI();
      
      // Remove params from URL to clean it up
      window.history.replaceState({}, document.title, "/");
      
      // Open admin modal if requested
      if (openAdmin === 'true') {
          setTimeout(() => { openAdminModal(); }, 500);
      }
    } catch(e) {}
  }

  // Guardar HTML original de secciones de juego (antes de que se modifiquen)
  saveOriginalSections();

  // Juegos destacados aleatorios + secciones del inicio
  renderFeatured();
  renderSimple();
  renderAction();

  // Evitar recarga en links del menÃº
  document.querySelectorAll('.nav-menu a').forEach(a => {
    a.addEventListener('click', e => e.preventDefault());
  });

  // Inicializar audio al cargar la pÃ¡gina
  initAudio();

  // Cargar tabla de posiciones desde la API
  fetchLeaderboard();
});

// --- ConfiguraciÃ³n de Supabase ---
let supabaseClient = null;
fetch('/api/config')
  .then(res => res.json())
  .then(async data => {
    if (data.SUPABASE_URL && data.SUPABASE_ANON_KEY && typeof supabase !== 'undefined') {
      supabaseClient = supabase.createClient(data.SUPABASE_URL, data.SUPABASE_ANON_KEY);
      
      // Check for OAuth, Password Reset, or pending un-synced sessions
      const { data: sessionData } = await supabaseClient.auth.getSession();
      
      // If we are logged into Supabase, but our local app doesn't have the token (e.g. Google Login, or returning from Email verification)
      if (sessionData.session && !localStorage.getItem('unigames_token')) {
          const res = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ supabaseToken: sessionData.session.access_token })
          });
          const backendData = await res.json();
          if (res.ok) {
            currentUser = backendData.user;
            localStorage.setItem('unigames_token', backendData.token);
            localStorage.setItem('unigames_user', JSON.stringify(currentUser));
            if (window.location.href.includes('google_login=true') || window.location.href.includes('type=signup')) {
              window.history.replaceState({}, document.title, "/"); 
            }
            updateAuthUI();
            sincronizarLogrosConBackend();
            showAuthAlert('login-alert', 'Â¡SesiÃ³n sincronizada exitosamente!', 'success');
          } else {
             // If sync failed for some reason, sign out to prevent broken state
             supabaseClient.auth.signOut();
          }
      }
      
      // If we just clicked a password reset link
      if (window.location.href.includes('reset_password=true') && sessionData.session) {
          const newPassword = prompt("IngresÃ¡ tu nueva contraseÃ±a:");
          if (newPassword) {
              const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
              if (!error) {
                  alert("Â¡ContraseÃ±a actualizada exitosamente! Ya podÃ©s iniciar sesiÃ³n.");
                  supabaseClient.auth.signOut();
                  window.history.replaceState({}, document.title, "/"); 
              } else {
                  alert("Hubo un error al actualizar: " + error.message);
              }
          }
      }
    }
  })
  .catch(err => console.error("Error cargando config de supabase:", err));


// â”€â”€â”€ LÃ³gica de API (Backend) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function handleLogin(e) {
  e.preventDefault();
  const identity = APP_EL.loginIdentity.value.trim();
  const password = APP_EL.loginPassword.value;

  if (!identity || !password) {
    return showAuthAlert('login-alert', 'CompletÃ¡ todos los campos.', 'error');
  }
  if (!supabaseClient) return showAuthAlert('login-alert', 'El sistema de seguridad estÃ¡ cargando...', 'error');

  try {
    // 1. Iniciar sesiÃ³n con Supabase Auth (requiere Email, no usuario)
    const { data: supaData, error: supaError } = await supabaseClient.auth.signInWithPassword({
      email: identity,
      password: password
    });

    if (supaError) {
      return showAuthAlert('login-alert', 'Correo o contraseÃ±a incorrectos.', 'error');
    }

    // 2. Sincronizar con nuestro backend para obtener el Token local y el ID
    const res = await fetch('/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supabaseToken: supaData.session.access_token })
    });
    const data = await res.json();

    if (res.ok) {
      currentUser = data.user;
      localStorage.setItem('unigames_token', data.token);
      localStorage.setItem('unigames_user', JSON.stringify(currentUser));
      showAuthAlert('login-alert', 'Â¡Bienvenido, ' + sanitizeHTML(data.user.username) + '!', 'success');
      updateAuthUI();
      sincronizarLogrosConBackend();
      setTimeout(closeModal, 900);
    } else {
      showAuthAlert('login-alert', data.error || 'Error al sincronizar sesiÃ³n.', 'error');
    }
  } catch (err) {
    console.error(err);
    showAuthAlert('login-alert', 'No se pudo conectar con el servidor.', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = APP_EL.regUsername.value.trim();
  const email = APP_EL.regEmail.value.trim();
  const password = APP_EL.regPassword.value;
  const confirm = APP_EL.regConfirm.value;

  if (!username || !email || !password || !confirm) {
    return showAuthAlert('register-alert', 'CompletÃ¡ todos los campos.', 'error');
  }

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_REGEX.test(email)) {
    return showAuthAlert('register-alert', 'IngresÃ¡ un email vÃ¡lido (ej: nombre@dominio.com).', 'error');
  }

  if (password !== confirm) {
    return showAuthAlert('register-alert', 'Las contraseÃ±as no coinciden.', 'error');
  }

  if (!supabaseClient) return showAuthAlert('register-alert', 'El sistema de seguridad estÃ¡ cargando...', 'error');

  try {
    // 1. Crear usuario en Supabase Auth
    const { data: supaData, error: supaError } = await supabaseClient.auth.signUp({
      email: email,
      password: password
    });

    if (supaError) {
      return showAuthAlert('register-alert', supaError.message, 'error');
    }

    if (!supaData.session) {
      return showAuthAlert('register-alert', 'Por favor, revisa tu correo electrÃ³nico para confirmar tu cuenta.', 'success');
    }

    // 2. Sincronizar con backend
    const res = await fetch('/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        supabaseToken: supaData.session.access_token,
        username: username 
      })
    });
    const data = await res.json();

    if (res.ok) {
      currentUser = data.user;
      localStorage.setItem('unigames_token', data.token);
      localStorage.setItem('unigames_user', JSON.stringify(currentUser));
      showAuthAlert('register-alert', 'Â¡Cuenta creada exitosamente! SesiÃ³n iniciada.', 'success');
      updateAuthUI();
      sincronizarLogrosConBackend();
      setTimeout(closeModal, 1200);
    } else {
      showAuthAlert('register-alert', data.error || 'Error al completar el registro.', 'error');
    }
  } catch (err) {
    console.error(err);
    showAuthAlert('register-alert', 'No se pudo conectar con el servidor.', 'error');
  }
}

async function handleGoogleLogin() {
  if (!supabaseClient) return showAuthAlert('login-alert', 'Error de conexión con seguridad. Verifica que supabase este configurado.', 'error');
  
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/?google_login=true'
    }
  });
  
  if (error) {
    console.error('Error con Google Login:', error);
    showAuthAlert('login-alert', 'No se pudo iniciar con Google.', 'error');
  }
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const identity = APP_EL.loginIdentity.value.trim();
  
  if (!identity) {
    return showAuthAlert('login-alert', 'Por favor escribe tu email en el campo de arriba primero.', 'error');
  }
  
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_REGEX.test(identity)) {
    return showAuthAlert('login-alert', 'IngresÃ¡ un email vÃ¡lido para recuperar la contraseÃ±a.', 'error');
  }

  if (!supabaseClient) return showAuthAlert('login-alert', 'Error de conexión con seguridad. Verifica que supabase este configurado.', 'error');

  const { data, error } = await supabaseClient.auth.resetPasswordForEmail(identity, {
    redirectTo: window.location.origin + '/?reset_password=true'
  });

  if (error) {
    return showAuthAlert('login-alert', 'Error al enviar el correo.', 'error');
  }

  showAuthAlert('login-alert', 'Â¡Te hemos enviado un correo con las instrucciones!', 'success');
}


  function updateAuthUI() {
    const drawerBody = APP_EL.accountDrawerBody;
    if (!drawerBody) return;

    if (currentUser) {
      drawerBody.innerHTML = `
        <div class="account-greeting">Hola, ${sanitizeHTML(currentUser.username)}</div>
        ${currentUser.rol === 'admin' ? '<button class="account-drawer-btn" onclick="closeAccountDrawer(); openAdminModal();"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>Panel Admin</button>' : ''}
        <button class="account-drawer-btn" onclick="closeAccountDrawer(); abrirPerfilPropio();"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>Perfil</button>
        <button class="account-drawer-btn" onclick="closeAccountDrawer(); openNotifModal();" style="justify-content: space-between;"><span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>Notificaciones</span><span id="notifDrawerBadge"></span></button>
        <button class="account-drawer-btn" onclick="closeAccountDrawer(); goTo('puntuacion');"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>PuntuaciÃ³n</button>
        <button class="account-drawer-btn" onclick="closeAccountDrawer(); goTo('amigos');"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>Amigos</button>
        <button class="account-drawer-btn" onclick="closeAccountDrawer(); goTo('logros');"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>Logros</button>
        <button class="account-drawer-btn btn-logout" onclick="logout()"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>Cerrar sesiÃ³n</button>
      `;
      actualizarBadgeNotificaciones();
    } else {
      drawerBody.innerHTML = `
        <button class="account-drawer-btn btn-login-drawer" onclick="closeAccountDrawer(); openModal('login');">Iniciar sesiÃ³n</button>
      `;
    }
  }

function logout() {
  if (supabaseClient) {
    supabaseClient.auth.signOut();
  }
  currentUser = null;
  localStorage.removeItem('unigames_token');
  localStorage.removeItem('unigames_user');
  updateAuthUI();
}

// â”€â”€â”€ Leaderboard con tabs por juego â”€â”€â”€â”€

let lbCurrentTab = 'all';

async function fetchLeaderboard() {
  if (lbCurrentTab === 'all') {
    await fetchLeaderboardGlobal();
  } else {
    await fetchLeaderboardByGame(lbCurrentTab);
  }
}

function switchLeaderboardTab(btn, juegoId) {
  document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  lbCurrentTab = juegoId;

  const panelAll    = APP_EL.lbPanelAll;
  const panelSingle = APP_EL.lbPanelSingle;

  if (juegoId === 'all') {
    panelAll.classList.add('active');    panelAll.style.display = '';
    panelSingle.classList.remove('active'); panelSingle.style.display = 'none';
    fetchLeaderboardGlobal();
  } else {
    panelAll.classList.remove('active'); panelAll.style.display = 'none';
    panelSingle.classList.add('active'); panelSingle.style.display = '';
    fetchLeaderboardByGame(juegoId);
  }
}

async function fetchLeaderboardGlobal() {
  const container = APP_EL.lbGlobalGrids;
  if (!container) return;
  try {
    const res = await fetch('/api/leaderboard/global');
    if (!res.ok) throw new Error();
    const data = await res.json(); // { juego_id: { juego, entries: [{jugador, puntos}] } }

    const GAME_ID_MAP = { 1:'sopa', 2:'preguntados', 3:'termina', 4:'ahorcado', 5:'adivina', 6:'wordle', 7:'runner', 8:'castle_escape' };
    const keys = Object.keys(data);

    if (keys.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#64748b;padding:2rem;">TodavÃ­a no hay puntuaciones. Â¡JugÃ¡ y aparecÃ© acÃ¡!</p>';
      return;
    }

    container.innerHTML = keys.map(jid => {
      const g = data[jid];
      const rowsHTML = g.entries.map((e, i) => {
        const medals = ['<svg style="width:1.2rem;height:1.2rem;fill:#ffd700;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>','<svg style="width:1.2rem;height:1.2rem;fill:#c0c0c0;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>','<svg style="width:1.2rem;height:1.2rem;fill:#cd7f32;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>'];
        const medal  = medals[i] || (i + 1);
        const cls    = i < 3 ? `rank-${i+1}` : '';
        return `<tr>
          <td class="${cls}">${medal} ${i >= 3 ? i+1 : ''}</td>
          <td><span class="lb-player-name" onclick="verPerfilPorUsername('${sanitizeHTML(e.jugador)}')">${sanitizeHTML(e.jugador)}</span></td>
          <td><span class="score-badge">${sanitizeHTML(String(e.puntos))}</span></td>
        </tr>`;
      }).join('');

      return `
        <div class="lb-game-card">
          <div class="lb-game-title">${gameIconSVG(GAME_ID_MAP[jid], 16)} ${sanitizeHTML(g.juego)}</div>
          <table class="lb-mini-table">
            <thead><tr><th>#</th><th>Jugador</th><th>Puntos</th></tr></thead>
            <tbody>${rowsHTML || '<tr><td colspan="3" style="text-align:center;color:#94a3b8;font-size:.8rem;">Sin partidas aÃºn</td></tr>'}</tbody>
          </table>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('Error leaderboard global', err);
    if (container) container.innerHTML = '<p style="text-align:center;color:#64748b;padding:2rem;">No se pudo cargar. Â¿El servidor estÃ¡ corriendo?</p>';
  }
}

async function fetchLeaderboardByGame(juegoId) {
  const tbody = APP_EL.leaderboardBody;
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b;">Cargando...</td></tr>';
  try {
    const url = juegoId === 'runner'
      ? '/api/leaderboard?juego_id=7'   // Pixel Runner = juego_id 7
      : `/api/leaderboard?juego_id=${juegoId}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error();
    const scores = await res.json();

    if (scores.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b;padding:1.5rem;">Nadie jugÃ³ esto todavÃ­a. Â¡SÃ© el primero!</td></tr>';
      return;
    }

    tbody.innerHTML = scores.map((s, i) => {
      const medals = ['<svg style="width:1.2rem;height:1.2rem;fill:#ffd700;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>','<svg style="width:1.2rem;height:1.2rem;fill:#c0c0c0;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>','<svg style="width:1.2rem;height:1.2rem;fill:#cd7f32;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>'];
      const medal  = medals[i] || (i + 1);
      const cls    = i < 3 ? `rank-${i+1}` : '';
      return `<tr>
        <td class="${cls}">${medal} ${i >= 3 ? i+1 : ''}</td>
        <td><span class="lb-player-name" onclick="verPerfilPorUsername('${sanitizeHTML(s.jugador)}')">${sanitizeHTML(s.jugador)}</span></td>
        <td><span class="score-badge">${sanitizeHTML(String(s.puntos))}</span></td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('Error leaderboard by game', err);
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#e53e3e;">Error al cargar</td></tr>';
  }
}

async function guardarPuntaje(juego_id, puntos, tematica_id) {
  if (!currentUser) return; // Solo guarda si hay sesiÃ³n iniciada
  try {
    const token = localStorage.getItem('unigames_token');
    await fetch('/api/partidas', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        juego_id: juego_id,
        tematica_id: tematica_id || null,
        puntos: puntos
      })
    });
    fetchLeaderboard(); // Refrescar la tabla
  } catch (err) {
    console.error('Error guardando puntos', err);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   PREGUNTADOS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const PREGUNTADOS_TOTAL = 10;
const PREGUNTADOS_TIME  = 15; // segundos por pregunta

const TEMATICA_NAMES = { 1: 'Videojuegos', 2: 'PelÃ­culas', 3: 'Anime', 4: 'ProgramaciÃ³n' };
const TEMATICA_MAP   = { 'Videojuegos': 1, 'PelÃ­culas': 2, 'Anime': 3, 'ProgramaciÃ³n': 4 };

let pregState = {
  preguntas: [], idx: 0, score: 0,
  timer: null, timeLeft: 0,
  tematicaId: 1, finished: false
};

// â”€â”€â”€ Modo Duelo de Preguntados â”€â”€â”€
// null si no hay un duelo en curso. Una sola ronda completa (mismas
// preguntas que en modo libre) con la temÃ¡tica elegida al mandar el
// reto; al terminar se manda el puntaje directo a
// /api/duelos/:id/resultado en vez de guardar puntaje normal o sumar
// logros (igual criterio que ahorcadoDuelo/wordleDuelo).
let pregDuelo = null;

function iniciarPreguntadosDuelo(dueloId, tematicaId) {
  dueloActivo = { id: dueloId, juego: 'preguntados' };
  pregDuelo = { activo: true, dueloId };
  goTo('preguntados');
  const overlay = document.getElementById('preguntadosStartOverlay');
  if (overlay) overlay.style.display = 'none';
  initPreguntados(tematicaId || 1);
}

async function initPreguntados(tematicaId) {
  tematicaId = tematicaId || pregState.tematicaId || 1;
  pregState.tematicaId = tematicaId;
  clearInterval(pregState.timer);

  let preguntas = [];
  try {
    const res  = await fetch('/api/preguntas?tematica_id=' + tematicaId);
    const raw  = await res.json();
    // Deduplicar por texto de pregunta (la BD puede tener filas repetidas con distintos ids)
    const seen = new Set();
    preguntas = shuffle(raw).filter(p => {
      if (seen.has(p.pregunta)) return false;
      seen.add(p.pregunta);
      return true;
    });
  } catch(e) { console.error(e); }

  pregState = { preguntas, idx: 0, score: 0, timer: null, timeLeft: PREGUNTADOS_TIME, tematicaId, finished: false };
  APP_EL.preguntadosThemeLabel.textContent = temaLabelConDuelo(pregDuelo && pregDuelo.activo, tematicaId);
  renderPreguntados();
}

// Arma el texto del "theme label" de cada minijuego clÃ¡sico, agregando
// el prefijo "âš”ï¸ Duelo Â·" cuando la partida es un duelo 1v1 (mismo
// criterio visual que ya usaban Ahorcado y Adivina la Palabra).
function temaLabelConDuelo(esDuelo, tematicaId) {
  const base = TEMATICA_NAMES[tematicaId] || '';
  return esDuelo ? `âš”ï¸ Duelo Â· ${base}` : base;
}

function renderPreguntados() {
  const sec = APP_EL.secPreguntados;
  const { preguntas, idx, score, finished } = pregState;

  if (preguntas.length === 0) {
    sec.innerHTML = `
      <div class="game-screen-header">
        <button class="btn-back" onclick="goTo('juegos')">â† Volver a Juegos</button>
        <div class="game-screen-title"><span>${gameIconSVG('preguntados', 22)}</span> Preguntados</div>
        <div class="game-screen-theme">${temaLabelConDuelo(pregDuelo && pregDuelo.activo, pregState.tematicaId)}</div>
      </div>
      <div class="coming-soon-box" style="margin-top:2rem;">
        <h2>Sin preguntas</h2>
        <p>AÃºn no hay preguntas cargadas para esta temÃ¡tica. (RecordÃ¡ correr python crear_bd.py)</p>
        <button class="btn-play" style="margin-top:20px" onclick="goTo('juegos')">â† Volver a Juegos</button>
      </div>`;
    // Si es un duelo y la temÃ¡tica no tiene preguntas cargadas, no lo
    // dejamos colgado: reportamos 0 puntos para que el duelo se pueda
    // resolver igual (mismo criterio de "no romper el duelo" que el resto).
    if (pregDuelo && pregDuelo.activo) {
      const dueloId = pregDuelo.dueloId;
      pregDuelo = null;
      finalizarDueloConPuntaje(dueloId, 0);
    }
    return;
  }

  if (finished || idx >= preguntas.length) {
    const puntos = score * 150;

    // En duelo: no se guarda puntaje normal ni logros, el puntaje va
    // directo al duelo (mismo criterio que ahorcadoDuelo/sopaDuelo).
    if (pregDuelo && pregDuelo.activo) {
      const dueloId = pregDuelo.dueloId;
      pregDuelo = null;
      finalizarDueloConPuntaje(dueloId, puntos);
      return;
    }

    sec.querySelector('.coming-soon-box')?.remove();
    guardarPuntaje(2, puntos, pregState.tematicaId);
    registrarProgresoJuego('preguntados', {
      preg_completadas: 1,
      preg_tematicas: [pregState.tematicaId],
      ...(score >= preguntas.length ? { preg_perfectas: 1 } : {})
    });
    sec.innerHTML = `
      <div class="game-screen-header">
        <button class="btn-back" onclick="goTo('juegos')">â† Volver a Juegos</button>
        <div class="game-screen-title"><span>${gameIconSVG('preguntados', 22)}</span> Preguntados</div>
        <div class="game-screen-theme" id="preguntados-theme-label">${TEMATICA_NAMES[pregState.tematicaId]||''}</div>
      </div>
      <div class="preg-result">
        <div class="preg-result-emoji">${score >= preguntas.length * 0.7 ? 'ðŸ†' : score >= preguntas.length * 0.4 ? 'ðŸ˜Š' : 'ðŸ˜…'}</div>
        <p class="preg-result-title">${score >= preguntas.length * 0.7 ? 'Â¡Excelente!' : score >= preguntas.length * 0.4 ? 'Â¡Bien hecho!' : 'Â¡SeguÃ­ practicando!'}</p>
        <p class="preg-result-score">${score} / ${preguntas.length} correctas</p>
        <p class="preg-result-pts">+${puntos} puntos</p>
        <button class="btn-play" style="max-width:240px;margin:0 auto;" onclick="initPreguntados(${pregState.tematicaId})"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>Jugar de nuevo</button>
        <button class="btn-back" style="margin:0 auto;" onclick="goTo('juegos')">â† Volver a Juegos</button>
      </div>`;
    return;
  }


  const q   = preguntas[idx];
  const opts = ['A', 'B', 'C', 'D'];
  const texts = [q.opcion_a, q.opcion_b, q.opcion_c, q.opcion_d];

  sec.innerHTML = `
    <div class="game-screen-header">
      <button class="btn-back" onclick="clearInterval(pregState.timer); goTo('juegos')">â† Volver a Juegos</button>
      <div class="game-screen-title"><span>${gameIconSVG('preguntados', 22)}</span> Preguntados</div>
      <div class="game-screen-theme" id="preguntados-theme-label">${temaLabelConDuelo(pregDuelo && pregDuelo.activo, pregState.tematicaId)}</div>
    </div>
    <div class="preg-wrap">
      <div class="preg-topbar">
        <span class="preg-counter">Pregunta ${idx+1} / ${preguntas.length}</span>
        <span class="preg-score"><svg style="width:1rem;height:1rem;fill:gold;vertical-align:middle;margin-right:2px;" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> ${score}</span>
        <div class="preg-timer-bar"><div class="preg-timer-fill" id="pregTimerFill"></div></div>
        <span class="preg-time" id="pregTimeText">${pregState.timeLeft}s</span>
      </div>
      <div class="preg-question">${q.pregunta}</div>
      <div class="preg-options">
        ${opts.map((opt, i) => `
          <button class="preg-opt" data-opt="${opt}" onclick="answerPreguntados('${opt}', '${q.respuesta_correcta}')">
            <span class="preg-opt-label">${opt}</span>
            <span>${texts[i]}</span>
          </button>
        `).join('')}
      </div>
    </div>`;

  startPregTimer();
}

function startPregTimer() {
  clearInterval(pregState.timer);
  pregState.timeLeft = PREGUNTADOS_TIME;
  const fill = () => {
    const f = document.getElementById('pregTimerFill');
    const t = document.getElementById('pregTimeText');
    if (f) f.style.width = (pregState.timeLeft / PREGUNTADOS_TIME * 100) + '%';
    if (t) t.textContent = pregState.timeLeft + 's';
    if (pregState.timeLeft <= 5 && f) f.style.background = '#e53e3e';
    if (pregState.timeLeft <= 0) {
      clearInterval(pregState.timer);
      flashPregAnswer(null, pregState.preguntas[pregState.idx]?.respuesta_correcta);
      actualizarProgresoParcial('preguntados', { preg_racha: false });
      setTimeout(() => { pregState.idx++; renderPreguntados(); }, 1200);
      return;
    }
    pregState.timeLeft--;
  };
  fill();
  pregState.timer = setInterval(fill, 1000);
}

function answerPreguntados(chosen, correct) {
  clearInterval(pregState.timer);
  const isCorrect = chosen === correct;
  if (isCorrect) pregState.score++;
  actualizarProgresoParcial('preguntados', {
    preg_racha: isCorrect,
    ...(isCorrect ? { preg_correctas: 1 } : {}),
    ...(isCorrect && pregState.timeLeft >= PREGUNTADOS_TIME - 1 ? { preg_veloz: 1 } : {})
  });
  flashPregAnswer(chosen, correct);
  setTimeout(() => { pregState.idx++; renderPreguntados(); }, 1100);
}

function flashPregAnswer(chosen, correct) {
  document.querySelectorAll('.preg-opt').forEach(btn => {
    const o = btn.dataset.opt;
    btn.disabled = true;
    if (o === correct) btn.classList.add('correct');
    else if (o === chosen && chosen !== correct) btn.classList.add('wrong');
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   SOPA DE LETRAS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const SOPA_GRID = 12; // 12x12
const SOPA_TIME = 120; // 2 minutos

let sopaState = {
  words: [], grid: [], placed: [], found: [],
  selected: [], dragging: false,
  timer: null, timeLeft: SOPA_TIME,
  score: 0, tematicaId: 1, finished: false,
  erroresSeleccion: 0
};
let sopaFinishTimeout = null;

// â”€â”€â”€ Modo Duelo de Sopa de Letras â”€â”€â”€
// null si no hay un duelo en curso. Un solo intento con la temÃ¡tica y
// duraciÃ³n elegidas al mandar el reto; al terminar (por completarla o por
// tiempo) se manda el puntaje directo a /api/duelos/:id/resultado, sin
// guardar puntaje normal ni sumar logros (igual criterio que ahorcadoDuelo).
let sopaDuelo = null;

function iniciarSopaDuelo(dueloId, tematicaId, duracionSegundos) {
  dueloActivo = { id: dueloId, juego: 'sopa' };
  sopaDuelo = { activo: true, dueloId };
  goTo('sopa');
  const overlay = document.getElementById('sopaStartOverlay');
  if (overlay) overlay.style.display = 'none';
  initSopa(tematicaId || 1, duracionSegundos || SOPA_TIME);
}

// Palabras hardcodeadas por temÃ¡tica â€” quedan como FALLBACK si falla el
// fetch a /api/sopa/palabras (o devuelve muy pocas), para que el juego no
// se rompa por un problema de red/server. La fuente real ahora es la BD
// (tabla palabras_ahorcado, la misma que ya usa Ahorcado).
const SOPA_WORDS = {
  1: ['POKEMON','MINECRAFT','VIDEOJUEGO','JOYSTICK','CONSOLA','NINTENDO','ZELDA','MARIO','ARCADE','GAMER'],
  2: ['PELICULA','CINEMA','DIRECTOR','ACTOR','GUION','ESCENA','TRAILER','DRAMA','COMEDIA','ESTRENO'],
  3: ['ANIME','NARUTO','MANGA','OTAKU','SHONEN','NINJA','SAMURAI','KAWAII','DRAGON','GOKU'],
  4: ['JAVASCRIPT','PYTHON','VARIABLE','FUNCION','SERVIDOR','EXPRESS','FRONTEND','BACKEND','REACT','GITHUB'],
};

async function initSopa(tematicaId, duracionSegundosDuelo) {
  tematicaId = Number(tematicaId) || sopaState.tematicaId || 1;
  // Fuera de duelo siempre se juega con el tiempo estÃ¡ndar (SOPA_TIME);
  // el parÃ¡metro de duraciÃ³n solo se usa cuando initSopa lo llama
  // iniciarSopaDuelo con la duraciÃ³n elegida al mandar el reto.
  const tiempoTotal = (sopaDuelo && sopaDuelo.activo && duracionSegundosDuelo) ? duracionSegundosDuelo : SOPA_TIME;
  clearInterval(sopaState.timer);
  if (sopaFinishTimeout) { clearTimeout(sopaFinishTimeout); sopaFinishTimeout = null; }

  const maxLargo = SOPA_GRID - 1;
  let palabras = [];
  try {
    const res = await fetch(
      `/api/sopa/palabras?tematica=${tematicaId}&cantidad=8&max_largo=${maxLargo}`,
      { cache: 'no-store' }
    );
    palabras = await res.json();
  } catch (e) { console.error(e); }

  // Si la API fallÃ³ o trajo menos de 4 palabras utilizables, se usa el
  // set hardcodeado como red de contenciÃ³n (mejor jugar con las palabras
  // viejas que dejar la sopa sin arrancar).
  if (!Array.isArray(palabras) || palabras.filter(w => w.length <= maxLargo).length < 4) {
    palabras = SOPA_WORDS[tematicaId] || SOPA_WORDS[1];
  }

  const candidatos = palabras.map(w => w.toUpperCase()).filter(w => w.length <= maxLargo);
  // Mezclar y tomar hasta 8 palabras
  const shuffled = [...candidatos].sort(() => Math.random() - 0.5).slice(0, 8);

  const { grid, placed } = buildSopaGrid(shuffled, SOPA_GRID);

  sopaState = {
    words: placed.map(p => p.word),
    grid, placed, found: [],
    selected: [], dragging: false,
    timer: null, timeLeft: tiempoTotal, tiempoTotal,
    score: 0, tematicaId, finished: false,
    erroresSeleccion: 0
  };

  APP_EL.sopaThemeLabel.textContent = (sopaDuelo && sopaDuelo.activo)
    ? `âš”ï¸ Duelo Â· ${TEMATICA_NAMES[tematicaId] || ''}`
    : (TEMATICA_NAMES[tematicaId] || '');
  renderSopa();
  startSopaTimer();
}

function buildSopaGrid(words, size) {
  const dirs = [
    [0,1],[1,0],[1,1],[0,-1],[-1,0],[-1,-1],[1,-1],[-1,1]
  ];
  const grid = Array.from({length: size}, () => Array(size).fill(''));
  const placed = [];

  for (const word of words) {
    let ok = false;
    for (let attempt = 0; attempt < 120 && !ok; attempt++) {
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);
      const cells = [];
      let valid = true;
      for (let i = 0; i < word.length; i++) {
        const r = row + dir[0] * i;
        const c = col + dir[1] * i;
        if (r < 0 || r >= size || c < 0 || c >= size) { valid = false; break; }
        if (grid[r][c] !== '' && grid[r][c] !== word[i]) { valid = false; break; }
        cells.push([r, c]);
      }
      if (valid) {
        cells.forEach(([r,c], i) => { grid[r][c] = word[i]; });
        placed.push({ word, cells });
        ok = true;
      }
    }
  }

  // Rellenar con letras aleatorias
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (!grid[r][c]) grid[r][c] = alpha[Math.floor(Math.random() * alpha.length)];

  return { grid, placed };
}

function renderSopa() {
  const sec = APP_EL.secSopa;
  const { grid, placed, found, timeLeft } = sopaState;
  const size = SOPA_GRID;

  const gridHTML = grid.map((row, r) =>
    row.map((cell, c) => {
      const isSel   = sopaState.selected.some(([sr,sc]) => sr===r && sc===c);
      const isFound = sopaState.found.some(w =>
        sopaState.placed.find(p => p.word === w)?.cells.some(([pr,pc]) => pr===r && pc===c)
      );
      return `<div class="sopa-cell${isSel?' sopa-sel':''}${isFound?' sopa-found':''}"
        data-r="${r}" data-c="${c}"
        onmousedown="sopaStart(${r},${c})"
        onmouseenter="sopaMove(${r},${c})"
        ontouchstart="sopaTouch(event,${r},${c})"
        ontouchmove="sopaTouchMove(event)"
      >${cell}</div>`;
    }).join('')
  ).join('');

  const wordsHTML = placed.map(p =>
    `<span class="sopa-word${found.includes(p.word)?' sopa-word-found':''}">${p.word}</span>`
  ).join('');

  sec.innerHTML = `
    <div class="game-screen-header">
      <button class="btn-back" onclick="clearInterval(sopaState.timer); goTo('juegos')">â† Volver a Juegos</button>
      <div class="game-screen-title"><span>${gameIconSVG('sopa', 22)}</span> Sopa de Letras</div>
      <div class="game-screen-theme" id="sopa-theme-label">${TEMATICA_NAMES[sopaState.tematicaId]||''}</div>
    </div>
    <div class="sopa-wrap">
      <div class="sopa-info">
        <span class="sopa-timer${timeLeft<=15?' sopa-timer-urgent':''}">â± ${timeLeft}s</span>
        <span class="sopa-score-disp"><svg style="width:1rem;height:1rem;fill:gold;vertical-align:middle;margin-right:2px;" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> ${sopaState.score}</span>
      </div>
      <div class="sopa-main">
        <div class="sopa-grid" onmouseup="sopaEnd()" ontouchend="sopaEnd()"
          style="grid-template-columns:repeat(${size},1fr);">${gridHTML}</div>
        <div class="sopa-words-panel">
          <p class="sopa-words-title">Palabras a encontrar:</p>
          <div class="sopa-words-list">${wordsHTML}</div>
        </div>
      </div>
    </div>`;
}

function startSopaTimer() {
  clearInterval(sopaState.timer);
  sopaState.timer = setInterval(() => {
    sopaState.timeLeft--;
    // Actualizar solo el timer sin re-renderizar todo
    const el = document.querySelector('.sopa-timer');
    if (el) {
      el.textContent = 'â± ' + sopaState.timeLeft + 's';
      if (sopaState.timeLeft <= 15) el.classList.add('sopa-timer-urgent');
    }
    if (sopaState.timeLeft <= 0) {
      clearInterval(sopaState.timer);
      sopaFinish(false);
    }
  }, 1000);
}

function sopaStart(r, c) {
  sopaState.dragging = true;
  sopaState.startCell = [r, c];
  sopaState.selected = [[r, c]];
  updateSopaHighlight();
}
function sopaMove(r, c) {
  if (!sopaState.dragging) return;
  const [sr, sc] = sopaState.startCell;
  // Calcular lÃ­nea recta desde start hasta r,c
  sopaState.selected = getCellsInLine(sr, sc, r, c);
  updateSopaHighlight();
}
function sopaEnd() {
  if (!sopaState.dragging) return;
  sopaState.dragging = false;
  checkSopaSelection();
  sopaState.selected = [];
  updateSopaHighlight();
}
function sopaTouch(e, r, c) {
  e.preventDefault();
  sopaStart(r, c);
}
function sopaTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  if (el && el.dataset.r !== undefined) {
    sopaMove(Number(el.dataset.r), Number(el.dataset.c));
  }
}

function getCellsInLine(r1, c1, r2, c2) {
  const dr = r2 - r1, dc = c2 - c1;
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  if (steps === 0) return [[r1, c1]];
  // Solo en direcciÃ³n recta o diagonal exacta
  const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
  const stepC = dc === 0 ? 0 : dc / Math.abs(dc);
  // Validar que sea diagonal exacta o lÃ­nea recta
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) {
    // No es diagonal exacta â†’ solo extender en la direcciÃ³n dominante
    if (Math.abs(dr) > Math.abs(dc)) return Array.from({length:Math.abs(dr)+1},(_,i)=>[[r1+stepR*i,c1]]).flat();
    return Array.from({length:Math.abs(dc)+1},(_,i)=>[[r1,c1+stepC*i]]).flat();
  }
  return Array.from({length:steps+1}, (_,i) => [r1+stepR*i, c1+stepC*i]);
}

function updateSopaHighlight() {
  document.querySelectorAll('.sopa-cell').forEach(el => {
    const r = Number(el.dataset.r), c = Number(el.dataset.c);
    const isSel   = sopaState.selected.some(([sr,sc]) => sr===r && sc===c);
    const isFound = sopaState.found.some(w =>
      sopaState.placed.find(p => p.word === w)?.cells.some(([pr,pc]) => pr===r && pc===c)
    );
    el.className = 'sopa-cell' + (isSel?' sopa-sel':'') + (isFound?' sopa-found':'');
  });
}

function checkSopaSelection() {
  const sel = sopaState.selected;
  // Formar la palabra seleccionada
  const word = sel.map(([r,c]) => sopaState.grid[r][c]).join('');
  const wordRev = word.split('').reverse().join('');

  for (const p of sopaState.placed) {
    if ((p.word === word || p.word === wordRev) && !sopaState.found.includes(p.word)) {
      sopaState.found.push(p.word);
      const bonus = Math.max(10, Math.floor(sopaState.timeLeft / 2));
      sopaState.score += bonus;
      document.querySelector('.sopa-score-disp').innerHTML = '<svg style="width:1rem;height:1rem;fill:gold;vertical-align:middle;margin-right:2px;" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> ' + sopaState.score;
      // Marcar encontradas
      updateSopaHighlight();
      // Actualizar lista de palabras
      document.querySelectorAll('.sopa-word').forEach(el => {
        if (el.textContent === p.word) el.classList.add('sopa-word-found');
      });
      if (sopaState.found.length === sopaState.placed.length) {
        // Todas las palabras encontradas â€” limpiar timer ANTES de programar el finish
        clearInterval(sopaState.timer);
        if (sopaFinishTimeout) clearTimeout(sopaFinishTimeout);
        sopaFinishTimeout = setTimeout(() => sopaFinish(true), 400);
      }
      return;
    }
  }

  // Ninguna palabra coincidiÃ³: cuenta como intento fallido (solo si la
  // selecciÃ³n tenÃ­a mÃ¡s de una celda, para no penalizar clicks sueltos).
  if (sel.length > 1) sopaState.erroresSeleccion = (sopaState.erroresSeleccion || 0) + 1;
}

function sopaFinish(won) {
  // Guard: evita que se ejecute dos veces (puede pasar si el jugador
  // encuentra la Ãºltima palabra justo cuando el tiempo llega a 0 â€”
  // el timeout y el setTimeout de victoria competÃ­an y la segunda
  // llamada pisaba el HTML reciÃ©n renderizado con el botÃ³n "Jugar de
  // nuevo", dejÃ¡ndolo sin su listener funcional).
  if (sopaState.finished) return;
  sopaState.finished = true;
  clearInterval(sopaState.timer);
  if (sopaFinishTimeout) { clearTimeout(sopaFinishTimeout); sopaFinishTimeout = null; }
  const total = sopaState.placed.length;
  const found = sopaState.found.length;
  const pts   = sopaState.score;

  // En duelo: no se guarda puntaje normal ni logros, el puntaje va
  // directo al duelo (mismo criterio que ahorcadoDuelo).
  if (sopaDuelo && sopaDuelo.activo) {
    const dueloId = sopaDuelo.dueloId;
    sopaDuelo = null;
    finalizarDueloConPuntaje(dueloId, pts);
    return;
  }

  guardarPuntaje(1, pts, sopaState.tematicaId); // juego_id=1 Sopa
  registrarProgresoJuego('sopa', {
    sopa_racha: won,
    sopa_maxScore_best: pts,
    ...(won ? {
      sopa_completadas: 1,
      sopa_tematicas: [sopaState.tematicaId],
      ...(sopaState.timeLeft > SOPA_TIME / 2 ? { sopa_veloz: 1 } : {}),
      ...(sopaState.timeLeft >= 90 ? { sopa_relampago: 1 } : {}),
      ...(sopaState.erroresSeleccion === 0 ? { sopa_sinerrores: 1 } : {})
    } : {})
  });
  const sec = APP_EL.secSopa;
  sec.innerHTML = `
    <div class="game-screen-header">
      <button class="btn-back" onclick="goTo('juegos')">â† Volver a Juegos</button>
      <div class="game-screen-title"><span>${gameIconSVG('sopa', 22)}</span> Sopa de Letras</div>
    </div>
    <div class="preg-result">
      <div class="preg-result-emoji">${won ? 'ðŸ†' : found > total/2 ? 'ðŸ˜Š' : 'ðŸ˜…'}</div>
      <p class="preg-result-title">${won ? 'Â¡Encontraste todas!' : 'Â¡Tiempo agotado!'}</p>
      <p class="preg-result-score">${found} / ${total} palabras encontradas</p>
      <p class="preg-result-pts">+${pts} puntos</p>
      <button class="btn-play" style="max-width:240px;margin:0 auto;" onclick="initSopa(${sopaState.tematicaId})"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>Jugar de nuevo</button>
      <button class="btn-back" style="margin:0 auto;" onclick="goTo('juegos')">â† Volver a Juegos</button>
    </div>`;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   TERMINA LA PALABRA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const TERMINA_MAX = 5;

let terminaState = {
  word: '', revealed: '', intentos: 0,
  guesses: [], finished: false,
  tematicaId: 1
};

// â”€â”€â”€ Modo Duelo de Termina la Palabra â”€â”€â”€
// null si no hay un duelo en curso. Una sola palabra con la temÃ¡tica
// elegida al mandar el reto; al resolverla (acertada o agotados los
// intentos) se manda el puntaje directo a /api/duelos/:id/resultado, sin
// guardar puntaje normal ni sumar logros (igual criterio que wordleDuelo).
let terminaDuelo = null;

function iniciarTerminaDuelo(dueloId, tematicaId) {
  dueloActivo = { id: dueloId, juego: 'termina' };
  terminaDuelo = { activo: true, dueloId };
  goTo('termina');
  const overlay = document.getElementById('terminaStartOverlay');
  if (overlay) overlay.style.display = 'none';
  initTermina(tematicaId || 1);
}

async function initTermina(tematicaId) {
  tematicaId = Number(tematicaId) || terminaState.tematicaId || 1;
  terminaState.tematicaId = tematicaId;

  let word = null;
  try {
    const res  = await fetch('/api/wordle/palabra?tematica=' + tematicaId, { cache: 'no-store' });
    const data = await res.json();
    if (data.palabra) word = data.palabra.toLowerCase();
  } catch(e) { console.error(e); }

  if (!word) {
    const sec = APP_EL.secTermina;
    if (sec) {
      sec.innerHTML = `
        <div class="game-screen-header">
          <button class="btn-back" onclick="goTo('juegos')">â† Volver a Juegos</button>
          <div class="game-screen-title"><span>${gameIconSVG('termina', 22)}</span> Termina la Palabra</div>
          <div class="game-screen-theme">${temaLabelConDuelo(terminaDuelo && terminaDuelo.activo, tematicaId)}</div>
        </div>
        <div class="coming-soon-box" style="margin-top:2rem;">
          <h2>Sin palabras</h2>
          <p>AÃºn no hay palabras cargadas para esta temÃ¡tica. (RecordÃ¡ correr python crear_bd.py)</p>
          <button class="btn-play" style="margin-top:20px" onclick="goTo('juegos')">â† Volver a Juegos</button>
        </div>`;
    }
    // Si es un duelo y la temÃ¡tica no tiene palabras cargadas, reportamos
    // 0 puntos para no dejarlo colgado (mismo criterio que Preguntados).
    if (terminaDuelo && terminaDuelo.activo) {
      const dueloId = terminaDuelo.dueloId;
      terminaDuelo = null;
      finalizarDueloConPuntaje(dueloId, 0);
    }
    return;
  }

  // Revelar entre 30-50% de las letras (posiciones aleatorias)
  const totalReveal = Math.max(1, Math.floor(word.length * 0.35));
  const positions = [...Array(word.length).keys()].sort(() => Math.random()-0.5).slice(0, totalReveal);
  const revealed  = word.split('').map((l, i) => positions.includes(i) ? l : '_').join('');

  terminaState = { word, revealed, intentos: 0, guesses: [], finished: false, tematicaId };
  APP_EL.terminaThemeLabel.textContent = temaLabelConDuelo(terminaDuelo && terminaDuelo.activo, tematicaId);
  renderTermina();
}

function renderTermina() {
  const sec = APP_EL.secTermina;
  const { word, revealed, intentos, guesses, finished } = terminaState;

  const intentosHTML = Array.from({length: TERMINA_MAX}, (_, i) => {
    if (i < guesses.length) {
      const g = guesses[i];
      return `<div class="termina-intento ${g.correct?'correct':'wrong'}">
        ${g.text} ${g.correct ? 'âœ…' : 'âŒ'}
      </div>`;
    }
    return `<div class="termina-intento empty">${i < intentos ? '' : 'â€”'}</div>`;
  }).join('');

  const displayWord = finished
    ? word.toUpperCase()
    : revealed.split('').map((l, i) =>
        `<span class="termina-letra ${l!='_'?'revelada':''}">${l==='_'?'_':l.toUpperCase()}</span>`
      ).join('');

  // En duelo no se ofrece "Nueva palabra" (el duelo era una sola palabra):
  // el cartel de resultado del duelo se encarga de la navegaciÃ³n siguiente.
  const botonesFinTermina = (terminaDuelo && terminaDuelo.activo) ? '' : `
        <div style="display:flex;gap:1rem;justify-content:center;margin-top:1rem;">
          <button class="btn-play" style="max-width:220px;" onclick="initTermina(${terminaState.tematicaId})"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>Nueva palabra</button>
          <button class="btn-back" onclick="goTo('juegos')">â† Volver a Juegos</button>
        </div>`;

  sec.innerHTML = `
    <div class="game-screen-header">
      <button class="btn-back" onclick="goTo('juegos')">â† Volver a Juegos</button>
      <div class="game-screen-title"><span>${gameIconSVG('termina', 22)}</span> Termina la Palabra</div>
      <div class="game-screen-theme" id="termina-theme-label">${temaLabelConDuelo(terminaDuelo && terminaDuelo.activo, terminaState.tematicaId)}</div>
    </div>
    <div class="termina-wrap">
      <p class="termina-hint">CompletÃ¡ la palabra. TenÃ©s ${TERMINA_MAX - intentos} intentos restantes.</p>
      <div class="termina-display">${displayWord}</div>
      ${!finished ? `
        <div class="termina-input-row">
          <input class="termina-input" id="terminaInput" type="text"
            placeholder="EscribÃ­ la palabra completa..."
            maxlength="${word.length + 3}"
            onkeydown="if(event.key==='Enter') submitTermina()"
            autocomplete="off" autocorrect="off" spellcheck="false" />
          <button class="btn-play" style="min-width:100px;" onclick="submitTermina()">Enviar</button>
        </div>` : ''}
      <div class="termina-intentos">${intentosHTML}</div>
      ${finished ? `
        <div class="termina-result ${guesses[guesses.length-1]?.correct?'win':'lose'}">
          ${guesses[guesses.length-1]?.correct ? 'ðŸŽ‰ Â¡Correcto!' : 'ðŸ’€ Era: ' + word.toUpperCase()}
        </div>
        ${botonesFinTermina}` : ''}
    </div>`;

  if (!finished) {
    setTimeout(() => document.getElementById('terminaInput')?.focus(), 50);
  }
}

function submitTermina() {
  const input = document.getElementById('terminaInput');
  if (!input) return;
  const guess = input.value.trim().toLowerCase();
  if (!guess) return;

  const { word } = terminaState;
  const correct  = guess === word;

  terminaState.guesses.push({ text: guess.toUpperCase(), correct });
  terminaState.intentos++;

  if (correct || terminaState.intentos >= TERMINA_MAX) {
    terminaState.finished = true;
    const pts = correct
      ? Math.max(200, 600 - (terminaState.intentos - 1) * 100)
      : 25;

    // En duelo: no se guarda puntaje normal ni logros, el puntaje va
    // directo al duelo (mismo criterio que ahorcadoDuelo/wordleDuelo).
    if (terminaDuelo && terminaDuelo.activo) {
      const dueloId = terminaDuelo.dueloId;
      renderTermina();
      terminaDuelo = null;
      setTimeout(() => finalizarDueloConPuntaje(dueloId, pts), 1400);
      return;
    }

    guardarPuntaje(3, pts, terminaState.tematicaId); // juego_id=3 Termina la Palabra
    registrarProgresoJuego('termina', {
      termina_racha: correct,
      ...(correct ? {
        termina_completadas: 1,
        termina_tematicas: [terminaState.tematicaId],
        ...(terminaState.intentos === 1 ? { termina_1intento: 1 } : {}),
        ...(terminaState.intentos <= 2 ? { termina_eficientes: 1 } : {}),
        ...(word.length >= 10 ? { termina_palabraLarga: 1 } : {}),
        ...(terminaState.intentos === TERMINA_MAX ? { termina_ultimoMomento: 1 } : {})
      } : {})
    });
  } else {
    // UI-004: dar feedback progresivo â€” revelar una letra oculta mÃ¡s
    // por cada intento fallido, para evitar la frustraciÃ³n del jugador.
    const ocultas = [];
    terminaState.revealed.split('').forEach((l, i) => { if (l === '_') ocultas.push(i); });
    if (ocultas.length > 0) {
      const idx = ocultas[Math.floor(Math.random() * ocultas.length)];
      const chars = terminaState.revealed.split('');
      chars[idx] = word[idx];
      terminaState.revealed = chars.join('');
    }
  }

  renderTermina();
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   ADIVINA LA COSA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Datos del juego organizados por temÃ¡tica â€” quedan como FALLBACK si falla
// el fetch a /api/adivina/items (o esa temÃ¡tica todavÃ­a no tiene items
// cargados en la BD). La fuente real ahora es la tabla adivina_items.
// Cada item tiene: respuesta, pistas (de vaga a especÃ­fica), imagen
const ADIVINA_DATA = {
  1: [ // Videojuegos
    {
      respuesta: 'minecraft',
      aliases: ['mine craft'],
      imagen: 'logos/videojuegos/minecraft.jpg',
      pistas: [
        'Es un videojuego de mundo abierto lanzado en 2011.',
        'PodÃ©s construir estructuras usando bloques.',
        'Incluye un modo supervivencia donde debÃ©s comer y combatir criaturas.',
        'El Creeper es uno de sus enemigos mÃ¡s icÃ³nicos.',
      ],
    },
    {
      respuesta: 'god of war',
      aliases: ['god of war', 'godofwar'],
      imagen: 'logos/videojuegos/god-of-war.jpg',
      pistas: [
        'Es una saga de acciÃ³n y aventura con temÃ¡tica mitolÃ³gica.',
        'El protagonista es un espartano con marcas blancas en la piel.',
        'En las entregas recientes viaja por la mitologÃ­a nÃ³rdica con su hijo Atreus.',
        'Su nombre es Kratos.',
      ],
    },
    {
      respuesta: 'pokemon',
      aliases: ['pokÃ©mon', 'pokemon rojo', 'pokÃ©mon rojo'],
      imagen: 'logos/videojuegos/pokemon-rojo.jpg',
      pistas: [
        'Es una saga de RPG donde coleccionÃ¡s y entrenÃ¡s criaturas.',
        'Tu objetivo principal es vencer a los 8 lÃ­deres de gimnasio.',
        'La primera entrega se lanzÃ³ en 1996 para Game Boy.',
        'El PokÃ©mon mÃ¡s famoso de la saga es Pikachu.',
      ],
    },
    {
      respuesta: 'silent hill',
      aliases: ['silent hill'],
      imagen: 'logos/videojuegos/silent-hill.jpg',
      pistas: [
        'Es una saga de videojuegos de terror psicolÃ³gico.',
        'Transcurre en una ciudad envuelta en niebla y oscuridad.',
        'Pyramid Head es uno de sus enemigos mÃ¡s reconocibles.',
        'Fue desarrollada por Konami a fines de los 90.',
      ],
    },
  ],
  2: [ // PelÃ­culas
    {
      respuesta: 'el origen de los guardianes',
      aliases: ['rise of the guardians', 'origen de los guardianes', 'guardianes'],
      imagen: 'logos/pelicula/el-origen-de-los-guardianes.jpg',
      pistas: [
        'Es una pelÃ­cula de animaciÃ³n de DreamWorks del aÃ±o 2012.',
        'Los protagonistas son figuras mÃ­ticas como el Conejo de Pascua y Santa Claus.',
        'Un villano llamado Pitch Black quiere que los niÃ±os dejen de creer.',
        'Jack Frost es el protagonista principal.',
      ],
    },
    {
      respuesta: 'metegol',
      aliases: ['foosball', 'underdogs'],
      imagen: 'logos/pelicula/metegol.jpg',
      pistas: [
        'Es una pelÃ­cula de animaciÃ³n argentina estrenada en 2013.',
        'Fue producida por Juan JosÃ© Campanella.',
        'Los personajes de un metegol cobran vida para ayudar al protagonista.',
        'GanÃ³ el Premio Goya a Mejor PelÃ­cula de AnimaciÃ³n.',
      ],
    },
    {
      respuesta: 'rapido y furioso',
      aliases: ['rÃ¡pido y furioso', 'fast and furious', 'fast furious', 'fast & furious'],
      imagen: 'logos/pelicula/rapido-y-furioso.jpg',
      pistas: [
        'Es una saga de acciÃ³n estadounidense con mÃºltiples pelÃ­culas.',
        'Gira en torno a carreras ilegales de autos y misiones de alto riesgo.',
        'Dominic Toretto es uno de sus personajes principales.',
        'Vin Diesel y Paul Walker son los actores mÃ¡s asociados a la saga.',
      ],
    },
    {
      respuesta: 'scary movie',
      aliases: ['scary movie 1'],
      imagen: 'logos/pelicula/scary-movie.jpg',
      pistas: [
        'Es una comedia de parodia de pelÃ­culas de terror de los aÃ±os 90.',
        'Se burla de cintas como Scream y SÃ© Lo Que Hiciste El Verano Pasado.',
        'Fue dirigida por Keenen Ivory Wayans en el aÃ±o 2000.',
        'La protagonista es Cindy Campbell, interpretada por Anna Faris.',
      ],
    },
  ],
  3: [ // Anime
    {
      respuesta: 'naruto',
      aliases: ['naruto shippuden', 'naruto uzumaki'],
      imagen: 'logos/anime/naruto.jpg',
      pistas: [
        'Es un anime shÅnen que sigue la vida de un joven ninja.',
        'El protagonista sueÃ±a con convertirse en Hokage de su aldea.',
        'Tiene sellado en su cuerpo un zorro de nueve colas llamado Kurama.',
        'El nombre del protagonista es el mismo que el del anime.',
      ],
    },
    {
      respuesta: 'goku',
      aliases: ['son goku', 'dragon ball', 'dragon ball z'],
      imagen: 'logos/anime/goku-jr.jpg',
      pistas: [
        'Es un personaje de una de las sagas de anime mÃ¡s famosas del mundo.',
        'Es un Saiyan cuya tÃ©cnica mÃ¡s emblemÃ¡tica es el Kamehameha.',
        'Pelea contra enemigos cada vez mÃ¡s poderosos para proteger la Tierra.',
        'Su nombre completo es Son Goku.',
      ],
    },
    {
      respuesta: 'eren',
      aliases: ['eren yeager', 'eren jaeger', 'attack on titan', 'shingeki no kyojin'],
      imagen: 'logos/anime/eren.jpg',
      pistas: [
        'Es el protagonista de un anime de acciÃ³n y drama oscuro.',
        'Vive en un mundo amenazado por gigantes canÃ­bales llamados Titanes.',
        'Posee la habilidad de transformarse en un TitÃ¡n.',
        'Su apellido es Yeager y el anime se llama Shingeki no Kyojin.',
      ],
    },
    {
      respuesta: 'kazuma',
      aliases: ['kazuma sato', 'konosuba', 'kono subarashii'],
      imagen: 'logos/anime/kazuma.jpg',
      pistas: [
        'Es el protagonista de un anime de isekai y comedia.',
        'Fue transportado a un mundo de fantasÃ­a despuÃ©s de morir de forma ridÃ­cula.',
        'Viaja con un grupo de compaÃ±eras bastante incompetentes.',
        'El anime se llama KonoSuba.',
      ],
    },
  ],
  4: [ // ProgramaciÃ³n
    {
      respuesta: 'python',
      aliases: ['python 3', 'python3'],
      imagen: 'logos/programacion/Python.png',
      pistas: [
        'Es uno de los lenguajes de programaciÃ³n mÃ¡s populares del mundo.',
        'Se usa mucho en ciencia de datos, inteligencia artificial y scripting.',
        'Su sintaxis es limpia y muy legible, ideal para principiantes.',
        'Su nombre hace referencia a un grupo de comediantes britÃ¡nicos.',
      ],
    },
    {
      respuesta: 'node',
      aliases: ['node.js', 'nodejs'],
      imagen: 'logos/programacion/node-js.png',
      pistas: [
        'Es un entorno de ejecuciÃ³n para JavaScript del lado del servidor.',
        'EstÃ¡ basado en el motor V8 de Google Chrome.',
        'Usa un modelo de entrada/salida no bloqueante, ideal para APIs.',
        'Se suele usar junto a Express para crear servidores web.',
      ],
    },
    {
      respuesta: 'arduino',
      aliases: [],
      imagen: 'logos/programacion/arduino.png',
      pistas: [
        'Es una plataforma de hardware y software de cÃ³digo abierto.',
        'Se usa para crear prototipos electrÃ³nicos y proyectos DIY.',
        'Su placa fÃ­sica es de color azul o verde y tiene pines de entrada/salida.',
        'Se programa con un lenguaje basado en C/C++.',
      ],
    },
    {
      respuesta: 'visual studio',
      aliases: ['visual studio code', 'vscode', 'vs code', 'vs'],
      imagen: 'logos/programacion/visual-studio.png',
      pistas: [
        'Es un editor de cÃ³digo desarrollado por Microsoft.',
        'Es altamente extensible mediante plugins y extensiones.',
        'Tiene integraciÃ³n nativa con Git y un terminal integrado.',
        'Es el editor de cÃ³digo mÃ¡s usado en el mundo segÃºn encuestas de Stack Overflow.',
      ],
    },
  ],
};

let adivinaState = null;

// â”€â”€â”€ Modo Duelo de Adivina la Cosa â”€â”€â”€
// null si no hay un duelo en curso. Una sola ronda completa (mismos
// items que en modo libre) con la temÃ¡tica elegida al mandar el reto;
// arranca directo sin pasar por el cartel de "â–¶ Empezar", y al terminar
// se manda el puntaje directo a /api/duelos/:id/resultado en vez de
// guardar puntaje normal o sumar logros (igual criterio que sopaDuelo).
let adivinaDuelo = null;

function iniciarAdivinaDuelo(dueloId, tematicaId) {
  dueloActivo = { id: dueloId, juego: 'adivina' };
  adivinaDuelo = { activo: true, dueloId };
  goTo('adivina');
  initAdivina(tematicaId || 1).then(() => {
    if (adivinaDuelo && adivinaDuelo.activo) startAdivina();
  });
}

function stopAdivina() {
  adivinaState = null;
}

async function initAdivina(tematicaId) {
  const tId = tematicaId && /^\d+$/.test(String(tematicaId)) ? Number(tematicaId) : 1;

  let items = [];
  try {
    const res = await fetch(`/api/adivina/items?tematica=${tId}`, { cache: 'no-store' });
    items = await res.json();
  } catch (e) { console.error(e); }

  // Fallback: la API fallÃ³ o todavÃ­a no hay items cargados en la BD para
  // esta temÃ¡tica â€” mismo criterio que Sopa, mejor jugar con el set viejo
  // que dejar el juego sin arrancar.
  if (!Array.isArray(items) || items.length === 0) {
    items = ADIVINA_DATA[tId] || ADIVINA_DATA[1];
  }
  items = shuffle([...items]);

  adivinaState = {
    tematicaId: tId,
    items,
    itemIdx: 0,
    score: 0,
    pistasUsed: 0,
    finished: false,
  };

  const enDuelo = adivinaDuelo && adivinaDuelo.activo;
  const labelEl = document.getElementById('adivina-theme-label');
  if (labelEl) labelEl.textContent = temaLabelConDuelo(enDuelo, tId);

  // Mostrar overlay de inicio (en duelo, startAdivina() lo cierra enseguida)
  const ov = APP_EL.adivinaOverlay;
  APP_EL.adivinaOverlayEmoji.textContent = enDuelo ? 'âš”ï¸' : 'ðŸ•µï¸';
  APP_EL.adivinaOverlayTitle.textContent = enDuelo ? 'Â¡ArrancÃ³ el duelo!' : 'Adivina la Cosa';
  APP_EL.adivinaOverlayDesc.textContent =
    `Se muestran ${items.length} items de la temÃ¡tica seleccionada.\nCuantas menos pistas uses, Â¡mÃ¡s puntos ganÃ¡s!`;
  APP_EL.adivinaOverlayBtn.textContent = 'â–¶ Empezar';
  APP_EL.adivinaOverlayBtn.onclick = startAdivina;
  ov.style.display = 'flex';
  APP_EL.adivinaGame.style.display = 'none';
}

function startAdivina() {
  if (!adivinaState) return;
  APP_EL.adivinaOverlay.style.display = 'none';
  APP_EL.adivinaGame.style.display = 'flex';
  adivinaState.itemIdx = 0;
  adivinaState.score = 0;
  adivinaState.pistasUsed = 0;
  adivinaState.pistasRevealedThisItem = [];
  adivinaState.pistasUsedThisItem = 0;
  adivinaState.respondido = false;
  renderAdivinaItem();
}

function renderAdivinaItem() {
  const s = adivinaState;
  const item = s.items[s.itemIdx];

  // Meta
  APP_EL.adivinaItemNum.textContent = s.itemIdx + 1;
  APP_EL.adivinaItemTotal.textContent = s.items.length;
  APP_EL.adivinaScore.textContent = s.score;
  APP_EL.adivinaPistasUsed.textContent = s.pistasUsedThisItem || 0;

  // Pistas
  APP_EL.adivinaPistasList.innerHTML = '';
  s.pistasRevealedThisItem = s.pistasRevealedThisItem || [];
  for (const pista of s.pistasRevealedThisItem) {
    const el = document.createElement('div');
    el.className = 'adivina-pista-item';
    el.textContent = `ðŸ”¹ ${pista}`;
    APP_EL.adivinaPistasList.appendChild(el);
  }

  // BotÃ³n pista
  const btn = APP_EL.adivinaBtnPista;
  const remaining = item.pistas.length - (s.pistasRevealedThisItem?.length || 0);
  btn.disabled = remaining === 0;
  btn.querySelector ? null : null;
  APP_EL.adivinaPistaCosto.textContent =
    `(-${pistasCosto(s.pistasRevealedThisItem?.length || 0)} pts)`;

  // Imagen pixelada
  renderAdivinaCanvas(item.imagen, s.pistasRevealedThisItem?.length || 0, item.pistas.length);

  // Input
  APP_EL.adivinaInput.value = '';
  APP_EL.adivinaInput.disabled = false;
  APP_EL.adivinaFeedback.style.display = 'none';
  setTimeout(() => APP_EL.adivinaInput?.focus(), 50);

  // BotÃ³n "Me rindo": solo disponible cuando ya no quedan mÃ¡s pistas para pedir
  const btnRendirse = APP_EL.adivinaBtnRendirse;
  if (btnRendirse) btnRendirse.style.display = remaining === 0 ? 'block' : 'none';
}

function pistasCosto(pistasYaReveladas) {
  // Primera pista: -100, segunda: -150, tercera: -200, cuarta: -250
  return 100 + pistasYaReveladas * 50;
}

function puntosItem(pistasUsadas) {
  // Sin pistas: 500, con 1: 400, con 2: 250, con 3: 100, con 4+: 50
  const base = [500, 400, 250, 100, 50];
  return base[Math.min(pistasUsadas, 4)];
}

function renderAdivinaCanvas(imgSrc, pistasCnt, totalPistas) {
  const canvas = APP_EL.adivinaCanvas;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.src = imgSrc;
  img.onload = () => {
    // Nivel de pixelado: cuantas mÃ¡s pistas, mÃ¡s nÃ­tida (1=muy pixelada, 0=nÃ­tida)
    // 0 pistas = pixelSize 24, 1=16, 2=10, 3=5, 4=1
    const pixelSizes = [24, 16, 10, 5, 1];
    const pixelSize = pixelSizes[Math.min(pistasCnt, pixelSizes.length - 1)];

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (pixelSize <= 1) {
      ctx.drawImage(img, 0, 0, w, h);
      return;
    }

    // Dibujar pequeÃ±o, luego escalar
    const small = document.createElement('canvas');
    small.width  = Math.max(1, Math.floor(w / pixelSize));
    small.height = Math.max(1, Math.floor(h / pixelSize));
    const sCtx = small.getContext('2d');
    sCtx.drawImage(img, 0, 0, small.width, small.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, w, h);
  };
  img.onerror = () => {
    // Fallback: cuadrado gris con Ã­cono
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '64px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ðŸ•µï¸', canvas.width / 2, canvas.height / 2);
  };
}

function revelarPista() {
  const s = adivinaState;
  if (!s) return;
  const item = s.items[s.itemIdx];
  if (!s.pistasRevealedThisItem) s.pistasRevealedThisItem = [];
  if (s.pistasRevealedThisItem.length >= item.pistas.length) return;

  const pista = item.pistas[s.pistasRevealedThisItem.length];
  s.pistasRevealedThisItem.push(pista);
  s.pistasUsedThisItem = s.pistasRevealedThisItem.length;
  s.pistasUsed = (s.pistasUsed || 0) + 1;

  renderAdivinaItem();
}

function rendirseAdivina() {
  const s = adivinaState;
  if (!s || s.respondido) return;
  const item = s.items[s.itemIdx];
  s.respondido = true;
  actualizarProgresoParcial('adivina', { adivina_racha: false });

  const input = APP_EL.adivinaInput;
  const fb = APP_EL.adivinaFeedback;
  fb.style.display = 'block';
  fb.className = 'adivina-feedback incorrecto';
  fb.textContent = `âŒ La respuesta era: ${item.respuesta.charAt(0).toUpperCase() + item.respuesta.slice(1)}`;
  input.disabled = true;
  APP_EL.adivinaBtnPista.disabled = true;
  const btnRendirse = APP_EL.adivinaBtnRendirse;
  if (btnRendirse) btnRendirse.style.display = 'none';

  // Revelar imagen completa
  renderAdivinaCanvas(item.imagen, 99, item.pistas.length);

  setTimeout(() => nextAdivinaItem(), 2200);
}

function submitAdivina() {
  const s = adivinaState;
  if (!s || s.respondido) return;
  const item = s.items[s.itemIdx];
  const input = APP_EL.adivinaInput;
  const raw = input.value.trim().toLowerCase().replace(/[Ã¡Ã Ã¤]/g,'a').replace(/[Ã©Ã¨Ã«]/g,'e')
    .replace(/[Ã­Ã¬Ã¯]/g,'i').replace(/[Ã³Ã²Ã¶]/g,'o').replace(/[ÃºÃ¹Ã¼]/g,'u');

  if (!raw) return;

  const normalize = (str) => str.toLowerCase()
    .replace(/[Ã¡Ã Ã¤]/g,'a').replace(/[Ã©Ã¨Ã«]/g,'e')
    .replace(/[Ã­Ã¬Ã¯]/g,'i').replace(/[Ã³Ã²Ã¶]/g,'o').replace(/[ÃºÃ¹Ã¼]/g,'u');

  const correctas = [item.respuesta, ...item.aliases].map(normalize);
  const correcto = correctas.includes(raw);

  const fb = APP_EL.adivinaFeedback;
  fb.style.display = 'block';

  const pistasUsadas = s.pistasRevealedThisItem?.length || 0;

  if (correcto) {
    s.respondido = true;
    const pts = puntosItem(pistasUsadas);
    s.score += pts;
    fb.className = 'adivina-feedback correcto';
    fb.textContent = `âœ… Â¡Correcto! +${pts} puntos`;
    input.disabled = true;
    APP_EL.adivinaBtnPista.disabled = true;

    actualizarProgresoParcial('adivina', {
      adivina_aciertos: 1,
      adivina_racha: true,
      ...(pistasUsadas === 0 ? { adivina_sinpistas: 1 } : {}),
      ...(pistasUsadas === 1 ? { adivina_1pista: 1 } : {})
    });

    // Revelar imagen completa
    renderAdivinaCanvas(item.imagen, 99, item.pistas.length);

    setTimeout(() => nextAdivinaItem(), 1800);
  } else {
    fb.className = 'adivina-feedback incorrecto';
    fb.textContent = 'âŒ No es eso, seguÃ­ intentando o pedÃ­ mÃ¡s pistas.';
    input.value = '';
    setTimeout(() => { fb.style.display = 'none'; input.focus(); }, 1500);
  }
}

// Soporte Enter en input
document.addEventListener('DOMContentLoaded', () => {
  const inp = APP_EL.adivinaInput;
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') submitAdivina(); });
});

function nextAdivinaItem() {
  const s = adivinaState;
  s.pistasRevealedThisItem = [];
  s.pistasUsedThisItem = 0;
  s.respondido = false;
  s.itemIdx++;

  if (s.itemIdx >= s.items.length) {
    // Fin del juego
    s.finished = true;

    // En duelo: no se guarda puntaje normal ni logros, el puntaje va
    // directo al duelo (mismo criterio que sopaDuelo).
    if (adivinaDuelo && adivinaDuelo.activo) {
      const dueloId = adivinaDuelo.dueloId;
      adivinaDuelo = null;
      finalizarDueloConPuntaje(dueloId, s.score);
      return;
    }

    guardarPuntaje(5, s.score, s.tematicaId); // juego_id=5 Adivina la Cosa
    registrarProgresoJuego('adivina', {
      adivina_tematicas: [s.tematicaId],
      adivina_rondasCompletadas: 1,
      ...((s.pistasUsed || 0) === 0 ? { adivina_rondasPerfectas: 1 } : {})
    });

    const ov = APP_EL.adivinaOverlay;
    APP_EL.adivinaOverlayEmoji.textContent = 'ðŸ†';
    APP_EL.adivinaOverlayTitle.textContent = 'Â¡Juego terminado!';
    APP_EL.adivinaOverlayDesc.textContent = `Tu puntaje final: ${s.score} puntos`;
    APP_EL.adivinaOverlayBtn.textContent = 'ðŸ” Jugar de nuevo';
    APP_EL.adivinaOverlayBtn.onclick = startAdivina;
    ov.style.display = 'flex';
    return;
  }

  renderAdivinaItem();
}
// â”€â”€â”€ MODAL INFO / CRÃ‰DITOS â”€â”€â”€
let currentInfoPage = 1;
const totalInfoPages = 4;

function openInfoModal() {
  APP_EL.infoOverlay.classList.add('show');
  currentInfoPage = 1;
  updateInfoModal();
}

function closeInfoModal() {
  APP_EL.infoOverlay.classList.remove('show');
}

function changeInfoPage(dir) {
  currentInfoPage += dir;
  if (currentInfoPage < 1) currentInfoPage = 1;
  if (currentInfoPage > totalInfoPages) currentInfoPage = totalInfoPages;
  updateInfoModal();
}

function goToInfoPage(page) {
  currentInfoPage = page;
  if (currentInfoPage < 1) currentInfoPage = 1;
  if (currentInfoPage > totalInfoPages) currentInfoPage = totalInfoPages;
  updateInfoModal();
}

function updateInfoModal() {
  // Ocultar todas las pÃ¡ginas
  document.querySelectorAll('.info-page').forEach(p => p.classList.remove('active'));
  // Mostrar la pÃ¡gina actual
  const activePage = document.getElementById('infoPage' + currentInfoPage);
  if (activePage) activePage.classList.add('active');

  // Actualizar dots
  const dots = document.querySelectorAll('#infoDots .dot');
  dots.forEach((dot, index) => {
    if (index === currentInfoPage - 1) dot.classList.add('active');
    else dot.classList.remove('active');
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// ==========================================
// NOTIFICACIONES
// Conectado a routes/notificaciones.js: GET /api/notificaciones,
// GET /api/notificaciones/no-leidas, POST /api/notificaciones/:id/leer,
// POST /api/notificaciones/leer-todas, DELETE /api/notificaciones/:id.
// Se generan desde el backend en 3 casos: solicitud de amistad recibida,
// aviso nuevo publicado desde el Panel Admin, y rÃ©cord de puntuaciÃ³n
// superado por otro jugador.
// ==========================================

// Emoji + destino (goTo) segÃºn el tipo de notificaciÃ³n que manda el backend.
const NOTIF_ICONOS = {
  solicitud_amistad: 'ðŸ¤',
  aviso: 'ðŸ“¢',
  record_superado: 'ðŸ†',
  duelo_reto: 'âš”ï¸',
  duelo_aceptado: 'âœ…',
  duelo_resultado: 'ðŸ',
};

function formatearFechaNotif(fechaStr) {
  try {
    const f = new Date(fechaStr.replace(' ', 'T') + 'Z');
    return f.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

window.openNotifModal = openNotifModal;
function openNotifModal() {
  const overlay = document.getElementById('notifOverlay');
  if (!overlay) return;
  overlay.classList.add('show');
  fetchNotificaciones();
}

window.closeNotifModal = closeNotifModal;
function closeNotifModal() {
  const overlay = document.getElementById('notifOverlay');
  if (overlay) overlay.classList.remove('show');
}

async function fetchNotificaciones() {
  const body = document.getElementById('notifListBody');
  if (!body) return;
  body.innerHTML = '<div class="notif-empty">Cargando notificaciones...</div>';
  try {
    const notifs = await apiFetch('/api/notificaciones');
    renderNotificaciones(notifs);
    // Ya las estamos mostrando: refrescamos el badge (no las marca leÃ­das,
    // eso pasa reciÃ©n cuando el usuario toca cada una o "Marcar todas").
    actualizarBadgeNotificaciones();
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    body.innerHTML = '<div class="notif-empty">No se pudieron cargar las notificaciones.</div>';
  }
}

function renderNotificaciones(notifs) {
  const body = document.getElementById('notifListBody');
  if (!body) return;

  if (!notifs || notifs.length === 0) {
    body.innerHTML = '<div class="notif-empty">No tenÃ©s notificaciones todavÃ­a.</div>';
    return;
  }

  body.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.leido ? '' : 'unread'}" id="notifItem-${n.id}" onclick="onClickNotif(${n.id}, ${n.leido ? 'true' : 'false'}, ${n.enlace ? `'${n.enlace}'` : 'null'}, '${n.tipo}')">
      <span class="notif-item-icon">${NOTIF_ICONOS[n.tipo] || 'ðŸ””'}</span>
      <div class="notif-item-text">
        ${sanitizeHTML(n.mensaje)}
        <span class="notif-item-date">${formatearFechaNotif(n.fecha)}</span>
      </div>
      <button class="notif-item-del" title="Eliminar" onclick="event.stopPropagation(); eliminarNotificacion(${n.id});">âœ•</button>
    </div>
  `).join('');
}

// Al tocar una notificaciÃ³n: si no estaba leÃ­da la marca como leÃ­da, y si
// tiene una secciÃ³n asociada (enlace) navega ahÃ­ y cierra el modal.
async function onClickNotif(id, yaLeida, enlace, tipo) {
  if (!yaLeida) await marcarNotifLeida(id, false);
  if (enlace) {
    closeNotifModal();
    goTo(enlace);
    if (typeof tipo === 'string' && tipo.startsWith('duelo_')) {
      mostrarTabAmigos('duelos');
    }
  }
}

async function marcarNotifLeida(id, refrescarLista = true) {
  try {
    await apiFetch(`/api/notificaciones/${id}/leer`, { method: 'POST' });
    const item = document.getElementById(`notifItem-${id}`);
    if (item) item.classList.remove('unread');
    actualizarBadgeNotificaciones();
  } catch (error) {
    console.error('Error al marcar notificaciÃ³n como leÃ­da:', error);
  }
  if (refrescarLista) fetchNotificaciones();
}

window.marcarTodasNotifLeidas = marcarTodasNotifLeidas;
async function marcarTodasNotifLeidas() {
  try {
    await apiFetch('/api/notificaciones/leer-todas', { method: 'POST' });
    fetchNotificaciones();
  } catch (error) {
    mostrarToast('No se pudieron marcar las notificaciones como leÃ­das', 'error');
  }
}

window.eliminarNotificacion = eliminarNotificacion;
async function eliminarNotificacion(id) {
  try {
    await apiFetch(`/api/notificaciones/${id}`, { method: 'DELETE' });
    fetchNotificaciones();
  } catch (error) {
    mostrarToast('No se pudo eliminar la notificaciÃ³n', 'error');
  }
}

// Actualiza el numerito rojo del botÃ³n "Notificaciones" en el menÃº lateral
// derecho. Se llama al loguearse, al abrir/cerrar el modal, y cada 30s
// mientras haya sesiÃ³n iniciada (mismo criterio que actualizarBadgeSolicitudes).
async function actualizarBadgeNotificaciones() {
  const badge = document.getElementById('notifDrawerBadge');
  if (!badge || !localStorage.getItem('unigames_token')) return;
  try {
    const data = await apiFetch('/api/notificaciones/no-leidas');
    badge.innerHTML = data.count > 0 ? `<span class="lb-tab-badge">${data.count}</span>` : '';
  } catch (error) {
    // silencioso: es solo un indicador
  }
}

// Polling liviano: cada 30s, si hay sesiÃ³n, refresca el contador para que
// se note una notificaciÃ³n nueva sin tener que recargar la pÃ¡gina.
setInterval(actualizarBadgeNotificaciones, 30000);

// ==========================================
// ADMIN PANEL LOGIC
// ==========================================
window.openAdminModal = openAdminModal;
function openAdminModal() {
  document.getElementById('adminOverlay').classList.add('show');
  loadAdminDashboard();
  loadAdminUsers();
  loadAdminConfig();
  loadAdminUsers();
}
window.closeAdminModal = closeAdminModal;
function closeAdminModal() {
  document.getElementById('adminOverlay').classList.remove('show');
}
window.loadAdminConfig = loadAdminConfig;
window.loadAdminConfig = loadAdminConfig;
async function loadAdminConfig() {
    try {
      const res = await fetch('/api/config');
      const config = await res.json();
      if(config.color_tema) document.getElementById('adminTema').value = config.color_tema;
      if(config.github_rodrigo) document.getElementById('adminGitRodrigo').value = config.github_rodrigo;
      if(config.github_santiago) document.getElementById('adminGitSantiago').value = config.github_santiago;
      if(config.github_kevin) document.getElementById('adminGitKevin').value = config.github_kevin;
      
    } catch(e) { console.error('Error cargando config:', e); }
  }
window.saveAdminConfig = saveAdminConfig;
window.saveAdminConfig = saveAdminConfig;
async function saveAdminConfig() {
  const token = localStorage.getItem('unigames_token');
  const data = {
    color_tema: document.getElementById('adminTema').value,
    github_rodrigo: document.getElementById('adminGitRodrigo').value,
    github_santiago: document.getElementById('adminGitSantiago').value,
    github_kevin: document.getElementById('adminGitKevin').value
  };
  try {
    const res = await fetch('/api/admin/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(data)
    });
    if(res.ok) {
        alert('ConfiguraciÃ³n guardada! La pÃ¡gina se recargarÃ¡ para aplicar los cambios.');
        setTimeout(() => location.reload(), 500);
      } else {
      alert('Error guardando configuraciÃ³n');
    }
  } catch(e) { console.error(e); }
}
window.loadAdminUsers = loadAdminUsers;
window.loadAdminUsers = loadAdminUsers;
async function loadAdminUsers() {
  const token = localStorage.getItem('unigames_token');
  const list = document.getElementById('adminUsersList');
  try {
    const res = await fetch('/api/admin/usuarios', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if(!res.ok) return list.innerHTML = '<li>Error cargando usuarios</li>';
    let users = await res.json();
    
    // Add Search logic
    const searchInput = document.getElementById('adminUserSearch');
    window.allAdminUsers = users;
    
    const renderUsers = (userList) => {
        list.innerHTML = userList.map(u => `
          <li>
            <div>
              <b style="${u.estado === 'suspendido' ? 'color:#EF4444;text-decoration:line-through;' : ''}">${u.nombre_usuario}</b> 
              <span style="color:#94A3B8; font-size:11px;">(${u.email})</span>
            </div>
            <div style="display:flex; gap:5px; align-items:center;">
              <select onchange="changeUserRole(${u.id}, this.value)" class="auth-input" style="width:auto; padding:2px; font-size:11px;">
                <option value="user" ${u.rol==='user'?'selected':''}>User</option>
                <option value="admin" ${u.rol==='admin'?'selected':''}>Admin</option>
              </select>
              <button onclick="changeUserStatus(${u.id}, '${u.estado === 'activo' ? 'suspendido' : 'activo'}')" 
                      style="background:${u.estado === 'activo' ? '#EF4444' : '#10B981'}; border:none; color:white; padding:4px 8px; border-radius:4px; font-size:10px; cursor:pointer;">
                ${u.estado === 'activo' ? 'Suspender' : 'Activar'}
              </button>
            </div>
          </li>
        `).join('');
    };
    
    renderUsers(users);
    
    searchInput.oninput = (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = window.allAdminUsers.filter(u => u.nombre_usuario.toLowerCase().includes(query) || u.email.toLowerCase().includes(query));
        renderUsers(filtered);
    };
    
  } catch(e) { console.error(e); }
}
window.changeUserRole = changeUserRole;
window.changeUserRole = changeUserRole;
async function changeUserRole(id, rol) {
  const token = localStorage.getItem('unigames_token');
  try {
    const res = await fetch('/api/admin/usuarios/'+id+'/rol', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ rol })
    });
    if(res.ok) alert('Rol actualizado correctamente');
    else alert('Error actualizando rol');
  } catch(e) { console.error(e); }
}
function applyTheme(tema) {
  document.body.classList.remove('theme-light', 'theme-blue', 'theme-red');
  if (tema === 'light') {
    document.body.classList.add('theme-light');
  } else if (tema === 'red') {
    document.body.classList.add('theme-red');
  }
}
// Init theme on load
fetch('/api/config').then(r=>r.json()).then(c => { 
  if(c.color_tema) applyTheme(c.color_tema); 
  
  // Configure system banner
  const banner = document.getElementById('systemBanner');
  const bannerText = document.getElementById('systemBannerText');
  if (banner && bannerText) {
      if (c.anuncio_activo === 'true' && c.anuncio_texto) {
          bannerText.textContent = c.anuncio_texto;
          banner.style.display = 'block';
      } else {
          banner.style.display = 'none';
      }
  }

  // Configure Dev Profile Links & Avatars
  const setDevProfile = async (nameText, url) => {
      if (url) {
          // Buscamos el elemento b por su texto en lugar de id
          const nameEl = Array.from(document.querySelectorAll('b')).find(e => e.textContent.includes(nameText));
          if (!nameEl || !nameEl.parentElement) return;
          
          const teamMemberDiv = nameEl.parentElement.parentElement;
          const textDiv = nameEl.parentElement;
          const avatarDiv = teamMemberDiv.querySelector('.team-avatar');
          
          // Aseguramos que el div del texto se pueda expandir y el link quede a la derecha
          textDiv.style.flex = "1";
          
          let linkA = teamMemberDiv.querySelector('.dev-link-icon');
          if (!linkA) {
              // Limpiar links viejos si hubieran
              const oldA = textDiv.querySelector('a');
              if (oldA) oldA.remove();

              linkA = document.createElement('a');
              linkA.className = 'dev-link-icon';
              linkA.target = '_blank';
              
              // Estilo de botoncito arcade
              linkA.style.marginLeft = 'auto'; // Empuja al borde derecho
              linkA.style.display = 'flex';
              linkA.style.alignItems = 'center';
              linkA.style.justifyContent = 'center';
              linkA.style.textDecoration = 'none';
              linkA.style.width = '45px';
              linkA.style.height = '45px';
              linkA.style.backgroundColor = 'rgba(255,255,255,0.03)';
              linkA.style.borderRadius = '8px';
              linkA.style.border = '2px solid rgba(255,255,255,0.08)';
              linkA.style.transition = 'all 0.2s ease';
              
              let isGithub = url.toLowerCase().includes('github.com') || (!url.startsWith('http') && !url.includes('/'));
              let svgPath = isGithub 
                ? 'M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z'
                : 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z';

              linkA.innerHTML = `<svg style="width:1.8rem;height:1.8rem;fill:rgba(255,255,255,0.7);transition:fill 0.2s;" viewBox="0 0 24 24"><path d="${svgPath}"/></svg>`;
              
              // Efectos de hover arcade
              linkA.onmouseover = () => { 
                  linkA.style.backgroundColor = 'var(--yellow)'; 
                  linkA.style.borderColor = 'var(--yellow)'; 
                  linkA.style.boxShadow = '0 0 15px rgba(250, 204, 21, 0.4)';
                  linkA.style.transform = 'scale(1.05)';
                  linkA.querySelector('svg').style.fill = 'var(--bg-dark)'; 
              };
              linkA.onmouseout = () => { 
                  linkA.style.backgroundColor = 'rgba(255,255,255,0.03)'; 
                  linkA.style.borderColor = 'rgba(255,255,255,0.08)'; 
                  linkA.style.boxShadow = 'none';
                  linkA.style.transform = 'scale(1)';
                  linkA.querySelector('svg').style.fill = 'rgba(255,255,255,0.7)'; 
              };

              // Lo adjuntamos AL DIV CONTENEDOR PRINCIPAL (.team-member)
              teamMemberDiv.appendChild(linkA);
          }
          
          let finalUrl = url;
          if (!url.startsWith('http')) {
              finalUrl = 'https://github.com/' + url;
          }
          linkA.href = finalUrl;
          linkA.title = 'Visitar Perfil';
          
          if(avatarDiv) {
              let githubUsername = null;
              if (!url.startsWith('http') && !url.includes('/')) {
                  githubUsername = url;
              } else if (url.includes('github.com/')) {
                  githubUsername = url.split('github.com/')[1].split('/')[0];
              }
              
              if (githubUsername) {
                  try {
                      const res = await fetch('https://api.github.com/users/' + githubUsername);
                      if (res.ok) {
                          const data = await res.json();
                          if (data.avatar_url) {
                              avatarDiv.innerHTML = `<img src="${data.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" alt="${githubUsername}">`;
                          }
                      }
                  } catch(e) { }
              }
          }
      }
  };

  setDevProfile('Rodrigo Antunez', c.github_rodrigo);
  setDevProfile('Veliz Santiago', c.github_santiago);
  setDevProfile('Juarez Kevin', c.github_kevin);
}).catch(()=>{});

window.switchAdminTab = function(tabId) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
    
    event.target.classList.add('active');
    document.getElementById('adminTab' + tabId.charAt(0).toUpperCase() + tabId.slice(1)).style.display = 'block';
    
    if (tabId === 'dashboard') loadAdminDashboard();
    if (tabId === 'usuarios') loadAdminUsers();
    if (tabId === 'avisos') loadAdminAvisos();
    if (tabId === 'juegos') loadAdminJuegos();
    if (tabId === 'config') loadAdminConfig();
};

window.loadAdminDashboard = async function() {
    const token = localStorage.getItem('unigames_token');
    try {
        const res = await fetch('/api/admin/dashboard', { headers: { 'Authorization': 'Bearer ' + token } });
        if(!res.ok) return;
        const stats = await res.json();
        
        document.getElementById('dashboardActivos').textContent = stats.activos;
        document.getElementById('dashboardTotal').textContent = stats.totalUsuarios;
        
        const top5 = document.getElementById('dashboardTop5');
        top5.innerHTML = stats.top5.map((u, i) => `<li>${i+1}. <b>${u.jugador}</b> - ${u.puntosTotales} pts</li>`).join('');
        
        // Chart.js
        const ctx = document.getElementById('gamesChart').getContext('2d');
        if (window.adminChart) window.adminChart.destroy();
        
        window.adminChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: stats.partidasPorJuego.map(p => p.nombre),
                datasets: [{
                    data: stats.partidasPorJuego.map(p => p.cantidad),
                    backgroundColor: ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { color: '#F1F5F9', font: {size: 11} } } }
            }
        });
    } catch(e) { console.error(e); }
};

window.changeUserStatus = async function(id, estado) {
    const token = localStorage.getItem('unigames_token');
    try {
        const res = await fetch(`/api/admin/usuarios/${id}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ estado })
        });
        if(res.ok) loadAdminUsers();
    } catch(e) { console.error(e); }
};

// Easter Egg
let gravityClickCount = 0;
window.triggerEasterEgg = function() {
    gravityClickCount++;
    if (gravityClickCount >= 5) {
        document.body.classList.add('gravity-inverted');
        gravityClickCount = 0;
    }
};
window.restoreGravity = function() {
    document.body.classList.remove('gravity-inverted');
};


// ==========================================
// AVISOS (ADMIN CRUD)
// ==========================================
window.loadAdminAvisos = async function() {
    const token = localStorage.getItem('unigames_token');
    if (!token) return;
    try {
        const res = await fetch('/api/admin/avisos', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error('Error fetching avisos');
        const avisos = await res.json();
        
        const listDiv = document.getElementById('adminAvisosList');
        if (avisos.length === 0) {
            listDiv.innerHTML = '<div style="text-align:center; color:#94A3B8; font-size:12px; padding:10px;">No hay avisos creados.</div>';
            return;
        }
        
        listDiv.innerHTML = avisos.map(aviso => `
            <div style="background:rgba(0,0,0,0.3); border-radius:6px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between; border-left: 4px solid ${aviso.color || '#3b82f6'};">
                <div style="flex:1;">
                    <div style="font-size:13px; color:#F1F5F9; font-weight:600; margin-bottom:4px;">
                        ${aviso.icono || 'ðŸ“¢'} ${aviso.texto}
                    </div>
                    <div style="font-size:10px; color:#94A3B8;">
                        Estado: <span style="color: ${aviso.activo ? '#4ade80' : '#94A3B8'}">${aviso.activo ? 'Activo (MostrÃ¡ndose)' : 'Inactivo'}</span>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    ${aviso.activo ? 
                        `<button onclick="toggleAvisoAdmin(${aviso.id}, false)" style="background:#334155; border:none; color:white; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; font-weight:bold;">Desactivar</button>` : 
                        `<button onclick="toggleAvisoAdmin(${aviso.id}, true)" style="background:#2563eb; border:none; color:white; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; font-weight:bold;">Activar</button>`
                    }
                    <button onclick="eliminarAvisoAdmin(${aviso.id})" style="background:#ef4444; border:none; color:white; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; font-weight:bold;">X</button>
                </div>
            </div>
        `).join('');
        
    } catch(e) {
        console.error(e);
    }
};

window.crearAvisoAdmin = async function() {
    const texto = document.getElementById('adminAvisoNuevoTexto').value.trim();
    const icono = document.getElementById('adminAvisoNuevoIcono').value.trim() || 'ðŸ“¢';
    const color = document.getElementById('adminAvisoNuevoColor').value;
    
    if (!texto) {
        alert("El texto del aviso no puede estar vacÃ­o");
        return;
    }
    
    const token = localStorage.getItem('unigames_token');
    try {
        const res = await fetch('/api/admin/avisos', {
            method: 'POST',
            headers: { 
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ texto, icono, color, activo: false })
        });
        
        if (res.ok) {
            document.getElementById('adminAvisoNuevoTexto').value = '';
            loadAdminAvisos();
        } else {
            alert('Error al crear aviso');
        }
    } catch(e) {
        console.error(e);
    }
};

window.toggleAvisoAdmin = async function(id, activar) {
    const token = localStorage.getItem('unigames_token');
    try {
        const res = await fetch(`/api/admin/avisos/${id}/toggle`, {
            method: 'PUT',
            headers: { 
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ activo: activar })
        });
        
        if (res.ok) {
            loadAdminAvisos();
            // Refrescar el aviso en la UI pÃºblica si es necesario
            loadAvisoPublico();
        }
    } catch(e) {
        console.error(e);
    }
};

window.eliminarAvisoAdmin = async function(id) {
    if (!confirm("Â¿Seguro que deseas eliminar este aviso de forma permanente?")) return;
    
    const token = localStorage.getItem('unigames_token');
    try {
        const res = await fetch(`/api/admin/avisos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (res.ok) {
            loadAdminAvisos();
            loadAvisoPublico();
        }
    } catch(e) {
        console.error(e);
    }
};

window.loadAvisoPublico = async function() {
    try {
        const res = await fetch('/api/avisos/activo');
        if (!res.ok) return;
        const aviso = await res.json();
        
        // Remove existing aviso if any
        const existingAviso = document.getElementById('global-aviso-banner');
        if (existingAviso) existingAviso.remove();
        
        if (aviso) {
            const avisoHTML = `
                <div id="global-aviso-banner" style="background: ${aviso.color || '#3b82f6'}; color: white; text-align: center; padding: 12px 20px; font-weight: 600; font-size: 14px; position: relative; z-index: 50; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); animation: slideDownAviso 0.5s ease-out forwards;">
                    <span style="margin-right:8px; font-size:16px;">${aviso.icono || 'ðŸ“¢'}</span>
                    ${aviso.texto}
                </div>
            `;
            // Insertar justo debajo del header
            const header = document.querySelector('header');
            if (header) {
                header.insertAdjacentHTML('afterend', avisoHTML);
            }
        }
    } catch (e) {
        console.error('Error cargando aviso publico:', e);
    }
};

// Insert slide animation dynamically
const avisoStyle = document.createElement('style');
avisoStyle.textContent = `
@keyframes slideDownAviso {
    from { transform: translateY(-100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
`;
document.head.appendChild(avisoStyle);

// Load it when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // wait a bit for standard init
    setTimeout(loadAvisoPublico, 500);
});

// ==========================================
// ADMIN - CONTENIDO DE JUEGOS (Ahorcado / Adivina la Palabra / Preguntados / Adivina la Cosa)
// ==========================================
window.__jgEditingId = null;
window.__jgTematicas = [];
window.__jgLastItems = [];

function jgEndpoint(tipo) {
    return { ahorcado: 'ahorcado', sopa: 'ahorcado', wordle: 'wordle', termina: 'wordle', preguntas: 'preguntas', adivina: 'adivina' }[tipo];
}

// "Sopa de Letras" y "Termina la Palabra" no tienen tabla propia: reusan
// las palabras de Ahorcado y de Adivina la Palabra respectivamente.
function jgFormFamily(tipo) {
    if (tipo === 'sopa') return 'ahorcado';
    if (tipo === 'termina') return 'wordle';
    return tipo;
}

function jgActualizarNotaCompartida(tipo) {
    const nota = document.getElementById('jgNotaCompartida');
    if (!nota) return;
    if (tipo === 'sopa') {
        nota.textContent = 'â„¹ï¸ Sopa de Letras usa el mismo banco de palabras que Ahorcado.';
        nota.style.display = 'block';
    } else if (tipo === 'termina') {
        nota.textContent = 'â„¹ï¸ Termina la Palabra usa el mismo banco de palabras que Adivina la Palabra.';
        nota.style.display = 'block';
    } else {
        nota.style.display = 'none';
    }
}

async function jgFetchTematicas(force) {
    if (window.__jgTematicas.length && !force) return window.__jgTematicas;
    const token = localStorage.getItem('unigames_token');
    try {
        const res = await fetch('/api/admin/tematicas', { headers: { 'Authorization': 'Bearer ' + token } });
        window.__jgTematicas = res.ok ? await res.json() : [];
    } catch (e) {
        console.error(e);
        window.__jgTematicas = [];
    }
    return window.__jgTematicas;
}

function jgPoblarSelectFiltro() {
    const sel = document.getElementById('juegosTematicaFiltro');
    if (!sel) return;
    const valorActual = sel.value;
    sel.innerHTML = '<option value="">Todas las temÃ¡ticas</option>' +
        window.__jgTematicas.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
    if (valorActual) sel.value = valorActual;
}

function jgOpcionesTematica(incluirNormal) {
    let html = incluirNormal
        ? '<option value="">Normal (sin temÃ¡tica)</option>'
        : '<option value="">-- ElegÃ­ una temÃ¡tica --</option>';
    html += window.__jgTematicas.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
    return html;
}

function jgResetBotones() {
    document.getElementById('juegosSubmitBtn').querySelector('span').textContent = 'Agregar';
    document.getElementById('juegosCancelBtn').style.display = 'none';
}

function renderJuegoForm(tipo) {
    const box = document.getElementById('juegosCamposComunes');
    if (!box) return;
    const familia = jgFormFamily(tipo);

    if (familia === 'ahorcado') {
        box.innerHTML = `
            <div class="auth-form-group">
                <label class="auth-form-label">Palabra</label>
                <input class="auth-input" id="jgPalabra" placeholder="ej: piraÃ±a">
            </div>
            <div class="auth-form-group">
                <label class="auth-form-label">TemÃ¡tica</label>
                <select class="auth-input" id="jgTematica">${jgOpcionesTematica(true)}</select>
            </div>`;
    } else if (familia === 'wordle') {
        box.innerHTML = `
            <div class="auth-form-group">
                <label class="auth-form-label">Palabra</label>
                <input class="auth-input" id="jgPalabra" placeholder="ej: mundo">
            </div>
            <div class="auth-form-group">
                <label class="auth-form-label">TemÃ¡tica</label>
                <select class="auth-input" id="jgTematica">${jgOpcionesTematica(false)}</select>
            </div>`;
    } else if (familia === 'preguntas') {
        box.innerHTML = `
            <div class="auth-form-group">
                <label class="auth-form-label">TemÃ¡tica</label>
                <select class="auth-input" id="jgTematica">${jgOpcionesTematica(false)}</select>
            </div>
            <div class="auth-form-group">
                <label class="auth-form-label">Pregunta</label>
                <input class="auth-input" id="jgPregunta" placeholder="Â¿CuÃ¡l es...?">
            </div>
            <div class="auth-form-group" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <input class="auth-input" id="jgOpcionA" placeholder="OpciÃ³n A">
                <input class="auth-input" id="jgOpcionB" placeholder="OpciÃ³n B">
                <input class="auth-input" id="jgOpcionC" placeholder="OpciÃ³n C">
                <input class="auth-input" id="jgOpcionD" placeholder="OpciÃ³n D">
            </div>
            <div class="auth-form-group">
                <label class="auth-form-label">Respuesta correcta</label>
                <select class="auth-input" id="jgRespuestaCorrecta">
                    <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                </select>
            </div>`;
    } else if (familia === 'adivina') {
        box.innerHTML = `
            <div class="auth-form-group">
                <label class="auth-form-label">TemÃ¡tica</label>
                <select class="auth-input" id="jgTematica">${jgOpcionesTematica(false)}</select>
            </div>
            <div class="auth-form-group">
                <label class="auth-form-label">Respuesta</label>
                <input class="auth-input" id="jgRespuesta" placeholder="ej: Mario">
            </div>
            <div class="auth-form-group">
                <label class="auth-form-label">Alias (separados por coma)</label>
                <input class="auth-input" id="jgAliases" placeholder="mario, super mario">
            </div>
            <div class="auth-form-group">
                <label class="auth-form-label">Imagen (URL)</label>
                <input class="auth-input" id="jgImagen" placeholder="https://...">
            </div>
            <div class="auth-form-group" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <input class="auth-input" id="jgPista1" placeholder="Pista 1">
                <input class="auth-input" id="jgPista2" placeholder="Pista 2">
                <input class="auth-input" id="jgPista3" placeholder="Pista 3">
                <input class="auth-input" id="jgPista4" placeholder="Pista 4">
            </div>`;
    }
}

window.loadAdminJuegos = async function() {
    await jgFetchTematicas();
    jgPoblarSelectFiltro();
    const tipoSelect = document.getElementById('juegosTipoSelect');
    switchJuegoTipo(tipoSelect ? tipoSelect.value : 'ahorcado');
};

window.switchJuegoTipo = async function(tipo) {
    window.__jgEditingId = null;
    jgResetBotones();
    await jgFetchTematicas();
    jgActualizarNotaCompartida(tipo);
    renderJuegoForm(tipo);
    loadJuegosContenidoList();
};

function jgValidarYArmarPayload(tipo) {
    const val = (id) => (document.getElementById(id) || {}).value ?? '';
    const familia = jgFormFamily(tipo);

    if (familia === 'ahorcado') {
        const palabra = val('jgPalabra').trim();
        if (!palabra) { alert('La palabra es requerida'); return null; }
        return { palabra, tematica_id: val('jgTematica') || null };
    }
    if (familia === 'wordle') {
        const palabra = val('jgPalabra').trim();
        const tematica_id = val('jgTematica');
        if (!palabra) { alert('La palabra es requerida'); return null; }
        if (!tematica_id) { alert('ElegÃ­ una temÃ¡tica'); return null; }
        return { palabra, tematica_id };
    }
    if (familia === 'preguntas') {
        const tematica_id = val('jgTematica');
        const pregunta = val('jgPregunta').trim();
        const opcion_a = val('jgOpcionA').trim();
        const opcion_b = val('jgOpcionB').trim();
        const opcion_c = val('jgOpcionC').trim();
        const opcion_d = val('jgOpcionD').trim();
        if (!tematica_id) { alert('ElegÃ­ una temÃ¡tica'); return null; }
        if (!pregunta) { alert('La pregunta es requerida'); return null; }
        if (!opcion_a || !opcion_b || !opcion_c || !opcion_d) { alert('Las 4 opciones son requeridas'); return null; }
        return { tematica_id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta: val('jgRespuestaCorrecta') };
    }
    if (familia === 'adivina') {
        const tematica_id = val('jgTematica');
        const respuesta = val('jgRespuesta').trim();
        if (!tematica_id) { alert('ElegÃ­ una temÃ¡tica'); return null; }
        if (!respuesta) { alert('La respuesta es requerida'); return null; }
        return {

            tematica_id,
            respuesta,
            aliases: val('jgAliases').split(',').map(s => s.trim()).filter(Boolean),
            imagen: val('jgImagen').trim(),
            pistas: [1, 2, 3, 4].map(n => val('jgPista' + n).trim())
        };
    }
    return null;
}

window.guardarContenidoJuego = async function() {
    const tipo = document.getElementById('juegosTipoSelect').value;
    const payload = jgValidarYArmarPayload(tipo);
    if (!payload) return;

    const token = localStorage.getItem('unigames_token');
    const endpoint = '/api/admin/' + jgEndpoint(tipo) + (window.__jgEditingId ? '/' + window.__jgEditingId : '');
    const method = window.__jgEditingId ? 'PUT' : 'POST';

    try {
        const res = await fetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Error al guardar'); return; }
        cancelarEdicionJuego();
        loadJuegosContenidoList();
    } catch (e) {
        console.error(e);
        alert('Error de conexiÃ³n');
    }
};

window.cancelarEdicionJuego = function() {
    window.__jgEditingId = null;
    jgResetBotones();
    renderJuegoForm(document.getElementById('juegosTipoSelect').value);
};

window.editarContenidoJuegoPorId = function(tipo, id) {
    const item = window.__jgLastItems.find(i => i.id === id);
    if (!item) return;

    window.__jgEditingId = item.id;
    renderJuegoForm(tipo);
    const familia = jgFormFamily(tipo);

    const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };

    if (familia === 'ahorcado' || familia === 'wordle') {
        set('jgPalabra', item.palabra);
        set('jgTematica', item.tematica_id ?? '');
    } else if (familia === 'preguntas') {
        set('jgTematica', item.tematica_id ?? '');
        set('jgPregunta', item.pregunta);
        set('jgOpcionA', item.opcion_a);
        set('jgOpcionB', item.opcion_b);
        set('jgOpcionC', item.opcion_c);
        set('jgOpcionD', item.opcion_d);
        set('jgRespuestaCorrecta', item.respuesta_correcta);
    } else if (familia === 'adivina') {
        set('jgTematica', item.tematica_id ?? '');
        set('jgRespuesta', item.respuesta);
        set('jgAliases', (item.aliases || []).join(', '));
        set('jgImagen', item.imagen);
        (item.pistas || []).forEach((p, i) => set('jgPista' + (i + 1), p));
    }

    document.getElementById('juegosSubmitBtn').querySelector('span').textContent = 'Guardar cambios';
    document.getElementById('juegosCancelBtn').style.display = 'inline-block';
    document.querySelector('.admin-juegos-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.eliminarContenidoJuego = async function(tipo, id) {
    if (!confirm('Â¿Eliminar este elemento de forma permanente?')) return;
    const token = localStorage.getItem('unigames_token');
    try {
        const res = await fetch('/api/admin/' + jgEndpoint(tipo) + '/' + id, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.ok) {
            if (window.__jgEditingId === id) cancelarEdicionJuego();
            loadJuegosContenidoList();
        } else {
            alert('Error al eliminar');
        }
    } catch (e) {
        console.error(e);
    }
};

window.loadJuegosContenidoList = async function() {
    const tipo = document.getElementById('juegosTipoSelect').value;
    const tematicaFiltro = document.getElementById('juegosTematicaFiltro').value;
    const token = localStorage.getItem('unigames_token');
    const listBox = document.getElementById('juegosContenidoList');
    listBox.innerHTML = '<div style="text-align:center; color:#94A3B8; font-size:12px; padding:10px;">Cargando...</div>';

    let url = '/api/admin/' + jgEndpoint(tipo);
    if (tematicaFiltro) url += '?tematica_id=' + tematicaFiltro;

    try {
        const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
        if (!res.ok) { listBox.innerHTML = '<div style="color:#FCA5A5; font-size:12px;">Error cargando contenido</div>'; return; }
        const items = await res.json();
        window.__jgLastItems = items;

        if (!items.length) {
            listBox.innerHTML = '<div style="text-align:center; color:#94A3B8; font-size:12px; padding:10px;">No hay elementos cargados.</div>';
            return;
        }

        const temaNombre = (id) => {
            if (id === null || id === undefined || id === '') return 'Normal';
            const t = window.__jgTematicas.find(t => t.id == id);
            return t ? t.nombre : ('#' + id);
        };

        listBox.innerHTML = items.map(item => {
            const familia = jgFormFamily(tipo);
            let titulo = '';
            if (familia === 'ahorcado' || familia === 'wordle') titulo = item.palabra;
            if (familia === 'preguntas') titulo = item.pregunta;
            if (familia === 'adivina') titulo = item.respuesta;

            return `
                <div style="background:rgba(0,0,0,0.3); border-radius:6px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:6px;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:13px; color:#F1F5F9; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${titulo}</div>
                        <div style="font-size:10px; color:#94A3B8;">TemÃ¡tica: ${temaNombre(item.tematica_id)}</div>
                    </div>
                    <div style="display:flex; gap:6px; flex-shrink:0;">
                        <button class="admin-btn-small" style="background:#2563eb;" onclick="editarContenidoJuegoPorId('${tipo}', ${item.id})">Editar</button>
                        <button class="admin-btn-small" style="background:#ef4444;" onclick="eliminarContenidoJuego('${tipo}', ${item.id})">Eliminar</button>
                    </div>
                </div>`;
        }).join('');
    } catch (e) {
        console.error(e);
        listBox.innerHTML = '<div style="color:#FCA5A5; font-size:12px;">Error de conexiÃ³n</div>';
    }
};

