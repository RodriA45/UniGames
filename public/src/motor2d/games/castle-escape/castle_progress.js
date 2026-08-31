// ══════════════════════════════════════
//   Castle Escape — castle_progress.js  (módulo ES6, sin dependencias)
// ══════════════════════════════════════
// Estrellas por nivel y qué niveles están desbloqueados — persistido en
// localStorage.

export function trGetStars() {
  try { return JSON.parse(localStorage.getItem('trampasStars')) || {}; }
  catch { return {}; }
}
export function trSaveStars(stars) {
  localStorage.setItem('trampasStars', JSON.stringify(stars));
}
export function trGetLevelStars(i) {
  return trGetStars()[i] || 0;
}
export function trSaveLevelStars(i, stars) {
  const all = trGetStars();
  if (stars > (all[i] || 0)) { all[i] = stars; trSaveStars(all); }
}
export function trIsUnlocked(i) {
  if (i === 0) return true;
  return trGetLevelStars(i - 1) >= 1;
}

// ─── Navegación de menús ───
