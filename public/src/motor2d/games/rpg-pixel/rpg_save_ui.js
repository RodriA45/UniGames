// ══════════════════════════════════════
//   RPG Pixel — rpg_save_ui.js  (módulo ES6)
// ══════════════════════════════════════
// Clase RpgMenu: Guardado en slots, entrada a la sección, controles táctiles y vistas del menú.
import { RpgModulo } from './rpg_modulo.js';
import { juego } from './rpg_juego.js';
import { RpgConfig } from './rpg_config.js';

export class RpgMenu extends RpgModulo {
  // ═══════════════════════════════════════════════
  //   Menú principal — Jugar / Mejoras / Ajustes / Cómo jugar
  // ═══════════════════════════════════════════════
  static MENU_VIEWS = [
    RpgConfig.EL.mainMenuView,
    RpgConfig.EL.slotsView,
    RpgConfig.EL.chaptersView,
    RpgConfig.EL.difficultyView,
    RpgConfig.EL.mejorasView,
    RpgConfig.EL.ajustesView,
    RpgConfig.EL.comoJugarView,
  ];
  constructor() {
    super();
    // Slots borrados por abandono detectado al cargarlos (ver loadSlotData).
    this.slotsPerdidos = new Set();
    document.addEventListener('fullscreenchange', this.syncFullscreenBtn);
    document.addEventListener('webkitfullscreenchange', this.syncFullscreenBtn);
  }

  // Partidas por usuario (ver ServiciosApp.claveUsuario).
  slotKey(n) {
    return juego.servicios.claveUsuario(RpgConfig.SAVE_KEY_PREFIX + n);
  }

  newSaveData() {
    return {
      chapterUnlocked: 1,
      chaptersCompleted: [],
      difficulty: 'normal',
      updatedAt: null,
      // true desde que arranca un capítulo hasta que se completa. Si al
      // cargar el slot sigue en true, el jugador salió en medio (F5, cerrar
      // la pestaña, cambiar de sección) → cuenta como abandonar.
      runActiva: false,
      // Mejoras de cofres guardadas al completar un capítulo, para seguir
      // con ellas en el siguiente aunque se vuelva al menú en el medio:
      // { chapter: capítulo en el que se aplican, upgrades: {...} } o null.
      runUpgrades: null,
    };
  }

  loadSlotData(n) {
    try {
      const raw = localStorage.getItem(this.slotKey(n));
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      // Blindaje por si el shape cambia en el futuro.
      if (!Array.isArray(data.chaptersCompleted)) data.chaptersCompleted = [];
      if (!Number.isFinite(data.chapterUnlocked)) data.chapterUnlocked = 1;
      // Saves viejos (previos a agregar dificultad) caen en 'normal'.
      if (data.difficulty !== 'normal' && data.difficulty !== 'elite') data.difficulty = 'normal';
      // Muerte permanente: quedó un capítulo a medias sin terminar ni
      // abandonar por el menú (recargó la página, cerró la pestaña o cambió
      // de sección). Se trata igual que abandonar: se borra la partida.
      if (data.runActiva === true) {
        this.deleteSlotData(n);
        this.slotsPerdidos.add(n); // para avisarlo en la lista de partidas
        return null;
      }
      if (!data.runUpgrades || typeof data.runUpgrades !== 'object') data.runUpgrades = null;
      return data;
    } catch {
      return null;
    }
  }

  saveSlotData(n, data) {
    try {
      localStorage.setItem(this.slotKey(n), JSON.stringify(data));
    } catch {}
  }

  deleteSlotData(n) {
    try {
      localStorage.removeItem(this.slotKey(n));
    } catch {}
  }

  // ─── Borrado de la partida activa (perder o salir en medio de una
  //     habitación) ─────
  // A diferencia de rpgDeleteSlotConfirm (borrado manual desde la lista de
  // partidas), esto lo dispara el propio juego: si morís o abandonás el
  // intento antes de completar el capítulo, se pierde todo el progreso
  // guardado en ese slot (capítulos desbloqueados/completados), no solo el
  // intento actual. rpgCompleteChapter ya guardó lo que corresponde antes
  // de volver al menú, así que esa pantalla NUNCA pasa por acá.
  eraseActiveSlot() {
    if (!juego.activeSlot) return;
    this.deleteSlotData(juego.activeSlot);
    juego.save = null;
  }

  // Se llama desde los puntos de salida "manuales" (pausa, botón de volver
  // a Juegos) para decidir si esa salida cuenta como abandonar el intento:
  // solo si hay un capítulo en curso (save.runActiva). Antes se deducía de
  // si el menú del RPG estaba oculto, y eso también era cierto en el cartel
  // de "¡Capítulo superado!": salir a Juegos desde ahí borraba la partida.
  abandonRunIfActive() {
    if (juego.save && juego.save.runActiva) this.eraseActiveSlot();
  }

  // Marca/desmarca el capítulo en curso y lo persiste al toque (tiene que
  // estar guardado ANTES de que el jugador pueda recargar la página).
  setRunActiva(activa) {
    if (!juego.activeSlot || !juego.save) return;
    juego.save.runActiva = !!activa;
    juego.save.updatedAt = Date.now();
    this.saveSlotData(juego.activeSlot, juego.save);
  }

  // ─── Entrada a la sección (llamado desde goTo en app.js) ─────
  init() {
    juego.canvas = RpgConfig.EL.canvas;
    juego.ctx = juego.canvas.getContext('2d');
    // Look retro nítido: sin esto, drawImage suaviza (bilinear) los sprites
    // al reducirlos al canvas interno de 480x270, y ese resultado ya borroso
    // se vuelve a escalar hacia arriba en bloques por el `image-rendering:
    // pixelated` de rpg.css — la mezcla se ve fea (borroso + bloques). Con
    // el suavizado apagado, el downscale usa vecino más cercano y queda
    // consistente con el upscale del CSS: pixel art prolijo de punta a punta.
    juego.ctx.imageSmoothingEnabled = false;
    this.setupTouchControls();
    juego.partida.stopLoop();
    this.showMenu();
  }

  // ─── Entradas: joystick + botones táctiles DENTRO del canvas ─────
  // Usa Engine2D.TouchControls (engine2d.js) en vez de los botones HTML de
  // abajo (como Pixel Runner): joystick analógico de movimiento a la
  // izquierda, y disparar/bloquear/interactuar como botones redondos a la
  // derecha, todo dibujado encima de la escena (ver el final de rpgDraw).
  // En desktop con mouse/trackpad (mismo criterio que el media query de
  // `.rpg-controls` en rpg.css) queda oculto: se juega con teclado.
  setupTouchControls() {
    if (typeof Engine2D === 'undefined' || !Engine2D.TouchControls) return;
    // rpgInit() se llama cada vez que se re-entra a la sección del juego
    // (ver app.js: goTo('rpg_pixel') → rpgInit()), así que sin esta guarda
    // se creaba una instancia de TouchControls nueva por cada visita SIN
    // desconectar la anterior — dejaba varios listeners de pointerdown/move/up
    // pegados al mismo canvas, uno por cada visita. El síntoma es justo el
    // reportado: los controles (y el avance de diálogo) empiezan a
    // "duplicarse" — un solo toque dispara la acción 2, 3, 4 veces según
    // cuántas veces se entró y salió del juego. Si ya está armado, no se
    // vuelve a crear nada.
    if (juego.touch) {
      this.syncTouchVisibility();
      return;
    }
    // logicalWidth/logicalHeight: el canvas real (RPG.canvas.width/height) se
    // escala por devicePixelRatio (ver rpgStartRoom) para verse nítido en
    // HiDPI, pero todas las zonas de acá abajo están pensadas en el espacio
    // lógico de siempre (480x270, RPG_LOGICAL_W/H). Sin pasarle esto al
    // motor, el hit-test compara contra el buffer ya escalado y NINGÚN toque
    // cae adentro de una zona — es la causa de que los controles no
    // respondieran en el celular.
    juego.touch = new Engine2D.TouchControls(juego.canvas, {
      logicalWidth: RpgConfig.LOGICAL_W,
      logicalHeight: RpgConfig.LOGICAL_H,
    });
    juego.touch.addJoystick({
      id: 'move',
      x: 54,
      y: RpgConfig.LOGICAL_H - 58,
      radius: 32,
      color: '74,222,128',
    });
    juego.touch.addButton({
      id: 'fire',
      x: RpgConfig.LOGICAL_W - 48,
      y: RpgConfig.LOGICAL_H - 82,
      radius: 24,
      label: 'A',
      color: '185,28,28',
    });
    juego.touch.addButton({
      id: 'block',
      x: RpgConfig.LOGICAL_W - 92,
      y: RpgConfig.LOGICAL_H - 32,
      radius: 20,
      label: 'D',
      color: '30,58,138',
    });
    juego.touch.addButton({
      id: 'interact',
      x: RpgConfig.LOGICAL_W - 32,
      y: RpgConfig.LOGICAL_H - 32,
      radius: 20,
      label: 'I',
      color: '21,128,61',
    });
    juego.touch.attach();
    juego.touchInteractPrev = false;
    this.syncTouchVisibility();
    window.addEventListener('resize', this.syncTouchVisibility);
    // Avanzar diálogo tocando CUALQUIER parte del canvas (no solo el botón
    // 💬): mientras hay una cinemática activa (RPG.inDialogue) el loop de
    // diálogo (rpgDialogueLoop) no llama a rpgUpdate — que es donde se
    // sondea el estado de los botones táctiles (ver rpgPollTouchActions) —
    // así que sin esto el jugador quedaba trabado en el primer diálogo sin
    // forma de avanzar desde el celular. Es un listener aparte del propio de
    // TouchControls (ambos conviven sin problema en el mismo canvas).
    // Método con nombre (ya enlazado por RpgModulo) en vez de una función
    // anónima: así se puede sacar con removeEventListener si algún día hace
    // falta, y agregarlo dos veces no lo duplica (mismo listener).
    juego.canvas.addEventListener('pointerdown', this.avanzarDialogoTactil);
  }

  avanzarDialogoTactil(e) {
    if (!juego.inDialogue) return;
    e.preventDefault();
    juego.combate.advanceDialogue();
  }

  // Mismo criterio que "@media (min-width: 900px) and (hover: hover) and
  // (pointer: fine)" en rpg.css (ahí se ocultaba la fila de botones HTML;
  // acá se oculta/deja de dibujar el joystick+botones del canvas).
  syncTouchVisibility() {
    if (!juego.touch) return;
    const isDesktopPointer =
      window.matchMedia && window.matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)').matches;
    juego.touch.visible = !isDesktopPointer;
  }

  // Se llama una vez por frame desde rpgUpdate: traduce el estado de los
  // botones táctiles a las mismas funciones que ya usan teclado/HTML
  // (rpgFire/rpgBlock/rpgInteract), sin duplicar lógica de juego.
  pollTouchActions() {
    const st = juego.touch.state;
    // Disparar: mantener apretado dispara en ráfaga (gatillado por el
    // propio cooldown de rpgFire, igual que mantener Espacio en teclado).
    if (st.fire) juego.combate.fire();
    // Bloquear: es un estado, no una acción puntual — se refleja 1 a 1.
    // rpgBlock removed from here, handled in rpgUpdate
    // Interactuar: acción puntual (abrir cofre / avanzar diálogo) — si se
    // llamara todos los frames mientras se mantiene apretado, un diálogo
    // completo se saltearía de una sola vez. Se dispara solo en el flanco
    // de subida (false → true), como un click.
    if (st.interact && !juego.touchInteractPrev) juego.combate.interact();
    juego.touchInteractPrev = !!st.interact;
  }

  showMenu() {
    juego.partida.stopLoop();
    juego.inDialogue = false;
    RpgConfig.EL.menu.classList.remove('hidden');
    RpgConfig.EL.hud.classList.add('hidden');
    RpgConfig.EL.overlay.classList.add('hidden');
    this.showMainMenu();
    juego.servicios.ponerMusica(RpgConfig.ASSET_BASE + 'sound/menu_song.mp3');
  }

  exitToHub() {
    this.abandonRunIfActive();
    juego.partida.stopLoop();
    juego.servicios.irASeccion('juegos');
  }

  hideAllMenuViews() {
    RpgMenu.MENU_VIEWS.forEach((el) => {
      if (el) el.classList.add('hidden');
    });
  }

  showMainMenu() {
    this.hideAllMenuViews();
    RpgConfig.EL.mainMenuView.classList.remove('hidden');
  }

  goToPlay() {
    juego.partida.showSlotsView();
  }

  goToMejoras() {
    this.hideAllMenuViews();
    RpgConfig.EL.mejorasView.classList.remove('hidden');
    juego.mejoras.renderMejoras();
  }

  goToAjustes() {
    this.hideAllMenuViews();
    RpgConfig.EL.ajustesView.classList.remove('hidden');
    this.renderAjustes();
  }

  goToComoJugar() {
    this.hideAllMenuViews();
    RpgConfig.EL.comoJugarView.classList.remove('hidden');
  }

  // ═══════════════════════════════════════════════
  //   Ajustes — volumen (mismo estado global que el resto del sitio, ver
  //   musicVolume/sfxVolume + getGlobalMusicVolume/setGlobalMusicVolume en
  //   app.js — la música del RPG usa el mismo bgMusic) y pantalla completa
  //   del contenedor del RPG.
  // ═══════════════════════════════════════════════
  renderAjustes() {
    const musicPct = Math.round(juego.servicios.volumenMusica() * 100);
    const sfxPct = Math.round(juego.servicios.volumenSfx() * 100);
    document.querySelectorAll('.rpg-music-volume-input').forEach((el) => {
      el.value = musicPct;
    });
    document.querySelectorAll('.rpg-music-volume-value').forEach((el) => {
      el.textContent = musicPct + '%';
    });
    document.querySelectorAll('.rpg-sfx-volume-input').forEach((el) => {
      el.value = sfxPct;
    });
    document.querySelectorAll('.rpg-sfx-volume-value').forEach((el) => {
      el.textContent = sfxPct + '%';
    });
    this.syncFullscreenBtn();
  }

  onMusicVolumeChange(value) {
    const pct = parseInt(value, 10) || 0;
    juego.servicios.setVolumenMusica(pct / 100);
    document.querySelectorAll('.rpg-music-volume-value').forEach((el) => {
      el.textContent = pct + '%';
    });
    // Por si hay dos copias del slider en el DOM a la vez (menú + pausa),
    // mantenerlas sincronizadas aunque solo una esté visible.
    document.querySelectorAll('.rpg-music-volume-input').forEach((el) => {
      el.value = pct;
    });
  }

  onSfxVolumeChange(value) {
    const pct = parseInt(value, 10) || 0;
    juego.servicios.setVolumenSfx(pct / 100);
    document.querySelectorAll('.rpg-sfx-volume-value').forEach((el) => {
      el.textContent = pct + '%';
    });
    document.querySelectorAll('.rpg-sfx-volume-input').forEach((el) => {
      el.value = pct;
    });
  }

  // Pantalla completa del .rpg-container (canvas + HUD + menú + overlays),
  // mismo criterio que runnerToggleFullscreen (app.js) pero apuntado al
  // contenedor del RPG en vez del runner.
  getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  fullscreenSupported() {
    const el = document.querySelector('#sec-rpg_pixel .rpg-container');
    return !!(el && (el.requestFullscreen || el.webkitRequestFullscreen));
  }

  toggleFullscreen() {
    const el = document.querySelector('#sec-rpg_pixel .rpg-container');
    if (!el) return;
    if (!this.getFullscreenElement()) {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }

  syncFullscreenBtn() {
    const supported = this.fullscreenSupported();
    document.querySelectorAll('.rpg-fullscreen-row').forEach((el) => {
      el.classList.toggle('unsupported', !supported);
    });
    const label = this.getFullscreenElement() ? 'Salir' : 'Activar';
    document.querySelectorAll('.rpg-fullscreen-btn').forEach((el) => {
      el.textContent = label;
    });
  }
}
