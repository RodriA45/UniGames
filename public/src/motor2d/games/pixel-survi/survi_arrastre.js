// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_arrastre.js
//
//   Clase Arrastre: arrastrar y soltar ítems (como en Minecraft), con
//   mouse o con el dedo (pointer events). No sabe nada del juego: solo
//   mira atributos del HTML y avisa qué se soltó dónde.
//
//     data-drag-id="123" data-origen="inv|hotbar" [data-slot="3"]
//         → algo que se puede agarrar
//     data-drop="inv|hotbar" [data-slot="3"]
//         → un lugar donde se puede soltar
//
//   Moverse menos de UMBRAL px cuenta como un toque (alTocar), no como un
//   arrastre: así se puede seguir tocando un ítem para usarlo.
// ══════════════════════════════════════════════════════════════

export class Arrastre {
  static UMBRAL = 5; // px

  #raiz;
  #alSoltar;
  #alTocar;
  #origen = null; // { id, origen, slot, el }
  #inicio = null; // { x, y }
  #fantasma = null; // copia del ícono que sigue al puntero
  #destacado = null; // destino que está debajo del puntero
  #mover = (e) => this.#alMover(e);
  #soltar = (e) => this.#alLevantar(e);

  // alSoltar(origen, destino): destino = { tipo, slot } o null si se soltó afuera.
  // alTocar(origen): se tocó sin arrastrar.
  constructor(raiz, { alSoltar, alTocar }) {
    this.#raiz = raiz;
    this.#alSoltar = alSoltar;
    this.#alTocar = alTocar;
    raiz.addEventListener('pointerdown', (e) => this.#alApretar(e));
  }

  get arrastrando() {
    return !!this.#fantasma;
  }

  #alApretar(e) {
    if (e.button !== undefined && e.button !== 0) return;
    // algo para agarrar, o un hueco vacío (ese solo se puede tocar, no arrastrar)
    const el = e.target.closest('[data-drag-id], [data-drop][data-slot]');
    if (!el || !this.#raiz.contains(el)) return;
    e.preventDefault(); // que no seleccione texto ni haga scroll
    this.#origen = {
      id: el.dataset.dragId !== undefined ? Number(el.dataset.dragId) : null,
      origen: el.dataset.origen || el.dataset.drop,
      slot: el.dataset.slot !== undefined ? Number(el.dataset.slot) : null,
      el,
    };
    this.#inicio = { x: e.clientX, y: e.clientY };
    window.addEventListener('pointermove', this.#mover);
    window.addEventListener('pointerup', this.#soltar);
    window.addEventListener('pointercancel', this.#soltar);
  }

  #alMover(e) {
    if (!this.#origen) return;
    if (!this.#fantasma) {
      if (this.#origen.id === null) return; // un hueco vacío no se arrastra
      if (Math.hypot(e.clientX - this.#inicio.x, e.clientY - this.#inicio.y) < Arrastre.UMBRAL) return;
      this.#empezar();
    }
    this.#fantasma.style.left = `${e.clientX}px`;
    this.#fantasma.style.top = `${e.clientY}px`;
    const destino = this.#destinoEn(e.clientX, e.clientY);
    const el = destino ? destino.el : null;
    if (el !== this.#destacado) {
      if (this.#destacado) this.#destacado.classList.remove('survi-drop-hover');
      if (el) el.classList.add('survi-drop-hover');
      this.#destacado = el;
    }
  }

  #empezar() {
    const icono = this.#origen.el.querySelector('.survi-slot-icon, .survi-equip-icon') || this.#origen.el;
    const f = document.createElement('div');
    f.className = 'survi-fantasma';
    f.appendChild(icono.cloneNode(true));
    document.body.appendChild(f);
    this.#fantasma = f;
    this.#origen.el.classList.add('survi-arrastrando');
  }

  #alLevantar(e) {
    window.removeEventListener('pointermove', this.#mover);
    window.removeEventListener('pointerup', this.#soltar);
    window.removeEventListener('pointercancel', this.#soltar);
    const origen = this.#origen;
    if (!origen) return;
    const arrastraba = !!this.#fantasma;
    const destino = arrastraba && e.type !== 'pointercancel' ? this.#destinoEn(e.clientX, e.clientY) : null;
    this.#limpiar();
    const datos = { id: origen.id, origen: origen.origen, slot: origen.slot };
    if (arrastraba) this.#alSoltar(datos, destino ? { tipo: destino.tipo, slot: destino.slot } : null);
    else if (e.type !== 'pointercancel') this.#alTocar(datos);
  }

  // Qué lugar de soltar hay debajo del punto (el fantasma no cuenta: no
  // recibe eventos, ver .survi-fantasma en el CSS).
  #destinoEn(x, y) {
    const el = document.elementFromPoint ? document.elementFromPoint(x, y) : null;
    const d = el && el.closest('[data-drop]');
    if (!d || !this.#raiz.contains(d)) return null;
    return { el: d, tipo: d.dataset.drop, slot: d.dataset.slot !== undefined ? Number(d.dataset.slot) : null };
  }

  #limpiar() {
    if (this.#fantasma) this.#fantasma.remove();
    if (this.#destacado) this.#destacado.classList.remove('survi-drop-hover');
    if (this.#origen) this.#origen.el.classList.remove('survi-arrastrando');
    this.#fantasma = null;
    this.#destacado = null;
    this.#origen = null;
  }
}
