// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_ui.js
//   Arma TODO el DOM del juego dentro del contenedor y devuelve las
//   referencias. No tiene lógica de juego: solo estructura, mostrar/
//   ocultar pantallas y pintar las tarjetas de los 3 mundos.
//
//   Usa las clases de ui-components.css (modal-game, btn-game-*,
//   game-icon-btn, game-slider-row) para no reinventar estilos.
// ══════════════════════════════════════════════════════════════

import {
  MAX_HP, MAX_HUNGER, COVER_SRC, MODES, ITEM_INFO, HOTBAR_SIZE,
  EQUIP_SLOTS, EQUIP_SLOT_ICON, RECIPES, CRAFT_CATS, ingredientHave, canCraft, BIOMES,
  SMELT, FUEL, SMELT_MS, CHEST_SLOTS
} from './survi_config.js';
import { fmtTime } from './survi_save.js';
import { icon, BIOME_ICON } from './survi_icons.js';
import { tileIconStyle, itemSpriteStyle, PLAYER } from './models/sprites.js';

// Nombres de pantalla válidos para showScreen()
export const SCREENS = ['cover', 'worlds', 'mode', 'settings', 'howto', 'pause', 'death', 'inv', 'equip', 'craft', 'furnace', 'chest'];

export function buildLayout(root) {
  root.classList.add('survi-root');
  root.innerHTML = `
    <canvas class="survi-canvas"></canvas>

    <!-- Aviso corto (ej. "Inventario lleno") — lo dispara ui.showToast(). -->
    <div class="survi-toast hidden"></div>

    <!-- ── HUD en partida ── -->
    <div class="survi-hud hidden">
      <div class="survi-hud-top">
        <button class="game-icon-btn survi-pause-btn" title="Pausa (Esc)">⏸</button>
        <button class="game-icon-btn survi-inv-btn" title="Inventario (I)">I</button>
      </div>
      <div class="survi-hud-bottom">
        <div class="survi-health" title="Vida">
          <span class="survi-health-heart">${icon('heart', { fill: true })}</span>
          <div class="survi-health-bar"><i></i></div>
          <span class="survi-health-text">${MAX_HP}/${MAX_HP}</span>
        </div>
        <div class="survi-hunger" title="Hambre">
          <span class="survi-hunger-icon">${icon('drumstick')}</span>
          <div class="survi-hunger-bar"><i></i></div>
          <span class="survi-hunger-text">${MAX_HUNGER}/${MAX_HUNGER}</span>
        </div>
        <div class="survi-hotbar"></div>
      </div>
    </div>

    <!-- ── Controles táctiles ── -->
    <div class="survi-touch hidden">
      <div class="survi-touch-move">
        <button class="game-icon-btn" data-touch="left">${icon('chevronLeft', { stroke: 3 })}</button>
        <button class="game-icon-btn" data-touch="right">${icon('chevronRight', { stroke: 3 })}</button>
      </div>
      <div class="survi-touch-right">
        <button class="game-icon-btn survi-touch-mode" title="Romper / Colocar">${icon('pickaxe')}</button>
        <button class="game-icon-btn survi-touch-jump" data-touch="jump">${icon('arrowUp', { stroke: 3 })}</button>
      </div>
    </div>

    <!-- ── Menú principal (portada) ── -->
    <div class="modal-game survi-screen survi-cover">
      <div class="modal-game-box">
        <div class="survi-cover-art">
          <img class="survi-cover-img" alt="" src="${COVER_SRC}">
          <div class="survi-cover-fallback">
            <span class="survi-cover-logo">PIXEL SURVI</span>
            <span class="survi-cover-note">portada en preparación</span>
          </div>
        </div>
        <button class="btn-game-primary" data-act="play">Jugar</button>
        <button class="btn-game-secondary" data-act="settings">Ajustes</button>
        <button class="btn-game-secondary" data-act="howto">Cómo jugar</button>
      </div>
    </div>

    <!-- ── Puntos de guardado ── -->
    <div class="modal-game survi-screen survi-worlds hidden">
      <div class="modal-game-box survi-worlds-box">
        <h2 class="modal-game-title">Elegí un mundo</h2>
        <div class="survi-worlds-list"></div>
        <button class="btn-game-secondary" data-act="back-cover">Volver</button>
      </div>
    </div>

    <!-- ── Modo de juego ── -->
    <div class="modal-game survi-screen survi-mode hidden">
      <div class="modal-game-box">
        <h2 class="modal-game-title survi-mode-title">Mundo 1</h2>
        <p class="modal-game-sub">¿Cómo querés jugar este mundo?</p>
        <button class="btn-game-primary" data-act="mode-normal">
          ${MODES.normal.label}
          <small>${MODES.normal.desc}</small>
        </button>
        <button class="btn-game-secondary survi-hardcore-btn" data-act="mode-hardcore">
          ${MODES.hardcore.label}
          <small>${MODES.hardcore.desc}</small>
        </button>
        <button class="btn-game-secondary" data-act="back-worlds">Volver</button>
      </div>
    </div>

    <!-- ── Ajustes ── -->
    <div class="modal-game survi-screen survi-settings hidden">
      <div class="modal-game-box survi-settings-box">
        <h2 class="modal-game-title">Ajustes</h2>
        <div class="game-settings-content survi-settings-content">
          <div class="game-slider-row">
            <label for="surviMusicVol">${icon('music')} Música</label>
            <input id="surviMusicVol" type="range" min="0" max="100" step="1">
            <span class="game-slider-value survi-music-val">70%</span>
          </div>
          <div class="game-slider-row">
            <label for="surviSfxVol">${icon('volume')} Efectos</label>
            <input id="surviSfxVol" type="range" min="0" max="100" step="1">
            <span class="game-slider-value survi-sfx-val">70%</span>
          </div>
          <div class="game-fullscreen-row survi-fullscreen-row">
            <button class="game-fullscreen-btn survi-fullscreen-btn" data-act="fullscreen">${icon('maximize')} Pantalla completa</button>
          </div>
          <div class="survi-quality-slot"></div>
        </div>
        <button class="btn-game-secondary" data-act="settings-back">Volver</button>
      </div>
    </div>

    <!-- ── Cómo jugar ── -->
    <div class="modal-game survi-screen survi-howto hidden">
      <div class="modal-game-box survi-howto-box">
        <h2 class="modal-game-title">Cómo jugar</h2>
        <div class="survi-howto-list">
          <div class="game-info-row"><b>A / D</b> o <b>←  →</b> — moverte</div>
          <div class="game-info-row"><b>Espacio</b> o <b>W</b> — saltar</div>
          <div class="game-info-row"><b>Clic izquierdo</b> (mantenido) — romper bloques y atacar</div>
          <div class="game-info-row"><b>Clic derecho</b> — colocar el bloque del slot elegido</div>
          <div class="game-info-row"><b>1 a 8</b> — elegir slot de la hotbar</div>
          <div class="game-info-row"><b>I</b> — abrir el inventario</div>
          <div class="game-info-row"><b>Esc</b> — pausa</div>
          <div class="game-info-row">Caer de más de 4 bloques te saca vida. En <b>hardcore</b> la muerte borra el mundo.</div>
          <div class="game-info-row">Cualquier herramienta pega, pero la <b>espada</b> es la que más daño hace y más rápido pega.</div>
          <div class="game-info-row">Cada material es mejor que el anterior: <b>madera → piedra → cobre → hierro → oro → diamante → esmeralda</b>. Los minerales piden un pico del nivel de abajo o mejor: cobre (piedra), hierro (cobre), oro (hierro), diamante (oro), esmeralda (diamante). Con un pico peor se rompen pero no sueltan nada.</div>
          <div class="game-info-row">Desde el inventario solo se craftea lo simple (palos, antorchas, flechas, flint y la <b>mesa de crafteo</b>). Con <b>clic derecho</b> sobre la mesa se hace todo lo demás: herramientas, armas, armadura, mochilas, <b>horno</b> y <b>cofre</b>.</div>
          <div class="game-info-row">En el <b>horno</b> se funden los minerales crudos a lingote y se cocina la comida, usando carbón o madera como combustible. El <b>cofre</b> guarda hasta 16 tipos de ítem.</div>
          <div class="game-info-row">${icon('drumstick')} El hambre baja solo. Rompé hojas para conseguir comida y comela con <b>clic derecho</b>. En 0 empieza a sacarte vida; bien alimentado, la regenerás de a poco.</div>
        </div>
        <button class="btn-game-secondary" data-act="back-cover">Volver</button>
      </div>
    </div>

    <!-- ── Inventario ── -->
    <div class="modal-game survi-screen survi-inv hidden">
      <div class="modal-game-box survi-inv-box">
        <h2 class="modal-game-title">Inventario <span class="survi-inv-count">(0/10)</span></h2>
        <div class="survi-inv-grid"></div>
        <p class="survi-inv-hint">Tocá un ítem para ponerlo en el slot #<span class="survi-inv-slot">1</span>.</p>
        <div class="survi-inv-actions">
          <button class="btn-game-secondary" data-act="open-equip">${icon('shield')} Equipamiento</button>
          <button class="btn-game-secondary" data-act="open-craft">${icon('hammer')} Craftear</button>
        </div>
        <button class="btn-game-primary" data-act="close-inv">Cerrar (I)</button>
      </div>
    </div>

    <!-- ── Equipamiento ── -->
    <div class="modal-game survi-screen survi-equip hidden">
      <div class="modal-game-box survi-equip-box">
        <h2 class="modal-game-title">Equipamiento</h2>
        <div class="survi-equip-layout">
          <div class="survi-equip-left">
            <div class="survi-equip-char"></div>
            <div class="survi-equip-slots"></div>
          </div>
          <div class="survi-equip-right">
            <p class="survi-equip-hint">Tocá un ítem para equiparlo.</p>
            <div class="survi-equip-list"></div>
          </div>
        </div>
        <button class="btn-game-secondary" data-act="equip-back">Volver</button>
      </div>
    </div>

    <!-- ── Craftear ── -->
    <div class="modal-game survi-screen survi-craft hidden">
      <div class="modal-game-box survi-craft-box">
        <h2 class="modal-game-title survi-craft-title">Craftear</h2>
        <p class="survi-craft-hint"></p>
        <div class="survi-craft-layout">
          <div class="survi-craft-side">
            <div class="survi-craft-tabs"></div>
            <div class="survi-craft-list"></div>
          </div>
          <div class="survi-craft-detail">
            <p class="survi-craft-empty">Elegí algo de la lista para ver qué pide.</p>
          </div>
        </div>
        <button class="btn-game-secondary" data-act="craft-back">Volver</button>
      </div>
    </div>

    <!-- ── Horno ── -->
    <div class="modal-game survi-screen survi-furnace hidden">
      <div class="modal-game-box survi-station-box">
        <h2 class="modal-game-title">Horno</h2>
        <div class="survi-furnace-ui">
          <div class="survi-furnace-col">
            <button type="button" class="survi-fslot" data-fslot="in" title="Para cocinar / fundir"></button>
            <div class="survi-furnace-fire" title="Fuego"><div class="survi-furnace-fire-fill"></div></div>
            <button type="button" class="survi-fslot" data-fslot="fuel" title="Combustible"></button>
          </div>
          <div class="survi-furnace-arrow"><div class="survi-furnace-arrow-fill"></div></div>
          <button type="button" class="survi-fslot survi-fslot-out" data-fslot="out" title="Resultado"></button>
        </div>
        <p class="survi-station-sub">Tocá algo de tu inventario para meterlo al horno. Tocá un casillero para sacarlo.</p>
        <div class="survi-station-inv survi-furnace-inv"></div>
        <button class="btn-game-secondary" data-act="station-close">Cerrar</button>
      </div>
    </div>

    <!-- ── Cofre ── -->
    <div class="modal-game survi-screen survi-chest hidden">
      <div class="modal-game-box survi-station-box">
        <h2 class="modal-game-title">Cofre</h2>
        <p class="survi-station-label survi-chest-label"></p>
        <div class="survi-station-inv survi-chest-grid"></div>
        <p class="survi-station-label">Tu inventario</p>
        <div class="survi-station-inv survi-chest-inv"></div>
        <p class="survi-station-sub">Tocá un ítem para pasarlo de un lado al otro.</p>
        <button class="btn-game-secondary" data-act="station-close">Cerrar</button>
      </div>
    </div>

    <!-- ── Pausa ── -->
    <div class="modal-game survi-screen survi-pause hidden">
      <div class="modal-game-box">
        <h2 class="modal-game-title">Pausa</h2>
        <p class="modal-game-sub survi-pause-info"></p>
        <button class="btn-game-primary" data-act="resume">Continuar</button>
        <button class="btn-game-secondary" data-act="settings">Ajustes</button>
        <button class="btn-game-secondary" data-act="save">Guardar partida</button>
        <button class="btn-game-secondary" data-act="to-menu">Volver al menú</button>
      </div>
    </div>

    <!-- ── Muerte ── -->
    <div class="modal-game survi-screen survi-death hidden">
      <div class="modal-game-box">
        <h2 class="modal-game-title survi-death-title">TE MORISTE</h2>
        <p class="modal-game-sub survi-death-time"></p>
        <button class="btn-game-primary" data-act="respawn">Respawn</button>
        <button class="btn-game-secondary" data-act="to-menu">Volver al menú</button>
      </div>
    </div>
  `;

  const q = (sel) => root.querySelector(sel);
  const ui = {
    root,
    canvas: q('.survi-canvas'),
    hud: q('.survi-hud'),
    pauseBtn: q('.survi-pause-btn'),
    invBtn: q('.survi-inv-btn'),
    hotbar: q('.survi-hotbar'),
    hpBar: q('.survi-health-bar i'),
    hpText: q('.survi-health-text'),
    hungerBar: q('.survi-hunger-bar i'),
    hungerText: q('.survi-hunger-text'),
    touch: q('.survi-touch'),
    touchMode: q('.survi-touch-mode'),
    screens: {
      cover: q('.survi-cover'),
      worlds: q('.survi-worlds'),
      mode: q('.survi-mode'),
      settings: q('.survi-settings'),
      howto: q('.survi-howto'),
      inv: q('.survi-inv'),
      equip: q('.survi-equip'),
      craft: q('.survi-craft'),
      furnace: q('.survi-furnace'),
      chest: q('.survi-chest'),
      pause: q('.survi-pause'),
      death: q('.survi-death')
    },
    worldsList: q('.survi-worlds-list'),
    modeTitle: q('.survi-mode-title'),
    invGrid: q('.survi-inv-grid'),
    invSlotNum: q('.survi-inv-slot'),
    invCount: q('.survi-inv-count'),
    equipChar: q('.survi-equip-char'),
    equipSlots: q('.survi-equip-slots'),
    equipList: q('.survi-equip-list'),
    craftTabs: q('.survi-craft-tabs'),
    craftList: q('.survi-craft-list'),
    craftDetail: q('.survi-craft-detail'),
    craftTitle: q('.survi-craft-title'),
    craftHint: q('.survi-craft-hint'),
    furnaceSlots: { in: q('[data-fslot="in"]'), fuel: q('[data-fslot="fuel"]'), out: q('[data-fslot="out"]') },
    furnaceFire: q('.survi-furnace-fire-fill'),
    furnaceArrow: q('.survi-furnace-arrow-fill'),
    furnaceInv: q('.survi-furnace-inv'),
    chestLabel: q('.survi-chest-label'),
    chestGrid: q('.survi-chest-grid'),
    chestInv: q('.survi-chest-inv'),
    toast: q('.survi-toast'),
    pauseInfo: q('.survi-pause-info'),
    deathTime: q('.survi-death-time'),
    deathRespawn: q('[data-act="respawn"]'),
    settingsContent: q('.survi-settings-content'),
    qualitySlot: q('.survi-quality-slot'),
    musicRange: q('#surviMusicVol'),
    musicVal: q('.survi-music-val'),
    sfxRange: q('#surviSfxVol'),
    sfxVal: q('.survi-sfx-val'),
    coverImg: q('.survi-cover-img')
  };

  // La portada todavía no existe: si el archivo no está, se oculta el
  // <img> y queda el placeholder de atrás (no un ícono roto).
  ui.coverImg.addEventListener('error', () => { ui.coverImg.style.display = 'none'; });

  // Render de hotbar e inventario: viven acá (DOM) y el juego solo los
  // dispara. Los íconos se recortan de los mismos atlas que usa el canvas
  // — los bloques de tiles.png y las herramientas de tools-icon.png.
  ui.renderHotbar = (game) => renderHotbar(ui, game);
  ui.renderInventory = (game) => renderInventory(ui, game);
  ui.renderEquip = (game) => renderEquip(ui, game);
  ui.renderCraft = (game) => renderCraft(ui, game);
  ui.renderFurnace = (game, barsOnly) => renderFurnace(ui, game, barsOnly);
  ui.renderChest = (game) => renderChest(ui, game);
  ui.showToast = (msg) => showToast(ui, msg);
  // Sprite del personaje en la pantalla de Equipamiento: un recorte fijo
  // (el frame "idle") del mismo sheet que usa el canvas.
  ui.equipChar.style.cssText = charSpriteStyle(72);

  return ui;
}

let _toastTimer = null;
function showToast(ui, msg) {
  if (!ui.toast) return;
  ui.toast.textContent = msg;
  ui.toast.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => ui.toast.classList.add('hidden'), 1800);
}

// Muestra una sola pantalla (o ninguna, con null = en partida).
export function showScreen(ui, name) {
  for (const key of Object.keys(ui.screens)) {
    ui.screens[key].classList.toggle('hidden', key !== name);
  }
  // El HUD solo se ve jugando o con la pausa/inventario/equipo/crafteo encima.
  const inGame = name === null || name === 'pause' || name === 'inv' ||
                 name === 'equip' || name === 'craft' || name === 'death' ||
                 name === 'furnace' || name === 'chest';
  ui.hud.classList.toggle('hidden', !inGame);
  ui.touch.classList.toggle('hidden', name !== null);
}

// Tarjetas de los 3 puntos de guardado.
// "hace 5 min" / "hace 3 h" / "hace 2 días"
function timeAgo(ts) {
  if (!ts) return '';
  const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

export function renderWorlds(ui, slots, { onPick, onDelete }) {
  ui.worldsList.innerHTML = '';
  for (const s of slots) {
    const card = document.createElement('div');
    const hard = s.mode === 'hardcore';
    card.className = 'survi-world-card' + (s.exists ? ' used' : ' empty') + (hard ? ' hardcore' : '');
    if (s.exists && s.biome) card.dataset.biome = s.biome;

    let info;
    if (s.exists) {
      const biome = BIOMES[s.biome];
      info = `
        <b class="survi-world-name">Mundo ${s.slot}</b>
        <span class="survi-world-tags">
          <span class="survi-tag ${hard ? 'tag-hard' : 'tag-normal'}">${icon(hard ? 'skull' : 'leaf')}${hard ? 'Hardcore' : 'Normal'}</span>
          ${biome ? `<span class="survi-tag tag-biome">${icon(BIOME_ICON[s.biome] || 'globe')}${biome.label}</span>` : ''}
        </span>
        <span class="survi-world-stats">
          <span>${icon('clock')}${fmtTime(s.playedMs)}</span>
          ${s.savedAt ? `<span>${icon('history')}${timeAgo(s.savedAt)}</span>` : ''}
        </span>`;
    } else {
      info = `
        <b class="survi-world-name">Mundo ${s.slot}</b>
        <span class="survi-world-empty-text">Espacio libre · creá un mundo nuevo</span>`;
    }

    card.innerHTML = `
      <button type="button" class="survi-world-main">
        <span class="survi-world-num">${s.exists ? s.slot : icon('plus', { stroke: 3 })}</span>
        <span class="survi-world-info">${info}</span>
        <span class="survi-world-go">${icon(s.exists ? 'play' : 'chevronRight', { fill: s.exists })}</span>
      </button>
      ${s.exists ? `<button type="button" class="survi-world-del" title="Borrar mundo" aria-label="Borrar Mundo ${s.slot}">${icon('trash')}</button>` : ''}
    `;
    card.querySelector('.survi-world-main').addEventListener('click', () => onPick(s));
    const del = card.querySelector('.survi-world-del');
    if (del) del.addEventListener('click', (e) => { e.stopPropagation(); onDelete(s); });
    ui.worldsList.appendChild(card);
  }
}


// ─── Íconos ───
// Un bloque se dibuja con su propia textura del tileset; una herramienta,
// con su sprite chico del sheet de ítems.
export function itemIconStyle(itemId, px) {
  const info = ITEM_INFO[itemId];
  if (!info) return '';
  if (info.sprite) return itemSpriteStyle(info.sprite, px);
  return tileIconStyle(info.place || itemId, px);
}

// Recorte del sprite del personaje (el "idle") para la pantalla de
// Equipamiento. PLAYER.fw/fh NO son cuadrados (24x36), así que esto es
// aparte de itemIconStyle/tileIconStyle (esas sí asumen
// celdas cuadradas) — se fija el ancho en `px` y el alto sale
// proporcional al sprite real, para no deformarlo.
function charSpriteStyle(px) {
  const frame = Array.isArray(PLAYER.frames.idle) ? PLAYER.frames.idle[0] : PLAYER.frames.idle;
  const col = frame % PLAYER.cols, row = Math.floor(frame / PLAYER.cols);
  const k = px / PLAYER.fw;
  const w = PLAYER.cols * PLAYER.fw * k, h = PLAYER.rows * PLAYER.fh * k;
  return `background-image:url('${PLAYER.src}');` +
         `background-size:${w}px ${h}px;` +
         `background-position:${-col * PLAYER.fw * k}px ${-row * PLAYER.fh * k}px;` +
         `background-repeat:no-repeat;image-rendering:pixelated;` +
         `width:${px}px;height:${px * (PLAYER.fh / PLAYER.fw)}px;`;
}

// Ícono de un ítem para un cell/slot, como HTML (no solo el estilo):
// los ítems de equipo (armadura, mochila…) todavía no tienen sprite
// propio, así que se muestran con el emoji de su slot como placeholder
// — mismo criterio que la portada (survi-cover-fallback), que muestra
// texto hasta que exista el PNG real.
function iconMarkup(id, px) {
  const info = ITEM_INFO[id];
  if (!info) return '';
  if (info.equip && !info.sprite) {
    return `<span class="survi-equip-icon" style="font-size:${Math.round(px * 0.75)}px">${icon(EQUIP_SLOT_ICON[info.equip])}</span>`;
  }
  return `<span class="survi-slot-icon" style="${itemIconStyle(id, px)}"></span>`;
}

function renderHotbar(ui, game) {
  ui.hotbar.innerHTML = '';
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const id = game.hotbarSlots[i];
    const info = id ? ITEM_INFO[id] : null;
    const count = id ? (game.inventory[id] || 0) : 0;
    const slot = document.createElement('div');
    slot.className = 'survi-slot' + (i === game.selectedSlot ? ' selected' : '');
    // Las herramientas no se apilan: no tiene sentido mostrarles "1".
    const showCount = info && !info.tool && count > 1;
    slot.innerHTML = `
      <span class="survi-slot-key">${i + 1}</span>
      ${info ? iconMarkup(id, 20) : ''}
      ${showCount ? `<span class="survi-slot-count">${count}</span>` : ''}
    `;
    slot.title = info ? info.name : '';
    slot.addEventListener('click', () => {
      game.selectedSlot = i;
      ui.renderHotbar(game);
      if (game.invOpen) ui.renderInventory(game);
    });
    ui.hotbar.appendChild(slot);
  }
}

// Inventario GENERAL: 10 huecos (14 con mochila puesta), aparte de los 8
// de la hotbar — los ítems ya asignados a la hotbar NO se listan acá de
// nuevo (antes sí, mostraba todo junto; ahora cada ítem vive en un solo
// lado a la vez). Los que están equipados tampoco aparecen: salieron del
// inventario en cuanto se equiparon (ver SurviGame.equipItem).
function renderInventory(ui, game) {
  const ids = Object.keys(game.inventory).map(Number)
    .filter(id => (game.inventory[id] || 0) > 0 && ITEM_INFO[id] && !game.hotbarSlots.includes(id));
  ui.invSlotNum.textContent = String(game.selectedSlot + 1);
  const cap = game.generalSlotCap;
  if (ui.invCount) ui.invCount.textContent = `(${ids.length}/${cap})`;

  ui.invGrid.innerHTML = '';
  if (!ids.length) {
    ui.invGrid.innerHTML = '<p class="survi-inv-empty">Vacío — rompé bloques con clic izquierdo.</p>';
  } else {
    // Primero las herramientas, después los bloques.
    ids.sort((a, b) => (ITEM_INFO[b].tool ? 1 : 0) - (ITEM_INFO[a].tool ? 1 : 0) || a - b);
    for (const id of ids) {
      const info = ITEM_INFO[id];
      const cell = document.createElement('button');
      cell.className = 'survi-inv-cell' + (game.hotbarSlots[game.selectedSlot] === id ? ' selected' : '');
      cell.title = info.name;
      cell.innerHTML = `
        ${iconMarkup(id, 26)}
        <span class="survi-inv-name">${info.name}</span>
        ${info.tool ? '' : `<span class="survi-inv-count">${game.inventory[id]}</span>`}
      `;
      cell.addEventListener('click', () => {
        const prev = game.hotbarSlots.indexOf(id);
        if (prev !== -1) game.hotbarSlots[prev] = null;
        game.hotbarSlots[game.selectedSlot] = id;
        ui.renderHotbar(game);
        ui.renderInventory(game);
      });
      ui.invGrid.appendChild(cell);
    }
  }
  // Huecos vacíos: así se ve de un vistazo cuánto cupo queda, no solo el
  // número del contador de arriba.
  for (let i = ids.length; i < cap; i++) {
    const empty = document.createElement('div');
    empty.className = 'survi-inv-cell survi-inv-cell-empty';
    ui.invGrid.appendChild(empty);
  }
}

// ═══════════ Equipamiento ═══════════
// Izquierda: sprite del personaje + los 6 huecos (casco/pecho/pantalón/
// botas/mochila/especial). Derecha: los ítems del inventario que se
// pueden equipar (los que tienen ITEM_INFO[id].equip), para tocar y
// mandarlos a su hueco. Tocar un hueco ya ocupado lo desequipa.
function renderEquip(ui, game) {
  ui.equipSlots.innerHTML = '';
  for (const s of EQUIP_SLOTS) {
    const id = game.equipment[s.key];
    const info = id ? ITEM_INFO[id] : null;
    const btn = document.createElement('button');
    btn.className = 'survi-equip-slot' + (info ? ' filled' : '');
    btn.title = info ? `${info.name} (tocar para desequipar)` : s.label;
    btn.innerHTML = info
      ? `${iconMarkup(id, 28)}<span class="survi-equip-slot-label">${s.label}</span>`
      : `<span class="survi-equip-slot-icon survi-equip-slot-icon-empty">${icon(s.icon)}</span><span class="survi-equip-slot-label">${s.label}</span>`;
    btn.addEventListener('click', () => {
      if (game.equipment[s.key]) game.unequipItem(s.key);
      renderEquip(ui, game);
    });
    ui.equipSlots.appendChild(btn);
  }

  // Lista de la derecha: cosas equipables que tenés sueltas en el
  // inventario general o en la hotbar (cualquiera de los dos: equipar
  // algo que por ahí quedó en la hotbar también tiene que funcionar).
  const equippableIds = Object.keys(game.inventory).map(Number)
    .filter(id => (game.inventory[id] || 0) > 0 && ITEM_INFO[id] && ITEM_INFO[id].equip);
  ui.equipList.innerHTML = '';
  if (!equippableIds.length) {
    ui.equipList.innerHTML = '<p class="survi-equip-empty">No tenés nada equipable en el inventario — crafteá armadura o una mochila.</p>';
    return;
  }
  for (const id of equippableIds) {
    const info = ITEM_INFO[id];
    const cell = document.createElement('button');
    cell.className = 'survi-inv-cell';
    cell.title = `Equipar ${info.name}`;
    cell.innerHTML = `${iconMarkup(id, 26)}<span class="survi-inv-name">${info.name}</span>`;
    cell.addEventListener('click', () => {
      game.equipItem(id);
      renderEquip(ui, game);
    });
    ui.equipList.appendChild(cell);
  }
}

// ═══════════ Craftear ═══════════
// Izquierda: la lista de recetas posibles (icono + nombre + lo que
// piden en chiquito). Derecha: el detalle de la receta elegida — cada
// material con cuánto pedís, cuánto tenés (en verde si alcanza, en rojo
// si no) y el botón para craftear (deshabilitado si falta algo).
function recipeResultName(recipe) {
  const info = ITEM_INFO[recipe.result];
  return info ? info.name : `Receta ${recipe.id}`;
}

function ingredientLabel(ing) {
  if (ing.label) return `${ing.qty}× ${ing.label}`;
  const ids = ing.anyOf || [ing.id];
  const names = ids.map(id => (ITEM_INFO[id] ? ITEM_INFO[id].name : `#${id}`));
  return `${ing.qty}× ${names.join(' / ')}`;
}

// Pestañas por categoría (Básicos, Herramientas, Armas…). En cada una,
// primero lo que ya podés craftear.
let craftCat = CRAFT_CATS[0].key;
function renderCraft(ui, game) {
  // Desde el inventario solo lo simple; en la mesa de crafteo, todo.
  const atTable = game.craftStation === 'table';
  const available = RECIPES.filter(r => atTable || r.station === 'hand');
  ui.craftTitle.textContent = atTable ? 'Mesa de crafteo' : 'Craftear';
  ui.craftHint.textContent = atTable ? '' : 'Herramientas, armas, armadura, horno y cofre se hacen en una mesa de crafteo.';
  ui.craftHint.classList.toggle('hidden', atTable);
  const cats = CRAFT_CATS.filter(c => available.some(r => r.cat === c.key));
  if (!cats.some(c => c.key === craftCat)) craftCat = cats[0].key;
  ui.craftTabs.innerHTML = '';
  for (const c of cats) {
    const tab = document.createElement('button');
    const n = available.filter(r => r.cat === c.key && canCraft(game.inventory, r)).length;
    tab.className = 'survi-craft-tab' + (c.key === craftCat ? ' active' : '');
    tab.innerHTML = `${c.label}${n ? `<span class="survi-craft-tab-n">${n}</span>` : ''}`;
    tab.addEventListener('click', () => { craftCat = c.key; ui.craftDetail.innerHTML = '<p class="survi-craft-empty">Elegí algo de la lista para ver qué pide.</p>'; renderCraft(ui, game); });
    ui.craftTabs.appendChild(tab);
  }
  ui.craftList.innerHTML = '';
  const list = available.filter(r => r.cat === craftCat)
    .map(r => ({ r, ok: canCraft(game.inventory, r) }))
    .sort((a, b) => (b.ok - a.ok));
  for (const { r: recipe, ok } of list) {
    const row = document.createElement('button');
    row.className = 'survi-craft-row' + (ok ? ' can-craft' : '');
    row.innerHTML = `
      ${iconMarkup(recipe.result, 26)}
      <span class="survi-craft-row-info">
        <span class="survi-craft-row-name">${recipeResultName(recipe)}${recipe.resultQty > 1 ? ` ×${recipe.resultQty}` : ''}</span>
        <span class="survi-craft-row-cost">${recipe.inputs.map(ingredientLabel).join(', ')}</span>
      </span>
    `;
    row.addEventListener('click', () => {
      ui.craftList.querySelectorAll('.survi-craft-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      renderCraftDetail(ui, game, recipe);
    });
    ui.craftList.appendChild(row);
  }
}

// ═══════════ Horno / cofre ═══════════
function stackButton(id, qty, onClick, px = 30) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'survi-sitem';
  b.title = ITEM_INFO[id] ? ITEM_INFO[id].name : '';
  b.innerHTML = `${iconMarkup(id, px)}<span class="survi-sitem-qty">${qty}</span>`;
  b.addEventListener('click', onClick);
  return b;
}

const FSLOT_LABEL = { in: 'Cocinar', fuel: 'Carbón', out: 'Listo' };
function renderFurnace(ui, game, barsOnly) {
  const f = game.openFurnace;
  if (!f) return;
  for (const k of ['in', 'fuel', 'out']) {
    const el = ui.furnaceSlots[k], st = f[k];
    const sig = st ? `${st.id}:${st.qty}` : '';
    if (el.dataset.sig !== sig) {           // solo se toca el DOM si cambió
      el.dataset.sig = sig;
      el.innerHTML = st
        ? `${iconMarkup(st.id, 32)}<span class="survi-sitem-qty">${st.qty}</span>`
        : `<span class="survi-fslot-empty">${FSLOT_LABEL[k]}</span>`;
      el.classList.toggle('filled', !!st);
    }
    el.onclick = () => game.furnaceTake(k);
  }
  ui.furnaceFire.style.height = (f.burnMax ? Math.round(100 * f.burn / f.burnMax) : 0) + '%';
  ui.furnaceArrow.style.width = Math.round(100 * Math.min(1, f.prog / SMELT_MS)) + '%';
  if (barsOnly) return;
  ui.furnaceInv.innerHTML = '';
  const ids = Object.keys(game.inventory).map(Number).filter(id => SMELT[id] || FUEL[id]);
  if (!ids.length) {
    ui.furnaceInv.innerHTML = '<p class="survi-station-empty">No tenés nada para cocinar o fundir, ni carbón.</p>';
    return;
  }
  for (const id of ids) ui.furnaceInv.appendChild(stackButton(id, game.inventory[id], () => game.furnaceInsert(id)));
}

function renderChest(ui, game) {
  const c = game.openChest;
  if (!c) return;
  const keys = Object.keys(c).map(Number);
  ui.chestLabel.textContent = `Cofre (${keys.length}/${CHEST_SLOTS})`;
  ui.chestGrid.innerHTML = '';
  if (!keys.length) ui.chestGrid.innerHTML = '<p class="survi-station-empty">Vacío</p>';
  for (const id of keys) ui.chestGrid.appendChild(stackButton(id, c[id], () => game.chestTake(id)));
  ui.chestInv.innerHTML = '';
  const inv = Object.keys(game.inventory).map(Number);
  if (!inv.length) ui.chestInv.innerHTML = '<p class="survi-station-empty">Tu inventario está vacío</p>';
  for (const id of inv) ui.chestInv.appendChild(stackButton(id, game.inventory[id], () => game.chestPut(id)));
}

function renderCraftDetail(ui, game, recipe) {
  const rows = recipe.inputs.map(ing => {
    const have = ingredientHave(game.inventory, ing);
    const enough = have >= ing.qty;
    const ids = ing.anyOf || [ing.id];
    const names = ing.label || ids.map(id => (ITEM_INFO[id] ? ITEM_INFO[id].name : `#${id}`)).join(' / ');
    return `
      <div class="survi-craft-ing ${enough ? 'have' : 'missing'}">
        <span class="survi-craft-ing-name">${names}</span>
        <span class="survi-craft-ing-qty">${have}/${ing.qty}</span>
      </div>
    `;
  }).join('');

  const ok = canCraft(game.inventory, recipe);
  ui.craftDetail.innerHTML = `
    <div class="survi-craft-detail-head">
      ${iconMarkup(recipe.result, 32)}
      <span class="survi-craft-detail-name">${recipeResultName(recipe)}</span>
    </div>
    <div class="survi-craft-ings">${rows}</div>
    <button class="btn-game-primary survi-craft-btn" ${ok ? '' : 'disabled'}>Craftear</button>
  `;
  const btn = ui.craftDetail.querySelector('.survi-craft-btn');
  btn.addEventListener('click', () => {
    const res = game.craftItem(recipe.id);
    if (res.ok) {
      renderCraftDetail(ui, game, recipe); // refresca cantidades tras gastar materiales
      renderCraft(ui, game);               // refresca la lista (por si ahora falta/alcanza otra receta)
      if (ui.showToast) ui.showToast(`Crafteaste: ${recipeResultName(recipe)}`);
    } else if (res.reason === 'full' && ui.showToast) {
      ui.showToast('Inventario lleno — no entra el resultado');
    }
  });
}
