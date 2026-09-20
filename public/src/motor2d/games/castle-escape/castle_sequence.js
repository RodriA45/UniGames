// ══════════════════════════════════════
//   Castle Escape — castle_sequence.js  (módulo ES6)
// ══════════════════════════════════════
// Secuencias de fin de nivel: morir, completar el nivel y el overlay de
// reinicio/continuar.
import {
  TRAMPAS, TR_EL, TR_LEVELS, trLoop, TR_FALL_FRAMES, TR_FALL_FRAME_DELAY,
  TR_DEATH_DELAY, TR_TIME_LIMITS, TR_DEATH_LIMITS
} from './castle_config.js';
import { trSaveLevelStars } from './castle_progress.js';
// Circular con castle_loop.js (loop importa showTrampasOverlay/
// trPlayerDie/trLevelComplete de acá) — seguro por la misma razón que
// los demás imports circulares de este set de módulos.
import { trCalculateStars, trLoadLevel, startTrampas } from './castle_loop.js';
import { trBackToLevelSelect } from './castle_menu_flow.js';
import { spawnExplosion } from './castle_render.js';

export function trPlayerDie() {
  const p = TRAMPAS.player;
  p.dead = true;
  TRAMPAS.deathsThisLevel++;
  TRAMPAS.totalDeaths++;
  TRAMPAS.levelDeaths++;
  const deathsEl = TR_EL.hudDeaths;
  if (deathsEl) deathsEl.textContent = 'Muertes: ' + TRAMPAS.totalDeaths;
  spawnExplosion(p.x + p.w / 2, p.y + p.h / 2);

  // Recorre fall_0..3 (junior.png) mientras dura el respawn, en vez de
  // quedarse en un solo frame — mismo criterio que playDeathAnimation en
  // Pixel Runner. El loop del juego (trLoop) sigue dibujando solo (updateTrampas
  // corta al toque por p.dead, pero el draw() del loop sigue en pie), así que acá
  // alcanza con ir cambiando animFrameName; no hace falta llamar drawTrampas() de nuevo.
  p.animFrameName = TR_FALL_FRAMES[0];

  let fallFrame = 0;
  const fallTimer = setInterval(() => {
    fallFrame++;
    if (fallFrame < TR_FALL_FRAMES.length) p.animFrameName = TR_FALL_FRAMES[fallFrame];
  }, TR_FALL_FRAME_DELAY);

  setTimeout(() => {
    clearInterval(fallTimer);
    trLoadLevel(TRAMPAS.levelIndex);
  }, TR_DEATH_DELAY);
}

export function trLevelComplete() {
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

  TR_EL.hudDeaths.textContent = 'Muertes: 0';

  // Reiniciar contadores para que el próximo nivel empiece en 0
  TRAMPAS.totalDeaths = 0;
  TRAMPAS.levelDeaths = 0;

  const esUltimo = TRAMPAS.levelIndex >= TR_LEVELS.length - 1;
  if (esUltimo) {
    if (typeof guardarPuntaje === 'function') guardarPuntaje(8, TRAMPAS.totalScore, null);
    showTrampasOverlay('¡Completaste todo!', starsText + '  +' + levelScore + ' pts — Total: ' + TRAMPAS.totalScore + '\n\n' + condiciones, true);
  } else {
    TRAMPAS.levelIndex++;
    TRAMPAS.levelStartTime = performance.now();
    trLoadLevel(TRAMPAS.levelIndex);
    showTrampasOverlay('¡Nivel superado!', starsText + '  +' + levelScore + ' pts\n\n' + condiciones, false, '▶ Continuar');
  }
}

export function showTrampasOverlay(title, sub, isEnd, btnLabel) {
  const overlay = TR_EL.overlay;
  overlay.classList.remove('hidden');
  TR_EL.overlayTitle.textContent = title;
  TR_EL.overlaySub.textContent = sub;
  TR_EL.startBtn.textContent = isEnd ? 'Jugar de nuevo' : (btnLabel || '▶ Empezar');
  TR_EL.startBtn.onclick = isEnd ? restartTrampas : startTrampas;
}

export function restartTrampas() {
  trBackToLevelSelect();
}

