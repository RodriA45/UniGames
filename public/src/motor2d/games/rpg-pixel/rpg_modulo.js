// ══════════════════════════════════════
//   RPG Pixel — rpg_modulo.js  (módulo ES6, sin dependencias)
// ══════════════════════════════════════
// Clase base abstracta de los módulos del juego. Enlaza cada método a su
// instancia para poder pasarlos como callbacks (requestAnimationFrame,
// addEventListener, onclick expuestos en window, etc.) sin perder el this.
export class RpgModulo {
  constructor() {
    if (new.target === RpgModulo) throw new Error('RpgModulo es abstracta: usá una subclase');
    let proto = Object.getPrototypeOf(this);
    while (proto && proto !== RpgModulo.prototype) {
      for (const nombre of Object.getOwnPropertyNames(proto)) {
        if (nombre === 'constructor' || Object.prototype.hasOwnProperty.call(this, nombre)) continue;
        const d = Object.getOwnPropertyDescriptor(proto, nombre);
        if (typeof d.value === 'function') this[nombre] = d.value.bind(this);
      }
      proto = Object.getPrototypeOf(proto);
    }
  }
}
