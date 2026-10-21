// ══════════════════════════════════════
//   Catálogo de logros (tabla `logros`)
// ══════════════════════════════════════
// Copia de los id/categoría/nombre de ACHIEVEMENTS en public/src/app2.js.
// La condición de cada logro (check) sigue viviendo en el frontend; acá
// está solo para que logros_usuario.logro_id tenga una FK válida.
//
// ⚠️ Si agregás un logro en app2.js, agregalo también acá: si no, el
// backend lo rechaza (POST /api/logros → "Logro desconocido").
//
// Formato: [id, categoria, nombre]
module.exports = [
    // general
    ["general_primer_juego", "general", "Primeros pasos"],
    ["general_los_9", "general", "Explorador"],
    ["general_primer_amigo", "general", "Nuevo amigo"],
    ["general_primer_duelo", "general", "Primer duelo"],
    ["general_racha_semanal", "general", "Jugador constante"],

    // sopa
    ["sopa_primera", "sopa", "Primera sopa"],
    ["sopa_veloz", "sopa", "Rayo veloz"],
    ["sopa_5", "sopa", "Buscador"],
    ["sopa_20", "sopa", "Maestro de la sopa"],
    ["sopa_tematicas", "sopa", "Todo terreno"],
    ["sopa_racha3", "sopa", "Racha ganadora"],
    ["sopa_sinerrores", "sopa", "Mano firme"],
    ["sopa_1000", "sopa", "Puntaje alto"],
    ["sopa_50", "sopa", "Leyenda de la sopa"],
    ["sopa_relampago", "sopa", "Relámpago"],

    // preguntados
    ["preg_primera", "preguntados", "Primera trivia"],
    ["preg_perfecta", "preguntados", "Ronda perfecta"],
    ["preg_50", "preguntados", "Cerebrito"],
    ["preg_racha", "preguntados", "Racha ganadora"],
    ["preg_tematicas", "preguntados", "Todo terreno"],
    ["preg_100", "preguntados", "Enciclopedia"],
    ["preg_racha15", "preguntados", "Imparable"],
    ["preg_10rondas", "preguntados", "Veterano"],
    ["preg_perfectas5", "preguntados", "Sin fallar"],
    ["preg_veloz", "preguntados", "Reflejos rápidos"],

    // termina
    ["termina_primera", "termina", "Primera palabra"],
    ["termina_1intento", "termina", "Puntería"],
    ["termina_10", "termina", "Buen vocabulario"],
    ["termina_racha", "termina", "Racha ganadora"],
    ["termina_tematicas", "termina", "Todo terreno"],
    ["termina_25", "termina", "Erudito"],
    ["termina_racha10", "termina", "Imparable"],
    ["termina_eficiente", "termina", "Eficiente"],
    ["termina_larga", "termina", "Palabra larga"],
    ["termina_ultimomomento", "termina", "Al filo"],

    // ahorcado
    ["ahorcado_primera", "ahorcado", "Primera horca"],
    ["ahorcado_perfecto", "ahorcado", "Sin errores"],
    ["ahorcado_10", "ahorcado", "Verdugo experto"],
    ["ahorcado_tematicas", "ahorcado", "Todo terreno"],
    ["ahorcado_racha", "ahorcado", "Racha ganadora"],
    ["ahorcado_25", "ahorcado", "Verdugo legendario"],
    ["ahorcado_racha10", "ahorcado", "Imparable"],
    ["ahorcado_perfectas5", "ahorcado", "Precisión total"],
    ["ahorcado_casiperfecto", "ahorcado", "Casi perfecto"],
    ["ahorcado_maratonista", "ahorcado", "Maratonista"],

    // wordle
    ["wordle_primera", "wordle", "Primera palabra"],
    ["wordle_1intento", "wordle", "De un solo tiro"],
    ["wordle_10", "wordle", "Letrado"],
    ["wordle_racha", "wordle", "Racha ganadora"],
    ["wordle_25", "wordle", "Maestro del wordle"],
    ["wordle_50", "wordle", "Leyenda del wordle"],
    ["wordle_racha10", "wordle", "Imparable"],
    ["wordle_eficiente", "wordle", "Eficiente"],
    ["wordle_larga", "wordle", "Palabra larga"],
    ["wordle_tematicas", "wordle", "Todo terreno"],

    // adivina
    ["adivina_primera", "adivina", "Primer acierto"],
    ["adivina_sinpistas", "adivina", "Ojo clínico"],
    ["adivina_10", "adivina", "Detective"],
    ["adivina_1pista", "adivina", "Pista certera"],
    ["adivina_25", "adivina", "Sabelotodo"],
    ["adivina_50", "adivina", "Leyenda"],
    ["adivina_racha5", "adivina", "Racha ganadora"],
    ["adivina_rondaperfecta", "adivina", "Ronda perfecta"],
    ["adivina_tematicas", "adivina", "Todo terreno"],
    ["adivina_10rondas", "adivina", "Veterano"],

    // runner
    ["runner_500", "runner", "Primeros pasos"],
    ["runner_historia", "runner", "Fin de la historia"],
    ["runner_infinito", "runner", "Sin límites"],
    ["runner_10000", "runner", "Imparable"],
    ["runner_monedas", "runner", "Coleccionista"],

    // castle_escape
    ["castle_nivel1", "castle_escape", "Primer paso"],
    ["castle_3estrellas", "castle_escape", "Perfección"],
    ["castle_10niveles", "castle_escape", "A mitad de camino"],
    ["castle_20niveles", "castle_escape", "Fuera del castillo"],
    ["castle_sinmuertes", "castle_escape", "Intacto"],

    // rpg_pixel
    ["rpg_primerjefe", "rpg_pixel", "Primer jefe caído"],
    ["rpg_capitulo1", "rpg_pixel", "Capítulo 1"],
    ["rpg_cofreoro", "rpg_pixel", "Fortuna"],
    ["rpg_elite", "rpg_pixel", "Modo Elite"],
    ["rpg_powerups", "rpg_pixel", "Alquimista"],
];
