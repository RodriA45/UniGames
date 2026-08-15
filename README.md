<div align="center">
  <h1>🎮 UniGames</h1>
  <p><b>Tu plataforma de mini juegos de palabras, cultura pop y entretenimiento.</b></p>
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express"/>
  <img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite"/>
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5"/>
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3"/>
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript"/>
</div>

---

## 📖 Sobre el Proyecto

**UniGames** es una aplicación web interactiva desarrollada en equipo como proyecto final, pensada para ofrecer una experiencia rápida y entretenida con mini juegos clásicos. Cuenta con distintos modos y temáticas (Videojuegos, Películas, Anime, Programación).

Actualmente incluye:
- 💀 **Ahorcado:** El clásico, con sistema de vidas y palabras por temática.
- 🟩 **Adivina la Palabra (Wordle):** Modo difícil para adivinar palabras con pistas de colores.
- 🕵️ **Adivina la Cosa:** Adivina el título/personaje usando pistas progresivas. Incluye imágenes que se des-pixelan dinámicamente con Canvas.
- 🏃 **Pixel Runner:** Juego de carrera infinita con físicas y obstáculos, aumentando de velocidad.
- *(En desarrollo)* Sopa de Letras, Preguntados, Termina la Palabra, Salto Traicionero.

### 🛡️ Características Principales
- **Autenticación Segura (JWT):** Login y registro usando Json Web Tokens guardados en `localStorage`. Las contraseñas se encriptan con `bcrypt`.
- **Sistema de Audio:** Efectos de sonido y música de fondo dinámica que cambia según el juego, con un botón global de "Mute".
- **Leaderboard Global:** Tabla de puntuaciones donde los jugadores compiten por el primer lugar en cada juego.
- **Preparado para Deploy:** Configurado con variables de entorno (`.env`) listo para ser desplegado en servicios como **Render**. *(Nota: Actualmente usa SQLite para la presentación local, pero se planea migración a PostgreSQL para producción).*

## 🚀 Instalación y Uso Local

Sigue estos pasos para correr el proyecto en tu entorno local:

### Requisitos previos
- [Node.js](https://nodejs.org/) instalado (versión 18+ recomendada).
- Python (Solo necesario si querés regenerar o expandir la base de datos de palabras desde cero).

### Pasos

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/RodriA45/UniGames.git
   cd UniGames
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Variables de Entorno:**
   Crea un archivo `.env` en la raíz del proyecto y agrega tu secreto para JWT:
   ```env
   JWT_SECRET=tu_clave_secreta_super_segura
   ```

4. **Generar la Base de Datos y Correr el Servidor:**
   El proyecto usa `sqlite` con Promesas. La base de datos `.db` NO se sube a GitHub para proteger los puntajes de los usuarios en producción.
   
   Para arrancar el servidor de desarrollo y generar la base de datos automáticamente (ejecuta el script de Python por detrás):
   ```bash
   npm start
   ```
   *(Alternativa en Windows: doble clic en el archivo `iniciar.bat`).*

5. **Jugar:**
   Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

### 📦 Cómo subir cambios y nuevas palabras (Para Desarrolladores)

Si deseas agregar nuevas preguntas o palabras a la base de datos, agrégalas en el archivo `crear_bd.py`. Luego, en vez de usar comandos de Git manualmente, simplemente:
1. Da doble clic en el archivo **`subir.bat`** (solo Windows).
2. Sigue las instrucciones en la consola para describir tu cambio.

El script actualizará tu base de datos local para verificar que no haya errores de sintaxis, y luego subirá el código a GitHub de forma segura. El servidor en producción (ej. Render) detectará el cambio y usará su propio `npm start` para inyectar tus palabras nuevas en la base de datos viva sin borrar a los usuarios.

### ⚠️ Importante para Deploy en Render (Plan Gratuito)
Para asegurarte de que tu base de datos SQLite y tus juegos funcionen correctamente en el servidor gratuito de Render:
1. Ve a **Settings** en tu proyecto de Render.
2. Asegúrate de configurar el **Build Command** como: `npm install && python crear_bd.py`.
3. Configura el **Start Command** como: `node server.js`.
Esto garantiza que tu base de datos de palabras se genere en la imagen del sistema y no se borre cuando Render ponga a dormir el servidor.

### 🛠️ Últimas Mejoras UI/UX
- **Navegación Dinámica:** Los Juegos Destacados del inicio ahora scrollean suavemente hacia la tarjeta de juego exacta sin conflictos de animación.
- **Adivina la Cosa:** Se rediseñó el modal de introducción y el fondo translúcido para asegurar que cubra exactamente el área de juego sin pisar el menú superior.

## 📂 Estructura del Proyecto

```text
UniGames/
│
├── public/                 # Archivos Estáticos (Frontend)
│   ├── src/                # Scripts y Estilos del cliente (app.js, styles.css)
│   ├── logos/              # Imágenes para "Adivina la Cosa"
│   ├── sounds/             # Efectos de sonido y música (.mp3)
│   └── index.html          # Vista principal y punto de entrada SPA
│
├── server.js               # Servidor Backend (API REST con Express, Async/Await)
├── crear_bd.py             # Script para generar las tablas y diccionarios de palabras
├── .env                    # Variables de entorno (no subido a GitHub)
├── iniciar.bat             # Acceso directo para inicializar en Windows
└── package.json            # Configuración de dependencias (express, sqlite, jsonwebtoken...)
```

## 🔌 Endpoints de la API (Protegida)

- `POST /api/register`: Registra usuario y devuelve un token JWT.
- `POST /api/login`: Verifica credenciales y devuelve token JWT.
- `GET /api/leaderboard`: Devuelve el top de jugadores globales.
- `POST /api/partidas`: Guarda el puntaje. **(Requiere header `Authorization: Bearer <token>`)**

---

<p align="center">Desarrollado en equipo para aprender y jugar.</p>
