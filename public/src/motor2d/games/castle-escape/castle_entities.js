// ══════════════════════════════════════
//   Castle Escape — castle_entities.js  (módulo ES6)
// ══════════════════════════════════════

import { CastleConfig as C } from './castle_config.js';

export class EntidadNivel extends Engine2D.Entity {
  colisionaCon(otro) {
    return C.rectsOverlap(this, otro);
  }

  // Mueve la entidad ida y vuelta entre move.from y move.to sobre el eje
  // move.axis ('x' o 'y'), a move.speed píxeles por step. Devuelve cuánto
  // se desplazó este frame (para arrastrar al jugador si está encima).
  oscilar(step) {
    if (!this.move) return 0;
    const axis = this.move.axis;
    const prev = this[axis];
    this[axis] += (this._dir || 1) * this.move.speed * step;
    if (this[axis] >= this.move.to) { this[axis] = this.move.to; this._dir = -1; }
    else if (this[axis] <= this.move.from) { this[axis] = this.move.from; this._dir = 1; }
    return this[axis] - prev;
  }
}

// ─────────────────────────────────────
//   Jugador
// ─────────────────────────────────────
// w/h en proporción 32:36 (la del dibujo a mano de respaldo), así el sprite
// llega exactamente hasta el borde inferior del hitbox.
export class Jugador extends EntidadNivel {
  constructor() {
    super({
      x: 20, y: 200, w: 24, h: 27, vx: 0, vy: 0, onGround: false, dead: false, ridingPlatform: null,
      facing: 1,          // 1 = mirando derecha, -1 = mirando izquierda
      animFrame: 0,       // índice dentro de RUN_FRAMES mientras corre
      animTick: 0,        // contador para el ritmo del ciclo de correr
      animFrameName: null // frame de la animación de morir (fall_0..3)
    });
  }

  // Vuelve a la posición de inicio del nivel, quieto y vivo.
  reiniciar(start) {
    this.x = start.x; this.y = start.y;
    this.vx = 0; this.vy = 0; this.dead = false; this.onGround = false; this.ridingPlatform = null;
    this.facing = 1; this.animFrame = 0; this.animTick = 0; this.animFrameName = null;
  }

  saltar() {
    if (this.dead || !this.onGround) return;
    this.vy = C.JUMP_VY;
    this.onGround = false;
  }

  // Movimiento horizontal + choque de costado contra bloques sólidos.
  moverHorizontal(step, keys, levelW, plataformas) {
    this.vx = 0;
    if (keys.left) this.vx = -C.MOVE_SPEED;
    if (keys.right) this.vx = C.MOVE_SPEED;
    this.x += this.vx * step;
    this.x = Math.max(0, Math.min(this.x, levelW - this.w));

    for (const plat of plataformas) {
      if (!plat.bloqueaDeCostado()) continue;
      if (!this.colisionaCon(plat)) continue;
      if (this.vx > 0) this.x = plat.x - this.w;
      else if (this.vx < 0) this.x = plat.x + plat.w;
      else if (this.x + this.w / 2 < plat.x + plat.w / 2) this.x = plat.x - this.w;
      else this.x = plat.x + plat.w;
    }
  }

  // Dirección del sprite y ciclo de correr (el renderer solo lee esto).
  animar(step) {
    if (this.vx > 0) this.facing = 1;
    else if (this.vx < 0) this.facing = -1;
    if (this.onGround && this.vx !== 0) {
      this.animTick += step;
      if (this.animTick >= 6) { this.animTick = 0; this.animFrame = (this.animFrame + 1) % C.RUN_FRAMES.length; }
    } else if (this.onGround) {
      this.animFrame = 0; this.animTick = 0; // quieto = primer frame de correr (pose de parado)
    }
  }

  // Gravedad + choque vertical: piso arriba del bloque y techo abajo.
  aplicarGravedad(step, plataformas) {
    this.vy += C.GRAVITY * step;
    this.y += this.vy * step;
    this.onGround = false;
    this.ridingPlatform = null;

    for (const plat of plataformas) {
      if (!plat.esSolida()) continue;
      if (!this.colisionaCon(plat)) continue;
      if (this.vy < 0) {
        // Golpe de cabeza contra la parte de abajo del bloque.
        this.y = plat.y + plat.h;
        this.vy = 0;
        continue;
      }
      this.y = plat.y - this.h;
      this.vy = 0;
      this.onGround = true;
      plat.alPisar(this);
    }
  }
}

// ─────────────────────────────────────
//   Plataformas
// ─────────────────────────────────────
export class Plataforma extends EntidadNivel {
  constructor(def) {
    super({ ...def, touchedAt: null, gone: false });
  }

  // Fábrica: crea la subclase que corresponde al tipo definido en el editor.
  static desde(def) {
    if (def.type === 'moving') return new PlataformaMovil(def);
    if (def.type === 'crumble') return new PlataformaDerrumbable(def);
    return new Plataforma(def);
  }

  // ¿Frena al jugador? Todo lo que no sea traspasable ni esté derrumbado.
  esSolida() {
    return !this.gone && this.type !== 'fake' && !this.fake;
  }

  // ¿Frena de costado? Por defecto, igual que esSolida().
  bloqueaDeCostado() {
    return this.esSolida();
  }

  // Pared vertical (checkbox "Pared vertical" del editor).
  esPared() {
    return this.type === 'normal' && !!this.vertical;
  }

  // 'normal'/'fake' nunca cambian durante el nivel → van horneadas en la
  // capa estática. Las subclases (móvil / derrumbable) devuelven false.
  esEstatica() {
    return this.type === 'normal' || this.type === 'fake';
  }

  // Lo que se mueve o se rompe se dibuja con el sprite de "isla flotante",
  // igual que lo que está elevado por encima del piso base del nivel.
  esFlotante(floorY) {
    return this.y < floorY;
  }

  // Hooks que las subclases sobrescriben:
  actualizar(step, jugador) {}   // antes de mover al jugador
  alPisar(jugador) {}            // el jugador aterrizó encima
  actualizarDerrumbe() {}        // después de las colisiones
}

// 'moving': va y viene y arrastra al jugador que va parado encima.
export class PlataformaMovil extends Plataforma {
  actualizar(step, jugador) {
    if (this.gone) return;
    const delta = this.oscilar(step);
    if (delta !== 0 && jugador.ridingPlatform === this) jugador[this.move.axis] += delta;
  }

  // Queda AFUERA del choque de costado a propósito: por redondeo de floats

  bloqueaDeCostado() {
    return false;
  }

  alPisar(jugador) {
    jugador.ridingPlatform = this;
  }

  esEstatica() {
    return false;
  }

  esFlotante() {
    return true;
  }
}

// 'crumble': se tiñe al pisarla y desaparece 400ms después.
export class PlataformaDerrumbable extends Plataforma {
  static TIEMPO_DERRUMBE = 400;

  alPisar() {
    if (this.touchedAt === null) this.touchedAt = performance.now();
  }

  actualizarDerrumbe() {
    if (this.touchedAt !== null && !this.gone) {
      if (performance.now() - this.touchedAt > PlataformaDerrumbable.TIEMPO_DERRUMBE) this.gone = true;
    }
  }

  fuePisada() {
    return this.touchedAt !== null;
  }

  esEstatica() {
    return false;
  }

  esFlotante() {
    return true;
  }
}

// ─────────────────────────────────────
//   Peligros
// ─────────────────────────────────────
export class Peligro extends EntidadNivel {
  constructor(def) {
    super({ ...def });
  }

  static desde(def) {
    return def.type === 'saw' ? new Sierra(def) : new Peligro(def);
  }

  // Los pinchos "falsos" (fake) se ven idénticos pero no matan.
  esLetal() {
    return !this.fake;
  }

  actualizar(step) {}
}

// Sierra: mismo movimiento que una plataforma móvil, pero mata.
export class Sierra extends Peligro {
  actualizar(step) {
    this.oscilar(step);
  }
}

// ─────────────────────────────────────
//   Flechas
// ─────────────────────────────────────
// Guarda su definición original (def) para saber desde dónde sale y qué
// la dispara; x/y/active/fires son el estado en juego.
export class Flecha extends EntidadNivel {
  constructor(def) {
    super({ ...def, active: false, fired: false, fires: 0 });
    this.def = def;
  }

  // Dos tipos de disparo (los arma el editor):
  //   'line' (default) → el jugador cruza la línea vertical triggerX.
  //   'area'           → el jugador entra en el rectángulo triggerZone.
  // repeat = cuántas veces puede dispararse (1 por defecto).
  intentarDisparar(jugador) {
    const def = this.def;
    const maxDisparos = Math.max(1, def.repeat || 1);
    if (this.active || (this.fires || 0) >= maxDisparos) return;
    const shouldFire = (def.triggerType === 'area' && def.triggerZone)
      ? C.rectsOverlap(jugador, def.triggerZone)
      : jugador.x >= def.triggerX;
    if (!shouldFire) return;
    this.fired = true;
    this.active = true;
    this.fires = (this.fires || 0) + 1;
    this.x = def.x;
    this.y = def.y;
  }

  // Movimiento según dirección: -1/1 = horizontal, 'up'/'down' = vertical.
  actualizar(step, levelW, levelH) {
    if (this.dir === 'up') this.y -= this.speed * step;
    else if (this.dir === 'down') this.y += this.speed * step;
    else this.x += this.dir * this.speed * step;
    const outX = this.x < -40 || this.x > levelW + 40;
    const outY = this.y < -40 || this.y > levelH + 40;
    if (outX || outY) this.active = false;
  }
}

// ─────────────────────────────────────
//   Explosiones (efecto visual al morir)
// ─────────────────────────────────────
export class Explosiones {
  static COLORES = ['#ef4444', '#f97316', '#facc15', '#fbbf24', '#fff'];

  constructor() {
    this.lista = [];
  }

  limpiar() {
    this.lista = [];
  }

  crear(cx, cy) {
    const colors = Explosiones.COLORES;
    for (let i = 0; i < 18; i++) {
      const angle = (Math.PI * 2 / 18) * i + (Math.random() - 0.5) * 0.4;
      const speed = 2 + Math.random() * 4;
      this.lista.push({
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

  // step: por tiempo real, así duran lo mismo a 30, 60 o 144 fps.
  actualizar(step = 1) {
    for (let i = this.lista.length - 1; i >= 0; i--) {
      const e = this.lista[i];
      e.x += e.vx * step;
      e.y += e.vy * step;
      e.vy += 0.1 * step;
      e.life -= e.decay * step;
      if (e.life <= 0) this.lista.splice(i, 1);
    }
  }

  dibujar(ctx) {
    if (!this.lista.length) return;
    const round = Engine2D.Quality.fx.roundParticles !== false;
    for (const e of this.lista) {
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
}
