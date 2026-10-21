# La Programación Orientada a Objetos (POO) en UniGames

La refactorización del proyecto introdujo la Programación Orientada a Objetos (POO) principalmente en el frontend (en el motor `engine2d.js` y en la lógica de cada juego). 

La POO se basa en **cuatro pilares fundamentales**. A continuación, explicamos qué significa cada uno y mostramos exactamente **dónde y cómo los estamos usando** en nuestro código.

---

## 1. Encapsulamiento
El encapsulamiento es el concepto de ocultar el estado interno (los datos) de un objeto y requerir que toda interacción se realice a través de los métodos (funciones) definidos por la clase. Esto protege los datos para que no sean modificados de forma inesperada desde afuera.

**Dónde lo usamos:**
En `engine2d.js`, la clase `AssetManager` utiliza **propiedades privadas** (usando el símbolo `#` de JavaScript).

```javascript
class AssetManager extends EngineService {
  // Las propiedades privadas no pueden ser accedidas ni modificadas desde fuera
  #images;
  #atlases;
  #imagePromises;
  #atlasPromises;

  constructor() {
    super();
    this.#images = {};
    // ...
  }

  // La única forma de interactuar con el estado interno es usar sus métodos públicos
  loadImage(src) {
    // Aquí el AssetManager controla cómo y cuándo se guarda la imagen en #images
    // El resto del juego no sabe ni le importa cómo funciona esto internamente.
  }
}
```
*Ventaja en UniGames:* Evita que un error en un juego sobreescriba accidentalmente el caché de imágenes, porque nadie más que `AssetManager` puede tocar la variable `#images`.

---

## 2. Abstracción
La abstracción consiste en ocultar la complejidad interna y mostrar solo los detalles esenciales al usuario u otras partes del código. Se crean conceptos "abstractos" que definen qué debe hacer algo, pero delegan el "cómo" a otras clases más específicas. 

**Dónde lo usamos:**
En `engine2d.js`, tenemos `EngineService`, que funciona como una **clase abstracta**. Una clase abstracta es una clase que *no debe ser instanciada directamente*, sino que solo sirve para que otras clases hereden de ella.

```javascript
class EngineService {
  constructor() {
    // Si alguien intenta hacer "new EngineService()", el programa lanza un error.
    // Solo se permite hacer "new" en clases que hereden de ella (como AssetManager).
    if (new.target === EngineService) {
      throw new Error('EngineService es abstracta'); 
    }
    // ...
  }
}
```

Otro ejemplo es la entidad `PowerUp` o `Obstaculo` en `runner_entities.js`. Son conceptos abstractos. Nunca creas un "Obstáculo" genérico en el juego, creas un `Pajaro` o un `ObstaculoSuelo`.

---

## 3. Herencia
La herencia permite que una clase (hija) adquiera las propiedades y métodos de otra clase (padre). Esto promueve la reutilización de código; no tienes que escribir lo mismo una y otra vez.

**Dónde lo usamos:**
En `runner_entities.js`, el `Jugador` (Junior) hereda de `Engine2D.Entity`. 

```javascript
// La clase padre (Entity) ya tiene la lógica de posición x, y, width, height.
export class Jugador extends Engine2D.Entity {
  constructor() {
    // "super" llama al constructor de la clase padre (Entity)
    super({
      x: 90, y: 0, w: 29, h: 34,
      vy: 0, jumps: 0, maxJumps: 2
    });
  }

  // Además de tener x, y, etc., el Jugador agrega sus propios métodos:
  saltar(viewH, lloviendo) {
    if (this.jumps < this.maxJumps) {
      this.vy = -viewH * 0.018;
      this.jumps++;
    }
  }
}
```
*Ventaja en UniGames:* Gracias a la herencia, el `Jugador` no tiene que programar desde cero cómo guardar su tamaño o sus coordenadas, ya que `Engine2D.Entity` se encarga de eso.

---

## 4. Polimorfismo
El polimorfismo ("muchas formas") es la capacidad de tratar a diferentes objetos de manera uniforme (como si fueran el mismo tipo de objeto) porque comparten la misma clase padre o la misma "interfaz", aunque cada uno responda de forma distinta a la misma instrucción.

**Dónde lo usamos:**
Imagina el bucle principal de nuestro juego. Cuando recolectas algo, no necesitas hacer un `if` gigantesco preguntando si es una moneda, un escudo o puntos dobles. 

```javascript
// En runner_entities.js (Ejemplo conceptual de Polimorfismo)

class Moneda extends Pickup {
  recolectar(jugador, juego) {
    juego.sumarMonedas(1);
    this.dead = true;
  }
}

class PowerUpEscudo extends PowerUp {
  recolectar(jugador, juego) {
    jugador.shieldFrames = 600; // Activa el escudo en el jugador
    this.dead = true;
  }
}

// En el bucle del juego (runner_loop.js o collision_system):
// 'entidad' puede ser una Moneda o un PowerUpEscudo. No importa.
// El juego simplemente llama a .recolectar() y el objeto correcto hace lo que debe hacer.
entidad.recolectar(jugador, juego); 
```
*Ventaja en UniGames:* El código del motor (o el bucle del juego) se mantiene súper limpio. Simplemente le dice a todos los objetos `entidad.dibujar()` o `entidad.recolectar()`, y gracias al polimorfismo, el pájaro aletea, el cactus se queda quieto, la moneda suma dinero y el escudo te protege. Cada entidad sabe cómo comportarse.
