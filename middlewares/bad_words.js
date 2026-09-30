// middlewares/bad_words.js
// Filtro básico de palabras vulgares u ofensivas.
const BAD_WORDS = [
    'puto', 'puta', 'putos', 'putas',
    'pito', 'pitos', 'polla', 'pollas',
    'mierda', 'mierdas', 'concha', 'cajeta',
    'culo', 'culos', 'teta', 'tetas',
    'verga', 'vergas', 'chota', 'chotas',
    'pija', 'pijas', 'zorra', 'zorras',
    'perra', 'perras', 'trolo', 'trola',
    'putazo', 'putito', 'forro', 'forra',
    'pendejo', 'pendeja', 'pelotudo', 'pelotuda',
    'boludo', 'boluda', 'tarado', 'tarada',
    'idiota', 'imbecil', 'estupido', 'estupida',
    'nazi', 'hitler', 'violador', 'pedofilo'
];

function normalizeUsername(username) {
    if (!username) return '';
    
    // Convertir a minúsculas
    let normalized = username.toLowerCase();
    
    // Reemplazar caracteres comunes usados para evadir filtros (leetspeak)
    const replacements = {
        '@': 'a', '4': 'a', 'á': 'a', 'ä': 'a',
        '3': 'e', 'é': 'e', 'ë': 'e',
        '1': 'i', '!': 'i', 'í': 'i', 'ï': 'i',
        '0': 'o', 'ó': 'o', 'ö': 'o',
        '5': 's', '$': 's',
        '7': 't',
        'v': 'b', // a veces b y v se usan para evadir (ej. verga / berga) - Ojo, puede afectar nombres válidos pero para malas palabras ayuda. Mejor no si el nombre es victor. Dejemos 'v' y 'b' separados, pero agreguemos variantes si es necesario.
    };

    let result = '';
    for (let char of normalized) {
        result += replacements[char] || char;
    }

    // Remover caracteres no alfabéticos para juntar palabras (ej. p.u.t.o -> puto)
    result = result.replace(/[^a-z]/g, '');

    return result;
}

function containsBadWords(username) {
    const normalized = normalizeUsername(username);
    
    for (let word of BAD_WORDS) {
        if (normalized.includes(word)) {
            return true;
        }
    }
    return false;
}

module.exports = {
    containsBadWords
};
