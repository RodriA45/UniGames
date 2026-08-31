function rpgDraw() {
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
    rpgDrawRoomBackground(ctx, bg, RPG.worldWidth, RPG_LOGICAL_H);
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

    ctx.save();

    // Aviso visual de un ataque especial a punto de salir (telegraph):
    // círculo rojo pulsante mientras el jefe "carga" antes del dash o de
    // invocar guerreros.
    if (e.alive && (e.attack.state === 'dashTelegraph' || e.attack.state === 'summonTelegraph')) {
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
    else if (e.alive && e.attack.state === 'dashTelegraph') {
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
      let frameName = species.poses.idle;
      if (!e.alive) {
        frameName = species.poses['death' + (e.deathFrame || 1)] || species.poses.death2;
      } else if (e.attack.state === 'meleeWindup') {
        frameName = species.poses[RPG_BOSS_WINDUP_POSES[e.attack.poseFrame]];
      } else if (e.attack.state === 'meleeAttack') {
        frameName = species.poses[RPG_BOSS_ATTACK_POSES[e.attack.poseFrame]];
      } else if (e.attack.state === 'rangedWindup') {
        frameName = species.poses.windup1;
      } else if (e.attack.state === 'dashTelegraph') {
        frameName = species.poses.windup2;
      } else if (e.attack.state === 'dashing') {
        frameName = species.poses.dash2;
      } else if (e.attack.state === 'summonTelegraph') {
        frameName = species.poses.summon;
      }
      if (atlas && img) {
        const scale = rpgSpeciesScale(e.species, species, atlas);
        rpgDrawAtlasFrameScaled(ctx, img, atlas, frameName, e.x, e.y, scale, flip);
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
  if (p.blocking) {
    const sheet = SPRITES.bloquear;
    const img = RPG.images[RPG_ASSET_BASE + 'models/junior/bloquear.png'];
    // Las 4 columnas de bloquear.png son 4 poses direccionales fijas
    // (frente/atrás/izq/der, mismo orden que junior.png) — no cuadros de
    // una animación. Se elige por RPG.facing, no por un contador de tiempo.
    if (sheet && img) rpgDrawFrame(ctx, img, sheet.rows[0], RPG_FACING_ROW[RPG.facing], p.x, p.y, RPG_PLAYER_DRAW_H, false);
  } else {
    const sheet = SPRITES.junior;
    const img = RPG.images[RPG_ASSET_BASE + 'models/junior/junior.png'];
    if (sheet && img) {
      const rowIdx = RPG_FACING_ROW[RPG.facing];
      rpgDrawFrame(ctx, img, sheet.rows[rowIdx], p.animFrame, p.x, p.y, RPG_PLAYER_DRAW_H, false);
    }
  }
  // Aura sutil mientras dura el boost de velocidad de la poción naranja.
  if (p.speedBoostTimer > 0) {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -RPG_PLAYER_DRAW_H * 0.35, RPG_PLAYER_DRAW_H * 0.42, RPG_PLAYER_DRAW_H * 0.55, 0, 0, Math.PI * 2);
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
    if (pr.kind === 'arrow') {
      const img = RPG.images[pr.sheet];
      const atlas = RPG.atlases[pr.atlas];
      const f = atlas && atlas.frames[pr.frameFly];
      if (img && f) {
        const angle = Math.atan2(pr.vy, pr.vx);
        const targetH = 8; // antes 12 — flecha más chica visualmente, acorde al hitbox reducido
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

  ctx.restore(); // cierra el scale(roomZoom) + translate(-camera.x, -camera.y) de arriba

  // (La recompensa de cofre ahora se muestra en el cartel HTML — ver
  // rpgShowChestRewardPanel — así que ya no hay nada que dibujar acá.)

  // Joystick + botones táctiles: SIEMPRE al final y fuera del save/restore
  // de la cámara — van fijos en coordenadas de canvas, como overlay encima
  // de todo (ver rpgSetupTouchControls).
  if (RPG.touch && RPG.running) RPG.touch.draw(ctx);
}

// Dibuja un frame de spritesheet anclado en (x, y) = punto de los pies,
// escalado a una altura fija `targetH` manteniendo el aspect ratio de la
// celda (los anchos de celda varían entre filas, así que si se estirara
// todo al mismo cuadro el personaje se vería deformado).
function rpgDrawFrame(ctx, img, rowData, frameIndex, x, y, targetH, flip) {
  const sx = frameIndex * rowData.cellWidth;
  const sy = rowData.y;
  const sw = rowData.cellWidth;
  const sh = rowData.cellHeight;
  const dh = targetH;
  const dw = dh * (sw / sh);
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh, dw, dh);
  ctx.restore();
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
function rpgSpeciesScale(speciesKey, species, atlas) {
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
function rpgDrawAtlasFrameScaled(ctx, img, atlas, frameName, x, y, scale, flip) {
  const f = atlas.frames[frameName];
  if (!f) return;
  const dw = f.w * scale;
  const dh = f.h * scale;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, f.x, f.y, f.w, f.h, -dw / 2, -dh, dw, dh);
  ctx.restore();
}

// Dibuja un frame por NOMBRE desde un atlas JSON ({frameSize, frames:{nombre:{x,y,w,h}}}).
// Se usa para dark_knight, que tiene poses/efectos discretos en vez de un
// ciclo de caminata uniforme (ver rpgDrawFrame para ese caso).
function rpgDrawAtlasFrame(ctx, img, atlas, frameName, x, y, targetH, flip, centered) {
  const f = atlas.frames[frameName];
  if (!f) return;
  const dh = targetH;
  const dw = dh * (f.w / f.h);
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  if (centered) {
    ctx.drawImage(img, f.x, f.y, f.w, f.h, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.drawImage(img, f.x, f.y, f.w, f.h, -dw / 2, -dh, dw, dh);
  }
  ctx.restore();
}

// Dibuja un ícono recortado directamente por coordenadas (RPG_ITEM_ICONS),
// usado para balas / pociones / proyectiles que viven todos en objeto.png.
// opts: { rotation, flip, centered, smooth }
// smooth=true fuerza suavizado (bilinear) SOLO para este dibujo puntual —
// útil para íconos chicos (cofre, power-up del cartel) cuyo sprite fuente
// es de resolución baja: sin esto, al escalarlos se ven en bloques mucho
// más marcados que Junior/enemigos (que sí tienen más detalle nativo y
// mantienen a propósito el estilo pixel-art sin smoothing). ctx.restore()
// ya deja el smoothing global (false) como estaba, no hace falta resetearlo.
function rpgDrawIconRect(ctx, img, rect, x, y, targetH, opts) {
  opts = opts || {};
  const dh = targetH;
  const dw = dh * (rect.w / rect.h);
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
function rpgDrawCover(ctx, img, dx, dy, dw, dh, anchorBottom) {
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
function rpgDrawRoomBackground(ctx, img, worldWidth, canvasHeight) {
  const ir = img.width / img.height;
  const dr = worldWidth / canvasHeight;
  if (ir > dr) {
    // Recorte horizontal (igual que la rama equivalente de rpgDrawCover):
    // rpgComputeRoomZoom da zoom=1 en este caso porque ya se ve toda la
    // altura de la imagen, no hace falta zoom-out.
    const sh = img.height;
    const sw = sh * dr;
    const sx = (img.width - sw) / 2;
    ctx.drawImage(img, sx, 0, sw, sh, 0, 0, worldWidth, canvasHeight);
    return;
  }
  // Anclado abajo: se dibuja la imagen COMPLETA escalada a lo ancho del
  // mundo — la parte de arriba que sobra queda por encima del canvas (dy
  // negativo), y el zoom-out fijo de la habitación decide cuánto de eso
  // se termina viendo (ver rpgDraw / rpgComputeRoomZoom).
  const scale = worldWidth / img.width;
  const dh = img.height * scale;
  const dy = canvasHeight - dh; // ancla el borde inferior de la imagen al borde inferior del canvas
  ctx.drawImage(img, 0, 0, img.width, img.height, 0, dy, worldWidth, dh);
}
