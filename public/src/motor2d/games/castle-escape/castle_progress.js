// ══════════════════════════════════════
//   Castle Escape — castle_progress.js  (módulo ES6, sin dependencias)
// ══════════════════════════════════════

export class Progreso {
  constructor(clave = 'trampasStars') {
    this.clave = clave;
  }

  // { indiceNivel: estrellas }
  obtenerTodas() {
    try { return JSON.parse(localStorage.getItem(this.clave)) || {}; }
    catch { return {}; }
  }

  guardarTodas(stars) {
    localStorage.setItem(this.clave, JSON.stringify(stars));
  }

  estrellasDe(i) {
    return this.obtenerTodas()[i] || 0;
  }

  // Solo guarda si mejora el récord de ese nivel.
  guardarEstrellas(i, stars) {
    const all = this.obtenerTodas();
    if (stars > (all[i] || 0)) { all[i] = stars; this.guardarTodas(all); }
  }

  // El primer nivel siempre está abierto; el resto, con al menos 1 estrella en el anterior.
  estaDesbloqueado(i) {
    if (i === 0) return true;
    return this.estrellasDe(i - 1) >= 1;
  }
}
