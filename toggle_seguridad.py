import os
import sys
import webbrowser
import time
import re

INDEX_PATH = 'public/index.html'

def toggle_security():
    if not os.path.exists(INDEX_PATH):
        print("Error: No se encontró public/index.html")
        return False

    with open(INDEX_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Patrones usando regex para ser mǭs robustos a espacios extra
    active_pattern = r'<script\s+src=["\']?src/security\.js["\']?\s*>\s*</script>'
    disabled_pattern = r'<!--\s*<script\s+src=["\']?src/security\.js["\']?\s*>\s*</script>\s*-->'
    
    if re.search(disabled_pattern, content):
        # Activar
        content = re.sub(disabled_pattern, '<script src="src/security.js"></script>', content)
        print("ACTIVADO")
    elif re.search(active_pattern, content):
        # Desactivar
        content = re.sub(active_pattern, '<!-- <script src="src/security.js"></script> -->', content)
        print("DESACTIVADO")
    else:
        print("Error: No se encontró la etiqueta de security.js en el HTML.")
        return False
        
    with open(INDEX_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
        
    # Esperamos un momento para que el sistema de archivos aplique los cambios
    time.sleep(0.5)
    
    # Abrimos automáticamente el navegador para "refrescar" o mostrar la página con la configuración nueva
    try:
        webbrowser.open("http://localhost:3000")
    except Exception:
        pass
    
    return True

if __name__ == '__main__':
    toggle_security()
