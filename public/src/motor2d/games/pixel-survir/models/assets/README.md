# Pixel Survi — assets

Ninguno de estos PNG se edita a mano: los arma `tools/build_assets.py` a
partir de los modelos originales. Si hay que cambiar una textura, se cambia
el modelo y se vuelve a correr el script.

```
python3 tools/build_assets.py      # necesita Pillow y la carpeta models/
```

## Modelos de entrada

```
models/assert/world/pradera.png        → familia grass  (pasto + tierra)
models/assert/world/desert.png         → familia sand
models/assert/world/snow.png           → familia snow
models/assert/world/Forestblack.png    → familia jgrass (selva)
models/assert/world/cavegrass.png      → familia cave   (roca de cueva)
models/assert/world/treee.png          → paleta de árbol "forest"
models/assert/world/pradera-tree.png   → paleta de árbol "pradera"
models/assert/world/blacktree.png      → paleta de árbol "jungle"
models/assert/item/tools-held.png      → herramienta en la mano
models/assert/item/tools-icon.png      → ícono de herramienta
models/assert/particle/cracks.png      → grietas de picado
models/junior/junior.png               → personaje jugable
```

## Salida

| archivo | tamaño | contenido |
|---|---|---|
| `tiles.png` | 128×288 | 139 tiles de 16px, 8 columnas. `id - 1` = índice |
| `junior.png` | 192×36 | 8 frames de 24×36: `idle · walk×4 · jump · swing · hurt` |
| `tools-held.png` | 80×64 | 5 herramientas × 4 materiales |
| `tools-icon.png` | 96×80 | 6 herramientas × 5 materiales |
| `cracks.png` | 64×16 | 4 etapas de picado |
| `portada.png` | 480×210 | escena del menú, armada con los propios tiles |

## Orden de `tiles.png`

El orden lo define `TID` en `survi_config.js` y el script lo replica exacto.
**Si se toca uno hay que tocar el otro.** Tres bloques:

1. **5 familias × 10 piezas** (ids 1–50) — `grass sand snow jgrass cave`,
   piezas `C T B L R TL TR BL BR S`. Salen del "blob" 3×3 de cada hoja: el
   borde de arriba es el pasto/costra, el centro el relleno. El bloque
   suelto (`S`) no está en todas las hojas, así que se arma con los cuatro
   cuadrantes de las esquinas.
2. **8 tiles simples** (ids 51–58) — `dirt stone ice bedrock coal iron gold
   cactus`. Piedra, hielo y bedrock se derivan tintando el relleno de cueva
   y de nieve; las vetas y el cactus se dibujan, porque no hay modelo.
3. **3 paletas × 27 piezas de árbol** (ids 59–139) — 19 de hoja y 8 de
   madera.

## Dos detalles que no son obvios

**Las hojas de árbol vienen con relieve en los cuatro lados.** Cada pieza
del modelo está dibujada como un cuadrado con contorno oscuro afuera y
bisel claro adentro. Pegadas tal cual, una copa se lee como una pila de
cuadrados. El script mide el grosor del relieve por borde (`edge_width`) y
lo borra de los lados que, según el autotile, siempre tocan otra hoja. Lo
mismo con el arriba y abajo de los troncos, para que se apilen sin juntas.

**Las tres hojas de árbol no tienen grilla uniforme.** Comparten el layout
de 4 columnas × 7 filas, pero entre algunas piezas hay margen transparente
y entre otras no. Los límites están medidos a mano en `TREE_SRC`: con una
grilla uniforme las filas de abajo salen cortadas.
