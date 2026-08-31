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
const RPG_FACING_ROW = { down: 0, up: 1, left: 2, right: 3 };

const RPG_ASSET_BASE = 'src/motor2d/games/rpg-pixel/';

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
const RPG_EL = {
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
const RPG_LOGICAL_W = 480;
const RPG_LOGICAL_H = 270;
const RPG_JOYSTICK_DEADZONE = 0.2; // ignora micro-toques accidentales cerca del centro


// ─── Zona jugable ─────
// El piso es la franja inferior del canvas donde el fondo (piso1a/b/c.png)
// muestra baldosas en vez de la pared/almenas de fondo. Dónde cae exacto ese
// borde EN PANTALLA depende de cuánto se recorta verticalmente el fondo al
// dibujarlo (ver rpgDrawCover con anchorBottom=true) — que a su vez depende
// de qué tan panorámico sea el mundo de esa habitación. Por eso ya no es una
// constante única: se recalcula por habitación en rpgStartRoom y se guarda
// en RPG.floorTopRatio; rpgFloorBounds usa ese valor (con este de acá como
// default antes de que se calcule la primera vez).
//
// RPG_FLOOR_TOP_RATIO_SRC = fracción medida a mano sobre el archivo
// ORIGINAL piso1a/b/c.png (0.505 = ahí termina la pared y arranca el piso
// en la imagen sin recortar). RPG_BG_ASPECT = relación de aspecto de esas
// imágenes (ancho/alto ≈ igual en piso1a .png y piso1b/1c .jfif nuevos).
const RPG_FLOOR_TOP_RATIO_SRC = 0.505;
const RPG_BG_ASPECT = 1.87;
let RPG_FLOOR_TOP_RATIO = RPG_FLOOR_TOP_RATIO_SRC; // se recalcula por habitación, ver rpgStartRoom
const RPG_FLOOR_BOTTOM_MARGIN = 0.008; // antes 0.02 — confirmado sobre piso1a/b/c: el piso llega limpio
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
function rpgRecalcFloorTopRatio(worldWidth, canvasHeight) {
  const dr = worldWidth / canvasHeight;
  if (RPG_BG_ASPECT > dr) {
    RPG_FLOOR_TOP_RATIO = RPG_FLOOR_TOP_RATIO_SRC;
  } else {
    RPG_FLOOR_TOP_RATIO = 1 - (1 - RPG_FLOOR_TOP_RATIO_SRC) * dr / RPG_BG_ASPECT;
  }
}

// ─── Mundo / cámara ─────
// Las habitaciones de combate (1-4) son más anchas que el canvas visible:
// la imagen de fondo se estira a este múltiplo del ancho del canvas y la
// cámara sigue a Junior horizontalmente, así nunca se ve toda la
// habitación de una — genera incertidumbre sobre qué enemigos hay más
// adelante. La habitación de jefe ('sides') NO escala: el jefe depende de
// C.width para sus posiciones de costado, así que ahí worldWidth = C.width
// (sin scroll, como antes).
const RPG_ROOM_WORLD_MULT = 1.8;
// Ancho de la franja de "puerta" pegada al borde derecho del mundo: mientras
// la habitación no está limpia, es una pared invisible; una vez limpia,
// cruzarla dispara el pase a la siguiente habitación (sin cartel).
const RPG_DOOR_ZONE_W = 26;

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
const RPG_ROOM_ZOOM_STRENGTH = 0.35;

function rpgComputeRoomZoom(C) {
  const cfg = rpgRoomCfg();
  const bg = cfg && RPG.images[cfg.zoneImage];
  if (!cfg || !bg || !bg.complete || !bg.naturalWidth || !bg.naturalHeight) return 1;
  const dr = RPG.worldWidth / RPG_LOGICAL_H;      // aspect del rect mundo x canvas, a zoom 1
  const ir = bg.naturalWidth / bg.naturalHeight;  // aspect real de la imagen de fondo
  if (ir > dr) return 1; // acá rpgDrawRoomBackground ya recorta a los costados, no arriba/abajo: no hace falta zoom
  const dhFull = RPG.worldWidth / ir;             // alto (en unidades de mundo) del fondo estirado a worldWidth, sin recortar nada
  if (dhFull <= RPG_LOGICAL_H) return 1; // ya entra entero sin zoom (fondo ancho respecto a su alto)
  const fitZoom = RPG_LOGICAL_H / dhFull; // zoom que revelaría el 100% de la imagen (cero recorte)
  return 1 + (fitZoom - 1) * RPG_ROOM_ZOOM_STRENGTH; // interpola: revela solo una fracción fija del cielo extra
}

// ─── Junior: tamaño y velocidad ─────
const RPG_PLAYER_DRAW_H = 42;   // antes 56 — más chico, así no "flota" al pisar el borde superior de la zona
const RPG_PLAYER_SPEED = 2.3;   // antes 1.6 — más rápido
const RPG_PLAYER_HITBOX = { w: 27, h: 38, yOff: -17 }; // escalado junto con RPG_PLAYER_DRAW_H
const RPG_PLAYER_MUZZLE_Y_OFF = -17;

// ─── Munición ─────
const RPG_PLAYER_MAX_AMMO = 8;
const RPG_PLAYER_RELOAD_MS = 3000; // recarga automática al gastar el cargador entero

// ─── Modo Elite ─────
// Multiplicadores aplicados a TODOS los enemigos (incluido el jefe) cuando
// la partida activa se creó en dificultad 'elite' (ver rpgCreateSlot/
// RPG.save.difficulty). RPG_ELITE_STAT_MULT sube vida y daño (contacto,
// flechas, dash y proyectiles del jefe); RPG_ELITE_SPEED_MULT sube
// velocidad de movimiento (enemigos normales, seguimiento vertical del
// jefe y su dash).
const RPG_ELITE_STAT_MULT = 2;
const RPG_ELITE_SPEED_MULT = 1.10;
function rpgEliteActive() {
  return !!(RPG.save && RPG.save.difficulty === 'elite');
}

// ─── Íconos reutilizados desde objeto.png (balas / pociones / proyectiles) ─────
// Coordenadas recortadas a mano sobre el spritesheet models/objeto.png.
const RPG_ITEM_SHEET = RPG_ASSET_BASE + 'models/objeto.png';
const RPG_ITEM_ICONS = {
  bullet:      { x: 78,  y: 29,  w: 55,  h: 130 }, // bala dorada (disparo normal de Junior)
  bulletBurning: { x: 720, y: 512, w: 112, h: 142 }, // bala con chispa de fuego en la punta — mejora permanente (esfera azul): quema al enemigo. OJO: antes apuntaba a un sprite horizontal de "fogonazo" (218,77,199,82) que ya tenía una dirección fija dibujada; como el juego rota el ícono según el ángulo de disparo (ver rpgDraw), esa rotación extra sobre un sprite ya horizontal lo dejaba viéndose como una bala común. Este rect es vertical (punta arriba, misma composición que "bullet") así que rota bien en cualquier dirección, igual que la bala normal.
  potionHp:    { x: 39,  y: 348, w: 102, h: 155 }, // poción roja (cura) — OJO: coordenadas viejas, ver nota abajo
  potionSpeed: { x: 39,  y: 558, w: 102, h: 147 }, // poción naranja (velocidad) — ídem
  projSmall:   { x: 72,  y: 231, w: 98,  h: 105 }, // orbe azul chico — fallback si una habitación no tiene bossProjectileSheet propio
  projBig:     { x: 258, y: 204, w: 223, h: 136 }  // orbe azul grande — ídem
};
// NOTA: objeto.png se reordenó en la nueva versión del sheet. potionHp y
// potionSpeed quedaron apuntando a un área vacía (esos gráficos ahora viven
// en power_up.png, como potionRed/potionOrange más abajo) y projSmall
// también quedó vacío. Esto rompe las pociones que aparecen en el piso
// durante el combate — lo dejo señalado para resolverlo aparte, no lo toco
// ahora para no mezclarlo con la carga de sprites nuevos.

// ─── Power-ups de recompensa de cofre (models/power_up.png) ─────
// Grilla de 2 columnas x 5 filas (celda 420x307), con el ícono recortado
// a su bounding box real dentro de cada celda (no ocupan la celda entera).
const RPG_POWERUP_SHEET = RPG_ASSET_BASE + 'models/power_up.png';
const RPG_POWERUP_ICONS = {
  potionGreen:  { x: 80,  y: 34,   w: 190, h: 272 }, // +10 HP permanente
  coins:        { x: 51,  y: 307,  w: 301, h: 275 }, // recompensa común (oro)
  armor:        { x: 34,  y: 659,  w: 280, h: 261 }, // -25% daño recibido
  potionRed:    { x: 471, y: 639,  w: 196, h: 234 }, // cura
  gun:          { x: 22,  y: 921,  w: 303, h: 283 }, // dispara 2 balas en vez de 1
  potionOrange: { x: 471, y: 960,  w: 197, h: 223 }, // +50% velocidad permanente
  ammo:         { x: 86,  y: 1300, w: 195, h: 207 }, // +5 daño
  blueOrb:      { x: 463, y: 1296, w: 179, h: 192 }  // balas queman (1 hp/seg x 5s) — mejora permanente, cambia el aspecto de la bala (ver bulletBurning arriba)
};

// ─── Cofres (models/cofre.png) ─────
// Grilla de 4 columnas x 2 filas (celda 388x546): secuencia de apertura de
// 4 frames (cerrado → abriendo → abriendo más → abierto). Salen al
// completar una habitación normal (no jefe); oro da mejor recompensa.
const RPG_CHEST_SHEET = RPG_ASSET_BASE + 'models/cofre.png';
const RPG_CHEST_FRAMES = {
  iron: [
    { x: 68,   y: 135, w: 293, h: 286 },
    { x: 451,  y: 131, w: 285, h: 291 },
    { x: 842,  y: 119, w: 283, h: 313 },
    { x: 1209, y: 86,  w: 304, h: 348 }
  ],
  gold: [
    { x: 75,   y: 676, w: 288, h: 286 },
    { x: 455,  y: 675, w: 289, h: 295 },
    { x: 827,  y: 646, w: 297, h: 328 },
    { x: 1201, y: 637, w: 301, h: 336 }
  ]
};
const RPG_CHEST_FRAME_MS = 130; // ms por frame de la animación de apertura (4 frames)
const RPG_CHEST_INTERACT_DIST = 42; // radio (px de mundo) para poder abrir el cofre con Interactuar
const RPG_CHEST_DRAW_H = 46; // antes 30 — pedido: que el cofre se vea más grande
const RPG_CHEST_REWARD_COUNT = 3; // plata y oro dan siempre 3 recompensas

// ─── Recompensas de cofre ─────
// Cada entrada: `apply` deja el efecto (algunos son permanentes para el
// resto del intento del capítulo — ver RPG.upgrades, que se resetea en
// rpgStartChapter — otros son al instante nomás, como la cura). `label`
// es lo que se muestra en el cartel al abrir el cofre; `coins` arma el
// suyo dinámico (incluye la cantidad) devolviéndolo desde apply().
// Las tablas de abajo (rpgBuildChestWeights) definen qué tan probable es
// cada una según el tipo de cofre y qué mejoras de una sola vez ya salieron.
const RPG_POWERUP_DEFS = {
  potionGreen: {
    label: '🟢 Poción verde · +10 HP máx',
    apply() {
      RPG.upgrades.maxHpBonus += 10;
      RPG.player.maxHp += 10;
      RPG.player.hp = Math.min(RPG.player.maxHp, RPG.player.hp + 10);
    }
  },
  coins: {
    label: null,
    apply() {
      const amount = 5 + Math.floor(Math.random() * 11); // 5–15
      RPG.upgrades.coins += amount;
      rpgAddMetaGold(amount); // banca directo a la tienda de mejoras permanentes
      return '🪙 Monedas · +' + amount;
    }
  },
  armor: {
    label: '🛡️ Pechera · -25% daño recibido',
    apply() {
      RPG.upgrades.dmgReduction = Math.min(0.75, RPG.upgrades.dmgReduction + 0.25);
    }
  },
  potionRed: {
    label: '❤️ Poción roja · Curación',
    apply() {
      RPG.player.hp = Math.min(RPG.player.maxHp, RPG.player.hp + 15);
    }
  },
  gun: {
    label: '🔫 Pistola · Disparo doble',
    apply() {
      RPG.upgrades.doubleShot = true;
    }
  },
  potionOrange: {
    label: '🟠 Poción amarilla · +50% velocidad',
    apply() {
      RPG.upgrades.speedPermanent = true;
      RPG.player.speed = RPG_PLAYER_SPEED * 1.5;
    }
  },
  ammo: {
    label: '💥 Munición · +2 daño',
    apply() {
      RPG.upgrades.dmgBonus += 2;
    }
  },
  blueOrb: {
    label: '🔵 Esfera azul · Balas en llamas',
    apply() {
      RPG.upgrades.burning = true;
    }
  }
};

// Peso de cada recompensa según el tipo de cofre. Ya no es una tabla fija:
// armor/gun/blueOrb (el "combo especial" del cofre de oro) y potionOrange
// (poción de velocidad, ambos cofres) son de UNA SOLA VEZ por intento —
// una vez que ya salieron, se sacan del sorteo y su % se reparte según lo
// pedido en vez de desperdiciarse. Se recalcula en cada tirada (ver
// rpgRollPowerup) porque depende de qué mejoras ya tiene RPG.upgrades.
//
// Plata: 30 monedas / 40 poción roja / 10 verde / 10 munición / 10
// velocidad (única vez; agotada, esos 10 se reparten 5/5 entre verde y
// munición).
//
// Oro: 40 verde / 40 munición / 10 combo especial (pechera, pistola,
// balas de fuego — cada una única vez; repartido en partes iguales entre
// las que falten, y si ya salieron las 3 ese 10 pasa entero a munición) /
// 10 velocidad (única vez; agotada, se reparte 5/5 entre verde y munición).
function rpgBuildChestWeights(chestType) {
  const u = RPG.upgrades;
  const speedTaken = u.speedPermanent;

  if (chestType === 'gold') {
    let green = 40;
    let ammoW = 40;
    const weights = {};

    const comboAvailable = [];
    if (u.dmgReduction <= 0) comboAvailable.push('armor');
    if (!u.doubleShot) comboAvailable.push('gun');
    if (!u.burning) comboAvailable.push('blueOrb');
    if (comboAvailable.length > 0) {
      const each = 10 / comboAvailable.length;
      comboAvailable.forEach(k => { weights[k] = each; });
    } else {
      ammoW += 10; // combo agotado (las 3 ya salieron) → ese 10% pasa a munición
    }

    if (speedTaken) {
      green += 5;
      ammoW += 5;
    } else {
      weights.potionOrange = 10;
    }

    weights.potionGreen = green;
    weights.ammo = ammoW;
    return weights;
  }

  // Plata
  let green = 10;
  let ammoW = 10;
  const weights = { coins: 30, potionRed: 40 };
  if (speedTaken) {
    green += 5;
    ammoW += 5;
  } else {
    weights.potionOrange = 10;
  }
  weights.potionGreen = green;
  weights.ammo = ammoW;
  return weights;
}

function rpgRollPowerup(chestType) {
  const table = rpgBuildChestWeights(chestType);
  const entries = Object.entries(table);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

// ─── Guardado: 3 slots en localStorage ─────
// ─── Expresiones de Junior para el DialogueBox (models/junior/expresiones.png) ─────
// Grilla de 3 columnas x 3 filas (celda 800x597), usada junto con
// portraitRect en Engine2D.DialogueBox. Nombres a confirmar con Roblei —
// son mi lectura de cada expresión, se renombran fácil si alguna no pega.
const RPG_EXPRESSION_SHEET = RPG_ASSET_BASE + 'models/junior/expresiones.png';
const RPG_EXPRESSIONS = {
  nervioso:    { x: 0,    y: 0,    w: 800, h: 597 },
  feliz:       { x: 800,  y: 0,    w: 800, h: 597 },
  enojado:     { x: 1600, y: 0,    w: 800, h: 597 },
  sorprendido: { x: 0,    y: 597,  w: 800, h: 597 },
  decidido:    { x: 800,  y: 597,  w: 800, h: 597 },
  receloso:    { x: 1600, y: 597,  w: 800, h: 597 },
  triste:      { x: 0,    y: 1194, w: 800, h: 598 },
  asombrado:   { x: 800,  y: 1194, w: 800, h: 598 },
  normal:      { x: 1600, y: 1194, w: 800, h: 598 }
};

// ─── Expresiones del Dark Knight (models/capitulo1/dk_expresiones.png) ─────
// Mismo mecanismo que RPG_EXPRESSIONS de arriba pero para el jefe del
// Cap. 1: un solo sheet con 3 caras recortadas por portraitRect (ver
// dk_expresiones.json). Se usa tanto en el diálogo de inicio del jefe
// como en el de su derrota (RPG_CHAPTERS[1].rooms[5].deathDialogue).
const RPG_DK_EXPRESSIONS_SHEET = RPG_ASSET_BASE + 'models/capitulo1/dk_expresiones.png';
const RPG_DK_EXPRESSIONS = {
  angry:   { x: 70,   y: 15, w: 611, h: 835 },
  normal:  { x: 835,  y: 15, w: 659, h: 844 },
  wounded: { x: 1670, y: 10, w: 633, h: 851 }
};

const RPG_SAVE_SLOTS = 3;
const RPG_SAVE_KEY_PREFIX = 'rpg_save_slot_';

// ═══════════════════════════════════════════════
//   Mejoras permanentes del personaje principal (tienda de oro)
// ═══════════════════════════════════════════════
// A diferencia del guardado por capítulo (rpg_save_slot_N, que se borra
// al perder o salir de una habitación — ver rpgEraseActiveSlot), esto es
// progreso compartido entre las 3 partidas: el oro juntado en cofres se
// banca acá apenas se recoge (ver coins.apply en RPG_POWERUP_DEFS) y NO
// se pierde al morir ni al borrar un slot. Vive en su propia key de
// localStorage, totalmente aparte del sistema de guardado.
const RPG_META_KEY = 'rpg_meta_progress';
const RPG_LIFE_UPGRADE_MAX = 5;     // hasta 5 niveles
const RPG_LIFE_UPGRADE_HP = 5;      // +5 HP máx. por nivel (25 HP máx. en total)
const RPG_DMG_UPGRADE_MAX = 10;     // hasta 10 niveles
const RPG_DMG_UPGRADE_STEP = 1;     // +1 daño por nivel (10 daño máx. en total)
const RPG_UPGRADE_COST_STEP = 50;   // costo del nivel N = N * 50 → 50/100/150/200/250/...
const RPG_CHEST_GUARANTEED_COST = 500; // mejora única: cofre del cap. 1 hab. 1 siempre oro
const RPG_CHEST_EXTRA_COST = 1000;     // mejora única: chance de recompensa extra en cofres
const RPG_CHEST_EXTRA_CHANCE = 0.25;

