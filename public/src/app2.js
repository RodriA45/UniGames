window.onerror = function(msg, url, line, col, err) {
  alert("Error: " + msg + " at line " + line);
  return false;
};
// ══════════════════════════════════════
//   UniGames — app.js
// ══════════════════════════════════════

let currentUser = null;

// === AUTO-LOGIN DEV ===
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('dev_token') && urlParams.has('dev_user')) {
  localStorage.setItem('unigames_token', urlParams.get('dev_token'));
  localStorage.setItem('unigames_user', decodeURIComponent(urlParams.get('dev_user')));
  window.history.replaceState({}, document.title, "/");
  // Refrescar para aplicar los cambios de sesión de inmediato
  window.location.reload();
}
// ======================
// ─── Audio Manager ─────────────────────
let globalAudioEnabled = true;
let pageMusicMuted = false;

// Volumen de música/efectos — 0 a 1, persistido en localStorage para que
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

// El audio arranca "activado" por defecto (icono 🔊) e intenta reproducirse
// apenas carga la página.
function initAudio() {
  const btn = document.getElementById('globalAudioBtn');
  if (btn) btn.innerHTML = '<svg style="width:1.8rem;height:1.8rem;fill:#FFF;filter:drop-shadow(0 0 2px rgba(255,255,255,0.8));" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
  attemptPlayMusic();
}

// Los navegadores bloquean bgMusic.play() si no hay un gesto del usuario
// (click/tap/tecla) todavía. Por eso al entrar a la página la música no
// se escuchaba: play() fallaba en silencio (solo el console.log del catch).
// attemptPlayMusic() intenta reproducir y, si el navegador lo bloquea,
// arma un listener para arrancar apenas el usuario interactúe con la
// página por primera vez (no hace falta que toque el botón de audio).
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
    document.getElementById('globalAudioBtn').innerHTML = '<svg style="width:1.8rem;height:1.8rem;fill:#FFF;filter:drop-shadow(0 0 2px rgba(255,255,255,0.8));" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
    unmutepageMusic();
  } else {
    document.getElementById('globalAudioBtn').innerHTML = '<svg style="width:1.8rem;height:1.8rem;fill:#FFF;filter:drop-shadow(0 0 2px rgba(255,255,255,0.8));" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
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

// Reproduce una pista de música de fondo (menú o juego).
// Solo cambia el src si es distinto para no reiniciar la reproducción,
// y siempre intenta reproducir (dentro de un gesto del usuario).
let currentMusicSrc = null;
function setMusic(src, forceRestart) {
  if (currentMusicSrc !== src) {
    currentMusicSrc = src;
    bgMusic.src = src;
  } else if (forceRestart) {
    // Mismo track, pero se pide arrancar desde 0 (ej: reintentar un nivel
    // después de perder, en vez de seguir donde había quedado sonando).
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

// ─── Datos de juegos ───────────────────
const allGames = [
  { id: 'sopa', emoji: '🔍', title: 'Sopa de Letras',    desc: 'Encontrá palabras ocultas en la grilla. Mientras más rápido, más puntos ganás.', tag: '⏱ Velocidad' },
  { id: 'preguntados', emoji: '❓', title: 'Preguntados',        desc: 'Trivia de múltiple opción. Respondé preguntas sobre tu temática favorita.',       tag: '🧠 Trivia'    },
  { id: 'termina', emoji: '🔤', title: 'Termina la Palabra', desc: 'Adiviná la palabra incompleta. Tenés solo 5 intentos. ¡Pensá bien!',             tag: '🎯 5 intentos' },
  { id: 'ahorcado', emoji: '💀', title: 'Ahorcado',           desc: 'El clásico de siempre, ahora con temáticas. Letra por letra antes de que se complete el dibujo.', tag: '⚡ Clásico'   },
  { id: 'adivina', emoji: '🕵️', title: 'Adivina la Cosa',   desc: 'Pistas progresivas para adivinar un juego, película, actor o anime.',           tag: '🔎 Pistas'    },
  { id: 'wordle', emoji: '🟩', title: 'Adivina la Palabra', desc: 'Modo difícil estilo Wordle. 5 intentos, colores que te dan pistas letra por letra.', tag: '🔥 Hard'     },
];

// Los juegos de acción (jugables con el motor 2D): Pixel Runner, Castle
// Escape y RPG Pixel. Se usan en "Juegos Destacados" y "Juegos de Acción".
const actionGames = [
  { id: 'runner', emoji: '🏃', title: 'Pixel Runner',     desc: 'Corré sin parar, esquivá obstáculos del suelo y del cielo. Doble salto y velocidad creciente.', tag: '⚡ Acción'   },
  { id: 'castle_escape', emoji: '🏰', title: 'Castle Escape',    desc: 'Saltá plataformas, esquivá trampas y llegá a la salida de los 20 niveles del castillo.',   tag: '🏰 Aventura' },
  { id: 'rpg_pixel', emoji: '🗡️', title: 'RPG Pixel',         desc: 'Combatí contra jefes pixel art: dispará y bloqueá con el escudo en arenas fijas.',         tag: '⚔️ Combate'  },
];

// Los 3 juegos sencillos fijos que se muestran siempre en el inicio.
const SIMPLE_GAME_IDS = ['sopa', 'ahorcado', 'preguntados'];

// ─── Utilidades ────────────────────────
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ─── Inicio: juegos destacados aleatorios ───
function gameCardHTML(g) {
  return `
    <div class="game-card" onclick="launchGame('${g.id}', this)">
      <div class="card-emoji">${g.emoji}</div>
      <div class="card-title">${g.title}</div>
      <p class="card-desc">${g.desc}</p>
      <span class="card-tag">${g.tag}</span>
      <button class="btn-play">▶ Jugar ahora</button>
    </div>
  `;
}

// Destacados: 3 al azar de TODOS los juegos (clásicos + de acción).
function renderFeatured() {
  const pool = [...allGames, ...actionGames];
  const three = shuffle(pool).slice(0, 3);
  document.getElementById('featuredGrid').innerHTML = three.map(gameCardHTML).join('');
}

// Juegos sencillos: 3 fijos (definidos en SIMPLE_GAME_IDS).
function renderSimple() {
  const list = SIMPLE_GAME_IDS.map(id => allGames.find(g => g.id === id)).filter(Boolean);
  document.getElementById('simpleGrid').innerHTML = list.map(gameCardHTML).join('');
}

// Juegos de acción: los jugables con el motor 2D.
function renderAction() {
  document.getElementById('actionGrid').innerHTML = actionGames.map(gameCardHTML).join('');
}

function scrollToGame(gameId) {
  // Cambiar a la pestaña de juegos manualmente para evitar conflicto de scroll
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('sec-juegos');
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

// ─── Guardar HTML original de secciones que reemplazan su contenido ───
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

// ─── Navegación entre secciones ────────
function goTo(section) {
  // Ocultar todas las secciones
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  // Mostrar la sección solicitada
  document.getElementById('sec-' + section).classList.add('active');

  // Actualizar link activo en el menú (solo para las secciones del nav)
  const links = document.querySelectorAll('.nav-menu a');
  const map = { inicio: 0, juegos: 1, puntuacion: 2 };
  links.forEach(a => a.classList.remove('active'));
  // Para pantallas de juego, mantener "Juegos" activo
  const navIdx = map[section] !== undefined ? map[section] : map['juegos'];
  if (links[navIdx]) links[navIdx].classList.add('active');

  // Refrescar leaderboard al navegar a la sección de puntuación
  if (section === 'puntuacion') fetchLeaderboard();

  // Restaurar HTML original de secciones de juego al volver a la grilla
  if (section === 'juegos') {
    ['preguntados', 'sopa', 'termina'].forEach(restoreOriginalSection);
  }

if (section === 'runner' || section === 'castle_escape' || section === 'rpg_pixel') {
    // Estos juegos manejan su propia música (la ponen ellos mismos vía
    // setMusic al mostrar su menú). Ojo: NO llamar a mutePageMusic() acá,
    // porque deja pageMusicMuted = true y el setMusic() que viene justo
    // después (showRunnerMenu / initTrampas / rpgInit) queda bloqueado hasta
    // que el usuario mutea y desmutea manualmente.
    unmutepageMusic();
    if (section === 'castle_escape' && typeof initTrampas === 'function') initTrampas();
    if (section === 'rpg_pixel' && typeof rpgInit === 'function') rpgInit();
  } else {
    // Cualquier otra sección usa la música ambiente del sitio: la reactivamos
    unmutepageMusic();
    if (typeof changeBgMusic === 'function') changeBgMusic('menu.mp3');
  }

  closeNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Menú hamburguesa ──────────────────
const hamburger = document.getElementById('hamburger');
const navMenu   = document.getElementById('navMenu');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navMenu.classList.toggle('open');
  const backdrop = document.getElementById('drawerBackdrop');
  if (backdrop) backdrop.classList.toggle('open');
});

function closeNav() {
  hamburger.classList.remove('open');
  navMenu.classList.remove('open');
  const backdrop = document.getElementById('drawerBackdrop');
  if (backdrop) backdrop.classList.remove('open');
}

function toggleAccountDrawer() {
  const drawer = document.getElementById('accountDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  if (drawer) drawer.classList.toggle('open');
  if (backdrop) backdrop.classList.toggle('open');
}

function closeAccountDrawer() {
  const drawer = document.getElementById('accountDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}

function iniciarJuego(gameKey) {
  launchGame(gameKey, null);
}

// ─── Carteles internos del Pixel Runner (Mejoras / Ajustes / Cómo jugar) ───
// Reemplazan los alert() del navegador: son paneles que se muestran arriba
// del menú del juego, dentro del mismo recuadro. Todos comparten
// cerrarPanelesRunner() para volver al menú.
function cerrarPanelesRunner() {
  ['runnerMejorasPanel', 'runnerAjustesPanel', 'runnerComoJugarPanel', 'runnerModePanel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

// ─── Selección de modo (Historia / Infinito) ───
// Se muestra al tocar "Jugar" en el menú de Pixel Runner. Infinito arranca
// bloqueado hasta completar Historia (llegar a los 2500 pts), estado que
// persiste en localStorage (ver loadHistoriaCompleta/saveHistoriaCompleta
// en pixelrunner.js).
function mostrarModoRunner() {
  const desbloqueado = typeof loadHistoriaCompleta === 'function' && loadHistoriaCompleta();
  const btnInfinito = document.getElementById('runnerModoInfinitoBtn');
  const descInfinito = document.getElementById('runnerModoInfinitoDesc');
  if (btnInfinito) btnInfinito.classList.toggle('locked', !desbloqueado);
  if (descInfinito) {
    descInfinito.textContent = desbloqueado
      ? 'Sin límite de puntos, ¡aguantá lo más que puedas!'
      : '🔒 Completá Historia para desbloquear';
  }
  const panel = document.getElementById('runnerModePanel');
  if (panel) panel.classList.remove('hidden');
}

function elegirModoRunner(mode) {
  if (mode === 'infinito' && !(typeof loadHistoriaCompleta === 'function' && loadHistoriaCompleta())) {
    return; // sigue bloqueado, no hace nada
  }
  cerrarPanelesRunner();
  if (mode === 'historia' && typeof RUNNER_COMICS !== 'undefined') {
    // Historia arranca con un cómic de intro; recién al tocar "Continuar"
    // se inicializa el juego de verdad.
    showRunnerComic(RUNNER_COMICS.intro, () => startPixelRunnerGame('historia'));
  } else {
    startPixelRunnerGame(mode);
  }
}

// ─── Panel de Mejoras (tienda de mejoras permanentes con monedas) ───
// El estado real (niveles, compradas, monedas) vive en pixelrunner.js
// (RUNNER.upgrades / RUNNER.totalCoins + localStorage). Acá solo se arma
// el HTML del panel a partir de ese estado, cada vez que se abre o se
// compra algo — así siempre se ve al día.
const RUNNER_UPGRADE_DEFS = [
  {
    tipo: 'shieldDuration',
    icon: '🛡️',
    nombre: 'Duración del Escudo',
    tipoNivel: true,
    formatEfecto: (nivel) => `Dura ${15 + nivel} seg`,
  },
  {
    tipo: 'x2Duration',
    icon: '⚡',
    nombre: 'Duración del x2',
    tipoNivel: true,
    formatEfecto: (nivel) => `Dura ${15 + nivel} seg`,
  },
  {
    tipo: 'shieldHits',
    icon: '🛡️✨',
    nombre: 'Escudo Reforzado',
    tipoNivel: false,
    costo: 1000,
    descripcion: 'El escudo aguanta 2 golpes en vez de 1',
  },
  {
    tipo: 'x2Triple',
    icon: '🔥',
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
          <div class="runner-mejora-efecto">${maxed ? efectoActual : (efectoActual + ' → ' + efectoSiguiente)}</div>
        </div>
        <button class="runner-mejora-btn" ${maxed || !puedeComprar ? 'disabled' : ''} onclick="comprarMejora('${def.tipo}')">
          ${maxed ? 'MÁX' : ('🪙 ' + costo)}
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
          ${comprado ? '✔ Comprado' : ('🪙 ' + def.costo)}
        </button>
      </div>`;
  }
}

function renderMejoras() {
  const grid = document.getElementById('runnerMejorasGrid');
  if (!grid || typeof refreshRunnerUpgrades !== 'function') return;
  const upgrades = refreshRunnerUpgrades();
  const coins = typeof loadTotalCoins === 'function' ? loadTotalCoins() : 0;
  grid.innerHTML = RUNNER_UPGRADE_DEFS.map(def => mejoraCardHtml(def, upgrades, coins)).join('');
}

function comprarMejora(tipo) {
  if (typeof buyRunnerUpgrade !== 'function') return;
  buyRunnerUpgrade(tipo); // ya valida costo/máximo adentro; si no se pudo, simplemente no cambia nada
  mostrarMejoras(); // re-renderiza con las monedas y niveles actualizados
}

function mostrarMejoras() {
  // RUNNER / loadTotalCoins vienen de pixelrunner.js (mismo scope global).
  // Se relee siempre de localStorage para no mostrar datos viejos si el
  // panel se abre antes de que arranque una partida en esta sesión.
  const coinsEl = document.getElementById('runnerMejorasCoinsTotal');
  const total = typeof loadTotalCoins === 'function' ? loadTotalCoins() : 0;
  if (coinsEl) coinsEl.textContent = total;
  renderMejoras();
  const panel = document.getElementById('runnerMejorasPanel');
  if (panel) panel.classList.remove('hidden');
}

function mostrarAjustes() {
  const musicSlider = document.getElementById('runnerMusicVolume');
  const sfxSlider   = document.getElementById('runnerSfxVolume');
  const musicValue  = document.getElementById('runnerMusicVolumeValue');
  const sfxValue    = document.getElementById('runnerSfxVolumeValue');
  const musicPct = Math.round(getGlobalMusicVolume() * 100);
  const sfxPct   = Math.round(getGlobalSfxVolume() * 100);
  if (musicSlider) musicSlider.value = musicPct;
  if (sfxSlider)   sfxSlider.value = sfxPct;
  if (musicValue)  musicValue.textContent = musicPct + '%';
  if (sfxValue)    sfxValue.textContent = sfxPct + '%';
  runnerSyncFullscreenBtn();
  const panel = document.getElementById('runnerAjustesPanel');
  if (panel) panel.classList.remove('hidden');
}

function runnerOnMusicVolumeChange(value) {
  const pct = parseInt(value, 10) || 0;
  setGlobalMusicVolume(pct / 100);
  const label = document.getElementById('runnerMusicVolumeValue');
  if (label) label.textContent = pct + '%';
}

function runnerOnSfxVolumeChange(value) {
  const pct = parseInt(value, 10) || 0;
  setGlobalSfxVolume(pct / 100);
  const label = document.getElementById('runnerSfxVolumeValue');
  if (label) label.textContent = pct + '%';
}

// ─── Pantalla completa (panel de Ajustes) ───
// Pone en fullscreen el .runner-container (canvas + HUD + overlays), no
// toda la página, para no perder los carteles/menús que viven dentro de
// ese mismo contenedor. runnerSyncFullscreenBtn() mantiene el texto del
// botón al día tanto si el cambio lo dispara este botón como si el
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
  const row = document.getElementById('runnerFullscreenRow');
  if (row) row.classList.toggle('unsupported', !runnerFullscreenSupported());
  const btn = document.getElementById('runnerFullscreenBtn');
  if (!btn) return;
  btn.textContent = runnerGetFullscreenElement() ? 'Salir' : 'Activar';
}

document.addEventListener('fullscreenchange', runnerSyncFullscreenBtn);
document.addEventListener('webkitfullscreenchange', runnerSyncFullscreenBtn);

function mostrarComoJugar() {
  const panel = document.getElementById('runnerComoJugarPanel');
  if (panel) panel.classList.remove('hidden');
}

// ─── Modal login / registro ────────────
function openModal(tab) {
  document.getElementById('modalOverlay').classList.add('open');
  switchTab(tab || 'login');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  // Limpiar inputs al cerrar
  const inputs = ['loginIdentity', 'loginPassword', 'regUsername', 'regEmail', 'regPassword'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabRegister').classList.toggle('active', !isLogin);
  document.getElementById('auth-section-login').classList.toggle('active', isLogin);
  document.getElementById('auth-section-register').classList.toggle('active', !isLogin);
}

function showAuthAlert(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'auth-alert ' + type + ' show';
  setTimeout(() => el.classList.remove('show'), 4000);
}

// ─── Selector de temática ──────────────
function selectTheme(btn) {
  const parent = btn.closest('.theme-selector');
  parent.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

// ─── Juegos: próximamente ──────────────
function proximamente() {
  alert('🚧 ¡Próximamente!\n\nEste juego está en desarrollo. Iniciá sesión para ser notificado cuando esté listo.');
}

// ─── Lanzar juego desde la card ────────
function launchGame(gameKey, btn) {
  const card = btn ? btn.closest('.game-card-full') : null;
  const selected = card ? card.querySelector('.theme-btn.selected') : null;
  const theme = selected ? selected.textContent.trim() : null;
  const tematicaId = card ? card.querySelector('.theme-btn.selected')?.dataset.tematica : null;

  goTo(gameKey);

  const labelId = gameKey + '-theme-label';
  const labelEl = document.getElementById(labelId);
  if (labelEl) labelEl.textContent = theme || '';

  if (gameKey === 'ahorcado')    initAhorcado(tematicaId);
  if (gameKey === 'wordle')      initWordle(tematicaId);
  if (gameKey === 'runner')      showRunnerMenu();
  if (gameKey === 'preguntados') {
    const tId = tematicaId && /^\d+$/.test(tematicaId) ? Number(tematicaId) : TEMATICA_MAP[theme] || 1;
    initPreguntados(tId);
  }
  if (gameKey === 'sopa') {
    const tId = tematicaId && /^\d+$/.test(tematicaId) ? Number(tematicaId) : TEMATICA_MAP[theme] || 1;
    initSopa(tId);
  }
  if (gameKey === 'termina') {
    const tId = tematicaId && /^\d+$/.test(tematicaId) ? Number(tematicaId) : TEMATICA_MAP[theme] || 1;
    initTermina(tId);
  }
  if (gameKey === 'adivina') {
    const tId = tematicaId && /^\d+$/.test(tematicaId) ? Number(tematicaId) : TEMATICA_MAP[theme] || 1;
    initAdivina(tId);
  }
}

// ══════════════════════════════════════
//   AHORCADO
// ══════════════════════════════════════

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

async function initAhorcado(tematicaId) {
  // Si no se pasa temática (ej. botón "Nueva palabra"), se reusa la última usada
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
    const sec = document.getElementById('sec-ahorcado');
    if (sec) {
      sec.innerHTML = `
        <div class="game-screen-header">
          <button class="btn-back" onclick="goTo('juegos')">← Volver a Juegos</button>
          <div class="game-screen-title"><span>💀</span> Ahorcado</div>
          <div class="game-screen-theme">${TEMATICA_NAMES[tematicaId]||'Normal'}</div>
        </div>
        <div class="coming-soon-box" style="margin-top:2rem;">
          <h2>Sin palabras</h2>
          <p>Aún no hay palabras cargadas para esta temática. (Recordá correr python crear_bd.py)</p>
          <button class="btn-play" style="margin-top:20px" onclick="goTo('juegos')">← Volver a Juegos</button>
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
  document.getElementById('ahorcado-status').textContent = '';
  document.getElementById('ahorcado-status').className = 'ahorcado-status';
}

function renderAhorcadoWord() {
  const { word, revealed } = ahorcadoState;
  document.getElementById('ahorcado-word').innerHTML = word.split('').map(l => {
    const show = revealed.includes(l);
    return `<div class="letter-box">${show ? l.toUpperCase() : ''}</div>`;
  }).join('');
}

function renderAhorcadoKeyboard() {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  document.getElementById('ahorcado-keyboard').innerHTML = letters.map(l => {
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
    const statusEl = document.getElementById('ahorcado-status');
    const tIdRaw = ahorcadoState.tematicaId;
    const tId = (tIdRaw && tIdRaw !== 'normal') ? Number(tIdRaw) : null;
    if (won) {
      statusEl.textContent = '🎉 ¡Ganaste! La palabra era: ' + word.toUpperCase();
      statusEl.className = 'ahorcado-status win';
      const puntos = 1000 - (ahorcadoState.wrong.length * 150);
      guardarPuntaje(4, puntos, tId); // juego_id = 4 (Ahorcado)
    } else {
      // Revelar todas las letras al perder
      ahorcadoState.revealed = word.split('');
      statusEl.textContent = '💀 ¡Perdiste! La palabra era: ' + word.toUpperCase();
      statusEl.className = 'ahorcado-status lose';
      if (typeof playDeathSound === 'function') playDeathSound();
      guardarPuntaje(4, 50, tId); // 50 puntos consuelo
    }
  }

  renderAhorcadoWord();
  renderAhorcadoKeyboard();
}

// ══════════════════════════════════════
//   ADIVINA LA PALABRA (estilo Wordle, hard, con temática)
// ══════════════════════════════════════

const WORDLE_MAX_ATTEMPTS = 5;
const WORDLE_TEMATICAS = { 1: 'Videojuegos', 2: 'Películas', 3: 'Anime', 4: 'Programación' };

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
  const sec = document.getElementById('sec-wordle');
  if (!sec || !sec.classList.contains('active')) return;
  if (wordleState.finished) return;
  const key = e.key;
  if (key === 'Enter') { wordleSubmit(); return; }
  if (key === 'Backspace') { wordleBackspace(); return; }
  if (/^[a-zA-ZñÑ]$/.test(key)) { wordleAddLetter(key.toLowerCase()); }
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
    const sec = document.getElementById('sec-wordle');
    if (sec) {
      sec.innerHTML = `
        <div class="game-screen-header">
          <button class="btn-back" onclick="goTo('juegos')">← Volver a Juegos</button>
          <div class="game-screen-title"><span>📝</span> Adivina la Palabra</div>
          <div class="game-screen-theme">${TEMATICA_NAMES[tematicaId]||''}</div>
        </div>
        <div class="coming-soon-box" style="margin-top:2rem;">
          <h2>Sin palabras</h2>
          <p>Aún no hay palabras cargadas para esta temática. (Recordá correr python crear_bd.py)</p>
          <button class="btn-play" style="margin-top:20px" onclick="goTo('juegos')">← Volver a Juegos</button>
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

  const labelEl = document.getElementById('wordle-theme-label');
  if (labelEl) labelEl.textContent = WORDLE_TEMATICAS[tematicaId] || '';

  document.getElementById('wordle-hint').textContent =
    word === 'error'
      ? 'No se pudo cargar la palabra. Probá de nuevo.'
      : `La palabra tiene ${word.length} letras. Tenés ${WORDLE_MAX_ATTEMPTS} intentos.`;
  document.getElementById('wordle-status').textContent = '';
  document.getElementById('wordle-status').className = 'wordle-status';

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

  document.getElementById('wordle-board').innerHTML = html;
}

function renderWordleKeyboard() {
  const letters = 'qwertyuiopasdfghjklzxcvbnm'.split('');
  const { keyColors, finished } = wordleState;
  document.getElementById('wordle-keyboard').innerHTML = letters.map(l => {
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
  const statusEl = document.getElementById('wordle-status');

  if (currentGuess.length < length) {
    statusEl.textContent = `Completá la palabra (${length} letras).`;
    statusEl.className = 'wordle-status warn';
    return;
  }

  // ── Algoritmo de colores estilo Wordle (maneja letras repetidas) ──
  const guessLetters = currentGuess.split('');
  const wordLetters = word.split('');
  const colors = new Array(length).fill('absent');
  const remaining = {};

  wordLetters.forEach(l => { remaining[l] = (remaining[l] || 0) + 1; });

  // 1° pasada: verdes (posición exacta)
  for (let i = 0; i < length; i++) {
    if (guessLetters[i] === wordLetters[i]) {
      colors[i] = 'correct';
      remaining[guessLetters[i]]--;
    }
  }
  // 2° pasada: amarillos (la letra está, en otro lugar)
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

  if (won) {
    wordleState.finished = true;
    statusEl.textContent = '🎉 ¡La adivinaste! Era: ' + word.toUpperCase();
    statusEl.className = 'wordle-status win';
    const intentosUsados = wordleState.currentRow;
    const puntos = Math.max(1500 - (intentosUsados - 1) * 250, 250);
    guardarPuntaje(6, puntos, tId); // juego_id = 6 (Adivina la Palabra)
  } else if (lost) {
    wordleState.finished = true;
    statusEl.textContent = '💀 ¡Se acabaron los intentos! Era: ' + word.toUpperCase();
    statusEl.className = 'wordle-status lose';
    guardarPuntaje(6, 50, tId); // puntos consuelo
  } else {
    statusEl.textContent = '';
  }

  wordleState.currentGuess = '';
  renderWordleBoard();
  renderWordleKeyboard();
}

// ─── Inicialización ────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Año dinámico en el footer
  document.getElementById('year').textContent = new Date().getFullYear();

  // Restaurar sesión desde localStorage
  try {
    const savedUser = localStorage.getItem('unigames_user');
    const savedToken = localStorage.getItem('unigames_token');
    if (savedUser && savedToken) {
      currentUser = JSON.parse(savedUser);
      updateAuthUI();
    }
  } catch (e) {
    localStorage.removeItem('unigames_user');
    localStorage.removeItem('unigames_token');
  }

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

  // Evitar recarga en links del menú
  document.querySelectorAll('.nav-menu a').forEach(a => {
    a.addEventListener('click', e => e.preventDefault());
  });

  // Inicializar audio al cargar la página
  initAudio();

  // Cargar tabla de posiciones desde la API
  fetchLeaderboard();
});

// ─── Lógica de API (Backend) ───────────
async function handleLogin(e) {
  e.preventDefault();
  const identity = document.getElementById('loginIdentity').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!identity || !password) {
    return showAuthAlert('login-alert', 'Completá todos los campos.', 'error');
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, password })
    });
    const data = await res.json();

    if (res.ok) {
      currentUser = data.user;
      localStorage.setItem('unigames_token', data.token);
      localStorage.setItem('unigames_user', JSON.stringify(currentUser));
      showAuthAlert('login-alert', '¡Bienvenido, ' + sanitizeHTML(data.user.username) + '!', 'success');
      updateAuthUI();
      setTimeout(closeModal, 900);
    } else {
      showAuthAlert('login-alert', data.error || 'Error al iniciar sesión.', 'error');
    }
  } catch (err) {
    console.error(err);
    showAuthAlert('login-alert', 'No se pudo conectar con el servidor.', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;

  if (!username || !email || !password || !confirm) {
    return showAuthAlert('register-alert', 'Completá todos los campos.', 'error');
  }

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_REGEX.test(email)) {
    return showAuthAlert('register-alert', 'Ingresá un email válido (ej: nombre@dominio.com).', 'error');
  }

  if (password !== confirm) {
    return showAuthAlert('register-alert', 'Las contraseñas no coinciden.', 'error');
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();

    if (res.ok) {
      currentUser = data.user;
      localStorage.setItem('unigames_token', data.token);
      localStorage.setItem('unigames_user', JSON.stringify(currentUser));
      showAuthAlert('register-alert', '¡Cuenta creada exitosamente! Sesión iniciada.', 'success');
      updateAuthUI();
      setTimeout(closeModal, 1200);
    } else {
      showAuthAlert('register-alert', data.error || 'Error al registrarse.', 'error');
    }
  } catch (err) {
    console.error(err);
    showAuthAlert('register-alert', 'No se pudo conectar con el servidor.', 'error');
  }
}

  function updateAuthUI() {
    const drawerBody = document.getElementById('accountDrawerBody');
    if (!drawerBody) return;

    if (currentUser) {
      drawerBody.innerHTML = `
        <div class="account-greeting">Hola, ${sanitizeHTML(currentUser.username)}</div>
        ${currentUser.rol === 'admin' ? '<button class="account-drawer-btn" onclick="closeAccountDrawer(); openAdminModal();"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>Panel Admin</button>' : ''}
        <button class="account-drawer-btn" onclick="closeAccountDrawer(); goTo('puntuacion');"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>Puntuación</button>
        <button class="account-drawer-btn"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>Amigos</button>
        <button class="account-drawer-btn"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>Logros</button>
        <button class="account-drawer-btn btn-logout" onclick="logout()"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>Cerrar sesión</button>
      `;
    } else {
      drawerBody.innerHTML = `
        <button class="account-drawer-btn btn-login-drawer" onclick="closeAccountDrawer(); openModal('login');">Iniciar sesión</button>
      `;
    }
  }

function logout() {
  currentUser = null;
  localStorage.removeItem('unigames_token');
  localStorage.removeItem('unigames_user');
  updateAuthUI();
}

// ─── Leaderboard con tabs por juego ────

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

  const panelAll    = document.getElementById('lb-panel-all');
  const panelSingle = document.getElementById('lb-panel-single');

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
  const container = document.getElementById('lb-global-grids');
  if (!container) return;
  try {
    const res = await fetch('/api/leaderboard/global');
    if (!res.ok) throw new Error();
    const data = await res.json(); // { juego_id: { juego, entries: [{jugador, puntos}] } }

    const GAME_ICONS = { 1:'🔍', 2:'❓', 3:'🔤', 4:'💀', 5:'🕵️', 6:'🟩', 7:'🏃', 8:'🪤' };
    const keys = Object.keys(data);

    if (keys.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#64748b;padding:2rem;">Todavía no hay puntuaciones. ¡Jugá y aparecé acá!</p>';
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
          <td>${sanitizeHTML(e.jugador)}</td>
          <td><span class="score-badge">${sanitizeHTML(String(e.puntos))}</span></td>
        </tr>`;
      }).join('');

      return `
        <div class="lb-game-card">
          <div class="lb-game-title">${sanitizeHTML(GAME_ICONS[jid] || '')} ${sanitizeHTML(g.juego)}</div>
          <table class="lb-mini-table">
            <thead><tr><th>#</th><th>Jugador</th><th>Puntos</th></tr></thead>
            <tbody>${rowsHTML || '<tr><td colspan="3" style="text-align:center;color:#94a3b8;font-size:.8rem;">Sin partidas aún</td></tr>'}</tbody>
          </table>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('Error leaderboard global', err);
    if (container) container.innerHTML = '<p style="text-align:center;color:#64748b;padding:2rem;">No se pudo cargar. ¿El servidor está corriendo?</p>';
  }
}

async function fetchLeaderboardByGame(juegoId) {
  const tbody = document.getElementById('leaderboardBody');
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
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b;padding:1.5rem;">Nadie jugó esto todavía. ¡Sé el primero!</td></tr>';
      return;
    }

    tbody.innerHTML = scores.map((s, i) => {
      const medals = ['<svg style="width:1.2rem;height:1.2rem;fill:#ffd700;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>','<svg style="width:1.2rem;height:1.2rem;fill:#c0c0c0;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>','<svg style="width:1.2rem;height:1.2rem;fill:#cd7f32;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>'];
      const medal  = medals[i] || (i + 1);
      const cls    = i < 3 ? `rank-${i+1}` : '';
      return `<tr>
        <td class="${cls}">${medal} ${i >= 3 ? i+1 : ''}</td>
        <td>${sanitizeHTML(s.jugador)}</td>
        <td><span class="score-badge">${sanitizeHTML(String(s.puntos))}</span></td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('Error leaderboard by game', err);
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#e53e3e;">Error al cargar</td></tr>';
  }
}

async function guardarPuntaje(juego_id, puntos, tematica_id) {
  if (!currentUser) return; // Solo guarda si hay sesión iniciada
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

// ══════════════════════════════════════
//   PREGUNTADOS
// ══════════════════════════════════════

const PREGUNTADOS_TOTAL = 10;
const PREGUNTADOS_TIME  = 15; // segundos por pregunta

const TEMATICA_NAMES = { 1: 'Videojuegos', 2: 'Películas', 3: 'Anime', 4: 'Programación' };
const TEMATICA_MAP   = { 'Videojuegos': 1, 'Películas': 2, 'Anime': 3, 'Programación': 4 };

let pregState = {
  preguntas: [], idx: 0, score: 0,
  timer: null, timeLeft: 0,
  tematicaId: 1, finished: false
};

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
  document.getElementById('preguntados-theme-label').textContent = TEMATICA_NAMES[tematicaId] || '';
  renderPreguntados();
}

function renderPreguntados() {
  const sec = document.getElementById('sec-preguntados');
  const { preguntas, idx, score, finished } = pregState;

  if (preguntas.length === 0) {
    sec.innerHTML = `
      <div class="game-screen-header">
        <button class="btn-back" onclick="goTo('juegos')">← Volver a Juegos</button>
        <div class="game-screen-title"><span>❓</span> Preguntados</div>
        <div class="game-screen-theme">${TEMATICA_NAMES[pregState.tematicaId]||''}</div>
      </div>
      <div class="coming-soon-box" style="margin-top:2rem;">
        <h2>Sin preguntas</h2>
        <p>Aún no hay preguntas cargadas para esta temática. (Recordá correr python crear_bd.py)</p>
        <button class="btn-play" style="margin-top:20px" onclick="goTo('juegos')">← Volver a Juegos</button>
      </div>`;
    return;
  }

  if (finished || idx >= preguntas.length) {
    sec.querySelector('.coming-soon-box')?.remove();
    const puntos = score * 150;
    guardarPuntaje(2, puntos, pregState.tematicaId);
    sec.innerHTML = `
      <div class="game-screen-header">
        <button class="btn-back" onclick="goTo('juegos')">← Volver a Juegos</button>
        <div class="game-screen-title"><span>❓</span> Preguntados</div>
        <div class="game-screen-theme" id="preguntados-theme-label">${TEMATICA_NAMES[pregState.tematicaId]||''}</div>
      </div>
      <div class="preg-result">
        <div class="preg-result-emoji">${score >= preguntas.length * 0.7 ? '🏆' : score >= preguntas.length * 0.4 ? '😊' : '😅'}</div>
        <p class="preg-result-title">${score >= preguntas.length * 0.7 ? '¡Excelente!' : score >= preguntas.length * 0.4 ? '¡Bien hecho!' : '¡Seguí practicando!'}</p>
        <p class="preg-result-score">${score} / ${preguntas.length} correctas</p>
        <p class="preg-result-pts">+${puntos} puntos</p>
        <button class="btn-play" style="max-width:240px;margin:0 auto;" onclick="initPreguntados(${pregState.tematicaId})">🔄 Jugar de nuevo</button>
        <button class="btn-back" style="margin:0 auto;" onclick="goTo('juegos')">← Volver a Juegos</button>
      </div>`;
    return;
  }


  const q   = preguntas[idx];
  const opts = ['A', 'B', 'C', 'D'];
  const texts = [q.opcion_a, q.opcion_b, q.opcion_c, q.opcion_d];

  sec.innerHTML = `
    <div class="game-screen-header">
      <button class="btn-back" onclick="clearInterval(pregState.timer); goTo('juegos')">← Volver a Juegos</button>
      <div class="game-screen-title"><span>❓</span> Preguntados</div>
      <div class="game-screen-theme" id="preguntados-theme-label">${TEMATICA_NAMES[pregState.tematicaId]||''}</div>
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

// ══════════════════════════════════════
//   SOPA DE LETRAS
// ══════════════════════════════════════

const SOPA_GRID = 12; // 12x12
const SOPA_TIME = 120; // 2 minutos

let sopaState = {
  words: [], grid: [], placed: [], found: [],
  selected: [], dragging: false,
  timer: null, timeLeft: SOPA_TIME,
  score: 0, tematicaId: 1, finished: false
};
let sopaFinishTimeout = null;

// Palabras hardcodeadas por temática para la sopa (se usan las del ahorcado)
const SOPA_WORDS = {
  1: ['POKEMON','MINECRAFT','VIDEOJUEGO','JOYSTICK','CONSOLA','NINTENDO','ZELDA','MARIO','ARCADE','GAMER'],
  2: ['PELICULA','CINEMA','DIRECTOR','ACTOR','GUION','ESCENA','TRAILER','DRAMA','COMEDIA','ESTRENO'],
  3: ['ANIME','NARUTO','MANGA','OTAKU','SHONEN','NINJA','SAMURAI','KAWAII','DRAGON','GOKU'],
  4: ['JAVASCRIPT','PYTHON','VARIABLE','FUNCION','SERVIDOR','EXPRESS','FRONTEND','BACKEND','REACT','GITHUB'],
};

async function initSopa(tematicaId) {
  tematicaId = Number(tematicaId) || sopaState.tematicaId || 1;
  clearInterval(sopaState.timer);
  if (sopaFinishTimeout) { clearTimeout(sopaFinishTimeout); sopaFinishTimeout = null; }

  const candidatos = (SOPA_WORDS[tematicaId] || SOPA_WORDS[1])
    .filter(w => w.length <= SOPA_GRID - 1);
  // Mezclar y tomar hasta 8 palabras
  const shuffled = [...candidatos].sort(() => Math.random() - 0.5).slice(0, 8);

  const { grid, placed } = buildSopaGrid(shuffled, SOPA_GRID);

  sopaState = {
    words: placed.map(p => p.word),
    grid, placed, found: [],
    selected: [], dragging: false,
    timer: null, timeLeft: SOPA_TIME,
    score: 0, tematicaId, finished: false
  };

  document.getElementById('sopa-theme-label').textContent = TEMATICA_NAMES[tematicaId] || '';
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
  const sec  = document.getElementById('sec-sopa');
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
      <button class="btn-back" onclick="clearInterval(sopaState.timer); goTo('juegos')">← Volver a Juegos</button>
      <div class="game-screen-title"><span>🔍</span> Sopa de Letras</div>
      <div class="game-screen-theme" id="sopa-theme-label">${TEMATICA_NAMES[sopaState.tematicaId]||''}</div>
    </div>
    <div class="sopa-wrap">
      <div class="sopa-info">
        <span class="sopa-timer${timeLeft<=15?' sopa-timer-urgent':''}">⏱ ${timeLeft}s</span>
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
      el.textContent = '⏱ ' + sopaState.timeLeft + 's';
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
  // Calcular línea recta desde start hasta r,c
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
  // Solo en dirección recta o diagonal exacta
  const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
  const stepC = dc === 0 ? 0 : dc / Math.abs(dc);
  // Validar que sea diagonal exacta o línea recta
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) {
    // No es diagonal exacta → solo extender en la dirección dominante
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
        // Todas las palabras encontradas — limpiar timer ANTES de programar el finish
        clearInterval(sopaState.timer);
        if (sopaFinishTimeout) clearTimeout(sopaFinishTimeout);
        sopaFinishTimeout = setTimeout(() => sopaFinish(true), 400);
      }
      return;
    }
  }
}

function sopaFinish(won) {
  // Guard: evita que se ejecute dos veces (puede pasar si el jugador
  // encuentra la última palabra justo cuando el tiempo llega a 0 —
  // el timeout y el setTimeout de victoria competían y la segunda
  // llamada pisaba el HTML recién renderizado con el botón "Jugar de
  // nuevo", dejándolo sin su listener funcional).
  if (sopaState.finished) return;
  sopaState.finished = true;
  clearInterval(sopaState.timer);
  if (sopaFinishTimeout) { clearTimeout(sopaFinishTimeout); sopaFinishTimeout = null; }
  const total = sopaState.placed.length;
  const found = sopaState.found.length;
  const pts   = sopaState.score;
  guardarPuntaje(1, pts, sopaState.tematicaId); // juego_id=1 Sopa
  const sec = document.getElementById('sec-sopa');
  sec.innerHTML = `
    <div class="game-screen-header">
      <button class="btn-back" onclick="goTo('juegos')">← Volver a Juegos</button>
      <div class="game-screen-title"><span>🔍</span> Sopa de Letras</div>
    </div>
    <div class="preg-result">
      <div class="preg-result-emoji">${won ? '🏆' : found > total/2 ? '😊' : '😅'}</div>
      <p class="preg-result-title">${won ? '¡Encontraste todas!' : '¡Tiempo agotado!'}</p>
      <p class="preg-result-score">${found} / ${total} palabras encontradas</p>
      <p class="preg-result-pts">+${pts} puntos</p>
      <button class="btn-play" style="max-width:240px;margin:0 auto;" onclick="initSopa(${sopaState.tematicaId})">🔄 Jugar de nuevo</button>
      <button class="btn-back" style="margin:0 auto;" onclick="goTo('juegos')">← Volver a Juegos</button>
    </div>`;
}

// ══════════════════════════════════════
//   TERMINA LA PALABRA
// ══════════════════════════════════════

const TERMINA_MAX = 5;

let terminaState = {
  word: '', revealed: '', intentos: 0,
  guesses: [], finished: false,
  tematicaId: 1
};

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
    const sec = document.getElementById('sec-termina');
    if (sec) {
      sec.innerHTML = `
        <div class="game-screen-header">
          <button class="btn-back" onclick="goTo('juegos')">← Volver a Juegos</button>
          <div class="game-screen-title"><span>🔤</span> Termina la Palabra</div>
          <div class="game-screen-theme">${TEMATICA_NAMES[tematicaId]||''}</div>
        </div>
        <div class="coming-soon-box" style="margin-top:2rem;">
          <h2>Sin palabras</h2>
          <p>Aún no hay palabras cargadas para esta temática. (Recordá correr python crear_bd.py)</p>
          <button class="btn-play" style="margin-top:20px" onclick="goTo('juegos')">← Volver a Juegos</button>
        </div>`;
    }
    return;
  }

  // Revelar entre 30-50% de las letras (posiciones aleatorias)
  const totalReveal = Math.max(1, Math.floor(word.length * 0.35));
  const positions = [...Array(word.length).keys()].sort(() => Math.random()-0.5).slice(0, totalReveal);
  const revealed  = word.split('').map((l, i) => positions.includes(i) ? l : '_').join('');

  terminaState = { word, revealed, intentos: 0, guesses: [], finished: false, tematicaId };
  document.getElementById('termina-theme-label').textContent = TEMATICA_NAMES[tematicaId] || '';
  renderTermina();
}

function renderTermina() {
  const sec = document.getElementById('sec-termina');
  const { word, revealed, intentos, guesses, finished } = terminaState;

  const intentosHTML = Array.from({length: TERMINA_MAX}, (_, i) => {
    if (i < guesses.length) {
      const g = guesses[i];
      return `<div class="termina-intento ${g.correct?'correct':'wrong'}">
        ${g.text} ${g.correct ? '✅' : '❌'}
      </div>`;
    }
    return `<div class="termina-intento empty">${i < intentos ? '' : '—'}</div>`;
  }).join('');

  const displayWord = finished
    ? word.toUpperCase()
    : revealed.split('').map((l, i) =>
        `<span class="termina-letra ${l!='_'?'revelada':''}">${l==='_'?'_':l.toUpperCase()}</span>`
      ).join('');

  sec.innerHTML = `
    <div class="game-screen-header">
      <button class="btn-back" onclick="goTo('juegos')">← Volver a Juegos</button>
      <div class="game-screen-title"><span>🔤</span> Termina la Palabra</div>
      <div class="game-screen-theme" id="termina-theme-label">${TEMATICA_NAMES[terminaState.tematicaId]||''}</div>
    </div>
    <div class="termina-wrap">
      <p class="termina-hint">Completá la palabra. Tenés ${TERMINA_MAX - intentos} intentos restantes.</p>
      <div class="termina-display">${displayWord}</div>
      ${!finished ? `
        <div class="termina-input-row">
          <input class="termina-input" id="terminaInput" type="text"
            placeholder="Escribí la palabra completa..."
            maxlength="${word.length + 3}"
            onkeydown="if(event.key==='Enter') submitTermina()"
            autocomplete="off" autocorrect="off" spellcheck="false" />
          <button class="btn-play" style="min-width:100px;" onclick="submitTermina()">Enviar</button>
        </div>` : ''}
      <div class="termina-intentos">${intentosHTML}</div>
      ${finished ? `
        <div class="termina-result ${guesses[guesses.length-1]?.correct?'win':'lose'}">
          ${guesses[guesses.length-1]?.correct ? '🎉 ¡Correcto!' : '💀 Era: ' + word.toUpperCase()}
        </div>
        <div style="display:flex;gap:1rem;justify-content:center;margin-top:1rem;">
          <button class="btn-play" style="max-width:220px;" onclick="initTermina(${terminaState.tematicaId})">🔄 Nueva palabra</button>
          <button class="btn-back" onclick="goTo('juegos')">← Volver a Juegos</button>
        </div>` : ''}
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
    guardarPuntaje(3, pts, terminaState.tematicaId); // juego_id=3 Termina la Palabra
  } else {
    // UI-004: dar feedback progresivo — revelar una letra oculta más
    // por cada intento fallido, para evitar la frustración del jugador.
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


// ══════════════════════════════════════
//   ADIVINA LA COSA
// ══════════════════════════════════════

// Datos del juego organizados por temática
// Cada item tiene: respuesta, pistas (de vaga a específica), imagen
const ADIVINA_DATA = {
  1: [ // Videojuegos
    {
      respuesta: 'minecraft',
      aliases: ['mine craft'],
      imagen: 'logos/videojuegos/minecraft.jpg',
      pistas: [
        'Es un videojuego de mundo abierto lanzado en 2011.',
        'Podés construir estructuras usando bloques.',
        'Incluye un modo supervivencia donde debés comer y combatir criaturas.',
        'El Creeper es uno de sus enemigos más icónicos.',
      ],
    },
    {
      respuesta: 'god of war',
      aliases: ['god of war', 'godofwar'],
      imagen: 'logos/videojuegos/god-of-war.jpg',
      pistas: [
        'Es una saga de acción y aventura con temática mitológica.',
        'El protagonista es un espartano con marcas blancas en la piel.',
        'En las entregas recientes viaja por la mitología nórdica con su hijo Atreus.',
        'Su nombre es Kratos.',
      ],
    },
    {
      respuesta: 'pokemon',
      aliases: ['pokémon', 'pokemon rojo', 'pokémon rojo'],
      imagen: 'logos/videojuegos/pokemon-rojo.jpg',
      pistas: [
        'Es una saga de RPG donde coleccionás y entrenás criaturas.',
        'Tu objetivo principal es vencer a los 8 líderes de gimnasio.',
        'La primera entrega se lanzó en 1996 para Game Boy.',
        'El Pokémon más famoso de la saga es Pikachu.',
      ],
    },
    {
      respuesta: 'silent hill',
      aliases: ['silent hill'],
      imagen: 'logos/videojuegos/silent-hill.jpg',
      pistas: [
        'Es una saga de videojuegos de terror psicológico.',
        'Transcurre en una ciudad envuelta en niebla y oscuridad.',
        'Pyramid Head es uno de sus enemigos más reconocibles.',
        'Fue desarrollada por Konami a fines de los 90.',
      ],
    },
  ],
  2: [ // Películas
    {
      respuesta: 'el origen de los guardianes',
      aliases: ['rise of the guardians', 'origen de los guardianes', 'guardianes'],
      imagen: 'logos/pelicula/el-origen-de-los-guardianes.jpg',
      pistas: [
        'Es una película de animación de DreamWorks del año 2012.',
        'Los protagonistas son figuras míticas como el Conejo de Pascua y Santa Claus.',
        'Un villano llamado Pitch Black quiere que los niños dejen de creer.',
        'Jack Frost es el protagonista principal.',
      ],
    },
    {
      respuesta: 'metegol',
      aliases: ['foosball', 'underdogs'],
      imagen: 'logos/pelicula/metegol.jpg',
      pistas: [
        'Es una película de animación argentina estrenada en 2013.',
        'Fue producida por Juan José Campanella.',
        'Los personajes de un metegol cobran vida para ayudar al protagonista.',
        'Ganó el Premio Goya a Mejor Película de Animación.',
      ],
    },
    {
      respuesta: 'rapido y furioso',
      aliases: ['rápido y furioso', 'fast and furious', 'fast furious', 'fast & furious'],
      imagen: 'logos/pelicula/rapido-y-furioso.jpg',
      pistas: [
        'Es una saga de acción estadounidense con múltiples películas.',
        'Gira en torno a carreras ilegales de autos y misiones de alto riesgo.',
        'Dominic Toretto es uno de sus personajes principales.',
        'Vin Diesel y Paul Walker son los actores más asociados a la saga.',
      ],
    },
    {
      respuesta: 'scary movie',
      aliases: ['scary movie 1'],
      imagen: 'logos/pelicula/scary-movie.jpg',
      pistas: [
        'Es una comedia de parodia de películas de terror de los años 90.',
        'Se burla de cintas como Scream y Sé Lo Que Hiciste El Verano Pasado.',
        'Fue dirigida por Keenen Ivory Wayans en el año 2000.',
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
        'Es un anime shōnen que sigue la vida de un joven ninja.',
        'El protagonista sueña con convertirse en Hokage de su aldea.',
        'Tiene sellado en su cuerpo un zorro de nueve colas llamado Kurama.',
        'El nombre del protagonista es el mismo que el del anime.',
      ],
    },
    {
      respuesta: 'goku',
      aliases: ['son goku', 'dragon ball', 'dragon ball z'],
      imagen: 'logos/anime/goku-jr.jpg',
      pistas: [
        'Es un personaje de una de las sagas de anime más famosas del mundo.',
        'Es un Saiyan cuya técnica más emblemática es el Kamehameha.',
        'Pelea contra enemigos cada vez más poderosos para proteger la Tierra.',
        'Su nombre completo es Son Goku.',
      ],
    },
    {
      respuesta: 'eren',
      aliases: ['eren yeager', 'eren jaeger', 'attack on titan', 'shingeki no kyojin'],
      imagen: 'logos/anime/eren.jpg',
      pistas: [
        'Es el protagonista de un anime de acción y drama oscuro.',
        'Vive en un mundo amenazado por gigantes caníbales llamados Titanes.',
        'Posee la habilidad de transformarse en un Titán.',
        'Su apellido es Yeager y el anime se llama Shingeki no Kyojin.',
      ],
    },
    {
      respuesta: 'kazuma',
      aliases: ['kazuma sato', 'konosuba', 'kono subarashii'],
      imagen: 'logos/anime/kazuma.jpg',
      pistas: [
        'Es el protagonista de un anime de isekai y comedia.',
        'Fue transportado a un mundo de fantasía después de morir de forma ridícula.',
        'Viaja con un grupo de compañeras bastante incompetentes.',
        'El anime se llama KonoSuba.',
      ],
    },
  ],
  4: [ // Programación
    {
      respuesta: 'python',
      aliases: ['python 3', 'python3'],
      imagen: 'logos/programacion/Python.png',
      pistas: [
        'Es uno de los lenguajes de programación más populares del mundo.',
        'Se usa mucho en ciencia de datos, inteligencia artificial y scripting.',
        'Su sintaxis es limpia y muy legible, ideal para principiantes.',
        'Su nombre hace referencia a un grupo de comediantes británicos.',
      ],
    },
    {
      respuesta: 'node',
      aliases: ['node.js', 'nodejs'],
      imagen: 'logos/programacion/node-js.png',
      pistas: [
        'Es un entorno de ejecución para JavaScript del lado del servidor.',
        'Está basado en el motor V8 de Google Chrome.',
        'Usa un modelo de entrada/salida no bloqueante, ideal para APIs.',
        'Se suele usar junto a Express para crear servidores web.',
      ],
    },
    {
      respuesta: 'arduino',
      aliases: [],
      imagen: 'logos/programacion/arduino.png',
      pistas: [
        'Es una plataforma de hardware y software de código abierto.',
        'Se usa para crear prototipos electrónicos y proyectos DIY.',
        'Su placa física es de color azul o verde y tiene pines de entrada/salida.',
        'Se programa con un lenguaje basado en C/C++.',
      ],
    },
    {
      respuesta: 'visual studio',
      aliases: ['visual studio code', 'vscode', 'vs code', 'vs'],
      imagen: 'logos/programacion/visual-studio.png',
      pistas: [
        'Es un editor de código desarrollado por Microsoft.',
        'Es altamente extensible mediante plugins y extensiones.',
        'Tiene integración nativa con Git y un terminal integrado.',
        'Es el editor de código más usado en el mundo según encuestas de Stack Overflow.',
      ],
    },
  ],
};

let adivinaState = null;

function stopAdivina() {
  adivinaState = null;
}

function initAdivina(tematicaId) {
  const tId = tematicaId && /^\d+$/.test(String(tematicaId)) ? Number(tematicaId) : 1;
  const items = shuffle([...ADIVINA_DATA[tId] || ADIVINA_DATA[1]]);

  adivinaState = {
    tematicaId: tId,
    items,
    itemIdx: 0,
    score: 0,
    pistasUsed: 0,
    finished: false,
  };

  // Mostrar overlay de inicio
  const ov = document.getElementById('adivinaOverlay');
  document.getElementById('adivinaOverlayEmoji').textContent = '🕵️';
  document.getElementById('adivinaOverlayTitle').textContent = 'Adivina la Cosa';
  document.getElementById('adivinaOverlayDesc').textContent =
    `Se muestran ${items.length} items de la temática seleccionada.\nCuantas menos pistas uses, ¡más puntos ganás!`;
  document.getElementById('adivinaOverlayBtn').textContent = '▶ Empezar';
  document.getElementById('adivinaOverlayBtn').onclick = startAdivina;
  ov.style.display = 'flex';
  document.getElementById('adivinaGame').style.display = 'none';
}

function startAdivina() {
  if (!adivinaState) return;
  document.getElementById('adivinaOverlay').style.display = 'none';
  document.getElementById('adivinaGame').style.display = 'flex';
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
  document.getElementById('adivinaItemNum').textContent = s.itemIdx + 1;
  document.getElementById('adivinaItemTotal').textContent = s.items.length;
  document.getElementById('adivinaScore').textContent = s.score;
  document.getElementById('adivinaPistasUsed').textContent = s.pistasUsedThisItem || 0;

  // Pistas
  document.getElementById('adivinaPistasList').innerHTML = '';
  s.pistasRevealedThisItem = s.pistasRevealedThisItem || [];
  for (const pista of s.pistasRevealedThisItem) {
    const el = document.createElement('div');
    el.className = 'adivina-pista-item';
    el.textContent = `🔹 ${pista}`;
    document.getElementById('adivinaPistasList').appendChild(el);
  }

  // Botón pista
  const btn = document.getElementById('adivinaBtnPista');
  const remaining = item.pistas.length - (s.pistasRevealedThisItem?.length || 0);
  btn.disabled = remaining === 0;
  btn.querySelector ? null : null;
  document.getElementById('adivinaPistaCosto').textContent =
    `(-${pistasCosto(s.pistasRevealedThisItem?.length || 0)} pts)`;

  // Imagen pixelada
  renderAdivinaCanvas(item.imagen, s.pistasRevealedThisItem?.length || 0, item.pistas.length);

  // Input
  document.getElementById('adivinaInput').value = '';
  document.getElementById('adivinaInput').disabled = false;
  document.getElementById('adivinaFeedback').style.display = 'none';
  setTimeout(() => document.getElementById('adivinaInput')?.focus(), 50);

  // Botón "Me rindo": solo disponible cuando ya no quedan más pistas para pedir
  const btnRendirse = document.getElementById('adivinaBtnRendirse');
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
  const canvas = document.getElementById('adivinaCanvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.src = imgSrc;
  img.onload = () => {
    // Nivel de pixelado: cuantas más pistas, más nítida (1=muy pixelada, 0=nítida)
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

    // Dibujar pequeño, luego escalar
    const small = document.createElement('canvas');
    small.width  = Math.max(1, Math.floor(w / pixelSize));
    small.height = Math.max(1, Math.floor(h / pixelSize));
    const sCtx = small.getContext('2d');
    sCtx.drawImage(img, 0, 0, small.width, small.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, w, h);
  };
  img.onerror = () => {
    // Fallback: cuadrado gris con ícono
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '64px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🕵️', canvas.width / 2, canvas.height / 2);
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

  renderAdivinaItem();
}

function rendirseAdivina() {
  const s = adivinaState;
  if (!s || s.respondido) return;
  const item = s.items[s.itemIdx];
  s.respondido = true;

  const input = document.getElementById('adivinaInput');
  const fb = document.getElementById('adivinaFeedback');
  fb.style.display = 'block';
  fb.className = 'adivina-feedback incorrecto';
  fb.textContent = `❌ La respuesta era: ${item.respuesta.charAt(0).toUpperCase() + item.respuesta.slice(1)}`;
  input.disabled = true;
  document.getElementById('adivinaBtnPista').disabled = true;
  const btnRendirse = document.getElementById('adivinaBtnRendirse');
  if (btnRendirse) btnRendirse.style.display = 'none';

  // Revelar imagen completa
  renderAdivinaCanvas(item.imagen, 99, item.pistas.length);

  setTimeout(() => nextAdivinaItem(), 2200);
}

function submitAdivina() {
  const s = adivinaState;
  if (!s || s.respondido) return;
  const item = s.items[s.itemIdx];
  const input = document.getElementById('adivinaInput');
  const raw = input.value.trim().toLowerCase().replace(/[áàä]/g,'a').replace(/[éèë]/g,'e')
    .replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u');

  if (!raw) return;

  const normalize = (str) => str.toLowerCase()
    .replace(/[áàä]/g,'a').replace(/[éèë]/g,'e')
    .replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u');

  const correctas = [item.respuesta, ...item.aliases].map(normalize);
  const correcto = correctas.includes(raw);

  const fb = document.getElementById('adivinaFeedback');
  fb.style.display = 'block';

  const pistasUsadas = s.pistasRevealedThisItem?.length || 0;

  if (correcto) {
    s.respondido = true;
    const pts = puntosItem(pistasUsadas);
    s.score += pts;
    fb.className = 'adivina-feedback correcto';
    fb.textContent = `✅ ¡Correcto! +${pts} puntos`;
    input.disabled = true;
    document.getElementById('adivinaBtnPista').disabled = true;

    // Revelar imagen completa
    renderAdivinaCanvas(item.imagen, 99, item.pistas.length);

    setTimeout(() => nextAdivinaItem(), 1800);
  } else {
    fb.className = 'adivina-feedback incorrecto';
    fb.textContent = '❌ No es eso, seguí intentando o pedí más pistas.';
    input.value = '';
    setTimeout(() => { fb.style.display = 'none'; input.focus(); }, 1500);
  }
}

// Soporte Enter en input
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('adivinaInput');
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
    guardarPuntaje(5, s.score, s.tematicaId); // juego_id=5 Adivina la Cosa

    const ov = document.getElementById('adivinaOverlay');
    document.getElementById('adivinaOverlayEmoji').textContent = '🏆';
    document.getElementById('adivinaOverlayTitle').textContent = '¡Juego terminado!';
    document.getElementById('adivinaOverlayDesc').textContent = `Tu puntaje final: ${s.score} puntos`;
    document.getElementById('adivinaOverlayBtn').textContent = '🔁 Jugar de nuevo';
    document.getElementById('adivinaOverlayBtn').onclick = startAdivina;
    ov.style.display = 'flex';
    return;
  }

  renderAdivinaItem();
}
// ─── MODAL INFO / CRÉDITOS ───
let currentInfoPage = 1;
const totalInfoPages = 4;

function openInfoModal() {
  document.getElementById('infoOverlay').classList.add('show');
  currentInfoPage = 1;
  updateInfoModal();
}

function closeInfoModal() {
  document.getElementById('infoOverlay').classList.remove('show');
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
  // Ocultar todas las páginas
  document.querySelectorAll('.info-page').forEach(p => p.classList.remove('active'));
  // Mostrar la página actual
  const activePage = document.getElementById('infoPage' + currentInfoPage);
  if (activePage) activePage.classList.add('active');

  // Actualizar dots
  const dots = document.querySelectorAll('#infoDots .dot');
  dots.forEach((dot, index) => {
    if (index === currentInfoPage - 1) dot.classList.add('active');
    else dot.classList.remove('active');
  });
}

// ══════════════════════════════════════


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
        alert('Configuración guardada! La página se recargará para aplicar los cambios.');
        setTimeout(() => location.reload(), 500);
      } else {
      alert('Error guardando configuración');
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
                        ${aviso.icono || '📢'} ${aviso.texto}
                    </div>
                    <div style="font-size:10px; color:#94A3B8;">
                        Estado: <span style="color: ${aviso.activo ? '#4ade80' : '#94A3B8'}">${aviso.activo ? 'Activo (Mostrándose)' : 'Inactivo'}</span>
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
    const icono = document.getElementById('adminAvisoNuevoIcono').value.trim() || '📢';
    const color = document.getElementById('adminAvisoNuevoColor').value;
    
    if (!texto) {
        alert("El texto del aviso no puede estar vacío");
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
            // Refrescar el aviso en la UI pública si es necesario
            loadAvisoPublico();
        }
    } catch(e) {
        console.error(e);
    }
};

window.eliminarAvisoAdmin = async function(id) {
    if (!confirm("¿Seguro que deseas eliminar este aviso de forma permanente?")) return;
    
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
                    <span style="margin-right:8px; font-size:16px;">${aviso.icono || '📢'}</span>
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
