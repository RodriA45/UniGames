<div align="center">
  <h1>🎮 UniGames</h1>
  <p><b>Tu plataforma de mini juegos de palabras, cultura pop y entretenimiento.</b></p>
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express"/>
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
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
- **Preparado para Deploy:** Configurado con variables de entorno (`.env`) y listo para ser desplegado en Render (usando `render.yaml`). Base de datos escalable en Neon.tech (PostgreSQL).

## 🚀 Instalación y Uso Local

Sigue estos pasos para correr el proyecto en tu entorno local:

### Requisitos previos
- [Node.js](https://nodejs.org/) instalado (versión 18+ recomendada).
- Una base de datos PostgreSQL alojada (ej: Neon.tech, Supabase) o instalada localmente.

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

   **Variables de Entorno (.env):**
   Crea un archivo `.env` en la raíz del proyecto y agrega tus configuraciones seguras:
   ```env
   JWT_SECRET=tu_clave_secreta_super_segura
   DEV_SECRET=clave_para_acceder_al_admin_en_produccion
   ```

4. **Generar la Base de Datos y Correr el Servidor:**
   El proyecto usa `PostgreSQL`. Asegúrate de haber pegado tu `DATABASE_URL` (por ejemplo, provista por Neon.tech) en tu archivo `.env`.
   
   Para inicializar/resetear las tablas de la base de datos y cargar los datos por defecto:
   ```bash
   npm run db:reset
   ```
   
   Para arrancar el servidor de desarrollo:
   ```bash
   npm run dev
   ```

5. **Jugar:**
   Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

### 📦 Cómo subir cambios y Modo Administrador (Para Desarrolladores)

**Modo Administrador Automático:** 
Si necesitas convertir tu usuario a Administrador rápidamente, simplemente corre este script universal (requiere configurar la variable `DEV_SECRET` en `.env`):
```bash
npm run admin
```
O haz doble clic en `hacer_admin.bat` (solo en Windows). Escribe tu email o usuario, y al recargar la página, verás el botón de "Panel Admin".

**Despliegue y Cambios:**
Si deseas agregar nuevas preguntas o palabras a la base de datos, agrégalas en el archivo `database/init_db.js`. Luego, en vez de usar comandos de Git manualmente:
1. Da doble clic en el archivo **`subir_cambios_Github.bat`** (solo Windows).
2. Sigue las instrucciones en la consola para describir tu cambio.

### 🛠️ Últimas Mejoras Técnicas y UI/UX
- **Validación Ultra Robusta (Zod):** Todas las entradas del usuario (registro, login, puntuaciones) pasan por una validación estricta de esquemas antes de tocar la base de datos, evitando colapsos del servidor y ataques comunes.
- **Backend Modularizado:** `server.js` fue optimizado, delegando toda la lógica a `/routes/auth.js`, `/routes/juegos.js` y `/routes/admin.js`, permitiendo un crecimiento profesional sin código espagueti.
- **Gestión Visual Avanzada:** Ahora puedes elegir el tema de la aplicación desde el panel de administrador y los colores se sincronizan en toda la plataforma instantáneamente.
- **Pantalla de Carga Global:** Los juegos que requieren múltiples texturas y sprites muestran una elegante animación de carga retro que garantiza que el mapa no sea invisible.

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
├── routes/                 # Lógica de Endpoints modulares (auth.js, admin.js, juegos.js)
├── middlewares/            # Validaciones Zod, Rate Limiting y Control de JWT
├── schemas/                # Esquemas estrictos de validación con Zod
├── database/               # Módulo de conexión centralizada a SQLite (db.js)
├── server.js               # Servidor Backend principal

├── render.yaml             # Configuración de infraestructura (Blueprint) automatizada para Render
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
