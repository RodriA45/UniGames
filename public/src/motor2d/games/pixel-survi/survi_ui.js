// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_ui.js
//   Arma TODO el DOM del juego dentro del contenedor y devuelve las
//   referencias. No tiene lógica de juego: solo estructura, mostrar/
//   ocultar pantallas y pintar las tarjetas de los 3 mundos.
//
//   Usa las clases de ui-components.css (modal-game, btn-game-*,
//   game-icon-btn, game-slider-row) para no reinventar estilos.
// ══════════════════════════════════════════════════════════════

import { MAX_HP, COVER_SRC, MODES, ITEM_INFO, HOTBAR_SIZE } from './survi_config.js';
import { fmtTime } from './survi_save.js';
import { tileIconStyle, toolIconStyle } from './models/sprites.js';

// Nombres de pantalla válidos para showScreen()
export const SCREENS = ['cover', 'worlds', 'mode', 'settings', 'howto', 'pause', 'death', 'inv'];

export function buildLayout(root) {
  root.classList.add('survi-root');
  root.innerHTML = `
    <canvas class="survi-canvas"></canvas>

    <!-- ── HUD en partida ── -->
    <div class="survi-hud hidden">
      <div class="survi-hud-top">
        <button class="game-icon-btn survi-pause-btn" title="Pausa (Esc)">⏸</button>
        <button class="game-icon-btn survi-inv-btn" title="Inventario (I)">I</button>
      </div>
      <div class="survi-hud-bottom">
        <div class="survi-health" title="Vida">
          <span class="survi-health-heart">♥</span>
          <div class="survi-health-bar"><i></i></div>
          <span class="survi-health-text">${MAX_HP}/${MAX_HP}</span>
        </div>
        <div class="survi-hotbar"></div>
      </div>
    </div>

    <!-- ── Controles táctiles ── -->
    <div class="survi-touch hidden">
      <div class="survi-touch-move">
        <button class="game-icon-btn" data-touch="left">◀</button>
        <button class="game-icon-btn" data-touch="right">▶</button>
      </div>
      <div class="survi-touch-right">
        <button class="game-icon-btn survi-touch-mode" title="Romper / Colocar">⛏</button>
        <button class="game-icon-btn survi-touch-jump" data-touch="jump">⤒</button>
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
            <label for="surviMusicVol">🎵 Música</label>
            <input id="surviMusicVol" type="range" min="0" max="100" step="1">
            <span class="game-slider-value survi-music-val">70%</span>
          </div>
          <div class="game-slider-row">
            <label for="surviSfxVol">🔊 Efectos</label>
            <input id="surviSfxVol" type="range" min="0" max="100" step="1">
            <span class="game-slider-value survi-sfx-val">70%</span>
          </div>
          <div class="game-fullscreen-row survi-fullscreen-row">
            <button class="game-fullscreen-btn survi-fullscreen-btn" data-act="fullscreen">⛶ Pantalla completa</button>
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
        </div>
        <button class="btn-game-secondary" data-act="back-cover">Volver</button>
      </div>
    </div>

    <!-- ── Inventario ── -->
    <div class="modal-game survi-screen survi-inv hidden">
      <div class="modal-game-box survi-inv-box">
        <h2 class="modal-game-title">Inventario</h2>
        <div class="survi-inv-grid"></div>
        <p class="survi-inv-hint">Clic en un ítem para ponerlo en el slot #<span class="survi-inv-slot">1</span>.</p>
        <button class="btn-game-primary" data-act="close-inv">Cerrar (I)</button>
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
    touch: q('.survi-touch'),
    touchMode: q('.survi-touch-mode'),
    screens: {
      cover: q('.survi-cover'),
      worlds: q('.survi-worlds'),
      mode: q('.survi-mode'),
      settings: q('.survi-settings'),
      howto: q('.survi-howto'),
      inv: q('.survi-inv'),
      pause: q('.survi-pause'),
      death: q('.survi-death')
    },
    worldsList: q('.survi-worlds-list'),
    modeTitle: q('.survi-mode-title'),
    invGrid: q('.survi-inv-grid'),
    invSlotNum: q('.survi-inv-slot'),
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

  return ui;
}

// Muestra una sola pantalla (o ninguna, con null = en partida).
export function showScreen(ui, name) {
  for (const key of Object.keys(ui.screens)) {
    ui.screens[key].classList.toggle('hidden', key !== name);
  }
  // El HUD solo se ve jugando o con la pausa/inventario encima.
  const inGame = name === null || name === 'pause' || name === 'inv' || name === 'death';
  ui.hud.classList.toggle('hidden', !inGame);
  ui.touch.classList.toggle('hidden', name !== null);
}

// Tarjetas de los 3 puntos de guardado.
export function renderWorlds(ui, slots, { onPick, onDelete }) {
  ui.worldsList.innerHTML = '';
  for (const s of slots) {
    const card = document.createElement('div');
    card.className = 'survi-world-card' + (s.exists ? ' used' : '');
    const modeLabel = s.mode === 'hardcore' ? '☠ Hardcore' : '🌱 Normal';
    card.innerHTML = `
      <div class="survi-world-main">
        <b>Mundo ${s.slot}</b>
        <span>${s.exists ? `${modeLabel} · ${fmtTime(s.playedMs)} jugado` : 'Vacío — mundo nuevo'}</span>
      </div>
      ${s.exists ? '<button class="survi-world-del" title="Borrar mundo">🗑</button>' : ''}
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
  if (info.tool) return toolIconStyle(info.tool, info.mat, px);
  return tileIconStyle(info.place || itemId, px);
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
      ${info ? `<span class="survi-slot-icon" style="${itemIconStyle(id, 20)}"></span>` : ''}
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

function renderInventory(ui, game) {
  const ids = Object.keys(game.inventory).map(Number)
    .filter(id => (game.inventory[id] || 0) > 0 && ITEM_INFO[id]);
  ui.invSlotNum.textContent = String(game.selectedSlot + 1);

  if (!ids.length) {
    ui.invGrid.innerHTML = '<p class="survi-inv-empty">Vacío — rompé bloques con clic izquierdo.</p>';
    return;
  }
  ui.invGrid.innerHTML = '';
  // Primero las herramientas, después los bloques.
  ids.sort((a, b) => (ITEM_INFO[b].tool ? 1 : 0) - (ITEM_INFO[a].tool ? 1 : 0) || a - b);
  for (const id of ids) {
    const info = ITEM_INFO[id];
    const cell = document.createElement('button');
    cell.className = 'survi-inv-cell' + (game.hotbarSlots[game.selectedSlot] === id ? ' selected' : '');
    cell.title = info.name;
    cell.innerHTML = `
      <span class="survi-inv-icon" style="${itemIconStyle(id, 26)}"></span>
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
