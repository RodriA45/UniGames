// ══════════════════════════════════════
//   Castle Escape — castle_render.js  (módulo ES6)
// ══════════════════════════════════════
// Todo el dibujo por frame: plataformas, piso de piedra, decoración,
// pinchos, el jugador y las explosiones (spawn/update/draw juntos porque
// son puramente un efecto visual).
import {
  TRAMPAS, TR_ASSET_BASE, TR_W, TR_H, TR_LEVELS, TR_STONE_MORTAR,
  TR_FALL_FRAMES, TR_JUMP_FRAME, TR_RUN_FRAMES
} from './castle_config.js';

export function trGetMapaAssets() {
  const img = Engine2D.getImage(TR_ASSET_BASE + 'models/mapa.png');
  const atlas = Engine2D.getAtlas(TR_ASSET_BASE + 'models/mapa_atlas.json');
  return (img && img.complete && atlas) ? { img, atlas } : null;
}
export function trGetDecoAssets() {
  const img = Engine2D.getImage(TR_ASSET_BASE + 'models/deco.png');
  const atlas = Engine2D.getAtlas(TR_ASSET_BASE + 'models/deco_atlas.json');
  return (img && img.complete && atlas) ? { img, atlas } : null;
}
export function trGetJuniorAssets() {
  const img = Engine2D.getImage(TR_ASSET_BASE + 'models/junior.png');
  const atlas = Engine2D.getAtlas(TR_ASSET_BASE + 'models/junior.atlas.json');
  return (img && img.complete && atlas) ? { img, atlas } : null;
}

// Dibuja una plataforma. El sprite de "isla flotante" (mapa.png) se usa
// SOLO para lo que realmente flota/se mueve/se rompe: plataformas
// 'moving', 'crumble', y las 'normal'/'fake' que están elevadas por
// encima del piso base del nivel (no forman parte de la fila de suelo).
// El "suelo" — los segmentos que están a la misma altura que el resto
// del piso, angostos o anchos — usa la textura de piso "wall" tileada.
// 'fake' siempre se dibuja IGUAL que 'normal' de su misma altura — esa
// es la trampa, no debe notarse cuál es cuál a simple vista.
export function trIsFloatingPlatform(plat) {
  return plat.type === 'moving' || plat.type === 'crumble' || plat.y < TRAMPAS.floorY;
}

export function trDrawPlatform(ctx, plat) {
  // Todas las plataformas (piso normal/fake y también islas flotantes,
  // crumble y moving) usan la piedra dibujada a mano — mapa.png ya no se
  // usa acá, solo queda para flechas y la puerta de salida.
  trDrawStoneFloor(ctx, plat);
  // Tinte por encima para distinguir estado — el de 'moving' se sacó
  // (tapaba la textura de la plataforma flotante con un rectángulo azul).
  if (plat.type === 'crumble' && plat.touchedAt !== null) {
    ctx.fillStyle = 'rgba(232,84,63,0.45)';
    ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
  }
}

// Piso de piedra gris oscuro dibujado a mano (reemplaza al sprite "wall"
// tileado y al viejo rectángulo morado plano). No es un gris fijo: cada
// bloque tiene un tono levemente distinto (variación tipo mampostería) y
// hay líneas de "argamasa" más oscuras entre bloques. La variación sale de
// un hash determinístico por posición (seno de x/y), no de Math.random,
// así el patrón queda fijo — no titila ni cambia de frame a frame.
export function trStoneShade(bx, by) {
  const n = Math.sin(bx * 12.9898 + by * 78.233) * 43758.5453;
  return n - Math.floor(n); // 0..1 determinístico para este bloque
}
// worldX/worldY: posición real en el nivel (de ahí sale el hash de cada
// bloque — trStoneShade — así el patrón de piedra queda fijo según dónde
// está la plataforma en el mundo). drawX/drawY: dónde se pinta en `ctx`.
// Para el uso de siempre (dibujar directo en el canvas del juego) son el
// mismo punto — trDrawStoneFloor(ctx, plat) de más abajo sigue haciendo
// eso. La separación sirve para poder hornear esta misma textura en un
// canvas chico propio (StaticLayer / TRAMPAS.staticLayer, ver más abajo)
// dibujando en (0,0) mientras el hash sigue usando la posición real.
export function trDrawStoneFloorAt(ctx, worldX, worldY, drawX, drawY, w, h) {
  // Argamasa de fondo — se ve en las líneas finas entre bloques.
  ctx.fillStyle = TR_STONE_MORTAR;
  ctx.fillRect(drawX, drawY, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(drawX, drawY, w, h);
  ctx.clip();

  // Bloques tipo mampostería, filas al tresbolillo (offset alternado).
  const blockH = Math.max(9, Math.round(h / 2));
  const blockW = blockH * 1.7;
  let row = 0;
  for (let wy = worldY; wy < worldY + h; wy += blockH) {
    const offset = (row % 2 === 0) ? 0 : -blockW / 2;
    for (let wx = worldX + offset; wx < worldX + w; wx += blockW) {
      const t = trStoneShade(Math.round(wx), Math.round(wy)); // 0..1, según posición real
      const g = Math.round(46 + t * 26); // gris oscuro, variación ~46-72
      ctx.fillStyle = `rgb(${g},${g - 2},${g + 3})`; // toque frío, no gris puro
      const dbx = wx - worldX + drawX, dby = wy - worldY + drawY;
      ctx.fillRect(dbx + 1, dby + 1, blockW - 2, blockH - 2);
    }
    row++;
  }
  ctx.restore();

  // Borde superior más claro (da sensación de piso sólido/luz de arriba)
  // y sombra fina abajo — mismo criterio visual que tenía el morado plano.
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(drawX, drawY, w, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(drawX, drawY + h - 2, w, 2);
}

export function trDrawStoneFloor(ctx, plat) {
  trDrawStoneFloorAt(ctx, plat.x, plat.y, plat.x, plat.y, plat.w, plat.h);
}
// Puramente visual — no colisiona, no importa el orden, se dibuja detrás
// de todo lo jugable. 'torch' anima sola (parpadeo, 4 frames de deco.png)
// sin que updateTrampas tenga que saber nada de esto.
export function trDrawDecor(ctx) {
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
    } else if (d.type === 'ivy_2') {
      f = F.ivy_2;
    } else if (d.type === 'chain') {
      f = F.chain_straight;
    } else if (d.type === 'chain_hook') {
      f = F.chain_hook;
    } else if (d.type === 'banner') {
      f = F.banner;
    } else if (d.type === 'banner_tattered') {
      f = F.banner_tattered;
    } else if (d.type === 'rat') {
      f = F.rat;
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
// Pinchos dibujados a mano (triángulos) — ya no usa el sprite spike_1a/b/c
// de mapa.png, ese atlas ahora solo se usa para flechas y puerta.
export function trDrawSpikeRow(ctx, x, y, w, h) {
  const n = Math.max(1, Math.floor(w / 14));
  const step = w / n;
  for (let i = 0; i < n; i++) {
    const sx = x + i * step;
    // Cuerpo del pincho — degradé simple (más claro en la punta) para
    // que no quede un triángulo de color plano.
    const grad = ctx.createLinearGradient(sx, y + h, sx, y);
    grad.addColorStop(0, '#7f1d1d');
    grad.addColorStop(1, '#f87171');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx, y + h);
    ctx.lineTo(sx + step / 2, y);
    ctx.lineTo(sx + step, y + h);
    ctx.closePath();
    ctx.fill();
    // Filo/brillo en un borde para dar volumen.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + step / 2, y);
    ctx.lineTo(sx + step, y + h);
    ctx.stroke();
  }
}

export function drawTrampasPlayer(ctx, p) {
  // Sprite real (junior.png, reutilizado de Pixel Runner) — si ya cargó,
  // se usa esto y no el dibujo a mano de abajo (que queda de fallback
  // por si los assets todavía no terminaron de cargar).
  const junior = trGetJuniorAssets();
  if (junior) {
    const frameName = p.dead
      ? (p.animFrameName || TR_FALL_FRAMES[0])
      : (!p.onGround ? TR_JUMP_FRAME : TR_RUN_FRAMES[p.animFrame]);
    ctx.save();
    if (p.dead) ctx.globalAlpha = 0.85;
    // Ancla: centro-x del hitbox, borde inferior — mismo criterio que ya
    // usa Pixel Runner con este mismo sprite (targetH = altura del hitbox,
    // drawAtlasFrame centra el ancho solo y sube desde `y`).
    Engine2D.drawAtlasFrame(ctx, junior.img, junior.atlas, frameName, p.x + p.w / 2, p.y + p.h, p.h, p.facing === -1, false);
    ctx.restore();
    return;
  }

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

export function spawnExplosion(cx, cy) {
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

export function updateExplosions() {
  for (let i = TRAMPAS.explosions.length - 1; i >= 0; i--) {
    const e = TRAMPAS.explosions[i];
    e.x += e.vx;
    e.y += e.vy;
    e.vy += 0.1;
    e.life -= e.decay;
    if (e.life <= 0) TRAMPAS.explosions.splice(i, 1);
  }
}

export function drawExplosions(ctx) {
  for (const e of TRAMPAS.explosions) {
    ctx.globalAlpha = e.life;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * e.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawTrampas() {
  const ctx = TRAMPAS.ctx;
  if (!ctx) return;
  const p = TRAMPAS.player;

  // Fondo transparente: el contenedor muestra la imagen del castillo (capa 0).
  // Todo el dibujo de world-space va dentro del translate de la cámara.
  ctx.clearRect(0, 0, TR_W, TR_H);
  ctx.save();
  // Escala inversa al fov: fov>1 (ve más mapa) => escala <1 (todo se dibuja
  // más chico); fov<1 (ve menos mapa) => escala >1 (todo se dibuja más
  // grande/zoom in). Con fov=1 esto es un scale(1,1), o sea no cambia nada
  // respecto al comportamiento original.
  const trFovScale = 1 / (TRAMPAS.fov || 1);
  ctx.scale(trFovScale, trFovScale);
  ctx.translate(-TRAMPAS.camera.x, -TRAMPAS.camera.y);

  // Decoración de fondo (antorchas/hiedra/cadenas/estandartes) — va antes
  // que las plataformas para quedar detrás de todo lo jugable.
  trDrawDecor(ctx);

  // Piso/paredes fijas (plataformas 'normal'/'fake') + pinchos de pozo
  // fijos: nada de esto cambia mientras dura el nivel, así que ya está
  // pre-pintado en TRAMPAS.staticLayer (ver trLoadLevel) — un solo
  // drawImage acá en vez de recorrer plataformas y recalcular la piedra
  // bloque por bloque en cada uno de los 60 frames por segundo. El orden
  // pincho-antes-que-plataforma que hacía falta para el truco de "piso
  // falso con pinchos escondidos debajo" (niveles 7 y 15) ya quedó
  // resuelto adentro del bake, en el mismo orden de siempre.
  if (TRAMPAS.staticLayer) TRAMPAS.staticLayer.draw(ctx);

  // Lo único que sí cambia en tiempo real —plataformas 'moving' (se
  // desplazan) y 'crumble' (se tiñen de rojo y desaparecen)— se sigue
  // dibujando a mano, plataforma por plataforma, encima de la capa
  // estática. 'normal'/'fake' ya están en TRAMPAS.staticLayer.
  for (const plat of TRAMPAS.platforms) {
    if (plat.gone) continue;
    if (plat.type !== 'moving' && plat.type !== 'crumble') continue;
    trDrawPlatform(ctx, plat);
    if (plat.decor === 'spike') {
      trDrawSpikeRow(ctx, plat.x, plat.y - 20, plat.w, 20);
    }
  }

  // Resto de los peligros (star, saw) — estos SÍ están pensados para
  // verse (señuelo visible o peligro en movimiento), así que se quedan
  // dibujándose después de las plataformas como antes.
  for (const hz of TRAMPAS.hazards) {
    if (hz.type === 'star') {
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

  // Flechas activas (horizontales: sprites arrow_left/right; verticales:
  // mismo sprite arrow_right rotado 90° para que apunte arriba/abajo).
  {
    const assets = trGetMapaAssets();
    TRAMPAS.arrows.forEach(a => {
      if (!a.active) return;
      if (assets) {
        let f, rot = 0;
        if (a.dir === 'up')        { f = assets.atlas.frames.arrow_right; rot = -Math.PI / 2; }
        else if (a.dir === 'down') { f = assets.atlas.frames.arrow_right; rot =  Math.PI / 2; }
        else                       { f = a.dir < 0 ? assets.atlas.frames.arrow_left : assets.atlas.frames.arrow_right; }
        if (f) {
          ctx.save();
          ctx.translate(a.x + a.w / 2, a.y + a.h / 2);
          if (rot) ctx.rotate(rot);
          ctx.drawImage(assets.img, f.x, f.y, f.w, f.h, -a.w / 2, -a.h / 2, a.w, a.h);
          ctx.restore();
          return;
        }
      }
      // Fallback vectorial (sin assets): triángulo según dirección.
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      if (a.dir === 'up')        { ctx.moveTo(a.x + a.w/2, a.y); ctx.lineTo(a.x, a.y + a.h); ctx.lineTo(a.x + a.w, a.y + a.h); }
      else if (a.dir === 'down') { ctx.moveTo(a.x + a.w/2, a.y + a.h); ctx.lineTo(a.x, a.y); ctx.lineTo(a.x + a.w, a.y); }
      else if (a.dir < 0)        { ctx.moveTo(a.x, a.y + a.h/2); ctx.lineTo(a.x + a.w, a.y); ctx.lineTo(a.x + a.w, a.y + a.h); }
      else                       { ctx.moveTo(a.x + a.w, a.y + a.h/2); ctx.lineTo(a.x, a.y); ctx.lineTo(a.x, a.y + a.h); }
      ctx.closePath();
      ctx.fill();
    });
  }

  // Salida
  const lvl = TR_LEVELS[TRAMPAS.levelIndex];
  {
    const assets = trGetMapaAssets();
    const f = assets && assets.atlas.frames.door;
    if (f) {
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

  // Salir del espacio de world (cámara)
  ctx.restore();

  // Controles táctiles (Engine2D)
  if (TRAMPAS.touch && TRAMPAS.touch.visible) {
    TRAMPAS.touch.draw(ctx);
  }
}
