<div align="center">
  <h1>🎮 UniGames</h1>
  <p><b>Tu plataforma de mini juegos de palabras, cultura pop y aventuras pixel-art.</b></p>
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express"/>
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5"/>
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3"/>
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript"/>
</div>

---

## 📖 Sobre el Proyecto

**UniGames** es una aplicación web interactiva (Single Page Application) desarrollada para ofrecer una experiencia rápida y entretenida con minijuegos tanto clásicos como de aventura. Cuenta con distintos modos y temáticas (Videojuegos, Películas, Anime, Programación).

### 🕹️ Juegos Disponibles
**Clásicos / Trivia:**
- 💀 **Ahorcado:** El clásico, con sistema de vidas y más de 40 palabras por temática.
- 🟩 **Adivina la Palabra (Wordle):** Descubre la palabra oculta de 5 letras (más de 40 palabras).
- 🕵️ **Adivina la Cosa:** Adivina el título/personaje usando pistas progresivas. Incluye imágenes que se des-pixelan dinámicamente con Canvas.
- ❓ **Preguntados:** Responde trivia con 4 opciones de más de 40 preguntas integradas.

**Aventuras 2D (Con Motor 2D Propio):**
- 🏃 **Pixel Runner:** Juego de carrera infinita con físicas, ciclo día/noche, power-ups y tienda de mejoras.
- 🏰 **Castle Escape (Trampas):** Juego de plataformas con saltos de precisión y trampas ocultas.
- ⚔️ **RPG Pixel:** Aventura de combate estilo RPG por turnos y exploración.

### 🛡️ Características Principales
- **Autenticación con Supabase Auth:** Integración nativa con Supabase para inicio de sesión seguro, registro, recuperación de contraseña y **Google OAuth**.
- **Roles y Usuarios:** Sistema de avatares pixel-art y roles de usuario (`user`, `admin`). Sincronización automática entre Supabase y la base de datos local de PostgreSQL (`/api/auth/sync`).
- **Sistema de Amigos y Duelos:** Busca y agrega a otros jugadores mediante su nombre de usuario, inspecciona sus logros en su perfil público y rétalos a **duelos 1v1** en minijuegos seleccionados (con soporte para temáticas y límite de tiempo).
- **Perfiles Personalizables:** Edición de perfil dinámica desde la interfaz. Cambia tu nombre de usuario y tu avatar pixel-art en tiempo real sin recargar la página.
- **Motor 2D Nativo (`engine2d.js`):** Desarrollado desde cero en Vanilla JS utilizando HTML5 Canvas con manejo avanzado de *requestAnimationFrame*, colisiones, sistema de partículas y cámara.
- **Filtro de Seguridad (Bad Words):** Middleware integrado en el backend para bloquear el uso de lenguaje inapropiado y validación estricta en tiempo real para evitar nombres de usuario duplicados.
- **Panel de Administración (sección propia, solo admins):** el HTML del panel lo sirve `GET /api/admin/panel` únicamente si la base confirma que la cuenta es admin activa (no alcanza con el rol del token). Incluye:
  - **Dashboard:** usuarios, conectados en este momento, récords, duelos, cuentas nuevas por día, top 5 y estado del servidor.
  - **Cuentas:** búsqueda y filtros (Usuarios: en línea / desconectados · Admins · Baneados: temporales / permanentes), paginadas de a 20 (`1 · 1–20`, `2 · 21–35`…), estado en línea, última conexión y menú ⋯ con *Ver perfil*, cambio de rol y **baneo temporal o permanente con motivo** (tabla `sanciones`; el usuario baneado queda afuera en el momento y ve el motivo).
  - **Contenido y reportes** paginados de a 20; los reportes se ordenan tocando el título de cada columna (usuarios: más nuevos primero).
  - Todas las confirmaciones y avisos usan carteles propios del sitio (no `alert`/`confirm` del navegador).
  - **Avisos:** título + descripción, prioridad *normal* (solo notificación) o *alta* (cartel en el medio de la pantalla para todos), envío inmediato o programado por fecha y hora, e historial con fecha/hora, destinatarios y % de lectura.
  - **Logs en tiempo real:** pedidos HTTP y mensajes del servidor en vivo, con búsqueda, filtro por nivel, pausa y descarga.
  - **Configuración:** modo mantenimiento, abrir/cerrar el registro de cuentas nuevas, ocultar juegos, tema por defecto y perfiles del equipo.
  - Contenido de los juegos y reportes (CSV / PDF).
- **Tiempo real (Server-Sent Events):** notificaciones, avisos, cambios de configuración y de rol llegan al instante (`GET /api/stream`).
- **Leaderboard Global:** Tabla de puntuaciones competitiva.

## 🚀 Instalación y Uso Local

### Requisitos previos
- [Node.js](https://nodejs.org/) instalado (versión 18+ recomendada).
- Una base de datos PostgreSQL alojada (ej: Neon.tech, Supabase) o instalada localmente.

### Pasos de Instalación

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/RodriA45/UniGames.git
   cd UniGames
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Variables de Entorno (.env):**
   Crea un archivo `.env` en la raíz del proyecto y agrega tus configuraciones seguras:
   ```env
   # Backend
   JWT_SECRET=tu_clave_secreta_super_segura

   # Supabase
   DATABASE_URL=postgresql://postgres.xxx... (URL de conexión a tu DB Postgres)
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_ANON_KEY=tu_anon_key_publica
   ```

4. **Inicializar Base de Datos (Muy Importante):**
   El proyecto utiliza `PostgreSQL`. Para crear las tablas necesarias e insertar la masiva cantidad de preguntas, palabras y configuraciones de juegos, ejecuta:
   ```bash
   npm run db:reset
   ```
   *(Este comando ejecuta el script optimizado `database/seed_games.js`).*

5. **Arrancar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

6. **Jugar:**
   Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

### 📦 Cómo subir cambios y Modo Administrador (Para Desarrolladores)

**Modo Administrador Automático:** 
Si necesitas convertir tu usuario a Administrador rápidamente, corre el script (usa la misma `DATABASE_URL` del `.env`):
```bash
npm run admin
```
En Windows, también puedes hacer doble clic en `hacer_admin.bat`. Escribe tu email o usuario, recarga la página, y verás el botón de "Panel Admin".

**Subir cambios a GitHub:**
Para automatizar los commits y push, ejecuta el archivo **`subir_cambios_Github.bat`** (solo Windows) y sigue las instrucciones en la consola.

### 🛠️ Arquitectura y Optimizaciones
- **Base de datos unificada:** Uso de un *wrapper* SQL personalizado (`db.js`) adaptado para integrar consultas universales (compatibilidad Postgres) sin utilizar ORMs pesados.
- **Física y Rendering 2D Optimizado:** Se corrigieron problemas de *memory leaks* cerrando ciclos de *GameLoop* al cambiar de vistas en la SPA. Uso de *image-rendering: pixelated* y *Math.trunc* en el motor 2D para eliminar efecto *stuttering* al desplazar cámara en Canvas.
- **Validación Robusta (Zod):** Entradas del usuario fuertemente tipadas y validadas antes de tocar la base de datos.

## 📂 Estructura del Proyecto

```text
UniGames/
│
├── public/                 # Archivos Estáticos (Frontend)
│   ├── src/                
│   │   ├── app2.js         # Orquestador SPA y lógica principal de Frontend
│   │   ├── styles.css      # Estilos globales y UI
│   │   ├── modales.css     # Estilos de modales
│   │   └── motor2d/        # Motor 2D Nativo y lógica de juegos avanzados
│   │       ├── engine2d.js # Core del motor (Loop, Física, Audio, Render)
│   │       ├── ui-components.css
│   │       └── games/      # Implementaciones (pixel-runner, castle-escape, rpg-pixel, pixel-survi)
│   ├── logos/              # Imágenes generales y avatares
│   ├── assert/             # Música del menú e íconos de perfil
│   └── index.html          # Vista principal (SPA), Modales y Canvas
│
├── routes/                 # Endpoints modulares del Backend (auth.js, admin.js, juegos.js)
├── middlewares/            # Validaciones Zod, Rate Limiting y autenticación JWT
├── schemas/                # Esquemas estrictos de validación (Zod)
├── database/               # Módulo de conexión a PostgreSQL (db.js) y seed_games.js
├── server.js               # Punto de entrada de Express (Backend)
│
├── render.yaml             # Configuración de despliegue automatizado para Render
├── .env                    # Variables de entorno seguras (no versionado)
├── iniciar.bat             # Acceso directo para levantar el servidor localmente
└── package.json            # Dependencias (express, pg, jsonwebtoken...)
```

## 🔌 Endpoints de la API Principal (Protegida)

- `POST /api/auth/sync`: Sincroniza la sesión de Supabase con el backend local.
- `GET /api/leaderboard`: Devuelve el ranking global.
- `POST /api/partidas`: Registra el puntaje tras finalizar un juego. **(Requiere header `Authorization: Bearer <token>`)**
- `GET /api/admin/*` & `PUT /api/admin/*`: Rutas exclusivas del Panel de Administración.

---

<p align="center">Desarrollado en equipo para aprender, jugar y explorar los límites de Vanilla JS.</p>
