// ══════════════════════════════════════
//   RPG Pixel — rpg_combat_input.js  (módulo ES6)
// ══════════════════════════════════════
// Clase RpgCombate: Loop de combate, diálogos, pausa, input, disparo, cofres y update por frame.
import { RpgModulo } from './rpg_modulo.js';
import { juego } from './rpg_juego.js';
import { RpgConfig } from './rpg_config.js';
import { RpgDatos } from './rpg_enemies_data.js';
export class RpgCombate extends RpgModulo {
  static DIR_VECTOR = {
    up: {
      x: 0,
      y: -1,
    },
    down: {
      x: 0,
      y: 1,
    },
    left: {
      x: -1,
      y: 0,
    },
    right: {
      x: 1,
      y: 0,
    },
  };
  constructor() {
    super();
    this.dialogueLastTs = 0;
    // ─── Update ─────
    this.lastTs = 0;
  }

  startDialogue(lines, onDone) {
    juego.partida.stopLoop();
    if (typeof Engine2D === 'undefined' || !Engine2D.DialogueBox) {
      // Motor de diálogo no disponible por algún motivo — no bloqueamos el juego.
      onDone();
      return;
    }
    if (!juego.dialogue) {
      juego.dialogue = new Engine2D.DialogueBox({
        x: 14,
        y: RpgConfig.LOGICAL_H - 84,
        width: RpgConfig.LOGICAL_W - 28,
        height: 74,
        portraitSize: 52,
        charsPerSecond: 42,
        font: '11px monospace',
        padding: 8,
      });
    }
    juego.inDialogue = true;
    juego.dialogueOnDone = onDone;
    // Reset defensivo: si alguna tecla de movimiento/bloqueo quedó "pegada"
    // justo al entrar en diálogo (ej: se soltó fuera de foco de la ventana
    // y el keyup nunca llegó), que no arranque el combate con Junior trabado.
    juego.keys.up = juego.keys.down = juego.keys.left = juego.keys.right = false;
    juego.keys.fire = false;
    juego.jugador.blocking = false;
    juego.dialogue.say(lines);
    this.dialogueLastTs = 0;
    juego.raf = requestAnimationFrame(this.dialogueLoop);
  }

  dialogueLoop(ts) {
    if (!juego.inDialogue) return;
    const dt = this.dialogueLastTs ? Math.min(ts - this.dialogueLastTs, 50) : 16;
    this.dialogueLastTs = ts;
    juego.dialogue.update(dt);
    juego.render.draw(); // fondo + personajes en su pose actual (estático)
    juego.dialogue.draw(juego.ctx); // caja de texto + retrato encima de todo

    // Indicador "▼" parpadeante cuando la línea ya terminó de tipearse — en
    // mobile ahora se avanza tocando cualquier parte del canvas (ver
    // rpgSetupTouchControls), así que esto es la única pista visual de que
    // se puede tocar para seguir.
    if (juego.dialogue.active && !juego.dialogue.isTyping() && Math.floor(ts / 420) % 2 === 0) {
      const ctx = juego.ctx;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('▼ toca para continuar', RpgConfig.LOGICAL_W - 20, RpgConfig.LOGICAL_H - 12);
      ctx.restore();
    }
    if (!juego.dialogue.active) {
      juego.inDialogue = false;
      this.dialogueLastTs = 0;
      const done = juego.dialogueOnDone;
      juego.dialogueOnDone = null;
      if (done) done();
      return;
    }
    juego.raf = requestAnimationFrame(this.dialogueLoop);
  }

  // Avanza el diálogo (completa la línea si se está tipeando, o pasa a la
  // siguiente). Se llama desde rpgInteract(), cableado a X / Enter y al
  // botón táctil 💬.
  advanceDialogue() {
    if (juego.dialogue) juego.dialogue.advance();
  }

  // ─── Overlay genérico (empezar / pausa / resultado) ─────
  setOverlay(title, sub, buttonsHtml) {
    RpgConfig.EL.overlayTitle.textContent = title;
    RpgConfig.EL.overlaySub.textContent = sub;
    RpgConfig.EL.overlayButtons.innerHTML = buttonsHtml;
  }

  // ─── Pausa ─────
  // Cartel de 2 columnas: a la izquierda 3 botones apilados (Continuar,
  // Ajustes, Salir), a la derecha el resumen de lo juntado en el intento
  // actual (ver rpgBuildUpgradesSummaryHtml). Reutiliza el overlay genérico
  // pero arma el contenido a mano porque rpgSetOverlay solo maneja texto
  // plano en la sub, no un layout de dos columnas.
  pauseGame() {
    if (!juego.running) return;
    juego.partida.stopLoop();
    this.renderPauseOverlay();
    RpgConfig.EL.overlay.classList.remove('hidden');
  }

  destroyPauseQualityRow() {
    if (juego.pauseQualityRow) {
      juego.pauseQualityRow.destroy();
      juego.pauseQualityRow = null;
    }
  }

  renderPauseOverlay() {
    this.destroyPauseQualityRow();
    RpgConfig.EL.overlayTitle.textContent = '⏸ Pausa';
    RpgConfig.EL.overlaySub.innerHTML =
      '<div class="rpg-pause-layout">' +
      '<div class="rpg-pause-actions">' +
      '<button class="btn-play" onclick="rpgResumeGame()">▶ Continuar</button>' +
      '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgShowPauseSettings()">⚙ Ajustes</button>' +
      '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgQuitToMenuFromRoom()">✖ Salir</button>' +
      '</div>' +
      '<div class="rpg-pause-upgrades">' +
      juego.enemigos.buildUpgradesSummaryHtml() +
      '</div>' +
      '</div>';
    RpgConfig.EL.overlayButtons.innerHTML = '';
  }

  // Vista "Ajustes" accedida desde dentro del cartel de pausa — mismos
  // controles que el menú principal (rpgGoToAjustes/rpgRenderAjustes: los
  // sliders de música/efectos y el botón de pantalla completa comparten el
  // mismo estado global, así que da igual desde dónde se abran). Antes esto
  // era un placeholder ("Próximamente") que nunca se actualizó cuando se
  // armaron los ajustes de verdad — quedaba vacío. Volver reconstruye el
  // cartel normal de pausa.
  showPauseSettings() {
    RpgConfig.EL.overlayTitle.textContent = 'Ajustes';
    RpgConfig.EL.overlaySub.innerHTML =
      '<div class="trampas-settings-content rpg-ajustes-content">' +
      '<div class="trampas-slider-row">' +
      '<label>Música</label>' +
      '<input type="range" class="rpg-music-volume-input" min="0" max="100" value="50" oninput="rpgOnMusicVolumeChange(this.value)">' +
      '<span class="trampas-slider-value rpg-music-volume-value">50%</span>' +
      '</div>' +
      '<div class="trampas-slider-row">' +
      '<label>Efectos</label>' +
      '<input type="range" class="rpg-sfx-volume-input" min="0" max="100" value="80" oninput="rpgOnSfxVolumeChange(this.value)">' +
      '<span class="trampas-slider-value rpg-sfx-volume-value">80%</span>' +
      '</div>' +
      '<div class="trampas-slider-row runner-fullscreen-row rpg-fullscreen-row">' +
      '<label>Pantalla completa</label>' +
      '<button type="button" class="runner-fullscreen-btn rpg-fullscreen-btn" onclick="rpgToggleFullscreen()">Activar</button>' +
      '</div>' +
      '<div class="rpg-pause-quality-slot"></div>' +
      '</div>';
    // Selector de calidad gráfica también en la pausa (se puede ajustar sin
    // salir de la partida; rpg_menu_flow.js ya redimensiona el canvas al
    // cambiar). Se destruye la fila anterior para no acumular listeners.
    this.destroyPauseQualityRow();
    const qSlot = RpgConfig.EL.overlaySub.querySelector('.rpg-pause-quality-slot');
    if (qSlot && typeof Engine2D !== 'undefined' && Engine2D.Quality) {
      juego.pauseQualityRow = Engine2D.Quality.createRow({
        label: 'Gráficos',
      });
      qSlot.appendChild(juego.pauseQualityRow);
    }
    RpgConfig.EL.overlayButtons.innerHTML =
      '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgRenderPauseOverlay()">← Volver</button>';
    // Clases, no ids (ver rpgRenderAjustes): puede haber otra copia de estos
    // mismos controles en el DOM al mismo tiempo (la del menú principal,
    // oculta detrás) — con ids duplicados, rpgRenderAjustes() terminaría
    // actualizando en silencio la copia equivocada.
    juego.menu.renderAjustes();
  }

  // Salir al menú "a mano" estando dentro de una habitación (desde la
  // pausa): cuenta como abandonar el intento, igual que perder.
  quitToMenuFromRoom() {
    juego.menu.abandonRunIfActive();
    juego.menu.showMenu();
  }

  resumeGame() {
    // Doble click en "Continuar": el segundo llega con el overlay ya oculto.
    if (RpgConfig.EL.overlay.classList.contains('hidden')) return;
    RpgConfig.EL.overlay.classList.add('hidden');
    this.startLoop();
  }

  // ─── Entradas: teclado ─────
  setupEvents() {
    if (juego.keyHandlerDown) document.removeEventListener('keydown', juego.keyHandlerDown);
    if (juego.keyHandlerUp) document.removeEventListener('keyup', juego.keyHandlerUp);
    juego.keyHandlerDown = function (e) {
      if (!RpgConfig.EL.section.classList.contains('active')) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') juego.keys.up = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') juego.keys.down = true;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') juego.keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') juego.keys.right = true;
      juego.combate.updateFacing();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyX', 'Enter', 'NumpadEnter'].includes(e.code))
        e.preventDefault();
      // Espacio: dispara al apretar y, mientras se mantenga, rpgUpdate sigue
      // disparando al ritmo del cooldown (RPG.keys.fire). Los keydown de
      // auto-repetición del sistema se ignoran: el ritmo lo pone el juego,
      // no la configuración de teclado de cada PC.
      if (e.code === 'Space') {
        if (!e.repeat) juego.combate.fire();
        if (!juego.inDialogue) juego.keys.fire = true;
      }
      if (e.code === 'KeyX' || e.code === 'Enter' || e.code === 'NumpadEnter') juego.combate.interact();
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') juego.keys.block = true;
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
      if (e.code === 'KeyP' && juego.running) {
        juego.enemies.filter((en) => en.alive).forEach((en) => juego.enemigos.enemyHit(en, en.hp || 9999));
      }
    };
    juego.keyHandlerUp = function (e) {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') juego.keys.up = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') juego.keys.down = false;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') juego.keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') juego.keys.right = false;
      juego.combate.updateFacing();
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') juego.keys.block = false;
      if (e.code === 'Space') juego.keys.fire = false;
    };
    document.addEventListener('keydown', juego.keyHandlerDown);
    document.addEventListener('keyup', juego.keyHandlerUp);
    // Si la ventana pierde el foco con una tecla apretada, el keyup nunca
    // llega: sin esto Junior seguiría caminando/disparando solo.
    if (!juego.blurHandler) {
      juego.blurHandler = function () {
        const k = juego.keys;
        k.up = k.down = k.left = k.right = k.block = k.fire = false;
      };
      window.addEventListener('blur', juego.blurHandler);
    }
  }

  // Recalcula RPG.facing según qué teclas de movimiento siguen apretadas en
  // este instante (se llama en keydown Y en keyup — antes solo se pisaba el
  // facing con la última tecla presionada y nunca se recalculaba al soltar,
  // por eso quedaba "pegado" mirando arriba/abajo). Izquierda/derecha pisan
  // a arriba/abajo cuando se combinan (ej: mantener Arriba y tocar Izquierda
  // muestra el sprite de izquierda, no el de arriba). Si no queda ninguna
  // tecla de movimiento apretada, se mantiene la última dirección mostrada.
  updateFacing() {
    if (juego.keys.left) {
      juego.facing = 'left';
      return;
    }
    if (juego.keys.right) {
      juego.facing = 'right';
      return;
    }
    if (juego.keys.up) {
      juego.facing = 'up';
      return;
    }
    if (juego.keys.down) {
      juego.facing = 'down';
      return;
    }
  }

  // ─── Entradas: controles táctiles (llamados desde index.html) ─────
  move(dir, on) {
    juego.keys[dir] = on;
    this.updateFacing();
  }

  block(on) {
    if (juego.inDialogue) return; // no bloquear mientras hay una cinemática activa
    const p = juego.jugador;
    // Mientras el bloqueo está en cooldown (después de absorber un golpe)
    // no se puede volver a activar, aunque se mantenga apretado el botón.
    if (on && p.blockCooldown > 0) return;
    p.blocking = on;
  }

  fire() {
    // Espacio también avanza el diálogo (por si el jugador viene de la
    // costumbre de "disparar para pasar" de antes de separar los botones) —
    // el input canónico para avanzar sigue siendo Interactuar (X/Enter/💬).
    if (juego.inDialogue) {
      this.advanceDialogue();
      return;
    }
    if (!juego.running) return;
    if (juego.jugador.fireCooldown > 0) return;
    if (juego.jugador.blocking) return; // no se dispara mientras se bloquea
    if (juego.jugador.reloading) return; // sin balas — hay que esperar a que termine la recarga

    const dir = RpgCombate.DIR_VECTOR[juego.facing];
    const speed = 4.6;
    const burning = juego.upgrades.burning; // esfera azul: balas celestes que queman (ver rpgApplyPowerup)
    const muzzleX = juego.jugador.x;
    const muzzleY = juego.jugador.y + RpgConfig.PLAYER_MUZZLE_Y_OFF;
    const makeBullet = (ox, oy) => ({
      x: muzzleX + ox,
      y: muzzleY + oy,
      vx: dir.x * speed,
      vy: dir.y * speed,
      w: 6,
      h: 6,
      burning,
    });
    if (juego.upgrades.doubleShot) {
      // Pistola: dos balas paralelas, separadas perpendicularmente a la
      // dirección de disparo (no una detrás de otra).
      const perpX = -dir.y * 4,
        perpY = dir.x * 4;
      juego.bullets.push(makeBullet(-perpX, -perpY));
      juego.bullets.push(makeBullet(perpX, perpY));
    } else {
      juego.bullets.push(makeBullet(0, 0));
    }
    juego.jugador.fireCooldown = 260; // ms entre disparos
    juego.jugador.ammo--;
    if (juego.jugador.ammo <= 0) {
      juego.jugador.ammo = 0;
      juego.jugador.reloading = true;
      juego.jugador.reloadTimer = RpgConfig.PLAYER_RELOAD_MS;
    }
    juego.enemigos.updateHudAmmo();
  }

  // Botón/tecla de Interactuar (X, Enter, o el botón táctil 💬). Por ahora
  // solo avanza el diálogo (completa la línea si se está tipeando, o pasa a
  // la siguiente) — es el lugar donde en el futuro se puede colgar hablar
  // con NPCs, abrir cofres, etc. sin pisar el disparo.
  interact() {
    if (juego.inDialogue) {
      this.advanceDialogue();
      return;
    }
    if (!juego.running) return;
    const c = juego.chest;
    if (c && !c.opening && !c.opened) {
      const p = juego.jugador;
      if (Math.hypot(p.x - c.x, p.y - c.y) <= RpgConfig.CHEST_INTERACT_DIST) {
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
  applyPowerup(chestType) {
    const items = [];
    for (let i = 0; i < RpgConfig.CHEST_REWARD_COUNT; i++) {
      const key = juego.datos.rollPowerup(chestType);
      const def = RpgDatos.POWERUP_DEFS[key];
      if (!def) continue;
      const dynamicLabel = def.apply();
      items.push({
        key,
        label: dynamicLabel || def.label,
      });
    }
    // Mejora permanente "Suerte del cofre": chance de un ítem extra, por
    // fuera de los RPG_CHEST_REWARD_COUNT normales.
    if (juego.mejoras.meta.extraChestChance && Math.random() < RpgConfig.CHEST_EXTRA_CHANCE) {
      const extraKey = juego.datos.rollPowerup(chestType);
      const extraDef = RpgDatos.POWERUP_DEFS[extraKey];
      if (extraDef) {
        const extraLabel = extraDef.apply();
        items.push({
          key: extraKey,
          label: '🍀 Extra · ' + (extraLabel || extraDef.label),
        });
      }
    }
    juego.enemigos.updateHudBars();
    juego.enemigos.updateHudAmmo();
    this.showChestRewardPanel(chestType, items);
  }

  // Recorta `rect` (RPG_POWERUP_ICONS) de `img` a un <canvas> chico y
  // devuelve un data URL — permite meter el ícono real del power-up dentro
  // de un <img> del cartel HTML sin tener que armar background-position a
  // mano por cada ítem (mismo recorte que usa rpgDrawIconRect para canvas).
  iconToDataUrl(img, rect, targetH) {
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
  showChestRewardPanel(chestType, items) {
    juego.partida.stopLoop();
    const img = juego.images[RpgConfig.POWERUP_SHEET];
    const rowsHtml = items
      .map(function (it) {
        const rect = RpgConfig.POWERUP_ICONS[it.key];
        const iconHtml =
          img && rect
            ? '<img class="rpg-reward-icon" src="' + juego.combate.iconToDataUrl(img, rect, 40) + '" alt="">'
            : '';
        return (
          '<div class="rpg-reward-row">' +
          iconHtml +
          '<span class="rpg-reward-label">' +
          (it.label || '') +
          '</span></div>'
        );
      })
      .join('');
    RpgConfig.EL.overlayTitle.textContent = chestType === 'gold' ? '✨ ¡Cofre de oro!' : '📦 ¡Cofre de plata!';
    RpgConfig.EL.overlaySub.innerHTML = '<div class="rpg-reward-list">' + rowsHtml + '</div>';
    RpgConfig.EL.overlayButtons.innerHTML =
      '<button class="btn-play" onclick="rpgCollectChestReward()">Recoger</button>';
    RpgConfig.EL.overlay.classList.remove('hidden');
  }

  collectChestReward() {
    // Doble click en "Recoger": sin esto el segundo click arrancaba el loop
    // de combate por detrás (en el cofre del jefe, encima del menú).
    if (RpgConfig.EL.overlay.classList.contains('hidden')) return;
    RpgConfig.EL.overlay.classList.add('hidden');
    if (juego.chestIsBossReward) {
      juego.chestIsBossReward = false;
      juego.enemigos.completeChapter();
      return;
    }
    this.startLoop();
  }

  // ÚNICO punto de arranque del loop de combate. Antes cada lugar hacía su
  // propio requestAnimationFrame(loop) sin cancelar el anterior: si se
  // llamaba dos veces (doble click en Continuar/Recoger) quedaban DOS
  // cadenas de frames corriendo y el juego iba a doble velocidad.
  // Cancelar antes de pedir el frame lo hace idempotente.
  startLoop() {
    if (juego.raf) cancelAnimationFrame(juego.raf);
    juego.running = true;
    // El primer frame después de una pausa/diálogo usa dt=16 en vez del
    // tiempo que estuvo parado (antes llegaba el tope de 50ms de golpe).
    this.lastTs = 0;
    juego.raf = requestAnimationFrame(this.loop);
  }

  loop(ts) {
    if (!juego.running) return;
    const dt = this.lastTs ? Math.min(ts - this.lastTs, 50) : 16;
    this.lastTs = ts;
    this.update(dt);
    juego.render.draw();
    juego.raf = requestAnimationFrame(this.loop);
  }

  update(dt) {
    const C = juego.canvas;
    const cfg = juego.datos.roomCfg();
    const p = juego.jugador;
    const step = dt / 16.6; // normaliza a "frames" de 60fps para no depender del refresh rate

    // ── Cartel de horda en pantalla (ver rpgSpawnNextWave / rpgDraw) ──
    if (juego.banner) {
      juego.banner.timer -= dt;
      if (juego.banner.timer <= 0) juego.banner = null;
    }
    // ── Reloj del combate (si la habitación tiene límite de tiempo) ──
    const anyEnemyAlive = juego.enemies.some((e) => e.alive);
    if (juego.timeLimitMs != null && anyEnemyAlive) {
      juego.combatElapsed += dt;
      juego.enemigos.updateHudTimer();
      if (juego.combatElapsed >= juego.timeLimitMs) {
        juego.enemigos.gameOver(
          '⏱ Se acabó el tiempo',
          (cfg.enemyName || 'El enemigo') + ' resistió hasta el final de la canción.',
        );
        return;
      }
    }
    // ── Movimiento del jugador ──
    if (p.speedBoostTimer > 0) p.speedBoostTimer -= dt;
    const speedMult = p.speedBoostTimer > 0 ? cfg.potionSpeedMult || 1.6 : 1;
    const isBlocking = juego.keys.block || (juego.touch && juego.touch.state && !!juego.touch.state.block);
    this.block(isBlocking);
    let dx = 0,
      dy = 0;
    if (juego.keys.up) dy -= 1;
    if (juego.keys.down) dy += 1;
    if (juego.keys.left) dx -= 1;
    if (juego.keys.right) dx += 1;
    // Joystick táctil (RPG.touch, ver rpgSetupTouchControls) — analógico,
    // dibujado dentro del canvas. Se suma al vector de teclado; si las dos
    // fuentes están activas a la vez (poco común) simplemente se combinan.
    if (juego.touch) {
      const stick = juego.touch.state.move;
      if (stick && Math.hypot(stick.x, stick.y) > RpgConfig.JOYSTICK_DEADZONE) {
        dx += stick.x;
        dy += stick.y;
      }
      juego.menu.pollTouchActions();
    }
    if (dx !== 0 || dy !== 0) {
      // Misma prioridad que rpgUpdateFacing (izq/der pisan a arriba/abajo):
      // se recalcula cada frame acá para que el joystick (que no dispara
      // eventos keydown/keyup) también actualice el sprite que mira Junior.
      if (dx < 0) juego.facing = 'left';
      else if (dx > 0) juego.facing = 'right';
      else if (dy < 0) juego.facing = 'up';
      else if (dy > 0) juego.facing = 'down';
    }
    p.moving = (dx !== 0 || dy !== 0) && !p.blocking;
    // Límites de la arena: solo se puede pisar la mitad de abajo (piso); la
    // mitad de arriba es cielo/fondo y queda fuera de la zona jugable. El
    // límite derecho es el del MUNDO de la habitación (no del canvas
    // visible): en habitaciones normales el mundo es más ancho. Mientras no
    // esté limpia, el tramo de "puerta" pegado al borde derecho es una pared
    // invisible; una vez limpia, se puede cruzar.
    const marginX = 16;
    const doorLocked = cfg.type === 'combat' && !juego.roomCleared;
    const rightLimit = juego.worldWidth - marginX - (doorLocked ? RpgConfig.DOOR_ZONE_W : 0);
    if (p.moving) {
      const len = Math.hypot(dx, dy) || 1;
      const spd = p.blocking ? 0 : p.speed * speedMult * step;
      const stepX = (dx / len) * spd;
      const stepY = (dy / len) * spd;
      // Zona de movimiento poligonal (ver rpg_enemies_data.js): reemplaza el
      // clamp rectangular de siempre por un point-in-polygon, para salas
      // como piso2a donde el borde izquierdo no es una simple línea vertical
      // en marginX sino que corta más adentro (pared con puerta decorativa).
      // Salas sin cfg.zonePolygon definido se comportan idéntico a antes
      // (rpgActiveZonePolygon cae al rectángulo default).
      const floor = juego.datos.floorBounds(C);
      const zone = juego.datos.activeZonePolygon(marginX, rightLimit, floor.top, floor.bottom);
      juego.debugZone = zone; // leído por rpgDraw cuando RPG_DEBUG_SHOW_ZONE está prendido

      const tryX = p.x + stepX;
      const tryY = p.y + stepY;
      if (juego.datos.pointInPolygon(zone, tryX, tryY)) {
        // Movimiento diagonal completo: el punto destino cae dentro de la zona.
        p.x = tryX;
        p.y = tryY;
      } else if (juego.datos.pointInPolygon(zone, tryX, p.y)) {
        // Bloqueado en Y (ej. tocando un borde horizontal) — desliza en X.
        p.x = tryX;
      } else if (juego.datos.pointInPolygon(zone, p.x, tryY)) {
        // Bloqueado en X (ej. tocando la pared/puerta) — desliza en Y.
        p.y = tryY;
      }
      // Si ninguna combinación cae adentro (esquina cerrada), no se mueve.
    }
    p.animarCaminata(step);
    // ── Cámara: sigue a Junior en horizontal. Si el mundo es más ancho que
    // la ventana visible (que ahora depende del zoom: a más zoom-out, se ve
    // más mundo de una), nunca se ve la habitación entera de una — así hay
    // incertidumbre sobre qué enemigos hay más adelante. RPG.camera.y NO se
    // toca acá: queda fijo desde que arrancó la habitación (ver rpgStartRoom
    // / rpgComputeRoomZoom) y no depende de la posición de Junior. ──
    if (juego.worldWidth > RpgConfig.LOGICAL_W) {
      const visibleW = RpgConfig.LOGICAL_W / juego.roomZoom;
      const targetCamX = Math.max(0, Math.min(juego.worldWidth - visibleW, p.x - visibleW / 2));
      juego.camera.x += (targetCamX - juego.camera.x) * 0.12;
    } else {
      juego.camera.x = 0;
    }
    // ── Puerta de salida: habitación normal ya limpia + Junior llegó al
    // borde derecho del mundo → pasa a la siguiente habitación, sin cartel.
    if (cfg.type === 'combat' && juego.roomCleared && p.x >= juego.worldWidth - marginX - 2) {
      juego.partida.stopLoop();
      juego.partida.startRoom(juego.room + 1);
      return;
    }
    p.actualizarTemporizadores(dt);
    // Disparo sostenido con teclado (el táctil ya lo hace en
    // rpgPollTouchActions): rpgFire respeta cooldown, bloqueo y recarga.
    if (juego.keys.fire) this.fire();
    // ── Cofre: animación de apertura (4 frames) y aplicación de la
    // recompensa recién en el último frame, no al tocar Interactuar. ──
    if (juego.chest && juego.chest.opening && !juego.chest.opened) {
      const c = juego.chest;
      c.animTick += dt;
      if (c.animTick >= RpgConfig.CHEST_FRAME_MS) {
        c.animTick -= RpgConfig.CHEST_FRAME_MS;
        if (c.frame < 3) {
          c.frame++;
        } else {
          c.opened = true;
          c.opening = false;
          this.applyPowerup(c.type);
        }
      }
    }
    // ── Recarga automática (se dispara sola al gastar las 8 balas) ──
    if (p.reloading) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) {
        p.reloading = false;
        p.reloadTimer = 0;
        p.ammo = RpgConfig.PLAYER_MAX_AMMO;
        juego.enemigos.updateHudAmmo();
      }
    }
    // ── Balas de Junior ──
    for (let i = juego.bullets.length - 1; i >= 0; i--) {
      const b = juego.bullets[i];
      b.x += b.vx * step;
      b.y += b.vy * step;
      if (b.x < -20 || b.x > juego.worldWidth + 20 || b.y < -20 || b.y > RpgConfig.LOGICAL_H + 20) {
        juego.bullets.splice(i, 1);
        continue;
      }
      // Contra el primer enemigo vivo que toque la bala (una bala solo
      // pega una vez, aunque haya varios enemigos superpuestos).
      let hitSomeone = false;
      for (let j = 0; j < juego.enemies.length; j++) {
        const e2 = juego.enemies[j];
        if (e2.alive && !e2.hidden && juego.enemigos.overlap(b.x, b.y, b.w, b.h, e2.x, e2.y - 40, 60, 80)) {
          juego.enemigos.enemyHit(
            e2,
            (cfg.playerBulletDamage || 5) +
              juego.upgrades.dmgBonus +
              juego.mejoras.meta.dmgLevel * RpgConfig.DMG_UPGRADE_STEP,
          );
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
      if (hitSomeone) juego.bullets.splice(i, 1);
    }
    // ── Proyectiles del jefe / flechas ──
    juego.enemigos.updateEnemyProjectiles(dt, step);
    // ── Enemigos ──
    juego.enemies.forEach((e) => {
      if (!e.alive) {
        e.avanzarAnimacionMuerte(step);
        return;
      }
      if (!e.aplicarQuemadura(dt)) return;
      // Polimorfismo: cada tipo de enemigo (EnemigoMelee, Arquero, Fantasma,
      // Jefe — ver rpg_entidades.js) trae su propia IA. Se decide por
      // especie al crearlo, así un kn_warror invocado dentro de la sala del
      // jefe usa su IA de persecución y no el patrón del jefe.
      e.actualizar(p, cfg, C, dt, step);
    });
  }
}
