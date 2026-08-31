// ══════════════════════════════════════
//   Castle Escape — castle_main.js  (entry point, módulo ES6)
// ══════════════════════════════════════
// Único archivo de Castle Escape que index.html carga con
// <script type="module">. Importa el resto de los castle_*.js (que entre
// ellos se importan/exportan como corresponda) y expone en window
// SOLAMENTE lo que se llama desde fuera del módulo:
//   - los onclick="..."/oninput="..." de index.html
//   - el "typeof initTrampas === 'function'" que hace app2.js al entrar
//     a la sección del juego
//
// Todo lo demás (TRAMPAS, TR_EL, trDrawPlatform, trOscillate, etc.) queda
// encapsulado en el scope del módulo — ya no contamina el global scope
// como pasaba con los <script> sueltos.
import { initTrampas, trPauseGame, trResumeGame, trExitToLevels, startTrampas, stopTrampas, toggleCastleMusic } from './castle_loop.js';
import {
  trShowMainMenu, trShowLevelSelect, trShowSettings, trShowHowToPlay,
  trToggleControlsSign, trToggleFullscreen, trNavLevel, trPlaySelectedLevel,
  trOnMusicVolumeChange, trOnSfxVolumeChange
} from './castle_menu_flow.js';

Object.assign(window, {
  initTrampas,
  startTrampas,
  stopTrampas,
  toggleCastleMusic,
  trPauseGame,
  trResumeGame,
  trExitToLevels,
  trShowMainMenu,
  trShowLevelSelect,
  trShowSettings,
  trShowHowToPlay,
  trToggleControlsSign,
  trToggleFullscreen,
  trNavLevel,
  trPlaySelectedLevel,
  trOnMusicVolumeChange,
  trOnSfxVolumeChange,
});
