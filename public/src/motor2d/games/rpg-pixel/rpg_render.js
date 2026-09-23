import { RPG_ASSET_BASE, RPG_CHEST_DRAW_H, RPG_CHEST_FRAMES, RPG_CHEST_INTERACT_DIST, RPG_CHEST_SHEET, RPG_DEBUG_SHOW_ZONE, RPG_FACING_ROW, RPG_ITEM_ICONS, RPG_ITEM_SHEET, RPG_LOGICAL_H, RPG_LOGICAL_W, RPG_PLAYER_DRAW_H } from './rpg_config.js';
import { RPG_BOSS_ATTACK_POSES, RPG_BOSS_WINDUP_POSES } from './rpg_enemies_ai.js';
import { RPG, RPG_ENEMY_TYPES, rpgRoomCfg } from './rpg_enemies_data.js';

export function rpgDraw() {
  const ctx = RPG.ctx;
  const C = RPG.canvas;
  if (!ctx) return;
  ctx.clearRect(0, 0, RPG_LOGICAL_W, RPG_LOGICAL_H);

  const cfg = rpgRoomCfg();
  if (!cfg) return;

  // Todo lo que sigue se dibuja en coordenadas de MUNDO; el canvas recorta
  // automáticamente lo que cae fuera de lo visible. ctx.scale(roomZoom)
  // encoge TODA la escena (fondo, Junior, enemigos) para el zoom-out fijo
  // de esta habitación — tiene que ir ANTES del translate para que
  // camera.x/camera.y (ya calculados en unidades de mundo) se compongan
  // bien con el zoom. Ver rpgComputeRoomZoom para cómo se calculan.
  ctx.save();
  ctx.scale(RPG.roomZoom, RPG.roomZoom);
  ctx.translate(-RPG.camera.x, -RPG.camera.y);

  const bg = RPG.images[cfg.zoneImage];
  if (bg && bg.complete) {
    // El fondo se estira a todo el ancho del mundo (no solo el canvas
    // visible), así la habitación "parece más grande" y hay campo de
    // visión limitado en vez de ver todo el piso de entrada.
    // anchorBottom=true: el recorte vertical de "cover" se ancla al borde
    // INFERIOR de la imagen en vez de centrarlo. Antes, al ser el mundo
    // (worldWidth x C.height) mucho más panorámico que la imagen original,
    // el cover centrado recortaba ~21% de arriba Y ~21% de abajo — y ese
    // recorte de abajo se comía varias filas de piso que sí existen en el
    // arte. Anclando abajo, se sacrifica más cielo/fondo arriba (que no
    // afecta el gameplay) pero el piso se ve completo hasta el borde.
    //
    // rpgDrawRoomBackground (no el rpgDrawCover genérico): mantiene SIEMPRE
    // la misma escala (mundo → ancho completo, recorte anclado abajo) y
    // solo agrega altura hacia arriba, que el zoom-out fijo de la
    // habitación (ctx.scale en rpgDraw) decide cuánto revelar. Usar el
    // rpgDrawCover genérico acá causaba un bug: al pasarle un dh más alto,
    // recalculaba el recorte con un aspect ratio distinto al original y
    // terminaba empujando el piso fuera de cuadro por abajo. Ver
    // rpgComputeRoomZoom para cómo se calcula el zoom.
    //
    // PERF: se le pasa la vista de la cámara para que vuelque SOLO la parte
    // visible del fondo (antes se escalaba la imagen entera — un webp de
    // 1920px o más — a todo el ancho del mundo en cada frame).
    const z = RPG.roomZoom || 1;
    rpgDrawRoomBackground(ctx, bg, RPG.worldWidth, RPG_LOGICAL_H, {
      x: RPG.camera.x, y: RPG.camera.y, w: RPG_LOGICAL_W / z, h: RPG_LOGICAL_H / z
    });
  } else {
    ctx.fillStyle = '#0a0f0a';
    ctx.fillRect(0, 0, RPG.worldWidth, RPG_LOGICAL_H);
  }

  const itemImg = RPG.images[RPG_ITEM_SHEET];

  // Enemigos (puede haber varios vivos a la vez en habitaciones normales;
  // los muertos siguen dibujándose un instante mientras corre su
  // animación de muerte — ver el bloque !e.alive en rpgUpdate).
  RPG.enemies.forEach(e => {
    const species = RPG_ENEMY_TYPES[e.species];
    if (!species) return;
    if (!e.alive && e.animKind !== 'death') return;
    if (e.hidden) return; // fantasma invisible/intangible mientras se teletransporta (ver rpgUpdateGhost)
    if (e.vanished) return; // el Guardián se disuelve del todo al terminar su diálogo de derrota (ver dark_ghostking.dissolveOnDeath)

    ctx.save();

    // Aviso visual de un ataque especial a punto de salir (telegraph):
    // círculo rojo pulsante mientras el jefe "carga" antes del dash o de
    // invocar guerreros.
    if (e.alive && (e.attack.state === 'dashTelegraph' || e.attack.state === 'summonTelegraph' || e.attack.state === 'teleportAppear')) {
      const pulse = 0.5 + 0.5 * Math.sin(e.attack.timer * 0.03);
      ctx.globalAlpha = 0.35 + pulse * 0.3;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(e.x, e.y - 45, 55 + pulse * 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (e.hitFlash > 0) ctx.globalAlpha = 0.55;
    // Parpadeo del propio sprite durante el aviso de dash (además del
    // círculo rojo de arriba) — alterna opacidad cada ~100ms mientras dura
    // el telegraph, la señal de "va a dashear" que pidió Reybug.
    else if (e.alive && (e.attack.state === 'dashTelegraph' || e.attack.state === 'teleportVanish')) {
      ctx.globalAlpha = Math.floor(e.attack.timer / 100) % 2 === 0 ? 1 : 0.3;
    }
    const flip = e.alive ? (e.x > RPG.player.x) : e.deathFlip;
    const atlas = RPG.atlases[species.atlas];
    const img = RPG.images[species.sheet];

    if (species.behavior === 'boss') {
      // Caminata: atlas/sheet APARTE del resto de las poses (ver
      // RPG_ENEMY_TYPES.dark_knight.walkScale) — solo se usa mientras el
      // roam lo está moviendo de verdad; parado (esperando cooldown,
      // recuperándose de un golpe, etc.) cae a la pose "idle" de siempre.
      if (e.alive && e.attack.state === 'roam' && e.moving && species.walkAtlas) {
        const walkAtlas = RPG.atlases[species.walkAtlas];
        const walkImg = RPG.images[species.walkSheet];
        if (walkAtlas && walkImg) {
          const frameName = species.walkPoses[e.animFrame % species.walkPoses.length];
          rpgDrawAtlasFrameScaled(ctx, walkImg, walkAtlas, frameName, e.x, e.y, species.walkScale, flip);
          ctx.restore();
          return;
        }
      }
      // Jefe: poses nombradas elegidas por el estado de su ataque actual,
      // no por un ciclo de frames. Muerto, ignora el estado de ataque y usa
      // e.deathFrame (1-2) — ver rpgStartBossDeathSequence/rpgPlayBossDeathFall.
      // windupKeys/attackKeys: por defecto el golpe cuerpo a cuerpo de 4+3
      // frames de dark_knight — dark_ghostking define su propio largo más
      // corto (ver meleeWindupPoseKeys/meleeAttackPoseKeys).
      const windupKeys = species.meleeWindupPoseKeys || RPG_BOSS_WINDUP_POSES;
      const attackKeys = species.meleeAttackPoseKeys || RPG_BOSS_ATTACK_POSES;
      let frameName = species.poses.idle;
      if (!e.alive) {
        frameName = species.poses['death' + (e.deathFrame || 1)] || species.poses.death2;
      } else if (e.attack.state === 'meleeWindup') {
        frameName = species.poses[windupKeys[e.attack.poseFrame]];
      } else if (e.attack.state === 'meleeAttack') {
        frameName = species.poses[attackKeys[e.attack.poseFrame]];
      } else if (e.attack.state === 'rangedWindup') {
        // Con poses propias de a distancia (rangedWindup1/2, ver
        // dark_ghostking) se parte la duración del windup en 2 mitades; si
        // la especie no las define, cae al comportamiento de siempre
        // (reusar windup1 del melee, como dark_knight).
        if (species.poses.rangedWindup1) {
          const half = (cfg.rangedWindupMs || 260) / 2;
          frameName = species.poses[e.attack.poseTick < half ? 'rangedWindup1' : 'rangedWindup2'];
        } else {
          frameName = species.poses.windup1;
        }
      } else if (e.attack.state === 'rangedAttack') {
        frameName = species.poses.rangedAttack;
      } else if (e.attack.state === 'dashTelegraph') {
        frameName = species.poses.windup2;
      } else if (e.attack.state === 'dashing') {
        frameName = species.poses.dash2;
      } else if (e.attack.state === 'teleportVanish') {
        frameName = species.poses.vanish1;
      } else if (e.attack.state === 'teleportAppear') {
        frameName = species.poses.vanish2;
      } else if (e.attack.state === 'summonTelegraph') {
        frameName = species.poses.summon;
      }

      // Flotación de idle (ver dark_ghostking.floatBob): puramente visual,
      // no mueve e.y real — así no afecta hitboxes/IA.
      let bobOffset = 0;
      if (species.floatBob && e.alive && e.attack.state === 'roam') {
        bobOffset = Math.sin(performance.now() / 450) * (species.floatBobAmount || 3);
      }

      // El frame puede vivir en el atlas principal o, si no está ahí
      // (summon/death de dark_ghostking, ver altSheet/altAtlas), en un
      // atlas secundario con su propia escala (altScale).
      let drawImg = img, drawAtlas = atlas, scale;
      if (drawAtlas && drawAtlas.frames[frameName]) {
        scale = rpgSpeciesScale(e.species, species, drawAtlas);
      } else if (species.altSheet && species.altAtlas) {
        drawAtlas = RPG.atlases[species.altAtlas];
        drawImg = RPG.images[species.altSheet];
        scale = species.altScale || 1;
      }
      if (drawAtlas && drawImg && drawAtlas.frames[frameName]) {
        rpgDrawAtlasFrameScaled(ctx, drawImg, drawAtlas, frameName, e.x, e.y + bobOffset, scale, flip);
      }
    } else if (atlas && img) {
      const frames = species.anims[e.animKind] || species.anims.idle;
      const frameName = frames[Math.min(e.animFrame, frames.length - 1)];
      const scale = rpgSpeciesScale(e.species, species, atlas);
      rpgDrawAtlasFrameScaled(ctx, img, atlas, frameName, e.x, e.y, scale, flip);
    }
    ctx.restore();
  });

  // Jugador
  const p = RPG.player;
  ctx.save();
  if (p.hitFlash > 0) ctx.globalAlpha = 0.55;
  // Inmunidad del tótem: parpadeo (igual criterio que el dash del jefe).
  else if (p.invulnTimer > 0 && Math.floor(p.invulnTimer / 100) % 2 === 0) ctx.globalAlpha = 0.35;
  if (p.blocking) {
    const sheet = SPRITES.bloquear;
    const img = RPG.images[RPG_ASSET_BASE + 'models/junior/bloquear.webp'];
    // Las 4 columnas de bloquear.webp son 4 poses direccionales fijas
    // (frente/atrás/izq/der, mismo orden que junior.webp) — no cuadros de
    // una animación. Se elige por RPG.facing, no por un contador de tiempo.
    if (sheet && img) rpgDrawFrame(ctx, img, sheet.rows[0], RPG_FACING_ROW[RPG.facing], p.x, p.y, RPG_PLAYER_DRAW_H, false);
  } else {
    const sheet = SPRITES.junior;
    const img = RPG.images[RPG_ASSET_BASE + 'models/junior/junior.webp'];
    if (sheet && img) {
      const rowIdx = RPG_FACING_ROW[RPG.facing];
      rpgDrawFrame(ctx, img, sheet.rows[rowIdx], p.animFrame, p.x, p.y, RPG_PLAYER_DRAW_H, false);
    }
  }
  // Aura dorada mientras dura la inmunidad del tótem.
  if (p.invulnTimer > 0) {
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - RPG_PLAYER_DRAW_H * 0.45, RPG_PLAYER_DRAW_H * 0.5, RPG_PLAYER_DRAW_H * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Aura sutil mientras dura el boost de velocidad de la poción naranja.
  if (p.speedBoostTimer > 0) {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // (antes centrada en (0, …): el sprite ya no deja el contexto trasladado
    // a los pies de Junior, así que el aura salía en la esquina del mundo)
    ctx.ellipse(p.x, p.y - RPG_PLAYER_DRAW_H * 0.35, RPG_PLAYER_DRAW_H * 0.42, RPG_PLAYER_DRAW_H * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Balas de Junior (sprite real, rotado según la dirección del disparo).
  // Con la esfera azul (RPG.upgrades.burning) cambian a la variante
  // celeste (bulletBurning) — cosmético, el daño extra ya se aplicó en
  // rpgUpdate al impactar.
  if (itemImg) {
    RPG.bullets.forEach(b => {
      const angle = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      const rect = b.burning ? RPG_ITEM_ICONS.bulletBurning : RPG_ITEM_ICONS.bullet;
      rpgDrawIconRect(ctx, itemImg, rect, b.x, b.y, 12, { rotation: angle, centered: true });
    });
  }

  // Cofre de recompensa de la habitación (ver rpgSpawnChest / rpgInteract).
  const chest = RPG.chest;
  if (chest) {
    const chestImg = RPG.images[RPG_CHEST_SHEET];
    if (chestImg) {
      const frame = RPG_CHEST_FRAMES[chest.type][chest.frame];
      rpgDrawIconRect(ctx, chestImg, frame, chest.x, chest.y, RPG_CHEST_DRAW_H, { smooth: true });
    }
    // Cartelito "Interactuar" mientras Junior está cerca y el cofre sigue cerrado.
    if (!chest.opening && !chest.opened) {
      const near = Math.hypot(p.x - chest.x, p.y - chest.y) <= RPG_CHEST_INTERACT_DIST;
      if (near) {
        ctx.save();
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(chest.x - 26, chest.y - RPG_CHEST_DRAW_H - 14, 52, 12);
        ctx.fillStyle = '#fde68a';
        ctx.fillText('💬 Abrir cofre', chest.x, chest.y - RPG_CHEST_DRAW_H - 5);
        ctx.restore();
      }
    }
  }

  // Proyectiles enemigos: dark_slash del jefe (horizontal, se espeja según
  // dirección) o flechas del archer (apuntan hacia donde se dispararon, se
  // rotan según su velocidad real).
  const slashImg = cfg.bossProjectileSheet ? RPG.images[cfg.bossProjectileSheet] : null;
  const slashAtlas = cfg.bossProjectileAtlas ? RPG.atlases[cfg.bossProjectileAtlas] : null;
  RPG.enemyProjectiles.forEach(pr => {
    // Proyectil que ya impactó y está explotando (ver rpgUpdateEnemyProjectiles
    // / rpgFireBossBolt): se queda quieto ciclando explodeFrames en el
    // punto de impacto, sin importar de qué 'kind' venía.
    if (pr.exploding) {
      const eImg = RPG.images[pr.explodeSheet || pr.sheet];
      const eAtlas = RPG.atlases[pr.explodeAtlas || pr.atlas];
      const frameName = pr.explodeFrames[pr.explodeFrameIdx || 0];
      if (eImg && eAtlas && eAtlas.frames[frameName]) {
        rpgDrawAtlasFrame(ctx, eImg, eAtlas, frameName, pr.x, pr.y, 26, false, true);
      }
      return;
    }
    if (pr.kind === 'arrow') {
      const img = RPG.images[pr.sheet];
      const atlas = RPG.atlases[pr.atlas];
      const f = atlas && atlas.frames[pr.frameFly];
      if (img && f) {
        const angle = Math.atan2(pr.vy, pr.vx);
        const targetH = pr.drawH || 8; // antes 12 — flecha más chica visualmente, acorde al hitbox reducido (pr.drawH: override por proyectil, ver rpgFireBossBolt)
        const dw = targetH * (f.w / f.h);
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(angle);
        ctx.drawImage(img, f.x, f.y, f.w, f.h, -dw / 2, -targetH / 2, dw, targetH);
        ctx.restore();
      } else if (itemImg) {
        rpgDrawIconRect(ctx, itemImg, RPG_ITEM_ICONS.projSmall, pr.x, pr.y, 16, { centered: true });
      }
      return;
    }
    // kind 'slash' (proyectil a distancia del jefe)
    if (slashImg && slashAtlas) {
      const frameName = (pr.size === 'small' ? 'slash_small_' : 'slash_large_') + pr.animFrame;
      const targetH = pr.size === 'small' ? 20 : 32;
      rpgDrawAtlasFrame(ctx, slashImg, slashAtlas, frameName, pr.x, pr.y, targetH, pr.dir === -1, true);
    } else if (itemImg) {
      const rect = pr.size === 'small' ? RPG_ITEM_ICONS.projSmall : RPG_ITEM_ICONS.projBig;
      const targetH = pr.size === 'small' ? 20 : 32;
      rpgDrawIconRect(ctx, itemImg, rect, pr.x, pr.y, targetH, { centered: true });
    }
  });

  // --- INDICADORES DE HABITACIÓN LIMPIA ---
  if (RPG.roomCleared && !RPG.transitioning) {
    const bounce = Math.sin(performance.now() / 150) * 5;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;

    if (chest && !chest.opened) {
      // Indicador sobre el cofre
      const textY = chest.y - RPG_CHEST_DRAW_H - 25 + bounce;
      ctx.strokeText('¡ABRE EL COFRE!', chest.x, textY);
      ctx.fillText('¡ABRE EL COFRE!', chest.x, textY);

      // Pequeña flecha apuntando hacia abajo
      ctx.beginPath();
      ctx.moveTo(chest.x - 5, textY + 5);
      ctx.lineTo(chest.x + 5, textY + 5);
      ctx.lineTo(chest.x, textY + 12);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }
    ctx.restore();
  }

  // --- DEBUG: zona de movimiento poligonal (ver RPG_DEBUG_SHOW_ZONE en
  // rpg_config.js y rpgActiveZonePolygon en rpg_enemies_data.js) — dibuja
  // los bordes reales por los que Junior queda encerrado, superpuestos al
  // fondo, para calibrar a ojo las coordenadas de una sala nueva. Se
  // recalcula cada frame en rpgUpdate (RPG.debugZone) y acá solo se
  // dibuja; no tiene ningún efecto sobre la colisión en sí.
  if (RPG_DEBUG_SHOW_ZONE && RPG.debugZone && RPG.debugZone.length) {
    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(34, 211, 238, 0.12)';
    ctx.beginPath();
    ctx.moveTo(RPG.debugZone[0].x, RPG.debugZone[0].y);
    for (let i = 1; i < RPG.debugZone.length; i++) {
      ctx.lineTo(RPG.debugZone[i].x, RPG.debugZone[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Vértices marcados con un punto, para ver dónde está cada esquina.
    ctx.fillStyle = '#22d3ee';
    RPG.debugZone.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  ctx.restore(); // cierra el scale(roomZoom) + translate(-camera.x, -camera.y) de arriba

  // --- INDICADOR 'AVANZAR' EN ESPACIO DE PANTALLA ---
  if (RPG.roomCleared && (!chest || chest.opened) && !RPG.transitioning) {
    const bounce = Math.sin(performance.now() / 150) * 5;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;

    // Indicador en la puerta derecha (borde derecho de la pantalla)
    const cx = ctx.canvas.width - 50 + bounce;
    const cy = ctx.canvas.height / 2;
    ctx.strokeText('AVANZAR', cx, cy);
    ctx.fillText('AVANZAR', cx, cy);

    // Flecha apuntando a la derecha
    ctx.beginPath();
    ctx.moveTo(cx + 35, cy - 10);
    ctx.lineTo(cx + 45, cy - 4);
    ctx.lineTo(cx + 35, cy + 2);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    ctx.restore();
  }

  // (La recompensa de cofre ahora se muestra en el cartel HTML — ver
  // rpgShowChestRewardPanel — así que ya no hay nada que dibujar acá.)

  // Cartel de horda (ver rpgSpawnNextWave/rpgUpdate) — texto grande al
  // centro, en coordenadas de pantalla (fuera del save/restore de cámara
  // de arriba, como el joystick). Fade rápido de entrada, se sostiene, y
  // fade de salida hacia el final de RPG.banner.durationMs.
  if (RPG.banner) {
    const t = RPG.banner.timer / RPG.banner.durationMs; // 1 → 0
    const fadeIn = Math.min(1, (1 - t) / 0.15);
    const fadeOut = Math.min(1, t / 0.25);
    const alpha = Math.min(fadeIn, fadeOut);
    const cy = RPG_LOGICAL_H * 0.38;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(10,0,20,0.9)';
    ctx.strokeText(RPG.banner.text, RPG_LOGICAL_W / 2, cy);
    ctx.fillStyle = '#a78bfa'; // violeta espectral, a tono con ghost/dk_ghost
    ctx.fillText(RPG.banner.text, RPG_LOGICAL_W / 2, cy);
    ctx.restore();
  }

  // Joystick + botones táctiles: SIEMPRE al final y fuera del save/restore
  // de la cámara — van fijos en coordenadas de canvas, como overlay encima
  // de todo (ver rpgSetupTouchControls).
  if (RPG.touch && RPG.running) RPG.touch.draw(ctx);
}

// Dibuja un frame de spritesheet anclado en (x, y) = punto de los pies,
// escalado a una altura fija `targetH` manteniendo el aspect ratio de la
// celda (los anchos de celda varían entre filas, así que si se estirara
// todo al mismo cuadro el personaje se vería deformado).
export function rpgDrawFrame(ctx, img, rowData, frameIndex, x, y, targetH, flip) {
  const sx = frameIndex * rowData.cellWidth;
  const sy = rowData.y;
  const sw = rowData.cellWidth;
  const sh = rowData.cellHeight;
  const dh = targetH;
  const dw = dh * (sw / sh);
  rpgBlit(ctx, img, sx, sy, sw, sh, x, y, -dw / 2, -dh, dw, dh, flip);
}

// PERF: los helpers hacían save()/restore() por sprite (copia TODO el
// estado del contexto). Sin flip se dibuja directo; con flip se aplica y
// se deshace la transformación a mano — mismo resultado, bastante más
// barato.
function rpgBlit(ctx, img, sx, sy, sw, sh, x, y, ox, oy, dw, dh, flip) {
  if (!flip) {
    ctx.drawImage(img, sx, sy, sw, sh, x + ox, y + oy, dw, dh);
    return;
  }
  ctx.translate(x, y);
  ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, sw, sh, ox, oy, dw, dh);
  ctx.scale(-1, 1);
  ctx.translate(-x, -y);
}

// Calcula (y cachea) la escala fija px-del-sheet → px-del-juego de una
// especie, contra un frame de referencia (el idle) en vez de recalcularla
// por cada frame dibujado. Los atlas de kn_warror/kn_archer/dark_knight
// tienen cada pose recortada a mano con proporciones bien distintas entre
// sí (ej: el frame final de "muerto" tirado en el piso es mucho más ancho
// y bajo que el de pie/caminando) — si cada frame se escalara a la MISMA
// altura objetivo (como hacía rpgDrawAtlasFrame), esas poses "achatadas"
// terminan dibujándose gigantes de ancho. Con una escala fija, cada pose
// queda en su tamaño real relativo al personaje, sin inflarse.
export function rpgSpeciesScale(speciesKey, species, atlas) {
  if (RPG.speciesScale[speciesKey] != null) return RPG.speciesScale[speciesKey];
  const refName = species.scaleRefFrame
    || (species.poses && species.poses.idle)
    || (species.anims && species.anims.idle && species.anims.idle[0]);
  const ref = refName && atlas.frames[refName];
  const scale = (ref && ref.h) ? (species.drawH / ref.h) : 1;
  RPG.speciesScale[speciesKey] = scale;
  return scale;
}

// Igual que rpgDrawAtlasFrame, pero con una escala FIJA en vez de una
// altura objetivo por frame (ver rpgSpeciesScale). Se usa para personajes;
// rpgDrawAtlasFrame se deja intacta para el proyectil dark_slash, cuyas
// variantes sí comparten la misma proporción entre sí.
export function rpgDrawAtlasFrameScaled(ctx, img, atlas, frameName, x, y, scale, flip) {
  const f = atlas.frames[frameName];
  if (!f) return;
  const dw = f.w * scale;
  const dh = f.h * scale;
  rpgBlit(ctx, img, f.x, f.y, f.w, f.h, x, y, -dw / 2, -dh, dw, dh, flip);
}

// Dibuja un frame por NOMBRE desde un atlas JSON ({frameSize, frames:{nombre:{x,y,w,h}}}).
// Se usa para dark_knight, que tiene poses/efectos discretos en vez de un
// ciclo de caminata uniforme (ver rpgDrawFrame para ese caso).
export function rpgDrawAtlasFrame(ctx, img, atlas, frameName, x, y, targetH, flip, centered) {
  const f = atlas.frames[frameName];
  if (!f) return;
  const dh = targetH;
  const dw = dh * (f.w / f.h);
  rpgBlit(ctx, img, f.x, f.y, f.w, f.h, x, y, -dw / 2, centered ? -dh / 2 : -dh, dw, dh, flip);
}

// Dibuja un ícono recortado directamente por coordenadas (RPG_ITEM_ICONS),
// usado para balas / pociones / proyectiles que viven todos en objeto.webp.
// opts: { rotation, flip, centered, smooth }
// smooth=true fuerza suavizado (bilinear) SOLO para este dibujo puntual —
// útil para íconos chicos (cofre, power-up del cartel) cuyo sprite fuente
// es de resolución baja: sin esto, al escalarlos se ven en bloques mucho
// más marcados que Junior/enemigos (que sí tienen más detalle nativo y
// mantienen a propósito el estilo pixel-art sin smoothing). ctx.restore()
// ya deja el smoothing global (false) como estaba, no hace falta resetearlo.
export function rpgDrawIconRect(ctx, img, rect, x, y, targetH, opts) {
  opts = opts || {};
  const dh = targetH;
  const dw = dh * (rect.w / rect.h);
  if (!opts.smooth && !opts.rotation) {
    rpgBlit(ctx, img, rect.x, rect.y, rect.w, rect.h, x, y, -dw / 2, opts.centered ? -dh / 2 : -dh, dw, dh, !!opts.flip);
    return;
  }
  ctx.save();
  if (opts.smooth) ctx.imageSmoothingEnabled = true;
  ctx.translate(x, y);
  if (opts.rotation) ctx.rotate(opts.rotation);
  if (opts.flip) ctx.scale(-1, 1);
  if (opts.centered) {
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, -dw / 2, -dh, dw, dh);
  }
  ctx.restore();
}

// Dibuja `img` cubriendo todo el rect destino (equivalente a background-size: cover).
// anchorBottom: si hace falta recortar verticalmente (imagen relativamente
// menos panorámica que el rect destino), ancla el recorte al borde inferior
// de la imagen en vez de centrarlo — usado para los fondos de habitación
// (ver rpgDraw) para no perder filas de piso por abajo.
export function rpgDrawCover(ctx, img, dx, dy, dw, dh, anchorBottom) {
  const ir = img.width / img.height;
  const dr = dw / dh;
  let sx, sy, sw, sh;
  if (ir > dr) {
    sh = img.height;
    sw = sh * dr;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / dr;
    sx = 0;
    sy = anchorBottom ? (img.height - sh) : (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

// Fondo de habitación (ver rpgComputeRoomZoom para el zoom-out fijo que lo
// acompaña). A diferencia de rpgDrawCover, acá la escala SIEMPRE se calcula
// contra el canvas real (worldWidth x canvasHeight), sin recortar la
// fuente verticalmente — si el fondo es más alto que canvasHeight, se
// dibuja completo igual, con dy negativo (por encima del canvas). Eso es
// justo lo que rpgDraw necesita: aplica ctx.scale(roomZoom) + el
// camera.y fijo de la habitación, y ese sobrante entra en cuadro según
// cuánto zoom-out le tocó a esa habitación (0 = queda igual que hoy).
export function rpgDrawRoomBackground(ctx, img, worldWidth, canvasHeight, view) {
  const ir = img.width / img.height;
  const dr = worldWidth / canvasHeight;
  if (ir > dr) {
    // Recorte horizontal (igual que la rama equivalente de rpgDrawCover):
    // rpgComputeRoomZoom da zoom=1 en este caso porque ya se ve toda la
    // altura de la imagen, no hace falta zoom-out.
    const sh = img.height;
    const sw = sh * dr;
    const sx = (img.width - sw) / 2;
    rpgDrawImageInView(ctx, img, sx, 0, sw, sh, 0, 0, worldWidth, canvasHeight, view);
    return;
  }
  // Anclado abajo: se dibuja la imagen COMPLETA escalada a lo ancho del
  // mundo — la parte de arriba que sobra queda por encima del canvas (dy
  // negativo), y el zoom-out fijo de la habitación decide cuánto de eso
  // se termina viendo (ver rpgDraw / rpgComputeRoomZoom).
  const scale = worldWidth / img.width;
  const dh = img.height * scale;
  const dy = canvasHeight - dh; // ancla el borde inferior de la imagen al borde inferior del canvas
  rpgDrawImageInView(ctx, img, 0, 0, img.width, img.height, 0, dy, worldWidth, dh, view);
}

// drawImage(img, sx,sy,sw,sh, dx,dy,dw,dh) pero recortado a `view` (rect en
// las mismas coordenadas que el destino): calcula qué parte de la fuente
// cae adentro y dibuja solo eso. Sin view, dibuja todo como antes.
export function rpgDrawImageInView(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, view) {
  if (!view) { ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh); return; }
  const m = 2; // margen para que el borde no quede sin pintar por redondeo
  const x0 = Math.max(dx, view.x - m), y0 = Math.max(dy, view.y - m);
  const x1 = Math.min(dx + dw, view.x + view.w + m), y1 = Math.min(dy + dh, view.y + view.h + m);
  if (x1 <= x0 || y1 <= y0) return;
  const kx = sw / dw, ky = sh / dh; // px de fuente por px de destino
  ctx.drawImage(img,
    sx + (x0 - dx) * kx, sy + (y0 - dy) * ky, (x1 - x0) * kx, (y1 - y0) * ky,
    x0, y0, x1 - x0, y1 - y0);
}
