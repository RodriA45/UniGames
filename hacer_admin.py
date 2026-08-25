import sqlite3
import webbrowser
import os
import sys
import time

# --- Colores para la consola ---
C_HEADER = '\033[95m'
C_BLUE = '\033[94m'
C_CYAN = '\033[96m'
C_GREEN = '\033[92m'
C_WARNING = '\033[93m'
C_FAIL = '\033[91m'
C_END = '\033[0m'
C_BOLD = '\033[1m'

DB_PATH = 'unigames.db'

def load_env():
    env_vars = {}
    if os.path.exists('.env'):
        with open('.env', 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    env_vars[key.strip()] = val.strip()
    return env_vars

ENV = load_env()
PROD_URL = ENV.get('PRODUCTION_URL', 'https://unigames-dszw.onrender.com')
DEV_SECRET = ENV.get('DEV_SECRET', 'unigames_super_secret')

def limpiar_pantalla():
    os.system('cls' if os.name == 'nt' else 'clear')

def imprimir_banner():
    print(f"{C_CYAN}{C_BOLD}")
    print("=======================================")
    print("   🛡️  UNIGAMES - PANEL DE CONTROL 🛡️   ")
    print("=======================================")
    print(f"{C_END}")

def obtener_conexion():
    try:
        conn = sqlite3.connect(DB_PATH)
        return conn
    except Exception as e:
        print(f"{C_FAIL}Error conectando a la base de datos: {e}{C_END}")
        return None

def listar_usuarios():
    limpiar_pantalla()
    imprimir_banner()
    print(f"{C_BLUE}--- Lista de Usuarios Registrados ---{C_END}\n")
    
    conn = obtener_conexion()
    if not conn: return
    
    try:
        c = conn.cursor()
        c.execute("SELECT id, nombre_usuario, email, rol FROM usuarios ORDER BY id ASC")
        usuarios = c.fetchall()
        
        if not usuarios:
            print(f"{C_WARNING}No hay usuarios registrados en la base de datos.{C_END}")
        else:
            print(f"{'ID':<5} | {'USUARIO':<15} | {'ROL':<10} | {'EMAIL'}")
            print("-" * 60)
            for u in usuarios:
                rol_str = f"{C_GREEN}{u[3]}{C_END}" if u[3] == 'admin' else u[3]
                print(f"{u[0]:<5} | {u[1]:<15} | {rol_str:<19} | {u[2]}")
    except sqlite3.Error as e:
        print(f"{C_FAIL}Error de lectura: {e}{C_END}")
    finally:
        conn.close()
        
    print("\n")
    input(f"{C_BOLD}Presiona ENTER para volver al menú principal...{C_END}")

def cambiar_rol(nuevo_rol):
    while True:
        limpiar_pantalla()
        imprimir_banner()
        titulo = "DAR PERMISOS DE ADMINISTRADOR" if nuevo_rol == 'admin' else "QUITAR PERMISOS DE ADMINISTRADOR"
        print(f"{C_BLUE}--- {titulo} ---{C_END}\n")
        
        email = input("Ingresa el correo electrónico del usuario (o '0' para volver atrás): ").strip()
        
        if email == '0':
            return
            
        if not email:
            print(f"{C_WARNING}El correo no puede estar vacío.{C_END}")
            time.sleep(1.5)
            continue
            
        conn = obtener_conexion()
        if not conn: return
        
        try:
            c = conn.cursor()
            c.execute("SELECT id, nombre_usuario, rol FROM usuarios WHERE email = ?", (email,))
            row = c.fetchone()
            
            if not row:
                print(f"\n{C_FAIL}❌ Error: No se encontró un usuario con el correo '{email}'.{C_END}")
                time.sleep(2)
                continue
            
            if row[2] == nuevo_rol:
                print(f"\n{C_WARNING}El usuario '{row[1]}' ya tiene el rol '{nuevo_rol}'.{C_END}")
                time.sleep(2)
                continue
                
            confirmacion = input(f"\n¿Estás seguro que deseas actualizar el rol de {C_BOLD}'{row[1]}'{C_END} a '{nuevo_rol}'? (s/n): ").strip().lower()
            if confirmacion == 's':
                c.execute("UPDATE usuarios SET rol = ? WHERE email = ?", (nuevo_rol, email))
                conn.commit()
                print(f"\n{C_GREEN}✅ ¡Éxito! El rol del usuario '{row[1]}' ha sido actualizado a {nuevo_rol}.{C_END}")
                time.sleep(2.5)
                return
            else:
                print(f"\n{C_WARNING}Operación cancelada.{C_END}")
                time.sleep(1.5)
                return
                
        except sqlite3.Error as e:
            print(f"\n{C_FAIL}Error de Base de Datos: {e}{C_END}")
            time.sleep(2)
            return
        finally:
            conn.close()

def login_rapido_navegador():
    limpiar_pantalla()
    imprimir_banner()
    print(f"{C_BLUE}--- Inicio de Sesión Rápido (Navegador) ---{C_END}\n")
    print(f"Esta opción abrirá el navegador e iniciará sesión automáticamente como Administrador.\n")
    print(f"¿A qué entorno deseas acceder?")
    print(f"  {C_GREEN}1.{C_END} Servidor Local (localhost:3000)")
    print(f"  {C_GREEN}2.{C_END} Servidor Producción (Render - unigames-dszw)")
    print(f"  {C_WARNING}0. Cancelar{C_END}\n")
    
    opcion = input(f"{C_BOLD}Tu opción: {C_END}").strip()
    
    if opcion == '1':
        url = "http://localhost:3000/api/admin/dev-login"
    elif opcion == '2':
        url = f"{PROD_URL}/api/admin/dev-login?secret={DEV_SECRET}"
    elif opcion == '0':
        print(f"\n{C_WARNING}Operación cancelada.{C_END}")
        time.sleep(1)
        return
    else:
        print(f"\n{C_FAIL}Opción no válida.{C_END}")
        time.sleep(1.5)
        return
        
    try:
        webbrowser.open(url)
        print(f"\n{C_GREEN}✅ Abriendo: {url}{C_END}")
        if opcion == '1':
            print(f"Si el servidor de Node.js no está corriendo, la página no cargará.")
    except Exception as e:
        print(f"\n{C_FAIL}No se pudo abrir el navegador: {e}{C_END}")
    time.sleep(2.5)

def menu_principal():
    while True:
        limpiar_pantalla()
        imprimir_banner()
        print(f"Selecciona una opción:")
        print(f"  {C_GREEN}1.{C_END} Ver lista de usuarios")
        print(f"  {C_GREEN}2.{C_END} Hacer a un usuario Administrador")
        print(f"  {C_GREEN}3.{C_END} Quitar rol de Administrador")
        print(f"  {C_GREEN}4.{C_END} Probar Panel Admin en Navegador (Auto-Login)")
        print(f"  {C_WARNING}0. Salir{C_END}\n")
        
        opcion = input(f"{C_BOLD}Tu opción: {C_END}").strip()
        
        if opcion == '1':
            listar_usuarios()
        elif opcion == '2':
            cambiar_rol('admin')
        elif opcion == '3':
            cambiar_rol('user')
        elif opcion == '4':
            login_rapido_navegador()
        elif opcion == '0':
            limpiar_pantalla()
            print(f"{C_GREEN}¡Hasta luego!{C_END}\n")
            sys.exit(0)
        else:
            print(f"{C_FAIL}\n❌ Opción no válida. Por favor, selecciona una opción del menú.{C_END}")
            time.sleep(1.5)

if __name__ == "__main__":
    # Comprobar si la base de datos existe
    if not os.path.exists(DB_PATH):
        print(f"{C_FAIL}Error: No se encontró la base de datos '{DB_PATH}'.{C_END}")
        print("Por favor, asegúrate de haber ejecutado 'crear_bd.py' o iniciado el servidor primero.")
        sys.exit(1)
        
    try:
        menu_principal()
    except KeyboardInterrupt:
        limpiar_pantalla()
        print(f"\n{C_WARNING}Script cancelado por el usuario. Saliendo...{C_END}\n")
        sys.exit(0)
