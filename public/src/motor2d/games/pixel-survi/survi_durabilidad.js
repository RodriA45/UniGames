// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_durabilidad.js
//
//   Clase Desgaste: cuánto se gastó cada herramienta / armadura de un
//   contenedor (el inventario, el equipo puesto o un cofre).
//
//   El inventario guarda los ítems como { id: cantidad }, así que el
//   desgaste también va por TIPO de ítem: lo que se guarda es cuánto se
//   gastó la unidad "en uso" de ese tipo. Si tenés 2 picos iguales, se gasta
//   uno; cuando se rompe, el contador vuelve a 0 y seguís con el otro (nuevo).
//
//   La durabilidad máxima de cada ítem sale de SurviConfig.ITEM_INFO[id].durabilidad
//   (herramientas y armaduras). Lo que no la tiene (bloques, comida, mochilas)
//   no se gasta nunca.
// ══════════════════════════════════════════════════════════════

import { SurviConfig } from './survi_config.js';

export class Desgaste {
  #gastado = {}; // id → usos gastados de la unidad en uso

  static max(id) {
    const info = SurviConfig.ITEM_INFO[id];
    return info && info.durabilidad ? info.durabilidad : 0;
  }

  static tieneDurabilidad(id) {
    return Desgaste.max(id) > 0;
  }

  gastado(id) {
    return this.#gastado[id] || 0;
  }

  restante(id) {
    return Math.max(0, Desgaste.max(id) - this.gastado(id));
  }

  // 1 = nuevo, 0 = roto. null si el ítem no tiene durabilidad.
  fraccion(id) {
    const max = Desgaste.max(id);
    return max ? this.restante(id) / max : null;
  }

  // Suma `n` usos. Devuelve true si la unidad se rompió: en ese caso el
  // contador vuelve a 0 (la próxima unidad del mismo tipo está nueva) y el
  // que llama saca 1 del contenedor.
  gastar(id, n = 1) {
    const max = Desgaste.max(id);
    if (!max) return false;
    const total = this.gastado(id) + n;
    if (total >= max) {
      delete this.#gastado[id];
      return true;
    }
    this.#gastado[id] = total;
    return false;
  }

  // Saca el desgaste de un tipo (cuando el ítem se va de este contenedor).
  tomar(id) {
    const g = this.gastado(id);
    delete this.#gastado[id];
    return g;
  }

  // Recibe el desgaste de un ítem que llega. Si ya había uno gastado del
  // mismo tipo, queda el mayor (se sigue usando el más gastado).
  poner(id, gastado) {
    if (!gastado) return;
    this.#gastado[id] = Math.max(this.gastado(id), gastado);
  }

  // El tipo ya no está en el contenedor.
  olvidar(id) {
    delete this.#gastado[id];
  }

  // Pasa el desgaste de `id` de este contenedor a otro.
  moverA(otro, id) {
    otro.poner(id, this.tomar(id));
  }

  toJSON() {
    return { ...this.#gastado };
  }

  static desde(obj) {
    const d = new Desgaste();
    if (obj && typeof obj === 'object') {
      for (const [id, g] of Object.entries(obj)) if (Number.isFinite(g) && g > 0) d.#gastado[id] = g;
    }
    return d;
  }
}
