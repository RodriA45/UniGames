// ══════════════════════════════════════
//   Castle Escape — castle_menu_flow.js  (módulo ES6)
// ══════════════════════════════════════
// Pantallas de menú: selección de nivel, ajustes, cómo jugar, pantalla
// completa, y el atajo de Enter sobre los overlays.
import { TR_EL, TRAMPAS, TR_ASSET_BASE, TR_MENU_VIEWS, TR_LEVELS } from './castle_config.js';
import { trGetLevelStars, trIsUnlocked } from './castle_progress.js';
// Import circular con castle_loop.js (loop importa varias de estas
// funciones de acá) — seguro porque ninguna se ejecuta durante la carga
// de los módulos, solo dentro de handlers de click/teclado más tarde.
import { stopTrampas, trStartLevel } from './castle_loop.js';

export function trAttachEnterHandler() {
  if (TRAMPAS.enterHandler) document.removeEventListener('keydown', TRAMPAS.enterHandler);
  TRAMPAS.enterHandler = (e) => {
    if (!TR_EL.section.classList.contains('active')) return;
    if (e.code !== 'Enter') return;
    const overlay = TR_EL.overlay;
    if (overlay && !overlay.classList.contains('hidden')) {
      e.preventDefault();
      TR_EL.startBtn?.click();
    }
  };
  document.addEventListener('keydown', TRAMPAS.enterHandler);
}

// ─── Estrellas (persistencia en localStorage) ───
export function trHideAll() {
  TR_MENU_VIEWS.forEach(el => {
    if (el) el.classList.add('hidden');
  });
}
// trLoadLevel() pinta el fondo del castillo (back.png) directo en
// .trampas-container vía style.background inline — y ese inline se queda
// pegado ahí para siempre (un inline style le gana al CSS) aunque
// volvamos al menú. Por eso, después de jugar un nivel, "Ajustes",
// "Cómo jugar" y "Ver niveles" mostraban el fondo del juego en vez de la
// imagen de menú del CSS. Esta función saca ese inline y deja que el CSS
// (la foto de menú) se vea de nuevo — se llama desde toda pantalla que
// NO sea el juego en sí.
export function trResetMenuBackground() {
  const cont = document.querySelector('.trampas-container');
  if (cont) cont.style.background = '';
}
export function trShowMainMenu() {
  trHideAll();
  trResetMenuBackground();
  TR_EL.mainMenu.classList.remove('hidden');
  TR_EL.pauseMenu.classList.add('hidden');
  stopTrampas();
  if (typeof setMusic === 'function') setMusic(TR_ASSET_BASE + 'sounds/menu_song.mp3');
}
export function trShowLevelSelect() {
  trHideAll();
  trResetMenuBackground();
  TR_EL.levelSelect.classList.remove('hidden');
  trUpdateLevelCard();
}
export function trShowSettings() {
  trHideAll();
  trResetMenuBackground();
  TR_EL.settings.classList.remove('hidden');
  // Sincronizar los sliders con el volumen global actual
  const musicPct = Math.round((typeof getGlobalMusicVolume === 'function' ? getGlobalMusicVolume() : 0.5) * 100);
  const sfxPct = Math.round((typeof getGlobalSfxVolume === 'function' ? getGlobalSfxVolume() : 0.8) * 100);
  const musicSlider = TR_EL.musicVolume;
  const sfxSlider = TR_EL.sfxVolume;
  if (musicSlider) musicSlider.value = musicPct;
  if (sfxSlider) sfxSlider.value = sfxPct;
  TR_EL.musicVolumeValue.textContent = musicPct + '%';
  TR_EL.sfxVolumeValue.textContent = sfxPct + '%';
  trSyncFullscreenBtn();
}
export function trOnMusicVolumeChange(v) {
  TR_EL.musicVolumeValue.textContent = v + '%';
  if (typeof setGlobalMusicVolume === 'function') setGlobalMusicVolume(v / 100);
}
export function trOnSfxVolumeChange(v) {
  TR_EL.sfxVolumeValue.textContent = v + '%';
  if (typeof setGlobalSfxVolume === 'function') setGlobalSfxVolume(v / 100);
}

// ─── Pantalla completa (exactamente igual a Pixel Runner) ───
export function trGetFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
}

export function trFullscreenSupported() {
  const el = document.querySelector('.trampas-container');
  return !!(el && (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen));
}

export function trToggleFullscreen() {
  const el = document.querySelector('.trampas-container');
  if (!el) return;
  if (!trGetFullscreenElement()) {
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  }
  trSyncFullscreenBtn();
}

export function trSyncFullscreenBtn() {
  const row = TR_EL.fullscreenRow;
  if (row) row.classList.toggle('unsupported', !trFullscreenSupported());
  const btn = TR_EL.fullscreenBtn;
  if (!btn) return;
  btn.textContent = trGetFullscreenElement() ? 'Salir' : 'Activar';
}

document.addEventListener('fullscreenchange', trSyncFullscreenBtn);
document.addEventListener('webkitfullscreenchange', trSyncFullscreenBtn);

export function trShowHowToPlay() {
  trHideAll();
  trResetMenuBackground();
  TR_EL.howToPlay.classList.remove('hidden');
}

export function trShowGameScreen() {
  trHideAll();
}
// Cartel de controles dentro del juego (no es un alert, es un panel que
// se muestra/oculta sobre el canvas con el botón ❓ del HUD).
export function trToggleControlsSign() {
  const el = TR_EL.controlsSign;
  if (el) el.classList.toggle('hidden');
}
export function trBackToLevelSelect() {
  stopTrampas();
  if (typeof setMusic === 'function') setMusic(TR_ASSET_BASE + 'sounds/menu_song.mp3');
  trShowLevelSelect();
}

export function trUpdateLevelCard() {
  // Sin niveles cargados (todavía no se creó ninguno en el editor): en vez
  // de romper (lvl sería undefined), mostramos un aviso y deshabilitamos
  // todo lo que dependa de un nivel real.
  if (!TR_LEVELS.length) {
    TR_EL.bigLevelNum.textContent = '–';
    TR_EL.bigLevelName.textContent = 'Sin niveles — creá uno en el Editor de Niveles';
    const starEls0 = document.querySelectorAll('#trBigStars .star');
    starEls0.forEach(el => el.classList.remove('earned'));
    const card0 = document.querySelector('.trampas-level-card-big');
    if (card0) card0.classList.add('locked');
    const navLeft0 = TR_EL.navLeft;
    const navRight0 = TR_EL.navRight;
    const playBtn0 = TR_EL.levelPlayBtn;
    if (navLeft0) navLeft0.disabled = true;
    if (navRight0) navRight0.disabled = true;
    if (playBtn0) playBtn0.disabled = true;
    document.querySelectorAll('.trampas-level-dot').forEach(d => d.classList.remove('active'));
    return;
  }

  const i = TRAMPAS.selectedLevel;
  const lvl = TR_LEVELS[i];
  const stars = trGetLevelStars(i);
  const unlocked = trIsUnlocked(i);

  TR_EL.bigLevelNum.textContent = (i + 1);
  TR_EL.bigLevelName.textContent = lvl.nombre;

  const starEls = document.querySelectorAll('#trBigStars .star');
  starEls.forEach((el, j) => {
    el.classList.toggle('earned', stars >= j + 1);
  });

  const card = document.querySelector('.trampas-level-card-big');
  card.classList.toggle('locked', !unlocked);

  TR_EL.navLeft.disabled = (i === 0);
  TR_EL.navRight.disabled = (i >= TR_LEVELS.length - 1);
  TR_EL.levelPlayBtn.disabled = !unlocked;

  const dots = document.querySelectorAll('.trampas-level-dot');
  dots.forEach((d, j) => d.classList.toggle('active', j === i));
}

export function trNavLevel(dir) {
  if (!TR_LEVELS.length) return;
  TRAMPAS.selectedLevel = Math.max(0, Math.min(TR_LEVELS.length - 1, TRAMPAS.selectedLevel + dir));
  trUpdateLevelCard();
}

export function trPlaySelectedLevel() {
  if (!TR_LEVELS.length) return;
  if (!trIsUnlocked(TRAMPAS.selectedLevel)) return;
  // Todavía cargando sprites/atlas (ver initTrampas) — no arrancar con
  // imágenes a medio cargar. La barra de progreso ya se está mostrando;
  // acá simplemente no hacemos nada hasta que llegue al 100%.
  if (!TRAMPAS.assetsReady) return;
  trStartLevel(TRAMPAS.selectedLevel);
}

