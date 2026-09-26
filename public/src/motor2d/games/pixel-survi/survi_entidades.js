// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_entidades.js
//   Entidades que se mueven por el mundo, como clases que heredan de
//   Engine2D.Entity (la física del motor las trata a todas igual:
//   Physics.applyGravity / resolveTileCollisions leen x, y, w, h, vx, vy,
//   grounded):
//
//     Engine2D.Entity
//      ├── Jugador          (el personaje: caja de colisión, dirección, empujón)
//      └── Criatura         (abstracta: vida, recibir golpes, parpadeo)
//           ├── Enemigo     (abstracta: patrulla; si te ve te persigue)
//           │    ├── Slime
//           │    ├── Zombie     (de noche / cuevas; se quema al sol)
//           │    ├── Esqueleto  (cuevas; dispara flechas a distancia)
//           │    ├── Serpiente  (desierto; su mordida envenena)
//           │    └── OjoVolador (de noche desde el día 10; vuela)
//           │         └── OjoBoca (igual, pero más grande y pega más fuerte)
//           └── Animal      (abstracta: pasivo, anda en manada y huye si lo golpeás)
//                ├── Vaca     → cuero y carne
//                ├── Cerdo    → carne
//                └── Gallina  → huevos (y a veces carne)
//
//   Flecha (proyectil del arco: vuela en arco, se clava, se junta)
//   ItemSuelto (lo que se rompe o suelta un mob cae al suelo; se junta pasando cerca)
//
//   Polimorfismo: el juego llama a.actualizar(), a.dibujar(), a.drops()
//   sin saber qué animal es; cada subclase define su tamaño, su velocidad,
//   lo que suelta y cómo se dibuja (por código, como los bloques).
// ══════════════════════════════════════════════════════════════

import { SurviConfig } from './survi_config.js';

export class Jugador extends Engine2D.Entity {
  constructor(x, y) {
    super({
      x,
      y,
      w: SurviConfig.PLAYER_BOX.w,
      h: SurviConfig.PLAYER_BOX.h,
      vx: 0,
      vy: 0,
      grounded: false,
      facing: 1, // 1 = mirando a la derecha, -1 = a la izquierda
    });
  }

  // Vuelve al punto de aparición, quieto.
  reaparecer(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
  }

  // Empujón al recibir un golpe: se aleja de `desdeX` y salta un poco.
  empujar(desdeX) {
    this.vx = Math.sign(this.x - desdeX || 1) * 3;
    this.vy = -3;
  }

  // ¿Adelante (hacia `dir`) hay un escalón de EXACTAMENTE 1 bloque que se
  // puede subir de un salto? Con 2 bloques o más de alto, o sin lugar para
  // la cabeza arriba, no.
  escalonAdelante(map, dir) {
    const T = SurviConfig.TILE;
    const col = Math.floor((dir > 0 ? this.x + this.w + 1 : this.x - 1) / T);
    const pies = Math.floor((this.y + this.h - 1) / T);
    const alto = Math.ceil(this.h / T); // filas que ocupa el jugador
    if (!map.isSolidAt(col, pies)) return false; // no hay bloque adelante
    for (let k = 1; k <= alto; k++) if (map.isSolidAt(col, pies - k)) return false; // es más alto que 1
    const c0 = Math.floor(this.x / T), c1 = Math.floor((this.x + this.w - 1) / T);
    for (let c = c0; c <= c1; c++) if (map.isSolidAt(c, pies - alto)) return false; // techo encima
    return true;
  }
}

// ─────────────────────────────────────
//   Criatura (base de enemigos y animales)
// ─────────────────────────────────────
// Además de la vida y los golpes, tiene los "sensores" del entorno y un
// movimiento común (moverHacia) que ya resuelve escalones, paredes y
// precipicios. Cada subclase solo decide QUÉ quiere hacer (patrullar,
// perseguir, huir...), no CÓMO moverse por el terreno.
export class Criatura extends Engine2D.Entity {
  static PARPADEO_MS = 150; // flash blanco al recibir un golpe
  static SALTO = 5.2; // con la gravedad del motor (0.6) sube ~22 px: pasa un bloque de 16

  constructor(props) {
    super({ vx: 0, vy: 0, grounded: false, hitMs: 0, facing: 1, ...props });
    if (new.target === Criatura) throw new Error('Criatura es abstracta');
  }

  estaMuerto() {
    return this.hp <= 0;
  }

  // ¿Hay algún bloque sólido tocando la caja si estuviera en (x, y)?
  // (para los que vuelan sin la física del motor)
  chocaEn(map, x, y) {
    const T = SurviConfig.TILE;
    const c0 = Math.floor(x / T), c1 = Math.floor((x + this.w - 1) / T);
    const r0 = Math.floor(y / T), r1 = Math.floor((y + this.h - 1) / T);
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) if (map.isSolidAt(c, r)) return true;
    return false;
  }

  // Tiro con parábola desde (ox, oy) a (tx, ty): { vx, vy } para que llegue
  // con gravedad `g` (px/paso²) yendo a `vel` px/paso en horizontal.
  static tiroParabolico(ox, oy, tx, ty, vel, g) {
    const dx = tx - ox, dy = ty - oy;
    const t = Math.max(8, Math.abs(dx) / vel); // pasos que tarda
    return { vx: dx / t, vy: Math.max(-7, dy / t - 0.5 * g * t) };
  }

  // ¿Se está quemando? (al sol, o metida en la lava): se le dibujan llamas.
  get enFuego() {
    return !!(this.quemando || (this.fluido && this.fluido.lava));
  }

  // Golpe del jugador: resta vida, la empuja hacia `dir` y parpadea.
  recibirGolpe(dmg, dir) {
    this.hp -= dmg;
    this.vx = dir * 3;
    this.vy = -3;
    this.hitMs = Criatura.PARPADEO_MS;
  }

  // Cada subclase define su IA. Devuelve false si hay que sacarla del mapa.
  actualizar(dt, step, juego) {
    return true;
  }

  // ── Agua y lava ──
  // Lo llama cada subclase al principio de actualizar(): guarda en qué
  // fluido está (lo usa moverHacia para flotar) y la lava la va quemando.
  sentirFluidos(juego, dt) {
    const antes = this.fluido;
    this.fluido = juego.fluidos ? juego.fluidos.enCaja(this) : null;
    // cayó al agua o a la lava: salpica (gotas / brasas)
    if (this.fluido && juego.salpicarEn) {
      if (this.fluido.agua && !(antes && antes.agua) && this.vy > 1.5) juego.salpicarEn(this, 1);
      else if (this.fluido.lava && !(antes && antes.lava)) juego.salpicarEn(this, 2);
    }
    if (this.fluido && this.fluido.lava) {
      this.quemaMs = (this.quemaMs || 0) + dt;
      if (this.quemaMs >= SurviConfig.LAVA_DANIO_MS) {
        this.quemaMs = 0;
        this.hp -= SurviConfig.LAVA_DANIO;
        this.hitMs = Criatura.PARPADEO_MS;
      }
    } else this.quemaMs = SurviConfig.LAVA_DANIO_MS; // el primer toque quema al instante
  }

  // ── Sensores (en tiles) ──
  get colCentro() {
    return Math.floor((this.x + this.w / 2) / SurviConfig.TILE);
  }

  // Fila de los pies (la celda de aire donde está parada).
  get filaPies() {
    return Math.floor((this.y + this.h - 1) / SurviConfig.TILE);
  }

  // Columna que tiene justo adelante, hacia `dir`.
  colFrente(dir) {
    return Math.floor((dir > 0 ? this.x + this.w + 1 : this.x - 1) / SurviConfig.TILE);
  }

  // ¿El bloque de adelante es un escalón de 1 que se puede subir saltando?
  puedeSubir(map, dir) {
    const c = this.colFrente(dir), f = this.filaPies;
    return !map.isSolidAt(c, f - 1) && !map.isSolidAt(c, f - 2) && !map.isSolidAt(this.colCentro, f - 2);
  }

  // Cuántos bloques de caída hay adelante (0 = suelo firme), mirando hasta `max`.
  caidaAdelante(map, dir, max) {
    const c = this.colFrente(dir), f = this.filaPies;
    let n = 0;
    while (n < max && !map.isSolidAt(c, f + 1 + n)) n++;
    return n;
  }

  // ¿Ve el punto (x, y)? Recorre los tiles de la línea que los une; un bloque
  // sólido en el medio corta la vista (no te ven a través de una pared).
  ve(map, x, y) {
    const T = SurviConfig.TILE;
    const x0 = this.x + this.w / 2, y0 = this.y + this.h / 3;
    const pasos = Math.ceil(Math.hypot(x - x0, y - y0) / (T / 2));
    for (let i = 1; i < pasos; i++) {
      const k = i / pasos;
      if (map.isSolidAt(Math.floor((x0 + (x - x0) * k) / T), Math.floor((y0 + (y - y0) * k) / T))) return false;
    }
    return true;
  }

  // Movimiento común: camina hacia `dir` a `velocidad`, salta escalones de
  // 1 bloque y no se tira por caídas de más de `maxCaida` bloques. Mientras
  // dura el empujón de un golpe, manda el empujón. Devuelve 'pared' o
  // 'precipicio' si se tuvo que frenar (la subclase decide qué hacer).
  moverHacia(dir, velocidad, juego, step, { maxCaida = 1 } = {}) {
    const map = juego.tilemap;
    if (dir) this.facing = dir;
    if (this.hitMs <= 0) this.vx = dir * velocidad;
    const quiere = this.vx;
    const fl = this.fluido;
    if (fl && (fl.agua || fl.lava)) {
      // en el fluido nada: más lento y flota hacia la superficie
      if (this.hitMs <= 0) this.vx *= fl.lava ? 0.45 : 0.6;
      this.vy = fl.cabeza ? Math.max(this.vy - 0.3 * step, -1.2) : Math.min(this.vy + 0.15 * step, 1.2);
    } else Engine2D.Physics.applyGravity(this, step);
    Engine2D.Physics.resolveTileCollisions(this, map, step);
    if (!dir || !velocidad || !this.grounded) return null;
    if (quiere !== 0 && this.vx === 0) {
      if (this.puedeSubir(map, dir)) {
        this.vy = -Criatura.SALTO;
        return null;
      }
      return 'pared';
    }
    if (this.caidaAdelante(map, dir, maxCaida + 1) > maxCaida) {
      this.vx = 0;
      return 'precipicio';
    }
    return null;
  }
}

// ─────────────────────────────────────
//   Enemigos
// ─────────────────────────────────────
// Enemigo (base): patrulla y, si te ve, te persigue y te pega al tocarte.
//   Estados: 'patrulla' → camina solo y se da vuelta en paredes/precipicios.
//            'alerta'   → te vio: se frena un instante y da un saltito ("!").
//            'persigue' → va hacia vos más rápido, sube escalones y se anima a
//                          bajar hasta 4 bloques. Si te pierde de vista un rato,
//                          te alejás mucho o queda trabado, vuelve a patrullar.
//   Al golpearte retrocede un momento en vez de quedarse pegado.
// Subclases (cada una define sus números, lo que suelta y cómo se dibuja):
//   Slime     → superficie. De día es pacífico (salvo que le pegues: se
//               enoja); de noche, agresivo.
//   Zombie    → de noche (o con lluvia) en la superficie y en las cuevas.
//   Esqueleto → solo en cuevas: se queda a distancia y te tira flechas.
// Zombie y esqueleto se QUEMAN con la luz del sol (solo el sol: a cielo
// abierto, de día y sin lluvia; las antorchas no cuentan). Quemándose, si
// te pegan (o te clava una flecha) te prenden fuego.
export class Enemigo extends Criatura {
  static TIPO = '';
  static ANCHO = 12;
  static ALTO = 12;
  static VIDA = 6;
  static DANIO = 2; // al tocarte
  static VELOCIDAD = 0.7;
  static VELOCIDAD_PERSECUCION = 1.05;
  static VISTA_TILES = 10; // a esta distancia te detecta (si te ve)
  static OLVIDO_TILES = 16; // más lejos que esto, deja de perseguirte
  static OLVIDO_MS = 2500; // tanto tiempo sin verte y se rinde
  static ALERTA_MS = 450;
  static RETROCESO_MS = 700; // después de golpearte
  static DISTANCIA_MAX_TILES = 45; // más lejos que esto del jugador, desaparece
  static SE_QUEMA_AL_SOL = false;
  static SOL_DANIO = 2; // cada SOL_MS al sol
  static SOL_MS = 700;

  // Registro tipo → clase (para crear el correcto al cargar la partida).
  static #tipos = new Map();

  static registrar(Clase) {
    Enemigo.#tipos.set(Clase.TIPO, Clase);
  }

  // Fábrica: d = { tipo, x, y, vx?, vy?, hp? }. Un save viejo sin tipo es un slime.
  static crear(d) {
    const Clase = Enemigo.#tipos.get((d && d.tipo) || 'slime');
    return Clase ? new Clase(d) : null;
  }

  constructor(d) {
    const C = new.target;
    super({
      x: d.x,
      y: d.y,
      w: C.ANCHO,
      h: C.ALTO,
      vx: Number.isFinite(d.vx) && d.vx !== 0 ? d.vx : C.VELOCIDAD,
      vy: Number.isFinite(d.vy) ? d.vy : 0,
      hp: Number.isFinite(d.hp) ? d.hp : C.VIDA,
    });
    if (C === Enemigo) throw new Error('Enemigo es abstracta: usá Enemigo.crear()');
    this.tipo = C.TIPO;
    this.facing = Math.sign(this.vx) || 1;
    this.estado = 'patrulla';
    this.estadoMs = 0; // tiempo en el estado actual
    this.sinVerMs = 0; // tiempo que lleva sin verte (persiguiendo)
    this.trabadoMs = 0; // tiempo empujando contra una pared (persiguiendo)
    this.retrocesoMs = 0;
    this.paso = 0; // avance del ciclo de piernas
    this.solMs = 0; // tiempo al sol (zombie, esqueleto)
    this.quemando = false;
    this.enojado = !!d.enojado; // (slime) le pegaste de día
  }

  // Lo mínimo para volver a crearlo igual al cargar la partida.
  serializar() {
    const d = { tipo: this.tipo, x: this.x, y: this.y, vx: this.vx, vy: this.vy, hp: this.hp };
    if (this.enojado) d.enojado = true;
    return d;
  }

  // Lista de { id, qty } que suelta al morir.
  drops() {
    return [];
  }

  cambiarEstado(estado) {
    this.estado = estado;
    this.estadoMs = 0;
    this.sinVerMs = 0;
    this.trabadoMs = 0;
  }

  // Efecto extra al pegarte (cada subclase suma el suyo, ej. el veneno).
  alPegar(juego) {
    if (this.quemando) juego.prenderFuego(); // quemándose, te contagia
  }

  // ¿Te ataca? Por defecto siempre (el slime lo cambia).
  esAgresivo(juego) {
    return true;
  }

  // Luz del sol directa (ver SurviGame.alSolDirecto): los que SE_QUEMA_AL_SOL
  // pierden vida de a poco y parpadean en naranja.
  quemarseAlSol(dt, juego) {
    const C = this.constructor;
    if (C.SE_QUEMA_AL_SOL && juego.alSolDirecto(this)) {
      this.quemando = true;
      this.solMs += dt;
      if (this.solMs >= C.SOL_MS) {
        this.solMs = 0;
        this.hp -= C.SOL_DANIO;
        this.hitMs = Criatura.PARPADEO_MS;
      }
    } else {
      this.quemando = false;
      this.solMs = 0;
    }
  }

  // Color que pisa todo el dibujo (null = ninguno). Quemándose ya no
  // parpadea en naranja: se le dibujan llamas encima (ver Llamas).
  tinte() {
    return null;
  }

  // Cualquier golpe también lo pone a perseguirte.
  recibirGolpe(dmg, dir) {
    super.recibirGolpe(dmg, dir);
    if (this.estado === 'patrulla') this.cambiarEstado('persigue');
  }

  // Distancia al jugador (centro a centro) y si te ve.
  mirarJugador(juego, vistaTiles) {
    const T = SurviConfig.TILE, player = juego.player;
    const dx = player.x + player.w / 2 - (this.x + this.w / 2);
    const dy = player.y + player.h / 2 - (this.y + this.h / 2);
    const cerca = Math.abs(dx) < vistaTiles * T && Math.abs(dy) < 6 * T;
    // en creativo o espectador los monstruos no te ven
    const teVe = cerca && !juego.dead && !juego.invisible && this.ve(juego.tilemap, player.x + player.w / 2, player.y + player.h / 3);
    return { dx, dy, teVe };
  }

  // ¿Sigue en el mapa? (muy lejos del jugador, se saca)
  sigueCerca(juego) {
    const T = SurviConfig.TILE, p = juego.player;
    const max = this.constructor.DISTANCIA_MAX_TILES * T;
    return Math.abs(this.x - p.x) <= max && Math.abs(this.y - p.y) <= max;
  }

  actualizar(dt, step, juego) {
    const C = this.constructor;
    const T = SurviConfig.TILE;
    const player = juego.player;
    if (this.hitMs > 0) this.hitMs -= dt;
    this.sentirFluidos(juego, dt);
    this.quemarseAlSol(dt, juego);
    this.estadoMs += dt;
    const agresivo = this.esAgresivo(juego);
    const mira = this.mirarJugador(juego, C.VISTA_TILES);
    const { dx, dy } = mira;
    const teVe = agresivo && mira.teVe;
    if (!agresivo && this.estado !== 'patrulla') this.cambiarEstado('patrulla'); // se calmó

    // ── decidir ──
    if (this.estado === 'patrulla' && teVe) {
      this.cambiarEstado('alerta');
      this.facing = Math.sign(dx) || this.facing;
      if (this.grounded) this.vy = -3; // saltito de sorpresa
    } else if (this.estado === 'alerta' && this.estadoMs >= C.ALERTA_MS) {
      this.cambiarEstado('persigue');
    } else if (this.estado === 'persigue') {
      this.sinVerMs = teVe ? 0 : this.sinVerMs + dt;
      const lejos = Math.abs(dx) > C.OLVIDO_TILES * T;
      if (lejos || this.sinVerMs > C.OLVIDO_MS || this.trabadoMs > 1200 || juego.dead) {
        const trabado = this.trabadoMs > 1200;
        this.cambiarEstado('patrulla');
        if (trabado) this.facing = -this.facing;
      }
    }

    // ── moverse ──
    let dir = this.facing, velocidad = C.VELOCIDAD, maxCaida = 1;
    if (this.retrocesoMs > 0) {
      this.retrocesoMs -= dt;
      dir = -Math.sign(dx) || -this.facing;
    } else if (this.estado === 'alerta') {
      velocidad = 0;
    } else if (this.estado === 'persigue') {
      // Justo arriba o abajo tuyo: no tiembla de un lado al otro.
      dir = Math.abs(dx) < 4 ? 0 : Math.sign(dx);
      velocidad = C.VELOCIDAD_PERSECUCION;
      maxCaida = 4;
    }
    const freno = this.moverHacia(dir, velocidad, juego, step, { maxCaida });
    if (this.retrocesoMs <= 0) this.facing = dir || this.facing;
    if (this.estado === 'persigue') {
      this.trabadoMs = freno === 'pared' ? this.trabadoMs + dt : 0;
      // si el jugador está arriba y hay una pared de 2, prueba igual un salto
      if (freno === 'pared' && dy < -T && this.grounded) this.vy = -Criatura.SALTO;
    } else if (freno && this.estado === 'patrulla') {
      this.facing = -this.facing;
    }
    this.contarPasos(step);

    // ── atacar (al tocarte) ──
    if (agresivo && C.DANIO > 0 && !juego.invisible && Engine2D.Collisions.rectOverlap(this, player)) {
      juego._damage(C.DANIO);
      this.alPegar(juego);
      player.empujar(this.x);
      this.retrocesoMs = C.RETROCESO_MS;
      this.vx = -Math.sign(dx || 1) * 2;
      this.vy = -2;
    }
    return this.sigueCerca(juego);
  }

  contarPasos(step) {
    if (this.vx !== 0 && this.grounded) this.paso += Math.abs(this.vx) * step;
    else if (this.grounded) this.paso = 0;
  }

  // Piernas: 0 o 1 según el avance.
  get fasePiernas() {
    return Math.floor(this.paso / 4) % 2;
  }

  // Igual que los animales: la subclase dibuja mirando a la derecha en
  // coordenadas locales con dibujarCuerpo(ctx, px, fase) y acá se espeja.
  dibujar(ctx, sx, sy) {
    const blanco = this.hitMs > 0;
    const tinte = this.tinte();
    const px = (x, y, w, h, color) => {
      ctx.fillStyle = blanco ? '#ffffff' : tinte || color;
      ctx.fillRect(x, y, w, h);
    };
    ctx.save();
    if (this.facing < 0) {
      ctx.translate(Math.round(sx) + this.w, Math.round(sy));
      ctx.scale(-1, 1);
    } else ctx.translate(Math.round(sx), Math.round(sy));
    this.dibujarCuerpo(ctx, px, this.fasePiernas);
    ctx.restore();
    // "!" arriba de la cabeza mientras está en alerta
    if (this.estado === 'alerta') {
      ctx.fillStyle = '#ffd23f';
      const x = Math.round(sx + this.w / 2 - 1), y = Math.round(sy);
      ctx.fillRect(x, y - 9, 2, 5);
      ctx.fillRect(x, y - 3, 2, 2);
    }
  }

  dibujarCuerpo(ctx, px, fase) {}
}

// ─── Slime: el enemigo de siempre ───
export class Slime extends Enemigo {
  static TIPO = 'slime';

  // De noche ataca; de día solo si lo hiciste enojar.
  esAgresivo(juego) {
    return this.enojado || juego.esNoche;
  }

  recibirGolpe(dmg, dir) {
    this.enojado = true;
    super.recibirGolpe(dmg, dir);
  }

  dibujarCuerpo(ctx, px) {
    const persigue = this.estado !== 'patrulla' || this.enojado;
    px(0, 0, this.w, this.h, persigue ? '#6fbf5c' : '#5aa469');
    px(0, 0, this.w, 1, '#8fd77c');
    const ojo = persigue ? '#7a1010' : '#12301b'; // ojos rojos cuando te persigue
    px(3, 4, 2, 2, ojo);
    px(this.w - 3, 4, 2, 2, ojo);
  }
}

// ─── Zombie: lento, aguanta y pega fuerte. Se quema al sol. ───
export class Zombie extends Enemigo {
  static TIPO = 'zombie';
  static ANCHO = 10;
  static ALTO = 22;
  static VIDA = 16;
  static DANIO = 3;
  static VELOCIDAD = 0.45;
  static VELOCIDAD_PERSECUCION = 0.8;
  static VISTA_TILES = 12;
  static OLVIDO_TILES = 20;
  static OLVIDO_MS = 4000; // insistente
  static SE_QUEMA_AL_SOL = true;
  static DROP_RARO = [
    [SurviConfig.FOOD.carrot, 0.08],
    [SurviConfig.FOOD.potato, 0.08],
  ];

  drops() {
    const lista = [{ id: SurviConfig.FOOD.meatRotten, qty: Animal.azar(0, 2) }];
    // a veces tiene una zanahoria o una papa (la única forma de conseguirlas, junto con los cofres de las minas)
    for (const [id, chance] of Zombie.DROP_RARO) if (Math.random() < chance) lista.push({ id, qty: 1 });
    return lista.filter((d) => d.qty > 0);
  }

  dibujarCuerpo(ctx, px, fase) {
    const piel = '#5f9e4a', pielOsc = '#3f7331', remera = '#3b6db3', remeraOsc = '#2a4f86', pantalon = '#4a3d8f', ojo = '#1a1a1a';
    // piernas (se alternan al caminar)
    const a = fase ? 1 : 0, b = fase ? 0 : 1;
    px(2, 15, 3, 7 - a, pantalon);
    px(5, 15, 3, 7 - b, pantalon);
    px(2, 21 - a, 3, 1, '#2d2560');
    px(5, 21 - b, 3, 1, '#2d2560');
    // torso
    px(1, 8, 8, 8, remera);
    px(1, 14, 8, 1, remeraOsc);
    px(2, 9, 1, 4, remeraOsc); // un roto
    // cabeza
    px(1, 0, 8, 8, piel);
    px(1, 0, 8, 1, pielOsc); // pelo ralo
    px(6, 3, 2, 2, ojo);
    px(3, 3, 2, 2, ojo);
    px(4, 6, 4, 1, pielOsc); // boca
    // brazos estirados hacia adelante
    px(5, 9, 5, 3, piel);
    px(5, 9, 5, 1, pielOsc);
  }
}

// ─── Esqueleto: solo en cuevas. Mantiene distancia y dispara flechas. ───
// Estados propios: 'patrulla' (como todos) y 'dispara': te vio, se acomoda
// entre DIST_MIN y DIST_MAX bloques (se aleja si te acercás, se acerca si
// estás lejos) y tira una flecha cada CADENCIA_MS mientras te vea.
export class Esqueleto extends Enemigo {
  static TIPO = 'esqueleto';
  static ANCHO = 10;
  static ALTO = 22;
  static VIDA = 12;
  static DANIO = 0; // no pega al tocarte: dispara
  static VELOCIDAD = 0.5;
  static VELOCIDAD_PERSECUCION = 0.75;
  static VISTA_TILES = 13;
  static OLVIDO_MS = 3000;
  static DIST_MIN = 4; // en bloques
  static DIST_MAX = 8;
  static CADENCIA_MS = 1900;
  static FLECHA_DANIO = 2;
  static FLECHA_VEL = 6;
  static PUNTERIA = 0.13; // error al apuntar (radianes, más o menos)
  static SE_QUEMA_AL_SOL = true;

  constructor(d) {
    super(d);
    this.recargaMs = 800 + Math.random() * 800;
    this.tensando = 0; // animación del arco tenso (ms)
  }

  drops() {
    return [{ id: SurviConfig.MAT.arrow, qty: Animal.azar(0, 3) }].filter((d) => d.qty > 0);
  }

  actualizar(dt, step, juego) {
    const C = Esqueleto;
    const T = SurviConfig.TILE;
    if (this.hitMs > 0) this.hitMs -= dt;
    if (this.tensando > 0) this.tensando -= dt;
    this.sentirFluidos(juego, dt);
    this.quemarseAlSol(dt, juego);
    this.estadoMs += dt;
    const { dx, dy, teVe } = this.mirarJugador(juego, C.VISTA_TILES);
    const dist = Math.abs(dx) / T;

    if (this.estado !== 'dispara' && teVe) this.cambiarEstado('dispara');
    else if (this.estado === 'dispara') {
      this.sinVerMs = teVe ? 0 : this.sinVerMs + dt;
      if (this.sinVerMs > C.OLVIDO_MS || juego.dead || dist > C.OLVIDO_TILES) this.cambiarEstado('patrulla');
    }

    let dir = this.facing, velocidad = C.VELOCIDAD;
    if (this.estado === 'dispara') {
      const haciaVos = Math.sign(dx) || this.facing;
      if (dist < C.DIST_MIN) dir = -haciaVos; // muy cerca: retrocede
      else if (dist > C.DIST_MAX || !teVe) dir = haciaVos; // lejos o sin verte: se acerca
      else dir = 0;
      velocidad = C.VELOCIDAD_PERSECUCION;
    }
    const freno = this.moverHacia(dir, velocidad, juego, step, { maxCaida: this.estado === 'dispara' ? 2 : 1 });
    if (dir === 0 && this.hitMs <= 0) this.vx = 0;
    if (this.estado === 'dispara') this.facing = Math.sign(dx) || this.facing; // siempre mirándote (camina de espaldas)
    else if (freno) this.facing = -this.facing;
    else if (dir) this.facing = dir;
    this.contarPasos(step);

    // ── disparar ──
    this.recargaMs -= dt;
    if (this.estado === 'dispara' && teVe && this.recargaMs <= 0 && dist <= C.VISTA_TILES) {
      this.recargaMs = C.CADENCIA_MS * (0.85 + Math.random() * 0.3);
      this.#disparar(juego);
    } else if (this.estado === 'dispara' && teVe && this.recargaMs < 350) this.tensando = 350;
    return this.sigueCerca(juego);
  }

  // Apunta al pecho del jugador compensando la caída de la flecha (vuela
  // recta FLECHA.rectaMs y después cae con FLECHA.gravedad), con algo de error.
  #disparar(juego) {
    const F = SurviConfig.FLECHA, C = Esqueleto;
    const p = juego.player;
    const ox = this.x + this.w / 2 + this.facing * 5, oy = this.y + 9;
    const tx = p.x + p.w / 2, ty = p.y + p.h / 3;
    const d = Math.hypot(tx - ox, ty - oy) || 1;
    const recto = (C.FLECHA_VEL * F.rectaMs) / (1000 / 60); // px que vuela sin caer
    const tCaida = Math.max(0, d - recto) / C.FLECHA_VEL; // frames cayendo (aprox.)
    const caida = 0.5 * F.gravedad * tCaida * tCaida;
    const ang = Math.atan2(ty - caida - oy, tx - ox) + (Math.random() * 2 - 1) * C.PUNTERIA;
    juego.sonar('arco', ox, oy);
    juego.flechas.push(
      new Flecha(ox, oy, Math.cos(ang) * C.FLECHA_VEL, Math.sin(ang) * C.FLECHA_VEL, C.FLECHA_DANIO, {
        enemiga: true,
        enLlamas: this.quemando, // esqueleto quemándose: flecha prendida fuego
      }),
    );
    this.tensando = 0;
  }

  dibujarCuerpo(ctx, px, fase) {
    const hueso = '#e4e2d6', sombra = '#a9a697', negro = '#1a1a1a', madera = '#8a5a2b';
    const a = fase ? 1 : 0, b = fase ? 0 : 1;
    // piernas finitas
    px(3, 15, 1, 7 - a, hueso);
    px(6, 15, 1, 7 - b, hueso);
    // pelvis y costillas
    px(2, 14, 6, 1, sombra);
    px(4, 8, 2, 6, hueso); // columna
    for (const y of [9, 11, 13]) px(2, y, 6, 1, hueso);
    // cráneo
    px(1, 0, 8, 7, hueso);
    px(1, 6, 8, 1, sombra);
    px(3, 2, 2, 2, negro);
    px(6, 2, 2, 2, negro);
    px(4, 5, 3, 1, negro); // dientes
    // brazo con el arco (tenso antes de disparar)
    const t = this.tensando > 0 ? 1 : 0;
    px(5, 9, 4, 1, hueso);
    px(9, 5, 1, 9, madera); // arco
    px(8, 4, 1, 1, madera);
    px(8, 14, 1, 1, madera);
    px(8 - t * 2, 6, 1, 7, '#dcdcdc'); // cuerda
  }
}

// ─── Serpiente: desierto. Baja y rápida; su mordida te envenena ───
// (cada mordida vuelve a llenar el veneno: ver SurviGame.envenenar).
export class Serpiente extends Enemigo {
  static TIPO = 'serpiente';
  static ANCHO = 14;
  static ALTO = 6;
  static VIDA = 8;
  static DANIO = 1;
  static VELOCIDAD = 0.35;
  static VELOCIDAD_PERSECUCION = 0.95;
  static VISTA_TILES = 7;
  static OLVIDO_TILES = 12;
  static RETROCESO_MS = 900;

  drops() {
    return [{ id: SurviConfig.FOOD.meatRaw, qty: Animal.azar(0, 1) }].filter((d) => d.qty > 0);
  }

  alPegar(juego) {
    super.alPegar(juego);
    juego.envenenar();
  }

  dibujarCuerpo(ctx, px) {
    const piel = '#b89a52', banda = '#6b5130', panza = '#e0cf94';
    const t = performance.now() / 140 + this.x * 0.2;
    const mueve = this.vx !== 0 ? 1 : 0.3;
    // cuerpo ondulado: 6 segmentos de 2 px que suben y bajan
    for (let i = 0; i < 6; i++) {
      const x = i * 2;
      const dy = Math.round(Math.sin(t + i * 1.1) * mueve);
      px(x, 3 + dy, 2, 2, i % 2 ? banda : piel);
      px(x, 5 + dy, 2, 1, panza);
    }
    // cola finita
    px(0, 4 + Math.round(Math.sin(t) * mueve), 1, 1, banda);
    // cabeza levantada
    px(11, 1, 3, 3, piel);
    px(12, 1, 1, 1, '#111111'); // ojo
    // lengua (sale de a ratos)
    if (Math.floor(t) % 3 === 0) px(14, 3, 1, 1, '#d63a3a');
  }
}

// ─── Ojo volador: aparece de noche desde el día 10 (ver SurviConfig.OJOS_DESDE_DIA) ───
// No usa gravedad: acelera hacia vos (con un leve vaivén), rebota contra los
// bloques y, al pegarte, retrocede y vuelve a embestir. Al amanecer se va
// volando para arriba y desaparece.
export class OjoVolador extends Enemigo {
  static TIPO = 'ojo';
  static ANCHO = 12;
  static ALTO = 12;
  static VIDA = 10;
  static DANIO = 2;
  static VEL_MAX = 1.5;
  static ACEL = 0.05;
  static RADIO = 6; // del globo (px)
  static IRIS = '#c0392b';
  static DISTANCIA_MAX_TILES = 50;

  constructor(d) {
    super(d);
    this.retrocesoMs = 0;
    this.huidaMs = 0;
  }

  // ¿Hay algún bloque sólido tocando la caja en (x, y)?
  #choca(map, x, y) {
    const T = SurviConfig.TILE;
    const c0 = Math.floor(x / T), c1 = Math.floor((x + this.w - 1) / T);
    const r0 = Math.floor(y / T), r1 = Math.floor((y + this.h - 1) / T);
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) if (map.isSolidAt(c, r)) return true;
    return false;
  }

  actualizar(dt, step, juego) {
    const C = this.constructor;
    const p = juego.player;
    if (this.hitMs > 0) this.hitMs -= dt;
    if (this.retrocesoMs > 0) this.retrocesoMs -= dt;
    this.estadoMs += dt;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const tx = p.x + p.w / 2, ty = p.y + p.h / 2;
    const huye = !juego.esNoche || juego.dead || juego.invisible; // si no te ve, se va
    let ax = 0, ay = 0;
    if (huye) {
      // de día (o si moriste): se va para arriba y afuera
      this.huidaMs += dt;
      ax = Math.sign(cx - tx || 1) * C.ACEL;
      ay = -C.ACEL * 1.6;
      if (this.huidaMs > 6000) return false;
    } else if (this.retrocesoMs <= 0 && this.hitMs <= 0) {
      const d = Math.hypot(tx - cx, ty - cy) || 1;
      ax = ((tx - cx) / d) * C.ACEL;
      ay = ((ty - cy) / d) * C.ACEL + Math.sin(this.estadoMs / 280) * 0.025; // vaivén
    }
    this.vx += ax * step;
    this.vy += ay * step;
    const v = Math.hypot(this.vx, this.vy), max = C.VEL_MAX * (huye ? 1.4 : 1);
    if (v > max) {
      this.vx *= max / v;
      this.vy *= max / v;
    }
    // mover eje por eje: si choca, rebota (y pierde velocidad)
    const map = juego.tilemap;
    const nx = this.x + this.vx * step;
    if (this.#choca(map, nx, this.y)) this.vx *= -0.6;
    else this.x = nx;
    const ny = this.y + this.vy * step;
    if (this.#choca(map, this.x, ny)) this.vy *= -0.6;
    else this.y = ny;
    this.x = Math.max(0, Math.min(SurviConfig.WORLD_W - this.w, this.x));
    this.y = Math.max(0, this.y);
    // embestida
    if (!huye && this.retrocesoMs <= 0 && Engine2D.Collisions.rectOverlap(this, p)) {
      juego._damage(C.DANIO);
      this.alPegar(juego);
      p.empujar(cx);
      const dir = Math.sign(cx - tx) || 1;
      this.vx = dir * 2.2;
      this.vy = -1.4;
      this.retrocesoMs = 450;
    }
    return this.sigueCerca(juego);
  }

  // Globo de pixeles, girado hacia donde vuela, con venas detrás.
  dibujar(ctx, sx, sy) {
    const C = this.constructor, R = C.RADIO;
    const blanco = this.hitMs > 0;
    const ang = Math.atan2(this.vy, this.vx || 0.001);
    ctx.save();
    ctx.translate(Math.round(sx + this.w / 2), Math.round(sy + this.h / 2));
    ctx.rotate(ang);
    if (this.vx < 0) ctx.scale(1, -1); // la boca / el brillo siempre del mismo lado
    const px = (x, y, w, h, color) => {
      ctx.fillStyle = blanco ? '#ffffff' : color;
      ctx.fillRect(x, y, w, h);
    };
    // venas / cola (ondulan)
    const t = this.estadoMs / 90;
    for (const [dy, largo] of [[-3, 7], [0, 9], [3, 7]]) {
      for (let i = 0; i < largo; i++) px(-R - i, dy + Math.round(Math.sin(t + i * 0.8 + dy) * 1), 1, 1, i % 3 ? '#9e2b2b' : '#c94a4a');
    }
    // globo
    for (let y = -R; y < R; y++) {
      for (let x = -R; x < R; x++) {
        const d = (x + 0.5) ** 2 + (y + 0.5) ** 2;
        if (d > R * R) continue;
        px(x, y, 1, 1, d > (R - 1) ** 2 ? '#d9b8b8' : '#f4eeee');
      }
    }
    px(-R + 2, -2, 2, 1, '#d96a6a'); // venitas en el blanco
    px(-R + 3, 2, 2, 1, '#d96a6a');
    this.dibujarCara(px, R);
    ctx.restore();
  }

  // Iris + pupila adelante (hacia donde vuela).
  dibujarCara(px, R) {
    const I = this.constructor.IRIS;
    px(R - 5, -3, 4, 6, I);
    px(R - 6, -2, 1, 4, I);
    px(R - 4, -1, 2, 2, '#111111');
    px(R - 5, -3, 1, 1, '#ffffff'); // brillo
  }
}

// ─── Ojo con boca: más grande, más resistente y pega más fuerte ───
export class OjoBoca extends OjoVolador {
  static TIPO = 'ojo_boca';
  static ANCHO = 14;
  static ALTO = 14;
  static VIDA = 18;
  static DANIO = 4;
  static VEL_MAX = 1.35;
  static RADIO = 7;
  static IRIS = '#7d1f5c';

  // ojo arriba y una boca con dientes abajo, las dos cosas mirando adelante
  dibujarCara(px, R) {
    const I = this.constructor.IRIS;
    px(R - 5, -5, 4, 4, I);
    px(R - 4, -4, 2, 2, '#111111');
    px(R - 5, -5, 1, 1, '#ffffff');
    // boca abierta que se mueve
    const abre = Math.floor(this.estadoMs / 160) % 2;
    px(R - 7, 1, 7, 3 + abre, '#3a0a0a');
    for (const x of [R - 7, R - 5, R - 3]) px(x, 1, 1, 1, '#ffffff'); // dientes de arriba
    for (const x of [R - 6, R - 4, R - 2]) px(x, 3 + abre, 1, 1, '#ffffff'); // de abajo
    px(R - 7, 0, 7, 1, '#b04a4a'); // labio
  }
}

// ─────────────────────────────────────
//   Mobs de los biomas de cueva
// ─────────────────────────────────────

// Proyectil de un mob: telaraña (araña) o bola de nieve (yeti). Vuela con
// gravedad; si te pega, daño + efecto (enredado / congelado). Contra un
// bloque se deshace.
export class ProyectilMob extends Engine2D.Entity {
  static TIPOS = {
    telarana: { tam: 6, g: 0.08, danio: 1, colores: ['#f2f2f2', '#d8d8d8', '#bfbfbf'] },
    nieve: { tam: 5, g: 0.14, danio: 1, colores: ['#ffffff', '#e4f3ff', '#b8dcf5'] },
  };
  static VIDA_MS = 4000;

  constructor(tipo, x, y, vx, vy) {
    const D = ProyectilMob.TIPOS[tipo];
    super({ x: x - D.tam / 2, y: y - D.tam / 2, w: D.tam, h: D.tam, vx, vy });
    this.tipo = tipo;
    this.ms = 0;
  }

  #deshacer(juego) {
    const D = ProyectilMob.TIPOS[this.tipo];
    if (juego.particulas) juego.particulas.chispas(this.x + this.w / 2, this.y + this.h / 2, D.colores, 7);
    juego.sonar(this.tipo === 'nieve' ? 'nieve' : 'telarana', this.x, this.y);
  }

  actualizar(dt, step, juego) {
    const D = ProyectilMob.TIPOS[this.tipo], T = SurviConfig.TILE;
    this.ms += dt;
    if (this.ms > ProyectilMob.VIDA_MS) return false;
    this.vy += D.g * step;
    this.x += this.vx * step;
    this.y += this.vy * step;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    if (cx < 0 || cy < 0 || cx >= SurviConfig.WORLD_W || cy >= SurviConfig.WORLD_H) return false;
    if (juego.tilemap.isSolidAt(Math.floor(cx / T), Math.floor(cy / T)) || juego.fluidos.tipo(Math.floor(cx / T), Math.floor(cy / T))) {
      this.#deshacer(juego);
      return false;
    }
    const p = juego.player;
    if (!juego.dead && !juego.invisible && Engine2D.Collisions.rectOverlap(this, p)) {
      juego._damage(D.danio);
      if (this.tipo === 'telarana') juego.enredar();
      else {
        juego.congelar();
        p.empujar(this.x - Math.sign(this.vx) * 10); // la bola de nieve empuja
      }
      this.#deshacer(juego);
      return false;
    }
    return true;
  }

  dibujar(ctx, sx, sy) {
    const x = Math.round(sx), y = Math.round(sy);
    if (this.tipo === 'nieve') {
      ctx.fillStyle = '#f4faff';
      ctx.fillRect(x + 1, y, 3, 5);
      ctx.fillRect(x, y + 1, 5, 3);
      ctx.fillStyle = '#b8dcf5';
      ctx.fillRect(x + 3, y + 3, 1, 1);
      ctx.fillRect(x + 1, y + 4, 2, 1);
    } else {
      // bollito de telaraña: una cruz con hilos
      ctx.fillStyle = 'rgba(240,240,240,0.9)';
      ctx.fillRect(x + 2, y, 2, 6);
      ctx.fillRect(x, y + 2, 6, 2);
      ctx.fillRect(x + 1, y + 1, 1, 1);
      ctx.fillRect(x + 4, y + 1, 1, 1);
      ctx.fillRect(x + 1, y + 4, 1, 1);
      ctx.fillRect(x + 4, y + 4, 1, 1);
    }
  }
}

// ─── Araña de cueva (cuevas de musgo) ───
// Rápida y baja. Persiguiéndote TREPA las paredes (no se queda trabada) y
// desde lejos te tira telaraña: si te pega quedás ENREDADO (muy lento y
// casi sin salto) unos segundos. Suelta hilo.
export class Arana extends Enemigo {
  static TIPO = 'arana';
  static ANCHO = 16;
  static ALTO = 8;
  static VIDA = 10;
  static DANIO = 2;
  static VELOCIDAD = 0.6;
  static VELOCIDAD_PERSECUCION = 1.2;
  static VISTA_TILES = 11;
  static OLVIDO_MS = 3500;
  static TELA_MS = 3200; // cada cuánto tira telaraña
  static TELA_VEL = 3.6;
  static TELA_DIST = [3, 9]; // en bloques
  static TREPA_VEL = 1.9;

  constructor(d) {
    super(d);
    this.recargaMs = 1500 + Math.random() * 1500;
    this.trepaMs = 0;
    this.escupeMs = 0; // animación
  }

  drops() {
    return [{ id: SurviConfig.MAT.string, qty: Animal.azar(1, 2) }];
  }

  actualizar(dt, step, juego) {
    const C = Arana, T = SurviConfig.TILE;
    // trepando: sube por la pared (le gana a la gravedad)
    if (this.trepaMs > 0) {
      this.trepaMs -= dt;
      this.vy = Math.min(this.vy, -C.TREPA_VEL);
    }
    if (this.escupeMs > 0) this.escupeMs -= dt;
    const sigue = super.actualizar(dt, step, juego);
    // contra una pared persiguiéndote: en vez de rendirse, trepa (y sigue
    // trepando mientras tenga la pared adelante)
    if (this.estado === 'persigue' && this.trabadoMs > 0) {
      this.trepaMs = 260;
      this.trabadoMs = 0;
    }
    if (this.trepaMs > 0 && juego.tilemap.isSolidAt(this.colFrente(this.facing), Math.floor((this.y + this.h - 1) / T))) this.trepaMs = 260;
    // telaraña a distancia
    this.recargaMs -= dt;
    if (this.estado === 'persigue' && this.recargaMs <= 0) {
      const { dx, teVe } = this.mirarJugador(juego, C.VISTA_TILES);
      const dist = Math.abs(dx) / T;
      if (teVe && dist >= C.TELA_DIST[0] && dist <= C.TELA_DIST[1]) {
        this.recargaMs = C.TELA_MS * (0.8 + Math.random() * 0.4);
        const p = juego.player, ox = this.x + this.w / 2, oy = this.y + 2;
        const v = Criatura.tiroParabolico(ox, oy, p.x + p.w / 2, p.y + p.h / 2, C.TELA_VEL, ProyectilMob.TIPOS.telarana.g);
        juego.flechas.push(new ProyectilMob('telarana', ox, oy, v.vx, v.vy));
        juego.sonar('telarana', ox, oy);
        this.escupeMs = 250;
      } else this.recargaMs = 400; // vuelve a probar pronto
    }
    return sigue;
  }

  dibujarCuerpo(ctx, px, fase) {
    const cuerpo = '#2b2622', lomo = '#3d352e', pata = '#1c1815', ojo = '#e0302a';
    const t = Math.floor(this.paso / 2 + (this.trepaMs > 0 ? performance.now() / 60 : 0));
    // línea de pixeles (para las patas)
    const linea = (x0, y0, x1, y1) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
      for (let k = 0; k <= n; k++) px(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), 1, 1, pata);
    };
    // 8 patas (se ven 4 por lado): del cuerpo suben a la rodilla y bajan
    // abiertas; las de atrás hacia atrás y las de adelante hacia adelante
    for (let i = 0; i < 4; i++) {
      const ax = [5, 7, 9, 11][i], d = i < 2 ? -1 : 1, paso = (t + i) % 2;
      const kx = ax + d * (2 + (i === 0 || i === 3 ? 1 : 0)), fx = kx + d * (2 + paso);
      linea(ax, 3, kx, 0);
      linea(kx, 0, fx, 7 - paso);
    }
    // abdomen (atrás) y cabeza (adelante)
    px(2, 2, 7, 4, cuerpo);
    px(3, 1, 5, 1, cuerpo);
    px(3, 6, 5, 1, cuerpo);
    px(3, 2, 4, 1, lomo);
    px(4, 3, 2, 2, '#8a1f1a'); // marca roja
    px(9, 3, 4, 3, cuerpo);
    px(13, 4, 1, 2, cuerpo); // colmillos
    // ojos rojos
    px(10, 3, 1, 1, ojo);
    px(12, 3, 1, 1, ojo);
    px(11, 4, 1, 1, ojo);
    if (this.escupeMs > 0) px(14, 5, 1, 1, '#f2f2f2');
  }


}

// ─── Yeti chico (cuevas de hielo) ───
// Grandote y lento, aguanta mucho. Te tira BOLAS DE NIEVE (empujan y te
// dejan CONGELADO: más lento) y de cerca pega fuerte. Suelta hielo azul y
// a veces cuero.
export class Yeti extends Enemigo {
  static TIPO = 'yeti';
  static ANCHO = 12;
  static ALTO = 16;
  static VIDA = 22;
  static DANIO = 3;
  static VELOCIDAD = 0.4;
  static VELOCIDAD_PERSECUCION = 0.85;
  static VISTA_TILES = 12;
  static OLVIDO_TILES = 18;
  static OLVIDO_MS = 3500;
  static NIEVE_MS = 2400;
  static NIEVE_VEL = 4;
  static NIEVE_DIST = [3, 10];

  constructor(d) {
    super(d);
    this.recargaMs = 1200 + Math.random() * 1200;
    this.lanzaMs = 0;
  }

  drops() {
    return [
      { id: SurviConfig.TID.hielo_azul, qty: Animal.azar(1, 2) },
      { id: SurviConfig.MAT.leather, qty: Animal.azar(0, 1) },
    ].filter((d) => d.qty > 0);
  }

  alPegar(juego) {
    super.alPegar(juego);
    juego.congelar(1500); // su abrazo también enfría
  }

  actualizar(dt, step, juego) {
    const C = Yeti, T = SurviConfig.TILE;
    if (this.lanzaMs > 0) this.lanzaMs -= dt;
    const sigue = super.actualizar(dt, step, juego);
    this.recargaMs -= dt;
    if (this.estado === 'persigue' && this.recargaMs <= 0) {
      const { dx, teVe } = this.mirarJugador(juego, C.VISTA_TILES);
      const dist = Math.abs(dx) / T;
      if (teVe && dist >= C.NIEVE_DIST[0] && dist <= C.NIEVE_DIST[1]) {
        this.recargaMs = C.NIEVE_MS * (0.8 + Math.random() * 0.4);
        const p = juego.player, ox = this.x + this.w / 2 + this.facing * 4, oy = this.y + 2;
        const v = Criatura.tiroParabolico(ox, oy, p.x + p.w / 2, p.y + p.h / 3, C.NIEVE_VEL, ProyectilMob.TIPOS.nieve.g);
        juego.flechas.push(new ProyectilMob('nieve', ox, oy, v.vx, v.vy));
        juego.sonar('yeti', ox, oy);
        this.lanzaMs = 300;
      } else this.recargaMs = 500;
    }
    return sigue;
  }

  dibujarCuerpo(ctx, px, fase) {
    const pelo = '#eef4fb', sombra = '#c3d3e4', cara = '#6f8fb3', ojo = '#1a2a3a';
    const a = fase ? 1 : 0, b = fase ? 0 : 1;
    // patas
    px(2, 12, 3, 4 - a, sombra);
    px(7, 12, 3, 4 - b, sombra);
    // cuerpo peludo
    px(1, 5, 10, 8, pelo);
    px(0, 7, 1, 4, pelo);
    px(1, 12, 10, 1, sombra);
    for (const [x, y] of [[2, 6], [5, 9], [8, 7], [3, 11]]) px(x, y, 1, 1, sombra); // mechones
    // cabeza con la cara azul
    px(2, 0, 8, 6, pelo);
    px(4, 2, 5, 3, cara);
    px(5, 2, 1, 1, ojo);
    px(7, 2, 1, 1, ojo);
    px(5, 4, 3, 1, '#3d5a7a'); // boca
    // brazo: levantado con la bola de nieve si está tirando
    if (this.lanzaMs > 0) {
      px(8, 0, 3, 6, pelo);
      px(9, -2, 3, 3, '#ffffff');
    } else px(9, 6, 3, 6, pelo);
  }
}

// ─── Murciélago (cuevas de estalactitas, y alguno en cualquier cueva) ───
// Duerme colgado del techo. Se despierta si te acercás o si hacés ruido
// picando cerca, y te ataca volando en zigzag: rápido pero con poca vida.
// Si te perdés, vuelve a colgarse de un techo.
export class Murcielago extends Enemigo {
  static TIPO = 'murcielago';
  static ANCHO = 10;
  static ALTO = 7;
  static VIDA = 4;
  static DANIO = 1;
  static VEL_MAX = 2.1;
  static ACEL = 0.09;
  static DESPIERTA_TILES = 5; // si te ve a esta distancia, se despierta
  static RUIDO_TILES = 9; // picar/romper a esta distancia lo despierta
  static OLVIDO_TILES = 16;
  static DISTANCIA_MAX_TILES = 50;

  constructor(d) {
    super(d);
    this.estado = d.estado === 'vuela' ? 'vuela' : 'duerme';
    if (this.estado === 'duerme') this.vx = this.vy = 0;
    this.fase = Math.random() * 10; // para que no zigzagueen todos igual
    this.retrocesoMs = 0;
  }

  serializar() {
    return { ...super.serializar(), estado: this.estado };
  }

  drops() {
    return [{ id: SurviConfig.MAT.leather, qty: Math.random() < 0.35 ? 1 : 0 }].filter((d) => d.qty > 0);
  }

  despertar(juego) {
    if (this.estado !== 'duerme') return;
    this.cambiarEstado('vuela');
    this.vy = 1; // se suelta del techo
    juego.sonar('murcielago', this.x + this.w / 2, this.y);
  }

  recibirGolpe(dmg, dir) {
    Criatura.prototype.recibirGolpe.call(this, dmg, dir);
    if (this.estado !== 'vuela') this.cambiarEstado('vuela');
  }

  actualizar(dt, step, juego) {
    const C = Murcielago, T = SurviConfig.TILE, map = juego.tilemap, p = juego.player;
    if (this.hitMs > 0) this.hitMs -= dt;
    if (this.retrocesoMs > 0) this.retrocesoMs -= dt;
    this.estadoMs += dt;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const tx = p.x + p.w / 2, ty = p.y + p.h / 3;
    const d = Math.hypot(tx - cx, ty - cy);
    if (this.estado === 'duerme') {
      this.vx = this.vy = 0;
      // se cayó el techo, lo viste de cerca o hiciste ruido: se despierta
      const techo = map.isSolidAt(Math.floor(cx / T), Math.floor((this.y - 1) / T));
      const teVe = !juego.invisible && !juego.dead && d < C.DESPIERTA_TILES * T && this.ve(map, tx, ty);
      if (!techo || teVe || juego.ruidoCerca(cx, cy, C.RUIDO_TILES * T)) this.despertar(juego);
      return this.sigueCerca(juego);
    }
    let ax = 0, ay = 0;
    const perdido = juego.dead || juego.invisible || d > C.OLVIDO_TILES * T;
    if (this.estado === 'vuela' && perdido) this.cambiarEstado('vuelve');
    if (this.estado === 'vuelve') {
      // sube hasta encontrar techo y se cuelga
      ay = -C.ACEL;
      ax = Math.sin(this.estadoMs / 400 + this.fase) * C.ACEL * 0.5;
      if (!perdido && d < C.DESPIERTA_TILES * T) this.cambiarEstado('vuela');
      if (this.estadoMs > 10000) return false; // no encontró dónde: se va
    } else if (this.retrocesoMs > 0) {
      ax = Math.sign(cx - tx || 1) * C.ACEL;
      ay = -C.ACEL * 0.6;
    } else {
      // zigzag hacia vos: el objetivo se mueve alrededor tuyo
      const t = this.estadoMs / 1000 + this.fase;
      const ox = Math.sin(t * 5.3) * 22, oy = Math.cos(t * 3.7) * 14 - 4;
      const gx = tx + (d > 40 ? ox : 0) - cx, gy = ty + (d > 40 ? oy : 0) - cy;
      const n = Math.hypot(gx, gy) || 1;
      ax = (gx / n) * C.ACEL;
      ay = (gy / n) * C.ACEL;
    }
    this.vx += ax * step;
    this.vy += ay * step;
    const v = Math.hypot(this.vx, this.vy), max = C.VEL_MAX * (this.estado === 'vuelve' ? 0.6 : 1);
    if (v > max) {
      this.vx *= max / v;
      this.vy *= max / v;
    }
    const nx = this.x + this.vx * step;
    if (this.chocaEn(map, nx, this.y)) this.vx *= -0.5;
    else this.x = nx;
    const ny = this.y + this.vy * step;
    if (this.chocaEn(map, this.x, ny)) {
      // tocó el techo volviendo: se cuelga
      if (this.estado === 'vuelve' && this.vy < 0) {
        this.y = Math.floor(this.y / T) * T;
        this.cambiarEstado('duerme');
        this.vx = this.vy = 0;
        return this.sigueCerca(juego);
      }
      this.vy *= -0.5;
    } else this.y = ny;
    if (this.vx) this.facing = Math.sign(this.vx);
    // mordida
    if (this.estado === 'vuela' && this.retrocesoMs <= 0 && !juego.invisible && Engine2D.Collisions.rectOverlap(this, p)) {
      juego._damage(C.DANIO);
      this.alPegar(juego);
      this.retrocesoMs = 700;
      this.vx = Math.sign(cx - tx || 1) * 2;
      this.vy = -1.5;
    }
    return this.sigueCerca(juego);
  }

  dibujar(ctx, sx, sy) {
    const blanco = this.hitMs > 0;
    const px = (x, y, w, h, color) => {
      ctx.fillStyle = blanco ? '#ffffff' : color;
      ctx.fillRect(Math.round(sx) + x, Math.round(sy) + y, w, h);
    };
    const cuerpo = '#3a2f3f', ala = '#2a2230', ojo = '#ff5a4a';
    if (this.estado === 'duerme') {
      // colgado cabeza abajo, con las alas cerradas
      px(4, 0, 1, 1, ala); // patitas
      px(6, 0, 1, 1, ala);
      px(3, 1, 5, 5, ala);
      px(4, 2, 3, 4, cuerpo);
      px(4, 6, 3, 1, cuerpo); // cabeza (abajo)
      px(4, 6, 1, 1, '#5a4a60'); // orejas
      px(6, 6, 1, 1, '#5a4a60');
      return;
    }
    const aleteo = Math.floor(this.estadoMs / 70 + this.fase) % 3; // 0 arriba, 1 medio, 2 abajo
    // alas (membrana con el borde de abajo festoneado), según el aleteo
    const ALAS = [
      [[0, 0, 4], [1, 1, 3], [0, 2, 1], [2, 2, 1]],
      [[0, 2, 4], [0, 3, 1], [2, 3, 1]],
      [[1, 3, 3], [0, 4, 3], [0, 5, 1]],
    ][aleteo];
    for (const [x, y, w] of ALAS) {
      px(x, y, w, 1, ala); // izquierda
      px(11 - x - w, y, w, 1, ala); // derecha (espejada)
    }
    // cuerpo y cabeza
    px(4, 2, 3, 4, cuerpo);
    px(4, 1, 1, 1, cuerpo); // orejas
    px(6, 1, 1, 1, cuerpo);
    px(4, 3, 1, 1, ojo);
    px(6, 3, 1, 1, ojo);
  }
}

// ─────────────────────────────────────
//   Mobs de la superficie (noche)
// ─────────────────────────────────────

// ─── Hongo explosivo ───
// De noche. Se te acerca callado y, cuando está pegado, prende la MECHA:
// se infla y parpadea en blanco… y explota (daño según la distancia y
// rompe bloques; en Fácil no rompe). Si te alejás a tiempo, la apaga y te
// vuelve a seguir. Se quema al sol. Matándolo antes: suelta pólvora.
export class HongoExplosivo extends Enemigo {
  static TIPO = 'hongo';
  static ANCHO = 12;
  static ALTO = 14;
  static VIDA = 12;
  static DANIO = 0; // no muerde: explota
  static VELOCIDAD = 0.45;
  static VELOCIDAD_PERSECUCION = 0.9;
  static VISTA_TILES = 12;
  static OLVIDO_MS = 4000;
  static SE_QUEMA_AL_SOL = true;
  static MECHA_MS = 1400;
  static PRENDE_TILES = 1.6; // a esta distancia prende la mecha
  static APAGA_TILES = 3.4; // si te alejás más, la apaga

  constructor(d) {
    super(d);
    this.mechaMs = 0; // > 0: prendida (lo que lleva)
  }

  drops() {
    return [{ id: SurviConfig.MAT.polvora, qty: Animal.azar(1, 2) }];
  }

  get prendido() {
    return this.mechaMs > 0;
  }

  actualizar(dt, step, juego) {
    const C = HongoExplosivo, T = SurviConfig.TILE, p = juego.player;
    const dx = p.x + p.w / 2 - (this.x + this.w / 2), dy = p.y + p.h / 2 - (this.y + this.h / 2);
    const dist = Math.hypot(dx, dy) / T;
    if (this.prendido) {
      // quieto, inflándose; si te fuiste (o no te ve), la apaga
      this.sentirFluidos(juego, dt);
      this.quemarseAlSol(dt, juego);
      if (this.hitMs > 0) this.hitMs -= dt;
      this.moverHacia(0, 0, juego, step);
      if (this.hitMs <= 0) this.vx = 0;
      this.mechaMs += dt;
      if (dist > C.APAGA_TILES || juego.dead || juego.invisible || (this.fluido && this.fluido.agua)) {
        this.mechaMs = 0; // el agua también la apaga
        return this.sigueCerca(juego);
      }
      if (this.mechaMs >= C.MECHA_MS) {
        juego.explotar(this.x + this.w / 2, this.y + this.h / 2, 'hongo', this);
        this.hp = 0; // se voló (no suelta pólvora)
        this.exploto = true;
        return false;
      }
      return true;
    }
    const sigue = super.actualizar(dt, step, juego);
    if (this.estado === 'persigue' && dist < C.PRENDE_TILES && !juego.invisible && !juego.dead && !(this.fluido && this.fluido.agua)) {
      this.mechaMs = 1;
      juego.sonar('mecha', this.x + this.w / 2, this.y);
    }
    return sigue;
  }

  // Inflado + parpadeo blanco mientras la mecha está prendida.
  dibujar(ctx, sx, sy) {
    if (!this.prendido) return super.dibujar(ctx, sx, sy);
    const k = this.mechaMs / HongoExplosivo.MECHA_MS; // 0 → 1
    const infla = 1 + 0.22 * k;
    const cada = 220 - 150 * k; // parpadea cada vez más rápido
    const blanco = Math.floor(this.mechaMs / cada) % 2 === 0;
    const px = (x, y, w, h, color) => {
      ctx.fillStyle = blanco ? '#ffffff' : color;
      ctx.fillRect(x, y, w, h);
    };
    ctx.save();
    ctx.translate(Math.round(sx + this.w / 2), Math.round(sy + this.h)); // desde los pies
    ctx.scale(infla * (this.facing < 0 ? -1 : 1), infla);
    ctx.translate(-this.w / 2, -this.h);
    this.dibujarCuerpo(ctx, px, 0);
    ctx.restore();
  }

  dibujarCuerpo(ctx, px, fase) {
    const sombrero = '#c9352c', sombreroOsc = '#96231d', punto = '#f4eee0', pie = '#e8dcc0', pieOsc = '#c9b996', ojo = '#1a1a1a';
    const a = fase ? 1 : 0, b = fase ? 0 : 1;
    // patitas
    px(3, 12, 2, 2 - a, pieOsc);
    px(7, 12, 2, 2 - b, pieOsc);
    // pie (cuerpo) con cara
    px(3, 6, 6, 7, pie);
    px(3, 12, 6, 1, pieOsc);
    px(4, 8, 1, 2, ojo);
    px(7, 8, 1, 2, ojo);
    px(5, 11, 2, 1, ojo); // boca
    // sombrero grande con puntos
    px(0, 3, 12, 3, sombrero);
    px(1, 1, 10, 2, sombrero);
    px(3, 0, 6, 1, sombrero);
    px(0, 5, 12, 1, sombreroOsc);
    px(2, 2, 2, 1, punto);
    px(7, 1, 2, 2, punto);
    px(9, 4, 2, 1, punto);
    px(4, 4, 1, 1, punto);
  }
}

// ─── Momia: el zombie del desierto (de noche) ───
// No se quema al sol. Sus golpes, además del daño, te dan HAMBRE.
// Suelta vendas (hilo) y a veces carne podrida.
export class Momia extends Enemigo {
  static TIPO = 'momia';
  static ANCHO = 10;
  static ALTO = 22;
  static VIDA = 18;
  static DANIO = 2;
  static VELOCIDAD = 0.42;
  static VELOCIDAD_PERSECUCION = 0.78;
  static VISTA_TILES = 12;
  static OLVIDO_TILES = 20;
  static OLVIDO_MS = 4000;

  drops() {
    return [
      { id: SurviConfig.MAT.string, qty: Animal.azar(1, 2) },
      { id: SurviConfig.FOOD.meatRotten, qty: Animal.azar(0, 1) },
    ].filter((d) => d.qty > 0);
  }

  alPegar(juego) {
    super.alPegar(juego);
    juego.darHambre(SurviConfig.MOMIA_HAMBRE);
  }

  dibujarCuerpo(ctx, px, fase) {
    const venda = '#d9ccb0', vendaOsc = '#b3a584', raya = '#8f8266', ojo = '#3fd16a';
    const a = fase ? 1 : 0, b = fase ? 0 : 1;
    // piernas
    px(2, 15, 3, 7 - a, venda);
    px(5, 15, 3, 7 - b, vendaOsc);
    // torso vendado (rayas en diagonal)
    px(1, 8, 8, 8, venda);
    for (const y of [9, 12, 15]) px(1, y, 8, 1, raya);
    px(6, 10, 3, 1, vendaOsc);
    // cabeza con ojos verdes que brillan
    px(1, 0, 8, 8, venda);
    px(1, 2, 8, 1, raya);
    px(1, 6, 8, 1, raya);
    px(3, 4, 2, 1, ojo);
    px(6, 4, 2, 1, ojo);
    // brazos estirados, con una venda colgando
    px(5, 9, 5, 3, venda);
    px(5, 11, 5, 1, raya);
    px(8, 12, 1, 2 + a, vendaOsc);
  }
}

// ─── TNT prendida ───
// La TNT del mundo, ya encendida: parpadea en blanco, cae si no tiene
// piso y a los TNT_MECHA_MS explota (SurviGame.explotar).
export class TntEncendida extends Engine2D.Entity {
  constructor(col, row, ms = SurviConfig.TNT_MECHA_MS) {
    const T = SurviConfig.TILE;
    super({ x: col * T, y: row * T, w: T, h: T, vx: 0, vy: 0 });
    this.ms = ms;
    this.total = ms;
  }

  actualizar(dt, step, juego) {
    const T = SurviConfig.TILE, map = juego.tilemap;
    this.ms -= dt;
    // cae si no tiene nada abajo
    const c = Math.floor((this.x + T / 2) / T), abajo = Math.floor((this.y + T) / T);
    if (!map.isSolidAt(c, abajo)) {
      this.vy = Math.min(this.vy + 0.5 * step, 7);
      this.y += this.vy * step;
      if (map.isSolidAt(c, Math.floor((this.y + T) / T))) {
        this.y = Math.floor((this.y + T) / T) * T - T;
        this.vy = 0;
      }
    }
    if (this.ms <= 0) {
      juego.explotar(this.x + T / 2, this.y + T / 2, 'tnt', this);
      return false;
    }
    return true;
  }

  dibujar(ctx, sx, sy, juego) {
    const T = SurviConfig.TILE, id = SurviConfig.TID.tnt;
    const img = juego._tilesetCanvas, tc = SurviConfig.TILESET_COLS, i = id - 1;
    if (img) ctx.drawImage(img, (i % tc) * T, Math.floor(i / tc) * T, T, T, Math.round(sx), Math.round(sy), T, T);
    // parpadeo blanco, cada vez más rápido
    const k = 1 - this.ms / this.total;
    if (Math.floor(this.ms / (250 - 180 * k)) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(Math.round(sx), Math.round(sy), T, T);
    }
  }
}

Enemigo.registrar(Slime);
Enemigo.registrar(OjoVolador);
Enemigo.registrar(OjoBoca);
Enemigo.registrar(Zombie);
Enemigo.registrar(Esqueleto);
Enemigo.registrar(Serpiente);
Enemigo.registrar(Arana);
Enemigo.registrar(Yeti);
Enemigo.registrar(Murcielago);
Enemigo.registrar(HongoExplosivo);
Enemigo.registrar(Momia);

// ─────────────────────────────────────
//   Animales
// ─────────────────────────────────────
// Pasivos: alternan entre quedarse quietos y caminar para un lado al azar.
// Suben escalones de 1 bloque saltando, se dan vuelta ante una pared más
// alta o un precipicio, y si los golpeás huyen rápido unos segundos.
export class Animal extends Criatura {
  // Lo define cada subclase:
  static TIPO = '';
  static ANCHO = 12;
  static ALTO = 10;
  static VIDA = 6;
  static VELOCIDAD = 0.5;
  static ASUSTADIZA = false; // si true, huye cuando te acercás corriendo

  static HUIDA_MS = 3000;
  static MULT_HUIDA = 2.2;
  static MANADA_TILES = 15; // hasta acá busca a otros de su especie
  static DISTANCIA_MAX_TILES = 60; // más lejos, se saca del mapa (y aparecen otros)

  // Registro tipo → clase, para crear el animal correcto al cargar la partida.
  static #tipos = new Map();

  static registrar(Clase) {
    Animal.#tipos.set(Clase.TIPO, Clase);
  }

  // Fábrica: d = { tipo, x, y, hp?, facing? } (nuevo o guardado). null si el tipo no existe.
  static crear(d) {
    const Clase = d && Animal.#tipos.get(d.tipo);
    return Clase ? new Clase(d) : null;
  }

  static get tipos() {
    return [...Animal.#tipos.keys()];
  }

  // Entero al azar entre min y max (incluidos).
  static azar(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  constructor(d) {
    const C = new.target;
    super({
      x: d.x,
      y: d.y,
      w: C.ANCHO,
      h: C.ALTO,
      hp: Number.isFinite(d.hp) ? d.hp : C.VIDA,
      facing: d.facing === -1 ? -1 : 1,
    });
    if (C === Animal) throw new Error('Animal es abstracta: usá Animal.crear()');
    this.tipo = C.TIPO;
    this.caminando = false;
    this.estadoMs = 500 + Math.random() * 1500; // cuánto le queda al estado actual
    this.huyendoMs = 0;
    this.huyeDeX = 0; // de dónde escapa
    this.paso = 0; // avance del ciclo de patas (se anima solo al moverse)
    // ── crianza ──
    this.domestico = !!d.domestico; // alimentado por vos: no desaparece nunca
    this.celoMs = d.celoMs > 0 ? d.celoMs : 0; // corazones: busca pareja
    this.esperaMs = d.esperaMs > 0 ? d.esperaMs : 0; // tiempo hasta poder criar de nuevo
    this.edadMs = d.edadMs > 0 ? d.edadMs : 0; // > 0 → es cría (lo que le falta para crecer)
    this.huevoMs = d.huevoMs > 0 ? d.huevoMs : Animal.#azarMs(SurviConfig.CRIANZA.huevoMs);
    this.t = Math.random() * 1000; // para animar los corazones
    this.mimoMs = 0; // corazones al darle de comer
    this.distSigue = 1.2 + Math.random() * 1.8; // a cuántos bloques tuyo se frena cuando te sigue (así no se amontonan)
    if (this.esCria) this.#ajustarTamanio();
  }

  static #azarMs([a, b]) {
    return a + Math.random() * (b - a);
  }

  get esCria() {
    return this.edadMs > 0;
  }

  // Comida que acepta (vacío = no se cría: aves).
  get comida() {
    return SurviConfig.CRIANZA.comida[this.tipo] || [];
  }

  // Cría: más chica. Adulta: tamaño normal (crece hacia arriba, sin hundirse).
  #ajustarTamanio() {
    const C = this.constructor, k = this.esCria ? SurviConfig.CRIANZA.escala : 1;
    const w = Math.max(4, Math.round(C.ANCHO * k)), h = Math.max(4, Math.round(C.ALTO * k));
    this.x += (this.w - w) / 2;
    this.y += this.h - h;
    this.w = w;
    this.h = h;
  }

  // Le das de comer (ya se sabe que es su comida). Devuelve qué pasó:
  // 'crece' | 'celo' | 'domesticado' | null (no la quiso: se gasta nada).
  alimentar() {
    const K = SurviConfig.CRIANZA;
    const nuevo = !this.domestico;
    this.domestico = true;
    this.mimoMs = 1200; // corazones un ratito
    if (this.esCria) {
      this.edadMs = Math.max(1, this.edadMs - K.creceMs * K.aceleraCria);
      return 'crece';
    }
    if (this.celoMs <= 0 && this.esperaMs <= 0) {
      this.celoMs = K.celoMs;
      this.huyendoMs = 0;
      return 'celo';
    }
    return nuevo ? 'domesticado' : null;
  }

  // Busca pareja en celo cerca. Si la toca, nace una cría.
  #buscarPareja(juego) {
    const K = SurviConfig.CRIANZA, T = SurviConfig.TILE;
    let pareja = null, dist = K.buscaTiles * T;
    for (const o of juego.animals) {
      if (o === this || o.tipo !== this.tipo || o.celoMs <= 0 || o.esCria) continue;
      const d = Math.hypot(o.x - this.x, o.y - this.y);
      if (d < dist) {
        dist = d;
        pareja = o;
      }
    }
    if (!pareja) return 0;
    if (dist < Math.max(this.w, 10)) {
      this.celoMs = pareja.celoMs = 0;
      this.esperaMs = pareja.esperaMs = K.esperaMs;
      juego.nacerCria(this.tipo, (this.x + pareja.x) / 2, Math.min(this.y, pareja.y));
      return 0;
    }
    return Math.sign(pareja.x - this.x);
  }

  // ¿El jugador tiene en la mano la comida de este animal?
  #tentado(juego) {
    if (juego.espectador || juego.dead) return false;
    const id = juego.hotbarSlots[juego.selectedSlot];
    return !!id && this.comida.includes(id);
  }

  // Timers de crianza (celo, espera, crecer, huevos).
  #actualizarCrianza(dt, juego) {
    this.t += dt;
    if (this.mimoMs > 0) this.mimoMs -= dt;
    if (this.celoMs > 0) this.celoMs -= dt;
    if (this.esperaMs > 0) this.esperaMs -= dt;
    if (this.edadMs > 0) {
      this.edadMs -= dt;
      if (this.edadMs <= 0) {
        this.edadMs = 0;
        this.#ajustarTamanio(); // creció
      }
    }
    // gallina domesticada adulta: pone huevos de vez en cuando
    if (this.tipo === 'gallina' && this.domestico && !this.esCria) {
      this.huevoMs -= dt;
      if (this.huevoMs <= 0) {
        this.huevoMs = Animal.#azarMs(SurviConfig.CRIANZA.huevoMs);
        juego.soltarItem(SurviConfig.FOOD.egg, 1, this.x + this.w / 2, this.y + this.h - 4);
        juego.sonar('gallina', this.x + this.w / 2, this.y);
      }
    }
  }

  serializar() {
    const d = { tipo: this.tipo, x: this.x, y: this.y, hp: this.hp, facing: this.facing };
    if (this.domestico) d.domestico = true;
    if (this.celoMs > 0) d.celoMs = Math.round(this.celoMs);
    if (this.esperaMs > 0) d.esperaMs = Math.round(this.esperaMs);
    if (this.edadMs > 0) d.edadMs = Math.round(this.edadMs);
    if (this.domestico && this.tipo === 'gallina') d.huevoMs = Math.round(this.huevoMs);
    return d;
  }

  // Lista de { id, qty } que suelta al morir. La define cada subclase.
  drops() {
    return [];
  }

  // Sale corriendo lejos de `desdeX` durante `ms`.
  asustar(desdeX, ms = Animal.HUIDA_MS) {
    this.huyeDeX = desdeX;
    this.huyendoMs = Math.max(this.huyendoMs, ms);
  }

  recibirGolpe(dmg, dir) {
    super.recibirGolpe(dmg, dir);
    this.asustar(this.x - dir * 20);
  }

  // Elige qué hacer cuando se termina el estado actual. Si hay otro de su
  // especie lejos (pero no tanto), tiende a caminar hacia él: así andan en
  // manada en vez de desparramarse por todo el mapa.
  #decidir(juego) {
    this.caminando = Math.random() < 0.55;
    if (!this.caminando) {
      this.estadoMs = 1000 + Math.random() * 2000;
      if (Math.random() < 0.4) this.facing = -this.facing; // mira para el otro lado
      return;
    }
    this.estadoMs = 1500 + Math.random() * 2500;
    const T = SurviConfig.TILE;
    let cercano = null, dist = Infinity;
    for (const o of juego.animals) {
      if (o === this || o.tipo !== this.tipo) continue;
      const d = Math.abs(o.x - this.x);
      if (d < dist) { dist = d; cercano = o; }
    }
    if (cercano && dist > 4 * T && dist < Animal.MANADA_TILES * T && Math.random() < 0.7) {
      this.facing = Math.sign(cercano.x - this.x) || this.facing;
    } else {
      this.facing = Math.random() < 0.5 ? -1 : 1;
    }
  }

  actualizar(dt, step, juego) {
    const C = this.constructor;
    const T = SurviConfig.TILE;
    const player = juego.player;
    const lejos = Math.abs(this.x - player.x) > Animal.DISTANCIA_MAX_TILES * T;
    // Domesticado y lejos: queda quieto donde está (no se saca ni se procesa).
    if (lejos && this.domestico) return true;
    if (this.hitMs > 0) this.hitMs -= dt;
    this.sentirFluidos(juego, dt);
    this.#actualizarCrianza(dt, juego);
    const tentado = this.#tentado(juego);

    // Asustadiza: si te acercás corriendo, se va (sin esperar el golpe).
    // Si es tuya o le mostrás su comida, no se asusta.
    if (C.ASUSTADIZA && !this.domestico && !tentado && this.huyendoMs <= 0 && !juego.espectador) {
      const dx = Math.abs(player.x - this.x), dy = Math.abs(player.y - this.y);
      if (dx < 2.5 * T && dy < 2 * T && Math.abs(player.vx) > 1.5) this.asustar(player.x, 1500);
    }

    let dir = 0, velocidad = 0, maxCaida = 1;
    if (this.huyendoMs > 0) {
      this.huyendoMs -= dt;
      dir = Math.sign(this.x - this.huyeDeX) || this.facing;
      velocidad = C.VELOCIDAD * Animal.MULT_HUIDA;
      maxCaida = 4; // huyendo se anima a tirarse para escapar
    } else {
      this.estadoMs -= dt;
      if (this.estadoMs <= 0) this.#decidir(juego);
      if (this.caminando) {
        dir = this.facing;
        velocidad = C.VELOCIDAD;
      }
      const K = SurviConfig.CRIANZA;
      const dxJ = player.x + player.w / 2 - (this.x + this.w / 2);
      if (this.celoMs > 0) {
        // en celo: va hacia la pareja más cercana (si no hay, sigue su vida)
        const hacia = this.#buscarPareja(juego);
        if (hacia) {
          dir = this.facing = hacia;
          velocidad = C.VELOCIDAD;
        }
      } else if (tentado && Math.abs(dxJ) < K.sigueTiles * T && Math.abs(player.y - this.y) < 4 * T) {
        // le mostrás su comida: te sigue (y se queda cerca tuyo)
        this.facing = Math.sign(dxJ) || this.facing;
        if (Math.abs(dxJ) > this.distSigue * T) {
          dir = this.facing;
          velocidad = C.VELOCIDAD * 1.3;
        } else dir = 0;
      }
    }

    const freno = this.moverHacia(dir, velocidad, juego, step, { maxCaida });
    if (dir === 0) this.vx = this.hitMs > 0 ? this.vx : 0;
    if (freno) {
      // Pared o precipicio: se da vuelta. Si estaba huyendo, escapa para el
      // otro lado (mejor que quedarse contra la pared).
      this.facing = -this.facing;
      if (this.huyendoMs > 0) this.huyeDeX = this.x + this.facing * -20;
    }

    if (this.vx !== 0 && this.grounded) this.paso += Math.abs(this.vx) * step;
    else if (this.grounded) this.paso = 0;

    return !lejos || this.domestico;
  }

  // Patas: 0 o 1 según el avance (2 poses, como el personaje).
  get fasePatas() {
    return Math.floor(this.paso / 3) % 2;
  }

  // Dibuja el animal en (sx, sy) de pantalla, espejado según hacia dónde
  // mira. Cada subclase dibuja su cuerpo mirando a la derecha en
  // coordenadas locales (0..w, 0..h) con dibujarCuerpo(ctx, px, fase).
  dibujar(ctx, sx, sy) {
    const blanco = this.hitMs > 0;
    // px(x, y, w, h, color): un rectángulo del dibujo (blanco al recibir un golpe)
    const px = (x, y, w, h, color) => {
      ctx.fillStyle = blanco ? '#ffffff' : color;
      ctx.fillRect(x, y, w, h);
    };
    ctx.save();
    if (this.facing < 0) {
      ctx.translate(Math.round(sx) + this.w, Math.round(sy));
      ctx.scale(-1, 1);
    } else {
      ctx.translate(Math.round(sx), Math.round(sy));
    }
    if (this.esCria) ctx.scale(this.w / this.constructor.ANCHO, this.h / this.constructor.ALTO);
    this.dibujarCuerpo(ctx, px, this.fasePatas);
    ctx.restore();
    if (this.celoMs > 0 || this.mimoMs > 0) Animal.dibujarCorazon(ctx, sx + this.w / 2, sy - 3, this.t);
  }

  // Corazoncito que sube y se desvanece (en celo, o al darle de comer).
  static dibujarCorazon(ctx, cx, y, t) {
    const ciclo = (t % 900) / 900;
    const x = Math.round(cx - 2 + Math.sin(t / 300)), yy = Math.round(y - ciclo * 8);
    ctx.save();
    ctx.globalAlpha = 1 - ciclo * 0.8;
    ctx.fillStyle = '#e8364f';
    ctx.fillRect(x, yy, 2, 1);
    ctx.fillRect(x + 3, yy, 2, 1);
    ctx.fillRect(x - 1, yy + 1, 7, 1);
    ctx.fillRect(x, yy + 2, 5, 1);
    ctx.fillRect(x + 1, yy + 3, 3, 1);
    ctx.fillRect(x + 2, yy + 4, 1, 1);
    ctx.fillStyle = '#ff9aa8';
    ctx.fillRect(x, yy + 1, 1, 1);
    ctx.restore();
  }

  dibujarCuerpo(ctx, px, fase) {}
}

// ─── Vaca: la más grande y lenta; la única que da cuero ───
export class Vaca extends Animal {
  static TIPO = 'vaca';
  static ANCHO = 20;
  static ALTO = 14;
  static VIDA = 10;
  static VELOCIDAD = 0.4;

  drops() {
    return [
      { id: SurviConfig.MAT.leather, qty: Animal.azar(1, 2) },
      { id: SurviConfig.FOOD.meatRaw, qty: Animal.azar(1, 3) },
    ];
  }

  dibujarCuerpo(ctx, px, fase) {
    const piel = '#f1ede4', mancha = '#2e2a28', pata = '#3a3431', hocico = '#e6a59c';
    // patas (se alternan al caminar)
    const a = fase ? 1 : 0, b = fase ? 0 : 1;
    px(3, 10 + a, 2, 4 - a, pata);
    px(6, 10 + b, 2, 4 - b, pata);
    px(11, 10 + a, 2, 4 - a, pata);
    px(14, 10 + b, 2, 4 - b, pata);
    // cola
    px(0, 4, 1, 5, mancha);
    // cuerpo con manchas
    px(1, 3, 16, 8, piel);
    px(3, 4, 4, 3, mancha);
    px(10, 6, 3, 3, mancha);
    px(7, 8, 2, 2, mancha);
    // ubre
    px(8, 11, 3, 1, hocico);
    // cabeza
    px(15, 1, 5, 7, piel);
    px(15, 0, 1, 1, '#d8c9a4'); // cuerno
    px(19, 0, 1, 1, '#d8c9a4');
    px(14, 2, 1, 2, mancha); // oreja
    px(17, 3, 1, 1, '#111111'); // ojo
    px(16, 6, 4, 2, hocico);
    px(18, 6, 1, 1, '#9b5c57');
  }
}

// ─── Cerdo ───
export class Cerdo extends Animal {
  static TIPO = 'cerdo';
  static ANCHO = 16;
  static ALTO = 11;
  static VIDA = 8;
  static VELOCIDAD = 0.45;

  drops() {
    return [{ id: SurviConfig.FOOD.meatRaw, qty: Animal.azar(2, 3) }];
  }

  dibujarCuerpo(ctx, px, fase) {
    const piel = '#f2a7b5', sombra = '#d9879a', hocico = '#e98ea2';
    const a = fase ? 1 : 0, b = fase ? 0 : 1;
    px(2, 8 + a, 2, 3 - a, sombra);
    px(5, 8 + b, 2, 3 - b, sombra);
    px(9, 8 + a, 2, 3 - a, sombra);
    px(11, 8 + b, 2, 3 - b, sombra);
    // colita enrulada
    px(0, 3, 1, 1, sombra);
    px(0, 2, 1, 1, sombra);
    // cuerpo
    px(1, 2, 12, 7, piel);
    px(1, 7, 12, 1, sombra);
    // cabeza
    px(11, 1, 5, 6, piel);
    px(12, 0, 2, 2, sombra); // oreja
    px(13, 2, 1, 1, '#111111'); // ojo
    px(14, 4, 2, 2, hocico);
    px(15, 4, 1, 1, '#a8566a');
    px(15, 5, 1, 1, '#a8566a');
  }
}

// ─── Gallina: chiquita y rápida; da huevos ───
export class Gallina extends Animal {
  static TIPO = 'gallina';
  static ANCHO = 9;
  static ALTO = 10;
  static VIDA = 4;
  static VELOCIDAD = 0.55;
  static ASUSTADIZA = true;

  drops() {
    const lista = [{ id: SurviConfig.FOOD.egg, qty: Animal.azar(1, 2) }];
    if (Math.random() < 0.5) lista.push({ id: SurviConfig.FOOD.meatRaw, qty: 1 });
    return lista;
  }

  dibujarCuerpo(ctx, px, fase) {
    const pluma = '#f7f5ef', ala = '#d9d4c7', pico = '#e9a23b', cresta = '#d63a3a';
    // patas
    px(3 + fase, 8, 1, 2, pico);
    px(5 - fase, 8, 1, 2, pico);
    // cola
    px(0, 2, 2, 3, ala);
    // cuerpo
    px(1, 4, 6, 4, pluma);
    px(2, 5, 3, 2, ala); // ala
    // cabeza
    px(5, 1, 3, 4, pluma);
    px(6, 0, 2, 1, cresta);
    px(7, 2, 1, 1, '#111111'); // ojo
    px(8, 2, 1, 2, pico);
    px(7, 4, 1, 1, cresta); // barbilla
  }
}

// ─── Aves (gorrión y cardenal) ───
// No usan la física de los animales de suelo: se POSAN arriba de cualquier
// bloque (una copa de árbol, una rama o el suelo) y VUELAN de un lugar a
// otro. Las hojas no son sólidas, así que posadas no caen por gravedad:
// se quedan quietas mientras el bloque de abajo exista.
//   'posada' → a ratos picotea, da saltitos por la rama o se va volando a
//              otro lugar cerca.
//   'vuela'  → va hacia un lugar para posarse (aleteando). Si te acercás o
//              le pegás, sale volando lejos tuyo; si no encuentra dónde
//              posarse, se va para arriba y desaparece.
export class Ave extends Animal {
  static ANCHO = 7;
  static ALTO = 6;
  static VIDA = 2;
  static VELOCIDAD_VUELO = 1.7;
  static MIEDO_TILES = 3.5; // a esta distancia se asusta
  static COLORES = null; // { cuerpo, ala, panza, pico, cresta? }

  constructor(d) {
    super(d);
    this.volando = false;
    this.destino = null; // { x, y } donde se va a posar (px de mundo)
    this.escapaMs = 0; // volando sin destino, hacia arriba
    this.picoteoMs = 0;
    this.aleteo = 0;
    this.pensarMs = 1500 + Math.random() * 3000;
  }

  drops() {
    return [{ id: SurviConfig.FOOD.meatRaw, qty: Animal.azar(0, 1) }].filter((d) => d.qty > 0);
  }

  // ¿Hay algo abajo de las patas para estar posada? (cualquier bloque que no
  // sea aire, pasto o antorcha)
  static #apoyo(juego, col, row) {
    const id = juego.tilemap.get(col, row);
    return id !== 0 && !SurviConfig.DECO_IDS.has(id) && !SurviConfig.TORCH_IDS.has(id);
  }

  // Lugar para posarse en la columna `col`: el aire justo arriba del primer
  // bloque de la columna (la copa del árbol, o el suelo si no hay árbol).
  static lugarEnColumna(juego, col) {
    if (col < 1 || col >= SurviConfig.COLS - 1) return null;
    for (let r = 1; r < SurviConfig.ROWS - 1; r++) {
      if (!Ave.#apoyo(juego, col, r)) continue;
      if (!SurviConfig.esAire(juego.tilemap.get(col, r - 1))) return null;
      if (juego.fluidos && (juego.fluidos.tipo(col, r - 1) || juego.fluidos.tipo(col, r))) return null; // lago
      return { col, row: r - 1 };
    }
    return null;
  }

  // Busca dónde posarse entre `min` y `max` bloques hacia `dir` (0 = cualquiera).
  #buscarLugar(juego, dir, min, max) {
    const T = SurviConfig.TILE;
    const c0 = Math.floor((this.x + this.w / 2) / T);
    for (let i = 0; i < 10; i++) {
      const d = dir || (Math.random() < 0.5 ? -1 : 1);
      const col = c0 + d * (min + Math.floor(Math.random() * (max - min + 1)));
      const l = Ave.lugarEnColumna(juego, col);
      if (l) return { x: l.col * T + (T - this.w) / 2, y: (l.row + 1) * T - this.h };
    }
    return null;
  }

  #volarA(destino) {
    this.volando = true;
    this.destino = destino;
    this.escapaMs = destino ? 0 : 6000;
  }

  // Se asusta: vuela lejos del punto `desdeX`.
  asustar(desdeX) {
    const dir = Math.sign(this.x - desdeX) || 1;
    // (juego se guarda en actualizar para poder buscar lugar desde acá)
    const destino = this._juego ? this.#buscarLugar(this._juego, dir, 10, 22) : null;
    if (!this.volando && this._juego) this._juego.sonar('ave', this.x + this.w / 2, this.y);
    this.#volarA(destino);
  }

  recibirGolpe(dmg, dir) {
    this.hp -= dmg;
    this.hitMs = Criatura.PARPADEO_MS;
    this.asustar(this.x - dir * 20);
  }

  actualizar(dt, step, juego) {
    this._juego = juego;
    const T = SurviConfig.TILE;
    const C = this.constructor;
    const p = juego.player;
    if (this.hitMs > 0) this.hitMs -= dt;
    this.aleteo += dt;
    // te acercaste: sale volando
    const dx = p.x + p.w / 2 - (this.x + this.w / 2), dy = p.y + p.h / 2 - (this.y + this.h / 2);
    if (!this.volando && !juego.espectador && Math.abs(dx) < C.MIEDO_TILES * T && Math.abs(dy) < 3 * T && !juego.dead) this.asustar(p.x);

    if (this.volando) {
      if (this.destino) {
        const ex = this.destino.x - this.x, ey = this.destino.y - this.y;
        const d = Math.hypot(ex, ey);
        if (d < 2) {
          this.x = this.destino.x;
          this.y = this.destino.y;
          this.volando = false;
          this.destino = null;
          this.pensarMs = 2000 + Math.random() * 4000;
        } else {
          // en arco: primero sube y después baja al destino
          const v = Math.min(C.VELOCIDAD_VUELO * step, d);
          const subir = d > 3 * T ? -0.6 : 0;
          this.vx = (ex / d) * v;
          this.vy = (ey / d) * v + subir * step;
          this.facing = Math.sign(ex) || this.facing;
        }
      } else {
        // escapando sin destino: hacia arriba y afuera
        this.escapaMs -= dt;
        this.vx = this.facing * C.VELOCIDAD_VUELO * step;
        this.vy = -1 * step;
        if (this.escapaMs <= 0) return false; // se fue
      }
      if (this.volando) {
        // no atraviesa el suelo: si choca con algo sólido, sube
        const nx = this.x + this.vx, ny = this.y + this.vy;
        const choca = juego.tilemap.isSolidAt(Math.floor((nx + this.w / 2) / T), Math.floor((ny + this.h) / T));
        if (choca) this.y -= 1.2 * step;
        else {
          this.x = nx;
          this.y = ny;
        }
        this.x = Math.max(0, Math.min(SurviConfig.WORLD_W - this.w, this.x));
        this.y = Math.max(0, this.y);
      }
    } else {
      this.vx = 0;
      this.vy = 0;
      const col = Math.floor((this.x + this.w / 2) / T), fila = Math.floor((this.y + this.h) / T);
      // se quedó sin apoyo (rompiste la rama): vuela
      if (!Ave.#apoyo(juego, col, fila)) this.#volarA(this.#buscarLugar(juego, 0, 2, 12));
      else {
        if (this.picoteoMs > 0) this.picoteoMs -= dt;
        this.pensarMs -= dt;
        if (this.pensarMs <= 0) {
          this.pensarMs = 1500 + Math.random() * 3000;
          const r = Math.random();
          if (r < 0.35) this.picoteoMs = 500;
          else if (r < 0.7) {
            // saltito al bloque de al lado si también se puede estar ahí
            const dir = Math.random() < 0.5 ? -1 : 1;
            this.facing = dir;
            const c2 = col + dir, f = fila - 1;
            if (SurviConfig.esAire(juego.tilemap.get(c2, f)) && Ave.#apoyo(juego, c2, fila)) this.x += dir * T;
          } else if (r < 0.85) this.#volarA(this.#buscarLugar(juego, 0, 3, 12));
          else this.facing = -this.facing;
        }
      }
    }
    return Math.abs(this.x - p.x) <= Animal.DISTANCIA_MAX_TILES * T;
  }

  serializar() {
    return { tipo: this.tipo, x: this.x, y: this.y, hp: this.hp, facing: this.facing };
  }

  dibujarCuerpo(ctx, px) {
    const k = this.constructor.COLORES;
    const pico = this.picoteoMs > 0 && Math.floor(this.picoteoMs / 120) % 2 ? 1 : 0; // cabeza abajo
    // patas (posada)
    if (!this.volando) {
      px(2, 5, 1, 1, '#6b4a2a');
      px(4, 5, 1, 1, '#6b4a2a');
    }
    // cuerpo y cola
    px(1, 2, 5, 3, k.cuerpo);
    px(2, 4, 3, 1, k.panza);
    px(0, 2, 1, 2, k.ala);
    // cabeza
    px(4, 0 + pico, 3, 3, k.cuerpo);
    if (k.cresta) px(4, -1 + pico, 1, 1, k.cresta);
    if (k.mascara) px(5, 1 + pico, 2, 1, k.mascara);
    px(5, 1 + pico, 1, 1, '#111111'); // ojo
    px(7, 1 + pico, 1, 1, k.pico);
    // ala: plegada, o arriba/abajo al volar
    if (this.volando) {
      const arriba = Math.floor(this.aleteo / 90) % 2;
      if (arriba) px(2, -1, 3, 3, k.ala);
      else px(2, 4, 3, 2, k.ala);
    } else px(2, 2, 3, 2, k.ala);
  }
}

export class Gorrion extends Ave {
  static TIPO = 'gorrion';
  static COLORES = { cuerpo: '#8a6440', ala: '#5e4128', panza: '#d9c7a4', pico: '#3a2a1c' };
}

export class Cardenal extends Ave {
  static TIPO = 'cardenal';
  static COLORES = { cuerpo: '#d63a3a', ala: '#9e2626', panza: '#e46a5a', pico: '#f0a83a', cresta: '#d63a3a', mascara: '#2a1a1a' };
}

Animal.registrar(Vaca);
Animal.registrar(Cerdo);
Animal.registrar(Gallina);
Animal.registrar(Gorrion);
Animal.registrar(Cardenal);

// ─────────────────────────────────────
//   Flecha (proyectil del arco)
// ─────────────────────────────────────
// Vuela recta un tramo corto y después cae en arco (gravedad), se frena en
// el agua y se quema en la lava. Si
// pega en una criatura le hace daño y desaparece; si pega en un bloque se
// queda clavada un rato y se puede volver a juntar pasando por encima.
export class Flecha extends Engine2D.Entity {
  static LARGO = 10;

  // enemiga: la tiró un esqueleto → te lastima a vos, no a los mobs, y no se junta.
  static CLAVADA_ENEMIGA_MS = 3000;

  constructor(x, y, vx, vy, danio, { enemiga = false, enLlamas = false } = {}) {
    super({ x: x - 2, y: y - 2, w: 4, h: 4, vx, vy });
    this.danio = danio;
    this.enemiga = enemiga;
    this.enLlamas = enLlamas;
    this.clavada = false;
    this.angulo = Math.atan2(vy, vx);
    this.tiempoMs = 0;
  }

  // Devuelve false cuando hay que sacarla del mapa.
  actualizar(dt, step, juego) {
    const F = SurviConfig.FLECHA, T = SurviConfig.TILE;
    this.tiempoMs += dt;
    if (this.clavada) {
      if (this.enemiga) return this.tiempoMs < Flecha.CLAVADA_ENEMIGA_MS;
      // se junta pasando por encima (si entra en el inventario)
      if (Engine2D.Collisions.rectOverlap(this, juego.player) && juego._recogerFlecha()) return false;
      return this.tiempoMs < F.clavadaMs;
    }
    if (this.tiempoMs > F.vueloMaxMs) return false;
    const fluido = juego.fluidos ? juego.fluidos.tipo(Math.floor(this.x / T), Math.floor(this.y / T)) : 0;
    if (fluido === 2) return false; // en la lava se quema
    if (fluido === 1) {
      this.enLlamas = false; // el agua la apaga
      // en el agua se frena mucho
      this.vx *= Math.pow(0.9, step);
      this.vy = Math.min(this.vy * Math.pow(0.9, step), 0.8);
    }
    if (this.tiempoMs > F.rectaMs) this.vy += F.gravedad * step;
    // en pasos chicos, para que una flecha rápida no atraviese un bloque o un mob
    const pasos = Math.max(1, Math.ceil((Math.max(Math.abs(this.vx), Math.abs(this.vy)) * step) / 4));
    for (let i = 0; i < pasos; i++) {
      this.x += (this.vx * step) / pasos;
      this.y += (this.vy * step) / pasos;
      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      if (cx < 0 || cy < 0 || cx >= SurviConfig.WORLD_W || cy >= SurviConfig.WORLD_H) return false;
      // una flecha tuya que pasa por un nido lo tira abajo (suelta los huevos)
      if (!this.enemiga && SurviConfig.NEST_IDS.has(juego.tilemap.get(Math.floor(cx / T), Math.floor(cy / T)))) {
        juego.romperNido(Math.floor(cx / T), Math.floor(cy / T));
        return false;
      }
      if (juego.tilemap.isSolidAt(Math.floor(cx / T), Math.floor(cy / T))) {
        this.clavada = true;
        this.angulo = Math.atan2(this.vy, this.vx);
        this.tiempoMs = 0;
        juego.sonar('flecha', cx, cy);
        return true;
      }
      if (this.enemiga) {
        if (!juego.dead && !juego.espectador && Engine2D.Collisions.rectOverlap(this, juego.player)) {
          juego._damage(this.danio);
          if (this.enLlamas) juego.prenderFuego();
          juego.player.empujar(this.x - Math.sign(this.vx) * 10);
          return false;
        }
        continue;
      }
      for (const lista of [juego.enemies, juego.animals]) {
        for (const c of lista) {
          if (c.estaMuerto() || !Engine2D.Collisions.rectOverlap(this, c)) continue;
          juego._golpearCriatura(c, this.danio, Math.sign(this.vx) || 1);
          return false;
        }
      }
    }
    this.angulo = Math.atan2(this.vy, this.vx);
    return true;
  }

  // Palito con punta y plumas, girado según hacia dónde vuela.
  dibujar(ctx, sx, sy) {
    const L = Flecha.LARGO;
    ctx.save();
    ctx.translate(sx + this.w / 2, sy + this.h / 2);
    ctx.rotate(this.angulo);
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(-L + 2, -0.5, L - 2, 1); // palo
    ctx.fillStyle = '#c9ccd2';
    ctx.fillRect(0, -1, 2, 2); // punta
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-L + 1, -1.5, 2, 1); // plumas
    ctx.fillRect(-L + 1, 0.5, 2, 1);
    if (this.enLlamas && !this.clavada) {
      ctx.fillStyle = Math.floor(this.tiempoMs / 80) % 2 ? '#ffb640' : '#ff6a00';
      ctx.fillRect(-2, -1.5, 3, 3); // fuego en la punta
    }
    ctx.restore();
  }
}

// ─────────────────────────────────────
//   ItemSuelto (ítem tirado en el mundo)
// ─────────────────────────────────────
// Al romper un bloque, matar un mob o morir, las cosas no van directo al
// inventario: caen al suelo (saltan un poquito), con gravedad y chocando con
// los bloques. En el agua bajan despacio y en la lava se queman.
// Pasando cerca, vuelan hacia vos y se juntan (si hay lugar en el
// inventario). Después de SUELTO_VIDA_MS (10 min) desaparecen.
// `gastado`: desgaste de la herramienta/armadura (al morir se conserva).
export class ItemSuelto extends Engine2D.Entity {
  static TAM = 8;

  constructor(d) {
    const T = ItemSuelto.TAM;
    super({
      x: d.x - T / 2,
      y: d.y - T / 2,
      w: T,
      h: T,
      vx: Number.isFinite(d.vx) ? d.vx : (Math.random() - 0.5) * 2,
      vy: Number.isFinite(d.vy) ? d.vy : -1.8 - Math.random(),
      grounded: false,
    });
    this.id = d.id;
    this.qty = d.qty || 1;
    this.gastado = d.gastado || 0;
    this.vidaMs = Number.isFinite(d.vidaMs) ? d.vidaMs : SurviConfig.SUELTO_VIDA_MS;
    this.esperaMs = Number.isFinite(d.esperaMs) ? d.esperaMs : SurviConfig.SUELTO_ESPERA_MS;
    this.t = Math.random() * 2000; // fase del flotar
    this.quieto = false;
    this.atraido = !!d.atraido; // viene hacia vos desde cualquier distancia (lo que pescás)
  }

  serializar() {
    return { id: this.id, qty: this.qty, x: this.x + this.w / 2, y: this.y + this.h / 2, vidaMs: Math.round(this.vidaMs), gastado: this.gastado, vx: 0, vy: 0 };
  }

  // Devuelve false cuando hay que sacarlo (se juntó, se quemó o se venció).
  actualizar(dt, step, juego) {
    const T = SurviConfig.TILE;
    this.vidaMs -= dt;
    if (this.vidaMs <= 0) return false;
    if (this.esperaMs > 0) this.esperaMs -= dt;
    this.t += dt;
    const p = juego.player;
    const dx = p.x + p.w / 2 - (this.x + this.w / 2), dy = p.y + p.h / 2 - (this.y + this.h / 2);
    const d = Math.hypot(dx, dy);
    // imán: cerca tuyo vuela hacia vos
    const cerca = d < SurviConfig.SUELTO_IMAN_TILES * T || (this.atraido && d < 40 * T);
    if (!juego.dead && this.esperaMs <= 0 && cerca && juego.hayLugarPara(this.id)) {
      if (d < 9) return !juego.recogerSuelto(this);
      // más rápido cuanto más cerca (sin bajar de 2.5 px por paso cuando viene de lejos)
      const v = Math.min(d, 2.5 + Math.max(0, 1 - d / (SurviConfig.SUELTO_IMAN_TILES * T)) * 3) * step;
      this.x += (dx / d) * v;
      this.y += (dy / d) * v;
      this.quieto = false;
      return true;
    }
    if (this.quieto) {
      // quieto en el piso: solo se revisa que el piso siga ahí
      const c = Math.floor((this.x + this.w / 2) / T), f = Math.floor((this.y + this.h + 1) / T);
      if (juego.tilemap.isSolidAt(c, f)) return true;
      this.quieto = false;
    }
    const fl = juego.fluidos ? juego.fluidos.tipo(Math.floor((this.x + this.w / 2) / T), Math.floor((this.y + this.h / 2) / T)) : 0;
    if (fl === 2) return false; // la lava lo quema
    if (fl === 1) {
      this.vx *= Math.pow(0.9, step);
      this.vy = Math.min(this.vy + 0.04 * step, 0.5); // baja despacio
    } else Engine2D.Physics.applyGravity(this, step);
    Engine2D.Physics.resolveTileCollisions(this, juego.tilemap, step);
    if (this.grounded) {
      this.vx *= Math.pow(0.75, step);
      if (Math.abs(this.vx) < 0.05) {
        this.vx = 0;
        this.quieto = true;
      }
    }
    return this.y < SurviConfig.WORLD_H;
  }

  // Ícono del ítem flotando (lo dibuja el juego: ver SurviGame.dibujarIcono).
  dibujar(ctx, sx, sy, juego) {
    const flota = Math.round(Math.sin(this.t / 300) * 1.5) - 1;
    // últimos 30 s: titila avisando que se va
    if (this.vidaMs < 30000 && Math.floor(this.t / 150) % 2) return;
    juego.dibujarIcono(ctx, this.id, Math.round(sx), Math.round(sy) + flota, this.w);
    if (this.qty > 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(Math.round(sx) + 4, Math.round(sy) + flota + 5, 5, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(sx) + 5, Math.round(sy) + flota + 6, 3, 2); // marquita "hay varios"
    }
  }
}

// ─────────────────────────────────────
//   Boya (pesca)
// ─────────────────────────────────────
// La tira la caña: vuela en arco. Si cae al agua flota en la superficie y,
// después de un rato al azar (SurviGame.tiempoPique), PICA: se hunde un poco
// con un "!" durante PESCA.ventanaMs. Si la recogés en ese momento, sacás
// algo. Si cae en el piso se queda ahí (recogerla no da nada); en la lava se
// quema; si te alejás mucho, se corta la línea.
export class Boya extends Engine2D.Entity {
  constructor(x, y, vx, vy) {
    super({ x: x - 2, y: y - 2, w: 4, h: 4, vx, vy });
    this.estado = 'vuela'; // 'vuela' | 'agua' | 'suelo'
    this.esperaMs = 0;
    this.picaMs = 0;
    this.t = 0;
  }

  get picando() {
    return this.picaMs > 0;
  }

  get centro() {
    return { x: this.x + 2, y: this.y + 2 };
  }

  actualizar(dt, step, juego) {
    const T = SurviConfig.TILE, P = SurviConfig.PESCA;
    this.t += dt;
    const { x: cx, y: cy } = this.centro;
    const c = Math.floor(cx / T), r = Math.floor(cy / T);
    const fl = juego.fluidos.tipo(c, r);
    if (fl === 2) return false; // lava: se quema
    if (this.estado === 'vuela') {
      if (fl === 1) {
        this.estado = 'agua';
        this.vx *= 0.3;
        this.vy = 0;
        this.esperaMs = juego.tiempoPique(c, r);
        juego.salpicar(cx, cy);
        juego.sonar('chapuzon', cx, cy);
      } else {
        this.vy += 0.16 * step;
        const nx = this.x + this.vx * step, ny = this.y + this.vy * step;
        if (juego.tilemap.isSolidAt(Math.floor((nx + 2) / T), Math.floor((ny + 2) / T))) {
          this.estado = 'suelo'; // pegó en un bloque
          this.vx = this.vy = 0;
        } else {
          this.x = nx;
          this.y = ny;
        }
      }
    } else if (this.estado === 'agua') {
      if (fl !== 1 && juego.fluidos.tipo(c, r + 1) !== 1) this.estado = 'vuela'; // se secó el agua
      else if (juego.fluidos.tipo(c, r - 1) === 1) this.y -= 0.8 * step; // sube a la superficie
      else {
        // flota en la superficie (con el nivel del agua de esa celda)
        const sup = (r + 1) * T - (juego.fluidos.nivel(c, r) / 8) * T;
        const meta = sup - 3 + (this.picando ? 3 : 0); // picando se hunde
        this.y += (meta - this.y) * Math.min(1, 0.25 * step);
      }
      this.vx *= Math.pow(0.9, step);
      this.x += this.vx * step;
      if (this.picaMs > 0) {
        this.picaMs -= dt;
        if (this.picaMs <= 0) this.esperaMs = juego.tiempoPique(c, r); // se escapó: a esperar otra vez
      } else {
        this.esperaMs -= dt;
        if (this.esperaMs <= 0) {
          this.picaMs = P.ventanaMs;
          juego.salpicar(cx, cy);
          juego.sonar('pica', cx, cy);
        }
      }
    }
    const p = juego.player;
    if (Math.hypot(p.x + p.w / 2 - cx, p.y + p.h / 2 - cy) > P.distanciaMax * T) return false; // se cortó
    return true;
  }

  dibujar(ctx, sx, sy) {
    const flota = this.estado === 'agua' && !this.picando ? Math.round(Math.sin(this.t / 350)) : 0;
    const x = Math.round(sx), y = Math.round(sy) + flota;
    ctx.fillStyle = '#e5483b';
    ctx.fillRect(x, y, 4, 2); // mitad roja arriba
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(x, y + 2, 4, 2); // blanca abajo
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 1, y - 1, 2, 1); // palito
    if (this.picando) {
      // "!" arriba para avisar que picó
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x + 1, y - 10, 2, 5);
      ctx.fillRect(x + 1, y - 4, 2, 2);
    }
  }
}
