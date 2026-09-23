// ══════════════════════════════════════
//   Pixel Runner — runner_economy.js  (módulo ES6)
// ══════════════════════════════════════
// Clase Economia: monedas, tienda de mejoras y progreso del Modo Historia,
// todo persistido en localStorage. Es la ÚNICA clase que toca esas claves.
//
// 7 mejoras permanentes, pagadas con las monedas juntadas:
//  - shieldLevel     (0..10): +1 seg de escudo por nivel.
//  - x2Level         (0..10): +1 seg de x2 por nivel.
//  - slowFallLevel   (0..10): +2 seg de caída lenta por nivel.
//  - slowSpeedLevel  (0..10): +1 seg de velocidad reducida por nivel.
//  - shieldHits      (bool):  el escudo aguanta 2 golpes en vez de 1.
//  - x2Triple        (bool):  el power-up de puntos pasa de x2 a x3.
//  - slowSpeedStrong (bool):  velocidad reducida pasa de -25% a -50%.
import { RunnerConfig as RC } from './runner_config.js';

export class Economia {
  constructor() {
    this.totalCoins = 0;  // total histórico (persistido)
    this.upgrades = null; // mejoras compradas — null hasta la primera carga
  }

  // ─── Monedas ───
  cargarMonedas() {
    const n = parseInt(localStorage.getItem(RC.COINS_STORAGE_KEY), 10);
    return Number.isFinite(n) ? n : 0;
  }

  guardarMonedas(total) {
    localStorage.setItem(RC.COINS_STORAGE_KEY, String(total));
  }

  // Suma monedas agarradas y las persiste al toque (no se pierden si se
  // cierra la pestaña antes del game over).
  sumarMonedas(cantidad) {
    this.totalCoins += cantidad;
    this.guardarMonedas(this.totalCoins);
  }

  // ─── Mejoras ───
  static mejorasPorDefecto() {
    return {
      shieldLevel: 0, x2Level: 0, slowFallLevel: 0, slowSpeedLevel: 0,
      shieldHits: false, x2Triple: false, slowSpeedStrong: false,
    };
  }

  cargarMejoras() {
    const def = Economia.mejorasPorDefecto();
    try {
      const raw = localStorage.getItem(RC.UPGRADES_STORAGE_KEY);
      if (!raw) return def;
      const parsed = JSON.parse(raw);
      const clampLevel = (n) => Math.min(RC.UPGRADE_MAX_LEVEL, Math.max(0, parseInt(n, 10) || 0));
      return {
        shieldLevel: clampLevel(parsed.shieldLevel),
        x2Level: clampLevel(parsed.x2Level),
        slowFallLevel: clampLevel(parsed.slowFallLevel),
        slowSpeedLevel: clampLevel(parsed.slowSpeedLevel),
        shieldHits: !!parsed.shieldHits,
        x2Triple: !!parsed.x2Triple,
        slowSpeedStrong: !!parsed.slowSpeedStrong,
      };
    } catch (e) {
      return def;
    }
  }

  guardarMejoras(u) {
    localStorage.setItem(RC.UPGRADES_STORAGE_KEY, JSON.stringify(u));
  }

  // Mejoras cacheadas (en el loop no hace falta leer localStorage cada frame).
  get mejoras() {
    if (!this.upgrades) this.upgrades = this.cargarMejoras();
    return this.upgrades;
  }

  // Fuerza una relectura (al abrir el panel de Mejoras, para no mostrar datos viejos).
  refrescarMejoras() {
    this.upgrades = this.cargarMejoras();
    return this.upgrades;
  }

  // Costo del próximo nivel/mejora de `tipo`, o null si ya está al máximo.
  costoMejora(tipo, upgrades) {
    const u = upgrades || this.mejoras;
    const nivel = (n) => n >= RC.UPGRADE_MAX_LEVEL ? null : RC.UPGRADE_LEVEL_COSTS[n];
    if (tipo === 'shieldDuration') return nivel(u.shieldLevel);
    if (tipo === 'x2Duration') return nivel(u.x2Level);
    if (tipo === 'slowFallDuration') return nivel(u.slowFallLevel);
    if (tipo === 'slowSpeedDuration') return nivel(u.slowSpeedLevel);
    if (tipo === 'shieldHits') return u.shieldHits ? null : RC.UPGRADE_SHIELD_HITS_COST;
    if (tipo === 'x2Triple') return u.x2Triple ? null : RC.UPGRADE_X2_TRIPLE_COST;
    if (tipo === 'slowSpeedStrong') return u.slowSpeedStrong ? null : RC.UPGRADE_SLOWSPEED_STRONG_COST;
    return null;
  }

  // Devuelve true si se pudo pagar (descuenta y persiste), false si no.
  comprarMejora(tipo) {
    this.refrescarMejoras(); // por si se compró en otra pestaña/sesión
    this.totalCoins = this.cargarMonedas();

    const cost = this.costoMejora(tipo);
    if (cost === null || this.totalCoins < cost) return false;

    this.totalCoins -= cost;
    this.guardarMonedas(this.totalCoins);

    const u = this.upgrades;
    if (tipo === 'shieldDuration') u.shieldLevel++;
    else if (tipo === 'x2Duration') u.x2Level++;
    else if (tipo === 'slowFallDuration') u.slowFallLevel++;
    else if (tipo === 'slowSpeedDuration') u.slowSpeedLevel++;
    else if (tipo === 'shieldHits') u.shieldHits = true;
    else if (tipo === 'x2Triple') u.x2Triple = true;
    else if (tipo === 'slowSpeedStrong') u.slowSpeedStrong = true;
    this.guardarMejoras(u);
    return true;
  }

  // ─── Efectos de las mejoras (duraciones en frames) ───
  duracionEscudo() {
    return RC.SHIELD_DURATION + this.mejoras.shieldLevel * RC.UPGRADE_DURATION_STEP;
  }
  duracionPuntosDobles() {
    return RC.DOUBLE_POINTS_DURATION + this.mejoras.x2Level * RC.UPGRADE_DURATION_STEP;
  }
  duracionCaidaLenta() {
    return RC.SLOWFALL_DURATION + this.mejoras.slowFallLevel * RC.SLOWFALL_DURATION_STEP;
  }
  duracionVelocidadReducida() {
    return RC.SLOWSPEED_DURATION + this.mejoras.slowSpeedLevel * RC.UPGRADE_DURATION_STEP;
  }
  // % de naturalSpeed mientras dura "velocidad reducida".
  factorVelocidadReducida() {
    return this.mejoras.slowSpeedStrong ? RC.SLOWSPEED_FACTOR_STRONG : RC.SLOWSPEED_FACTOR_BASE;
  }
  // Golpes que aguanta el escudo (1, o 2 con la mejora).
  golpesEscudo() {
    return this.mejoras.shieldHits ? 2 : 1;
  }
  // Multiplicador de puntaje con x2 activo (2, o 3 con la mejora).
  multiplicadorPuntos() {
    return this.mejoras.x2Triple ? 3 : 2;
  }

  // ─── Modo Historia (completarlo desbloquea el Infinito para siempre) ───
  historiaCompleta() {
    return localStorage.getItem(RC.HISTORIA_STORAGE_KEY) === '1';
  }
  guardarHistoriaCompleta() {
    localStorage.setItem(RC.HISTORIA_STORAGE_KEY, '1');
  }
}
