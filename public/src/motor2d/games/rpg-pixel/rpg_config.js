// ══════════════════════════════════════
//   RPG Pixel — rpg_config.js  (módulo ES6)
// ══════════════════════════════════════
// Clase RpgConfig: Constantes de tuning, assets, caché del DOM y helpers puros (solo miembros static, no se instancia).

export class RpgConfig {
  // ══════════════════════════════════════
  //   RPG Pixel — rpg.js
  // ══════════════════════════════════════
  //
  // Estructura: capítulos → habitaciones. Cada capítulo tiene 5 habitaciones
  // (1 a 4 = combates normales, 5 = jefe final del capítulo). Al matar al
  // jefe de la habitación 5 se guarda el progreso y se desbloquea el
  // siguiente capítulo. Si morís, o salís a mitad de un capítulo, se pierde
  // el intento: al reintentar se arranca desde la habitación 1 del capítulo
  // (nada se guarda hasta completarlo entero).
  //
  // Usa el objeto global SPRITES (src/motor2d/games/rpg-pixel/models/sprites.js) para
  // recortar cada frame del spritesheet con drawImage, y Engine2D.DialogueBox
  // (engine2d.js) para las cinemáticas de diálogo con retrato.
  //
  // Convención elegida para las filas de SPRITES.junior (documentada acá
  // porque no viene indicada en sprites.js — si al ver el juego corriendo
  // alguna fila queda mal asignada, se cambia únicamente este objeto):
  //   fila 0 = mirando hacia abajo (frente)
  //   fila 1 = mirando hacia arriba (espalda)
  //   fila 2 = mirando hacia la izquierda
  //   fila 3 = mirando hacia la derecha
  static FACING_ROW = {
    down: 0,
    up: 1,
    left: 2,
    right: 3,
  };
  static ASSET_BASE = 'src/motor2d/games/rpg-pixel/';
  // ═══════════════════════════════════════════════
  //   Caché del DOM
  // ═══════════════════════════════════════════════
  // Antes, funciones que corren todo el tiempo (rpgUpdateHudBars en cada
  // golpe, rpgHideAllMenuViews en cada cambio de pantalla, etc.) llamaban
  // document.getElementById(...) de nuevo cada vez, aunque el elemento
  // nunca cambia. Acá se busca cada uno UNA sola vez, al cargar el script
  // (que va al final del <body>, así que el HTML ya existe), y de ahí en
  // adelante se usa la referencia guardada en RPG_EL.
  // Si en algún momento se agrega un elemento nuevo al HTML, solo hay que
  // sumar una línea acá — no hace falta tocar el resto del archivo.
  static EL = {
    overlay: document.getElementById('rpgOverlay'),
    overlayTitle: document.getElementById('rpgOverlayTitle'),
    overlaySub: document.getElementById('rpgOverlaySub'),
    overlayButtons: document.getElementById('rpgOverlayButtons'),
    menu: document.getElementById('rpgMenu'),
    timeLeft: document.getElementById('rpgTimeLeft'),
    slotsView: document.getElementById('rpgSlotsView'),
    hud: document.getElementById('rpgHud'),
    section: document.getElementById('sec-rpg_pixel'),
    slotsButtons: document.getElementById('rpgSlotsButtons'),
    playerHpText: document.getElementById('rpgPlayerHpText'),
    playerHpFill: document.getElementById('rpgPlayerHpFill'),
    playerAvatar: document.getElementById('rpgPlayerAvatar'),
    mejorasView: document.getElementById('rpgMejorasView'),
    mejorasList: document.getElementById('rpgMejorasList'),
    mejorasGold: document.getElementById('rpgMejorasGold'),
    mainMenuView: document.getElementById('rpgMainMenuView'),
    enemyName: document.getElementById('rpgEnemyName'),
    enemyHudWrap: document.getElementById('rpgEnemyHudWrap'),
    enemyHudFrameImg: document.getElementById('rpgEnemyHudFrameImg'),
    enemyHpTrack: document.getElementById('rpgEnemyHpTrack'),
    enemyHpFill: document.getElementById('rpgEnemyHpFill'),
    difficultyView: document.getElementById('rpgDifficultyView'),
    comoJugarView: document.getElementById('rpgComoJugarView'),
    chaptersView: document.getElementById('rpgChaptersView'),
    chapterButtons: document.getElementById('rpgChapterButtons'),
    canvas: document.getElementById('rpgCanvas'),
    ammoText: document.getElementById('rpgAmmoText'),
    ajustesView: document.getElementById('rpgAjustesView'),
  };
  // ─── Resolución lógica vs. resolución real del canvas ─────
  // Todo el juego (posiciones, cámara, mundo, HUD dibujado a mano) se sigue
  // calculando en un espacio lógico fijo de 480x270, exactamente como antes.
  // Lo único que cambia es que el <canvas> real (canvas.width/height, el
  // "backing buffer") ahora es más grande, escalado por devicePixelRatio, y
  // se aplica ctx.setTransform(dpr,...) una vez por habitación (ver
  // rpgStartRoom) para que ese espacio lógico se dibuje nítido sobre el
  // buffer más grande. Antes el canvas se creaba directo a 480x270 y el
  // navegador lo estiraba por CSS hasta ~800px de ancho con nearest-neighbor
  // (image-rendering: pixelated) — de ahí que todo, incluido el texto
  // dibujado a mano (fillText) y los sprites, se viera "bloqueado". Con esto
  // los sprites pixel-art conservan su estilo (siguen sin smoothing) pero el
  // texto, cofres y demás detalles dibujados con vectores quedan mucho más
  // nítidos.
  static LOGICAL_W = 480;
  static LOGICAL_H = 270;
  static JOYSTICK_DEADZONE = 0.2;
  // ─── Zona jugable ─────
  // El piso es la franja inferior del canvas donde el fondo (piso1a/b/c.webp)
  // muestra baldosas en vez de la pared/almenas de fondo. Dónde cae exacto ese
  // borde EN PANTALLA depende de cuánto se recorta verticalmente el fondo al
  // dibujarlo (ver rpgDrawCover con anchorBottom=true) — que a su vez depende
  // de qué tan panorámico sea el mundo de esa habitación. Por eso ya no es una
  // constante única: se recalcula por habitación en rpgStartRoom y se guarda
  // en RPG.floorTopRatio; rpgFloorBounds usa ese valor (con este de acá como
  // default antes de que se calcule la primera vez).
  //
  // RPG_FLOOR_TOP_RATIO_SRC = fracción medida a mano sobre el archivo
  // ORIGINAL piso1a/b/c.webp (0.505 = ahí termina la pared y arranca el piso
  // en la imagen sin recortar). RPG_BG_ASPECT = relación de aspecto de esas
  // imágenes (ancho/alto ≈ igual en piso1a .webp y piso1b/1c .webp nuevos).
  static FLOOR_TOP_RATIO_SRC = 0.505;
  static BG_ASPECT = 1.87;
  static FLOOR_TOP_RATIO = RpgConfig.FLOOR_TOP_RATIO_SRC;
  static FLOOR_BOTTOM_MARGIN = 0.008;
  // ─── Mundo / cámara ─────
  // Las habitaciones de combate (1-4) son más anchas que el canvas visible:
  // la imagen de fondo se estira a este múltiplo del ancho del canvas y la
  // cámara sigue a Junior horizontalmente, así nunca se ve toda la
  // habitación de una — genera incertidumbre sobre qué enemigos hay más
  // adelante. La habitación de jefe ('sides') NO escala: el jefe depende de
  // C.width para sus posiciones de costado, así que ahí worldWidth = C.width
  // (sin scroll, como antes).
  static ROOM_WORLD_MULT = 1.8;
  // Ancho de la franja de "puerta" pegada al borde derecho del mundo: mientras
  // la habitación no está limpia, es una pared invisible; una vez limpia,
  // cruzarla dispara el pase a la siguiente habitación (sin cartel).
  static DOOR_ZONE_W = 26;
  static DEBUG_SHOW_ZONE = false;
  // Zoom-out FIJO por habitación (reemplaza el viejo pan vertical dinámico
  // atado a la posición de Junior). El problema de fondo del pan dinámico:
  // para revelar más "cielo" arriba había que correr toda la escena hacia
  // abajo, y como el fondo es una sola imagen ya completa, eso se comía el
  // piso por abajo — un trade-off inevitable de panear. La solución es
  // zoomear en vez de panear: escalando TODA la escena (fondo + Junior +
  // enemigos) hacia abajo con ctx.scale (ver rpgDraw), se puede ver más
  // arriba Y más abajo al mismo tiempo, sin mover nada según la posición del
  // jugador. RPG.roomZoom se calcula una sola vez por habitación (no por
  // frame) y RPG.camera.y queda fijo todo el nivel — no hay más lerp
  // vertical (ver rpgUpdate, donde antes vivía ese cálculo).
  //
  // RPG_ROOM_ZOOM_STRENGTH interpola entre no zoomear nada (0 = como antes,
  // solo se ve la franja de abajo) y zoomear del todo (1 = revela el 100% de
  // la imagen, cero recorte) — full zoom-out casi anula el scroll horizontal
  // de las salas de combate porque el aspect ratio del arte (~1.87) está muy
  // cerca del aspect del canvas (480/270 ≈ 1.78), así que "entrar entera" la
  // imagen ya te muestra ~95% del ancho del mundo de una. Con 0.35 se revela
  // solo una fracción del cielo extra y se conserva la mayor parte del
  // scroll/incertidumbre horizontal en combate.
  static ROOM_ZOOM_STRENGTH = 0.35;
  // ─── Junior: tamaño y velocidad ─────
  static PLAYER_DRAW_H = 42;
  static PLAYER_SPEED = 2.3;
  static PLAYER_HITBOX = {
    w: 27,
    h: 38,
    yOff: -17,
  };
  static PLAYER_MUZZLE_Y_OFF = -17;
  // ─── Munición ─────
  static PLAYER_MAX_AMMO = 8;
  static PLAYER_RELOAD_MS = 3000;
  // ─── Modo Elite ─────
  // Multiplicadores aplicados a TODOS los enemigos (incluido el jefe) cuando
  // la partida activa se creó en dificultad 'elite' (ver rpgCreateSlot/
  // RPG.save.difficulty). RPG_ELITE_STAT_MULT sube vida y daño (contacto,
  // flechas, dash y proyectiles del jefe); RPG_ELITE_SPEED_MULT sube
  // velocidad de movimiento (enemigos normales, seguimiento vertical del
  // jefe y su dash).
  static ELITE_STAT_MULT = 2;
  static ELITE_SPEED_MULT = 1.1;
  // ─── Íconos reutilizados desde objeto.webp (balas / pociones / proyectiles) ─────
  // Coordenadas recortadas a mano sobre el spritesheet models/objeto.webp.
  static ITEM_SHEET = RpgConfig.ASSET_BASE + 'models/objeto.webp';
  static ITEM_ICONS = {
    bullet: {
      x: 78,
      y: 29,
      w: 55,
      h: 130,
    },
    // bala dorada (disparo normal de Junior)
    bulletBurning: {
      x: 720,
      y: 512,
      w: 112,
      h: 142,
    },
    // bala con chispa de fuego en la punta — mejora permanente (esfera azul): quema al enemigo. OJO: antes apuntaba a un sprite horizontal de "fogonazo" (218,77,199,82) que ya tenía una dirección fija dibujada; como el juego rota el ícono según el ángulo de disparo (ver rpgDraw), esa rotación extra sobre un sprite ya horizontal lo dejaba viéndose como una bala común. Este rect es vertical (punta arriba, misma composición que "bullet") así que rota bien en cualquier dirección, igual que la bala normal.
    potionHp: {
      x: 39,
      y: 348,
      w: 102,
      h: 155,
    },
    // poción roja (cura) — OJO: coordenadas viejas, ver nota abajo
    potionSpeed: {
      x: 39,
      y: 558,
      w: 102,
      h: 147,
    },
    // poción naranja (velocidad) — ídem
    projSmall: {
      x: 72,
      y: 231,
      w: 98,
      h: 105,
    },
    // orbe azul chico — fallback si una habitación no tiene bossProjectileSheet propio
    projBig: {
      x: 258,
      y: 204,
      w: 223,
      h: 136,
    }, // orbe azul grande — ídem
  };
  // NOTA: objeto.webp se reordenó en la nueva versión del sheet. potionHp y
  // potionSpeed quedaron apuntando a un área vacía (esos gráficos ahora viven
  // en power_up.webp, como potionRed/potionOrange más abajo) y projSmall
  // también quedó vacío. Esto rompe las pociones que aparecen en el piso
  // durante el combate — lo dejo señalado para resolverlo aparte, no lo toco
  // ahora para no mezclarlo con la carga de sprites nuevos.
  // ─── Power-ups de recompensa de cofre (models/power_up.webp) ─────
  // Grilla de 2 columnas x 5 filas (celda 420x307), con el ícono recortado
  // a su bounding box real dentro de cada celda (no ocupan la celda entera).
  static POWERUP_SHEET = RpgConfig.ASSET_BASE + 'models/power_up.webp';
  static POWERUP_ICONS = {
    potionGreen: {
      x: 80,
      y: 34,
      w: 190,
      h: 272,
    },
    // +10 HP permanente
    coins: {
      x: 51,
      y: 307,
      w: 301,
      h: 275,
    },
    // recompensa común (oro)
    armor: {
      x: 34,
      y: 659,
      w: 280,
      h: 261,
    },
    // -25% daño recibido
    potionRed: {
      x: 471,
      y: 639,
      w: 196,
      h: 234,
    },
    // cura
    gun: {
      x: 22,
      y: 921,
      w: 303,
      h: 283,
    },
    // dispara 2 balas en vez de 1
    potionOrange: {
      x: 471,
      y: 960,
      w: 197,
      h: 223,
    },
    // +50% velocidad permanente
    ammo: {
      x: 86,
      y: 1300,
      w: 195,
      h: 207,
    },
    // +5 daño
    blueOrb: {
      x: 463,
      y: 1296,
      w: 179,
      h: 192,
    }, // balas queman (1 hp/seg x 5s) — mejora permanente, cambia el aspecto de la bala (ver bulletBurning arriba)
  };
  // ─── Cofres (models/cofre.webp) ─────
  // Grilla de 4 columnas x 2 filas (celda 388x546): secuencia de apertura de
  // 4 frames (cerrado → abriendo → abriendo más → abierto). Salen al
  // completar una habitación normal (no jefe); oro da mejor recompensa.
  static CHEST_SHEET = RpgConfig.ASSET_BASE + 'models/cofre.webp';
  static CHEST_FRAMES = {
    iron: [
      {
        x: 68,
        y: 135,
        w: 293,
        h: 286,
      },
      {
        x: 451,
        y: 131,
        w: 285,
        h: 291,
      },
      {
        x: 842,
        y: 119,
        w: 283,
        h: 313,
      },
      {
        x: 1209,
        y: 86,
        w: 304,
        h: 348,
      },
    ],
    gold: [
      {
        x: 75,
        y: 676,
        w: 288,
        h: 286,
      },
      {
        x: 455,
        y: 675,
        w: 289,
        h: 295,
      },
      {
        x: 827,
        y: 646,
        w: 297,
        h: 328,
      },
      {
        x: 1201,
        y: 637,
        w: 301,
        h: 336,
      },
    ],
  };
  static CHEST_FRAME_MS = 130;
  static CHEST_INTERACT_DIST = 42;
  static CHEST_DRAW_H = 46;
  static CHEST_REWARD_COUNT = 3;
  // ─── Guardado: 3 slots en localStorage ─────
  // ─── Expresiones de Junior para el DialogueBox (models/junior/expresiones.webp) ─────
  // Grilla de 3 columnas x 3 filas (celda 800x597), usada junto con
  // portraitRect en Engine2D.DialogueBox. Nombres a confirmar con Roblei —
  // son mi lectura de cada expresión, se renombran fácil si alguna no pega.
  static EXPRESSION_SHEET = RpgConfig.ASSET_BASE + 'models/junior/expresiones.webp';
  static EXPRESSIONS = {
    nervioso: {
      x: 0,
      y: 0,
      w: 800,
      h: 597,
    },
    feliz: {
      x: 800,
      y: 0,
      w: 800,
      h: 597,
    },
    enojado: {
      x: 1600,
      y: 0,
      w: 800,
      h: 597,
    },
    sorprendido: {
      x: 0,
      y: 597,
      w: 800,
      h: 597,
    },
    decidido: {
      x: 800,
      y: 597,
      w: 800,
      h: 597,
    },
    receloso: {
      x: 1600,
      y: 597,
      w: 800,
      h: 597,
    },
    triste: {
      x: 0,
      y: 1194,
      w: 800,
      h: 598,
    },
    asombrado: {
      x: 800,
      y: 1194,
      w: 800,
      h: 598,
    },
    normal: {
      x: 1600,
      y: 1194,
      w: 800,
      h: 598,
    },
  };
  // ─── Expresiones del Dark Knight (models/capitulo1/dk_expresiones.webp) ─────
  // Mismo mecanismo que RPG_EXPRESSIONS de arriba pero para el jefe del
  // Cap. 1: un solo sheet con 3 caras recortadas por portraitRect (ver
  // dk_expresiones.json). Se usa tanto en el diálogo de inicio del jefe
  // como en el de su derrota (RPG_CHAPTERS[1].rooms[5].deathDialogue).
  static DK_EXPRESSIONS_SHEET = RpgConfig.ASSET_BASE + 'models/capitulo1/dk_expresiones.webp';
  static DK_EXPRESSIONS = {
    angry: {
      x: 70,
      y: 15,
      w: 611,
      h: 835,
    },
    normal: {
      x: 835,
      y: 15,
      w: 659,
      h: 844,
    },
    wounded: {
      x: 1670,
      y: 10,
      w: 633,
      h: 851,
    },
  };
  // ─── Expresiones del Guardián / Dark Ghost King (models/capitulo2/ghostking_expre.png) ─────
  // Mismo mecanismo que RPG_DK_EXPRESSIONS de arriba, para el jefe del Cap. 2.
  // PNG con transparencia real (sin fondo ni carteles de texto) — coordenadas
  // recalculadas sobre esta versión, reemplaza a la hoja .webp anterior.
  // Estos 3 recortes son solo los BUSTOS (para portraitRect en diálogo); las
  // poses de cuerpo entero "enojado"/"derrotado" de esa misma hoja se usan
  // aparte, como atlas de sprite normal (ver RPG_ENEMY_TYPES.dark_ghostking.
  // altSheet/altAtlas en rpg_enemies_data.js).
  static GK_EXPRESSIONS_SHEET = RpgConfig.ASSET_BASE + 'models/capitulo2/ghostking_expre.png';
  static GK_EXPRESSIONS = {
    normal: {
      x: 40,
      y: 19,
      w: 489,
      h: 551,
    },
    angry: {
      x: 674,
      y: 19,
      w: 506,
      h: 552,
    },
    defeated: {
      x: 1314,
      y: 46,
      w: 495,
      h: 525,
    },
  };
  static SAVE_SLOTS = 3;
  static SAVE_KEY_PREFIX = 'rpg_save_slot_';
  // ═══════════════════════════════════════════════
  //   Mejoras permanentes del personaje principal (tienda de oro)
  // ═══════════════════════════════════════════════
  // A diferencia del guardado por capítulo (rpg_save_slot_N, que se borra
  // al perder o salir de una habitación — ver rpgEraseActiveSlot), esto es
  // progreso compartido entre las 3 partidas: el oro juntado en cofres se
  // banca acá apenas se recoge (ver coins.apply en RPG_POWERUP_DEFS) y NO
  // se pierde al morir ni al borrar un slot. Vive en su propia key de
  // localStorage, totalmente aparte del sistema de guardado.
  static META_KEY = 'rpg_meta_progress';
  static LIFE_UPGRADE_MAX = 10;
  static LIFE_UPGRADE_HP = 5;
  static DMG_UPGRADE_MAX = 10;
  static DMG_UPGRADE_STEP = 1;
  static UPGRADE_COST_STEP = 50;
  static CHEST_GUARANTEED_COST = 500;
  static CHEST_EXTRA_COST = 1000;
  static CHEST_EXTRA_CHANCE = 0.25;
  // Tótem (mejora única): cuando un golpe te dejaría en 0 HP, en vez de
  // morir quedás con RPG_TOTEM_HEAL de vida e inmune RPG_TOTEM_INVULN_MS.
  // Se activa UNA vez por capítulo (se recarga al arrancar cada capítulo,
  // ver rpgStartChapter).
  static TOTEM_COST = 1000;
  static TOTEM_HEAL = 25;
  static TOTEM_INVULN_MS = 3000;
  // hasta el borde de abajo, sin murito ni viñeta. Se deja un resto
  // mínimo solo para que los pies de Junior/enemigos no queden
  // recortados justo en el borde del canvas.
  // Recalcula RPG_FLOOR_TOP_RATIO para la habitación actual, en base a qué
  // tan panorámico es su mundo (worldWidth/C.height) comparado con el aspect
  // real de la imagen de fondo. Con el recorte anclado abajo (rpgDrawCover
  // anchorBottom=true):
  //  - Si el mundo es MENOS panorámico que la imagen (el jefe, sin scroll):
  //    no hace falta recortar verticalmente, se ve la imagen completa —
  //    la ratio queda igual que en el archivo original (RPG_FLOOR_TOP_RATIO_SRC).
  //  - Si el mundo es MÁS panorámico (habitaciones de combate, mundo 1.8x):
  //    se recorta desde arriba para llenar el ancho, así que en pantalla el
  //    piso arranca mucho antes (proporcionalmente) que en la imagen original.
  static recalcFloorTopRatio(worldWidth, canvasHeight) {
    const dr = worldWidth / canvasHeight;
    if (RpgConfig.BG_ASPECT > dr) {
      RpgConfig.FLOOR_TOP_RATIO = RpgConfig.FLOOR_TOP_RATIO_SRC;
    } else {
      RpgConfig.FLOOR_TOP_RATIO = 1 - ((1 - RpgConfig.FLOOR_TOP_RATIO_SRC) * dr) / RpgConfig.BG_ASPECT;
    }
  }
}
