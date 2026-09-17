import { RPG_ASSET_BASE, RPG_DK_EXPRESSIONS, RPG_DK_EXPRESSIONS_SHEET, RPG_EXPRESSIONS, RPG_EXPRESSION_SHEET, RPG_FLOOR_BOTTOM_MARGIN, RPG_FLOOR_TOP_RATIO, RPG_LOGICAL_H, RPG_PLAYER_MAX_AMMO, RPG_PLAYER_SPEED, RPG_ROOM_ZOOM_STRENGTH } from './rpg_config.js';
import { rpgAddMetaGold } from './rpg_meta.js';

// ═══════════════════════════════════════════════
//   Especies de enemigo — catálogo de render/animación
// ═══════════════════════════════════════════════
// Cada especie define su sheet + atlas (frames nombrados, recortados a
// mano por transparencia — NO son grillas uniformes, cada pose tiene un
// tamaño distinto, por eso usan atlas en vez de SPRITES.rows) y los ciclos
// de animación (listas de nombres de frame) que arma rpgDrawEnemy según el
// estado de cada enemigo (idle/walk/attack/hurt/death).
export const RPG_ENEMY_TYPES = {
  kn_warror: {
    sheet: RPG_ASSET_BASE + 'models/capitulo1/kn_warror.webp',
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
    },
    // ── Embestida ocasional (ver rpgUpdateSimpleChase) — aparte del combo
    // de golpe de siempre. Cada instancia arranca con su propio cooldown
    // random dentro de cooldownMs (se resortea de nuevo cada vez que
    // dashea), así 2 kn_warror en la misma sala no embisten sincronizados.
    // Reusa frames que ya existen en el atlas, no hace falta sprite nuevo:
    // telegraphFrame = pose de carga (espada en alto, quieto)
    // activeFrame    = pose de golpe con más "empuje" (la del tajo con estela)
    dashAbility: {
      cooldownMs: [7000, 10000],
      telegraphFrame: 'attack_1',
      telegraphMs: 350,
      activeFrame: 'attack_5',
      durationMs: 750, // "un pequeño dash de 0.75" → 750ms de embestida
      speedMult: 3.2   // veces la velocidad normal de caminata (e.speed)
    }
  },
  kn_archer: {
    sheet: RPG_ASSET_BASE + 'models/capitulo1/kn_archer.webp',
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
    sheet: RPG_ASSET_BASE + 'models/capitulo1/Dark_knight.webp',
    atlas: RPG_ASSET_BASE + 'models/capitulo1/dark_knight.json',
    drawH: 74,
    behavior: 'boss', // patrón de jefe (ver rpgUpdateBoss): se mueve libre por
                       // toda la arena, no por un ciclo — poses elegidas a mano
                       // según el estado de su ataque actual.
    poses: {
      idle: 'idle_front',
      // Golpe cuerpo a cuerpo: carga (windup_1→4) y después el swing que
      // conecta (attack_1→3) — ver RPG_BOSS_WINDUP_POSES/RPG_BOSS_ATTACK_POSES.
      windup1: 'windup_1', windup2: 'windup_2', windup3: 'windup_3', windup4: 'windup_4',
      attack1: 'attack_1', attack2: 'attack_2', attack3: 'attack_3',
      // Dash directo hacia Junior (fase 2+) — ver RPG_BOSS_DASH_POSES.
      dash1: 'dash_1', dash2: 'dash_2', dash3: 'dash_3',
      block: 'block',
      hurt: 'hurt',
      summon: 'raise_front', // habilidad "invocar guerreros" — el jefe levanta la espada
      // Caída final (ver rpgStartBossDeathSequence): se congela en death2
      // durante el diálogo. El atlas actual solo trae estos 2 frames de
      // muerte (antes había 4) — rpgPlayBossDeathFall ya cae a death2 si
      // pide un frame que no existe, así que esto funciona sin más cambios.
      death1: 'death_1', death2: 'death_2'
    },
    // ── Caminata (roam) — sheet/atlas APARTE de Dark_knight.webp: sacado de
    // una hoja de referencia distinta ("nuevo.webp") para no perder la
    // relación de proporciones. Al sacar el fondo blanco hay que usar un
    // recorte de transparencia DIRECTO por umbral (blanco puro → alpha 0,
    // el resto queda con su color original sin tocar) — la primera pasada
    // usaba una técnica de "unpremultiply" para suavizar el borde y esa
    // cuenta terminaba corriendo el color hacia rojo en las zonas oscuras
    // de la armadura. walkScale sale de comparar la MISMA pose (idle+
    // escudo) en las dos hojas, recortada bien justa en las dos (ojo: la
    // hoja nueva tenía líneas de grilla finitas pegadas a cada celda — hay
    // que recortar con margen de seguridad ANTES de sacar el fondo, si no
    // esas líneas quedan adentro del sprite como manchas negras): en
    // Dark_knight.webp esa pose mide 220px de alto (drawH 74 → escala
    // 74/220); en la hoja nueva, recortada igual de justo, mide 136px de
    // alto para el mismo tamaño real de personaje → walkScale = 74/136 ≈
    // 0.5441. Si el día de mañana se recortan los 8 frames de nuevo, este
    // número hay que recalcularlo con la misma comparación (no sirve
    // reusar rpgSpeciesScale: cachea un solo valor por especie y pisaría
    // el de la hoja principal).
    walkSheet: RPG_ASSET_BASE + 'models/capitulo1/dark_knight_walk.webp',
    walkAtlas: RPG_ASSET_BASE + 'models/capitulo1/dark_knight_walk.json',
    walkScale: 74 / 136,
    walkPoses: ['walk_1', 'walk_2', 'walk_3', 'walk_4', 'walk_5', 'walk_6', 'walk_7', 'walk_8']
  },
  ghost: {
    sheet: RPG_ASSET_BASE + 'models/capitulo2/ghost.webp',
    atlas: RPG_ASSET_BASE + 'models/capitulo2/ghost.json',
    drawH: 56,
    // Patrón nuevo (ver rpgUpdateGhost en rpg_enemies_ai.js): igual que
    // 'ranged' (mantiene distancia y dispara) pero cada tanto se desvanece
    // (disappear), queda invisible/intangible un instante en otro punto de
    // la arena, y reaparece (appear) para retomar la persecución. No
    // reutiliza 'ranged' tal cual porque esa fase de teletransporte no
    // existe en ningún otro enemigo.
    behavior: 'ghost',
    animSpeed: 8,
    animSpeeds: { walk: 10, appear: 10, disappear: 10, death: 9 },
    preferredDist: [110, 200],
    anims: {
      idle:      ['idle_1', 'idle_2', 'idle_3', 'idle_4', 'idle_5', 'idle_6', 'idle_7', 'idle_8'],
      walk:      ['walk_1', 'walk_2', 'walk_3', 'walk_4', 'walk_5', 'walk_6', 'walk_7', 'walk_8', 'walk_9'],
      attack:    ['attack_1', 'attack_2', 'attack_3', 'attack_4', 'attack_5', 'attack_6'],
      // No tiene pose de dolor propia: reusa 2 frames de idle como reacción
      // breve al golpe (ver ghost.json / rpgEnemyHit).
      hurt:      ['hurt_1', 'hurt_2'],
      death:     ['death_1', 'death_2', 'death_3', 'death_4', 'death_5', 'death_6', 'death_7', 'death_8', 'death_9', 'death_10'],
      appear:    ['appear_1', 'appear_2', 'appear_3', 'appear_4', 'appear_5', 'appear_6'],
      disappear: ['disappear_1', 'disappear_2', 'disappear_3', 'disappear_4']
    },
    // Bola de energía, dibujada/rotada igual que la flecha del archer (ver
    // rpgFireGhostBolt: kind 'arrow' reutilizado a propósito).
    projectile: { frameFly: 'proj_3', frameHit: 'proj_6', w: 12, h: 12, speed: 3.3 },
    // ── Teletransporte (ver rpgUpdateGhost) ──
    teleportCooldownMs: [3500, 5500], // cuánto dura la fase activa (persiguiendo/disparando) antes de desvanecerse
    teleportHiddenMs: [400, 700],     // pausa invisible entre desvanecerse y reaparecer
    teleportMinDist: 70,              // no reaparece pegado a Junior
    teleportRangeDist: [110, 220]     // reaparece a esta distancia de Junior
  },
  dk_ghost: {
    sheet: RPG_ASSET_BASE + 'models/capitulo2/dk_ghost.webp',
    atlas: RPG_ASSET_BASE + 'models/capitulo2/dk_ghost.json',
    drawH: 70,
    // Reskin espectral de kn_warror: mismo patrón 'melee' de siempre
    // (rpgUpdateSimpleChase), sin habilidades nuevas — no confundir con la
    // especie 'ghost' (fantasma volador con proyectil y teletransporte),
    // este es un caballero fantasma cuerpo a cuerpo.
    behavior: 'melee',
    animSpeed: 8,
    animSpeeds: { walk: 14 },
    anims: {
      idle:   ['idle_1', 'idle_2', 'idle_3', 'idle_4', 'idle_5', 'idle_6', 'idle_7'],
      walk:   ['walk_1', 'walk_2', 'walk_3', 'walk_4', 'walk_5', 'walk_6', 'walk_7', 'walk_8'],
      attack: ['attack_1', 'attack_2', 'attack_3', 'attack_4', 'attack_5', 'attack_6', 'attack_7', 'attack_8'],
      // No tiene pose de dolor propia: reusa 2 frames de idle como reacción
      // breve al golpe (mismo criterio que con 'ghost').
      hurt:   ['idle_2', 'idle_1'],
      death:  ['death_1', 'death_2', 'death_3', 'death_4', 'death_5', 'death_6', 'death_7']
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
export const RPG_CHAPTERS = {
  1: {
    name: 'Capítulo 1 · Patio del Castillo',
    rooms: {
      1: {
        type: 'combat',
        name: 'Habitación 1',
        zoneImage: RPG_ASSET_BASE + 'models/capitulo1/piso1a.webp',
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
        zoneImage: RPG_ASSET_BASE + 'models/capitulo1/piso1b.webp',
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
        zoneImage: RPG_ASSET_BASE + 'models/capitulo1/piso1b.webp',
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
        zoneImage: RPG_ASSET_BASE + 'models/capitulo1/piso1b.webp',
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
        zoneImage: RPG_ASSET_BASE + 'models/capitulo1/piso1c.webp',
        // Dark Knight: sheet con poses nombradas (ver RPG_ENEMY_TYPES.dark_knight),
        // NO un ciclo de caminata numérico. Se representa igual que el resto
        // (enemySpawns con 1 entrada) para que el motor sea uniforme.
        enemySpawns: [
          { species: 'dark_knight', hp: 400, speed: 0.95 }
        ],
        enemyName: 'Dark Knight',
        music: RPG_ASSET_BASE + 'sound/dark_knight_boss.mp3',
        enemySpeed: 0.55, // antes 0.95 — se veía demasiado rápido acercándose

        // ── Patrón "boss" (ver rpgUpdateBoss): ya no vive pegado a los
        // costados — se mueve libre por toda la arena persiguiendo a
        // Junior. 3 rangos de distancia deciden el ataque:
        //   ≤ meleeRange           → cuerpo a cuerpo
        //   meleeRange..farRange   → dash (fase 2+; en fase 1 solo se acerca)
        //   > farRange             → corte a distancia (siempre horizontal)
        // Además, desde fase 2 el dash también puede dispararse aunque esté
        // en rango de corte, si su cooldown ya está listo. 3 fases según su
        // HP (ver rpgGetBossPhase). sideMarginRatio se mantiene: la
        // habilidad "invocar guerreros" sigue apareciendo un kn_warror
        // pegado a cada costado del arena (ver rpgSummonWarriors).
        attackPattern: 'boss',
        sideMarginRatio: 0.14,

        // Cuerpo a cuerpo: se acerca y golpea si Junior está a esta
        // distancia o menos (carga windup_1→4, conecta en attack_2).
        meleeRange: 46,
        meleeDamage: 12,
        meleeCooldownMs: [1300, 1800],
        meleeWindupFrameMs: 90,
        meleeAttackFrameMs: 90,

        // Corte a distancia: mismo proyectil dark_slash de siempre, ahora
        // con una breve carga (windup_1) antes de salir. Solo se dispara si
        // Junior está MUY lejos (> farRange) — a media distancia el jefe
        // prefiere dashear (ver dashDistanceMult más abajo). La dirección
        // se recalcula en el momento del disparo según de qué lado esté
        // Junior (ya no depende de un costado fijo).
        farRange: 200,
        rangedWindupMs: 260,
        projectileSmallDmg: 5,
        projectileSmallSpeed: 3.1,
        projectileBigDmg: 10,
        projectileBigSpeed: 2.2,
        fireCooldownPhase1: [1700, 2300], // fase 1: solo proyectil chico
        fireCooldownPhase2: [1300, 1800], // fase 2: mezcla chico/grande
        fireCooldownPhase3: [950, 1350],  // fase 3: solo proyectil grande

        // Dash: recién se habilita en fase 2. Antes de largarlo, el jefe se
        // queda quieto 1s parpadeando (aviso) y después dashea cubriendo
        // dashDistanceMult veces la distancia que lo separaba de Junior en
        // ese instante (1.5 = 3x lo que cubría antes, que era la mitad),
        // en cualquier dirección (no solo costado a costado). Si conecta,
        // se queda "reponiéndose" postHitRecoveryMs antes de poder volver a
        // moverse — si erra el golpe, sigue de largo sin esa pausa.
        dashDamage: 15,          // 100% bloqueable
        dashTelegraphMs: 1000,
        dashSpeed: 7,
        dashDistanceMult: 1.5,   // antes 0.5 (mitad de la distancia) → x3
        dashCooldownMs: [3200, 4400],
        postHitRecoveryMs: 2000, // pausa tras conectar un golpe (dash o cuerpo a cuerpo)

        // Sprite propio del ataque del jefe. Tiene 2 variantes (large/small)
        // con 2 frames cada una para una animación simple.
        bossProjectileSheet: RPG_ASSET_BASE + 'models/capitulo1/dark_slash.webp',
        bossProjectileAtlas: RPG_ASSET_BASE + 'models/capitulo1/dark_slash.json',

        playerBulletDamage: 5, // daño del disparo de Junior contra este jefe

        // El combate dura lo que dura el tema del jefe: si no lo matás antes
        // de que la música termine (o vuelva a arrancar), perdés.
        timeLimitMs: 'music',

        // ── Habilidad "invocar guerreros" ──
        // Cada 20s (ver rpgUpdateBoss), el jefe hace una breve pausa
        // levantando la espada (pose "summon" = raise_front) y aparecen 2
        // kn_warror — siempre uno pegado al costado izquierdo del arena y
        // el otro al derecho (ver rpgSummonWarriors) — con la misma IA de
        // persecución/ataque que ya usan en las habitaciones normales.
        summonCooldownMs: 20000,
        summonTelegraphMs: 700,

        // dk_expresiones.webp tiene 3 caras recortadas (angry/normal/wounded)
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
  },
  2: {
    name: 'Capítulo 2 · TODO: nombre',
    rooms: {
      // Fondos confirmados (ver models/capitulo2/): sala1 piso2a, sala2 y
      // sala4 piso2c, sala3 piso2b, sala5 (jefe) piso2d — el del retrato.
      // Dificultad: arranca un escalón arriba del pico del capítulo 1
      // (que terminaba en kn_warror hp60/speed1.05, kn_archer hp35). Estos
      // números son un punto de partida para probar, no definitivos.
      // Las 4 salas de combate (no la del jefe) usan la mecánica de horda
      // (cfg.waves, ver rpgSpawnNextWave): oleada 1 = lo de siempre
      // (kn_warror/kn_archer), oleada 2 suma 'ghost' (fantasma volador con
      // proyectil + teletransporte) junto con 'dk_ghost' (caballero
      // fantasma cuerpo a cuerpo) en cada una.
      1: {
        type: 'combat',
        name: 'Habitación 1',
        zoneImage: RPG_ASSET_BASE + 'models/capitulo2/piso2a.webp',
        // Zona caminable: contorno calcado a mano sobre piso2a.webp (con
        // la página propia de marcado de puntos, a forceRoomZoom=0.85 —
        // ver ese valor más abajo) — sigue el borde real del piso
        // (perspectiva de la puerta a la izquierda) y ya excluye las cajas
        // y los barriles como muescas del propio polígono, así que no
        // hace falta un cfg.obstacles aparte para esta sala.
        zonePolygon: (marginX, rightLimit, floorTop, floorBottom) => [
          { x: 0.0, y: 269.5 },
          { x: 863.1, y: 268.6 },
          { x: 863.1, y: 59.7 },
          { x: 850.7, y: 59.7 },
          { x: 851.6, y: 70.3 },
          { x: 823.3, y: 70.3 },
          { x: 823.3, y: 75.6 },
          { x: 795.0, y: 75.6 },
          { x: 794.1, y: 57.9 },
          { x: 561.2, y: 59.7 },
          { x: 555.9, y: 47.3 },
          { x: 295.7, y: 47.3 },
          { x: 290.4, y: 53.5 },
          { x: 362.1, y: 55.3 },
          { x: 358.5, y: 78.3 },
          { x: 350.6, y: 85.4 },
          { x: 321.3, y: 84.5 },
          { x: 313.4, y: 91.6 },
          { x: 280.6, y: 91.6 },
          { x: 284.2, y: 83.6 },
          { x: 260.3, y: 82.7 },
          { x: 207.1, y: 128.7 },
          { x: 170.0, y: 125.2 },
          { x: 145.2, y: 144.7 },
          { x: 147.8, y: 163.3 },
          { x: 118.6, y: 187.2 },
          { x: 121.3, y: 197.8 },
          { x: 85.9, y: 222.6 },
          { x: 62.0, y: 223.5 }
        ],
        // Spawn de Junior — a diferencia del resto de las salas (que solo
        // pisan playerSpawnX y caen en el 68% de alto de siempre), acá
        // también hace falta fijar la altura porque la zona no es un
        // rectángulo parejo. Requiere el soporte de cfg.playerSpawnY
        // agregado en rpgStartRoom (rpg_menu_flow.js).
        playerSpawnX: 176.2,
        playerSpawnY: 143.8,
        forceRoomZoom: 0.850, // calibrado junto con el polígono de arriba — si se vuelve a tocar el zoom, hay que re-marcar el polígono con la página de marcado
        music: RPG_ASSET_BASE + 'sound/terror_boss.mp3', // TODO: música propia del cap. 2 si hay
        // ── Mecánica de horda/ronda (primera sala del capítulo 2) ──
        // En vez de tirar todos los enemigos juntos, salen en 2 oleadas.
        // Sin `pos` manual: usa el mismo reparto automático parejo que TODAS
        // las demás salas del juego (capítulo 1 incluido, ver el `else` de
        // rpgCreateEnemies) — antes esta sala tenía posiciones a mano
        // puestas a ciegas sin ver el fondo real, y quedaban más
        // amontonadas que en cualquier otra sala.
        // Oleada 2 dispara cuando de la oleada 1 queda 1 o menos vivo
        // (waveTriggerRemaining) — ver rpgSpawnNextWave en rpg_enemies_ai.js.
        // waveBannerText: solo esta sala lo tiene — es la primera vez que el
        // jugador ve la mecánica de horda, así que al saltar a la oleada 2
        // se muestra este cartel en pantalla (ver rpgDraw). Las salas 2-4
        // también usan `waves` pero sin este campo no muestran nada: para
        // esa altura del capítulo ya se entiende que hay más de una oleada.
        waveTriggerRemaining: 1,
        waveBannerText: 'EMBOSCADA ESPECTRAL',
        waves: [
          [ // oleada 1 — 4 kn_warror + 2 kn_archer
            { species: 'kn_warror', hp: 65, speed: 1.0, contactDamage: 11 },
            { species: 'kn_warror', hp: 65, speed: 1.0, contactDamage: 11 },
            { species: 'kn_warror', hp: 65, speed: 1.0, contactDamage: 11 },
            { species: 'kn_warror', hp: 65, speed: 1.0, contactDamage: 11 },
            { species: 'kn_archer', hp: 35, speed: 0.75, arrowDamage: 5, fireCooldownMs: [1300, 1900] },
            { species: 'kn_archer', hp: 35, speed: 0.75, arrowDamage: 5, fireCooldownMs: [1300, 1900] }
          ],
          [ // oleada 2 — 2 kn_archer + 2 ghost + 2 dk_ghost (los dos
            // enemigos nuevos del cap. 2, ver RPG_ENEMY_TYPES.ghost/dk_ghost)
            { species: 'kn_archer', hp: 35, speed: 0.8, arrowDamage: 5, fireCooldownMs: [1200, 1700] },
            { species: 'kn_archer', hp: 35, speed: 0.8, arrowDamage: 5, fireCooldownMs: [1200, 1700] },
            { species: 'ghost', hp: 30, speed: 0.9, arrowDamage: 6, fireCooldownMs: [1500, 2100] },
            { species: 'ghost', hp: 30, speed: 0.9, arrowDamage: 6, fireCooldownMs: [1500, 2100] },
            { species: 'dk_ghost', hp: 70, speed: 1.0, contactDamage: 12 },
            { species: 'dk_ghost', hp: 70, speed: 1.0, contactDamage: 12 }
          ]
        ],
        dialogueBefore: [
          // TODO: diálogo de entrada al capítulo 2
        ]
      },
      2: {
        type: 'combat',
        name: 'Habitación 2',
        zoneImage: RPG_ASSET_BASE + 'models/capitulo2/piso2c.webp',
        forceRoomZoom: 1, // el fondo .webp zoomeaba de más de lo normal (ver forceRoomZoom en rpgStartRoom) — se fuerza sin zoom, igual que el resto de las salas
        music: RPG_ASSET_BASE + 'sound/terror_boss.mp3',
        // Misma mecánica de horda que la sala 1 (ver waveTriggerRemaining /
        // rpgSpawnNextWave): oleada 2 = ghost + dk_ghost, sin `pos` manual
        // (se ubican automáticamente, igual que antes la oleada única).
        waveTriggerRemaining: 1,
        waves: [
          [ // oleada 1 — igual que antes de sumar la horda
            { species: 'kn_warror', hp: 65, speed: 1.0, contactDamage: 11 },
            { species: 'kn_warror', hp: 65, speed: 1.0, contactDamage: 11 },
            { species: 'kn_archer', hp: 40, speed: 0.8, arrowDamage: 5, fireCooldownMs: [1200, 1700] },
            { species: 'kn_archer', hp: 40, speed: 0.8, arrowDamage: 5, fireCooldownMs: [1200, 1700] }
          ],
          [ // oleada 2 — 1 ghost + 1 dk_ghost
            { species: 'ghost', hp: 30, speed: 0.9, arrowDamage: 6, fireCooldownMs: [1500, 2100] },
            { species: 'dk_ghost', hp: 70, speed: 1.0, contactDamage: 12 }
          ]
        ]
      },
      3: {
        type: 'combat',
        name: 'Habitación 3',
        zoneImage: RPG_ASSET_BASE + 'models/capitulo2/piso2b.webp',
        forceRoomZoom: 1, // el fondo .webp zoomeaba de más de lo normal (ver forceRoomZoom en rpgStartRoom) — se fuerza sin zoom, igual que el resto de las salas
        music: RPG_ASSET_BASE + 'sound/vampire_boss.mp3',
        waveTriggerRemaining: 1,
        waves: [
          [ // oleada 1 — igual que antes de sumar la horda
            { species: 'kn_warror', hp: 70, speed: 1.05, contactDamage: 12 },
            { species: 'kn_warror', hp: 70, speed: 1.05, contactDamage: 12 },
            { species: 'kn_warror', hp: 70, speed: 1.05, contactDamage: 12 },
            { species: 'kn_archer', hp: 40, speed: 0.8, arrowDamage: 5, fireCooldownMs: [1100, 1600] }
          ],
          [ // oleada 2 — 2 ghost + 1 dk_ghost
            { species: 'ghost', hp: 30, speed: 0.9, arrowDamage: 6, fireCooldownMs: [1500, 2100] },
            { species: 'ghost', hp: 30, speed: 0.9, arrowDamage: 6, fireCooldownMs: [1500, 2100] },
            { species: 'dk_ghost', hp: 70, speed: 1.0, contactDamage: 12 }
          ]
        ]
      },
      4: {
        type: 'combat',
        name: 'Habitación 4',
        zoneImage: RPG_ASSET_BASE + 'models/capitulo2/piso2c.webp',
        forceRoomZoom: 1, // el fondo .webp zoomeaba de más de lo normal (ver forceRoomZoom en rpgStartRoom) — se fuerza sin zoom, igual que el resto de las salas
        music: RPG_ASSET_BASE + 'sound/vampire_boss.mp3',
        waveTriggerRemaining: 1,
        waves: [
          [ // oleada 1 — igual que antes de sumar la horda
            { species: 'kn_warror', hp: 70, speed: 1.05, contactDamage: 12 },
            { species: 'kn_warror', hp: 70, speed: 1.05, contactDamage: 12 },
            { species: 'kn_warror', hp: 70, speed: 1.05, contactDamage: 12 },
            { species: 'kn_archer', hp: 40, speed: 0.85, arrowDamage: 5, fireCooldownMs: [1000, 1500] },
            { species: 'kn_archer', hp: 40, speed: 0.85, arrowDamage: 5, fireCooldownMs: [1000, 1500] }
          ],
          [ // oleada 2 — 2 ghost + 2 dk_ghost (la sala más dura de las 4, la
            // horda más cargada de los dos enemigos nuevos)
            { species: 'ghost', hp: 30, speed: 0.9, arrowDamage: 6, fireCooldownMs: [1500, 2100] },
            { species: 'ghost', hp: 30, speed: 0.9, arrowDamage: 6, fireCooldownMs: [1500, 2100] },
            { species: 'dk_ghost', hp: 70, speed: 1.0, contactDamage: 12 },
            { species: 'dk_ghost', hp: 70, speed: 1.0, contactDamage: 12 }
          ]
        ]
      },
      5: {
        type: 'boss',
        name: 'Habitación 5 · Jefe final',
        zoneImage: RPG_ASSET_BASE + 'models/capitulo2/piso2d.webp',
        forceRoomZoom: 1, // el fondo .webp zoomeaba de más de lo normal (ver forceRoomZoom en rpgStartRoom) — se fuerza sin zoom, igual que el resto de las salas
        // ── PLACEHOLDER de testeo ──
        // Todavía no está integrado el sprite real del jefe (el "guardián"
        // que menciona el diálogo final del cap. 1 — Reybug ya tiene el
        // sprite, falta subirlo/recortarlo). Mientras tanto, un kn_warror
        // bien reforzado ocupa su lugar para poder jugar el capítulo
        // completo de punta a punta: usa la misma IA simple de siempre
        // (rpgUpdateSimpleChase), sin fases ni ataques especiales.
        //
        // type:'boss' se deja intacto a propósito: la barra de vida única
        // (rpgUpdateHudBars), el cofre de oro y rpgCompleteChapter dependen
        // de roomCfg.type, NO de species.behavior === 'boss' — así que todo
        // ese flujo funciona igual con este placeholder. La cinemática de
        // muerte especial (rpgStartBossDeathSequence) sí es exclusiva de
        // species.behavior === 'boss', así que con kn_warror se saltea
        // solita y va directo a rpgVictory() — nada roto, solo no hay
        // cinemática todavía.
        //
        // TODO: cuando esté el sprite real, reemplazar por la especie de
        // jefe posta (con su propio behavior:'boss', dashAbility,
        // bossProjectileSheet, deathDialogue, etc. — ver dark_knight en el
        // capítulo 1 como referencia).
        enemySpawns: [
          { species: 'kn_warror', hp: 180, speed: 1.0, contactDamage: 16 }
        ],
        enemyName: 'el Guardián (placeholder)',
        music: RPG_ASSET_BASE + 'sound/vampire_boss.mp3' // TODO: música propia cuando esté
      }
    }
  }
};

export const RPG = {
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

  // Cartel grande en pantalla (ver rpgSpawnNextWave / rpgDraw) — solo lo
  // dispara una oleada con cfg.waveBannerText definido (hoy, únicamente la
  // sala 1 del capítulo 2). null = no hay nada que mostrar.
  banner: null, // { text, timer, durationMs }

  // ── Slot de guardado activo ──
  activeSlot: null, // 1, 2 o 3
  save: null,       // { chapterUnlocked, chaptersCompleted: [], updatedAt }

  // ── Diálogo ──
  dialogue: null,    // instancia de Engine2D.DialogueBox (se crea una vez)
  inDialogue: false,
  dialogueOnDone: null,

  keys: { up: false, down: false, left: false, right: false, block: false, fire: false },
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
    speedBoostTimer: 0,
    invulnTimer: 0 // ms de inmunidad restante (tótem)
  },
  totemUsed: false, // true si el tótem ya se gastó en este capítulo
  // Lista de enemigos vivos/muertos de la habitación actual. Se arma en
  // rpgStartRoom a partir de cfg.enemySpawns (1 a N enemigos simultáneos).
  // El jefe de la habitación 5 también vive acá como enemies[0] — así el
  // motor de update/draw es uniforme para combates normales y jefe.
  enemies: [],
  bullets: [],           // disparos de Junior
  enemyProjectiles: [],  // proyectiles del jefe (cortes a distancia, ver rpgUpdateBoss)

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
export const RPG_SPAWN_SAFE_DIST = 70;

// ─── Utilidades ─────
export function rpgRandRange(range) {
  if (!range) return 0;
  return range[0] + Math.random() * (range[1] - range[0]);
}

export function rpgFloorBounds(C) {
  return {
    top: RPG_LOGICAL_H * RPG_FLOOR_TOP_RATIO,
    bottom: RPG_LOGICAL_H * (1 - RPG_FLOOR_BOTTOM_MARGIN)
  };
}

// ═══════════════════════════════════════════════
//   Zona de movimiento poligonal (colisión con paredes/muros diagonales)
// ═══════════════════════════════════════════════
// Reemplaza el clamp rectangular de siempre (marginX/rightLimit en X,
// floor.top/floor.bottom en Y) por un polígono arbitrario, para salas
// donde el piso caminable NO es un rectángulo (ej. piso2a: pared con
// puerta decorativa a la izquierda que corta más adentro que el margen
// estándar). El rectángulo de siempre sigue siendo el default — cualquier
// sala que NO define cfg.zonePolygon se comporta exactamente igual que
// antes, bit a bit.
//
// Point-in-polygon por ray casting (algoritmo estándar, sin dependencias).
// Válido para polígonos simples (sin auto-intersección), con cualquier
// cantidad de vértices — funciona igual para un rectángulo que para una
// forma con bordes diagonales/oblicuos.
export function rpgPointInPolygon(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Rectángulo de siempre, expresado como polígono de 4 puntos — mismos
// bordes que el clamp viejo (marginX/rightLimit/floor.top/floor.bottom).
export function rpgDefaultZonePolygon(marginX, rightLimit, floorTop, floorBottom) {
  return [
    { x: marginX, y: floorTop },
    { x: rightLimit, y: floorTop },
    { x: rightLimit, y: floorBottom },
    { x: marginX, y: floorBottom }
  ];
}

// Zona real de la sala actual: si cfg.zonePolygon está definido, se arma
// llamándolo con los mismos 4 valores dinámicos que siempre importaron
// (marginX, rightLimit —que ya trae adentro el bloqueo de puerta según
// RPG.roomCleared—, floorTop, floorBottom), así una sala con forma
// irregular sigue respetando la puerta que se destraba al limpiarla. Si
// la sala no define nada, cae al rectángulo de siempre.
export function rpgActiveZonePolygon(marginX, rightLimit, floorTop, floorBottom) {
  const cfg = rpgRoomCfg();
  if (cfg && typeof cfg.zonePolygon === 'function') {
    return cfg.zonePolygon(marginX, rightLimit, floorTop, floorBottom);
  }
  return rpgDefaultZonePolygon(marginX, rightLimit, floorTop, floorBottom);
}

// ─── Obstáculos sólidos dentro de la zona caminable ─────
// A diferencia de zonePolygon (que define el CONTORNO exterior por el que
// Junior puede moverse), esto son "agujeros" puntuales adentro de esa
// zona: objetos de la escena (cajas, barriles, muebles) que no se pueden
// pisar aunque el punto caiga dentro del polígono principal. Mismo
// formato que zonePolygon (array de {x,y}, reutiliza rpgPointInPolygon)
// para no sumar una segunda forma de representar geometría — un
// obstáculo rectangular es simplemente un polígono de 4 puntos (ver
// rpgRect). cfg.obstacles: array de polígonos, ej.
// [ rpgRect(236, 50, 356, 87) ]. Sala sin cfg.obstacles se comporta igual
// que siempre (nada bloqueado, lista vacía).
export function rpgRect(x1, y1, x2, y2) {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 }
  ];
}

export function rpgActiveObstacles() {
  const cfg = rpgRoomCfg();
  return (cfg && Array.isArray(cfg.obstacles)) ? cfg.obstacles : [];
}

// true si (x,y) cae adentro de CUALQUIER obstáculo de la sala actual.
export function rpgPointInObstacles(x, y) {
  const obstacles = rpgActiveObstacles();
  for (let i = 0; i < obstacles.length; i++) {
    if (rpgPointInPolygon(obstacles[i], x, y)) return true;
  }
  return false;
}

// Config de la habitación / capítulo actuales (reemplaza al viejo
// RPG_LEVELS[RPG.level] de cuando el juego era por niveles sueltos).
export function rpgChapterCfg() {
  return RPG_CHAPTERS[RPG.chapter];
}
export function rpgRoomCfg() {
  const ch = RPG_CHAPTERS[RPG.chapter];
  return ch ? ch.rooms[RPG.room] : null;
}

// ─── Carga de imágenes (con cache) ─────
// El cache real ahora es el de Engine2D; RPG.images/RPG.atlases quedan como
// espejo de solo lectura para todo el código que ya los venía consultando
// directo (rpg_render.js es el que más los usa). Antes eran DOS caches
// independientes: los retratos del DialogueBox iban por Engine2D y el resto
// por RPG.images, así que una imagen usada por los dos caminos se
// descargaba y —lo caro— se decodificaba dos veces, con dos bitmaps vivos
// en memoria. El chequeo de naturalWidth que tenía esta función se movió
// adentro de Engine2D.loadImage, así que lo hereda todo el motor.
export function rpgLoadImage(src) {
  return Engine2D.loadImage(src).then(img => {
    RPG.images[src] = img;
    return img;
  });
}

// ─── Carga de atlas JSON (con cache) ─────
export function rpgLoadAtlas(src) {
  return Engine2D.loadAtlas(src).then(data => {
    RPG.atlases[src] = data;
    return data;
  });
}

// Suelta el fondo de una sala que ya no se juega. Los sprites de personajes
// NO se tocan: se reusan sala a sala y recargarlos costaría más de lo que
// ahorra. Ver Engine2D.clearImage.
export function rpgReleaseImage(src) {
  if (!src) return;
  delete RPG.images[src];
  Engine2D.clearImage(src);
}

// ─── Progreso de carga (para Engine2D.LoadingBar) ─────
// A diferencia de Engine2D.loadAllWithProgress (que arma sus propias
// promesas a partir de un manifest {type, src}), acá `loaders` ya es un
// array de promesas (rpgLoadImage/rpgLoadAtlas siguen escribiendo en
// RPG.images/RPG.atlases, no en el cache interno del motor) — este helper
// solo cuenta cuántas terminaron, mismo criterio de "un asset que falla
// también cuenta como terminado" que usa Engine2D.
export function rpgLoadWithProgress(promises, onProgress) {
  const total = promises.length;
  if (total === 0) {
    if (onProgress) onProgress(0, 0);
    return Promise.resolve([]);
  }
  let loaded = 0;
  const mark = () => { loaded++; if (onProgress) onProgress(loaded, total); };
  return Promise.all(promises.map(p => p.then(
    result => { mark(); return result; },
    err => { mark(); throw err; }
  )));
}

// ═══════════════════════════════════════════════
//   Guardado — 3 slots en localStorage
// ═══════════════════════════════════════════════

// ─── Movido desde rpg_config.js: usa RPG directamente, sin import circular ───
export function rpgComputeRoomZoom(C) {
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

export function rpgEliteActive() {
  return !!(RPG.save && RPG.save.difficulty === 'elite');
}

// ─── Recompensas de cofre ─────
// Cada entrada: `apply` deja el efecto (algunos son permanentes para el
// resto del intento del capítulo — ver RPG.upgrades, que se resetea en
// rpgStartChapter — otros son al instante nomás, como la cura). `label`
// es lo que se muestra en el cartel al abrir el cofre; `coins` arma el
// suyo dinámico (incluye la cantidad) devolviéndolo desde apply().
// Las tablas de abajo (rpgBuildChestWeights) definen qué tan probable es
// cada una según el tipo de cofre y qué mejoras de una sola vez ya salieron.
export const RPG_POWERUP_DEFS = {
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
      return 'Monedas · +' + amount; // el cartel ya muestra el sprite de monedas al lado
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
export function rpgBuildChestWeights(chestType) {
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

export function rpgRollPowerup(chestType) {
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

