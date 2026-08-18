// ══════════════════════════════════════
//   UniGames — app.js
// ══════════════════════════════════════

let currentUser = null;

// ─── Audio Manager ─────────────────────
let globalAudioEnabled = true;
let pageMusicMuted = false;
const bgMusic = new Audio('assert/menu.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.5;

const deathSound = new Audio('sounds/muerte.mp3');
deathSound.volume = 0.8;

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
  if (btn) btn.textContent = '🔊';
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
    document.getElementById('globalAudioBtn').textContent = '🔊';
    unmutepageMusic();
  } else {
    document.getElementById('globalAudioBtn').textContent = '🔇';
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
  bgMusic.volume = 0.5;
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
function renderFeatured() {
  const three = shuffle(allGames).slice(0, 3);
  document.getElementById('featuredGrid').innerHTML = three.map(g => `
    <div class="game-card" onclick="launchGame('${g.id}', this)">
      <div class="card-emoji">${g.emoji}</div>
      <div class="card-title">${g.title}</div>
      <p class="card-desc">${g.desc}</p>
      <span class="card-tag">${g.tag}</span>
      <button class="btn-play">▶ Jugar ahora</button>
    </div>
  `).join('');
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
});

function closeNav() {
  hamburger.classList.remove('open');
  navMenu.classList.remove('open');
}

function iniciarJuego(gameKey) {
  launchGame(gameKey, null);
}

function mostrarAjustes() {
  alert('⚙️ Ajustes\n\nEste apartado se abrirá en una próxima actualización.');
}

function mostrarComoJugar() {
  alert('📋 Cómo jugar\n\n1. Seleccioná un juego de la lista\n2. Elegí tu temática preferida\n3. Presioná ▶ Jugar\n4. Usá las flechas o controles táctiles\n5. ¡Evitá los obstáculos y tratá de llegar lo más lejos posible!\n\nBuena suerte y diviertete!');
}

// ─── Modal login / registro ────────────
function openModal(tab) {
  document.getElementById('modalOverlay').classList.add('open');
  switchTab(tab || 'login');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
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
          <button class="btn-back" onclick="goTo('juegos')">← Volver</button>
          <div class="game-screen-title"><span>💀</span> Ahorcado</div>
          <div class="game-screen-theme">${TEMATICA_NAMES[tematicaId]||'Normal'}</div>
        </div>
        <div class="coming-soon-box" style="margin-top:2rem;">
          <h2>Sin palabras</h2>
          <p>Aún no hay palabras cargadas para esta temática. (Recordá correr python crear_bd.py)</p>
          <button class="btn-play" style="margin-top:20px" onclick="goTo('juegos')">← Volver</button>
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
const WORDLE_TEMATICAS = { 1: '🎮 Videojuegos', 2: '🎬 Películas', 3: '⛩️ Anime', 4: '💻 Programación' };

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
          <button class="btn-back" onclick="goTo('juegos')">← Volver</button>
          <div class="game-screen-title"><span>📝</span> Adivina la Palabra</div>
          <div class="game-screen-theme">${TEMATICA_NAMES[tematicaId]||''}</div>
        </div>
        <div class="coming-soon-box" style="margin-top:2rem;">
          <h2>Sin palabras</h2>
          <p>Aún no hay palabras cargadas para esta temática. (Recordá correr python crear_bd.py)</p>
          <button class="btn-play" style="margin-top:20px" onclick="goTo('juegos')">← Volver</button>
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

  // Guardar HTML original de secciones de juego (antes de que se modifiquen)
  saveOriginalSections();

  // Juegos destacados aleatorios
  renderFeatured();

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
  const authArea = document.getElementById('authArea');
  if (currentUser) {
    authArea.innerHTML = `
      <span style="color: #fff; margin-right: 15px; font-weight: bold;">Hola, ${sanitizeHTML(currentUser.username)}</span>
      <button class="btn-auth btn-register" onclick="logout()">Cerrar sesión</button>
    `;
  } else {
    authArea.innerHTML = `
      <button class="btn-auth btn-login" onclick="openModal('login')">Iniciar sesión</button>
      <button class="btn-auth btn-register" onclick="openModal('register')">Registrarse</button>
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
        const medals = ['🥇','🥈','🥉'];
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
          <div class="lb-game-title">${sanitizeHTML(GAME_ICONS[jid] || '🎮')} ${sanitizeHTML(g.juego)}</div>
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
      const medals = ['🥇','🥈','🥉'];
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
//   PIXEL RUNNER
// ══════════════════════════════════════

const RUNNER = {
  canvas: null, ctx: null,
  raf: null, running: false,
  touchHandler: null,
  score: 0, bestScore: 0,
  speed: 5, baseSpeed: 5,
  frameCount: 0,
  obstacleTimer: 0, obstacleInterval: 90,

  // Personaje
  player: {
    x: 90, y: 0, w: 29, h: 34, // antes 34x40 — más chico
    vy: 0, jumps: 0, maxJumps: 2,
    dead: false, animFrame: 0, animTick: 0,
    groundY: 0,
  },

  // Suelo y cielo
  groundH: 34, skyH: 30,

  // Obstáculos activos
  obstacles: [],

  // Estrellas de fondo
  stars: [],
};

function initRunner() {
  RUNNER.canvas = document.getElementById('runnerCanvas');

  // Esperar a que el layout esté listo (en mobile la sección recién se hizo visible
  // y clientWidth puede ser 0 si el paint aún no corrió)
  requestAnimationFrame(() => {
    const C = RUNNER.canvas;

    // Resolución interna igual a Castle Escape (480x270) para que el
    // contenedor (mismo tamaño/aspecto en ambos juegos) no estire la imagen.
    const W = 480, H = 270;
    C.width  = W;
    C.height = H;
    RUNNER.ctx = C.getContext('2d');

    // groundY: el personaje debe apoyar sobre el suelo
    RUNNER.player.groundY = C.height - RUNNER.groundH - RUNNER.player.h;
    RUNNER.player.y       = RUNNER.player.groundY;

    // Generar estrellas
    RUNNER.stars = Array.from({length: 40}, () => ({
      x: Math.random() * C.width,
      y: Math.random() * (C.height * 0.55),
      r: Math.random() * 1.5 + 0.5,
      blink: Math.random()
    }));

    // Ocultar overlay y arrancar el juego directo
    document.getElementById('runnerOverlay').classList.add('hidden');
    if (RUNNER.bestScore > 0) {
      document.getElementById('runnerBest').textContent = 'Mejor: ' + RUNNER.bestScore + ' pts';
    }

    // Eventos
    setupRunnerEvents();

    // Arrancar el bucle del juego
    startRunner();
  });
}

function setupRunnerEvents() {
  // Evitar duplicados
  document.removeEventListener('keydown', runnerKeyHandler);
  document.addEventListener('keydown', runnerKeyHandler);

  // En touch, usamos solo touchstart y bloqueamos el click sintético que
  // el browser genera después, para que no consuma el doble salto.
  // IMPORTANTE: guardamos la referencia de la función en RUNNER.touchHandler
  // para poder removerla en cada init y evitar que se acumulen listeners
  // (esto causaba el lag/fuga de memoria reportado en el QA: cada vez que
  // se reiniciaba o se volvía a entrar al juego se sumaba un listener nuevo).
  const canvas = RUNNER.canvas;
  canvas.removeEventListener('click',      runnerTapHandler);
  canvas.removeEventListener('touchstart', runnerTapHandler);
  if (RUNNER.touchHandler) {
    canvas.removeEventListener('touchstart', RUNNER.touchHandler);
  }

  if ('ontouchstart' in window) {
    // Dispositivo táctil: solo touchstart, nunca click
    RUNNER.touchHandler = function(e) {
      e.preventDefault(); // bloquea el click sintético posterior
      runnerJumpOrStart();
    };
    canvas.addEventListener('touchstart', RUNNER.touchHandler, { passive: false });
  } else {
    // Desktop: solo click
    canvas.addEventListener('click', runnerTapHandler);
  }
}

function runnerKeyHandler(e) {
  if (!document.getElementById('sec-runner').classList.contains('active')) return;

  // Si está el overlay de Game Over visible, Enter/Espacio equivalen a
  // tocar "Volver a intentar"
  const overlay = document.getElementById('runnerOverlay');
  if (overlay && !overlay.classList.contains('hidden')) {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      const btn = document.getElementById('runnerRestartBtn');
      if (btn && btn.style.display !== 'none') btn.click();
    }
    return;
  }

  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    runnerJumpOrStart();
  }
  if (e.code === 'ArrowDown') {
    e.preventDefault();
    runnerFastDrop();
  }
}
function runnerTapHandler(e) { runnerJumpOrStart(); }

function runnerFastDrop() {
  if (!RUNNER.running) return;
  const p = RUNNER.player;
  if (p.dead || p.y >= p.groundY) return; // ya está en el suelo
  p.vy = Math.abs(p.vy) * 0.5 + RUNNER.canvas.height * 0.04; // impulso hacia abajo
}

function runnerJumpOrStart() {
  // Si el overlay está visible, ignorar saltos (solo el botón puede iniciar)
  const overlay = document.getElementById('runnerOverlay');
  if (overlay && !overlay.classList.contains('hidden')) return;
  if (!RUNNER.running) return;
  const p = RUNNER.player;
  if (p.dead) return;
  if (p.jumps < p.maxJumps) {
    p.vy = -RUNNER.canvas.height * 0.018;
    p.jumps++;
  }
}

function startRunner() {
  // Pixel Runner usa su propia música de fondo
  setMusic('assert/pixel runner/sounds/backplay.mp3');

  // Reset estado
  const C = RUNNER.canvas;
  RUNNER.score = 0;
  RUNNER.speed = RUNNER.baseSpeed;
  RUNNER.frameCount = 0;
  RUNNER.obstacleTimer = 0;
  RUNNER.obstacleInterval = 90;
  RUNNER.obstacles = [];
  RUNNER.running = true;

  const p = RUNNER.player;
  p.y = p.groundY;
  p.vy = 0;
  p.jumps = 0;
  p.dead = false;
  p.animFrame = 0;
  p.animTick = 0;

  // Ocultar overlay
  document.getElementById('runnerOverlay').classList.add('hidden');
  document.getElementById('runner-score-display').textContent = '0';

  // Ocultar botones de game over
  document.getElementById('runnerRestartBtn').style.display = 'none';
  document.getElementById('runnerMenuBtn').style.display = 'none';

  if (RUNNER.raf) cancelAnimationFrame(RUNNER.raf);
  RUNNER.raf = requestAnimationFrame(runnerLoop);
}

function stopRunner() {
  RUNNER.running = false;
  if (RUNNER.raf) { cancelAnimationFrame(RUNNER.raf); RUNNER.raf = null; }
  document.removeEventListener('keydown', runnerKeyHandler);
}

function runnerLoop() {
  if (!RUNNER.running) return;
  updateRunner();
  drawRunner();
  RUNNER.raf = requestAnimationFrame(runnerLoop);
}

const GRAVITY = 0.09; // relativo a altura del canvas

function updateRunner() {
  const C = RUNNER.canvas;
  const p = RUNNER.player;
  if (p.dead) return;

  // Score + velocidad
  RUNNER.frameCount++;
  if (RUNNER.frameCount % 6 === 0) {
    RUNNER.score++;
    document.getElementById('runner-score-display').textContent = RUNNER.score;
    if (RUNNER.score % 250 === 0) {
      RUNNER.speed += 0.8;
      RUNNER.obstacleInterval = Math.max(45, RUNNER.obstacleInterval - 5);
    }
  }

  // Física jugador
  p.vy += GRAVITY * (C.height / 200);
  p.y  += p.vy;
  if (p.y >= p.groundY) {
    p.y = p.groundY;
    p.vy = 0;
    p.jumps = 0;
  }

  // Animación piernas (solo en suelo)
  p.animTick++;
  if (p.animTick >= 6) { p.animTick = 0; p.animFrame = (p.animFrame + 1) % 4; }

  // Spawn obstáculos
  RUNNER.obstacleTimer++;
  if (RUNNER.obstacleTimer >= RUNNER.obstacleInterval) {
    RUNNER.obstacleTimer = 0;
    spawnObstacle(C);
  }

  // Mover obstáculos
  for (let i = RUNNER.obstacles.length - 1; i >= 0; i--) {
    const o = RUNNER.obstacles[i];
    o.x -= RUNNER.speed;
    if (o.x + o.w < -20) { RUNNER.obstacles.splice(i, 1); continue; }

    // Colisión con margen perdonador
    const margin = 6;
    if (
      p.x + margin < o.x + o.w - margin &&
      p.x + p.w - margin > o.x + margin &&
      p.y + margin < o.y + o.h - margin &&
      p.y + p.h - margin > o.y + margin
    ) {
      playerDie();
      return;
    }
  }
}

function spawnObstacle(C) {
  const type = Math.random();
  const groundY = C.height - RUNNER.groundH;
  const skyTop  = RUNNER.skyH;

  if (type < 0.45) {
    // Obstáculo del suelo (cactus/pared)
    const h = 36 + Math.floor(Math.random() * 34);
    const w = 20 + Math.floor(Math.random() * 18);
    RUNNER.obstacles.push({ x: C.width + 20, y: groundY - h, w, h, kind: 'ground' });
  } else if (type < 0.75) {
    // Obstáculo aéreo (pájaro/nube enemiga)
    const h = 24 + Math.floor(Math.random() * 16);
    const w = 38 + Math.floor(Math.random() * 26);
    const minY = skyTop + 4;
    const maxY = C.height * 0.45;
    const y = minY + Math.random() * (maxY - minY);
    RUNNER.obstacles.push({ x: C.width + 20, y, w, h, kind: 'air' });
  } else {
    // Combo: dos obstáculos a la vez
    const h1 = 32 + Math.floor(Math.random() * 26);
    RUNNER.obstacles.push({ x: C.width + 20, y: groundY - h1, w: 18, h: h1, kind: 'ground' });
    const h2 = 22;
    const y2 = skyTop + 10 + Math.random() * (C.height * 0.3);
    RUNNER.obstacles.push({ x: C.width + 60, y: y2, w: 34, h: h2, kind: 'air' });
  }
}

function playerDie() {
  RUNNER.player.dead = true;
  RUNNER.running = false;
  bgMusic.pause();
  if (typeof playDeathSound === 'function') playDeathSound();
  if (RUNNER.raf) { cancelAnimationFrame(RUNNER.raf); RUNNER.raf = null; }

  if (RUNNER.score > RUNNER.bestScore) RUNNER.bestScore = RUNNER.score;
  guardarPuntaje(7, RUNNER.score); // Pixel Runner = juego_id 7

  // Dibujar última frame con el player muerto
  drawRunner(true);

  setTimeout(() => {
    document.getElementById('runnerBest').textContent = 'Mejor: ' + RUNNER.bestScore + ' pts';
    showRunnerOverlay('¡Game Over!', 'Puntos: ' + RUNNER.score, true);
  }, 600);
}

function showRunnerOverlay(title, sub, isGameover) {
  const overlay = document.getElementById('runnerOverlay');
  overlay.classList.remove('hidden');
  document.getElementById('runnerOverlayTitle').textContent = title;
  document.getElementById('runnerOverlaySub').textContent  = sub;
  if (RUNNER.bestScore > 0)
    document.getElementById('runnerBest').textContent = 'Mejor: ' + RUNNER.bestScore + ' pts';

  // Show/game over buttons
  const goBtn = document.getElementById('runnerRestartBtn');
  const menuBtn = document.getElementById('runnerMenuBtn');
  if (goBtn) goBtn.style.display = isGameover ? 'inline-block' : 'none';
  if (menuBtn) menuBtn.style.display = isGameover ? 'inline-block' : 'none';
}

function restartRunner() {
  stopRunner();
  // Reset score and state
  RUNNER.score = 0;
  RUNNER.speed = RUNNER.baseSpeed;
  RUNNER.frameCount = 0;
  RUNNER.obstacleTimer = 0;
  RUNNER.obstacleInterval = 90;
  RUNNER.obstacles = [];
  const p = RUNNER.player;
  p.y = p.groundY;
  p.vy = 0;
  p.jumps = 0;
  p.dead = false;
  p.animFrame = 0;
  p.animTick = 0;
  document.getElementById('runnerOverlay').classList.add('hidden');
  document.getElementById('runner-score-display').textContent = '0';
  // stopRunner() quitó el listener de teclado; hay que reengancharlo o
  // los controles quedan muertos después de "Volver a intentar"
  setupRunnerEvents();
  startRunner();
}

function toRunnerMenu() {
  stopRunner();
  showRunnerMenu();
}

function showRunnerMenu() {
  const menu = document.getElementById('runnerMenu');
  const container = document.querySelector('#sec-runner .runner-container');
  const controls = document.querySelector('#sec-runner .runner-controls');
  const hint = document.querySelector('#sec-runner .runner-hint');
  if (menu) menu.classList.remove('hidden');
  if (container) container.classList.remove('hidden');
  if (controls) controls.classList.add('hidden');
  if (hint) hint.classList.add('hidden');
  // Ocultar overlay de juego por si estaba visible
  const ov = document.getElementById('runnerOverlay');
  if (ov) ov.classList.add('hidden');
  // Música del menú de Pixel Runner
  setMusic('assert/pixel runner/sounds/menu.mp3');
}

function startPixelRunnerGame() {
  const menu = document.getElementById('runnerMenu');
  const controls = document.querySelector('#sec-runner .runner-controls');
  const hintEl = document.querySelector('#sec-runner .runner-hint');
  if (menu) menu.classList.add('hidden');
  if (controls) controls.classList.remove('hidden');
  if (hintEl) hintEl.classList.remove('hidden');
  // Música de fondo del juego
  setMusic('assert/pixel runner/sounds/backplay.mp3');
  // Inicializar y arrancar el juego
  initRunner();
}

// ─── DIBUJO ────────────────────────────
function drawRunner(dead = false) {
  const C = RUNNER.canvas;
  const ctx = RUNNER.ctx;
  const W = C.width, H = C.height;
  const groundY = H - RUNNER.groundH;
  const skyH    = RUNNER.skyH;

  // Fondo degradado noche
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,   '#0d1b2a');
  bg.addColorStop(0.6, '#162032');
  bg.addColorStop(1,   '#1a2a1a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Estrellas
  RUNNER.stars.forEach(s => {
    s.blink = (s.blink + 0.015) % (Math.PI * 2);
    const alpha = 0.5 + 0.5 * Math.sin(s.blink);
    ctx.fillStyle = `rgba(255,255,220,${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    s.x -= RUNNER.speed * 0.15;
    if (s.x < 0) { s.x = W; s.y = Math.random() * H * 0.55; }
  });

  // Luna
  ctx.fillStyle = '#fffde7';
  ctx.beginPath();
  ctx.arc(W - 60, 38, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#162032';
  ctx.beginPath();
  ctx.arc(W - 54, 34, 14, 0, Math.PI * 2);
  ctx.fill();

  // Banda del cielo (zona de obstáculos aéreos) — sutil
  ctx.fillStyle = 'rgba(37,99,235,0.07)';
  ctx.fillRect(0, 0, W, skyH + 2);

  // Suelo
  const grd = ctx.createLinearGradient(0, groundY, 0, H);
  grd.addColorStop(0, '#2d5a1b');
  grd.addColorStop(0.3, '#1e3d10');
  grd.addColorStop(1, '#0f2008');
  ctx.fillStyle = grd;
  ctx.fillRect(0, groundY, W, RUNNER.groundH);

  // Línea del suelo
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(W, groundY);
  ctx.stroke();

  // Obstáculos
  RUNNER.obstacles.forEach(o => {
    if (o.kind === 'ground') {
      drawCactus(ctx, o);
    } else {
      drawBird(ctx, o);
    }
  });

  // Jugador
  drawPlayer(ctx, RUNNER.player, dead);

  // Score en canvas (pequeño, esquina)
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('x' + Math.floor(RUNNER.speed * 10) / 10, W - 58, 18);
}

function drawCactus(ctx, o) {
  // Cuerpo principal
  ctx.fillStyle = '#15803d';
  ctx.fillRect(o.x + o.w * 0.3, o.y, o.w * 0.4, o.h);
  // Brazo izquierdo
  ctx.fillRect(o.x, o.y + o.h * 0.3, o.w * 0.35, o.h * 0.2);
  ctx.fillRect(o.x, o.y + o.h * 0.1,  o.w * 0.12, o.h * 0.25);
  // Brazo derecho
  ctx.fillRect(o.x + o.w * 0.65, o.y + o.h * 0.4, o.w * 0.35, o.h * 0.2);
  ctx.fillRect(o.x + o.w * 0.88, o.y + o.h * 0.2, o.w * 0.12, o.h * 0.25);
  // Borde más oscuro
  ctx.strokeStyle = '#14532d';
  ctx.lineWidth = 1;
  ctx.strokeRect(o.x + o.w * 0.3, o.y, o.w * 0.4, o.h);
}

function drawBird(ctx, o) {
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  const flap = Math.sin(Date.now() / 120) * 0.3;

  // Cuerpo
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.ellipse(cx, cy, o.w * 0.32, o.h * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  // Alas (animadas)
  ctx.fillStyle = '#dc2626';
  // Ala izquierda
  ctx.save();
  ctx.translate(cx - o.w * 0.2, cy);
  ctx.rotate(-0.4 + flap);
  ctx.beginPath();
  ctx.ellipse(0, 0, o.w * 0.32, o.h * 0.18, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Ala derecha
  ctx.save();
  ctx.translate(cx + o.w * 0.2, cy);
  ctx.rotate(0.4 - flap);
  ctx.beginPath();
  ctx.ellipse(0, 0, o.w * 0.32, o.h * 0.18, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Ojo
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(cx + o.w * 0.12, cy - o.h * 0.1, o.h * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e1e1e';
  ctx.beginPath();
  ctx.arc(cx + o.w * 0.14, cy - o.h * 0.1, o.h * 0.07, 0, Math.PI * 2);
  ctx.fill();

  // Pico
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(cx + o.w * 0.28, cy);
  ctx.lineTo(cx + o.w * 0.48, cy + o.h * 0.08);
  ctx.lineTo(cx + o.w * 0.28, cy + o.h * 0.18);
  ctx.closePath();
  ctx.fill();
}

function drawPlayer(ctx, p, dead) {
  const x = Math.round(p.x), y = Math.round(p.y);
  const W = p.w, H = p.h;

  if (dead) {
    // Tono de muerte (parpadeo rojo)
    ctx.save();
    ctx.globalAlpha = 0.7;
  }

  const S = W / 32; // escala pixel

  // ── Piernas animadas ──
  const legColors = ['#1e3a5f', '#1e3a5f'];
  const shoeColor = '#f5c518';

  if (!dead) {
    // Pierna izquierda
    const legOff1 = [0, -4, -6, -4][p.animFrame];
    const legOff2 = [0, 4, 6, 4][p.animFrame];
    // Pierna izq
    ctx.fillStyle = legColors[0];
    ctx.fillRect(x + 8*S, y + 25*S + legOff1*S, 7*S, 8*S);
    ctx.fillStyle = shoeColor;
    ctx.fillRect(x + 6*S, y + 33*S + legOff1*S, 9*S, 3*S);
    // Pierna der
    ctx.fillStyle = legColors[1];
    ctx.fillRect(x + 17*S, y + 25*S + legOff2*S, 7*S, 8*S);
    ctx.fillStyle = shoeColor;
    ctx.fillRect(x + 17*S, y + 33*S + legOff2*S, 9*S, 3*S);
  } else {
    ctx.fillStyle = legColors[0];
    ctx.fillRect(x + 8*S, y + 25*S, 7*S, 8*S);
    ctx.fillRect(x + 17*S, y + 25*S, 7*S, 8*S);
    ctx.fillStyle = shoeColor;
    ctx.fillRect(x + 6*S, y + 33*S, 9*S, 3*S);
    ctx.fillRect(x + 17*S, y + 33*S, 9*S, 3*S);
  }

  // ── Cuerpo ──
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(x + 8*S, y + 14*S, 16*S, 11*S);

  // Cuello/piel
  ctx.fillStyle = '#fbbf7a';
  ctx.fillRect(x + 12*S, y + 14*S, 8*S, 3*S);

  // ── Brazos (alternados) ──
  const armOff = p.animFrame % 2 === 0 ? 0 : 2;
  ctx.fillStyle = '#fbbf7a';
  ctx.fillRect(x + 3*S,  y + 16*S - armOff*S, 5*S, 3*S);
  ctx.fillRect(x + 24*S, y + 16*S + armOff*S, 5*S, 3*S);

  // ── Cabeza ──
  ctx.fillStyle = '#fbbf7a';
  ctx.fillRect(x + 8*S, y + 2*S, 16*S, 13*S);

  // Pelo
  ctx.fillStyle = '#3b2506';
  ctx.fillRect(x + 8*S,  y,       16*S, 3*S);
  ctx.fillRect(x + 7*S,  y + 1*S, 2*S,  2*S);
  ctx.fillRect(x + 23*S, y + 1*S, 2*S,  2*S);

  // Anteojos — marco
  ctx.strokeStyle = '#1a3a6b';
  ctx.lineWidth = Math.max(1, S * 1.5);
  ctx.strokeRect(x + 8*S,  y + 8*S, 7*S, 5*S);
  ctx.strokeRect(x + 17*S, y + 8*S, 7*S, 5*S);
  // Puente
  ctx.fillStyle = '#1a3a6b';
  ctx.fillRect(x + 15*S, y + 10*S, 2*S, 1.5*S);

  // Lentes (cristal)
  ctx.fillStyle = 'rgba(147,197,253,0.55)';
  ctx.fillRect(x + 9*S,  y + 9*S, 5*S, 3*S);
  ctx.fillRect(x + 18*S, y + 9*S, 5*S, 3*S);

  // Boca
  ctx.fillStyle = dead ? '#ef4444' : '#d97706';
  ctx.fillRect(x + 12*S, y + 12*S, 8*S, 2*S);

  // Ojos detrás de anteojos
  if (!dead) {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(x + 10*S, y + 9.5*S, 2*S, 1.5*S);
    ctx.fillRect(x + 20*S, y + 9.5*S, 2*S, 1.5*S);
  } else {
    // Ojos en X
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = S;
    ctx.beginPath();
    ctx.moveTo(x + 9*S,  y + 9*S); ctx.lineTo(x + 14*S, y + 13*S);
    ctx.moveTo(x + 14*S, y + 9*S); ctx.lineTo(x + 9*S,  y + 13*S);
    ctx.moveTo(x + 18*S, y + 9*S); ctx.lineTo(x + 23*S, y + 13*S);
    ctx.moveTo(x + 23*S, y + 9*S); ctx.lineTo(x + 18*S, y + 13*S);
    ctx.stroke();
  }

  // Estela de salto (partículas simples)
  if (p.vy < -1 && !dead) {
    ctx.fillStyle = 'rgba(245,197,24,0.35)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x + (10 + i * 6) * S, y + H - i * 3 * S, 2 * S, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (dead) ctx.restore();
}

// ══════════════════════════════════════
//   SALTO TRAICIONERO (plataformas + trampas)
// ══════════════════════════════════════

// Resolución lógica fija (el canvas se escala por CSS al ancho del contenedor)
const TR_W = 480, TR_H = 270;
const TR_GRAVITY = 0.42;
const TR_JUMP_VY = -7.4;
const TR_MOVE_SPEED = 2.7;

// Niveles: cada uno define plataformas, peligros, flechas-trampa, inicio y salida.
// type de plataforma: 'normal' | 'fake' (sin colisión, se ve igual a una normal)
// | 'crumble' (colisiona pero se derrumba unos frames después de pisarla)
const TR_LEVELS = [
  {
    nombre: 'El piso falso',
    hint: 'Caminá tranquilo... o no.',
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0,   y: 240, w: 130, h: 30, type: 'normal' },
      { x: 130, y: 240, w: 60,  h: 30, type: 'fake'   },
      { x: 210, y: 240, w: 270, h: 30, type: 'normal' },
    ],
    hazards: [],
    arrows: [],
    exit: { x: 430, y: 200, w: 26, h: 40 },
  },
  {
    nombre: 'La estrella tentadora',
    hint: 'No todo lo brillante conviene agarrarlo.',
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0, y: 240, w: 480, h: 30, type: 'normal' },
    ],
    hazards: [
      { x: 222, y: 168, w: 20, h: 20, type: 'star' },
    ],
    arrows: [],
    exit: { x: 430, y: 200, w: 26, h: 40 },
  },
  {
    nombre: 'Flecha en la pared',
    hint: 'Algo se acerca desde la derecha.',
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0, y: 240, w: 480, h: 30, type: 'normal' },
    ],
    hazards: [],
    arrows: [
      { triggerX: 190, x: 480, y: 214, w: 22, h: 8, dir: -1, speed: 4.2, active: false, fired: false },
    ],
    exit: { x: 430, y: 200, w: 26, h: 40 },
  },
  {
    nombre: 'Se cae a pedazos',
    hint: 'No te quedes parado mucho tiempo.',
    start: { x: 20, y: 170 },
    platforms: [
      { x: 0,   y: 210, w: 90,  h: 20, type: 'normal'  },
      { x: 150, y: 210, w: 80,  h: 20, type: 'crumble' },
      { x: 300, y: 210, w: 90,  h: 20, type: 'normal'  },
      { x: 430, y: 210, w: 50,  h: 20, type: 'normal'  },
    ],
    hazards: [
      { x: 0, y: 255, w: 480, h: 15, type: 'spike' },
    ],
    arrows: [],
    exit: { x: 440, y: 170, w: 26, h: 40 },
  },
  {
    nombre: 'Salto de fe',
    hint: 'Donde ves pinchos, pisá. Donde ves piso, ¡no!',
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0,   y: 240, w: 110, h: 30, type: 'normal' },
      { x: 110, y: 240, w: 40,  h: 30, type: 'normal', decor: 'spike' },
      { x: 150, y: 240, w: 90,  h: 30, type: 'fake'   },
      { x: 240, y: 240, w: 40,  h: 30, type: 'normal', decor: 'spike' },
      { x: 280, y: 240, w: 200, h: 30, type: 'normal' },
    ],
    hazards: [],
    arrows: [
      { triggerX: 340, x: 480, y: 214, w: 22, h: 8, dir: -1, speed: 4.6, active: false, fired: false },
    ],
    exit: { x: 440, y: 200, w: 26, h: 40 },
  },
  {
    nombre: 'El puente quebradizo',
    hint: 'Todo se derrumba, movete rápido.',
    start: { x: 20, y: 170 },
    platforms: [
      { x: 0,   y: 210, w: 70,  h: 20, type: 'normal'  },
      { x: 100, y: 210, w: 60,  h: 20, type: 'crumble' },
      { x: 190, y: 180, w: 50,  h: 20, type: 'crumble' },
      { x: 270, y: 210, w: 60,  h: 20, type: 'crumble' },
      { x: 360, y: 210, w: 120, h: 20, type: 'normal'  },
    ],
    hazards: [
      { x: 0, y: 255, w: 480, h: 15, type: 'spike' },
    ],
    arrows: [],
    exit: { x: 430, y: 170, w: 26, h: 40 },
  },
  {
    nombre: 'Doble trampa',
    hint: 'Flechas y pisos falsos juntos. Dificil.',
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0,   y: 240, w: 100, h: 30, type: 'normal' },
      { x: 120, y: 240, w: 70,  h: 30, type: 'fake'   },
      { x: 210, y: 240, w: 100, h: 30, type: 'normal' },
      { x: 340, y: 220, w: 140, h: 30, type: 'normal' },
    ],
    hazards: [
      { x: 120, y: 255, w: 70,  h: 15, type: 'spike' },
    ],
    arrows: [
      { triggerX: 100, x: 480, y: 214, w: 22, h: 8, dir: -1, speed: 4.5, active: false, fired: false },
      { triggerX: 300, x: 480, y: 194, w: 22, h: 8, dir: -1, speed: 5.0, active: false, fired: false },
    ],
    exit: { x: 430, y: 180, w: 26, h: 40 },
  },
  {
    nombre: 'Laberinto invisible',
    hint: 'Los caminos seguros no se ven.',
    start: { x: 20, y: 170 },
    platforms: [
      { x: 0,   y: 210, w: 80,  h: 20, type: 'normal'  },
      { x: 120, y: 180, w: 60,  h: 20, type: 'fake'    },
      { x: 120, y: 210, w: 60,  h: 20, type: 'normal'  },
      { x: 220, y: 150, w: 60,  h: 20, type: 'fake'    },
      { x: 220, y: 210, w: 60,  h: 20, type: 'normal'  },
      { x: 320, y: 180, w: 60,  h: 20, type: 'crumble' },
      { x: 400, y: 210, w: 80,  h: 20, type: 'normal'  },
    ],
    hazards: [
      { x: 0, y: 255, w: 480, h: 15, type: 'spike' },
    ],
    arrows: [
      { triggerX: 250, x: 480, y: 190, w: 22, h: 8, dir: -1, speed: 5.2, active: false, fired: false },
    ],
    exit: { x: 430, y: 170, w: 26, h: 40 },
  },
  {
    nombre: 'Lluvia de flechas',
    hint: 'Miras a la derecha y te alcanzan.',
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0,   y: 240, w: 480, h: 30, type: 'normal' },
    ],
    hazards: [],
    arrows: [
      { triggerX: 80,  x: 480, y: 214, w: 22, h: 8, dir: -1, speed: 4.0, active: false, fired: false },
      { triggerX: 160, x: 480, y: 214, w: 22, h: 8, dir: -1, speed: 4.8, active: false, fired: false },
      { triggerX: 240, x: 480, y: 214, w: 22, h: 8, dir: -1, speed: 5.5, active: false, fired: false },
      { triggerX: 320, x: 480, y: 214, w: 22, h: 8, dir: -1, speed: 6.0, active: false, fired: false },
    ],
    exit: { x: 430, y: 200, w: 26, h: 40 },
  },
  {
    nombre: 'Todo es mentira',
    hint: 'Nada es lo que parece. Desconfiá de todo.',
    start: { x: 20, y: 170 },
    platforms: [
      { x: 0,   y: 210, w: 80,  h: 20, type: 'normal'  },
      { x: 100, y: 210, w: 50,  h: 20, type: 'fake'    },
      { x: 140, y: 180, w: 50,  h: 20, type: 'crumble' },
      { x: 210, y: 210, w: 40,  h: 20, type: 'normal'  },
      { x: 270, y: 210, w: 50,  h: 20, type: 'fake'    },
      { x: 330, y: 180, w: 150, h: 20, type: 'normal'  },
    ],
    hazards: [
      { x: 100, y: 255, w: 50,  h: 15, type: 'spike' },
      { x: 270, y: 255, w: 50,  h: 15, type: 'spike' },
    ],
    arrows: [
      { triggerX: 150, x: 480, y: 154, w: 22, h: 8, dir: -1, speed: 5.0, active: false, fired: false },
      { triggerX: 300, x: 480, y: 194, w: 22, h: 8, dir: -1, speed: 5.5, active: false, fired: false },
    ],
    exit: { x: 400, y: 140, w: 26, h: 40 },
  },
  {
    nombre: 'La prueba final',
    hint: 'Un poco de todo. No hay margen para error.',
    start: { x: 20, y: 140 },
    platforms: [
      { x: 0,   y: 180, w: 70,  h: 20, type: 'normal'  },
      { x: 100, y: 180, w: 50,  h: 20, type: 'fake'    },
      { x: 100, y: 210, w: 50,  h: 20, type: 'crumble' },
      { x: 180, y: 150, w: 50,  h: 20, type: 'fake'    },
      { x: 180, y: 210, w: 50,  h: 20, type: 'normal'  },
      { x: 260, y: 180, w: 40,  h: 20, type: 'crumble' },
      { x: 330, y: 210, w: 50,  h: 20, type: 'normal'  },
      { x: 410, y: 180, w: 70,  h: 20, type: 'normal'  },
    ],
    hazards: [
      { x: 0,   y: 255, w: 480, h: 15, type: 'spike' },
    ],
    arrows: [
      { triggerX: 120, x: 480, y: 190, w: 22, h: 8, dir: -1, speed: 5.0, active: false, fired: false },
      { triggerX: 280, x: 480, y: 214, w: 22, h: 8, dir: -1, speed: 5.8, active: false, fired: false },
      { triggerX: 370, x: 480, y: 180, w: 22, h: 8, dir: -1, speed: 6.5, active: false, fired: false },
    ],
    exit: { x: 420, y: 140, w: 26, h: 40 },
  },
];

const TRAMPAS = {
  canvas: null, ctx: null,
  raf: null, running: false,
  levelIndex: 0,
  deathsThisLevel: 0,
  totalDeaths: 0,
  totalScore: 0,
  levelStartTime: 0,
  levelDeaths: 0,
  keys: {},
  keyHandlerDown: null,
  keyHandlerUp: null,
  explosions: [],

  // w/h en proporción 32:36 (la misma que usa drawTrampasPlayer), así el
  // sprite dibujado llega exactamente hasta el borde inferior del hitbox
  // y no queda "flotando" sobre las plataformas.
  player: { x: 20, y: 200, w: 24, h: 27, vx: 0, vy: 0, onGround: false, dead: false },

  // Estado dinámico del nivel actual (copias mutables de plataformas/flechas)
  platforms: [],
  hazards: [],
  arrows: [],
};

// ─── SISTEMA DE ESTRELLAS ───
const TR_TIME_LIMITS = [30, 35, 35, 40, 40, 45, 45, 50, 50, 55, 60];
const TR_DEATH_LIMITS = [5, 5, 5, 4, 4, 3, 3, 3, 2, 2, 1];

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

// ─── NAVEGACIÓN DE MENÚS ───
let trSelectedLevel = 0;

function trHideAll() {
  ['trampasMainMenu', 'trampasLevelSelect', 'trampasSettings', 'trampasGameScreen'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
}
function trShowMainMenu() {
  trHideAll();
  document.getElementById('trampasMainMenu').classList.remove('hidden');
  document.getElementById('trampasPauseMenu').classList.add('hidden');
  stopTrampas();
  if (typeof setMusic === 'function') setMusic('assert/Castle Escape/sounds/menu_song.mp3');
}
function trShowLevelSelect() {
  trHideAll();
  document.getElementById('trampasLevelSelect').classList.remove('hidden');
  trUpdateLevelCard();
}
function trShowSettings() {
  trHideAll();
  document.getElementById('trampasSettings').classList.remove('hidden');
}
function trShowGameScreen() {
  trHideAll();
  document.getElementById('trampasGameScreen').classList.remove('hidden');
}
function trBackToLevelSelect() {
  stopTrampas();
  if (typeof setMusic === 'function') setMusic('assert/Castle Escape/sounds/menu_song.mp3');
  trShowLevelSelect();
}

function trUpdateLevelCard() {
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
  trSelectedLevel = Math.max(0, Math.min(TR_LEVELS.length - 1, trSelectedLevel + dir));
  trUpdateLevelCard();
}

function trPlaySelectedLevel() {
  if (!trIsUnlocked(trSelectedLevel)) return;
  trStartLevel(trSelectedLevel);
}

function trStartLevel(i) {
  TRAMPAS.levelIndex = i;
  TRAMPAS.totalScore = 0;
  TRAMPAS.totalDeaths = 0;
  TRAMPAS.levelStartTime = performance.now();
  TRAMPAS.levelDeaths = 0;
  TRAMPAS.explosions = [];
  trLoadLevel(i);
  trShowGameScreen();
  document.getElementById('trampasPauseMenu').classList.add('hidden');
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

// ─── PAUSA ───
function trPauseGame() {
  TRAMPAS.running = false;
  if (TRAMPAS.raf) { cancelAnimationFrame(TRAMPAS.raf); TRAMPAS.raf = null; }
  document.getElementById('trampasPauseMenu').classList.remove('hidden');
}
function trResumeGame() {
  document.getElementById('trampasPauseMenu').classList.add('hidden');
  TRAMPAS.running = true;
  if (TRAMPAS.raf) cancelAnimationFrame(TRAMPAS.raf);
  TRAMPAS.raf = requestAnimationFrame(trampasLoop);
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

  const p = TRAMPAS.player;
  p.x = lvl.start.x; p.y = lvl.start.y;
  p.vx = 0; p.vy = 0; p.dead = false; p.onGround = false;

  const starsEl = document.getElementById('trampas-hud-stars');
  if (starsEl) starsEl.textContent = (index + 1) + '/' + TR_LEVELS.length + ' - ' + lvl.nombre;

  // Imagen de fondo del castillo (capa 0): back1 para los primeros niveles, back2 después
  const cont = document.querySelector('.trampas-container');
  if (cont) cont.style.background = "#150620 url('assert/Castle Escape/" + (index >= 6 ? 'back2' : 'back1') + ".jpg') center/cover no-repeat";
}

function initTrampas() {
  TRAMPAS.canvas = document.getElementById('trampasCanvas');
  const C = TRAMPAS.canvas;
  C.width = TR_W;
  C.height = TR_H;
  TRAMPAS.ctx = C.getContext('2d');

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
  if (TRAMPAS.keyHandlerDown) document.removeEventListener('keydown', TRAMPAS.keyHandlerDown);
  if (TRAMPAS.keyHandlerUp)   document.removeEventListener('keyup', TRAMPAS.keyHandlerUp);

  TRAMPAS.keyHandlerDown = function(e) {
    if (!document.getElementById('sec-castle_escape').classList.contains('active')) return;

    // Si el overlay (empezar / nivel superado / completado) está visible,
    // Enter/Espacio equivalen a tocar el botón en vez de tener que clickear
    const overlay = document.getElementById('trampasOverlay');
    if (overlay && !overlay.classList.contains('hidden')) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        const btn = document.getElementById('trampasStartBtn');
        if (btn) btn.click();
      }
      return;
    }

    if (['ArrowLeft','ArrowRight','ArrowUp','Space','KeyA','KeyD','KeyW'].includes(e.code)) e.preventDefault();
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') TRAMPAS.keys.left  = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') TRAMPAS.keys.right = true;
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') trJump();
  };
  TRAMPAS.keyHandlerUp = function(e) {
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') TRAMPAS.keys.left  = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') TRAMPAS.keys.right = false;
  };
  document.addEventListener('keydown', TRAMPAS.keyHandlerDown);
  document.addEventListener('keyup', TRAMPAS.keyHandlerUp);
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
  if (TRAMPAS.raf) cancelAnimationFrame(TRAMPAS.raf);
  TRAMPAS.raf = requestAnimationFrame(trampasLoop);
  if (typeof setMusic === 'function') setMusic('assert/Castle Escape/sounds/backsong.mp3');
}

function stopTrampas() {
  TRAMPAS.running = false;
  if (TRAMPAS.raf) { cancelAnimationFrame(TRAMPAS.raf); TRAMPAS.raf = null; }
  if (TRAMPAS.keyHandlerDown) document.removeEventListener('keydown', TRAMPAS.keyHandlerDown);
  if (TRAMPAS.keyHandlerUp)   document.removeEventListener('keyup', TRAMPAS.keyHandlerUp);
}

function toggleCastleMusic() {
  if (typeof bgMusic !== 'undefined' && bgMusic) bgMusic.muted = !bgMusic.muted;
}

function trampasLoop() {
  if (!TRAMPAS.running) return;
  updateTrampas();
  drawTrampas();
  TRAMPAS.raf = requestAnimationFrame(trampasLoop);
}

function trRectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function updateTrampas() {
  const p = TRAMPAS.player;
  if (p.dead) return;

  // Movimiento horizontal
  p.vx = 0;
  if (TRAMPAS.keys.left)  p.vx = -TR_MOVE_SPEED;
  if (TRAMPAS.keys.right) p.vx =  TR_MOVE_SPEED;
  p.x += p.vx;
  p.x = Math.max(0, Math.min(p.x, TR_W - p.w));

  // Gravedad
  p.vy += TR_GRAVITY;
  p.y  += p.vy;
  p.onGround = false;

  // Colisión con plataformas (solo 'normal' y 'crumble' vivas; 'fake' nunca colisiona)
  for (const plat of TRAMPAS.platforms) {
    if (plat.type === 'fake' || plat.gone) continue;
    const feetPrev = p.y + p.h - p.vy;
    const withinX = p.x + p.w > plat.x && p.x < plat.x + plat.w;
    if (withinX && p.vy >= 0 && feetPrev <= plat.y + 1 && p.y + p.h >= plat.y) {
      p.y = plat.y - p.h;
      p.vy = 0;
      p.onGround = true;
      if (plat.type === 'crumble' && plat.touchedAt === null) {
        plat.touchedAt = performance.now();
      }
    }
  }

  // Derrumbe de plataformas 'crumble' 400ms después de pisarlas
  for (const plat of TRAMPAS.platforms) {
    if (plat.type === 'crumble' && plat.touchedAt !== null && !plat.gone) {
      if (performance.now() - plat.touchedAt > 400) plat.gone = true;
    }
  }

  // Flechas de pared: se activan al cruzar triggerX
  for (const lvl of [TR_LEVELS[TRAMPAS.levelIndex]]) {
    lvl.arrows.forEach((def, i) => {
      const a = TRAMPAS.arrows[i];
      if (!a.fired && p.x >= def.triggerX) {
        a.fired = true;
        a.active = true;
        a.x = def.x;
      }
    });
  }
  TRAMPAS.arrows.forEach(a => {
    if (a.active) {
      a.x += a.dir * a.speed;
      if (a.x < -30 || a.x > TR_W + 30) a.active = false;
      if (trRectsOverlap(p, a)) { trPlayerDie(); return; }
    }
  });

  if (p.dead) return;

  // Peligros estáticos (picos y estrella-trampa)
  for (const hz of TRAMPAS.hazards) {
    if (trRectsOverlap(p, hz)) { trPlayerDie(); return; }
  }

  // Caerse del mapa
  if (p.y > TR_H + 20) { trPlayerDie(); return; }

  // Llegar a la salida
  const lvl = TR_LEVELS[TRAMPAS.levelIndex];
  if (trRectsOverlap(p, lvl.exit)) { trLevelComplete(); }
}

function drawTrampasPlayer(ctx, p) {
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
  drawTrampas();

  setTimeout(() => {
    trLoadLevel(TRAMPAS.levelIndex);
    drawTrampas();
  }, 450);
}

function trLevelComplete() {
  TRAMPAS.running = false;
  if (TRAMPAS.raf) { cancelAnimationFrame(TRAMPAS.raf); TRAMPAS.raf = null; }

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
    guardarPuntaje(8, TRAMPAS.totalScore, null);
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

  // Fondo transparente: el contenedor muestra la imagen del castillo (capa 0)
  ctx.clearRect(0, 0, TR_W, TR_H);

  // Plataformas
  for (const plat of TRAMPAS.platforms) {
    if (plat.gone) continue;
    if (plat.type === 'crumble' && plat.touchedAt !== null) {
      ctx.fillStyle = '#e8543f';
    } else {
      ctx.fillStyle = '#7c3aed';
    }
    ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(plat.x, plat.y, plat.w, 4);

    if (plat.decor === 'spike') {
      ctx.fillStyle = '#ef4444';
      const n = Math.max(1, Math.floor(plat.w / 14));
      for (let i = 0; i < n; i++) {
        const sx = plat.x + i * (plat.w / n);
        ctx.beginPath();
        ctx.moveTo(sx, plat.y);
        ctx.lineTo(sx + plat.w / n / 2, plat.y - 10);
        ctx.lineTo(sx + plat.w / n, plat.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Peligros
  for (const hz of TRAMPAS.hazards) {
    if (hz.type === 'spike') {
      ctx.fillStyle = '#ef4444';
      const n = Math.max(1, Math.floor(hz.w / 14));
      for (let i = 0; i < n; i++) {
        const sx = hz.x + i * (hz.w / n);
        ctx.beginPath();
        ctx.moveTo(sx, hz.y + hz.h);
        ctx.lineTo(sx + hz.w / n / 2, hz.y);
        ctx.lineTo(sx + hz.w / n, hz.y + hz.h);
        ctx.closePath();
        ctx.fill();
      }
    } else if (hz.type === 'star') {
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
    }
  }

  // Flechas activas
  ctx.fillStyle = '#facc15';
  TRAMPAS.arrows.forEach(a => {
    if (a.active) ctx.fillRect(a.x, a.y, a.w, a.h);
  });

  // Salida
  const lvl = TR_LEVELS[TRAMPAS.levelIndex];
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(lvl.exit.x, lvl.exit.y, lvl.exit.w, lvl.exit.h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(lvl.exit.x, lvl.exit.y, lvl.exit.w, 5);

  // Jugador — sprite de Pixel Runner adaptado
  drawTrampasPlayer(ctx, p);

  // Explosiones
  updateExplosions();
  drawExplosions(ctx);
}

// ══════════════════════════════════════
//   PREGUNTADOS
// ══════════════════════════════════════

const PREGUNTADOS_TOTAL = 10;
const PREGUNTADOS_TIME  = 15; // segundos por pregunta

const TEMATICA_NAMES = { 1: '🎮 Videojuegos', 2: '🎬 Películas', 3: '⛩️ Anime', 4: '💻 Programación' };
const TEMATICA_MAP   = { '🎮 Videojuegos': 1, '🎬 Películas': 2, '⛩️ Anime': 3, '💻 Programación': 4 };

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
        <button class="btn-back" onclick="goTo('juegos')">← Volver</button>
        <div class="game-screen-title"><span>❓</span> Preguntados</div>
        <div class="game-screen-theme">${TEMATICA_NAMES[pregState.tematicaId]||''}</div>
      </div>
      <div class="coming-soon-box" style="margin-top:2rem;">
        <h2>Sin preguntas</h2>
        <p>Aún no hay preguntas cargadas para esta temática. (Recordá correr python crear_bd.py)</p>
        <button class="btn-play" style="margin-top:20px" onclick="goTo('juegos')">← Volver</button>
      </div>`;
    return;
  }

  if (finished || idx >= preguntas.length) {
    sec.querySelector('.coming-soon-box')?.remove();
    const puntos = score * 150;
    guardarPuntaje(2, puntos, pregState.tematicaId);
    sec.innerHTML = `
      <div class="game-screen-header">
        <button class="btn-back" onclick="goTo('juegos')">← Volver</button>
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
      <button class="btn-back" onclick="clearInterval(pregState.timer); goTo('juegos')">← Volver</button>
      <div class="game-screen-title"><span>❓</span> Preguntados</div>
      <div class="game-screen-theme" id="preguntados-theme-label">${TEMATICA_NAMES[pregState.tematicaId]||''}</div>
    </div>
    <div class="preg-wrap">
      <div class="preg-topbar">
        <span class="preg-counter">Pregunta ${idx+1} / ${preguntas.length}</span>
        <span class="preg-score">⭐ ${score}</span>
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
      <button class="btn-back" onclick="clearInterval(sopaState.timer); goTo('juegos')">← Volver</button>
      <div class="game-screen-title"><span>🔍</span> Sopa de Letras</div>
      <div class="game-screen-theme" id="sopa-theme-label">${TEMATICA_NAMES[sopaState.tematicaId]||''}</div>
    </div>
    <div class="sopa-wrap">
      <div class="sopa-info">
        <span class="sopa-timer${timeLeft<=15?' sopa-timer-urgent':''}">⏱ ${timeLeft}s</span>
        <span class="sopa-score-disp">⭐ ${sopaState.score}</span>
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
      document.querySelector('.sopa-score-disp').textContent = '⭐ ' + sopaState.score;
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
      <button class="btn-back" onclick="goTo('juegos')">← Volver</button>
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
          <button class="btn-back" onclick="goTo('juegos')">← Volver</button>
          <div class="game-screen-title"><span>🔤</span> Termina la Palabra</div>
          <div class="game-screen-theme">${TEMATICA_NAMES[tematicaId]||''}</div>
        </div>
        <div class="coming-soon-box" style="margin-top:2rem;">
          <h2>Sin palabras</h2>
          <p>Aún no hay palabras cargadas para esta temática. (Recordá correr python crear_bd.py)</p>
          <button class="btn-play" style="margin-top:20px" onclick="goTo('juegos')">← Volver</button>
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
      <button class="btn-back" onclick="goTo('juegos')">← Volver</button>
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
          <button class="btn-back" onclick="goTo('juegos')">← Volver</button>
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
