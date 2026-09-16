// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_main.js   (punto de entrada del módulo)
//
//   app2.js lo carga con lazy loading:
//     ensureSurviLoaded().then(() => initSurvi());
//
//   Expone initSurvi() / stopSurvi() también en window, igual que hacen
//   rpg_main.js y runner_main.js, para que goTo() los pueda llamar sin
//   importar nada.
// ══════════════════════════════════════════════════════════════

import { buildLayout, showScreen, renderWorlds } from './survi_ui.js';
import { listSlots, loadWorld, deleteWorld, fmtTime } from './survi_save.js';
import { SurviGame } from './survi_game.js';
import { MODES } from './survi_config.js';

const ROOT_ID = 'survi-root';

let ui = null;
let game = null;
let pickedSlot = null;      // { slot, exists, mode, ... } elegido en la lista
let settingsFrom = 'cover'; // a qué pantalla vuelve el botón Volver de Ajustes
let qualityRowAdded = false;

// ─── Entrada ───
export function initSurvi() {
  const root = document.getElementById(ROOT_ID);
  if (!root) {
    console.warn(`[pixel-survi] falta <div id="${ROOT_ID}"> en la sección.`);
    return;
  }
  if (!ui) {
    ui = buildLayout(root);
    game = new SurviGame(ui);
    wireActions();
    wireSettings();
  }
  // Al entrar (o volver) a la sección siempre se arranca desde el menú.
  // La partida anterior ya quedó guardada por stopSurvi().
  showScreen(ui, 'cover');
}

// ─── Salida: app2.js la llama al navegar a otra sección para que no quede
// el requestAnimationFrame corriendo de fondo. ───
export function stopSurvi() {
  if (game && game.running) game.stop();       // stop() guarda antes de cortar
}

// ═══════════ Cableado de botones ═══════════
function wireActions() {
  ui.root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn || !ui.root.contains(btn)) return;
    const act = btn.dataset.act;

    switch (act) {
      // ── menú principal ──
      case 'play':
        openWorlds();
        break;
      case 'howto':
        showScreen(ui, 'howto');
        break;
      case 'settings':
        settingsFrom = game.running && !game.dead ? 'pause' : 'cover';
        showScreen(ui, 'settings');
        break;
      case 'settings-back':
        showScreen(ui, settingsFrom);
        break;
      case 'back-cover':
        showScreen(ui, 'cover');
        break;
      case 'back-worlds':
        openWorlds();
        break;

      // ── modo ──
      case 'mode-normal':
        startWorld('normal');
        break;
      case 'mode-hardcore':
        startWorld('hardcore');
        break;

      // ── en partida ──
      case 'fullscreen':
        if (typeof Engine2D !== 'undefined') Engine2D.Fullscreen.toggle(ui.root);
        break;
      case 'resume':
        game.setPaused(false);
        break;
      case 'save':
        flashBtn(btn, game.save() ? 'Guardado ✓' : 'No se pudo guardar');
        break;
      case 'close-inv':
        game.toggleInventory(false);
        break;
      case 'respawn':
        game.respawn();
        break;
      case 'to-menu':
        game.stop();
        showScreen(ui, 'cover');
        break;
    }
  });
}

function flashBtn(btn, text) {
  const original = btn.dataset.label || btn.textContent;
  btn.dataset.label = original;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = original; }, 900);
}

// ═══════════ Mundos ═══════════
function openWorlds() {
  renderWorlds(ui, listSlots(), {
    onPick: (s) => openMode(s),
    onDelete: (s) => {
      if (confirm(`¿Borrar el Mundo ${s.slot}? No se puede recuperar.`)) {
        deleteWorld(s.slot);
        openWorlds();
      }
    }
  });
  showScreen(ui, 'worlds');
}

function openMode(slotInfo) {
  pickedSlot = slotInfo;
  ui.modeTitle.textContent = `Mundo ${slotInfo.slot}`;
  const sub = ui.screens.mode.querySelector('.modal-game-sub');
  sub.textContent = slotInfo.exists
    ? `Partida guardada en ${MODES[slotInfo.mode] ? MODES[slotInfo.mode].label.toLowerCase() : 'modo normal'} · ${fmtTime(slotInfo.playedMs)} jugado.\nElegí el mismo modo para continuarla.`
    : 'Mundo vacío: se genera uno nuevo con aparición al azar en la superficie.';
  showScreen(ui, 'mode');
}

async function startWorld(mode) {
  const info = pickedSlot;
  if (!info) return;

  let save = null;
  if (info.exists) {
    if (info.mode === mode) {
      save = loadWorld(info.slot);           // continuar la partida
    } else {
      const ok = confirm(
        `El Mundo ${info.slot} ya tiene una partida en ${info.mode === 'hardcore' ? 'hardcore' : 'normal'}.\n` +
        `Empezar en ${mode === 'hardcore' ? 'hardcore' : 'normal'} la borra. ¿Seguir?`
      );
      if (!ok) return;
      deleteWorld(info.slot);
    }
  }

  showScreen(ui, null);
  await game.start({ slot: info.slot, mode, save });
}

// ═══════════ Ajustes ═══════════
function wireSettings() {
  const E = typeof Engine2D !== 'undefined' ? Engine2D : null;

  // Música y efectos salen del mixer del motor (Engine2D.Audio), que ya
  // persiste los volúmenes en localStorage — no hace falta guardarlos acá.
  const setVal = (el, v) => { el.textContent = Math.round(v * 100) + '%'; };
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
  if (E && E.Quality && !qualityRowAdded) {
    ui.qualitySlot.appendChild(E.Quality.createRow({ label: '🖼️ Gráficos' }));
    qualityRowAdded = true;
  }

  // Pantalla completa: si el navegador no lo soporta, se oculta la fila.
  if (E && E.Fullscreen && !E.Fullscreen.isSupported()) {
    ui.root.querySelector('.survi-fullscreen-row').classList.add('hidden');
  }
}

// ─── Globals para app2.js (mismo patrón que rpgInit / showRunnerMenu) ───
globalThis.initSurvi = initSurvi;
globalThis.stopSurvi = stopSurvi;

export default { initSurvi, stopSurvi };
