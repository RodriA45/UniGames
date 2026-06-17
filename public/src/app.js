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

  // Actualizar link activo en el menú
  const links = document.querySelectorAll('.nav-menu a');
  const map = { inicio: 0, juegos: 1, puntuacion: 2 };
  links.forEach(a => a.classList.remove('active'));
  if (links[map[section]]) links[map[section]].classList.add('active');

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
      
      let rankClass = rank <= 3 ? \`rank-\${idx+1}\` : '';

      return \`<tr>
        <td class="\${rankClass}">\${rank}</td>
        <td>\${s.jugador}</td>
        <td><span class="game-pill">\${s.juego}</span></td>
        <td>\${s.tematica || '—'}</td>
        <td><span class="score-badge">\${s.puntos}</span></td>
      </tr>\`;
    }).join('');
  } catch (err) {
    console.error('Error al cargar puntuaciones', err);
  }
}
