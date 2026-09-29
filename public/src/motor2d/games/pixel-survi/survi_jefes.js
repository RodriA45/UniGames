// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_jefes.js
//
//   Clase Jefe (extends Enemigo): lo común a todos los jefes.
//     • Mucha vida y FASES según la vida que le queda (fase 2 debajo de
//       FASE2_VIDA): la subclase cambia su forma de pelear.
//     • No lo empujan los golpes, no cuenta para los topes y NO se guarda
//       con la partida: si guardás / salís en medio de la pelea, se va.
//     • Si te alejás más de HUIR_TILES o morís, se va (SurviGame avisa).
//     • Se invoca usando un ítem (ITEM_INFO[id].invoca) con clic derecho;
//       cada jefe dice en puedeInvocar() dónde y cuándo se puede.
//     • Al morir por tu mano queda anotado en SurviGame.jefesDerrotados.
//
//   Clase ReySlime: el primer minijefe (superficie, de día).
//     • Espera en el piso y salta hacia vos: saltos altos y bajos alternados.
//     • Al caer hace temblar la cámara y lastima si estás cerca en el piso.
//     • Cada vez que pierde un 10% de vida larga slimes chicos (tope 6).
//     • Fase 2 (menos de la mitad): salta más seguido, más lejos y se enoja (rojo).
//     • MEGA SALTO (cada MEGA_CADA saltos): se agacha titilando, salta 5 veces
//       más alto, te sigue desde el aire (se ve su sombra en el piso) y al caer
//       lastima en un área grande y hace temblar todo. Saltando lo esquivás.
//     • Suelta la bola de slime mutante (100%) y bolas de slime.
// ══════════════════════════════════════════════════════════════
import { SurviConfig } from './survi_config.js';
import { Enemigo, Arana, Criatura, ProyectilMob, Yeti } from './survi_entidades.js';

export class Jefe extends Enemigo {
  static NOMBRE = 'Jefe';
  static HUIR_TILES = 48; // más lejos que esto de vos, se va
  static FASE2_VIDA = 0.5; // fracción de vida en la que pasa a la fase 2

  get esJefe() {
    return true;
  }

  get nombre() {
    return this.constructor.NOMBRE;
  }

  get vidaMax() {
    return this.constructor.VIDA;
  }

  // Una vez en la fase 2 se queda ahí, aunque se cure.
  get fase() {
    return this.enFase2 || this.hp <= this.vidaMax * this.constructor.FASE2_VIDA ? 2 : 1;
  }

  // Avisa una sola vez cuando pasa a la fase 2 (lo llama la subclase en actualizar).
  revisarFase(juego) {
    if (this.fase === 2 && !this.enFase2) {
      this.enFase2 = true;
      this.alFase2(juego);
    }
  }

  // Qué hace al entrar en la fase 2 (cada jefe el suyo).
  alFase2(juego) {}

  // Cuando se va de la pelea (muerto o porque te alejaste): deshacer lo suyo.
  alTerminar(juego) {}

  // null = se puede invocar; si no, el texto de por qué no.
  static puedeInvocar(juego) {
    return null;
  }

  // Dónde aparece al invocarlo: al costado tuyo, cayendo del cielo.
  static lugarInvocacion(juego, jefe) {
    const T = SurviConfig.TILE, p = juego.player;
    for (const lado of Math.random() < 0.5 ? [1, -1] : [-1, 1]) {
      for (const dist of [10, 8, 12, 6, 4]) {
        const x = p.x + p.w / 2 + lado * dist * T - jefe.w / 2;
        for (const alto of [10, 7, 4, 2, 0]) {
          const y = p.y + p.h - jefe.h - alto * T;
          if (x < T || x + jefe.w > (SurviConfig.COLS - 1) * T || y < T) continue;
          jefe.x = x;
          jefe.y = y;
          if (juego._cajaLibre(jefe)) return true;
        }
      }
    }
    return false;
  }

  // Los golpes lo lastiman pero no lo empujan.
  recibirGolpe(dmg, dir) {
    this.hp -= dmg;
    this.hitMs = 90;
    if (this.estado === 'patrulla') this.cambiarEstado('persigue');
  }

  // Los jefes no se guardan (ver SurviGame.save).
  serializar() {
    return null;
  }

  sigueCerca(juego) {
    const T = SurviConfig.TILE, p = juego.player, max = this.constructor.HUIR_TILES * T;
    return !juego.dead && Math.abs(this.x - p.x) <= max && Math.abs(this.y - p.y) <= max;
  }

  // La luna de sangre no los cambia (ya están balanceados solos).
  factorVelocidad() {
    return 1;
  }

  factorVista() {
    return 1;
  }
}

export class ReySlime extends Jefe {
  static TIPO = 'rey_slime';
  static NOMBRE = 'Rey Slime';
  static AMA_ACIDO = true; // la lluvia ácida no lo lastima (en Difícil / Hardcore lo cura)
  static LLUVIA_MS = 60000; // Difícil / Hardcore: al llegar a la mitad de la vida llama a la lluvia ácida
  static ESCALA = 3; // dibujo base 16x11 → 48x33 (3 bloques de ancho)
  static ANCHO = 48;
  static ALTO = 33;
  static VIDA = 160;
  static DANIO = 4; // al tocarte
  static ESPERA_MS = [1300, 750]; // en el piso antes de saltar (fase 1 / fase 2)
  static SALTO_ALTO = [6.2, 7];
  static SALTO_BAJO = [3.6, 4.2];
  static VEL_AIRE = [1.7, 2.4]; // px por paso hacia vos, en el aire
  static PISOTON_TILES = 3.5; // al caer: lastima si estás en el piso a esta distancia
  static PISOTON_DANIO = 3;
  static CRIAS_MAX = 6; // slimes chicos vivos a la vez
  static CRIAS_CADA = 0.1; // larga crías cada vez que pierde esta fracción de vida
  // Mega salto
  static MEGA_CADA = [5, 3]; // cada cuántos saltos (fase 1 / fase 2)
  static MEGA_ALTURA = 5; // veces más alto que el salto alto
  static MEGA_CARGA_MS = 750; // se agacha titilando antes (aviso)
  static MEGA_VEL = 3.2; // px por paso máximo siguiéndote en el aire
  static MEGA_RADIO_TILES = 7; // área del golpe al caer
  static MEGA_DANIO = 7;
  static MEGA_TEMBLOR = [10, 700]; // intensidad, ms

  constructor(d) {
    super(d);
    this.esperaMs = 800;
    this.saltos = 0;
    this.enAire = false;
    this.vidaCrias = this.hp; // vida en la que largó las últimas crías
    this.cargaMs = 0; // agachado antes del mega salto
    this.mega = false; // está en el aire en un mega salto
    this.sombraY = null; // piso debajo durante el mega salto (para dibujar la sombra)
  }

  static puedeInvocar(juego) {
    if (juego.esNoche) return 'El Rey Slime solo sale de día';
    if (!juego.alCielo(juego.player)) return 'Tenés que estar en la superficie, a cielo abierto';
    return null;
  }

  drops() {
    const E = SurviConfig.ESPECIAL;
    return [
      { id: E.slimeMutante, qty: 1 },
      { id: E.slimeBall, qty: 8 + Math.floor(Math.random() * 7) },
    ];
  }

  actualizar(dt, step, juego) {
    const C = ReySlime, T = SurviConfig.TILE, p = juego.player, f = this.fase - 1;
    if (this.hitMs > 0) this.hitMs -= dt;
    this.sentirFluidos(juego, dt);
    const dx = p.x + p.w / 2 - (this.x + this.w / 2);
    if (this.estado === 'patrulla') this.cambiarEstado('persigue'); // te busca desde que aparece
    this.revisarFase(juego);
    // ── saltar ──
    if (this.grounded && !this.enAire) {
      this.vx = 0;
      if (this.cargaMs > 0) {
        // agachado: al terminar, MEGA SALTO
        this.cargaMs -= dt;
        if (this.cargaMs <= 0) this.#saltar(juego, dx, true);
      } else {
        this.esperaMs -= dt;
        if (this.esperaMs <= 0 && !juego.ocultoPara(this)) {
          this.saltos++;
          if (this.saltos % C.MEGA_CADA[f] === 0) {
            this.cargaMs = C.MEGA_CARGA_MS;
            juego.sonar('slime', this.x + this.w / 2, this.y);
          } else this.#saltar(juego, dx, false);
        }
      }
    }
    if (this.enAire) {
      // mega salto: te sigue desde el aire para caerte encima
      this.vx = this.mega ? Math.max(-C.MEGA_VEL, Math.min(C.MEGA_VEL, dx * 0.03)) : this.facing * C.VEL_AIRE[f];
      if (this.mega) {
        this.facing = Math.sign(dx) || this.facing;
        this.sombraY = this.#pisoDebajo(juego);
      }
    }
    Engine2D.Physics.applyGravity(this, step);
    Engine2D.Physics.resolveTileCollisions(this, juego.tilemap, step);
    // ── caer ──
    if (this.enAire && this.grounded) {
      this.enAire = false;
      this.esperaMs = C.ESPERA_MS[f];
      this.vx = 0;
      if (this.mega) this.#megaPisoton(juego);
      else this.#pisoton(juego);
      this.mega = false;
      this.sombraY = null;
    }
    this.contarPasos(step);
    // ── crías ──
    if (this.vidaCrias - this.hp >= this.vidaMax * C.CRIAS_CADA) {
      this.vidaCrias = this.hp;
      this.#largarCrias(juego, f ? 2 : 1);
    }
    // ── tocarte ──
    if (!juego.ocultoPara(this) && Engine2D.Collisions.rectOverlap(this, p)) {
      juego._damage(C.DANIO);
      p.empujar(this.x + this.w / 2);
    }
    return this.sigueCerca(juego);
  }

  // Difícil / Hardcore: en la mitad de la vida llama a la lluvia ácida 1 min (que lo cura).
  alFase2(juego) {
    if (!juego.dif.jefesDuros || !juego.clima) return;
    juego.clima.forzar('acida', ReySlime.LLUVIA_MS);
    if (juego.ui.showToast) juego.ui.showToast('¡El Rey Slime llamó a la lluvia ácida!');
    if (juego.camera) juego.camera.shake(5, 500);
  }

  #saltar(juego, dx, mega) {
    const C = ReySlime, f = this.fase - 1;
    const alto = this.saltos % 3 !== 0; // dos altos, uno bajo
    const v = alto ? C.SALTO_ALTO[f] : C.SALTO_BAJO[f];
    this.vy = -(mega ? C.SALTO_ALTO[f] * Math.sqrt(C.MEGA_ALTURA) : v); // altura ∝ v²
    this.mega = mega;
    this.facing = Math.sign(dx) || this.facing;
    this.enAire = true;
    this.grounded = false;
    juego.sonar(mega ? 'explosion' : 'slime', this.x + this.w / 2, this.y);
  }

  // Fila (en px) del primer bloque sólido debajo del centro.
  #pisoDebajo(juego) {
    const T = SurviConfig.TILE, c = Math.floor((this.x + this.w / 2) / T);
    let r = Math.floor((this.y + this.h) / T);
    for (let i = 0; i < 60 && !juego.tilemap.isSolidAt(c, r); i++) r++;
    return r * T;
  }

  // Caída del mega salto: temblor fuerte, mucho polvo y daño en un área grande.
  #megaPisoton(juego) {
    const C = ReySlime, T = SurviConfig.TILE, p = juego.player;
    if (juego.camera) juego.camera.shake(C.MEGA_TEMBLOR[0], C.MEGA_TEMBLOR[1]);
    const row = Math.floor((this.y + this.h + 1) / T), c0 = Math.floor((this.x + this.w / 2) / T);
    for (let c = c0 - C.MEGA_RADIO_TILES; c <= c0 + C.MEGA_RADIO_TILES; c++) juego.particulas.polvo(c, row - 1);
    juego.sonar('explosion', this.x + this.w / 2, this.y + this.h);
    const dx = Math.abs(p.x + p.w / 2 - (this.x + this.w / 2)) - this.w / 2;
    const dy = Math.abs(p.y + p.h - (this.y + this.h));
    if (!juego.ocultoPara(this) && p.grounded && dx < C.MEGA_RADIO_TILES * T && dy < 2 * T) {
      juego._damage(C.MEGA_DANIO);
      p.empujar(this.x + this.w / 2);
      p.vy = Math.min(p.vy, -4); // la onda te levanta
    }
  }

  // Agachado antes del mega salto: titila en blanco (aviso para esquivarlo).
  tinte() {
    return this.cargaMs > 0 && Math.floor(this.cargaMs / 90) % 2 ? '#ffffff' : null;
  }

  // Encima del dibujo normal: la sombra en el piso mientras está en el aire en un mega salto.
  dibujar(ctx, sx, sy) {
    if (this.mega && this.sombraY !== null) {
      const alto = this.sombraY - (this.y + this.h); // cuánto falta para caer
      const k = Math.max(0.35, 1 - alto / 300); // más cerca, más grande y oscura
      const w = Math.round(this.w * k), x = Math.round(sx + (this.w - w) / 2), y = Math.round(sy + (this.sombraY - this.y)) - 3;
      ctx.fillStyle = `rgba(0,0,0,${0.25 + 0.3 * k})`;
      ctx.fillRect(x + 2, y, w - 4, 3);
      ctx.fillRect(x, y + 1, w, 1);
    }
    super.dibujar(ctx, sx, sy);
  }

  // Al caer: temblor, polvo y daño si estás cerca y en el piso.
  #pisoton(juego) {
    const T = SurviConfig.TILE, p = juego.player;
    if (juego.camera) juego.camera.shake(4, 220);
    const col0 = Math.floor(this.x / T), col1 = Math.floor((this.x + this.w) / T), row = Math.floor((this.y + this.h + 1) / T);
    for (let c = col0; c <= col1; c += 2) juego.particulas.polvo(c, row - 1);
    juego.sonar('colocar', this.x + this.w / 2, this.y + this.h, { material: 'tierra' });
    const dx = Math.abs(p.x + p.w / 2 - (this.x + this.w / 2)) - this.w / 2;
    const dy = Math.abs(p.y + p.h - (this.y + this.h));
    if (!juego.ocultoPara(this) && p.grounded && dx < ReySlime.PISOTON_TILES * T && dy < T) {
      juego._damage(ReySlime.PISOTON_DANIO);
      p.empujar(this.x + this.w / 2);
    }
  }

  #largarCrias(juego, n) {
    const vivas = juego.enemies.filter((e) => e.tipo === 'slime' && e.deRey && !e.estaMuerto()).length;
    for (let i = 0; i < n && vivas + i < ReySlime.CRIAS_MAX; i++) {
      const cria = Enemigo.crear({
        tipo: 'slime',
        x: this.x + this.w / 2 - 6,
        y: this.y + 2,
        vx: (Math.random() < 0.5 ? -1 : 1) * 0.6,
        vy: -3.5,
        enojado: true,
      });
      if (!cria) continue;
      cria.deRey = true;
      cria.cambiarEstado('persigue');
      juego.enemies.push(cria);
    }
  }

  // Base 16x11: cuerpo verde (rojo enojado en la fase 2), corona dorada.
  dibujarCuerpo(ctx, px) {
    const f2 = this.fase === 2;
    const cuerpo = f2 ? '#c8503c' : '#5fb35a', claro = f2 ? '#e8826a' : '#8fd77c', osc = f2 ? '#8c2e24' : '#3d7c3d';
    // cuerpo (redondeado arriba)
    px(1, 3, 14, 8, cuerpo);
    px(2, 2, 12, 1, cuerpo);
    px(0, 5, 16, 5, cuerpo);
    px(2, 2, 12, 1, claro);
    px(1, 3, 3, 2, claro); // brillo
    px(0, 10, 16, 1, osc); // base
    // núcleo adentro
    px(10, 6, 3, 2, osc);
    // ojos y boca
    const ojo = f2 ? '#ffe45a' : '#12301b';
    px(4, 5, 2, 2, ojo);
    px(10, 5, 2, 2, ojo);
    px(6, 8, 4, 1, osc);
    // corona
    px(4, 0, 8, 2, '#f5c518');
    px(4, -1, 1, 1, '#f5c518');
    px(7, -2, 2, 2, '#f5c518');
    px(11, -1, 1, 1, '#f5c518');
    px(7, 0, 2, 1, '#e0343c'); // joya
  }
}

Enemigo.registrar(ReySlime);

// ══════════════════════════════════════════════════════════════
//   Araña Reina (cuevas de musgo)
//     • Rápida: te corre y trepa las paredes (no se queda trabada).
//     • A distancia te tira telaraña (te enreda: lento y casi sin salto).
//     • Cuerpo a cuerpo muerde y te ENVENENA.
//     • Especial: tira HUEVOS que caen cerca tuyo; si no los rompés en 20 s
//       (10 s en Difícil / Hardcore) nacen arañas.
//     • Fase 2: tira telaraña más seguido (de a 3), más huevos, y TACLEA:
//       se frena titilando en rojo y sale disparada de costado rompiendo los
//       bloques que tiene adelante (nunca los de abajo).
// ══════════════════════════════════════════════════════════════
export class AranaReina extends Jefe {
  static TIPO = 'arana_reina';
  static NOMBRE = 'Araña Reina';
  static ESCALA = 3; // dibujo base 16x8 (el de la araña) → 48x24
  static ANCHO = 48;
  static ALTO = 24;
  static VIDA = 220;
  static DANIO = 3; // mordida (y veneno)
  static VEL = [1.45, 1.85]; // fase 1 / fase 2
  static TREPA_VEL = 2.2;
  static MORDIDA_MS = 700; // entre mordida y mordida
  static TELA_MS = [1700, 950];
  static TELA_VEL = 4.2;
  static TELA_DIST = [2.5, 13]; // en bloques
  static HUEVOS_MS = [11000, 7000]; // cada cuánto tira huevos
  static HUEVOS_N = [2, 4];
  static DASH_CADA_MS = 5500; // (solo fase 2)
  static DASH_CARGA_MS = 550;
  static DASH_DUR_MS = 700;
  static DASH_VEL = 6;
  static DASH_DANIO = 6;
  static DASH_DIST = [3, 14];

  constructor(d) {
    super(d);
    this.telaMs = 1500;
    this.huevosMs = 6000;
    this.mordidaMs = 0;
    this.dashCdMs = 2500;
    this.dashCargaMs = 0;
    this.dashMs = 0;
    this.dashDir = 1;
    this.trepaMs = 0; // (para el dibujo de la araña)
    this.escupeMs = 0;
  }

  static puedeInvocar(juego) {
    const T = SurviConfig.TILE, p = juego.player;
    const col = Math.floor((p.x + p.w / 2) / T), row = Math.floor((p.y + p.h / 2) / T);
    const bajoTierra = row > juego.world.surfaceByCol[col] + SurviConfig.CUEVA_FILAS;
    if (!bajoTierra || juego._regionCueva(col, row) !== SurviConfig.REGION_CUEVA.musgo) return 'La Araña Reina solo aparece en las cuevas de musgo';
    return null;
  }

  drops() {
    const E = SurviConfig.ESPECIAL;
    return [
      { id: E.colmilloReina, qty: 1 },
      { id: SurviConfig.MAT.string, qty: 10 + Math.floor(Math.random() * 7) },
    ];
  }

  alPegar(juego) {
    juego.envenenar();
  }

  actualizar(dt, step, juego) {
    const C = AranaReina, T = SurviConfig.TILE, p = juego.player;
    if (this.hitMs > 0) this.hitMs -= dt;
    if (this.escupeMs > 0) this.escupeMs -= dt;
    if (this.mordidaMs > 0) this.mordidaMs -= dt;
    this.sentirFluidos(juego, dt);
    this.revisarFase(juego);
    if (this.estado === 'patrulla') this.cambiarEstado('persigue');
    const f = this.fase - 1, oculto = juego.ocultoPara(this);
    const dx = p.x + p.w / 2 - (this.x + this.w / 2), dy = p.y + p.h / 2 - (this.y + this.h / 2);
    const dist = Math.abs(dx) / T;

    if (this.dashMs > 0) {
      this.#taclear(dt, step, juego);
    } else if (this.dashCargaMs > 0) {
      // frenada, titilando en rojo: aviso del tacle
      this.dashCargaMs -= dt;
      this.vx = 0;
      Engine2D.Physics.applyGravity(this, step);
      Engine2D.Physics.resolveTileCollisions(this, juego.tilemap, step);
      if (this.dashCargaMs <= 0) {
        this.dashMs = C.DASH_DUR_MS;
        this.dashDir = Math.sign(dx) || this.facing;
        this.facing = this.dashDir;
        juego.sonar('arana', this.x + this.w / 2, this.y);
      }
    } else {
      // correrte (y trepar si hay una pared)
      const dir = oculto ? 0 : Math.abs(dx) < 6 ? 0 : Math.sign(dx);
      if (this.trepaMs > 0) {
        this.trepaMs -= dt;
        this.vy = Math.min(this.vy, -C.TREPA_VEL);
      }
      const freno = this.moverHacia(dir, C.VEL[f], juego, step, { maxCaida: 8 });
      if (freno === 'pared') this.trepaMs = 260;
      // sigue trepando mientras tenga la pared adelante (como la araña chica)
      if (this.trepaMs > 0 && juego.tilemap.isSolidAt(this.colFrente(this.facing), Math.floor((this.y + this.h - 1) / T))) this.trepaMs = 260;
      if (dir) this.facing = dir;
      this.contarPasos(step);
      // tacle (fase 2)
      this.dashCdMs -= dt;
      if (f && !oculto && this.dashCdMs <= 0 && this.grounded && dist >= C.DASH_DIST[0] && dist <= C.DASH_DIST[1] && Math.abs(dy) < 2 * T) {
        this.dashCdMs = C.DASH_CADA_MS;
        this.dashCargaMs = C.DASH_CARGA_MS;
      }
    }
    if (!oculto) {
      this.#telarana(dt, juego, dx, dist, f);
      this.#huevos(dt, juego, f);
      // mordida (y veneno) al tocarte
      if (this.mordidaMs <= 0 && Engine2D.Collisions.rectOverlap(this, p)) {
        this.mordidaMs = C.MORDIDA_MS;
        juego._damage(this.dashMs > 0 ? C.DASH_DANIO : C.DANIO);
        this.alPegar(juego);
        p.empujar(this.x + this.w / 2);
        if (this.dashMs > 0) p.vy = Math.min(p.vy, -3.5);
      }
    }
    return this.sigueCerca(juego);
  }

  // Tacle: sale disparada de costado y rompe lo que tiene adelante (a la
  // altura de su cuerpo; lo de abajo no). Si choca con algo que no se rompe, frena.
  #taclear(dt, step, juego) {
    const C = AranaReina, T = SurviConfig.TILE;
    this.dashMs -= dt;
    this.vx = this.dashDir * C.DASH_VEL;
    const col = Math.floor((this.dashDir > 0 ? this.x + this.w + this.vx * step : this.x + this.vx * step) / T);
    const r0 = Math.floor(this.y / T), r1 = Math.floor((this.y + this.h - 1) / T); // solo las filas del cuerpo
    for (let r = r0; r <= r1; r++) if (juego.tilemap.isSolidAt(col, r)) juego.romperBloqueJefe(col, r);
    Engine2D.Physics.applyGravity(this, step);
    Engine2D.Physics.resolveTileCollisions(this, juego.tilemap, step);
    if (this.vx === 0 || this.dashMs <= 0) {
      this.dashMs = 0;
      if (juego.camera) juego.camera.shake(3, 160);
    }
    if (Math.random() < 0.5) juego.particulas.polvo(Math.floor((this.x + this.w / 2) / T), Math.floor((this.y + this.h - 1) / T));
  }

  #telarana(dt, juego, dx, dist, f) {
    const C = AranaReina, p = juego.player;
    this.telaMs -= dt;
    if (this.telaMs > 0 || this.dashMs > 0 || this.dashCargaMs > 0) return;
    const { teVe } = this.mirarJugador(juego, C.TELA_DIST[1]);
    if (!teVe || dist < C.TELA_DIST[0] || dist > C.TELA_DIST[1]) {
      this.telaMs = 300;
      return;
    }
    this.telaMs = C.TELA_MS[f];
    const ox = this.x + this.w / 2 + this.facing * this.w * 0.35, oy = this.y + 6;
    const v = Criatura.tiroParabolico(ox, oy, p.x + p.w / 2, p.y + p.h / 2, C.TELA_VEL, ProyectilMob.TIPOS.telarana.g);
    const tiros = f ? [0, -0.9, 0.9] : [0]; // fase 2: de a 3, abiertas
    for (const a of tiros) juego.flechas.push(new ProyectilMob('telarana', ox, oy, v.vx, v.vy + a));
    juego.sonar('telarana', ox, oy);
    this.escupeMs = 250;
  }

  #huevos(dt, juego, f) {
    const C = AranaReina, T = SurviConfig.TILE, p = juego.player;
    this.huevosMs -= dt;
    if (this.huevosMs > 0) return;
    this.huevosMs = C.HUEVOS_MS[f];
    const ox = this.x + this.w / 2, oy = this.y;
    for (let i = 0; i < C.HUEVOS_N[f]; i++) {
      const tx = p.x + p.w / 2 + (Math.random() - 0.5) * 7 * T;
      const h = Enemigo.crear({ tipo: 'huevo_arana', x: ox - 6, y: oy - 4, vx: 0 });
      if (!h) continue;
      const v = Criatura.tiroParabolico(ox, oy, tx, p.y, 3 + Math.random(), HuevoArana.G);
      h.vx = v.vx;
      h.vy = v.vy;
      h.eclosionMs = juego.dif.jefesDuros ? HuevoArana.ECLOSION_MS[1] : HuevoArana.ECLOSION_MS[0];
      juego.enemies.push(h);
    }
    juego.sonar('slime', ox, oy);
    if (juego.ui.showToast && f === 0 && !this.avisoHuevos) {
      this.avisoHuevos = true;
      juego.ui.showToast('¡Rompé los huevos antes de que nazcan arañas!');
    }
  }

  // Tacle a punto de salir: titila en rojo.
  tinte() {
    return this.dashCargaMs > 0 && Math.floor(this.dashCargaMs / 80) % 2 ? '#ff3b3b' : null;
  }

  // El dibujo de la araña (más grande), con marcas violetas y corona.
  dibujarCuerpo(ctx, px, fase) {
    Arana.prototype.dibujarCuerpo.call(this, ctx, px, fase);
    px(3, 2, 1, 1, '#9b4dd6');
    px(6, 3, 2, 1, '#9b4dd6');
    px(4, 5, 1, 1, '#9b4dd6');
    // corona sobre la cabeza
    px(9, 1, 4, 1, '#f5c518');
    px(9, 0, 1, 1, '#f5c518');
    px(11, 0, 1, 1, '#f5c518');
    px(12, 0, 1, 1, '#f5c518');
    px(10, 1, 1, 1, '#e0343c');
  }
}

// Huevo de la Araña Reina: cae donde lo tira y, si no lo rompés a tiempo,
// nacen arañas. No se mueve ni lastima. Titila cuando está por abrirse.
export class HuevoArana extends Enemigo {
  static TIPO = 'huevo_arana';
  static ESCALA = 2; // base 6x7
  static ANCHO = 12;
  static ALTO = 14;
  static VIDA = 5;
  static DANIO = 0;
  static G = 0.2; // gravedad propia (px/paso²)
  static ECLOSION_MS = [20000, 10000]; // normal / Difícil-Hardcore
  static ARANAS = 2; // cuántas nacen

  constructor(d) {
    super(d);
    this.eclosionMs = HuevoArana.ECLOSION_MS[0];
  }

  serializar() {
    return null; // no se guardan (como los jefes)
  }

  recibirGolpe(dmg) {
    this.hp -= dmg;
    this.hitMs = 90;
  }

  actualizar(dt, step, juego) {
    if (this.hitMs > 0) this.hitMs -= dt;
    this.sentirFluidos(juego, dt);
    this.vy += HuevoArana.G * step;
    if (this.grounded) this.vx *= 0.7;
    Engine2D.Physics.resolveTileCollisions(this, juego.tilemap, step);
    this.eclosionMs -= dt;
    if (this.eclosionMs <= 0) {
      // nacen arañas (te buscan también en creativo, como las del catálogo)
      for (let i = 0; i < HuevoArana.ARANAS; i++) {
        const a = Enemigo.crear({ tipo: 'arana', x: this.x + i * 4 - 2, y: this.y + this.h - 8, vx: i ? 0.6 : -0.6, vy: -2.5 });
        if (!a) continue;
        a.deCatalogo = true;
        a.cambiarEstado('persigue');
        juego.enemies.push(a);
      }
      juego.particulas.chispas(this.x + this.w / 2, this.y + this.h / 2, ['#f2ecd8', '#cbbf9a', '#9b4dd6'], 10);
      juego.sonar('arana', this.x, this.y);
      this.hp = 0; // (no suelta nada: no lo rompiste vos)
      return false;
    }
    return this.sigueCerca(juego);
  }

  // Titila en violeta los últimos 3 segundos.
  tinte() {
    return this.eclosionMs < 3000 && Math.floor(this.eclosionMs / (this.eclosionMs < 1200 ? 90 : 200)) % 2 ? '#c77dff' : null;
  }

  dibujarCuerpo(ctx, px) {
    const cascara = '#efe6cf', sombra = '#c9bb95', vena = '#9b4dd6';
    px(1, 1, 4, 6, cascara);
    px(0, 2, 6, 4, cascara);
    px(2, 0, 2, 1, cascara);
    px(4, 3, 2, 3, sombra);
    px(1, 6, 4, 1, sombra);
    px(2, 2, 1, 2, vena);
    px(3, 4, 1, 2, vena);
    px(1, 1, 1, 1, '#ffffff'); // brillo
  }
}

Enemigo.registrar(AranaReina);
Enemigo.registrar(HuevoArana);

// ══════════════════════════════════════════════════════════════
//   Ojo Gigante (superficie, cae del cielo)
//     • Vuela SIEMPRE por arriba tuyo (nunca baja de tu altura) y cada tanto
//       se frena, tiembla y se te tira encima (embestida).
//     • Embistiendo ROMPE los bloques que se le cruzan (menos roca madre y
//       estaciones): esconderse atrás de un muro no alcanza.
//     • Viene con 2 ojos que lo ayudan; si matás uno, al rato sale otro.
//     • Fase 2: le sale la boca, embiste más seguido y más rápido, llama a
//       2 ojos más y a la LLUVIA DE SANGRE (luna de sangre + lluvia roja)
//       hasta que muera: de noche salen más monstruos; de día solo están
//       más agresivos. La lluvia roja NO lo cura a él.
// ══════════════════════════════════════════════════════════════
export class OjoGigante extends Jefe {
  static TIPO = 'ojo_gigante';
  static NOMBRE = 'Ojo Gigante';
  static ESCALA = 3; // dibujo base de radio 9 → 54x54
  static RADIO = 9;
  static ANCHO = 54;
  static ALTO = 54;
  static VIDA = 260;
  static DANIO = 3; // al tocarte flotando
  static EMBISTE_DANIO = 6;
  static ALTURA_TILES = 6; // flota a esta altura sobre vos
  static VEL = [2.2, 2.8]; // flotando (fase 1 / fase 2)
  static ACEL = 0.12;
  static FLOTA_MS = [2000, 1100]; // entre embestidas
  static CARGA_MS = 380; // se frena y tiembla antes de tirarse
  static EMBISTE_VEL = [6, 7.6];
  static EMBISTE_MS = 750;
  static ESBIRROS = [2, 4]; // ojos que lo acompañan
  static REPONER_MS = 2500; // al matar un ojo, cuánto tarda en salir otro
  static GOLPE_MS = 600; // entre golpe y golpe al tocarte

  constructor(d) {
    super(d);
    this.modo = 'flota'; // flota | carga | embiste
    this.modoMs = 0;
    this.golpeMs = 0;
    this.reponerMs = 0;
    this.esbirros = []; // sus ojos
    this.lado = Math.random() < 0.5 ? -1 : 1;
    this.ang = Math.PI / 2;
  }

  static puedeInvocar(juego) {
    if (!juego.alCielo(juego.player)) return 'El Ojo Gigante baja del cielo: tenés que estar a cielo abierto';
    return null;
  }

  // Aparece bien arriba, sobre vos.
  static lugarInvocacion(juego, jefe) {
    const T = SurviConfig.TILE, p = juego.player;
    for (const alto of [14, 11, 8]) {
      for (const dx of [0, 5, -5, 9, -9]) {
        jefe.x = p.x + p.w / 2 + dx * T - jefe.w / 2;
        jefe.y = p.y - alto * T;
        if (jefe.y < T || jefe.x < T || jefe.x + jefe.w > (SurviConfig.COLS - 1) * T) continue;
        if (juego._cajaLibre(jefe)) return true;
      }
    }
    return false;
  }

  drops() {
    const E = SurviConfig.ESPECIAL;
    return [
      { id: E.lenteAbismo, qty: 1 },
      { id: E.ojoMutante, qty: 3 + Math.floor(Math.random() * 3) },
    ];
  }

  // Fase 2: 2 ojos más (los repone solo) y la lluvia de sangre hasta que muera.
  alFase2(juego) {
    juego.empezarSangreJefe(this);
    if (juego.camera) juego.camera.shake(6, 600);
    juego.sonar('ojo', this.x + this.w / 2, this.y);
  }

  // Al irse o morir: se corta la lluvia de sangre y sus ojos se van.
  alTerminar(juego) {
    juego.terminarSangreJefe(this);
    for (const o of this.esbirros) if (!o.estaMuerto()) o.hp = 0;
  }

  actualizar(dt, step, juego) {
    const C = OjoGigante, T = SurviConfig.TILE, p = juego.player;
    if (this.hitMs > 0) this.hitMs -= dt;
    if (this.golpeMs > 0) this.golpeMs -= dt;
    this.estadoMs += dt;
    this.modoMs += dt;
    this.revisarFase(juego);
    const f = this.fase - 1, oculto = juego.ocultoPara(this);
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const px = p.x + p.w / 2, py = p.y + p.h / 2;
    this.#esbirros(dt, juego, f);

    if (this.modo === 'flota') {
      // arriba tuyo, a un costado (cambia de lado cada tanto)
      const tx = px + this.lado * 3 * T, ty = p.y - C.ALTURA_TILES * T;
      const d = Math.hypot(tx - cx, ty - cy) || 1;
      this.vx += ((tx - cx) / d) * C.ACEL * step;
      this.vy += ((ty - cy) / d) * C.ACEL * step + Math.sin(this.estadoMs / 300) * 0.02;
      const v = Math.hypot(this.vx, this.vy);
      if (v > C.VEL[f]) {
        this.vx *= C.VEL[f] / v;
        this.vy *= C.VEL[f] / v;
      }
      this.ang = Math.atan2(py - cy, px - cx); // te mira
      if (!oculto && this.modoMs >= C.FLOTA_MS[f] && cy < py) {
        this.modo = 'carga';
        this.modoMs = 0;
      }
    } else if (this.modo === 'carga') {
      // se frena y tiembla: aviso de la embestida
      this.vx *= 0.8;
      this.vy *= 0.8;
      this.ang = Math.atan2(py - cy, px - cx);
      if (this.modoMs >= C.CARGA_MS) {
        const d = Math.hypot(px - cx, py - cy) || 1;
        this.vx = ((px - cx) / d) * C.EMBISTE_VEL[f];
        this.vy = Math.max(0.4, ((py - cy) / d) * C.EMBISTE_VEL[f]); // siempre hacia abajo o de costado, nunca para arriba
        this.modo = 'embiste';
        this.modoMs = 0;
        juego.sonar('ojo', cx, cy);
      }
    } else if (this.modoMs >= C.EMBISTE_MS) this.#volverAFlotar();

    this.#mover(juego, step, this.modo === 'embiste');
    // nunca más abajo que vos: si llegó a tu altura, corta la embestida y sube
    if (this.y + this.h > p.y + p.h) {
      this.y = Math.min(this.y, p.y + p.h - this.h);
      if (this.modo === 'embiste') this.#volverAFlotar();
      this.vy = Math.min(this.vy, 0);
    }
    // golpe al tocarte
    if (!oculto && this.golpeMs <= 0 && Engine2D.Collisions.rectOverlap(this, p)) {
      this.golpeMs = C.GOLPE_MS;
      juego._damage(this.modo === 'embiste' ? C.EMBISTE_DANIO : C.DANIO);
      p.empujar(cx);
      if (this.modo === 'embiste') this.#volverAFlotar();
    }
    return this.sigueCerca(juego);
  }

  #volverAFlotar() {
    this.modo = 'flota';
    this.modoMs = 0;
    this.lado = -this.lado;
    this.vy = -2.5; // rebota para arriba
    this.vx *= 0.3;
  }

  // Mover eje por eje. Los bloques lo frenan; embistiendo los rompe.
  #mover(juego, step, embiste) {
    for (const eje of ['x', 'y']) {
      const v = eje === 'x' ? this.vx : this.vy;
      if (!v) continue;
      const nx = eje === 'x' ? this.x + v * step : this.x, ny = eje === 'y' ? this.y + v * step : this.y;
      const tapa = this.#bloquesEn(juego, nx, ny);
      if (tapa.length && embiste && tapa.every(([c, r]) => juego.esRompible(c, r))) {
        for (const [c, r] of tapa) juego.romperBloqueJefe(c, r);
      } else if (tapa.length) {
        if (eje === 'x') this.vx *= -0.4;
        else this.vy *= -0.4;
        if (embiste) this.#volverAFlotar();
        continue;
      }
      this.x = nx;
      this.y = ny;
    }
    this.x = Math.max(0, Math.min(SurviConfig.WORLD_W - this.w, this.x));
    this.y = Math.max(0, this.y);
  }

  #bloquesEn(juego, x, y) {
    const T = SurviConfig.TILE, map = juego.tilemap, out = [];
    for (let c = Math.floor(x / T); c <= Math.floor((x + this.w - 1) / T); c++)
      for (let r = Math.floor(y / T); r <= Math.floor((y + this.h - 1) / T); r++) if (map.isSolidAt(c, r)) out.push([c, r]);
    return out;
  }

  // Sus ojos: mantiene ESBIRROS vivos; si matás uno, a los REPONER_MS sale otro de él.
  #esbirros(dt, juego, f) {
    this.esbirros = this.esbirros.filter((o) => !o.estaMuerto() && juego.enemies.includes(o));
    if (this.esbirros.length >= OjoGigante.ESBIRROS[f]) {
      this.reponerMs = this.esbirros.length ? OjoGigante.REPONER_MS : 0;
      return;
    }
    this.reponerMs -= dt;
    if (this.reponerMs > 0) return;
    this.reponerMs = OjoGigante.REPONER_MS;
    const o = Enemigo.crear({ tipo: 'ojo', x: this.x + this.w / 2 - 6, y: this.y + this.h / 2 - 6, vx: (Math.random() - 0.5) * 3, vy: -1 });
    if (!o) return;
    o.esbirro = true; // también de día (no se va con el sol)
    o.deCatalogo = true; // te busca también en creativo
    o.sinDrops = true; // (si no, se podrían farmear ojos mutantes)
    this.esbirros.push(o);
    juego.enemies.push(o);
  }

  // Antes de tirarse: tiembla y titila en rojo.
  tinte() {
    return this.modo === 'carga' && Math.floor(this.modoMs / 70) % 2 ? '#ff3b3b' : null;
  }

  // Globo de pixeles (como el ojo volador pero grande), girado hacia vos.
  dibujar(ctx, sx, sy) {
    const C = OjoGigante, R = C.RADIO, E = C.ESCALA;
    const blanco = this.hitMs > 0, tinte = this.tinte();
    const temblor = this.modo === 'carga' ? (Math.random() - 0.5) * 3 : 0;
    ctx.save();
    ctx.translate(Math.round(sx + this.w / 2 + temblor), Math.round(sy + this.h / 2));
    ctx.rotate(this.ang);
    if (Math.cos(this.ang) < 0) ctx.scale(1, -1);
    ctx.scale(E, E);
    const px = (x, y, w, h, color) => {
      ctx.fillStyle = blanco ? '#ffffff' : tinte || color;
      ctx.fillRect(x, y, w, h);
    };
    // venas / cola atrás (ondulan)
    const t = this.estadoMs / 90;
    for (const [dy, largo] of [[-5, 8], [-2, 11], [2, 11], [5, 8]]) {
      for (let i = 0; i < largo; i++) px(-R - i, dy + Math.round(Math.sin(t + i * 0.7 + dy) * 1.3), 1, 1, i % 3 ? '#9e2b2b' : '#c94a4a');
    }
    // globo
    for (let y = -R; y < R; y++) {
      for (let x = -R; x < R; x++) {
        const d = (x + 0.5) ** 2 + (y + 0.5) ** 2;
        if (d > R * R) continue;
        px(x, y, 1, 1, d > (R - 1) ** 2 ? '#d9b8b8' : '#f4eeee');
      }
    }
    // venitas rojas en el blanco
    for (const [x, y, w] of [[-R + 2, -4, 3], [-R + 3, 3, 3], [-2, -R + 2, 1], [-3, R - 3, 2], [-R + 5, 0, 2]]) px(x, y, w, 1, '#d96a6a');
    if (this.fase === 2) {
      // fase 2: ojo chico arriba y una boca enorme con dientes
      px(R - 7, -7, 5, 4, '#8e1f1f');
      px(R - 6, -6, 2, 2, '#111111');
      const abre = Math.floor(this.estadoMs / 130) % 2;
      px(R - 10, -1, 10, 6 + abre, '#3a0a0a');
      px(R - 10, -2, 10, 1, '#b04a4a');
      for (let x = R - 10; x < R; x += 2) {
        px(x, -1, 1, 2, '#ffffff');
        px(x + 1, 4 + abre, 1, 2, '#ffffff');
      }
    } else {
      // iris rojo grande con pupila
      px(R - 7, -4, 6, 8, '#c0392b');
      px(R - 8, -3, 1, 6, '#c0392b');
      px(R - 5, -2, 3, 4, '#111111');
      px(R - 7, -4, 2, 1, '#ffffff'); // brillo
    }
    ctx.restore();
  }
}

Enemigo.registrar(OjoGigante);

// ══════════════════════════════════════════════════════════════
//   Yeti Anciano (cuevas de hielo) — se invoca con una Ofrenda helada
//     • Lanzas de escarcha: van rectas, ATRAVIESAN bloques y pegan fuerte.
//       Cada golpe suyo te deja una marca de escarcha: con 5 (3 en Difícil /
//       Hardcore) quedás congelado 3 s (ver SurviGame.escarchar).
//     • Bastón de madera: golpe en ÁREA adelante suyo que te tira 3 bloques
//       para atrás.
//     • Mega golpe al suelo: levanta el bastón titilando y lo clava; si estás
//       cerca y en el piso te lastima y te ATRAE 3 bloques hacia él.
//     • Llama yetis para que lo ayuden.
//     • Rompe bloques de costado (paredes) y para arriba (techos), nunca abajo.
//     • Fase 2: se enoja (ojos rojos), más rápido, lanzas de a 3 y más seguido.
// ══════════════════════════════════════════════════════════════
export class YetiAnciano extends Jefe {
  static TIPO = 'yeti_anciano';
  static NOMBRE = 'Yeti Anciano';
  static ESCALA = 4; // dibujo base 12x16 (el del yeti) → 48x64
  static ANCHO = 48;
  static ALTO = 64;
  static VIDA = 320;
  static DANIO = 3; // al tocarlo
  static VEL = [0.8, 1.15];
  static LANZA_MS = [2600, 1400];
  static LANZA_VEL = [5, 6.2];
  static LANZA_DIST = 18; // (en bloques) desde dónde te tira
  static BASTON_DIST = 3.4; // alcance del bastonazo (bloques)
  static BASTON_CARGA_MS = 420;
  static BASTON_CD_MS = 1300;
  static BASTON_DANIO = 5;
  static MEGA_MS = [9000, 6500];
  static MEGA_CARGA_MS = 850;
  static MEGA_RADIO = 6; // bloques
  static MEGA_DANIO = 7;
  static EMPUJE_TILES = 3; // bastonazo: para atrás / mega golpe: hacia él
  static AYUDA_MS = [16000, 11000]; // cada cuánto llama yetis
  static AYUDA_MAX = [1, 2]; // yetis suyos vivos a la vez
  static GOLPE_MS = 700; // entre golpes al tocarte

  constructor(d) {
    super(d);
    this.lanzaMs = 0; // (brazo levantado en el dibujo del yeti)
    this.lanzaCdMs = 1500;
    this.accion = null; // null | 'baston' | 'mega'
    this.accionMs = 0;
    this.bastonCdMs = 0;
    this.megaMs = 5000;
    this.ayudaMs = 6000;
    this.golpeMs = 0;
    this.saltoCdMs = 0;
    this.ayudantes = [];
    this.bastonAng = 0; // para dibujar el bastón
  }

  static puedeInvocar(juego) {
    const T = SurviConfig.TILE, p = juego.player;
    const col = Math.floor((p.x + p.w / 2) / T), row = Math.floor((p.y + p.h / 2) / T);
    const bajoTierra = row > juego.world.surfaceByCol[col] + SurviConfig.CUEVA_FILAS;
    if (!bajoTierra || juego._regionCueva(col, row) !== SurviConfig.REGION_CUEVA.hielo) return 'El Yeti Anciano solo aparece en las cuevas de hielo';
    return null;
  }

  drops() {
    const E = SurviConfig.ESPECIAL;
    return [
      { id: E.cuernoHelado, qty: 1 },
      { id: SurviConfig.TID.hielo_azul, qty: 8 + Math.floor(Math.random() * 5) },
      { id: SurviConfig.MAT.leather, qty: 3 + Math.floor(Math.random() * 3) },
    ];
  }

  alTerminar() {
    for (const y of this.ayudantes) if (!y.estaMuerto()) y.hp = 0;
  }

  // Cualquier golpe suyo también deja escarcha.
  #pegar(juego, danio) {
    juego._damage(danio);
    juego.escarchar();
  }

  actualizar(dt, step, juego) {
    const C = YetiAnciano, T = SurviConfig.TILE, p = juego.player;
    for (const k of ['hitMs', 'lanzaMs', 'bastonCdMs', 'golpeMs', 'saltoCdMs']) if (this[k] > 0) this[k] -= dt;
    this.sentirFluidos(juego, dt);
    this.revisarFase(juego);
    if (this.estado === 'patrulla') this.cambiarEstado('persigue');
    const f = this.fase - 1, oculto = juego.ocultoPara(this);
    const cx = this.x + this.w / 2, dx = p.x + p.w / 2 - cx, dy = p.y + p.h - (this.y + this.h);
    const dist = Math.abs(dx) / T;

    if (this.accion) {
      // cargando un golpe: quieto
      this.accionMs += dt;
      this.vx = 0;
      Engine2D.Physics.applyGravity(this, step);
      Engine2D.Physics.resolveTileCollisions(this, juego.tilemap, step);
      const carga = this.accion === 'baston' ? C.BASTON_CARGA_MS : C.MEGA_CARGA_MS;
      const k = Math.min(1, this.accionMs / carga);
      this.bastonAng = this.accion === 'baston' ? -1.2 - k * 1.2 : -1.6 - k * 0.5; // lo levanta
      if (this.accionMs >= carga) {
        if (this.accion === 'baston') this.#bastonazo(juego);
        else this.#megaGolpe(juego);
        this.accion = null;
        this.bastonAng = 1.1; // golpe: bastón abajo (vuelve de a poco)
      }
    } else {
      this.bastonAng += (-0.6 - this.bastonAng) * 0.12; // reposo: apoyado
      // caminar hacia vos (sin pegarse del todo)
      const dir = oculto || Math.abs(dx) < 1.5 * T ? 0 : Math.sign(dx);
      const freno = this.moverHacia(dir, C.VEL[f], juego, step, { maxCaida: 8 });
      if (dir) this.facing = dir;
      this.contarPasos(step);
      // pared adelante: la rompe (solo a la altura de su cuerpo)
      if (freno === 'pared') this.#romperAdelante(juego);
      // estás arriba: rompe el techo y salta
      if (!oculto && this.grounded && this.saltoCdMs <= 0 && dy < -2.5 * T && Math.abs(dx) < 6 * T) {
        this.saltoCdMs = 1500;
        this.#romperArriba(juego);
        this.vy = -6;
      }
      if (!oculto) {
        this.#lanzas(dt, juego, dx, f);
        // bastonazo si estás cerca
        if (this.bastonCdMs <= 0 && dist < C.BASTON_DIST && Math.abs(dy) < 3 * T) {
          this.accion = 'baston';
          this.accionMs = 0;
          this.bastonCdMs = C.BASTON_CD_MS;
          this.facing = Math.sign(dx) || this.facing;
        }
        // mega golpe al suelo
        this.megaMs -= dt;
        if (!this.accion && this.megaMs <= 0 && this.grounded && dist < 12) {
          this.megaMs = C.MEGA_MS[f];
          this.accion = 'mega';
          this.accionMs = 0;
          juego.sonar('yeti', cx, this.y);
        }
        this.#pedirAyuda(dt, juego, f);
      }
    }
    // tocarlo
    if (!oculto && this.golpeMs <= 0 && Engine2D.Collisions.rectOverlap(this, p)) {
      this.golpeMs = C.GOLPE_MS;
      this.#pegar(juego, C.DANIO);
      p.empujar(cx);
    }
    return this.sigueCerca(juego);
  }

  // Lanzas de escarcha: rectas hacia vos (atraviesan bloques). Fase 2: de a 3.
  #lanzas(dt, juego, dx, f) {
    const C = YetiAnciano, T = SurviConfig.TILE, p = juego.player;
    this.lanzaCdMs -= dt;
    if (this.lanzaCdMs > 0 || Math.abs(dx) > C.LANZA_DIST * T) return;
    this.lanzaCdMs = C.LANZA_MS[f];
    const ox = this.x + this.w / 2 + this.facing * this.w * 0.3, oy = this.y + this.h * 0.2;
    const base = Math.atan2(p.y + p.h / 2 - oy, p.x + p.w / 2 - ox);
    for (const a of f ? [-0.2, 0, 0.2] : [0]) {
      const v = C.LANZA_VEL[f];
      juego.flechas.push(new ProyectilMob('escarcha', ox, oy, Math.cos(base + a) * v, Math.sin(base + a) * v));
    }
    this.lanzaMs = 350;
    juego.sonar('nieve', ox, oy);
  }

  // Bastonazo: área adelante suyo; te tira 3 bloques para atrás.
  #bastonazo(juego) {
    const C = YetiAnciano, T = SurviConfig.TILE, p = juego.player;
    const hx = this.x + this.w / 2 + this.facing * this.w * 0.6, hy = this.y + this.h * 0.6;
    juego.sonar('pegar', hx, hy);
    for (let i = 0; i < 6; i++) juego.particulas.chispas(hx + this.facing * i * 4, hy + 10, ['#bfe8ff', '#ffffff'], 1);
    const d = Math.hypot(p.x + p.w / 2 - hx, p.y + p.h / 2 - hy);
    if (juego.ocultoPara(this) || d > C.BASTON_DIST * T) return;
    this.#pegar(juego, C.BASTON_DANIO);
    juego.arrastrarJugador(Math.sign(p.x + p.w / 2 - (this.x + this.w / 2)) || this.facing, C.EMPUJE_TILES);
    p.vy = Math.min(p.vy, -3);
  }

  // Mega golpe al suelo: temblor, escarcha en el piso; cerca y en el piso te
  // lastima y te atrae 3 bloques hacia él.
  #megaGolpe(juego) {
    const C = YetiAnciano, T = SurviConfig.TILE, p = juego.player;
    const cx = this.x + this.w / 2, row = Math.floor((this.y + this.h + 1) / T), c0 = Math.floor(cx / T);
    if (juego.camera) juego.camera.shake(9, 600);
    juego.sonar('explosion', cx, this.y + this.h);
    for (let c = c0 - C.MEGA_RADIO; c <= c0 + C.MEGA_RADIO; c++) {
      juego.particulas.polvo(c, row - 1);
      if (c % 2 === 0) juego.particulas.chispas(c * T + T / 2, row * T - 2, ['#bfe8ff', '#ffffff', '#6fc3ff'], 2);
    }
    const dx = p.x + p.w / 2 - cx;
    if (juego.ocultoPara(this) || !p.grounded || Math.abs(dx) > C.MEGA_RADIO * T || Math.abs(p.y + p.h - (this.y + this.h)) > 2 * T) return;
    this.#pegar(juego, C.MEGA_DANIO);
    juego.arrastrarJugador(-Math.sign(dx) || -this.facing, C.EMPUJE_TILES, 260);
  }

  // Llama a un yeti (hasta AYUDA_MAX suyos vivos), que aparece a su lado.
  #pedirAyuda(dt, juego, f) {
    const C = YetiAnciano, T = SurviConfig.TILE;
    this.ayudantes = this.ayudantes.filter((y) => !y.estaMuerto() && juego.enemies.includes(y));
    this.ayudaMs -= dt;
    if (this.ayudaMs > 0 || this.ayudantes.length >= C.AYUDA_MAX[f]) return;
    this.ayudaMs = C.AYUDA_MS[f];
    const y = Enemigo.crear({ tipo: 'yeti', x: 0, y: 0, vx: 0.5 });
    if (!y) return;
    for (const lado of [-this.facing, this.facing]) {
      y.x = this.x + this.w / 2 + lado * (this.w / 2 + T) - y.w / 2;
      y.y = this.y + this.h - y.h - 1;
      if (!juego._cajaLibre(y)) continue;
      y.deCatalogo = true; // te busca también en creativo
      y.sinDrops = true; // (si no, se podría farmear hielo azul)
      y.cambiarEstado('persigue');
      this.ayudantes.push(y);
      juego.enemies.push(y);
      juego.sonar('yeti', y.x, y.y);
      if (juego.ui.showToast && this.ayudantes.length === 1 && !this.avisoAyuda) {
        this.avisoAyuda = true;
        juego.ui.showToast('¡El Yeti Anciano llamó a un yeti!');
      }
      return;
    }
  }

  // Rompe la pared que tiene adelante, a la altura de su cuerpo (no el piso).
  #romperAdelante(juego) {
    const T = SurviConfig.TILE;
    const col = this.colFrente(this.facing), r0 = Math.floor(this.y / T), r1 = Math.floor((this.y + this.h - 1) / T);
    for (let r = r0; r <= r1; r++) if (juego.esRompible(col, r)) juego.romperBloqueJefe(col, r);
  }

  // Rompe el techo arriba de la cabeza (3 filas), a lo ancho de su cuerpo.
  #romperArriba(juego) {
    const T = SurviConfig.TILE, r0 = Math.floor(this.y / T);
    for (let c = Math.floor(this.x / T); c <= Math.floor((this.x + this.w - 1) / T); c++)
      for (let r = r0 - 3; r < r0; r++) if (juego.esRompible(c, r)) juego.romperBloqueJefe(c, r);
  }

  // Titila en celeste mientras levanta el bastón para el mega golpe.
  tinte() {
    return this.accion === 'mega' && Math.floor(this.accionMs / 90) % 2 ? '#9fe0ff' : null;
  }

  // El yeti (grande), con barba gris y cuernos; en la fase 2 ojos rojos.
  dibujarCuerpo(ctx, px, fase) {
    Yeti.prototype.dibujarCuerpo.call(this, ctx, px, fase);
    px(4, 5, 5, 2, '#b8c2cc'); // barba
    px(5, 7, 3, 1, '#b8c2cc');
    px(1, -1, 2, 2, '#d9cfae'); // cuernos
    px(9, -1, 2, 2, '#d9cfae');
    px(0, -2, 1, 1, '#d9cfae');
    px(11, -2, 1, 1, '#d9cfae');
    if (this.fase === 2) {
      px(5, 2, 1, 1, '#ff2a2a');
      px(7, 2, 1, 1, '#ff2a2a');
    }
  }

  // Encima del cuerpo: el bastón de madera en la mano (gira al golpear).
  dibujar(ctx, sx, sy) {
    super.dibujar(ctx, sx, sy);
    const E = YetiAnciano.ESCALA, dir = this.facing;
    const hx = Math.round(sx + (dir > 0 ? this.w * 0.82 : this.w * 0.18)), hy = Math.round(sy + this.h * 0.5);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.scale(dir, 1);
    ctx.rotate(this.bastonAng);
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(-2 * E, -1.5, 13 * E, 3); // palo
    ctx.fillStyle = '#8a6440';
    ctx.fillRect(-2 * E, -1.5, 13 * E, 1);
    ctx.fillStyle = '#6fc3ff';
    ctx.fillRect(11 * E - 2, -4, 7, 8); // piedra de hielo en la punta
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(11 * E - 1, -3, 2, 2);
    ctx.restore();
  }
}

Enemigo.registrar(YetiAnciano);

// Todos los jefes por tipo (para la invocación y la lista de derrotados).
export const JEFES = { rey_slime: ReySlime, arana_reina: AranaReina, ojo_gigante: OjoGigante, yeti_anciano: YetiAnciano };
