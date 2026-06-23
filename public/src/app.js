// ══════════════════════════════════════
//   UniGames — app.js
// ══════════════════════════════════════

let currentUser = null;

// ─── Datos de juegos ───────────────────
const allGames = [
  { emoji: '🔍', title: 'Sopa de Letras',    desc: 'Encontrá palabras ocultas en la grilla. Mientras más rápido, más puntos ganás.', tag: '⏱ Velocidad' },
  { emoji: '❓', title: 'Preguntados',        desc: 'Trivia de múltiple opción. Respondé preguntas sobre tu temática favorita.',       tag: '🧠 Trivia'    },
  { emoji: '🔤', title: 'Termina la Palabra', desc: 'Adiviná la palabra incompleta. Tenés solo 5 intentos. ¡Pensá bien!',             tag: '🎯 5 intentos' },
  { emoji: '🪢', title: 'Ahorcado',           desc: 'El clásico de siempre, ahora con temáticas. Letra por letra antes de que se complete el dibujo.', tag: '⚡ Clásico'   },
  { emoji: '🕵️', title: 'Adivina la Cosa',   desc: 'Pistas progresivas para adivinar un juego, película, actor o anime.',           tag: '🔎 Pistas'    },
  { emoji: '🟩', title: 'Adivina la Palabra', desc: 'Modo difícil estilo Wordle. 5 intentos, colores que te dan pistas letra por letra.', tag: '🔥 Hard'     },
];

// ─── Utilidades ────────────────────────
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ─── Inicio: juegos destacados aleatorios ───
function renderFeatured() {
  const three = shuffle(allGames).slice(0, 3);
  document.getElementById('featuredGrid').innerHTML = three.map(g => `
    <div class="game-card" onclick="goTo('juegos')">
      <div class="card-emoji">${g.emoji}</div>
      <div class="card-title">${g.title}</div>
      <p class="card-desc">${g.desc}</p>
      <span class="card-tag">${g.tag}</span>
      <button class="btn-play">▶ Jugar ahora</button>
    </div>
  `).join('');
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

// ─── Modal login / registro ────────────
function openModal(tab) {
  document.getElementById('modalOverlay').classList.add('open');
  switchTab(tab || 'login');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabRegister').classList.toggle('active', !isLogin);
  document.getElementById('auth-section-login').classList.toggle('active', isLogin);
  document.getElementById('auth-section-register').classList.toggle('active', !isLogin);
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
  const card = btn.closest('.game-card-full');
  const selected = card ? card.querySelector('.theme-btn.selected') : null;
  const theme = selected ? selected.textContent.trim() : null;
  const tematicaId = selected ? selected.dataset.tematica : null;

  goTo(gameKey);

  const labelId = gameKey + '-theme-label';
  const labelEl = document.getElementById(labelId);
  if (labelEl) labelEl.textContent = theme || '';

  if (gameKey === 'ahorcado')    initAhorcado(tematicaId);
  if (gameKey === 'wordle')      initWordle(tematicaId);
  if (gameKey === 'runner')      initRunner();
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
    const res = await fetch('/api/ahorcado/palabra?tematica=' + encodeURIComponent(tematicaId));
    const data = await res.json();
    if (data.palabra) word = data.palabra.toLowerCase();
  } catch (e) {
    console.error(e);
    word = 'error';
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
    const res = await fetch('/api/wordle/palabra?tematica=' + encodeURIComponent(tematicaId));
    const data = await res.json();
    if (data.palabra) word = data.palabra.toLowerCase();
  } catch (e) {
    console.error(e);
  }

  if (!word) word = 'error';

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

  // Juegos destacados aleatorios
  renderFeatured();

  // Evitar recarga en links del menú
  document.querySelectorAll('.nav-menu a').forEach(a => {
    a.addEventListener('click', e => e.preventDefault());
  });

  // Cargar tabla de posiciones desde la API
  fetchLeaderboard();
});

// ─── Lógica de API (Backend) ───────────
async function handleLogin(e) {
  e.preventDefault();
  const identity = document.getElementById('loginIdentity').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, password })
    });
    const data = await res.json();
    
    if (res.ok) {
      currentUser = data.user;
      alert('Inicio de sesión exitoso');
      closeModal();
      updateAuthUI();
    } else {
      alert(data.error || 'Error al iniciar sesión');
    }
  } catch (err) {
    console.error(err);
    alert('Error de conexión');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('regUsername').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;

  if (password !== confirm) {
    alert('Las contraseñas no coinciden');
    return;
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    
    if (res.ok) {
      alert('Registro exitoso, ahora podés iniciar sesión');
      switchTab('login');
    } else {
      alert(data.error || 'Error al registrarse');
    }
  } catch (err) {
    console.error(err);
    alert('Error de conexión');
  }
}

function updateAuthUI() {
  const authArea = document.getElementById('authArea');
  if (currentUser) {
    authArea.innerHTML = `
      <span style="color: #fff; margin-right: 15px; font-weight: bold;">Hola, ${currentUser.username}</span>
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

    const GAME_ICONS = { 1:'🔍', 2:'❓', 3:'🔤', 4:'🪢', 5:'🕵️', 6:'🟩' };
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
          <td>${e.jugador}</td>
          <td><span class="score-badge">${e.puntos}</span></td>
        </tr>`;
      }).join('');

      return `
        <div class="lb-game-card">
          <div class="lb-game-title">${GAME_ICONS[jid] || '🎮'} ${g.juego}</div>
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
      ? '/api/leaderboard?juego_id=1'   // runner usa juego_id=1 provisoriamente
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
        <td>${s.jugador}</td>
        <td><span class="score-badge">${s.puntos}</span></td>
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
    await fetch('/api/partidas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: currentUser.id,
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
  score: 0, bestScore: 0,
  speed: 5, baseSpeed: 5,
  frameCount: 0,
  obstacleTimer: 0, obstacleInterval: 90,

  // Personaje
  player: {
    x: 90, y: 0, w: 32, h: 48,
    vy: 0, jumps: 0, maxJumps: 2,
    dead: false, animFrame: 0, animTick: 0,
    groundY: 0,
  },

  // Suelo y cielo
  groundH: 24, skyH: 24,

  // Obstáculos activos
  obstacles: [],

  // Estrellas de fondo
  stars: [],
};

function initRunner() {
  RUNNER.canvas = document.getElementById('runnerCanvas');
  const C = RUNNER.canvas;

  // Tamaño responsivo
  const W = Math.min(C.parentElement.clientWidth, 800);
  C.width  = W;
  C.height = Math.round(W * 0.38);
  RUNNER.ctx = C.getContext('2d');

  // Las zapatillas llegan hasta y + 36*S, con S = p.w/32 = 1 → 36px desde y
  // groundY = donde empieza el suelo, el personaje debe llegar justo ahí
  RUNNER.player.groundY = C.height - RUNNER.groundH - 36;
  RUNNER.player.y       = RUNNER.player.groundY;

  // Generar estrellas
  RUNNER.stars = Array.from({length: 40}, () => ({
    x: Math.random() * C.width,
    y: Math.random() * (C.height * 0.55),
    r: Math.random() * 1.5 + 0.5,
    blink: Math.random()
  }));

  // Mostrar overlay de inicio
  showRunnerOverlay('¡Pixel Runner!', 'Espacio / ↑ / Tap para saltar\nDoble salto disponible', false);
  if (RUNNER.bestScore > 0) {
    document.getElementById('runnerBest').textContent = 'Mejor: ' + RUNNER.bestScore + ' pts';
  }

  // Eventos
  setupRunnerEvents();
}

function setupRunnerEvents() {
  // Evitar duplicados
  document.removeEventListener('keydown', runnerKeyHandler);
  document.addEventListener('keydown', runnerKeyHandler);
  RUNNER.canvas.removeEventListener('click', runnerTapHandler);
  RUNNER.canvas.addEventListener('click', runnerTapHandler);
  RUNNER.canvas.removeEventListener('touchstart', runnerTapHandler);
  RUNNER.canvas.addEventListener('touchstart', runnerTapHandler, {passive: true});
}

function runnerKeyHandler(e) {
  if (!document.getElementById('sec-runner').classList.contains('active')) return;
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
    const h = 28 + Math.floor(Math.random() * 28);
    const w = 16 + Math.floor(Math.random() * 14);
    RUNNER.obstacles.push({ x: C.width + 20, y: groundY - h, w, h, kind: 'ground' });
  } else if (type < 0.75) {
    // Obstáculo aéreo (pájaro/nube enemiga)
    const h = 18 + Math.floor(Math.random() * 12);
    const w = 30 + Math.floor(Math.random() * 20);
    const minY = skyTop + 4;
    const maxY = C.height * 0.45;
    const y = minY + Math.random() * (maxY - minY);
    RUNNER.obstacles.push({ x: C.width + 20, y, w, h, kind: 'air' });
  } else {
    // Combo: dos obstáculos a la vez
    const h1 = 24 + Math.floor(Math.random() * 20);
    RUNNER.obstacles.push({ x: C.width + 20, y: groundY - h1, w: 14, h: h1, kind: 'ground' });
    const h2 = 16;
    const y2 = skyTop + 10 + Math.random() * (C.height * 0.3);
    RUNNER.obstacles.push({ x: C.width + 60, y: y2, w: 28, h: h2, kind: 'air' });
  }
}

function playerDie() {
  RUNNER.player.dead = true;
  RUNNER.running = false;
  if (RUNNER.raf) { cancelAnimationFrame(RUNNER.raf); RUNNER.raf = null; }

  if (RUNNER.score > RUNNER.bestScore) RUNNER.bestScore = RUNNER.score;
  guardarPuntaje(1, RUNNER.score); // Guardamos puntaje (ID 1 temporal)

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
  document.getElementById('runnerStartBtn').textContent    = isGameover ? '🔄 Reintentar' : '▶ Empezar';
  if (RUNNER.bestScore > 0)
    document.getElementById('runnerBest').textContent = 'Mejor: ' + RUNNER.bestScore + ' pts';
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
    preguntas  = await res.json();
  } catch(e) { console.error(e); }

  pregState = { preguntas, idx: 0, score: 0, timer: null, timeLeft: PREGUNTADOS_TIME, tematicaId, finished: false };
  document.getElementById('preguntados-theme-label').textContent = TEMATICA_NAMES[tematicaId] || '';
  renderPreguntados();
}

function renderPreguntados() {
  const sec = document.getElementById('sec-preguntados');
  const { preguntas, idx, score, finished } = pregState;

  if (finished || idx >= preguntas.length) {
    sec.querySelector('.coming-soon-box')?.remove();
    const puntos = score;
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

  if (preguntas.length === 0) {
    sec.innerHTML = `
      <div class="game-screen-header">
        <button class="btn-back" onclick="goTo('juegos')">← Volver</button>
        <div class="game-screen-title"><span>❓</span> Preguntados</div>
      </div>
      <div class="coming-soon-box">
        <div class="cs-emoji">😕</div>
        <p class="cs-title">Sin preguntas</p>
        <p class="cs-desc">No hay preguntas para esta temática todavía.</p>
        <button class="btn-play" onclick="goTo('juegos')" style="max-width:200px;margin:0 auto;">← Volver a Juegos</button>
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
  renderSopa(); startSopaTimer(); // re-render sin perder timer
  // Evitar restart del timer: solo re-render visual
  clearInterval(sopaState.timer);
  updateSopaHighlight();
  startSopaTimer();
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
        clearInterval(sopaState.timer);
        setTimeout(() => sopaFinish(true), 400);
      }
      return;
    }
  }
}

function sopaFinish(won) {
  sopaState.finished = true;
  clearInterval(sopaState.timer);
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
    const res  = await fetch('/api/wordle/palabra?tematica=' + tematicaId);
    const data = await res.json();
    if (data.palabra) word = data.palabra.toLowerCase();
  } catch(e) { console.error(e); }

  if (!word) word = 'error';

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
  }

  renderTermina();
}

