// ══════════════════════════════════════
//   Castle Escape — castle_menu_flow.js  (módulo ES6)
// ══════════════════════════════════════
// Clase CastleMenu: pantallas de menú (principal, selección de nivel,
// ajustes, cómo jugar), pantalla completa y el atajo de Enter sobre los
// overlays.
export class CastleMenu {
  constructor(juego) {
    this.juego = juego;
    this.dom = juego.dom;
    this.enterHandler = null;
    this.sincronizarPantallaCompleta = this.sincronizarPantallaCompleta.bind(this);
    document.addEventListener('fullscreenchange', this.sincronizarPantallaCompleta);
    document.addEventListener('webkitfullscreenchange', this.sincronizarPantallaCompleta);
  }

  // Enter también cierra el overlay (además de Espacio, que maneja el teclado del juego).
  engancharEnter() {
    this.soltarEnter();
    this.enterHandler = (e) => {
      if (!this.dom.section.classList.contains('active')) return;
      if (e.code !== 'Enter') return;
      if (this.dom.overlayVisible()) {
        e.preventDefault();
        this.dom.startBtn?.click();
      }
    };
    document.addEventListener('keydown', this.enterHandler);
  }

  soltarEnter() {
    if (this.enterHandler) {
      document.removeEventListener('keydown', this.enterHandler);
      this.enterHandler = null;
    }
  }

  ocultarTodo() {
    this.dom.menuViews.forEach(el => { if (el) el.classList.add('hidden'); });
  }

  // cargarNivel() pinta el fondo del castillo inline en .trampas-container
  // y un inline style le gana al CSS aunque volvamos al menú. Esto lo saca
  // para que se vea de nuevo la imagen de menú del CSS.
  restaurarFondoMenu() {
    const cont = this.dom.container;
    if (cont) cont.style.background = '';
  }

  // Oculta todo, restaura el fondo y muestra una sola pantalla.
  mostrarPantalla(el) {
    this.ocultarTodo();
    this.restaurarFondoMenu();
    el.classList.remove('hidden');
  }

  mostrarMenuPrincipal() {
    this.mostrarPantalla(this.dom.mainMenu);
    this.dom.pauseMenu.classList.add('hidden');
    this.juego.detener();
    this.juego.ponerMusica('menu_song.mp3');
  }

  mostrarSeleccionNivel() {
    this.mostrarPantalla(this.dom.levelSelect);
    this.actualizarTarjetaNivel();
  }

  mostrarAjustes() {
    this.mostrarPantalla(this.dom.settings);
    // Sincronizar los sliders con el volumen global actual
    const musicPct = Math.round((typeof getGlobalMusicVolume === 'function' ? getGlobalMusicVolume() : 0.5) * 100);
    const sfxPct = Math.round((typeof getGlobalSfxVolume === 'function' ? getGlobalSfxVolume() : 0.8) * 100);
    if (this.dom.musicVolume) this.dom.musicVolume.value = musicPct;
    if (this.dom.sfxVolume) this.dom.sfxVolume.value = sfxPct;
    this.dom.musicVolumeValue.textContent = musicPct + '%';
    this.dom.sfxVolumeValue.textContent = sfxPct + '%';
    this.sincronizarPantallaCompleta();
  }

  mostrarComoJugar() {
    this.mostrarPantalla(this.dom.howToPlay);
  }

  mostrarPantallaJuego() {
    this.ocultarTodo();
  }

  cambiarVolumenMusica(v) {
    this.dom.musicVolumeValue.textContent = v + '%';
    if (typeof setGlobalMusicVolume === 'function') setGlobalMusicVolume(v / 100);
  }

  cambiarVolumenSfx(v) {
    this.dom.sfxVolumeValue.textContent = v + '%';
    if (typeof setGlobalSfxVolume === 'function') setGlobalSfxVolume(v / 100);
  }

  // Cartel de controles dentro del juego (botón ❓ del HUD).
  alternarCartelControles() {
    const el = this.dom.controlsSign;
    if (el) el.classList.toggle('hidden');
  }

  volverASeleccionNivel() {
    this.juego.detener();
    this.juego.ponerMusica('menu_song.mp3');
    this.mostrarSeleccionNivel();
  }

  // ─── Pantalla completa (igual que Pixel Runner) ───
  elementoPantallaCompleta() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
  }

  pantallaCompletaSoportada() {
    const el = this.dom.container;
    return !!(el && (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen));
  }

  alternarPantallaCompleta() {
    const el = this.dom.container;
    if (!el) return;
    if (!this.elementoPantallaCompleta()) {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.msRequestFullscreen) el.msRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.msExitFullscreen) document.msExitFullscreen();
    }
    this.sincronizarPantallaCompleta();
  }

  sincronizarPantallaCompleta() {
    const row = this.dom.fullscreenRow;
    if (row) row.classList.toggle('unsupported', !this.pantallaCompletaSoportada());
    const btn = this.dom.fullscreenBtn;
    if (!btn) return;
    btn.textContent = this.elementoPantallaCompleta() ? 'Salir' : 'Activar';
  }

  // ─── Selección de nivel ───
  crearPuntosNiveles() {
    const dotsEl = this.dom.levelDots;
    dotsEl.innerHTML = '';
    this.juego.levels.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.className = 'trampas-level-dot';
      dot.onclick = () => { this.juego.selectedLevel = i; this.actualizarTarjetaNivel(); };
      dotsEl.appendChild(dot);
    });
  }

  actualizarTarjetaNivel() {
    const dom = this.dom;
    const levels = this.juego.levels;
    // Sin niveles cargados (todavía no se creó ninguno en el editor): aviso
    // y todo lo que dependa de un nivel real queda deshabilitado.
    if (!levels.length) {
      dom.bigLevelNum.textContent = '–';
      dom.bigLevelName.textContent = 'Sin niveles — creá uno en el Editor de Niveles';
      document.querySelectorAll('#trBigStars .star').forEach(el => el.classList.remove('earned'));
      const card0 = document.querySelector('.trampas-level-card-big');
      if (card0) card0.classList.add('locked');
      if (dom.navLeft) dom.navLeft.disabled = true;
      if (dom.navRight) dom.navRight.disabled = true;
      if (dom.levelPlayBtn) dom.levelPlayBtn.disabled = true;
      document.querySelectorAll('.trampas-level-dot').forEach(d => d.classList.remove('active'));
      return;
    }

    const i = this.juego.selectedLevel;
    const lvl = levels[i];
    const stars = this.juego.progreso.estrellasDe(i);
    const unlocked = this.juego.progreso.estaDesbloqueado(i);

    dom.bigLevelNum.textContent = (i + 1);
    dom.bigLevelName.textContent = lvl.nombre;

    document.querySelectorAll('#trBigStars .star').forEach((el, j) => {
      el.classList.toggle('earned', stars >= j + 1);
    });

    document.querySelector('.trampas-level-card-big').classList.toggle('locked', !unlocked);

    dom.navLeft.disabled = (i === 0);
    dom.navRight.disabled = (i >= levels.length - 1);
    dom.levelPlayBtn.disabled = !unlocked;

    document.querySelectorAll('.trampas-level-dot').forEach((d, j) => d.classList.toggle('active', j === i));
  }

  navegarNivel(dir) {
    const levels = this.juego.levels;
    if (!levels.length) return;
    this.juego.selectedLevel = Math.max(0, Math.min(levels.length - 1, this.juego.selectedLevel + dir));
    this.actualizarTarjetaNivel();
  }

  jugarNivelSeleccionado() {
    const juego = this.juego;
    if (!juego.levels.length) return;
    if (!juego.progreso.estaDesbloqueado(juego.selectedLevel)) return;
    // Todavía cargando sprites/atlas: no arrancar con imágenes a medio cargar.
    if (!juego.assetsReady) return;
    juego.empezarNivel(juego.selectedLevel);
  }
}
