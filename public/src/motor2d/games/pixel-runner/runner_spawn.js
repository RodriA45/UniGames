// ══════════════════════════════════════
//   Pixel Runner — runner_spawn.js  (módulo ES6)
// ══════════════════════════════════════
// Generación procedural: obstáculos, clusters, monedas y power-ups, más
// los checks de espacio libre para no solaparlos.
import {
  RUNNER, RUNNER_EL, TREE_VARIANTS, CACTUS_VARIANTS, COIN_SPIN_FRAMES,
  OBSTACLE_CLUSTER_MIN_SCORE, OBSTACLE_CLUSTER_CHANCE, PICKUP_OBSTACLE_BUFFER,
  PICKUP_GROUP_MIN, PICKUP_GROUP_MAX, POWERUP_STACK_CAP, COIN_VALUE,
  groundVariantsForBiome
} from './runner_config.js';
import { saveTotalCoins, shieldDurationFrames, doublePointsDurationFrames, shieldMaxHits } from './runner_economy.js';

export function spawnObstacle(C) {
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
    const y = groundY - h;
    const x = findClearXForObstacle(C.width + 20, y, w, h);
    if (x === null) return; // no había lugar libre de monedas, se salta este spawn
    RUNNER.obstacles.push({ x, y, w, h, kind: 'ground', sprite: variant });
  } else if (type < 0.75) {
    const h = 24 + Math.floor(Math.random() * 16);
    const w = 38 + Math.floor(Math.random() * 26);
    const minY = skyTop + 4;
    const maxY = C.height * 0.45;
    const y = minY + Math.random() * (maxY - minY);
    const x = findClearXForObstacle(C.width + 20, y, w, h);
    if (x === null) return;
    RUNNER.obstacles.push({ x, y, w, h, kind: 'air', animTick: Math.random() * 8 });
  } else {
    const h1 = 32 + Math.floor(Math.random() * 26);
    const variant1 = groundVariants[Math.floor(Math.random() * groundVariants.length)];
    const y1 = groundY - h1;
    const x1 = findClearXForObstacle(C.width + 20, y1, 18, h1);
    if (x1 === null) return;
    RUNNER.obstacles.push({ x: x1, y: y1, w: 18, h: h1, kind: 'ground', sprite: variant1 });
    const h2 = 22;
    const y2 = skyTop + 10 + Math.random() * (C.height * 0.3);
    const x2 = findClearXForObstacle(x1 + 40, y2, 34, h2);
    if (x2 === null) return;
    RUNNER.obstacles.push({ x: x2, y: y2, w: 34, h: h2, kind: 'air', animTick: Math.random() * 8 });
  }
}

// Grupo de obstáculos de piso pegados uno al lado del otro, todos de la
// misma familia (recibida en `familyVariants`: TREE_VARIANTS o
// CACTUS_VARIANTS). 2 o 3 al azar; cada uno con su propio tamaño para que
// no se vea repetido en fila, pero bien juntos entre sí.
export function spawnGroundCluster(C, familyVariants) {
  const groundY = C.height - RUNNER.groundH;
  const count = Math.random() < 0.5 ? 2 : 3;
  let cx = C.width + 20;
  for (let i = 0; i < count; i++) {
    const variant = familyVariants[Math.floor(Math.random() * familyVariants.length)];
    const h = 34 + Math.floor(Math.random() * 28);
    const w = 20 + Math.floor(Math.random() * 16);
    const y = groundY - h;
    const x = findClearXForObstacle(cx, y, w, h);
    if (x === null) return; // cortamos el cluster acá, ya quedaron puestos los anteriores
    RUNNER.obstacles.push({ x, y, w, h, kind: 'ground', sprite: variant });
    cx = x + w + 4; // pegaditos, casi sin separación entre uno y el siguiente
  }
}

// Chequea que un rectángulo (con margen extra) no se pise con ningún
// obstáculo actual. Como items y obstáculos viajan siempre a la misma
// velocidad (RUNNER.speed), si están libres al momento de spawnear se
// mantienen libres para siempre — no hace falta re-chequear después.
export function isClearOfObstacles(x, y, w, h) {
  for (let i = 0; i < RUNNER.obstacles.length; i++) {
    const o = RUNNER.obstacles[i];
    if (
      x < o.x + o.w + PICKUP_OBSTACLE_BUFFER &&
      x + w > o.x - PICKUP_OBSTACLE_BUFFER &&
      y < o.y + o.h + PICKUP_OBSTACLE_BUFFER &&
      y + h > o.y - PICKUP_OBSTACLE_BUFFER
    ) return false;
  }
  return true;
}

// Chequeo simétrico al de arriba, pero para el lado de los obstáculos: un
// obstáculo nuevo no debe pisar ninguna moneda/power-up ya existente. Sin
// esto, una tanda de monedas que nació corrida (por el retry de
// spawnPickupGroup) podía terminar exactamente en el borde donde nace el
// próximo obstáculo, y como ambos viajan siempre a la misma velocidad
// quedaban pegados para siempre.
export function isClearOfPickups(x, y, w, h) {
  for (let i = 0; i < RUNNER.pickups.length; i++) {
    const o = RUNNER.pickups[i];
    if (
      x < o.x + o.w + PICKUP_OBSTACLE_BUFFER &&
      x + w > o.x - PICKUP_OBSTACLE_BUFFER &&
      y < o.y + o.h + PICKUP_OBSTACLE_BUFFER &&
      y + h > o.y - PICKUP_OBSTACLE_BUFFER
    ) return false;
  }
  return true;
}

// Busca una x libre de monedas/power-ups para un obstáculo, arrancando en
// startX y corriéndose hacia la derecha si hace falta (mismo patrón que
// usan las monedas para evitar obstáculos). Devuelve null si no encontró
// lugar en los intentos permitidos — en ese caso el caller se salta el
// spawn de ese obstáculo puntual.
export function findClearXForObstacle(startX, y, w, h) {
  let x = startX;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (isClearOfPickups(x, y, w, h)) return x;
    x += 45;
  }
  return null;
}

// Grupo de monedas (3 a 5) en el suelo o flotando en el cielo — 50/50 al
// azar cuál de las dos. Van en una leve curva (no una fila robótica) para
// que se sientan más naturales al recolectarlas.
export function spawnPickupGroup(C) {
  const groundY = C.height - RUNNER.groundH;
  const count = PICKUP_GROUP_MIN + Math.floor(Math.random() * (PICKUP_GROUP_MAX - PICKUP_GROUP_MIN + 1));
  const onGround = Math.random() < 0.5;
  const spacing = 24;
  const itemSize = 15;
  // En el suelo: altura de un salto chico. En el cielo: banda alta, como
  // para tener que saltar a buscarlas.
  const baseY = onGround
    ? groundY - 30
    : RUNNER.skyH + 24 + Math.random() * 40;
  const maxArc = count > 1 ? 12 : 0;
  const groupW = (count - 1) * spacing + itemSize;
  const groupH = itemSize + maxArc;

  // Si el lugar recién generado se pisa con un obstáculo, corremos todo
  // el grupo un poco más a la derecha (más lejos en el spawn) y probamos
  // de nuevo; si después de varios intentos sigue sin haber lugar, mejor
  // no aparece nada esta vez (la próxima tanda lo intenta de nuevo).
  let startX = C.width + 20;
  let clear = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (isClearOfObstacles(startX, baseY - maxArc, groupW, groupH)) { clear = true; break; }
    startX += 45;
  }
  if (!clear) return;

  for (let i = 0; i < count; i++) {
    const arc = count > 1 ? Math.sin((i / (count - 1)) * Math.PI) * maxArc : 0;
    RUNNER.pickups.push({
      x: startX + i * spacing,
      y: baseY - arc,
      w: itemSize, h: itemSize,
      kind: 'coin',
      spinTick: Math.random() * 8,
      spinFrame: Math.floor(Math.random() * COIN_SPIN_FRAMES.length),
    });
  }
}

// Power-up suelto (escudo o x2), flotando en algún punto de la banda
// aérea — aparece solo, al azar, mucho menos seguido que las monedas.
export function spawnPowerup(C) {
  const groundY = C.height - RUNNER.groundH;
  const minY = RUNNER.skyH + 10;
  const maxY = groundY - 40;
  const size = 22;
  const y = minY + Math.random() * (maxY - minY);

  let x = C.width + 20;
  let clear = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (isClearOfObstacles(x, y, size, size)) { clear = true; break; }
    x += 45;
  }
  if (!clear) return;

  const type = Math.random() < 0.5 ? 'shield' : 'x2';
  RUNNER.pickups.push({
    x, y, w: size, h: size,
    kind: 'powerup', type,
  });
}

// Efecto al agarrar una moneda o un power-up.
export function collectPickup(o) {
  if (o.kind === 'coin') {
    // Las monedas NO suman puntaje — son una moneda de juego aparte,
    // pensada para una futura tienda de mejoras. Se acumulan y se
    // persisten en localStorage al toque (así no se pierden si cierra
    // la pestaña antes del game over).
    RUNNER.coinsRun += COIN_VALUE;
    RUNNER.totalCoins += COIN_VALUE;
    saveTotalCoins(RUNNER.totalCoins);
    // Mientras se juega solo se muestran las monedas de ESTA partida — el
    // total histórico recién se revela al perder (ver playDeathAnimation).
    const coinsEl = RUNNER_EL.coinsRunDisplay;
    if (coinsEl) coinsEl.textContent = RUNNER.coinsRun;
  } else if (o.kind === 'powerup') {
    if (o.type === 'shield') {
      // Si ya lo tenía activo, suma tiempo en vez de resetearlo (con un
      // tope para que no se vuelva infinito si se juntan muchos seguidos).
      // La duración ya viene con la mejora de nivel aplicada (shieldDurationFrames).
      const p = RUNNER.player;
      p.shieldFrames = Math.min(POWERUP_STACK_CAP, p.shieldFrames + shieldDurationFrames());
      p.shield = true;
      p.shieldHitsLeft = shieldMaxHits(); // agarrar el pickup también "recarga" los golpes que aguanta
    } else if (o.type === 'x2') {
      RUNNER.doublePointsFrames = Math.min(POWERUP_STACK_CAP, RUNNER.doublePointsFrames + doublePointsDurationFrames());
    }
  }
}


// Arranca la secuencia: limpia lo que haya en pantalla (no queremos que
// Junior choque justo cuando ya ganó) y hace aparecer el castillo
// deslizándose desde afuera del canvas.
