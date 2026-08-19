// ══════════════════════════════════════
//   Pixel Runner — src/games/pixelrunner.js
// ══════════════════════════════════════
//
// Reescritura sobre Engine2D. Reemplaza el bloque RUNNER que vivía suelto
// en app.js (líneas ~948-1437 de la versión vieja). Mismas funciones
// públicas que ya usa index.html (initRunner, startRunner, stopRunner,
// restartRunner, toRunnerMenu, showRunnerMenu, startPixelRunnerGame,
// runnerJumpOrStart, runnerFastDrop) así el HTML no necesita tocarse.
//
// ─── Mecánica nueva: movimiento izquierda/derecha acotado ─────────────
// El jugador y los obstáculos viajan sobre el mismo eje X, así que
// moverse no te saca del "camino" del obstáculo (tarde o temprano barre
// cualquier X del corredor). Lo que SÍ hace moverte:
//   - Retroceder (izquierda) = el obstáculo tiene que recorrer más
//     distancia para llegarte = más frames de reacción para saltar/agachar.
//   - Avanzar (derecha) = menos margen, pero te deja "adelantarte" a un
//     combo apretado antes de que se solape con el siguiente.
// El corredor tiene paredes invisibles (CORRIDOR_MIN_X/MAX_X) — no podés
// escapar infinitamente hacia atrás. A velocidades altas, sin esto,
// ciertos combos de obstáculos son directamente imposibles de esquivar
// solo con salto/agache; con el margen que da moverte, vuelven a ser
// jugables.
// ══════════════════════════════════════

const RUNNER = {
  canvas: null, ctx: null,
  loop: null,
  input: null,
  running: false,
  started: false, // false = esperando el primer input del jugador (personaje quieto, nada se mueve)
  score: 0, bestScore: 0,
  speed: 5, baseSpeed: 5,
  frameCount: 0,
  obstacleTimer: 0, obstacleInterval: 90,

  // Corredor de movimiento lateral (coordenadas de mundo = canvas, 480x270)
  corridorMinX: 20,
  corridorMaxX: 190,
  moveSpeed: 2.6, // px por "step" (step = dt/16.6, ver Engine2D.GameLoop)

  // Personaje
  player: {
    x: 90, y: 0, w: 29, h: 34,
    vy: 0, jumps: 0, maxJumps: 2,
    dead: false, animFrame: 0, animTick: 0,
    groundY: 0,
    facing: 1, // 1 = mirando derecha (default), -1 = mirando izquierda
    shield: false, // power-up de escudo: absorbe un choque y se consume
  },

  groundH: 34, skyH: 30,
  obstacles: [],

  // Monedas + power-ups (escudo / x2). Separado de `obstacles` porque no
  // matan al tocarlos, al revés: suman puntos o dan un buff.
  pickups: [],
  pickupTimer: 0, pickupInterval: 130,
  doublePointsFrames: 0, // > 0 mientras el x2 está activo (ver updateRunner)

  // Bioma actual ('grass' | 'desert'). Se deriva del score en updateRunner;
  // este valor es solo el default antes de que arranque la partida.
  biome: 'grass',
};

const RUNNER_ASSETS = {
  junior:    'assert/pixel runner/models/junior.png',
  juniorAt:  'assert/pixel runner/models/junior.atlas.json',
  bird:      'assert/pixel runner/models/bird.png',
  birdAt:    'assert/pixel runner/models/bird.atlas.json',
  obst:      'assert/pixel runner/models/obstaculo.png',
  obstAt:    'assert/pixel runner/models/obstaculo.atlas.json',
  mapa:      'assert/pixel runner/models/mapa.png',
  mapaAt:    'assert/pixel runner/models/mapa.atlas.json',
  item:      'assert/pixel runner/models/item.png',
  itemAt:    'assert/pixel runner/models/item.atlas.json',
};

const TREE_VARIANTS = ['tree_small', 'tree_medium', 'tree_large'];
const CACTUS_VARIANTS = ['cactus_small', 'cactus_medium', 'cactus_large'];
const ROCK_VARIANTS = ['rock_small', 'rock_medium', 'rock_large'];
const BIRD_FRAMES = ['flap_0','flap_1','flap_2','flap_3','flap_4','flap_5','flap_6','flap_7'];
const RUN_FRAMES = ['run_0','run_1','run_2','run_3','run_4','run_5','run_6'];
const SUN_FRAMES = ['sun_0','sun_1','sun_2','sun_3'];
const MOON_FRAMES = ['moon_0','moon_1','moon_2','moon_3'];
const CLOUD_FRAMES = ['cloud_0','cloud_1','cloud_2','cloud_3'];

// ─── Items: monedas + power-ups (item.png / item.atlas.json) ──────────
const COIN_SPIN_FRAMES = ['coin_0','coin_1','coin_2','coin_3','coin_4','coin_5','coin_6','coin_7'];
const SHIELD_SHIMMER_FRAMES = ['shield_shimmer_0','shield_shimmer_1','shield_shimmer_2','shield_shimmer_3','shield_shimmer_4'];

const COIN_VALUE = 15;                    // puntos que suma cada moneda agarrada
const PICKUP_GROUP_MIN = 3, PICKUP_GROUP_MAX = 5; // cantidad de monedas por tanda
const POWERUP_CHANCE = 0.16;              // probabilidad de que la tanda sea un power-up en vez de monedas
const DOUBLE_POINTS_DURATION = 480;       // "frames" (a step≈1/frame, ~8s) que dura el x2

// Variantes de obstáculo "de piso" según bioma — árboles solo en pasto,
// cactus solo en desierto; las rocas son neutras y salen en los dos.
function groundVariantsForBiome(biome) {
  return biome === 'desert'
    ? CACTUS_VARIANTS.concat(ROCK_VARIANTS)
    : TREE_VARIANTS.concat(ROCK_VARIANTS);
}

// Cuántos px "hundir" el sprite del obstáculo respecto a su caja de
// colisión al dibujarlo, para que la base quede pisando el piso en vez de
// flotar sobre él (el padding transparente de cada frame del atlas es
// distinto por tipo, así que cada familia necesita su propio ajuste). Es
// puramente visual, no mueve la caja de colisión real.
const GROUND_OBSTACLE_SINK = {
  tree_small: 5, tree_medium: 5, tree_large: 5,
  cactus_small: 5, cactus_medium: 5, cactus_large: 5,
  rock_small: 14, rock_medium: 14, rock_large: 14,
};
function sinkForSprite(sprite) {
  return GROUND_OBSTACLE_SINK[sprite] != null ? GROUND_OBSTACLE_SINK[sprite] : 5;
}

// Duración (en puntos) de cada bioma y de cada mitad día/noche dentro de
// ese bioma — ver updateRunner para cómo se derivan de RUNNER.score.
const BIOME_SEGMENT = 500;
const DAY_HALF = 250;

// ─── Ciclo día/noche ────────────────────
// Un ciclo completo (día + noche) dura cycleLen frames. `t` avanza
// siempre; `phase` = t/cycleLen va de 0 a 1. 0..0.5 = día (sol cruza el
// cielo), 0.5..1 = noche (luna cruza el cielo + estrellas). El fondo
// interpola de color entre los dos extremos para que no haya un corte feo.
//
// IMPORTANTE: t se deriva de RUNNER.frameCount (ver updateRunner), NO se
// incrementa solo — así el día/noche queda 100% sincronizado con el score:
// el score sube 1 punto cada 6 frames, así que cycleLen = BIOME_SEGMENT*6
// hace que la noche arranque justo a los DAY_HALF (250) puntos.
RUNNER.sky = {
  t: 0,
  cycleLen: BIOME_SEGMENT * 6,
  clouds: [
    { x: 60,  y: 30, speed: 0.15, frame: 0 },
    { x: 260, y: 18, speed: 0.09, frame: 1 },
    { x: 400, y: 42, speed: 0.12, frame: 2 },
  ],
};

function initRunner() {
  RUNNER.canvas = document.getElementById('runnerCanvas');

  requestAnimationFrame(() => {
    const C = RUNNER.canvas;
    const W = 480, H = 270;
    C.width = W;
    C.height = H;
    RUNNER.ctx = C.getContext('2d');

    RUNNER.player.groundY = C.height - RUNNER.groundH - RUNNER.player.h;
    RUNNER.player.y = RUNNER.player.groundY;

    document.getElementById('runnerOverlay').classList.add('hidden');
    if (RUNNER.bestScore > 0) {
      document.getElementById('runnerBest').textContent = 'Mejor: ' + RUNNER.bestScore + ' pts';
    }

    setupRunnerInput();

    // Cargar sprites una sola vez (Engine2D cachea, así que si ya están
    // cargados de una sesión anterior esto resuelve al toque).
    Engine2D.loadAll([
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
    ]).then(() => startRunner())
      .catch(err => {
        console.error('No se pudieron cargar los sprites de Pixel Runner', err);
        startRunner(); // arranca igual — drawRunner tiene fallback a rectángulos
      });
  });
}

// ─── Input ──────────────────────────────
function setupRunnerInput() {
  if (RUNNER.input) RUNNER.input.detach();

  RUNNER.input = new Engine2D.KeyboardInput(
    {
      ArrowUp: 'jump', Space: 'jump',
      ArrowDown: 'drop',
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
    },
    {
      activeCheck: () => document.getElementById('sec-runner').classList.contains('active'),
      preventDefaultFor: new Set(['ArrowUp', 'Space', 'ArrowDown', 'ArrowLeft', 'ArrowRight']),
      onDown: (action) => {
        // Enter/Espacio en el overlay de game over = reintentar
        const overlay = document.getElementById('runnerOverlay');
        if (overlay && !overlay.classList.contains('hidden')) {
          if (action === 'jump') {
            const btn = document.getElementById('runnerRestartBtn');
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
function runnerMove(dir, isDown) {
  if (!RUNNER.input) return;
  RUNNER.input.state[dir] = isDown;
}

function runnerFastDrop() {
  if (!RUNNER.running) return;
  RUNNER.started = true; // agacharse/caída rápida también cuenta como el primer input
  const p = RUNNER.player;
  if (p.dead || p.y >= p.groundY) return;
  p.vy = Math.abs(p.vy) * 0.5 + RUNNER.canvas.height * 0.04;
}

function runnerJumpOrStart() {
  const overlay = document.getElementById('runnerOverlay');
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
function startRunner() {
  setMusic('assert/pixel runner/sounds/backplay.mp3');

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

  // Arranca siempre en el bioma de pasto y de día (frame 0 = fase 0 del
  // ciclo día/noche, que cae dentro del tramo de día).
  RUNNER.biome = 'grass';
  RUNNER.sky.t = 0;

  document.getElementById('runnerOverlay').classList.add('hidden');
  document.getElementById('runner-score-display').textContent = '0';
  document.getElementById('runnerRestartBtn').style.display = 'none';
  document.getElementById('runnerMenuBtn').style.display = 'none';

  if (RUNNER.loop) RUNNER.loop.stop();
  RUNNER.loop = new Engine2D.GameLoop({
    update: (dt, step) => updateRunner(step),
    draw: () => drawRunner(),
  });
  RUNNER.loop.start();
}

function stopRunner() {
  RUNNER.running = false;
  if (RUNNER.loop) RUNNER.loop.stop();
  if (RUNNER.input) RUNNER.input.detach();
}

const GRAVITY = 0.09;

function updateRunner(step) {
  const C = RUNNER.canvas;
  const p = RUNNER.player;
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

  // Score + velocidad
  RUNNER.frameCount++;
  if (RUNNER.frameCount % 6 === 0) {
    RUNNER.score += RUNNER.doublePointsFrames > 0 ? 2 : 1; // x2 activo = doble puntaje por tick
    document.getElementById('runner-score-display').textContent = RUNNER.score;
    if (RUNNER.score % 250 === 0) {
      RUNNER.speed += 0.8;
      RUNNER.obstacleInterval = Math.max(45, RUNNER.obstacleInterval - 5);
    }
  }
  if (RUNNER.doublePointsFrames > 0) RUNNER.doublePointsFrames = Math.max(0, RUNNER.doublePointsFrames - step);

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
      if (p.shield) {
        // El escudo absorbe el choque: se consume, el obstáculo desaparece
        // y el jugador sigue corriendo sin morir.
        p.shield = false;
        RUNNER.obstacles.splice(i, 1);
        continue;
      }
      playerDie();
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
const OBSTACLE_CLUSTER_MIN_SCORE = 1000;
const OBSTACLE_CLUSTER_CHANCE = 0.25;

function spawnObstacle(C) {
  const groundVariants = groundVariantsForBiome(RUNNER.biome);

  // Después de los 1000 puntos, a veces en vez de un obstáculo suelto sale
  // un grupo de 2 o 3 pegados (todos de la misma familia: árboles en
  // bioma grass, cactus en bioma desert — las rocas quedan afuera de los
  // grupos, van solas).
  if (RUNNER.score >= OBSTACLE_CLUSTER_MIN_SCORE && Math.random() < OBSTACLE_CLUSTER_CHANCE) {
    const family = RUNNER.biome === 'desert' ? CACTUS_VARIANTS : TREE_VARIANTS;
    spawnGroundCluster(C, family);
    return;
  }

  const type = Math.random();
  const groundY = C.height - RUNNER.groundH;
  const skyTop = RUNNER.skyH;

  if (type < 0.45) {
    const h = 36 + Math.floor(Math.random() * 34);
    const w = 20 + Math.floor(Math.random() * 18);
    const variant = groundVariants[Math.floor(Math.random() * groundVariants.length)];
    RUNNER.obstacles.push({ x: C.width + 20, y: groundY - h, w, h, kind: 'ground', sprite: variant });
  } else if (type < 0.75) {
    const h = 24 + Math.floor(Math.random() * 16);
    const w = 38 + Math.floor(Math.random() * 26);
    const minY = skyTop + 4;
    const maxY = C.height * 0.45;
    const y = minY + Math.random() * (maxY - minY);
    RUNNER.obstacles.push({ x: C.width + 20, y, w, h, kind: 'air', animTick: Math.random() * 8 });
  } else {
    const h1 = 32 + Math.floor(Math.random() * 26);
    const variant1 = groundVariants[Math.floor(Math.random() * groundVariants.length)];
    RUNNER.obstacles.push({ x: C.width + 20, y: groundY - h1, w: 18, h: h1, kind: 'ground', sprite: variant1 });
    const h2 = 22;
    const y2 = skyTop + 10 + Math.random() * (C.height * 0.3);
    RUNNER.obstacles.push({ x: C.width + 60, y: y2, w: 34, h: h2, kind: 'air', animTick: Math.random() * 8 });
  }
}

// Grupo de obstáculos de piso pegados uno al lado del otro, todos de la
// misma familia (recibida en `familyVariants`: TREE_VARIANTS o
// CACTUS_VARIANTS). 2 o 3 al azar; cada uno con su propio tamaño para que
// no se vea repetido en fila, pero bien juntos entre sí.
function spawnGroundCluster(C, familyVariants) {
  const groundY = C.height - RUNNER.groundH;
  const count = Math.random() < 0.5 ? 2 : 3;
  let cx = C.width + 20;
  for (let i = 0; i < count; i++) {
    const variant = familyVariants[Math.floor(Math.random() * familyVariants.length)];
    const h = 34 + Math.floor(Math.random() * 28);
    const w = 20 + Math.floor(Math.random() * 16);
    RUNNER.obstacles.push({ x: cx, y: groundY - h, w, h, kind: 'ground', sprite: variant });
    cx += w + 4; // pegaditos, casi sin separación entre uno y el siguiente
  }
}

// Grupo de monedas (3 a 5) en el suelo o flotando en el cielo — 50/50 al
// azar cuál de las dos. Van en una leve curva (no una fila robótica) para
// que se sientan más naturales al recolectarlas.
function spawnPickupGroup(C) {
  const groundY = C.height - RUNNER.groundH;
  const count = PICKUP_GROUP_MIN + Math.floor(Math.random() * (PICKUP_GROUP_MAX - PICKUP_GROUP_MIN + 1));
  const onGround = Math.random() < 0.5;
  const spacing = 24;
  const startX = C.width + 20;
  // En el suelo: altura de un salto chico. En el cielo: banda alta, como
  // para tener que saltar a buscarlas.
  const baseY = onGround
    ? groundY - 30
    : RUNNER.skyH + 24 + Math.random() * 40;

  for (let i = 0; i < count; i++) {
    const arc = count > 1 ? Math.sin((i / (count - 1)) * Math.PI) * 12 : 0;
    RUNNER.pickups.push({
      x: startX + i * spacing,
      y: baseY - arc,
      w: 15, h: 15,
      kind: 'coin',
      spinTick: Math.random() * 8,
      spinFrame: Math.floor(Math.random() * COIN_SPIN_FRAMES.length),
    });
  }
}

// Power-up suelto (escudo o x2), flotando en algún punto de la banda
// aérea — aparece solo, al azar, mucho menos seguido que las monedas.
function spawnPowerup(C) {
  const groundY = C.height - RUNNER.groundH;
  const minY = RUNNER.skyH + 10;
  const maxY = groundY - 40;
  const y = minY + Math.random() * (maxY - minY);
  const type = Math.random() < 0.5 ? 'shield' : 'x2';
  RUNNER.pickups.push({
    x: C.width + 20, y, w: 22, h: 22,
    kind: 'powerup', type,
  });
}

// Efecto al agarrar una moneda o un power-up.
function collectPickup(o) {
  if (o.kind === 'coin') {
    RUNNER.score += COIN_VALUE;
    document.getElementById('runner-score-display').textContent = RUNNER.score;
  } else if (o.kind === 'powerup') {
    if (o.type === 'shield') {
      RUNNER.player.shield = true;
    } else if (o.type === 'x2') {
      RUNNER.doublePointsFrames = DOUBLE_POINTS_DURATION;
    }
  }
}


const FALL_FRAMES = ['fall_0', 'fall_1', 'fall_2', 'fall_3'];
const FALL_FRAME_DELAY = 130; // ms entre frames de la animación de choque
const FALL_HOLD_BEFORE_OVERLAY = 300; // ms que se queda en el último frame antes del cartel

function playerDie() {
  const p = RUNNER.player;
  p.dead = true;
  RUNNER.running = false;
  bgMusic.pause();
  if (typeof playDeathSound === 'function') playDeathSound();
  if (RUNNER.loop) RUNNER.loop.stop();

  if (RUNNER.score > RUNNER.bestScore) RUNNER.bestScore = RUNNER.score;
  guardarPuntaje(7, RUNNER.score);

  playDeathAnimation();
}

// Recorre fall_0..fall_3 a mano (el loop ya está parado) y recién cuando
// termina muestra el cartel de "Game Over" — así el choque se ve como un
// golpe/caída en vez de saltar directo al cartel.
function playDeathAnimation() {
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
        document.getElementById('runnerBest').textContent = 'Mejor: ' + RUNNER.bestScore + ' pts';
        showRunnerOverlay('¡Game Over!', 'Puntos: ' + RUNNER.score, true);
      }, FALL_HOLD_BEFORE_OVERLAY);
    }
  };
  setTimeout(step, FALL_FRAME_DELAY);
}

function showRunnerOverlay(title, sub, isGameover) {
  const overlay = document.getElementById('runnerOverlay');
  overlay.classList.remove('hidden');
  document.getElementById('runnerOverlayTitle').textContent = title;
  document.getElementById('runnerOverlaySub').textContent = sub;
  if (RUNNER.bestScore > 0) {
    document.getElementById('runnerBest').textContent = 'Mejor: ' + RUNNER.bestScore + ' pts';
  }
  const goBtn = document.getElementById('runnerRestartBtn');
  const menuBtn = document.getElementById('runnerMenuBtn');
  if (goBtn) goBtn.style.display = isGameover ? 'inline-block' : 'none';
  if (menuBtn) menuBtn.style.display = isGameover ? 'inline-block' : 'none';
}

function restartRunner() {
  stopRunner();
  setupRunnerInput();
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
  const ov = document.getElementById('runnerOverlay');
  if (ov) ov.classList.add('hidden');
  setMusic('assert/pixel runner/sounds/menu.mp3');
}

function startPixelRunnerGame() {
  const menu = document.getElementById('runnerMenu');
  const controls = document.querySelector('#sec-runner .runner-controls');
  const hintEl = document.querySelector('#sec-runner .runner-hint');
  if (menu) menu.classList.add('hidden');
  if (controls) controls.classList.remove('hidden');
  if (hintEl) hintEl.classList.remove('hidden');
  setMusic('assert/pixel runner/sounds/backplay.mp3');
  initRunner();
}

// ─── Dibujo ─────────────────────────────
function drawRunner(dead = false) {
  const C = RUNNER.canvas;
  const ctx = RUNNER.ctx;
  const W = C.width, H = C.height;
  const groundY = H - RUNNER.groundH;
  const skyH = RUNNER.skyH;

  drawSky(ctx, W, H, groundY, skyH);
  drawGroundTexture(ctx, W, groundY, RUNNER.biome);

  // Obstáculos
  const obstImg = Engine2D.getImage(RUNNER_ASSETS.obst);
  const obstAtlas = Engine2D.getAtlas(RUNNER_ASSETS.obstAt);
  const birdImg = Engine2D.getImage(RUNNER_ASSETS.bird);
  const birdAtlas = Engine2D.getAtlas(RUNNER_ASSETS.birdAt);

  RUNNER.obstacles.forEach(o => {
    if (o.kind === 'ground' && obstImg && obstAtlas) {
      // El sink es por tipo de sprite: solo visual, hunde el sprite en el
      // piso para que no parezca flotando; la caja de colisión (o.y/o.h)
      // no se toca.
      Engine2D.drawAtlasFrame(ctx, obstImg, obstAtlas, o.sprite, o.x + o.w / 2, o.y + o.h + sinkForSprite(o.sprite), o.h, false, false);
    } else if (o.kind === 'air' && birdImg && birdAtlas) {
      const frameIdx = Math.floor((o.animTick || 0) / 4) % BIRD_FRAMES.length;
      Engine2D.drawAtlasFrame(ctx, birdImg, birdAtlas, BIRD_FRAMES[frameIdx], o.x + o.w / 2, o.y + o.h / 2, o.h, true, true);
    } else {
      // Fallback si los sprites todavía no cargaron
      ctx.fillStyle = o.kind === 'ground' ? '#4b7a3f' : '#c0392b';
      ctx.fillRect(o.x, o.y, o.w, o.h);
    }
  });

  // Monedas y power-ups
  const itemImg = Engine2D.getImage(RUNNER_ASSETS.item);
  const itemAtlas = Engine2D.getAtlas(RUNNER_ASSETS.itemAt);
  RUNNER.pickups.forEach(o => {
    if (itemImg && itemAtlas) {
      if (o.kind === 'coin') {
        Engine2D.drawAtlasFrame(ctx, itemImg, itemAtlas, COIN_SPIN_FRAMES[o.spinFrame], o.x + o.w / 2, o.y + o.h, o.h, false, false);
      } else if (o.type === 'shield') {
        Engine2D.drawAtlasFrame(ctx, itemImg, itemAtlas, 'powerup_shield', o.x + o.w / 2, o.y + o.h, o.h, false, false);
      } else if (o.type === 'x2') {
        Engine2D.drawAtlasFrame(ctx, itemImg, itemAtlas, 'powerup_x2', o.x + o.w / 2, o.y + o.h, o.h, false, false);
      }
    } else {
      ctx.fillStyle = o.kind === 'coin' ? '#f4c430' : (o.type === 'shield' ? '#3b82f6' : '#f97316');
      ctx.beginPath();
      ctx.arc(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Jugador
  const p = RUNNER.player;

  // Aura del escudo: usa los frames de brillo del item.png como un pulso
  // detrás del personaje mientras el power-up está activo.
  if (p.shield && itemImg && itemAtlas) {
    const shimmerIdx = Math.floor(RUNNER.frameCount / 4) % SHIELD_SHIMMER_FRAMES.length;
    ctx.save();
    ctx.globalAlpha = 0.75;
    Engine2D.drawAtlasFrame(ctx, itemImg, itemAtlas, SHIELD_SHIMMER_FRAMES[shimmerIdx], p.x + p.w / 2, p.y + p.h / 2, p.h * 1.6, false, true);
    ctx.restore();
  }

  const juniorImg = Engine2D.getImage(RUNNER_ASSETS.junior);
  const juniorAtlas = Engine2D.getAtlas(RUNNER_ASSETS.juniorAt);
  if (juniorImg && juniorAtlas) {
    const onGround = p.y >= p.groundY - 0.5;
    const frameName = dead
      ? (p.animFrameName || 'fall_0')
      : (!RUNNER.started ? RUN_FRAMES[0] : (onGround ? RUN_FRAMES[p.animFrame] : 'action_2')); // action_2 ~ pose de salto
    Engine2D.drawAtlasFrame(ctx, juniorImg, juniorAtlas, frameName, p.x + p.w / 2, p.y + p.h, p.h, p.facing === -1, false);
  } else {
    ctx.fillStyle = dead ? '#7a2020' : '#2563eb';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }

  // Score en pantalla (además del HTML de afuera)
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Vel: ' + RUNNER.speed.toFixed(1), 6, 16);

  // Indicador de x2 activo (arriba a la derecha)
  if (RUNNER.doublePointsFrames > 0) {
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('x2 puntos', W - 6, 16);
  }
}

// ─── Cielo: fondo interpolado + sol/luna en arco + nubes + estrellas ───
function lerp(a, b, t) { return a + (b - a) * t; }

function lerpColorHex(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(lerp(ar, br, t)), g = Math.round(lerp(ag, bg, t)), bl = Math.round(lerp(ab, bb, t));
  return `rgb(${r},${g},${bl})`;
}

// Tilea horizontalmente un frame del atlas (usado para la franja de
// estrellas y para la textura del piso, que son mucho más angostos que
// el ancho del canvas).
function drawTiledFrame(ctx, img, atlas, frameName, x, y, width, height) {
  const f = atlas.frames[frameName];
  if (!f) return;
  const tileW = height * (f.w / f.h);
  let cx = x;
  while (cx < x + width) {
    const w = Math.min(tileW, x + width - cx) + 1;
    ctx.drawImage(img, f.x, f.y, f.w * (w / tileW), f.h, Math.round(cx), y, Math.ceil(w), height);
    cx += tileW;
  }
}

function drawSky(ctx, W, H, groundY, skyH) {
  const sky = RUNNER.sky;
  const phase = sky.t / sky.cycleLen;         // 0..1, ciclo completo
  const dayProgress = (phase % 0.5) / 0.5;    // 0..1 dentro de la mitad actual (día o noche)
  const isDay = phase < 0.5;

  // Luz ambiente: 1 = pleno día, 0 = plena noche. Con esta única curva
  // continua el amanecer/atardecer sale gratis (no hay "corte" al cambiar
  // de mitad, todo es una interpolación suave).
  const L = (Math.cos(2 * Math.PI * (phase - 0.25)) + 1) / 2;

  // Fondo: 3 franjas (arriba/medio/horizonte) interpoladas entre paleta
  // de día y de noche según L.
  const nightColors = ['#0d1b2a', '#162032', '#1a2a1a'];
  const dayColors   = ['#7ec8e3', '#bfe3e0', '#cfe8b0'];
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,   lerpColorHex(nightColors[0], dayColors[0], L));
  bg.addColorStop(0.6, lerpColorHex(nightColors[1], dayColors[1], L));
  bg.addColorStop(1,   lerpColorHex(nightColors[2], dayColors[2], L));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Estrellas — solo de noche, se desvanecen con L (más L = más de día = menos visibles)
  const mapaImg = Engine2D.getImage(RUNNER_ASSETS.mapa);
  const mapaAtlas = Engine2D.getAtlas(RUNNER_ASSETS.mapaAt);
  if (mapaImg && mapaAtlas && L < 0.6) {
    ctx.save();
    ctx.globalAlpha = (0.6 - L) / 0.6; // 1 en plena noche, 0 apenas empieza a clarear
    ctx.beginPath();
    ctx.rect(0, skyH, W, groundY - skyH - 30);
    ctx.clip();
    drawTiledFrame(ctx, mapaImg, mapaAtlas, 'stars_dense', 0, skyH + 4, W, 50);
    ctx.restore();
  }

  // Sol (mitad día) / Luna (mitad noche) — arco simple: más alto al
  // mediodía/medianoche, bajo cerca del horizonte al salir/ponerse.
  if (mapaImg && mapaAtlas) {
    const elevation = Math.sin(Math.PI * dayProgress); // 0 en los bordes, 1 en el punto más alto
    const arcX = lerp(30, W - 30, dayProgress);
    const arcY = lerp(skyH + 55, skyH + 8, elevation);
    const frames = isDay ? SUN_FRAMES : MOON_FRAMES;
    const frameIdx = Math.floor(sky.t / 40) % frames.length;
    ctx.save();
    ctx.globalAlpha = Math.max(0.15, elevation);
    Engine2D.drawAtlasFrame(ctx, mapaImg, mapaAtlas, frames[frameIdx], arcX, arcY, 26, false, true);
    ctx.restore();
  }

  // Nubes — parallax lento, un poco más tenues de noche
  if (mapaImg && mapaAtlas) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * L;
    sky.clouds.forEach(c => {
      Engine2D.drawAtlasFrame(ctx, mapaImg, mapaAtlas, CLOUD_FRAMES[c.frame % CLOUD_FRAMES.length], c.x, c.y, 20, false, false);
    });
    ctx.restore();
  }
}

function drawGroundTexture(ctx, W, groundY, biome) {
  const mapaImg = Engine2D.getImage(RUNNER_ASSETS.mapa);
  const mapaAtlas = Engine2D.getAtlas(RUNNER_ASSETS.mapaAt);
  const frameName = biome === 'desert' ? 'ground_desert' : 'ground_grass';
  if (mapaImg && mapaAtlas) {
    drawTiledFrame(ctx, mapaImg, mapaAtlas, frameName, 0, groundY, W, RUNNER.groundH);
  } else {
    ctx.fillStyle = biome === 'desert' ? '#5a4a2f' : '#22331f';
    ctx.fillRect(0, groundY, W, RUNNER.groundH);
  }
}
