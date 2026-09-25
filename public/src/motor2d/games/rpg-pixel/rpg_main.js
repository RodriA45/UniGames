// ══════════════════════════════════════
//   RPG Pixel — rpg_main.js  (entry point, módulo ES6)
// ══════════════════════════════════════
// Único archivo de RPG Pixel que se carga desde app2.js (import()). La
// instancia del juego (juego, clase RpgPixel) se crea en rpg_juego.js; acá
// solo se expone en window lo que se llama desde afuera del módulo, con los
// mismos nombres de siempre (los métodos ya vienen enlazados a su instancia):
//   - los onclick="..."/oninput="..." de index.html
//   - los onclick="..." armados por innerHTML (slots, capítulos, mejoras,
//     pausa, cartel de recompensa de cofre)
//   - el "typeof rpgInit/rpgStopLoop === 'function'" que hace app2.js
import { juego } from './rpg_juego.js';

export { juego };

Object.assign(window, {
  rpgInit: juego.menu.init,
  rpgStopLoop: juego.partida.stopLoop,
  rpgExitToHub: juego.menu.exitToHub,
  rpgGoToAjustes: juego.menu.goToAjustes,
  rpgGoToComoJugar: juego.menu.goToComoJugar,
  rpgGoToMejoras: juego.menu.goToMejoras,
  rpgGoToPlay: juego.menu.goToPlay,
  rpgShowMainMenu: juego.menu.showMainMenu,
  rpgShowSlotsView: juego.partida.showSlotsView,
  rpgToggleFullscreen: juego.menu.toggleFullscreen,
  rpgOnMusicVolumeChange: juego.menu.onMusicVolumeChange,
  rpgOnSfxVolumeChange: juego.menu.onSfxVolumeChange,
  rpgSelectDifficulty: juego.partida.selectDifficulty,
  rpgShowMenu: juego.menu.showMenu,
  rpgBackToSlots: juego.partida.backToSlots,
  rpgBeginCombat: juego.partida.beginCombat,
  rpgStartChapter: juego.partida.startChapter,
  rpgSelectSlot: juego.partida.selectSlot,
  rpgDeleteSlotConfirm: juego.partida.deleteSlotConfirm,
  rpgPauseGame: juego.combate.pauseGame,
  rpgResumeGame: juego.combate.resumeGame,
  rpgShowPauseSettings: juego.combate.showPauseSettings,
  rpgQuitToMenuFromRoom: juego.combate.quitToMenuFromRoom,
  rpgRenderPauseOverlay: juego.combate.renderPauseOverlay,
  rpgCollectChestReward: juego.combate.collectChestReward,
  rpgBuyLifeUpgrade: juego.mejoras.buyLifeUpgrade,
  rpgBuyDmgUpgrade: juego.mejoras.buyDmgUpgrade,
  rpgBuyGuaranteedChest: juego.mejoras.buyGuaranteedChest,
  rpgBuyExtraChestChance: juego.mejoras.buyExtraChestChance,
  rpgBuyTotem: juego.mejoras.buyTotem,
});
