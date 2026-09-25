// ══════════════════════════════════════
//   RPG Pixel — rpg_enemies_ai.js  (módulo ES6)
// ══════════════════════════════════════
// Clase RpgEnemigos: Creación de enemigos, oleadas, proyectiles, daño, HUD y fin de sala/capítulo.
import { RpgModulo } from './rpg_modulo.js';
import { juego } from './rpg_juego.js';
import { Enemigo } from './rpg_entidades.js';
import { RpgConfig } from './rpg_config.js';
import { RpgDatos } from './rpg_enemies_data.js';
export class RpgEnemigos extends RpgModulo {
  // Poses del golpe cuerpo a cuerpo, en orden — ver RPG_ENEMY_TYPES.dark_knight.poses.
  static BOSS_WINDUP_POSES = ['windup1', 'windup2', 'windup3', 'windup4'];
  static BOSS_ATTACK_POSES = ['attack1', 'attack2', 'attack3'];
  static BOSS_MELEE_HIT_FRAME = 1;
  // Corre su propio loop liviano (solo dibuja, no hay física/IA que
  // actualizar) para animar 2 frames de caída del jefe, igual que
  // rpgDialogueLoop hace con el diálogo. `frames` es el par [inicio, fin] de
  // e.deathFrame a usar (ver RPG_ENEMY_TYPES.dark_knight.poses: death1..4) —
  // [1,2] para la primera caída, [3,4] para la segunda tras el diálogo.
  // onDone se llama al terminar de sostener el frame final — el llamador
  // decide qué sigue (diálogo, otra caída, o terminar la secuencia).
  static BOSS_DEATH_FRAME_MS = 260;
  static BOSS_DEATH_HOLD_MS = 300;
  constructor() {
    super();
  }

  // ─── Creación de enemigos a partir de una lista de spawns ─────
  // Reusada tanto por rpgStartRoom (oleada inicial, o única lista si la sala
  // no usa `waves`) como por rpgSpawnNextWave (oleadas siguientes). Antes
  // vivía inline dentro de rpgStartRoom — se sacó para no duplicar toda esta
  // lógica al agregar el sistema de oleadas.
  createEnemies(spawns, cfg, floorNow, eliteStatMult, eliteSpeedMult) {
    const n = spawns.length;
    // Reparto automático (solo se usa para spawns SIN `pos` manual, ver abajo).
    const marginX = Math.max(60, juego.worldWidth * 0.1);
    const desiredSafeX = juego.jugador.x + Math.max(RpgDatos.SPAWN_SAFE_DIST, RpgConfig.LOGICAL_W * 1.05);
    const safeStartX = Math.min(
      Math.max(marginX, desiredSafeX),
      Math.max(marginX, juego.worldWidth - marginX - 40), // no te pases del final del mundo
    );
    const spanX = Math.max(20, juego.worldWidth - marginX - safeStartX);
    const yTiers = [0.22, 0.5, 0.78];
    return spawns.map((spawn, idx) => {
      const species = RpgDatos.ENEMY_TYPES[spawn.species];
      const e = {
        species: spawn.species,
        x: 0,
        y: 0,
        hp: spawn.hp * eliteStatMult,
        maxHp: spawn.hp * eliteStatMult,
        speed: (spawn.speed || 0.8) * eliteSpeedMult,
        contactDamage: (spawn.contactDamage || 0) * eliteStatMult,
        arrowDamage: (spawn.arrowDamage || 0) * eliteStatMult,
        fireCooldownMs: spawn.fireCooldownMs || [1500, 2200],
        fireTimer: 0,
        animFrame: 0,
        animTick: 0,
        animKind: 'idle',
        // 'idle' | 'walk' | 'attack' | 'hurt' | 'death' — decide qué ciclo de rpgDrawEnemy usar
        contactCooldown: 0,
        attackHitApplied: false,
        // evita que un mismo swing de ataque golpee más de una vez (ver rpgUpdateSimpleChase)
        hitFlash: 0,
        hurtLock: 0,
        // ms restantes reaccionando a un golpe (pausa la IA y muestra la pose "hurt")
        burnTicksLeft: 0,
        // ticks de 1hp restantes de la quemadura (esfera azul), ver rpgUpdate
        burnTimer: 0,
        // ms hasta el próximo tick de quemadura
        alive: true,
        side: 'left',
        phase: 1,
        moving: false,
        // solo lo usa el jefe (ver rpgUpdateBoss/rpgDraw) para elegir entre pose idle y ciclo de caminata
        // Estado del patrón de ataque especial del jefe — se pisa por completo
        // más abajo si attackPattern === 'boss'; el resto de las especies lo
        // ignora (queda con este valor por defecto sin usarlo nunca).
        attack: {
          state: 'idle',
          timer: 1200,
          vx: 0,
          vy: 0,
          hit: false,
        },
      };
      if (cfg.attackPattern === 'boss') {
        // Ya no arranca pegado a un costado fijo (ver rpgUpdateBoss): entra
        // por el lado derecho de la arena, a distancia prudente de Junior,
        // y de ahí en más se mueve libre.
        e.x = juego.worldWidth * 0.78;
        e.y = RpgConfig.LOGICAL_H * 0.72;
        e.attack = {
          state: 'roam',
          timer: 0,
          vx: 0,
          vy: 0,
          hit: false,
          poseFrame: 0,
          poseTick: 0,
          meleeCd: juego.datos.randRange(cfg.meleeCooldownMs),
          rangedCd: juego.datos.randRange(cfg.fireCooldownPhase1),
          dashCd: juego.datos.randRange(cfg.dashCooldownMs),
          summonCd: cfg.summonCooldownMs || 20000, // ver rpgSummonWarriors
        };
      } else if (spawn.pos) {
        // ── Posición manual (fracciones 0-1 de worldWidth / del alto del
        // piso jugable) ── Para hordas/oleadas donde cada enemigo necesita
        // un lugar estratégico puntual en vez del reparto parejo automático
        // (ver el else de abajo). spawn.pos = { x: 0-1, y: 0-1 }.
        e.x = spawn.pos.x * juego.worldWidth;
        e.y = floorNow.top + (floorNow.bottom - floorNow.top) * spawn.pos.y;
        e.fireTimer = juego.datos.randRange(e.fireCooldownMs);
      } else {
        // Reparto horizontal parejo a lo largo de TODO el mundo de la
        // habitación (no solo la porción visible en el canvas), con un
        // pequeño escalonado en Y para que no queden todos en fila
        // perfecta. Al ser más ancho que la cámara, Junior no ve a todos
        // los enemigos apenas entra.
        // El primer tramo (desde la puerta de entrada hasta ~85% del ancho
        // del canvas) queda vacío a propósito: como la cámara arranca en
        // x=0, eso es justo lo que se ve en el primer frame, así que ningún
        // enemigo puede aparecer ya visible al lado de Junior.
        e.x = safeStartX + (n === 1 ? spanX / 2 : (spanX * idx) / Math.max(1, n - 1));
        // Antes solo alternaba entre 2 "carriles" (35%/60% del piso), lo
        // que dejaba sin usar buena parte del alto de la zona de combate
        // (sobre todo ahora que el piso es más alto, ver RPG_FLOOR_*).
        // Con 3 carriles (22%/50%/78%) + un pequeño jitter random se
        // aprovecha todo el fondo, con más variedad de posiciones.
        const yFrac = yTiers[idx % yTiers.length];
        const jitter = (Math.random() - 0.5) * (floorNow.bottom - floorNow.top) * 0.08;
        e.y = floorNow.top + (floorNow.bottom - floorNow.top) * yFrac + jitter;
        e.fireTimer = juego.datos.randRange(e.fireCooldownMs);
      }
      // Embestida ocasional (ver species.dashAbility / rpgUpdateSimpleChase):
      // cooldown inicial random por instancia, así 2 enemigos de la misma
      // especie en la misma sala no embisten sincronizados.
      if (species.dashAbility) {
        e.dashState = null;
        e.dashCd = juego.datos.randRange(species.dashAbility.cooldownMs);
      }
      // Fantasma teletransportador (ver rpgUpdateGhost): arranca en fase
      // activa, con su propio cooldown random hasta el primer teletransporte
      // (así 2 ghost en la misma sala no se desvanecen sincronizados).
      // e.hidden es lo que rpgDraw y el choque de balas de Junior chequean
      // para tratarlo como invisible/intangible mientras dura el teletransporte.
      if (species.behavior === 'ghost') {
        e.hidden = false;
        e.ghostState = 'active';
        e.teleportTimer = juego.datos.randRange(species.teleportCooldownMs || [3500, 5500]);
      }
      return Enemigo.crear(e);
    });
  }

  // ─── Sistema de oleadas/hordas (sala con cfg.waves) ─────
  // Se dispara desde rpgEnemyHit cuando a la oleada actual le queda
  // `cfg.waveTriggerRemaining` (default 1) o menos enemigos vivos y todavía
  // hay una oleada siguiente en cfg.waves. Los enemigos nuevos se SUMAN a
  // RPG.enemies (los que quedan vivos de la oleada anterior siguen en juego,
  // no se pisan) — así el jugador termina de limpiar la horda anterior
  // mientras ya está lidiando con la nueva.
  spawnNextWave(cfg) {
    juego.waveIndex++;
    const floorNow = juego.datos.floorBounds(juego.canvas);
    const eliteStatMult = juego.datos.eliteActive() ? RpgConfig.ELITE_STAT_MULT : 1;
    const eliteSpeedMult = juego.datos.eliteActive() ? RpgConfig.ELITE_SPEED_MULT : 1;
    const newEnemies = this.createEnemies(cfg.waves[juego.waveIndex], cfg, floorNow, eliteStatMult, eliteSpeedMult);
    juego.enemies.push(...newEnemies);
    this.updateHudBars();
    juego.partida.updateEnemyLabel();
    // Cartel en pantalla (ver RPG.banner / rpgDraw) — solo si esta sala en
    // particular lo pidió con cfg.waveBannerText (ver comentario en la sala 1
    // del capítulo 2, rpg_enemies_data.js).
    if (cfg.waveBannerText) {
      const durationMs = 2200;
      juego.banner = {
        text: cfg.waveBannerText,
        timer: durationMs,
        durationMs,
      };
    }
  }

  // ─── Habilidad del jefe: invocar guerreros ─────
  // Por defecto aparecen 2 kn_warror, uno pegado a cada costado del arena
  // (comportamiento de siempre de dark_knight). cfg.summonSpecies (ver
  // dark_ghostking) permite elegir OTRA(S) especie(s) y sus stats por sala —
  // con un solo elemento aparece UN esbirro centrado en vez de 2 a los
  // costados. Soporta tanto especies 'melee' (kn_warror/dk_ghost) como
  // 'ghost' (agrega hidden/ghostState/teleportTimer, ver más abajo); no
  // sirve tal cual para 'boss'.

  updateEnemyProjectiles(dt, step) {
    const C = juego.canvas;
    const p = juego.jugador;
    for (let i = juego.enemyProjectiles.length - 1; i >= 0; i--) {
      const pr = juego.enemyProjectiles[i];
      // Proyectil que ya chocó y está en su animación de explosión (ver
      // pr.explodeFrames más abajo, y rpgFireBossBolt) — se queda quieto en
      // el punto de impacto ciclando esos frames y recién ahí desaparece; no
      // vuelve a chocar de nuevo (el daño ya se aplicó una sola vez, al
      // momento del impacto).
      if (pr.exploding) {
        pr.explodeTick += dt;
        const frameMs = pr.explodeFrameMs || 90;
        pr.explodeFrameIdx = Math.min(pr.explodeFrames.length - 1, Math.floor(pr.explodeTick / frameMs));
        if (pr.explodeTick >= frameMs * pr.explodeFrames.length) juego.enemyProjectiles.splice(i, 1);
        continue;
      }
      pr.x += pr.vx * step;
      pr.y += pr.vy * step;
      if (pr.kind === 'slash') {
        // El dark_slash del jefe anima entre sus 2 frames por variante.
        pr.animTick += step;
        if (pr.animTick >= 6) {
          pr.animTick = 0;
          pr.animFrame = pr.animFrame === 1 ? 2 : 1;
        }
      }
      if (pr.x < -40 || pr.x > juego.worldWidth + 40 || pr.y < -40 || pr.y > RpgConfig.LOGICAL_H + 40) {
        juego.enemyProjectiles.splice(i, 1);
        continue;
      }
      if (
        this.overlap(
          pr.x,
          pr.y,
          pr.w,
          pr.h,
          p.x,
          p.y + RpgConfig.PLAYER_HITBOX.yOff,
          RpgConfig.PLAYER_HITBOX.w,
          RpgConfig.PLAYER_HITBOX.h,
        )
      ) {
        this.playerHit(pr.dmg, {
          fullyBlockable: true,
        });
        if (pr.explodeFrames) {
          // No se borra todavía: pasa a explotar en el lugar (ver arriba).
          pr.exploding = true;
          pr.explodeTick = 0;
          pr.explodeFrameIdx = 0;
        } else {
          juego.enemyProjectiles.splice(i, 1);
        }
      }
    }
  }

  // ─── Pociones ─────
  // (Sistema de pociones en el suelo eliminado — ya no se usa.)
  overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;
  }

  playerHit(dmg, opts) {
    const p = juego.jugador;
    // Inmune (tótem recién activado): el golpe no hace nada, ni gasta el bloqueo.
    if (p.invulnTimer > 0) return;
    const fullyBlockable = opts && opts.fullyBlockable;
    let finalDmg = dmg;
    if (p.blocking) {
      finalDmg = fullyBlockable ? 0 : Math.round(dmg * 0.25);
      // El bloqueo solo absorbe un golpe: después se desactiva (lo que ya
      // corta la animación de bloqueo, ver el reset de blockAnimFrame en
      // rpgUpdate) y queda en cooldown 10s antes de poder volver a usarse.
      p.blocking = false;
      p.blockCooldown = 10000;
    }
    // Pechera (cofre): reduce un % del daño ya calculado (después del
    // bloqueo, así ambas reducciones se combinan en vez de pisarse).
    if (juego.upgrades.dmgReduction > 0) finalDmg = Math.round(finalDmg * (1 - juego.upgrades.dmgReduction));
    p.hp = Math.max(0, p.hp - finalDmg);
    p.hitFlash = 200;
    if (p.hp <= 0 && juego.mejoras.meta.totem && !juego.totemUsed) this.activateTotem();
    this.updateHudBars();
    if (p.hp <= 0) this.gameOver();
  }

  // Tótem (mejora de la tienda): en vez de morir, vuelve con RPG_TOTEM_HEAL
  // de vida y queda inmune RPG_TOTEM_INVULN_MS. Una vez por capítulo.
  activateTotem() {
    const p = juego.jugador;
    juego.totemUsed = true;
    p.hp = Math.min(p.maxHp, RpgConfig.TOTEM_HEAL);
    p.invulnTimer = RpgConfig.TOTEM_INVULN_MS;
    p.hitFlash = 0;
    juego.banner = {
      text: '¡Tótem activado!',
      timer: 1800,
      durationMs: 1800,
    };
  }

  // dmg ahora se aplica a un enemigo puntual `e` (puede haber varios vivos
  // a la vez). La habitación se gana recién cuando TODOS están muertos.
  enemyHit(e, dmg) {
    if (!e.alive) return;
    e.hp = Math.max(0, e.hp - dmg);
    e.hitFlash = 150;
    e.animKind = 'hurt';
    e.animFrame = 0;
    e.animTick = 0;
    e.hurtLock = 220; // breve pausa de reacción antes de retomar la IA
    this.updateHudBars();
    if (e.hp <= 0) {
      e.alive = false;
      e.hurtLock = 0;
      e.animKind = 'death';
      e.animFrame = 0;
      e.animTick = 0;
      // Los enemigos muertos ya no pasan por el resto de rpgUpdate (ver el
      // primer if de ese loop), así que hitFlash nunca se terminaba de
      // descontar solo — el cuerpo se quedaba semitransparente para siempre.
      // Se corta acá mismo, de una.
      e.hitFlash = 0;
      // Congela la orientación en el instante de morir: si no, el cuerpo
      // "sigue mirando" hacia donde esté Junior en cada frame siguiente,
      // como si el muerto lo persiguiera con la vista.
      e.deathFlip = e.x > juego.jugador.x;
      juego.partida.updateEnemyLabel();
      const species = RpgDatos.ENEMY_TYPES[e.species];
      if (species && species.behavior === 'boss') {
        // El jefe: su muerte SIEMPRE termina el combate, sin esperar a que
        // mueran también los kn_warror que haya invocado (ver
        // rpgSummonWarriors) — la pelea terminó, así que se descartan.
        // rpgStartBossDeathSequence se encarga de la cinemática + el cofre.
        juego.enemies = [e];
        e.iniciarMuerte(juego.datos.roomCfg());
        return;
      }
      // ── Horda/oleadas ── Si la sala define `waves` y todavía queda alguna
      // por salir, no se declara victoria apenas se vacía RPG.enemies: se
      // revisa cuántos siguen vivos de la oleada actual y, si son pocos
      // (cfg.waveTriggerRemaining, default 1), se llama a la siguiente en vez
      // de terminar el combate. Recién cuando ya no quedan más oleadas Y
      // todos están muertos se llama a rpgVictory (misma condición de
      // siempre para salas sin `waves`).
      const aliveCount = juego.enemies.filter((en) => en.alive).length;
      const roomCfg = juego.datos.roomCfg();
      if (
        roomCfg &&
        roomCfg.waves &&
        juego.waveIndex < roomCfg.waves.length - 1 &&
        aliveCount <= (roomCfg.waveTriggerRemaining || 1)
      ) {
        this.spawnNextWave(roomCfg);
      } else if (juego.enemies.every((en) => !en.alive)) {
        this.victory();
      }
    }
  }

  // ─── Cinemática de derrota del jefe ─────
  // Al llegar a 0 HP el jefe reproduce su primera caída (muerte 1 → muerte 2)
  // y queda congelado —opaco, no semitransparente— en muerte 2. Recién ahí
  // arranca el diálogo final (jefe + Junior, ver cfg.deathDialogue). Cuando
  // el jugador termina de leer la última línea, se reproduce una SEGUNDA
  // caída distinta (muerte 3 → muerte 4) y ahí sí, congelado en muerte 4,
  // aparece el cofre de oro — ver rpgPlayBossDeathFall.

  finishBossDeath() {
    this.victory();
    juego.combate.startLoop();
  }

  // Barra de HP del enemigo: en habitaciones con varios enemigos muestra el
  // HP TOTAL sumado (todos cuentan igual), en la del jefe es simplemente su
  // única barra (RPG.enemies tiene 1 solo elemento ahí).
  updateHudBars() {
    const p = juego.jugador;
    const pFill = RpgConfig.EL.playerHpFill;
    const eFill = RpgConfig.EL.enemyHpFill;
    const pText = RpgConfig.EL.playerHpText;
    const pct = Math.max(0, p.hp / p.maxHp);
    if (pFill) pFill.style.width = pct * 100 + '%';
    if (pText) pText.textContent = Math.max(0, Math.round(p.hp)) + '/' + p.maxHp;
    // Expresión de Junior según % de vida (usa expresiones.webp vía CSS) y
    // temblor leve del HUD cuando queda al 25% o menos.
    const avatar = RpgConfig.EL.playerAvatar;
    if (avatar) {
      avatar.classList.remove('rpg-expr-feliz', 'rpg-expr-nervioso', 'rpg-expr-sorprendido');
      if (pct <= 0.25) avatar.classList.add('rpg-expr-sorprendido');
      else if (pct <= 0.5) avatar.classList.add('rpg-expr-nervioso');
      else avatar.classList.add('rpg-expr-feliz');
    }
    const playerFrame = document.querySelector('.rpg-hud-frame-player');
    if (playerFrame) playerFrame.classList.toggle('rpg-hud-shake', pct > 0 && pct <= 0.25);
    if (eFill) {
      // En la sala del jefe (RPG.enemies[0] siempre es él, ver
      // rpgUpdateEnemyLabel) la barra es SOLO su vida — si sumáramos acá los
      // kn_warror que invoca (ver rpgSummonWarriors), la barra "subiría" cada
      // vez que aparecen refuerzos y parecería que el jefe se curó.
      const roomCfg = juego.datos.roomCfg();
      if (roomCfg && roomCfg.type === 'boss' && juego.enemies[0]) {
        const boss = juego.enemies[0];
        eFill.style.width = Math.max(0, (Math.max(0, boss.hp) / boss.maxHp) * 100) + '%';
      } else {
        const totalMax = juego.enemies.reduce((s, e) => s + e.maxHp, 0) || 1;
        const totalHp = juego.enemies.reduce((s, e) => s + Math.max(0, e.hp), 0);
        eFill.style.width = Math.max(0, (totalHp / totalMax) * 100) + '%';
      }
    }
  }

  // Resumen de mejoras juntadas en cofres durante el intento (ver
  // RPG.upgrades), usado dentro del cartel de pausa (ver rpgRenderPauseOverlay).
  // Los aumentos que se pueden ir acumulando (HP máx, daño, monedas) se
  // muestran con ícono + cuánto llevás; los ítems especiales (pechera,
  // pistola, balas de fuego, velocidad — de una sola vez, ver
  // rpgBuildChestWeights) se muestran SOLO con su sprite, sin nombre.
  buildUpgradesSummaryHtml() {
    const u = juego.upgrades;
    const img = juego.images[RpgConfig.POWERUP_SHEET];
    const rows = [];
    if (u.maxHpBonus > 0) rows.push(this.upgradeRowHtml(img, 'potionGreen', '+' + u.maxHpBonus + ' HP máx'));
    if (u.dmgBonus > 0) rows.push(this.upgradeRowHtml(img, 'ammo', '+' + u.dmgBonus + ' daño'));
    if (u.coins > 0) rows.push(this.upgradeRowHtml(img, 'coins', u.coins + ' monedas'));
    if (u.dmgReduction > 0) rows.push(this.upgradeIconOnlyHtml(img, 'armor'));
    if (u.doubleShot) rows.push(this.upgradeIconOnlyHtml(img, 'gun'));
    if (u.burning) rows.push(this.upgradeIconOnlyHtml(img, 'blueOrb'));
    if (u.speedPermanent) rows.push(this.upgradeIconOnlyHtml(img, 'potionOrange'));
    if (juego.mejoras.meta.totem) {
      rows.push(
        '<div class="rpg-reward-row"><span class="rpg-reward-label">Tótem: ' +
          (juego.totemUsed ? 'usado en este capítulo' : 'listo') +
          '</span></div>',
      );
    }
    if (rows.length === 0) return '<p class="rpg-pause-empty">Todavía no juntaste nada este intento.</p>';
    return '<div class="rpg-reward-list">' + rows.join('') + '</div>';
  }

  upgradeRowHtml(img, key, label) {
    const rect = RpgConfig.POWERUP_ICONS[key];
    const iconHtml =
      img && rect
        ? '<img class="rpg-reward-icon" src="' + juego.combate.iconToDataUrl(img, rect, 32) + '" alt="">'
        : '';
    return '<div class="rpg-reward-row">' + iconHtml + '<span class="rpg-reward-label">' + label + '</span></div>';
  }

  upgradeIconOnlyHtml(img, key) {
    const rect = RpgConfig.POWERUP_ICONS[key];
    if (!img || !rect) return '';
    return (
      '<div class="rpg-reward-row rpg-reward-row-icon-only"><img class="rpg-reward-icon" src="' +
      juego.combate.iconToDataUrl(img, rect, 32) +
      '" alt=""></div>'
    );
  }

  updateHudAmmo() {
    const p = juego.jugador;
    const el = RpgConfig.EL.ammoText;
    if (!el) return;
    if (p.reloading) {
      el.textContent = 'Recargando…';
      el.classList.add('rpg-ammo-reloading');
    } else {
      el.textContent = p.ammo + '/' + RpgConfig.PLAYER_MAX_AMMO;
      el.classList.remove('rpg-ammo-reloading');
    }
  }

  updateHudTimer() {
    const el = RpgConfig.EL.timeLeft;
    if (!el) return;
    if (juego.timeLimitMs == null) {
      el.textContent = '';
      return;
    }
    const remainMs = Math.max(0, juego.timeLimitMs - juego.combatElapsed);
    const totalSec = Math.ceil(remainMs / 1000);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    el.textContent = '⏱ ' + mm + ':' + String(ss).padStart(2, '0');
    el.classList.toggle('rpg-timer-warn', remainMs <= 15000);
  }

  // ─── Derrota ─────
  // Morir (o que se acabe el tiempo) borra la partida activa: se pierde
  // todo lo guardado en el slot (capítulos desbloqueados/completados), no
  // solo el intento actual (ver rpgEraseActiveSlot). Sin opción de
  // reintentar in-place: para volver a jugar hay que pasar por el menú y
  // arrancar una partida (esa misma u otro slot) desde cero.
  gameOver(title, sub) {
    juego.partida.stopLoop();
    juego.menu.eraseActiveSlot();
    const roomCfg = juego.datos.roomCfg();
    const foeLabel = roomCfg.enemyName || 'Los enemigos';
    juego.combate.setOverlay(
      title || '💀 Derrota',
      sub || foeLabel + ' fueron más fuertes esta vez. La partida se borró — volvé al menú para empezar de nuevo.',
      '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgShowMenu()">← Volver al menú</button>',
    );
    RpgConfig.EL.overlay.classList.remove('hidden');
  }

  // ─── Victoria de una habitación ─────
  // Si es una habitación normal (1-4), aparece un cofre de plata y se pasa
  // a la siguiente. Si es la habitación 5 (jefe), aparece un cofre de ORO
  // garantizado — el único lugar del juego donde puede salir — y recién al
  // recogerlo (ver rpgCollectChestReward) se completa el capítulo.
  victory() {
    const room = juego.room;
    const chapterCfg = juego.datos.chapterCfg();
    const roomCfg = chapterCfg.rooms[room];
    if (roomCfg.type === 'boss') {
      juego.chestIsBossReward = true;
      this.spawnChest('gold');
      return;
    }
    // Habitación normal: sin cartel — se destraba la puerta del borde
    // derecho (ver rpgUpdate) y Junior pasa a la siguiente caminando.
    // Mejora permanente "Cofre inicial garantizado": el primer cofre del
    // Capítulo 1 (habitación 1) sale siempre de oro en vez de plata.
    juego.roomCleared = true;
    const forceGoldChest = juego.mejoras.meta.guaranteedFirstChest && juego.chapter === 1 && room === 1;
    this.spawnChest(forceGoldChest ? 'gold' : 'iron');
  }

  // ─── Cofre de recompensa ─────
  // Plata: sale siempre en habitaciones normales (1-4) al vaciarlas. Oro:
  // SOLO sale al matar al jefe de la habitación 5 (ver rpgVictory) — ya no
  // es un chance aleatorio en habitaciones normales. Se ubica siempre en el
  // centro horizontal de la habitación (worldWidth / 2), sin importar dónde
  // esté parado Junior ni dónde quede la puerta de salida.
  spawnChest(type) {
    const C = juego.canvas;
    const floor = juego.datos.floorBounds(C);
    juego.chest = {
      type: type || 'iron',
      x: juego.worldWidth / 2,
      y: (floor.top + floor.bottom) / 2,
      frame: 0,
      animTick: 0,
      opening: false,
      opened: false,
    };
  }

  // ─── Completar capítulo (guardado) ─────
  completeChapter() {
    juego.partida.stopLoop(); // el cofre de oro del jefe deja el loop corriendo hasta recogerlo
    const chapterIdx = juego.chapter;
    const chapterCfg = RpgDatos.CHAPTERS[chapterIdx];
    const nextChapterIdx = chapterIdx + 1;
    const hasNext = !!RpgDatos.CHAPTERS[nextChapterIdx];
    if (juego.activeSlot) {
      const save = juego.save || juego.menu.newSaveData();
      if (!save.chaptersCompleted.includes(chapterIdx)) save.chaptersCompleted.push(chapterIdx);
      save.chapterUnlocked = Math.max(save.chapterUnlocked, hasNext ? nextChapterIdx : chapterIdx);
      // Capítulo terminado: ya no hay intento en curso (salir desde este
      // cartel, incluso a Juegos o con F5, no borra nada).
      save.runActiva = false;
      // Mejoras de cofres para el capítulo siguiente, por si se vuelve al
      // menú en vez de tocar "▶ Siguiente capítulo". Si se rejugó un
      // capítulo anterior, no pisa las de uno más avanzado.
      const previas = save.runUpgrades;
      if (hasNext && (!previas || nextChapterIdx >= previas.chapter)) {
        save.runUpgrades = { chapter: nextChapterIdx, upgrades: { ...juego.upgrades } };
      }
      save.updatedAt = Date.now();
      juego.save = save;
      juego.menu.saveSlotData(juego.activeSlot, save);
    }
    juego.combate.setOverlay(
      '🏆 ¡Capítulo superado!',
      'Derrotaste a ' +
        chapterCfg.rooms[5].enemyName +
        ' y completaste ' +
        chapterCfg.name +
        '. Partida guardada' +
        (hasNext ? ' con tus mejoras: podés seguir ahora o más tarde desde el menú.' : '.'),
      (hasNext
        ? '<button class="btn-play" onclick="rpgStartChapter(' +
          nextChapterIdx +
          ', true)">▶ Siguiente capítulo</button>'
        : '') +
        '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgShowMenu()">← Volver al menú</button>',
    );
    RpgConfig.EL.overlay.classList.remove('hidden');
  }
}
