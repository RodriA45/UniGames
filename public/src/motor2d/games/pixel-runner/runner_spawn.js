// ══════════════════════════════════════
//   Pixel Runner — runner_spawn.js  (módulo ES6)
// ══════════════════════════════════════
// Clase Spawner: generación procedural de obstáculos, grupos de monedas y
// power-ups, con los chequeos de espacio libre para no solaparlos. Crea
// instancias de las clases de runner_entities.js y las agrega al juego.
import { RunnerConfig as RC } from './runner_config.js';
import { ObstaculoSuelo, Pajaro, Moneda, PowerUp } from './runner_entities.js';

export class Spawner {
  constructor(juego) {
    this.juego = juego;
  }

  get groundY() {
    return this.juego.view.height - this.juego.groundH;
  }

  azar(lista) {
    return lista[Math.floor(Math.random() * lista.length)];
  }

  // ─── Obstáculos ───
  generarObstaculo() {
    const juego = this.juego, C = juego.view;
    const groundVariants = RC.groundVariantsForBiome(juego.biome);

    // Después de los 1000 puntos, a veces sale un grupo de 2 o 3 pegados
    // (árboles en pasto, cactus en desierto; las rocas van solas).
    if (juego.score >= RC.OBSTACLE_CLUSTER_MIN_SCORE && Math.random() < RC.OBSTACLE_CLUSTER_CHANCE) {
      this.generarGrupoSuelo(juego.biome === 'desert' ? RC.CACTUS_VARIANTS : RC.TREE_VARIANTS);
      return;
    }

    const type = Math.random();
    const groundY = this.groundY;
    const skyTop = juego.skyH;

    if (type < 0.45) {
      const h = 36 + Math.floor(Math.random() * 34);
      const w = 20 + Math.floor(Math.random() * 18);
      const variant = this.azar(groundVariants);
      const y = groundY - h;
      const x = this.xLibreParaObstaculo(C.width + 20, y, w, h);
      if (x === null) return; // no había lugar libre de monedas
      juego.obstacles.push(new ObstaculoSuelo(x, y, w, h, variant));
    } else if (type < 0.75) {
      const h = 24 + Math.floor(Math.random() * 16);
      const w = 38 + Math.floor(Math.random() * 26);
      const minY = skyTop + 4;
      const maxY = C.height * 0.45;
      const y = minY + Math.random() * (maxY - minY);
      const x = this.xLibreParaObstaculo(C.width + 20, y, w, h);
      if (x === null) return;
      juego.obstacles.push(new Pajaro(x, y, w, h));
    } else {
      // Combo: uno de piso + un pájaro un poco más atrás
      const h1 = 32 + Math.floor(Math.random() * 26);
      const variant1 = this.azar(groundVariants);
      const y1 = groundY - h1;
      const x1 = this.xLibreParaObstaculo(C.width + 20, y1, 18, h1);
      if (x1 === null) return;
      juego.obstacles.push(new ObstaculoSuelo(x1, y1, 18, h1, variant1));
      const h2 = 22;
      const y2 = skyTop + 10 + Math.random() * (C.height * 0.3);
      const x2 = this.xLibreParaObstaculo(x1 + 40, y2, 34, h2);
      if (x2 === null) return;
      juego.obstacles.push(new Pajaro(x2, y2, 34, h2));
    }
  }

  // 2 o 3 obstáculos de la misma familia pegados, cada uno de su tamaño.
  generarGrupoSuelo(familia) {
    const groundY = this.groundY;
    const count = Math.random() < 0.5 ? 2 : 3;
    let cx = this.juego.view.width + 20;
    for (let i = 0; i < count; i++) {
      const variant = this.azar(familia);
      const h = 34 + Math.floor(Math.random() * 28);
      const w = 20 + Math.floor(Math.random() * 16);
      const y = groundY - h;
      const x = this.xLibreParaObstaculo(cx, y, w, h);
      if (x === null) return; // quedan los anteriores
      this.juego.obstacles.push(new ObstaculoSuelo(x, y, w, h, variant));
      cx = x + w + 4;
    }
  }

  // ─── Chequeos de espacio libre ───
  // Items y obstáculos viajan a la misma velocidad: si están libres al
  // nacer, quedan libres para siempre.
  static seSolapan(x, y, w, h, o) {
    const b = RC.PICKUP_OBSTACLE_BUFFER;
    return x < o.x + o.w + b && x + w > o.x - b && y < o.y + o.h + b && y + h > o.y - b;
  }

  libreDeObstaculos(x, y, w, h) {
    return !this.juego.obstacles.some(o => Spawner.seSolapan(x, y, w, h, o));
  }

  libreDePickups(x, y, w, h) {
    return !this.juego.pickups.some(o => Spawner.seSolapan(x, y, w, h, o));
  }

  // Prueba desde startX corriéndose 45px hasta 6 veces; null si no hay lugar.
  buscarX(startX, estaLibre) {
    let x = startX;
    for (let attempt = 0; attempt < 6; attempt++) {
      if (estaLibre(x)) return x;
      x += 45;
    }
    return null;
  }

  xLibreParaObstaculo(startX, y, w, h) {
    return this.buscarX(startX, x => this.libreDePickups(x, y, w, h));
  }

  // ─── Monedas y power-ups ───
  // Grupo de 3 a 5 monedas en el suelo o en el cielo, en una leve curva.
  generarGrupoMonedas() {
    const juego = this.juego;
    const groundY = this.groundY;
    const count = RC.PICKUP_GROUP_MIN + Math.floor(Math.random() * (RC.PICKUP_GROUP_MAX - RC.PICKUP_GROUP_MIN + 1));
    const onGround = Math.random() < 0.5;
    const spacing = 24;
    const itemSize = 15;
    const baseY = onGround ? groundY - 30 : juego.skyH + 24 + Math.random() * 40;
    const maxArc = count > 1 ? 12 : 0;
    const groupW = (count - 1) * spacing + itemSize;
    const groupH = itemSize + maxArc;

    const startX = this.buscarX(juego.view.width + 20, x => this.libreDeObstaculos(x, baseY - maxArc, groupW, groupH));
    if (startX === null) return;

    for (let i = 0; i < count; i++) {
      const arc = count > 1 ? Math.sin((i / (count - 1)) * Math.PI) * maxArc : 0;
      juego.pickups.push(new Moneda(startX + i * spacing, baseY - arc, itemSize));
    }
  }

  // Power-up suelto en la banda aérea; los 4 tipos con 25% cada uno.
  generarPowerUp() {
    const juego = this.juego;
    const minY = juego.skyH + 10;
    const maxY = this.groundY - 40;
    const size = PowerUp.TAMANIO;
    const y = minY + Math.random() * (maxY - minY);

    const x = this.buscarX(juego.view.width + 20, x => this.libreDeObstaculos(x, y, size, size));
    if (x === null) return;

    const roll = Math.random();
    const type = roll < 0.25 ? 'shield' : roll < 0.5 ? 'x2' : roll < 0.75 ? 'slowfall' : 'slowspeed';
    juego.pickups.push(PowerUp.crear(x, y, type));
  }
}
