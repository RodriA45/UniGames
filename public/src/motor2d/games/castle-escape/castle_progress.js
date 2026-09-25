// ══════════════════════════════════════
//   Castle Escape — castle_progress.js  (módulo ES6, sin dependencias)
// ══════════════════════════════════════

export class Progreso {
  // claveUsuario: función que convierte la clave base en la del usuario
  // actual (ServiciosApp.claveUsuario). Por defecto, la misma clave.
  constructor(clave = 'trampasStars', claveUsuario = (base) => base) {
    this.clave = clave;
    this.claveUsuario = claveUsuario;
  }

  // Se calcula en cada acceso: si se cambia de cuenta, se leen sus estrellas.
  get claveActual() {
    return this.claveUsuario(this.clave);
  }

  // { indiceNivel: estrellas }
  obtenerTodas() {
    try { return JSON.parse(localStorage.getItem(this.claveActual)) || {}; }
    catch { return {}; }
  }

  guardarTodas(stars) {
    localStorage.setItem(this.claveActual, JSON.stringify(stars));
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
