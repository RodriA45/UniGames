// ══════════════════════════════════════
//   Castle Escape — castle_render.js  (módulo ES6)
// ══════════════════════════════════════
// Todo el dibujo por frame: plataformas, piso de piedra, decoración,
// pinchos, el jugador y las explosiones (spawn/update/draw juntos porque
// son puramente un efecto visual).
import {
  TRAMPAS, TR_ASSET_BASE, TR_TILE, TR_W, TR_H, TR_LEVELS, TR_STONE_MORTAR,
  TR_FALL_FRAMES, TR_JUMP_FRAME, TR_RUN_FRAMES
} from './castle_config.js';

// Se llaman varias veces por frame: antes armaban 2 strings y un objeto
// nuevo en cada llamada. Ahora las rutas son constantes y el par
// {img, atlas} se cachea apenas los dos están listos.
// OJO: las rutas se arman DENTRO de la función, no en una constante de
// módulo. castle_config.js ↔ castle_loop.js ↔ castle_render.js se importan
// en círculo, así que este archivo se evalúa ANTES de que config termine
// de definir TR_ASSET_BASE: tocarlo a nivel de módulo tira
// "Cannot access 'TR_ASSET_BASE' before initialization" y se cae la carga
// de todo Castle Escape (el juego quedaba sin arrancar).
const TR_ASSET_FILES = {
  mapa:   ['models/mapa.webp',   'models/mapa_atlas.json'],
  deco:   ['models/deco.webp',   'models/deco_atlas.json'],
  junior: ['models/junior.webp', 'models/junior.atlas.json'],
};
const trAssetCache = {};
function trGetAssets(key) {
  const files = TR_ASSET_FILES[key];
  if (!files) return null; // 'tiles'/'obst': ver trGetResolvedAssets más abajo
  const cached = trAssetCache[key];
  const imgSrc = TR_ASSET_BASE + files[0];
  const atlasSrc = TR_ASSET_BASE + files[1];
  const img = Engine2D.getImage(imgSrc);
  // Si alguien liberó la imagen del cache del motor, se vuelve a buscar.
  if (cached && cached.img === img) return cached;
  const atlas = Engine2D.getAtlas(atlasSrc);
  if (img && img.complete && img.naturalWidth > 0 && atlas) {
    return (trAssetCache[key] = { img, atlas });
  }
  return null;
}
export function trGetMapaAssets() { return trGetAssets('mapa'); }
export function trGetDecoAssets() { return trGetAssets('deco'); }
export function trGetJuniorAssets() { return trGetAssets('junior'); }

// ── Texturas nuevas (bloques y obstáculos): con nombre de archivo
// tolerante ──
// El juego (a diferencia del editor, que probaba una lista larga de
// rutas) solo intentaba UN nombre fijo. Si en el servidor el archivo
// había quedado con el nombre viejo (mapa.png / obstaculo.png en vez de
// mapa_tiles.png / obstaculo.webp), la carga fallaba en silencio y el
// juego dibujaba la piedra a mano para siempre — aunque el editor sí lo
// encontraba, porque ahí probábamos varias rutas. Ahora el juego prueba
// las mismas alternativas, una sola vez, al arrancar (ver
// trResolveNewTextures, llamada desde initTrampas).
const TR_TEX_CANDIDATES = {
  tiles: { img: ['models/mapa_tiles.png', 'models/mapa.png'], atlas: ['models/mapa_tiles_atlas.json'] },
  obst:  { img: ['models/obstaculo.webp', 'models/obstaculo.png'], atlas: ['models/obstaculo_atlas.json'] },
};
// undefined = todavía no se intentó cargar; null = se intentó y no se
// encontró ninguna variante; {imgSrc, atlasSrc} = la que funcionó.
const trResolvedTex = { tiles: undefined, obst: undefined };

async function trTryPaths(paths, loader) {
  for (const rel of paths) {
    try { await loader(TR_ASSET_BASE + rel); return TR_ASSET_BASE + rel; }
    catch (e) { /* probar la siguiente */ }
  }
  return null;
}

// Se llama una vez desde initTrampas, en paralelo con la carga principal.
// No hace falta esperar su resultado para mostrar el menú: mientras tanto
// trGetAssets('tiles'/'obst') devuelve null y se ve la piedra a mano, y en
// cuanto resuelve empieza a devolver la textura real.
export async function trResolveNewTextures() {
  for (const key of Object.keys(TR_TEX_CANDIDATES)) {
    const cand = TR_TEX_CANDIDATES[key];
    const imgSrc = await trTryPaths(cand.img, Engine2D.loadImage);
    if (!imgSrc) {
      console.warn('[Castle Escape] no se encontró la textura de ' + key + ' en ninguna ruta:', cand.img);
      trResolvedTex[key] = null;
      continue;
    }
    const atlasSrc = await trTryPaths(cand.atlas, Engine2D.loadAtlas);
    if (!atlasSrc) {
      console.warn('[Castle Escape] no se encontró el atlas de ' + key + ':', cand.atlas);
      trResolvedTex[key] = null;
      continue;
    }
    trResolvedTex[key] = { imgSrc, atlasSrc };
  }
}

function trGetResolvedAssets(key) {
  const r = trResolvedTex[key];
  if (!r) return null; // undefined (aún cargando) o null (no se encontró)
  const cached = trAssetCache[key];
  const img = Engine2D.getImage(r.imgSrc);
  if (cached && cached.img === img) return cached;
  const atlas = Engine2D.getAtlas(r.atlasSrc);
  if (img && img.complete && img.naturalWidth > 0 && atlas) {
    return (trAssetCache[key] = { img, atlas });
  }
  return null;
}
export function trGetTilesAssets() { return trGetResolvedAssets('tiles'); }
export function trGetObstAssets() { return trGetResolvedAssets('obst'); }

// Plataformas que se mueven o se rompen ('moving'/'crumble') no pueden ir
// en la capa estática, pero su TEXTURA no cambia: antes se re-dibujaba la
// piedra bloque por bloque (clip + decenas de fillRect + strings de color
// + seno por bloque) en cada frame. Ahora se hornea una vez por plataforma
// en un canvas chico y cada frame es un solo drawImage. La textura queda
// "pegada" a la plataforma (antes el patrón se recalculaba con la posición
// actual y titilaba mientras se movía).
function trPlatformSprite(plat) {
  if (plat._sprite) return plat._sprite;
  const top = plat.decor === 'spike' ? 20 : 0;
  const w = Math.max(1, Math.ceil(plat.w));
  const h = Math.max(1, Math.ceil(plat.h + top));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  trDrawPlatformAt(c, plat, 0, top);
  if (top) trDrawSpikeRow(c, 0, 0, plat.w, 20);
  plat._sprite = { canvas, top };
  return plat._sprite;
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
  // Bloques con la textura nueva (autotile) para lo fijo, y las piezas de
  // madera para lo que se mueve o se rompe. Si la textura todavía no
  // cargó, cae en la piedra dibujada a mano de siempre.
  trDrawPlatformAt(ctx, plat, plat.x, plat.y);
  // Tinte por encima para distinguir estado — el de 'moving' se sacó
  // (tapaba la textura de la plataforma flotante con un rectángulo azul).
  if (plat.type === 'crumble' && plat.touchedAt !== null) {
    ctx.fillStyle = 'rgba(232,84,63,0.45)';
    ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
  }
}

// Igual que trDrawPlatform pero pintando en (drawX, drawY) — lo usa
// trPlatformSprite para hornear la plataforma en su propio canvas.
export function trDrawPlatformAt(ctx, plat, drawX, drawY) {
  // plat.piece = una de las 3 plataformas de madera; plat.tile = uno de los
  // 9 bloques. Los niveles viejos no traen ninguno de los dos y se decide
  // por tipo, como antes.
  const wood = plat.piece || (!plat.tile && (plat.type === 'moving' || plat.type === 'crumble'));
  const ok = wood
    ? trDrawWoodPlatform(ctx, drawX, drawY, plat.w, plat.h, plat.piece)
    : trDrawBlockRect(ctx, drawX, drawY, plat.w, plat.h, plat.tile);
  if (!ok) trDrawStoneFloorAt(ctx, plat.x, plat.y, drawX, drawY, plat.w, plat.h, trIsWall(plat));
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
// isWall: plataforma marcada como "pared vertical" en el editor
// (plat.vertical). Se dibuja con las hiladas rotadas 90° — columnas de
// bloques apilados — y la luz en el borde izquierdo en vez del de arriba,
// igual que la vista previa del editor.
export function trDrawStoneFloorAt(ctx, worldX, worldY, drawX, drawY, w, h, isWall = false) {
  // Argamasa de fondo — se ve en las líneas finas entre bloques.
  ctx.fillStyle = TR_STONE_MORTAR;
  ctx.fillRect(drawX, drawY, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(drawX, drawY, w, h);
  ctx.clip();

  // Bloques tipo mampostería, hiladas al tresbolillo (offset alternado).
  if (isWall) {
    const blockW = Math.max(9, Math.round(w / 2));
    const blockH = blockW * 1.7;
    let col = 0;
    for (let wx = worldX; wx < worldX + w; wx += blockW) {
      const offset = (col % 2 === 0) ? 0 : -blockH / 2;
      for (let wy = worldY + offset; wy < worldY + h; wy += blockH) {
        const t = trStoneShade(Math.round(wx), Math.round(wy));
        const g = Math.round(46 + t * 26);
        ctx.fillStyle = `rgb(${g},${g - 2},${g + 3})`;
        const dbx = wx - worldX + drawX, dby = wy - worldY + drawY;
        ctx.fillRect(dbx + 1, dby + 1, blockW - 2, blockH - 2);
      }
      col++;
    }
  } else {
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
  }
  ctx.restore();

  // Luz y sombra en los bordes: arriba/abajo para un piso, izquierda/
  // derecha para una pared.
  if (isWall) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(drawX, drawY, 2, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(drawX + w - 2, drawY, 2, h);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(drawX, drawY, w, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(drawX, drawY + h - 2, w, 2);
  }
}

// ¿Esta plataforma es una pared vertical? (checkbox "Pared vertical" del
// editor — bloquea el paso lateral, ver updateTrampas.)
// ¿Este bloque frena? Todo lo que no sea traspasable ni esté derrumbado.
export function trIsSolidPlatform(plat) {
  return !plat.gone && plat.type !== 'fake' && !plat.fake;
}

export function trIsWall(plat) {
  return plat.type === 'normal' && !!plat.vertical;
}

// ─── Bloques con textura (mapa_tiles.png) ───────────────────────────
// Los 9 recortes del autotile: cada uno tiene su función según dónde cae
// la celda dentro del rectángulo (esquinas, bordes, relleno). Un bloque
// de 1 celda usa la fila de arriba (el borde con luz queda arriba, que es
// lo que se ve en un piso).
const TR_WALL_FRAMES = [
  ['wall_tl', 'wall_t', 'wall_tr'],
  ['wall_l',  'wall_c', 'wall_r'],
  ['wall_bl', 'wall_b', 'wall_br'],
];

// Dibuja un rectángulo de nivel como una grilla de bloques de TR_TILE.
// worldX/worldY es la posición real (solo se usa para el fallback dibujado
// a mano); drawX/drawY es dónde se pinta. Devuelve false si la textura
// todavía no cargó, para que el caller use la piedra de siempre.
export function trDrawBlockRect(ctx, drawX, drawY, w, h, tileName) {
  const tiles = trGetTilesAssets();
  if (!tiles) return false;
  const F = tiles.atlas.frames;
  // El editor guarda QUÉ pieza es cada bloque (plat.tile): se dibuja esa y
  // punto, no se recalcula por vecinos. El autotile de abajo queda solo
  // para los niveles viejos, que no tienen ese dato.
  if (tileName && F[tileName]) {
    const f = F[tileName];
    const cols = Math.max(1, Math.round(w / TR_TILE));
    const rows = Math.max(1, Math.round(h / TR_TILE));
    const cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.drawImage(tiles.img, f.x, f.y, f.w, f.h,
          drawX + c * cw, drawY + r * ch, Math.ceil(cw), Math.ceil(ch));
      }
    }
    return true;
  }
  // Celdas: se reparte el rectángulo en partes lo más cercanas a TR_TILE
  // posible, así los niveles viejos (alturas de 20px, por ejemplo) también
  // quedan prolijos en vez de cortados por la mitad.
  const cols = Math.max(1, Math.round(w / TR_TILE));
  const rows = Math.max(1, Math.round(h / TR_TILE));
  const cw = w / cols, ch = h / rows;
  for (let r = 0; r < rows; r++) {
    const fr = rows === 1 ? 0 : (r === 0 ? 0 : (r === rows - 1 ? 2 : 1));
    for (let c = 0; c < cols; c++) {
      const fc = cols === 1 ? 1 : (c === 0 ? 0 : (c === cols - 1 ? 2 : 1));
      const f = F[TR_WALL_FRAMES[fr][fc]];
      if (!f) continue;
      ctx.drawImage(tiles.img, f.x, f.y, f.w, f.h,
        drawX + c * cw, drawY + r * ch, Math.ceil(cw), Math.ceil(ch));
    }
  }
  return true;
}

// Plataforma de madera (las 3 piezas de mapa_tiles.png). Se elige la pieza
// por ancho en celdas: 1 = chica, 2 = mediana, 3+ = grande estirada.
export function trDrawWoodPlatform(ctx, drawX, drawY, w, h, piece) {
  const tiles = trGetTilesAssets();
  if (!tiles) return false;
  const cells = Math.max(1, Math.round(w / TR_TILE));
  const name = piece || (cells <= 1 ? 'plat_small' : (cells === 2 ? 'plat_medium' : 'plat_large'));
  const f = tiles.atlas.frames[name];
  if (!f) return false;
  ctx.drawImage(tiles.img, f.x, f.y, f.w, f.h, drawX, drawY, Math.ceil(w), Math.ceil(h));
  return true;
}

export function trDrawStoneFloor(ctx, plat) {
  trDrawStoneFloorAt(ctx, plat.x, plat.y, plat.x, plat.y, plat.w, plat.h, trIsWall(plat));
}
// Puramente visual — no colisiona, no importa el orden, se dibuja detrás
// de todo lo jugable. 'torch' anima sola (parpadeo, 4 frames de deco.png)
// sin que updateTrampas tenga que saber nada de esto.
export function trDrawDecor(ctx) {
  const assets = trGetDecoAssets();
  if (!assets) return;
  const lvl = TR_LEVELS[TRAMPAS.levelIndex];
  const decor = lvl.decor || [];
  if (!decor || !decor.length) return;
  const F = assets.atlas.frames;
  // Un solo cálculo por frame (antes: performance.now() + string por antorcha).
  const torchF = F[TR_TORCH_FRAMES[Math.floor(performance.now() / 150) % 4]];
  // Vista actual en coordenadas de mundo, para no dibujar lo que no se ve.
  const fov = TRAMPAS.fov || 1;
  const vx0 = TRAMPAS.camera.x - 64, vx1 = TRAMPAS.camera.x + TR_W * fov + 64;
  const vy0 = TRAMPAS.camera.y - 64, vy1 = TRAMPAS.camera.y + TR_H * fov + 64;
  for (const d of decor) {
    if (d.x > vx1 || d.x < vx0 - 200 || d.y > vy1 || d.y < vy0 - 200) continue;
    let f;
    if (d.type === 'torch') {
      f = torchF;
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
    if (!f) continue;
    const h = d.h || 40;
    const w = h * (f.w / f.h);
    ctx.drawImage(assets.img, f.x, f.y, f.w, f.h, d.x, d.y, w, h);
  }
}
const TR_TORCH_FRAMES = ['torch_1', 'torch_2', 'torch_3', 'torch_4'];

// Sprite de pincho más chico, repetido para llenar un ancho — reemplaza
// los triángulos dibujados a mano, tanto para el peligro 'spike' (pozo)
// como para la decoración decor:'spike' arriba de una plataforma.
// Pinchos dibujados a mano (triángulos) — ya no usa el sprite spike_1a/b/c
// de mapa.png, ese atlas ahora solo se usa para flechas y puerta.
// ─── Obstáculos con textura (obstaculo.webp) ────────────────────────
// La sierra son 13 frames (saw_0..saw_12) que se recorren por tiempo: la
// hoja gira sola aunque la sierra esté quieta.
const TR_SAW_FRAMES = 13;
const TR_SAW_FPS = 20;
export function trDrawSaw(ctx, hz) {
  const obst = trGetObstAssets();
  if (!obst) return false;
  const idx = Math.floor(performance.now() / (1000 / TR_SAW_FPS)) % TR_SAW_FRAMES;
  const f = obst.atlas.frames['saw_' + idx];
  if (!f) return false;
  // Un poco más grande que el hitbox: los dientes sobresalen, se ve mejor
  // y sigue siendo el hitbox el que decide si te mata.
  const pad = Math.max(2, hz.w * 0.12);
  ctx.drawImage(obst.img, f.x, f.y, f.w, f.h,
    hz.x - pad, hz.y - pad, hz.w + pad * 2, hz.h + pad * 2);
  return true;
}

// Flecha con sprite (arrow_right/arrow_up/arrow_down del atlas nuevo).
export function trDrawArrowSprite(ctx, a) {
  const obst = trGetObstAssets();
  if (!obst) return false;
  const F = obst.atlas.frames;
  let f = null, flip = false;
  if (a.dir === 'up') f = F.arrow_up_a;
  else if (a.dir === 'down') f = F.arrow_down;
  else { f = F.arrow_right_a; flip = a.dir < 0; }
  if (!f) return false;
  if (flip) {
    ctx.translate(a.x + a.w / 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(obst.img, f.x, f.y, f.w, f.h, -a.w / 2, a.y, a.w, a.h);
    ctx.scale(-1, 1);
    ctx.translate(-(a.x + a.w / 2), 0);
  } else {
    ctx.drawImage(obst.img, f.x, f.y, f.w, f.h, a.x, a.y, a.w, a.h);
  }
  return true;
}

// Cuántos pinchos entran por celda según el tamaño elegido en el editor.
export const TR_SPIKES_PER_CELL = { small: 4, medium: 2, large: 1 };

// hz (opcional): el peligro entero, para leer size y rot45. Los pinchos
// siempre se apoyan en el BORDE INFERIOR del rectángulo — antes los
// medianos quedaban centrados y parecían flotar dentro del cuadrado.
export function trDrawSpikeRow(ctx, x, y, w, h, hz) {
  const size = (hz && hz.size) || 'medium';
  const perCell = TR_SPIKES_PER_CELL[size] || 2;
  const n = Math.max(1, Math.round((w / TR_TILE) * perCell));
  const step = w / n;
  const sh = Math.min(h, step);      // pincho cuadrado: 4 chiquitos, 2 medianos, 1 grande
  const top = y + h - sh;            // apoyado abajo

  const rot = hz && hz.rot45;
  if (rot) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(Math.PI / 4);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }
  const obst = trGetObstAssets();
  if (obst && obst.atlas.frames.spike_a) {
    for (let i = 0; i < n; i++) {
      const f = obst.atlas.frames[i % 2 === 0 ? 'spike_a' : 'spike_b'] || obst.atlas.frames.spike_a;
      ctx.drawImage(obst.img, f.x, f.y, f.w, f.h, x + i * step, top, Math.ceil(step), sh);
    }
  } else {
    trDrawSpikeRowVector(ctx, x, top, w, sh);
  }
  if (rot) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }
}

// Pinchos dibujados a mano — fallback de siempre.
export function trDrawSpikeRowVector(ctx, x, y, w, h) {
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
    if (p.dead) ctx.globalAlpha = 0.85;
    // Mismo sprite que Pixel Runner, mismo problema: es arte "pintado",
    // no pixel art de bloques — con vecino-más-cercano se ve dentado al
    // achicarlo. Suavizado solo acá, se apaga enseguida para no afectar
    // el resto (piedra, pinchos, etc., que sí son pixel art de verdad).
    ctx.imageSmoothingEnabled = true;
    // Ancla: centro-x del hitbox, borde inferior — mismo criterio que ya
    // usa Pixel Runner con este mismo sprite (targetH = altura del hitbox,
    // drawAtlasFrame centra el ancho solo y sube desde `y`).
    Engine2D.drawAtlasFrame(ctx, junior.img, junior.atlas, frameName, p.x + p.w / 2, p.y + p.h, p.h, p.facing === -1, false);
    ctx.imageSmoothingEnabled = false;
    if (p.dead) ctx.globalAlpha = 1;
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

// step: el del GameLoop (antes avanzaba "1 por frame dibujado", así que
// con pocos FPS la explosión duraba más y en 144Hz casi no se veía).
export function updateExplosions(step = 1) {
  for (let i = TRAMPAS.explosions.length - 1; i >= 0; i--) {
    const e = TRAMPAS.explosions[i];
    e.x += e.vx * step;
    e.y += e.vy * step;
    e.vy += 0.1 * step;
    e.life -= e.decay * step;
    if (e.life <= 0) TRAMPAS.explosions.splice(i, 1);
  }
}

export function drawExplosions(ctx) {
  if (!TRAMPAS.explosions.length) return;
  const round = Engine2D.Quality.fx.roundParticles !== false;
  for (const e of TRAMPAS.explosions) {
    ctx.globalAlpha = e.life;
    ctx.fillStyle = e.color;
    const r = e.r * e.life;
    if (round) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
    }
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
  // Solo el pedazo que ve la cámara (la capa mide lo que el nivel entero).
  if (TRAMPAS.staticLayer) {
    const fov = TRAMPAS.fov || 1;
    TRAMPAS.staticLayer.drawRegion(ctx, TRAMPAS.camera.x, TRAMPAS.camera.y, TR_W * fov, TR_H * fov);
  }

  // Lo único que sí cambia en tiempo real —plataformas 'moving' (se
  // desplazan) y 'crumble' (se tiñen de rojo y desaparecen)— se sigue
  // dibujando a mano, plataforma por plataforma, encima de la capa
  // estática. 'normal'/'fake' ya están en TRAMPAS.staticLayer.
  for (const plat of TRAMPAS.platforms) {
    if (plat.gone) continue;
    if (plat.type !== 'moving' && plat.type !== 'crumble') continue;
    const spr = trPlatformSprite(plat);
    ctx.drawImage(spr.canvas, Math.round(plat.x), Math.round(plat.y) - spr.top);
    if (plat.type === 'crumble' && plat.touchedAt !== null) {
      ctx.fillStyle = 'rgba(232,84,63,0.45)';
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
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
      if (trDrawSaw(ctx, hz)) continue;
      // Fallback (textura sin cargar): sierra dibujada a mano — el ángulo
      // gira en función de la posición (obj[axis]), así la rotación va
      // acorde a cómo se mueve.
      const cx = hz.x + hz.w / 2, cy = hz.y + hz.h / 2, r = hz.w / 2;
      const angle = (hz.move ? (hz[hz.move.axis] || 0) : 0) * 0.15;
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
      // Sprites nuevos (obstaculo.webp) primero; si no cargaron, el atlas
      // viejo de mapa.webp, y último el triángulo dibujado a mano.
      if (trDrawArrowSprite(ctx, a)) return;
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
  // Salida: el mismo rectángulo verde que muestra el editor (ya no usa el
  // sprite 'door' del atlas — el set de texturas nuevo no trae puerta).
  const lvl = TR_LEVELS[TRAMPAS.levelIndex];
  {
    const e = lvl.exit;
    ctx.fillStyle = '#15803d';
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4);
    ctx.fillStyle = '#facc15'; // picaporte
    ctx.beginPath();
    ctx.arc(e.x + 6, e.y + e.h / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Jugador — sprite dibujado a mano
  drawTrampasPlayer(ctx, p);

  // Explosiones
  // Las explosiones avanzan por tiempo real (step = ms/16.6), no "1 por
  // dibujado": así duran lo mismo a 30, 60 o 144 fps, y siguen andando
  // aunque la secuencia de muerte dibuje fuera del GameLoop.
  const now = performance.now();
  const exStep = TRAMPAS._lastDrawAt ? Math.min(3, (now - TRAMPAS._lastDrawAt) / 16.6) : 1;
  TRAMPAS._lastDrawAt = now;
  if (TRAMPAS.explosions.length) updateExplosions(exStep);
  drawExplosions(ctx);

  // Salir del espacio de world (cámara)
  ctx.restore();

  // Controles táctiles (Engine2D)
  if (TRAMPAS.touch && TRAMPAS.touch.visible) {
    TRAMPAS.touch.draw(ctx);
  }
}
