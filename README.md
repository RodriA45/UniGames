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
- **Roles y Usuarios:** Sistema de avatares (con imágenes pixel-art predeterminadas) y roles de usuario (`user`, `admin`).
- **Panel de Administración (NUEVO):** Un potente panel exclusivo para administradores que permite:
  - Ver estadísticas en tiempo real (usuarios totales, partidas jugadas, actividad gráfica).
  - Gestionar usuarios (buscar, banear/desbanear, promover a admin).
  - Personalizar la apariencia del sitio (cambiar color del tema a Oscuro, Claro o Rojo).
  - Gestionar anuncios globales (historial de avisos y activación dinámica de un banner público).
- **Sistema de Audio:** Efectos de sonido y música de fondo dinámica que cambia según el juego, con un botón global de "Mute".
- **Leaderboard Global:** Tabla de puntuaciones donde los jugadores compiten por el primer lugar en cada juego.
- **Preparado para Deploy:** Configurado con variables de entorno (`.env`) listo para ser desplegado. *(Usa SQLite localmente).*

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
   El proyecto usa `sqlite` con Promesas. La base de datos `.db` NO se sube a GitHub para proteger los puntajes de los usuarios.
   
   Para arrancar el servidor de desarrollo y generar la base de datos automáticamente (ejecuta el script de Python por detrás):
   ```bash
   npm start
   ```
   *(Alternativa en Windows: doble clic en el archivo `iniciar.bat`).*

5. **Jugar:**
   Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

### 📦 Cómo subir cambios y Modo Administrador (Para Desarrolladores)

**Modo Administrador Automático:** 
Si necesitas convertir tu usuario a Administrador rápidamente, simplemente haz doble clic en `hacer_admin.bat` y escribe tu nombre de usuario. Al recargar la página, verás el botón de "Panel Admin".

**Despliegue y Cambios:**
Si deseas agregar nuevas preguntas o palabras a la base de datos, agrégalas en el archivo `crear_bd.py`. Luego, en vez de usar comandos de Git manualmente:
1. Da doble clic en el archivo **`subir_cambios_Github.bat`** (solo Windows).
2. Sigue las instrucciones en la consola para describir tu cambio.

### 🛠️ Últimas Mejoras UI/UX
- **Gestión Visual Avanzada:** Ahora puedes elegir el tema de la aplicación desde el panel de administrador y los colores se sincronizan en toda la plataforma instantáneamente.
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
│   └── index.html          # Vista principal, Modales, Panel Admin y SPA
│
├── server.js               # Servidor Backend (API REST con Express, Async/Await, Endpoints de Admin)
├── crear_bd.py             # Script para generar las tablas (usuarios, avisos, configuracion) y diccionarios
├── .env                    # Variables de entorno (no subido a GitHub)
├── iniciar.bat             # Acceso directo para inicializar en Windows
└── package.json            # Configuración de dependencias (express, sqlite, jsonwebtoken...)
```

## 🔌 Endpoints de la API (Protegida)

- `POST /api/register` & `POST /api/login`: Autenticación.
- `GET /api/leaderboard`: Devuelve el top de jugadores globales.
- `POST /api/partidas`: Guarda el puntaje. **(Requiere header `Authorization: Bearer <token>`)**
- `GET /api/admin/*` & `PUT /api/admin/*`: Rutas exclusivas del Panel de Administración. Protegidas con token JWT y validación de rol `admin` en el backend.

---

<p align="center">Desarrollado en equipo para aprender y jugar.</p>
