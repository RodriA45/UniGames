# La Programación Orientada a Objetos (POO) en app2.js

En nuestro archivo `app2.js`, la lógica general de la aplicación frontend (manejo del DOM, autenticación, notificaciones, ruteo) se reestructuró utilizando POO. 

La idea principal fue separar cada responsabilidad en su propio "Módulo", permitiendo que el archivo principal que controla toda la página sea ordenado, mantenible y escalable. 

Aquí te muestro cómo aplicamos los cuatro pilares de la POO **específicamente en `app2.js`**:

---

## 1. Abstracción
La abstracción se trata de definir moldes y comportamientos comunes para que otras clases los implementen, ocultando el mecanismo complejo.

**En `app2.js`:**
Se definió la clase base `Modulo`. Esta clase funciona como una **clase abstracta** (lanza un error si intentas crear un "Módulo" directo) y se encarga del trabajo sucio de enlazar (bind) los métodos a la propia clase para que funcionen bien cuando se llaman desde eventos de botones HTML (`onclick`).

```javascript
class Modulo {
  constructor() {
    // ABSTRACCIÓN: Evita instanciar esta clase genérica. 
    // Obliga al programador a usar subclases (ej. AuthManager)
    if (new.target === Modulo) {
      throw new Error('Modulo es abstracta: usá una subclase');
    }
    
    // (Oculta la lógica compleja de auto-enlazar los métodos)
    // ...
  }

  // Define la interfaz común que todos los módulos DEBEN tener
  iniciar() {}
}
```

---

## 2. Herencia
La herencia permite crear nuevas clases basadas en clases existentes.

**En `app2.js`:**
Cada sección de la aplicación es una clase que **hereda** (`extends`) de la clase base `Modulo`. Tenemos `AuthManager`, `Nucleo`, `Navegacion`, `Logros`, etc.

```javascript
// HERENCIA: AuthManager adquiere la lógica de auto-enlazado de Modulo
class AuthManager extends Modulo {
  constructor() {
    super(); // Llama al constructor de Modulo
    
    this.currentUser = null;
    this.supabaseClient = null;
  }

  // Sobrescribe el método iniciar() para implementar su propia lógica
  iniciar() {
    // Configura supabase, revisa la sesión, etc.
  }
  
  handleGoogleLogin() {
    // ...
  }
}

// Otro ejemplo: Nucleo también hereda de Modulo
class Nucleo extends Modulo {
  constructor() {
    super();
    this.APP_EL = { ... }; // Elementos del DOM
  }
}
```
*Ventaja:* Al crear un módulo nuevo, no tienes que volver a escribir el código complicado para atar las funciones (bind) al objeto, solo heredas de `Modulo` y te concentras en lo que hace tu módulo específico.

---

## 3. Encapsulamiento
El encapsulamiento se asegura de que la información interna o el estado de cada parte del sistema pertenezca solo a esa parte, exponiendo métodos controlados para modificarlo.

**En `app2.js`:**
La clase `Nucleo` **encapsula** todas las referencias a los elementos HTML (`APP_EL`). La clase `AuthManager` **encapsula** al usuario actual (`this.currentUser`) y a la conexión con Supabase (`this.supabaseClient`).

```javascript
class AuthManager extends Modulo {
  // ...

  // ENCAPSULAMIENTO: En lugar de que cualquier código modifique el usuario, 
  // proveemos un método controlado que actualiza la UI y limpia recursos
  cambiarUsuario(usuario) {
    this.currentUser = usuario;
    
    // Aplica lógicas asociadas que nadie desde afuera debería tener que recordar
    if (app.tema) app.tema.aplicarTemaEfectivo();
  }

  logout() {
    if (this.supabaseClient) this.supabaseClient.auth.signOut();
    this.cambiarUsuario(null);
    localStorage.removeItem('unigames_token');
    this.updateAuthUI();
  }
}
```
*Ventaja:* Si otra parte del código necesita que el usuario cierre sesión, no tiene que borrar los tokens a mano y borrar las variables de memoria, simplemente llama a `app.auth.logout()` que tiene toda la lógica encapsulada.

---

## 4. Polimorfismo
El polimorfismo significa que distintos objetos pueden ser tratados de la misma manera usando la misma instrucción, y cada uno reaccionará de la forma que le corresponde.

**En `app2.js`:**
La magia final del sistema modular es la clase global `App`. Esta clase tiene una lista de **todos los módulos** (ya sean de autenticación, de UI, de logros, etc.). Cuando arranca la aplicación, `App` recorre todos los módulos y llama a `.iniciar()`.

```javascript
class App {
  constructor() {
    // Agrupamos instancias de diferentes clases hijas de Modulo
    this.nucleo = new Nucleo();
    this.auth = new AuthManager();
    this.navegacion = new Navegacion();
    
    // Un array que los trata a todos por igual (Polimorfismo)
    this.modulos = [
      this.nucleo, 
      this.auth, 
      this.navegacion
    ];
  }

  arrancar() {
    // POLIMORFISMO: No importa si es Nucleo o AuthManager, 
    // sabemos que como heredan de Modulo, tienen la función .iniciar()
    for (const mod of this.modulos) {
      mod.iniciar(); 
    }
  }
}
```
*Ventaja:* Si el día de mañana agregamos un `class TiendaManager extends Modulo`, solo lo agregamos a la lista de `this.modulos`, y el bucle `.iniciar()` lo encenderá automáticamente sin requerir que modifiquemos cómo arranca la página web. Cada módulo sabe exactamente cómo inicializarse a sí mismo.
