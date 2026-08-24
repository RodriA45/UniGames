// ══════════════════════════════════════
//   Engine2D — engine2d.js
// ══════════════════════════════════════
//
// Motor 2D chico para canvas, sacado de lo genérico que ya vivía adentro
// de rpg.js (loop con dt normalizado, cache de imágenes/atlas, helpers de
// dibujo con drawImage, manejo de teclado, entidades/escenas). La idea es
// que cada minijuego nuevo NO reescriba esto: solo define su config de
// niveles, sus entidades (con update/draw) y listo.
//
// No depende de nada del resto del proyecto — no toca DOM de HUD/overlay
// específico ni sabe nada de "secciones" (sec-rpg_pixel, etc). Cada juego
// sigue siendo dueño de su propio HTML/CSS/overlay, como ya vienen siendo
// Pixel Runner y RPG Pixel. Este archivo se carga UNA vez en index.html
// (antes que los .js de cada juego) y expone el objeto global `Engine2D`.
//
// Uso típico de un minijuego nuevo:
//
//   const loop = new Engine2D.GameLoop({
//     update: (dt, step) => scene.update(dt, step),
//     draw:   () => { ctx.clearRect(0,0,C.width,C.height); scene.draw(ctx); }
//   });
//   Engine2D.loadAll([{type:'image', src:'foo.png'}]).then(() => loop.start());
//
// ══════════════════════════════════════

const Engine2D = (function () {

  // ─────────────────────────────────────
  // Assets: cache de imágenes y atlas JSON
  // ─────────────────────────────────────
  const images = {};
  const atlases = {};

  function loadImage(src) {
    if (images[src] && images[src].complete) return Promise.resolve(images[src]);
    return new Promise((resolve, reject) => {
      const img = images[src] || new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      images[src] = img;
      if (!img.src) img.src = src;
    });
  }

  function loadAtlas(src) {
    if (atlases[src]) return Promise.resolve(atlases[src]);
    return fetch(src)
      .then(r => r.json())
      .then(data => { atlases[src] = data; return data; });
  }

  // manifest: [{type:'image', src}, {type:'atlas', src}, {type:'audio', src}, ...]
  // Devuelve Promise.all — usar .catch() en el que llama para mostrar
  // el mensaje de "no se pudieron cargar los recursos" propio del juego.
  // `type:'audio'` solo precarga la pista en el caché de Audio (no la
  // reproduce): el juego la usa después con Engine2D.Audio.playMusic/playSFX.
  function loadAll(manifest) {
    return Promise.all(manifest.map(item => {
      if (item.type === 'atlas') return loadAtlas(item.src);
      if (item.type === 'audio') return loadAudio(item.src);
      return loadImage(item.src);
    }));
  }

  function getImage(src) { return images[src]; }
  function getAtlas(src) { return atlases[src]; }

  // ─────────────────────────────────────
  // Audio — sistema de audio centralizado
  // ─────────────────────────────────────
  //
  // Categorías:
  //   music   — música de fondo (un solo tema a la vez, con loop por default).
  //   ambient — paisaje/ambiente sonoro (un solo canal a la vez).
  //   sfx     — efectos cortos (pueden solaparse entre sí).
  //
  // Resuelve de forma centralizada cosas como "cuando pierdo la música se
  // detiene" (que Pixel Runner hoy maneja a mano con el bgMusic global de
  // app.js). Acá playMusic() corta automáticamente el tema anterior y
  // stopMusic()/stopAll() silencian sin dejar el audio sonando por atrás.
  //
  // Uso:
  //   Engine2D.Audio.playMusic('boss.mp3');
  //   Engine2D.Audio.playSFX('shoot.wav');
  //   Engine2D.Audio.stopMusic();
  //   Engine2D.Audio.stopAll();
  //   Engine2D.Audio.setVolume(0.5);         // master (afecta a todo)
  //   Engine2D.Audio.setMusicVolume(0.6);
  //   Engine2D.Audio.setSfxVolume(0.8);
  //   Engine2D.Audio.setAmbientVolume(0.4);
  //   Engine2D.Audio.mute(); Engine2D.Audio.unmute(); Engine2D.Audio.isMuted();
  //   Engine2D.Audio.pause(); Engine2D.Audio.resume();  // menú de pausa
  //   Engine2D.Audio.unlock();               // dentro de un gesto del usuario
  //
  // Para pre-cargar pistas junto con el resto de assets del juego, agregalas
  // al manifest de Engine2D.loadAll():
  //   Engine2D.loadAll([
  //     { type: 'image', src: 'boss.png' },
  //     { type: 'audio', src: 'boss.mp3' },
  //   ]);
  //
  // Autoplay: los navegadores bloquean la reproducción hasta el primer
  // gesto del usuario. Si un play() es rechazado, el sistema arma solo un
  // listener y reintenta con el primer click/tap/tecla — no hace falta que
  // cada juego maneje eso por su cuenta.
  //
  // Nota: este módulo NO toca el sistema de audio global que ya usa app.js
  // (bgMusic/setMusic/pageMusic) — conviven sin pisarse. Cada juego podrá
  // migrar a Engine2D.Audio cuando quiera, sin romper a los demás.

  const _audioCache = {};       // src -> HTMLAudioElement (reusado y pre-cargado)
  const _channels = { music: null, ambient: null }; // canal único por categoría continua
  const _activeSfx = new Set(); // efectos sonando en este momento
  const _persistKeys = {
    master:  'engine2d.masterVolume',
    music:   'engine2d.musicVolume',
    sfx:     'engine2d.sfxVolume',
    ambient: 'engine2d.ambientVolume'
  };

  // Si un juego prefiere pasar solo el nombre del archivo (como en los
  // ejemplos: Audio.playMusic('boss.mp3')), setea el base path una vez:
  //   Engine2D.Audio.setBasePath('assert/pixel runner/sounds/');
  // Las rutas que ya vienen completas (con '/', 'http', 'data:', o que
  // arrancan con 'assert/') se usan tal cual. Por default está vacío.
  let _basePath = '';

  // Volúmenes — 0..1, persistidos en localStorage para recordarlos entre
  // sesiones. La primera vez, si el usuario ya tenía volúmenes del sistema
  // viejo de app.js (musicVolume/sfxVolume), se toman como valor inicial.
  function _storedNum(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      const n = raw !== null ? parseFloat(raw) : NaN;
      return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
    } catch { return fallback; }
  }
  function _store(key, v) { try { localStorage.setItem(key, String(v)); } catch {} }
  function _legacyDefault(key, fallback) { return _storedNum(key, fallback); }

  let _masterVolume = _storedNum(_persistKeys.master, 0.8);
  const _volumes = {
    music:   _storedNum(_persistKeys.music,   _legacyDefault('musicVolume', 0.5)),
    sfx:     _storedNum(_persistKeys.sfx,     _legacyDefault('sfxVolume', 0.8)),
    ambient: _storedNum(_persistKeys.ambient, 0.5)
  };
  let _muted = false;
  let _unlocked = false;
  let _unlockArmed = false;

  function _clamp01(v) { return Math.min(1, Math.max(0, v)); }

  // Resuelve una ruta: si ya parece completa la usa, si no le antepone el
  // base path configurado (setBasePath). Así se pueden pasar nombres cortos.
  function _resolve(src) {
    if (!_basePath) return src;
    if (/^(https?:)?\/\//.test(src) || src.startsWith('data:') || src.startsWith('assert/') || src.includes('/')) return src;
    return _basePath + src;
  }

  function loadAudio(src) {
    src = _resolve(src);
    if (_audioCache[src]) return _audioCache[src];
    const a = new Audio(src);
    a.preload = 'auto';
    a.muted = _muted;
    _audioCache[src] = a;
    return a;
  }

  // Aplica el volumen resultante (master × categoría) a lo que está sonando.
  function _applyVolumes() {
    const music = _channels.music, ambient = _channels.ambient;
    if (music)   music.volume   = _masterVolume * _volumes.music;
    if (ambient) ambient.volume = _masterVolume * _volumes.ambient;
    _activeSfx.forEach(a => { a.volume = _masterVolume * _volumes.sfx * (a._baseVol ?? 1); });
  }

  // Los navegadores bloquean play() sin un gesto previo del usuario. Si un
  // play falla, armamos un listener único que reintenta con el primer
  // click/tap/tecla (misma idea que ya hacía app.js con attemptPlayMusic).
  function _armUnlock() {
    if (_unlockArmed) return;
    _unlockArmed = true;
    const onGesture = () => {
      document.removeEventListener('pointerdown', onGesture);
      document.removeEventListener('keydown', onGesture);
      _unlockArmed = false;
      _unlock();
    };
    document.addEventListener('pointerdown', onGesture, { once: true });
    document.addEventListener('keydown', onGesture, { once: true });
  }

  function _play(a, restart) {
    if (restart) a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => _armUnlock());
  }

  // Desbloquea la reproducción (llamarla desde un gesto del usuario o la
  // arma sola un play() fallido). Reintenta los canales de música/ambiente
  // que quedaron "pendientes" de arrancar, sin reiniciarlos desde cero.
  function _unlock() {
    _unlocked = true;
    for (const key of ['music', 'ambient']) {
      const a = _channels[key];
      if (a) { a.muted = _muted; _applyVolumes(); _play(a, false); }
    }
  }

  // Reproduce un canal continuo (music/ambient): corta el anterior, aplica
  // loop/restart y guarda la referencia para poder pararlo después.
  function _playChannel(key, src, opts) {
    const prev = _channels[key];
    const a = loadAudio(src);
    if (prev && prev !== a) { prev.pause(); prev.currentTime = 0; }
    a.loop = opts.loop !== false;
    a.muted = _muted;
    _channels[key] = a;
    _applyVolumes();
    _play(a, opts.restart !== false);
    return a;
  }

  function _stopChannel(key) {
    const a = _channels[key];
    if (a) { a.pause(); a.currentTime = 0; }
    _channels[key] = null;
  }

  const AudioSystem = {
    // Carga y cachea una pista sin reproducirla (para pre-cargar).
    load(src) { return loadAudio(src); },

    // Base path para pasar nombres cortos de archivo (ver _basePath).
    setBasePath(path) { _basePath = String(path || ''); },
    getBasePath() { return _basePath; },

    // Música de fondo: un solo tema a la vez — el anterior se corta solo.
    playMusic(src, opts = {}) { return _playChannel('music', src, opts); },

    // Ambiente: un solo canal, separado de la música.
    playAmbient(src, opts = {}) { return _playChannel('ambient', src, opts); },

    // Efecto corto: puede solaparse con otros efectos. Devolvemos el
    // elemento por si el juego quiere escuchar cuándo termina ('ended').
    // opts: { volume: 0..1, rate: playbackRate }
    playSFX(src, opts = {}) {
      const a = loadAudio(src).cloneNode(true);
      a.muted = _muted;
      a._baseVol = _clamp01(opts.volume ?? 1);
      a.volume = _masterVolume * _volumes.sfx * a._baseVol;
      if (opts.rate) a.playbackRate = opts.rate;
      _activeSfx.add(a);
      const done = () => { _activeSfx.delete(a); a.removeEventListener('ended', done); a.removeEventListener('error', done); };
      a.addEventListener('ended', done);
      a.addEventListener('error', done);
      _play(a, true);
      return a;
    },

    stopMusic()   { _stopChannel('music'); },
    stopAmbient() { _stopChannel('ambient'); },
    // Corta música + ambiente (los SFX son one-shot y mueren solos).
    stopAll() { _stopChannel('music'); _stopChannel('ambient'); },

    // Volumen master — afecta a las tres categorías a la vez.
    setVolume(v) {
      _masterVolume = _clamp01(v);
      _store(_persistKeys.master, _masterVolume);
      _applyVolumes();
    },
    setMusicVolume(v)   { _volumes.music   = _clamp01(v); _store(_persistKeys.music,   _volumes.music);   _applyVolumes(); },
    setSfxVolume(v)     { _volumes.sfx     = _clamp01(v); _store(_persistKeys.sfx,     _volumes.sfx);     _applyVolumes(); },
    setAmbientVolume(v) { _volumes.ambient = _clamp01(v); _store(_persistKeys.ambient, _volumes.ambient); _applyVolumes(); },
    getVolume()         { return _masterVolume; },
    getMusicVolume()    { return _volumes.music; },
    getSfxVolume()      { return _volumes.sfx; },
    getAmbientVolume()  { return _volumes.ambient; },

    // Silencia todo sin cortar la reproducción (vuelve con unmute()).
    mute()   { _muted = true;  Object.values(_audioCache).forEach(a => { a.muted = true; }); },
    unmute() { _muted = false; Object.values(_audioCache).forEach(a => { a.muted = false; }); _applyVolumes(); },
    toggleMute() { return this.isMuted() ? this.unmute() : this.mute(); },
    isMuted() { return _muted; },

    // Pausa/Resume — útil para el menú de pausa del juego. Guarda qué
    // canales estaban sonando para volver exactamente a ese estado.
    pause() {
      this._wasPlaying = {
        music:   !!_channels.music   && !_channels.music.paused,
        ambient: !!_channels.ambient && !_channels.ambient.paused
      };
      if (_channels.music)   _channels.music.pause();
      if (_channels.ambient) _channels.ambient.pause();
    },
    resume() {
      if (this._wasPlaying) {
        if (this._wasPlaying.music   && _channels.music)   _play(_channels.music, false);
        if (this._wasPlaying.ambient && _channels.ambient) _play(_channels.ambient, false);
        this._wasPlaying = null;
      }
    },

    // Desbloquea el audio (llamar dentro de un gesto del usuario, ej. el
    // primer click). También se arma solo si un play() falla antes.
    unlock() { _unlock(); },
    get unlocked() { return _unlocked; }
  };

  // ─────────────────────────────────────
  // Partículas — efectos visuales sin sprites
  // ─────────────────────────────────────
  //
  // Sistema global de partículas para explosiones, humo, polvo al saltar,
  // chispas, impactos, monedas, magia, fuego... sin tener que crear sprites
  // por cada efecto.
  //
  // Uso:
  //   // en el update del juego (recibe el dt del GameLoop, en ms):
  //   Engine2D.Particles.update(dt);
  //   // en el draw (pasale la cámara si el mundo tiene una):
  //   Engine2D.Particles.draw(ctx, camera);
  //
  //   Engine2D.Particles.emit({
  //     x: player.x, y: player.y,
  //     amount: 15,
  //     life: 400
  //   });
  //   Engine2D.Particles.explosion(enemy.x, enemy.y, { amount: 24 });
  //   Engine2D.Particles.sparks(hitX, hitY, { amount: 12 });
  //   Engine2D.Particles.dust(player.x, player.y + player.h);
  //   Engine2D.Particles.coins(coin.x, coin.y);
  //   Engine2D.Particles.magic(tx, ty);
  //   Engine2D.Particles.fire(torchX, torchY);
  //
  // Opciones de emit() (todas opcionales salvo x/y):
  //   x, y        — punto de origen (coordenadas de mundo)
  //   amount      — cantidad de partículas (default 10)
  //   life        — vida en ms (o [min,max]) (default 400)
  //   speed       — velocidad inicial en px/s (o [min,max]) (default 100)
  //   angle       — dirección base en grados (0 = derecha, 90 = abajo) (default 0)
  //   spread      — dispersión angular total en grados alrededor de `angle`
  //                 (default 360 = radial)
  //   vx, vy      — velocidad fija extra (p. ej. heredar la del jugador)
  //   gravity     — gravedad en px/s² (default 0)
  //   drag        — amortiguación por segundo 0..1 (default 0)
  //   size        — tamaño en px (o [min,max]) (default 4)
  //   endSize     — si se pasa, el tamaño va de size → endSize durante la vida
  //   shrink      — true = encoge hasta ~15% del tamaño inicial
  //   colors      — array de colores (se elige al azar por partícula)
  //   shape       — 'square' (default) | 'circle'
  //   rotation    — rotación inicial en rad (solo square), rotationSpeed en rad/s
  //   fade        — true = se desvanece el alpha al final de la vida (default true)
  //   glow        — px de shadowBlur para brillo (costoso, usarlo con moderación)
  //   onUpdate    — callback por partícula (p, dtMs) para física custom (magia, fuego)
  //
  // El sistema dibuja agrupando por color para no cambiar fillStyle por
  // partícula (mucho más rápido con cientos de partículas), recicla las
  // partículas muertas y tiene tope de seguridad para no degradar el juego.

  const Particles = (function () {
    const pool = [];      // partículas activas
    const free = [];      // partículas reutilizables
    const MAX_PARTICLES = 3000;
    let count = 0;

    // Si el valor es un número lo usa; si es [min,max] elige al azar.
    function _rand(v, def) {
      if (v === undefined || v === null) return def;
      if (Array.isArray(v)) return v[0] + Math.random() * (v[1] - v[0]);
      return v;
    }

    function _newParticle() {
      if (free.length) return free.pop();
      if (count >= MAX_PARTICLES) return null;
      count++;
      return {};
    }

    function emit(opts = {}) {
      const amount = Math.max(0, Math.floor(opts.amount ?? 10));
      if (!amount) return this;
      const baseAngle = ((opts.angle ?? 0) * Math.PI) / 180;
      const spreadRad = ((opts.spread ?? 360) * Math.PI) / 180;
      const x = opts.x ?? 0, y = opts.y ?? 0;
      const vx0 = opts.vx ?? 0, vy0 = opts.vy ?? 0;
      const colors = Array.isArray(opts.colors) && opts.colors.length ? opts.colors : ['#ffffff'];
      const shape = opts.shape === 'circle' ? 'circle' : 'square';
      const fade = opts.fade !== false;
      const glow = opts.glow ?? 0;
      const gravity = opts.gravity ?? 0;
      const drag = opts.drag ?? 0;
      const startSize = _rand(opts.size, 4);
      let endSize;
      if (opts.endSize !== undefined) endSize = opts.endSize;
      else if (opts.shrink) endSize = startSize * 0.15;
      else endSize = startSize;
      const onUpdate = typeof opts.onUpdate === 'function' ? opts.onUpdate : null;
      const rotationSpeed = opts.rotationSpeed ?? 0;
      const rotation0 = opts.rotation ?? 0;

      for (let i = 0; i < amount; i++) {
        const p = _newParticle();
        if (!p) break; // tope de partículas alcanzado
        const a = spreadRad > 0 ? baseAngle + (Math.random() * 2 - 1) * spreadRad : baseAngle;
        const speed = _rand(opts.speed, 100);
        p.x = x; p.y = y;
        p.vx = Math.cos(a) * speed + vx0;
        p.vy = Math.sin(a) * speed + vy0;
        p.life = _rand(opts.life, 400);
        p.maxLife = p.life > 0 ? p.life : 1;
        p.startSize = startSize;
        p.endSize = endSize;
        p.size = startSize;
        p.color = colors[(Math.random() * colors.length) | 0];
        p.alpha = 1;
        p.gravity = gravity;
        p.drag = drag;
        p.shape = shape;
        p.fade = fade;
        p.glow = glow;
        p.rotation = rotation0;
        p.rotationSpeed = rotationSpeed;
        p.onUpdate = onUpdate;
        pool.push(p);
      }
      return this;
    }

    function update(dt) {
      const sec = dt / 1000;
      for (let i = pool.length - 1; i >= 0; i--) {
        const p = pool[i];
        p.life -= dt;
        if (p.life <= 0) {
          pool[i] = pool[pool.length - 1];
          pool.pop();
          free.push(p);
          continue;
        }
        if (p.onUpdate) p.onUpdate(p, dt);
        p.vy += p.gravity * sec;
        if (p.drag > 0) {
          const d = Math.max(0, 1 - p.drag * sec);
          p.vx *= d; p.vy *= d;
        }
        p.x += p.vx * sec;
        p.y += p.vy * sec;
        const t = p.life / p.maxLife; // 1 al nacer → 0 al morir
        p.size = p.endSize + (p.startSize - p.endSize) * t;
        p.alpha = p.fade ? Math.min(1, t * 2) : 1;
        p.rotation += p.rotationSpeed * sec;
      }
    }

    function draw(ctx, camera) {
      if (!pool.length) return;
      // Agrupar por color para no cambiar fillStyle por partícula.
      const groups = new Map();
      for (const p of pool) {
        let g = groups.get(p.color);
        if (!g) { g = { color: p.color, items: [] }; groups.set(p.color, g); }
        g.items.push(p);
      }
      ctx.save();
      // Transformación mundo → pantalla (cámara opcional, con zoom centrado).
      if (camera) {
        ctx.translate(-camera.x, -camera.y);
        if (camera.zoom !== 1) {
          const cx = camera.x + camera.width / 2;
          const cy = camera.y + camera.height / 2;
          ctx.translate(cx, cy);
          ctx.scale(camera.zoom, camera.zoom);
          ctx.translate(-cx, -cy);
        }
      }
      for (const g of groups.values()) {
        ctx.fillStyle = g.color;
        ctx.globalAlpha = 1;
        const needGlow = g.items.some(p => p.glow > 0);
        for (const p of g.items) {
          ctx.globalAlpha = p.alpha;
          ctx.shadowBlur = p.glow > 0 ? p.glow : (needGlow ? 0 : ctx.shadowBlur);
          if (p.glow > 0) ctx.shadowColor = p.color;
          const s = p.size;
          if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.5, s / 2), 0, Math.PI * 2);
            ctx.fill();
          } else if (p.rotation !== 0) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillRect(-s / 2, -s / 2, s, s);
            ctx.restore();
          } else {
            ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
          }
        }
      }
      ctx.restore();
    }

    function clear() {
      for (let i = 0; i < pool.length; i++) free.push(pool[i]);
      pool.length = 0;
    }

    // ── Atajos para efectos comunes ──
    function burst(x, y, opts = {}) {
      return emit(Object.assign({ x, y, amount: 10, spread: 360 }, opts));
    }
    function explosion(x, y, opts = {}) {
      return emit(Object.assign({
        x, y, amount: 24, life: 500, speed: 220, size: 6, spread: 360,
        gravity: 200, drag: 0.4, glow: 8,
        colors: ['#ff6b35', '#ffd23f', '#ff9f1c', '#ffffff']
      }, opts));
    }
    function sparks(x, y, opts = {}) {
      return emit(Object.assign({
        x, y, amount: 12, life: 300, speed: 320, size: 2.5, spread: 360,
        gravity: 600, drag: 0.2, glow: 4,
        colors: ['#ffe08a', '#ffffff', '#ffcf3f']
      }, opts));
    }
    function dust(x, y, opts = {}) {
      return emit(Object.assign({
        x, y, amount: 8, life: 450, speed: 60, size: 5, spread: 180,
        angle: 270, gravity: -40, drag: 0.6,
        colors: ['#d7cfc0', '#b9b1a3', '#f0e9dd']
      }, opts));
    }
    function coins(x, y, opts = {}) {
      return emit(Object.assign({
        x, y, amount: 8, life: 700, speed: 160, size: 5, spread: 360,
        gravity: 350, drag: 0.3, glow: 6,
        colors: ['#fde047', '#facc15', '#fef9c3']
      }, opts));
    }
    function magic(x, y, opts = {}) {
      return emit(Object.assign({
        x, y, amount: 16, life: 800, speed: 90, size: 4, spread: 360,
        gravity: -120, drag: 0.05, glow: 10, shape: 'circle',
        colors: ['#a78bfa', '#c4b5fd', '#e9d5ff', '#ffffff']
      }, opts));
    }
    function fire(x, y, opts = {}) {
      return emit(Object.assign({
        x, y, amount: 12, life: 500, speed: 50, size: 7, spread: 40,
        angle: 270, gravity: -80, drag: 0.1, glow: 8, shape: 'circle',
        colors: ['#ff6b35', '#ffd23f', '#ef4444', '#ff9f1c']
      }, opts));
    }

    return {
      emit, update, draw, clear,
      burst, explosion, sparks, dust, coins, magic, fire,
      get count() { return pool.length; }
    };
  })();

  // ─────────────────────────────────────
  // Utilidades numéricas
  // ─────────────────────────────────────
  function randRange(range) {
    if (!range) return 0;
    return range[0] + Math.random() * (range[1] - range[0]);
  }

  // Zona jugable: piso = mitad inferior del canvas (u otro ratio), con
  // margen inferior. Mismo criterio que usaban rpg.js/Pixel Runner a mano.
  function floorBounds(canvas, topRatio = 0.5, bottomMargin = 0.06) {
    return {
      top: canvas.height * topRatio,
      bottom: canvas.height * (1 - bottomMargin)
    };
  }

  // ─────────────────────────────────────
  // Config — configuración por juego
  // ─────────────────────────────────────
  // Cada minijuego define un `config` arriba y el motor lo usa (física,
  // tamaño, debug) sin que los juegos pisen nada del motor:
  //
  //   const config = Engine2D.createConfig({
  //     width: 480, height: 270, gravity: 0.6, playerSpeed: 4, debug: false
  //   }, {
  //     gravity: 0.09, playerSpeed: 5   // overrides de ESTE juego
  //   });
  //
  // createConfig mezcla defaults + overrides (se puede pasar más de un
  // objeto override), valida los numéricos (positivos; width/height ≥ 1
  // enteros) y devuelve un objeto CONGELADO — nadie lo puede mutar a mitad
  // de partida por accidente.
  //
  // Los niveles pueden override el config base sin tocarlo: la física del
  // Scene lo resuelve con config.merge(levelCfg) → OTRO objeto congelado.
  function createConfig(defaults = {}, ...overrides) {
    const out = {};
    for (const k in defaults) out[k] = defaults[k];
    for (const ov of overrides) {
      if (!ov) continue;
      for (const k in ov) out[k] = ov[k];
    }
    for (const k in out) {
      const v = out[k];
      if (typeof v === 'number' && isFinite(v)) {
        if (k === 'width' || k === 'height') out[k] = Math.max(1, Math.floor(v));
        else if (k !== 'debug') out[k] = Math.max(0, v);
      }
    }
    return Object.freeze(out);
  }

  // Mezcla el config base con un override (ej. de nivel/habitación) y
  // devuelve otro objeto congelado, sin mutar el original.
  function mergeConfig(base = {}, overrides = {}) {
    return createConfig(base, overrides);
  }

  // Ajusta el canvas a un tamaño lógico (config.width × config.height)
  // manteniendo la relación de aspecto dentro de su contenedor. Devuelve
  // el factor de escala aplicado. Opt-in: solo se usa si el juego lo llama.
  function fitCanvas(canvas, width, height) {
    const parent = canvas.parentElement;
    const pW = parent && parent.clientWidth ? parent.clientWidth : window.innerWidth;
    const pH = parent && parent.clientHeight ? parent.clientHeight : window.innerHeight;
    const scale = Math.min(pW / width, pH / height);
    canvas.style.width = Math.max(1, Math.floor(width * scale)) + 'px';
    canvas.style.height = Math.max(1, Math.floor(height * scale)) + 'px';
    canvas.width = Math.max(1, Math.floor(width));
    canvas.height = Math.max(1, Math.floor(height));
    return scale;
  }

  // ─────────────────────────────────────
  // Overlay de debug — ver qué pasa bajo el capó
  // ─────────────────────────────────────
  // Panel con FPS + valores del config, hitboxes de entidades y zonas de
  // trigger. Se llama SOLO si el juego tiene config.debug = true (lo
  // dibuja el Scene.drawDebug() automáticamente); no afecta la jugabilidad.
  //
  //   Engine2D.drawDebugOverlay(ctx, {
  //     camera, config,
  //     hitboxes: [player, ...entities],
  //     triggers: triggers.zones,
  //     fps, lines: ['vida: 3']
  //   });
  function drawDebugOverlay(ctx, opts = {}) {
    const camera = opts.camera;
    ctx.save();
    // ── hitboxes y triggers en coordenadas de mundo ──
    if (camera) {
      ctx.translate(-camera.x, -camera.y);
      if (camera.zoom !== 1) {
        const cx = camera.x + camera.width / 2;
        const cy = camera.y + camera.height / 2;
        ctx.translate(cx, cy);
        ctx.scale(camera.zoom, camera.zoom);
        ctx.translate(-cx, -cy);
      }
    }
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,255,120,0.9)';
    for (const e of opts.hitboxes || []) {
      if (!e || e.dead) continue;
      if (e.r != null) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.stroke(); }
      if (e.w != null && e.h != null) ctx.strokeRect(e.x, e.y, e.w, e.h);
    }
    for (const z of opts.triggers || []) {
      if (!z.enabled) continue;
      ctx.fillStyle = z.color;
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = z.borderColor;
      ctx.strokeRect(z.x, z.y, z.w, z.h);
      if (z.id) {
        ctx.fillStyle = z.borderColor;
        ctx.font = '10px monospace';
        ctx.fillText(z.id, z.x + 3, z.y + 11);
      }
    }
    ctx.restore();
    // ── panel de info en coordenadas de pantalla ──
    const lines = [];
    if (opts.fps !== undefined) lines.push('FPS: ' + Math.round(opts.fps));
    for (const k in (opts.config || {})) lines.push(k + ': ' + opts.config[k]);
    for (const l of opts.lines || []) lines.push(String(l));
    if (!lines.length) return;
    const x = opts.x ?? 8, y = opts.y ?? 8;
    ctx.save();
    ctx.font = '11px monospace';
    const panelW = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0) + 14;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x, y, panelW, lines.length * 14 + 8);
    ctx.fillStyle = '#7CFC00';
    lines.forEach((l, i) => ctx.fillText(l, x + 6, y + 17 + i * 14));
    ctx.restore();
  }

  // ─────────────────────────────────────
  // Dibujo — helpers con drawImage
  // ─────────────────────────────────────

  // Dibuja un frame de spritesheet de grilla uniforme (como sprites.js),
  // anclado en (x,y) = punto de los pies, escalado a targetH manteniendo
  // el aspect ratio de la celda.
  function drawFrame(ctx, img, rowData, frameIndex, x, y, targetH, flip) {
    const sx = frameIndex * rowData.cellWidth;
    const sy = rowData.y;
    const sw = rowData.cellWidth;
    const sh = rowData.cellHeight;
    const dh = targetH;
    const dw = dh * (sw / sh);
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh, dw, dh);
    ctx.restore();
  }

  // Dibuja un frame por NOMBRE desde un atlas JSON
  // ({frameSize, frames:{nombre:{x,y,w,h}}}) — para sheets con poses
  // discretas (dash, ataques) en vez de un ciclo de caminata uniforme.
  function drawAtlasFrame(ctx, img, atlas, frameName, x, y, targetH, flip, centered) {
    const f = atlas.frames[frameName];
    if (!f) return;
    const dh = targetH;
    const dw = dh * (f.w / f.h);
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    if (centered) {
      ctx.drawImage(img, f.x, f.y, f.w, f.h, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.drawImage(img, f.x, f.y, f.w, f.h, -dw / 2, -dh, dw, dh);
    }
    ctx.restore();
  }

  // Dibuja un ícono recortado a mano por coordenadas fijas {x,y,w,h}
  // (balas, pociones, proyectiles sueltos en una hoja compartida).
  // opts: { rotation, flip, centered }
  function drawIconRect(ctx, img, rect, x, y, targetH, opts = {}) {
    const dh = targetH;
    const dw = dh * (rect.w / rect.h);
    ctx.save();
    ctx.translate(x, y);
    if (opts.rotation) ctx.rotate(opts.rotation);
    if (opts.flip) ctx.scale(-1, 1);
    if (opts.centered) {
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, -dw / 2, -dh, dw, dh);
    }
    ctx.restore();
  }

  // Dibuja `img` cubriendo todo el rect destino (equivalente a
  // background-size: cover) — para fondos de zona/escena.
  function drawCover(ctx, img, dx, dy, dw, dh) {
    const ir = img.width / img.height;
    const dr = dw / dh;
    let sx, sy, sw, sh;
    if (ir > dr) {
      sh = img.height; sw = sh * dr; sx = (img.width - sw) / 2; sy = 0;
    } else {
      sw = img.width; sh = sw / dr; sx = 0; sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  // ─────────────────────────────────────
  // GameLoop — requestAnimationFrame con dt normalizado a "frames" de 60fps
  // ─────────────────────────────────────
  class GameLoop {
    // opts: { update(dt, step), draw(), maxDt=50 }
    // step = dt/16.6, para mover cosas en unidades "por frame a 60fps"
    // sin depender del refresh rate real de la pantalla (mismo criterio
    // que ya usaba rpgUpdate).
    constructor({ update, draw, maxDt = 50 }) {
      this.updateFn = update;
      this.drawFn = draw;
      this.maxDt = maxDt;
      this.running = false;
      this.raf = null;
      this.lastTs = 0;
      this._tick = this._tick.bind(this);
    }
    start() {
      // OJO: stop() antes de prender running=true — si se llama al revés,
      // un start() inmediatamente seguido de lógica que llame stop() apaga
      // el loop recién prendido y nunca vuelve a correr (bug real que tuvo
      // rpg.js con rpgBeginCombat/rpgStopLoop).
      this.stop();
      this.running = true;
      this.lastTs = 0;
      this.raf = requestAnimationFrame(this._tick);
    }
    stop() {
      this.running = false;
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
    }
    _tick(ts) {
      if (!this.running) return;
      const dt = this.lastTs ? Math.min(ts - this.lastTs, this.maxDt) : 16;
      this.lastTs = ts;
      const step = dt / 16.6;
      this.updateFn(dt, step);
      this.drawFn();
      this.raf = requestAnimationFrame(this._tick);
    }
  }

  // ─────────────────────────────────────
  // Input — teclado
  // ─────────────────────────────────────
  // keyMap: { ArrowUp:'up', KeyW:'up', Space:'fire', ... } → nombres de
  // acción, no códigos de tecla, así el juego no vuelve a repetir el if
  // gigante de e.code === 'ArrowUp' || e.code === 'KeyW' que tenía rpg.js.
  //
  // opts:
  //   activeCheck: () => boolean   — para no reaccionar si la sección/juego
  //                                  no está visible (RPG usaba esto para
  //                                  chequear .classList.contains('active'))
  //   onDown(action, e), onUp(action, e) — callbacks opcionales, ej. para
  //                                  recalcular "facing" o disparar
  //   preventDefaultFor: Set(['ArrowUp',...]) — códigos a los que hacerles
  //                                  preventDefault (evita scroll de página)
  class KeyboardInput {
    constructor(keyMap, opts = {}) {
      this.keyMap = keyMap;
      this.state = {}; // { up:true, fire:false, ... } — ya normalizado por acción
      this.opts = opts;
      this._down = this._down.bind(this);
      this._up = this._up.bind(this);
    }
    attach() {
      this.detach();
      document.addEventListener('keydown', this._down);
      document.addEventListener('keyup', this._up);
    }
    detach() {
      document.removeEventListener('keydown', this._down);
      document.removeEventListener('keyup', this._up);
    }
    _down(e) {
      if (this.opts.activeCheck && !this.opts.activeCheck()) return;
      const action = this.keyMap[e.code];
      if (!action) return;
      this.state[action] = true;
      if (this.opts.preventDefaultFor && this.opts.preventDefaultFor.has(e.code)) e.preventDefault();
      if (this.opts.onDown) this.opts.onDown(action, e);
    }
    _up(e) {
      const action = this.keyMap[e.code];
      if (!action) return;
      this.state[action] = false;
      if (this.opts.onUp) this.opts.onUp(action, e);
    }
  }

  // Nota sobre controles táctiles: en este proyecto los botones táctiles
  // se cablean directo en el HTML con onpointerdown/onpointerup llamando
  // funciones globales del juego (ver rpgMove/rpgBlock/rpgFire en
  // rpg.js + index.html). El motor no fuerza otra convención encima de
  // eso — cada juego simplemente hace que esas funciones globales toquen
  // el mismo `KeyboardInput.state` (o su propio estado) que ya usa para
  // teclado, para no duplicar lógica de movimiento entre los dos modos.

  // ─────────────────────────────────────
  // Animation / Animator — ciclos de sprites con FPS propio, loop opcional
  // y transición automática de una animación a otra
  // ─────────────────────────────────────
  //
  // Animation = UN ciclo (ej. "walk"): una lista de frames + a qué
  // velocidad se reproducen. `frames` puede ser nombres de atlas (para
  // usar con Engine2D.drawAtlasFrame) o índices numéricos (para
  // Engine2D.drawFrame con una grilla) — a la clase no le importa el
  // contenido, solo el orden y el timing.
  //
  // Uso solo:
  //   const walk = new Engine2D.Animation({ frames: ['walk_0','walk_1','walk_2'], fps: 10 });
  //   // en el update: walk.update(dt);
  //   // en el draw:   Engine2D.drawAtlasFrame(ctx, img, atlas, walk.currentFrame, x, y, h, flip);
  //
  // opts:
  //   frames: array de nombres o índices (obligatorio)
  //   fps: cuadros por segundo de la animación (no confundir con el fps
  //        del juego — cada Animation tiene el suyo)
  //   loop: true = vuelve al frame 0 al terminar (ciclos como idle/walk).
  //         false = se queda clavada en el último frame (ataques, dash,
  //         muerte — cosas que pasan una vez)
  //   onComplete: se llama UNA sola vez, justo cuando una animación con
  //         loop:false termina (nunca se llama en animaciones con loop).
  //         Pensada para "terminó el ataque, ahora sí puedo pegar otro" o
  //         "terminó la animación de muerte, mostrar game over".
  //   next: nombre de OTRA animación (dentro del mismo Animator) a la que
  //         saltar automáticamente apenas esta termina — solo tiene efecto
  //         con loop:false y si esta Animation vive dentro de un Animator
  //         (ver más abajo). Así "attack" puede volver solo a "idle" sin
  //         que el juego tenga que acordarse de hacerlo a mano cada vez.
  class Animation {
    constructor({ frames, fps = 10, loop = true, onComplete = null, next = null }) {
      this.frames = frames;
      this.fps = Math.max(1, fps);
      this.loop = loop;
      this.onComplete = onComplete;
      this.next = next;
      this.frameIndex = 0;
      this._elapsedMs = 0; // ms acumulados dentro del frame actual
      this.finished = false; // true cuando una animación loop:false llegó al último frame
    }
    // Vuelve al frame 0 — se llama sola al hacer Animator.play(), pero
    // también sirve para reiniciar un ciclo a mano (ej. un dash que se
    // puede volver a disparar antes de que "termine" visualmente).
    reset() {
      this.frameIndex = 0;
      this._elapsedMs = 0;
      this.finished = false;
    }
    update(dt) {
      if (this.finished) return; // clavada en el último frame, no consume más tiempo
      this._elapsedMs += dt;
      const frameDurationMs = 1000 / this.fps;
      // while (no if): si dt fue grande (pestaña en background, lag) esto
      // avanza los frames que corresponda en vez de trabarse en uno solo.
      while (this._elapsedMs >= frameDurationMs) {
        this._elapsedMs -= frameDurationMs;
        this.frameIndex++;
        if (this.frameIndex >= this.frames.length) {
          if (this.loop) {
            this.frameIndex = 0;
          } else {
            this.frameIndex = this.frames.length - 1;
            this.finished = true;
            if (this.onComplete) this.onComplete();
            break;
          }
        }
      }
    }
    get currentFrame() { return this.frames[this.frameIndex]; }
  }

  // Animator = varias Animation con nombre ("idle","walk","attack",...)
  // más el control de cuál está sonando ahora — esto es lo que en general
  // va a guardar cada entidad, no una Animation suelta.
  //
  // Uso:
  //   const anim = new Engine2D.Animator({
  //     idle:   new Engine2D.Animation({ frames: ['idle_0','idle_1'], fps: 4 }),
  //     walk:   new Engine2D.Animation({ frames: ['walk_0','walk_1','walk_2','walk_3'], fps: 10 }),
  //     attack: new Engine2D.Animation({ frames: ['atk_0','atk_1','atk_2'], fps: 14, loop: false, next: 'idle' }),
  //     hurt:   new Engine2D.Animation({ frames: ['hurt_0'], fps: 6, loop: false, next: 'idle' }),
  //     death:  new Engine2D.Animation({ frames: ['death_0','death_1','death_2'], fps: 8, loop: false }),
  //   }, 'idle');
  //
  //   // en el update de la entidad:
  //   anim.play(moving ? 'walk' : 'idle');   // no reinicia si ya estaba en esa
  //   anim.update(dt);
  //
  //   // al atacar (ej. al tocar el botón de ataque):
  //   anim.play('attack', true); // force:true para que SIEMPRE arranque de 0
  //
  //   // en el draw:
  //   Engine2D.drawAtlasFrame(ctx, img, atlas, anim.frameName, x, y, h, facing < 0);
  class Animator {
    constructor(animations = {}, initial = null) {
      this.animations = animations; // { nombre: Animation }
      this.current = null;
      this.currentName = null;
      if (initial) this.play(initial, true);
    }
    // Cambia a la animación `name`. Por default, si ya está reproduciendo
    // esa misma animación NO la reinicia — evita el típico bug de "el
    // personaje tiembla" al llamar play('walk') en cada frame mientras
    // caminás. Pasar force:true cuando sí hace falta arrancar de cero
    // (un ataque nuevo, un hit que interrumpe lo que sea que estuviera
    // pasando).
    play(name, force = false) {
      if (this.currentName === name && !force) return;
      const anim = this.animations[name];
      if (!anim) return; // nombre inválido: no rompe, simplemente no cambia nada
      anim.reset();
      this.current = anim;
      this.currentName = name;
    }
    // Agrega o reemplaza una animación por nombre (por si el set de
    // animaciones de una entidad no está completo desde el arranque).
    set(name, animation) { this.animations[name] = animation; }
    update(dt) {
      if (!this.current) return;
      this.current.update(dt);
      // Transición automática: si la animación actual terminó (loop:false)
      // y tiene `next` definido, salta sola sin que el juego tenga que
      // acordarse de hacerlo en el onComplete.
      if (this.current.finished && this.current.next) {
        this.play(this.current.next);
      }
    }
    get frameName() { return this.current ? this.current.currentFrame : null; }
    get finished() { return this.current ? this.current.finished : true; }
    isPlaying(name) { return this.currentName === name; }
  }

  // ─────────────────────────────────────
  // Entidad / Escena
  // ─────────────────────────────────────
  // Clase base opcional — un juego puede usar objetos planos si prefiere
  // el estilo que ya tenía rpg.js (RPG.player como objeto suelto). Sirve
  // sobre todo para juegos con varios enemigos/proyectiles a la vez, donde
  // antes había arrays sueltos (RPG.bullets, RPG.potions, ...) cada uno
  // con su propio forEach de update y de draw.
  class Entity {
    constructor(props = {}) { Object.assign(this, props); }
    update(dt, step, scene) {}
    draw(ctx, scene) {}
    // Poner en true para que Scene.update() la saque sola del array
    // (reemplaza los "RPG.bullets = RPG.bullets.filter(...)" a mano).
    dead = false;
  }

  // ─────────────────────────────────────
  // StateMachine — máquina de estados para entidades
  // ─────────────────────────────────────
  // En vez de un `if (attacking) ... else if (blocking) ... else if (hurt) ...`
  // gigante, cada estado (IDLE, WALK, ATTACK, BLOCK, HURT, DASH, DEAD...)
  // se define como { enter, update, exit } y el motor decide cuál corre.
  //
  //   const fsm = new Engine2D.StateMachine({
  //     IDLE:   { update(dt, fsm) { if (quiereMoverse) return fsm.changeTo('WALK'); } },
  //     WALK:   { update(dt, fsm) { mover(); if (!quiereMoverse) return fsm.changeTo('IDLE'); } },
  //     ATTACK: { enter(fsm) { fsm.timer = 0; },
  //               update(dt, fsm) { if ((fsm.timer += dt) > 300) return fsm.changeTo('IDLE'); } },
  //     HURT:   { enter(fsm) { fsm.timer = 0; },
  //               update(dt, fsm) { if ((fsm.timer += dt) > 200) return fsm.changeTo('IDLE'); } },
  //     DEAD:   { enter() { /* terminal: no se sale de acá solo */ } }
  //   }, 'IDLE', player);   // owner = la entidad que usa la máquina
  //
  //   player.fsm.update(dt);          // cada frame
  //   player.fsm.changeTo('HURT');    // cuando recibe daño, desde cualquier lado
  //   player.fsm.is('ATTACK', 'DASH');// para elegir frame de sprite / colisiones
  //
  // Dentro de enter/update/exit, `this` es la entidad dueña (owner), así que
  // se usa this.x, this.hp, etc. directo. `fsm.time` = ms en el estado actual
  // (para timers). changeTo() al MISMO estado no hace nada (no re-entra).
  // Los argumentos extra de changeTo() llegan a enter()/exit(); los de
  // update() llegan al update() del estado.
  class StateMachine {
    constructor(states = {}, initial = null, owner = null) {
      this.states = states;
      this.owner = owner;
      this.current = null;
      this.time = 0;
      if (initial) this.changeTo(initial);
    }

    get name() { return this.current; }

    // Cambia de estado: ejecuta exit() del anterior y enter() del nuevo.
    changeTo(name, ...args) {
      if (name === this.current) return this;
      const prev = this.current;
      if (prev && this.states[prev] && this.states[prev].exit) {
        this.states[prev].exit.call(this.owner, this, ...args);
      }
      this.current = name;
      this.time = 0;
      const st = this.states[name];
      if (st && st.enter) st.enter.call(this.owner, this, ...args);
      return this;
    }

    // Avanza el estado actual. Llamar UNA vez por frame con el dt del
    // GameLoop (ms). Los argumentos extra pasan al update del estado.
    update(dt, ...args) {
      this.time += dt;
      const st = this.states[this.current];
      if (st && st.update) st.update.call(this.owner, dt, this, ...args);
      return this;
    }

    // ¿Está en alguno de estos estados? is('IDLE') / is('ATTACK', 'DASH')
    is(...names) { return names.includes(this.current); }

    // Alias por si se prefiere setState en lugar de changeTo.
    setState(name, ...args) { return this.changeTo(name, ...args); }
  }

  // ─────────────────────────────────────
  // Trigger zones — zonas invisibles que ejecutan algo cuando algo entra
  // ─────────────────────────────────────
  // Pensadas para juegos por habitaciones (Castle Escape): "ENTRA → aparece
  // enemigo / cambia habitación / inicia diálogo / activa trampa / termina
  // nivel". La zona es un AABB invisible; el motor detecta entrada/salida
  // contra las entidades que se le pasan (por lo general el jugador) y
  // dispara los callbacks. Con config.debug = true se dibujan.
  //
  //   const zone = new Engine2D.TriggerZone(160, 0, 40, 270, {
  //     id: 'spawn1',
  //     once: true,
  //     onEnter(player) {
  //       spawnEnemy();
  //       Engine2D.Particles.explosion(player.x, player.y);
  //     },
  //     onExit(player) { /* ... */ }
  //   });
  //   triggers.add(zone);                 // o triggers.add({x,y,w,h,onEnter...})
  //   triggers.update(player);            // cada frame (una entidad o un array)
  //   triggers.draw(ctx, camera);         // solo debug / visualización
  //
  // Opciones: once (se desactiva sola tras el primer onEnter), enabled
  // (arranca apagada), id (etiqueta para el debug), color/borderColor.
  class TriggerZone {
    constructor(x, y, w, h, opts = {}) {
      this.x = x; this.y = y; this.w = w; this.h = h;
      this.id = opts.id || null;
      this.onEnter = typeof opts.onEnter === 'function' ? opts.onEnter : null;
      this.onExit = typeof opts.onExit === 'function' ? opts.onExit : null;
      this.once = !!opts.once;
      this.enabled = opts.enabled !== false;
      this.inside = new Set();   // entidades dentro ahora mismo (para onExit)
      this.color = opts.color || 'rgba(0,200,255,0.22)';
      this.borderColor = opts.borderColor || 'rgba(0,200,255,0.9)';
    }

    // targets: una entidad (con x,y,w,h) o un array de entidades.
    update(targets) {
      if (!this.enabled) return;
      const list = Array.isArray(targets) ? targets : [targets];
      for (const e of list) {
        if (!e || e.dead) continue;
        const inside = e.x < this.x + this.w && e.x + e.w > this.x &&
                       e.y < this.y + this.h && e.y + e.h > this.y;
        const was = this.inside.has(e);
        if (inside && !was) {
          this.inside.add(e);
          if (this.onEnter) this.onEnter(e, this);
          if (this.once) this.enabled = false;
        } else if (!inside && was) {
          this.inside.delete(e);
          if (this.onExit) this.onExit(e, this);
        }
      }
    }

    // Dibuja la zona (solo para debug / visualización de la zona).
    draw(ctx, camera) {
      if (!this.enabled) return;
      ctx.save();
      if (camera) {
        ctx.translate(-camera.x, -camera.y);
        if (camera.zoom !== 1) {
          const cx = camera.x + camera.width / 2;
          const cy = camera.y + camera.height / 2;
          ctx.translate(cx, cy);
          ctx.scale(camera.zoom, camera.zoom);
          ctx.translate(-cx, -cy);
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.strokeStyle = this.borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(this.x, this.y, this.w, this.h);
      if (this.id) {
        ctx.fillStyle = this.borderColor;
        ctx.font = '10px monospace';
        ctx.fillText(this.id, this.x + 3, this.y + 11);
      }
      ctx.restore();
    }
  }

  // Gestor simple de zonas por juego/escena.
  const Triggers = {
    zones: [],
    // add(zona) o add({x,y,w,h,onEnter...}) — en el segundo caso construye
    // la TriggerZone sola. Devuelve la zona creada.
    add(z) {
      const zone = z instanceof TriggerZone
        ? z
        : new TriggerZone(z.x || 0, z.y || 0, z.w || 0, z.h || 0, z);
      this.zones.push(zone);
      return zone;
    },
    remove(z) {
      const i = this.zones.indexOf(z);
      if (i >= 0) this.zones.splice(i, 1);
      return z;
    },
    clear() { this.zones.length = 0; },
    update(targets) { for (const z of this.zones) z.update(targets); },
    draw(ctx, camera) { for (const z of this.zones) z.draw(ctx, camera); },
    get count() { return this.zones.length; }
  };

  class Scene {
    constructor(opts = {}) {
      this.entities = [];
      this.config = opts.config || {};
      this.physics = opts.physics || null; // Engine2D.Physics.create(config) si se quiere
      this.triggers = opts.triggers || null;
      this.debug = !!this.config.debug;
    }
    add(entity) { this.entities.push(entity); return entity; }
    remove(entity) {
      const i = this.entities.indexOf(entity);
      if (i >= 0) this.entities.splice(i, 1);
    }
    clear() { this.entities.length = 0; }
    update(dt, step) {
      this.entities.forEach(e => e.update(dt, step, this));
      // Zonas de trigger (aparece enemigo, cambia habitación, activa trampa...)
      if (this.triggers) this.triggers.update(this.entities);
      // Limpieza de entidades muertas (bala que salió de pantalla,
      // proyectil que impactó, etc) — un solo lugar en vez de repetirlo
      // por cada array como pasaba en rpg.js.
      this.entities = this.entities.filter(e => !e.dead);
    }
    draw(ctx) { this.entities.forEach(e => e.draw(ctx, this)); }
    // Filtra por un campo, ej: scene.byType('bullet')
    byType(type) { return this.entities.filter(e => e.type === type); }

    // Overlay de debug cuando config.debug = true: panel con FPS + valores
    // del config, hitboxes de las entidades y zonas de trigger. Llamar
    // después del draw() normal.
    drawDebug(ctx, camera, extra = {}) {
      drawDebugOverlay(ctx, {
        camera,
        config: this.config,
        hitboxes: this.entities,
        triggers: this.triggers ? this.triggers.zones : null,
        fps: extra.fps,
        lines: extra.lines || []
      });
    }
  }

  // ─────────────────────────────────────
  // TileMap — mundo en grilla (tipo Terraria/plataformas)
  // ─────────────────────────────────────
  // data: array plano de largo cols*rows, un id numérico por celda.
  // 0 = aire (vacío) por convención — cualquier otro id se busca en el
  // tileset. solidIds: Set de ids que bloquean movimiento (ej. tierra,
  // piedra sí; una antorcha de fondo no).
  class TileMap {
    constructor({ cols, rows, tileSize, tilesetSrc, tilesetCols, solidIds = new Set(), data = null }) {
      this.cols = cols;
      this.rows = rows;
      this.tileSize = tileSize;
      this.tilesetSrc = tilesetSrc;   // src ya cargado con Engine2D.loadImage
      this.tilesetCols = tilesetCols; // columnas del tileset (grilla uniforme, id-1 = índice)
      this.solidIds = solidIds;
      this.data = data || new Uint16Array(cols * rows); // 0 = aire
    }

    inBounds(col, row) {
      return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
    }

    get(col, row) {
      if (!this.inBounds(col, row)) return 0;
      return this.data[row * this.cols + col];
    }

    set(col, row, id) {
      if (!this.inBounds(col, row)) return;
      this.data[row * this.cols + col] = id;
    }

    isSolidAt(col, row) {
      return this.solidIds.has(this.get(col, row));
    }

    // Coordenadas de mundo (px) → celda de la grilla.
    worldToTile(x, y) {
      return { col: Math.floor(x / this.tileSize), row: Math.floor(y / this.tileSize) };
    }

    // Celda → esquina superior-izquierda en coordenadas de mundo (px).
    tileToWorld(col, row) {
      return { x: col * this.tileSize, y: row * this.tileSize };
    }

    // AABB en mundo de una celda — usado por la física para resolver colisiones.
    tileWorldBox(col, row) {
      return { x: col * this.tileSize, y: row * this.tileSize, w: this.tileSize, h: this.tileSize };
    }

    // Picar: vacía la celda y devuelve el id que había (para sumarlo al
    // inventario). Si ya estaba vacía devuelve 0.
    breakTile(col, row) {
      const id = this.get(col, row);
      if (id !== 0) this.set(col, row, 0);
      return id;
    }

    // Colocar: solo si la celda está vacía (no pisa un bloque existente).
    // Devuelve true si colocó.
    placeTile(col, row, id) {
      if (!this.inBounds(col, row)) return false;
      if (this.get(col, row) !== 0) return false;
      this.set(col, row, id);
      return true;
    }

    // Dibuja solo los tiles visibles dentro del viewport de la cámara
    // (nunca el mundo entero) — clave para que un mundo grande no reviente
    // el rendimiento. Requiere el tileset ya cargado (Engine2D.getImage).
    draw(ctx, camera) {
      const img = getImage(this.tilesetSrc);
      if (!img) return;
      const ts = this.tileSize;
      const colStart = Math.max(0, Math.floor(camera.x / ts));
      const colEnd = Math.min(this.cols - 1, Math.ceil((camera.x + camera.width) / ts));
      const rowStart = Math.max(0, Math.floor(camera.y / ts));
      const rowEnd = Math.min(this.rows - 1, Math.ceil((camera.y + camera.height) / ts));

      for (let row = rowStart; row <= rowEnd; row++) {
        for (let col = colStart; col <= colEnd; col++) {
          const id = this.get(col, row);
          if (id === 0) continue; // aire, no dibuja nada
          const tileIndex = id - 1; // id 1 = primer tile del tileset
          const sx = (tileIndex % this.tilesetCols) * ts;
          const sy = Math.floor(tileIndex / this.tilesetCols) * ts;
          const dx = col * ts - camera.x;
          const dy = row * ts - camera.y;
          ctx.drawImage(img, sx, sy, ts, ts, Math.round(dx), Math.round(dy), ts, ts);
        }
      }
    }
  }

  // ─────────────────────────────────────
  // Camera — sigue a un objetivo y traduce mundo → pantalla
  // ─────────────────────────────────────
  // x,y = esquina superior-izquierda del viewport, en coordenadas de mundo.
  // width,height = tamaño del viewport (normalmente C.width / C.height).
  // worldWidth/worldHeight = límites del mundo, para no mostrar "fuera del
  // mapa" en los bordes (clamp automático). Si necesitás límites que no
  // arrancan en (0,0) o más chicos que el mapa entero (ej: la arena de un
  // jefe), usá setBounds() — pisa el clamp de worldWidth/worldHeight.
  //
  // Seguimiento:
  //   follow(x,y)         — snap instantáneo (comportamiento de siempre, sin cambios)
  //   followSmooth(x,y)   — objetivo con suavizado (ver `smoothing`) + deadzone opcional
  //   lookAt(x,y,ms)       — paneo animado a un punto, para cinemáticas
  //   sequence([...])      — encadena zoom/lookAt/shake/esperas/callbacks
  //
  // Ejemplo típico (aparece un jefe: cámara normal → zoom → centra al jefe → combate):
  //   camera.sequence([
  //     { zoom: 1.3, duration: 500 },
  //     { lookAt: [boss.x, boss.y], duration: 600 },
  //     { wait: 300 },
  //     { call: () => beginBossCombat() },
  //   ]);
  //   // mientras camera.isBusy() sea true, no llamar a follow()/followSmooth()
  //   // (se pisarían con el paneo). Al terminar, retomar el seguimiento normal.
  class Camera {
    constructor({ x = 0, y = 0, width, height, worldWidth = Infinity, worldHeight = Infinity }) {
      this.x = x; this.y = y;
      this.width = width; this.height = height;
      this.worldWidth = worldWidth; this.worldHeight = worldHeight;
      // Zoom (1 = normal, >1 = acercar). Se anima solo con zoomTo().
      this.zoom = 1;
      this._zoomTarget = 1;
      this._zoomSpeed = 0; // por ms — 0 = sin animación en curso
      // Shake (temblor). Se dispara con shake() y decae solo.
      this._shakeIntensity = 0;
      this._shakeElapsed = 0;
      this._shakeDuration = 0;
      this._shakeOffsetX = 0;
      this._shakeOffsetY = 0;

      // Límites explícitos opcionales — ver setBounds(). null = usar el
      // clamp de siempre contra worldWidth/worldHeight.
      this._bounds = null; // {minX, minY, maxX, maxY}

      // Suavizado para followSmooth() — 0 = corte instantáneo, 0.85-0.95 =
      // bien "amortiguado", 0.6-0.8 = sutil. No afecta a follow().
      this.smoothing = 0;

      // Deadzone para followSmooth() — {width,height} en px de mundo,
      // rectángulo centrado en la cámara donde el objetivo puede moverse
      // sin que la cámara reaccione. null = sin deadzone (sigue siempre).
      this.deadzone = null;
      this._followX = null;
      this._followY = null;

      // lookAt() en curso (paneo animado independiente de follow/followSmooth).
      this._panTargetX = null;
      this._panTargetY = null;
      this._panSpeedX = 0;
      this._panSpeedY = 0;

      // Cola de transición/cinemática — ver sequence().
      this._queue = [];
      this._queueStep = null;
      this._queueElapsed = 0;
    }

    // Centra la cámara en (targetX, targetY) — normalmente el centro del
    // jugador — y la clampea para que no muestre fuera del mundo.
    // Sin cambios de comportamiento: sigue siendo un snap instantáneo.
    follow(targetX, targetY) {
      this.x = targetX - this.width / 2;
      this.y = targetY - this.height / 2;
      this._clamp();
    }

    // Clamp compartido por follow()/followSmooth()/lookAt(). Si se configuró
    // setBounds(), usa esos límites explícitos; si no, el clamp de siempre
    // contra worldWidth/worldHeight (comportamiento previo intacto).
    _clamp() {
      if (this._bounds) {
        const { minX, minY, maxX, maxY } = this._bounds;
        const camMaxX = Math.max(minX, maxX - this.width);
        const camMaxY = Math.max(minY, maxY - this.height);
        this.x = Math.max(minX, Math.min(this.x, camMaxX));
        this.y = Math.max(minY, Math.min(this.y, camMaxY));
      } else {
        const maxX = Math.max(0, this.worldWidth - this.width);
        const maxY = Math.max(0, this.worldHeight - this.height);
        this.x = Math.max(0, Math.min(this.x, maxX));
        this.y = Math.max(0, Math.min(this.y, maxY));
      }
    }

    // Límites explícitos en coordenadas de mundo — para zonas/arenas que no
    // arrancan en (0,0) o son más chicas que el mapa entero (ej: encerrar
    // la cámara dentro de la arena de un jefe mientras dura el combate).
    // Llamar con null para volver a clampear contra worldWidth/worldHeight.
    setBounds(minX, minY, maxX, maxY) {
      this._bounds = (minX == null) ? null : { minX, minY, maxX, maxY };
    }

    // Seguimiento con suavizado + deadzone opcional. A diferencia de
    // follow(), no mueve la cámara al toque: guarda el objetivo y es
    // update(dt) quien la va acercando cuadro a cuadro (igual que ya hace
    // con shake/zoom). Llamar todos los frames mientras se quiera seguir
    // al jugador, en vez de follow().
    followSmooth(targetX, targetY) {
      this._followX = targetX;
      this._followY = targetY;
    }

    // Paneo animado hacia un punto de mundo en durationMs — para
    // cinemáticas ("la cámara se va sola a mirar al jefe"). No depende de
    // follow()/followSmooth(): mientras haya un lookAt() en curso, este pisa
    // la posición cuadro a cuadro (no llamar a follow()/followSmooth() en
    // simultáneo). instant=true salta directo, como follow() pero sin tocar
    // el objetivo de followSmooth().
    lookAt(targetX, targetY, durationMs = 500, instant = false) {
      const destX = targetX - this.width / 2;
      const destY = targetY - this.height / 2;
      if (instant || durationMs <= 0) {
        this.x = destX; this.y = destY;
        this._clamp();
        this._panTargetX = null; this._panTargetY = null;
        return;
      }
      this._panTargetX = destX;
      this._panTargetY = destY;
      this._panSpeedX = (destX - this.x) / durationMs;
      this._panSpeedY = (destY - this.y) / durationMs;
    }

    // Transición entre "modos" de cámara: encadena pasos que se ejecutan
    // uno después del otro, avanzando en update(dt). Cada paso es un objeto
    // con UNA de estas claves:
    //   { zoom: 1.3, duration: 500 }        — como zoomTo()
    //   { lookAt: [x, y], duration: 500 }   — como lookAt()
    //   { shake: [intensity, duration] }    — como shake()
    //   { wait: 300 }                       — pausa sin hacer nada
    //   { smoothing: 0.9 }                  — cambia this.smoothing (instantáneo)
    //   { deadzone: {width,height} | null } — cambia this.deadzone (instantáneo)
    //   { call: () => { ... } }             — callback (instantáneo), ej. para
    //                                          arrancar el combate del jefe
    // Ejemplo (cámara normal → zoom → centra al jefe → combate):
    //   camera.sequence([
    //     { zoom: 1.3, duration: 500 },
    //     { lookAt: [boss.x, boss.y], duration: 600 },
    //     { wait: 300 },
    //     { call: () => beginBossCombat() },
    //   ]);
    sequence(steps) {
      this._queue = steps.slice();
      this._advanceQueue();
    }

    // Corta la cola de transición en seco (no revierte zoom/paneo en curso).
    stopSequence() {
      this._queue = [];
      this._queueStep = null;
      this._queueElapsed = 0;
    }

    // true mientras haya una sequence() corriendo o pendiente — útil para
    // no dejar que el jugador se mueva, o para saber cuándo retomar
    // follow()/followSmooth() después de una cinemática.
    isBusy() {
      return !!this._queueStep;
    }

    _advanceQueue() {
      this._queueStep = this._queue.shift() || null;
      this._queueElapsed = 0;
      const s = this._queueStep;
      if (!s) return;
      if (s.zoom !== undefined) this.zoomTo(s.zoom, s.duration || 400);
      else if (s.lookAt) this.lookAt(s.lookAt[0], s.lookAt[1], s.duration || 500);
      else if (s.shake) this.shake(s.shake[0], s.shake[1]);
      else if (s.smoothing !== undefined) this.smoothing = s.smoothing;
      else if (s.deadzone !== undefined) this.deadzone = s.deadzone;
      else if (s.call) s.call();
      // 'wait' no dispara nada acá — solo consume tiempo en update().
    }

    worldToScreen(x, y) { return { x: x - this.x, y: y - this.y }; }
    screenToWorld(x, y) { return { x: x + this.x, y: y + this.y }; }

    // Sacudida: un golpe de jefe, un impacto, un dash que conecta. Se
    // llama una vez al momento del golpe (ej. en rpg.js sería en el punto
    // donde hoy se activa `hitFlash`). La intensidad decae sola con el
    // tiempo, no hace falta apagarla a mano.
    // intensity: desplazamiento máximo en px. durationMs: cuánto dura.
    shake(intensity, durationMs) {
      this._shakeIntensity = intensity;
      this._shakeDuration = durationMs;
      this._shakeElapsed = 0;
    }

    // Zoom animado hacia `targetZoom` (1 = normal, 1.4 = 40% más cerca).
    // durationMs: cuánto tarda en llegar. Útil para el golpe final de un
    // jefe, o para "entrar" a una cinemática con un acercamiento lento.
    zoomTo(targetZoom, durationMs = 400) {
      this._zoomTarget = targetZoom;
      // velocidad constante en "unidades de zoom por ms" para llegar en durationMs
      const diff = targetZoom - this.zoom;
      this._zoomSpeed = durationMs > 0 ? diff / durationMs : diff;
    }

    // Llamar UNA VEZ por frame (con el dt del GameLoop) antes de dibujar —
    // hace avanzar el shake y el zoom. Sin esto, shake()/zoomTo() no hacen nada.
    update(dt) {
      // shake: decae linealmente de intensity a 0 a lo largo de duration
      if (this._shakeDuration > 0) {
        this._shakeElapsed += dt;
        if (this._shakeElapsed >= this._shakeDuration) {
          this._shakeDuration = 0;
          this._shakeOffsetX = 0; this._shakeOffsetY = 0;
        } else {
          const remaining = 1 - (this._shakeElapsed / this._shakeDuration);
          const mag = this._shakeIntensity * remaining;
          this._shakeOffsetX = (Math.random() * 2 - 1) * mag;
          this._shakeOffsetY = (Math.random() * 2 - 1) * mag;
        }
      }
      // zoom: avanza hacia el target a velocidad constante, sin pasarse
      if (this.zoom !== this._zoomTarget) {
        this.zoom += this._zoomSpeed * dt;
        const overshot = this._zoomSpeed > 0 ? this.zoom >= this._zoomTarget : this.zoom <= this._zoomTarget;
        if (overshot) this.zoom = this._zoomTarget;
      }

      // lookAt() en curso: paneo a velocidad constante hacia el destino.
      // Tiene prioridad sobre followSmooth (mientras dura, followSmooth no
      // se aplica este frame) — así una cinemática no compite con el
      // seguimiento del jugador.
      let panning = false;
      if (this._panTargetX != null) {
        panning = true;
        this.x += this._panSpeedX * dt;
        this.y += this._panSpeedY * dt;
        const doneX = this._panSpeedX >= 0 ? this.x >= this._panTargetX : this.x <= this._panTargetX;
        const doneY = this._panSpeedY >= 0 ? this.y >= this._panTargetY : this.y <= this._panTargetY;
        if (doneX) this.x = this._panTargetX;
        if (doneY) this.y = this._panTargetY;
        this._clamp();
        if (doneX && doneY) { this._panTargetX = null; this._panTargetY = null; }
      }

      // followSmooth(): lerp exponencial e independiente de dt (misma idea
      // que el "step" de dt/16.6 que ya usa el resto del motor) hacia el
      // objetivo — o hacia el borde de la deadzone si hay una configurada.
      if (!panning && this._followX != null) {
        let tx = this._followX, ty = this._followY;
        if (this.deadzone) {
          const cx = this.x + this.width / 2;
          const cy = this.y + this.height / 2;
          const halfW = this.deadzone.width / 2;
          const halfH = this.deadzone.height / 2;
          const dx = tx - cx, dy = ty - cy;
          let pushX = 0, pushY = 0;
          if (dx > halfW) pushX = dx - halfW;
          else if (dx < -halfW) pushX = dx + halfW;
          if (dy > halfH) pushY = dy - halfH;
          else if (dy < -halfH) pushY = dy + halfH;
          tx = cx + pushX;
          ty = cy + pushY;
        }
        const desiredX = tx - this.width / 2;
        const desiredY = ty - this.height / 2;
        if (this.smoothing > 0) {
          const t = 1 - Math.pow(1 - this.smoothing, dt / 16.6);
          this.x += (desiredX - this.x) * t;
          this.y += (desiredY - this.y) * t;
        } else {
          this.x = desiredX;
          this.y = desiredY;
        }
        this._clamp();
      }

      // Cola de sequence(): esperar a que termine el paso actual y pasar al
      // siguiente. zoom/lookAt/shake ya se evalúan arriba en este mismo update.
      if (this._queueStep) {
        this._queueElapsed += dt;
        const s = this._queueStep;
        let done;
        if (s.wait !== undefined) done = this._queueElapsed >= s.wait;
        else if (s.zoom !== undefined) done = this.zoom === this._zoomTarget;
        else if (s.lookAt) done = this._panTargetX == null;
        else if (s.shake) done = this._shakeDuration === 0;
        else done = true; // call/smoothing/deadzone son instantáneos
        if (done) this._advanceQueue();
      }
    }

    // Atajo para dibujar entidades (que ya asumen coordenadas de mundo)
    // sin que cada una tenga que restar camera.x/y a mano: envolvé el
    // dibujo de la escena entre begin()/end(). Aplica zoom (centrado en
    // el viewport) y el offset de shake, además del desplazamiento normal.
    begin(ctx) {
      ctx.save();
      if (this.zoom !== 1) {
        const cx = this.width / 2, cy = this.height / 2;
        ctx.translate(cx, cy);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-cx, -cy);
      }
      ctx.translate(
        -Math.round(this.x - this._shakeOffsetX),
        -Math.round(this.y - this._shakeOffsetY)
      );
    }
    end(ctx) { ctx.restore(); }
  }

  // ─────────────────────────────────────
  // Physics — gravedad + colisión AABB contra el TileMap
  // ─────────────────────────────────────
  // Convención: la entidad usa x,y como esquina superior-izquierda de su
  // caja de colisión (no "pies" como en drawFrame) — w,h su tamaño, y
  // vx,vy su velocidad en px/step. Es la convención estándar para física
  // de plataformas; si tu sprite se dibuja anclado en los pies, restale
  // el offset al dibujar (no acá).
  const Physics = {
    gravity: 0.6,       // px/step² — ajustar según qué tan "flotante" se sienta el salto
    maxFallSpeed: 12,    // px/step — terminal velocity, evita atravesar tiles finos a alta velocidad

    // Física ligada a un config (por juego o por nivel). Cada juego puede
    // tener su gravedad/velocidad sin pisar el singleton global:
    //   const physics = Engine2D.Physics.create(config);
    //   physics.applyGravity(player, step);
    // Crea un objeto que hereda los métodos y solo sobreescribe los valores
    // del config (gravity, maxFallSpeed).
    create(config = {}) {
      return Object.assign(Object.create(this), {
        gravity: config.gravity ?? this.gravity,
        maxFallSpeed: config.maxFallSpeed ?? this.maxFallSpeed
      });
    },

    applyGravity(entity, step) {
      entity.vy = Math.min(entity.vy + this.gravity * step, this.maxFallSpeed);
    },

    // Mueve la entidad y resuelve colisión contra tilemap, eje por eje
    // (primero X, después Y) — separar los ejes evita que se "trabe" en
    // esquinas, que es el bug clásico de resolver todo junto.
    // Al terminar, entity.grounded queda en true si tocó piso este step
    // (usalo para permitir saltar solo si está parado).
    resolveTileCollisions(entity, tilemap) {
      const ts = tilemap.tileSize;

      // ── Eje X ──
      entity.x += entity.vx;
      this._forEachOverlappingSolid(entity, tilemap, (tileBox) => {
        if (entity.vx > 0) entity.x = tileBox.x - entity.w;
        else if (entity.vx < 0) entity.x = tileBox.x + tileBox.w;
        entity.vx = 0;
      });

      // ── Eje Y ──
      entity.y += entity.vy;
      entity.grounded = false;
      this._forEachOverlappingSolid(entity, tilemap, (tileBox) => {
        if (entity.vy > 0) { entity.y = tileBox.y - entity.h; entity.grounded = true; }
        else if (entity.vy < 0) { entity.y = tileBox.y + tileBox.h; }
        entity.vy = 0;
      });
    },

    // Recorre las celdas sólidas que se superponen con la caja actual de
    // la entidad y llama cb(tileBox) por cada una, re-chequeando la caja
    // después de cada corrección (para no dejar overlap residual).
    _forEachOverlappingSolid(entity, tilemap, cb) {
      const ts = tilemap.tileSize;
      let changed = true;
      let guard = 0; // corta si algo queda inconsistente, nunca debería llegar
      while (changed && guard < 8) {
        changed = false;
        guard++;
        const colStart = Math.floor(entity.x / ts);
        const colEnd = Math.floor((entity.x + entity.w - 0.01) / ts);
        const rowStart = Math.floor(entity.y / ts);
        const rowEnd = Math.floor((entity.y + entity.h - 0.01) / ts);
        for (let row = rowStart; row <= rowEnd && !changed; row++) {
          for (let col = colStart; col <= colEnd && !changed; col++) {
            if (!tilemap.isSolidAt(col, row)) continue;
            cb(tilemap.tileWorldBox(col, row));
            changed = true; // recalcula rango de celdas con la posición ya corregida
          }
        }
      }
    }
  };

  // ─────────────────────────────────────
  // Collisions — entidad contra entidad (jugador↔enemigo, bala↔enemigo,
  // pickup↔jugador, etc). Para colisión contra el mundo/tilemap usar
  // Physics.resolveTileCollisions de arriba — esto es solo para pares de
  // entidades sueltas, sin resolver empuje ni física, solo "¿se tocan?".
  // ─────────────────────────────────────
  //
  // Convención de formas (mismos nombres de campo en toda la clase):
  //   Rectángulo (AABB): { x, y, w, h } — x,y = esquina superior-izquierda
  //                       (misma convención que Physics/TileMap/Entity).
  //   Círculo:            { x, y, r }    — x,y = CENTRO (no esquina), r = radio.
  // Cualquier entidad del juego (jugador, bala, enemigo...) sirve tal cual
  // como "forma" siempre que tenga esos campos — no hace falta envolverla
  // en un objeto aparte.
  const Collisions = {
    // Rectángulo vs rectángulo.
    rectOverlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x &&
             a.y < b.y + b.h && a.y + a.h > b.y;
    },

    // Círculo vs círculo.
    circleOverlap(a, b) {
      const dx = a.x - b.x, dy = a.y - b.y;
      const rr = a.r + b.r;
      return (dx * dx + dy * dy) <= rr * rr;
    },

    // Círculo vs rectángulo (ej. una bala redonda contra la caja de un
    // enemigo) — busca el punto del rect más cercano al centro del
    // círculo y mide distancia contra eso.
    circleRectOverlap(circle, rect) {
      const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
      const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
      const dx = circle.x - closestX, dy = circle.y - closestY;
      return (dx * dx + dy * dy) <= circle.r * circle.r;
    },

    // Detección genérica: infiere el tipo de cada forma por sus campos
    // (tiene `.r` → círculo; si no → rectángulo AABB) así no hay que
    // acordarse de llamar rectOverlap/circleOverlap/circleRectOverlap a
    // mano según el caso — esto es lo que en general conviene usar.
    //   Engine2D.Collisions.overlap(player, enemy)
    //   Engine2D.Collisions.overlap(bullet, enemy)   // bullet con {x,y,r}
    overlap(a, b) {
      const aCircle = a.r != null, bCircle = b.r != null;
      if (aCircle && bCircle) return this.circleOverlap(a, b);
      if (aCircle && !bCircle) return this.circleRectOverlap(a, b);
      if (!aCircle && bCircle) return this.circleRectOverlap(b, a);
      return this.rectOverlap(a, b);
    },

    // Recorre listA × listB (cualquiera de las dos puede ser una sola
    // entidad suelta, no hace falta envolverla en array) y llama cb(a, b)
    // por cada par que se superpone. Saltea automáticamente entidades ya
    // marcadas .dead (para no procesar un choque contra algo que la
    // propia Scene va a sacar al final de este frame) y el caso a === b.
    //
    //   Engine2D.Collisions.forEachOverlap(bullets, enemies, (bullet, enemy) => {
    //     enemy.hp -= bullet.damage;
    //     bullet.dead = true;
    //   });
    //   Engine2D.Collisions.forEachOverlap(player, enemies, (player, enemy) => {
    //     player.hp -= enemy.damage;
    //   });
    forEachOverlap(listA, listB, cb) {
      const arrA = Array.isArray(listA) ? listA : [listA];
      const arrB = Array.isArray(listB) ? listB : [listB];
      for (const a of arrA) {
        if (a.dead) continue;
        for (const b of arrB) {
          if (b === a || b.dead) continue;
          if (this.overlap(a, b)) cb(a, b);
        }
      }
    },

    // Distancia entre dos puntos/centros {x,y} — útil para rangos de
    // ataque circulares o IA de enemigos ("si distance(this, player) < 40
    // atacar") sin tener que armar un objeto {r} truco para eso.
    distance(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  // ─────────────────────────────────────
  // TouchControls — joystick/botones DENTRO del canvas (no HTML aparte)
  // ─────────────────────────────────────
  // A diferencia de los controles de RPG Pixel/Pixel Runner (botones HTML
  // reales, afuera del canvas, con onpointerdown en el markup), esto dibuja
  // los controles como parte de la escena — para juegos donde el mundo
  // ocupa toda la pantalla y no hay lugar (o no queda bien) tener HTML
  // superpuesto. Van fijos en coordenadas del canvas (no de mundo — no se
  // mueven con la cámara).
  //
  // Uso:
  //   const touch = new Engine2D.TouchControls(canvas, { logicalWidth: 480, logicalHeight: 270 });
  //   touch.addJoystick({ id: 'move', x: 55, y: 210, radius: 32, color: '74,222,128' });
  //   touch.addButton({ id: 'jump', x: 430, y: 210, radius: 22, label: '⬆' });
  //   touch.attach();
  //   // en el update: const dir = touch.state.move; // {x,y} entre -1 y 1
  //   //               if (touch.state.jump) { ... }
  //   // en el draw (después de dibujar el mundo, encima de todo):
  //   touch.draw(ctx);
  //
  // logicalWidth/logicalHeight: pasalos SIEMPRE que el juego escale el
  // buffer real del canvas (canvas.width/height) por devicePixelRatio u
  // otro factor — si no, el hit-test de los toques queda desalineado
  // (compara contra el tamaño real del buffer en vez del espacio lógico
  // en el que se definieron x/y de cada zona). Si el canvas.width/height
  // YA es el tamaño lógico (sin reescalar), se pueden omitir.
  class TouchControls {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.zones = [];      // [{id,type,x,y,radius,label}]
      this.state = {};      // { move:{x,y}, jump:true/false, ... }
      this.visible = opts.visible !== false; // por si querés ocultarlos en desktop
      // Coordenadas en las que se definen las zonas (addJoystick/addButton)
      // y en las que se dibujan. Por defecto es el buffer real del canvas
      // (canvas.width/height) — pero si el juego escala ese buffer por
      // devicePixelRatio para verse nítido en HiDPI (canvas.width bastante
      // más grande que el tamaño lógico con el que se calcula todo lo
      // demás, ej. RPG_LOGICAL_W/H de RPG Pixel), hay que pasarle acá esas
      // dimensiones lógicas explícitas — si no, el hit-test de _canvasPos
      // queda desalineado (compara contra el buffer grande en vez del
      // espacio lógico) y los controles no responden.
      this.logicalWidth = opts.logicalWidth || null;
      this.logicalHeight = opts.logicalHeight || null;
      this._active = new Map(); // pointerId → zone
      this._onDown = this._onDown.bind(this);
      this._onMove = this._onMove.bind(this);
      this._onUp = this._onUp.bind(this);
    }

    addButton({ id, x, y, radius = 24, label = '', color = null }) {
      this.zones.push({ id, type: 'button', x, y, radius, label, color });
      this.state[id] = false;
    }

    addJoystick({ id, x, y, radius = 32, color = null }) {
      this.zones.push({ id, type: 'joystick', x, y, radius, color });
      this.state[id] = { x: 0, y: 0 };
    }

    attach() {
      this.detach();
      // pointer events en vez de touch events: cubre mouse+touch+pen igual,
      // y ya es lo que usa el resto del proyecto (onpointerdown en el HTML).
      this.canvas.addEventListener('pointerdown', this._onDown);
      this.canvas.addEventListener('pointermove', this._onMove);
      this.canvas.addEventListener('pointerup', this._onUp);
      this.canvas.addEventListener('pointercancel', this._onUp);
      this.canvas.addEventListener('pointerleave', this._onUp);
    }

    detach() {
      this.canvas.removeEventListener('pointerdown', this._onDown);
      this.canvas.removeEventListener('pointermove', this._onMove);
      this.canvas.removeEventListener('pointerup', this._onUp);
      this.canvas.removeEventListener('pointercancel', this._onUp);
      this.canvas.removeEventListener('pointerleave', this._onUp);
    }

    // El canvas se muestra escalado por CSS (ej. 480x270 interno, más
    // grande en pantalla) — hay que convertir la posición del evento a
    // coordenadas internas del canvas, si no el joystick queda desalineado
    // en cualquier pantalla que no sea exactamente la resolución interna.
    // Usa logicalWidth/Height si se pasaron (ver constructor); si no, cae
    // al tamaño real del buffer (canvas.width/height), que es correcto
    // solo cuando el juego NO escala el canvas por devicePixelRatio.
    _canvasPos(e) {
      const rect = this.canvas.getBoundingClientRect();
      const refW = this.logicalWidth || this.canvas.width;
      const refH = this.logicalHeight || this.canvas.height;
      const scaleX = refW / rect.width;
      const scaleY = refH / rect.height;
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    }

    _onDown(e) {
      if (!this.visible) return;
      const pos = this._canvasPos(e);
      for (const zone of this.zones) {
        if (this._active.has(zone.id)) continue; // ya usado por otro dedo
        const dx = pos.x - zone.x, dy = pos.y - zone.y;
        // Radio de toque más grande que el dibujado (más fácil de acertar en celular)
        if (dx * dx + dy * dy <= (zone.radius * 1.6) ** 2) {
          e.preventDefault();
          this._active.set(zone.id, { pointerId: e.pointerId, zone });
          this._updateZone(zone, pos);
          break; // un dedo activa una sola zona
        }
      }
    }

    _onMove(e) {
      for (const [id, entry] of this._active) {
        if (entry.pointerId !== e.pointerId) continue;
        e.preventDefault();
        this._updateZone(entry.zone, this._canvasPos(e));
      }
    }

    _onUp(e) {
      for (const [id, entry] of this._active) {
        if (entry.pointerId !== e.pointerId) continue;
        this._resetZone(entry.zone);
        this._active.delete(id);
      }
    }

    _updateZone(zone, pos) {
      if (zone.type === 'button') {
        this.state[zone.id] = true;
      } else if (zone.type === 'joystick') {
        let dx = pos.x - zone.x, dy = pos.y - zone.y;
        const dist = Math.hypot(dx, dy);
        if (dist > zone.radius) { dx = (dx / dist) * zone.radius; dy = (dy / dist) * zone.radius; }
        this.state[zone.id] = { x: dx / zone.radius, y: dy / zone.radius }; // normalizado -1..1
        zone._stickX = dx; zone._stickY = dy; // para dibujar
      }
    }

    _resetZone(zone) {
      if (zone.type === 'button') this.state[zone.id] = false;
      else { this.state[zone.id] = { x: 0, y: 0 }; zone._stickX = 0; zone._stickY = 0; }
    }

    // Dibujar SIEMPRE al final, después del mundo/entidades, para que
    // quede como overlay encima de todo.
    draw(ctx) {
      if (!this.visible) return;
      ctx.save();
      this.zones.forEach(zone => {
        const active = this._isZoneActive(zone);
        // zone.color: string "R,G,B" (ej. '185,28,28' para rojo) — opcional,
        // tiñe el botón/joystick para diferenciarlos a simple vista (fuego
        // rojo, bloqueo azul, etc.) en vez de que todos sean el mismo blanco
        // translúcido. Si no se pasa, cae al gris/blanco neutro de siempre.
        const rgb = zone.color || '255,255,255';
        if (zone.type === 'button') {
          // Contorno oscuro por detrás: sin esto, un botón blanco translúcido
          // se pierde contra fondos claros (cielo, nieve, etc.) — con este
          // borde queda legible encima de cualquier escena.
          ctx.beginPath();
          ctx.arc(zone.x, zone.y, zone.radius + 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0,0,0,0.45)';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb},${active ? 0.55 : 0.32})`;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = `rgba(${rgb},0.9)`;
          ctx.stroke();
          if (zone.label) {
            ctx.fillStyle = '#fff';
            ctx.font = `700 ${Math.round(zone.radius)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(zone.label, zone.x, zone.y);
          }
        } else {
          // Base fija del joystick (con el mismo contorno oscuro de contraste)
          ctx.beginPath();
          ctx.arc(zone.x, zone.y, zone.radius + 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0,0,0,0.45)';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb},0.18)`;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = `rgba(${rgb},0.55)`;
          ctx.stroke();
          // Stick — se mueve dentro de la base según el dedo
          const sx = zone.x + (zone._stickX || 0);
          const sy = zone.y + (zone._stickY || 0);
          ctx.beginPath();
          ctx.arc(sx, sy, zone.radius * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb},${active ? 0.85 : 0.55})`;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.stroke();
        }
      });
      ctx.restore();
    }

    _isZoneActive(zone) {
      for (const entry of this._active.values()) if (entry.zone === zone) return true;
      return false;
    }
  }

  // ─────────────────────────────────────
  // Fullscreen — helper chico sobre la Fullscreen API del navegador
  // ─────────────────────────────────────
  // Pedile fullscreen al contenedor del juego (ej. .rpg-container), no al
  // canvas solo — así el HUD/overlay que están afuera del canvas pero
  // adentro del contenedor siguen viéndose.
  const Fullscreen = {
    isSupported() {
      return !!(document.fullscreenEnabled ||
        document.webkitFullscreenEnabled ||
        document.msFullscreenEnabled);
    },
    isActive() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    },
    // Si ya está en fullscreen, sale; si no, entra en `el`.
    toggle(el) {
      if (this.isActive()) {
        (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)
          .call(document);
      } else {
        (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)
          .call(el);
      }
    },
    // cb() se llama cada vez que se entra o sale de fullscreen (por ejemplo
    // para cambiar el ícono del botón, o para recalcular tamaño del canvas).
    onChange(cb) {
      document.addEventListener('fullscreenchange', cb);
      document.addEventListener('webkitfullscreenchange', cb);
      document.addEventListener('MSFullscreenChange', cb);
    }
  };

  // ─────────────────────────────────────
  // DialogueBox — cinemática con retrato + texto (estilo Deltarune/Undertale)
  // ─────────────────────────────────────
  // Rectángulo fijo (en coordenadas de canvas, no de mundo) con un
  // retrato del personaje a la izquierda/arriba y texto a la derecha que
  // aparece letra por letra. Se avanza a mano llamando advance() — el
  // motor no decide con qué tecla/botón se avanza, eso lo cablea cada
  // juego (igual que ya hace con el resto del input).
  //
  // Uso:
  //   const box = new Engine2D.DialogueBox({ x: 20, y: 190, width: 440, height: 70 });
  //   box.say([
  //     { speaker: 'Junior', portraitSrc: 'assert/rpg pixel/models/junior/cara.png', text: 'Esto es peligroso...' },
  //     { speaker: 'Junior', portraitSrc: 'assert/rpg pixel/models/junior/cara.png', text: 'Pero tengo que seguir.' }
  //   ]);
  //   // en el update: box.update(dt);
  //   // en el draw, AL FINAL (encima de todo): if (box.active) box.draw(ctx);
  //   // en el input (tecla/click/botón táctil): box.advance();
  class DialogueBox {
    constructor({ x, y, width, height, portraitSize = 56, charsPerSecond = 40, font = '12px sans-serif', padding = 10 }) {
      this.x = x; this.y = y; this.width = width; this.height = height;
      this.portraitSize = portraitSize;
      this.charsPerSecond = charsPerSecond;
      this.font = font;
      this.padding = padding;

      this.queue = [];       // líneas pendientes, cada una {text, speaker, portraitSrc}
      this.current = null;   // línea que se está mostrando ahora
      this.visibleChars = 0; // cuántos caracteres del texto ya se revelaron (typewriter)
      this.active = false;   // false = la cinemática terminó / no empezó

      this._wrapped = null;      // líneas de `text` ya cortadas al ancho de la caja
      this._totalChars = 0;      // suma de caracteres de _wrapped (para saber cuándo terminó de tipear)
    }

    // Arranca (o reemplaza) la cola de diálogo. `lines` puede ser un solo
    // objeto {text, speaker, portraitSrc} o un array de varios, para una
    // cinemática con más de una línea seguida.
    say(lines) {
      this.queue = Array.isArray(lines) ? lines.slice() : [lines];
      this.active = true;
      this._nextLine();
    }

    _nextLine() {
      this.current = this.queue.shift() || null;
      this.visibleChars = 0;
      this._wrapped = null; // se recalcula en el próximo draw() (necesita ctx para medir texto)
      if (!this.current) this.active = false;
    }

    // Si la línea actual todavía se está tipeando, la completa de una
    // (para cuando el jugador toca "avanzar" impaciente). Si ya terminó
    // de tipearse, pasa a la siguiente línea de la cola.
    advance() {
      if (!this.active || !this.current) return;
      if (this.visibleChars < this._totalChars) {
        this.visibleChars = this._totalChars; // mostrar todo el texto ya
        return;
      }
      this._nextLine();
    }

    isTyping() {
      return this.active && this.current && this.visibleChars < this._totalChars;
    }

    update(dt) {
      if (!this.active || !this.current) return;
      if (this.visibleChars < this._totalChars) {
        this.visibleChars = Math.min(this._totalChars, this.visibleChars + (this.charsPerSecond * dt) / 1000);
      }
    }

    // Corta `text` en líneas que entren en el ancho disponible (el ancho
    // de la caja menos el retrato y el padding) — se calcula una sola vez
    // por línea de diálogo y se cachea, no en cada frame.
    _wrapText(ctx, text, maxWidth) {
      ctx.font = this.font;
      const words = text.split(' ');
      const lines = [];
      let line = '';
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      return lines;
    }

    draw(ctx) {
      if (!this.active || !this.current) return;
      const { x, y, width, height, padding, portraitSize } = this;

      // Caja de fondo
      ctx.save();
      ctx.fillStyle = 'rgba(10,10,15,0.88)';
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);

      // Retrato — arriba a la izquierda adentro de la caja, como el
      // recuadro de cara en Deltarune. Si no hay portraitSrc o todavía no
      // cargó la imagen, se deja el espacio vacío (no rompe el layout).
      // portraitRect es opcional: {x,y,w,h} para recortar una región de un
      // spritesheet de expresiones en vez de usar la imagen completa.
      const textX = x + padding + (this.current.portraitSrc ? portraitSize + padding : 0);
      if (this.current.portraitSrc) {
        const img = getImage(this.current.portraitSrc);
        if (img && img.complete) {
          const rect = this.current.portraitRect;
          if (rect) {
            ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, x + padding, y + padding, portraitSize, portraitSize);
          } else {
            ctx.drawImage(img, x + padding, y + padding, portraitSize, portraitSize);
          }
        }
      }

      // Nombre del que habla, arriba del texto
      let textY = y + padding;
      if (this.current.speaker) {
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold ' + this.font;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(this.current.speaker, textX, textY);
        textY += 16;
      }

      // Texto — se envuelve una sola vez (cacheado) y se revela letra por
      // letra según visibleChars.
      const maxTextWidth = x + width - padding - textX;
      if (!this._wrapped) {
        this._wrapped = this._wrapText(ctx, this.current.text, maxTextWidth);
        this._totalChars = this._wrapped.reduce((n, l) => n + l.length, 0);
      }
      ctx.fillStyle = '#fff';
      ctx.font = this.font;
      let remaining = Math.floor(this.visibleChars);
      for (const line of this._wrapped) {
        if (remaining <= 0) break;
        const shown = remaining >= line.length ? line : line.slice(0, remaining);
        ctx.fillText(shown, textX, textY);
        remaining -= line.length;
        textY += 16;
      }

      // Indicador de "seguir" — parpadea solo cuando ya terminó de tipear,
      // así el jugador sabe que puede avanzar (y no que está trabado).
      if (!this.isTyping()) {
        const blink = Math.sin(performance.now() / 250) > 0;
        if (blink) {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(x + width - 16, y + height - 14);
          ctx.lineTo(x + width - 8, y + height - 14);
          ctx.lineTo(x + width - 12, y + height - 8);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  return {
    // assets
    loadImage, loadAtlas, loadAll, getImage, getAtlas,
    // audio centralizado (música / efectos / ambiente)
    Audio: AudioSystem,
    // partículas — efectos visuales sin sprites
    Particles,
    // utils
    randRange, floorBounds,
    // configuración por juego + canvas ajustado + overlay de debug
    createConfig, mergeConfig, fitCanvas, drawDebugOverlay,
    // dibujo
    drawFrame, drawAtlasFrame, drawIconRect, drawCover,
    // loop / input / animación / entidades
    GameLoop, KeyboardInput, Animation, Animator, Entity, Scene, StateMachine,
    // trigger zones — zonas invisibles con onEnter/onExit
    TriggerZone, Triggers,
    // mundo tipo Terraria: tiles, cámara y física
    TileMap, Camera, Physics,
    // colisiones entidad-contra-entidad (jugador↔enemigo, bala↔enemigo, etc)
    Collisions,
    // controles táctiles dentro del canvas + pantalla completa
    TouchControls, Fullscreen,
    // cinemáticas con retrato + texto
    DialogueBox
  };
})();
