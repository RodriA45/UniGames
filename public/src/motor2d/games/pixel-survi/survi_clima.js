// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_clima.js
//
//   Clase Clima: el tiempo que hace en el mundo.
//     • despejado
//     • lluvia        → gotas celestes, cielo gris, un poco menos de luz.
//                       Tapa el sol: los zombies y esqueletos NO se queman
//                       y los zombies pueden salir de día.
//     • lluvia ácida  → (poco común) gotas verdes que lastiman a todo lo que
//                       esté a cielo abierto (menos a los slimes) y gastan la
//                       armadura x3. Bajo techo o con la cabeza bajo el agua,
//                       no pasa nada. (El daño lo aplica SurviGame.)
//
//   Cada clima dura un rato (DURACION_MS) y al terminar se sortea el
//   siguiente con CHANCE. El cambio es gradual: `intensidad` va de 0 a 1
//   en unos segundos (cielo, luz y cantidad de gotas).
//
//   Las gotas son partículas en px de mundo: caen en diagonal y desaparecen
//   al llegar al primer bloque sólido de su columna (techo o suelo), así
//   bajo techo y en las cuevas no llueve.
// ══════════════════════════════════════════════════════════════

export class Clima {
  static TIPOS = {
    despejado: { nombre: 'Despejado' },
    lluvia: { nombre: 'Lluvia', gota: 'rgba(170, 205, 255, 0.6)', cielo: '#5b6672', luz: 0.8 },
    acida: { nombre: 'Lluvia ácida', gota: 'rgba(130, 255, 90, 0.8)', cielo: '#4f6b43', luz: 0.75 },
    // No se sortea: es la lluvia común durante una luna de sangre (ver `sangre`).
    sangre: { nombre: 'Lluvia de sangre', gota: 'rgba(230, 40, 50, 0.75)', cielo: '#5a1a22', luz: 0.7 },
  };
  // Al terminar un clima, qué sale después (el resto de la probabilidad = despejado).
  static CHANCE = { acida: 0.05, lluvia: 0.25 };
  // Cuánto dura cada uno (ms, entre min y max).
  static DURACION_MS = {
    despejado: [120000, 300000],
    lluvia: [60000, 150000],
    acida: [35000, 70000],
  };
  static TRANSICION_MS = 4000; // de 0 a 1 de intensidad
  static GOTAS_MAX = { low: 60, medium: 110, high: 170 };
  static VIENTO = 1.3; // px por paso hacia la derecha
  static CAIDA = 7; // px por paso hacia abajo

  constructor(d = null) {
    const ok = d && Clima.TIPOS[d.tipo];
    this.tipo = ok ? d.tipo : 'despejado';
    this.restanteMs = ok && Number.isFinite(d.restanteMs) ? d.restanteMs : Clima.#duracion(this.tipo);
    this.intensidad = this.tipo === 'despejado' ? 0 : 1;
    this.visual = this.tipo === 'despejado' ? 'lluvia' : this.tipo; // colores mientras se desvanece
    this.gotas = [];
    this.salpicaduras = [];
    this.sangre = false; // luna de sangre: la lluvia común se vuelve roja (lo pone SurviGame)
  }

  static #duracion(tipo) {
    const [a, b] = Clima.DURACION_MS[tipo];
    return a + Math.random() * (b - a);
  }

  static #sortear() {
    const r = Math.random();
    if (r < Clima.CHANCE.acida) return 'acida';
    if (r < Clima.CHANCE.acida + Clima.CHANCE.lluvia) return 'lluvia';
    return 'despejado';
  }

  get lloviendo() {
    return this.tipo !== 'despejado';
  }

  get acida() {
    return this.tipo === 'acida';
  }

  // Lluvia roja: llueve (común) durante una luna de sangre.
  get sangrienta() {
    return this.sangre && this.tipo === 'lluvia';
  }

  get nombre() {
    return Clima.TIPOS[this.tipo].nombre;
  }

  // Colores / luz del clima que se está viendo (también mientras se desvanece).
  get datosVisuales() {
    return Clima.TIPOS[this.sangre && this.visual === 'lluvia' ? 'sangre' : this.visual];
  }

  // Factor de la luz del sol (1 = sin cambio).
  get factorSol() {
    return 1 - (1 - this.datosVisuales.luz) * this.intensidad;
  }

  // Avanza el tiempo. Devuelve el tipo nuevo si cambió (para avisar), o null.
  actualizar(dt) {
    let cambio = null;
    this.restanteMs -= dt;
    if (this.restanteMs <= 0) {
      const nuevo = Clima.#sortear();
      if (nuevo !== this.tipo) cambio = nuevo;
      this.tipo = nuevo;
      this.restanteMs = Clima.#duracion(nuevo);
    }
    if (this.lloviendo) this.visual = this.tipo;
    const meta = this.lloviendo ? 1 : 0;
    const paso = dt / Clima.TRANSICION_MS;
    this.intensidad = meta > this.intensidad ? Math.min(1, this.intensidad + paso) : Math.max(0, this.intensidad - paso);
    return cambio;
  }

  // Forzar un clima (para probar desde la consola).
  forzar(tipo, ms = null) {
    if (!Clima.TIPOS[tipo]) return;
    this.tipo = tipo;
    this.restanteMs = ms ?? Clima.#duracion(tipo);
  }

  serializar() {
    return { tipo: this.tipo, restanteMs: Math.round(this.restanteMs) };
  }

  // ── Gotas ──
  // camera: {x, y, width, height} en px de mundo. techo(col) → fila del
  // primer bloque sólido de esa columna. calidad: 'low' | 'medium' | 'high'.
  actualizarGotas(dt, step, camera, techo, T, calidad) {
    const max = Math.round((Clima.GOTAS_MAX[calidad] || Clima.GOTAS_MAX.medium) * this.intensidad);
    // nacen arriba de la vista (un poco a la izquierda, por el viento)
    let nuevas = Math.min(max - this.gotas.length, Math.ceil(max / 25));
    while (nuevas-- > 0) {
      this.gotas.push({
        x: camera.x - 40 + Math.random() * (camera.width + 40),
        y: camera.y - 20 - Math.random() * camera.height * 0.6,
        v: Clima.CAIDA * (0.85 + Math.random() * 0.3),
      });
    }
    const piso = camera.y + camera.height + 10;
    const maxSalp = calidad === 'low' ? 0 : 40; // gama baja: sin salpicaduras
    const G = this.gotas;
    for (let i = G.length - 1; i >= 0; i--) {
      const g = G[i];
      g.x += Clima.VIENTO * step;
      g.y += g.v * step;
      const col = Math.floor(g.x / T);
      const tope = techo(col) * T;
      if (g.y >= tope || g.y > piso || g.x > camera.x + camera.width + 20) {
        if (g.y >= tope && g.y < piso && this.salpicaduras.length < maxSalp) this.salpicaduras.push({ x: g.x, y: tope, ms: 160 });
        G[i] = G[G.length - 1]; // sacar sin correr todo el array (el orden no importa)
        G.pop();
      }
    }
    for (let i = this.salpicaduras.length - 1; i >= 0; i--) {
      if ((this.salpicaduras[i].ms -= dt) <= 0) this.salpicaduras.splice(i, 1);
    }
  }

  // Con el ctx ya escalado por el zoom (mismo espacio que el tilemap).
  dibujar(ctx, camera) {
    if (!this.gotas.length && !this.salpicaduras.length) return;
    const color = this.datosVisuales.gota;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const dx = Clima.VIENTO * 1.6, dy = Clima.CAIDA * 1.1; // largo del trazo
    for (const g of this.gotas) {
      const x = g.x - camera.x, y = g.y - camera.y;
      ctx.moveTo(x, y);
      ctx.lineTo(x - dx, y - dy);
    }
    ctx.stroke();
    ctx.fillStyle = color;
    for (const s of this.salpicaduras) {
      const x = Math.round(s.x - camera.x), y = Math.round(s.y - camera.y);
      const k = s.ms > 80 ? 1 : 2;
      ctx.fillRect(x - k, y - 1, 1, 1);
      ctx.fillRect(x + k, y - 1, 1, 1);
    }
    ctx.restore();
  }
}
