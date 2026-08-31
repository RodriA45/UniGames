const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const INDEX_PATH = path.join(__dirname, 'public', 'index.html');

function toggleSecurity() {
    if (!fs.existsSync(INDEX_PATH)) {
        console.log("Error: No se encontró public/index.html");
        process.exit(1);
    }

    let content = fs.readFileSync(INDEX_PATH, 'utf8');
    
    const activePattern = /<script\s+src=["']?src\/security\.js["']?\s*>\s*<\/script>/;
    const disabledPattern = /<!--\s*<script\s+src=["']?src\/security\.js["']?\s*>\s*<\/script>\s*-->/;
    
    if (disabledPattern.test(content)) {
        // Activar
        content = content.replace(disabledPattern, '<script src="src/security.js"></script>');
        console.log("ACTIVADO");
    } else if (activePattern.test(content)) {
        // Desactivar
        content = content.replace(activePattern, '<!-- <script src="src/security.js"></script> -->');
        console.log("DESACTIVADO");
    } else {
        console.log("Error: No se encontró la etiqueta de security.js en el HTML.");
        process.exit(1);
    }
        
    fs.writeFileSync(INDEX_PATH, content, 'utf8');
    
    setTimeout(() => {
        const startCommand = process.platform === 'win32' ? 'start' : (process.platform === 'darwin' ? 'open' : 'xdg-open');
        exec(`${startCommand} http://localhost:3000`, () => {});
    }, 500);
}

toggleSecurity();
