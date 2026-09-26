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
import { ControlesTactiles } from './survi_tactil.js';
import { SurviGame } from './survi_game.js';
import { GestorGuardado } from './survi_save.js';
import { SurviUI } from './survi_ui.js';

export class SurviApp {
  static ROOT_ID = 'survi-root';
  constructor(root) {
    // Composición: la app crea las piezas y se las pasa al juego.
    // Celular / tablet: joysticks (en PC no se crean, ver survi_tactil.js).
    // La pantalla completa es opcional, desde Ajustes, en los dos.
    this.movil = ControlesTactiles.esDispositivoTactil();
    this.ui = new SurviUI(root, { movil: this.movil });
    this.servicios = new ServiciosApp();
    // Mundos por usuario (ver ServiciosApp.claveUsuario).
    this.guardado = new GestorGuardado((base) => this.servicios.claveUsuario(base));
    this.game = new SurviGame(this.ui, this.guardado, { movil: this.movil });
    this.tactil = this.movil ? new ControlesTactiles(this.ui, this.game) : null;
    this.pickedSlot = null; // { slot, exists, mode, ... } elegido en la lista
    this.settingsFrom = 'cover'; // a qué pantalla vuelve el botón Volver de Ajustes
    this.qualityRowAdded = false;
    this.fsReal = false; // true si se entró con la Fullscreen API (no el modo CSS de iPhone)
    this.wireActions();
    this.wireSettings();
    this.#escucharPantallaCompleta();
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
    this.salirPantallaCompleta(); // que no quede tapando el resto del sitio
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
        case 'salir':
          // (pantalla completa) el juego tapa todo: este botón vuelve al sitio
          this.salirPantallaCompleta();
          this.servicios.irASeccion('juegos');
          break;
        case 'back-cover':
          ui.showScreen('cover');
          break;
        case 'back-worlds':
          this.openWorlds();
          break;
        // ── crear mundo ──
        case 'crear-mundo':
          this.crearMundo();
          break;
        // ── creativo / espectador ──
        case 'volar':
          game.alternarVuelo();
          break;
        case 'espectador':
          game.alternarEspectador();
          break;
        case 'open-catalogo':
          ui.renderCatalogo(game);
          ui.showScreen('catalogo');
          break;
        case 'catalogo-back':
          ui.showScreen('inv');
          ui.renderInventory(game);
          break;
        case 'vaciar-inv':
          if (confirm('¿Vaciar todo el inventario?')) game.vaciarInventario();
          break;
        case 'espectar':
          game.verComoEspectador();
          break;
        // ── en partida ──
        case 'fullscreen':
          this.alternarPantallaCompleta();
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

  // ═══════════ Pantalla completa (opcional, desde Ajustes) ═══════════
  // Por defecto se juega dentro de la sección, como el RPG. Al activarla:
  //   • la clase .survi-fs hace que el juego tape toda la pantalla (ver CSS)
  //     y el juego ensancha la vista (ver SurviGame._fit);
  //   • si el navegador tiene la Fullscreen API se pide también (se van las
  //     barras del navegador) y en celular se traba en horizontal.
  // En iPhone no hay Fullscreen API: queda solo la clase, y en vertical el
  // juego pide girarlo.
  get pantallaCompleta() {
    return this.ui.root.classList.contains('survi-fs');
  }

  static elementoFs() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  alternarPantallaCompleta() {
    if (this.pantallaCompleta) this.salirPantallaCompleta();
    else this.entrarPantallaCompleta();
  }

  // Tiene que llamarse dentro del toque/clic del jugador (el navegador no
  // deja pedir pantalla completa sin un gesto).
  entrarPantallaCompleta() {
    this.#fijarPantallaCompleta(true);
    const el = this.ui.root;
    const pedir = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!pedir || SurviApp.elementoFs()) return;
    try {
      const p = pedir.call(el, { navigationUI: 'hide' });
      const alEntrar = () => {
        this.fsReal = true;
        try {
          if (this.movil && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
        } catch {
          /* sin bloqueo de orientación: se gira a mano */
        }
      };
      if (p && p.then) p.then(alEntrar).catch(() => {});
      else alEntrar();
    } catch {
      /* sin Fullscreen API: queda el modo CSS */
    }
  }

  salirPantallaCompleta() {
    if (!this.pantallaCompleta && !SurviApp.elementoFs()) return;
    this.#fijarPantallaCompleta(false);
    this.fsReal = false;
    try {
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } catch {}
    try {
      if (SurviApp.elementoFs()) {
        const salir = document.exitFullscreen || document.webkitExitFullscreen;
        const p = salir && salir.call(document);
        if (p && p.catch) p.catch(() => {});
      }
    } catch {}
  }

  #fijarPantallaCompleta(activa) {
    this.ui.root.classList.toggle('survi-fs', activa);
    document.documentElement.classList.toggle('survi-fs-abierto', activa); // sin scroll de la página atrás
    this.ui.mostrarPantallaCompleta(activa);
    // el contenedor cambió de tamaño: vista y canvas de nuevo (al frame siguiente, ya con el CSS aplicado)
    requestAnimationFrame(() => this.game._fit());
  }

  // Si se sale con Esc o con el botón "atrás" del celular, se vuelve a la sección.
  #escucharPantallaCompleta() {
    const alCambiar = () => {
      if (this.fsReal && !SurviApp.elementoFs()) {
        this.fsReal = false;
        this.#fijarPantallaCompleta(false);
      }
    };
    document.addEventListener('fullscreenchange', alCambiar);
    document.addEventListener('webkitfullscreenchange', alCambiar);
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
      // Mundo ya creado: se continúa directo con lo que elegiste al crearlo.
      // Un espacio vacío abre la pantalla de "Nuevo mundo".
      onPick: (s) => {
        if (s.exists) {
          this.pickedSlot = s;
          this.startWorld();
        } else this.openCrear(s);
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

  // ═══════════ Nuevo mundo ═══════════
  // Pantalla dentro del juego: nombre, modo (supervivencia / creativo) y
  // dificultad (fácil / normal / difícil / hardcore). Solo para espacios vacíos.
  openCrear(slotInfo) {
    this.pickedSlot = slotInfo;
    this.eleccion = { modo: 'supervivencia', dificultad: 'normal' };
    const ui = this.ui;
    ui.crearNombre.value = `Mundo ${slotInfo.slot}`;
    if (!this.crearCableado) {
      this.crearCableado = true;
      ui.screens.crear.addEventListener('click', (e) => {
        const m = e.target.closest('[data-modo]'), d = e.target.closest('[data-dif]');
        if (m) this.eleccion.modo = m.dataset.modo;
        else if (d && !d.disabled) this.eleccion.dificultad = d.dataset.dif;
        else return;
        ui.mostrarCrear(this.eleccion);
      });
      // Enter en el nombre = crear
      ui.crearNombre.addEventListener('keydown', (e) => {
        e.stopPropagation(); // que las teclas no las agarre el juego
        if (e.key === 'Enter') this.crearMundo();
      });
    }
    ui.mostrarCrear(this.eleccion);
    ui.showScreen('crear');
    // en PC, listo para escribir (en celular no, para que no salte el teclado)
    if (!this.movil) setTimeout(() => ui.crearNombre.select(), 50);
  }

  crearMundo() {
    const info = this.pickedSlot;
    if (!info || info.exists) return;
    const nombre = this.ui.crearNombre.value.trim().slice(0, 24) || `Mundo ${info.slot}`;
    const { modo, dificultad } = this.eleccion;
    this.startWorld({ nombre, modo, dificultad: modo === 'creativo' ? 'normal' : dificultad });
  }

  // nuevo: { nombre, modo, dificultad } si se está creando; si no, se carga
  // el mundo guardado con lo que tenía.
  async startWorld(nuevo = null) {
    const info = this.pickedSlot;
    if (!info) return;
    // Mundo existente: se carga. Si la meta existe pero los datos no se
    // pueden leer, se avisa en vez de generar uno nuevo en silencio que
    // después pisaría el guardado.
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
      save,
      nombre: save ? info.nombre : nuevo.nombre,
      modo: save ? info.modo : nuevo.modo,
      dificultad: save ? info.dificultad : nuevo.dificultad,
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
    // Pantalla completa: la fila se muestra siempre (sin Fullscreen API, como
    // en iPhone, igual tapa toda la pantalla con CSS).
    ui.mostrarPantallaCompleta(this.pantallaCompleta);
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
