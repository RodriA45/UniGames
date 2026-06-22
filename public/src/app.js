// ══════════════════════════════════════
//   UniGames — app.js
// ══════════════════════════════════════

let currentUser = null;

// ─── Datos de juegos ───────────────────
const allGames = [
  { emoji: '🔍', title: 'Sopa de Letras',    desc: 'Encontrá palabras ocultas en la grilla. Mientras más rápido, más puntos ganás.', tag: '⏱ Velocidad' },
  { emoji: '❓', title: 'Preguntados',        desc: 'Trivia de múltiple opción. Respondé preguntas sobre tu temática favorita.',       tag: '🧠 Trivia'    },
  { emoji: '🔤', title: 'Termina la Palabra', desc: 'Adiviná la palabra incompleta. Tenés solo 5 intentos. ¡Pensá bien!',             tag: '🎯 5 intentos' },
  { emoji: '🪢', title: 'Ahorcado',           desc: 'El clásico de siempre. Letra por letra antes de que se complete el dibujo.',     tag: '⚡ Clásico'   },
  { emoji: '🕵️', title: 'Adivina la Cosa',   desc: 'Pistas progresivas para adivinar un juego, película, actor o anime.',           tag: '🔎 Pistas'    },
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
  document.getElementById('formLogin').style.display    = isLogin ? 'block' : 'none';
  document.getElementById('formRegister').style.display = isLogin ? 'none'  : 'block';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabRegister').classList.toggle('active', !isLogin);
  document.getElementById('modalTitle').innerHTML = isLogin
    ? 'Iniciar sesión<br>en UniGames'
    : 'Crear cuenta<br>en UniGames';
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

  goTo(gameKey);

  const labelId = gameKey + '-theme-label';
  const labelEl = document.getElementById(labelId);
  if (labelEl) labelEl.textContent = theme || '';

  if (gameKey === 'ahorcado') initAhorcado();
  if (gameKey === 'runner')   initRunner();
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
  finished: false
};

async function initAhorcado() {
  let word = 'cargando';
  try {
    const res = await fetch('/api/ahorcado/palabra');
    const data = await res.json();
    if (data.palabra) word = data.palabra.toLowerCase();
  } catch (e) {
    console.error(e);
    word = 'error';
  }

  ahorcadoState = { word, revealed: [], wrong: [], maxErrors: 6, finished: false };

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
    if (won) {
      statusEl.textContent = '🎉 ¡Ganaste! La palabra era: ' + word.toUpperCase();
      statusEl.className = 'ahorcado-status win';
      const puntos = 1000 - (ahorcadoState.wrong.length * 150);
      guardarPuntaje(4, puntos); // juego_id = 4 (Ahorcado)
    } else {
      // Revelar todas las letras al perder
      ahorcadoState.revealed = word.split('');
      statusEl.textContent = '💀 ¡Perdiste! La palabra era: ' + word.toUpperCase();
      statusEl.className = 'ahorcado-status lose';
      guardarPuntaje(4, 50); // 50 puntos consuelo
    }
  }

  renderAhorcadoWord();
  renderAhorcadoKeyboard();
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

async function fetchLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    if (!res.ok) return;
    const scores = await res.json();
    
    const tbody = document.getElementById('leaderboardBody');
    if (!tbody) return;

    if (scores.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Todavía no hay puntuaciones</td></tr>';
      return;
    }

    tbody.innerHTML = scores.map((s, idx) => {
      let rank = idx + 1;
      if (rank === 1) rank = '🥇 1';
      else if (rank === 2) rank = '🥈 2';
      else if (rank === 3) rank = '🥉 3';
      
      let rankClass = rank <= 3 ? `rank-${idx+1}` : '';

      return `<tr>
        <td class="${rankClass}">${rank}</td>
        <td>${s.jugador}</td>
        <td><span class="game-pill">${s.juego}</span></td>
        <td>${s.tematica || '—'}</td>
        <td><span class="score-badge">${s.puntos}</span></td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('Error al cargar puntuaciones', err);
  }
}

async function guardarPuntaje(juego_id, puntos) {
  if (!currentUser) return; // Solo guarda si hay sesión iniciada
  try {
    await fetch('/api/partidas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: currentUser.id,
        juego_id: juego_id,
        tematica_id: null,
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
  if (!RUNNER.running) { startRunner(); return; }
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
