# Parche para `app2.js` — Pixel Survi con lazy loading

Cinco cambios chicos. Ninguno toca lo que ya anda.

---

## 1) Nuevo `ensureSurviLoaded()` — al lado de `ensureRpgLoaded()` (~línea 1941)

Pegar justo después de la función `ensureRpgLoaded()`:

```js
// Pixel Survi es 100% módulos ES: no necesita ningún script clásico
// previo (no usa globales tipo SPRITES ni CASTLE_ESCAPE_CUSTOM_LEVELS),
// así que el CSS y el import() van en paralelo. Igual que los otros,
// la promesa se cachea: se baja una sola vez por sesión.
let surviModuleLoading = null;
function ensureSurviLoaded() {
  if (!surviModuleLoading) {
    surviModuleLoading = Promise.all([
      ensureCSS('src/motor2d/games/pixel-survi/pixel-survi.css'),
      import('./motor2d/games/pixel-survi/survi_main.js')
    ]).then(([, mod]) => mod);
  }
  return surviModuleLoading;
}
```

> Ojo con la ruta del `import()`: es relativa a **app2.js**, no al HTML.
> Si `app2.js` está en `public/src/app2.js`, `./motor2d/games/...` es correcto
> (así están armados runner/castle/rpg). El `ensureCSS()` en cambio es
> relativo al **documento**, por eso lleva `src/` adelante.

---

## 2) `GAME_SCREEN_IDS` (~línea 1820)

```js
const GAME_SCREEN_IDS = ['sopa', 'preguntados', 'termina', 'ahorcado', 'wordle', 'adivina', 'runner', 'castle_escape', 'rpg_pixel', 'pixel_survi'];
```

---

## 3) Dentro de `goTo()` (~línea 2020 y ~2040)

Arriba de todo, donde se frenan los loops:

```js
  if (typeof stopRpg === 'function') stopRpg();
  if (typeof rpgStopLoop === 'function') rpgStopLoop();
  if (typeof stopSurvi === 'function') stopSurvi();   // ← agregar
```

Y en el `if` de juegos de acción:

```js
if (section === 'runner' || section === 'castle_escape' || section === 'rpg_pixel' || section === 'pixel_survi') {
    unmutepageMusic();
    if (section === 'castle_escape') { ... }
    if (section === 'rpg_pixel') { ... }

    // ← agregar
    if (section === 'pixel_survi') {
      ensureSurviLoaded().then(() => {
        if (typeof initSurvi === 'function') initSurvi();
      });
    }
  } else {
```

---

## 4) Catálogo `actionGames` (~línea 300) — para que aparezca la tarjeta

```js
const actionGames = [
  { id: 'runner', title: 'Pixel Runner', ... },
  { id: 'castle_escape', title: 'Castle Escape', ... },
  { id: 'rpg_pixel', title: 'RPG Pixel', ... },
  { id: 'pixel_survi', title: 'Pixel Survi', desc: 'Mundo abierto por biomas: rompé bloques, construí y sobreviví. Normal o hardcore.', tag: 'Sandbox' },
];
```

Y en `gameIconSVG()`, junto a los otros íconos:

```js
    pixel_survi: '<rect x="3" y="13" width="18" height="8"></rect><path d="M3 13l4-4 5 3 4-5 5 6"></path>',
```

(Opcional, para logros) en `LOGROS_JUEGOS`:

```js
  { id: 'pixel_survi',  nombre: 'Pixel Survi' },
```

---

## 5) `index.html`

- Pegar la sección de `pixel-survi.html` junto a las otras `sec-*`.
- **No** agregar `<link>` del CSS ni `<script>` del juego: los mete app2.js.
- `engine2d.js` tiene que seguir cargado como script clásico **antes** de
  `app2.js` (Pixel Survi lee `window.Engine2D`, igual que los otros tres).

---

## Estructura final de archivos

```
public/src/motor2d/games/pixel-survi/
  survi_main.js      ← punto de entrada (initSurvi / stopSurvi)
  survi_game.js      ← loop, jugador, vida, minado, enemigos
  survi_world.js     ← generación por biomas, tileset, spawn aleatorio
  survi_save.js      ← 3 mundos en localStorage (meta + data separadas)
  survi_ui.js        ← DOM y pantallas
  survi_config.js    ← constantes, tiles, ítems, biomas
  pixel-survi.css
  assets/portada.png ← todavía no existe; si falta, el menú muestra el placeholder
```
