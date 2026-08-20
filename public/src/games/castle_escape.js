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

// ─── SISTEMA DE ESTRELLAS ───
const TR_TIME_LIMITS = [30, 35, 35, 40, 40, 45, 45, 50, 50, 55, 60, 55, 55, 60, 60, 65, 65, 70, 70, 75];
const TR_DEATH_LIMITS = [5, 5, 5, 4, 4, 3, 3, 3, 2, 2, 1, 3, 3, 2, 2, 2, 1, 1, 1, 1];

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
    decor: [
      { type: 'torch', x: 20,  y: 40, h: 38 },
      { type: 'torch', x: 440, y: 40, h: 38 },
      { type: 'ivy',   x: 150, y: 0,  h: 55 },
      { type: 'banner', x: 300, y: 0, h: 70 },
    ],
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
  // ─── Nivel 12: mecánica nueva — plataformas móviles ('moving') ───
  // Se paran arriba tuyo y te llevan con ellas mientras las estás pisando
  // (ver trOscillate/ridingPlatform en updateTrampas). Nivel intro: es la
  // única forma de subir, sin nada más que lo complique.
  {
    nombre: 'El ascensor traidor',
    hint: 'Subite y esperá. No te tires.',
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0,   y: 240, w: 80,  h: 30, type: 'normal' },
      { x: 150, y: 240, w: 60,  h: 16, type: 'moving', move: { axis: 'y', from: 140, to: 240, speed: 0.8 } },
      { x: 250, y: 140, w: 230, h: 30, type: 'normal' },
    ],
    hazards: [],
    arrows: [],
    exit: { x: 430, y: 100, w: 26, h: 40 },
    decor: [
      { type: 'chain', x: 145, y: 0, h: 90 },
      { type: 'torch', x: 260, y: 90, h: 34 },
      { type: 'banner_tattered', x: 420, y: 0, h: 65 },
    ],
  },
  // ─── Nivel 13: mecánica nueva — sierra móvil ('saw') ───
  // Peligro que se mueve solo (no es pisable), mata al tocarlo. Nivel
  // intro de la mecánica: piso plano, solo hay que timear el salto.
  {
    nombre: 'La sierra viviente',
    hint: 'Algo afilado va y viene por el piso.',
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0, y: 240, w: 480, h: 30, type: 'normal' },
    ],
    hazards: [
      { x: 190, y: 214, w: 26, h: 26, type: 'saw', move: { axis: 'x', from: 150, to: 330, speed: 1.6 } },
    ],
    arrows: [],
    exit: { x: 430, y: 200, w: 26, h: 40 },
  },
  {
    nombre: 'Doble ascensor',
    hint: 'Un elevador te sube, otro te cruza.',
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0,   y: 240, w: 70, h: 30, type: 'normal' },
      { x: 100, y: 240, w: 50, h: 16, type: 'moving', move: { axis: 'y', from: 150, to: 240, speed: 0.9 } },
      { x: 170, y: 150, w: 60, h: 20, type: 'normal' },
      { x: 250, y: 150, w: 60, h: 16, type: 'moving', move: { axis: 'x', from: 250, to: 370, speed: 1.1 } },
      { x: 390, y: 150, w: 90, h: 20, type: 'normal' },
    ],
    hazards: [
      { x: 230, y: 255, w: 250, h: 15, type: 'spike' },
    ],
    arrows: [],
    exit: { x: 440, y: 110, w: 26, h: 40 },
  },
  {
    nombre: 'Salto de fe (parte 2)',
    hint: 'Piso falso arriba, sierra abajo.',
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0,   y: 240, w: 100, h: 30, type: 'normal' },
      { x: 140, y: 240, w: 70,  h: 30, type: 'fake'   },
      { x: 250, y: 240, w: 230, h: 30, type: 'normal' },
    ],
    hazards: [
      { x: 140, y: 255, w: 70, h: 15, type: 'spike' },
      { x: 270, y: 214, w: 26, h: 26, type: 'saw', move: { axis: 'x', from: 270, to: 440, speed: 1.8 } },
    ],
    arrows: [],
    exit: { x: 440, y: 200, w: 26, h: 40 },
  },
  {
    nombre: 'Torres gemelas',
    hint: 'Dos ascensores, dos ritmos distintos.',
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0,   y: 240, w: 60, h: 30, type: 'normal' },
      { x: 90,  y: 240, w: 50, h: 16, type: 'moving', move: { axis: 'y', from: 120, to: 240, speed: 1.0 } },
      { x: 200, y: 220, w: 50, h: 16, type: 'moving', move: { axis: 'y', from: 100, to: 220, speed: 1.2 } },
      { x: 310, y: 100, w: 170, h: 20, type: 'normal' },
    ],
    hazards: [
      { x: 60, y: 255, w: 420, h: 15, type: 'spike' },
    ],
    arrows: [
      { triggerX: 250, x: 480, y: 80, w: 22, h: 8, dir: -1, speed: 5.0, active: false, fired: false },
    ],
    exit: { x: 440, y: 60, w: 26, h: 40 },
  },
  {
    nombre: 'Todo se mueve',
    hint: 'Nada se queda quieto acá adentro.',
    start: { x: 20, y: 170 },
    platforms: [
      { x: 0,   y: 210, w: 70, h: 20, type: 'normal'  },
      { x: 110, y: 210, w: 60, h: 20, type: 'crumble' },
      { x: 200, y: 180, w: 60, h: 16, type: 'moving',  move: { axis: 'x', from: 200, to: 320, speed: 1.3 } },
      { x: 350, y: 180, w: 130, h: 20, type: 'normal' },
    ],
    hazards: [
      { x: 0,   y: 255, w: 480, h: 15, type: 'spike' },
      { x: 360, y: 154, w: 26,  h: 26, type: 'saw', move: { axis: 'x', from: 360, to: 450, speed: 2.0 } },
    ],
    arrows: [],
    exit: { x: 440, y: 140, w: 26, h: 40 },
  },
  {
    nombre: 'Lluvia y sierra',
    hint: 'Esquivá flechas sin dejar de mirar el piso.',
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0, y: 240, w: 480, h: 30, type: 'normal' },
    ],
    hazards: [
      { x: 250, y: 214, w: 26, h: 26, type: 'saw', move: { axis: 'x', from: 80, to: 400, speed: 2.2 } },
    ],
    arrows: [
      { triggerX: 100, x: 480, y: 214, w: 22, h: 8, dir: -1, speed: 4.5, active: false, fired: false },
      { triggerX: 220, x: 480, y: 214, w: 22, h: 8, dir: -1, speed: 5.5, active: false, fired: false },
      { triggerX: 340, x: 480, y: 214, w: 22, h: 8, dir: -1, speed: 6.5, active: false, fired: false },
    ],
    exit: { x: 430, y: 200, w: 26, h: 40 },
  },
  {
    nombre: 'El ascensor invisible',
    hint: 'La plataforma de arriba miente. La de abajo, no.',
    start: { x: 20, y: 150 },
    platforms: [
      { x: 0,   y: 180, w: 70, h: 20, type: 'normal'  },
      { x: 100, y: 150, w: 50, h: 20, type: 'fake'    },
      { x: 170, y: 150, w: 50, h: 16, type: 'moving',  move: { axis: 'y', from: 150, to: 230, speed: 1.1 } },
      { x: 250, y: 150, w: 60, h: 20, type: 'crumble' },
      { x: 340, y: 180, w: 140, h: 20, type: 'normal' },
    ],
    hazards: [
      { x: 0, y: 255, w: 480, h: 15, type: 'spike' },
    ],
    arrows: [
      { triggerX: 280, x: 480, y: 154, w: 22, h: 8, dir: -1, speed: 5.5, active: false, fired: false },
    ],
    exit: { x: 440, y: 140, w: 26, h: 40 },
  },
  {
    nombre: 'La prueba definitiva',
    hint: 'Todo lo que aprendiste, junto y sin piedad.',
    start: { x: 20, y: 150 },
    platforms: [
      { x: 0,   y: 180, w: 60, h: 20, type: 'normal'  },
      { x: 90,  y: 180, w: 40, h: 20, type: 'fake'    },
      { x: 90,  y: 210, w: 40, h: 20, type: 'crumble' },
      { x: 160, y: 210, w: 50, h: 16, type: 'moving',  move: { axis: 'x', from: 160, to: 260, speed: 1.2 } },
      { x: 290, y: 150, w: 50, h: 16, type: 'moving',  move: { axis: 'y', from: 150, to: 230, speed: 1.3 } },
      { x: 380, y: 110, w: 100, h: 20, type: 'normal' },
    ],
    hazards: [
      { x: 0,   y: 255, w: 480, h: 15, type: 'spike' },
      { x: 390, y: 84,  w: 26,  h: 26, type: 'saw', move: { axis: 'x', from: 390, to: 450, speed: 2.4 } },
    ],
    arrows: [
      { triggerX: 200, x: 480, y: 184, w: 22, h: 8, dir: -1, speed: 5.5, active: false, fired: false },
      { triggerX: 320, x: 480, y: 124, w: 22, h: 8, dir: -1, speed: 6.5, active: false, fired: false },
    ],
    exit: { x: 440, y: 70, w: 26, h: 40 },
  },
];

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

  // w/h en proporción 32:36 (la misma que usa drawTrampasPlayer), así el
  // sprite dibujado llega exactamente hasta el borde inferior del hitbox
  // y no queda "flotando" sobre las plataformas.
  player: { x: 20, y: 200, w: 24, h: 27, vx: 0, vy: 0, onGround: false, dead: false, ridingPlatform: null },

  // Estado dinámico del nivel actual (copias mutables de plataformas/flechas)
  platforms: [],
  hazards: [],
  arrows: [],
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
  ['trampasMainMenu', 'trampasLevelSelect', 'trampasSettings', 'trampasHowToPlay', 'trampasGameScreen'].forEach(id => {
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
  // Sincronizar los sliders con el volumen global actual (por si se
  // cambió desde otro juego, o es la primera vez que se abre).
  const musicPct = Math.round((typeof getGlobalMusicVolume === 'function' ? getGlobalMusicVolume() : 0.5) * 100);
  const sfxPct = Math.round((typeof getGlobalSfxVolume === 'function' ? getGlobalSfxVolume() : 0.8) * 100);
  const musicSlider = document.getElementById('trMusicVolume');
  const sfxSlider = document.getElementById('trSfxVolume');
  if (musicSlider) musicSlider.value = musicPct;
  if (sfxSlider) sfxSlider.value = sfxPct;
  document.getElementById('trMusicVolumeValue').textContent = musicPct + '%';
  document.getElementById('trSfxVolumeValue').textContent = sfxPct + '%';
}
function trOnMusicVolumeChange(v) {
  document.getElementById('trMusicVolumeValue').textContent = v + '%';
  if (typeof setGlobalMusicVolume === 'function') setGlobalMusicVolume(v / 100);
}
function trOnSfxVolumeChange(v) {
  document.getElementById('trSfxVolumeValue').textContent = v + '%';
  if (typeof setGlobalSfxVolume === 'function') setGlobalSfxVolume(v / 100);
}
function trShowHowToPlay() {
  trHideAll();
  document.getElementById('trampasHowToPlay').classList.remove('hidden');
}
function trShowGameScreen() {
  trHideAll();
  document.getElementById('trampasGameScreen').classList.remove('hidden');
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

  const p = TRAMPAS.player;
  p.x = lvl.start.x; p.y = lvl.start.y;
  p.vx = 0; p.vy = 0; p.dead = false; p.onGround = false; p.ridingPlatform = null;

  const starsEl = document.getElementById('trampas-hud-stars');
  if (starsEl) starsEl.textContent = (index + 1) + '/' + TR_LEVELS.length + ' - ' + lvl.nombre;

  // Imagen de fondo del castillo (capa 0): back1 para la primera mitad de
  // niveles, back2 para la segunda (repartido parejo entre los 20).
  const cont = document.querySelector('.trampas-container');
  if (cont) cont.style.background = "#150620 url('assert/Castle Escape/" + (index >= 10 ? 'back2' : 'back1') + ".jpg') center/cover no-repeat";
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

// Dibuja una plataforma. El sprite de "isla flotante" (mapa.png) se usa
// SOLO para lo que realmente flota/se mueve/se rompe: plataformas
// 'moving', 'crumble', y las 'normal'/'fake' que son islas sueltas en el
// aire (angostas, no tocan el piso). El "suelo" — los pisos largos que
// hacen de base del nivel — vuelve a la textura de color plana de antes,
// tal cual pediste. 'fake' siempre se dibuja IGUAL que 'normal' de su
// mismo tipo (isla o piso) — esa es la trampa, no debe notarse cuál es cuál.
function trIsFloatingPlatform(plat) {
  return plat.type === 'moving' || plat.type === 'crumble' || plat.w < 260;
}

function trDrawPlatform(ctx, plat) {
  const assets = trGetMapaAssets();
  const useSprite = assets && trIsFloatingPlatform(plat);
  if (useSprite) {
    const f = assets.atlas.frames.platform_float;
    ctx.drawImage(assets.img, f.x, f.y, f.w, f.h, plat.x, plat.y, plat.w, plat.h);
  } else {
    // Piso / suelo — textura de color plana, la de siempre.
    ctx.fillStyle = '#7c3aed';
    ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(plat.x, plat.y, plat.w, 4);
  }
  // Tintes por encima para distinguir tipo/estado — mismo criterio de
  // color que antes, ahora como overlay semi-transparente sobre lo que
  // se haya dibujado (sprite o color plano).
  if (plat.type === 'moving') {
    ctx.fillStyle = 'rgba(14,165,233,0.35)';
    ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
  } else if (plat.type === 'crumble' && plat.touchedAt !== null) {
    ctx.fillStyle = 'rgba(232,84,63,0.45)';
    ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
  }
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
    } else if (d.type === 'chain') {
      f = F.chain_straight;
    } else if (d.type === 'banner') {
      f = F.banner;
    } else if (d.type === 'banner_tattered') {
      f = F.banner_tattered;
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
function trDrawSpikeRow(ctx, x, y, w, h) {
  const assets = trGetMapaAssets();
  if (!assets) {
    ctx.fillStyle = '#ef4444';
    const n = Math.max(1, Math.floor(w / 14));
    for (let i = 0; i < n; i++) {
      const sx = x + i * (w / n);
      ctx.beginPath();
      ctx.moveTo(sx, y + h);
      ctx.lineTo(sx + w / n / 2, y);
      ctx.lineTo(sx + w / n, y + h);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }
  const f = assets.atlas.frames.spike_1;
  const iconW = h * (f.w / f.h);
  const n = Math.max(1, Math.round(w / iconW));
  const step = w / n;
  for (let i = 0; i < n; i++) {
    ctx.drawImage(assets.img, f.x, f.y, f.w, f.h, x + i * step, y, step, h);
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
  p.x = Math.max(0, Math.min(p.x, TR_W - p.w));

  // Gravedad
  p.vy += TR_GRAVITY * step;
  p.y  += p.vy * step;
  p.onGround = false;
  p.ridingPlatform = null;

  // Colisión con plataformas (todo menos 'fake', que nunca colisiona)
  // Sigue siendo código propio: son rectángulos sueltos, no una grilla de
  // tiles pareja, así que Engine2D.Physics (pensado para TileMap) no aplica acá.
  for (const plat of TRAMPAS.platforms) {
    if (plat.type === 'fake' || plat.gone) continue;
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

  // Flechas de pared: se activan al cruzar triggerX
  const lvl = TR_LEVELS[TRAMPAS.levelIndex];
  lvl.arrows.forEach((def, i) => {
    const a = TRAMPAS.arrows[i];
    if (!a.fired && p.x >= def.triggerX) {
      a.fired = true;
      a.active = true;
      a.x = def.x;
    }
  });
  TRAMPAS.arrows.forEach(a => {
    if (a.active) {
      a.x += a.dir * a.speed * step;
      if (a.x < -30 || a.x > TR_W + 30) a.active = false;
      if (trRectsOverlap(p, a)) { trPlayerDie(); return; }
    }
  });

  if (p.dead) return;

  // Peligros: estáticos (picos, estrella) y móviles (sierra) — misma
  // comprobación, la sierra ya se movió arriba antes de llegar acá.
  for (const hz of TRAMPAS.hazards) {
    if (trRectsOverlap(p, hz)) { trPlayerDie(); return; }
  }

  // Caerse del mapa
  if (p.y > TR_H + 20) { trPlayerDie(); return; }

  // Llegar a la salida
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

  // Fondo transparente: el contenedor muestra la imagen del castillo (capa 0)
  ctx.clearRect(0, 0, TR_W, TR_H);

  // Decoración de fondo (antorchas/hiedra/cadenas/estandartes) — va antes
  // que las plataformas para quedar detrás de todo lo jugable.
  trDrawDecor(ctx);

  // Plataformas
  for (const plat of TRAMPAS.platforms) {
    if (plat.gone) continue;
    trDrawPlatform(ctx, plat);
    if (plat.decor === 'spike') {
      trDrawSpikeRow(ctx, plat.x, plat.y - 20, plat.w, 20);
    }
  }

  // Peligros
  for (const hz of TRAMPAS.hazards) {
    if (hz.type === 'spike') {
      trDrawSpikeRow(ctx, hz.x, hz.y, hz.w, hz.h);
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

  // Flechas activas
  {
    const assets = trGetMapaAssets();
    TRAMPAS.arrows.forEach(a => {
      if (!a.active) return;
      if (assets) {
        const f = a.dir < 0 ? assets.atlas.frames.arrow_left : assets.atlas.frames.arrow_right;
        ctx.drawImage(assets.img, f.x, f.y, f.w, f.h, a.x, a.y, a.w, a.h);
      } else {
        ctx.fillStyle = '#facc15';
        ctx.fillRect(a.x, a.y, a.w, a.h);
      }
    });
  }

  // Salida
  const lvl = TR_LEVELS[TRAMPAS.levelIndex];
  {
    const assets = trGetMapaAssets();
    if (assets) {
      const f = assets.atlas.frames.door_exit;
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
}
