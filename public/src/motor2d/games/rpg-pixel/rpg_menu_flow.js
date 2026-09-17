import { rpgLoop, rpgSetOverlay, rpgStartDialogue, setupRpgEvents } from './rpg_combat_input.js';
import { RPG_ASSET_BASE, RPG_CHEST_SHEET, RPG_EL, RPG_ELITE_SPEED_MULT, RPG_ELITE_STAT_MULT, RPG_ITEM_SHEET, RPG_LIFE_UPGRADE_HP, RPG_LOGICAL_H, RPG_LOGICAL_W, RPG_PLAYER_MAX_AMMO, RPG_PLAYER_SPEED, RPG_POWERUP_SHEET, RPG_ROOM_WORLD_MULT, RPG_SAVE_SLOTS, rpgRecalcFloorTopRatio } from './rpg_config.js';
import { rpgCreateEnemies, rpgUpdateHudAmmo, rpgUpdateHudBars } from './rpg_enemies_ai.js';
import { RPG, RPG_CHAPTERS, RPG_ENEMY_TYPES, rpgChapterCfg, rpgComputeRoomZoom, rpgEliteActive, rpgFloorBounds, rpgLoadAtlas, rpgLoadImage, rpgLoadWithProgress, rpgReleaseImage, rpgRoomCfg } from './rpg_enemies_data.js';
import { RPG_META } from './rpg_meta.js';
import { rpgDeleteSlotData, rpgHideAllMenuViews, rpgLoadSlotData, rpgNewSaveData, rpgSaveSlotData, rpgShowMenu } from './rpg_save_ui.js';

//   Menú — selección de slot → (dificultad si es nueva) → selección de capítulo
// ═══════════════════════════════════════════════
export function rpgShowSlotsView() {
  rpgHideAllMenuViews();
  RPG_EL.slotsView.classList.remove('hidden');
  rpgRenderSlots();
}

export function rpgRenderSlots() {
  const wrap = RPG_EL.slotsButtons;
  if (!wrap) return;
  let html = '';
  for (let n = 1; n <= RPG_SAVE_SLOTS; n++) {
    const data = rpgLoadSlotData(n);
    if (data) {
      const completed = data.chaptersCompleted.length;
      const dateStr = data.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : '';
      html += '<div class="rpg-slot-row">'
        + '<button class="btn-play rpg-slot-btn" onclick="rpgSelectSlot(' + n + ')">'
        + 'Partida ' + n + ' · Cap. ' + data.chapterUnlocked
        + ' · ' + (data.difficulty === 'elite' ? 'Elite' : 'Normal')
        + (completed ? ' · ' + completed + ' completado' + (completed > 1 ? 's' : '') : '')
        + (dateStr ? '<span class="rpg-slot-date">' + dateStr + '</span>' : '')
        + '</button>'
        + '<button class="rpg-slot-delete" title="Borrar partida" onclick="rpgDeleteSlotConfirm(' + n + ')">🗑</button>'
        + '</div>';
    } else {
      html += '<div class="rpg-slot-row">'
        + '<button class="btn-play rpg-slot-btn rpg-slot-empty" onclick="rpgSelectSlot(' + n + ')">Partida ' + n + ' · Nueva</button>'
        + '</div>';
    }
  }
  wrap.innerHTML = html;
}

export function rpgDeleteSlotConfirm(n) {
  if (!confirm('¿Borrar la Partida ' + n + '? Esta acción no se puede deshacer.')) return;
  rpgDeleteSlotData(n);
  rpgRenderSlots();
}

export function rpgSelectSlot(n) {
  RPG.activeSlot = n;
  const existing = rpgLoadSlotData(n);
  if (existing) {
    RPG.save = existing;
    rpgShowChapterSelect();
  } else {
    // Partida nueva: todavía no se crea el save hasta elegir dificultad.
    rpgHideAllMenuViews();
    RPG_EL.difficultyView.classList.remove('hidden');
  }
}

export function rpgSelectDifficulty(diff) {
  RPG.save = rpgNewSaveData();
  RPG.save.difficulty = diff; // 'normal' | 'elite'
  rpgSaveSlotData(RPG.activeSlot, RPG.save);
  // Partida nueva: siempre arranca en el capítulo 1, sin pantalla de selección.
  rpgStartChapter(1);
}

export function rpgShowChapterSelect() {
  RPG_EL.slotsView.classList.add('hidden');
  RPG_EL.chaptersView.classList.remove('hidden');
  rpgRenderChapters();
}

export function rpgBackToSlots() {
  rpgShowSlotsView();
}

export function rpgRenderChapters() {
  const wrap = RPG_EL.chapterButtons;
  if (!wrap) return;
  const save = RPG.save || rpgNewSaveData();
  let html = '';
  Object.keys(RPG_CHAPTERS).map(Number).sort((a, b) => a - b).forEach(idx => {
    const cfg = RPG_CHAPTERS[idx];
    const unlocked = idx <= save.chapterUnlocked;
    const completed = save.chaptersCompleted.includes(idx);
    if (unlocked) {
      html += '<button class="btn-play" onclick="rpgStartChapter(' + idx + ')">'
        + cfg.name + (completed ? ' (completado)' : '') + '</button>';
    } else {
      html += '<button class="btn-play rpg-btn-secondary" disabled>' + cfg.name + ' (bloqueado)</button>';
    }
  });
  wrap.innerHTML = html;
}

// Texto del HUD con el nombre del enemigo: en habitaciones normales
// muestra cuántos quedan vivos (puede haber varias especies a la vez); en
// la habitación del jefe muestra su nombre y fase actual.
export function rpgUpdateEnemyLabel() {
  const cfg = rpgRoomCfg();
  const el = RPG_EL.enemyName;
  if (!el || !cfg) return;
  if (cfg.type === 'boss') {
    const boss = RPG.enemies[0];
    el.textContent = cfg.enemyName + (boss && boss.phase > 1 ? ' · Fase ' + boss.phase : '');
  } else {
    const alive = RPG.enemies.filter(e => e.alive).length;
    el.textContent = 'Enemigos: ' + alive + '/' + RPG.enemies.length;
  }
}

// ─── Posiciones de costado (usadas solo por rpgSummonWarriors: los 2
// guerreros invocados siguen apareciendo pegados a cada costado del
// arena) ─────
export function rpgSideX(side, cfg, C) {
  const m = RPG.worldWidth * cfg.sideMarginRatio;
  return side === 'left' ? m : RPG.worldWidth - m;
}

// ─── Arrancar un capítulo (siempre desde la habitación 1) ─────
// keepUpgrades: true SOLO cuando viene de "▶ Siguiente capítulo" en el
// cartel de victoria (ver rpgCompleteChapter, rpg_enemies_ai.js) — ahí es
// la misma partida en curso, así que las mejoras de cofres juntadas en el
// capítulo anterior tienen que seguir. En cualquier otro caso (elegir un
// capítulo a mano desde el menú, reintentar tras morir) es un intento
// nuevo y se resetea, como siempre.
export function rpgStartChapter(chapterIndex, keepUpgrades) {
  const cfg = RPG_CHAPTERS[chapterIndex];
  if (!cfg) return;
  RPG.chapter = chapterIndex;
  // Tótem: se recarga en cada capítulo (también al pasar al siguiente).
  RPG.totemUsed = false;
  if (!keepUpgrades) {
    RPG.upgrades = {
      maxHpBonus: 0,
      dmgReduction: 0,
      speedPermanent: false,
      doubleShot: false,
      dmgBonus: 0,
      burning: false,
      coins: 0
    };
  }
  rpgStartRoom(1);
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
export function rpgApplyCanvasScale(C) {
  if (!C) return;
  const dprCap = (typeof Engine2D !== 'undefined' && Engine2D.Quality)
    ? Engine2D.Quality.pick({ low: 1, medium: 1.5, high: 2.5 })
    : 2.5;
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  RPG.dpr = dpr;
  C.width = RPG_LOGICAL_W * dpr;
  C.height = RPG_LOGICAL_H * dpr;
  // Cambiar el tamaño del canvas resetea el contexto (transform y smoothing
  // incluidos), así que ambos se vuelven a fijar acá: el transform mapea el
  // espacio lógico 480x270 sobre el buffer más grande, y el smoothing
  // apagado mantiene los sprites pixel-art nítidos (solo lo que se dibuja a
  // mano con fillText/paths gana nitidez extra).
  RPG.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  RPG.ctx.imageSmoothingEnabled = false;
}

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
    if (RPG.canvas && RPG.ctx) rpgApplyCanvasScale(RPG.canvas);
  });
}

export function rpgStartRoom(roomIndex) {
  const chapterCfg = rpgChapterCfg();
  const cfg = chapterCfg ? chapterCfg.rooms[roomIndex] : null;
  if (!cfg) return;
  RPG.room = roomIndex;

  RPG_EL.menu.classList.add('hidden');
  RPG_EL.hud.classList.remove('hidden');
  // Sin cartel de "Capítulo X · Empezar": se entra directo a la habitación
  // (el diálogo cinemático, si la habitación tiene, sigue mostrándose aparte).
  RPG_EL.overlay.classList.add('hidden');

  // La barra de vida del enemigo solo se muestra en la habitación del jefe
  // (en las de combate normal 1-4 no hay un único "enemigo" cuya vida mostrar).
  const enemyHudWrap = RPG_EL.enemyHudWrap;
  if (enemyHudWrap) enemyHudWrap.classList.toggle('hidden', cfg.type !== 'boss');

  const timeEl = RPG_EL.timeLeft;
  if (timeEl) { timeEl.textContent = ''; timeEl.classList.remove('rpg-timer-warn'); }

  requestAnimationFrame(() => {
    const C = RPG.canvas;
    rpgApplyCanvasScale(C);

    // ── Mundo de esta habitación ──
    // El jefe ahora vive en un mundo del mismo ancho que las salas
    // normales (con cámara que lo sigue, ver rpgUpdate) — antes su mundo
    // era fijo a 480 (= el canvas, sin scroll); rpgSideX ya usa
    // RPG.worldWidth así que sus posiciones de costado se ajustan solas.
    RPG.worldWidth = RPG_LOGICAL_W * (cfg.worldWidthMult || RPG_ROOM_WORLD_MULT);
    rpgRecalcFloorTopRatio(RPG.worldWidth, RPG_LOGICAL_H);
    RPG.camera.x = 0;
    RPG.camera.y = 0;
    RPG.roomZoom = 1; // se recalcula abajo una vez que cfg.zoneImage ya cargó
    RPG.roomCleared = false;

    // Reset de estado
    RPG.bullets = [];
    RPG.enemyProjectiles = [];
    RPG.chest = null;
    RPG.chestIsBossReward = false;
    RPG.banner = null;
    RPG.combatElapsed = 0;
    RPG.timeLimitMs = null;
    RPG.facing = 'down';
    RPG.keys = { up: false, down: false, left: false, right: false, block: false, fire: false };
    // Junior entra siempre pegado al costado izquierdo del mundo (la
    // "puerta" de entrada) — incluida ahora la sala del jefe, que dejó de
    // ser un caso especial al unificarse su worldWidth con el resto.
    // cfg.playerSpawnX/playerSpawnY: override para salas cuya zona
    // caminable (ver zonePolygon en rpg_enemies_data.js) no arranca en el
    // margen/altura estándar — ej. piso2a, donde la pared con la puerta
    // decorativa corta más adentro y spawnear en (55, 68%) dejaría a
    // Junior afuera del polígono, trabado sin poder moverse.
    RPG.player.x = (typeof cfg.playerSpawnX === 'number') ? cfg.playerSpawnX : 55;
    RPG.player.y = (typeof cfg.playerSpawnY === 'number') ? cfg.playerSpawnY : RPG_LOGICAL_H * 0.68;
    // Vida máxima y velocidad base incluyen las mejoras permanentes
    // juntadas en cofres durante este intento (ver RPG.upgrades) — entrar
    // a la habitación siempre cura del todo, pero el máximo/velocidad
    // reflejan lo juntado hasta ahora.
    RPG.player.maxHp = 25 + (RPG_META.lifeLevel * RPG_LIFE_UPGRADE_HP) + RPG.upgrades.maxHpBonus;
    RPG.player.hp = RPG.player.maxHp;
    RPG.player.speed = RPG.upgrades.speedPermanent ? RPG_PLAYER_SPEED * 1.5 : RPG_PLAYER_SPEED;
    RPG.player.blocking = false;
    RPG.player.blockCooldown = 0;
    RPG.player.fireCooldown = 0;
    RPG.player.ammo = RPG_PLAYER_MAX_AMMO;
    RPG.player.reloading = false;
    RPG.player.reloadTimer = 0;
    RPG.player.hitFlash = 0;
    RPG.player.speedBoostTimer = 0;
    RPG.player.invulnTimer = 0;
    // ── Arma RPG.enemies a partir de cfg.enemySpawns (o cfg.waves[0]) ──
    // La creación en sí vive en rpgCreateEnemies (rpg_enemies_ai.js) para
    // poder reusarla también al spawnear una oleada siguiente en salas con
    // `waves` (ver rpgSpawnNextWave). Acá solo se resuelve CUÁL lista de
    // spawns usar y se resetea el contador de oleada de la sala.
    const floorNow = rpgFloorBounds(C);
    // Elite: x2 vida/daño y +10% velocidad para TODOS los enemigos de la
    // sala, incluido el jefe (que entra por este mismo camino con species
    // 'dark_knight' — ver RPG_ELITE_* y rpgEliteActive() más arriba).
    const eliteStatMult = rpgEliteActive() ? RPG_ELITE_STAT_MULT : 1;
    const eliteSpeedMult = rpgEliteActive() ? RPG_ELITE_SPEED_MULT : 1;
    RPG.waveIndex = 0;
    const initialSpawns = cfg.waves ? cfg.waves[0] : cfg.enemySpawns;
    RPG.enemies = rpgCreateEnemies(initialSpawns, cfg, floorNow, eliteStatMult, eliteSpeedMult);

    rpgUpdateHudBars();
    rpgUpdateHudAmmo();
    rpgUpdateEnemyLabel();

    setupRpgEvents();

    // Especies distintas presentes en esta habitación (para no repetir
    // cargas). Si la sala tiene `waves`, se juntan las especies de TODAS
    // las oleadas acá (no solo la primera) para precargar sus sprites
    // desde el arranque de la sala — si no, la oleada 2 tendría un
    // freno/hitch de carga justo al aparecer en medio del combate.
    const allSpawns = cfg.waves ? cfg.waves.flat() : cfg.enemySpawns;
    const speciesInRoom = Array.from(new Set(allSpawns.map(s => s.species)));

    // Soltar el fondo de la sala anterior antes de pedir el nuevo. Los
    // fondos son lo más pesado del juego en memoria (un webp de 1920px son
    // ~200KB en disco pero ~7MB decodificado) y no se reusan: después de
    // diez salas había diez bitmaps vivos a la vez. Solo el fondo — los
    // sprites de personajes se quedan, que esos sí se repiten sala a sala.
    if (RPG._lastZoneImage && RPG._lastZoneImage !== cfg.zoneImage) {
      rpgReleaseImage(RPG._lastZoneImage);
    }
    RPG._lastZoneImage = cfg.zoneImage;

    const loaders = [
      rpgLoadImage(cfg.zoneImage),
      rpgLoadImage(RPG_ASSET_BASE + 'models/junior/junior.webp'),
      rpgLoadImage(RPG_ASSET_BASE + 'models/junior/bloquear.webp'),
      rpgLoadImage(RPG_ITEM_SHEET)
    ];
    speciesInRoom.forEach(key => {
      const species = RPG_ENEMY_TYPES[key];
      if (!species) return;
      loaders.push(rpgLoadImage(species.sheet));
      loaders.push(rpgLoadAtlas(species.atlas));
      // Ciclo de caminata del jefe: sheet/atlas aparte (ver
      // RPG_ENEMY_TYPES.dark_knight.walkSheet/walkAtlas).
      if (species.walkSheet) loaders.push(rpgLoadImage(species.walkSheet));
      if (species.walkAtlas) loaders.push(rpgLoadAtlas(species.walkAtlas));
    });
    // Sprite del ataque a distancia del jefe (dark_slash, jefe final por ahora)
    if (cfg.bossProjectileSheet) loaders.push(rpgLoadImage(cfg.bossProjectileSheet));
    if (cfg.bossProjectileAtlas) loaders.push(rpgLoadAtlas(cfg.bossProjectileAtlas));
    // Cofre de recompensa: solo hace falta en habitaciones normales (no jefe).
    if (cfg.type === 'combat') {
      loaders.push(rpgLoadImage(RPG_CHEST_SHEET));
      loaders.push(rpgLoadImage(RPG_POWERUP_SHEET));
    }

    // Retratos de diálogo: se cargan aparte, vía Engine2D (el DialogueBox
    // busca las imágenes en el cache propio del motor, no en RPG.images).
    // No se agregan a `loaders`: si todavía no existe el archivo de cara
    // (se suman más adelante), no tiene que romper la carga de la habitación.
    if (cfg.dialogueBefore && cfg.dialogueBefore.length && typeof Engine2D !== 'undefined') {
      const portraits = cfg.dialogueBefore.filter(l => l.portraitSrc).map(l => ({ type: 'image', src: l.portraitSrc }));
      if (portraits.length) Engine2D.loadAll(portraits).catch(() => {});
    }

    // Barra de carga real (Engine2D.LoadingBar) mientras bajan los sprites
    // de esta habitación — mismo patrón que Castle Escape en castle_loop.js,
    // adaptado con rpgLoadWithProgress porque acá `loaders` ya es un array
    // de promesas, no un manifest {type, src}.
    const rpgLoadingBar = new Engine2D.LoadingBar({
      container: document.querySelector('.rpg-container') || document.body,
      label: 'Cargando habitación…'
    });
    rpgLoadWithProgress(loaders, (loaded, total) => {
      rpgLoadingBar.update(loaded / total);
    }).then(() => {
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
      RPG.roomZoom = cfg.forceRoomZoom || rpgComputeRoomZoom(C);
      RPG.camera.y = RPG_LOGICAL_H * (1 - 1 / RPG.roomZoom);
      // forceRestart=true: si es la misma habitación que se acaba de perder,
      // la música tiene que arrancar desde 0, no seguir donde iba.
      if (typeof setMusic === 'function') setMusic(cfg.music, true);
      // Sin cartel de "Empezar": se entra directo al diálogo (si la
      // habitación tiene uno) o al combate.
      RPG_EL.overlay.classList.add('hidden');
      rpgBeginCombat();
    }).catch(err => {
      rpgLoadingBar.destroy();
      // Ver rpgLoadImage/rpgLoadAtlas: ahora el error trae el nombre del
      // archivo que 404eó — antes acá no había forma de saber cuál de
      // TODOS los sprites/atlas de la sala era el que faltaba.
      console.error('[RPG] Falló la carga de la habitación:', err);
      // OJO: antes esto arrancaba el texto del overlay pero nunca le
      // sacaba la clase 'hidden' (quedó oculto desde más arriba en esta
      // misma función) — el jugador solo veía el canvas en negro (relleno
      // #0a0f0a de rpgDraw cuando el fondo no cargó) sin ningún mensaje.
      rpgSetOverlay(chapterCfg.name, 'No se pudieron cargar los recursos de la habitación.', '<button class="btn-play" onclick="rpgShowMenu()">← Volver</button>');
      RPG_EL.overlay.classList.remove('hidden');
    });
  });
}

export function rpgBeginCombat() {
  RPG_EL.overlay.classList.add('hidden');
  // OJO: rpgStopLoop() pone RPG.running en false y cancela el raf pendiente.
  // Hay que llamarlo ANTES de activar running = true (si se llama después,
  // apaga el juego que recién se había prendido y el loop nunca vuelve a
  // correr — por eso nada se movía).
  rpgStopLoop();

  const cfg = rpgRoomCfg();
  if (cfg.dialogueBefore && cfg.dialogueBefore.length) {
    rpgStartDialogue(cfg.dialogueBefore, rpgActuallyStartCombat);
    return;
  }
  rpgActuallyStartCombat();
}

export function rpgActuallyStartCombat() {
  const cfg = rpgRoomCfg();
  RPG.combatElapsed = 0;
  RPG.timeLimitMs = cfg.timeLimitMs === 'music'
    ? rpgGetTrackDurationMs(133500)
    : (cfg.timeLimitMs || null);

  RPG.running = true;
  RPG.raf = requestAnimationFrame(rpgLoop);
}

// Duración del tema actual (bgMusic vive en app.js, cargado después de
// este archivo — por eso se referencia en tiempo de ejecución, no acá
// arriba). Si todavía no cargó metadata, se usa el fallback.
export function rpgGetTrackDurationMs(fallbackMs) {
  if (typeof bgMusic !== 'undefined' && bgMusic && isFinite(bgMusic.duration) && bgMusic.duration > 0) {
    return bgMusic.duration * 1000;
  }
  return fallbackMs;
}

export function rpgStopLoop() {
  RPG.running = false;
  if (RPG.raf) { cancelAnimationFrame(RPG.raf); RPG.raf = null; }
}

// ═══════════════════════════════════════════════
//   Diálogo — cinemática con retrato (Engine2D.DialogueBox)
// ═══════════════════════════════════════════════
// Se usa antes de empezar una habitación si `cfg.dialogueBefore` está
// definido. Corre en su propio loop (separado del combate) mientras dura,
// y llama a `onDone` cuando el jugador terminó de avanzar todas las líneas.
