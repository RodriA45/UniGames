// ══════════════════════════════════════
//   Pixel Runner — runner_loop.js  (módulo ES6)
// ══════════════════════════════════════
// Ciclo de vida del juego (init/start/stop), input (teclado + touch) y el
// update principal por frame (updateRunner). Equivalente al rol de
// rpg_combat_input.js en RPG Pixel.
import {
  RUNNER, RUNNER_EL, RUNNER_ASSETS, RUNNER_ASSET_BASE, RUN_FRAMES, GRAVITY,
  BIOME_SEGMENT, HISTORIA_GOAL, POWERUP_CHANCE, runnerScoreText,
  COIN_SPIN_FRAMES
} from './runner_config.js';
import { loadTotalCoins, refreshRunnerUpgrades, runnerScoreMultiplier } from './runner_economy.js';
import { spawnObstacle, spawnPickupGroup, spawnPowerup, collectPickup } from './runner_spawn.js';
import { startHistoriaWinApproach, updateWinApproach, playerDie } from './runner_sequence.js';
import { drawRunner } from './runner_render.js';

export function initRunner() {
  RUNNER.canvas = document.getElementById('runnerCanvas');

  requestAnimationFrame(() => {
    const C = RUNNER.canvas;
    const W = 480, H = 270;
    C.width = W;
    C.height = H;
    RUNNER.ctx = C.getContext('2d');

    RUNNER.player.groundY = C.height - RUNNER.groundH - RUNNER.player.h;
    RUNNER.player.y = RUNNER.player.groundY;
    RUNNER.totalCoins = loadTotalCoins();
    refreshRunnerUpgrades(); // trae las mejoras compradas antes de que arranque la partida

    RUNNER_EL.overlay.classList.add('hidden');
    if (RUNNER.bestScore > 0) {
      RUNNER_EL.best.textContent = 'Mejor: ' + RUNNER.bestScore + ' pts';
    }

    setupRunnerInput();
    setupRunnerTouch();

    // Cargar sprites una sola vez (Engine2D cachea, así que si ya están
    // cargados de una sesión anterior esto resuelve al toque). Barra de
    // carga real (Engine2D.LoadingBar), mismo patrón que Castle Escape en
    // castle_loop.js: se ve el % mientras bajan los sprites/atlas.
    const runnerLoadingBar = new Engine2D.LoadingBar({
      container: document.querySelector('.runner-container') || document.body,
      label: 'Cargando Pixel Runner…'
    });
    Engine2D.loadAllWithProgress([
      { type: 'image', src: RUNNER_ASSETS.junior },
      { type: 'atlas', src: RUNNER_ASSETS.juniorAt },
      { type: 'image', src: RUNNER_ASSETS.bird },
      { type: 'atlas', src: RUNNER_ASSETS.birdAt },
      { type: 'image', src: RUNNER_ASSETS.obst },
      { type: 'atlas', src: RUNNER_ASSETS.obstAt },
      { type: 'image', src: RUNNER_ASSETS.mapa },
      { type: 'atlas', src: RUNNER_ASSETS.mapaAt },
      { type: 'image', src: RUNNER_ASSETS.item },
      { type: 'atlas', src: RUNNER_ASSETS.itemAt },
      { type: 'image', src: RUNNER_ASSETS.castillo },
    ], (loaded, total) => {
      runnerLoadingBar.update(loaded / total);
    }).then(() => {
        runnerLoadingBar.destroy();
        startRunner();
      }).catch(err => {
        runnerLoadingBar.destroy();
        console.error('No se pudieron cargar los sprites de Pixel Runner', err);
        startRunner(); // arranca igual — drawRunner tiene fallback a rectángulos
      });
  });
}

// ─── Input ──────────────────────────────
export function setupRunnerInput() {
  if (RUNNER.input) RUNNER.input.detach();

  RUNNER.input = new Engine2D.KeyboardInput(
    {
      ArrowUp: 'jump', Space: 'jump', KeyW: 'jump',
      ArrowDown: 'drop', KeyS: 'drop',
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
    },
    {
      activeCheck: () => RUNNER_EL.section.classList.contains('active'),
      preventDefaultFor: new Set(['ArrowUp', 'Space', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS']),
      onDown: (action) => {
        // Enter/Espacio en el overlay de game over = reintentar
        const overlay = RUNNER_EL.overlay;
        if (overlay && !overlay.classList.contains('hidden')) {
          if (action === 'jump') {
            const btn = RUNNER_EL.restartBtn;
            if (btn && btn.style.display !== 'none') btn.click();
          }
          return;
        }
        if (action === 'jump') runnerJumpOrStart();
        if (action === 'drop') runnerFastDrop();
      },
    }
  );
  RUNNER.input.attach();
}

// Llamadas desde los botones táctiles (index.html, mismo patrón que rpgMove)
export function runnerMove(dir, isDown) {
  if (!RUNNER.input) return;
  RUNNER.input.state[dir] = isDown;
}

// Controles táctiles DENTRO del canvas (Engine2D.TouchControls) — reemplazan
// los viejos botones de Saltar/Bajar que vivían en HTML debajo del juego.
// Izquierda/derecha: par horizontal abajo a la izquierda.
// Saltar/bajar: par vertical abajo a la derecha.
// Chicos (radius 15) para no tapar mucha pantalla de juego.
export function setupRunnerTouch() {
  if (RUNNER.touch) RUNNER.touch.detach();
  const C = RUNNER.canvas;
  // Solo se muestran/reaccionan en dispositivos táctiles — en PC el juego
  // se controla con teclado, así que acá no deben aparecer ni ser clickeables.
  const isTouchDevice = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  RUNNER.touch = new Engine2D.TouchControls(C, { visible: isTouchDevice });
  RUNNER.touch.addButton({ id: 'left', x: 34, y: 232, radius: 26, label: '◀' });
  RUNNER.touch.addButton({ id: 'right', x: 94, y: 232, radius: 26, label: '▶' });
  RUNNER.touch.addButton({ id: 'jump', x: 450, y: 182, radius: 26, label: '▲' });
  RUNNER.touch.addButton({ id: 'drop', x: 450, y: 242, radius: 26, label: '▼' });
  RUNNER.touch.attach();
  RUNNER._touchPrev = { left: false, right: false, jump: false, drop: false };
}

// Se llama UNA VEZ por frame desde updateRunner (antes que nada, incluso
// con el jugador muerto, para que Saltar reintente en la pantalla de game
// over igual que hace la tecla ↑/Espacio). Convierte el estado "sostenido"
// del engine en las mismas llamadas que ya usaba el teclado.
export function syncRunnerTouch() {
  const t = RUNNER.touch;
  if (!t) return;
  const prev = RUNNER._touchPrev;

  if (t.state.left !== prev.left) { runnerMove('left', t.state.left); prev.left = t.state.left; }
  if (t.state.right !== prev.right) { runnerMove('right', t.state.right); prev.right = t.state.right; }

  const jumpPressed = t.state.jump && !prev.jump;
  const dropPressed = t.state.drop && !prev.drop;
  prev.jump = t.state.jump;
  prev.drop = t.state.drop;
  if (!jumpPressed && !dropPressed) return;

  // Mismo criterio que setupRunnerInput: si el cartel de game over está
  // abierto, Saltar reintenta en vez de saltar.
  const overlay = RUNNER_EL.overlay;
  if (overlay && !overlay.classList.contains('hidden')) {
    if (jumpPressed) {
      const btn = RUNNER_EL.restartBtn;
      if (btn && btn.style.display !== 'none') btn.click();
    }
    return;
  }
  if (jumpPressed) runnerJumpOrStart();
  if (dropPressed) runnerFastDrop();
}

export function runnerFastDrop() {
  if (!RUNNER.running) return;
  RUNNER.started = true; // agacharse/caída rápida también cuenta como el primer input
  const p = RUNNER.player;
  if (p.dead || p.y >= p.groundY) return;
  p.vy = Math.abs(p.vy) * 0.5 + RUNNER.canvas.height * 0.04;
}

export function runnerJumpOrStart() {
  const overlay = RUNNER_EL.overlay;
  if (overlay && !overlay.classList.contains('hidden')) return;
  if (!RUNNER.running) return;
  RUNNER.started = true; // primer input: arranca el juego (personaje deja de estar quieto)
  const p = RUNNER.player;
  if (p.dead) return;
  if (p.jumps < p.maxJumps) {
    p.vy = -RUNNER.canvas.height * 0.018;
    p.jumps++;
  }
}

// ─── Ciclo de vida ──────────────────────
export function startRunner() {
  setMusic(RUNNER_ASSET_BASE + 'sounds/backplay.mp3');

  RUNNER.score = 0;
  RUNNER.speed = RUNNER.baseSpeed;
  RUNNER.frameCount = 0;
  RUNNER.obstacleTimer = 0;
  RUNNER.obstacleInterval = 90;
  RUNNER.obstacles = [];
  RUNNER.running = true;
  RUNNER.started = false; // arranca quieto — se activa con el primer input (ver updateRunner)
  RUNNER.pickups = [];
  RUNNER.pickupTimer = 0;
  RUNNER.doublePointsFrames = 0;
  RUNNER.coinsRun = 0; // totalCoins NO se resetea acá, es histórico
  RUNNER.winCastle = null;
  RUNNER.winArrived = false;

  const p = RUNNER.player;
  p.x = 90;
  p.y = p.groundY;
  p.vy = 0;
  p.jumps = 0;
  p.dead = false;
  p.animFrame = 0;
  p.animTick = 0;
  p.animFrameName = null;
  p.facing = 1;
  p.shield = false;
  p.shieldFrames = 0;
  p.shieldHitsLeft = 0;

  // Arranca siempre en el bioma de pasto y de día (frame 0 = fase 0 del
  // ciclo día/noche, que cae dentro del tramo de día).
  RUNNER.biome = 'grass';
  RUNNER.sky.t = 0;

  RUNNER_EL.overlay.classList.add('hidden');
  RUNNER_EL.scoreDisplay.textContent = runnerScoreText(0);
  const coinsRunEl = RUNNER_EL.coinsRunDisplay;
  if (coinsRunEl) coinsRunEl.textContent = '0';
  RUNNER_EL.restartBtn.style.display = 'none';
  RUNNER_EL.menuBtn.style.display = 'none';

  if (RUNNER.loop) RUNNER.loop.stop();
  RUNNER.loop = new Engine2D.GameLoop({
    update: (dt, step) => updateRunner(step),
    draw: () => drawRunner(),
  });
  RUNNER.loop.start();
}

export function stopRunner() {
  RUNNER.running = false;
  if (RUNNER.loop) RUNNER.loop.stop();
  if (RUNNER.input) RUNNER.input.detach();
  if (RUNNER.touch) RUNNER.touch.detach();
}

export function updateRunner(step) {
  const C = RUNNER.canvas;
  const p = RUNNER.player;
  syncRunnerTouch();
  if (p.dead) return;

  // Esperando el primer input: el personaje queda quieto parado en el
  // piso y nada más se mueve (ni obstáculos, ni score, ni ciclo día/noche)
  // hasta que el jugador toca cualquier botón (salto, agache, izq o der).
  if (!RUNNER.started) {
    const waitingInput = RUNNER.input.state;
    if (waitingInput.left || waitingInput.right || waitingInput.jump || waitingInput.drop) {
      RUNNER.started = true;
    } else {
      return;
    }
  }

  // Secuencia de victoria de Historia en curso: el castillo entra en
  // cuadro / Junior camina hacia la puerta. Mientras dura esto no hay
  // spawns, colisiones ni más puntaje — ver updateWinApproach.
  if (RUNNER.winCastle) {
    updateWinApproach(step, C);
    return;
  }

  // Score + velocidad
  RUNNER.frameCount++;
  if (RUNNER.frameCount % 6 === 0) {
    RUNNER.score += RUNNER.doublePointsFrames > 0 ? runnerScoreMultiplier() : 1; // x2/x3 (según mejora) activo = puntaje multiplicado por tick
    if (RUNNER.mode === 'historia' && RUNNER.score >= HISTORIA_GOAL) {
      RUNNER.score = HISTORIA_GOAL; // no pasarse de la meta en el HUD
      RUNNER_EL.scoreDisplay.textContent = runnerScoreText(RUNNER.score);
      startHistoriaWinApproach(C);
      return;
    }
    RUNNER_EL.scoreDisplay.textContent = runnerScoreText(RUNNER.score);
    if (RUNNER.score % 250 === 0) {
      RUNNER.speed += 0.8;
      RUNNER.obstacleInterval = Math.max(45, RUNNER.obstacleInterval - 5);
    }
  }
  if (RUNNER.doublePointsFrames > 0) RUNNER.doublePointsFrames = Math.max(0, RUNNER.doublePointsFrames - step);
  if (p.shieldFrames > 0) {
    p.shieldFrames = Math.max(0, p.shieldFrames - step);
    p.shield = p.shieldFrames > 0;
  }

  // Bioma: alterna pasto/desierto cada BIOME_SEGMENT (500) puntos.
  const segmentIndex = Math.floor(RUNNER.score / BIOME_SEGMENT);
  RUNNER.biome = (segmentIndex % 2 === 0) ? 'grass' : 'desert';

  // Movimiento lateral (acotado al corredor). Junior siempre corre mirando
  // a la derecha — ir hacia la izquierda no lo hace "correr para atrás",
  // es simplemente perder terreno/velocidad relativa (el sprite no se da
  // vuelta), por eso facing nunca pasa a -1 acá.
  const input = RUNNER.input.state;
  let vx = 0;
  if (input.left) vx -= RUNNER.moveSpeed;
  if (input.right) vx += RUNNER.moveSpeed;
  p.x = Math.min(RUNNER.corridorMaxX, Math.max(RUNNER.corridorMinX, p.x + vx * step));

  // Física vertical (salto/gravedad) — sin cambios respecto a antes
  p.vy += GRAVITY * (C.height / 200) * step;
  p.y += p.vy * step;
  if (p.y >= p.groundY) {
    p.y = p.groundY;
    p.vy = 0;
    p.jumps = 0;
  }

  // Animación de correr (piernas) solo si está en el piso
  p.animTick += step;
  if (p.animTick >= 6) { p.animTick = 0; p.animFrame = (p.animFrame + 1) % RUN_FRAMES.length; }

  // Ciclo día/noche + nubes (las nubes van a su propia velocidad, más
  // lenta que el juego — no aceleran con RUNNER.speed, dan sensación de
  // fondo lejano / parallax). sky.t se deriva directo de frameCount (no se
  // acumula solo) para que quede perfectamente sincronizado con el score:
  // la noche arranca justo a los DAY_HALF puntos de cada bioma.
  RUNNER.sky.t = RUNNER.frameCount % RUNNER.sky.cycleLen;
  RUNNER.sky.clouds.forEach(c => {
    c.x -= c.speed * step;
    if (c.x < -100) c.x = C.width + 40 + Math.random() * 60;
  });

  // Spawn de obstáculos
  RUNNER.obstacleTimer += step;
  if (RUNNER.obstacleTimer >= RUNNER.obstacleInterval) {
    RUNNER.obstacleTimer = 0;
    spawnObstacle(C);
  }

  // Mover + colisionar obstáculos
  for (let i = RUNNER.obstacles.length - 1; i >= 0; i--) {
    const o = RUNNER.obstacles[i];
    o.x -= RUNNER.speed * step;
    o.animTick = (o.animTick || 0) + step;
    if (o.x + o.w < -20) { RUNNER.obstacles.splice(i, 1); continue; }

    const margin = 6;
    if (
      p.x + margin < o.x + o.w - margin &&
      p.x + p.w - margin > o.x + margin &&
      p.y + margin < o.y + o.h - margin &&
      p.y + p.h - margin > o.y + margin
    ) {
      if (p.shieldFrames > 0) {
        // El escudo protege golpes (1, o 2 con la mejora "Escudo
        // reforzado") sin importar cuánto timer le quedaba todavía; recién
        // se apaga del todo cuando se le acaban los golpes.
        p.shieldHitsLeft = Math.max(0, (p.shieldHitsLeft || 1) - 1);
        RUNNER.obstacles.splice(i, 1);
        if (p.shieldHitsLeft <= 0) {
          p.shieldFrames = 0;
          p.shield = false;
        }
        continue;
      }
      // Si hay un duelo de Pixel Runner en curso (window.dueloActivo lo
      // pone app2.js), capturamos el puntaje final ACÁ, en el momento
      // exacto de morir, antes de que playerDie() haga lo suyo. Es más
      // confiable que leerlo después desde el HUD.
      const dueloRunnerActivo = window.dueloActivo && window.dueloActivo.juego === 'runner'
        ? window.dueloActivo
        : null;
      const scoreFinalDuelo = RUNNER.score;
      playerDie();
      if (dueloRunnerActivo && typeof window.finalizarDueloConPuntaje === 'function') {
        window.finalizarDueloConPuntaje(dueloRunnerActivo.id, scoreFinalDuelo);
      }
      return;
    }
  }

  // Spawn de monedas / power-ups
  RUNNER.pickupTimer += step;
  if (RUNNER.pickupTimer >= RUNNER.pickupInterval) {
    RUNNER.pickupTimer = 0;
    if (Math.random() < POWERUP_CHANCE) {
      spawnPowerup(C);
    } else {
      spawnPickupGroup(C);
    }
  }

  // Mover + colisionar monedas / power-ups (no matan, suman puntos o dan buff)
  for (let i = RUNNER.pickups.length - 1; i >= 0; i--) {
    const o = RUNNER.pickups[i];
    o.x -= RUNNER.speed * step;
    if (o.kind === 'coin') {
      o.spinTick = (o.spinTick || 0) + step;
      if (o.spinTick >= 4) { o.spinTick = 0; o.spinFrame = (o.spinFrame + 1) % COIN_SPIN_FRAMES.length; }
    }
    if (o.x + o.w < -20) { RUNNER.pickups.splice(i, 1); continue; }

    if (
      p.x < o.x + o.w &&
      p.x + p.w > o.x &&
      p.y < o.y + o.h &&
      p.y + p.h > o.y
    ) {
      collectPickup(o);
      RUNNER.pickups.splice(i, 1);
    }
  }
}

// Puntaje a partir del cual pueden aparecer obstáculos "en grupo" (varios
// árboles o varios cactus pegados uno al lado del otro).
