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

**UniGames** es una aplicación web interactiva desarrollada en equipo, pensada para ofrecer una experiencia rápida y entretenida con mini juegos clásicos. Actualmente en desarrollo, la plataforma incluirá juegos como:
- 🔍 Sopa de Letras
- ❓ Preguntados
- 🔤 Termina la Palabra
- 🪢 Ahorcado
- 🕵️ Adivina la Cosa

El sistema cuenta con **registro y autenticación de usuarios**, y una **tabla de puntuaciones global** (Leaderboard) donde los jugadores pueden competir para alcanzar el primer puesto según la temática elegida (Videojuegos, Películas, Anime, etc.).

## 🚀 Instalación y Uso Local

Sigue estos pasos para correr el proyecto en tu entorno local:

### Requisitos previos
- [Node.js](https://nodejs.org/) instalado (versión 18+ recomendada).
- Python (Solo necesario si querés regenerar la base de datos desde cero).

### Pasos

1. **Clonar el repositorio:**
   \`\`\`bash
   git clone https://github.com/RodriA45/UniGames.git
   cd UniGames
   \`\`\`

2. **Instalar dependencias:**
   \`\`\`bash
   npm install
   \`\`\`

3. **Base de Datos:**
   El proyecto usa SQLite. El archivo \`unigames.db\` se genera localmente para almacenar usuarios y puntajes. Si necesitás regenerarla, puedes usar el script de Python incluido:
   \`\`\`bash
   python crear_bd.py
   \`\`\`

4. **Iniciar el Servidor:**
   \`\`\`bash
   node server.js
   \`\`\`
   *(Alternativa en Windows: puedes hacer doble clic en el archivo \`iniciar.bat\` que levantará el servidor y abrirá el navegador automáticamente).*

5. **Jugar:**
   Abre tu navegador en [http://localhost:3000](http://localhost:3000).

## 📂 Estructura del Proyecto

\`\`\`text
UniGames/
│
├── public/                 # Archivos Estáticos (Frontend)
│   ├── src/                # Scripts y Estilos del cliente
│   └── index.html          # Vista principal y punto de entrada SPA
│
├── server.js               # Servidor Backend (API REST con Express)
├── crear_bd.py             # Script para generar las tablas en SQLite
├── iniciar.bat             # Acceso directo para inicializar en Windows
├── package.json            # Configuración de dependencias de Node
└── .gitignore              # Archivos excluidos de Git (node_modules, *.db)
\`\`\`

## 🔌 Endpoints de la API

El backend provee la siguiente API REST para la comunicación con el cliente:
- \`POST /api/register\`: Registra un usuario nuevo con contraseña encriptada (bcrypt).
- \`POST /api/login\`: Verifica las credenciales e inicia sesión.
- \`GET /api/leaderboard\`: Devuelve el top 10 de jugadores globales.
- \`POST /api/partidas\`: Guarda el puntaje obtenido por un usuario en un juego y temática.

---

<p align="center">Desarrollado para jugar y aprender.</p>
