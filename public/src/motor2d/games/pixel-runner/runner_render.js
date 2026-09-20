// ══════════════════════════════════════
//   Pixel Runner — runner_render.js  (módulo ES6)
// ══════════════════════════════════════
// Todo el dibujo por frame: personaje, cielo día/noche, piso y helpers de
// interpolación usados solo acá.
import {
  RUNNER, RUNNER_ASSETS, VIEW_W, VIEW_H, BIOME_SEGMENT, GROUND_TRANSITION_RANGE,
  COIN_SPIN_FRAMES, SHIELD_SHIMMER_FRAMES, RUN_FRAMES, SUN_FRAMES,
  MOON_PHASES, CLOUD_FRAMES, CLOUD_DARK_FRAMES, BIRD_FRAMES, sinkForSprite,
  RAIN_SPLASH_LIFE, JUNIOR_GROUND_SINK, RAIN_SPLASH_GROUND_OFFSET
} from './runner_config.js';
import { getRunnerUpgrades } from './runner_economy.js';

export function drawRunner(dead = false) {
  const ctx = RUNNER.ctx;
  // Siempre en coordenadas lógicas (480x270). El canvas real puede ser
  // más chico según la calidad: de eso se encarga la transformación, que
  // se re-fija acá por si algo reseteó el contexto.
  const W = VIEW_W, H = VIEW_H;
  const s = RUNNER._renderScale || 1;
  ctx.setTransform(s, 0, 0, s, 0, 0);
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
  const Q = Engine2D.Quality.fx;
  // Progreso del barrido (0 = recién arrancó el bioma nuevo, 1 = ya
  // terminó de entrar del todo). null = sin transición en curso, dibuja
  // el piso de siempre sin nada especial.
  const groundWipe = (Q.transitions && !RUNNER.winCastle && segmentIndex > 0 && posInSegment < GROUND_TRANSITION_RANGE)
    ? posInSegment / GROUND_TRANSITION_RANGE
    : null;
  drawGroundTexture(ctx, W, groundY, RUNNER.biome, groundWipe);

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
  // El sheet de monedas/power-ups es arte "pintado" con degradés, no pixel
  // art de bloques — reducirlo con vecino-más-cercano (el modo pixel-art
  // de todo el canvas) lo dejaba ruidoso/quemado en vez de nítido. Acá sí
  // se activa el suavizado; se apaga de nuevo enseguida para no afectar
  // a Junior ni al resto, que sí son pixel-art de verdad.
  ctx.imageSmoothingEnabled = true;
  RUNNER.pickups.forEach(o => {
    if (itemImg && itemAtlas) {
      if (o.kind === 'coin') {
        Engine2D.drawAtlasFrame(ctx, itemImg, itemAtlas, COIN_SPIN_FRAMES[o.spinFrame], o.x + o.w / 2, o.y + o.h, o.h, false, false);
      } else if (o.type === 'shield') {
        Engine2D.drawAtlasFrame(ctx, itemImg, itemAtlas, 'powerup_shield', o.x + o.w / 2, o.y + o.h, o.h, false, false);
      } else if (o.type === 'x2') {
        // Con la mejora "x2 → x3" comprada, el pickup en el piso ya
        // muestra el ícono de x3 — así el jugador sabe qué va a agarrar
        // antes de tocarlo, no recién cuando lee el indicador de arriba.
        const frame = getRunnerUpgrades().x2Triple ? 'powerup_x3' : 'powerup_x2';
        Engine2D.drawAtlasFrame(ctx, itemImg, itemAtlas, frame, o.x + o.w / 2, o.y + o.h, o.h, false, false);
      } else if (o.type === 'slowfall') {
        Engine2D.drawAtlasFrame(ctx, itemImg, itemAtlas, 'powerup_slowfall', o.x + o.w / 2, o.y + o.h, o.h, false, false);
      } else if (o.type === 'slowspeed') {
        Engine2D.drawAtlasFrame(ctx, itemImg, itemAtlas, 'powerup_slowspeed', o.x + o.w / 2, o.y + o.h, o.h, false, false);
      }
    } else {
      const fallbackColors = { shield: '#3b82f6', x2: '#f97316', slowfall: '#38bdf8', slowspeed: '#84cc16' };
      ctx.fillStyle = o.kind === 'coin' ? '#f4c430' : (fallbackColors[o.type] || '#f97316');
      ctx.beginPath();
      ctx.arc(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.imageSmoothingEnabled = false;

  // Jugador
  const p = RUNNER.player;

  // Aura del escudo: usa los frames de brillo del item.png como un pulso
  // detrás del personaje mientras el power-up está activo.
  // En calidad baja se ve igual (es info de juego: tenés escudo), pero con
  // un solo frame fijo y sin alpha.
  if (p.shield && itemImg && itemAtlas) {
    ctx.imageSmoothingEnabled = true;
    if (Q.shimmer) {
      const shimmerIdx = Math.floor(RUNNER.frameCount / 4) % SHIELD_SHIMMER_FRAMES.length;
      ctx.globalAlpha = 0.75;
      Engine2D.drawAtlasFrame(ctx, itemImg, itemAtlas, SHIELD_SHIMMER_FRAMES[shimmerIdx], p.x + p.w / 2, p.y + p.h / 2, p.h * 1.6, false, true);
      ctx.globalAlpha = 1;
    } else {
      Engine2D.drawAtlasFrame(ctx, itemImg, itemAtlas, SHIELD_SHIMMER_FRAMES[0], p.x + p.w / 2, p.y + p.h / 2, p.h * 1.6, false, true);
    }
    ctx.imageSmoothingEnabled = false;
  }

  const juniorImg = Engine2D.getImage(RUNNER_ASSETS.junior);
  const juniorAtlas = Engine2D.getAtlas(RUNNER_ASSETS.juniorAt);
  if (juniorImg && juniorAtlas) {
    const onGround = p.y >= p.groundY - 0.5;
    const frameName = dead
      ? (p.animFrameName || 'fall_0')
      : (!RUNNER.started ? RUN_FRAMES[0] : (onGround ? RUN_FRAMES[p.animFrame] : 'action_2')); // action_2 ~ pose de salto
    // Igual que las monedas/power-ups: el sprite nuevo es arte "pintado"
    // con degradés, no pixel art de bloques — reducido con vecino-más-
    // cercano (el modo pixel-art de todo el canvas) se ve dentado/muy
    // "pixelado" en el mal sentido. Se prende el suavizado solo acá.
    ctx.imageSmoothingEnabled = true;
    Engine2D.drawAtlasFrame(ctx, juniorImg, juniorAtlas, frameName, p.x + p.w / 2, p.y + p.h + JUNIOR_GROUND_SINK, p.h, p.facing === -1, false);
    ctx.imageSmoothingEnabled = false;
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

  // El indicador de x2/x3 y la fila de power-ups activos (escudo/caída
  // lenta/velocidad reducida) se movieron al HUD en HTML, al lado de
  // Puntos y debajo de Monedas — ver runnerUpdateHudBadges() en
  // runner_loop.js. Ya no se dibujan acá.

  drawRain(ctx);

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
  // Cache en dos niveles (frame → tamaño) en vez de armar un string de
  // clave por llamada: esto corre varias veces por frame.
  if (!RUNNER._cachedTiles) RUNNER._cachedTiles = {};
  const byFrame = RUNNER._cachedTiles[frameName] || (RUNNER._cachedTiles[frameName] = {});
  const sizeKey = Math.round(width) * 4096 + Math.round(height);
  let cvs = byFrame[sizeKey];

  if (!cvs) {
    cvs = document.createElement('canvas');
    cvs.width = Math.ceil(width);
    cvs.height = Math.ceil(height);
    const cctx = cvs.getContext('2d');
    const tileW = height * (f.w / f.h);
    let cx = 0, i = 0;
    while (cx < width) {
      const w = Math.min(tileW, width - cx) + 1;
      // sw = ancho de origen a recortar. El +1 de `w` es SOLO para que el
      // destino se solape 1px con la copia siguiente (tapar huecos por
      // redondeo) — sin el Math.min de acá, ese +1 también agrandaba el
      // recorte de ORIGEN más allá de f.w, y terminaba leyendo lo que
      // hubiera al lado en la hoja empaquetada (a veces un padding
      // transparente, a veces borde de OTRO sprite) → esa era la línea
      // negra que aparecía en algunas costuras del desierto.
      const sw = Math.min(f.w, f.w * (w / tileW));
      // Mirror-tiling: las copias pares van normales y las impares
      // espejadas. El borde que comparten dos copias consecutivas queda
      // simétrico (la misma silueta reflejada) en vez de cortar de golpe
      // de un lado cualquiera del sprite al otro — sin esto, un pasto con
      // matas/flores desparejas en el borde se veía como una línea oscura
      // marcada cada vez que el piso se repetía.
      if (i % 2 === 0) {
        cctx.drawImage(img, f.x, f.y, sw, f.h, Math.round(cx), 0, Math.ceil(w), height);
      } else {
        cctx.save();
        cctx.translate(Math.round(cx) + Math.ceil(w), 0);
        cctx.scale(-1, 1);
        cctx.drawImage(img, f.x, f.y, sw, f.h, 0, 0, Math.ceil(w), height);
        cctx.restore();
      }
      cx += tileW;
      i++;
    }
    // Curado de costura, pero quirúrgico: el mirror-tiling ya evita el
    // corte brusco en general, pero un sprite con matas/flores parejas en
    // el borde de arriba (pasto) puede dejar un huequito hacia el cielo
    // justo en el límite de cada copia. Antes esto clonaba la columna
    // entera sin mirar qué había — en una textura con detalle marcado
    // (piedras del desierto) eso metía una línea NUEVA donde no hacía
    // falta curar nada. Ahora solo toca, fila por fila, los píxeles que
    // de verdad son un hueco transparente (hacia el cielo); el resto de
    // la columna (tierra, piedras, lo que sea) queda intacto.
    if (tileW >= 6) {
      const heal = cctx.getImageData(0, 0, cvs.width, cvs.height);
      const data = heal.data;
      for (let seamX = Math.round(tileW); seamX < cvs.width; seamX += Math.round(tileW)) {
        const src = Math.max(0, seamX - 3);
        for (const dstX of [seamX - 1, seamX, seamX + 1]) {
          if (dstX < 0 || dstX >= cvs.width) continue;
          for (let y = 0; y < cvs.height; y++) {
            const d = (y * cvs.width + dstX) * 4;
            if (data[d + 3] >= 120) continue; // ya es opaco acá, no hay hueco que tapar
            const sIdx = (y * cvs.width + src) * 4;
            if (data[sIdx + 3] < 120) continue; // tampoco hay con qué taparlo
            data[d] = data[sIdx]; data[d + 1] = data[sIdx + 1];
            data[d + 2] = data[sIdx + 2]; data[d + 3] = data[sIdx + 3];
          }
        }
      }
      cctx.putImageData(heal, 0, 0);
    }
    byFrame[sizeKey] = cvs;
  }
  ctx.drawImage(cvs, Math.round(x), Math.round(y));
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

  // (la base de noche se dibuja más abajo, solo si el día no la tapa entera)

  // Superponer día con alpha (muchísimo más rápido que lerpColorHex).
  // Sin transiciones (calidad baja/media) el cielo cambia en 4 escalones en
  // vez de un fundido continuo, y en pleno día se dibuja un solo fondo.
  const Q = Engine2D.Quality.fx;
  const Ls = Q.transitions ? L : Math.round(L * 4) / 4;
  if (Ls < 0.99) ctx.drawImage(RUNNER._bgNight, 0, 0);
  if (Ls >= 0.99) {
    ctx.drawImage(RUNNER._bgDay, 0, 0);
  } else if (Ls > 0.01) {
    ctx.globalAlpha = Ls;
    ctx.drawImage(RUNNER._bgDay, 0, 0);
    ctx.globalAlpha = 1;
  }

  // Estrellas — solo de noche, se desvanecen con L (más L = más de día = menos visibles)
  const mapaImg = Engine2D.getImage(RUNNER_ASSETS.mapa);
  const mapaAtlas = Engine2D.getAtlas(RUNNER_ASSETS.mapaAt);
  if (Q.ambientSprites && mapaImg && mapaAtlas && L < 0.6) {
    ctx.save();
    ctx.globalAlpha = (0.6 - L) / 0.6; // 1 en plena noche, 0 apenas empieza a clarear
    // Eliminado el ctx.clip() porque consumía mucha CPU y las estrellas ya están acotadas a Y=50
    drawTiledFrame(ctx, mapaImg, mapaAtlas, 'stars_dense', 0, skyH + 4, W, 26);
    ctx.restore();
  }

  // Sol (mitad día) / Luna (mitad noche) — arco simple: más alto al
  // mediodía/medianoche, bajo cerca del horizonte al salir/ponerse.
  if (mapaImg && mapaAtlas) {
    const elevation = Math.sin(Math.PI * dayProgress); // 0 en los bordes, 1 en el punto más alto
    const arcX = lerp(30, W - 30, dayProgress);
    const arcY = lerp(skyH + 55, skyH + 8, elevation);
    // Qué noche es (0ª, 1ª, 2ª...) para elegir media luna o luna llena —
    // alterna una fase por noche en vez de mezclarlas dentro de la misma
    // noche, que se vería como si la luna cambiara de forma sin razón.
    const nightIndex = Math.floor(RUNNER.frameCount / sky.cycleLen);
    const moonGroup = (nightIndex % 2 === 0) ? MOON_PHASES.half : MOON_PHASES.full;
    const frames = isDay ? SUN_FRAMES : moonGroup;
    const frameIdx = Math.floor(sky.t / 40) % frames.length;
    ctx.save();
    ctx.globalAlpha = Math.max(0.15, elevation);
    Engine2D.drawAtlasFrame(ctx, mapaImg, mapaAtlas, frames[frameIdx], arcX, arcY, 26, false, true);
    ctx.restore();
  }

  // Nubes — parallax lento. De día son las claras de siempre; pasada la
  // mitad de la noche se cambia a la variante oscura (mismo dibujo, tono
  // de tormenta) — el índice de cada nube se mantiene, así no "saltan" de
  // posición al cambiar de set.
  if (mapaImg && mapaAtlas) {
    const cloudSet = (L < 0.5 || RUNNER.rainActive) ? CLOUD_DARK_FRAMES : CLOUD_FRAMES;
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * L;
    sky.clouds.forEach(c => {
      Engine2D.drawAtlasFrame(ctx, mapaImg, mapaAtlas, cloudSet[c.frame % cloudSet.length], c.x, c.y, 20, false, false);
    });
    ctx.restore();
  }
}

// Lluvia: líneas cortas diagonales, sin sprite (ver updateRain en
// runner_loop.js para la física). El splash sí es sprite, pero solo
// aparece en calidad Alta.
function drawRain(ctx) {
  const drops = RUNNER.rainDrops;
  const splashes = RUNNER.rainSplashes;
  if (!drops.length && !splashes.length) return;

  if (drops.length) {
    ctx.save();
    ctx.strokeStyle = 'rgba(190,220,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of drops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 2, d.y + d.len); // mismo ángulo que RAIN_DROP_WIND/RAIN_DROP_SPEED
    }
    ctx.stroke();
    ctx.restore();
  }

  if (splashes.length) {
    const splashImg = Engine2D.getImage(RUNNER_ASSETS.rainSplash);
    if (splashImg) {
      ctx.save();
      for (const s of splashes) {
        ctx.globalAlpha = Math.max(0, s.life / RAIN_SPLASH_LIFE);
        ctx.drawImage(splashImg, s.x - 12, s.y - RAIN_SPLASH_GROUND_OFFSET, 24, 8);
      }
      ctx.restore();
    }
  }
}

// Los primeros GROUND_TRANSITION_RANGE puntos de cada bioma nuevo, el piso
// hace un crossfade del bioma anterior al nuevo en vez de cambiar de
// golpe — se dibuja el piso nuevo de base y se le superpone el viejo con
// alpha decreciente hasta que se termina de "desvanecer".
// wipe: null = sin transición (dibuja el bioma actual y listo). 0..1 = a
// mitad de la transición al bioma nuevo — en vez de un fundido parejo en
// toda la pantalla (que se sentía como que el paisaje cambiaba "por
// arte de magia" en todos lados a la vez), esto es un barrido: se ve el
// bioma VIEJO de fondo y el NUEVO va entrando desde la derecha —como si
// de verdad estuvieras llegando a la zona nueva— hasta tapar toda la
// pantalla cuando wipe llega a 1.
export function drawGroundTexture(ctx, W, groundY, biome, wipe) {
  const mapaImg = Engine2D.getImage(RUNNER_ASSETS.mapa);
  const mapaAtlas = Engine2D.getAtlas(RUNNER_ASSETS.mapaAt);
  const frameName = biome === 'desert' ? 'ground_desert' : 'ground_grass';
  const prevFrameName = biome === 'desert' ? 'ground_grass' : 'ground_desert';
  const currentColor = biome === 'desert' ? '#5a4a2f' : '#22331f';
  const prevColor = biome === 'desert' ? '#22331f' : '#5a4a2f';

  if (wipe === null || wipe === undefined) {
    if (mapaImg && mapaAtlas) drawTiledFrame(ctx, mapaImg, mapaAtlas, frameName, 0, groundY, W, RUNNER.groundH);
    else { ctx.fillStyle = currentColor; ctx.fillRect(0, groundY, W, RUNNER.groundH); }
    return;
  }

  // Fondo: el bioma VIEJO, a todo lo ancho.
  if (mapaImg && mapaAtlas) drawTiledFrame(ctx, mapaImg, mapaAtlas, prevFrameName, 0, groundY, W, RUNNER.groundH);
  else { ctx.fillStyle = prevColor; ctx.fillRect(0, groundY, W, RUNNER.groundH); }

  // El bioma NUEVO tapa desde `wipeX` (que arranca en W, sin tapar nada) hasta
  // el borde derecho, y wipeX baja hasta 0 (toda la pantalla) a medida que
  // wipe avanza — el límite entre los dos se ve "entrando" de derecha a
  // izquierda en vez de aparecer de golpe.
  const wipeX = W * (1 - wipe);
  ctx.save();
  ctx.beginPath();
  ctx.rect(wipeX, groundY, W - wipeX, RUNNER.groundH);
  ctx.clip();
  if (mapaImg && mapaAtlas) drawTiledFrame(ctx, mapaImg, mapaAtlas, frameName, 0, groundY, W, RUNNER.groundH);
  else { ctx.fillStyle = currentColor; ctx.fillRect(0, groundY, W, RUNNER.groundH); }
  ctx.restore();
}
