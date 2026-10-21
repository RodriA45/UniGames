// ══════════════════════════════════════
//   RPG Pixel — rpg_menu_flow.js  (módulo ES6)
// ══════════════════════════════════════
// Clase RpgPartida: Slots, dificultad, capítulos y arranque de cada habitación.
import { RpgModulo } from './rpg_modulo.js';
import { juego } from './rpg_juego.js';
import { RpgConfig } from './rpg_config.js';
import { RpgDatos } from './rpg_enemies_data.js';
export class RpgPartida extends RpgModulo {
  constructor() {
    super();
    // Si el usuario cambia la calidad DURANTE una partida (no solo desde el
    // menú), el canvas se redimensiona en el próximo frame en vez de esperar a
    // la sala siguiente. Este módulo se importa una sola vez por sesión (el
    // import() de app2.js está cacheado en una promesa — ver ensureRpgLoaded),
    // así que el listener también queda registrado una sola vez.
    if (typeof Engine2D !== 'undefined' && Engine2D.Quality) {
      Engine2D.Quality.onChange(() => {
        // Sin canvas todavía (nunca se abrió el RPG en esta sesión) no hay nada
        // que redimensionar — rpgStartRoom lo va a hacer con el valor correcto
        // cuando se entre por primera vez.
        if (juego.canvas && juego.ctx) this.applyCanvasScale(juego.canvas);
      });
    }
  }

  //   Menú — selección de slot → (dificultad si es nueva) → selección de capítulo
  // ═══════════════════════════════════════════════
  showSlotsView() {
    juego.menu.hideAllMenuViews();
    RpgConfig.EL.slotsView.classList.remove('hidden');
    this.renderSlots();
  }

  renderSlots() {
    const wrap = RpgConfig.EL.slotsButtons;
    if (!wrap) return;
    let html = '';
    for (let n = 1; n <= RpgConfig.SAVE_SLOTS; n++) {
      const data = juego.menu.loadSlotData(n);
      if (juego.menu.slotsPerdidos.has(n)) {
        html +=
          '<p class="rpg-slot-lost" style="color:#f87171;font-size:12px;margin:4px 0;">Partida ' +
          n +
          ' perdida: saliste en medio de un capítulo.</p>';
      }
      if (data) {
        const completed = data.chaptersCompleted.length;
        const dateStr = data.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : '';
        html +=
          '<div class="rpg-slot-row">' +
          '<button class="btn-play rpg-slot-btn" onclick="rpgSelectSlot(' +
          n +
          ')">' +
          'Partida ' +
          n +
          ' · Cap. ' +
          data.chapterUnlocked +
          ' · ' +
          (data.difficulty === 'elite' ? 'Elite' : 'Normal') +
          (completed ? ' · ' + completed + ' completado' + (completed > 1 ? 's' : '') : '') +
          (dateStr ? '<span class="rpg-slot-date">' + dateStr + '</span>' : '') +
          '</button>' +
          '<button class="rpg-slot-delete" title="Borrar partida" onclick="rpgDeleteSlotConfirm(' +
          n +
          ')" aria-label="Borrar partida">' + (window.app && app.utils ? app.utils.uiIconSVG('trash', 15) : 'X') + '</button>' +
          '</div>';
      } else {
        html +=
          '<div class="rpg-slot-row">' +
          '<button class="btn-play rpg-slot-btn rpg-slot-empty" onclick="rpgSelectSlot(' +
          n +
          ')">Partida ' +
          n +
          ' · Nueva</button>' +
          '</div>';
      }
    }
    wrap.innerHTML = html;
    juego.menu.slotsPerdidos.clear();
  }

  deleteSlotConfirm(n) {
    if (!confirm('¿Borrar la Partida ' + n + '? Esta acción no se puede deshacer.')) return;
    juego.menu.deleteSlotData(n);
    this.renderSlots();
  }

  selectSlot(n) {
    juego.activeSlot = n;
    const existing = juego.menu.loadSlotData(n);
    if (!existing && juego.menu.slotsPerdidos.has(n)) {
      // Se detectó recién ahora que había quedado un capítulo a medias.
      this.renderSlots();
      return;
    }
    if (existing) {
      juego.save = existing;
      this.showChapterSelect();
    } else {
      // Partida nueva: todavía no se crea el save hasta elegir dificultad.
      juego.menu.hideAllMenuViews();
      RpgConfig.EL.difficultyView.classList.remove('hidden');
    }
  }

  selectDifficulty(diff) {
    juego.save = juego.menu.newSaveData();
    juego.save.difficulty = diff; // 'normal' | 'elite'
    juego.menu.saveSlotData(juego.activeSlot, juego.save);
    // Partida nueva: siempre arranca en el capítulo 1, sin pantalla de selección.
    this.startChapter(1);
  }

  showChapterSelect() {
    RpgConfig.EL.slotsView.classList.add('hidden');
    RpgConfig.EL.chaptersView.classList.remove('hidden');
    this.renderChapters();
  }

  backToSlots() {
    this.showSlotsView();
  }

  renderChapters() {
    const wrap = RpgConfig.EL.chapterButtons;
    if (!wrap) return;
    const save = juego.save || juego.menu.newSaveData();
    let html = '';
    Object.keys(RpgDatos.CHAPTERS)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((idx) => {
        const cfg = RpgDatos.CHAPTERS[idx];
        const unlocked = idx <= save.chapterUnlocked;
        const completed = save.chaptersCompleted.includes(idx);
        const conMejoras = !!(save.runUpgrades && save.runUpgrades.chapter === idx);
        if (unlocked) {
          html +=
            '<button class="btn-play" onclick="rpgStartChapter(' +
            idx +
            ')">' +
            cfg.name +
            (completed ? ' (completado)' : '') +
            (conMejoras ? ' · ▶ con tus mejoras' : '') +
            '</button>';
        } else {
          html += '<button class="btn-play rpg-btn-secondary" disabled>' + cfg.name + ' (bloqueado)</button>';
        }
      });
    wrap.innerHTML = html;
  }

  // Texto del HUD con el nombre del enemigo: en habitaciones normales
  // muestra cuántos quedan vivos (puede haber varias especies a la vez); en
  // la habitación del jefe muestra su nombre y fase actual.
  updateEnemyLabel() {
    const cfg = juego.datos.roomCfg();
    const el = RpgConfig.EL.enemyName;
    if (!el || !cfg) return;
    if (cfg.type === 'boss') {
      const boss = juego.enemies[0];
      el.textContent = cfg.enemyName + (boss && boss.phase > 1 ? ' · Fase ' + boss.phase : '');
    } else {
      const alive = juego.enemies.filter((e) => e.alive).length;
      el.textContent = 'Enemigos: ' + alive + '/' + juego.enemies.length;
    }
  }

  // ─── Posiciones de costado (usadas solo por rpgSummonWarriors: los 2
  // guerreros invocados siguen apareciendo pegados a cada costado del
  // arena) ─────
  sideX(side, cfg, C) {
    const m = juego.worldWidth * cfg.sideMarginRatio;
    return side === 'left' ? m : juego.worldWidth - m;
  }

  // ─── Arrancar un capítulo (siempre desde la habitación 1) ─────
  // Mejoras de cofres con las que se arranca:
  //   - keepUpgrades true ("▶ Siguiente capítulo" del cartel de victoria):
  //     las que ya están en memoria, la misma partida sigue de largo.
  //   - Desde el menú, si es el capítulo que sigue al último completado
  //     (save.runUpgrades.chapter): las guardadas al completarlo. Así se
  //     puede volver al menú entre capítulos sin perderlas.
  //   - Cualquier otro caso (rejugar un capítulo anterior): desde cero.
  startChapter(chapterIndex, keepUpgrades) {
    const cfg = RpgDatos.CHAPTERS[chapterIndex];
    if (!cfg) return;
    juego.chapter = chapterIndex;
    // Tótem: se recarga en cada capítulo (también al pasar al siguiente).
    juego.totemUsed = false;
    if (!keepUpgrades) {
      const guardadas = juego.save && juego.save.runUpgrades;
      juego.upgrades =
        guardadas && guardadas.chapter === chapterIndex && guardadas.upgrades
          ? { ...RpgPartida.mejorasVacias(), ...guardadas.upgrades }
          : RpgPartida.mejorasVacias();
    }
    // Desde acá hasta completar el capítulo, salir por cualquier lado
    // (morir, abandonar desde la pausa, F5, cerrar la pestaña) pierde la partida.
    juego.menu.setRunActiva(true);
    this.startRoom(1);
  }

  static mejorasVacias() {
    return {
      maxHpBonus: 0,
      dmgReduction: 0,
      speedPermanent: false,
      doubleShot: false,
      dmgBonus: 0,
      burning: false,
      coins: 0,
    };
  }

  // ─── Arrancar una habitación puntual dentro del capítulo actual ─────
  // Resolución interna del canvas: el buffer real es más grande que
  // RPG_LOGICAL_W/H (escalado por devicePixelRatio, con techo según la
  // calidad gráfica elegida — ver Engine2D.Quality) para que se vea nítido en
  // pantallas HiDPI. RPG_LOGICAL_W/H (480x270 de siempre) sigue siendo la
  // unidad con la que se calcula TODO el juego (posiciones, cámara, mundo);
  // el resto del código nunca lee C.width/C.height directo.
  //
  // Techo de densidad por calidad: este es el número más caro de todo el
  // proyecto. Pixel Runner y Castle Escape dibujan 480x270 fijo (130k px por
  // frame); el RPG, con dpr 2.5, dibuja 1200x675 = 810k px por frame — seis
  // veces más trabajo de rasterizado. En calidad baja el techo es 1, o sea
  // exactamente la misma carga que los otros dos juegos.
  //
  // Separada de rpgStartRoom para poder llamarla también desde el listener de
  // Quality.onChange (más abajo) y que el cambio de calidad se note DE UNA,
  // en vez de recién en la próxima sala. Solo toca la resolución del buffer:
  // no resetea cámara, mundo ni roomZoom (rpgComputeRoomZoom no depende del
  // dpr, solo de RPG.worldWidth/RPG_LOGICAL_H — la relación lógica no cambia).
  applyCanvasScale(C) {
    if (!C) return;
    const dprCap =
      typeof Engine2D !== 'undefined' && Engine2D.Quality
        ? Engine2D.Quality.pick({
            low: 1,
            medium: 1.5,
            high: 2.5,
          })
        : 2.5;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    juego.dpr = dpr;
    C.width = RpgConfig.LOGICAL_W * dpr;
    C.height = RpgConfig.LOGICAL_H * dpr;
    // Cambiar el tamaño del canvas resetea el contexto (transform y smoothing
    // incluidos), así que ambos se vuelven a fijar acá: el transform mapea el
    // espacio lógico 480x270 sobre el buffer más grande, y el smoothing
    // apagado mantiene los sprites pixel-art nítidos (solo lo que se dibuja a
    // mano con fillText/paths gana nitidez extra).
    juego.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    juego.ctx.imageSmoothingEnabled = false;
  }

  startRoom(roomIndex) {
    const chapterCfg = juego.datos.chapterCfg();
    const cfg = chapterCfg ? chapterCfg.rooms[roomIndex] : null;
    if (!cfg) return;
    juego.room = roomIndex;
    RpgConfig.EL.menu.classList.add('hidden');
    RpgConfig.EL.hud.classList.remove('hidden');
    // Sin cartel de "Capítulo X · Empezar": se entra directo a la habitación
    // (el diálogo cinemático, si la habitación tiene, sigue mostrándose aparte).
    RpgConfig.EL.overlay.classList.add('hidden');
    // La barra de vida del enemigo solo se muestra en la habitación del jefe
    // (en las de combate normal 1-4 no hay un único "enemigo" cuya vida mostrar).
    const enemyHudWrap = RpgConfig.EL.enemyHudWrap;
    if (enemyHudWrap) enemyHudWrap.classList.toggle('hidden', cfg.type !== 'boss');
    // Marco de la barra de vida del jefe: cada jefe puede traer su propio
    // arte (ver cfg.bossHpBarFrame/bossHpBarWindow — p.ej. dark_ghostking usa
    // lifeboss2.webp con su ventana de relleno propia, distinta a la del
    // marco genérico). Si la sala no lo define (dark_knight, hoy), vuelve al
    // marco de siempre (lifeboss1.webp) y a la ventana fija de la clase CSS
    // .rpg-hud-fill-track-boss (se limpia el estilo inline).
    if (cfg.type === 'boss' && RpgConfig.EL.enemyHudFrameImg) {
      RpgConfig.EL.enemyHudFrameImg.src = cfg.bossHpBarFrame || RpgConfig.ASSET_BASE + 'models/hud/lifeboss1.webp';
      const track = RpgConfig.EL.enemyHpTrack;
      if (track) {
        const w = cfg.bossHpBarWindow;
        track.style.left = w ? w.left : '';
        track.style.top = w ? w.top : '';
        track.style.width = w ? w.width : '';
        track.style.height = w ? w.height : '';
      }
    }
    const timeEl = RpgConfig.EL.timeLeft;
    if (timeEl) {
      timeEl.textContent = '';
      timeEl.classList.remove('rpg-timer-warn');
    }
    requestAnimationFrame(() => {
      const C = juego.canvas;
      this.applyCanvasScale(C);
      // ── Mundo de esta habitación ──
      // El jefe ahora vive en un mundo del mismo ancho que las salas
      // normales (con cámara que lo sigue, ver rpgUpdate) — antes su mundo
      // era fijo a 480 (= el canvas, sin scroll); rpgSideX ya usa
      // RPG.worldWidth así que sus posiciones de costado se ajustan solas.
      juego.worldWidth = RpgConfig.LOGICAL_W * (cfg.worldWidthMult || RpgConfig.ROOM_WORLD_MULT);
      RpgConfig.recalcFloorTopRatio(juego.worldWidth, RpgConfig.LOGICAL_H);
      juego.camera.x = 0;
      juego.camera.y = 0;
      juego.roomZoom = 1; // se recalcula abajo una vez que cfg.zoneImage ya cargó
      juego.roomCleared = false;
      // Reset de estado
      juego.bullets = [];
      juego.enemyProjectiles = [];
      juego.chest = null;
      juego.chestIsBossReward = false;
      juego.banner = null;
      juego.combatElapsed = 0;
      juego.timeLimitMs = null;
      juego.facing = 'down';
      juego.keys = {
        up: false,
        down: false,
        left: false,
        right: false,
        block: false,
        fire: false,
      };
      // Junior entra siempre pegado al costado izquierdo del mundo (la
      // "puerta" de entrada) — incluida ahora la sala del jefe, que dejó de
      // ser un caso especial al unificarse su worldWidth con el resto.
      // cfg.playerSpawnX/playerSpawnY: override para salas cuya zona
      // caminable (ver zonePolygon en rpg_enemies_data.js) no arranca en el
      // margen/altura estándar — ej. piso2a, donde la pared con la puerta
      // decorativa corta más adentro y spawnear en (55, 68%) dejaría a
      // Junior afuera del polígono, trabado sin poder moverse.
      // Vida máxima y velocidad base incluyen las mejoras permanentes
      // juntadas en cofres durante este intento (ver juego.upgrades) — entrar
      // a la habitación siempre cura del todo, pero el máximo/velocidad
      // reflejan lo juntado hasta ahora.
      juego.jugador.entrarASala(
        typeof cfg.playerSpawnX === 'number' ? cfg.playerSpawnX : 55,
        typeof cfg.playerSpawnY === 'number' ? cfg.playerSpawnY : RpgConfig.LOGICAL_H * 0.68,
        25 + juego.mejoras.meta.lifeLevel * RpgConfig.LIFE_UPGRADE_HP + juego.upgrades.maxHpBonus,
        juego.upgrades.speedPermanent ? RpgConfig.PLAYER_SPEED * 1.5 : RpgConfig.PLAYER_SPEED,
      );
      // ── Arma RPG.enemies a partir de cfg.enemySpawns (o cfg.waves[0]) ──
      // La creación en sí vive en rpgCreateEnemies (rpg_enemies_ai.js) para
      // poder reusarla también al spawnear una oleada siguiente en salas con
      // `waves` (ver rpgSpawnNextWave). Acá solo se resuelve CUÁL lista de
      // spawns usar y se resetea el contador de oleada de la sala.
      const floorNow = juego.datos.floorBounds(C);
      // Elite: x2 vida/daño y +10% velocidad para TODOS los enemigos de la
      // sala, incluido el jefe (que entra por este mismo camino con species
      // 'dark_knight' — ver RPG_ELITE_* y rpgEliteActive() más arriba).
      const eliteStatMult = juego.datos.eliteActive() ? RpgConfig.ELITE_STAT_MULT : 1;
      const eliteSpeedMult = juego.datos.eliteActive() ? RpgConfig.ELITE_SPEED_MULT : 1;
      juego.waveIndex = 0;
      const initialSpawns = cfg.waves ? cfg.waves[0] : cfg.enemySpawns;
      juego.enemies = juego.enemigos.createEnemies(initialSpawns, cfg, floorNow, eliteStatMult, eliteSpeedMult);
      juego.enemigos.updateHudBars();
      juego.enemigos.updateHudAmmo();
      this.updateEnemyLabel();
      juego.combate.setupEvents();
      // Especies distintas presentes en esta habitación (para no repetir
      // cargas). Si la sala tiene `waves`, se juntan las especies de TODAS
      // las oleadas acá (no solo la primera) para precargar sus sprites
      // desde el arranque de la sala — si no, la oleada 2 tendría un
      // freno/hitch de carga justo al aparecer en medio del combate.
      const allSpawns = cfg.waves ? cfg.waves.flat() : cfg.enemySpawns;
      const speciesInRoom = Array.from(new Set(allSpawns.map((s) => s.species)));
      // Soltar el fondo de la sala anterior antes de pedir el nuevo. Los
      // fondos son lo más pesado del juego en memoria (un webp de 1920px son
      // ~200KB en disco pero ~7MB decodificado) y no se reusan: después de
      // diez salas había diez bitmaps vivos a la vez. Solo el fondo — los
      // sprites de personajes se quedan, que esos sí se repiten sala a sala.
      if (juego.lastZoneImage && juego.lastZoneImage !== cfg.zoneImage) {
        juego.datos.releaseImage(juego.lastZoneImage);
      }
      juego.lastZoneImage = cfg.zoneImage;
      const loaders = [
        juego.datos.loadImage(cfg.zoneImage),
        juego.datos.loadImage(RpgConfig.ASSET_BASE + 'models/junior/junior.webp'),
        juego.datos.loadImage(RpgConfig.ASSET_BASE + 'models/junior/bloquear.webp'),
        juego.datos.loadImage(RpgConfig.ITEM_SHEET),
      ];
      speciesInRoom.forEach((key) => {
        const species = RpgDatos.ENEMY_TYPES[key];
        if (!species) return;
        loaders.push(juego.datos.loadImage(species.sheet));
        loaders.push(juego.datos.loadAtlas(species.atlas));
        // Ciclo de caminata del jefe: sheet/atlas aparte (ver
        // RPG_ENEMY_TYPES.dark_knight.walkSheet/walkAtlas).
        if (species.walkSheet) loaders.push(juego.datos.loadImage(species.walkSheet));
        if (species.walkAtlas) loaders.push(juego.datos.loadAtlas(species.walkAtlas));
      });
      // Sprite del ataque a distancia del jefe (dark_slash, jefe final por ahora)
      if (cfg.bossProjectileSheet) loaders.push(juego.datos.loadImage(cfg.bossProjectileSheet));
      if (cfg.bossProjectileAtlas) loaders.push(juego.datos.loadAtlas(cfg.bossProjectileAtlas));
      // Cofre de recompensa: solo hace falta en habitaciones normales (no jefe).
      if (cfg.type === 'combat') {
        loaders.push(juego.datos.loadImage(RpgConfig.CHEST_SHEET));
        loaders.push(juego.datos.loadImage(RpgConfig.POWERUP_SHEET));
      }
      // Retratos de diálogo: se cargan aparte, vía Engine2D (el DialogueBox
      // busca las imágenes en el cache propio del motor, no en RPG.images).
      // No se agregan a `loaders`: si todavía no existe el archivo de cara
      // (se suman más adelante), no tiene que romper la carga de la habitación.
      if (cfg.dialogueBefore && cfg.dialogueBefore.length && typeof Engine2D !== 'undefined') {
        const portraits = cfg.dialogueBefore
          .filter((l) => l.portraitSrc)
          .map((l) => ({
            type: 'image',
            src: l.portraitSrc,
          }));
        if (portraits.length) Engine2D.loadAll(portraits).catch(() => {});
      }
      // Barra de carga real (Engine2D.LoadingBar) mientras bajan los sprites
      // de esta habitación — mismo patrón que Castle Escape en castle_loop.js,
      // adaptado con rpgLoadWithProgress porque acá `loaders` ya es un array
      // de promesas, no un manifest {type, src}.
      const rpgLoadingBar = new Engine2D.LoadingBar({
        container: document.querySelector('.rpg-container') || document.body,
        label: 'Cargando habitación…',
      });
      juego.datos
        .loadWithProgress(loaders, (loaded, total) => {
          rpgLoadingBar.update(loaded / total);
        })
        .then(() => {
          rpgLoadingBar.destroy();
          // Ahora que cfg.zoneImage ya está en RPG.images y cargado, se puede
          // calcular el zoom-out fijo de esta habitación puntual (cada fondo
          // puede necesitar un zoom distinto). RPG.camera.y también queda fijo
          // acá, calculado para que el fondo quede siempre anclado abajo (el
          // piso nunca se pierde) igual que en rpgDrawRoomBackground.
          // cfg.forceRoomZoom: escape hatch para saltear el cálculo automático
          // en salas puntuales cuyo fondo tiene una proporción rara y termina
          // zoomeando de más (arena con pinta más chica/apretada que el resto,
          // aunque worldWidth sea el mismo) — ver capítulo 2.
          juego.roomZoom = cfg.forceRoomZoom || juego.datos.computeRoomZoom(C);
          juego.camera.y = RpgConfig.LOGICAL_H * (1 - 1 / juego.roomZoom);
          // forceRestart=true: si es la misma habitación que se acaba de perder,
          // la música tiene que arrancar desde 0, no seguir donde iba.
          juego.servicios.ponerMusica(cfg.music, true);
          // Sin cartel de "Empezar": se entra directo al diálogo (si la
          // habitación tiene uno) o al combate.
          RpgConfig.EL.overlay.classList.add('hidden');
          this.beginCombat();
        })
        .catch((err) => {
          rpgLoadingBar.destroy();
          // Ver rpgLoadImage/rpgLoadAtlas: ahora el error trae el nombre del
          // archivo que 404eó — antes acá no había forma de saber cuál de
          // TODOS los sprites/atlas de la sala era el que faltaba.
          console.error('[RPG] Falló la carga de la habitación:', err);
          // OJO: antes esto arrancaba el texto del overlay pero nunca le
          // sacaba la clase 'hidden' (quedó oculto desde más arriba en esta
          // misma función) — el jugador solo veía el canvas en negro (relleno
          // #0a0f0a de rpgDraw cuando el fondo no cargó) sin ningún mensaje.
          juego.combate.setOverlay(
            chapterCfg.name,
            'No se pudieron cargar los recursos de la habitación.',
            '<button class="btn-play" onclick="rpgShowMenu()">← Volver</button>',
          );
          RpgConfig.EL.overlay.classList.remove('hidden');
        });
    });
  }

  beginCombat() {
    RpgConfig.EL.overlay.classList.add('hidden');
    // OJO: rpgStopLoop() pone RPG.running en false y cancela el raf pendiente.
    // Hay que llamarlo ANTES de activar running = true (si se llama después,
    // apaga el juego que recién se había prendido y el loop nunca vuelve a
    // correr — por eso nada se movía).
    this.stopLoop();
    const cfg = juego.datos.roomCfg();
    if (cfg.dialogueBefore && cfg.dialogueBefore.length) {
      juego.combate.startDialogue(cfg.dialogueBefore, this.actuallyStartCombat);
      return;
    }
    this.actuallyStartCombat();
  }

  actuallyStartCombat() {
    const cfg = juego.datos.roomCfg();
    juego.combatElapsed = 0;
    juego.timeLimitMs = cfg.timeLimitMs === 'music' ? this.getTrackDurationMs(133500) : cfg.timeLimitMs || null;
    juego.combate.startLoop();
  }

  // Duración del tema actual. Si todavía no cargó metadata, se usa el fallback.
  getTrackDurationMs(fallbackMs) {
    return juego.servicios.duracionMusicaMs(fallbackMs);
  }

  stopLoop() {
    juego.running = false;
    if (juego.raf) {
      cancelAnimationFrame(juego.raf);
      juego.raf = null;
    }
  }
}
