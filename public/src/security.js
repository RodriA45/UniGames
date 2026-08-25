/**
 * Módulo de Seguridad y Anti-Cheat
 * Bloquea combinaciones de teclas para evitar apertura de consola y trampas.
 */
(function() {
    // Array "hasheado" (ofuscado en hexadecimal) de códigos clave prohibidos.
    // 0x7B = 123 (F12)
    // 0x49 = 73 (I)
    // 0x4A = 74 (J)
    // 0x43 = 67 (C)
    // 0x55 = 85 (U)
    const _0xBlocked = [0x7B, 0x49, 0x4A, 0x43, 0x55];

    // Bloquear Click Derecho (Context Menu)
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });

    // Bloquear combinaciones de teclado
    document.addEventListener('keydown', function(e) {
        // F12
        if (e.keyCode === _0xBlocked[0]) {
            e.preventDefault();
        }
        
        // Ctrl + Shift + I (Herramientas de desarrollo)
        if (e.ctrlKey && e.shiftKey && e.keyCode === _0xBlocked[1]) {
            e.preventDefault();
        }
        
        // Ctrl + Shift + J (Consola)
        if (e.ctrlKey && e.shiftKey && e.keyCode === _0xBlocked[2]) {
            e.preventDefault();
        }
        
        // Ctrl + Shift + C (Inspector)
        if (e.ctrlKey && e.shiftKey && e.keyCode === _0xBlocked[3]) {
            e.preventDefault();
        }

        // Ctrl + U (Ver código fuente)
        if (e.ctrlKey && e.keyCode === _0xBlocked[4]) {
            e.preventDefault();
        }
    });

    // Detección rudimentaria de consola abierta por tamaño de ventana
    // Si la diferencia entre el tamaño interno y externo es sospechosa.
    let _0xLimit = 160;
    setInterval(function() {
        if (window.outerWidth - window.innerWidth > _0xLimit || window.outerHeight - window.innerHeight > _0xLimit) {
            // Se asume que las DevTools podrían estar abiertas.
            // Para no romper la exp. en monitores raros, solo vaciamos la consola.
            console.clear();
            console.log("%c¡Alto ahí! 🛑", "color: red; font-size: 40px; font-weight: bold;");
            console.log("%cLas trampas no están permitidas en UniGames.", "color: white; font-size: 20px;");
        }
    }, 2000);
})();
