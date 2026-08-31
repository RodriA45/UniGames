function rpgSlotKey(n) {
  return RPG_SAVE_KEY_PREFIX + n;
}

function rpgNewSaveData() {
  return { chapterUnlocked: 1, chaptersCompleted: [], difficulty: 'normal', updatedAt: null };
}

function rpgLoadSlotData(n) {
  try {
    const raw = localStorage.getItem(rpgSlotKey(n));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    // Blindaje por si el shape cambia en el futuro.
    if (!Array.isArray(data.chaptersCompleted)) data.chaptersCompleted = [];
    if (!Number.isFinite(data.chapterUnlocked)) data.chapterUnlocked = 1;
    // Saves viejos (previos a agregar dificultad) caen en 'normal'.
    if (data.difficulty !== 'normal' && data.difficulty !== 'elite') data.difficulty = 'normal';
    return data;
  } catch {
    return null;
  }
}

function rpgSaveSlotData(n, data) {
  try { localStorage.setItem(rpgSlotKey(n), JSON.stringify(data)); } catch {}
}

function rpgDeleteSlotData(n) {
  try { localStorage.removeItem(rpgSlotKey(n)); } catch {}
}

// ─── Borrado de la partida activa (perder o salir en medio de una
//     habitación) ─────
// A diferencia de rpgDeleteSlotConfirm (borrado manual desde la lista de
// partidas), esto lo dispara el propio juego: si morís o abandonás el
// intento antes de completar el capítulo, se pierde todo el progreso
// guardado en ese slot (capítulos desbloqueados/completados), no solo el
// intento actual. rpgCompleteChapter ya guardó lo que corresponde antes
// de volver al menú, así que esa pantalla NUNCA pasa por acá.
function rpgEraseActiveSlot() {
  if (!RPG.activeSlot) return;
  rpgDeleteSlotData(RPG.activeSlot);
  RPG.save = null;
}

// Se llama desde los puntos de salida "manuales" (pausa, botón de volver
// a Juegos) para decidir si esa salida cuenta como abandonar el intento:
// solo si el jugador está efectivamente dentro de una habitación (rpgMenu
// oculto). Si está parado en el menú del RPG (eligiendo slot/capítulo,
// mejoras, ajustes, etc.) no hay ningún intento en curso y no se borra
// nada.
function rpgAbandonRunIfActive() {
  const menuEl = RPG_EL.menu;
  const inRoom = menuEl && menuEl.classList.contains('hidden');
  if (inRoom) rpgEraseActiveSlot();
}

// ─── Entrada a la sección (llamado desde goTo en app.js) ─────
function rpgInit() {
  RPG.canvas = RPG_EL.canvas;
  RPG.ctx = RPG.canvas.getContext('2d');
  // Look retro nítido: sin esto, drawImage suaviza (bilinear) los sprites
  // al reducirlos al canvas interno de 480x270, y ese resultado ya borroso
  // se vuelve a escalar hacia arriba en bloques por el `image-rendering:
  // pixelated` de rpg.css — la mezcla se ve fea (borroso + bloques). Con
  // el suavizado apagado, el downscale usa vecino más cercano y queda
  // consistente con el upscale del CSS: pixel art prolijo de punta a punta.
  RPG.ctx.imageSmoothingEnabled = false;
  rpgSetupTouchControls();
  rpgStopLoop();
  rpgShowMenu();
}

// ─── Entradas: joystick + botones táctiles DENTRO del canvas ─────
// Usa Engine2D.TouchControls (engine2d.js) en vez de los botones HTML de
// abajo (como Pixel Runner): joystick analógico de movimiento a la
// izquierda, y disparar/bloquear/interactuar como botones redondos a la
// derecha, todo dibujado encima de la escena (ver el final de rpgDraw).
// En desktop con mouse/trackpad (mismo criterio que el media query de
// `.rpg-controls` en rpg.css) queda oculto: se juega con teclado.
function rpgSetupTouchControls() {
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
  if (RPG.touch) { rpgSyncTouchVisibility(); return; }

  // logicalWidth/logicalHeight: el canvas real (RPG.canvas.width/height) se
  // escala por devicePixelRatio (ver rpgStartRoom) para verse nítido en
  // HiDPI, pero todas las zonas de acá abajo están pensadas en el espacio
  // lógico de siempre (480x270, RPG_LOGICAL_W/H). Sin pasarle esto al
  // motor, el hit-test compara contra el buffer ya escalado y NINGÚN toque
  // cae adentro de una zona — es la causa de que los controles no
  // respondieran en el celular.
  RPG.touch = new Engine2D.TouchControls(RPG.canvas, {
    logicalWidth: RPG_LOGICAL_W,
    logicalHeight: RPG_LOGICAL_H
  });
  RPG.touch.addJoystick({ id: 'move', x: 54, y: RPG_LOGICAL_H - 58, radius: 32, color: '74,222,128' });
  RPG.touch.addButton({ id: 'fire', x: RPG_LOGICAL_W - 48, y: RPG_LOGICAL_H - 82, radius: 24, label: 'A', color: '185,28,28' });
  RPG.touch.addButton({ id: 'block', x: RPG_LOGICAL_W - 92, y: RPG_LOGICAL_H - 32, radius: 20, label: 'D', color: '30,58,138' });
  RPG.touch.addButton({ id: 'interact', x: RPG_LOGICAL_W - 32, y: RPG_LOGICAL_H - 32, radius: 20, label: 'I', color: '21,128,61' });
  RPG.touch.attach();
  RPG._touchInteractPrev = false;
  rpgSyncTouchVisibility();
  window.addEventListener('resize', rpgSyncTouchVisibility);

  // Avanzar diálogo tocando CUALQUIER parte del canvas (no solo el botón
  // 💬): mientras hay una cinemática activa (RPG.inDialogue) el loop de
  // diálogo (rpgDialogueLoop) no llama a rpgUpdate — que es donde se
  // sondea el estado de los botones táctiles (ver rpgPollTouchActions) —
  // así que sin esto el jugador quedaba trabado en el primer diálogo sin
  // forma de avanzar desde el celular. Es un listener aparte del propio de
  // TouchControls (ambos conviven sin problema en el mismo canvas).
  RPG.canvas.addEventListener('pointerdown', function(e) {
    if (!RPG.inDialogue) return;
    e.preventDefault();
    rpgAdvanceDialogue();
  });
}

// Mismo criterio que "@media (min-width: 900px) and (hover: hover) and
// (pointer: fine)" en rpg.css (ahí se ocultaba la fila de botones HTML;
// acá se oculta/deja de dibujar el joystick+botones del canvas).
function rpgSyncTouchVisibility() {
  if (!RPG.touch) return;
  const isDesktopPointer = window.matchMedia
    && window.matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)').matches;
  RPG.touch.visible = !isDesktopPointer;
}

// Se llama una vez por frame desde rpgUpdate: traduce el estado de los
// botones táctiles a las mismas funciones que ya usan teclado/HTML
// (rpgFire/rpgBlock/rpgInteract), sin duplicar lógica de juego.
function rpgPollTouchActions() {
  const st = RPG.touch.state;
  // Disparar: mantener apretado dispara en ráfaga (gatillado por el
  // propio cooldown de rpgFire, igual que mantener Espacio en teclado).
  if (st.fire) rpgFire();
  // Bloquear: es un estado, no una acción puntual — se refleja 1 a 1.
  // rpgBlock removed from here, handled in rpgUpdate
  // Interactuar: acción puntual (abrir cofre / avanzar diálogo) — si se
  // llamara todos los frames mientras se mantiene apretado, un diálogo
  // completo se saltearía de una sola vez. Se dispara solo en el flanco
  // de subida (false → true), como un click.
  if (st.interact && !RPG._touchInteractPrev) rpgInteract();
  RPG._touchInteractPrev = !!st.interact;
}

function rpgShowMenu() {
  rpgStopLoop();
  RPG.inDialogue = false;
  RPG_EL.menu.classList.remove('hidden');
  RPG_EL.hud.classList.add('hidden');
  RPG_EL.overlay.classList.add('hidden');
  rpgShowMainMenu();
  if (typeof setMusic === 'function') setMusic(RPG_ASSET_BASE + 'sound/menu_song.mp3');
}

function rpgExitToHub() {
  rpgAbandonRunIfActive();
  rpgStopLoop();
  goTo('juegos');
}

// ═══════════════════════════════════════════════
//   Menú principal — Jugar / Mejoras / Ajustes / Cómo jugar
// ═══════════════════════════════════════════════
const RPG_MENU_VIEWS = [RPG_EL.mainMenuView, RPG_EL.slotsView, RPG_EL.chaptersView, RPG_EL.difficultyView, RPG_EL.mejorasView, RPG_EL.ajustesView, RPG_EL.comoJugarView];

function rpgHideAllMenuViews() {
  RPG_MENU_VIEWS.forEach(el => {
    if (el) el.classList.add('hidden');
  });
}

function rpgShowMainMenu() {
  rpgHideAllMenuViews();
  RPG_EL.mainMenuView.classList.remove('hidden');
}

function rpgGoToPlay() {
  rpgShowSlotsView();
}

function rpgGoToMejoras() {
  rpgHideAllMenuViews();
  RPG_EL.mejorasView.classList.remove('hidden');
  rpgRenderMejoras();
}

function rpgGoToAjustes() {
  rpgHideAllMenuViews();
  RPG_EL.ajustesView.classList.remove('hidden');
  rpgRenderAjustes();
}

function rpgGoToComoJugar() {
  rpgHideAllMenuViews();
  RPG_EL.comoJugarView.classList.remove('hidden');
}

// ═══════════════════════════════════════════════
//   Ajustes — volumen (mismo estado global que el resto del sitio, ver
//   musicVolume/sfxVolume + getGlobalMusicVolume/setGlobalMusicVolume en
//   app.js — la música del RPG usa el mismo bgMusic) y pantalla completa
//   del contenedor del RPG.
// ═══════════════════════════════════════════════
function rpgRenderAjustes() {
  const musicPct = Math.round((typeof getGlobalMusicVolume === 'function' ? getGlobalMusicVolume() : 0.5) * 100);
  const sfxPct   = Math.round((typeof getGlobalSfxVolume === 'function' ? getGlobalSfxVolume() : 0.8) * 100);
  document.querySelectorAll('.rpg-music-volume-input').forEach(el => { el.value = musicPct; });
  document.querySelectorAll('.rpg-music-volume-value').forEach(el => { el.textContent = musicPct + '%'; });
  document.querySelectorAll('.rpg-sfx-volume-input').forEach(el => { el.value = sfxPct; });
  document.querySelectorAll('.rpg-sfx-volume-value').forEach(el => { el.textContent = sfxPct + '%'; });
  rpgSyncFullscreenBtn();
}

function rpgOnMusicVolumeChange(value) {
  const pct = parseInt(value, 10) || 0;
  if (typeof setGlobalMusicVolume === 'function') setGlobalMusicVolume(pct / 100);
  document.querySelectorAll('.rpg-music-volume-value').forEach(el => { el.textContent = pct + '%'; });
  // Por si hay dos copias del slider en el DOM a la vez (menú + pausa),
  // mantenerlas sincronizadas aunque solo una esté visible.
  document.querySelectorAll('.rpg-music-volume-input').forEach(el => { el.value = pct; });
}

function rpgOnSfxVolumeChange(value) {
  const pct = parseInt(value, 10) || 0;
  if (typeof setGlobalSfxVolume === 'function') setGlobalSfxVolume(pct / 100);
  document.querySelectorAll('.rpg-sfx-volume-value').forEach(el => { el.textContent = pct + '%'; });
  document.querySelectorAll('.rpg-sfx-volume-input').forEach(el => { el.value = pct; });
}

// Pantalla completa del .rpg-container (canvas + HUD + menú + overlays),
// mismo criterio que runnerToggleFullscreen (app.js) pero apuntado al
// contenedor del RPG en vez del runner.
function rpgGetFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function rpgFullscreenSupported() {
  const el = document.querySelector('#sec-rpg_pixel .rpg-container');
  return !!(el && (el.requestFullscreen || el.webkitRequestFullscreen));
}

function rpgToggleFullscreen() {
  const el = document.querySelector('#sec-rpg_pixel .rpg-container');
  if (!el) return;
  if (!rpgGetFullscreenElement()) {
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
}

function rpgSyncFullscreenBtn() {
  const supported = rpgFullscreenSupported();
  document.querySelectorAll('.rpg-fullscreen-row').forEach(el => { el.classList.toggle('unsupported', !supported); });
  const label = rpgGetFullscreenElement() ? 'Salir' : 'Activar';
  document.querySelectorAll('.rpg-fullscreen-btn').forEach(el => { el.textContent = label; });
}

document.addEventListener('fullscreenchange', rpgSyncFullscreenBtn);
document.addEventListener('webkitfullscreenchange', rpgSyncFullscreenBtn);

// ═══════════════════════════════════════════════
