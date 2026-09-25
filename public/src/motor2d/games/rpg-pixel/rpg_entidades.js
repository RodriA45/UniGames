// ══════════════════════════════════════
//   RPG Pixel — rpg_entidades.js  (módulo ES6)
// ══════════════════════════════════════
// Entidades del juego, como clases que heredan de Engine2D.Entity:
//
//   Engine2D.Entity
//    ├── Jugador              (Junior)
//    └── Enemigo              (abstracta: vida, animación, muerte)
//         ├── EnemigoMelee    (kn_warror, dk_ghost: persigue y golpea cuerpo a cuerpo)
//         ├── Arquero         (ataque a distancia: mantiene distancia y dispara flechas)
//         ├── Fantasma        (se desvanece, se teletransporta y dispara rayos)
//         └── Jefe            (dark_knight, dark_ghostking: fases, embestidas,
//                              ataques a distancia, invocaciones y muerte cinemática)
//
// Polimorfismo: el loop de combate llama e.actualizar(...) en cada enemigo
// sin preguntar de qué tipo es — antes era una cadena de if/else por
// species.behavior que llamaba a 4 funciones sueltas distintas.
//
// Las entidades conservan las mismas propiedades que tenían los objetos
// sueltos de antes (species, hp, animKind, attack, ...), así el renderer y
// el resto del código las siguen leyendo igual.
import { juego } from './rpg_juego.js';
import { RpgConfig } from './rpg_config.js';
import { RpgDatos } from './rpg_enemies_data.js';
import { RpgEnemigos } from './rpg_enemies_ai.js';

// ─────────────────────────────────────
//   Jugador
// ─────────────────────────────────────
export class Jugador extends Engine2D.Entity {
  constructor() {
    super({
      x: 0,
      y: 0,
      hp: 25,
      maxHp: 25,
      speed: RpgConfig.PLAYER_SPEED,
      animFrame: 0,
      animTick: 0,
      moving: false,
      blocking: false,
      blockCooldown: 0, // ms restantes hasta poder volver a bloquear (tras absorber un golpe)
      blockAnimFrame: 0,
      blockAnimTick: 0,
      fireCooldown: 0,
      ammo: RpgConfig.PLAYER_MAX_AMMO,
      reloading: false,
      reloadTimer: 0,
      hitFlash: 0,
      speedBoostTimer: 0,
      invulnTimer: 0, // ms de inmunidad restante (tótem)
    });
  }

  // Al entrar a una habitación: posición de entrada, vida llena y
  // estadísticas según las mejoras juntadas hasta ahora.
  entrarASala(x, y, maxHp, speed) {
    this.x = x;
    this.y = y;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.speed = speed;
    this.blocking = false;
    this.blockCooldown = 0;
    this.fireCooldown = 0;
    this.ammo = RpgConfig.PLAYER_MAX_AMMO;
    this.reloading = false;
    this.reloadTimer = 0;
    this.hitFlash = 0;
    this.speedBoostTimer = 0;
    this.invulnTimer = 0;
  }

  // Ciclo de caminata (3 frames) o pose quieta.
  animarCaminata(step) {
    if (this.moving) {
      this.animTick += step;
      if (this.animTick >= 7) {
        this.animTick = 0;
        this.animFrame = (this.animFrame + 1) % 3;
      }
    } else {
      this.animFrame = 0;
      this.animTick = 0;
    }
  }

  // Descuenta los temporizadores (ms) de disparo, bloqueo, flash de golpe e inmunidad.
  actualizarTemporizadores(dt) {
    if (!this.blocking) {
      this.blockAnimFrame = 0;
      this.blockAnimTick = 0;
    }
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.blockCooldown > 0) this.blockCooldown -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
  }
}

// ─────────────────────────────────────
//   Enemigos
// ─────────────────────────────────────
export class Enemigo extends Engine2D.Entity {
  constructor(props) {
    super(props);
    if (new.target === Enemigo) throw new Error('Enemigo es abstracta: usá Enemigo.crear()');
  }

  // Fábrica: arma la subclase que corresponde al comportamiento de la especie.
  static crear(props) {
    const species = RpgDatos.ENEMY_TYPES[props.species];
    const behavior = species && species.behavior;
    if (behavior === 'boss') return new Jefe(props);
    if (behavior === 'ranged') return new Arquero(props);
    if (behavior === 'ghost') return new Fantasma(props);
    return new EnemigoMelee(props);
  }

  // Definición de la especie (sprites, animaciones, stats base).
  get especie() {
    return RpgDatos.ENEMY_TYPES[this.species];
  }

  // IA de cada frame — la define cada subclase.
  actualizar(p, cfg, C, dt, step) {}

  // Ya muerto: la animación de muerte avanza una sola vez (sin loop) y
  // queda "el cuerpo" en el piso en el último frame.
  avanzarAnimacionMuerte(step) {
    const species = this.especie;
    if (species && species.anims && this.animKind === 'death') {
      const frames = species.anims.death;
      this.animTick += step;
      if (this.animTick >= (species.animSpeed || 8) && this.animFrame < frames.length - 1) {
        this.animTick = 0;
        this.animFrame++;
      }
    }
  }

  // Quemadura (munición celeste): 1 hp por segundo mientras dure,
  // independiente de la IA. Devuelve false si el enemigo murió por esto.
  aplicarQuemadura(dt) {
    if (this.burnTicksLeft > 0 && !this.hidden) {
      this.burnTimer -= dt;
      if (this.burnTimer <= 0) {
        this.burnTimer += 1000;
        this.burnTicksLeft--;
        juego.enemigos.enemyHit(this, 1);
        if (!this.alive) return false;
      }
    }
    return true;
  }

  // Hace avanzar el frame de animación de un enemigo dentro del ciclo
  // `e.animKind` actual (idle/walk/attack/hurt/death), usando la cantidad de
  // frames que tenga esa especie para no salirse del rango.
  animar(species, step) {
    if (!species || !species.anims) return;
    const frames = species.anims[this.animKind] || species.anims.idle;
    this.animTick += step;
    // Velocidad propia por ciclo si está definida (species.animSpeeds[kind]);
    // si no, cae al animSpeed general de la especie.
    const speed = (species.animSpeeds && species.animSpeeds[this.animKind]) || species.animSpeed || 8;
    if (this.animTick >= speed) {
      this.animTick = 0;
      this.animFrame = (this.animFrame + 1) % frames.length;
    }
  }
}

// Perseguir al jugador y golpear SOLO cuando conecta el swing del ataque.
export class EnemigoMelee extends Enemigo {
  actualizar(p, cfg, C, dt, step) {
    const species = RpgDatos.ENEMY_TYPES[this.species];
    if (this.hurtLock > 0) {
      this.hurtLock -= dt;
      this.animKind = 'hurt';
      this.animar(species, step);
      if (this.hitFlash > 0) this.hitFlash -= dt;
      return;
    }
    // Límites de la zona de combate — el chase normal casi nunca los toca
    // (siempre apunta hacia Junior, que ya está adentro), pero la embestida
    // de acá abajo mueve a velocidad fija por un rato y SÍ puede pasarse de
    // largo (por eso el bug de "caminar en el cielo": sin este clamp, un
    // dash lanzado con Junior pegado al borde de arriba seguía de largo
    // fuera del piso). Se aplica siempre, por las dudas.
    const floor = juego.datos.floorBounds(C);
    const xMin = 20,
      xMax = juego.worldWidth - 20;
    const yMin = floor.top + 15,
      yMax = floor.bottom - 10;
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
      if (this.dashState === 'telegraph') {
        this.animKind = 'attack';
        this.animFrame = species.anims.attack.indexOf(dashCfg.telegraphFrame);
        this.dashTimer -= dt;
        if (this.dashTimer <= 0) {
          const dx = p.x - this.x,
            dy = p.y - this.y;
          const d = Math.hypot(dx, dy) || 1;
          const spd = (this.speed || 1) * (dashCfg.speedMult || 3);
          this.dashVx = (dx / d) * spd;
          this.dashVy = (dy / d) * spd;
          this.dashTimer = dashCfg.durationMs || 750;
          this.dashHit = false;
          this.animFrame = species.anims.attack.indexOf(dashCfg.activeFrame);
          this.dashState = 'dashing';
        }
        if (this.hitFlash > 0) this.hitFlash -= dt;
        return;
      }
      if (this.dashState === 'dashing') {
        this.animKind = 'attack';
        this.animFrame = species.anims.attack.indexOf(dashCfg.activeFrame);
        this.x = Math.max(xMin, Math.min(xMax, this.x + this.dashVx * step));
        this.y = Math.max(yMin, Math.min(yMax, this.y + this.dashVy * step));
        if (!this.dashHit && Math.hypot(p.x - this.x, p.y - this.y) <= 36) {
          juego.enemigos.playerHit(this.contactDamage);
          this.dashHit = true;
        }
        this.dashTimer -= dt;
        if (this.dashTimer <= 0) {
          this.dashState = null;
          this.animKind = 'idle';
          this.animFrame = 0;
          this.animTick = 0;
        }
        if (this.hitFlash > 0) this.hitFlash -= dt;
        return;
      }
      this.dashCd -= dt;
      // No arranca en medio del combo de golpe normal (e.animKind==='attack')
      // para no pisarle el frame — espera a que termine.
      if (this.dashCd <= 0 && this.animKind !== 'attack') {
        this.dashState = 'telegraph';
        this.dashTimer = dashCfg.telegraphMs || 350;
        this.dashCd = juego.datos.randRange(dashCfg.cooldownMs);
      }
    }
    const distX = p.x - this.x;
    const distY = p.y - this.y;
    const dist = Math.hypot(distX, distY);
    const stopDistance = 30; // antes 42 — alcance de golpe más corto (rango de daño reducido)

    if (this.contactCooldown > 0) this.contactCooldown -= dt;
    // Mientras dura el swing, el enemigo no se mueve ni vuelve a idle/walk
    // hasta completar el ciclo entero de anims.attack.
    if (this.animKind === 'attack') {
      const frames = species.anims.attack;
      const hitFrame = Math.floor(frames.length / 2); // frame en el que "conecta" el golpe
      const prevFrame = this.animFrame;
      this.animar(species, step);
      if (!this.attackHitApplied && prevFrame < hitFrame && this.animFrame >= hitFrame) {
        if (dist <= stopDistance + 6) juego.enemigos.playerHit(this.contactDamage); // antes +10 — hitbox de golpe más chica
        this.attackHitApplied = true;
      }
      if (this.animFrame === 0 && prevFrame === frames.length - 1) {
        // ciclo completo → termina el ataque
        this.animKind = dist > stopDistance ? 'walk' : 'idle';
        this.attackHitApplied = false;
      }
      if (this.hitFlash > 0) this.hitFlash -= dt;
      return;
    }
    if (dist > stopDistance) {
      this.x = Math.max(xMin, Math.min(xMax, this.x + (distX / dist) * this.speed * step));
      this.y = Math.max(yMin, Math.min(yMax, this.y + (distY / dist) * this.speed * step));
      this.animKind = 'walk';
      this.animar(species, step);
    } else {
      this.animKind = 'idle';
      this.animar(species, step);
      if (dist <= stopDistance + 6 && this.contactCooldown <= 0) {
        this.animKind = 'attack';
        this.animFrame = 0;
        this.animTick = 0;
        this.attackHitApplied = false;
        this.contactCooldown = 900;
      }
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }
}

// Mantiene distancia del jugador y le dispara flechas.
export class Arquero extends Enemigo {
  // Comportamiento a distancia (kn_archer y cualquier especie 'ranged'):
  // mantiene una banda de distancia preferida — si Junior está muy cerca
  // retrocede, si está muy lejos se acerca, y si está en rango se queda
  // quieto disparando flechas con cooldown propio.
  actualizar(p, cfg, C, dt, step) {
    const species = this.especie;
    if (this.hurtLock > 0) {
      this.hurtLock -= dt;
      this.animKind = 'hurt';
      this.animar(species, step);
      if (this.hitFlash > 0) this.hitFlash -= dt;
      return;
    }
    const distX = p.x - this.x;
    const distY = p.y - this.y;
    const dist = Math.hypot(distX, distY) || 1;
    const [minD, maxD] = species.preferredDist || [90, 160];
    if (dist < minD) {
      this.x -= (distX / dist) * this.speed * step;
      this.y -= (distY / dist) * this.speed * step;
      this.animKind = 'walk';
      this.animar(species, step);
    } else if (dist > maxD) {
      this.x += (distX / dist) * this.speed * step;
      this.y += (distY / dist) * this.speed * step;
      this.animKind = 'walk';
      this.animar(species, step);
    } else {
      // En rango para disparar, pero no se queda plantado como blanco fijo:
      // se desplaza de costado (perpendicular a Junior), alternando de lado
      // cada tanto, como un intento simple de esquivar mientras dispara.
      this.strafeTimer = (this.strafeTimer || 0) - dt;
      if (this.strafeTimer <= 0) {
        this.strafeDir = Math.random() < 0.5 ? -1 : 1;
        this.strafeTimer = 550 + Math.random() * 650;
      }
      const perpX = -distY / dist;
      const perpY = distX / dist;
      this.x += perpX * this.strafeDir * this.speed * 0.5 * step;
      this.y += perpY * this.strafeDir * this.speed * 0.5 * step;
      this.animKind = this.fireTimer < 260 ? 'attack' : 'walk';
      this.animar(species, step);
    }
    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && dist <= maxD * 1.3) {
      this.dispararFlecha(p, species);
      this.fireTimer = juego.datos.randRange(this.fireCooldownMs);
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  // Flecha del archer: a diferencia del dark_slash del jefe (siempre
  // horizontal), apunta hacia la posición actual de Junior en el momento del
  // disparo.
  dispararFlecha(p, species) {
    const dx = p.x - this.x;
    const dy = p.y - 30 - (this.y - 45);
    const dist = Math.hypot(dx, dy) || 1;
    const proj = species.projectile;
    const speed = proj.speed || 3.3;
    juego.enemyProjectiles.push({
      kind: 'arrow',
      x: this.x,
      y: this.y - 45,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      dmg: this.arrowDamage || 6,
      w: proj.w || 16,
      h: proj.h || 7,
      frameFly: proj.frameFly,
      frameHit: proj.frameHit,
      sheet: species.sheet,
      atlas: species.atlas,
    });
  }
}

// Se desvanece, reaparece en otro lugar y dispara rayos.
export class Fantasma extends Enemigo {
  // ─── Patrón "ghost" (fantasma teletransportador, capítulo 2) ─────
  // Alterna entre una fase ACTIVA —igual que rpgUpdateRangedChase: mantiene
  // una banda de distancia y dispara— y una fase de teletransporte: se
  // desvanece (disappear, una sola vuelta del ciclo, sin loop), queda
  // invisible e INTANGIBLE un instante (e.hidden — ver el skip en rpgDraw y
  // el filtro de e2.hidden en el choque de balas de Junior, ambos en
  // rpg_render.js/rpg_combat_input.js), reaparece (appear) en otro punto de
  // la arena cerca de Junior y retoma la fase activa. e.ghostState guarda en
  // qué parte de ese ciclo está: 'active' | 'disappearing' | 'hidden' | 'appearing'.
  actualizar(p, cfg, C, dt, step) {
    const species = RpgDatos.ENEMY_TYPES[this.species];
    if (this.hurtLock > 0) {
      this.hurtLock -= dt;
      this.animKind = 'hurt';
      this.animar(species, step);
      if (this.hitFlash > 0) this.hitFlash -= dt;
      return;
    }
    if (this.ghostState === 'disappearing') {
      const frames = species.anims.disappear;
      const prevFrame = this.animFrame;
      this.animar(species, step);
      if (this.animFrame === 0 && prevFrame === frames.length - 1) {
        // ciclo completo → ya no se ve
        this.hidden = true;
        this.ghostState = 'hidden';
        this.ghostTimer = juego.datos.randRange(species.teleportHiddenMs || [400, 700]);
        this.elegirPuntoTeletransporte(p, species, C);
      }
      return;
    }
    if (this.ghostState === 'hidden') {
      this.ghostTimer -= dt;
      if (this.ghostTimer <= 0) {
        this.hidden = false;
        this.ghostState = 'appearing';
        this.animKind = 'appear';
        this.animFrame = 0;
        this.animTick = 0;
      }
      return;
    }
    if (this.ghostState === 'appearing') {
      const frames = species.anims.appear;
      const prevFrame = this.animFrame;
      this.animar(species, step);
      if (this.animFrame === 0 && prevFrame === frames.length - 1) {
        // ciclo completo → retoma la IA normal
        this.ghostState = 'active';
        this.teleportTimer = juego.datos.randRange(species.teleportCooldownMs || [3500, 5500]);
        this.animKind = 'idle';
        this.animFrame = 0;
        this.animTick = 0;
      }
      return;
    }
    // ── Fase activa: cuenta regresiva hacia el próximo teletransporte ──
    this.teleportTimer -= dt;
    if (this.teleportTimer <= 0) {
      this.ghostState = 'disappearing';
      this.animKind = 'disappear';
      this.animFrame = 0;
      this.animTick = 0;
      return;
    }
    // Resto igual que rpgUpdateRangedChase (mantener distancia + strafe + disparo).
    const distX = p.x - this.x;
    const distY = p.y - this.y;
    const dist = Math.hypot(distX, distY) || 1;
    const [minD, maxD] = species.preferredDist || [90, 160];
    if (dist < minD) {
      this.x -= (distX / dist) * this.speed * step;
      this.y -= (distY / dist) * this.speed * step;
      this.animKind = 'walk';
      this.animar(species, step);
    } else if (dist > maxD) {
      this.x += (distX / dist) * this.speed * step;
      this.y += (distY / dist) * this.speed * step;
      this.animKind = 'walk';
      this.animar(species, step);
    } else {
      this.strafeTimer = (this.strafeTimer || 0) - dt;
      if (this.strafeTimer <= 0) {
        this.strafeDir = Math.random() < 0.5 ? -1 : 1;
        this.strafeTimer = 550 + Math.random() * 650;
      }
      const perpX = -distY / dist;
      const perpY = distX / dist;
      this.x += perpX * this.strafeDir * this.speed * 0.5 * step;
      this.y += perpY * this.strafeDir * this.speed * 0.5 * step;
      this.animKind = this.fireTimer < 260 ? 'attack' : 'walk';
      this.animar(species, step);
    }
    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && dist <= maxD * 1.3) {
      this.dispararRayo(p, species);
      this.fireTimer = juego.datos.randRange(this.fireCooldownMs);
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  // Elige dónde reaparece el fantasma: un punto a distancia
  // teleportRangeDist de Junior (ángulo random alrededor suyo, achatado en Y
  // para no salirse tanto del piso jugable como en X), descartado si termina
  // a menos de teleportMinDist — 8 intentos y si ninguno sirve, se queda
  // donde estaba (mejor que teletransportarse encima del jugador).
  elegirPuntoTeletransporte(p, species, C) {
    const floor = juego.datos.floorBounds(C);
    const xMin = 24,
      xMax = juego.worldWidth - 24;
    const [minD, maxD] = species.teleportRangeDist || species.preferredDist || [90, 200];
    for (let tries = 0; tries < 8; tries++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = minD + Math.random() * (maxD - minD);
      const x = Math.max(xMin, Math.min(xMax, p.x + Math.cos(angle) * dist));
      const y = Math.max(floor.top + 12, Math.min(floor.bottom - 8, p.y + Math.sin(angle) * dist * 0.4));
      if (Math.hypot(x - p.x, y - p.y) >= (species.teleportMinDist || 70)) {
        this.x = x;
        this.y = y;
        return;
      }
    }
  }

  // Bola de energía del fantasma: mismo mecanismo que rpgFireArrow (kind
  // 'arrow' reutilizado a propósito — el dibujo ya rota cualquier frame
  // según la velocidad real, sirve igual para una flecha que para un orbe).
  dispararRayo(p, species) {
    const dx = p.x - this.x;
    const dy = p.y - 30 - (this.y - 45);
    const dist = Math.hypot(dx, dy) || 1;
    const proj = species.projectile;
    const speed = proj.speed || 3.2;
    juego.enemyProjectiles.push({
      kind: 'arrow',
      x: this.x,
      y: this.y - 45,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      dmg: this.arrowDamage || 6,
      w: proj.w || 12,
      h: proj.h || 12,
      frameFly: proj.frameFly,
      frameHit: proj.frameHit,
      sheet: species.sheet,
      atlas: species.atlas,
    });
  }
}

// Jefe de capítulo: se mueve libre, cambia de fase según su vida, alterna
// embestidas, golpes cuerpo a cuerpo y ataques a distancia, invoca
// guerreros y tiene una muerte cinemática.
export class Jefe extends Enemigo {
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
  calcularFase() {
    const ratio = this.hp / this.maxHp;
    if (ratio <= 0.25) return 3;
    if (ratio <= 0.5) return 2;
    return 1;
  }

  static rangoDisparoSegunFase(cfg, phase) {
    if (phase === 1) return cfg.fireCooldownPhase1;
    if (phase === 2) return cfg.fireCooldownPhase2;
    return cfg.fireCooldownPhase3;
  }

  alCambiarFase(cfg, phase) {
    juego.partida.updateEnemyLabel();
    this.hitFlash = 250;
  }

  actualizar(p, cfg, C, dt, step) {
    const atk = this.attack;
    const species = RpgDatos.ENEMY_TYPES[this.species];
    const phase = this.calcularFase();
    if (phase !== this.phase) {
      this.phase = phase;
      this.alCambiarFase(cfg, phase);
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this.moving = false; // se prende de nuevo más abajo si el roam efectivamente lo mueve

    const floor = juego.datos.floorBounds(C);
    const marginX = 20;
    const xMin = marginX,
      xMax = juego.worldWidth - marginX;
    const yMin = floor.top + 25,
      yMax = floor.bottom - 15;
    // Los cooldowns corren siempre, salvo el propio mientras el jefe está
    // metido en la animación de ESE ataque — así uno no bloquea a los otros
    // (ej: el dash se puede activar aunque el corte a distancia siga enfriando).
    if (atk.state !== 'meleeWindup' && atk.state !== 'meleeAttack') atk.meleeCd -= dt;
    if (atk.state !== 'rangedWindup') atk.rangedCd -= dt;
    if (phase >= 2 && atk.state !== 'dashTelegraph' && atk.state !== 'dashing') atk.dashCd -= dt;
    if (atk.state !== 'summonTelegraph') atk.summonCd -= dt;
    const distX = p.x - this.x;
    const distY = p.y - this.y;
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
        this.invocarGuerreros(cfg, C);
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
      atk.timer = cfg.teleportBehind ? cfg.teleportVanishMs || 300 : cfg.dashTelegraphMs || 1000;
      atk.dashCd = juego.datos.randRange(cfg.dashCooldownMs);
    }
    if (atk.state === 'teleportVanish') {
      atk.timer -= dt;
      if (atk.timer <= 0) {
        // Aparece del lado OPUESTO al que estaba antes de desaparecer, así
        // se siente como que rodeó a Junior por la espalda.
        const appearDir = this.x > p.x ? -1 : 1;
        this.x = Math.max(xMin, Math.min(xMax, p.x + appearDir * (meleeRange * 0.75)));
        this.y = Math.max(yMin, Math.min(yMax, p.y + (Math.random() - 0.5) * 20));
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
        const worldScale = juego.worldWidth / RpgConfig.LOGICAL_W;
        const eliteSpeedMult = juego.datos.eliteActive() ? RpgConfig.ELITE_SPEED_MULT : 1;
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
      this.x = Math.max(xMin, Math.min(xMax, this.x + atk.vx * step));
      this.y = Math.max(yMin, Math.min(yMax, this.y + atk.vy * step));
      atk.dashTraveled += moveLen;
      if (
        !atk.hit &&
        juego.enemigos.overlap(
          this.x,
          this.y - 40,
          70,
          90,
          p.x,
          p.y + RpgConfig.PLAYER_HITBOX.yOff,
          RpgConfig.PLAYER_HITBOX.w,
          RpgConfig.PLAYER_HITBOX.h,
        )
      ) {
        juego.enemigos.playerHit(cfg.dashDamage * (juego.datos.eliteActive() ? RpgConfig.ELITE_STAT_MULT : 1), {
          fullyBlockable: true,
        });
        atk.hit = true;
      }
      if (atk.dashTraveled >= atk.dashTarget) {
        // Si conectó, se queda repuniéndose antes de poder volver a moverse
        // o atacar; si erró, sigue de largo directo al roam.
        if (atk.hit) {
          atk.state = 'recover';
          atk.timer = cfg.postHitRecoveryMs || 2000;
        } else atk.state = 'roam';
      }
      return;
    }
    // phaseAttackSpeedMult/phaseDamageMult (ver dark_ghostking): opcionales,
    // dark_knight no los define y quedan en 1 (sin cambio de comportamiento).
    const atkSpeedMult = cfg.phaseAttackSpeedMult ? cfg.phaseAttackSpeedMult[phase - 1] || 1 : 1;
    const dmgMult = cfg.phaseDamageMult ? cfg.phaseDamageMult[phase - 1] || 1 : 1;
    if (atk.state === 'meleeWindup') {
      atk.poseTick += dt;
      const frameMs = (cfg.meleeWindupFrameMs || 90) / atkSpeedMult;
      const windupLen = (species.meleeWindupPoseKeys || RpgEnemigos.BOSS_WINDUP_POSES).length;
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
      const attackLen = (species.meleeAttackPoseKeys || RpgEnemigos.BOSS_ATTACK_POSES).length;
      const hitFrame = species.meleeHitFrame != null ? species.meleeHitFrame : RpgEnemigos.BOSS_MELEE_HIT_FRAME;
      if (!atk.hit && atk.poseFrame === hitFrame) {
        if (dist <= meleeRange + 12) {
          juego.enemigos.playerHit(
            cfg.meleeDamage * dmgMult * (juego.datos.eliteActive() ? RpgConfig.ELITE_STAT_MULT : 1),
          );
        }
        atk.hit = true;
      }
      if (atk.poseTick >= frameMs) {
        atk.poseTick -= frameMs;
        atk.poseFrame++;
        if (atk.poseFrame >= attackLen) {
          atk.meleeCd = juego.datos.randRange(cfg.meleeCooldownMs);
          // Mismo criterio que el dash: solo hay pausa de recuperación si
          // el golpe conectó de verdad.
          if (atk.hit) {
            atk.state = 'recover';
            atk.timer = cfg.postHitRecoveryMs || 2000;
          } else atk.state = 'roam';
        }
      }
      return;
    }
    if (atk.state === 'rangedWindup') {
      atk.poseTick += dt;
      if (atk.poseTick >= (cfg.rangedWindupMs || 260)) {
        if (cfg.bossBoltProjectile) this.dispararRayo(p, cfg, phase);
        else this.dispararProyectil(p, cfg, phase);
        atk.rangedCd = juego.datos.randRange(Jefe.rangoDisparoSegunFase(cfg, phase));
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
      atk.poseFrame = 0;
      atk.poseTick = 0;
      return;
    }
    if (dist > farRange && atk.rangedCd <= 0) {
      atk.state = 'rangedWindup';
      atk.poseFrame = 0;
      atk.poseTick = 0;
      return;
    }
    if (dist > 4) {
      const eliteSpeedMult = juego.datos.eliteActive() ? RpgConfig.ELITE_SPEED_MULT : 1;
      const phaseSpeedMult = cfg.phaseSpeedMult ? cfg.phaseSpeedMult[phase - 1] || 1 : 1;
      const move = Math.min(dist, cfg.enemySpeed * eliteSpeedMult * phaseSpeedMult * step * 2.2);
      this.x = Math.max(xMin, Math.min(xMax, this.x + (distX / dist) * move));
      this.y = Math.max(yMin, Math.min(yMax, this.y + (distY / dist) * move));
      this.moving = true;
    }
    // Ciclo de caminata (8 frames, ver RPG_ENEMY_TYPES.dark_knight.walkPoses) —
    // solo avanza mientras se está moviendo de verdad; parado, rpgDrawEnemy
    // cae directo a la pose "idle" (ver render).
    if (this.moving) {
      this.animTick += step;
      if (this.animTick >= 8) {
        this.animTick = 0;
        this.animFrame = (this.animFrame + 1) % 8;
      }
    } else {
      this.animTick = 0;
    }
  }

  // dir/posición del corte ahora se recalculan en cada disparo según de qué
  // lado esté Junior en ESE instante (antes dependía de e.side, un costado
  // fijo) — el corte sigue viajando solo horizontal, nunca en diagonal.
  dispararProyectil(p, cfg, phase) {
    let size;
    if (phase === 1) size = 'small';
    else if (phase === 3) size = 'big';
    else size = Math.random() < 0.5 ? 'small' : 'big';
    const dir = p.x >= this.x ? 1 : -1;
    // projectileSmallSpeed/BigSpeed están calibradas para un mundo de 480 —
    // se escalan para cruzar el mundo actual en el mismo tiempo de siempre.
    const worldScale = juego.worldWidth / RpgConfig.LOGICAL_W;
    const speed = (size === 'small' ? cfg.projectileSmallSpeed : cfg.projectileBigSpeed) * worldScale;
    const dmg =
      (size === 'small' ? cfg.projectileSmallDmg : cfg.projectileBigDmg) *
      (juego.datos.eliteActive() ? RpgConfig.ELITE_STAT_MULT : 1);
    juego.enemyProjectiles.push({
      kind: 'slash',
      x: this.x + dir * 34,
      y: this.y - 45,
      vx: dir * speed,
      vy: 0,
      dir,
      // 1 = viaja a la derecha (sprite normal), -1 = izquierda (sprite espejado)
      size,
      dmg,
      w: size === 'small' ? 16 : 30,
      h: size === 'small' ? 16 : 24,
      animFrame: 1,
      // dark_slash tiene frames "_1" y "_2" por variante
      animTick: 0,
    });
  }

  // Proyectil a distancia del Guardián (dark_ghostking): a diferencia del
  // corte del dark_knight (kind 'slash', horizontal, con tamaño chico/
  // grande), este es un solo proyectil que viaja en línea recta hacia
  // Junior y EXPLOTA al chocar (ver explodeFrames/rpgUpdateEnemyProjectiles)
  // en vez de desaparecer solo. Reutiliza kind 'arrow' (rotación según
  // velocidad real, ver rpgDraw) porque encaja mejor con un cometa girando
  // hacia el objetivo que con el corte horizontal espejado del otro jefe.
  dispararRayo(p, cfg, phase) {
    const spec = cfg.bossBoltProjectile;
    const dmgMult = cfg.phaseDamageMult ? cfg.phaseDamageMult[phase - 1] || 1 : 1;
    const dx = p.x - this.x,
      dy = p.y - 30 - (this.y - 45);
    const dist = Math.hypot(dx, dy) || 1;
    const speed = (spec.speed || 3) * (juego.worldWidth / RpgConfig.LOGICAL_W);
    juego.enemyProjectiles.push({
      kind: 'arrow',
      x: this.x,
      y: this.y - 45,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      dmg: spec.dmg * dmgMult * (juego.datos.eliteActive() ? RpgConfig.ELITE_STAT_MULT : 1),
      w: spec.w || 14,
      h: spec.h || 14,
      drawH: spec.drawH || 16,
      // más grande que una flecha común (ver targetH en rpgDraw)
      frameFly: spec.frameFly,
      sheet: spec.sheet,
      atlas: spec.atlas,
      explodeFrames: spec.explodeFrames,
      explodeFrameMs: spec.explodeFrameMs,
      explodeSheet: spec.explodeSheet || spec.sheet,
      explodeAtlas: spec.explodeAtlas || spec.atlas,
    });
  }

  // ─── Habilidad del jefe: invocar guerreros ─────
  // Por defecto aparecen 2 kn_warror, uno pegado a cada costado del arena
  // (comportamiento de siempre de dark_knight). cfg.summonSpecies (ver
  // dark_ghostking) permite elegir OTRA(S) especie(s) y sus stats por sala —
  // con un solo elemento aparece UN esbirro centrado en vez de 2 a los
  // costados. Soporta tanto especies 'melee' (kn_warror/dk_ghost) como
  // 'ghost' (agrega hidden/ghostState/teleportTimer, ver más abajo); no
  // sirve tal cual para 'boss'.
  invocarGuerreros(cfg, C) {
    const floor = juego.datos.floorBounds(C);
    const midY = (floor.top + floor.bottom) / 2;
    const specs = cfg.summonSpecies || [
      {
        species: 'kn_warror',
        hp: 50,
        speed: 1.0,
        contactDamage: 10,
      },
      {
        species: 'kn_warror',
        hp: 50,
        speed: 1.0,
        contactDamage: 10,
      },
    ];
    const sides = specs.length === 1 ? ['center'] : ['left', 'right'];
    specs.forEach((s, i) => {
      const side = sides[i] || 'left';
      const sSpecies = RpgDatos.ENEMY_TYPES[s.species];
      const enemy = {
        species: s.species,
        x: side === 'center' ? juego.worldWidth / 2 : juego.partida.sideX(side, cfg, C),
        y: midY + (Math.random() - 0.5) * (floor.bottom - floor.top) * 0.3,
        hp: s.hp,
        maxHp: s.hp,
        speed: s.speed != null ? s.speed : 1.0,
        contactDamage: s.contactDamage || 0,
        arrowDamage: s.arrowDamage || 0,
        fireCooldownMs: s.fireCooldownMs || [1500, 2200],
        fireTimer: 0,
        animFrame: 0,
        animTick: 0,
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
        attack: {
          state: 'idle',
          timer: 1200,
          vx: 0,
          vy: 0,
          hit: false,
        },
      };
      // Especie 'ghost' (teletransportador, ver rpgUpdateGhost): necesita
      // estos 3 campos propios además de lo de arriba — sin esto arrancaría
      // "vivo" pero nunca se desvanecería/reaparecería (rpgUpdateGhost los
      // da por puestos, ver rpgCreateEnemies).
      if (sSpecies && sSpecies.behavior === 'ghost') {
        enemy.hidden = false;
        enemy.ghostState = 'active';
        enemy.teleportTimer = juego.datos.randRange(sSpecies.teleportCooldownMs || [3500, 5500]);
      }
      juego.enemies.push(Enemigo.crear(enemy));
    });
    juego.enemigos.updateHudBars(); // el jefe sigue teniendo su propia barra (ver rpgUpdateHudBars) — esto solo refresca el label
    juego.partida.updateEnemyLabel();
  }

  // ─── Cinemática de derrota del jefe ─────
  // Al llegar a 0 HP el jefe reproduce su primera caída (muerte 1 → muerte 2)
  // y queda congelado —opaco, no semitransparente— en muerte 2. Recién ahí
  // arranca el diálogo final (jefe + Junior, ver cfg.deathDialogue). Cuando
  // el jugador termina de leer la última línea, se reproduce una SEGUNDA
  // caída distinta (muerte 3 → muerte 4) y ahí sí, congelado en muerte 4,
  // aparece el cofre de oro — ver rpgPlayBossDeathFall.
  iniciarMuerte(cfg) {
    juego.partida.stopLoop(); // corta el loop de juego — de acá en más es todo cinemática
    const species = RpgDatos.ENEMY_TYPES[this.species];
    this.animarCaida([1, 2], () => {
      const lines = (cfg && cfg.deathDialogue) || [];
      // dissolveOnDeath (ver dark_ghostking): en vez de una 2da caída — que
      // para este jefe repetiría el mismo frame, no tiene death3/4 — el
      // cuerpo se disuelve DEL TODO apenas termina el diálogo (e.vanished,
      // ver el chequeo en rpgDraw): es un fantasma, no deja un cadáver.
      const finishAfterDialogue =
        species && species.dissolveOnDeath
          ? () => {
              this.vanished = true;
              juego.enemigos.finishBossDeath();
            }
          : () => this.animarCaida([3, 4], () => juego.enemigos.finishBossDeath());
      if (!lines.length) {
        finishAfterDialogue();
        return;
      }
      juego.combate.startDialogue(lines, finishAfterDialogue);
    });
  }

  animarCaida(frames, onDone) {
    const enemigo = this;
    const [frameStart, frameEnd] = frames;
    this.deathFrame = frameStart;
    let elapsed = 0;
    let last = 0;
    function step(ts) {
      const dt = last ? Math.min(ts - last, 50) : 16;
      last = ts;
      elapsed += dt;
      if (enemigo.deathFrame === frameStart && elapsed >= RpgEnemigos.BOSS_DEATH_FRAME_MS)
        enemigo.deathFrame = frameEnd;
      juego.render.draw();
      if (elapsed < RpgEnemigos.BOSS_DEATH_FRAME_MS + RpgEnemigos.BOSS_DEATH_HOLD_MS) {
        juego.raf = requestAnimationFrame(step);
      } else {
        onDone();
      }
    }
    juego.raf = requestAnimationFrame(step);
  }
}
