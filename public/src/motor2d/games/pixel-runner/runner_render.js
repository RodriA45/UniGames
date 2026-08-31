// ══════════════════════════════════════
//   Pixel Runner — runner_render.js  (módulo ES6)
// ══════════════════════════════════════
// Todo el dibujo por frame: personaje, cielo día/noche, piso y helpers de
// interpolación usados solo acá.
import {
  RUNNER, RUNNER_ASSETS, BIOME_SEGMENT, GROUND_TRANSITION_RANGE,
  COIN_SPIN_FRAMES, SHIELD_SHIMMER_FRAMES, RUN_FRAMES, SUN_FRAMES,
  MOON_FRAMES, CLOUD_FRAMES, BIRD_FRAMES, sinkForSprite
} from './runner_config.js';
import { runnerScoreMultiplier } from './runner_economy.js';

export function drawRunner(dead = false) {
  const C = RUNNER.canvas;
  const ctx = RUNNER.ctx;
  const W = C.width, H = C.height;
  const groundY = H - RUNNER.groundH;
  const skyH = RUNNER.skyH;

  drawSky(ctx, W, H, groundY, skyH);
  const segmentIndex = Math.floor(RUNNER.score / BIOME_SEGMENT);
  const posInSegment = RUNNER.score % BIOME_SEGMENT;
  // El blend solo tiene sentido a partir del 2do segmento en adelante —
  // en el primero (score 0) no hay "bioma anterior" real del que venir,
  // así que sin esta guarda se veía el desierto tapando el pasto al arrancar.
  // Tampoco tiene sentido durante la secuencia del castillo: ahí el bioma
  // queda forzado a pasto (ver startHistoriaWinApproach) y sin esta guarda
  // el degradé de transición pintaba desierto encima igual, calculado a
  // partir del score en vez del bioma real de la escena.
  const groundBlend = (!RUNNER.winCastle && segmentIndex > 0 && posInSegment < GROUND_TRANSITION_RANGE)
    ? 1 - (posInSegment / GROUND_TRANSITION_RANGE)
    : 0;
  drawGroundTexture(ctx, W, groundY, RUNNER.biome, groundBlend);

  // Castillo (secuencia de victoria de Historia) — se dibuja antes que
  // obstáculos/jugador para que quede "de fondo", como un escenario en el
  // que Junior entra caminando.
  if (RUNNER.winCastle) {
    const castleImg = Engine2D.getImage(RUNNER_ASSETS.castillo);
    const c = RUNNER.winCastle;
    if (castleImg) {
      ctx.drawImage(castleImg, c.x, c.y, c.w, c.h);
    } else {
      ctx.fillStyle = '#7a5c3e';
      ctx.fillRect(c.x, c.y, c.w, c.h);
    }
  }

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

  // Velocidad en pantalla (además del HTML de afuera). El contador de
  // monedas se sacó de acá — se ve pixeleado al dibujarse con fillText
  // dentro del canvas escalado; ahora vive como HTML debajo del contador
  // de puntos (.runner-coins-display, ver index.html).
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Vel: ' + RUNNER.speed.toFixed(1), 6, 16);

  // Indicador de x2 activo (arriba a la derecha)
  if (RUNNER.doublePointsFrames > 0) {
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('x' + runnerScoreMultiplier() + ' puntos', W - 6, 16);
  }

  // Controles táctiles — SIEMPRE al final, como overlay encima de todo.
  if (RUNNER.touch) RUNNER.touch.draw(ctx);
}

// ─── Cielo: fondo interpolado + sol/luna en arco + nubes + estrellas ───
export function lerp(a, b, t) { return a + (b - a) * t; }

export function lerpColorHex(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(lerp(ar, br, t)), g = Math.round(lerp(ag, bg, t)), bl = Math.round(lerp(ab, bb, t));
  return `rgb(${r},${g},${bl})`;
}

// Tilea horizontalmente un frame del atlas (usado para la franja de
// estrellas y para la textura del piso, que son mucho más angostos que
// el ancho del canvas).
export function drawTiledFrame(ctx, img, atlas, frameName, x, y, width, height) {
  const f = atlas.frames[frameName];
  if (!f) return;
  if (!RUNNER._cachedTiles) RUNNER._cachedTiles = {};
  const cacheKey = frameName + '_' + Math.round(width) + '_' + Math.round(height);
  
  if (!RUNNER._cachedTiles[cacheKey]) {
    const cvs = document.createElement('canvas');
    cvs.width = Math.ceil(width);
    cvs.height = Math.ceil(height);
    const cctx = cvs.getContext('2d');
    const tileW = height * (f.w / f.h);
    let cx = 0;
    while (cx < width) {
      const w = Math.min(tileW, width - cx) + 1;
      cctx.drawImage(img, f.x, f.y, f.w * (w / tileW), f.h, Math.round(cx), 0, Math.ceil(w), height);
      cx += tileW;
    }
    RUNNER._cachedTiles[cacheKey] = cvs;
  }
  ctx.drawImage(RUNNER._cachedTiles[cacheKey], Math.round(x), Math.round(y));
}

export function drawSky(ctx, W, H, groundY, skyH) {
  const sky = RUNNER.sky;
  const phase = sky.t / sky.cycleLen;         // 0..1, ciclo completo
  const dayProgress = (phase % 0.5) / 0.5;    // 0..1 dentro de la mitad actual (día o noche)
  const isDay = phase < 0.5;

  // Luz ambiente: 1 = pleno día, 0 = plena noche. Con esta única curva
  // continua el amanecer/atardecer sale gratis (no hay "corte" al cambiar
  // de mitad, todo es una interpolación suave).
  const L = (Math.cos(2 * Math.PI * (phase - 0.25)) + 1) / 2;

  // Fondo: 3 franjas interpoladas con offscreen canvas para no recrear gradientes cada frame
  const nightColors = ['#0d1b2a', '#162032', '#1a2a1a'];
  const dayColors   = ['#7ec8e3', '#bfe3e0', '#cfe8b0'];
  
  if (!RUNNER._bgNight) {
    RUNNER._bgNight = document.createElement('canvas');
    RUNNER._bgNight.width = W; RUNNER._bgNight.height = H;
    const nctx = RUNNER._bgNight.getContext('2d');
    const nbg = nctx.createLinearGradient(0, 0, 0, H);
    nbg.addColorStop(0, nightColors[0]); nbg.addColorStop(0.6, nightColors[1]); nbg.addColorStop(1, nightColors[2]);
    nctx.fillStyle = nbg; nctx.fillRect(0, 0, W, H);

    RUNNER._bgDay = document.createElement('canvas');
    RUNNER._bgDay.width = W; RUNNER._bgDay.height = H;
    const dctx = RUNNER._bgDay.getContext('2d');
    const dbg = dctx.createLinearGradient(0, 0, 0, H);
    dbg.addColorStop(0, dayColors[0]); dbg.addColorStop(0.6, dayColors[1]); dbg.addColorStop(1, dayColors[2]);
    dctx.fillStyle = dbg; dctx.fillRect(0, 0, W, H);
  }

  // Dibujar base de noche
  ctx.drawImage(RUNNER._bgNight, 0, 0);
  
  // Superponer día con alpha (muchísimo más rápido que lerpColorHex)
  if (L > 0.01) {
    ctx.save();
    ctx.globalAlpha = L;
    ctx.drawImage(RUNNER._bgDay, 0, 0);
    ctx.restore();
  }

  // Estrellas — solo de noche, se desvanecen con L (más L = más de día = menos visibles)
  const mapaImg = Engine2D.getImage(RUNNER_ASSETS.mapa);
  const mapaAtlas = Engine2D.getAtlas(RUNNER_ASSETS.mapaAt);
  if (mapaImg && mapaAtlas && L < 0.6) {
    ctx.save();
    ctx.globalAlpha = (0.6 - L) / 0.6; // 1 en plena noche, 0 apenas empieza a clarear
    // Eliminado el ctx.clip() porque consumía mucha CPU y las estrellas ya están acotadas a Y=50
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

// Los primeros GROUND_TRANSITION_RANGE puntos de cada bioma nuevo, el piso
// hace un crossfade del bioma anterior al nuevo en vez de cambiar de
// golpe — se dibuja el piso nuevo de base y se le superpone el viejo con
// alpha decreciente hasta que se termina de "desvanecer".
export function drawGroundTexture(ctx, W, groundY, biome, blend) {
  const mapaImg = Engine2D.getImage(RUNNER_ASSETS.mapa);
  const mapaAtlas = Engine2D.getAtlas(RUNNER_ASSETS.mapaAt);
  const frameName = biome === 'desert' ? 'ground_desert' : 'ground_grass';
  const prevFrameName = biome === 'desert' ? 'ground_grass' : 'ground_desert';

  if (mapaImg && mapaAtlas) {
    drawTiledFrame(ctx, mapaImg, mapaAtlas, frameName, 0, groundY, W, RUNNER.groundH);
    if (blend > 0.001) {
      ctx.save();
      ctx.globalAlpha = blend;
      drawTiledFrame(ctx, mapaImg, mapaAtlas, prevFrameName, 0, groundY, W, RUNNER.groundH);
      ctx.restore();
    }
  } else {
    const currentColor = biome === 'desert' ? '#5a4a2f' : '#22331f';
    const prevColor = biome === 'desert' ? '#22331f' : '#5a4a2f';
    ctx.fillStyle = currentColor;
    ctx.fillRect(0, groundY, W, RUNNER.groundH);
    if (blend > 0.001) {
      ctx.save();
      ctx.globalAlpha = blend;
      ctx.fillStyle = prevColor;
      ctx.fillRect(0, groundY, W, RUNNER.groundH);
      ctx.restore();
    }
  }
}
