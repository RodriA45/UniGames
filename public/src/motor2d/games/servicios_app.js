// ══════════════════════════════════════════════════════════════
//   UniGames — servicios_app.js  (módulo ES6, lo usan Runner, Castle y RPG)
// ══════════════════════════════════════════════════════════════
// Clase ServiciosApp: lo que los juegos necesitan del sitio (música,
// volumen, puntajes, duelos, navegación) en UN solo objeto.
//
// Antes cada juego llamaba directo a funciones globales de app2.js
// (setMusic, bgMusic, guardarPuntaje, goTo, …), con `typeof x === 'function'`
// desparramados por todos lados. Ahora:
//   - Esta es la ÚNICA clase que conoce esos globals.
//   - Cada *_main.js crea una instancia y se la pasa al juego por
//     constructor (inyección de dependencias): new PixelRunner(servicios).
//   - Los juegos solo hablan con this.servicios, sin saber que existe app2.
// Así, para probar un juego aislado alcanza con pasarle un objeto con los
// mismos métodos (un "doble" de prueba) en vez del sitio entero.
//
// Si una función no está (el juego se carga fuera del sitio, o app2.js
// todavía no terminó de arrancar), el método no hace nada en vez de romper.
export class ServiciosApp {
  // Busca un global de app2.js (los publica App.exponerGlobales en window).
  #global(nombre) {
    return globalThis[nombre];
  }

  #llamar(nombre, ...args) {
    const fn = this.#global(nombre);
    return typeof fn === 'function' ? fn(...args) : undefined;
  }

  #musica() {
    return this.#global('bgMusic') || null;
  }

  // ─── Música ───
  // reiniciar: true arranca el tema desde 0 aunque ya esté sonando.
  ponerMusica(src, reiniciar) {
    this.#llamar('setMusic', src, reiniciar);
  }

  pausarMusica() {
    const m = this.#musica();
    if (m) m.pause();
  }

  alternarSilencioMusica() {
    const m = this.#musica();
    if (m) m.muted = !m.muted;
  }

  // Duración del tema actual en ms, o fallbackMs si todavía no cargó.
  duracionMusicaMs(fallbackMs) {
    const m = this.#musica();
    return m && isFinite(m.duration) && m.duration > 0 ? m.duration * 1000 : fallbackMs;
  }

  // ─── Volumen (0..1, compartido por todo el sitio) ───
  volumenMusica() {
    const v = this.#llamar('getGlobalMusicVolume');
    return typeof v === 'number' ? v : 0.5;
  }

  setVolumenMusica(v) {
    this.#llamar('setGlobalMusicVolume', v);
  }

  volumenSfx() {
    const v = this.#llamar('getGlobalSfxVolume');
    return typeof v === 'number' ? v : 0.8;
  }

  setVolumenSfx(v) {
    this.#llamar('setGlobalSfxVolume', v);
  }

  sonidoMuerte() {
    this.#llamar('playDeathSound');
  }

  // ─── Puntajes y duelos ───
  guardarPuntaje(juegoId, puntos, tematicaId = null) {
    this.#llamar('guardarPuntaje', juegoId, puntos, tematicaId);
  }

  // Duelo en curso ({ id, juego }) o null.
  dueloActivo() {
    return this.#global('dueloActivo') || null;
  }

  finalizarDuelo(dueloId, puntos) {
    this.#llamar('finalizarDueloConPuntaje', dueloId, puntos);
  }

  // ─── Navegación del sitio ───
  irASeccion(nombre) {
    this.#llamar('goTo', nombre);
  }

  // Paneles del menú de Pixel Runner (Mejoras/Ajustes/Cómo jugar), que
  // viven en app2.js.
  cerrarPanelesRunner() {
    this.#llamar('cerrarPanelesRunner');
  }

  // ─── Guardado por usuario ───
  // Id del usuario logueado (string) o null si se juega como invitado.
  usuarioId() {
    const u = this.#global('currentUser');
    return u && u.id != null ? String(u.id) : null;
  }

  // Claves de localStorage ya migradas en esta sesión (ver claveUsuario).
  #migradas = new Set();

  // Convierte una clave de localStorage de un juego en la del usuario
  // actual: 'pixelRunnerCoins' → 'pixelRunnerCoins@u15'. Así, en una PC
  // compartida, cada cuenta tiene sus propias monedas, mejoras, niveles y
  // partidas. Se calcula en cada acceso (no al crear el juego), porque se
  // puede cerrar sesión y entrar con otra cuenta sin recargar la página.
  //
  // Invitado (sin sesión): la clave base, como antes.
  //
  // Migración: el progreso que ya existía (guardado sin usuario) pasa a la
  // PRIMERA cuenta que lo lee, si esa cuenta todavía no tiene nada propio.
  // Se MUEVE (no se copia) para que otra cuenta no reciba lo mismo otra vez.
  // Lo mismo pasa si jugás como invitado y después iniciás sesión.
  claveUsuario(base) {
    const id = this.usuarioId();
    if (!id) return base;
    const clave = base + '@u' + id;
    if (!this.#migradas.has(clave)) {
      this.#migradas.add(clave);
      try {
        if (localStorage.getItem(clave) === null) {
          const previo = localStorage.getItem(base);
          if (previo !== null) {
            localStorage.setItem(clave, previo);
            localStorage.removeItem(base);
          }
        }
      } catch {
        /* localStorage bloqueado: se usa la clave igual */
      }
    }
    return clave;
  }
}
