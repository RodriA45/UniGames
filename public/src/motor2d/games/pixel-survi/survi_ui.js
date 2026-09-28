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
    'crear',
    'catalogo',
    'settings',
    'howto',
    'pause',
    'death',
    'inv',
    'equip',
    'craft',
    'furnace',
    'chest',
    'mapa',
  ];
  constructor(root, { movil = false } = {}) {
    root.classList.add('survi-root');
    // Celular / tablet: joysticks (la pantalla completa es aparte: .survi-fs).
    root.classList.toggle('survi-movil', movil);
    root.innerHTML = `
      <canvas class="survi-canvas hidden"></canvas>
      <!-- portada de fondo: detrás de todas las pantallas del menú -->
      <img class="survi-portada-fondo hidden" alt="" src="${SurviConfig.COVER_SRC}" decoding="async">

      <!-- Aviso corto (ej. "Inventario lleno") — lo dispara this.showToast(). -->
      <div class="survi-toast hidden"></div>

      <!-- Cartel de confirmación (borrar mundo, vaciar inventario): ver confirmar() -->
      <div class="survi-confirmar hidden" role="dialog" aria-modal="true">
        <div class="survi-confirmar-box">
          <p class="survi-confirmar-txt"></p>
          <div class="survi-confirmar-btns">
            <button type="button" class="btn-game-secondary survi-confirmar-no">Cancelar</button>
            <button type="button" class="btn-game-primary survi-confirmar-si">Aceptar</button>
          </div>
        </div>
      </div>

      <!-- ── HUD en partida ── -->
      <div class="survi-hud hidden">
        <div class="survi-hud-top">
          <div class="survi-hud-izq">
            <button class="game-icon-btn survi-pause-btn" title="Pausa (Esc)" aria-label="Pausa">${Iconos.icon('pause', { fill: true })}</button>
            <button class="game-icon-btn survi-zoom-btn survi-solo-movil" title="Zoom (Z)">${Iconos.icon('zoomIn')}</button>
            <div class="survi-coords" title="Coordenadas (X: 0 en el medio del mundo · Y: 0 al nivel del suelo, negativo bajo tierra)">
              <span>X <b class="survi-coords-x">0</b></span>
              <span>Y <b class="survi-coords-y">0</b></span>
            </div>
          </div>
          <!-- modo creativo / espectador: [espectador] [etiqueta] [volar] -->
          <div class="survi-hud-modo hidden">
            <button class="game-icon-btn survi-btn-espectador" data-act="espectador" title="Modo espectador (V)">${Iconos.icon('eye')}</button>
            <span class="survi-modo-label">Creativo</span>
            <button class="game-icon-btn survi-btn-volar" data-act="volar" title="Volar (F)">${Iconos.icon('wind')}</button>
          </div>
          <div class="survi-hud-der">
            <button class="game-icon-btn survi-mapa-btn" title="Mapa (M)" aria-label="Mapa">${Iconos.icon('map')}</button>
            <button class="game-icon-btn survi-inv-btn" title="Inventario (I)">I</button>
          </div>
        </div>
        <div class="survi-hud-bottom">
          <div class="survi-air hidden" title="Aire"></div>
          <div class="survi-efectos">
            <span class="survi-efecto survi-efecto-veneno hidden" title="Envenenado">${Iconos.icon('droplet', { fill: true })} Veneno <b>10s</b></span>
            <span class="survi-efecto survi-efecto-enredado hidden" title="Enredado en telaraña">${Iconos.icon('web')} Enredado <b>3s</b></span>
            <span class="survi-efecto survi-efecto-congelado hidden" title="Congelado">${Iconos.icon('snowflake')} Congelado <b>3s</b></span>
          </div>
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
          <!-- hotbar centrada; el botón de colocar/usar (solo celular) va pegado a su derecha -->
          <div class="survi-hotbar-fila">
            <div class="survi-hotbar"></div>
            <button class="game-icon-btn survi-btn-colocar survi-solo-movil" title="Colocar / usar">${Iconos.icon('box')}</button>
          </div>
        </div>
      </div>

      <!-- ── Controles táctiles (solo celular / tablet, ver survi_tactil.js) ──
           Cada zona es el área donde se puede tocar: el joystick aparece donde
           ponés el dedo (en reposo se ve apagado en su lugar de siempre). -->
      <div class="survi-touch hidden">
        <div class="survi-zona survi-zona-mover" aria-label="Mover">
          <div class="survi-stick"><div class="survi-stick-palanca"></div></div>
        </div>
        <div class="survi-zona survi-zona-mira" aria-label="Apuntar y romper">
          <div class="survi-stick survi-stick-mira">
            <div class="survi-stick-palanca">${Iconos.icon('crosshair')}</div>
          </div>
        </div>
      </div>

      <!-- ── Celular en vertical: se pide girarlo (el juego se pausa solo) ── -->
      <div class="survi-girar">
        <div>${Iconos.icon('smartphone', { size: 48 })}<p>Girá el celular para jugar</p></div>
      </div>

      <!-- ── Menú principal (portada) ── -->
      <!-- ── Portada: la imagen ocupa toda la pantalla (ya trae el logo) y los
           botones van abajo, encima. Si la imagen no carga, se ve el logo de texto. ── -->
      <div class="modal-game survi-screen survi-cover">
        <div class="modal-game-box survi-cover-box">
          <span class="survi-cover-logo">PIXEL SURVIVAL</span>
          <button class="btn-game-primary survi-cover-jugar" data-act="play">${Iconos.icon('play', { fill: true })} Jugar</button>
          <div class="survi-cover-fila">
            <button class="btn-game-secondary" data-act="settings">Ajustes</button>
            <button class="btn-game-secondary" data-act="howto">Cómo jugar</button>
            <button class="btn-game-secondary survi-solo-fs" data-act="salir">Volver a Juegos</button>
          </div>
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

      <!-- ── Crear mundo: nombre, modo y dificultad ── -->
      <div class="modal-game survi-screen survi-crear hidden">
        <div class="modal-game-box survi-crear-box">
          <div class="survi-crear-head">
            <button class="game-icon-btn survi-crear-volver" data-act="back-worlds" title="Volver">${Iconos.icon('chevronLeft')}</button>
            <h2 class="modal-game-title">Nuevo mundo</h2>
          </div>
          <label class="survi-crear-label" for="surviNombreMundo">Nombre</label>
          <input id="surviNombreMundo" class="survi-crear-nombre" type="text" maxlength="${SurviConfig.NOMBRE_MAX}" autocomplete="off" spellcheck="false">
          <span class="survi-crear-label">Modo</span>
          <div class="survi-opciones survi-opciones-modo">
            ${Object.entries(SurviConfig.MODOS_JUEGO)
              .map(([k, m]) => `<button type="button" class="survi-opcion" data-modo="${k}">${Iconos.icon(k === 'creativo' ? 'sparkles' : 'heart')} ${m.label}</button>`)
              .join('')}
          </div>
          <span class="survi-crear-label">Dificultad</span>
          <div class="survi-opciones survi-opciones-dif">
            ${Object.entries(SurviConfig.DIFICULTADES)
              .map(([k, d]) => `<button type="button" class="survi-opcion${k === 'hardcore' ? ' survi-opcion-hard' : ''}" data-dif="${k}">${d.label}</button>`)
              .join('')}
          </div>
          <p class="survi-crear-desc"></p>
          <button class="btn-game-primary survi-crear-btn" data-act="crear-mundo">${Iconos.icon('plus', { stroke: 3 })} Crear mundo</button>
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
              <button class="game-fullscreen-btn survi-fullscreen-btn" data-act="fullscreen">${Iconos.icon('maximize')} Pantalla completa: <b class="survi-fs-val">No</b></button>
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
            <div class="survi-howto-sec survi-solo-pc">
              <h3 class="survi-howto-tit">${Iconos.icon('grid')} Teclado y mouse</h3>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>A</kbd><kbd>D</kbd><kbd>←</kbd><kbd>→</kbd></span><span class="survi-ctrl-d">Moverte</span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>Espacio</kbd><kbd>W</kbd><kbd>↑</kbd></span><span class="survi-ctrl-d">Saltar · subir escaleras · nadar hacia arriba</span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>S</kbd><kbd>↓</kbd></span><span class="survi-ctrl-d">Bajar escaleras</span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>Clic izq.</kbd></span><span class="survi-ctrl-d">Mantenido: romper bloques · atacar · disparar con el arco</span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>Clic der.</kbd></span><span class="survi-ctrl-d">Colocar bloques · usar (comer, mesa, horno, cofre, cama, puerta, azada, caña, cubo, TNT, dar de comer)</span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>1</kbd><kbd>8</kbd><kbd>Rueda</kbd></span><span class="survi-ctrl-d">Elegir el ítem de la barra</span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>I</kbd></span><span class="survi-ctrl-d">Inventario (arrastrá los ítems para ordenarlos)</span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>M</kbd></span><span class="survi-ctrl-d">Mapa</span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>Z</kbd></span><span class="survi-ctrl-d">Zoom (normal, cerca, lejos)</span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>Esc</kbd></span><span class="survi-ctrl-d">Pausa / cerrar</span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>F</kbd><kbd>V</kbd></span><span class="survi-ctrl-d">Volar · espectador <span class="survi-howto-nota">(solo en creativo)</span></span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>Doble salto</kbd></span><span class="survi-ctrl-d">Volar / dejar de volar <span class="survi-howto-nota">(solo en creativo)</span></span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>Clic der.</kbd></span><span class="survi-ctrl-d">Sobre la cama: acostarte (el tiempo pasa x3). Saltá o movete para levantarte</span></div>
            </div>
            <div class="survi-howto-sec survi-solo-movil">
              <h3 class="survi-howto-tit">${Iconos.icon('smartphone')} Pantalla táctil</h3>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>Joystick izq.</kbd></span><span class="survi-ctrl-d">Moverte · hacia arriba salta · hacia abajo baja escaleras</span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>Joystick der.</kbd></span><span class="survi-ctrl-d">Mover la mira; mientras lo empujás rompe, ataca o dispara. Al tope, la mira sigue avanzando</span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>Cama</kbd></span><span class="survi-ctrl-d">Botón azul apuntando a la cama: acostarte (el tiempo pasa x3). Mové el joystick izquierdo para levantarte</span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>Botón azul</kbd></span><span class="survi-ctrl-d">Colocar bloques · usar (comer, mesa, horno, cofre, cama, puerta…). Mantenelo para colocar seguido</span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>Barra</kbd></span><span class="survi-ctrl-d">Tocá un ítem para elegirlo</span></div>
              <div class="survi-ctrl"><span class="survi-ctrl-k"><kbd>Arriba</kbd></span><span class="survi-ctrl-d">Pausa · zoom · mapa · inventario</span></div>
            </div>
          </div>
          <button class="btn-game-secondary" data-act="back-cover">Volver</button>
        </div>
      </div>

      <!-- ── Inventario ── -->
      <div class="modal-game survi-screen survi-inv hidden">
        <div class="modal-game-box survi-inv-box">
          <button class="survi-cerrar" data-act="close-inv" title="Cerrar (I)" aria-label="Cerrar">${Iconos.icon('x', { size: 18 })}</button>
          <h2 class="modal-game-title">Inventario <span class="survi-inv-count">(0/10)</span></h2>
          <div class="survi-inv-main">
            <div class="survi-inv-col">
              <div class="survi-inv-grid" data-drop="inv"></div>
            </div>
            <!-- a la derecha: la ficha del ítem y, abajo, los botones chicos -->
            <div class="survi-inv-der">
              <div class="survi-item-info"></div>
              <div class="survi-inv-botones">
                <button class="btn-game-secondary survi-btn-chico" data-act="open-craft" title="Craftear">${Iconos.icon('hammer')} Craftear</button>
                <button class="btn-game-secondary survi-btn-chico" data-act="open-equip" title="Equipamiento">${Iconos.icon('shield')} Equipo</button>
                <button class="btn-game-primary survi-btn-chico survi-solo-creativo" data-act="open-catalogo" title="Todos los ítems">${Iconos.icon('sparkles')} Ítems</button>
              </div>
            </div>
          </div>
          <div class="survi-inv-hotbar"></div>
          <p class="survi-inv-hint">Tocá un ítem para pasarlo a la barra (o de vuelta), arrastralo al hueco que quieras o afuera para tirarlo. <span class="survi-inv-slot hidden">1</span></p>
        </div>
      </div>

      <!-- ── Catálogo del modo creativo: todos los ítems ── -->
      <div class="modal-game survi-screen survi-catalogo hidden">
        <div class="modal-game-box survi-catalogo-box">
          <button class="survi-cerrar" data-act="catalogo-back" title="Volver al inventario" aria-label="Volver">${Iconos.icon('x', { size: 18 })}</button>
          <h2 class="modal-game-title">Todos los ítems</h2>
          <div class="survi-catalogo-main">
            <div class="survi-catalogo-izq">
              <div class="survi-craft-tabs survi-catalogo-tabs"></div>
              <div class="survi-catalogo-grid"></div>
            </div>
            <!-- a la derecha: lo que tenés (se puede soltar acá o en la barra) -->
            <div class="survi-catalogo-der">
              <div class="survi-catalogo-sub">Tu inventario <span class="survi-catalogo-cupo"></span></div>
              <div class="survi-catalogo-inv" data-drop="inv"></div>
              <div class="survi-catalogo-hotbar"></div>
              <button class="btn-game-secondary survi-btn-chico" data-act="vaciar-inv">${Iconos.icon('trash')} Vaciar</button>
            </div>
          </div>
          <p class="survi-inv-hint">Tocá un ítem para sumarlo, o arrastralo a un hueco de tu inventario o de la barra.</p>
        </div>
      </div>

      <!-- ── Equipamiento ── -->
      <div class="modal-game survi-screen survi-equip hidden">
        <div class="modal-game-box survi-equip-box">
          <h2 class="modal-game-title">Equipamiento</h2>
          <div class="survi-equip-layout">
            <div class="survi-equip-left">
              <div class="survi-equip-char"></div>
              <div class="survi-equip-stats"></div>
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

      <!-- ── Mapa ── -->
      <div class="modal-game survi-screen survi-mapa hidden">
        <div class="modal-game-box survi-mapa-box">
          <button class="survi-cerrar survi-mapa-cerrar" title="Cerrar (M)" aria-label="Cerrar">${Iconos.icon('x', { size: 18 })}</button>
          <h2 class="modal-game-title">Mapa</h2>
          <div class="survi-mapa-vista">
            <canvas class="survi-mapa-canvas"></canvas>
            <div class="survi-mapa-ctrl">
              <button class="game-icon-btn survi-mapa-mas" title="Acercar" aria-label="Acercar">${Iconos.icon('plus')}</button>
              <button class="game-icon-btn survi-mapa-menos" title="Alejar" aria-label="Alejar">${Iconos.icon('minus')}</button>
              <button class="game-icon-btn survi-mapa-centrar" title="Centrar en vos" aria-label="Centrar en vos">${Iconos.icon('crosshair')}</button>
            </div>
          </div>
          <p class="survi-mapa-info"></p>
        </div>
      </div>

      <!-- ── Craftear ── -->
      <div class="modal-game survi-screen survi-craft hidden">
        <div class="modal-game-box survi-craft-box">
          <button class="survi-cerrar" data-act="craft-back" title="Cerrar" aria-label="Cerrar">${Iconos.icon('x', { size: 18 })}</button>
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
          <button class="btn-game-primary hidden" data-act="espectar">${Iconos.icon('eye')} Ver como espectador</button>
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
      mapaBtn: q('.survi-mapa-btn'),
      mapaCerrar: q('.survi-mapa-cerrar'),
      mapaCanvas: q('.survi-mapa-canvas'),
      mapaInfo: q('.survi-mapa-info'),
      mapaMas: q('.survi-mapa-mas'),
      mapaMenos: q('.survi-mapa-menos'),
      mapaCentrar: q('.survi-mapa-centrar'),
      hotbar: q('.survi-hotbar'),
      hpBar: q('.survi-health-bar i'),
      hpText: q('.survi-health-text'),
      hungerBar: q('.survi-hunger-bar i'),
      hungerText: q('.survi-hunger-text'),
      touch: q('.survi-touch'),
      zonaMover: q('.survi-zona-mover'),
      zonaMira: q('.survi-zona-mira'),
      btnColocar: q('.survi-btn-colocar'),
      btnZoom: q('.survi-zoom-btn'),
      screens: {
        cover: q('.survi-cover'),
        worlds: q('.survi-worlds'),
        crear: q('.survi-crear'),
        catalogo: q('.survi-catalogo'),
        settings: q('.survi-settings'),
        howto: q('.survi-howto'),
        inv: q('.survi-inv'),
        equip: q('.survi-equip'),
        craft: q('.survi-craft'),
        furnace: q('.survi-furnace'),
        chest: q('.survi-chest'),
        mapa: q('.survi-mapa'),
        pause: q('.survi-pause'),
        death: q('.survi-death'),
      },
      worldsList: q('.survi-worlds-list'),
      crearNombre: q('#surviNombreMundo'),
      crearDesc: q('.survi-crear-desc'),
      crearBtn: q('.survi-crear-btn'),
      catalogoTabs: q('.survi-catalogo-tabs'),
      catalogoGrid: q('.survi-catalogo-grid'),
      catalogoInv: q('.survi-catalogo-inv'),
      catalogoHotbar: q('.survi-catalogo-hotbar'),
      catalogoCupo: q('.survi-catalogo-cupo'),
      catalogoDer: q('.survi-catalogo-der'),
      confirmarBox: q('.survi-confirmar'),
      confirmarTxt: q('.survi-confirmar-txt'),
      confirmarSi: q('.survi-confirmar-si'),
      confirmarNo: q('.survi-confirmar-no'),
      hudModo: q('.survi-hud-modo'),
      modoLabel: q('.survi-modo-label'),
      btnEspectador: q('.survi-btn-espectador'),
      btnVolar: q('.survi-btn-volar'),
      deathEspectar: q('[data-act="espectar"]'),
      invGrid: q('.survi-inv-grid'),
      itemInfo: q('.survi-item-info'),
      equipStats: q('.survi-equip-stats'),
      invHotbar: q('.survi-inv-hotbar'),
      invSlotNum: q('.survi-inv-slot'),
      invCount: q('.survi-inv-count'),
      equipChar: q('.survi-equip-char'),
      equipSlots: q('.survi-equip-slots'),
      equipList: q('.survi-equip-list'),
      craftTabs: q('.survi-craft .survi-craft-tabs'), // (ojo: el catálogo también usa .survi-craft-tabs)
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
      fsVal: q('.survi-fs-val'),
      aire: q('.survi-air'),
      efectoVeneno: q('.survi-efecto-veneno'),
      efectoEnredado: q('.survi-efecto-enredado'),
      efectoCongelado: q('.survi-efecto-congelado'),
      coordsX: q('.survi-coords-x'),
      coordsY: q('.survi-coords-y'),
      qualitySlot: q('.survi-quality-slot'),
      musicRange: q('#surviMusicVol'),
      musicVal: q('.survi-music-val'),
      sfxRange: q('#surviSfxVol'),
      sfxVal: q('.survi-sfx-val'),
      coverImg: q('.survi-portada-fondo'),
    });
    // Arrastrar y soltar en el inventario (juego = el que se dibujó por última vez)
    this.juegoInv = null;
    this.arrastre = new Arrastre(this.screens.inv, {
      alSoltar: (o, d, punto) => this.#soltarItem(o, d, punto),
      alTocar: (o) => this.#tocarItem(o),
    });
    // Catálogo del creativo: los ítems del catálogo se tocan o se arrastran al inventario / la barra
    this.arrastreCatalogo = new Arrastre(this.screens.catalogo, {
      alSoltar: (o, d, punto) => this.#soltarItem(o, d, punto),
      alTocar: (o) => this.#tocarItem(o),
    });
    // Si la portada no carga: se oculta el <img> (no un ícono roto) y se
    // muestra el logo de texto arriba de los botones.
    this.coverImg.addEventListener('error', () => {
      this.coverImg.style.display = 'none';
      this.screens.cover.classList.add('survi-sin-portada');
    });
    // Sprite del personaje en la pantalla de Equipamiento: un recorte fijo
    // (el frame "idle") del mismo sheet que usa el canvas.
    this.equipChar.style.cssText = SurviUI.charSpriteStyle(72);
    // Estado de la UI (antes eran variables sueltas del módulo)
    this.toastTimer = null; // aviso corto en pantalla
    this.craftCat = SurviConfig.CRAFT_CATS[0].key; // pestaña elegida en el crafteo
  }

  // Texto del usuario (nombre del mundo) → seguro para meter en HTML.
  static escapar(t) {
    return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  // ═══════════ Crear mundo ═══════════
  // Marca el modo y la dificultad elegidos; en creativo la dificultad no
  // aplica (se apaga).
  mostrarCrear(elegido) {
    const root = this.screens.crear;
    root.querySelectorAll('[data-modo]').forEach((b) => b.classList.toggle('active', b.dataset.modo === elegido.modo));
    const creativo = elegido.modo === 'creativo';
    root.querySelectorAll('[data-dif]').forEach((b) => {
      b.classList.toggle('active', !creativo && b.dataset.dif === elegido.dificultad);
      b.disabled = creativo;
    });
    root.querySelector('.survi-opciones-dif').classList.toggle('apagado', creativo);
    this.crearDesc.textContent = creativo
      ? SurviConfig.MODOS_JUEGO.creativo.desc
      : SurviConfig.DIFICULTADES[elegido.dificultad].desc;
  }

  // ═══════════ Modo creativo / espectador (HUD) ═══════════
  // modo: { creativo, espectador, volando, puedeCambiar }
  mostrarModo({ creativo, espectador, volando, puedeCambiar }) {
    this.root.classList.toggle('survi-creativo', creativo);
    this.root.classList.toggle('survi-espectador', espectador);
    const visible = creativo || espectador;
    this.hudModo.classList.toggle('hidden', !visible);
    this.modoLabel.textContent = espectador ? 'Espectador' : 'Creativo';
    this.btnEspectador.classList.toggle('hidden', !puedeCambiar);
    this.btnEspectador.classList.toggle('activo', espectador);
    this.btnVolar.classList.toggle('activo', volando);
  }

  // ═══════════ Categorías de ítems ═══════════
  // Las mismas en el inventario, el catálogo del creativo y el crafteo.
  // El orden importa: gana la primera que coincide.
  static CATEGORIAS = [
    { key: 'herramientas', label: 'Herramientas', icon: 'pickaxe', es: (i) => (i.tool && i.tool !== 'sword') || i.cubo !== undefined || !!i.cana || !!i.azada },
    { key: 'armas', label: 'Armas', icon: 'sword', es: (i) => i.tool === 'sword' || !!i.arco },
    { key: 'armadura', label: 'Armadura', icon: 'shield', es: (i) => !!i.equip },
    { key: 'comida', label: 'Comida', icon: 'drumstick', es: (i) => !!i.food },
    { key: 'bloques', label: 'Bloques', icon: 'layers', es: (i) => !!(i.place || i.fondo) },
    { key: 'materiales', label: 'Materiales', icon: 'gem', es: () => true },
  ];
  static CATALOGO_CATS = [
    SurviUI.CATEGORIAS[4], // bloques primero
    ...SurviUI.CATEGORIAS.filter((c) => c.key !== 'bloques'),
  ];
  // Íconos de las pestañas del crafteo (SurviConfig.CRAFT_CATS)
  static CRAFT_ICON = {
    basicos: 'hammer', estaciones: 'box', muebles: 'home', herramientas: 'pickaxe', armas: 'sword',
    armadura: 'shield', mochilas: 'backpack', comida: 'drumstick', otros: 'flame',
  };

  static categoriaDe(id) {
    const info = SurviConfig.ITEM_INFO[id];
    return info ? SurviUI.CATEGORIAS.find((c) => c.es(info)) : SurviUI.CATEGORIAS[5];
  }

  // Pestaña chiquita con ícono + texto (+ número opcional).
  // compacta: solo el ícono (el nombre aparece en la activa y al pasar el mouse)
  static pestana(label, icon, activa, n = null, onClick = null, compacta = false) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'survi-craft-tab' + (activa ? ' active' : '') + (compacta ? ' compacta' : '');
    tab.title = label;
    tab.innerHTML = `${icon ? Iconos.icon(icon) : ''}<span class="survi-tab-label">${label}</span>${n ? `<span class="survi-craft-tab-n">${n}</span>` : ''}`;
    if (onClick) tab.addEventListener('click', onClick);
    return tab;
  }

  // Lo que dice cada ítem (daño, defensa, comida…): lista de [etiqueta, valor].
  static detalleItem(id, frac = null) {
    const info = SurviConfig.ITEM_INFO[id];
    if (!info) return [];
    const S = SurviConfig, d = [];
    const HERR = { pickaxe: 'Pico', axe: 'Hacha', shovel: 'Pala' };
    if (info.tool) {
      const st = S.WEAPON_STATS[info.tool] || S.BARE_HAND_ATTACK;
      const danio = S.ATTACK_DMG * st.dmgMult + (info.tool === 'sword' ? info.power * 2 : 0);
      d.push(['Daño', danio.toFixed(1).replace('.0', '')]);
      if (info.tool !== 'sword') d.push(['Velocidad', `×${(1 + info.power).toFixed(1)}`]);
      if (info.tool === 'pickaxe') d.push(['Nivel de pico', String(info.tier)]);
      d.push(['Golpes por segundo', (1000 / st.cooldown).toFixed(1)]);
    }
    if (info.arco) {
      d.push(['Daño por flecha', String(info.arco.danio)]);
      d.push(['Tiros por segundo', (1000 / info.arco.cadenciaMs).toFixed(1)]);
    }
    if (info.defense) d.push(['Defensa', `+${info.defense}`]);
    if (info.bonusSlots) d.push(['Huecos extra', `+${info.bonusSlots}`]);
    if (info.food) d.push(['Llena', `${info.food} de hambre`]);
    if (info.planta) d.push(['Se planta', 'en tierra arada']);
    if (info.azada) d.push(['Uso', 'ara tierra y pasto']);
    if (info.cana) d.push(['Uso', 'pescar (clic derecho)']);
    if (info.cubo !== undefined) d.push(['Uso', info.cubo ? 'volcar (clic derecho)' : 'juntar agua o lava']);
    if (info.place && S.TOOL_FOR[info.place]) d.push(['Se rompe con', HERR[S.TOOL_FOR[info.place]] || S.TOOL_FOR[info.place]]);
    if (info.fondo) d.push(['Va', 'en la pared de fondo']);
    if (S.LUZ_TILES && S.LUZ_TILES[info.place]) d.push(['Da luz', 'sí']);
    if (info.luz) d.push(['Da luz', 'puesto en la cabeza']);
    if (info.vidaExtra) d.push(['Uso', `+${info.vidaExtra} vida máxima (clic derecho)`]);
    if (info.alas) d.push(['Uso', 'volar (doble salto o F)']);
    if (info.durabilidad) {
      const quedan = frac === null || frac === undefined ? info.durabilidad : Math.round(frac * info.durabilidad);
      d.push(['Durabilidad', `${quedan}/${info.durabilidad}`]);
    }
    return d;
  }

  // Ficha de un ítem: ícono grande, nombre, categoría y sus datos.
  static fichaItem(id, { frac = null, cantidad = null, px = 36 } = {}) {
    const info = SurviConfig.ITEM_INFO[id];
    if (!info) return '';
    const cat = SurviUI.categoriaDe(id);
    const datos = SurviUI.detalleItem(id, frac)
      .map(([k, v]) => `<span class="survi-ficha-dato"><span>${k}</span><b>${v}</b></span>`)
      .join('');
    return `
      <div class="survi-ficha">
        <div class="survi-ficha-icono">${SurviUI.iconMarkup(id, px)}</div>
        <div class="survi-ficha-txt">
          <span class="survi-ficha-nombre">${info.name}${cantidad > 1 ? ` <small>×${cantidad}</small>` : ''}</span>
          <span class="survi-ficha-cat">${Iconos.icon(cat.icon)} ${cat.label}</span>
        </div>
        ${datos ? `<div class="survi-ficha-datos">${datos}</div>` : ''}
      </div>`;
  }

  static categoriaCatalogo(info) {
    return SurviUI.CATALOGO_CATS.find((c) => c.es(info)).key;
  }

  renderCatalogo(game) {
    this.catalogoCat = this.catalogoCat || 'bloques';
    this.catalogoTabs.innerHTML = '';
    for (const c of SurviUI.CATALOGO_CATS) {
      this.catalogoTabs.appendChild(
        SurviUI.pestana(c.label, c.icon, c.key === this.catalogoCat, null, () => {
          this.catalogoCat = c.key;
          this.renderCatalogo(game);
        }),
      );
    }
    this.catalogoGrid.innerHTML = '';
    const ids = Object.keys(SurviConfig.ITEM_INFO)
      .map(Number)
      .filter((id) => SurviUI.categoriaCatalogo(SurviConfig.ITEM_INFO[id]) === this.catalogoCat)
      .sort((a, b) => a - b);
    for (const id of ids) {
      const info = SurviConfig.ITEM_INFO[id];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'survi-sitem';
      b.title = info.name;
      b.innerHTML = SurviUI.iconMarkup(id, 28);
      b.dataset.dragId = String(id); // tocar = sumarlo; arrastrar = a un hueco (ver #soltarItem)
      b.dataset.origen = 'catalogo';
      this.catalogoGrid.appendChild(b);
    }
    this.renderCatalogoInv(game);
  }

  // Panel derecho del catálogo: tu inventario y la barra (se puede ordenar igual que en el inventario).
  renderCatalogoInv(game) {
    this.juegoInv = game;
    if (!this.catalogoInv || (this.arrastreCatalogo && this.arrastreCatalogo.arrastrando)) return;
    const ids = SurviUI.idsInventario(game), cap = game.generalSlotCap;
    if (this.catalogoCupo) this.catalogoCupo.textContent = `(${ids.length}/${cap})`;
    this.catalogoInv.innerHTML = '';
    for (let i = 0; i < cap; i++) {
      const id = ids[i];
      const cell = document.createElement(id ? 'button' : 'div');
      cell.className = 'survi-inv-cell' + (id ? '' : ' survi-inv-cell-empty');
      if (id) {
        const info = SurviConfig.ITEM_INFO[id];
        cell.type = 'button';
        cell.title = info.name;
        cell.innerHTML = `${SurviUI.iconMarkup(id, 24)}${info.tool || info.arco ? '' : `<span class="survi-inv-count">${game.inventory[id]}</span>`}`;
        cell.dataset.dragId = String(id);
        cell.dataset.origen = 'inv';
      }
      this.catalogoInv.appendChild(cell);
    }
    this.catalogoHotbar.innerHTML = '';
    for (let i = 0; i < SurviConfig.HOTBAR_SIZE; i++) {
      const slot = SurviUI.casillaHotbar(game, i, 22);
      slot.dataset.drop = 'hotbar';
      slot.dataset.slot = String(i);
      if (game.hotbarSlots[i]) {
        slot.dataset.dragId = String(game.hotbarSlots[i]);
        slot.dataset.origen = 'hotbar';
      }
      this.catalogoHotbar.appendChild(slot);
    }
  }

  // Aviso de "inventario lleno" bien visible (cartel + el panel titila en rojo).
  avisarLleno() {
    this.showToast('Inventario lleno: tirá o vaciá algo primero');
    const der = this.catalogoDer;
    if (!der) return;
    der.classList.remove('survi-lleno');
    void der.offsetWidth; // reinicia la animación
    der.classList.add('survi-lleno');
  }

  // Ítems del inventario general (sin los que están en la barra), en orden.
  static idsInventario(game) {
    return Object.keys(game.inventory)
      .map(Number)
      .filter((id) => (game.inventory[id] || 0) > 0 && SurviConfig.ITEM_INFO[id] && !game.hotbarSlots.includes(id));
  }

  // Cartel de confirmación dentro del juego (en vez de confirm() del navegador).
  // Devuelve una promesa: true = aceptó.
  confirmar(texto, { si = 'Aceptar', no = 'Cancelar', peligro = false } = {}) {
    const C = this.confirmarBox;
    if (!C || !this.confirmarTxt) return Promise.resolve(false);
    this.confirmarTxt.textContent = texto;
    this.confirmarSi.innerHTML = `${peligro ? Iconos.icon('trash') + ' ' : ''}${si}`;
    this.confirmarNo.textContent = no;
    this.confirmarSi.classList.toggle('survi-peligro', peligro);
    C.classList.remove('hidden');
    return new Promise((resolve) => {
      const fin = (v) => {
        C.classList.add('hidden');
        this.confirmarSi.onclick = this.confirmarNo.onclick = C.onclick = null;
        document.removeEventListener('keydown', teclas, true);
        resolve(v);
      };
      const teclas = (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          fin(false);
        } else if (e.key === 'Enter') fin(true);
      };
      this.confirmarSi.onclick = () => fin(true);
      this.confirmarNo.onclick = () => fin(false);
      C.onclick = (e) => e.target === C && fin(false); // tocar afuera = cancelar
      document.addEventListener('keydown', teclas, true);
      this.confirmarNo.focus();
    });
  }

  // Burbujas de aire (solo se ven mientras te falta aire bajo el agua).
  mostrarAire(llenas, total) {
    if (!this.aire) return;
    this.aire.classList.toggle('hidden', llenas >= total);
    let html = '';
    for (let i = 0; i < total; i++) html += `<i class="${i < llenas ? 'llena' : ''}"></i>`;
    this.aire.innerHTML = html;
  }

  // Ajustes: estado del botón de pantalla completa.
  mostrarPantallaCompleta(activa) {
    if (this.fsVal) this.fsVal.textContent = activa ? 'Sí' : 'No';
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
      name === 'chest' ||
      name === 'mapa' ||
      name === 'catalogo';
    this.hud.classList.toggle('hidden', !inGame);
    this.touch.classList.toggle('hidden', name !== null);
    // Menú (sin partida atrás): la portada queda de fondo y las pantallas
    // (mundos, ajustes, cómo jugar…) van semitransparentes encima.
    const menu = SurviUI.PANTALLAS_MENU.includes(name) && this.canvas.classList.contains('hidden');
    this.coverImg.classList.toggle('hidden', !menu);
    this.root.classList.toggle('survi-en-menu', menu);
  }

  // Pantallas que usan la portada de fondo (Ajustes solo desde el menú:
  // desde la pausa se ve el juego atrás).
  static PANTALLAS_MENU = ['cover', 'worlds', 'crear', 'settings', 'howto'];

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
      const hard = s.dificultad === 'hardcore';
      const creativo = s.modo === 'creativo';
      card.className = 'survi-world-card' + (s.exists ? ' used' : ' empty') + (hard && !creativo ? ' hardcore' : '');
      if (s.exists && s.biome) card.dataset.biome = s.biome;
      let info;
      if (s.exists) {
        const biome = SurviConfig.BIOMES[s.biome];
        info = `
          <b class="survi-world-name">${SurviUI.escapar(s.nombre)}</b>
          <span class="survi-world-tags">
            ${
              creativo
                ? `<span class="survi-tag tag-creativo">${Iconos.icon('sparkles')}Creativo</span>`
                : `<span class="survi-tag ${hard ? 'tag-hard' : 'tag-normal'}">${Iconos.icon(hard ? 'skull' : 'leaf')}${SurviConfig.DIFICULTADES[s.dificultad] ? SurviConfig.DIFICULTADES[s.dificultad].label : 'Normal'}</span>`
            }
            ${s.muerto ? `<span class="survi-tag tag-hard">${Iconos.icon('eye')}Espectador</span>` : ''}
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
    if (info.icono) return SpritesSurvi.tileIconStyle(info.icono, px); // ícono dibujado por código (cama, puerta, vidrio)
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
  #soltarItem(origen, destino, punto = null) {
    const game = this.juegoInv;
    if (!game) return;
    // del catálogo (creativo): se suma al inventario y, si fue a la barra, va a ese hueco
    if (origen.origen === 'catalogo') {
      if (!destino) return;
      if (!game.darItemCreativo(origen.id)) {
        this.avisarLleno();
        return;
      }
      if (destino.tipo === 'hotbar') game.ponerEnHotbar(origen.id, destino.slot);
      this.renderCatalogoInv(game);
      return;
    }
    if (!destino) {
      // soltado AFUERA de la caja del inventario: se tira al suelo
      const caja = punto && document.elementFromPoint && document.elementFromPoint(punto.x, punto.y);
      if (punto && !(caja && caja.closest('.modal-game-box')) && game.tirarItem(origen.id)) {
        const info = SurviConfig.ITEM_INFO[origen.id];
        this.showToast(`Tiraste: ${info ? info.name : 'ítem'}`);
        this.renderCatalogoInv(game);
      }
      return;
    }
    if (destino.tipo === 'hotbar') game.ponerEnHotbar(origen.id, destino.slot);
    else if (destino.tipo === 'inv' && origen.origen === 'hotbar' && !game.sacarDeHotbar(origen.slot)) {
      this.showToast('El inventario está lleno');
    }
    this.renderCatalogoInv(game);
  }

  #tocarItem(origen) {
    const game = this.juegoInv;
    if (!game) return;
    if (origen.origen === 'catalogo') {
      const info = SurviConfig.ITEM_INFO[origen.id];
      if (game.darItemCreativo(origen.id)) this.showToast(`+ ${info.name}`);
      else this.avisarLleno();
      this.renderCatalogoInv(game);
      return;
    }
    // Tocar pasa el ítem de un lado al otro: del inventario a la barra, y de
    // la barra de vuelta al inventario. Tocar un hueco vacío lo selecciona.
    if (origen.origen === 'hotbar') {
      if (origen.id === null) game.seleccionarSlot(origen.slot);
      else if (!game.sacarDeHotbar(origen.slot)) this.showToast('El inventario está lleno');
    } else if (origen.id !== null) game.mandarAHotbar(origen.id);
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
    const todos = SurviUI.idsInventario(game);
    this.invSlotNum.textContent = String(game.selectedSlot + 1);
    const cap = game.generalSlotCap;
    if (this.invCount) this.invCount.textContent = `(${todos.length}/${cap})`;
    const ids = todos; // todo junto, sin separar por tipo
    this.invGrid.innerHTML = '';
    if (!todos.length) {
      const como = this.root.classList.contains('survi-movil') ? 'con el joystick derecho' : 'con clic izquierdo';
      this.invGrid.innerHTML = `<p class="survi-inv-empty">Vacío — rompé bloques ${como}.</p>`;
    } else {
      for (const id of ids) {
        const info = SurviConfig.ITEM_INFO[id];
        const cell = document.createElement('button');
        cell.className = 'survi-inv-cell' + (this.infoId === id ? ' selected' : '');
        const frac = game.durabilidadInventario(id);
        cell.title = SurviUI.tituloItem(id, frac);
        cell.innerHTML = `
          ${SurviUI.iconMarkup(id, 28)}
          ${info.tool || info.arco ? '' : `<span class="survi-inv-count">${game.inventory[id]}</span>`}
          ${SurviUI.barraDurabilidad(frac)}
        `;
        cell.dataset.dragId = String(id); // se agarra con Arrastre (ver #soltarItem / #tocarItem)
        cell.dataset.origen = 'inv';
        // pasar el mouse (o tocar) muestra su ficha abajo
        cell.addEventListener('pointerenter', () => this.mostrarInfoItem(game, id));
        cell.addEventListener('focus', () => this.mostrarInfoItem(game, id));
        this.invGrid.appendChild(cell);
      }
    }
    // Huecos vacíos: así se ve de un vistazo cuánto cupo queda.
    for (let i = todos.length; i < cap; i++) {
      const empty = document.createElement('div');
      empty.className = 'survi-inv-cell survi-inv-cell-empty';
      this.invGrid.appendChild(empty);
    }
    // (con el catálogo del creativo abierto, su panel de la derecha también)
    if (this.screens.catalogo && !this.screens.catalogo.classList.contains('hidden')) this.renderCatalogoInv(game);
    // la hotbar también muestra su ficha al pasar el mouse
    if (this.invHotbar) {
      this.invHotbar.querySelectorAll('.survi-slot').forEach((slot, i) => {
        slot.addEventListener('pointerenter', () => game.hotbarSlots[i] && this.mostrarInfoItem(game, game.hotbarSlots[i]));
      });
    }
    const vigente = this.infoId && (game.inventory[this.infoId] || 0) > 0 ? this.infoId : game.hotbarSlots[game.selectedSlot];
    this.mostrarInfoItem(game, vigente || null);
  }

  // Ficha del ítem abajo de la grilla del inventario.
  mostrarInfoItem(game, id) {
    if (!this.itemInfo) return;
    if (!id || !SurviConfig.ITEM_INFO[id]) {
      this.infoId = null;
      this.itemInfo.innerHTML = '<p class="survi-item-info-vacio">Pasá el mouse (o tocá) un ítem para ver sus datos.</p>';
      return;
    }
    this.infoId = id;
    this.itemInfo.innerHTML = SurviUI.fichaItem(id, { frac: game.durabilidadInventario(id), cantidad: game.inventory[id] || 0 });
  }

  // ═══════════ Equipamiento ═══════════
  // Izquierda: sprite del personaje + los 6 huecos (casco/pecho/pantalón/
  // botas/mochila/especial). Derecha: los ítems del inventario que se
  // pueden equipar (los que tienen ITEM_INFO[id].equip), para tocar y
  // mandarlos a su hueco. Tocar un hueco ya ocupado lo desequipa.
  renderEquip(game) {
    if (this.equipStats) {
      const def = SurviConfig.totalDefense(game.equipment);
      const red = Math.round(SurviConfig.armorReduction(def) * 100);
      const bag = game.equipment.bag ? SurviConfig.ITEM_INFO[game.equipment.bag] : null;
      this.equipStats.innerHTML = `
        <span class="survi-ficha-dato"><span>${Iconos.icon('shield')} Defensa</span><b>${def}</b></span>
        <span class="survi-ficha-dato"><span>Daño que recibís</span><b>−${red}%</b></span>
        <span class="survi-ficha-dato"><span>${Iconos.icon('backpack')} Huecos</span><b>${game.generalSlotCap}${bag ? ` (+${bag.bonusSlots})` : ''}</b></span>`;
    }
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
      const extra = info.defense ? `+${info.defense} def.` : info.bonusSlots ? `+${info.bonusSlots} huecos` : '';
      cell.innerHTML = `${SurviUI.iconMarkup(id, 26)}<span class="survi-inv-name">${info.name}</span>${extra ? `<span class="survi-inv-extra">${extra}</span>` : ''}${SurviUI.barraDurabilidad(frac)}`;
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
      const n = available.filter((r) => r.cat === c.key && SurviConfig.canCraft(game.inventory, r)).length;
      this.craftTabs.appendChild(
        SurviUI.pestana(c.label, SurviUI.CRAFT_ICON[c.key], c.key === this.craftCat, n, () => {
          this.craftCat = c.key;
          this.craftSel = null;
          this.craftDetail.innerHTML = '<p class="survi-craft-empty">Elegí algo de la lista para ver qué pide.</p>';
          this.renderCraft(game);
        }, true),
      );
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
      row.className = 'survi-craft-row' + (ok ? ' can-craft' : '') + (this.craftSel === recipe.id ? ' selected' : '');
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
        this.craftSel = recipe.id;
        this.renderCraftDetail(game, recipe);
      });
      this.craftList.appendChild(row);
    }
    // sin nada elegido: la primera que se puede hacer (o la primera)
    if (!this.craftSel || !list.some(({ r }) => r.id === this.craftSel)) {
      const primera = list[0];
      if (primera) {
        this.craftSel = primera.r.id;
        this.craftList.firstElementChild.classList.add('selected');
        this.renderCraftDetail(game, primera.r);
      }
    }
  }

  // ¿Cuántas veces se puede hacer la receta con lo que tenés?
  static vecesCrafteable(inventory, recipe) {
    let n = Infinity;
    for (const ing of recipe.inputs) n = Math.min(n, Math.floor(SurviConfig.ingredientHave(inventory, ing) / ing.qty));
    return n === Infinity ? 0 : n;
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
        // ícono: el que más tenés de los que sirven
        const icono = ids.reduce((m, id) => ((game.inventory[id] || 0) > (game.inventory[m] || 0) ? id : m), ids[0]);
        const names =
          ing.label ||
          ids.map((id) => (SurviConfig.ITEM_INFO[id] ? SurviConfig.ITEM_INFO[id].name : `#${id}`)).join(' / ');
        return `
        <div class="survi-craft-ing ${enough ? 'have' : 'missing'}">
          ${SurviUI.iconMarkup(icono, 18)}
          <span class="survi-craft-ing-name">${names}</span>
          <span class="survi-craft-ing-qty">${have}/${ing.qty}</span>
        </div>
      `;
      })
      .join('');
    const veces = SurviUI.vecesCrafteable(game.inventory, recipe);
    const ok = veces > 0;
    const cantidades = [1, 5, 'max'].filter((c) => c === 1 || (c === 'max' ? veces > 1 : veces >= c));
    this.craftDetail.innerHTML = `
      ${SurviUI.fichaItem(recipe.result, { cantidad: recipe.resultQty || 1, px: 40 })}
      <p class="survi-craft-sub">Necesitás</p>
      <div class="survi-craft-ings">${rows}</div>
      <div class="survi-craft-btns">
        ${cantidades
          .map(
            (c) =>
              `<button class="btn-game-primary survi-craft-btn" data-veces="${c}" ${ok ? '' : 'disabled'}>${
                c === 'max' ? `Craftear todo (${veces})` : c === 1 ? 'Craftear' : `×${c}`
              }</button>`,
          )
          .join('')}
      </div>
    `;
    this.craftDetail.querySelectorAll('.survi-craft-btn').forEach((btn) =>
      btn.addEventListener('click', () => {
        const pedido = btn.dataset.veces === 'max' ? veces : Number(btn.dataset.veces);
        let hechas = 0, res = { ok: true };
        while (hechas < pedido && (res = game.craftItem(recipe.id)).ok) hechas++;
        this.renderCraft(game); // refresca la lista y el detalle (cantidades nuevas)
        if (hechas && this.showToast) {
          const total = hechas * (recipe.resultQty || 1);
          this.showToast(`Crafteaste: ${SurviUI.recipeResultName(recipe)}${total > 1 ? ` ×${total}` : ''}`);
        }
        if (!res.ok && res.reason === 'full' && this.showToast) this.showToast('Inventario lleno — no entra el resultado');
      }),
    );
  }
}
