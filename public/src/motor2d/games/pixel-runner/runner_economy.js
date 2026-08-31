// ══════════════════════════════════════
//   Pixel Runner — runner_economy.js  (módulo ES6)
// ══════════════════════════════════════
// Monedas, mejoras de la tienda (RUNNER.upgrades) y progreso del Modo
// Historia — todo persistido en localStorage. Constantes en runner_config.js.
import {
  RUNNER, COINS_STORAGE_KEY, UPGRADES_STORAGE_KEY, UPGRADE_MAX_LEVEL,
  UPGRADE_LEVEL_COSTS, UPGRADE_SHIELD_HITS_COST, UPGRADE_X2_TRIPLE_COST,
  SHIELD_DURATION, DOUBLE_POINTS_DURATION, UPGRADE_DURATION_STEP,
  HISTORIA_STORAGE_KEY
} from './runner_config.js';

export function loadTotalCoins() {
  const raw = localStorage.getItem(COINS_STORAGE_KEY);
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}
export function saveTotalCoins(total) {
  localStorage.setItem(COINS_STORAGE_KEY, String(total));
}

// ─── Tienda de mejoras ──────────────────────────────────────────────────
// 4 mejoras permanentes, pagadas con las monedas juntadas (RUNNER.totalCoins),
// persistidas en localStorage igual que las monedas y el progreso de Historia.
//
//  - shieldLevel (0..10): +1 seg de duración del escudo por nivel.
//  - x2Level     (0..10): +1 seg de duración del x2 por nivel.
//  - shieldHits  (bool):  el escudo pasa de aguantar 1 golpe a 2.
//  - x2Triple    (bool):  el power-up de puntos pasa de x2 a x3.
//
// Las mejoras de nivel cuestan más cada vez (100,200,...,1000 = 5500 en
// total para llevar una al máximo); las de un solo golpe (shieldHits /
// x2Triple) son compras únicas.
export function defaultRunnerUpgrades() {
  return { shieldLevel: 0, x2Level: 0, shieldHits: false, x2Triple: false };
}

export function loadUpgrades() {
  const def = defaultRunnerUpgrades();
  try {
    const raw = localStorage.getItem(UPGRADES_STORAGE_KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw);
    const clampLevel = (n) => Math.min(UPGRADE_MAX_LEVEL, Math.max(0, parseInt(n, 10) || 0));
    return {
      shieldLevel: clampLevel(parsed.shieldLevel),
      x2Level: clampLevel(parsed.x2Level),
      shieldHits: !!parsed.shieldHits,
      x2Triple: !!parsed.x2Triple,
    };
  } catch (e) {
    return def;
  }
}

export function saveUpgrades(u) {
  localStorage.setItem(UPGRADES_STORAGE_KEY, JSON.stringify(u));
}

// Devuelve las mejoras ya cargadas (las cachea en RUNNER.upgrades la
// primera vez) — se usa en el loop del juego, donde no hace falta pegarle
// a localStorage en cada frame.
export function getRunnerUpgrades() {
  if (!RUNNER.upgrades) RUNNER.upgrades = loadUpgrades();
  return RUNNER.upgrades;
}

// Fuerza una relectura desde localStorage. Se usa al abrir el panel de
// Mejoras (se puede abrir desde el menú antes de jugar, o después de
// comprar algo) para no mostrar datos viejos.
export function refreshRunnerUpgrades() {
  RUNNER.upgrades = loadUpgrades();
  return RUNNER.upgrades;
}

// Costo para comprar el próximo nivel/mejora de `tipo`, o null si ya está
// al máximo (nivel 10, o ya comprada en el caso de las mejoras únicas).
export function getUpgradeCost(tipo, upgrades) {
  const u = upgrades || getRunnerUpgrades();
  if (tipo === 'shieldDuration') return u.shieldLevel >= UPGRADE_MAX_LEVEL ? null : UPGRADE_LEVEL_COSTS[u.shieldLevel];
  if (tipo === 'x2Duration') return u.x2Level >= UPGRADE_MAX_LEVEL ? null : UPGRADE_LEVEL_COSTS[u.x2Level];
  if (tipo === 'shieldHits') return u.shieldHits ? null : UPGRADE_SHIELD_HITS_COST;
  if (tipo === 'x2Triple') return u.x2Triple ? null : UPGRADE_X2_TRIPLE_COST;
  return null;
}

// Intenta comprar una mejora. Devuelve true si se pudo pagar (y descuenta
// las monedas + persiste todo), false si estaba al máximo o no alcanzaba.
export function buyRunnerUpgrade(tipo) {
  refreshRunnerUpgrades(); // relee de localStorage antes de tocar nada, por si se compró en otra pestaña/sesión
  RUNNER.totalCoins = loadTotalCoins();

  const cost = getUpgradeCost(tipo);
  if (cost === null || RUNNER.totalCoins < cost) return false;

  RUNNER.totalCoins -= cost;
  saveTotalCoins(RUNNER.totalCoins);

  const u = RUNNER.upgrades;
  if (tipo === 'shieldDuration') u.shieldLevel++;
  else if (tipo === 'x2Duration') u.x2Level++;
  else if (tipo === 'shieldHits') u.shieldHits = true;
  else if (tipo === 'x2Triple') u.x2Triple = true;
  saveUpgrades(u);
  return true;
}

// Duración efectiva (en frames) de cada power-up, ya con las mejoras de
// nivel aplicadas — reemplazan el uso directo de SHIELD_DURATION /
// DOUBLE_POINTS_DURATION al agarrar el pickup.
export function shieldDurationFrames() {
  return SHIELD_DURATION + getRunnerUpgrades().shieldLevel * UPGRADE_DURATION_STEP;
}
export function doublePointsDurationFrames() {
  return DOUBLE_POINTS_DURATION + getRunnerUpgrades().x2Level * UPGRADE_DURATION_STEP;
}
// Golpes que aguanta el escudo antes de romperse (1, o 2 con la mejora).
export function shieldMaxHits() {
  return getRunnerUpgrades().shieldHits ? 2 : 1;
}
// Multiplicador de puntaje mientras el x2 está activo (2x, o 3x con la mejora).
export function runnerScoreMultiplier() {
  return getRunnerUpgrades().x2Triple ? 3 : 2;
}

// ─── Progreso de campaña: Modo Historia ────────────────────────────────
// Modo Historia = llegar a HISTORIA_GOAL puntos. Al lograrlo una vez se
// desbloquea el Modo Infinito para siempre (persistido en localStorage,
// mismo patrón que las monedas).
export function loadHistoriaCompleta() {
  return localStorage.getItem(HISTORIA_STORAGE_KEY) === '1';
}
export function saveHistoriaCompleta() {
  localStorage.setItem(HISTORIA_STORAGE_KEY, '1');
}

// En Historia el HUD muestra "puntos / meta" para que se vea el progreso;
// en Infinito muestra solo el puntaje, como antes.
