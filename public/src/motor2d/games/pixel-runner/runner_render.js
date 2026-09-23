// ══════════════════════════════════════
//   Pixel Runner — runner_render.js  (módulo ES6)
// ══════════════════════════════════════
// Clase RunnerRenderer: todo el dibujo por frame (cielo día/noche, piso,
// castillo, obstáculos, pickups, Junior, lluvia y controles táctiles) y
// sus cachés (piso tileado, fondos de día/noche). Solo LEE el estado del
// juego. Obstáculos y pickups se dibujan a sí mismos (polimorfismo: cada
// entidad tiene su propio dibujar()).
import { RunnerConfig as RC } from './runner_config.js';

export class RunnerRenderer {
  constructor(juego) {
    this.juego = juego;
    this.tilesCache = null;   // frame → tamaño → canvas con el frame tileado
    this.fondoNoche = null;   // gradientes pre-pintados del cielo
    this.fondoDia = null;
  }

  // Sprites cargados por Engine2D (null mientras no terminaron de bajar).
  assets() {
    const A = RC.ASSETS;
    const economia = this.juego.economia;
    return {
      obstImg: Engine2D.getImage(A.obst), obstAtlas: Engine2D.getAtlas(A.obstAt),
      birdImg: Engine2D.getImage(A.bird), birdAtlas: Engine2D.getAtlas(A.birdAt),
      itemImg: Engine2D.getImage(A.item), itemAtlas: Engine2D.getAtlas(A.itemAt),
      // getter: solo consulta las mejoras si hay un x2 que dibujar
      get x2Triple() { return economia.mejoras.x2Triple; },
    };
  }

  dibujar(dead = false) {
    const juego = this.juego;
    const ctx = juego.ctx;
    // Siempre en coordenadas lógicas (480x270); la escala real la pone la calidad.
    const W = RC.VIEW_W, H = RC.VIEW_H;
    const s = juego.renderScale || 1;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    const groundY = H - juego.groundH;

    this.dibujarCielo(ctx, W, H, groundY, juego.skyH);

    // Barrido de transición de bioma: solo desde el 2do segmento, y nunca
    // durante la secuencia del castillo (ahí el bioma queda forzado a pasto).
    const segmentIndex = Math.floor(juego.score / RC.BIOME_SEGMENT);
    const posInSegment = juego.score % RC.BIOME_SEGMENT;
    const Q = Engine2D.Quality.fx;
    const groundWipe = (Q.transitions && !juego.winCastle && segmentIndex > 0 && posInSegment < RC.GROUND_TRANSITION_RANGE)
      ? posInSegment / RC.GROUND_TRANSITION_RANGE
      : null;
    this.dibujarPiso(ctx, W, groundY, juego.biome, groundWipe);

    // Castillo de la victoria, de fondo.
    if (juego.winCastle) {
      const castleImg = Engine2D.getImage(RC.ASSETS.castillo);
      const c = juego.winCastle;
      if (castleImg) {
        ctx.drawImage(castleImg, c.x, c.y, c.w, c.h);
      } else {
        ctx.fillStyle = '#7a5c3e';
        ctx.fillRect(c.x, c.y, c.w, c.h);
      }
    }

    const a = this.assets();
    juego.obstacles.forEach(o => o.dibujar(ctx, a));

    // Monedas y power-ups: arte "pintado", con suavizado solo acá.
    ctx.imageSmoothingEnabled = true;
    juego.pickups.forEach(o => o.dibujar(ctx, a));
    ctx.imageSmoothingEnabled = false;

    this.dibujarJugador(ctx, dead, a, Q);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Vel: ' + juego.speed.toFixed(1), 6, 16);

    this.dibujarLluvia(ctx);

    // Controles táctiles — SIEMPRE al final, encima de todo.
    if (juego.touch) juego.touch.draw(ctx);
  }

  dibujarJugador(ctx, dead, a, Q) {
    const juego = this.juego;
    const p = juego.jugador;

    // Aura del escudo detrás del personaje (en calidad baja, un frame fijo).
    if (p.shield && a.itemImg && a.itemAtlas) {
      ctx.imageSmoothingEnabled = true;
      if (Q.shimmer) {
        const shimmerIdx = Math.floor(juego.frameCount / 4) % RC.SHIELD_SHIMMER_FRAMES.length;
        ctx.globalAlpha = 0.75;
        Engine2D.drawAtlasFrame(ctx, a.itemImg, a.itemAtlas, RC.SHIELD_SHIMMER_FRAMES[shimmerIdx], p.x + p.w / 2, p.y + p.h / 2, p.h * 1.6, false, true);
        ctx.globalAlpha = 1;
      } else {
        Engine2D.drawAtlasFrame(ctx, a.itemImg, a.itemAtlas, RC.SHIELD_SHIMMER_FRAMES[0], p.x + p.w / 2, p.y + p.h / 2, p.h * 1.6, false, true);
      }
      ctx.imageSmoothingEnabled = false;
    }

    const juniorImg = Engine2D.getImage(RC.ASSETS.junior);
    const juniorAtlas = Engine2D.getAtlas(RC.ASSETS.juniorAt);
    if (juniorImg && juniorAtlas) {
      const frameName = dead
        ? (p.animFrameName || 'fall_0')
        : (!juego.started ? RC.RUN_FRAMES[0] : (p.estaEnPiso() ? RC.RUN_FRAMES[p.animFrame] : 'action_2')); // action_2 ~ pose de salto
      ctx.imageSmoothingEnabled = true;
      Engine2D.drawAtlasFrame(ctx, juniorImg, juniorAtlas, frameName, p.x + p.w / 2, p.y + p.h + RC.JUNIOR_GROUND_SINK, p.h, p.facing === -1, false);
      ctx.imageSmoothingEnabled = false;
    } else {
      ctx.fillStyle = dead ? '#7a2020' : '#2563eb';
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
  }

  // ─── Cielo: fondo interpolado + sol/luna en arco + nubes + estrellas ───
  static lerp(a, b, t) { return a + (b - a) * t; }

  static lerpColorHex(hexA, hexB, t) {
    const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    const r = Math.round(RunnerRenderer.lerp(ar, br, t)), g = Math.round(RunnerRenderer.lerp(ag, bg, t)), bl = Math.round(RunnerRenderer.lerp(ab, bb, t));
    return `rgb(${r},${g},${bl})`;
  }

  // Tilea horizontalmente un frame del atlas (usado para la franja de
  // estrellas y para la textura del piso, que son mucho más angostos que
  // el ancho del canvas).
  dibujarTileado(ctx, img, atlas, frameName, x, y, width, height) {
    const f = atlas.frames[frameName];
    if (!f) return;
    // Cache en dos niveles (frame → tamaño) en vez de armar un string de
    // clave por llamada: esto corre varias veces por frame.
    if (!this.tilesCache) this.tilesCache = {};
    const byFrame = this.tilesCache[frameName] || (this.tilesCache[frameName] = {});
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

  dibujarCielo(ctx, W, H, groundY, skyH) {
    const sky = this.juego.cielo;
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

    if (!this.fondoNoche) {
      this.fondoNoche = document.createElement('canvas');
      this.fondoNoche.width = W; this.fondoNoche.height = H;
      const nctx = this.fondoNoche.getContext('2d');
      const nbg = nctx.createLinearGradient(0, 0, 0, H);
      nbg.addColorStop(0, nightColors[0]); nbg.addColorStop(0.6, nightColors[1]); nbg.addColorStop(1, nightColors[2]);
      nctx.fillStyle = nbg; nctx.fillRect(0, 0, W, H);

      this.fondoDia = document.createElement('canvas');
      this.fondoDia.width = W; this.fondoDia.height = H;
      const dctx = this.fondoDia.getContext('2d');
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
    if (Ls < 0.99) ctx.drawImage(this.fondoNoche, 0, 0);
    if (Ls >= 0.99) {
      ctx.drawImage(this.fondoDia, 0, 0);
    } else if (Ls > 0.01) {
      ctx.globalAlpha = Ls;
      ctx.drawImage(this.fondoDia, 0, 0);
      ctx.globalAlpha = 1;
    }

    // Estrellas — solo de noche, se desvanecen con L (más L = más de día = menos visibles)
    const mapaImg = Engine2D.getImage(RC.ASSETS.mapa);
    const mapaAtlas = Engine2D.getAtlas(RC.ASSETS.mapaAt);
    if (Q.ambientSprites && mapaImg && mapaAtlas && L < 0.6) {
      ctx.save();
      ctx.globalAlpha = (0.6 - L) / 0.6; // 1 en plena noche, 0 apenas empieza a clarear
      // Eliminado el ctx.clip() porque consumía mucha CPU y las estrellas ya están acotadas a Y=50
      this.dibujarTileado(ctx, mapaImg, mapaAtlas, 'stars_dense', 0, skyH + 4, W, 26);
      ctx.restore();
    }

    // Sol (mitad día) / Luna (mitad noche) — arco simple: más alto al
    // mediodía/medianoche, bajo cerca del horizonte al salir/ponerse.
    if (mapaImg && mapaAtlas) {
      const elevation = Math.sin(Math.PI * dayProgress); // 0 en los bordes, 1 en el punto más alto
      const arcX = RunnerRenderer.lerp(30, W - 30, dayProgress);
      const arcY = RunnerRenderer.lerp(skyH + 55, skyH + 8, elevation);
      // Qué noche es (0ª, 1ª, 2ª...) para elegir media luna o luna llena —
      // alterna una fase por noche en vez de mezclarlas dentro de la misma
      // noche, que se vería como si la luna cambiara de forma sin razón.
      const nightIndex = Math.floor(this.juego.frameCount / sky.cycleLen);
      const moonGroup = (nightIndex % 2 === 0) ? RC.MOON_PHASES.half : RC.MOON_PHASES.full;
      const frames = isDay ? RC.SUN_FRAMES : moonGroup;
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
      const cloudSet = (L < 0.5 || this.juego.lluvia.active) ? RC.CLOUD_DARK_FRAMES : RC.CLOUD_FRAMES;
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
  dibujarLluvia(ctx) {
    const drops = this.juego.lluvia.drops;
    const splashes = this.juego.lluvia.splashes;
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
      const splashImg = Engine2D.getImage(RC.ASSETS.rainSplash);
      if (splashImg) {
        ctx.save();
        for (const s of splashes) {
          ctx.globalAlpha = Math.max(0, s.life / RC.RAIN_SPLASH_LIFE);
          ctx.drawImage(splashImg, s.x - 12, s.y - RC.RAIN_SPLASH_GROUND_OFFSET, 24, 8);
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
  dibujarPiso(ctx, W, groundY, biome, wipe) {
    const mapaImg = Engine2D.getImage(RC.ASSETS.mapa);
    const mapaAtlas = Engine2D.getAtlas(RC.ASSETS.mapaAt);
    const frameName = biome === 'desert' ? 'ground_desert' : 'ground_grass';
    const prevFrameName = biome === 'desert' ? 'ground_grass' : 'ground_desert';
    const currentColor = biome === 'desert' ? '#5a4a2f' : '#22331f';
    const prevColor = biome === 'desert' ? '#22331f' : '#5a4a2f';

    if (wipe === null || wipe === undefined) {
      if (mapaImg && mapaAtlas) this.dibujarTileado(ctx, mapaImg, mapaAtlas, frameName, 0, groundY, W, this.juego.groundH);
      else { ctx.fillStyle = currentColor; ctx.fillRect(0, groundY, W, this.juego.groundH); }
      return;
    }

    // Fondo: el bioma VIEJO, a todo lo ancho.
    if (mapaImg && mapaAtlas) this.dibujarTileado(ctx, mapaImg, mapaAtlas, prevFrameName, 0, groundY, W, this.juego.groundH);
    else { ctx.fillStyle = prevColor; ctx.fillRect(0, groundY, W, this.juego.groundH); }

    // El bioma NUEVO tapa desde `wipeX` (que arranca en W, sin tapar nada) hasta
    // el borde derecho, y wipeX baja hasta 0 (toda la pantalla) a medida que
    // wipe avanza — el límite entre los dos se ve "entrando" de derecha a
    // izquierda en vez de aparecer de golpe.
    const wipeX = W * (1 - wipe);
    ctx.save();
    ctx.beginPath();
    ctx.rect(wipeX, groundY, W - wipeX, this.juego.groundH);
    ctx.clip();
    if (mapaImg && mapaAtlas) this.dibujarTileado(ctx, mapaImg, mapaAtlas, frameName, 0, groundY, W, this.juego.groundH);
    else { ctx.fillStyle = currentColor; ctx.fillRect(0, groundY, W, this.juego.groundH); }
    ctx.restore();
  }
}
