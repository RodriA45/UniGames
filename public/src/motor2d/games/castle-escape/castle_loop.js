// ══════════════════════════════════════
//   Castle Escape — castle_loop.js  (módulo ES6)
// ══════════════════════════════════════
// Ciclo de vida de un nivel (cargar/pausar/reanudar/salir), input
// (teclado + touch) y el update principal por frame (updateTrampas).
// Equivalente al rol de runner_loop.js en Pixel Runner.
import {
  TR_EL, TRAMPAS, TR_LEVELS, TR_W, TR_H, TR_TIME_LIMITS, TR_DEATH_LIMITS,
  TR_ASSET_BASE, TR_ASSETS, TR_JUMP_VY, TR_GRAVITY, TR_MOVE_SPEED, TR_RUN_FRAMES,
  trLoop, trInput, trRectsOverlap, trOscillate
} from './castle_config.js';
import { trShowGameScreen, trAttachEnterHandler, trShowMainMenu, trShowLevelSelect, trUpdateLevelCard } from './castle_menu_flow.js';
import { trDrawSpikeRow, trDrawPlatform, drawTrampas } from './castle_render.js';
// Circular con castle_sequence.js (sequence importa trCalculateStars/
// trLoadLevel de acá) — igual que los otros, seguro porque no se llaman
// durante la carga del módulo.
import { showTrampasOverlay, trPlayerDie, trLevelComplete } from './castle_sequence.js';

export function trStartLevel(i) {
  if (!TR_LEVELS.length || !TR_LEVELS[i]) return;
  TRAMPAS.levelIndex = i;
  TRAMPAS.totalScore = 0;
  TRAMPAS.totalDeaths = 0;
  TRAMPAS.levelStartTime = performance.now();
  TRAMPAS.levelDeaths = 0;
  TRAMPAS.explosions = [];
  trLoadLevel(i);
  trShowGameScreen();
  TR_EL.pauseMenu.classList.add('hidden');
  TR_EL.controlsSign.classList.add('hidden');
  showTrampasOverlay(TR_LEVELS[i].nombre, TR_LEVELS[i].hint, false);
  TR_EL.hudDeaths.textContent = '💀 0';
  setupTrampasEvents();
  drawTrampas();
}

export function trCalculateStars() {
  const elapsed = (performance.now() - TRAMPAS.levelStartTime) / 1000;
  const timeLimit = TR_TIME_LIMITS[TRAMPAS.levelIndex] || 60;
  const deathLimit = TR_DEATH_LIMITS[TRAMPAS.levelIndex] || 5;
  let stars = 1;
  if (elapsed <= timeLimit) stars = 2;
  if (TRAMPAS.levelDeaths <= deathLimit) stars = 3;
  return stars;
}

// ─── Pausa ───
export function trPauseGame() {
  TRAMPAS.running = false;
  trLoop.stop();
  TR_EL.pauseMenu.classList.remove('hidden');
}
export function trResumeGame() {
  TR_EL.pauseMenu.classList.add('hidden');
  TRAMPAS.running = true;
  trLoop.start();
}
export function trExitToLevels() {
  TR_EL.pauseMenu.classList.add('hidden');
  stopTrampas();
  if (typeof setMusic === 'function') setMusic(TR_ASSET_BASE + 'sounds/menu_song.mp3');
  trShowLevelSelect();
}

export function trLoadLevel(index) {
  const lvl = TR_LEVELS[index];
  TRAMPAS.platforms = lvl.platforms.map(p => ({ ...p, touchedAt: null, gone: false }));
  TRAMPAS.hazards    = lvl.hazards.map(h => ({ ...h }));
  TRAMPAS.arrows     = lvl.arrows.map(a => ({ ...a, active: false, fired: false }));
  TRAMPAS.deathsThisLevel = 0;

  // Tamaño del nivel en world-space
  TRAMPAS.levelW = lvl.width  || TR_W;
  TRAMPAS.levelH = lvl.height || TR_H;
  TRAMPAS.fov = lvl.fov || 1;
  TRAMPAS.camera.x = 0;
  TRAMPAS.camera.y = 0;

  const floorCandidates = lvl.platforms.filter(p => p.type === 'normal' || p.type === 'fake');
  TRAMPAS.floorY = Math.max(...(floorCandidates.length ? floorCandidates : lvl.platforms).map(p => p.y));

  // Capa estática del nivel: piso/paredes (plataformas 'normal'/'fake', que
  // NUNCA cambian mientras dura el nivel) + los pinchos de pozo fijos
  // (hazards tipo 'spike'), todo pre-pintado UNA sola vez acá (con el
  // mismo dibujo a mano — piedra bloque por bloque — de siempre) en vez de
  // recalcularse en cada uno de los 60 frames por segundo (ver drawTrampas
  // y Engine2D.StaticLayer). Lo que sí cambia en tiempo real —plataformas
  // 'moving'/'crumble', pinchos que "aparecen" (arrows), decoración
  // animada (antorchas)— se sigue dibujando a mano, encima de esta capa.
  TRAMPAS.staticLayer = new Engine2D.StaticLayer(TRAMPAS.levelW, TRAMPAS.levelH);
  TRAMPAS.staticLayer.bake(bctx => {
    for (const hz of TRAMPAS.hazards) {
      if (hz.type === 'spike') trDrawSpikeRow(bctx, hz.x, hz.y, hz.w, hz.h);
    }
    for (const plat of TRAMPAS.platforms) {
      if (plat.type !== 'normal' && plat.type !== 'fake') continue;
      trDrawPlatform(bctx, plat);
      if (plat.decor === 'spike') trDrawSpikeRow(bctx, plat.x, plat.y - 20, plat.w, 20);
    }
  });

  const p = TRAMPAS.player;
  p.x = lvl.start.x; p.y = lvl.start.y;
  p.vx = 0; p.vy = 0; p.dead = false; p.onGround = false; p.ridingPlatform = null;
  p.facing = 1; p.animFrame = 0; p.animTick = 0; p.animFrameName = null;

  const starsEl = TR_EL.hudStars;
  if (starsEl) starsEl.textContent = (index + 1) + '/' + TR_LEVELS.length + ' - ' + lvl.nombre;

  const cont = document.querySelector('.trampas-container');
  if (cont) cont.style.background = `#150620 url('${TR_ASSET_BASE}models/back.webp') center/cover no-repeat`;
}

export function setupTrampasTouch() {
  if (TRAMPAS.touch) TRAMPAS.touch.detach();
  const C = TRAMPAS.canvas;
  const isTouchDevice = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  TRAMPAS.touch = new Engine2D.TouchControls(C, { visible: isTouchDevice });
  TRAMPAS.touch.addButton({ id: 'left', x: 40, y: 230, radius: 24, label: '◀' });
  TRAMPAS.touch.addButton({ id: 'right', x: 100, y: 230, radius: 24, label: '▶' });
  TRAMPAS.touch.addButton({ id: 'jump', x: 430, y: 230, radius: 30, label: '↑' });
  TRAMPAS.touch.attach();
  TRAMPAS._touchPrev = { left: false, right: false, jump: false };
}

export function syncTrampasTouch() {
  const t = TRAMPAS.touch;
  if (!t) return;
  const prev = TRAMPAS._touchPrev;

  if (t.state.left !== prev.left) { TRAMPAS.keys.left = t.state.left; prev.left = t.state.left; }
  if (t.state.right !== prev.right) { TRAMPAS.keys.right = t.state.right; prev.right = t.state.right; }

  const jumpPressed = t.state.jump && !prev.jump;
  prev.jump = t.state.jump;

  TRAMPAS.keys.jump = t.state.jump;
  if (jumpPressed) trJump();
}

export function initTrampas() {
  TRAMPAS.canvas = TR_EL.canvas;
  const C = TRAMPAS.canvas;
  C.width = TR_W;
  C.height = TR_H;
  TRAMPAS.ctx = C.getContext('2d');

  // Gestor de assets con progreso real: mientras se descargan sprites/
  // atlas se muestra una barra de carga encima del contenedor del juego
  // (Engine2D.LoadingBar, autocontenida) y TRAMPAS.assetsReady queda en
  // false — trPlaySelectedLevel no deja tocar "Empezar" hasta el 100%
  // (antes la carga arrancaba en paralelo con el menú, sin avisar nada:
  // en una conexión lenta se podía entrar a jugar con sprites invisibles
  // el primer segundo).
  TRAMPAS.assetsReady = false;
  const trLoadingBar = new Engine2D.LoadingBar({
    container: document.querySelector('.trampas-container') || document.body,
    label: 'Cargando Castle Escape…'
  });
  Engine2D.loadAllWithProgress(TR_ASSETS, (loaded, total) => {
    trLoadingBar.update(loaded / total);
  }).then(() => {
    TRAMPAS.assetsReady = true;
    trLoadingBar.destroy();
  }).catch(err => {
    console.error('Castle Escape: no se pudieron cargar los sprites', err);
    // No trabar el juego entero por un solo asset que falló — mismo
    // criterio que ya tenía el .catch() de antes.
    TRAMPAS.assetsReady = true;
    trLoadingBar.destroy();
  });

  const dotsEl = TR_EL.levelDots;
  dotsEl.innerHTML = '';
  TR_LEVELS.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'trampas-level-dot';
    dot.onclick = () => { TRAMPAS.selectedLevel = i; trUpdateLevelCard(); };
    dotsEl.appendChild(dot);
  });

  TRAMPAS.selectedLevel = 0;
  trShowMainMenu();
  setupTrampasEvents();
}

export function setupTrampasEvents() {
  trInput.attach();
  trAttachEnterHandler();
  setupTrampasTouch();
}

export function trJump() {
  if (!TRAMPAS.running) return;
  const p = TRAMPAS.player;
  if (p.dead || !p.onGround) return;
  p.vy = TR_JUMP_VY;
  p.onGround = false;
}

export function startTrampas() {
  TR_EL.overlay.classList.add('hidden');
  TRAMPAS.levelStartTime = performance.now();
  TRAMPAS.levelDeaths = 0;
  TRAMPAS.running = true;
  trLoop.start();
  if (TRAMPAS.touch) TRAMPAS.touch.attach();
  if (typeof setMusic === 'function') setMusic(TR_ASSET_BASE + 'sounds/backsong.mp3');
}

export function stopTrampas() {
  TRAMPAS.running = false;
  trLoop.stop();
  trInput.detach();
  if (TRAMPAS.touch) TRAMPAS.touch.detach();
  TRAMPAS.keys.left = false;
  TRAMPAS.keys.right = false;
  TRAMPAS.keys.jump = false;
  if (TRAMPAS.enterHandler) { document.removeEventListener('keydown', TRAMPAS.enterHandler); TRAMPAS.enterHandler = null; }
}

export function toggleCastleMusic() {
  if (typeof bgMusic !== 'undefined' && bgMusic) bgMusic.muted = !bgMusic.muted;
}

// ─── Helpers de sprites (mapa.png / deco.png) ───
export function updateTrampas(step) {
  syncTrampasTouch();
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

  // Salto continuo táctil: si el botón de saltar está mantenido y el jugador
  // acaba de aterrizar, saltar automáticamente (sin necesidad de soltar y volver
  // a tocar el botón entre cada salto).
  if (TRAMPAS.keys.jump && p.onGround) {
    p.vy = TR_JUMP_VY;
    p.onGround = false;
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

