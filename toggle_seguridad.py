import os
import sys
import webbrowser
import time

INDEX_PATH = 'public/index.html'

def toggle_security():
    if not os.path.exists(INDEX_PATH):
        print("Error: No se encontró public/index.html")
        return False

    with open(INDEX_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Patrones posibles
    active_pattern = '<script src="src/security.js"></script>'
    disabled_pattern = '<!-- <script src="src/security.js"></script> -->'
    
    if disabled_pattern in content:
        # Activar
        content = content.replace(disabled_pattern, active_pattern)
        print("ACTIVADO")
    elif active_pattern in content:
        # Desactivar
        content = content.replace(active_pattern, disabled_pattern)
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
