// ══════════════════════════════════════
//   Pixel Runner — runner_entities.js  (módulo ES6)
// ══════════════════════════════════════
// Todo lo que se mueve en la partida, como clases:
//
//   Engine2D.Entity
//    ├── Jugador                    (Junior: salto, gravedad, power-ups)
//    ├── Obstaculo                  (abstracta: se desplaza y mata al tocarlo)
//    │    ├── ObstaculoSuelo        (árbol / cactus / roca)
//    │    └── Pajaro                (obstáculo aéreo animado)
//    └── Pickup                     (abstracta: se desplaza y se recolecta)
//         ├── Moneda                (suma monedas de la tienda)
//         └── PowerUp               (abstracta: da un efecto temporal)
//              ├── PowerUpEscudo
//              ├── PowerUpPuntosDobles
//              ├── PowerUpCaidaLenta
//              └── PowerUpVelocidadReducida
//
//   Cielo    (ciclo día/noche + nubes)
//   Lluvia   (evento de clima: gotas + salpicaduras)
//
// Polimorfismo: el juego llama o.dibujar(), o.recolectar(juego), etc. sin
// preguntar de qué tipo es cada uno. Las entidades conservan las mismas
// propiedades de antes (kind, type, sprite, spinFrame...).
import { RunnerConfig as RC } from './runner_config.js';

// ─────────────────────────────────────
//   Jugador
// ─────────────────────────────────────
export class Jugador extends Engine2D.Entity {
  constructor() {
    super({
      x: 90, y: 0, w: 29, h: 34,
      vy: 0, jumps: 0, maxJumps: 2,
      dead: false, animFrame: 0, animTick: 0,
      groundY: 0,
      facing: 1,           // 1 = mirando a la derecha
      shield: false,       // true mientras el escudo está activo
      shieldFrames: 0,     // frames restantes del escudo
      shieldHitsLeft: 0,   // golpes que todavía puede absorber
      slowFallFrames: 0,   // > 0 mientras dura la caída lenta
    });
  }

  reiniciar() {
    this.x = 90;
    this.y = this.groundY;
    this.vy = 0;
    this.jumps = 0;
    this.dead = false;
    this.animFrame = 0;
    this.animTick = 0;
    this.animFrameName = null;
    this.facing = 1;
    this.shield = false;
    this.shieldFrames = 0;
    this.shieldHitsLeft = 0;
    this.slowFallFrames = 0;
  }

  estaEnPiso() {
    return this.y >= this.groundY - 0.5;
  }

  // Doble salto; con lluvia el salto rinde menos.
  saltar(viewH, lloviendo) {
    if (this.jumps < this.maxJumps) {
      this.vy = -viewH * 0.018 * (lloviendo ? RC.RAIN_JUMP_MULT : 1);
      this.jumps++;
    }
  }

  caidaRapida(viewH) {
    if (this.y >= this.groundY) return;
    this.vy = Math.abs(this.vy) * 0.5 + viewH * 0.04;
  }

  // Descuenta la duración de los power-ups que viven en el jugador.
  actualizarPowerUps(step) {
    if (this.shieldFrames > 0) {
      this.shieldFrames = Math.max(0, this.shieldFrames - step);
      this.shield = this.shieldFrames > 0;
    }
    if (this.slowFallFrames > 0) this.slowFallFrames = Math.max(0, this.slowFallFrames - step);
  }

  // Movimiento lateral acotado al corredor. Junior siempre mira a la
  // derecha: ir a la izquierda es perder terreno, no correr para atrás.
  moverLateral(step, input, minX, maxX, moveSpeed) {
    let vx = 0;
    if (input.left) vx -= moveSpeed;
    if (input.right) vx += moveSpeed;
    this.x = Math.min(maxX, Math.max(minX, this.x + vx * step));
  }

  // Salto/gravedad. Con caída lenta la gravedad se reduce.
  aplicarFisica(step, viewH) {
    const gravMult = this.slowFallFrames > 0 ? RC.SLOWFALL_GRAVITY_MULT : 1;
    this.vy += RC.GRAVITY * gravMult * (viewH / 200) * step;
    this.y += this.vy * step;
    if (this.y >= this.groundY) {
      this.y = this.groundY;
      this.vy = 0;
      this.jumps = 0;
    }
  }

  animarCarrera(step) {
    this.animTick += step;
    if (this.animTick >= 6) { this.animTick = 0; this.animFrame = (this.animFrame + 1) % RC.RUN_FRAMES.length; }
  }

  // ¿El escudo absorbe este golpe? Aguanta 1 (o 2 con la mejora) sin
  // importar cuánto timer le quedaba; se apaga al quedarse sin golpes.
  absorberGolpe() {
    if (this.shieldFrames <= 0) return false;
    this.shieldHitsLeft = Math.max(0, (this.shieldHitsLeft || 1) - 1);
    if (this.shieldHitsLeft <= 0) {
      this.shieldFrames = 0;
      this.shield = false;
    }
    return true;
  }

  activarEscudo(frames, golpes) {
    this.shieldFrames = Math.min(RC.POWERUP_STACK_CAP, this.shieldFrames + frames);
    this.shield = true;
    this.shieldHitsLeft = golpes; // agarrar el pickup también recarga los golpes
  }

  activarCaidaLenta(frames) {
    this.slowFallFrames = Math.min(RC.POWERUP_STACK_CAP, this.slowFallFrames + frames);
  }
}

// ─────────────────────────────────────
//   Obstáculos
// ─────────────────────────────────────
export class Obstaculo extends Engine2D.Entity {
  static MARGEN_COLISION = 6;

  constructor(props) {
    super(props);
    if (new.target === Obstaculo) throw new Error('Obstaculo es abstracta');
  }

  mover(step, speed) {
    this.x -= speed * step;
    this.animTick = (this.animTick || 0) + step;
  }

  fueraDePantalla() {
    return this.x + this.w < -20;
  }

  // Hitbox un poco más chica que el sprite (margen) para que sea justa.
  golpea(p) {
    const m = Obstaculo.MARGEN_COLISION;
    return p.x + m < this.x + this.w - m &&
      p.x + p.w - m > this.x + m &&
      p.y + m < this.y + this.h - m &&
      p.y + p.h - m > this.y + m;
  }

  dibujarRespaldo(ctx, color) {
    ctx.fillStyle = color;
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}

export class ObstaculoSuelo extends Obstaculo {
  constructor(x, y, w, h, sprite) {
    super({ x, y, w, h, kind: 'ground', sprite });
  }

  // El sink hunde SOLO el dibujo para que no parezca flotando.
  dibujar(ctx, a) {
    if (a.obstImg && a.obstAtlas) {
      Engine2D.drawAtlasFrame(ctx, a.obstImg, a.obstAtlas, this.sprite, this.x + this.w / 2, this.y + this.h + RC.sinkForSprite(this.sprite), this.h, false, false);
    } else {
      this.dibujarRespaldo(ctx, '#4b7a3f');
    }
  }
}

export class Pajaro extends Obstaculo {
  constructor(x, y, w, h) {
    super({ x, y, w, h, kind: 'air', animTick: Math.random() * 8 });
  }

  dibujar(ctx, a) {
    if (a.birdImg && a.birdAtlas) {
      const frameIdx = Math.floor((this.animTick || 0) / 4) % RC.BIRD_FRAMES.length;
      Engine2D.drawAtlasFrame(ctx, a.birdImg, a.birdAtlas, RC.BIRD_FRAMES[frameIdx], this.x + this.w / 2, this.y + this.h / 2, this.h, true, true);
    } else {
      this.dibujarRespaldo(ctx, '#c0392b');
    }
  }
}

// ─────────────────────────────────────
//   Pickups (monedas y power-ups)
// ─────────────────────────────────────
export class Pickup extends Engine2D.Entity {
  constructor(props) {
    super(props);
    if (new.target === Pickup || new.target === PowerUp) throw new Error('Clase abstracta');
  }

  mover(step, speed) {
    this.x -= speed * step;
  }

  fueraDePantalla() {
    return this.x + this.w < -20;
  }

  tocaA(p) {
    return p.x < this.x + this.w && p.x + p.w > this.x && p.y < this.y + this.h && p.y + p.h > this.y;
  }

  // Cada subclase define su efecto.
  recolectar(juego) {}

  // Arte "pintado": el renderer ya activó el suavizado antes de llamar.
  dibujarFrame(ctx, a, frame) {
    Engine2D.drawAtlasFrame(ctx, a.itemImg, a.itemAtlas, frame, this.x + this.w / 2, this.y + this.h, this.h, false, false);
  }

  dibujarRespaldo(ctx, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.w / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Las monedas NO suman puntaje: son la moneda de la tienda de mejoras.
export class Moneda extends Pickup {
  constructor(x, y, size) {
    super({
      x, y, w: size, h: size,
      kind: 'coin',
      spinTick: Math.random() * 8,
      spinFrame: Math.floor(Math.random() * RC.COIN_SPIN_FRAMES.length),
    });
  }

  mover(step, speed) {
    super.mover(step, speed);
    this.spinTick = (this.spinTick || 0) + step;
    if (this.spinTick >= 4) { this.spinTick = 0; this.spinFrame = (this.spinFrame + 1) % RC.COIN_SPIN_FRAMES.length; }
  }

  recolectar(juego) {
    juego.coinsRun += RC.COIN_VALUE;
    juego.economia.sumarMonedas(RC.COIN_VALUE);
    // Durante la partida solo se muestran las monedas de ESTA corrida.
    if (juego.dom.coinsRunDisplay) juego.dom.coinsRunDisplay.textContent = juego.coinsRun;
  }

  dibujar(ctx, a) {
    if (a.itemImg && a.itemAtlas) this.dibujarFrame(ctx, a, RC.COIN_SPIN_FRAMES[this.spinFrame]);
    else this.dibujarRespaldo(ctx, '#f4c430');
  }
}

export class PowerUp extends Pickup {
  static TAMANIO = 22;

  constructor(x, y, type) {
    super({ x, y, w: PowerUp.TAMANIO, h: PowerUp.TAMANIO, kind: 'powerup', type });
  }

  // Fábrica según el tipo sorteado.
  static crear(x, y, type) {
    const Clase = {
      shield: PowerUpEscudo, x2: PowerUpPuntosDobles,
      slowfall: PowerUpCaidaLenta, slowspeed: PowerUpVelocidadReducida,
    }[type];
    return new Clase(x, y, type);
  }

  // Frame del atlas y color de respaldo: los define cada subclase.
  frame(a) { return 'powerup_' + this.type; }
  get colorRespaldo() { return '#f97316'; }

  dibujar(ctx, a) {
    if (a.itemImg && a.itemAtlas) this.dibujarFrame(ctx, a, this.frame(a));
    else this.dibujarRespaldo(ctx, this.colorRespaldo);
  }
}

export class PowerUpEscudo extends PowerUp {
  get colorRespaldo() { return '#3b82f6'; }
  recolectar(juego) {
    juego.jugador.activarEscudo(juego.economia.duracionEscudo(), juego.economia.golpesEscudo());
  }
}

export class PowerUpPuntosDobles extends PowerUp {
  get colorRespaldo() { return '#f97316'; }
  // Con la mejora "x2 → x3" el pickup ya muestra el ícono de x3.
  frame(a) { return a.x2Triple ? 'powerup_x3' : 'powerup_x2'; }
  recolectar(juego) {
    juego.doublePointsFrames = Math.min(RC.POWERUP_STACK_CAP, juego.doublePointsFrames + juego.economia.duracionPuntosDobles());
  }
}

export class PowerUpCaidaLenta extends PowerUp {
  get colorRespaldo() { return '#38bdf8'; }
  recolectar(juego) {
    juego.jugador.activarCaidaLenta(juego.economia.duracionCaidaLenta());
  }
}

export class PowerUpVelocidadReducida extends PowerUp {
  get colorRespaldo() { return '#84cc16'; }
  // La velocidad baja mientras dura y se recupera sola (ver PixelRunner.actualizarVelocidad).
  recolectar(juego) {
    juego.slowSpeedFrames = Math.min(RC.POWERUP_STACK_CAP, juego.slowSpeedFrames + juego.economia.duracionVelocidadReducida());
  }
}

// ─────────────────────────────────────
//   Cielo: ciclo día/noche + nubes
// ─────────────────────────────────────
// t se deriva del frameCount del juego (no se acumula solo), así el
// día/noche queda sincronizado con el score: la noche arranca justo a los
// DAY_HALF puntos de cada bioma (el score sube 1 cada 6 frames).
export class Cielo {
  constructor() {
    this.t = 0;
    this.cycleLen = RC.BIOME_SEGMENT * 6;
    this.clouds = [
      { x: 60, y: 30, speed: 0.15, frame: 0 },
      { x: 260, y: 18, speed: 0.09, frame: 1 },
      { x: 400, y: 42, speed: 0.12, frame: 2 },
    ];
  }

  sincronizar(frameCount) {
    this.t = frameCount % this.cycleLen;
  }

  // Parallax lento: las nubes no aceleran con la velocidad del juego.
  moverNubes(step, width) {
    this.clouds.forEach(c => {
      c.x -= c.speed * step;
      if (c.x < -100) c.x = width + 40 + Math.random() * 60;
    });
  }

  get fase() { return this.t / this.cycleLen; } // 0..1 (0..0.5 día, 0.5..1 noche)
}

// ─────────────────────────────────────
//   Lluvia (evento de clima, no es un power-up)
// ─────────────────────────────────────
// Cada RAIN_CHECK_INTERVAL puntos hay RAIN_CHANCE de que empiece a llover
// (solo si no está lloviendo ya). Mientras llueve el salto rinde menos y
// las nubes pasan a la variante oscura.
export class Lluvia {
  constructor(viewW, viewH, groundH) {
    this.viewW = viewW;
    this.groundY = viewH - groundH;
    this.reiniciar();
  }

  reiniciar() {
    this.active = false;
    this.timer = 0;
    this.nextCheck = RC.RAIN_CHECK_INTERVAL;
    this.drops = [];
    this.splashes = [];
  }

  // Tira el dado en cada checkpoint de puntaje y descuenta la duración.
  actualizarClima(score, step) {
    while (score >= this.nextCheck) {
      this.nextCheck += RC.RAIN_CHECK_INTERVAL;
      if (!this.active && Math.random() < RC.RAIN_CHANCE) {
        this.active = true;
        this.timer = RC.RAIN_DURATION;
      }
    }
    if (this.active) {
      this.timer -= step;
      if (this.timer <= 0) { this.active = false; this.timer = 0; }
    }
  }

  crearGota(midFall) {
    return {
      x: Math.random() * this.viewW,
      y: midFall ? Math.random() * this.groundY : -10 - Math.random() * 30,
      len: 6 + Math.random() * 6,
    };
  }

  // Cantidad de gotas según la calidad gráfica.
  ajustarCantidad() {
    const tier = (typeof Engine2D !== 'undefined' && Engine2D.Quality) ? Engine2D.Quality.level : 'high';
    const target = Math.round(RC.RAIN_BASE_COUNT * (RC.RAIN_DENSITY[tier] ?? 1));
    const drops = this.drops;
    while (drops.length < target) drops.push(this.crearGota(true));
    if (drops.length > target) drops.length = target;
  }

  // Gotas cayendo + salpicaduras contra el piso (sprite, solo en calidad Alta).
  actualizar(step) {
    if (this.active) {
      this.ajustarCantidad();
      const spawnSplash = !Engine2D.Quality || Engine2D.Quality.level === 'high';
      for (const d of this.drops) {
        d.x += RC.RAIN_DROP_WIND * step;
        d.y += RC.RAIN_DROP_SPEED * step;
        if (d.y >= this.groundY) {
          if (spawnSplash) this.splashes.push({ x: d.x, y: this.groundY, life: RC.RAIN_SPLASH_LIFE });
          Object.assign(d, this.crearGota(false));
        }
        if (d.x < -10) d.x = this.viewW + 10;
        else if (d.x > this.viewW + 10) d.x = -10;
      }
    } else if (this.drops.length) {
      this.drops.length = 0; // corte simple al terminar
    }

    // Los splashes se apagan solos aunque la lluvia ya haya parado.
    const splashes = this.splashes;
    for (let i = splashes.length - 1; i >= 0; i--) {
      splashes[i].life -= step;
      if (splashes[i].life <= 0) { splashes[i] = splashes[splashes.length - 1]; splashes.pop(); }
    }
  }
}
