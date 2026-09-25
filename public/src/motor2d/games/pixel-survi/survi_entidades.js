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
//           ├── Enemigo     (patrulla; si te ve te persigue; retrocede al golpearte)
//           └── Animal      (abstracta: pasivo, anda en manada y huye si lo golpeás)
//                ├── Vaca     → cuero y carne
//                ├── Cerdo    → carne
//                └── Gallina  → huevos (y a veces carne)
//
//   Flecha (proyectil del arco: vuela en arco, se clava, se junta)
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
    this.fluido = juego.fluidos ? juego.fluidos.enCaja(this) : null;
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
//   Enemigo
// ─────────────────────────────────────
// Estados: 'patrulla' → camina solo y se da vuelta en paredes/precipicios.
//          'alerta'   → te vio: se frena un instante y da un saltito ("!").
//          'persigue' → va hacia vos más rápido, sube escalones y se anima a
//                        bajar hasta 4 bloques. Si te pierde de vista un rato,
//                        te alejás mucho o queda trabado, vuelve a patrullar.
// Al golpearte retrocede un momento en vez de quedarse pegado.
export class Enemigo extends Criatura {
  static VELOCIDAD = 0.7;
  static VELOCIDAD_PERSECUCION = 1.05;
  static DANIO = 2;
  static VIDA = 6;
  static DISTANCIA_MAX_TILES = 45; // más lejos que esto del jugador, desaparece
  static VISTA_TILES = 10; // a esta distancia te detecta (si te ve)
  static OLVIDO_TILES = 16; // más lejos que esto, deja de perseguirte
  static OLVIDO_MS = 2500; // tanto tiempo sin verte y se rinde
  static ALERTA_MS = 450;
  static RETROCESO_MS = 700; // después de golpearte

  // d: { x, y, vx?, vy?, hp? } — un enemigo nuevo o uno guardado en la
  // partida (ver serializar()).
  constructor(d) {
    super({
      x: d.x,
      y: d.y,
      w: 12,
      h: 12,
      vx: Number.isFinite(d.vx) && d.vx !== 0 ? d.vx : Enemigo.VELOCIDAD,
      vy: Number.isFinite(d.vy) ? d.vy : 0,
      hp: Number.isFinite(d.hp) ? d.hp : Enemigo.VIDA,
    });
    this.facing = Math.sign(this.vx) || 1;
    this.estado = 'patrulla';
    this.estadoMs = 0; // tiempo en el estado actual
    this.sinVerMs = 0; // tiempo que lleva sin verte (persiguiendo)
    this.trabadoMs = 0; // tiempo empujando contra una pared (persiguiendo)
    this.retrocesoMs = 0;
  }

  // Lo mínimo para volver a crearlo igual al cargar la partida.
  serializar() {
    return { x: this.x, y: this.y, vx: this.vx, vy: this.vy, hp: this.hp };
  }

  #cambiarEstado(estado) {
    this.estado = estado;
    this.estadoMs = 0;
    this.sinVerMs = 0;
    this.trabadoMs = 0;
  }

  // Te vio: además de perseguirte, cualquier golpe también lo pone en alerta.
  recibirGolpe(dmg, dir) {
    super.recibirGolpe(dmg, dir);
    if (this.estado === 'patrulla') this.#cambiarEstado('persigue');
  }

  actualizar(dt, step, juego) {
    const T = SurviConfig.TILE;
    const map = juego.tilemap;
    const player = juego.player;
    if (this.hitMs > 0) this.hitMs -= dt;
    this.sentirFluidos(juego, dt);
    this.estadoMs += dt;

    const dx = player.x + player.w / 2 - (this.x + this.w / 2);
    const dy = player.y + player.h / 2 - (this.y + this.h / 2);
    const cerca = Math.abs(dx) < Enemigo.VISTA_TILES * T && Math.abs(dy) < 6 * T;
    const teVe = cerca && !juego.dead && this.ve(map, player.x + player.w / 2, player.y + player.h / 3);

    // ── decidir ──
    if (this.estado === 'patrulla' && teVe) {
      this.#cambiarEstado('alerta');
      this.facing = Math.sign(dx) || this.facing;
      if (this.grounded) this.vy = -3; // saltito de sorpresa
    } else if (this.estado === 'alerta' && this.estadoMs >= Enemigo.ALERTA_MS) {
      this.#cambiarEstado('persigue');
    } else if (this.estado === 'persigue') {
      this.sinVerMs = teVe ? 0 : this.sinVerMs + dt;
      const lejos = Math.abs(dx) > Enemigo.OLVIDO_TILES * T;
      if (lejos || this.sinVerMs > Enemigo.OLVIDO_MS || this.trabadoMs > 1200 || juego.dead) {
        this.#cambiarEstado('patrulla');
        if (this.trabadoMs > 1200) this.facing = -this.facing;
      }
    }

    // ── moverse ──
    let dir = this.facing, velocidad = Enemigo.VELOCIDAD, maxCaida = 1;
    if (this.retrocesoMs > 0) {
      this.retrocesoMs -= dt;
      dir = -Math.sign(dx) || -this.facing;
      velocidad = Enemigo.VELOCIDAD;
    } else if (this.estado === 'alerta') {
      velocidad = 0;
    } else if (this.estado === 'persigue') {
      // Justo arriba o abajo tuyo: no tiembla de un lado al otro.
      dir = Math.abs(dx) < 4 ? 0 : Math.sign(dx);
      velocidad = Enemigo.VELOCIDAD_PERSECUCION;
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

    // ── atacar ──
    if (Engine2D.Collisions.rectOverlap(this, player)) {
      juego._damage(Enemigo.DANIO);
      player.empujar(this.x);
      this.retrocesoMs = Enemigo.RETROCESO_MS;
      this.vx = -Math.sign(dx || 1) * 2;
      this.vy = -2;
    }
    return Math.abs(this.x - player.x) <= Enemigo.DISTANCIA_MAX_TILES * T;
  }

  dibujar(ctx, sx, sy) {
    const x = Math.round(sx), y = Math.round(sy);
    ctx.fillStyle = this.hitMs > 0 ? '#ffffff' : this.estado === 'patrulla' ? '#5aa469' : '#6fbf5c';
    ctx.fillRect(x, y, this.w, this.h);
    ctx.fillStyle = this.estado === 'patrulla' ? '#12301b' : '#7a1010'; // ojos rojos cuando te persigue
    const ojo = this.facing > 0 ? 1 : -1;
    ctx.fillRect(x + 2 + ojo, y + 4, 2, 2);
    ctx.fillRect(x + this.w - 4 + ojo, y + 4, 2, 2);
    // "!" arriba de la cabeza mientras está en alerta
    if (this.estado === 'alerta') {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x + this.w / 2 - 1, y - 9, 2, 5);
      ctx.fillRect(x + this.w / 2 - 1, y - 3, 2, 2);
    }
  }
}

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
  }

  serializar() {
    return { tipo: this.tipo, x: this.x, y: this.y, hp: this.hp, facing: this.facing };
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
    if (this.hitMs > 0) this.hitMs -= dt;
    this.sentirFluidos(juego, dt);

    // Asustadiza: si te acercás corriendo, se va (sin esperar el golpe).
    if (C.ASUSTADIZA && this.huyendoMs <= 0) {
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

    return Math.abs(this.x - player.x) <= Animal.DISTANCIA_MAX_TILES * T;
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
    this.dibujarCuerpo(ctx, px, this.fasePatas);
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

Animal.registrar(Vaca);
Animal.registrar(Cerdo);
Animal.registrar(Gallina);

// ─────────────────────────────────────
//   Flecha (proyectil del arco)
// ─────────────────────────────────────
// Vuela recta un tramo corto y después cae en arco (gravedad), se frena en
// el agua y se quema en la lava. Si
// pega en una criatura le hace daño y desaparece; si pega en un bloque se
// queda clavada un rato y se puede volver a juntar pasando por encima.
export class Flecha extends Engine2D.Entity {
  static LARGO = 10;

  constructor(x, y, vx, vy, danio) {
    super({ x: x - 2, y: y - 2, w: 4, h: 4, vx, vy });
    this.danio = danio;
    this.clavada = false;
    this.angulo = Math.atan2(vy, vx);
    this.tiempoMs = 0;
  }

  // Devuelve false cuando hay que sacarla del mapa.
  actualizar(dt, step, juego) {
    const F = SurviConfig.FLECHA, T = SurviConfig.TILE;
    this.tiempoMs += dt;
    if (this.clavada) {
      // se junta pasando por encima (si entra en el inventario)
      if (Engine2D.Collisions.rectOverlap(this, juego.player) && juego._recogerFlecha()) return false;
      return this.tiempoMs < F.clavadaMs;
    }
    if (this.tiempoMs > F.vueloMaxMs) return false;
    const fluido = juego.fluidos ? juego.fluidos.tipo(Math.floor(this.x / T), Math.floor(this.y / T)) : 0;
    if (fluido === 2) return false; // en la lava se quema
    if (fluido === 1) {
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
      if (juego.tilemap.isSolidAt(Math.floor(cx / T), Math.floor(cy / T))) {
        this.clavada = true;
        this.angulo = Math.atan2(this.vy, this.vx);
        this.tiempoMs = 0;
        return true;
      }
      for (const c of [...juego.enemies, ...juego.animals]) {
        if (c.estaMuerto() || !Engine2D.Collisions.rectOverlap(this, c)) continue;
        juego._golpearCriatura(c, this.danio, Math.sign(this.vx) || 1);
        return false;
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
    ctx.restore();
  }
}
