// ══════════════════════════════════════
//   Pixel Runner — runner_sequence.js  (módulo ES6)
// ══════════════════════════════════════
// Secuencias especiales de fin de partida: muerte, animación de caída y
// la aproximación/entrada al castillo al ganar el Modo Historia.
import {
  RUNNER, RUNNER_EL, RUNNER_ASSETS, RUNNER_COMICS, RUN_FRAMES, FALL_FRAMES,
  CASTLE_TARGET_H, CASTLE_REST_MARGIN, CASTLE_GROUND_OFFSET, CASTLE_DOOR_WALK_GAP,
  CASTLE_WALK_SPEED_MULT, WIN_APPROACH_PAUSE_MS, FALL_FRAME_DELAY, FALL_HOLD_BEFORE_OVERLAY,
  showRunnerComic, runnerSyncPauseBtn
} from './runner_config.js';
import { loadHistoriaCompleta, saveHistoriaCompleta } from './runner_economy.js';
import { drawRunner } from './runner_render.js';

export async function startHistoriaWinApproach(C) {
  RUNNER.obstacles = [];
  RUNNER.pickups = [];

  // El castillo es una imagen pesada (2400×1792) que solo se ve acá, al
  // ganar Modo Historia — no tiene sentido tenerla en el manifest inicial
  // pagando esa VRAM durante toda la partida. Se carga recién ahora, bajo
  // demanda; Engine2D.loadImage cachea en el mismo lugar que getImage(),
  // así que el resto del código (drawRunner en runner_render.js) no
  // necesita saber que la carga fue diferida.
  const img = await Engine2D.loadImage(RUNNER_ASSETS.castillo).catch(() => null);

  const p = RUNNER.player;
  const h = CASTLE_TARGET_H;
  const aspect = (img && img.width && img.height) ? (img.width / img.height) : 0.85;
  const w = h * aspect;
  const groundY = C.height - RUNNER.groundH;
  const restX = C.width - w - CASTLE_REST_MARGIN;

  RUNNER.winCastle = {
    x: C.width + 30,
    y: groundY - h + CASTLE_GROUND_OFFSET,
    w, h,
    restX,
    settled: false, // true cuando termina de entrar en cuadro
  };
  RUNNER.winArrived = false;
  p.walkTargetX = restX - CASTLE_DOOR_WALK_GAP; // hasta acá camina Junior antes de "tocar" la puerta

  // Fuerza pasto para el final, sin importar en qué segmento (pasto/desierto)
  // haya caído el score al tocar la meta.
  RUNNER.biome = 'grass';
}

// Update especial mientras dura la secuencia de victoria — reemplaza por
// completo al updateRunner de siempre (sin spawns, sin colisiones, sin
// más puntaje). Primero entra el castillo, recién cuando ya está asentado
// Junior arranca a caminar hacia la puerta.
export function updateWinApproach(step, C) {
  const p = RUNNER.player;
  const castle = RUNNER.winCastle;
  if (!castle) return;

  // El cielo/nubes siguen su curso para que la escena no se sienta
  // congelada mientras dura la secuencia.
  RUNNER.sky.t = RUNNER.frameCount % RUNNER.sky.cycleLen;
  RUNNER.sky.clouds.forEach(c => {
    c.x -= c.speed * step;
    if (c.x < -100) c.x = C.width + 40 + Math.random() * 60;
  });

  if (!castle.settled) {
    // Entra a la misma velocidad a la que venían viajando los obstáculos.
    castle.x -= RUNNER.speed * step;
    if (castle.x <= castle.restX) {
      castle.x = castle.restX;
      castle.settled = true;
    }
    // Junior sigue trotando en el lugar mientras tanto.
    p.animTick += step;
    if (p.animTick >= 6) { p.animTick = 0; p.animFrame = (p.animFrame + 1) % RUN_FRAMES.length; }
    return;
  }

  if (RUNNER.winArrived) return; // ya llegó, está esperando el timeout de finishHistoriaWin

  if (p.x < p.walkTargetX) {
    p.x = Math.min(p.walkTargetX, p.x + RUNNER.moveSpeed * CASTLE_WALK_SPEED_MULT * step);
    p.animTick += step;
    if (p.animTick >= 6) { p.animTick = 0; p.animFrame = (p.animFrame + 1) % RUN_FRAMES.length; }
  } else {
    RUNNER.winArrived = true;
    setTimeout(finishHistoriaWin, WIN_APPROACH_PAUSE_MS);
  }
}


export function playerDie() {
  const p = RUNNER.player;
  p.dead = true;
  RUNNER.running = false;
  runnerSyncPauseBtn();
  bgMusic.pause();
  if (typeof playDeathSound === 'function') playDeathSound();
  if (RUNNER.loop) RUNNER.loop.stop();

  if (RUNNER.score > RUNNER.bestScore) RUNNER.bestScore = RUNNER.score;
  guardarPuntaje(7, RUNNER.score);

  playDeathAnimation();
}

// Se llama al terminar la secuencia de acercamiento al castillo (ver
// updateWinApproach). A diferencia de playerDie() no hay choque/animación
// de caída: el personaje ya llegó caminando hasta la puerta, y de acá se
// pasa directo al cómic final + cartel de victoria, y de paso se
// desbloquea el Modo Infinito para siempre.
export function finishHistoriaWin() {
  const p = RUNNER.player;
  RUNNER.running = false;
  runnerSyncPauseBtn();
  if (RUNNER.loop) RUNNER.loop.stop();
  bgMusic.pause();

  if (RUNNER.score > RUNNER.bestScore) RUNNER.bestScore = RUNNER.score;
  guardarPuntaje(7, RUNNER.score);

  const yaEstabaCompleto = loadHistoriaCompleta();
  saveHistoriaCompleta();

  const sub = yaEstabaCompleto
    ? ('Puntos: ' + RUNNER.score + '  ·  Monedas totales: ' + RUNNER.totalCoins)
    : ('¡Modo Infinito desbloqueado! 🔓  ·  Monedas totales: ' + RUNNER.totalCoins);

  // Cómic final antes del cartel de victoria de siempre.
  showRunnerComic(RUNNER_COMICS.final, () => {
    showRunnerOverlay('🏆 ¡Historia completada!', sub, true, true);
  });
}

// Recorre fall_0..fall_3 a mano (el loop ya está parado) y recién cuando
// termina muestra el cartel de "Game Over" — así el choque se ve como un
// golpe/caída en vez de saltar directo al cartel.
export function playDeathAnimation() {
  const p = RUNNER.player;
  let frame = 0;
  p.animFrameName = FALL_FRAMES[0];
  drawRunner(true);

  const step = () => {
    frame++;
    if (frame < FALL_FRAMES.length) {
      p.animFrameName = FALL_FRAMES[frame];
      drawRunner(true);
      setTimeout(step, FALL_FRAME_DELAY);
    } else {
      setTimeout(() => {
        RUNNER_EL.best.textContent = 'Mejor: ' + RUNNER.bestScore + ' pts';
        // Al perder recién ahí se muestra el total histórico de monedas
        // (durante la partida el HUD solo mostraba las de esa corrida).
        showRunnerOverlay('¡Game Over!', 'Puntos: ' + RUNNER.score + '  ·  Monedas totales: ' + RUNNER.totalCoins, true);
      }, FALL_HOLD_BEFORE_OVERLAY);
    }
  };
  setTimeout(step, FALL_FRAME_DELAY);
}

// Dibuja el sprite de derrota de Junior (último frame de la caída, ya
// cargado en el atlas) en el mini-canvas del overlay de game over, en vez
// del ícono genérico viejo que había ahí antes.
export function drawRunnerCharPreview(victory) {
  const canvas = RUNNER_EL.charPreviewCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const juniorImg = Engine2D.getImage(RUNNER_ASSETS.junior);
  const juniorAtlas = Engine2D.getAtlas(RUNNER_ASSETS.juniorAt);
  if (juniorImg && juniorAtlas) {
    // Derrota = último frame de la caída; victoria = pose corriendo (no hay
    // sprite de "festejo" en el atlas, así que reusamos una de correr).
    const frameName = victory ? RUN_FRAMES[0] : FALL_FRAMES[FALL_FRAMES.length - 1];
    const targetH = canvas.height - 4; // margen chico para que no se recorte contra los bordes
    ctx.imageSmoothingEnabled = true;
    Engine2D.drawAtlasFrame(ctx, juniorImg, juniorAtlas, frameName, canvas.width / 2, canvas.height - 2, targetH, false, false);
    ctx.imageSmoothingEnabled = false;
  }
}

export function showRunnerOverlay(title, sub, isGameover, victory) {
  const overlay = RUNNER_EL.overlay;
  overlay.classList.remove('hidden');
  RUNNER_EL.overlayTitle.textContent = title;
  RUNNER_EL.overlaySub.textContent = sub;
  if (RUNNER.bestScore > 0) {
    RUNNER_EL.best.textContent = 'Mejor: ' + RUNNER.bestScore + ' pts';
  }
  if (isGameover) drawRunnerCharPreview(victory);
  const goBtn = RUNNER_EL.restartBtn;
  const menuBtn = RUNNER_EL.menuBtn;
  if (goBtn) goBtn.style.display = isGameover ? 'inline-block' : 'none';
  if (menuBtn) menuBtn.style.display = isGameover ? 'inline-block' : 'none';
}

