// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_tactil.js
//
//   Controles para celular y tablet (en PC no se crean):
//     • Zona izquierda  → joystick flotante para caminar: tocás en cualquier
//                         lugar de la zona y el joystick aparece ahí.
//                         Empujado hacia arriba (recto o en diagonal) salta.
//     • Zona derecha    → joystick flotante de la mira: la mueve dentro del
//                         círculo de alcance del personaje (el mismo que en
//                         PC) y, mientras está empujado, pega / rompe / dispara.
//                         Es relativa: al volver a tocar, la mira sigue desde
//                         donde quedó (no salta al centro).
//     • Botón chico     → (a la derecha de la hotbar) colocar bloque /
//                         interactuar (mesa, horno, cofre), comer, usar el
//                         cubo. Mantenerlo apretado coloca seguido.
//     • Botón de zoom   → Normal → Cerca → Lejos (como la tecla Z).
//
//   Clases:
//     Joystick           → un joystick flotante dentro de una zona del DOM
//                          (pointer events): da un vector (x, y) entre -1 y 1.
//     ControlesTactiles  → arma los controles y los conecta al juego.
// ══════════════════════════════════════════════════════════════

export class Joystick {
  static ZONA_MUERTA = 0.18; // empujes más chicos que esto no cuentan

  #zona;
  #base;
  #palanca;
  #puntero = null; // pointerId del dedo que lo maneja
  #centro = null; // { x, y } en px de pantalla: donde apareció el joystick
  #alMover;
  #alEmpezar;

  // zona: el área donde se puede tocar (.survi-zona). Adentro está la base
  // (.survi-stick); en reposo se ve en su lugar de siempre, apagada.
  // alMover(x, y, activo) se llama en cada cambio; alEmpezar() al apoyar el dedo.
  constructor(zona, alMover, alEmpezar = null) {
    this.#alEmpezar = alEmpezar;
    this.#zona = zona;
    this.#base = zona.querySelector('.survi-stick');
    this.#palanca = zona.querySelector('.survi-stick-palanca');
    this.#alMover = alMover;
    this.x = 0;
    this.y = 0;
    zona.addEventListener('pointerdown', (e) => this.#empezar(e));
    zona.addEventListener('pointermove', (e) => this.#mover(e));
    zona.addEventListener('pointerup', (e) => this.#soltar(e));
    zona.addEventListener('pointercancel', (e) => this.#soltar(e));
    zona.addEventListener('lostpointercapture', (e) => this.#soltar(e));
  }

  get activo() {
    return Math.hypot(this.x, this.y) > Joystick.ZONA_MUERTA;
  }

  #empezar(e) {
    if (this.#puntero !== null) return;
    e.preventDefault();
    this.#puntero = e.pointerId;
    try {
      this.#zona.setPointerCapture(e.pointerId);
    } catch {
      /* sin captura: igual funciona mientras el dedo siga encima */
    }
    // El joystick aparece centrado en el dedo, sin salirse de la zona.
    const z = this.#zona.getBoundingClientRect();
    const r = this.#base.offsetWidth / 2;
    const cx = Math.max(z.left + r, Math.min(z.right - r, e.clientX));
    const cy = Math.max(z.top + r, Math.min(z.bottom - r, e.clientY));
    this.#centro = { x: cx, y: cy, r: r || 1 };
    Object.assign(this.#base.style, {
      left: `${cx - z.left - r}px`,
      top: `${cy - z.top - r}px`,
      right: 'auto',
      bottom: 'auto',
    });
    this.#base.classList.add('activo');
    if (this.#alEmpezar) this.#alEmpezar();
    this.#mover(e);
  }

  #mover(e) {
    if (e.pointerId !== this.#puntero || !this.#centro) return;
    e.preventDefault();
    const { x: cx, y: cy, r } = this.#centro;
    let x = (e.clientX - cx) / r;
    let y = (e.clientY - cy) / r;
    const largo = Math.hypot(x, y);
    if (largo > 1) {
      x /= largo;
      y /= largo;
    }
    this.#fijar(x, y);
  }

  #soltar(e) {
    if (e.pointerId !== this.#puntero) return;
    this.#puntero = null;
    this.#centro = null;
    this.#base.classList.remove('activo');
    // vuelve a su lugar de reposo (el del CSS)
    this.#base.style.left = this.#base.style.top = this.#base.style.right = this.#base.style.bottom = '';
    this.#fijar(0, 0);
  }

  #fijar(x, y) {
    this.x = x;
    this.y = y;
    // la palanca se mueve hasta el borde de la base (40% del ancho)
    this.#palanca.style.transform = `translate(calc(-50% + ${x * 40}%), calc(-50% + ${y * 40}%))`;
    this.#alMover(x, y, this.activo);
  }
}

export class ControlesTactiles {
  // ¿Celular o tablet? Pantalla táctil y puntero "grueso" (el dedo). Una PC
  // con pantalla táctil pero con mouse (pointer: fine) no cuenta.
  static esDispositivoTactil() {
    const grueso = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const tactil = (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || 'ontouchstart' in globalThis;
    return !!(grueso && tactil);
  }

  // ui: SurviUI (tiene los elementos), juego: SurviGame.
  constructor(ui, juego) {
    this.juego = juego;
    this.mover = new Joystick(ui.zonaMover, (x, y) => juego.moverTactil(x, y));
    // la mira es RELATIVA: cada toque nuevo sigue desde donde quedó
    this.mira = new Joystick(
      ui.zonaMira,
      (x, y, activo) => juego.apuntarTactil(x, y, activo),
      () => juego.empezarMiraTactil(),
    );
    // colocar / interactuar: mantener apretado coloca seguido
    const b = ui.btnColocar;
    const soltar = (e) => {
      e.preventDefault();
      b.classList.remove('activo');
      juego.colocarTactil(false);
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.classList.add('activo');
      juego.colocarTactil(true);
    });
    b.addEventListener('pointerup', soltar);
    b.addEventListener('pointercancel', soltar);
    b.addEventListener('pointerleave', soltar);
    ui.btnZoom.addEventListener('click', (e) => {
      e.preventDefault();
      juego.cambiarZoom();
    });
  }
}
