// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_main.js   (punto de entrada del módulo)
//
//   Clase SurviApp: arma la UI, el gestor de guardado y el juego, y
//   conecta los botones del menú (mundos, modo, ajustes, pausa…).
//   Hay UNA sola instancia (app), que se crea la primera vez que se entra
//   a la sección.
//
//   app2.js lo carga con lazy loading:
//     ensureSurviLoaded().then(() => initSurvi());
//
//   Expone initSurvi() / stopSurvi() también en window, igual que hacen
//   rpg_main.js y runner_main.js, para que goTo() los pueda llamar sin
//   importar nada.
// ══════════════════════════════════════════════════════════════

import { ServiciosApp } from '../servicios_app.js';
import { SurviGame } from './survi_game.js';
import { GestorGuardado } from './survi_save.js';
import { SurviUI } from './survi_ui.js';

export class SurviApp {
  static ROOT_ID = 'survi-root';
  constructor(root) {
    // Composición: la app crea las piezas y se las pasa al juego.
    this.ui = new SurviUI(root);
    this.servicios = new ServiciosApp();
    // Mundos por usuario (ver ServiciosApp.claveUsuario).
    this.guardado = new GestorGuardado((base) => this.servicios.claveUsuario(base));
    this.game = new SurviGame(this.ui, this.guardado);
    this.pickedSlot = null; // { slot, exists, mode, ... } elegido en la lista
    this.settingsFrom = 'cover'; // a qué pantalla vuelve el botón Volver de Ajustes
    this.qualityRowAdded = false;
    this.wireActions();
    this.wireSettings();
  }

  // ─── Entrada: al entrar (o volver) a la sección siempre se arranca desde
  // el menú. La partida anterior ya quedó guardada por detener(). ───
  mostrarPortada() {
    this.ui.showScreen('cover');
  }

  // ─── Salida: app2.js la llama al navegar a otra sección para que no
  // quede el requestAnimationFrame corriendo de fondo. ───
  detener() {
    if (this.game.running) this.game.stop(); // stop() guarda antes de cortar
  }

  // ═══════════ Cableado de botones ═══════════
  wireActions() {
    const ui = this.ui,
      game = this.game;
    ui.root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn || !ui.root.contains(btn)) return;
      const act = btn.dataset.act;
      switch (act) {
        // ── menú principal ──
        case 'play':
          this.openWorlds();
          break;
        case 'howto':
          ui.showScreen('howto');
          break;
        case 'settings':
          this.settingsFrom = game.running && !game.dead ? 'pause' : 'cover';
          ui.showScreen('settings');
          break;
        case 'autosalto':
          game.autoSalto = !game.autoSalto;
          ui.mostrarAutoSalto(game.autoSalto);
          break;
        case 'settings-back':
          ui.showScreen(this.settingsFrom);
          break;
        case 'back-cover':
          ui.showScreen('cover');
          break;
        case 'back-worlds':
          this.openWorlds();
          break;
        // ── modo ──
        case 'mode-normal':
          this.startWorld('normal');
          break;
        case 'mode-hardcore':
          this.startWorld('hardcore');
          break;
        // ── en partida ──
        case 'fullscreen':
          if (typeof Engine2D !== 'undefined') Engine2D.Fullscreen.toggle(ui.root);
          break;
        case 'resume':
          game.setPaused(false);
          break;
        case 'save':
          SurviApp.flashBtn(btn, game.save() ? 'Guardado ✓' : 'No se pudo guardar');
          break;
        case 'close-inv':
          game.toggleInventory(false);
          break;
        case 'open-equip':
          ui.renderEquip(game);
          ui.showScreen('equip');
          break;
        case 'equip-back':
          ui.showScreen('inv');
          ui.renderInventory(game); // el cupo pudo cambiar (equipaste/desequipaste una mochila)
          break;
        case 'open-craft':
          ui.renderCraft(game);
          ui.showScreen('craft');
          break;
        case 'craft-back':
          // desde la mesa de crafteo, Volver cierra y vuelve al juego
          if (game.craftStation === 'table') {
            game.closeStation();
            break;
          }
          ui.showScreen('inv');
          ui.renderInventory(game);
          break;
        case 'station-close':
          game.closeStation();
          break;
        case 'respawn':
          game.respawn();
          break;
        case 'to-menu':
          game.stop();
          ui.showScreen('cover');
          break;
      }
    });
  }

  static flashBtn(btn, text) {
    const original = btn.dataset.label || btn.textContent;
    btn.dataset.label = original;
    btn.textContent = text;
    setTimeout(() => {
      btn.textContent = original;
    }, 900);
  }

  // ═══════════ Mundos ═══════════
  openWorlds() {
    this.ui.renderWorlds(this.guardado.listarSlots(), {
      // Mundo ya creado: se continúa directo en su modo (ya lo elegiste al
      // crearlo). Solo un espacio vacío pregunta normal / hardcore.
      onPick: (s) => {
        if (s.exists) {
          this.pickedSlot = s;
          this.startWorld(s.mode === 'hardcore' ? 'hardcore' : 'normal');
        } else this.openMode(s);
      },
      onDelete: (s) => {
        if (confirm(`¿Borrar el Mundo ${s.slot}? No se puede recuperar.`)) {
          this.guardado.borrarMundo(s.slot);
          this.openWorlds();
        }
      },
    });
    this.ui.showScreen('worlds');
  }

  // Solo para espacios vacíos: un mundo que ya existe se continúa directo en
  // su modo (ver onPick en openWorlds), así que acá no hay partida que avisar.
  openMode(slotInfo) {
    this.pickedSlot = slotInfo;
    this.ui.modeTitle.textContent = `Mundo ${slotInfo.slot}`;
    const sub = this.ui.screens.mode.querySelector('.modal-game-sub');
    sub.textContent = 'Mundo vacío: se genera uno nuevo con aparición al azar en la superficie.';
    this.ui.showScreen('mode');
  }

  async startWorld(mode) {
    const info = this.pickedSlot;
    if (!info) return;
    // Mundo existente: se carga (siempre en su propio modo, ver onPick).
    // Si la meta existe pero los datos no se pueden leer, se avisa en vez de
    // generar uno nuevo en silencio que después pisaría el guardado.
    let save = null;
    if (info.exists) {
      save = this.guardado.cargarMundo(info.slot);
      if (!save) {
        alert(
          `No se pudo leer el Mundo ${info.slot}: los datos guardados están dañados. Podés borrarlo desde la lista.`,
        );
        this.openWorlds();
        return;
      }
    }
    this.ui.showScreen(null);
    await this.game.start({
      slot: info.slot,
      mode,
      save,
    });
  }

  // ═══════════ Ajustes ═══════════
  wireSettings() {
    const ui = this.ui;
    ui.mostrarAutoSalto(this.game.autoSalto);
    const E = typeof Engine2D !== 'undefined' ? Engine2D : null;
    // Música y efectos salen del mixer del motor (Engine2D.Audio), que ya
    // persiste los volúmenes en localStorage — no hace falta guardarlos acá.
    const setVal = (el, v) => {
      el.textContent = Math.round(v * 100) + '%';
    };
    if (E && E.Audio) {
      ui.musicRange.value = Math.round(E.Audio.getMusicVolume() * 100);
      ui.sfxRange.value = Math.round(E.Audio.getSfxVolume() * 100);
      setVal(ui.musicVal, E.Audio.getMusicVolume());
      setVal(ui.sfxVal, E.Audio.getSfxVolume());
      ui.musicRange.addEventListener('input', () => {
        const v = Number(ui.musicRange.value) / 100;
        E.Audio.setMusicVolume(v);
        setVal(ui.musicVal, v);
      });
      ui.sfxRange.addEventListener('input', () => {
        const v = Number(ui.sfxRange.value) / 100;
        E.Audio.setSfxVolume(v);
        setVal(ui.sfxVal, v);
      });
    }
    // Gráficos: la fila Bajo/Medio/Alto la arma el propio motor y se
    // sincroniza sola con Engine2D.Quality (es UNA preferencia global para
    // todos los juegos del sitio).
    if (E && E.Quality && !this.qualityRowAdded) {
      ui.qualitySlot.appendChild(
        E.Quality.createRow({
          label: '🖼️ Gráficos',
        }),
      );
      this.qualityRowAdded = true;
    }
    // Pantalla completa: si el navegador no lo soporta, se oculta la fila.
    if (E && E.Fullscreen && !E.Fullscreen.isSupported()) {
      ui.root.querySelector('.survi-fullscreen-row').classList.add('hidden');
    }
  }

  // ─── Instancia única + entrada/salida que llama app2.js ───
  // Se crea la primera vez que se entra a la sección y se reusa después.
  static #app = null;

  static get actual() {
    return SurviApp.#app;
  }

  static iniciar() {
    const root = document.getElementById(SurviApp.ROOT_ID);
    if (!root) {
      console.warn(`[pixel-survi] falta <div id="${SurviApp.ROOT_ID}"> en la sección.`);
      return;
    }
    if (!SurviApp.#app) SurviApp.#app = new SurviApp(root);
    SurviApp.#app.mostrarPortada();
  }

  static salir() {
    if (SurviApp.#app) SurviApp.#app.detener();
  }
}

// ─── Globals para app2.js (mismo patrón que rpgInit / showRunnerMenu) ───
export const initSurvi = SurviApp.iniciar;
export const stopSurvi = SurviApp.salir;
globalThis.initSurvi = initSurvi;
globalThis.stopSurvi = stopSurvi;

export default { initSurvi, stopSurvi };
