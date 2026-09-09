// ══════════════════════════════════════
//   RPG Pixel — rpg_main.js  (entry point, módulo ES6)
// ══════════════════════════════════════
// Único archivo de RPG Pixel que index.html carga con
// <script type="module">. Importa el resto de los rpg_*.js (que entre
// ellos se importan/exportan como corresponda, con imports circulares
// entre config/meta/enemies_data resueltos a propósito — ver el traslado
// de rpgComputeRoomZoom/rpgEliteActive/RPG_POWERUP_DEFS a
// rpg_enemies_data.js para que rpg_config.js quede sin imports) y expone
// en window SOLAMENTE lo que se llama desde fuera del módulo:
//   - los onclick="..."/oninput="..." de index.html
//   - los onclick="..." armados dinámicamente por innerHTML (menú de
//     slots, capítulos, mejoras, pausa, cartel de recompensa de cofre)
//   - el "typeof rpgInit/rpgStopLoop === 'function'" que hace app2.js
//     al entrar/salir de la sección del juego
import { rpgInit, rpgExitToHub, rpgGoToAjustes, rpgGoToComoJugar, rpgGoToMejoras, rpgGoToPlay, rpgShowMainMenu, rpgToggleFullscreen, rpgOnMusicVolumeChange, rpgOnSfxVolumeChange, rpgShowMenu } from './rpg_save_ui.js';
import { rpgStopLoop, rpgBackToSlots, rpgBeginCombat, rpgSelectDifficulty, rpgStartChapter, rpgSelectSlot, rpgDeleteSlotConfirm, rpgShowSlotsView } from './rpg_menu_flow.js';
import { rpgPauseGame, rpgResumeGame, rpgShowPauseSettings, rpgQuitToMenuFromRoom, rpgRenderPauseOverlay, rpgCollectChestReward } from './rpg_combat_input.js';
import { rpgBuyLifeUpgrade, rpgBuyDmgUpgrade, rpgBuyGuaranteedChest, rpgBuyExtraChestChance } from './rpg_meta.js';

Object.assign(window, {
  // app2.js (typeof-guardado en goTo)
  rpgInit,
  rpgStopLoop,
  // index.html (onclick/oninput del menú del RPG)
  rpgExitToHub,
  rpgGoToAjustes,
  rpgGoToComoJugar,
  rpgGoToMejoras,
  rpgGoToPlay,
  rpgShowMainMenu,
  rpgShowSlotsView,
  rpgToggleFullscreen,
  rpgOnMusicVolumeChange,
  rpgOnSfxVolumeChange,
  rpgSelectDifficulty,
  // onclick armados a mano por innerHTML (slots, capítulos, pausa,
  // ajustes en pausa, cartel de recompensa de cofre, mejoras)
  rpgShowMenu,
  rpgBackToSlots,
  rpgBeginCombat,
  rpgStartChapter,
  rpgSelectSlot,
  rpgDeleteSlotConfirm,
  rpgPauseGame,
  rpgResumeGame,
  rpgShowPauseSettings,
  rpgQuitToMenuFromRoom,
  rpgRenderPauseOverlay,
  rpgCollectChestReward,
  rpgBuyLifeUpgrade,
  rpgBuyDmgUpgrade,
  rpgBuyGuaranteedChest,
  rpgBuyExtraChestChance,
});
