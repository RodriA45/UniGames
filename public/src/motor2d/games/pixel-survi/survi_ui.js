// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_ui.js
//   Clase SurviUI: arma TODO el DOM del juego dentro del contenedor y
//   guarda las referencias como campos (ui.hotbar, ui.screens, …). No
//   tiene lógica de juego: solo estructura, mostrar/ocultar pantallas y
//   pintar hotbar, inventario, equipo, crafteo, horno, cofre y mundos.
//   El juego la recibe por constructor (new SurviGame(ui)) y llama a sus
//   métodos: ui.showScreen('pause'), ui.renderHotbar(game), …
//
//   Usa las clases de ui-components.css (modal-game, btn-game-*,
//   game-icon-btn, game-slider-row) para no reinventar estilos.
// ══════════════════════════════════════════════════════════════

import { SpritesSurvi } from './models/sprites-survi.js';
import { SurviConfig } from './survi_config.js';
import { Arrastre } from './survi_arrastre.js';
import { Iconos } from './survi_icons.js';
import { GestorGuardado } from './survi_save.js';

export class SurviUI {
  // Nombres de pantalla válidos para showScreen()
  static SCREENS = [
    'cover',
    'worlds',
    'mode',
    'settings',
    'howto',
    'pause',
    'death',
    'inv',
    'equip',
    'craft',
    'furnace',
    'chest',
  ];
  constructor(root) {
    root.classList.add('survi-root');
    root.innerHTML = `
      <canvas class="survi-canvas"></canvas>

      <!-- Aviso corto (ej. "Inventario lleno") — lo dispara this.showToast(). -->
      <div class="survi-toast hidden"></div>

      <!-- ── HUD en partida ── -->
      <div class="survi-hud hidden">
        <div class="survi-hud-top">
          <button class="game-icon-btn survi-pause-btn" title="Pausa (Esc)">⏸</button>
          <button class="game-icon-btn survi-inv-btn" title="Inventario (I)">I</button>
        </div>
        <div class="survi-hud-bottom">
          <div class="survi-air hidden" title="Aire"></div>
          <div class="survi-health" title="Vida">
            <span class="survi-health-heart">${Iconos.icon('heart', {
              fill: true,
            })}</span>
            <div class="survi-health-bar"><i></i></div>
            <span class="survi-health-text">${SurviConfig.MAX_HP}/${SurviConfig.MAX_HP}</span>
          </div>
          <div class="survi-hunger" title="Hambre">
            <span class="survi-hunger-icon">${Iconos.icon('drumstick')}</span>
            <div class="survi-hunger-bar"><i></i></div>
            <span class="survi-hunger-text">${SurviConfig.MAX_HUNGER}/${SurviConfig.MAX_HUNGER}</span>
          </div>
          <div class="survi-hotbar"></div>
        </div>
      </div>

      <!-- ── Controles táctiles ── -->
      <div class="survi-touch hidden">
        <div class="survi-touch-move">
          <button class="game-icon-btn" data-touch="left">${Iconos.icon('chevronLeft', {
            stroke: 3,
          })}</button>
          <button class="game-icon-btn" data-touch="right">${Iconos.icon('chevronRight', {
            stroke: 3,
          })}</button>
        </div>
        <div class="survi-touch-right">
          <button class="game-icon-btn survi-touch-mode" title="Romper / Colocar">${Iconos.icon('pickaxe')}</button>
          <button class="game-icon-btn survi-touch-jump" data-touch="jump">${Iconos.icon('arrowUp', {
            stroke: 3,
          })}</button>
        </div>
      </div>

      <!-- ── Menú principal (portada) ── -->
      <div class="modal-game survi-screen survi-cover">
        <div class="modal-game-box">
          <div class="survi-cover-art">
            <img class="survi-cover-img" alt="" src="${SurviConfig.COVER_SRC}">
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
            ${SurviConfig.MODES.normal.label}
            <small>${SurviConfig.MODES.normal.desc}</small>
          </button>
          <button class="btn-game-secondary survi-hardcore-btn" data-act="mode-hardcore">
            ${SurviConfig.MODES.hardcore.label}
            <small>${SurviConfig.MODES.hardcore.desc}</small>
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
              <label for="surviMusicVol">${Iconos.icon('music')} Música</label>
              <input id="surviMusicVol" type="range" min="0" max="100" step="1">
              <span class="game-slider-value survi-music-val">70%</span>
            </div>
            <div class="game-slider-row">
              <label for="surviSfxVol">${Iconos.icon('volume')} Efectos</label>
              <input id="surviSfxVol" type="range" min="0" max="100" step="1">
              <span class="game-slider-value survi-sfx-val">70%</span>
            </div>
            <div class="game-fullscreen-row survi-autosalto-row">
              <button class="game-fullscreen-btn survi-autosalto-btn" data-act="autosalto">${Iconos.icon('arrowUp')} Salto automático: <b class="survi-autosalto-val">Sí</b></button>
            </div>
            <div class="game-fullscreen-row survi-fullscreen-row">
              <button class="game-fullscreen-btn survi-fullscreen-btn" data-act="fullscreen">${Iconos.icon('maximize')} Pantalla completa</button>
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
            <div class="game-info-row">${Iconos.icon('drumstick')} El hambre baja solo. Rompé hojas para conseguir comida y comela con <b>clic derecho</b>. En 0 empieza a sacarte vida; bien alimentado, la regenerás de a poco.</div>
            <div class="game-info-row">De día aparecen <b>animales</b> en la superficie: la <b>vaca</b> da cuero y carne, el <b>cerdo</b> carne y la <b>gallina</b> huevos. No atacan: si les pegás, huyen. La carne y los huevos se cocinan en el horno; el cuero sirve para la armadura de cuero.</div>
            <div class="game-info-row">Hay <b>agua</b> (lagos y pozos en las cuevas) y <b>lava</b> (en lo más hondo). Adentro nadás: mantené <b>saltar</b> para subir. Bajo el agua se gasta el <b>aire</b>; sin aire te ahogás. La lava <b>quema</b> y te deja quemándote un rato (meterte al agua lo apaga). Con un <b>cubo</b> (3 lingotes de hierro, en la mesa) juntás agua o lava con clic derecho y la volcás en otro lado. Donde el agua toca lava, se forma piedra.</div>
            <div class="game-info-row"><b>Z</b> cambia el zoom (normal, cerca, lejos). En el <b>inventario (I)</b> arrastrá los ítems a la barra de abajo para usarlos, o entre huecos para ordenarlos.</div>
            <div class="game-info-row">Con un <b>arco</b> en la mano, clic izquierdo dispara hacia el mouse (cada tiro gasta una flecha). Hay 3 arcos: el mejor hace más daño, dispara más rápido y dura más. Las flechas que se clavan en un bloque se juntan pasando por encima. El <b>hilo</b> se hace con hojas.</div>
            <div class="game-info-row">Las <b>herramientas</b> se gastan al romper bloques o pegarle a un mob, y la <b>armadura</b> al recibir golpes (las <b>botas</b>, además, con las caídas). La barrita debajo del ícono muestra cuánto les queda: al llegar a 0 se rompen. La espada pega en un arco más amplio que el resto.</div>
          </div>
          <button class="btn-game-secondary" data-act="back-cover">Volver</button>
        </div>
      </div>

      <!-- ── Inventario ── -->
      <div class="modal-game survi-screen survi-inv hidden">
        <div class="modal-game-box survi-inv-box">
          <h2 class="modal-game-title">Inventario <span class="survi-inv-count">(0/10)</span></h2>
          <div class="survi-inv-grid" data-drop="inv"></div>
          <div class="survi-inv-hotbar"></div>
          <p class="survi-inv-hint">Arrastrá los ítems a la barra para usarlos, o entre huecos para ordenarlos. Tocar un ítem lo pone en el hueco #<span class="survi-inv-slot">1</span>.</p>
          <div class="survi-inv-actions">
            <button class="btn-game-secondary" data-act="open-equip">${Iconos.icon('shield')} Equipamiento</button>
            <button class="btn-game-secondary" data-act="open-craft">${Iconos.icon('hammer')} Craftear</button>
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
    Object.assign(this, {
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
        death: q('.survi-death'),
      },
      worldsList: q('.survi-worlds-list'),
      modeTitle: q('.survi-mode-title'),
      invGrid: q('.survi-inv-grid'),
      invHotbar: q('.survi-inv-hotbar'),
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
      furnaceSlots: {
        in: q('[data-fslot="in"]'),
        fuel: q('[data-fslot="fuel"]'),
        out: q('[data-fslot="out"]'),
      },
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
      autoSaltoVal: q('.survi-autosalto-val'),
      aire: q('.survi-air'),
      qualitySlot: q('.survi-quality-slot'),
      musicRange: q('#surviMusicVol'),
      musicVal: q('.survi-music-val'),
      sfxRange: q('#surviSfxVol'),
      sfxVal: q('.survi-sfx-val'),
      coverImg: q('.survi-cover-img'),
    });
    // Arrastrar y soltar en el inventario (juego = el que se dibujó por última vez)
    this.juegoInv = null;
    this.arrastre = new Arrastre(this.screens.inv, {
      alSoltar: (o, d) => this.#soltarItem(o, d),
      alTocar: (o) => this.#tocarItem(o),
    });
    // La portada todavía no existe: si el archivo no está, se oculta el
    // <img> y queda el placeholder de atrás (no un ícono roto).
    this.coverImg.addEventListener('error', () => {
      this.coverImg.style.display = 'none';
    });
    // Sprite del personaje en la pantalla de Equipamiento: un recorte fijo
    // (el frame "idle") del mismo sheet que usa el canvas.
    this.equipChar.style.cssText = SurviUI.charSpriteStyle(72);
    // Estado de la UI (antes eran variables sueltas del módulo)
    this.toastTimer = null; // aviso corto en pantalla
    this.craftCat = SurviConfig.CRAFT_CATS[0].key; // pestaña elegida en el crafteo
  }

  // Burbujas de aire (solo se ven mientras te falta aire bajo el agua).
  mostrarAire(llenas, total) {
    if (!this.aire) return;
    this.aire.classList.toggle('hidden', llenas >= total);
    let html = '';
    for (let i = 0; i < total; i++) html += `<i class="${i < llenas ? 'llena' : ''}"></i>`;
    this.aire.innerHTML = html;
  }

  // Ajustes: estado del botón de salto automático.
  mostrarAutoSalto(activo) {
    if (this.autoSaltoVal) this.autoSaltoVal.textContent = activo ? 'Sí' : 'No';
  }

  showToast(msg) {
    if (!this.toast) return;
    this.toast.textContent = msg;
    this.toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.classList.add('hidden'), 1800);
  }

  // Muestra una sola pantalla (o ninguna, con null = en partida).
  showScreen(name) {
    for (const key of Object.keys(this.screens)) {
      this.screens[key].classList.toggle('hidden', key !== name);
    }
    // El HUD solo se ve jugando o con la pausa/inventario/equipo/crafteo encima.
    const inGame =
      name === null ||
      name === 'pause' ||
      name === 'inv' ||
      name === 'equip' ||
      name === 'craft' ||
      name === 'death' ||
      name === 'furnace' ||
      name === 'chest';
    this.hud.classList.toggle('hidden', !inGame);
    this.touch.classList.toggle('hidden', name !== null);
  }

  // Tarjetas de los 3 puntos de guardado.
  // "hace 5 min" / "hace 3 h" / "hace 2 días"
  static timeAgo(ts) {
    if (!ts) return '';
    const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (min < 1) return 'recién';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  }

  renderWorlds(slots, { onPick, onDelete }) {
    this.worldsList.innerHTML = '';
    for (const s of slots) {
      const card = document.createElement('div');
      const hard = s.mode === 'hardcore';
      card.className = 'survi-world-card' + (s.exists ? ' used' : ' empty') + (hard ? ' hardcore' : '');
      if (s.exists && s.biome) card.dataset.biome = s.biome;
      let info;
      if (s.exists) {
        const biome = SurviConfig.BIOMES[s.biome];
        info = `
          <b class="survi-world-name">Mundo ${s.slot}</b>
          <span class="survi-world-tags">
            <span class="survi-tag ${hard ? 'tag-hard' : 'tag-normal'}">${Iconos.icon(hard ? 'skull' : 'leaf')}${hard ? 'Hardcore' : 'Normal'}</span>
            ${biome ? `<span class="survi-tag tag-biome">${Iconos.icon(Iconos.BIOME_ICON[s.biome] || 'globe')}${biome.label}</span>` : ''}
          </span>
          <span class="survi-world-stats">
            <span>${Iconos.icon('clock')}${GestorGuardado.fmtTime(s.playedMs)}</span>
            ${s.savedAt ? `<span>${Iconos.icon('history')}${SurviUI.timeAgo(s.savedAt)}</span>` : ''}
          </span>`;
      } else {
        info = `
          <b class="survi-world-name">Mundo ${s.slot}</b>
          <span class="survi-world-empty-text">Espacio libre · creá un mundo nuevo</span>`;
      }
      card.innerHTML = `
        <button type="button" class="survi-world-main">
          <span class="survi-world-num">${
            s.exists
              ? s.slot
              : Iconos.icon('plus', {
                  stroke: 3,
                })
          }</span>
          <span class="survi-world-info">${info}</span>
          <span class="survi-world-go">${Iconos.icon(s.exists ? 'play' : 'chevronRight', {
            fill: s.exists,
          })}</span>
        </button>
        ${s.exists ? `<button type="button" class="survi-world-del" title="Borrar mundo" aria-label="Borrar Mundo ${s.slot}">${Iconos.icon('trash')}</button>` : ''}
      `;
      card.querySelector('.survi-world-main').addEventListener('click', () => onPick(s));
      const del = card.querySelector('.survi-world-del');
      if (del)
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          onDelete(s);
        });
      this.worldsList.appendChild(card);
    }
  }

  // ─── Íconos ───
  // Un bloque se dibuja con su propia textura del tileset; una herramienta,
  // con su sprite chico del sheet de ítems.
  static itemIconStyle(itemId, px) {
    const info = SurviConfig.ITEM_INFO[itemId];
    if (!info) return '';
    if (info.sprite) return SpritesSurvi.itemSpriteStyle(info.sprite, px);
    return SpritesSurvi.tileIconStyle(info.place || itemId, px);
  }

  // Recorte del sprite del personaje (el "idle") para la pantalla de
  // Equipamiento. PLAYER.fw/fh NO son cuadrados (24x36), así que esto es
  // aparte de itemIconStyle/tileIconStyle (esas sí asumen
  // celdas cuadradas) — se fija el ancho en `px` y el alto sale
  // proporcional al sprite real, para no deformarlo.
  static charSpriteStyle(px) {
    const frame = Array.isArray(SpritesSurvi.PLAYER.frames.idle)
      ? SpritesSurvi.PLAYER.frames.idle[0]
      : SpritesSurvi.PLAYER.frames.idle;
    const col = frame % SpritesSurvi.PLAYER.cols,
      row = Math.floor(frame / SpritesSurvi.PLAYER.cols);
    const k = px / SpritesSurvi.PLAYER.fw;
    const w = SpritesSurvi.PLAYER.cols * SpritesSurvi.PLAYER.fw * k,
      h = SpritesSurvi.PLAYER.rows * SpritesSurvi.PLAYER.fh * k;
    return (
      `background-image:url('${SpritesSurvi.PLAYER.src}');` +
      `background-size:${w}px ${h}px;` +
      `background-position:${-col * SpritesSurvi.PLAYER.fw * k}px ${-row * SpritesSurvi.PLAYER.fh * k}px;` +
      `background-repeat:no-repeat;image-rendering:pixelated;` +
      `width:${px}px;height:${px * (SpritesSurvi.PLAYER.fh / SpritesSurvi.PLAYER.fw)}px;`
    );
  }

  // Ícono de un ítem para un cell/slot, como HTML (no solo el estilo):
  // los ítems de equipo (armadura, mochila…) todavía no tienen sprite
  // propio, así que se muestran con el emoji de su slot como placeholder
  // — mismo criterio que la portada (survi-cover-fallback), que muestra
  // texto hasta que exista el PNG real.
  // Barrita de durabilidad abajo del ícono (solo si el ítem ya está gastado).
  // frac: 1 = nuevo, 0 = por romperse, null = no se gasta.
  static barraDurabilidad(frac) {
    if (frac === null || frac === undefined || frac >= 1) return '';
    const color = frac > 0.5 ? '#5ad16a' : frac > 0.2 ? '#e6c229' : '#e5483b';
    return `<span class="survi-dura"><span style="width:${Math.max(4, Math.round(frac * 100))}%;background:${color}"></span></span>`;
  }

  // Nombre + durabilidad para el tooltip ("Pico de hierro · 120/300").
  static tituloItem(id, frac) {
    const info = SurviConfig.ITEM_INFO[id];
    if (!info) return '';
    if (frac === null || frac === undefined || !info.durabilidad) return info.name;
    return `${info.name} · ${Math.round(frac * info.durabilidad)}/${info.durabilidad}`;
  }

  static iconMarkup(id, px) {
    const info = SurviConfig.ITEM_INFO[id];
    if (!info) return '';
    if (info.equip && !info.sprite) {
      return `<span class="survi-equip-icon" style="font-size:${Math.round(px * 0.75)}px">${Iconos.icon(SurviConfig.EQUIP_SLOT_ICON[info.equip])}</span>`;
    }
    return `<span class="survi-slot-icon" style="${SurviUI.itemIconStyle(id, px)}"></span>`;
  }

  // Una casilla de la hotbar (se usa en el HUD y en el inventario).
  static casillaHotbar(game, i, px = 20) {
    const id = game.hotbarSlots[i];
    const info = id ? SurviConfig.ITEM_INFO[id] : null;
    const count = id ? game.inventory[id] || 0 : 0;
    const slot = document.createElement('div');
    slot.className = 'survi-slot' + (i === game.selectedSlot ? ' selected' : '');
    // Las herramientas no se apilan: no tiene sentido mostrarles "1".
    // Con un arco, el número es cuántas flechas te quedan.
    const esArco = info && info.arco;
    const flechas = esArco ? game.inventory[SurviConfig.MAT.arrow] || 0 : 0;
    const showCount = info && !info.tool && !esArco && count > 1;
    const frac = id ? game.durabilidadInventario(id) : null;
    slot.innerHTML = `
      <span class="survi-slot-key">${i + 1}</span>
      ${info ? SurviUI.iconMarkup(id, px) : ''}
      ${showCount ? `<span class="survi-slot-count">${count}</span>` : ''}
      ${esArco ? `<span class="survi-slot-count${flechas ? '' : ' survi-sin-flechas'}" title="Flechas">${flechas}</span>` : ''}
      ${info ? SurviUI.barraDurabilidad(frac) : ''}
    `;
    slot.title = info ? SurviUI.tituloItem(id, frac) : '';
    return slot;
  }

  renderHotbar(game) {
    this.hotbar.innerHTML = '';
    for (let i = 0; i < SurviConfig.HOTBAR_SIZE; i++) {
      const slot = SurviUI.casillaHotbar(game, i);
      slot.addEventListener('click', () => game.seleccionarSlot(i));
      this.hotbar.appendChild(slot);
    }
  }

  // ─── Arrastrar y soltar (inventario) ───
  #soltarItem(origen, destino) {
    const game = this.juegoInv;
    if (!game || !destino) return;
    if (destino.tipo === 'hotbar') game.ponerEnHotbar(origen.id, destino.slot);
    else if (destino.tipo === 'inv' && origen.origen === 'hotbar' && !game.sacarDeHotbar(origen.slot)) {
      this.showToast('El inventario está lleno');
    }
  }

  #tocarItem(origen) {
    const game = this.juegoInv;
    if (!game) return;
    if (origen.origen === 'hotbar') game.seleccionarSlot(origen.slot);
    else if (origen.id !== null) game.ponerEnHotbar(origen.id, game.selectedSlot); // como antes: al hueco seleccionado
  }

  // Inventario GENERAL: 10 huecos (14 con mochila puesta), aparte de los 8
  // de la hotbar — los ítems ya asignados a la hotbar NO se listan acá de
  // nuevo (antes sí, mostraba todo junto; ahora cada ítem vive en un solo
  // lado a la vez). Los que están equipados tampoco aparecen: salieron del
  // inventario en cuanto se equiparon (ver SurviGame.equipItem).
  renderInventory(game) {
    this.juegoInv = game;
    if (this.arrastre && this.arrastre.arrastrando) return; // no rearmar debajo del dedo
    // la hotbar, adentro del inventario: se puede soltar en cualquier hueco
    if (this.invHotbar) {
      this.invHotbar.innerHTML = '';
      for (let i = 0; i < SurviConfig.HOTBAR_SIZE; i++) {
        const slot = SurviUI.casillaHotbar(game, i, 24);
        slot.dataset.drop = 'hotbar';
        slot.dataset.slot = String(i);
        if (game.hotbarSlots[i]) {
          slot.dataset.dragId = String(game.hotbarSlots[i]);
          slot.dataset.origen = 'hotbar';
        }
        this.invHotbar.appendChild(slot);
      }
    }
    const ids = Object.keys(game.inventory)
      .map(Number)
      .filter((id) => (game.inventory[id] || 0) > 0 && SurviConfig.ITEM_INFO[id] && !game.hotbarSlots.includes(id));
    this.invSlotNum.textContent = String(game.selectedSlot + 1);
    const cap = game.generalSlotCap;
    if (this.invCount) this.invCount.textContent = `(${ids.length}/${cap})`;
    this.invGrid.innerHTML = '';
    if (!ids.length) {
      this.invGrid.innerHTML = '<p class="survi-inv-empty">Vacío — rompé bloques con clic izquierdo.</p>';
    } else {
      // Primero las herramientas, después los bloques.
      ids.sort((a, b) => (SurviConfig.ITEM_INFO[b].tool ? 1 : 0) - (SurviConfig.ITEM_INFO[a].tool ? 1 : 0) || a - b);
      for (const id of ids) {
        const info = SurviConfig.ITEM_INFO[id];
        const cell = document.createElement('button');
        cell.className = 'survi-inv-cell' + (game.hotbarSlots[game.selectedSlot] === id ? ' selected' : '');
        const frac = game.durabilidadInventario(id);
        cell.title = SurviUI.tituloItem(id, frac);
        cell.innerHTML = `
          ${SurviUI.iconMarkup(id, 26)}
          <span class="survi-inv-name">${info.name}</span>
          ${info.tool || info.arco ? '' : `<span class="survi-inv-count">${game.inventory[id]}</span>`}
          ${SurviUI.barraDurabilidad(frac)}
        `;
        cell.dataset.dragId = String(id); // se agarra con Arrastre (ver #soltarItem / #tocarItem)
        cell.dataset.origen = 'inv';
        this.invGrid.appendChild(cell);
      }
    }
    // Huecos vacíos: así se ve de un vistazo cuánto cupo queda, no solo el
    // número del contador de arriba.
    for (let i = ids.length; i < cap; i++) {
      const empty = document.createElement('div');
      empty.className = 'survi-inv-cell survi-inv-cell-empty';
      this.invGrid.appendChild(empty);
    }
  }

  // ═══════════ Equipamiento ═══════════
  // Izquierda: sprite del personaje + los 6 huecos (casco/pecho/pantalón/
  // botas/mochila/especial). Derecha: los ítems del inventario que se
  // pueden equipar (los que tienen ITEM_INFO[id].equip), para tocar y
  // mandarlos a su hueco. Tocar un hueco ya ocupado lo desequipa.
  renderEquip(game) {
    this.equipSlots.innerHTML = '';
    for (const s of SurviConfig.EQUIP_SLOTS) {
      const id = game.equipment[s.key];
      const info = id ? SurviConfig.ITEM_INFO[id] : null;
      const btn = document.createElement('button');
      btn.className = 'survi-equip-slot' + (info ? ' filled' : '');
      const frac = id ? game.durabilidadEquipo(id) : null;
      btn.title = info ? `${SurviUI.tituloItem(id, frac)} (tocar para desequipar)` : s.label;
      btn.innerHTML = info
        ? `${SurviUI.iconMarkup(id, 28)}<span class="survi-equip-slot-label">${s.label}</span>${SurviUI.barraDurabilidad(frac)}`
        : `<span class="survi-equip-slot-icon survi-equip-slot-icon-empty">${Iconos.icon(s.icon)}</span><span class="survi-equip-slot-label">${s.label}</span>`;
      btn.addEventListener('click', () => {
        if (game.equipment[s.key]) game.unequipItem(s.key);
        this.renderEquip(game);
      });
      this.equipSlots.appendChild(btn);
    }
    // Lista de la derecha: cosas equipables que tenés sueltas en el
    // inventario general o en la hotbar (cualquiera de los dos: equipar
    // algo que por ahí quedó en la hotbar también tiene que funcionar).
    const equippableIds = Object.keys(game.inventory)
      .map(Number)
      .filter((id) => (game.inventory[id] || 0) > 0 && SurviConfig.ITEM_INFO[id] && SurviConfig.ITEM_INFO[id].equip);
    this.equipList.innerHTML = '';
    if (!equippableIds.length) {
      this.equipList.innerHTML =
        '<p class="survi-equip-empty">No tenés nada equipable en el inventario — crafteá armadura o una mochila.</p>';
      return;
    }
    for (const id of equippableIds) {
      const info = SurviConfig.ITEM_INFO[id];
      const cell = document.createElement('button');
      cell.className = 'survi-inv-cell';
      const frac = game.durabilidadInventario(id);
      cell.title = `Equipar ${SurviUI.tituloItem(id, frac)}`;
      cell.innerHTML = `${SurviUI.iconMarkup(id, 26)}<span class="survi-inv-name">${info.name}</span>${SurviUI.barraDurabilidad(frac)}`;
      cell.addEventListener('click', () => {
        game.equipItem(id);
        this.renderEquip(game);
      });
      this.equipList.appendChild(cell);
    }
  }

  // ═══════════ Craftear ═══════════
  // Izquierda: la lista de recetas posibles (icono + nombre + lo que
  // piden en chiquito). Derecha: el detalle de la receta elegida — cada
  // material con cuánto pedís, cuánto tenés (en verde si alcanza, en rojo
  // si no) y el botón para craftear (deshabilitado si falta algo).
  static recipeResultName(recipe) {
    const info = SurviConfig.ITEM_INFO[recipe.result];
    return info ? info.name : `Receta ${recipe.id}`;
  }

  static ingredientLabel(ing) {
    if (ing.label) return `${ing.qty}× ${ing.label}`;
    const ids = ing.anyOf || [ing.id];
    const names = ids.map((id) => (SurviConfig.ITEM_INFO[id] ? SurviConfig.ITEM_INFO[id].name : `#${id}`));
    return `${ing.qty}× ${names.join(' / ')}`;
  }

  // Pestañas por categoría (Básicos, Herramientas, Armas…). En cada una,
  // primero lo que ya podés craftear.
  renderCraft(game) {
    // Desde el inventario solo lo simple; en la mesa de crafteo, todo.
    const atTable = game.craftStation === 'table';
    const available = SurviConfig.RECIPES.filter((r) => atTable || r.station === 'hand');
    this.craftTitle.textContent = atTable ? 'Mesa de crafteo' : 'Craftear';
    this.craftHint.textContent = atTable
      ? ''
      : 'Herramientas, armas, armadura, horno y cofre se hacen en una mesa de crafteo.';
    this.craftHint.classList.toggle('hidden', atTable);
    const cats = SurviConfig.CRAFT_CATS.filter((c) => available.some((r) => r.cat === c.key));
    if (!cats.some((c) => c.key === this.craftCat)) this.craftCat = cats[0].key;
    this.craftTabs.innerHTML = '';
    for (const c of cats) {
      const tab = document.createElement('button');
      const n = available.filter((r) => r.cat === c.key && SurviConfig.canCraft(game.inventory, r)).length;
      tab.className = 'survi-craft-tab' + (c.key === this.craftCat ? ' active' : '');
      tab.innerHTML = `${c.label}${n ? `<span class="survi-craft-tab-n">${n}</span>` : ''}`;
      tab.addEventListener('click', () => {
        this.craftCat = c.key;
        this.craftDetail.innerHTML = '<p class="survi-craft-empty">Elegí algo de la lista para ver qué pide.</p>';
        this.renderCraft(game);
      });
      this.craftTabs.appendChild(tab);
    }
    this.craftList.innerHTML = '';
    const list = available
      .filter((r) => r.cat === this.craftCat)
      .map((r) => ({
        r,
        ok: SurviConfig.canCraft(game.inventory, r),
      }))
      .sort((a, b) => b.ok - a.ok);
    for (const { r: recipe, ok } of list) {
      const row = document.createElement('button');
      row.className = 'survi-craft-row' + (ok ? ' can-craft' : '');
      row.innerHTML = `
        ${SurviUI.iconMarkup(recipe.result, 26)}
        <span class="survi-craft-row-info">
          <span class="survi-craft-row-name">${SurviUI.recipeResultName(recipe)}${recipe.resultQty > 1 ? ` ×${recipe.resultQty}` : ''}</span>
          <span class="survi-craft-row-cost">${recipe.inputs.map(SurviUI.ingredientLabel).join(', ')}</span>
        </span>
      `;
      row.addEventListener('click', () => {
        this.craftList.querySelectorAll('.survi-craft-row').forEach((r) => r.classList.remove('selected'));
        row.classList.add('selected');
        this.renderCraftDetail(game, recipe);
      });
      this.craftList.appendChild(row);
    }
  }

  // ═══════════ Horno / cofre ═══════════
  static stackButton(id, qty, onClick, px = 30, frac = null) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'survi-sitem';
    b.title = SurviUI.tituloItem(id, frac);
    b.innerHTML = `${SurviUI.iconMarkup(id, px)}<span class="survi-sitem-qty">${qty}</span>${SurviUI.barraDurabilidad(frac)}`;
    b.addEventListener('click', onClick);
    return b;
  }

  static FSLOT_LABEL = {
    in: 'Cocinar',
    fuel: 'Carbón',
    out: 'Listo',
  };
  renderFurnace(game, barsOnly) {
    const f = game.openFurnace;
    if (!f) return;
    for (const k of ['in', 'fuel', 'out']) {
      const el = this.furnaceSlots[k],
        st = f[k];
      const sig = st ? `${st.id}:${st.qty}` : '';
      if (el.dataset.sig !== sig) {
        // solo se toca el DOM si cambió
        el.dataset.sig = sig;
        el.innerHTML = st
          ? `${SurviUI.iconMarkup(st.id, 32)}<span class="survi-sitem-qty">${st.qty}</span>`
          : `<span class="survi-fslot-empty">${SurviUI.FSLOT_LABEL[k]}</span>`;
        el.classList.toggle('filled', !!st);
      }
      el.onclick = () => game.furnaceTake(k);
    }
    this.furnaceFire.style.height = (f.burnMax ? Math.round((100 * f.burn) / f.burnMax) : 0) + '%';
    this.furnaceArrow.style.width = Math.round(100 * Math.min(1, f.prog / SurviConfig.SMELT_MS)) + '%';
    if (barsOnly) return;
    this.furnaceInv.innerHTML = '';
    const ids = Object.keys(game.inventory)
      .map(Number)
      .filter((id) => SurviConfig.SMELT[id] || SurviConfig.FUEL[id]);
    if (!ids.length) {
      this.furnaceInv.innerHTML = '<p class="survi-station-empty">No tenés nada para cocinar o fundir, ni carbón.</p>';
      return;
    }
    for (const id of ids)
      this.furnaceInv.appendChild(SurviUI.stackButton(id, game.inventory[id], () => game.furnaceInsert(id)));
  }

  renderChest(game) {
    const c = game.openChest;
    if (!c) return;
    const keys = Object.keys(c).map(Number);
    this.chestLabel.textContent = `Cofre (${keys.length}/${SurviConfig.CHEST_SLOTS})`;
    this.chestGrid.innerHTML = '';
    if (!keys.length) this.chestGrid.innerHTML = '<p class="survi-station-empty">Vacío</p>';
    for (const id of keys)
      this.chestGrid.appendChild(SurviUI.stackButton(id, c[id], () => game.chestTake(id), 30, game.durabilidadCofre(id)));
    this.chestInv.innerHTML = '';
    const inv = Object.keys(game.inventory).map(Number);
    if (!inv.length) this.chestInv.innerHTML = '<p class="survi-station-empty">Tu inventario está vacío</p>';
    for (const id of inv)
      this.chestInv.appendChild(
        SurviUI.stackButton(id, game.inventory[id], () => game.chestPut(id), 30, game.durabilidadInventario(id)),
      );
  }

  renderCraftDetail(game, recipe) {
    const rows = recipe.inputs
      .map((ing) => {
        const have = SurviConfig.ingredientHave(game.inventory, ing);
        const enough = have >= ing.qty;
        const ids = ing.anyOf || [ing.id];
        const names =
          ing.label ||
          ids.map((id) => (SurviConfig.ITEM_INFO[id] ? SurviConfig.ITEM_INFO[id].name : `#${id}`)).join(' / ');
        return `
        <div class="survi-craft-ing ${enough ? 'have' : 'missing'}">
          <span class="survi-craft-ing-name">${names}</span>
          <span class="survi-craft-ing-qty">${have}/${ing.qty}</span>
        </div>
      `;
      })
      .join('');
    const ok = SurviConfig.canCraft(game.inventory, recipe);
    this.craftDetail.innerHTML = `
      <div class="survi-craft-detail-head">
        ${SurviUI.iconMarkup(recipe.result, 32)}
        <span class="survi-craft-detail-name">${SurviUI.recipeResultName(recipe)}</span>
      </div>
      <div class="survi-craft-ings">${rows}</div>
      <button class="btn-game-primary survi-craft-btn" ${ok ? '' : 'disabled'}>Craftear</button>
    `;
    const btn = this.craftDetail.querySelector('.survi-craft-btn');
    btn.addEventListener('click', () => {
      const res = game.craftItem(recipe.id);
      if (res.ok) {
        this.renderCraftDetail(game, recipe); // refresca cantidades tras gastar materiales
        this.renderCraft(game); // refresca la lista (por si ahora falta/alcanza otra receta)
        if (this.showToast) this.showToast(`Crafteaste: ${SurviUI.recipeResultName(recipe)}`);
      } else if (res.reason === 'full' && this.showToast) {
        this.showToast('Inventario lleno — no entra el resultado');
      }
    });
  }
}
