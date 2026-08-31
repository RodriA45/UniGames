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
    // ── Caminata (roam) — sheet/atlas APARTE de Dark_knight.png: sacado de
    // una hoja de referencia distinta ("nuevo.png") para no perder la
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
    // Dark_knight.png esa pose mide 220px de alto (drawH 74 → escala
    // 74/220); en la hoja nueva, recortada igual de justo, mide 136px de
    // alto para el mismo tamaño real de personaje → walkScale = 74/136 ≈
    // 0.5441. Si el día de mañana se recortan los 8 frames de nuevo, este
    // número hay que recalcularlo con la misma comparación (no sirve
    // reusar rpgSpeciesScale: cachea un solo valor por especie y pisaría
    // el de la hoja principal).
    walkSheet: RPG_ASSET_BASE + 'models/capitulo1/dark_knight_walk.png',
    walkAtlas: RPG_ASSET_BASE + 'models/capitulo1/dark_knight_walk.json',
    walkScale: 74 / 136,
    walkPoses: ['walk_1', 'walk_2', 'walk_3', 'walk_4', 'walk_5', 'walk_6', 'walk_7', 'walk_8']
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
        bossProjectileSheet: RPG_ASSET_BASE + 'models/capitulo1/dark_slash.png',
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
  },
  2: {
    name: 'Capítulo 2 · TODO: nombre',
    rooms: {
      // Fondos confirmados (ver models/capitulo2/): sala1 piso2a, sala2 y
      // sala4 piso2c, sala3 piso2b, sala5 (jefe) piso2d — el del retrato.
      // Dificultad: arranca un escalón arriba del pico del capítulo 1
      // (que terminaba en kn_warror hp60/speed1.05, kn_archer hp35). Estos
      // números son un punto de partida para probar, no definitivos.
      // TODO: sumar el enemigo nuevo (falta el sprite) — buen candidato:
      // reemplazar 1 kn_archer de la sala 3 o 4, o directamente sumarlo
      // como tercera especie en la sala 4.
      1: {
        type: 'combat',
        name: 'Habitación 1',
        zoneImage: RPG_ASSET_BASE + 'models/capitulo2/piso2a.png',
        music: RPG_ASSET_BASE + 'sound/terror_boss.mp3', // TODO: música propia del cap. 2 si hay
        // ── Mecánica de horda/ronda (primera sala del capítulo 2) ──
        // En vez de tirar todos los enemigos juntos (se pisan visualmente
        // en una sala chica), salen en 2 oleadas. `pos` es manual
        // (fracciones 0-1 de worldWidth / del alto del piso jugable) para
        // ubicar a cada uno estratégicamente lejos de donde entra Junior
        // (que arranca pegado al costado izquierdo, x≈55 sobre un mundo de
        // varios cientos de px) — ajustar estos números mirando piso2a.png
        // ya cargado en el juego, esto es un punto de partida.
        // Oleada 2 dispara cuando de la oleada 1 queda 1 o menos vivo
        // (waveTriggerRemaining) — ver rpgSpawnNextWave en rpg_enemies_ai.js.
        waveTriggerRemaining: 1,
        waves: [
          [ // oleada 1 — 4 kn_warror + 2 kn_archer
            { species: 'kn_warror', hp: 65, speed: 1.0, contactDamage: 11, pos: { x: 0.32, y: 0.25 } },
            { species: 'kn_warror', hp: 65, speed: 1.0, contactDamage: 11, pos: { x: 0.50, y: 0.78 } },
            { species: 'kn_warror', hp: 65, speed: 1.0, contactDamage: 11, pos: { x: 0.68, y: 0.30 } },
            { species: 'kn_warror', hp: 65, speed: 1.0, contactDamage: 11, pos: { x: 0.88, y: 0.65 } },
            { species: 'kn_archer', hp: 35, speed: 0.75, arrowDamage: 5, fireCooldownMs: [1300, 1900], pos: { x: 0.45, y: 0.50 } },
            { species: 'kn_archer', hp: 35, speed: 0.75, arrowDamage: 5, fireCooldownMs: [1300, 1900], pos: { x: 0.78, y: 0.20 } }
          ],
          [ // oleada 2 — 2 kn_archer + 2 enemigos nuevos (TODO: reemplazar
            // 'ENEMIGO_NUEVO_1'/'2' por la especie real una vez que tenga
            // sprite/atlas cargado en RPG_ENEMY_TYPES y stats definidos)
            { species: 'kn_archer', hp: 35, speed: 0.8, arrowDamage: 5, fireCooldownMs: [1200, 1700], pos: { x: 0.55, y: 0.30 } },
            { species: 'kn_archer', hp: 35, speed: 0.8, arrowDamage: 5, fireCooldownMs: [1200, 1700], pos: { x: 0.80, y: 0.70 } }
            // { species: 'ENEMIGO_NUEVO_1', hp: ?, speed: ?, contactDamage: ?, pos: { x: 0.40, y: 0.60 } },
            // { species: 'ENEMIGO_NUEVO_2', hp: ?, speed: ?, contactDamage: ?, pos: { x: 0.65, y: 0.45 } }
          ]
        ],
        dialogueBefore: [
          // TODO: diálogo de entrada al capítulo 2
        ]
      },
      2: {
        type: 'combat',
        name: 'Habitación 2',
        zoneImage: RPG_ASSET_BASE + 'models/capitulo2/piso2c.png',
        music: RPG_ASSET_BASE + 'sound/terror_boss.mp3',
        enemySpawns: [
          { species: 'kn_warror', hp: 65, speed: 1.0, contactDamage: 11 },
          { species: 'kn_warror', hp: 65, speed: 1.0, contactDamage: 11 },
          { species: 'kn_archer', hp: 40, speed: 0.8, arrowDamage: 5, fireCooldownMs: [1200, 1700] },
          { species: 'kn_archer', hp: 40, speed: 0.8, arrowDamage: 5, fireCooldownMs: [1200, 1700] }
        ]
      },
      3: {
        type: 'combat',
        name: 'Habitación 3',
        zoneImage: RPG_ASSET_BASE + 'models/capitulo2/piso2b.png',
        music: RPG_ASSET_BASE + 'sound/vampire_boss.mp3',
        enemySpawns: [
          { species: 'kn_warror', hp: 70, speed: 1.05, contactDamage: 12 },
          { species: 'kn_warror', hp: 70, speed: 1.05, contactDamage: 12 },
          { species: 'kn_warror', hp: 70, speed: 1.05, contactDamage: 12 },
          { species: 'kn_archer', hp: 40, speed: 0.8, arrowDamage: 5, fireCooldownMs: [1100, 1600] }
        ]
      },
      4: {
        type: 'combat',
        name: 'Habitación 4',
        zoneImage: RPG_ASSET_BASE + 'models/capitulo2/piso2c.png',
        music: RPG_ASSET_BASE + 'sound/vampire_boss.mp3',
        enemySpawns: [
          { species: 'kn_warror', hp: 70, speed: 1.05, contactDamage: 12 },
          { species: 'kn_warror', hp: 70, speed: 1.05, contactDamage: 12 },
          { species: 'kn_warror', hp: 70, speed: 1.05, contactDamage: 12 },
          { species: 'kn_archer', hp: 40, speed: 0.85, arrowDamage: 5, fireCooldownMs: [1000, 1500] },
          { species: 'kn_archer', hp: 40, speed: 0.85, arrowDamage: 5, fireCooldownMs: [1000, 1500] }
        ]
      },
      5: {
        type: 'boss',
        name: 'Habitación 5 · Jefe final',
        zoneImage: RPG_ASSET_BASE + 'models/capitulo2/piso2d.png',
        // TODO: falta el sprite/atlas del jefe (el "guardián" que ya
        // menciona el diálogo final del cap. 1) y su patrón de ataque —
        // Reybug ya tiene la idea definida, queda pendiente de subir.
        enemySpawns: [],
        enemyName: 'TODO',
        music: RPG_ASSET_BASE + 'sound/TODO.mp3'
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

  keys: { up: false, down: false, left: false, right: false, block: false },
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

// ─── Progreso de carga (para Engine2D.LoadingBar) ─────
// A diferencia de Engine2D.loadAllWithProgress (que arma sus propias
// promesas a partir de un manifest {type, src}), acá `loaders` ya es un
// array de promesas (rpgLoadImage/rpgLoadAtlas siguen escribiendo en
// RPG.images/RPG.atlases, no en el cache interno del motor) — este helper
// solo cuenta cuántas terminaron, mismo criterio de "un asset que falla
// también cuenta como terminado" que usa Engine2D.
function rpgLoadWithProgress(promises, onProgress) {
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
