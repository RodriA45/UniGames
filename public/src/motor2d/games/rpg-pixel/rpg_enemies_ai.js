import { rpgIconToDataUrl, rpgLoop, rpgSetOverlay, rpgStartDialogue } from './rpg_combat_input.js';
import { RPG_EL, RPG_ELITE_SPEED_MULT, RPG_ELITE_STAT_MULT, RPG_LOGICAL_H, RPG_LOGICAL_W, RPG_PLAYER_HITBOX, RPG_PLAYER_MAX_AMMO, RPG_POWERUP_ICONS, RPG_POWERUP_SHEET, RPG_TOTEM_HEAL, RPG_TOTEM_INVULN_MS } from './rpg_config.js';
import { RPG, RPG_CHAPTERS, RPG_ENEMY_TYPES, RPG_SPAWN_SAFE_DIST, rpgChapterCfg, rpgEliteActive, rpgFloorBounds, rpgRandRange, rpgRoomCfg } from './rpg_enemies_data.js';
import { rpgSideX, rpgStartChapter, rpgStopLoop, rpgUpdateEnemyLabel } from './rpg_menu_flow.js';
import { RPG_META } from './rpg_meta.js';
import { rpgDraw } from './rpg_render.js';
import { rpgEraseActiveSlot, rpgNewSaveData, rpgSaveSlotData, rpgShowMenu } from './rpg_save_ui.js';

export function rpgUpdateSimpleChase(e, p, cfg, C, dt, step) {
  const species = RPG_ENEMY_TYPES[e.species];

  if (e.hurtLock > 0) {
    e.hurtLock -= dt;
    e.animKind = 'hurt';
    rpgTickAnim(e, species, step);
    if (e.hitFlash > 0) e.hitFlash -= dt;
    return;
  }

  // Límites de la zona de combate — el chase normal casi nunca los toca
  // (siempre apunta hacia Junior, que ya está adentro), pero la embestida
  // de acá abajo mueve a velocidad fija por un rato y SÍ puede pasarse de
  // largo (por eso el bug de "caminar en el cielo": sin este clamp, un
  // dash lanzado con Junior pegado al borde de arriba seguía de largo
  // fuera del piso). Se aplica siempre, por las dudas.
  const floor = rpgFloorBounds(C);
  const xMin = 20, xMax = RPG.worldWidth - 20;
  const yMin = floor.top + 15, yMax = floor.bottom - 10;

  // ── Embestida ocasional (opcional, ver species.dashAbility — hoy solo
  // kn_warror): aparte del combo de golpe de acá abajo, cada tanto hace
  // una corrida corta hacia Junior. e.dashCd arranca en un valor random
  // (ver rpgSpawnEnemy) y se vuelve a sortear cada vez que dashea, así 2
  // enemigos de la misma sala no embisten sincronizados. No usa sprite
  // nuevo: telegraphFrame/activeFrame son 2 frames que ya existen dentro
  // de species.anims.attack (se muestran fijos, sin ciclar, mientras dura
  // cada etapa). ──
  const dashCfg = species.dashAbility;
  if (dashCfg) {
    if (e.dashState === 'telegraph') {
      e.animKind = 'attack';
      e.animFrame = species.anims.attack.indexOf(dashCfg.telegraphFrame);
      e.dashTimer -= dt;
      if (e.dashTimer <= 0) {
        const dx = p.x - e.x, dy = p.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const spd = (e.speed || 1) * (dashCfg.speedMult || 3);
        e.dashVx = (dx / d) * spd;
        e.dashVy = (dy / d) * spd;
        e.dashTimer = dashCfg.durationMs || 750;
        e.dashHit = false;
        e.animFrame = species.anims.attack.indexOf(dashCfg.activeFrame);
        e.dashState = 'dashing';
      }
      if (e.hitFlash > 0) e.hitFlash -= dt;
      return;
    }
    if (e.dashState === 'dashing') {
      e.animKind = 'attack';
      e.animFrame = species.anims.attack.indexOf(dashCfg.activeFrame);
      e.x = Math.max(xMin, Math.min(xMax, e.x + e.dashVx * step));
      e.y = Math.max(yMin, Math.min(yMax, e.y + e.dashVy * step));
      if (!e.dashHit && Math.hypot(p.x - e.x, p.y - e.y) <= 36) {
        rpgPlayerHit(e.contactDamage);
        e.dashHit = true;
      }
      e.dashTimer -= dt;
      if (e.dashTimer <= 0) {
        e.dashState = null;
        e.animKind = 'idle';
        e.animFrame = 0;
        e.animTick = 0;
      }
      if (e.hitFlash > 0) e.hitFlash -= dt;
      return;
    }
    e.dashCd -= dt;
    // No arranca en medio del combo de golpe normal (e.animKind==='attack')
    // para no pisarle el frame — espera a que termine.
    if (e.dashCd <= 0 && e.animKind !== 'attack') {
      e.dashState = 'telegraph';
      e.dashTimer = dashCfg.telegraphMs || 350;
      e.dashCd = rpgRandRange(dashCfg.cooldownMs);
    }
  }

  const distX = p.x - e.x;
  const distY = p.y - e.y;
  const dist = Math.hypot(distX, distY);
  const stopDistance = 30; // antes 42 — alcance de golpe más corto (rango de daño reducido)

  if (e.contactCooldown > 0) e.contactCooldown -= dt;

  // Mientras dura el swing, el enemigo no se mueve ni vuelve a idle/walk
  // hasta completar el ciclo entero de anims.attack.
  if (e.animKind === 'attack') {
    const frames = species.anims.attack;
    const hitFrame = Math.floor(frames.length / 2); // frame en el que "conecta" el golpe
    const prevFrame = e.animFrame;
    rpgTickAnim(e, species, step);
    if (!e.attackHitApplied && prevFrame < hitFrame && e.animFrame >= hitFrame) {
      if (dist <= stopDistance + 6) rpgPlayerHit(e.contactDamage); // antes +10 — hitbox de golpe más chica
      e.attackHitApplied = true;
    }
    if (e.animFrame === 0 && prevFrame === frames.length - 1) { // ciclo completo → termina el ataque
      e.animKind = dist > stopDistance ? 'walk' : 'idle';
      e.attackHitApplied = false;
    }
    if (e.hitFlash > 0) e.hitFlash -= dt;
    return;
  }

  if (dist > stopDistance) {
    e.x = Math.max(xMin, Math.min(xMax, e.x + (distX / dist) * e.speed * step));
    e.y = Math.max(yMin, Math.min(yMax, e.y + (distY / dist) * e.speed * step));
    e.animKind = 'walk';
    rpgTickAnim(e, species, step);
  } else {
    e.animKind = 'idle';
    rpgTickAnim(e, species, step);
    if (dist <= stopDistance + 6 && e.contactCooldown <= 0) {
      e.animKind = 'attack';
      e.animFrame = 0; e.animTick = 0;
      e.attackHitApplied = false;
      e.contactCooldown = 900;
    }
  }
  if (e.hitFlash > 0) e.hitFlash -= dt;
}

// Hace avanzar el frame de animación de un enemigo dentro del ciclo
// `e.animKind` actual (idle/walk/attack/hurt/death), usando la cantidad de
// frames que tenga esa especie para no salirse del rango.
export function rpgTickAnim(e, species, step) {
  if (!species || !species.anims) return;
  const frames = species.anims[e.animKind] || species.anims.idle;
  e.animTick += step;
  // Velocidad propia por ciclo si está definida (species.animSpeeds[kind]);
  // si no, cae al animSpeed general de la especie.
  const speed = (species.animSpeeds && species.animSpeeds[e.animKind]) || species.animSpeed || 8;
  if (e.animTick >= speed) {
    e.animTick = 0;
    e.animFrame = (e.animFrame + 1) % frames.length;
  }
}

// Comportamiento a distancia (kn_archer y cualquier especie 'ranged'):
// mantiene una banda de distancia preferida — si Junior está muy cerca
// retrocede, si está muy lejos se acerca, y si está en rango se queda
// quieto disparando flechas con cooldown propio.
export function rpgUpdateRangedChase(e, p, species, dt, step) {
  if (e.hurtLock > 0) {
    e.hurtLock -= dt;
    e.animKind = 'hurt';
    rpgTickAnim(e, species, step);
    if (e.hitFlash > 0) e.hitFlash -= dt;
    return;
  }

  const distX = p.x - e.x;
  const distY = p.y - e.y;
  const dist = Math.hypot(distX, distY) || 1;
  const [minD, maxD] = species.preferredDist || [90, 160];

  if (dist < minD) {
    e.x -= (distX / dist) * e.speed * step;
    e.y -= (distY / dist) * e.speed * step;
    e.animKind = 'walk';
    rpgTickAnim(e, species, step);
  } else if (dist > maxD) {
    e.x += (distX / dist) * e.speed * step;
    e.y += (distY / dist) * e.speed * step;
    e.animKind = 'walk';
    rpgTickAnim(e, species, step);
  } else {
    // En rango para disparar, pero no se queda plantado como blanco fijo:
    // se desplaza de costado (perpendicular a Junior), alternando de lado
    // cada tanto, como un intento simple de esquivar mientras dispara.
    e.strafeTimer = (e.strafeTimer || 0) - dt;
    if (e.strafeTimer <= 0) {
      e.strafeDir = Math.random() < 0.5 ? -1 : 1;
      e.strafeTimer = 550 + Math.random() * 650;
    }
    const perpX = -distY / dist;
    const perpY = distX / dist;
    e.x += perpX * e.strafeDir * e.speed * 0.5 * step;
    e.y += perpY * e.strafeDir * e.speed * 0.5 * step;
    e.animKind = e.fireTimer < 260 ? 'attack' : 'walk';
    rpgTickAnim(e, species, step);
  }

  e.fireTimer -= dt;
  if (e.fireTimer <= 0 && dist <= maxD * 1.3) {
    rpgFireArrow(e, p, species);
    e.fireTimer = rpgRandRange(e.fireCooldownMs);
  }

  if (e.hitFlash > 0) e.hitFlash -= dt;
}

// Flecha del archer: a diferencia del dark_slash del jefe (siempre
// horizontal), apunta hacia la posición actual de Junior en el momento del
// disparo.
export function rpgFireArrow(e, p, species) {
  const dx = p.x - e.x;
  const dy = (p.y - 30) - (e.y - 45);
  const dist = Math.hypot(dx, dy) || 1;
  const proj = species.projectile;
  const speed = proj.speed || 3.3;
  RPG.enemyProjectiles.push({
    kind: 'arrow',
    x: e.x, y: e.y - 45,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    dmg: e.arrowDamage || 6,
    w: proj.w || 16, h: proj.h || 7,
    frameFly: proj.frameFly, frameHit: proj.frameHit,
    sheet: species.sheet, atlas: species.atlas
  });
}

// ─── Patrón "ghost" (fantasma teletransportador, capítulo 2) ─────
// Alterna entre una fase ACTIVA —igual que rpgUpdateRangedChase: mantiene
// una banda de distancia y dispara— y una fase de teletransporte: se
// desvanece (disappear, una sola vuelta del ciclo, sin loop), queda
// invisible e INTANGIBLE un instante (e.hidden — ver el skip en rpgDraw y
// el filtro de e2.hidden en el choque de balas de Junior, ambos en
// rpg_render.js/rpg_combat_input.js), reaparece (appear) en otro punto de
// la arena cerca de Junior y retoma la fase activa. e.ghostState guarda en
// qué parte de ese ciclo está: 'active' | 'disappearing' | 'hidden' | 'appearing'.
export function rpgUpdateGhost(e, p, cfg, C, dt, step) {
  const species = RPG_ENEMY_TYPES[e.species];

  if (e.hurtLock > 0) {
    e.hurtLock -= dt;
    e.animKind = 'hurt';
    rpgTickAnim(e, species, step);
    if (e.hitFlash > 0) e.hitFlash -= dt;
    return;
  }

  if (e.ghostState === 'disappearing') {
    const frames = species.anims.disappear;
    const prevFrame = e.animFrame;
    rpgTickAnim(e, species, step);
    if (e.animFrame === 0 && prevFrame === frames.length - 1) { // ciclo completo → ya no se ve
      e.hidden = true;
      e.ghostState = 'hidden';
      e.ghostTimer = rpgRandRange(species.teleportHiddenMs || [400, 700]);
      rpgPickGhostTeleportSpot(e, p, species, C);
    }
    return;
  }

  if (e.ghostState === 'hidden') {
    e.ghostTimer -= dt;
    if (e.ghostTimer <= 0) {
      e.hidden = false;
      e.ghostState = 'appearing';
      e.animKind = 'appear';
      e.animFrame = 0; e.animTick = 0;
    }
    return;
  }

  if (e.ghostState === 'appearing') {
    const frames = species.anims.appear;
    const prevFrame = e.animFrame;
    rpgTickAnim(e, species, step);
    if (e.animFrame === 0 && prevFrame === frames.length - 1) { // ciclo completo → retoma la IA normal
      e.ghostState = 'active';
      e.teleportTimer = rpgRandRange(species.teleportCooldownMs || [3500, 5500]);
      e.animKind = 'idle';
      e.animFrame = 0; e.animTick = 0;
    }
    return;
  }

  // ── Fase activa: cuenta regresiva hacia el próximo teletransporte ──
  e.teleportTimer -= dt;
  if (e.teleportTimer <= 0) {
    e.ghostState = 'disappearing';
    e.animKind = 'disappear';
    e.animFrame = 0; e.animTick = 0;
    return;
  }

  // Resto igual que rpgUpdateRangedChase (mantener distancia + strafe + disparo).
  const distX = p.x - e.x;
  const distY = p.y - e.y;
  const dist = Math.hypot(distX, distY) || 1;
  const [minD, maxD] = species.preferredDist || [90, 160];

  if (dist < minD) {
    e.x -= (distX / dist) * e.speed * step;
    e.y -= (distY / dist) * e.speed * step;
    e.animKind = 'walk';
    rpgTickAnim(e, species, step);
  } else if (dist > maxD) {
    e.x += (distX / dist) * e.speed * step;
    e.y += (distY / dist) * e.speed * step;
    e.animKind = 'walk';
    rpgTickAnim(e, species, step);
  } else {
    e.strafeTimer = (e.strafeTimer || 0) - dt;
    if (e.strafeTimer <= 0) {
      e.strafeDir = Math.random() < 0.5 ? -1 : 1;
      e.strafeTimer = 550 + Math.random() * 650;
    }
    const perpX = -distY / dist;
    const perpY = distX / dist;
    e.x += perpX * e.strafeDir * e.speed * 0.5 * step;
    e.y += perpY * e.strafeDir * e.speed * 0.5 * step;
    e.animKind = e.fireTimer < 260 ? 'attack' : 'walk';
    rpgTickAnim(e, species, step);
  }

  e.fireTimer -= dt;
  if (e.fireTimer <= 0 && dist <= maxD * 1.3) {
    rpgFireGhostBolt(e, p, species);
    e.fireTimer = rpgRandRange(e.fireCooldownMs);
  }

  if (e.hitFlash > 0) e.hitFlash -= dt;
}

// Elige dónde reaparece el fantasma: un punto a distancia
// teleportRangeDist de Junior (ángulo random alrededor suyo, achatado en Y
// para no salirse tanto del piso jugable como en X), descartado si termina
// a menos de teleportMinDist — 8 intentos y si ninguno sirve, se queda
// donde estaba (mejor que teletransportarse encima del jugador).
export function rpgPickGhostTeleportSpot(e, p, species, C) {
  const floor = rpgFloorBounds(C);
  const xMin = 24, xMax = RPG.worldWidth - 24;
  const [minD, maxD] = species.teleportRangeDist || species.preferredDist || [90, 200];
  for (let tries = 0; tries < 8; tries++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = minD + Math.random() * (maxD - minD);
    const x = Math.max(xMin, Math.min(xMax, p.x + Math.cos(angle) * dist));
    const y = Math.max(floor.top + 12, Math.min(floor.bottom - 8, p.y + Math.sin(angle) * dist * 0.4));
    if (Math.hypot(x - p.x, y - p.y) >= (species.teleportMinDist || 70)) {
      e.x = x; e.y = y;
      return;
    }
  }
}

// Bola de energía del fantasma: mismo mecanismo que rpgFireArrow (kind
// 'arrow' reutilizado a propósito — el dibujo ya rota cualquier frame
// según la velocidad real, sirve igual para una flecha que para un orbe).
export function rpgFireGhostBolt(e, p, species) {
  const dx = p.x - e.x;
  const dy = (p.y - 30) - (e.y - 45);
  const dist = Math.hypot(dx, dy) || 1;
  const proj = species.projectile;
  const speed = proj.speed || 3.2;
  RPG.enemyProjectiles.push({
    kind: 'arrow',
    x: e.x, y: e.y - 45,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    dmg: e.arrowDamage || 6,
    w: proj.w || 12, h: proj.h || 12,
    frameFly: proj.frameFly, frameHit: proj.frameHit,
    sheet: species.sheet, atlas: species.atlas
  });
}

// ─── Patrón "boss" (jefe final de capítulo) ─────
// El jefe se mueve LIBRE por toda la arena (ya no queda pegado a los
// costados) persiguiendo a Junior, y decide su ataque según 3 rangos de
// distancia (ver cfg.meleeRange/farRange en la config de la habitación):
//   ≤ meleeRange           → cuerpo a cuerpo (carga windup_1→4, conecta en attack_2)
//   meleeRange..farRange   → dash directo (solo fase 2+; en fase 1 se limita
//                             a acercarse caminando)
//   > farRange             → corte a distancia (siempre horizontal, mismo
//                             proyectil dark_slash de siempre)
// El dash telegrafía 1s (parpadeo) antes de salir y cubre
// cfg.dashDistanceMult veces la distancia que los separaba en ESE instante.
// Si un golpe (dash o cuerpo a cuerpo) conecta, el jefe se queda quieto
// postHitRecoveryMs reponiéndose antes de poder volver a actuar; si erra,
// sigue de largo sin esa pausa. La habilidad "invocar guerreros" (ver
// rpgSummonWarriors) es aparte y tiene su propio cooldown/telegraph,
// independiente del resto.
//   fase 1 (>50% HP): sin dash, solo proyectil chico
//   fase 2 (<=50% HP): dash habilitado, proyectiles chico y grande
//   fase 3 (<=25% HP): dash habilitado, solo proyectil grande
export function rpgGetBossPhase(e) {
  const ratio = e.hp / e.maxHp;
  if (ratio <= 0.25) return 3;
  if (ratio <= 0.5) return 2;
  return 1;
}

export function rpgFireRangeForPhase(cfg, phase) {
  if (phase === 1) return cfg.fireCooldownPhase1;
  if (phase === 2) return cfg.fireCooldownPhase2;
  return cfg.fireCooldownPhase3;
}

export function rpgOnBossPhaseChange(e, cfg, phase) {
  rpgUpdateEnemyLabel();
  e.hitFlash = 250;
}

// Poses del golpe cuerpo a cuerpo, en orden — ver RPG_ENEMY_TYPES.dark_knight.poses.
export const RPG_BOSS_WINDUP_POSES = ['windup1', 'windup2', 'windup3', 'windup4'];
export const RPG_BOSS_ATTACK_POSES = ['attack1', 'attack2', 'attack3'];
export const RPG_BOSS_MELEE_HIT_FRAME = 1; // attack2 — el frame en el que "conecta" el golpe

export function rpgUpdateBoss(e, p, cfg, C, dt, step) {
  const atk = e.attack;
  const species = RPG_ENEMY_TYPES[e.species];
  const phase = rpgGetBossPhase(e);
  if (phase !== e.phase) {
    e.phase = phase;
    rpgOnBossPhaseChange(e, cfg, phase);
  }
  if (e.hitFlash > 0) e.hitFlash -= dt;
  e.moving = false; // se prende de nuevo más abajo si el roam efectivamente lo mueve

  const floor = rpgFloorBounds(C);
  const marginX = 20;
  const xMin = marginX, xMax = RPG.worldWidth - marginX;
  const yMin = floor.top + 25, yMax = floor.bottom - 15;

  // Los cooldowns corren siempre, salvo el propio mientras el jefe está
  // metido en la animación de ESE ataque — así uno no bloquea a los otros
  // (ej: el dash se puede activar aunque el corte a distancia siga enfriando).
  if (atk.state !== 'meleeWindup' && atk.state !== 'meleeAttack') atk.meleeCd -= dt;
  if (atk.state !== 'rangedWindup') atk.rangedCd -= dt;
  if (phase >= 2 && atk.state !== 'dashTelegraph' && atk.state !== 'dashing') atk.dashCd -= dt;
  if (atk.state !== 'summonTelegraph') atk.summonCd -= dt;

  const distX = p.x - e.x;
  const distY = p.y - e.y;
  const dist = Math.hypot(distX, distY) || 1;
  const meleeRange = cfg.meleeRange || 46;
  const farRange = cfg.farRange || 200;

  // ── Recuperación tras conectar un golpe: bloquea todo (ni siquiera
  // invocar/dash pueden interrumpirla) hasta que se cumple el timer. ──
  if (atk.state === 'recover') {
    atk.timer -= dt;
    if (atk.timer <= 0) atk.state = 'roam';
    return;
  }

  // ── Invocar guerreros: prioridad máxima, pero no interrumpe un golpe o
  // dash ya en marcha (solo el roam / la espera antes de un corte). ──
  const interruptible = atk.state === 'roam' || atk.state === 'rangedWindup';
  const summonMinPhase = cfg.summonMinPhase || 1; // ver dark_ghostking: solo desde fase 2
  if (atk.summonCd <= 0 && phase >= summonMinPhase && interruptible) {
    atk.state = 'summonTelegraph';
    atk.timer = cfg.summonTelegraphMs || 700;
    atk.summonCd = cfg.summonCooldownMs || 20000;
  }

  if (atk.state === 'summonTelegraph') {
    // Se queda quieto levantando la espada (pose "summon") durante
    // summonTelegraphMs — es el aviso visual — y recién al final aparecen
    // los 2 guerreros.
    atk.timer -= dt;
    if (atk.timer <= 0) {
      rpgSummonWarriors(e, cfg, C);
      atk.state = 'roam';
    }
    return;
  }

  // ── Dash: solo desde fase 2, y solo mientras Junior esté en la franja
  // media (más cerca ya lo resuelve el cuerpo a cuerpo). Tampoco
  // interrumpe un golpe ya arrancado. ──
  if (phase >= 2 && dist > meleeRange && dist <= farRange && atk.dashCd <= 0 && interruptible) {
    // cfg.teleportBehind (ver dark_ghostking): en vez del embiste clásico,
    // desaparece y reaparece detrás tuyo para un arañazo — ver los 2
    // estados nuevos más abajo (teleportVanish/teleportAppear).
    atk.state = cfg.teleportBehind ? 'teleportVanish' : 'dashTelegraph';
    atk.timer = cfg.teleportBehind ? (cfg.teleportVanishMs || 300) : (cfg.dashTelegraphMs || 1000);
    atk.dashCd = rpgRandRange(cfg.dashCooldownMs);
  }

  if (atk.state === 'teleportVanish') {
    atk.timer -= dt;
    if (atk.timer <= 0) {
      // Aparece del lado OPUESTO al que estaba antes de desaparecer, así
      // se siente como que rodeó a Junior por la espalda.
      const appearDir = e.x > p.x ? -1 : 1;
      e.x = Math.max(xMin, Math.min(xMax, p.x + appearDir * (meleeRange * 0.75)));
      e.y = Math.max(yMin, Math.min(yMax, p.y + (Math.random() - 0.5) * 20));
      atk.state = 'teleportAppear';
      atk.timer = cfg.teleportAppearMs || 300;
    }
    return;
  }

  if (atk.state === 'teleportAppear') {
    atk.timer -= dt;
    if (atk.timer <= 0) {
      // Encadena directo al arañazo (attack1) sin volver a pasar por roam.
      atk.state = 'meleeWindup';
      atk.poseFrame = 0;
      atk.poseTick = 0;
    }
    return;
  }

  if (atk.state === 'dashTelegraph') {
    // Parpadeo (ver rpgDraw) durante todo el aviso — recién al terminar se
    // calcula el destino: dashDistanceMult veces la distancia que separa a
    // los dos EN ESE INSTANTE (1.5 = 3x lo que cubría la versión vieja,
    // que era la mitad).
    atk.timer -= dt;
    if (atk.timer <= 0) {
      const worldScale = RPG.worldWidth / RPG_LOGICAL_W;
      const eliteSpeedMult = rpgEliteActive() ? RPG_ELITE_SPEED_MULT : 1;
      const spd = (cfg.dashSpeed || 7) * worldScale * eliteSpeedMult;
      atk.vx = (distX / dist) * spd;
      atk.vy = (distY / dist) * spd;
      atk.dashTraveled = 0;
      atk.dashTarget = dist * (cfg.dashDistanceMult != null ? cfg.dashDistanceMult : 0.5);
      atk.hit = false;
      atk.state = 'dashing';
    }
    return;
  }

  if (atk.state === 'dashing') {
    const moveLen = Math.hypot(atk.vx, atk.vy) * step;
    e.x = Math.max(xMin, Math.min(xMax, e.x + atk.vx * step));
    e.y = Math.max(yMin, Math.min(yMax, e.y + atk.vy * step));
    atk.dashTraveled += moveLen;

    if (!atk.hit && rpgOverlap(
      e.x, e.y - 40, 70, 90,
      p.x, p.y + RPG_PLAYER_HITBOX.yOff, RPG_PLAYER_HITBOX.w, RPG_PLAYER_HITBOX.h
    )) {
      rpgPlayerHit(cfg.dashDamage * (rpgEliteActive() ? RPG_ELITE_STAT_MULT : 1), { fullyBlockable: true });
      atk.hit = true;
    }

    if (atk.dashTraveled >= atk.dashTarget) {
      // Si conectó, se queda repuniéndose antes de poder volver a moverse
      // o atacar; si erró, sigue de largo directo al roam.
      if (atk.hit) { atk.state = 'recover'; atk.timer = cfg.postHitRecoveryMs || 2000; }
      else atk.state = 'roam';
    }
    return;
  }

  // phaseAttackSpeedMult/phaseDamageMult (ver dark_ghostking): opcionales,
  // dark_knight no los define y quedan en 1 (sin cambio de comportamiento).
  const atkSpeedMult = cfg.phaseAttackSpeedMult ? (cfg.phaseAttackSpeedMult[phase - 1] || 1) : 1;
  const dmgMult = cfg.phaseDamageMult ? (cfg.phaseDamageMult[phase - 1] || 1) : 1;

  if (atk.state === 'meleeWindup') {
    atk.poseTick += dt;
    const frameMs = (cfg.meleeWindupFrameMs || 90) / atkSpeedMult;
    const windupLen = (species.meleeWindupPoseKeys || RPG_BOSS_WINDUP_POSES).length;
    if (atk.poseTick >= frameMs) {
      atk.poseTick -= frameMs;
      atk.poseFrame++;
      if (atk.poseFrame >= windupLen) {
        atk.state = 'meleeAttack';
        atk.poseFrame = 0;
        atk.poseTick = 0;
        atk.hit = false;
      }
    }
    return;
  }

  if (atk.state === 'meleeAttack') {
    atk.poseTick += dt;
    const frameMs = (cfg.meleeAttackFrameMs || 90) / atkSpeedMult;
    const attackLen = (species.meleeAttackPoseKeys || RPG_BOSS_ATTACK_POSES).length;
    const hitFrame = species.meleeHitFrame != null ? species.meleeHitFrame : RPG_BOSS_MELEE_HIT_FRAME;
    if (!atk.hit && atk.poseFrame === hitFrame) {
      if (dist <= meleeRange + 12) {
        rpgPlayerHit(cfg.meleeDamage * dmgMult * (rpgEliteActive() ? RPG_ELITE_STAT_MULT : 1));
      }
      atk.hit = true;
    }
    if (atk.poseTick >= frameMs) {
      atk.poseTick -= frameMs;
      atk.poseFrame++;
      if (atk.poseFrame >= attackLen) {
        atk.meleeCd = rpgRandRange(cfg.meleeCooldownMs);
        // Mismo criterio que el dash: solo hay pausa de recuperación si
        // el golpe conectó de verdad.
        if (atk.hit) { atk.state = 'recover'; atk.timer = cfg.postHitRecoveryMs || 2000; }
        else atk.state = 'roam';
      }
    }
    return;
  }

  if (atk.state === 'rangedWindup') {
    atk.poseTick += dt;
    if (atk.poseTick >= (cfg.rangedWindupMs || 260)) {
      if (cfg.bossBoltProjectile) rpgFireBossBolt(e, p, cfg, phase);
      else rpgFireBossProjectile(e, p, cfg, phase);
      atk.rangedCd = rpgRandRange(rpgFireRangeForPhase(cfg, phase));
      // Pose de lanzamiento breve (ver dark_ghostking.poses.rangedAttack) —
      // si la especie no la define (dark_knight), va directo a roam como
      // siempre.
      atk.state = species.poses.rangedAttack ? 'rangedAttack' : 'roam';
      atk.timer = cfg.rangedAttackFrameMs || 150;
    }
    return;
  }

  if (atk.state === 'rangedAttack') {
    atk.timer -= dt;
    if (atk.timer <= 0) atk.state = 'roam';
    return;
  }

  // ── 'roam' (estado por defecto): se acerca a Junior y decide el
  // próximo ataque según la distancia actual (ver los 3 rangos arriba). ──
  if (dist <= meleeRange && atk.meleeCd <= 0) {
    atk.state = 'meleeWindup';
    atk.poseFrame = 0; atk.poseTick = 0;
    return;
  }
  if (dist > farRange && atk.rangedCd <= 0) {
    atk.state = 'rangedWindup';
    atk.poseFrame = 0; atk.poseTick = 0;
    return;
  }
  if (dist > 4) {
    const eliteSpeedMult = rpgEliteActive() ? RPG_ELITE_SPEED_MULT : 1;
    const phaseSpeedMult = cfg.phaseSpeedMult ? (cfg.phaseSpeedMult[phase - 1] || 1) : 1;
    const move = Math.min(dist, cfg.enemySpeed * eliteSpeedMult * phaseSpeedMult * step * 2.2);
    e.x = Math.max(xMin, Math.min(xMax, e.x + (distX / dist) * move));
    e.y = Math.max(yMin, Math.min(yMax, e.y + (distY / dist) * move));
    e.moving = true;
  }
  // Ciclo de caminata (8 frames, ver RPG_ENEMY_TYPES.dark_knight.walkPoses) —
  // solo avanza mientras se está moviendo de verdad; parado, rpgDrawEnemy
  // cae directo a la pose "idle" (ver render).
  if (e.moving) {
    e.animTick += step;
    if (e.animTick >= 8) { e.animTick = 0; e.animFrame = (e.animFrame + 1) % 8; }
  } else {
    e.animTick = 0;
  }
}

// dir/posición del corte ahora se recalculan en cada disparo según de qué
// lado esté Junior en ESE instante (antes dependía de e.side, un costado
// fijo) — el corte sigue viajando solo horizontal, nunca en diagonal.
export function rpgFireBossProjectile(e, p, cfg, phase) {
  let size;
  if (phase === 1) size = 'small';
  else if (phase === 3) size = 'big';
  else size = Math.random() < 0.5 ? 'small' : 'big';

  const dir = p.x >= e.x ? 1 : -1;
  // projectileSmallSpeed/BigSpeed están calibradas para un mundo de 480 —
  // se escalan para cruzar el mundo actual en el mismo tiempo de siempre.
  const worldScale = RPG.worldWidth / RPG_LOGICAL_W;
  const speed = (size === 'small' ? cfg.projectileSmallSpeed : cfg.projectileBigSpeed) * worldScale;
  const dmg = (size === 'small' ? cfg.projectileSmallDmg : cfg.projectileBigDmg) * (rpgEliteActive() ? RPG_ELITE_STAT_MULT : 1);

  RPG.enemyProjectiles.push({
    kind: 'slash',
    x: e.x + dir * 34,
    y: e.y - 45,
    vx: dir * speed,
    vy: 0,
    dir, // 1 = viaja a la derecha (sprite normal), -1 = izquierda (sprite espejado)
    size,
    dmg,
    w: size === 'small' ? 16 : 30,
    h: size === 'small' ? 16 : 24,
    animFrame: 1, // dark_slash tiene frames "_1" y "_2" por variante
    animTick: 0
  });
}

// Proyectil a distancia del Guardián (dark_ghostking): a diferencia del
// corte del dark_knight (kind 'slash', horizontal, con tamaño chico/
// grande), este es un solo proyectil que viaja en línea recta hacia
// Junior y EXPLOTA al chocar (ver explodeFrames/rpgUpdateEnemyProjectiles)
// en vez de desaparecer solo. Reutiliza kind 'arrow' (rotación según
// velocidad real, ver rpgDraw) porque encaja mejor con un cometa girando
// hacia el objetivo que con el corte horizontal espejado del otro jefe.
export function rpgFireBossBolt(e, p, cfg, phase) {
  const spec = cfg.bossBoltProjectile;
  const dmgMult = cfg.phaseDamageMult ? (cfg.phaseDamageMult[phase - 1] || 1) : 1;
  const dx = p.x - e.x, dy = (p.y - 30) - (e.y - 45);
  const dist = Math.hypot(dx, dy) || 1;
  const speed = (spec.speed || 3) * (RPG.worldWidth / RPG_LOGICAL_W);
  RPG.enemyProjectiles.push({
    kind: 'arrow',
    x: e.x, y: e.y - 45,
    vx: (dx / dist) * speed, vy: (dy / dist) * speed,
    dmg: spec.dmg * dmgMult * (rpgEliteActive() ? RPG_ELITE_STAT_MULT : 1),
    w: spec.w || 14, h: spec.h || 14,
    drawH: spec.drawH || 16, // más grande que una flecha común (ver targetH en rpgDraw)
    frameFly: spec.frameFly, sheet: spec.sheet, atlas: spec.atlas,
    explodeFrames: spec.explodeFrames, explodeFrameMs: spec.explodeFrameMs,
    explodeSheet: spec.explodeSheet || spec.sheet, explodeAtlas: spec.explodeAtlas || spec.atlas
  });
}

// ─── Creación de enemigos a partir de una lista de spawns ─────
// Reusada tanto por rpgStartRoom (oleada inicial, o única lista si la sala
// no usa `waves`) como por rpgSpawnNextWave (oleadas siguientes). Antes
// vivía inline dentro de rpgStartRoom — se sacó para no duplicar toda esta
// lógica al agregar el sistema de oleadas.
export function rpgCreateEnemies(spawns, cfg, floorNow, eliteStatMult, eliteSpeedMult) {
  const n = spawns.length;
  // Reparto automático (solo se usa para spawns SIN `pos` manual, ver abajo).
  const marginX = Math.max(60, RPG.worldWidth * 0.1);
  const desiredSafeX = RPG.player.x + Math.max(RPG_SPAWN_SAFE_DIST, RPG_LOGICAL_W * 1.05);
  const safeStartX = Math.min(
    Math.max(marginX, desiredSafeX),
    Math.max(marginX, RPG.worldWidth - marginX - 40) // no te pases del final del mundo
  );
  const spanX = Math.max(20, (RPG.worldWidth - marginX) - safeStartX);
  const yTiers = [0.22, 0.5, 0.78];

  return spawns.map((spawn, idx) => {
    const species = RPG_ENEMY_TYPES[spawn.species];
    const e = {
      species: spawn.species,
      x: 0, y: 0,
      hp: spawn.hp * eliteStatMult, maxHp: spawn.hp * eliteStatMult,
      speed: (spawn.speed || 0.8) * eliteSpeedMult,
      contactDamage: (spawn.contactDamage || 0) * eliteStatMult,
      arrowDamage: (spawn.arrowDamage || 0) * eliteStatMult,
      fireCooldownMs: spawn.fireCooldownMs || [1500, 2200],
      fireTimer: 0,
      animFrame: 0, animTick: 0,
      animKind: 'idle', // 'idle' | 'walk' | 'attack' | 'hurt' | 'death' — decide qué ciclo de rpgDrawEnemy usar
      contactCooldown: 0,
      attackHitApplied: false, // evita que un mismo swing de ataque golpee más de una vez (ver rpgUpdateSimpleChase)
      hitFlash: 0,
      hurtLock: 0, // ms restantes reaccionando a un golpe (pausa la IA y muestra la pose "hurt")
      burnTicksLeft: 0, // ticks de 1hp restantes de la quemadura (esfera azul), ver rpgUpdate
      burnTimer: 0,     // ms hasta el próximo tick de quemadura
      alive: true,
      side: 'left',
      phase: 1,
      moving: false, // solo lo usa el jefe (ver rpgUpdateBoss/rpgDraw) para elegir entre pose idle y ciclo de caminata
      // Estado del patrón de ataque especial del jefe — se pisa por completo
      // más abajo si attackPattern === 'boss'; el resto de las especies lo
      // ignora (queda con este valor por defecto sin usarlo nunca).
      attack: { state: 'idle', timer: 1200, vx: 0, vy: 0, hit: false }
    };
    if (cfg.attackPattern === 'boss') {
      // Ya no arranca pegado a un costado fijo (ver rpgUpdateBoss): entra
      // por el lado derecho de la arena, a distancia prudente de Junior,
      // y de ahí en más se mueve libre.
      e.x = RPG.worldWidth * 0.78;
      e.y = RPG_LOGICAL_H * 0.72;
      e.attack = {
        state: 'roam',
        timer: 0,
        vx: 0, vy: 0, hit: false,
        poseFrame: 0, poseTick: 0,
        meleeCd: rpgRandRange(cfg.meleeCooldownMs),
        rangedCd: rpgRandRange(cfg.fireCooldownPhase1),
        dashCd: rpgRandRange(cfg.dashCooldownMs),
        summonCd: cfg.summonCooldownMs || 20000 // ver rpgSummonWarriors
      };
    } else if (spawn.pos) {
      // ── Posición manual (fracciones 0-1 de worldWidth / del alto del
      // piso jugable) ── Para hordas/oleadas donde cada enemigo necesita
      // un lugar estratégico puntual en vez del reparto parejo automático
      // (ver el else de abajo). spawn.pos = { x: 0-1, y: 0-1 }.
      e.x = spawn.pos.x * RPG.worldWidth;
      e.y = floorNow.top + (floorNow.bottom - floorNow.top) * spawn.pos.y;
      e.fireTimer = rpgRandRange(e.fireCooldownMs);
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
      e.fireTimer = rpgRandRange(e.fireCooldownMs);
    }
    // Embestida ocasional (ver species.dashAbility / rpgUpdateSimpleChase):
    // cooldown inicial random por instancia, así 2 enemigos de la misma
    // especie en la misma sala no embisten sincronizados.
    if (species.dashAbility) {
      e.dashState = null;
      e.dashCd = rpgRandRange(species.dashAbility.cooldownMs);
    }
    // Fantasma teletransportador (ver rpgUpdateGhost): arranca en fase
    // activa, con su propio cooldown random hasta el primer teletransporte
    // (así 2 ghost en la misma sala no se desvanecen sincronizados).
    // e.hidden es lo que rpgDraw y el choque de balas de Junior chequean
    // para tratarlo como invisible/intangible mientras dura el teletransporte.
    if (species.behavior === 'ghost') {
      e.hidden = false;
      e.ghostState = 'active';
      e.teleportTimer = rpgRandRange(species.teleportCooldownMs || [3500, 5500]);
    }
    return e;
  });
}

// ─── Sistema de oleadas/hordas (sala con cfg.waves) ─────
// Se dispara desde rpgEnemyHit cuando a la oleada actual le queda
// `cfg.waveTriggerRemaining` (default 1) o menos enemigos vivos y todavía
// hay una oleada siguiente en cfg.waves. Los enemigos nuevos se SUMAN a
// RPG.enemies (los que quedan vivos de la oleada anterior siguen en juego,
// no se pisan) — así el jugador termina de limpiar la horda anterior
// mientras ya está lidiando con la nueva.
export function rpgSpawnNextWave(cfg) {
  RPG.waveIndex++;
  const floorNow = rpgFloorBounds(RPG.canvas);
  const eliteStatMult = rpgEliteActive() ? RPG_ELITE_STAT_MULT : 1;
  const eliteSpeedMult = rpgEliteActive() ? RPG_ELITE_SPEED_MULT : 1;
  const newEnemies = rpgCreateEnemies(cfg.waves[RPG.waveIndex], cfg, floorNow, eliteStatMult, eliteSpeedMult);
  RPG.enemies.push(...newEnemies);
  rpgUpdateHudBars();
  rpgUpdateEnemyLabel();
  // Cartel en pantalla (ver RPG.banner / rpgDraw) — solo si esta sala en
  // particular lo pidió con cfg.waveBannerText (ver comentario en la sala 1
  // del capítulo 2, rpg_enemies_data.js).
  if (cfg.waveBannerText) {
    const durationMs = 2200;
    RPG.banner = { text: cfg.waveBannerText, timer: durationMs, durationMs };
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
export function rpgSummonWarriors(e, cfg, C) {
  const floor = rpgFloorBounds(C);
  const midY = (floor.top + floor.bottom) / 2;
  const specs = cfg.summonSpecies || [
    { species: 'kn_warror', hp: 50, speed: 1.0, contactDamage: 10 },
    { species: 'kn_warror', hp: 50, speed: 1.0, contactDamage: 10 }
  ];
  const sides = specs.length === 1 ? ['center'] : ['left', 'right'];
  specs.forEach((s, i) => {
    const side = sides[i] || 'left';
    const sSpecies = RPG_ENEMY_TYPES[s.species];
    const enemy = {
      species: s.species,
      x: side === 'center' ? RPG.worldWidth / 2 : rpgSideX(side, cfg, C),
      y: midY + (Math.random() - 0.5) * (floor.bottom - floor.top) * 0.3,
      hp: s.hp, maxHp: s.hp,
      speed: s.speed != null ? s.speed : 1.0,
      contactDamage: s.contactDamage || 0,
      arrowDamage: s.arrowDamage || 0,
      fireCooldownMs: s.fireCooldownMs || [1500, 2200],
      fireTimer: 0,
      animFrame: 0, animTick: 0,
      animKind: 'idle',
      contactCooldown: 0,
      attackHitApplied: false,
      hitFlash: 0,
      hurtLock: 0,
      burnTicksLeft: 0,
      burnTimer: 0,
      alive: true,
      side,
      phase: 1,
      attack: { state: 'idle', timer: 1200, vx: 0, vy: 0, hit: false }
    };
    // Especie 'ghost' (teletransportador, ver rpgUpdateGhost): necesita
    // estos 3 campos propios además de lo de arriba — sin esto arrancaría
    // "vivo" pero nunca se desvanecería/reaparecería (rpgUpdateGhost los
    // da por puestos, ver rpgCreateEnemies).
    if (sSpecies && sSpecies.behavior === 'ghost') {
      enemy.hidden = false;
      enemy.ghostState = 'active';
      enemy.teleportTimer = rpgRandRange(sSpecies.teleportCooldownMs || [3500, 5500]);
    }
    RPG.enemies.push(enemy);
  });
  rpgUpdateHudBars(); // el jefe sigue teniendo su propia barra (ver rpgUpdateHudBars) — esto solo refresca el label
  rpgUpdateEnemyLabel();
}

export function rpgUpdateEnemyProjectiles(dt, step) {
  const C = RPG.canvas;
  const p = RPG.player;
  for (let i = RPG.enemyProjectiles.length - 1; i >= 0; i--) {
    const pr = RPG.enemyProjectiles[i];

    // Proyectil que ya chocó y está en su animación de explosión (ver
    // pr.explodeFrames más abajo, y rpgFireBossBolt) — se queda quieto en
    // el punto de impacto ciclando esos frames y recién ahí desaparece; no
    // vuelve a chocar de nuevo (el daño ya se aplicó una sola vez, al
    // momento del impacto).
    if (pr.exploding) {
      pr.explodeTick += dt;
      const frameMs = pr.explodeFrameMs || 90;
      pr.explodeFrameIdx = Math.min(pr.explodeFrames.length - 1, Math.floor(pr.explodeTick / frameMs));
      if (pr.explodeTick >= frameMs * pr.explodeFrames.length) RPG.enemyProjectiles.splice(i, 1);
      continue;
    }

    pr.x += pr.vx * step;
    pr.y += pr.vy * step;
    if (pr.kind === 'slash') {
      // El dark_slash del jefe anima entre sus 2 frames por variante.
      pr.animTick += step;
      if (pr.animTick >= 6) { pr.animTick = 0; pr.animFrame = pr.animFrame === 1 ? 2 : 1; }
    }
    if (pr.x < -40 || pr.x > RPG.worldWidth + 40 || pr.y < -40 || pr.y > RPG_LOGICAL_H + 40) {
      RPG.enemyProjectiles.splice(i, 1);
      continue;
    }
    if (rpgOverlap(
      pr.x, pr.y, pr.w, pr.h,
      p.x, p.y + RPG_PLAYER_HITBOX.yOff, RPG_PLAYER_HITBOX.w, RPG_PLAYER_HITBOX.h
    )) {
      rpgPlayerHit(pr.dmg, { fullyBlockable: true });
      if (pr.explodeFrames) {
        // No se borra todavía: pasa a explotar en el lugar (ver arriba).
        pr.exploding = true;
        pr.explodeTick = 0;
        pr.explodeFrameIdx = 0;
      } else {
        RPG.enemyProjectiles.splice(i, 1);
      }
    }
  }
}

// ─── Pociones ─────
// (Sistema de pociones en el suelo eliminado — ya no se usa.)

export function rpgOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;
}

export function rpgPlayerHit(dmg, opts) {
  const p = RPG.player;
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
  if (RPG.upgrades.dmgReduction > 0) finalDmg = Math.round(finalDmg * (1 - RPG.upgrades.dmgReduction));
  p.hp = Math.max(0, p.hp - finalDmg);
  p.hitFlash = 200;
  if (p.hp <= 0 && RPG_META.totem && !RPG.totemUsed) rpgActivateTotem();
  rpgUpdateHudBars();
  if (p.hp <= 0) rpgGameOver();
}

// Tótem (mejora de la tienda): en vez de morir, vuelve con RPG_TOTEM_HEAL
// de vida y queda inmune RPG_TOTEM_INVULN_MS. Una vez por capítulo.
export function rpgActivateTotem() {
  const p = RPG.player;
  RPG.totemUsed = true;
  p.hp = Math.min(p.maxHp, RPG_TOTEM_HEAL);
  p.invulnTimer = RPG_TOTEM_INVULN_MS;
  p.hitFlash = 0;
  RPG.banner = { text: '¡Tótem activado!', timer: 1800, durationMs: 1800 };
}

// dmg ahora se aplica a un enemigo puntual `e` (puede haber varios vivos
// a la vez). La habitación se gana recién cuando TODOS están muertos.
export function rpgEnemyHit(e, dmg) {
  if (!e.alive) return;
  e.hp = Math.max(0, e.hp - dmg);
  e.hitFlash = 150;
  e.animKind = 'hurt';
  e.animFrame = 0; e.animTick = 0;
  e.hurtLock = 220; // breve pausa de reacción antes de retomar la IA
  rpgUpdateHudBars();
  if (e.hp <= 0) {
    e.alive = false;
    e.hurtLock = 0;
    e.animKind = 'death';
    e.animFrame = 0; e.animTick = 0;
    // Los enemigos muertos ya no pasan por el resto de rpgUpdate (ver el
    // primer if de ese loop), así que hitFlash nunca se terminaba de
    // descontar solo — el cuerpo se quedaba semitransparente para siempre.
    // Se corta acá mismo, de una.
    e.hitFlash = 0;
    // Congela la orientación en el instante de morir: si no, el cuerpo
    // "sigue mirando" hacia donde esté Junior en cada frame siguiente,
    // como si el muerto lo persiguiera con la vista.
    e.deathFlip = e.x > RPG.player.x;
    rpgUpdateEnemyLabel();

    const species = RPG_ENEMY_TYPES[e.species];
    if (species && species.behavior === 'boss') {
      // El jefe: su muerte SIEMPRE termina el combate, sin esperar a que
      // mueran también los kn_warror que haya invocado (ver
      // rpgSummonWarriors) — la pelea terminó, así que se descartan.
      // rpgStartBossDeathSequence se encarga de la cinemática + el cofre.
      RPG.enemies = [e];
      rpgStartBossDeathSequence(e, rpgRoomCfg());
      return;
    }
    // ── Horda/oleadas ── Si la sala define `waves` y todavía queda alguna
    // por salir, no se declara victoria apenas se vacía RPG.enemies: se
    // revisa cuántos siguen vivos de la oleada actual y, si son pocos
    // (cfg.waveTriggerRemaining, default 1), se llama a la siguiente en vez
    // de terminar el combate. Recién cuando ya no quedan más oleadas Y
    // todos están muertos se llama a rpgVictory (misma condición de
    // siempre para salas sin `waves`).
    const aliveCount = RPG.enemies.filter(en => en.alive).length;
    const roomCfg = rpgRoomCfg();
    if (roomCfg && roomCfg.waves && RPG.waveIndex < roomCfg.waves.length - 1
        && aliveCount <= (roomCfg.waveTriggerRemaining || 1)) {
      rpgSpawnNextWave(roomCfg);
    } else if (RPG.enemies.every(en => !en.alive)) {
      rpgVictory();
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
export function rpgStartBossDeathSequence(e, cfg) {
  rpgStopLoop(); // corta el loop de juego — de acá en más es todo cinemática
  const species = RPG_ENEMY_TYPES[e.species];
  rpgPlayBossDeathFall(e, [1, 2], () => {
    const lines = (cfg && cfg.deathDialogue) || [];
    // dissolveOnDeath (ver dark_ghostking): en vez de una 2da caída — que
    // para este jefe repetiría el mismo frame, no tiene death3/4 — el
    // cuerpo se disuelve DEL TODO apenas termina el diálogo (e.vanished,
    // ver el chequeo en rpgDraw): es un fantasma, no deja un cadáver.
    const finishAfterDialogue = species && species.dissolveOnDeath
      ? () => { e.vanished = true; rpgFinishBossDeath(); }
      : () => rpgPlayBossDeathFall(e, [3, 4], () => rpgFinishBossDeath());
    if (!lines.length) { finishAfterDialogue(); return; }
    rpgStartDialogue(lines, finishAfterDialogue);
  });
}

export function rpgFinishBossDeath() {
  rpgVictory();
  RPG.running = true;
  RPG.raf = requestAnimationFrame(rpgLoop);
}

// Corre su propio loop liviano (solo dibuja, no hay física/IA que
// actualizar) para animar 2 frames de caída del jefe, igual que
// rpgDialogueLoop hace con el diálogo. `frames` es el par [inicio, fin] de
// e.deathFrame a usar (ver RPG_ENEMY_TYPES.dark_knight.poses: death1..4) —
// [1,2] para la primera caída, [3,4] para la segunda tras el diálogo.
// onDone se llama al terminar de sostener el frame final — el llamador
// decide qué sigue (diálogo, otra caída, o terminar la secuencia).
export const RPG_BOSS_DEATH_FRAME_MS = 260;
export const RPG_BOSS_DEATH_HOLD_MS = 300; // pausa en el frame final antes de onDone
export function rpgPlayBossDeathFall(e, frames, onDone) {
  const [frameStart, frameEnd] = frames;
  e.deathFrame = frameStart;
  let elapsed = 0;
  let last = 0;
  function step(ts) {
    const dt = last ? Math.min(ts - last, 50) : 16;
    last = ts;
    elapsed += dt;
    if (e.deathFrame === frameStart && elapsed >= RPG_BOSS_DEATH_FRAME_MS) e.deathFrame = frameEnd;
    rpgDraw();
    if (elapsed < RPG_BOSS_DEATH_FRAME_MS + RPG_BOSS_DEATH_HOLD_MS) {
      RPG.raf = requestAnimationFrame(step);
    } else {
      onDone();
    }
  }
  RPG.raf = requestAnimationFrame(step);
}

// Barra de HP del enemigo: en habitaciones con varios enemigos muestra el
// HP TOTAL sumado (todos cuentan igual), en la del jefe es simplemente su
// única barra (RPG.enemies tiene 1 solo elemento ahí).
export function rpgUpdateHudBars() {
  const p = RPG.player;
  const pFill = RPG_EL.playerHpFill;
  const eFill = RPG_EL.enemyHpFill;
  const pText = RPG_EL.playerHpText;
  const pct = Math.max(0, p.hp / p.maxHp);
  if (pFill) pFill.style.width = (pct * 100) + '%';
  if (pText) pText.textContent = Math.max(0, Math.round(p.hp)) + '/' + p.maxHp;

  // Expresión de Junior según % de vida (usa expresiones.webp vía CSS) y
  // temblor leve del HUD cuando queda al 25% o menos.
  const avatar = RPG_EL.playerAvatar;
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
    const roomCfg = rpgRoomCfg();
    if (roomCfg && roomCfg.type === 'boss' && RPG.enemies[0]) {
      const boss = RPG.enemies[0];
      eFill.style.width = Math.max(0, (Math.max(0, boss.hp) / boss.maxHp) * 100) + '%';
    } else {
      const totalMax = RPG.enemies.reduce((s, e) => s + e.maxHp, 0) || 1;
      const totalHp = RPG.enemies.reduce((s, e) => s + Math.max(0, e.hp), 0);
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
export function rpgBuildUpgradesSummaryHtml() {
  const u = RPG.upgrades;
  const img = RPG.images[RPG_POWERUP_SHEET];
  const rows = [];

  if (u.maxHpBonus > 0) rows.push(rpgUpgradeRowHtml(img, 'potionGreen', '+' + u.maxHpBonus + ' HP máx'));
  if (u.dmgBonus > 0) rows.push(rpgUpgradeRowHtml(img, 'ammo', '+' + u.dmgBonus + ' daño'));
  if (u.coins > 0) rows.push(rpgUpgradeRowHtml(img, 'coins', u.coins + ' monedas'));

  if (u.dmgReduction > 0) rows.push(rpgUpgradeIconOnlyHtml(img, 'armor'));
  if (u.doubleShot) rows.push(rpgUpgradeIconOnlyHtml(img, 'gun'));
  if (u.burning) rows.push(rpgUpgradeIconOnlyHtml(img, 'blueOrb'));
  if (u.speedPermanent) rows.push(rpgUpgradeIconOnlyHtml(img, 'potionOrange'));
  if (RPG_META.totem) {
    rows.push('<div class="rpg-reward-row"><span class="rpg-reward-label">Tótem: ' +
      (RPG.totemUsed ? 'usado en este capítulo' : 'listo') + '</span></div>');
  }

  if (rows.length === 0) return '<p class="rpg-pause-empty">Todavía no juntaste nada este intento.</p>';
  return '<div class="rpg-reward-list">' + rows.join('') + '</div>';
}

export function rpgUpgradeRowHtml(img, key, label) {
  const rect = RPG_POWERUP_ICONS[key];
  const iconHtml = (img && rect) ? '<img class="rpg-reward-icon" src="' + rpgIconToDataUrl(img, rect, 32) + '" alt="">' : '';
  return '<div class="rpg-reward-row">' + iconHtml + '<span class="rpg-reward-label">' + label + '</span></div>';
}

export function rpgUpgradeIconOnlyHtml(img, key) {
  const rect = RPG_POWERUP_ICONS[key];
  if (!img || !rect) return '';
  return '<div class="rpg-reward-row rpg-reward-row-icon-only"><img class="rpg-reward-icon" src="' + rpgIconToDataUrl(img, rect, 32) + '" alt=""></div>';
}

export function rpgUpdateHudAmmo() {
  const p = RPG.player;
  const el = RPG_EL.ammoText;
  if (!el) return;
  if (p.reloading) {
    el.textContent = 'Recargando…';
    el.classList.add('rpg-ammo-reloading');
  } else {
    el.textContent = p.ammo + '/' + RPG_PLAYER_MAX_AMMO;
    el.classList.remove('rpg-ammo-reloading');
  }
}

export function rpgUpdateHudTimer() {
  const el = RPG_EL.timeLeft;
  if (!el) return;
  if (RPG.timeLimitMs == null) { el.textContent = ''; return; }
  const remainMs = Math.max(0, RPG.timeLimitMs - RPG.combatElapsed);
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
export function rpgGameOver(title, sub) {
  rpgStopLoop();
  rpgEraseActiveSlot();
  const roomCfg = rpgRoomCfg();
  const foeLabel = roomCfg.enemyName || 'Los enemigos';
  rpgSetOverlay(
    title || '💀 Derrota',
    sub || (foeLabel + ' fueron más fuertes esta vez. La partida se borró — volvé al menú para empezar de nuevo.'),
    '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgShowMenu()">← Volver al menú</button>'
  );
  RPG_EL.overlay.classList.remove('hidden');
}

// ─── Victoria de una habitación ─────
// Si es una habitación normal (1-4), aparece un cofre de plata y se pasa
// a la siguiente. Si es la habitación 5 (jefe), aparece un cofre de ORO
// garantizado — el único lugar del juego donde puede salir — y recién al
// recogerlo (ver rpgCollectChestReward) se completa el capítulo.
export function rpgVictory() {
  const room = RPG.room;
  const chapterCfg = rpgChapterCfg();
  const roomCfg = chapterCfg.rooms[room];

  if (roomCfg.type === 'boss') {
    RPG.chestIsBossReward = true;
    rpgSpawnChest('gold');
    return;
  }

  // Habitación normal: sin cartel — se destraba la puerta del borde
  // derecho (ver rpgUpdate) y Junior pasa a la siguiente caminando.
  // Mejora permanente "Cofre inicial garantizado": el primer cofre del
  // Capítulo 1 (habitación 1) sale siempre de oro en vez de plata.
  RPG.roomCleared = true;
  const forceGoldChest = RPG_META.guaranteedFirstChest && RPG.chapter === 1 && room === 1;
  rpgSpawnChest(forceGoldChest ? 'gold' : 'iron');
}

// ─── Cofre de recompensa ─────
// Plata: sale siempre en habitaciones normales (1-4) al vaciarlas. Oro:
// SOLO sale al matar al jefe de la habitación 5 (ver rpgVictory) — ya no
// es un chance aleatorio en habitaciones normales. Se ubica siempre en el
// centro horizontal de la habitación (worldWidth / 2), sin importar dónde
// esté parado Junior ni dónde quede la puerta de salida.
export function rpgSpawnChest(type) {
  const C = RPG.canvas;
  const floor = rpgFloorBounds(C);
  RPG.chest = {
    type: type || 'iron',
    x: RPG.worldWidth / 2,
    y: (floor.top + floor.bottom) / 2,
    frame: 0,
    animTick: 0,
    opening: false,
    opened: false
  };
}

// ─── Completar capítulo (guardado) ─────
export function rpgCompleteChapter() {
  rpgStopLoop(); // el cofre de oro del jefe deja el loop corriendo hasta recogerlo
  const chapterIdx = RPG.chapter;
  const chapterCfg = RPG_CHAPTERS[chapterIdx];
  const nextChapterIdx = chapterIdx + 1;
  const hasNext = !!RPG_CHAPTERS[nextChapterIdx];

  if (RPG.activeSlot) {
    const save = RPG.save || rpgNewSaveData();
    if (!save.chaptersCompleted.includes(chapterIdx)) save.chaptersCompleted.push(chapterIdx);
    save.chapterUnlocked = Math.max(save.chapterUnlocked, hasNext ? nextChapterIdx : chapterIdx);
    save.updatedAt = Date.now();
    RPG.save = save;
    rpgSaveSlotData(RPG.activeSlot, save);
  }

  rpgSetOverlay(
    '🏆 ¡Capítulo superado!',
    'Derrotaste a ' + chapterCfg.rooms[5].enemyName + ' y completaste ' + chapterCfg.name + '. Partida guardada.',
    (hasNext
      ? '<button class="btn-play" onclick="rpgStartChapter(' + nextChapterIdx + ', true)">▶ Siguiente capítulo</button>'
      : '') +
    '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgShowMenu()">← Volver al menú</button>'
  );
  RPG_EL.overlay.classList.remove('hidden');
}

// ─── Draw ─────
