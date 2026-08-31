// Exportado desde Castle Escape Level Editor
// Guardá este archivo como src/games/castle_escape_levels.js (reemplazando
// el que ya esté ahí) e incluilo con un <script> ANTES de castle_escape.js
// en index.html — así el juego usa estos niveles siempre, en cualquier
// navegador, sin depender del localStorage del editor.
const CASTLE_ESCAPE_CUSTOM_LEVELS = [
  {
    nombre: "Inicio de la adventura",
    hint: "Caminá tranquilo... o no.",
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0, y: 240, w: 130, h: 30, type: 'normal' },
      { x: 130, y: 240, w: 60, h: 30, type: 'fake' },
      { x: 190, y: 240, w: 20, h: 30, type: 'fake' },
      { x: 210, y: 240, w: 110, h: 30, type: 'normal' },
      { x: 320, y: 240, w: 50, h: 30, type: 'fake' },
      { x: 370, y: 240, w: 110, h: 30, type: 'normal' },
    ],
    hazards: [
    ],
    arrows: [
    ],
    exit: { x: 430, y: 200, w: 26, h: 40 },
    decor: [
      { type: 'torch', x: 20, y: 40, h: 38 },
      { type: 'torch', x: 440, y: 40, h: 38 },
      { type: 'ivy', x: 150, y: 0, h: 55 },
      { type: 'banner', x: 300, y: 0, h: 70 },
    ],
  },
  {
    nombre: "Camino Peligroso",
    hint: "El piso te puede fallar dos veces.",
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0, y: 240, w: 150, h: 30, type: 'normal' },
      { x: 150, y: 240, w: 50, h: 30, type: 'fake' },
      { x: 200, y: 240, w: 150, h: 30, type: 'normal' },
      { x: 350, y: 240, w: 60, h: 30, type: 'fake' },
      { x: 410, y: 240, w: 70, h: 30, type: 'normal' },
    ],
    hazards: [
      { x: 130, y: 230, w: 20, h: 10, type: 'spike', size: 'small' },
    ],
    arrows: [
    ],
    exit: { x: 430, y: 200, w: 26, h: 40 },
    decor: [
      { type: 'torch', x: 50, y: 80, h: 36 },
      { type: 'torch', x: 270, y: 80, h: 36 },
      { type: 'ivy_2', x: 250, y: 0, h: 50 },
    ],
  },
  {
    nombre: "Sorpresa por los 2 Lados",
    hint: "Algo se acerca desde la derecha.",
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0, y: 240, w: 170, h: 30, type: 'normal' },
      { x: 170, y: 240, w: 80, h: 30, type: 'fake' },
      { x: 250, y: 240, w: 230, h: 30, type: 'normal' },
    ],
    hazards: [
    ],
    arrows: [
      { triggerX: 195, x: 480, y: 220, w: 22, h: 8, dir: -1, speed: 4.2, active: false, fired: false },
      { triggerX: 300, x: -25, y: 220, w: 22, h: 8, dir: 1, speed: 10, active: false, fired: false },
    ],
    exit: { x: 430, y: 200, w: 26, h: 40 },
    decor: [
      { type: 'torch', x: 25, y: 50, h: 34 },
      { type: 'chain_hook', x: 200, y: 0, h: 60 },
      { type: 'banner_tattered', x: 400, y: 0, h: 55 },
    ],
  },
  {
    nombre: "Se cae a pedazos",
    hint: "No te quedes parado mucho tiempo.",
    width: 510,
    start: { x: 20, y: 170 },
    platforms: [
      { x: 0, y: 210, w: 90, h: 20, type: 'normal' },
      { x: 90, y: 210, w: 30, h: 20, type: 'fake' },
      { x: 180, y: 210, w: 60, h: 20, type: 'crumble' },
      { x: 300, y: 210, w: 90, h: 20, type: 'normal' },
      { x: 460, y: 210, w: 50, h: 20, type: 'normal' },
    ],
    hazards: [
      { x: 0, y: 255, w: 510, h: 15, type: 'spike' },
    ],
    arrows: [
      { triggerX: 390, x: 420, y: 270, w: 8, h: 22, dir: 'up', speed: 25, active: false, fired: false },
    ],
    exit: { x: 470, y: 170, w: 26, h: 40 },
    decor: [
      { type: 'torch', x: 50, y: 80, h: 34 },
      { type: 'torch', x: 470, y: 80, h: 34 },
    ],
  },
  {
    nombre: "Salto de fe",
    hint: "Donde ves pinchos, pisá. Donde ves piso, ¡no!",
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0, y: 240, w: 110, h: 30, type: 'normal' },
      { x: 110, y: 240, w: 40, h: 30, type: 'normal', decor: 'spike' },
      { x: 150, y: 240, w: 90, h: 30, type: 'fake' },
      { x: 240, y: 240, w: 40, h: 30, type: 'normal', decor: 'spike' },
      { x: 280, y: 240, w: 200, h: 30, type: 'normal' },
    ],
    hazards: [
    ],
    arrows: [
      { triggerX: 340, x: 480, y: 220, w: 22, h: 8, dir: -1, speed: 7, active: false, fired: false },
      { triggerX: 380, x: 480, y: 60, w: 22, h: 8, dir: -1, speed: 7, active: false, fired: false },
    ],
    exit: { x: 440, y: 200, w: 26, h: 40 },
    decor: [
      { type: 'torch', x: 50, y: 80, h: 36 },
      { type: 'banner', x: 260, y: 60, h: 65 },
      { type: 'ivy_2', x: 60, y: 0, h: 45 },
    ],
  },
  {
    nombre: "Saltos Precisos",
    hint: "Al limite los saltos",
    width: 600,
    height: 280,
    start: { x: 20, y: 200 },
    platforms: [
      { x: 0, y: 240, w: 60, h: 20, type: 'normal' },
      { x: 230, y: 240, w: 80, h: 20, type: 'normal' },
      { x: 160, y: 240, w: 30, h: 20, type: 'fake' },
      { x: 240, y: 130, w: 30, h: 20, type: 'fake' },
      { x: 480, y: 120, w: 40, h: 20, type: 'fake' },
      { x: 90, y: 240, w: 30, h: 20, type: 'crumble' },
      { x: 350, y: 190, w: 60, h: 20, type: 'crumble' },
      { x: 520, y: 120, w: 80, h: 20, type: 'normal' },
      { x: 270, y: 130, w: 40, h: 20, type: 'normal' },
      { x: 280, y: 50, w: 40, h: 20, type: 'crumble' },
      { x: 370, y: 50, w: 30, h: 20, type: 'crumble' },
      { x: 90, y: 90, w: 30, h: 20, type: 'moving', move: { axis: 'x', from: 90, to: 190, speed: 1.2 } },
    ],
    hazards: [
    ],
    arrows: [
      { triggerX: 320, x: 600, y: 180, w: 22, h: 8, dir: -1, speed: 15, active: false, fired: false },
    ],
    exit: { x: 550, y: 80, w: 26, h: 40 },
    decor: [
      { type: 'torch', x: 340, y: 70, h: 38 },
    ],
  },
  {
    nombre: "Prueba extrema",
    hint: "mucho cuidado con lo saltos",
    width: 640,
    height: 440,
    fov: 1.3,
    start: { x: 20, y: 80 },
    platforms: [
      { x: 0, y: 120, w: 100, h: 20, type: 'normal' },
      { x: 140, y: 120, w: 180, h: 20, type: 'normal' },
      { x: 590, y: 100, w: 50, h: 20, type: 'normal' },
      { x: 0, y: 232, w: 310, h: 20, type: 'normal' },
      { x: 170, y: 350, w: 250, h: 20, type: 'normal' },
      { x: 30, y: 390, w: 50, h: 30, type: 'crumble' },
      { x: 310, y: 280, w: 50, h: 30, type: 'moving', move: { axis: 'x', from: 160, to: 317, speed: 1.2 } },
      { x: 290, y: 420, w: 60, h: 20, type: 'moving', move: { axis: 'x', from: 100, to: 400, speed: 2 } },
      { x: 540, y: 400, w: 30, h: 20, type: 'moving', move: { axis: 'y', from: 200, to: 400, speed: 1.2 } },
      { x: 470, y: 410, w: 30, h: 20, type: 'normal' },
      { x: 490, y: 170, w: 35, h: 20, type: 'moving', move: { axis: 'y', from: 10, to: 200, speed: 2 } },
    ],
    hazards: [
      { x: 120, y: 200, w: 40, h: 36, type: 'saw', move: { axis: 'x', from: 113, to: 246, speed: 1.8 } },
      { x: 140, y: 112, w: 180, h: 8, type: 'spike', size: 'medium' },
      { x: 220, y: 150, w: 30, h: 10, type: 'saw', move: { axis: 'x', from: 128, to: 261, speed: 1.8 } },
      { x: 170, y: 340, w: 250, h: 8, type: 'spike', size: 'medium' },
      { x: 430, y: 160, w: 26, h: 26, type: 'saw', move: { axis: 'y', from: 10, to: 300, speed: 20 } },
    ],
    arrows: [
    ],
    exit: { x: 600, y: 60, w: 26, h: 40 },
    decor: [
      { type: 'torch', x: 70, y: 70, h: 38 },
      { type: 'torch', x: 360, y: 70, h: 38 },
    ],
  },
];
