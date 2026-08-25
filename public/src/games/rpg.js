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
// Usa el objeto global SPRITES (assert/rpg pixel/models/sprites.js) para
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

const RPG_ASSET_BASE = 'assert/rpg pixel/';

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

function rpgMetaDefaults() {
  return {
    gold: 0,
    lifeLevel: 0,
    dmgLevel: 0,
    guaranteedFirstChest: false,
    extraChestChance: false
  };
}

function rpgLoadMeta() {
  try {
    const raw = localStorage.getItem(RPG_META_KEY);
    if (!raw) return rpgMetaDefaults();
    const data = JSON.parse(raw);
    return Object.assign(rpgMetaDefaults(), data);
  } catch {
    return rpgMetaDefaults();
  }
}

function rpgSaveMeta() {
  try { localStorage.setItem(RPG_META_KEY, JSON.stringify(RPG_META)); } catch {}
}

let RPG_META = rpgLoadMeta();

// Costo del nivel `level` (1-indexado): nivel 1 = 50, nivel 2 = 100, etc.
function rpgUpgradeCost(level) {
  return level * RPG_UPGRADE_COST_STEP;
}

function rpgAddMetaGold(amount) {
  RPG_META.gold += amount;
  rpgSaveMeta();
}

function rpgBuyLifeUpgrade() {
  if (RPG_META.lifeLevel >= RPG_LIFE_UPGRADE_MAX) return;
  const cost = rpgUpgradeCost(RPG_META.lifeLevel + 1);
  if (RPG_META.gold < cost) return;
  RPG_META.gold -= cost;
  RPG_META.lifeLevel += 1;
  rpgSaveMeta();
  rpgRenderMejoras();
}

function rpgBuyDmgUpgrade() {
  if (RPG_META.dmgLevel >= RPG_DMG_UPGRADE_MAX) return;
  const cost = rpgUpgradeCost(RPG_META.dmgLevel + 1);
  if (RPG_META.gold < cost) return;
  RPG_META.gold -= cost;
  RPG_META.dmgLevel += 1;
  rpgSaveMeta();
  rpgRenderMejoras();
}

function rpgBuyGuaranteedChest() {
  if (RPG_META.guaranteedFirstChest) return;
  if (RPG_META.gold < RPG_CHEST_GUARANTEED_COST) return;
  RPG_META.gold -= RPG_CHEST_GUARANTEED_COST;
  RPG_META.guaranteedFirstChest = true;
  rpgSaveMeta();
  rpgRenderMejoras();
}

function rpgBuyExtraChestChance() {
  if (RPG_META.extraChestChance) return;
  if (RPG_META.gold < RPG_CHEST_EXTRA_COST) return;
  RPG_META.gold -= RPG_CHEST_EXTRA_COST;
  RPG_META.extraChestChance = true;
  rpgSaveMeta();
  rpgRenderMejoras();
}

// ─── Vista "Mejoras" del menú ─────
function rpgMejoraRowHtml(opts) {
  return '<div class="rpg-mejora-row">'
    + '<div class="rpg-mejora-info">'
    + '<p class="rpg-mejora-title">' + opts.title + '</p>'
    + '<p class="rpg-mejora-desc">' + opts.desc + '</p>'
    + '</div>'
    + '<div class="rpg-mejora-buy">'
    + '<span class="rpg-mejora-cost">' + opts.costLabel + '</span>'
    + '<button class="btn-play rpg-mejora-btn" ' + (opts.disabled ? 'disabled' : '') + ' onclick="' + opts.onclick + '">' + opts.btnLabel + '</button>'
    + '</div>'
    + '</div>';
}

function rpgRenderMejoras() {
  const goldEl = document.getElementById('rpgMejorasGold');
  if (goldEl) goldEl.textContent = RPG_META.gold;

  const wrap = document.getElementById('rpgMejorasList');
  if (!wrap) return;

  const rows = [];

  const lifeMaxed = RPG_META.lifeLevel >= RPG_LIFE_UPGRADE_MAX;
  const lifeCost = lifeMaxed ? null : rpgUpgradeCost(RPG_META.lifeLevel + 1);
  rows.push(rpgMejoraRowHtml({
    title: '❤️ Vida máxima',
    desc: 'Nivel ' + RPG_META.lifeLevel + '/' + RPG_LIFE_UPGRADE_MAX + ' · +' + RPG_LIFE_UPGRADE_HP + ' HP máx. por nivel',
    costLabel: lifeMaxed ? 'Al máximo' : ('🪙 ' + lifeCost),
    disabled: lifeMaxed || RPG_META.gold < lifeCost,
    onclick: 'rpgBuyLifeUpgrade()',
    btnLabel: lifeMaxed ? 'Máximo' : 'Mejorar'
  }));

  const dmgMaxed = RPG_META.dmgLevel >= RPG_DMG_UPGRADE_MAX;
  const dmgCost = dmgMaxed ? null : rpgUpgradeCost(RPG_META.dmgLevel + 1);
  rows.push(rpgMejoraRowHtml({
    title: '💥 Daño',
    desc: 'Nivel ' + RPG_META.dmgLevel + '/' + RPG_DMG_UPGRADE_MAX + ' · +' + RPG_DMG_UPGRADE_STEP + ' daño por nivel',
    costLabel: dmgMaxed ? 'Al máximo' : ('🪙 ' + dmgCost),
    disabled: dmgMaxed || RPG_META.gold < dmgCost,
    onclick: 'rpgBuyDmgUpgrade()',
    btnLabel: dmgMaxed ? 'Máximo' : 'Mejorar'
  }));

  rows.push(rpgMejoraRowHtml({
    title: '✨ Cofre inicial garantizado',
    desc: 'El primer cofre del Capítulo 1 (habitación 1) sale siempre de oro.',
    costLabel: RPG_META.guaranteedFirstChest ? 'Comprado' : ('🪙 ' + RPG_CHEST_GUARANTEED_COST),
    disabled: RPG_META.guaranteedFirstChest || RPG_META.gold < RPG_CHEST_GUARANTEED_COST,
    onclick: 'rpgBuyGuaranteedChest()',
    btnLabel: RPG_META.guaranteedFirstChest ? 'Comprado' : 'Comprar'
  }));

  rows.push(rpgMejoraRowHtml({
    title: '🍀 Suerte del cofre',
    desc: Math.round(RPG_CHEST_EXTRA_CHANCE * 100) + '% de chance de una recompensa extra en cada cofre.',
    costLabel: RPG_META.extraChestChance ? 'Comprado' : ('🪙 ' + RPG_CHEST_EXTRA_COST),
    disabled: RPG_META.extraChestChance || RPG_META.gold < RPG_CHEST_EXTRA_COST,
    onclick: 'rpgBuyExtraChestChance()',
    btnLabel: RPG_META.extraChestChance ? 'Comprado' : 'Comprar'
  }));

  wrap.innerHTML = rows.join('');
}

// ═══════════════════════════════════════════════
//   Especies de enemigo — catálogo de render/animación
// ═══════════════════════════════════════════════
// Cada especie define su sheet + atlas (frames nombrados, recortados a
// mano por transparencia — NO son grillas uniformes, cada pose tiene un
// tamaño distinto, por eso usan atlas en vez de SPRITES.rows) y los ciclos
// de animación (listas de nombres de frame) que arma rpgDrawEnemy según el
// estado de cada enemigo (idle/walk/attack/hurt/death).
const RPG_ENEMY_TYPES = {
  kn_warror: {
    sheet: RPG_ASSET_BASE + 'models/capitulo1/kn_warror.png',
    atlas: RPG_ASSET_BASE + 'models/capitulo1/kn_warror.json',
    drawH: 66,
    behavior: 'melee',
    animSpeed: 8, // ticks por frame (mismo criterio que rpgUpdateSimpleChase ya usaba)
    animSpeeds: { walk: 14 }, // el walk se ve más lento y notorio que idle/attack
    anims: {
      idle:   ['idle_1', 'idle_2', 'idle_3', 'idle_4', 'idle_5'],
      walk:   ['walk_1', 'walk_2', 'walk_3', 'walk_4', 'walk_5', 'walk_6'],
      attack: ['attack_1', 'attack_2', 'attack_3', 'attack_4', 'attack_5'],
      hurt:   ['hurt_1', 'hurt_2'],
      death:  ['hurt_3', 'death_1', 'death_2', 'death_3']
    }
  },
  kn_archer: {
    sheet: RPG_ASSET_BASE + 'models/capitulo1/kn_archer.png',
    atlas: RPG_ASSET_BASE + 'models/capitulo1/kn_archer.json',
    drawH: 64,
    behavior: 'ranged',
    animSpeed: 8,
    animSpeeds: { walk: 14 }, // el walk se ve más lento y notorio que idle/attack
    preferredDist: [157, 273], // +50% de rango respecto al valor anterior [105, 182], para que no se acerquen tanto
    anims: {
      idle:   ['idle_1', 'idle_2', 'idle_3', 'idle_4', 'idle_5', 'idle_6'],
      walk:   ['walk_1', 'walk_2', 'walk_3', 'walk_4', 'walk_5', 'walk_6'],
      attack: ['attack_1', 'attack_2', 'attack_3', 'attack_4', 'attack_5'],
      hurt:   ['hurt_1', 'hurt_2'],
      death:  ['hurt_3', 'death_1', 'death_2']
    },
    // Flecha más chica que antes (w/h reducidos) para achicar su hitbox
    // real; para compensar y que siga siendo una amenaza, +25% de velocidad.
    projectile: { frameFly: 'arrow_fly', frameHit: 'arrow_hit', w: 11, h: 5, speed: 4.1 }
  },
  dark_knight: {
    sheet: RPG_ASSET_BASE + 'models/capitulo1/Dark_knight.png',
    atlas: RPG_ASSET_BASE + 'models/capitulo1/dark_knight.json',
    drawH: 74,
    behavior: 'sides', // patrón especial de jefe (ver rpgUpdateSidesBoss) — poses elegidas por estado, no por ciclo
    poses: {
      idle: 'idle_front', telegraph: 'windup_2', dashing: 'dash_1',
      summon: 'raise_front', // habilidad "invocar guerreros" — el jefe levanta la espada
      // Secuencia de muerte en 2 partes (ver rpgStartBossDeathSequence):
      // caída 1 = death_1→death_2 (se congela en death_2 durante el diálogo
      // final), caída 2 = death_3→death_4 (se reproduce recién cuando
      // termina el diálogo, y se congela en death_4 hasta que aparece el
      // cofre). Si el atlas usa otros nombres para estos 2 frames nuevos,
      // ajustar acá.
      death1: 'death_1', death2: 'death_2', death3: 'death_3', death4: 'death_4'
    }
  }
};

// Config por capítulo. Cada capítulo tiene rooms 1..5 (5 = jefe final).
// Para sumar un capítulo nuevo: agregar la entrada acá (RPG_CHAPTERS[2] =
// {...}) — el menú de selección de capítulo ya es genérico y lo muestra
// solo, respetando el capítulo desbloqueado del slot activo.
//
// Habitaciones 1-4: `enemySpawns` es la lista de enemigos que aparecen
// SIMULTÁNEOS en la habitación (no oleadas — todos a la vez desde que
// arranca el combate). Dificultad creciente 1→4 tanto en cantidad como en
// stats. Habitación 5 = Dark Knight, jefe final ya diseñado.
const RPG_CHAPTERS = {
  1: {
    name: 'Capítulo 1 · Patio del Castillo',
    rooms: {
      1: {
        type: 'combat',
        name: 'Habitación 1',
        zoneImage: RPG_ASSET_BASE + 'models/capitulo1/piso1a.png',
        music: RPG_ASSET_BASE + 'sound/terror_boss.mp3',
        enemySpawns: [
          { species: 'kn_warror', hp: 50, speed: 0.90, contactDamage: 10 },
          { species: 'kn_warror', hp: 50, speed: 0.90, contactDamage: 10 }
        ],
        dialogueBefore: [
          { speaker: 'Junior', portraitSrc: RPG_EXPRESSION_SHEET, portraitRect: RPG_EXPRESSIONS.nervioso, text: 'Uf... después de buscar una salida, estoy arriba de los muros del castillo.' },
          { speaker: 'Junior', portraitSrc: RPG_EXPRESSION_SHEET, portraitRect: RPG_EXPRESSIONS.receloso, text: 'Me pregunto cómo podré volver a mi mundo... y por qué aparecieron de la nada este escudo y esta arma.' },
          { speaker: 'Junior', portraitSrc: RPG_EXPRESSION_SHEET, portraitRect: RPG_EXPRESSIONS.sorprendido, text: '¡Ahí hay caballeros! Y pinta que no son amigables...' },
          { speaker: 'Junior', portraitSrc: RPG_EXPRESSION_SHEET, portraitRect: RPG_EXPRESSIONS.sorprendido, text: 'Espero que esta arma me ayude a derrotarlos y cruzar este camino.' }
        ]
      },
      2: {
        type: 'combat',
        name: 'Habitación 2',
        zoneImage: RPG_ASSET_BASE + 'models/capitulo1/piso1b.png',
        music: RPG_ASSET_BASE + 'sound/terror_boss.mp3',
        enemySpawns: [
          { species: 'kn_warror', hp: 50, speed: 0.95, contactDamage: 10 },
          { species: 'kn_warror', hp: 50, speed: 0.95, contactDamage: 10 },
          { species: 'kn_archer', hp: 25, speed: 0.65, arrowDamage: 5, fireCooldownMs: [1500, 2200] }
        ]
      },
      3: {
        type: 'combat',
        name: 'Habitación 3',
        zoneImage: RPG_ASSET_BASE + 'models/capitulo1/piso1b.png',
        music: RPG_ASSET_BASE + 'sound/vampire_boss.mp3',
        enemySpawns: [
          // A partir de acá los enemigos ganan +10 HP respecto a las
          // habitaciones 1-2 (60/35 en vez de 50/25) — la habitación 4 se
          // queda en este mismo valor, no vuelve a subir.
          { species: 'kn_warror', hp: 60, speed: 1.0, contactDamage: 10 },
          { species: 'kn_warror', hp: 60, speed: 1.0, contactDamage: 10 },
          { species: 'kn_archer', hp: 35, speed: 0.7, arrowDamage: 5, fireCooldownMs: [1300, 1900] },
          { species: 'kn_archer', hp: 35, speed: 0.7, arrowDamage: 5, fireCooldownMs: [1300, 1900] }
        ]
      },
      4: {
        type: 'combat',
        name: 'Habitación 4',
        zoneImage: RPG_ASSET_BASE + 'models/capitulo1/piso1b.png',
        music: RPG_ASSET_BASE + 'sound/vampire_boss.mp3',
        enemySpawns: [
          { species: 'kn_warror', hp: 60, speed: 1.05, contactDamage: 10 },
          { species: 'kn_warror', hp: 60, speed: 1.05, contactDamage: 10 },
          { species: 'kn_warror', hp: 60, speed: 1.05, contactDamage: 10 },
          { species: 'kn_archer', hp: 35, speed: 0.75, arrowDamage: 5, fireCooldownMs: [1200, 1700] },
          { species: 'kn_archer', hp: 35, speed: 0.75, arrowDamage: 5, fireCooldownMs: [1200, 1700] }
        ]
      },
      5: {
        type: 'boss',
        name: 'Habitación 5 · Jefe final',
        zoneImage: RPG_ASSET_BASE + 'models/capitulo1/piso1c.png',
        // Dark Knight: sheet con poses nombradas (ver RPG_ENEMY_TYPES.dark_knight),
        // NO un ciclo de caminata numérico. Se representa igual que el resto
        // (enemySpawns con 1 entrada) para que el motor sea uniforme.
        enemySpawns: [
          { species: 'dark_knight', hp: 300, speed: 0.95 }
        ],
        enemyName: 'Dark Knight',
        music: RPG_ASSET_BASE + 'sound/dark_knight_boss.mp3',
        enemySpeed: 0.95, // velocidad vertical con la que sigue a Junior

        // ── Patrón "sides": el jefe vive pegado a los costados del mapa,
        // mirando al centro. Se mueve arriba/abajo para alinearse con Junior
        // y dispara proyectiles horizontales; cada tanto hace un dash recto
        // de lado a lado (así cambia de costado). Tiene 3 fases según su HP.
        attackPattern: 'sides',
        sideMarginRatio: 0.14,

        dashDamage: 15,          // daño del dash (100% bloqueable)
        dashTelegraphMs: 550,    // aviso antes de largar el dash
        dashSpeedPhase1: 6,      // fase 1: dash más lento
        dashSpeedPhase2: 9,      // fase 2 y 3: dash más rápido
        dashCooldownMs: [2200, 3200],

        projectileSmallDmg: 5,
        projectileSmallSpeed: 3.1,
        projectileBigDmg: 10,
        projectileBigSpeed: 2.2,
        fireCooldownPhase1: [1100, 1700], // fase 1: solo proyectil chico
        fireCooldownPhase2: [850, 1300],  // fase 2: mezcla chico/grande
        fireCooldownPhase3: [650, 1000],  // fase 3: solo proyectil grande

        // Sprite propio del ataque del jefe. Tiene 2 variantes (large/small)
        // con 2 frames cada una para una animación simple.
        bossProjectileSheet: RPG_ASSET_BASE + 'models/capitulo1/dark_slash.png',
        bossProjectileAtlas: RPG_ASSET_BASE + 'models/capitulo1/dark_slash.json',

        playerBulletDamage: 5, // daño del disparo de Junior contra este jefe

        // El combate dura lo que dura el tema del jefe: si no lo matás antes
        // de que la música termine (o vuelva a arrancar), perdés.
        timeLimitMs: 'music',

        // ── Habilidad "invocar guerreros" ──
        // Cada 20s (ver rpgUpdateSidesBoss), el jefe hace una breve pausa
        // levantando la espada (pose "summon" = raise_front) y aparecen 2
        // kn_warror — siempre uno pegado al costado izquierdo del arena y
        // el otro al derecho (ver rpgSummonWarriors) — con la misma IA de
        // persecución/ataque que ya usan en las habitaciones normales.
        summonCooldownMs: 20000,
        summonTelegraphMs: 700,

        // dk_expresiones.png tiene 3 caras recortadas (angry/normal/wounded)
        // en un solo sheet — se usa portraitRect para elegir cuál mostrar
        // en cada línea, sin necesitar un archivo por expresión.
        dialogueBefore: [
          { speaker: 'Dark Knight', portraitSrc: RPG_DK_EXPRESSIONS_SHEET, portraitRect: RPG_DK_EXPRESSIONS.angry, text: 'Llegaste lejos, pequeño... pero acá termina tu camino.' },
          { speaker: 'Junior', portraitSrc: RPG_EXPRESSION_SHEET, portraitRect: RPG_EXPRESSIONS.decidido, text: 'Eso lo vamos a ver.' }
        ],

        // ── Cinemática de derrota (ver rpgStartBossDeathSequence) ──
        // Arranca apenas el jefe llega a 0 HP: se congela en su sprite
        // "muerte 2" durante todas estas líneas y recién cuando termina la
        // última reproduce la caída real (muerte 1 → muerte 2) y aparece
        // el cofre de oro.
        deathDialogue: [
          { speaker: 'Dark Knight', portraitSrc: RPG_DK_EXPRESSIONS_SHEET, portraitRect: RPG_DK_EXPRESSIONS.wounded, text: 'Me pudiste derrotar... le fallé a mi rey.' },
          { speaker: 'Dark Knight', portraitSrc: RPG_DK_EXPRESSIONS_SHEET, portraitRect: RPG_DK_EXPRESSIONS.wounded, text: 'Guerrero desconocido... nunca podrás ganarle al guardián dentro del castillo.' },
          { speaker: 'Dark Knight', portraitSrc: RPG_DK_EXPRESSIONS_SHEET, portraitRect: RPG_DK_EXPRESSIONS.wounded, text: 'Adiós, mi rey......' },
          { speaker: 'Junior', portraitSrc: RPG_EXPRESSION_SHEET, portraitRect: RPG_EXPRESSIONS.nervioso, text: 'Vaya, sí que fue un enemigo fuerte... así que el rey está en el final...' },
          { speaker: 'Junior', portraitSrc: RPG_EXPRESSION_SHEET, portraitRect: RPG_EXPRESSIONS.decidido, text: 'Debo derrotar al guardián para ir contra el rey... supongo que será más fuerte que el caballero oscuro.' },
          { speaker: 'Junior', portraitSrc: RPG_EXPRESSION_SHEET, portraitRect: RPG_EXPRESSIONS.normal, text: 'Parece que soy el personaje principal de este mundo.' },
          { speaker: 'Junior', portraitSrc: RPG_EXPRESSION_SHEET, portraitRect: RPG_EXPRESSIONS.triste, text: 'Acabo de entrar al juego increíble... espero poder volver a casa.' }
        ]
      }
    }
  }
};

const RPG = {
  canvas: null,
  ctx: null,
  running: false,
  raf: null,

  // ── Progreso de la partida en curso ──
  chapter: 1,
  room: 1,

  // ── Mundo / cámara de la habitación actual ──
  worldWidth: 480,       // se recalcula en rpgStartRoom según la habitación
  camera: { x: 0, y: 0 }, // y: fijo por habitación (ver roomZoom), no mueve el límite de piso ni depende de Junior
  roomZoom: 1,            // zoom-out fijo de esta habitación, 1 = sin zoom (ver rpgComputeRoomZoom)
  roomCleared: false,    // true cuando ya no quedan enemigos vivos (destraba la puerta derecha)

  // ── Slot de guardado activo ──
  activeSlot: null, // 1, 2 o 3
  save: null,       // { chapterUnlocked, chaptersCompleted: [], updatedAt }

  // ── Diálogo ──
  dialogue: null,    // instancia de Engine2D.DialogueBox (se crea una vez)
  inDialogue: false,
  dialogueOnDone: null,

  keys: { up: false, down: false, left: false, right: false },
  facing: 'down', // última dirección caminada; define hacia dónde se dispara
  player: {
    x: 0, y: 0,
    hp: 25, maxHp: 25,
    speed: RPG_PLAYER_SPEED,
    animFrame: 0, animTick: 0,
    moving: false,
    blocking: false,
    blockCooldown: 0, // ms restantes hasta poder volver a bloquear (tras absorber un golpe)
    blockAnimFrame: 0, blockAnimTick: 0,
    fireCooldown: 0,
    ammo: RPG_PLAYER_MAX_AMMO,
    reloading: false,
    reloadTimer: 0,
    hitFlash: 0,
    speedBoostTimer: 0
  },
  // Lista de enemigos vivos/muertos de la habitación actual. Se arma en
  // rpgStartRoom a partir de cfg.enemySpawns (1 a N enemigos simultáneos).
  // El jefe de la habitación 5 también vive acá como enemies[0] — así el
  // motor de update/draw es uniforme para combates normales y jefe.
  enemies: [],
  bullets: [],           // disparos de Junior
  enemyProjectiles: [],  // proyectiles del jefe (patrón "sides")

  // ── Cofre de recompensa de la habitación actual ──
  // null mientras la sala no está limpia; se crea en rpgSpawnChest() al
  // vaciarla (ver rpgVictory) y se resetea a null en cada rpgStartRoom.
  chest: null, // { type: 'iron'|'gold', x, y, frame, animTick, opening, opened }
  chestIsBossReward: false, // true si el cofre actual es el de oro del jefe (ver rpgVictory/rpgCollectChestReward)

  // ── Mejoras permanentes juntadas de cofres durante el intento actual ──
  // Sobreviven entre habitaciones del mismo capítulo (rpgStartRoom NO las
  // toca) pero se resetean al arrancar/reintentar un capítulo — ver
  // rpgStartChapter. Así el riesgo de morir tiene sentido: perdés lo
  // juntado y hay que reintentar desde la habitación 1.
  upgrades: {
    maxHpBonus: 0,
    dmgReduction: 0,   // 0–0.75, fracción de daño recibido absorbida
    speedPermanent: false,
    doubleShot: false,
    dmgBonus: 0,
    burning: false,    // balas queman → celeste (ver bulletBurning) + DOT
    coins: 0
  },

  combatElapsed: 0,
  timeLimitMs: null,
  images: {}, // cache de HTMLImageElement por src
  atlases: {}, // cache de atlas JSON (dark_knight.json) por src
  speciesScale: {}, // cache de escala fija por especie (ver rpgSpeciesScale)
  keyHandlerDown: null,
  keyHandlerUp: null
};

// Distancia mínima "de base" (en px de mundo) que debe haber entre el punto
// de entrada de Junior y cualquier enemigo recién generado. En la práctica
// el spawn real usa además un margen relativo al ancho del canvas (ver
// rpgStartRoom) para garantizar que el enemigo quede FUERA de lo que se ve
// en el primer frame (cámara arranca en x=0), no solo "un poco lejos".
const RPG_SPAWN_SAFE_DIST = 70;

// ─── Utilidades ─────
function rpgRandRange(range) {
  if (!range) return 0;
  return range[0] + Math.random() * (range[1] - range[0]);
}

function rpgFloorBounds(C) {
  return {
    top: RPG_LOGICAL_H * RPG_FLOOR_TOP_RATIO,
    bottom: RPG_LOGICAL_H * (1 - RPG_FLOOR_BOTTOM_MARGIN)
  };
}

// Config de la habitación / capítulo actuales (reemplaza al viejo
// RPG_LEVELS[RPG.level] de cuando el juego era por niveles sueltos).
function rpgChapterCfg() {
  return RPG_CHAPTERS[RPG.chapter];
}
function rpgRoomCfg() {
  const ch = RPG_CHAPTERS[RPG.chapter];
  return ch ? ch.rooms[RPG.room] : null;
}

// ─── Carga de imágenes (con cache) ─────
function rpgLoadImage(src) {
  if (RPG.images[src] && RPG.images[src].complete) {
    return Promise.resolve(RPG.images[src]);
  }
  return new Promise((resolve, reject) => {
    const img = RPG.images[src] || new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    RPG.images[src] = img;
    if (!img.src) img.src = src;
  });
}

// ─── Carga de atlas JSON (con cache) ─────
function rpgLoadAtlas(src) {
  if (RPG.atlases[src]) return Promise.resolve(RPG.atlases[src]);
  return fetch(src)
    .then(r => r.json())
    .then(data => { RPG.atlases[src] = data; return data; });
}

// ═══════════════════════════════════════════════
//   Guardado — 3 slots en localStorage
// ═══════════════════════════════════════════════
function rpgSlotKey(n) {
  return RPG_SAVE_KEY_PREFIX + n;
}

function rpgNewSaveData() {
  return { chapterUnlocked: 1, chaptersCompleted: [], difficulty: 'normal', updatedAt: null };
}

function rpgLoadSlotData(n) {
  try {
    const raw = localStorage.getItem(rpgSlotKey(n));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    // Blindaje por si el shape cambia en el futuro.
    if (!Array.isArray(data.chaptersCompleted)) data.chaptersCompleted = [];
    if (!Number.isFinite(data.chapterUnlocked)) data.chapterUnlocked = 1;
    // Saves viejos (previos a agregar dificultad) caen en 'normal'.
    if (data.difficulty !== 'normal' && data.difficulty !== 'elite') data.difficulty = 'normal';
    return data;
  } catch {
    return null;
  }
}

function rpgSaveSlotData(n, data) {
  try { localStorage.setItem(rpgSlotKey(n), JSON.stringify(data)); } catch {}
}

function rpgDeleteSlotData(n) {
  try { localStorage.removeItem(rpgSlotKey(n)); } catch {}
}

// ─── Borrado de la partida activa (perder o salir en medio de una
//     habitación) ─────
// A diferencia de rpgDeleteSlotConfirm (borrado manual desde la lista de
// partidas), esto lo dispara el propio juego: si morís o abandonás el
// intento antes de completar el capítulo, se pierde todo el progreso
// guardado en ese slot (capítulos desbloqueados/completados), no solo el
// intento actual. rpgCompleteChapter ya guardó lo que corresponde antes
// de volver al menú, así que esa pantalla NUNCA pasa por acá.
function rpgEraseActiveSlot() {
  if (!RPG.activeSlot) return;
  rpgDeleteSlotData(RPG.activeSlot);
  RPG.save = null;
}

// Se llama desde los puntos de salida "manuales" (pausa, botón de volver
// a Juegos) para decidir si esa salida cuenta como abandonar el intento:
// solo si el jugador está efectivamente dentro de una habitación (rpgMenu
// oculto). Si está parado en el menú del RPG (eligiendo slot/capítulo,
// mejoras, ajustes, etc.) no hay ningún intento en curso y no se borra
// nada.
function rpgAbandonRunIfActive() {
  const menuEl = document.getElementById('rpgMenu');
  const inRoom = menuEl && menuEl.classList.contains('hidden');
  if (inRoom) rpgEraseActiveSlot();
}

// ─── Entrada a la sección (llamado desde goTo en app.js) ─────
function rpgInit() {
  RPG.canvas = document.getElementById('rpgCanvas');
  RPG.ctx = RPG.canvas.getContext('2d');
  // Look retro nítido: sin esto, drawImage suaviza (bilinear) los sprites
  // al reducirlos al canvas interno de 480x270, y ese resultado ya borroso
  // se vuelve a escalar hacia arriba en bloques por el `image-rendering:
  // pixelated` de rpg.css — la mezcla se ve fea (borroso + bloques). Con
  // el suavizado apagado, el downscale usa vecino más cercano y queda
  // consistente con el upscale del CSS: pixel art prolijo de punta a punta.
  RPG.ctx.imageSmoothingEnabled = false;
  rpgSetupTouchControls();
  rpgStopLoop();
  rpgShowMenu();
}

// ─── Entradas: joystick + botones táctiles DENTRO del canvas ─────
// Usa Engine2D.TouchControls (engine2d.js) en vez de los botones HTML de
// abajo (como Pixel Runner): joystick analógico de movimiento a la
// izquierda, y disparar/bloquear/interactuar como botones redondos a la
// derecha, todo dibujado encima de la escena (ver el final de rpgDraw).
// En desktop con mouse/trackpad (mismo criterio que el media query de
// `.rpg-controls` en rpg.css) queda oculto: se juega con teclado.
function rpgSetupTouchControls() {
  if (typeof Engine2D === 'undefined' || !Engine2D.TouchControls) return;
  // rpgInit() se llama cada vez que se re-entra a la sección del juego
  // (ver app.js: goTo('rpg_pixel') → rpgInit()), así que sin esta guarda
  // se creaba una instancia de TouchControls nueva por cada visita SIN
  // desconectar la anterior — dejaba varios listeners de pointerdown/move/up
  // pegados al mismo canvas, uno por cada visita. El síntoma es justo el
  // reportado: los controles (y el avance de diálogo) empiezan a
  // "duplicarse" — un solo toque dispara la acción 2, 3, 4 veces según
  // cuántas veces se entró y salió del juego. Si ya está armado, no se
  // vuelve a crear nada.
  if (RPG.touch) { rpgSyncTouchVisibility(); return; }

  // logicalWidth/logicalHeight: el canvas real (RPG.canvas.width/height) se
  // escala por devicePixelRatio (ver rpgStartRoom) para verse nítido en
  // HiDPI, pero todas las zonas de acá abajo están pensadas en el espacio
  // lógico de siempre (480x270, RPG_LOGICAL_W/H). Sin pasarle esto al
  // motor, el hit-test compara contra el buffer ya escalado y NINGÚN toque
  // cae adentro de una zona — es la causa de que los controles no
  // respondieran en el celular.
  RPG.touch = new Engine2D.TouchControls(RPG.canvas, {
    logicalWidth: RPG_LOGICAL_W,
    logicalHeight: RPG_LOGICAL_H
  });
  RPG.touch.addJoystick({ id: 'move', x: 54, y: RPG_LOGICAL_H - 58, radius: 32, color: '74,222,128' });
  RPG.touch.addButton({ id: 'fire', x: RPG_LOGICAL_W - 48, y: RPG_LOGICAL_H - 82, radius: 24, label: 'A', color: '185,28,28' });
  RPG.touch.addButton({ id: 'block', x: RPG_LOGICAL_W - 92, y: RPG_LOGICAL_H - 32, radius: 20, label: 'D', color: '30,58,138' });
  RPG.touch.addButton({ id: 'interact', x: RPG_LOGICAL_W - 32, y: RPG_LOGICAL_H - 32, radius: 20, label: 'I', color: '21,128,61' });
  RPG.touch.attach();
  RPG._touchInteractPrev = false;
  rpgSyncTouchVisibility();
  window.addEventListener('resize', rpgSyncTouchVisibility);

  // Avanzar diálogo tocando CUALQUIER parte del canvas (no solo el botón
  // 💬): mientras hay una cinemática activa (RPG.inDialogue) el loop de
  // diálogo (rpgDialogueLoop) no llama a rpgUpdate — que es donde se
  // sondea el estado de los botones táctiles (ver rpgPollTouchActions) —
  // así que sin esto el jugador quedaba trabado en el primer diálogo sin
  // forma de avanzar desde el celular. Es un listener aparte del propio de
  // TouchControls (ambos conviven sin problema en el mismo canvas).
  RPG.canvas.addEventListener('pointerdown', function(e) {
    if (!RPG.inDialogue) return;
    e.preventDefault();
    rpgAdvanceDialogue();
  });
}

// Mismo criterio que "@media (min-width: 900px) and (hover: hover) and
// (pointer: fine)" en rpg.css (ahí se ocultaba la fila de botones HTML;
// acá se oculta/deja de dibujar el joystick+botones del canvas).
function rpgSyncTouchVisibility() {
  if (!RPG.touch) return;
  const isDesktopPointer = window.matchMedia
    && window.matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)').matches;
  RPG.touch.visible = !isDesktopPointer;
}

// Se llama una vez por frame desde rpgUpdate: traduce el estado de los
// botones táctiles a las mismas funciones que ya usan teclado/HTML
// (rpgFire/rpgBlock/rpgInteract), sin duplicar lógica de juego.
function rpgPollTouchActions() {
  const st = RPG.touch.state;
  // Disparar: mantener apretado dispara en ráfaga (gatillado por el
  // propio cooldown de rpgFire, igual que mantener Espacio en teclado).
  if (st.fire) rpgFire();
  // Bloquear: es un estado, no una acción puntual — se refleja 1 a 1.
  rpgBlock(!!st.block);
  // Interactuar: acción puntual (abrir cofre / avanzar diálogo) — si se
  // llamara todos los frames mientras se mantiene apretado, un diálogo
  // completo se saltearía de una sola vez. Se dispara solo en el flanco
  // de subida (false → true), como un click.
  if (st.interact && !RPG._touchInteractPrev) rpgInteract();
  RPG._touchInteractPrev = !!st.interact;
}

function rpgShowMenu() {
  rpgStopLoop();
  RPG.inDialogue = false;
  document.getElementById('rpgMenu').classList.remove('hidden');
  document.getElementById('rpgHud').classList.add('hidden');
  document.getElementById('rpgOverlay').classList.add('hidden');
  rpgShowMainMenu();
  if (typeof setMusic === 'function') setMusic(RPG_ASSET_BASE + 'menu_song.mp3');
}

function rpgExitToHub() {
  rpgAbandonRunIfActive();
  rpgStopLoop();
  goTo('juegos');
}

// ═══════════════════════════════════════════════
//   Menú principal — Jugar / Mejoras / Ajustes / Cómo jugar
// ═══════════════════════════════════════════════
const RPG_MENU_VIEW_IDS = ['rpgMainMenuView', 'rpgSlotsView', 'rpgChaptersView', 'rpgDifficultyView', 'rpgMejorasView', 'rpgAjustesView', 'rpgComoJugarView'];

function rpgHideAllMenuViews() {
  RPG_MENU_VIEW_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

function rpgShowMainMenu() {
  rpgHideAllMenuViews();
  document.getElementById('rpgMainMenuView').classList.remove('hidden');
}

function rpgGoToPlay() {
  rpgShowSlotsView();
}

function rpgGoToMejoras() {
  rpgHideAllMenuViews();
  document.getElementById('rpgMejorasView').classList.remove('hidden');
  rpgRenderMejoras();
}

function rpgGoToAjustes() {
  rpgHideAllMenuViews();
  document.getElementById('rpgAjustesView').classList.remove('hidden');
  rpgRenderAjustes();
}

function rpgGoToComoJugar() {
  rpgHideAllMenuViews();
  document.getElementById('rpgComoJugarView').classList.remove('hidden');
}

// ═══════════════════════════════════════════════
//   Ajustes — volumen (mismo estado global que el resto del sitio, ver
//   musicVolume/sfxVolume + getGlobalMusicVolume/setGlobalMusicVolume en
//   app.js — la música del RPG usa el mismo bgMusic) y pantalla completa
//   del contenedor del RPG.
// ═══════════════════════════════════════════════
function rpgRenderAjustes() {
  const musicPct = Math.round((typeof getGlobalMusicVolume === 'function' ? getGlobalMusicVolume() : 0.5) * 100);
  const sfxPct   = Math.round((typeof getGlobalSfxVolume === 'function' ? getGlobalSfxVolume() : 0.8) * 100);
  document.querySelectorAll('.rpg-music-volume-input').forEach(el => { el.value = musicPct; });
  document.querySelectorAll('.rpg-music-volume-value').forEach(el => { el.textContent = musicPct + '%'; });
  document.querySelectorAll('.rpg-sfx-volume-input').forEach(el => { el.value = sfxPct; });
  document.querySelectorAll('.rpg-sfx-volume-value').forEach(el => { el.textContent = sfxPct + '%'; });
  rpgSyncFullscreenBtn();
}

function rpgOnMusicVolumeChange(value) {
  const pct = parseInt(value, 10) || 0;
  if (typeof setGlobalMusicVolume === 'function') setGlobalMusicVolume(pct / 100);
  document.querySelectorAll('.rpg-music-volume-value').forEach(el => { el.textContent = pct + '%'; });
  // Por si hay dos copias del slider en el DOM a la vez (menú + pausa),
  // mantenerlas sincronizadas aunque solo una esté visible.
  document.querySelectorAll('.rpg-music-volume-input').forEach(el => { el.value = pct; });
}

function rpgOnSfxVolumeChange(value) {
  const pct = parseInt(value, 10) || 0;
  if (typeof setGlobalSfxVolume === 'function') setGlobalSfxVolume(pct / 100);
  document.querySelectorAll('.rpg-sfx-volume-value').forEach(el => { el.textContent = pct + '%'; });
  document.querySelectorAll('.rpg-sfx-volume-input').forEach(el => { el.value = pct; });
}

// Pantalla completa del .rpg-container (canvas + HUD + menú + overlays),
// mismo criterio que runnerToggleFullscreen (app.js) pero apuntado al
// contenedor del RPG en vez del runner.
function rpgGetFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function rpgFullscreenSupported() {
  const el = document.querySelector('#sec-rpg_pixel .rpg-container');
  return !!(el && (el.requestFullscreen || el.webkitRequestFullscreen));
}

function rpgToggleFullscreen() {
  const el = document.querySelector('#sec-rpg_pixel .rpg-container');
  if (!el) return;
  if (!rpgGetFullscreenElement()) {
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
}

function rpgSyncFullscreenBtn() {
  const supported = rpgFullscreenSupported();
  document.querySelectorAll('.rpg-fullscreen-row').forEach(el => { el.classList.toggle('unsupported', !supported); });
  const label = rpgGetFullscreenElement() ? 'Salir' : 'Activar';
  document.querySelectorAll('.rpg-fullscreen-btn').forEach(el => { el.textContent = label; });
}

document.addEventListener('fullscreenchange', rpgSyncFullscreenBtn);
document.addEventListener('webkitfullscreenchange', rpgSyncFullscreenBtn);

// ═══════════════════════════════════════════════
//   Menú — selección de slot → (dificultad si es nueva) → selección de capítulo
// ═══════════════════════════════════════════════
function rpgShowSlotsView() {
  rpgHideAllMenuViews();
  document.getElementById('rpgSlotsView').classList.remove('hidden');
  rpgRenderSlots();
}

function rpgRenderSlots() {
  const wrap = document.getElementById('rpgSlotsButtons');
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

function rpgDeleteSlotConfirm(n) {
  if (!confirm('¿Borrar la Partida ' + n + '? Esta acción no se puede deshacer.')) return;
  rpgDeleteSlotData(n);
  rpgRenderSlots();
}

function rpgSelectSlot(n) {
  RPG.activeSlot = n;
  const existing = rpgLoadSlotData(n);
  if (existing) {
    RPG.save = existing;
    rpgShowChapterSelect();
  } else {
    // Partida nueva: todavía no se crea el save hasta elegir dificultad.
    rpgHideAllMenuViews();
    document.getElementById('rpgDifficultyView').classList.remove('hidden');
  }
}

function rpgSelectDifficulty(diff) {
  RPG.save = rpgNewSaveData();
  RPG.save.difficulty = diff; // 'normal' | 'elite'
  rpgSaveSlotData(RPG.activeSlot, RPG.save);
  // Partida nueva: siempre arranca en el capítulo 1, sin pantalla de selección.
  rpgStartChapter(1);
}

function rpgShowChapterSelect() {
  document.getElementById('rpgSlotsView').classList.add('hidden');
  document.getElementById('rpgChaptersView').classList.remove('hidden');
  rpgRenderChapters();
}

function rpgBackToSlots() {
  rpgShowSlotsView();
}

function rpgRenderChapters() {
  const wrap = document.getElementById('rpgChapterButtons');
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
function rpgUpdateEnemyLabel() {
  const cfg = rpgRoomCfg();
  const el = document.getElementById('rpgEnemyName');
  if (!el || !cfg) return;
  if (cfg.type === 'boss') {
    const boss = RPG.enemies[0];
    el.textContent = cfg.enemyName + (boss && boss.phase > 1 ? ' · Fase ' + boss.phase : '');
  } else {
    const alive = RPG.enemies.filter(e => e.alive).length;
    el.textContent = 'Enemigos: ' + alive + '/' + RPG.enemies.length;
  }
}

// ─── Posiciones de costado (para el patrón "sides") ─────
function rpgSideX(side, cfg, C) {
  const m = RPG.worldWidth * cfg.sideMarginRatio;
  return side === 'left' ? m : RPG.worldWidth - m;
}

// ─── Arrancar un capítulo (siempre desde la habitación 1) ─────
function rpgStartChapter(chapterIndex) {
  const cfg = RPG_CHAPTERS[chapterIndex];
  if (!cfg) return;
  RPG.chapter = chapterIndex;
  // Intento nuevo del capítulo: se pierden las mejoras de cofres juntadas
  // en el intento anterior (morir o reintentar arranca de cero otra vez).
  RPG.upgrades = {
    maxHpBonus: 0,
    dmgReduction: 0,
    speedPermanent: false,
    doubleShot: false,
    dmgBonus: 0,
    burning: false,
    coins: 0
  };
  rpgStartRoom(1);
}

// ─── Arrancar una habitación puntual dentro del capítulo actual ─────
function rpgStartRoom(roomIndex) {
  const chapterCfg = rpgChapterCfg();
  const cfg = chapterCfg ? chapterCfg.rooms[roomIndex] : null;
  if (!cfg) return;
  RPG.room = roomIndex;

  document.getElementById('rpgMenu').classList.add('hidden');
  document.getElementById('rpgHud').classList.remove('hidden');
  // Sin cartel de "Capítulo X · Empezar": se entra directo a la habitación
  // (el diálogo cinemático, si la habitación tiene, sigue mostrándose aparte).
  document.getElementById('rpgOverlay').classList.add('hidden');

  // La barra de vida del enemigo solo se muestra en la habitación del jefe
  // (en las de combate normal 1-4 no hay un único "enemigo" cuya vida mostrar).
  const enemyHudWrap = document.getElementById('rpgEnemyHudWrap');
  if (enemyHudWrap) enemyHudWrap.classList.toggle('hidden', cfg.type !== 'boss');

  const timeEl = document.getElementById('rpgTimeLeft');
  if (timeEl) { timeEl.textContent = ''; timeEl.classList.remove('rpg-timer-warn'); }

  requestAnimationFrame(() => {
    const C = RPG.canvas;
    // Resolución interna: el buffer real del canvas ahora es más grande
    // (escalado por devicePixelRatio, con techo en 2.5x para no pedirle
    // demasiados píxeles a celulares muy densos) para que todo se vea
    // nítido en pantallas HiDPI. RPG_LOGICAL_W/H (480x270 de siempre) siguen
    // siendo la unidad con la que se calcula TODO el juego (posiciones,
    // cámara, mundo) — por eso a partir de acá el código sigue usando esas
    // constantes en vez de leer C.width/C.height directo.
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    RPG.dpr = dpr;
    C.width = RPG_LOGICAL_W * dpr;
    C.height = RPG_LOGICAL_H * dpr;
    // Cambiar el tamaño del canvas resetea el contexto (transform y
    // smoothing incluidos), así que ambos se vuelven a fijar acá: el
    // transform mapea el espacio lógico 480x270 sobre el buffer más
    // grande, y el smoothing apagado mantiene los sprites pixel-art nítidos
    // (solo lo que se dibuja a mano con fillText/paths gana nitidez extra).
    RPG.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    RPG.ctx.imageSmoothingEnabled = false;

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
    RPG.combatElapsed = 0;
    RPG.timeLimitMs = null;
    RPG.facing = 'down';
    RPG.keys = { up: false, down: false, left: false, right: false };
    // Junior entra siempre pegado al costado izquierdo del mundo (la
    // "puerta" de entrada) — incluida ahora la sala del jefe, que dejó de
    // ser un caso especial al unificarse su worldWidth con el resto.
    RPG.player.x = 55;
    RPG.player.y = RPG_LOGICAL_H * 0.68;
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
    // ── Arma RPG.enemies a partir de cfg.enemySpawns ──
    // Distribuye a los enemigos a lo ancho del piso jugable para que no
    // aparezcan superpuestos. El jefe (attackPattern 'sides') ignora este
    // reparto y usa su posición fija de costado, como antes.
    const floorNow = rpgFloorBounds(C);
    // Elite: x2 vida/daño y +10% velocidad para TODOS los enemigos de la
    // sala, incluido el jefe (que entra por este mismo map con species
    // 'dark_knight' — ver RPG_ELITE_* y rpgEliteActive() más arriba).
    const eliteStatMult = rpgEliteActive() ? RPG_ELITE_STAT_MULT : 1;
    const eliteSpeedMult = rpgEliteActive() ? RPG_ELITE_SPEED_MULT : 1;
    RPG.enemies = cfg.enemySpawns.map((spawn, idx) => {
      const species = RPG_ENEMY_TYPES[spawn.species];
      const e = {
        species: spawn.species,
        x: 0, y: 0,
        hp: spawn.hp * eliteStatMult, maxHp: spawn.hp * eliteStatMult,
        speed: (spawn.speed || 0.8) * eliteSpeedMult,
        contactDamage: (spawn.contactDamage || 0) * eliteStatMult,
        arrowDamage: (spawn.arrowDamage || 0) * eliteStatMult,
        fireCooldownMs: spawn.fireCooldownMs || [1500, 2200],
        fireTimer: 0,
        animFrame: 0, animTick: 0,
        animKind: 'idle', // 'idle' | 'walk' | 'attack' | 'hurt' | 'death' — decide qué ciclo de rpgDrawEnemy usar
        contactCooldown: 0,
        attackHitApplied: false, // evita que un mismo swing de ataque golpee más de una vez (ver rpgUpdateSimpleChase)
        hitFlash: 0,
        hurtLock: 0, // ms restantes reaccionando a un golpe (pausa la IA y muestra la pose "hurt")
        burnTicksLeft: 0, // ticks de 1hp restantes de la quemadura (esfera azul), ver rpgUpdate
        burnTimer: 0,     // ms hasta el próximo tick de quemadura
        alive: true,
        side: 'left',
        phase: 1,
        // Estado del patrón de ataque especial (charge / sides) — solo lo usa el jefe.
        attack: { state: 'idle', timer: 1200, vx: 0, vy: 0, hit: false }
      };
      if (cfg.attackPattern === 'sides') {
        e.side = 'right';
        e.x = rpgSideX('right', cfg, C);
        e.y = RPG_LOGICAL_H * 0.72;
        e.attack = {
          state: 'tracking',
          timer: 0,
          vx: 0, vy: 0, hit: false,
          fireTimer: rpgRandRange(cfg.fireCooldownPhase1),
          dashTimer: rpgRandRange(cfg.dashCooldownMs),
          summonTimer: cfg.summonCooldownMs || 20000 // ver rpgSummonWarriors
        };
      } else {
        // Reparto horizontal parejo a lo largo de TODO el mundo de la
        // habitación (no solo la porción visible en el canvas), con un
        // pequeño escalonado en Y para que no queden todos en fila
        // perfecta. Al ser más ancho que la cámara, Junior no ve a todos
        // los enemigos apenas entra.
        // El primer tramo (desde la puerta de entrada hasta ~85% del ancho
        // del canvas) queda vacío a propósito: como la cámara arranca en
        // x=0, eso es justo lo que se ve en el primer frame, así que ningún
        // enemigo puede aparecer ya visible al lado de Junior.
        const n = cfg.enemySpawns.length;
        const marginX = Math.max(60, RPG.worldWidth * 0.1);
        const desiredSafeX = RPG.player.x + Math.max(RPG_SPAWN_SAFE_DIST, RPG_LOGICAL_W * 1.05);
        const safeStartX = Math.min(
          Math.max(marginX, desiredSafeX),
          Math.max(marginX, RPG.worldWidth - marginX - 40) // no te pases del final del mundo
        );
        const spanX = Math.max(20, (RPG.worldWidth - marginX) - safeStartX);
        e.x = safeStartX + (n === 1 ? spanX / 2 : (spanX * idx) / Math.max(1, n - 1));
        // Antes solo alternaba entre 2 "carriles" (35%/60% del piso), lo
        // que dejaba sin usar buena parte del alto de la zona de combate
        // (sobre todo ahora que el piso es más alto, ver RPG_FLOOR_*).
        // Con 3 carriles (22%/50%/78%) + un pequeño jitter random se
        // aprovecha todo el fondo, con más variedad de posiciones.
        const yTiers = [0.22, 0.5, 0.78];
        const yFrac = yTiers[idx % yTiers.length];
        const jitter = (Math.random() - 0.5) * (floorNow.bottom - floorNow.top) * 0.08;
        e.y = floorNow.top + (floorNow.bottom - floorNow.top) * yFrac + jitter;
        e.fireTimer = rpgRandRange(e.fireCooldownMs);
      }
      return e;
    });

    rpgUpdateHudBars();
    rpgUpdateHudAmmo();
    rpgUpdateEnemyLabel();

    setupRpgEvents();

    // Especies distintas presentes en esta habitación (para no repetir cargas).
    const speciesInRoom = Array.from(new Set(cfg.enemySpawns.map(s => s.species)));

    const loaders = [
      rpgLoadImage(cfg.zoneImage),
      rpgLoadImage(RPG_ASSET_BASE + 'models/junior/junior.png'),
      rpgLoadImage(RPG_ASSET_BASE + 'models/junior/bloquear.png'),
      rpgLoadImage(RPG_ITEM_SHEET)
    ];
    speciesInRoom.forEach(key => {
      const species = RPG_ENEMY_TYPES[key];
      if (!species) return;
      loaders.push(rpgLoadImage(species.sheet));
      loaders.push(rpgLoadAtlas(species.atlas));
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

    if (window.showGlobalLoader) window.showGlobalLoader();
      Promise.all(loaders).then(() => {
        if (window.hideGlobalLoader) window.hideGlobalLoader();
      // Ahora que cfg.zoneImage ya está en RPG.images y cargado, se puede
      // calcular el zoom-out fijo de esta habitación puntual (cada fondo
      // puede necesitar un zoom distinto). RPG.camera.y también queda fijo
      // acá, calculado para que el fondo quede siempre anclado abajo (el
      // piso nunca se pierde) igual que en rpgDrawRoomBackground.
      RPG.roomZoom = rpgComputeRoomZoom(C);
      RPG.camera.y = RPG_LOGICAL_H * (1 - 1 / RPG.roomZoom);
      // forceRestart=true: si es la misma habitación que se acaba de perder,
      // la música tiene que arrancar desde 0, no seguir donde iba.
      if (typeof setMusic === 'function') setMusic(cfg.music, true);
      // Sin cartel de "Empezar": se entra directo al diálogo (si la
      // habitación tiene uno) o al combate.
      document.getElementById('rpgOverlay').classList.add('hidden');
      rpgBeginCombat();
    }).catch(() => {
      // OJO: antes esto arrancaba el texto del overlay pero nunca le
      // sacaba la clase 'hidden' (quedó oculto desde más arriba en esta
      // misma función) — el jugador solo veía el canvas en negro (relleno
      // #0a0f0a de rpgDraw cuando el fondo no cargó) sin ningún mensaje.
      rpgSetOverlay(chapterCfg.name, 'No se pudieron cargar los recursos de la habitación.', '<button class="btn-play" onclick="rpgShowMenu()">← Volver</button>');
      document.getElementById('rpgOverlay').classList.remove('hidden');
    });
  });
}

function rpgBeginCombat() {
  document.getElementById('rpgOverlay').classList.add('hidden');
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

function rpgActuallyStartCombat() {
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
function rpgGetTrackDurationMs(fallbackMs) {
  if (typeof bgMusic !== 'undefined' && bgMusic && isFinite(bgMusic.duration) && bgMusic.duration > 0) {
    return bgMusic.duration * 1000;
  }
  return fallbackMs;
}

function rpgStopLoop() {
  RPG.running = false;
  if (RPG.raf) { cancelAnimationFrame(RPG.raf); RPG.raf = null; }
}

// ═══════════════════════════════════════════════
//   Diálogo — cinemática con retrato (Engine2D.DialogueBox)
// ═══════════════════════════════════════════════
// Se usa antes de empezar una habitación si `cfg.dialogueBefore` está
// definido. Corre en su propio loop (separado del combate) mientras dura,
// y llama a `onDone` cuando el jugador terminó de avanzar todas las líneas.
function rpgStartDialogue(lines, onDone) {
  rpgStopLoop();
  if (typeof Engine2D === 'undefined' || !Engine2D.DialogueBox) {
    // Motor de diálogo no disponible por algún motivo — no bloqueamos el juego.
    onDone();
    return;
  }
  if (!RPG.dialogue) {
    RPG.dialogue = new Engine2D.DialogueBox({
      x: 14, y: RPG_LOGICAL_H - 84, width: RPG_LOGICAL_W - 28, height: 74,
      portraitSize: 52, charsPerSecond: 42, font: '11px monospace', padding: 8
    });
  }
  RPG.inDialogue = true;
  RPG.dialogueOnDone = onDone;
  // Reset defensivo: si alguna tecla de movimiento/bloqueo quedó "pegada"
  // justo al entrar en diálogo (ej: se soltó fuera de foco de la ventana
  // y el keyup nunca llegó), que no arranque el combate con Junior trabado.
  RPG.keys.up = RPG.keys.down = RPG.keys.left = RPG.keys.right = false;
  RPG.player.blocking = false;
  RPG.dialogue.say(lines);
  rpgDialogueLastTs = 0;
  RPG.raf = requestAnimationFrame(rpgDialogueLoop);
}

let rpgDialogueLastTs = 0;
function rpgDialogueLoop(ts) {
  if (!RPG.inDialogue) return;
  const dt = rpgDialogueLastTs ? Math.min(ts - rpgDialogueLastTs, 50) : 16;
  rpgDialogueLastTs = ts;

  RPG.dialogue.update(dt);
  rpgDraw();                 // fondo + personajes en su pose actual (estático)
  RPG.dialogue.draw(RPG.ctx); // caja de texto + retrato encima de todo

  // Indicador "▼" parpadeante cuando la línea ya terminó de tipearse — en
  // mobile ahora se avanza tocando cualquier parte del canvas (ver
  // rpgSetupTouchControls), así que esto es la única pista visual de que
  // se puede tocar para seguir.
  if (RPG.dialogue.active && !RPG.dialogue.isTyping() && Math.floor(ts / 420) % 2 === 0) {
    const ctx = RPG.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('▼ toca para continuar', RPG_LOGICAL_W - 20, RPG_LOGICAL_H - 12);
    ctx.restore();
  }

  if (!RPG.dialogue.active) {
    RPG.inDialogue = false;
    rpgDialogueLastTs = 0;
    const done = RPG.dialogueOnDone;
    RPG.dialogueOnDone = null;
    if (done) done();
    return;
  }
  RPG.raf = requestAnimationFrame(rpgDialogueLoop);
}

// Avanza el diálogo (completa la línea si se está tipeando, o pasa a la
// siguiente). Se llama desde rpgInteract(), cableado a X / Enter y al
// botón táctil 💬.
function rpgAdvanceDialogue() {
  if (RPG.dialogue) RPG.dialogue.advance();
}

// ─── Overlay genérico (empezar / pausa / resultado) ─────
function rpgSetOverlay(title, sub, buttonsHtml) {
  document.getElementById('rpgOverlayTitle').textContent = title;
  document.getElementById('rpgOverlaySub').textContent = sub;
  document.getElementById('rpgOverlayButtons').innerHTML = buttonsHtml;
}

// ─── Pausa ─────
// Cartel de 2 columnas: a la izquierda 3 botones apilados (Continuar,
// Ajustes, Salir), a la derecha el resumen de lo juntado en el intento
// actual (ver rpgBuildUpgradesSummaryHtml). Reutiliza el overlay genérico
// pero arma el contenido a mano porque rpgSetOverlay solo maneja texto
// plano en la sub, no un layout de dos columnas.
function rpgPauseGame() {
  if (!RPG.running) return;
  rpgStopLoop();
  rpgRenderPauseOverlay();
  document.getElementById('rpgOverlay').classList.remove('hidden');
}

function rpgRenderPauseOverlay() {
  document.getElementById('rpgOverlayTitle').textContent = '⏸ Pausa';
  document.getElementById('rpgOverlaySub').innerHTML =
    '<div class="rpg-pause-layout">' +
      '<div class="rpg-pause-actions">' +
        '<button class="btn-play" onclick="rpgResumeGame()">▶ Continuar</button>' +
        '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgShowPauseSettings()">⚙ Ajustes</button>' +
        '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgQuitToMenuFromRoom()">✖ Salir</button>' +
      '</div>' +
      '<div class="rpg-pause-upgrades">' + rpgBuildUpgradesSummaryHtml() + '</div>' +
    '</div>';
  document.getElementById('rpgOverlayButtons').innerHTML = '';
}

// Vista "Ajustes" accedida desde dentro del cartel de pausa — mismos
// controles que el menú principal (rpgGoToAjustes/rpgRenderAjustes: los
// sliders de música/efectos y el botón de pantalla completa comparten el
// mismo estado global, así que da igual desde dónde se abran). Antes esto
// era un placeholder ("Próximamente") que nunca se actualizó cuando se
// armaron los ajustes de verdad — quedaba vacío. Volver reconstruye el
// cartel normal de pausa.
function rpgShowPauseSettings() {
  document.getElementById('rpgOverlayTitle').textContent = '⚙ Ajustes';
  document.getElementById('rpgOverlaySub').innerHTML =
    '<div class="trampas-settings-content rpg-ajustes-content">' +
      '<div class="trampas-slider-row">' +
        '<label>🎵 Música</label>' +
        '<input type="range" class="rpg-music-volume-input" min="0" max="100" value="50" oninput="rpgOnMusicVolumeChange(this.value)">' +
        '<span class="trampas-slider-value rpg-music-volume-value">50%</span>' +
      '</div>' +
      '<div class="trampas-slider-row">' +
        '<label>🔊 Efectos</label>' +
        '<input type="range" class="rpg-sfx-volume-input" min="0" max="100" value="80" oninput="rpgOnSfxVolumeChange(this.value)">' +
        '<span class="trampas-slider-value rpg-sfx-volume-value">80%</span>' +
      '</div>' +
      '<div class="trampas-slider-row runner-fullscreen-row rpg-fullscreen-row">' +
        '<label>🖥️ Pantalla completa</label>' +
        '<button type="button" class="runner-fullscreen-btn rpg-fullscreen-btn" onclick="rpgToggleFullscreen()">Activar</button>' +
      '</div>' +
    '</div>';
  document.getElementById('rpgOverlayButtons').innerHTML =
    '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgRenderPauseOverlay()">← Volver</button>';
  // Clases, no ids (ver rpgRenderAjustes): puede haber otra copia de estos
  // mismos controles en el DOM al mismo tiempo (la del menú principal,
  // oculta detrás) — con ids duplicados, rpgRenderAjustes() terminaría
  // actualizando en silencio la copia equivocada.
  rpgRenderAjustes();
}

// Salir al menú "a mano" estando dentro de una habitación (desde la
// pausa): cuenta como abandonar el intento, igual que perder.
function rpgQuitToMenuFromRoom() {
  rpgAbandonRunIfActive();
  rpgShowMenu();
}

function rpgResumeGame() {
  document.getElementById('rpgOverlay').classList.add('hidden');
  RPG.running = true;
  RPG.raf = requestAnimationFrame(rpgLoop);
}

// ─── Entradas: teclado ─────
function setupRpgEvents() {
  if (RPG.keyHandlerDown) document.removeEventListener('keydown', RPG.keyHandlerDown);
  if (RPG.keyHandlerUp)   document.removeEventListener('keyup', RPG.keyHandlerUp);

  RPG.keyHandlerDown = function(e) {
    if (!document.getElementById('sec-rpg_pixel').classList.contains('active')) return;

    if (e.code === 'ArrowUp' || e.code === 'KeyW')    RPG.keys.up = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS')  RPG.keys.down = true;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA')  RPG.keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') RPG.keys.right = true;
    rpgUpdateFacing();
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyX','Enter','NumpadEnter'].includes(e.code)) e.preventDefault();
    if (e.code === 'Space') rpgFire();
    if (e.code === 'KeyX' || e.code === 'Enter' || e.code === 'NumpadEnter') rpgInteract();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') rpgBlock(true);
  };
  RPG.keyHandlerUp = function(e) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW')    RPG.keys.up = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS')  RPG.keys.down = false;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA')  RPG.keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') RPG.keys.right = false;
    rpgUpdateFacing();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') rpgBlock(false);
  };
  document.addEventListener('keydown', RPG.keyHandlerDown);
  document.addEventListener('keyup', RPG.keyHandlerUp);
}

// Recalcula RPG.facing según qué teclas de movimiento siguen apretadas en
// este instante (se llama en keydown Y en keyup — antes solo se pisaba el
// facing con la última tecla presionada y nunca se recalculaba al soltar,
// por eso quedaba "pegado" mirando arriba/abajo). Izquierda/derecha pisan
// a arriba/abajo cuando se combinan (ej: mantener Arriba y tocar Izquierda
// muestra el sprite de izquierda, no el de arriba). Si no queda ninguna
// tecla de movimiento apretada, se mantiene la última dirección mostrada.
function rpgUpdateFacing() {
  if (RPG.keys.left) { RPG.facing = 'left'; return; }
  if (RPG.keys.right) { RPG.facing = 'right'; return; }
  if (RPG.keys.up) { RPG.facing = 'up'; return; }
  if (RPG.keys.down) { RPG.facing = 'down'; return; }
}

// ─── Entradas: controles táctiles (llamados desde index.html) ─────
function rpgMove(dir, on) {
  RPG.keys[dir] = on;
  rpgUpdateFacing();
}

function rpgBlock(on) {
  if (RPG.inDialogue) return; // no bloquear mientras hay una cinemática activa
  const p = RPG.player;
  // Mientras el bloqueo está en cooldown (después de absorber un golpe)
  // no se puede volver a activar, aunque se mantenga apretado el botón.
  if (on && p.blockCooldown > 0) return;
  p.blocking = on;
}

function rpgFire() {
  // Espacio también avanza el diálogo (por si el jugador viene de la
  // costumbre de "disparar para pasar" de antes de separar los botones) —
  // el input canónico para avanzar sigue siendo Interactuar (X/Enter/💬).
  if (RPG.inDialogue) { rpgAdvanceDialogue(); return; }
  if (!RPG.running) return;
  if (RPG.player.fireCooldown > 0) return;
  if (RPG.player.blocking) return; // no se dispara mientras se bloquea
  if (RPG.player.reloading) return; // sin balas — hay que esperar a que termine la recarga

  const dir = RPG_DIR_VECTOR[RPG.facing];
  const speed = 4.6;
  const burning = RPG.upgrades.burning; // esfera azul: balas celestes que queman (ver rpgApplyPowerup)
  const muzzleX = RPG.player.x;
  const muzzleY = RPG.player.y + RPG_PLAYER_MUZZLE_Y_OFF;
  const makeBullet = (ox, oy) => ({
    x: muzzleX + ox,
    y: muzzleY + oy,
    vx: dir.x * speed,
    vy: dir.y * speed,
    w: 6, h: 6,
    burning
  });
  if (RPG.upgrades.doubleShot) {
    // Pistola: dos balas paralelas, separadas perpendicularmente a la
    // dirección de disparo (no una detrás de otra).
    const perpX = -dir.y * 4, perpY = dir.x * 4;
    RPG.bullets.push(makeBullet(-perpX, -perpY));
    RPG.bullets.push(makeBullet(perpX, perpY));
  } else {
    RPG.bullets.push(makeBullet(0, 0));
  }
  RPG.player.fireCooldown = 260; // ms entre disparos
  RPG.player.ammo--;
  if (RPG.player.ammo <= 0) {
    RPG.player.ammo = 0;
    RPG.player.reloading = true;
    RPG.player.reloadTimer = RPG_PLAYER_RELOAD_MS;
  }
  rpgUpdateHudAmmo();
}

// Botón/tecla de Interactuar (X, Enter, o el botón táctil 💬). Por ahora
// solo avanza el diálogo (completa la línea si se está tipeando, o pasa a
// la siguiente) — es el lugar donde en el futuro se puede colgar hablar
// con NPCs, abrir cofres, etc. sin pisar el disparo.
function rpgInteract() {
  if (RPG.inDialogue) { rpgAdvanceDialogue(); return; }
  if (!RPG.running) return;
  const c = RPG.chest;
  if (c && !c.opening && !c.opened) {
    const p = RPG.player;
    if (Math.hypot(p.x - c.x, p.y - c.y) <= RPG_CHEST_INTERACT_DIST) {
      c.opening = true;
      c.animTick = 0;
    }
  }
}

// Recompensa: cofre de plata (iron) u oro dan siempre RPG_CHEST_REWARD_COUNT
// ítems (se puede repetir el mismo más de una vez, tal cual la tabla de
// pesos de rpgBuildChestWeights). Se aplican todos los efectos al instante
// (ver RPG_POWERUP_DEFS) y recién después se muestra el cartel con lo
// que salió — ver rpgShowChestRewardPanel.
function rpgApplyPowerup(chestType) {
  const items = [];
  for (let i = 0; i < RPG_CHEST_REWARD_COUNT; i++) {
    const key = rpgRollPowerup(chestType);
    const def = RPG_POWERUP_DEFS[key];
    if (!def) continue;
    const dynamicLabel = def.apply();
    items.push({ key, label: dynamicLabel || def.label });
  }
  // Mejora permanente "Suerte del cofre": chance de un ítem extra, por
  // fuera de los RPG_CHEST_REWARD_COUNT normales.
  if (RPG_META.extraChestChance && Math.random() < RPG_CHEST_EXTRA_CHANCE) {
    const extraKey = rpgRollPowerup(chestType);
    const extraDef = RPG_POWERUP_DEFS[extraKey];
    if (extraDef) {
      const extraLabel = extraDef.apply();
      items.push({ key: extraKey, label: '🍀 Extra · ' + (extraLabel || extraDef.label) });
    }
  }
  rpgUpdateHudBars();
  rpgUpdateHudAmmo();
  rpgShowChestRewardPanel(chestType, items);
}

// Recorta `rect` (RPG_POWERUP_ICONS) de `img` a un <canvas> chico y
// devuelve un data URL — permite meter el ícono real del power-up dentro
// de un <img> del cartel HTML sin tener que armar background-position a
// mano por cada ítem (mismo recorte que usa rpgDrawIconRect para canvas).
function rpgIconToDataUrl(img, rect, targetH) {
  const dw = Math.max(1, Math.round(targetH * (rect.w / rect.h)));
  const c = document.createElement('canvas');
  c.width = dw;
  c.height = targetH;
  const cctx = c.getContext('2d');
  cctx.imageSmoothingEnabled = true;
  cctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, dw, targetH);
  return c.toDataURL();
}

// ─── Cartel de recompensa de cofre ─────
// Pausa el juego (mismo mecanismo que rpgPauseGame) y reutiliza el
// overlay genérico (#rpgOverlay) para mostrar los RPG_CHEST_REWARD_COUNT
// ítems que salieron, cada uno con su ícono real y una línea de qué hace.
// Se retoma recién al tocar "Recoger".
function rpgShowChestRewardPanel(chestType, items) {
  rpgStopLoop();
  const img = RPG.images[RPG_POWERUP_SHEET];
  const rowsHtml = items.map(function (it) {
    const rect = RPG_POWERUP_ICONS[it.key];
    const iconHtml = (img && rect)
      ? '<img class="rpg-reward-icon" src="' + rpgIconToDataUrl(img, rect, 40) + '" alt="">'
      : '';
    return '<div class="rpg-reward-row">' + iconHtml +
      '<span class="rpg-reward-label">' + (it.label || '') + '</span></div>';
  }).join('');

  document.getElementById('rpgOverlayTitle').textContent =
    chestType === 'gold' ? '✨ ¡Cofre de oro!' : '📦 ¡Cofre de plata!';
  document.getElementById('rpgOverlaySub').innerHTML =
    '<div class="rpg-reward-list">' + rowsHtml + '</div>';
  document.getElementById('rpgOverlayButtons').innerHTML =
    '<button class="btn-play" onclick="rpgCollectChestReward()">Recoger</button>';
  document.getElementById('rpgOverlay').classList.remove('hidden');
}

function rpgCollectChestReward() {
  document.getElementById('rpgOverlay').classList.add('hidden');
  if (RPG.chestIsBossReward) {
    RPG.chestIsBossReward = false;
    rpgCompleteChapter();
    return;
  }
  RPG.running = true;
  RPG.raf = requestAnimationFrame(rpgLoop);
}

const RPG_DIR_VECTOR = {
  up:    { x: 0, y: -1 },
  down:  { x: 0, y: 1 },
  left:  { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

// ─── Update ─────
let rpgLastTs = 0;
function rpgLoop(ts) {
  if (!RPG.running) return;
  const dt = rpgLastTs ? Math.min(ts - rpgLastTs, 50) : 16;
  rpgLastTs = ts;
  rpgUpdate(dt);
  rpgDraw();
  RPG.raf = requestAnimationFrame(rpgLoop);
}

function rpgUpdate(dt) {
  const C = RPG.canvas;
  const cfg = rpgRoomCfg();
  const p = RPG.player;
  const step = dt / 16.6; // normaliza a "frames" de 60fps para no depender del refresh rate

  // ── Reloj del combate (si la habitación tiene límite de tiempo) ──
  const anyEnemyAlive = RPG.enemies.some(e => e.alive);
  if (RPG.timeLimitMs != null && anyEnemyAlive) {
    RPG.combatElapsed += dt;
    rpgUpdateHudTimer();
    if (RPG.combatElapsed >= RPG.timeLimitMs) {
      rpgGameOver(
        '⏱ Se acabó el tiempo',
        (cfg.enemyName || 'El enemigo') + ' resistió hasta el final de la canción.'
      );
      return;
    }
  }

  // ── Movimiento del jugador ──
  if (p.speedBoostTimer > 0) p.speedBoostTimer -= dt;
  const speedMult = p.speedBoostTimer > 0 ? (cfg.potionSpeedMult || 1.6) : 1;

  let dx = 0, dy = 0;
  if (RPG.keys.up) dy -= 1;
  if (RPG.keys.down) dy += 1;
  if (RPG.keys.left) dx -= 1;
  if (RPG.keys.right) dx += 1;

  // Joystick táctil (RPG.touch, ver rpgSetupTouchControls) — analógico,
  // dibujado dentro del canvas. Se suma al vector de teclado; si las dos
  // fuentes están activas a la vez (poco común) simplemente se combinan.
  if (RPG.touch) {
    const stick = RPG.touch.state.move;
    if (stick && Math.hypot(stick.x, stick.y) > RPG_JOYSTICK_DEADZONE) {
      dx += stick.x;
      dy += stick.y;
    }
    rpgPollTouchActions();
  }

  if (dx !== 0 || dy !== 0) {
    // Misma prioridad que rpgUpdateFacing (izq/der pisan a arriba/abajo):
    // se recalcula cada frame acá para que el joystick (que no dispara
    // eventos keydown/keyup) también actualice el sprite que mira Junior.
    if (dx < 0) RPG.facing = 'left';
    else if (dx > 0) RPG.facing = 'right';
    else if (dy < 0) RPG.facing = 'up';
    else if (dy > 0) RPG.facing = 'down';
  }

  p.moving = (dx !== 0 || dy !== 0) && !p.blocking;

  // Límites de la arena: solo se puede pisar la mitad de abajo (piso); la
  // mitad de arriba es cielo/fondo y queda fuera de la zona jugable. El
  // límite derecho es el del MUNDO de la habitación (no del canvas
  // visible): en habitaciones normales el mundo es más ancho. Mientras no
  // esté limpia, el tramo de "puerta" pegado al borde derecho es una pared
  // invisible; una vez limpia, se puede cruzar.
  const marginX = 16;
  const doorLocked = cfg.type === 'combat' && !RPG.roomCleared;
  const rightLimit = RPG.worldWidth - marginX - (doorLocked ? RPG_DOOR_ZONE_W : 0);

  if (p.moving) {
    const len = Math.hypot(dx, dy) || 1;
    const spd = p.blocking ? 0 : p.speed * speedMult * step;
    p.x += (dx / len) * spd;
    p.y += (dy / len) * spd;

    const floor = rpgFloorBounds(C);
    p.x = Math.max(marginX, Math.min(rightLimit, p.x));
    p.y = Math.max(floor.top, Math.min(floor.bottom, p.y));

    p.animTick += step;
    if (p.animTick >= 7) { p.animTick = 0; p.animFrame = (p.animFrame + 1) % 3; }
  } else {
    p.animFrame = 0;
    p.animTick = 0;
  }

  // ── Cámara: sigue a Junior en horizontal. Si el mundo es más ancho que
  // la ventana visible (que ahora depende del zoom: a más zoom-out, se ve
  // más mundo de una), nunca se ve la habitación entera de una — así hay
  // incertidumbre sobre qué enemigos hay más adelante. RPG.camera.y NO se
  // toca acá: queda fijo desde que arrancó la habitación (ver rpgStartRoom
  // / rpgComputeRoomZoom) y no depende de la posición de Junior. ──
  if (RPG.worldWidth > RPG_LOGICAL_W) {
    const visibleW = RPG_LOGICAL_W / RPG.roomZoom;
    const targetCamX = Math.max(0, Math.min(RPG.worldWidth - visibleW, p.x - visibleW / 2));
    RPG.camera.x += (targetCamX - RPG.camera.x) * 0.12;
  } else {
    RPG.camera.x = 0;
  }

  // ── Puerta de salida: habitación normal ya limpia + Junior llegó al
  // borde derecho del mundo → pasa a la siguiente habitación, sin cartel.
  if (cfg.type === 'combat' && RPG.roomCleared && p.x >= RPG.worldWidth - marginX - 2) {
    rpgStopLoop();
    rpgStartRoom(RPG.room + 1);
    return;
  }

  if (!p.blocking) {
    p.blockAnimFrame = 0;
    p.blockAnimTick = 0;
  }

  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (p.blockCooldown > 0) p.blockCooldown -= dt;
  if (p.hitFlash > 0) p.hitFlash -= dt;

  // ── Cofre: animación de apertura (4 frames) y aplicación de la
  // recompensa recién en el último frame, no al tocar Interactuar. ──
  if (RPG.chest && RPG.chest.opening && !RPG.chest.opened) {
    const c = RPG.chest;
    c.animTick += dt;
    if (c.animTick >= RPG_CHEST_FRAME_MS) {
      c.animTick -= RPG_CHEST_FRAME_MS;
      if (c.frame < 3) {
        c.frame++;
      } else {
        c.opened = true;
        c.opening = false;
        rpgApplyPowerup(c.type);
      }
    }
  }
  // ── Recarga automática (se dispara sola al gastar las 8 balas) ──
  if (p.reloading) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) {
      p.reloading = false;
      p.reloadTimer = 0;
      p.ammo = RPG_PLAYER_MAX_AMMO;
      rpgUpdateHudAmmo();
    }
  }

  // ── Balas de Junior ──
  for (let i = RPG.bullets.length - 1; i >= 0; i--) {
    const b = RPG.bullets[i];
    b.x += b.vx * step;
    b.y += b.vy * step;
    if (b.x < -20 || b.x > RPG.worldWidth + 20 || b.y < -20 || b.y > RPG_LOGICAL_H + 20) {
      RPG.bullets.splice(i, 1);
      continue;
    }
    // Contra el primer enemigo vivo que toque la bala (una bala solo
    // pega una vez, aunque haya varios enemigos superpuestos).
    let hitSomeone = false;
    for (let j = 0; j < RPG.enemies.length; j++) {
      const e2 = RPG.enemies[j];
      if (e2.alive && rpgOverlap(b.x, b.y, b.w, b.h, e2.x, e2.y - 40, 60, 80)) {
        rpgEnemyHit(e2, (cfg.playerBulletDamage || 5) + RPG.upgrades.dmgBonus + (RPG_META.dmgLevel * RPG_DMG_UPGRADE_STEP));
        // Munición celeste (esfera azul): además del impacto, deja quemando
        // 1 hp/seg durante 5s — se resetea el DOT si ya estaba ardiendo.
        if (b.burning && e2.alive) {
          e2.burnTicksLeft = 5;
          e2.burnTimer = 1000;
        }
        hitSomeone = true;
        break;
      }
    }
    if (hitSomeone) RPG.bullets.splice(i, 1);
  }

  // ── Proyectiles del jefe / flechas ──
  rpgUpdateEnemyProjectiles(dt, step);

  // ── Enemigos ──
  RPG.enemies.forEach(e => {
    if (!e.alive) {
      // Terminó de morir: deja avanzar la animación de muerte una sola vez
      // (sin loop) para que quede "el cuerpo" en el piso en el último frame.
      const species = RPG_ENEMY_TYPES[e.species];
      if (species && species.anims && e.animKind === 'death') {
        const frames = species.anims.death;
        e.animTick += step;
        if (e.animTick >= (species.animSpeed || 8) && e.animFrame < frames.length - 1) {
          e.animTick = 0;
          e.animFrame++;
        }
      }
      return;
    }
    // Quemadura (esfera azul): 1 hp de daño por segundo mientras dure,
    // independiente de la IA normal del enemigo — no interrumpe su ataque.
    if (e.burnTicksLeft > 0) {
      e.burnTimer -= dt;
      if (e.burnTimer <= 0) {
        e.burnTimer += 1000;
        e.burnTicksLeft--;
        rpgEnemyHit(e, 1);
        if (!e.alive) return;
      }
    }
    // Antes esto se decidía por cfg.attackPattern (a nivel de HABITACIÓN),
    // lo que estaba bien mientras el jefe era el único enemigo de su sala —
    // pero con la habilidad "invocar guerreros" (ver rpgSummonWarriors) un
    // kn_warror puede aparecer DENTRO de la sala del jefe y necesita su
    // propia IA de persecución, no el patrón "sides". Por eso ahora se
    // decide por especie, entidad por entidad.
    const species = RPG_ENEMY_TYPES[e.species];
    if (species && species.behavior === 'sides') {
      rpgUpdateSidesBoss(e, p, cfg, C, dt, step);
    } else if (species && species.behavior === 'ranged') {
      rpgUpdateRangedChase(e, p, species, dt, step);
    } else {
      rpgUpdateSimpleChase(e, p, cfg, dt, step);
    }
  });
}

// Comportamiento base (kn_warror y cualquier especie 'melee'): perseguir al
// jugador y golpear SOLO cuando conecta el swing del ataque (no por simple
// contacto/cercanía). Al entrar en rango arranca el ciclo de animación
// 'attack' completo; el daño se aplica una única vez, en el frame de
// impacto (mitad del ciclo), y solo si Junior sigue en rango de golpe en
// ese instante — recién ahí se considera "atacar", no antes.
function rpgUpdateSimpleChase(e, p, cfg, dt, step) {
  const species = RPG_ENEMY_TYPES[e.species];

  if (e.hurtLock > 0) {
    e.hurtLock -= dt;
    e.animKind = 'hurt';
    rpgTickAnim(e, species, step);
    if (e.hitFlash > 0) e.hitFlash -= dt;
    return;
  }

  const distX = p.x - e.x;
  const distY = p.y - e.y;
  const dist = Math.hypot(distX, distY);
  const stopDistance = 30; // antes 42 — alcance de golpe más corto (rango de daño reducido)

  if (e.contactCooldown > 0) e.contactCooldown -= dt;

  // Mientras dura el swing, el enemigo no se mueve ni vuelve a idle/walk
  // hasta completar el ciclo entero de anims.attack.
  if (e.animKind === 'attack') {
    const frames = species.anims.attack;
    const hitFrame = Math.floor(frames.length / 2); // frame en el que "conecta" el golpe
    const prevFrame = e.animFrame;
    rpgTickAnim(e, species, step);
    if (!e.attackHitApplied && prevFrame < hitFrame && e.animFrame >= hitFrame) {
      if (dist <= stopDistance + 6) rpgPlayerHit(e.contactDamage); // antes +10 — hitbox de golpe más chica
      e.attackHitApplied = true;
    }
    if (e.animFrame === 0 && prevFrame === frames.length - 1) { // ciclo completo → termina el ataque
      e.animKind = dist > stopDistance ? 'walk' : 'idle';
      e.attackHitApplied = false;
    }
    if (e.hitFlash > 0) e.hitFlash -= dt;
    return;
  }

  if (dist > stopDistance) {
    e.x += (distX / dist) * e.speed * step;
    e.y += (distY / dist) * e.speed * step;
    e.animKind = 'walk';
    rpgTickAnim(e, species, step);
  } else {
    e.animKind = 'idle';
    rpgTickAnim(e, species, step);
    if (dist <= stopDistance + 6 && e.contactCooldown <= 0) {
      e.animKind = 'attack';
      e.animFrame = 0; e.animTick = 0;
      e.attackHitApplied = false;
      e.contactCooldown = 900;
    }
  }
  if (e.hitFlash > 0) e.hitFlash -= dt;
}

// Hace avanzar el frame de animación de un enemigo dentro del ciclo
// `e.animKind` actual (idle/walk/attack/hurt/death), usando la cantidad de
// frames que tenga esa especie para no salirse del rango.
function rpgTickAnim(e, species, step) {
  if (!species || !species.anims) return;
  const frames = species.anims[e.animKind] || species.anims.idle;
  e.animTick += step;
  // Velocidad propia por ciclo si está definida (species.animSpeeds[kind]);
  // si no, cae al animSpeed general de la especie.
  const speed = (species.animSpeeds && species.animSpeeds[e.animKind]) || species.animSpeed || 8;
  if (e.animTick >= speed) {
    e.animTick = 0;
    e.animFrame = (e.animFrame + 1) % frames.length;
  }
}

// Comportamiento a distancia (kn_archer y cualquier especie 'ranged'):
// mantiene una banda de distancia preferida — si Junior está muy cerca
// retrocede, si está muy lejos se acerca, y si está en rango se queda
// quieto disparando flechas con cooldown propio.
function rpgUpdateRangedChase(e, p, species, dt, step) {
  if (e.hurtLock > 0) {
    e.hurtLock -= dt;
    e.animKind = 'hurt';
    rpgTickAnim(e, species, step);
    if (e.hitFlash > 0) e.hitFlash -= dt;
    return;
  }

  const distX = p.x - e.x;
  const distY = p.y - e.y;
  const dist = Math.hypot(distX, distY) || 1;
  const [minD, maxD] = species.preferredDist || [90, 160];

  if (dist < minD) {
    e.x -= (distX / dist) * e.speed * step;
    e.y -= (distY / dist) * e.speed * step;
    e.animKind = 'walk';
    rpgTickAnim(e, species, step);
  } else if (dist > maxD) {
    e.x += (distX / dist) * e.speed * step;
    e.y += (distY / dist) * e.speed * step;
    e.animKind = 'walk';
    rpgTickAnim(e, species, step);
  } else {
    // En rango para disparar, pero no se queda plantado como blanco fijo:
    // se desplaza de costado (perpendicular a Junior), alternando de lado
    // cada tanto, como un intento simple de esquivar mientras dispara.
    e.strafeTimer = (e.strafeTimer || 0) - dt;
    if (e.strafeTimer <= 0) {
      e.strafeDir = Math.random() < 0.5 ? -1 : 1;
      e.strafeTimer = 550 + Math.random() * 650;
    }
    const perpX = -distY / dist;
    const perpY = distX / dist;
    e.x += perpX * e.strafeDir * e.speed * 0.5 * step;
    e.y += perpY * e.strafeDir * e.speed * 0.5 * step;
    e.animKind = e.fireTimer < 260 ? 'attack' : 'walk';
    rpgTickAnim(e, species, step);
  }

  e.fireTimer -= dt;
  if (e.fireTimer <= 0 && dist <= maxD * 1.3) {
    rpgFireArrow(e, p, species);
    e.fireTimer = rpgRandRange(e.fireCooldownMs);
  }

  if (e.hitFlash > 0) e.hitFlash -= dt;
}

// Flecha del archer: a diferencia del dark_slash del jefe (siempre
// horizontal), apunta hacia la posición actual de Junior en el momento del
// disparo.
function rpgFireArrow(e, p, species) {
  const dx = p.x - e.x;
  const dy = (p.y - 30) - (e.y - 45);
  const dist = Math.hypot(dx, dy) || 1;
  const proj = species.projectile;
  const speed = proj.speed || 3.3;
  RPG.enemyProjectiles.push({
    kind: 'arrow',
    x: e.x, y: e.y - 45,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    dmg: e.arrowDamage || 6,
    w: proj.w || 16, h: proj.h || 7,
    frameFly: proj.frameFly, frameHit: proj.frameHit,
    sheet: species.sheet, atlas: species.atlas
  });
}

// ─── Patrón "sides" (jefe final de capítulo) ─────
// El jefe vive en los costados del mapa mirando al centro. Se mueve
// verticalmente para alinearse con Junior (así apunta al disparar) y
// cada tanto hace un dash recto hacia el otro costado (100% bloqueable,
// y es también su forma de cambiar de lado). Tiene 3 fases según su HP:
//   fase 1 (>50% HP): solo proyectiles chicos, dash lento
//   fase 2 (<=50% HP): proyectiles chicos y grandes, dash rápido
//   fase 3 (<=25% HP): solo proyectiles grandes, dash rápido, sin pociones
function rpgGetSidesPhase(e) {
  const ratio = e.hp / e.maxHp;
  if (ratio <= 0.25) return 3;
  if (ratio <= 0.5) return 2;
  return 1;
}

function rpgFireRangeForPhase(cfg, phase) {
  if (phase === 1) return cfg.fireCooldownPhase1;
  if (phase === 2) return cfg.fireCooldownPhase2;
  return cfg.fireCooldownPhase3;
}

function rpgOnSidesPhaseChange(e, cfg, phase) {
  rpgUpdateEnemyLabel();
  e.hitFlash = 250;
}

function rpgUpdateSidesBoss(e, p, cfg, C, dt, step) {
  const atk = e.attack;
  const phase = rpgGetSidesPhase(e);
  if (phase !== e.phase) {
    e.phase = phase;
    rpgOnSidesPhaseChange(e, cfg, phase);
  }

  if (e.hitFlash > 0) e.hitFlash -= dt;

  const floor = rpgFloorBounds(C);
  const yTop = floor.top + 25;
  const yBottom = floor.bottom - 15;

  if (atk.state === 'tracking') {
    // Se alinea verticalmente con Junior para poder apuntarle.
    const targetY = Math.max(yTop, Math.min(yBottom, p.y));
    const dy = targetY - e.y;
    if (Math.abs(dy) > 2) {
      const eliteSpeedMult = rpgEliteActive() ? RPG_ELITE_SPEED_MULT : 1;
      const move = Math.sign(dy) * Math.min(Math.abs(dy), cfg.enemySpeed * eliteSpeedMult * step * 3);
      e.y += move;
    }
    e.animTick += step;
    if (e.animTick >= 9) { e.animTick = 0; e.animFrame = (e.animFrame + 1) % 2; }

    atk.fireTimer -= dt;
    if (atk.fireTimer <= 0) {
      rpgFireBossProjectile(e, cfg, phase);
      atk.fireTimer = rpgRandRange(rpgFireRangeForPhase(cfg, phase));
    }

    // Habilidad "invocar guerreros": chequea antes que el dash para que,
    // si ambos enfriamientos llegan a 0 el mismo frame, gane la invocación
    // (es la menos frecuente de las dos). El cooldown se reinicia ACÁ, al
    // arrancar el telegraph, no cuando termina de invocar.
    atk.summonTimer -= dt;
    if (atk.summonTimer <= 0) {
      atk.state = 'summonTelegraph';
      atk.timer = cfg.summonTelegraphMs || 700;
      atk.summonTimer = cfg.summonCooldownMs || 20000;
      return;
    }

    atk.dashTimer -= dt;
    if (atk.dashTimer <= 0) {
      atk.state = 'telegraph';
      atk.timer = cfg.dashTelegraphMs;
    }
    return;
  }

  if (atk.state === 'summonTelegraph') {
    // El jefe se queda quieto levantando la espada (pose "summon") durante
    // summonTelegraphMs — es el aviso visual — y recién al final aparecen
    // los 2 guerreros.
    atk.timer -= dt;
    if (atk.timer <= 0) {
      rpgSummonWarriors(e, cfg, C);
      atk.state = 'tracking';
    }
    return;
  }

  if (atk.state === 'telegraph') {
    atk.timer -= dt;
    if (atk.timer <= 0) {
      const dir = e.side === 'left' ? 1 : -1;
      // dashSpeedPhase1/2 están calibradas para un mundo de 480 (el ancho
      // "de siempre" del jefe); ahora que su arena mide lo mismo que las
      // salas normales (ver rpgStartRoom), se escala la velocidad por ese
      // mismo factor para que el dash tarde lo mismo en cruzar de punta a
      // punta — si no, con casi el doble de distancia se vería en cámara
      // lenta.
      const worldScale = RPG.worldWidth / RPG_LOGICAL_W;
      const eliteSpeedMult = rpgEliteActive() ? RPG_ELITE_SPEED_MULT : 1;
      const spd = (phase === 1 ? cfg.dashSpeedPhase1 : cfg.dashSpeedPhase2) * worldScale * eliteSpeedMult;
      atk.vx = dir * spd;
      atk.state = 'dashing';
      atk.hit = false;
    }
    return;
  }

  if (atk.state === 'dashing') {
    e.x += atk.vx * step;
    e.y = Math.max(yTop, Math.min(yBottom, e.y));

    if (!atk.hit && rpgOverlap(
      e.x, e.y - 40, 80, 90,
      p.x, p.y + RPG_PLAYER_HITBOX.yOff, RPG_PLAYER_HITBOX.w, RPG_PLAYER_HITBOX.h
    )) {
      rpgPlayerHit(cfg.dashDamage * (rpgEliteActive() ? RPG_ELITE_STAT_MULT : 1), { fullyBlockable: true });
      atk.hit = true;
    }

    const otherSide = e.side === 'left' ? 'right' : 'left';
    const targetX = rpgSideX(otherSide, cfg, C);
    const reached = e.side === 'left' ? e.x >= targetX : e.x <= targetX;
    if (reached) {
      e.x = targetX;
      e.side = otherSide;
      atk.state = 'tracking';
      atk.dashTimer = rpgRandRange(cfg.dashCooldownMs);
      atk.fireTimer = rpgRandRange(rpgFireRangeForPhase(cfg, e.phase));
    }
  }
}

function rpgFireBossProjectile(e, cfg, phase) {
  let size;
  if (phase === 1) size = 'small';
  else if (phase === 3) size = 'big';
  else size = Math.random() < 0.5 ? 'small' : 'big';

  const dir = e.side === 'left' ? 1 : -1;
  // Mismo motivo que el dash (ver rpgUpdateSidesBoss): projectileSmallSpeed/
  // BigSpeed están calibradas para 480 de ancho, así que se escalan para
  // cruzar el mundo actual del jefe en el mismo tiempo de siempre.
  const worldScale = RPG.worldWidth / RPG_LOGICAL_W;
  const speed = (size === 'small' ? cfg.projectileSmallSpeed : cfg.projectileBigSpeed) * worldScale;
  const dmg = (size === 'small' ? cfg.projectileSmallDmg : cfg.projectileBigDmg) * (rpgEliteActive() ? RPG_ELITE_STAT_MULT : 1);

  RPG.enemyProjectiles.push({
    kind: 'slash',
    x: e.x + dir * 34,
    y: e.y - 45,
    vx: dir * speed,
    vy: 0,
    dir, // 1 = viaja a la derecha (sprite normal), -1 = izquierda (sprite espejado)
    size,
    dmg,
    w: size === 'small' ? 16 : 30,
    h: size === 'small' ? 16 : 24,
    animFrame: 1, // dark_slash tiene frames "_1" y "_2" por variante
    animTick: 0
  });
}

// ─── Habilidad del jefe: invocar guerreros ─────
// Aparece un kn_warror pegado a cada costado del arena (uno a la
// izquierda y otro a la derecha, siempre los dos juntos) reutilizando el
// mismo tipo de enemigo y stats que las habitaciones normales — apenas
// aparecen, rpgUpdate ya los rutea por especie a rpgUpdateSimpleChase, así
// que persiguen y golpean a Junior con su IA de siempre, sin tocar en
// nada el patrón "sides" del jefe.
function rpgSummonWarriors(e, cfg, C) {
  const floor = rpgFloorBounds(C);
  const midY = (floor.top + floor.bottom) / 2;
  ['left', 'right'].forEach(side => {
    RPG.enemies.push({
      species: 'kn_warror',
      x: rpgSideX(side, cfg, C),
      y: midY + (Math.random() - 0.5) * (floor.bottom - floor.top) * 0.3,
      hp: 50, maxHp: 50,
      speed: 1.0, // mismo empujón de velocidad que kn_warror en las salas normales
      contactDamage: 10,
      arrowDamage: 0,
      fireCooldownMs: [1500, 2200],
      fireTimer: 0,
      animFrame: 0, animTick: 0,
      animKind: 'idle',
      contactCooldown: 0,
      attackHitApplied: false,
      hitFlash: 0,
      hurtLock: 0,
      burnTicksLeft: 0,
      burnTimer: 0,
      alive: true,
      side,
      phase: 1,
      attack: { state: 'idle', timer: 1200, vx: 0, vy: 0, hit: false }
    });
  });
  rpgUpdateHudBars(); // el jefe sigue teniendo su propia barra (ver rpgUpdateHudBars) — esto solo refresca el label
  rpgUpdateEnemyLabel();
}

function rpgUpdateEnemyProjectiles(dt, step) {
  const C = RPG.canvas;
  const p = RPG.player;
  for (let i = RPG.enemyProjectiles.length - 1; i >= 0; i--) {
    const pr = RPG.enemyProjectiles[i];
    pr.x += pr.vx * step;
    pr.y += pr.vy * step;
    if (pr.kind === 'slash') {
      // El dark_slash del jefe anima entre sus 2 frames por variante.
      pr.animTick += step;
      if (pr.animTick >= 6) { pr.animTick = 0; pr.animFrame = pr.animFrame === 1 ? 2 : 1; }
    }
    if (pr.x < -40 || pr.x > RPG.worldWidth + 40 || pr.y < -40 || pr.y > RPG_LOGICAL_H + 40) {
      RPG.enemyProjectiles.splice(i, 1);
      continue;
    }
    if (rpgOverlap(
      pr.x, pr.y, pr.w, pr.h,
      p.x, p.y + RPG_PLAYER_HITBOX.yOff, RPG_PLAYER_HITBOX.w, RPG_PLAYER_HITBOX.h
    )) {
      rpgPlayerHit(pr.dmg, { fullyBlockable: true });
      RPG.enemyProjectiles.splice(i, 1);
    }
  }
}

// ─── Pociones ─────
// (Sistema de pociones en el suelo eliminado — ya no se usa.)

function rpgOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;
}

function rpgPlayerHit(dmg, opts) {
  const p = RPG.player;
  const fullyBlockable = opts && opts.fullyBlockable;
  let finalDmg = dmg;
  if (p.blocking) {
    finalDmg = fullyBlockable ? 0 : Math.round(dmg * 0.25);
    // El bloqueo solo absorbe un golpe: después se desactiva (lo que ya
    // corta la animación de bloqueo, ver el reset de blockAnimFrame en
    // rpgUpdate) y queda en cooldown 10s antes de poder volver a usarse.
    p.blocking = false;
    p.blockCooldown = 10000;
  }
  // Pechera (cofre): reduce un % del daño ya calculado (después del
  // bloqueo, así ambas reducciones se combinan en vez de pisarse).
  if (RPG.upgrades.dmgReduction > 0) finalDmg = Math.round(finalDmg * (1 - RPG.upgrades.dmgReduction));
  p.hp = Math.max(0, p.hp - finalDmg);
  p.hitFlash = 200;
  rpgUpdateHudBars();
  if (p.hp <= 0) rpgGameOver();
}

// dmg ahora se aplica a un enemigo puntual `e` (puede haber varios vivos
// a la vez). La habitación se gana recién cuando TODOS están muertos.
function rpgEnemyHit(e, dmg) {
  if (!e.alive) return;
  e.hp = Math.max(0, e.hp - dmg);
  e.hitFlash = 150;
  e.animKind = 'hurt';
  e.animFrame = 0; e.animTick = 0;
  e.hurtLock = 220; // breve pausa de reacción antes de retomar la IA
  rpgUpdateHudBars();
  if (e.hp <= 0) {
    e.alive = false;
    e.hurtLock = 0;
    e.animKind = 'death';
    e.animFrame = 0; e.animTick = 0;
    // Los enemigos muertos ya no pasan por el resto de rpgUpdate (ver el
    // primer if de ese loop), así que hitFlash nunca se terminaba de
    // descontar solo — el cuerpo se quedaba semitransparente para siempre.
    // Se corta acá mismo, de una.
    e.hitFlash = 0;
    // Congela la orientación en el instante de morir: si no, el cuerpo
    // "sigue mirando" hacia donde esté Junior en cada frame siguiente,
    // como si el muerto lo persiguiera con la vista.
    e.deathFlip = e.x > RPG.player.x;
    rpgUpdateEnemyLabel();

    const species = RPG_ENEMY_TYPES[e.species];
    if (species && species.behavior === 'sides') {
      // El jefe: su muerte SIEMPRE termina el combate, sin esperar a que
      // mueran también los kn_warror que haya invocado (ver
      // rpgSummonWarriors) — la pelea terminó, así que se descartan.
      // rpgStartBossDeathSequence se encarga de la cinemática + el cofre.
      RPG.enemies = [e];
      rpgStartBossDeathSequence(e, rpgRoomCfg());
      return;
    }
    if (RPG.enemies.every(en => !en.alive)) rpgVictory();
  }
}

// ─── Cinemática de derrota del jefe ─────
// Al llegar a 0 HP el jefe reproduce su primera caída (muerte 1 → muerte 2)
// y queda congelado —opaco, no semitransparente— en muerte 2. Recién ahí
// arranca el diálogo final (jefe + Junior, ver cfg.deathDialogue). Cuando
// el jugador termina de leer la última línea, se reproduce una SEGUNDA
// caída distinta (muerte 3 → muerte 4) y ahí sí, congelado en muerte 4,
// aparece el cofre de oro — ver rpgPlayBossDeathFall.
function rpgStartBossDeathSequence(e, cfg) {
  rpgStopLoop(); // corta el loop de juego — de acá en más es todo cinemática
  rpgPlayBossDeathFall(e, [1, 2], () => {
    const lines = (cfg && cfg.deathDialogue) || [];
    if (!lines.length) { rpgPlayBossDeathFall(e, [3, 4], () => rpgFinishBossDeath()); return; }
    rpgStartDialogue(lines, () => rpgPlayBossDeathFall(e, [3, 4], () => rpgFinishBossDeath()));
  });
}

function rpgFinishBossDeath() {
  rpgVictory();
  RPG.running = true;
  RPG.raf = requestAnimationFrame(rpgLoop);
}

// Corre su propio loop liviano (solo dibuja, no hay física/IA que
// actualizar) para animar 2 frames de caída del jefe, igual que
// rpgDialogueLoop hace con el diálogo. `frames` es el par [inicio, fin] de
// e.deathFrame a usar (ver RPG_ENEMY_TYPES.dark_knight.poses: death1..4) —
// [1,2] para la primera caída, [3,4] para la segunda tras el diálogo.
// onDone se llama al terminar de sostener el frame final — el llamador
// decide qué sigue (diálogo, otra caída, o terminar la secuencia).
const RPG_BOSS_DEATH_FRAME_MS = 260;
const RPG_BOSS_DEATH_HOLD_MS = 300; // pausa en el frame final antes de onDone
function rpgPlayBossDeathFall(e, frames, onDone) {
  const [frameStart, frameEnd] = frames;
  e.deathFrame = frameStart;
  let elapsed = 0;
  let last = 0;
  function step(ts) {
    const dt = last ? Math.min(ts - last, 50) : 16;
    last = ts;
    elapsed += dt;
    if (e.deathFrame === frameStart && elapsed >= RPG_BOSS_DEATH_FRAME_MS) e.deathFrame = frameEnd;
    rpgDraw();
    if (elapsed < RPG_BOSS_DEATH_FRAME_MS + RPG_BOSS_DEATH_HOLD_MS) {
      RPG.raf = requestAnimationFrame(step);
    } else {
      onDone();
    }
  }
  RPG.raf = requestAnimationFrame(step);
}

// Barra de HP del enemigo: en habitaciones con varios enemigos muestra el
// HP TOTAL sumado (todos cuentan igual), en la del jefe es simplemente su
// única barra (RPG.enemies tiene 1 solo elemento ahí).
function rpgUpdateHudBars() {
  const p = RPG.player;
  const pFill = document.getElementById('rpgPlayerHpFill');
  const eFill = document.getElementById('rpgEnemyHpFill');
  const pText = document.getElementById('rpgPlayerHpText');
  const pct = Math.max(0, p.hp / p.maxHp);
  if (pFill) pFill.style.width = (pct * 100) + '%';
  if (pText) pText.textContent = Math.max(0, Math.round(p.hp)) + '/' + p.maxHp;

  // Expresión de Junior según % de vida (usa expresiones.png vía CSS) y
  // temblor leve del HUD cuando queda al 25% o menos.
  const avatar = document.getElementById('rpgPlayerAvatar');
  if (avatar) {
    avatar.classList.remove('rpg-expr-feliz', 'rpg-expr-nervioso', 'rpg-expr-sorprendido');
    if (pct <= 0.25) avatar.classList.add('rpg-expr-sorprendido');
    else if (pct <= 0.5) avatar.classList.add('rpg-expr-nervioso');
    else avatar.classList.add('rpg-expr-feliz');
  }
  const playerFrame = document.querySelector('.rpg-hud-frame-player');
  if (playerFrame) playerFrame.classList.toggle('rpg-hud-shake', pct > 0 && pct <= 0.25);

  if (eFill) {
    // En la sala del jefe (RPG.enemies[0] siempre es él, ver
    // rpgUpdateEnemyLabel) la barra es SOLO su vida — si sumáramos acá los
    // kn_warror que invoca (ver rpgSummonWarriors), la barra "subiría" cada
    // vez que aparecen refuerzos y parecería que el jefe se curó.
    const roomCfg = rpgRoomCfg();
    if (roomCfg && roomCfg.type === 'boss' && RPG.enemies[0]) {
      const boss = RPG.enemies[0];
      eFill.style.width = Math.max(0, (Math.max(0, boss.hp) / boss.maxHp) * 100) + '%';
    } else {
      const totalMax = RPG.enemies.reduce((s, e) => s + e.maxHp, 0) || 1;
      const totalHp = RPG.enemies.reduce((s, e) => s + Math.max(0, e.hp), 0);
      eFill.style.width = Math.max(0, (totalHp / totalMax) * 100) + '%';
    }
  }
}

// Resumen de mejoras juntadas en cofres durante el intento (ver
// RPG.upgrades), usado dentro del cartel de pausa (ver rpgRenderPauseOverlay).
// Los aumentos que se pueden ir acumulando (HP máx, daño, monedas) se
// muestran con ícono + cuánto llevás; los ítems especiales (pechera,
// pistola, balas de fuego, velocidad — de una sola vez, ver
// rpgBuildChestWeights) se muestran SOLO con su sprite, sin nombre.
function rpgBuildUpgradesSummaryHtml() {
  const u = RPG.upgrades;
  const img = RPG.images[RPG_POWERUP_SHEET];
  const rows = [];

  if (u.maxHpBonus > 0) rows.push(rpgUpgradeRowHtml(img, 'potionGreen', '+' + u.maxHpBonus + ' HP máx'));
  if (u.dmgBonus > 0) rows.push(rpgUpgradeRowHtml(img, 'ammo', '+' + u.dmgBonus + ' daño'));
  if (u.coins > 0) rows.push(rpgUpgradeRowHtml(img, 'coins', u.coins + ' monedas'));

  if (u.dmgReduction > 0) rows.push(rpgUpgradeIconOnlyHtml(img, 'armor'));
  if (u.doubleShot) rows.push(rpgUpgradeIconOnlyHtml(img, 'gun'));
  if (u.burning) rows.push(rpgUpgradeIconOnlyHtml(img, 'blueOrb'));
  if (u.speedPermanent) rows.push(rpgUpgradeIconOnlyHtml(img, 'potionOrange'));

  if (rows.length === 0) return '<p class="rpg-pause-empty">Todavía no juntaste nada este intento.</p>';
  return '<div class="rpg-reward-list">' + rows.join('') + '</div>';
}

function rpgUpgradeRowHtml(img, key, label) {
  const rect = RPG_POWERUP_ICONS[key];
  const iconHtml = (img && rect) ? '<img class="rpg-reward-icon" src="' + rpgIconToDataUrl(img, rect, 32) + '" alt="">' : '';
  return '<div class="rpg-reward-row">' + iconHtml + '<span class="rpg-reward-label">' + label + '</span></div>';
}

function rpgUpgradeIconOnlyHtml(img, key) {
  const rect = RPG_POWERUP_ICONS[key];
  if (!img || !rect) return '';
  return '<div class="rpg-reward-row rpg-reward-row-icon-only"><img class="rpg-reward-icon" src="' + rpgIconToDataUrl(img, rect, 32) + '" alt=""></div>';
}

function rpgUpdateHudAmmo() {
  const p = RPG.player;
  const el = document.getElementById('rpgAmmoText');
  if (!el) return;
  if (p.reloading) {
    el.textContent = 'Recargando…';
    el.classList.add('rpg-ammo-reloading');
  } else {
    el.textContent = p.ammo + '/' + RPG_PLAYER_MAX_AMMO;
    el.classList.remove('rpg-ammo-reloading');
  }
}

function rpgUpdateHudTimer() {
  const el = document.getElementById('rpgTimeLeft');
  if (!el) return;
  if (RPG.timeLimitMs == null) { el.textContent = ''; return; }
  const remainMs = Math.max(0, RPG.timeLimitMs - RPG.combatElapsed);
  const totalSec = Math.ceil(remainMs / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  el.textContent = '⏱ ' + mm + ':' + String(ss).padStart(2, '0');
  el.classList.toggle('rpg-timer-warn', remainMs <= 15000);
}

// ─── Derrota ─────
// Morir (o que se acabe el tiempo) borra la partida activa: se pierde
// todo lo guardado en el slot (capítulos desbloqueados/completados), no
// solo el intento actual (ver rpgEraseActiveSlot). Sin opción de
// reintentar in-place: para volver a jugar hay que pasar por el menú y
// arrancar una partida (esa misma u otro slot) desde cero.
function rpgGameOver(title, sub) {
  rpgStopLoop();
  rpgEraseActiveSlot();
  const roomCfg = rpgRoomCfg();
  const foeLabel = roomCfg.enemyName || 'Los enemigos';
  rpgSetOverlay(
    title || '💀 Derrota',
    sub || (foeLabel + ' fueron más fuertes esta vez. La partida se borró — volvé al menú para empezar de nuevo.'),
    '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgShowMenu()">← Volver al menú</button>'
  );
  document.getElementById('rpgOverlay').classList.remove('hidden');
}

// ─── Victoria de una habitación ─────
// Si es una habitación normal (1-4), aparece un cofre de plata y se pasa
// a la siguiente. Si es la habitación 5 (jefe), aparece un cofre de ORO
// garantizado — el único lugar del juego donde puede salir — y recién al
// recogerlo (ver rpgCollectChestReward) se completa el capítulo.
function rpgVictory() {
  const room = RPG.room;
  const chapterCfg = rpgChapterCfg();
  const roomCfg = chapterCfg.rooms[room];

  if (roomCfg.type === 'boss') {
    RPG.chestIsBossReward = true;
    rpgSpawnChest('gold');
    return;
  }

  // Habitación normal: sin cartel — se destraba la puerta del borde
  // derecho (ver rpgUpdate) y Junior pasa a la siguiente caminando.
  // Mejora permanente "Cofre inicial garantizado": el primer cofre del
  // Capítulo 1 (habitación 1) sale siempre de oro en vez de plata.
  RPG.roomCleared = true;
  const forceGoldChest = RPG_META.guaranteedFirstChest && RPG.chapter === 1 && room === 1;
  rpgSpawnChest(forceGoldChest ? 'gold' : 'iron');
}

// ─── Cofre de recompensa ─────
// Plata: sale siempre en habitaciones normales (1-4) al vaciarlas. Oro:
// SOLO sale al matar al jefe de la habitación 5 (ver rpgVictory) — ya no
// es un chance aleatorio en habitaciones normales. Se ubica siempre en el
// centro horizontal de la habitación (worldWidth / 2), sin importar dónde
// esté parado Junior ni dónde quede la puerta de salida.
function rpgSpawnChest(type) {
  const C = RPG.canvas;
  const floor = rpgFloorBounds(C);
  RPG.chest = {
    type: type || 'iron',
    x: RPG.worldWidth / 2,
    y: (floor.top + floor.bottom) / 2,
    frame: 0,
    animTick: 0,
    opening: false,
    opened: false
  };
}

// ─── Completar capítulo (guardado) ─────
function rpgCompleteChapter() {
  rpgStopLoop(); // el cofre de oro del jefe deja el loop corriendo hasta recogerlo
  const chapterIdx = RPG.chapter;
  const chapterCfg = RPG_CHAPTERS[chapterIdx];
  const nextChapterIdx = chapterIdx + 1;
  const hasNext = !!RPG_CHAPTERS[nextChapterIdx];

  if (RPG.activeSlot) {
    const save = RPG.save || rpgNewSaveData();
    if (!save.chaptersCompleted.includes(chapterIdx)) save.chaptersCompleted.push(chapterIdx);
    save.chapterUnlocked = Math.max(save.chapterUnlocked, hasNext ? nextChapterIdx : chapterIdx);
    save.updatedAt = Date.now();
    RPG.save = save;
    rpgSaveSlotData(RPG.activeSlot, save);
  }

  rpgSetOverlay(
    '🏆 ¡Capítulo superado!',
    'Derrotaste a ' + chapterCfg.rooms[5].enemyName + ' y completaste ' + chapterCfg.name + '. Partida guardada.',
    (hasNext
      ? '<button class="btn-play" onclick="rpgStartChapter(' + nextChapterIdx + ')">▶ Siguiente capítulo</button>'
      : '') +
    '<button class="btn-play rpg-btn-secondary" style="opacity:1;cursor:pointer;" onclick="rpgShowMenu()">← Volver al menú</button>'
  );
  document.getElementById('rpgOverlay').classList.remove('hidden');
}

// ─── Draw ─────
function rpgDraw() {
  const ctx = RPG.ctx;
  const C = RPG.canvas;
  if (!ctx) return;
  ctx.clearRect(0, 0, RPG_LOGICAL_W, RPG_LOGICAL_H);

  const cfg = rpgRoomCfg();
  if (!cfg) return;

  // Todo lo que sigue se dibuja en coordenadas de MUNDO; el canvas recorta
  // automáticamente lo que cae fuera de lo visible. ctx.scale(roomZoom)
  // encoge TODA la escena (fondo, Junior, enemigos) para el zoom-out fijo
  // de esta habitación — tiene que ir ANTES del translate para que
  // camera.x/camera.y (ya calculados en unidades de mundo) se compongan
  // bien con el zoom. Ver rpgComputeRoomZoom para cómo se calculan.
  ctx.save();
  ctx.scale(RPG.roomZoom, RPG.roomZoom);
  ctx.translate(-RPG.camera.x, -RPG.camera.y);

  const bg = RPG.images[cfg.zoneImage];
  if (bg && bg.complete) {
    // El fondo se estira a todo el ancho del mundo (no solo el canvas
    // visible), así la habitación "parece más grande" y hay campo de
    // visión limitado en vez de ver todo el piso de entrada.
    // anchorBottom=true: el recorte vertical de "cover" se ancla al borde
    // INFERIOR de la imagen en vez de centrarlo. Antes, al ser el mundo
    // (worldWidth x C.height) mucho más panorámico que la imagen original,
    // el cover centrado recortaba ~21% de arriba Y ~21% de abajo — y ese
    // recorte de abajo se comía varias filas de piso que sí existen en el
    // arte. Anclando abajo, se sacrifica más cielo/fondo arriba (que no
    // afecta el gameplay) pero el piso se ve completo hasta el borde.
    //
    // rpgDrawRoomBackground (no el rpgDrawCover genérico): mantiene SIEMPRE
    // la misma escala (mundo → ancho completo, recorte anclado abajo) y
    // solo agrega altura hacia arriba, que el zoom-out fijo de la
    // habitación (ctx.scale en rpgDraw) decide cuánto revelar. Usar el
    // rpgDrawCover genérico acá causaba un bug: al pasarle un dh más alto,
    // recalculaba el recorte con un aspect ratio distinto al original y
    // terminaba empujando el piso fuera de cuadro por abajo. Ver
    // rpgComputeRoomZoom para cómo se calcula el zoom.
    rpgDrawRoomBackground(ctx, bg, RPG.worldWidth, RPG_LOGICAL_H);
  } else {
    ctx.fillStyle = '#0a0f0a';
    ctx.fillRect(0, 0, RPG.worldWidth, RPG_LOGICAL_H);
  }

  const itemImg = RPG.images[RPG_ITEM_SHEET];

  // Enemigos (puede haber varios vivos a la vez en habitaciones normales;
  // los muertos siguen dibujándose un instante mientras corre su
  // animación de muerte — ver el bloque !e.alive en rpgUpdate).
  RPG.enemies.forEach(e => {
    const species = RPG_ENEMY_TYPES[e.species];
    if (!species) return;
    if (!e.alive && e.animKind !== 'death') return;

    ctx.save();

    // Aviso visual de un ataque especial a punto de salir (telegraph):
    // círculo rojo pulsante mientras el jefe "carga" antes del dash.
    if (e.alive && (e.attack.state === 'telegraph' || e.attack.state === 'summonTelegraph')) {
      const pulse = 0.5 + 0.5 * Math.sin(e.attack.timer * 0.03);
      ctx.globalAlpha = 0.35 + pulse * 0.3;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(e.x, e.y - 45, 55 + pulse * 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (e.hitFlash > 0) ctx.globalAlpha = 0.55;
    const flip = e.alive ? (e.x > RPG.player.x) : e.deathFlip;
    const atlas = RPG.atlases[species.atlas];
    const img = RPG.images[species.sheet];

    if (species.behavior === 'sides') {
      // Jefe: poses nombradas elegidas por el estado de su ataque especial,
      // no por un ciclo de frames. Muerto, ignora el estado de ataque y usa
      // e.deathFrame (1-4) — ver rpgStartBossDeathSequence/rpgPlayBossDeathFall.
      let frameName = species.poses.idle;
      if (!e.alive) frameName = species.poses['death' + (e.deathFrame || 1)] || species.poses.death2;
      else if (e.attack.state === 'telegraph') frameName = species.poses.telegraph;
      else if (e.attack.state === 'dashing') frameName = species.poses.dashing;
      else if (e.attack.state === 'summonTelegraph') frameName = species.poses.summon;
      if (atlas && img) {
        const scale = rpgSpeciesScale(e.species, species, atlas);
        rpgDrawAtlasFrameScaled(ctx, img, atlas, frameName, e.x, e.y, scale, flip);
      }
    } else if (atlas && img) {
      const frames = species.anims[e.animKind] || species.anims.idle;
      const frameName = frames[Math.min(e.animFrame, frames.length - 1)];
      const scale = rpgSpeciesScale(e.species, species, atlas);
      rpgDrawAtlasFrameScaled(ctx, img, atlas, frameName, e.x, e.y, scale, flip);
    }
    ctx.restore();
  });

  // Jugador
  const p = RPG.player;
  ctx.save();
  if (p.hitFlash > 0) ctx.globalAlpha = 0.55;
  if (p.blocking) {
    const sheet = SPRITES.bloquear;
    const img = RPG.images[RPG_ASSET_BASE + 'models/junior/bloquear.png'];
    // Las 4 columnas de bloquear.png son 4 poses direccionales fijas
    // (frente/atrás/izq/der, mismo orden que junior.png) — no cuadros de
    // una animación. Se elige por RPG.facing, no por un contador de tiempo.
    if (sheet && img) rpgDrawFrame(ctx, img, sheet.rows[0], RPG_FACING_ROW[RPG.facing], p.x, p.y, RPG_PLAYER_DRAW_H, false);
  } else {
    const sheet = SPRITES.junior;
    const img = RPG.images[RPG_ASSET_BASE + 'models/junior/junior.png'];
    if (sheet && img) {
      const rowIdx = RPG_FACING_ROW[RPG.facing];
      rpgDrawFrame(ctx, img, sheet.rows[rowIdx], p.animFrame, p.x, p.y, RPG_PLAYER_DRAW_H, false);
    }
  }
  // Aura sutil mientras dura el boost de velocidad de la poción naranja.
  if (p.speedBoostTimer > 0) {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -RPG_PLAYER_DRAW_H * 0.35, RPG_PLAYER_DRAW_H * 0.42, RPG_PLAYER_DRAW_H * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Balas de Junior (sprite real, rotado según la dirección del disparo).
  // Con la esfera azul (RPG.upgrades.burning) cambian a la variante
  // celeste (bulletBurning) — cosmético, el daño extra ya se aplicó en
  // rpgUpdate al impactar.
  if (itemImg) {
    RPG.bullets.forEach(b => {
      const angle = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      const rect = b.burning ? RPG_ITEM_ICONS.bulletBurning : RPG_ITEM_ICONS.bullet;
      rpgDrawIconRect(ctx, itemImg, rect, b.x, b.y, 12, { rotation: angle, centered: true });
    });
  }

  // Cofre de recompensa de la habitación (ver rpgSpawnChest / rpgInteract).
  const chest = RPG.chest;
  if (chest) {
    const chestImg = RPG.images[RPG_CHEST_SHEET];
    if (chestImg) {
      const frame = RPG_CHEST_FRAMES[chest.type][chest.frame];
      rpgDrawIconRect(ctx, chestImg, frame, chest.x, chest.y, RPG_CHEST_DRAW_H, { smooth: true });
    }
    // Cartelito "Interactuar" mientras Junior está cerca y el cofre sigue cerrado.
    if (!chest.opening && !chest.opened) {
      const near = Math.hypot(p.x - chest.x, p.y - chest.y) <= RPG_CHEST_INTERACT_DIST;
      if (near) {
        ctx.save();
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(chest.x - 26, chest.y - RPG_CHEST_DRAW_H - 14, 52, 12);
        ctx.fillStyle = '#fde68a';
        ctx.fillText('💬 Abrir cofre', chest.x, chest.y - RPG_CHEST_DRAW_H - 5);
        ctx.restore();
      }
    }
  }

  // Proyectiles enemigos: dark_slash del jefe (horizontal, se espeja según
  // dirección) o flechas del archer (apuntan hacia donde se dispararon, se
  // rotan según su velocidad real).
  const slashImg = cfg.bossProjectileSheet ? RPG.images[cfg.bossProjectileSheet] : null;
  const slashAtlas = cfg.bossProjectileAtlas ? RPG.atlases[cfg.bossProjectileAtlas] : null;
  RPG.enemyProjectiles.forEach(pr => {
    if (pr.kind === 'arrow') {
      const img = RPG.images[pr.sheet];
      const atlas = RPG.atlases[pr.atlas];
      const f = atlas && atlas.frames[pr.frameFly];
      if (img && f) {
        const angle = Math.atan2(pr.vy, pr.vx);
        const targetH = 8; // antes 12 — flecha más chica visualmente, acorde al hitbox reducido
        const dw = targetH * (f.w / f.h);
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(angle);
        ctx.drawImage(img, f.x, f.y, f.w, f.h, -dw / 2, -targetH / 2, dw, targetH);
        ctx.restore();
      } else if (itemImg) {
        rpgDrawIconRect(ctx, itemImg, RPG_ITEM_ICONS.projSmall, pr.x, pr.y, 16, { centered: true });
      }
      return;
    }
    // kind 'slash' (proyectil a distancia del jefe)
    if (slashImg && slashAtlas) {
      const frameName = (pr.size === 'small' ? 'slash_small_' : 'slash_large_') + pr.animFrame;
      const targetH = pr.size === 'small' ? 20 : 32;
      rpgDrawAtlasFrame(ctx, slashImg, slashAtlas, frameName, pr.x, pr.y, targetH, pr.dir === -1, true);
    } else if (itemImg) {
      const rect = pr.size === 'small' ? RPG_ITEM_ICONS.projSmall : RPG_ITEM_ICONS.projBig;
      const targetH = pr.size === 'small' ? 20 : 32;
      rpgDrawIconRect(ctx, itemImg, rect, pr.x, pr.y, targetH, { centered: true });
    }
  });

  ctx.restore(); // cierra el scale(roomZoom) + translate(-camera.x, -camera.y) de arriba

  // (La recompensa de cofre ahora se muestra en el cartel HTML — ver
  // rpgShowChestRewardPanel — así que ya no hay nada que dibujar acá.)

  // Joystick + botones táctiles: SIEMPRE al final y fuera del save/restore
  // de la cámara — van fijos en coordenadas de canvas, como overlay encima
  // de todo (ver rpgSetupTouchControls).
  if (RPG.touch && RPG.running) RPG.touch.draw(ctx);
}

// Dibuja un frame de spritesheet anclado en (x, y) = punto de los pies,
// escalado a una altura fija `targetH` manteniendo el aspect ratio de la
// celda (los anchos de celda varían entre filas, así que si se estirara
// todo al mismo cuadro el personaje se vería deformado).
function rpgDrawFrame(ctx, img, rowData, frameIndex, x, y, targetH, flip) {
  const sx = frameIndex * rowData.cellWidth;
  const sy = rowData.y;
  const sw = rowData.cellWidth;
  const sh = rowData.cellHeight;
  const dh = targetH;
  const dw = dh * (sw / sh);
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh, dw, dh);
  ctx.restore();
}

// Calcula (y cachea) la escala fija px-del-sheet → px-del-juego de una
// especie, contra un frame de referencia (el idle) en vez de recalcularla
// por cada frame dibujado. Los atlas de kn_warror/kn_archer/dark_knight
// tienen cada pose recortada a mano con proporciones bien distintas entre
// sí (ej: el frame final de "muerto" tirado en el piso es mucho más ancho
// y bajo que el de pie/caminando) — si cada frame se escalara a la MISMA
// altura objetivo (como hacía rpgDrawAtlasFrame), esas poses "achatadas"
// terminan dibujándose gigantes de ancho. Con una escala fija, cada pose
// queda en su tamaño real relativo al personaje, sin inflarse.
function rpgSpeciesScale(speciesKey, species, atlas) {
  if (RPG.speciesScale[speciesKey] != null) return RPG.speciesScale[speciesKey];
  const refName = species.scaleRefFrame
    || (species.poses && species.poses.idle)
    || (species.anims && species.anims.idle && species.anims.idle[0]);
  const ref = refName && atlas.frames[refName];
  const scale = (ref && ref.h) ? (species.drawH / ref.h) : 1;
  RPG.speciesScale[speciesKey] = scale;
  return scale;
}

// Igual que rpgDrawAtlasFrame, pero con una escala FIJA en vez de una
// altura objetivo por frame (ver rpgSpeciesScale). Se usa para personajes;
// rpgDrawAtlasFrame se deja intacta para el proyectil dark_slash, cuyas
// variantes sí comparten la misma proporción entre sí.
function rpgDrawAtlasFrameScaled(ctx, img, atlas, frameName, x, y, scale, flip) {
  const f = atlas.frames[frameName];
  if (!f) return;
  const dw = f.w * scale;
  const dh = f.h * scale;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, f.x, f.y, f.w, f.h, -dw / 2, -dh, dw, dh);
  ctx.restore();
}

// Dibuja un frame por NOMBRE desde un atlas JSON ({frameSize, frames:{nombre:{x,y,w,h}}}).
// Se usa para dark_knight, que tiene poses/efectos discretos en vez de un
// ciclo de caminata uniforme (ver rpgDrawFrame para ese caso).
function rpgDrawAtlasFrame(ctx, img, atlas, frameName, x, y, targetH, flip, centered) {
  const f = atlas.frames[frameName];
  if (!f) return;
  const dh = targetH;
  const dw = dh * (f.w / f.h);
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  if (centered) {
    ctx.drawImage(img, f.x, f.y, f.w, f.h, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.drawImage(img, f.x, f.y, f.w, f.h, -dw / 2, -dh, dw, dh);
  }
  ctx.restore();
}

// Dibuja un ícono recortado directamente por coordenadas (RPG_ITEM_ICONS),
// usado para balas / pociones / proyectiles que viven todos en objeto.png.
// opts: { rotation, flip, centered, smooth }
// smooth=true fuerza suavizado (bilinear) SOLO para este dibujo puntual —
// útil para íconos chicos (cofre, power-up del cartel) cuyo sprite fuente
// es de resolución baja: sin esto, al escalarlos se ven en bloques mucho
// más marcados que Junior/enemigos (que sí tienen más detalle nativo y
// mantienen a propósito el estilo pixel-art sin smoothing). ctx.restore()
// ya deja el smoothing global (false) como estaba, no hace falta resetearlo.
function rpgDrawIconRect(ctx, img, rect, x, y, targetH, opts) {
  opts = opts || {};
  const dh = targetH;
  const dw = dh * (rect.w / rect.h);
  ctx.save();
  if (opts.smooth) ctx.imageSmoothingEnabled = true;
  ctx.translate(x, y);
  if (opts.rotation) ctx.rotate(opts.rotation);
  if (opts.flip) ctx.scale(-1, 1);
  if (opts.centered) {
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, -dw / 2, -dh, dw, dh);
  }
  ctx.restore();
}

// Dibuja `img` cubriendo todo el rect destino (equivalente a background-size: cover).
// anchorBottom: si hace falta recortar verticalmente (imagen relativamente
// menos panorámica que el rect destino), ancla el recorte al borde inferior
// de la imagen en vez de centrarlo — usado para los fondos de habitación
// (ver rpgDraw) para no perder filas de piso por abajo.
function rpgDrawCover(ctx, img, dx, dy, dw, dh, anchorBottom) {
  const ir = img.width / img.height;
  const dr = dw / dh;
  let sx, sy, sw, sh;
  if (ir > dr) {
    sh = img.height;
    sw = sh * dr;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / dr;
    sx = 0;
    sy = anchorBottom ? (img.height - sh) : (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

// Fondo de habitación (ver rpgComputeRoomZoom para el zoom-out fijo que lo
// acompaña). A diferencia de rpgDrawCover, acá la escala SIEMPRE se calcula
// contra el canvas real (worldWidth x canvasHeight), sin recortar la
// fuente verticalmente — si el fondo es más alto que canvasHeight, se
// dibuja completo igual, con dy negativo (por encima del canvas). Eso es
// justo lo que rpgDraw necesita: aplica ctx.scale(roomZoom) + el
// camera.y fijo de la habitación, y ese sobrante entra en cuadro según
// cuánto zoom-out le tocó a esa habitación (0 = queda igual que hoy).
function rpgDrawRoomBackground(ctx, img, worldWidth, canvasHeight) {
  const ir = img.width / img.height;
  const dr = worldWidth / canvasHeight;
  if (ir > dr) {
    // Recorte horizontal (igual que la rama equivalente de rpgDrawCover):
    // rpgComputeRoomZoom da zoom=1 en este caso porque ya se ve toda la
    // altura de la imagen, no hace falta zoom-out.
    const sh = img.height;
    const sw = sh * dr;
    const sx = (img.width - sw) / 2;
    ctx.drawImage(img, sx, 0, sw, sh, 0, 0, worldWidth, canvasHeight);
    return;
  }
  // Anclado abajo: se dibuja la imagen COMPLETA escalada a lo ancho del
  // mundo — la parte de arriba que sobra queda por encima del canvas (dy
  // negativo), y el zoom-out fijo de la habitación decide cuánto de eso
  // se termina viendo (ver rpgDraw / rpgComputeRoomZoom).
  const scale = worldWidth / img.width;
  const dh = img.height * scale;
  const dy = canvasHeight - dh; // ancla el borde inferior de la imagen al borde inferior del canvas
  ctx.drawImage(img, 0, 0, img.width, img.height, 0, dy, worldWidth, dh);
}
