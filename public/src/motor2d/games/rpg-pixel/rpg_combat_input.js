import { RPG_CHEST_EXTRA_CHANCE, RPG_CHEST_FRAME_MS, RPG_CHEST_INTERACT_DIST, RPG_CHEST_REWARD_COUNT, RPG_DMG_UPGRADE_STEP, RPG_DOOR_ZONE_W, RPG_EL, RPG_JOYSTICK_DEADZONE, RPG_LOGICAL_H, RPG_LOGICAL_W, RPG_PLAYER_MAX_AMMO, RPG_PLAYER_MUZZLE_Y_OFF, RPG_PLAYER_RELOAD_MS, RPG_POWERUP_ICONS, RPG_POWERUP_SHEET } from './rpg_config.js';
import { rpgBuildUpgradesSummaryHtml, rpgCompleteChapter, rpgEnemyHit, rpgGameOver, rpgOverlap, rpgUpdateBoss, rpgUpdateEnemyProjectiles, rpgUpdateGhost, rpgUpdateHudAmmo, rpgUpdateHudBars, rpgUpdateHudTimer, rpgUpdateRangedChase, rpgUpdateSimpleChase } from './rpg_enemies_ai.js';
import { RPG, RPG_ENEMY_TYPES, RPG_POWERUP_DEFS, rpgFloorBounds, rpgRollPowerup, rpgRoomCfg } from './rpg_enemies_data.js';
import { rpgStartRoom, rpgStopLoop } from './rpg_menu_flow.js';
import { RPG_META } from './rpg_meta.js';
import { rpgDraw } from './rpg_render.js';
import { rpgAbandonRunIfActive, rpgOnMusicVolumeChange, rpgOnSfxVolumeChange, rpgPollTouchActions, rpgRenderAjustes, rpgShowMenu, rpgToggleFullscreen } from './rpg_save_ui.js';

export function rpgStartDialogue(lines, onDone) {
  rpgStopLoop();
  if (typeof Engine2D === 'undefined' || !Engine2D.DialogueBox) {
    // Motor de diálogo no disponible por algún motivo — no bloqueamos el juego.
    onDone();
    return;
  }
  if (!RPG.dialogue) {
    RPG.dialogue = new Engine2D.DialogueBox({
      x: 14, y: RPG_LOGICAL_H - 84, width: RPG_LOGICAL_W - 28, height: 74,
      portraitSize: 52, charsPerSecond: 42, font: '11px monospace', padding: 8
    });
  }
  RPG.inDialogue = true;
  RPG.dialogueOnDone = onDone;
  // Reset defensivo: si alguna tecla de movimiento/bloqueo quedó "pegada"
  // justo al entrar en diálogo (ej: se soltó fuera de foco de la ventana
  // y el keyup nunca llegó), que no arranque el combate con Junior trabado.
  RPG.keys.up = RPG.keys.down = RPG.keys.left = RPG.keys.right = false;
  RPG.player.blocking = false;
  RPG.dialogue.say(lines);
  rpgDialogueLastTs = 0;
  RPG.raf = requestAnimationFrame(rpgDialogueLoop);
}

export let rpgDialogueLastTs = 0;
export function rpgDialogueLoop(ts) {
  if (!RPG.inDialogue) return;
  const dt = rpgDialogueLastTs ? Math.min(ts - rpgDialogueLastTs, 50) : 16;
  rpgDialogueLastTs = ts;

  RPG.dialogue.update(dt);
  rpgDraw();                 // fondo + personajes en su pose actual (estático)
  RPG.dialogue.draw(RPG.ctx); // caja de texto + retrato encima de todo

  // Indicador "▼" parpadeante cuando la línea ya terminó de tipearse — en
  // mobile ahora se avanza tocando cualquier parte del canvas (ver
  // rpgSetupTouchControls), así que esto es la única pista visual de que
  // se puede tocar para seguir.
  if (RPG.dialogue.active && !RPG.dialogue.isTyping() && Math.floor(ts / 420) % 2 === 0) {
    const ctx = RPG.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('▼ toca para continuar', RPG_LOGICAL_W - 20, RPG_LOGICAL_H - 12);
    ctx.restore();
  }

  if (!RPG.dialogue.active) {
    RPG.inDialogue = false;
    rpgDialogueLastTs = 0;
    const done = RPG.dialogueOnDone;
    RPG.dialogueOnDone = null;
    if (done) done();
    return;
  }
  RPG.raf = requestAnimationFrame(rpgDialogueLoop);
}

// Avanza el diálogo (completa la línea si se está tipeando, o pasa a la
// siguiente). Se llama desde rpgInteract(), cableado a X / Enter y al
// botón táctil 💬.
export function rpgAdvanceDialogue() {
  if (RPG.dialogue) RPG.dialogue.advance();
}

// ─── Overlay genérico (empezar / pausa / resultado) ─────
export function rpgSetOverlay(title, sub, buttonsHtml) {
  RPG_EL.overlayTitle.textContent = title;
  RPG_EL.overlaySub.textContent = sub;
  RPG_EL.overlayButtons.innerHTML = buttonsHtml;
}

// ─── Pausa ─────
// Cartel de 2 columnas: a la izquierda 3 botones apilados (Continuar,
// Ajustes, Salir), a la derecha el resumen de lo juntado en el intento
// actual (ver rpgBuildUpgradesSummaryHtml). Reutiliza el overlay genérico
// pero arma el contenido a mano porque rpgSetOverlay solo maneja texto
// plano en la sub, no un layout de dos columnas.
export function rpgPauseGame() {
  if (!RPG.running) return;
  rpgStopLoop();
  rpgRenderPauseOverlay();
  RPG_EL.overlay.classList.remove('hidden');
}

export function rpgRenderPauseOverlay() {
  RPG_EL.overlayTitle.textContent = '⏸ Pausa';
  RPG_EL.overlaySub.innerHTML =
    '<div class="rpg-pause-layout">' +
      '<div class="rpg-pause-actions">' +
        '<button class="btn-play" onclick="rpgResumeGame()">▶ Continuar</button>' +
        '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgShowPauseSettings()">⚙ Ajustes</button>' +
        '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgQuitToMenuFromRoom()">✖ Salir</button>' +
      '</div>' +
      '<div class="rpg-pause-upgrades">' + rpgBuildUpgradesSummaryHtml() + '</div>' +
    '</div>';
  RPG_EL.overlayButtons.innerHTML = '';
}

// Vista "Ajustes" accedida desde dentro del cartel de pausa — mismos
// controles que el menú principal (rpgGoToAjustes/rpgRenderAjustes: los
// sliders de música/efectos y el botón de pantalla completa comparten el
// mismo estado global, así que da igual desde dónde se abran). Antes esto
// era un placeholder ("Próximamente") que nunca se actualizó cuando se
// armaron los ajustes de verdad — quedaba vacío. Volver reconstruye el
// cartel normal de pausa.
export function rpgShowPauseSettings() {
  RPG_EL.overlayTitle.textContent = '⚙ Ajustes';
  RPG_EL.overlaySub.innerHTML =
    '<div class="trampas-settings-content rpg-ajustes-content">' +
      '<div class="trampas-slider-row">' +
        '<label>🎵 Música</label>' +
        '<input type="range" class="rpg-music-volume-input" min="0" max="100" value="50" oninput="rpgOnMusicVolumeChange(this.value)">' +
        '<span class="trampas-slider-value rpg-music-volume-value">50%</span>' +
      '</div>' +
      '<div class="trampas-slider-row">' +
        '<label>🔊 Efectos</label>' +
        '<input type="range" class="rpg-sfx-volume-input" min="0" max="100" value="80" oninput="rpgOnSfxVolumeChange(this.value)">' +
        '<span class="trampas-slider-value rpg-sfx-volume-value">80%</span>' +
      '</div>' +
      '<div class="trampas-slider-row runner-fullscreen-row rpg-fullscreen-row">' +
        '<label>🖥️ Pantalla completa</label>' +
        '<button type="button" class="runner-fullscreen-btn rpg-fullscreen-btn" onclick="rpgToggleFullscreen()">Activar</button>' +
      '</div>' +
    '</div>';
  RPG_EL.overlayButtons.innerHTML =
    '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgRenderPauseOverlay()">← Volver</button>';
  // Clases, no ids (ver rpgRenderAjustes): puede haber otra copia de estos
  // mismos controles en el DOM al mismo tiempo (la del menú principal,
  // oculta detrás) — con ids duplicados, rpgRenderAjustes() terminaría
  // actualizando en silencio la copia equivocada.
  rpgRenderAjustes();
}

// Salir al menú "a mano" estando dentro de una habitación (desde la
// pausa): cuenta como abandonar el intento, igual que perder.
export function rpgQuitToMenuFromRoom() {
  rpgAbandonRunIfActive();
  rpgShowMenu();
}

export function rpgResumeGame() {
  RPG_EL.overlay.classList.add('hidden');
  RPG.running = true;
  RPG.raf = requestAnimationFrame(rpgLoop);
}

// ─── Entradas: teclado ─────
export function setupRpgEvents() {
  if (RPG.keyHandlerDown) document.removeEventListener('keydown', RPG.keyHandlerDown);
  if (RPG.keyHandlerUp)   document.removeEventListener('keyup', RPG.keyHandlerUp);

  RPG.keyHandlerDown = function(e) {
    if (!RPG_EL.section.classList.contains('active')) return;

    if (e.code === 'ArrowUp' || e.code === 'KeyW')    RPG.keys.up = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS')  RPG.keys.down = true;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA')  RPG.keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') RPG.keys.right = true;
    rpgUpdateFacing();
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyX','Enter','NumpadEnter'].includes(e.code)) e.preventDefault();
    if (e.code === 'Space') rpgFire();
    if (e.code === 'KeyX' || e.code === 'Enter' || e.code === 'NumpadEnter') rpgInteract();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') RPG.keys.block = true;

    // ── DEV/TESTING TEMPORAL: tecla P = matar a todos los enemigos vivos
    // de la sala actual, para llegar rápido a salas/capítulos más
    // adelantados sin jugar todo el combate cada vez. Pasa por
    // rpgEnemyHit (no toca e.alive a mano), así respeta todo el flujo real
    // — animación de muerte, disparo de la oleada siguiente si la sala
    // tiene `waves`, cofre de recompensa, cinemática de jefe si
    // corresponde, etc. Si la sala tiene 2 oleadas, con 1 sola tecla P
    // solo se limpia la que está en pantalla en ese momento (la oleada 2
    // recién aparece después) — apretar P de nuevo la limpia a ella
    // también.
    // TODO: sacar este bloque (y el 'if' de arriba) cuando ya no haga
    // falta para testear.
    if (e.code === 'KeyP' && RPG.running) {
      RPG.enemies.filter(en => en.alive).forEach(en => rpgEnemyHit(en, en.hp || 9999));
    }
  };
  RPG.keyHandlerUp = function(e) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW')    RPG.keys.up = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS')  RPG.keys.down = false;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA')  RPG.keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') RPG.keys.right = false;
    rpgUpdateFacing();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') RPG.keys.block = false;
  };
  document.addEventListener('keydown', RPG.keyHandlerDown);
  document.addEventListener('keyup', RPG.keyHandlerUp);
}

// Recalcula RPG.facing según qué teclas de movimiento siguen apretadas en
// este instante (se llama en keydown Y en keyup — antes solo se pisaba el
// facing con la última tecla presionada y nunca se recalculaba al soltar,
// por eso quedaba "pegado" mirando arriba/abajo). Izquierda/derecha pisan
// a arriba/abajo cuando se combinan (ej: mantener Arriba y tocar Izquierda
// muestra el sprite de izquierda, no el de arriba). Si no queda ninguna
// tecla de movimiento apretada, se mantiene la última dirección mostrada.
export function rpgUpdateFacing() {
  if (RPG.keys.left) { RPG.facing = 'left'; return; }
  if (RPG.keys.right) { RPG.facing = 'right'; return; }
  if (RPG.keys.up) { RPG.facing = 'up'; return; }
  if (RPG.keys.down) { RPG.facing = 'down'; return; }
}

// ─── Entradas: controles táctiles (llamados desde index.html) ─────
export function rpgMove(dir, on) {
  RPG.keys[dir] = on;
  rpgUpdateFacing();
}

export function rpgBlock(on) {
  if (RPG.inDialogue) return; // no bloquear mientras hay una cinemática activa
  const p = RPG.player;
  // Mientras el bloqueo está en cooldown (después de absorber un golpe)
  // no se puede volver a activar, aunque se mantenga apretado el botón.
  if (on && p.blockCooldown > 0) return;
  p.blocking = on;
}

export function rpgFire() {
  // Espacio también avanza el diálogo (por si el jugador viene de la
  // costumbre de "disparar para pasar" de antes de separar los botones) —
  // el input canónico para avanzar sigue siendo Interactuar (X/Enter/💬).
  if (RPG.inDialogue) { rpgAdvanceDialogue(); return; }
  if (!RPG.running) return;
  if (RPG.player.fireCooldown > 0) return;
  if (RPG.player.blocking) return; // no se dispara mientras se bloquea
  if (RPG.player.reloading) return; // sin balas — hay que esperar a que termine la recarga

  const dir = RPG_DIR_VECTOR[RPG.facing];
  const speed = 4.6;
  const burning = RPG.upgrades.burning; // esfera azul: balas celestes que queman (ver rpgApplyPowerup)
  const muzzleX = RPG.player.x;
  const muzzleY = RPG.player.y + RPG_PLAYER_MUZZLE_Y_OFF;
  const makeBullet = (ox, oy) => ({
    x: muzzleX + ox,
    y: muzzleY + oy,
    vx: dir.x * speed,
    vy: dir.y * speed,
    w: 6, h: 6,
    burning
  });
  if (RPG.upgrades.doubleShot) {
    // Pistola: dos balas paralelas, separadas perpendicularmente a la
    // dirección de disparo (no una detrás de otra).
    const perpX = -dir.y * 4, perpY = dir.x * 4;
    RPG.bullets.push(makeBullet(-perpX, -perpY));
    RPG.bullets.push(makeBullet(perpX, perpY));
  } else {
    RPG.bullets.push(makeBullet(0, 0));
  }
  RPG.player.fireCooldown = 260; // ms entre disparos
  RPG.player.ammo--;
  if (RPG.player.ammo <= 0) {
    RPG.player.ammo = 0;
    RPG.player.reloading = true;
    RPG.player.reloadTimer = RPG_PLAYER_RELOAD_MS;
  }
  rpgUpdateHudAmmo();
}

// Botón/tecla de Interactuar (X, Enter, o el botón táctil 💬). Por ahora
// solo avanza el diálogo (completa la línea si se está tipeando, o pasa a
// la siguiente) — es el lugar donde en el futuro se puede colgar hablar
// con NPCs, abrir cofres, etc. sin pisar el disparo.
export function rpgInteract() {
  if (RPG.inDialogue) { rpgAdvanceDialogue(); return; }
  if (!RPG.running) return;
  const c = RPG.chest;
  if (c && !c.opening && !c.opened) {
    const p = RPG.player;
    if (Math.hypot(p.x - c.x, p.y - c.y) <= RPG_CHEST_INTERACT_DIST) {
      c.opening = true;
      c.animTick = 0;
    }
  }
}

// Recompensa: cofre de plata (iron) u oro dan siempre RPG_CHEST_REWARD_COUNT
// ítems (se puede repetir el mismo más de una vez, tal cual la tabla de
// pesos de rpgBuildChestWeights). Se aplican todos los efectos al instante
// (ver RPG_POWERUP_DEFS) y recién después se muestra el cartel con lo
// que salió — ver rpgShowChestRewardPanel.
export function rpgApplyPowerup(chestType) {
  const items = [];
  for (let i = 0; i < RPG_CHEST_REWARD_COUNT; i++) {
    const key = rpgRollPowerup(chestType);
    const def = RPG_POWERUP_DEFS[key];
    if (!def) continue;
    const dynamicLabel = def.apply();
    items.push({ key, label: dynamicLabel || def.label });
  }
  // Mejora permanente "Suerte del cofre": chance de un ítem extra, por
  // fuera de los RPG_CHEST_REWARD_COUNT normales.
  if (RPG_META.extraChestChance && Math.random() < RPG_CHEST_EXTRA_CHANCE) {
    const extraKey = rpgRollPowerup(chestType);
    const extraDef = RPG_POWERUP_DEFS[extraKey];
    if (extraDef) {
      const extraLabel = extraDef.apply();
      items.push({ key: extraKey, label: '🍀 Extra · ' + (extraLabel || extraDef.label) });
    }
  }
  rpgUpdateHudBars();
  rpgUpdateHudAmmo();
  rpgShowChestRewardPanel(chestType, items);
}

// Recorta `rect` (RPG_POWERUP_ICONS) de `img` a un <canvas> chico y
// devuelve un data URL — permite meter el ícono real del power-up dentro
// de un <img> del cartel HTML sin tener que armar background-position a
// mano por cada ítem (mismo recorte que usa rpgDrawIconRect para canvas).
export function rpgIconToDataUrl(img, rect, targetH) {
  const dw = Math.max(1, Math.round(targetH * (rect.w / rect.h)));
  const c = document.createElement('canvas');
  c.width = dw;
  c.height = targetH;
  const cctx = c.getContext('2d');
  cctx.imageSmoothingEnabled = true;
  cctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, dw, targetH);
  return c.toDataURL();
}

// ─── Cartel de recompensa de cofre ─────
// Pausa el juego (mismo mecanismo que rpgPauseGame) y reutiliza el
// overlay genérico (#rpgOverlay) para mostrar los RPG_CHEST_REWARD_COUNT
// ítems que salieron, cada uno con su ícono real y una línea de qué hace.
// Se retoma recién al tocar "Recoger".
export function rpgShowChestRewardPanel(chestType, items) {
  rpgStopLoop();
  const img = RPG.images[RPG_POWERUP_SHEET];
  const rowsHtml = items.map(function (it) {
    const rect = RPG_POWERUP_ICONS[it.key];
    const iconHtml = (img && rect)
      ? '<img class="rpg-reward-icon" src="' + rpgIconToDataUrl(img, rect, 40) + '" alt="">'
      : '';
    return '<div class="rpg-reward-row">' + iconHtml +
      '<span class="rpg-reward-label">' + (it.label || '') + '</span></div>';
  }).join('');

  RPG_EL.overlayTitle.textContent =
    chestType === 'gold' ? '✨ ¡Cofre de oro!' : '📦 ¡Cofre de plata!';
  RPG_EL.overlaySub.innerHTML =
    '<div class="rpg-reward-list">' + rowsHtml + '</div>';
  RPG_EL.overlayButtons.innerHTML =
    '<button class="btn-play" onclick="rpgCollectChestReward()">Recoger</button>';
  RPG_EL.overlay.classList.remove('hidden');
}

export function rpgCollectChestReward() {
  RPG_EL.overlay.classList.add('hidden');
  if (RPG.chestIsBossReward) {
    RPG.chestIsBossReward = false;
    rpgCompleteChapter();
    return;
  }
  RPG.running = true;
  RPG.raf = requestAnimationFrame(rpgLoop);
}

export const RPG_DIR_VECTOR = {
  up:    { x: 0, y: -1 },
  down:  { x: 0, y: 1 },
  left:  { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

// ─── Update ─────
export let rpgLastTs = 0;
export function rpgLoop(ts) {
  if (!RPG.running) return;
  const dt = rpgLastTs ? Math.min(ts - rpgLastTs, 50) : 16;
  rpgLastTs = ts;
  rpgUpdate(dt);
  rpgDraw();
  RPG.raf = requestAnimationFrame(rpgLoop);
}

export function rpgUpdate(dt) {
  const C = RPG.canvas;
  const cfg = rpgRoomCfg();
  const p = RPG.player;
  const step = dt / 16.6; // normaliza a "frames" de 60fps para no depender del refresh rate

  // ── Cartel de horda en pantalla (ver rpgSpawnNextWave / rpgDraw) ──
  if (RPG.banner) {
    RPG.banner.timer -= dt;
    if (RPG.banner.timer <= 0) RPG.banner = null;
  }

  // ── Reloj del combate (si la habitación tiene límite de tiempo) ──
  const anyEnemyAlive = RPG.enemies.some(e => e.alive);
  if (RPG.timeLimitMs != null && anyEnemyAlive) {
    RPG.combatElapsed += dt;
    rpgUpdateHudTimer();
    if (RPG.combatElapsed >= RPG.timeLimitMs) {
      rpgGameOver(
        '⏱ Se acabó el tiempo',
        (cfg.enemyName || 'El enemigo') + ' resistió hasta el final de la canción.'
      );
      return;
    }
  }

  // ── Movimiento del jugador ──
  if (p.speedBoostTimer > 0) p.speedBoostTimer -= dt;
  const speedMult = p.speedBoostTimer > 0 ? (cfg.potionSpeedMult || 1.6) : 1;

  const isBlocking = RPG.keys.block || (RPG.touch && RPG.touch.state && !!RPG.touch.state.block);
  rpgBlock(isBlocking);

  let dx = 0, dy = 0;
  if (RPG.keys.up) dy -= 1;
  if (RPG.keys.down) dy += 1;
  if (RPG.keys.left) dx -= 1;
  if (RPG.keys.right) dx += 1;

  // Joystick táctil (RPG.touch, ver rpgSetupTouchControls) — analógico,
  // dibujado dentro del canvas. Se suma al vector de teclado; si las dos
  // fuentes están activas a la vez (poco común) simplemente se combinan.
  if (RPG.touch) {
    const stick = RPG.touch.state.move;
    if (stick && Math.hypot(stick.x, stick.y) > RPG_JOYSTICK_DEADZONE) {
      dx += stick.x;
      dy += stick.y;
    }
    rpgPollTouchActions();
  }

  if (dx !== 0 || dy !== 0) {
    // Misma prioridad que rpgUpdateFacing (izq/der pisan a arriba/abajo):
    // se recalcula cada frame acá para que el joystick (que no dispara
    // eventos keydown/keyup) también actualice el sprite que mira Junior.
    if (dx < 0) RPG.facing = 'left';
    else if (dx > 0) RPG.facing = 'right';
    else if (dy < 0) RPG.facing = 'up';
    else if (dy > 0) RPG.facing = 'down';
  }

  p.moving = (dx !== 0 || dy !== 0) && !p.blocking;

  // Límites de la arena: solo se puede pisar la mitad de abajo (piso); la
  // mitad de arriba es cielo/fondo y queda fuera de la zona jugable. El
  // límite derecho es el del MUNDO de la habitación (no del canvas
  // visible): en habitaciones normales el mundo es más ancho. Mientras no
  // esté limpia, el tramo de "puerta" pegado al borde derecho es una pared
  // invisible; una vez limpia, se puede cruzar.
  const marginX = 16;
  const doorLocked = cfg.type === 'combat' && !RPG.roomCleared;
  const rightLimit = RPG.worldWidth - marginX - (doorLocked ? RPG_DOOR_ZONE_W : 0);

  if (p.moving) {
    const len = Math.hypot(dx, dy) || 1;
    const spd = p.blocking ? 0 : p.speed * speedMult * step;
    p.x += (dx / len) * spd;
    p.y += (dy / len) * spd;

    const floor = rpgFloorBounds(C);
    p.x = Math.max(marginX, Math.min(rightLimit, p.x));
    p.y = Math.max(floor.top, Math.min(floor.bottom, p.y));

    p.animTick += step;
    if (p.animTick >= 7) { p.animTick = 0; p.animFrame = (p.animFrame + 1) % 3; }
  } else {
    p.animFrame = 0;
    p.animTick = 0;
  }

  // ── Cámara: sigue a Junior en horizontal. Si el mundo es más ancho que
  // la ventana visible (que ahora depende del zoom: a más zoom-out, se ve
  // más mundo de una), nunca se ve la habitación entera de una — así hay
  // incertidumbre sobre qué enemigos hay más adelante. RPG.camera.y NO se
  // toca acá: queda fijo desde que arrancó la habitación (ver rpgStartRoom
  // / rpgComputeRoomZoom) y no depende de la posición de Junior. ──
  if (RPG.worldWidth > RPG_LOGICAL_W) {
    const visibleW = RPG_LOGICAL_W / RPG.roomZoom;
    const targetCamX = Math.max(0, Math.min(RPG.worldWidth - visibleW, p.x - visibleW / 2));
    RPG.camera.x += (targetCamX - RPG.camera.x) * 0.12;
  } else {
    RPG.camera.x = 0;
  }

  // ── Puerta de salida: habitación normal ya limpia + Junior llegó al
  // borde derecho del mundo → pasa a la siguiente habitación, sin cartel.
  if (cfg.type === 'combat' && RPG.roomCleared && p.x >= RPG.worldWidth - marginX - 2) {
    rpgStopLoop();
    rpgStartRoom(RPG.room + 1);
    return;
  }

  if (!p.blocking) {
    p.blockAnimFrame = 0;
    p.blockAnimTick = 0;
  }

  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (p.blockCooldown > 0) p.blockCooldown -= dt;
  if (p.hitFlash > 0) p.hitFlash -= dt;

  // ── Cofre: animación de apertura (4 frames) y aplicación de la
  // recompensa recién en el último frame, no al tocar Interactuar. ──
  if (RPG.chest && RPG.chest.opening && !RPG.chest.opened) {
    const c = RPG.chest;
    c.animTick += dt;
    if (c.animTick >= RPG_CHEST_FRAME_MS) {
      c.animTick -= RPG_CHEST_FRAME_MS;
      if (c.frame < 3) {
        c.frame++;
      } else {
        c.opened = true;
        c.opening = false;
        rpgApplyPowerup(c.type);
      }
    }
  }
  // ── Recarga automática (se dispara sola al gastar las 8 balas) ──
  if (p.reloading) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) {
      p.reloading = false;
      p.reloadTimer = 0;
      p.ammo = RPG_PLAYER_MAX_AMMO;
      rpgUpdateHudAmmo();
    }
  }

  // ── Balas de Junior ──
  for (let i = RPG.bullets.length - 1; i >= 0; i--) {
    const b = RPG.bullets[i];
    b.x += b.vx * step;
    b.y += b.vy * step;
    if (b.x < -20 || b.x > RPG.worldWidth + 20 || b.y < -20 || b.y > RPG_LOGICAL_H + 20) {
      RPG.bullets.splice(i, 1);
      continue;
    }
    // Contra el primer enemigo vivo que toque la bala (una bala solo
    // pega una vez, aunque haya varios enemigos superpuestos).
    let hitSomeone = false;
    for (let j = 0; j < RPG.enemies.length; j++) {
      const e2 = RPG.enemies[j];
      if (e2.alive && !e2.hidden && rpgOverlap(b.x, b.y, b.w, b.h, e2.x, e2.y - 40, 60, 80)) {
        rpgEnemyHit(e2, (cfg.playerBulletDamage || 5) + RPG.upgrades.dmgBonus + (RPG_META.dmgLevel * RPG_DMG_UPGRADE_STEP));
        // Munición celeste (esfera azul): además del impacto, deja quemando
        // 1 hp/seg durante 5s — se resetea el DOT si ya estaba ardiendo.
        if (b.burning && e2.alive) {
          e2.burnTicksLeft = 5;
          e2.burnTimer = 1000;
        }
        hitSomeone = true;
        break;
      }
    }
    if (hitSomeone) RPG.bullets.splice(i, 1);
  }

  // ── Proyectiles del jefe / flechas ──
  rpgUpdateEnemyProjectiles(dt, step);

  // ── Enemigos ──
  RPG.enemies.forEach(e => {
    if (!e.alive) {
      // Terminó de morir: deja avanzar la animación de muerte una sola vez
      // (sin loop) para que quede "el cuerpo" en el piso en el último frame.
      const species = RPG_ENEMY_TYPES[e.species];
      if (species && species.anims && e.animKind === 'death') {
        const frames = species.anims.death;
        e.animTick += step;
        if (e.animTick >= (species.animSpeed || 8) && e.animFrame < frames.length - 1) {
          e.animTick = 0;
          e.animFrame++;
        }
      }
      return;
    }
    // Quemadura (esfera azul): 1 hp de daño por segundo mientras dure,
    // independiente de la IA normal del enemigo — no interrumpe su ataque.
    if (e.burnTicksLeft > 0 && !e.hidden) {
      e.burnTimer -= dt;
      if (e.burnTimer <= 0) {
        e.burnTimer += 1000;
        e.burnTicksLeft--;
        rpgEnemyHit(e, 1);
        if (!e.alive) return;
      }
    }
    // Antes esto se decidía por cfg.attackPattern (a nivel de HABITACIÓN),
    // lo que estaba bien mientras el jefe era el único enemigo de su sala —
    // pero con la habilidad "invocar guerreros" (ver rpgSummonWarriors) un
    // kn_warror puede aparecer DENTRO de la sala del jefe y necesita su
    // propia IA de persecución, no el patrón del jefe. Por eso ahora se
    // decide por especie, entidad por entidad.
    const species = RPG_ENEMY_TYPES[e.species];
    if (species && species.behavior === 'boss') {
      rpgUpdateBoss(e, p, cfg, C, dt, step);
    } else if (species && species.behavior === 'ranged') {
      rpgUpdateRangedChase(e, p, species, dt, step);
    } else if (species && species.behavior === 'ghost') {
      rpgUpdateGhost(e, p, cfg, C, dt, step);
    } else {
      rpgUpdateSimpleChase(e, p, cfg, C, dt, step);
    }
  });
}

// Comportamiento base (kn_warror y cualquier especie 'melee'): perseguir al
// jugador y golpear SOLO cuando conecta el swing del ataque (no por simple
// contacto/cercanía). Al entrar en rango arranca el ciclo de animación
// 'attack' completo; el daño se aplica una única vez, en el frame de
// impacto (mitad del ciclo), y solo si Junior sigue en rango de golpe en
// ese instante — recién ahí se considera "atacar", no antes.
