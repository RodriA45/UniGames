// ══════════════════════════════════════
//   RPG Pixel — rpg_juego.js  (módulo ES6)
// ══════════════════════════════════════
// Clase RpgPixel: el juego. Es dueña del estado de la partida (lo que antes
// era el objeto global RPG) y se COMPONE de un módulo por responsabilidad:
//
//   RpgPixel  (instancia única: juego)
//    ├── datos     : RpgDatos     especies, capítulos, recompensas, utilidades de mundo
//    ├── mejoras   : RpgMejoras   oro y tienda de mejoras permanentes
//    ├── render    : RpgRender    todo el dibujo por frame
//    ├── enemigos  : RpgEnemigos  creación, oleadas, proyectiles, daño, HUD, fin de sala
//    ├── combate   : RpgCombate   loop, diálogos, pausa, input, disparo, cofres
//    ├── partida   : RpgPartida   slots, dificultad, capítulos, arranque de habitaciones
//    ├── menu      : RpgMenu      guardado, entrada a la sección, táctil, vistas del menú
//    ├── jugador   : Jugador      (rpg_entidades.js)
//    └── enemies[] : Enemigo      EnemigoMelee / Arquero / Fantasma / Jefe
//
// Cada módulo es una clase que hereda de RpgModulo y accede al resto a
// través de la instancia única `juego` (juego.render.draw(), etc.).
import { RpgDatos } from './rpg_enemies_data.js';
import { RpgEnemigos } from './rpg_enemies_ai.js';
import { RpgCombate } from './rpg_combat_input.js';
import { RpgPartida } from './rpg_menu_flow.js';
import { RpgMejoras } from './rpg_meta.js';
import { RpgRender } from './rpg_render.js';
import { RpgMenu } from './rpg_save_ui.js';
import { Jugador } from './rpg_entidades.js';
import { ServiciosApp } from '../servicios_app.js';

export class RpgPixel {
  // servicios: ServiciosApp (../servicios_app.js) — música, volumen,
  // puntajes, duelos y navegación del sitio. Se recibe por constructor
  // (inyección de dependencias): el juego no toca globals de app2.js.
  constructor(servicios) {
    this.servicios = servicios;
    this.canvas = null;
    this.ctx = null;
    this.dpr = null;
    this.running = false;
    this.raf = null;

    // ── Progreso de la partida en curso ──
    this.chapter = 1;
    this.room = 1;

    // ── Mundo / cámara de la habitación actual ──
    this.worldWidth = 480; // se recalcula en startRoom según la habitación
    this.camera = { x: 0, y: 0 }; // y: fijo por habitación (ver roomZoom), no depende de Junior
    this.roomZoom = 1; // zoom-out fijo de esta habitación, 1 = sin zoom (ver computeRoomZoom)
    this.roomCleared = false; // true cuando ya no quedan enemigos vivos (destraba la puerta derecha)
    this.waveIndex = null; // oleada actual en salas con cfg.waves
    this.lastZoneImage = null; // fondo de la sala anterior (se libera al cambiar de sala)
    this.debugZone = null; // polígono de movimiento (solo para RpgConfig.DEBUG_SHOW_ZONE)

    // Cartel grande en pantalla al llegar una oleada con cfg.waveBannerText.
    this.banner = null; // { text, timer, durationMs }

    // ── Slot de guardado activo ──
    this.activeSlot = null; // 1, 2 o 3
    this.save = null; // { chapterUnlocked, chaptersCompleted: [], difficulty, updatedAt }

    // ── Diálogo ──
    this.dialogue = null; // instancia de Engine2D.DialogueBox (se crea una vez)
    this.inDialogue = false;
    this.dialogueOnDone = null;

    // ── Input ──
    this.keys = { up: false, down: false, left: false, right: false, block: false, fire: false };
    this.facing = 'down'; // última dirección caminada; define hacia dónde se dispara
    this.keyHandlerDown = null;
    this.keyHandlerUp = null;
    this.blurHandler = null;
    this.touch = null; // Engine2D.TouchControls (joystick + botones)
    this.touchInteractPrev = null;
    this.pauseQualityRow = null;

    // ── Entidades de la habitación actual (ver rpg_entidades.js) ──
    this.jugador = new Jugador();
    this.totemUsed = false; // true si el tótem ya se gastó en este capítulo
    // Enemigos vivos/muertos de la habitación. El jefe también vive acá como
    // enemies[0]: el update/draw es uniforme para combates normales y jefe.
    this.enemies = [];
    this.bullets = []; // disparos de Junior
    this.enemyProjectiles = []; // flechas, rayos y cortes de los enemigos

    // ── Cofre de recompensa de la habitación actual ──
    this.chest = null; // { type: 'iron'|'gold', x, y, frame, animTick, opening, opened }
    this.chestIsBossReward = false; // true si es el cofre de oro del jefe

    // ── Mejoras juntadas de cofres durante el intento actual ──
    // Sobreviven entre habitaciones del mismo capítulo pero se resetean al
    // arrancar/reintentar un capítulo (ver RpgPartida.startChapter).
    this.upgrades = {
      maxHpBonus: 0,
      dmgReduction: 0, // 0–0.75, fracción de daño recibido absorbida
      speedPermanent: false,
      doubleShot: false,
      dmgBonus: 0,
      burning: false, // balas que queman (munición celeste) + DOT
      coins: 0,
    };

    this.combatElapsed = 0;
    this.timeLimitMs = null;
    this.images = {}; // cache de HTMLImageElement por src
    this.atlases = {}; // cache de atlas JSON por src
    this.speciesScale = {}; // cache de escala fija por especie (ver RpgRender.speciesScale)

    // ─── Composición: un módulo por responsabilidad ───
    this.datos = new RpgDatos();
    this.mejoras = new RpgMejoras();
    this.render = new RpgRender();
    this.enemigos = new RpgEnemigos();
    this.combate = new RpgCombate();
    this.partida = new RpgPartida();
    this.menu = new RpgMenu();
  }
}

// Instancia única del juego, con sus dependencias.
// (En el RPG la instancia se crea acá y no en rpg_main.js porque los
// módulos la importan directamente — ver el encabezado.)
export const juego = new RpgPixel(new ServiciosApp());
