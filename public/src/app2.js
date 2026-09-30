// UniGames — app2.js (frontend, POO)
// Modulo: clase base abstracta (enlaza los métodos a la instancia).
// Cada área de la app es un Modulo con su estado y comportamiento; App los
// compone y los arranca (app.<modulo>). App.exponerGlobales() publica sus
// métodos y estado en window para el HTML (onclick) y los juegos 2D.

class Modulo {
  constructor() {
    if (new.target === Modulo) throw new Error('Modulo es abstracta: usá una subclase');
    let proto = Object.getPrototypeOf(this);
    while (proto && proto !== Modulo.prototype) {
      for (const nombre of Object.getOwnPropertyNames(proto)) {
        if (nombre === 'constructor' || Object.prototype.hasOwnProperty.call(this, nombre)) continue;
        const d = Object.getOwnPropertyDescriptor(proto, nombre);
        if (typeof d.value === 'function') this[nombre] = d.value.bind(this);
      }
      proto = Object.getPrototypeOf(proto);
    }
  }

  // Punto de arranque del módulo (listeners, timers, etc). Las subclases lo sobrescriben.
  iniciar() {}

  // Nombres de los métodos públicos (para exponerlos al HTML)
  metodosPublicos() {
    const nombres = new Set();
    let proto = Object.getPrototypeOf(this);
    while (proto && proto !== Modulo.prototype) {
      for (const n of Object.getOwnPropertyNames(proto))
        if (n !== 'constructor' && n !== 'iniciar') nombres.add(n);
      proto = Object.getPrototypeOf(proto);
    }
    return [...nombres];
  }
}

// AuthManager — Sesión del usuario: login, registro, Google, recuperar clave y logout. (app.auth)
class AuthManager extends Modulo {
  constructor() {
    super();
    this.currentUser = null;
    this.supabaseClient = null;
    this.syncEnCurso = null; // { token, promesa } del POST /api/auth/sync en curso
  }

  iniciar() {
    fetch('/api/config')
      .then((res) => res.json())
      .then(async (data) => {
        if (data.SUPABASE_URL && data.SUPABASE_ANON_KEY && typeof supabase !== 'undefined') {
          this.supabaseClient = supabase.createClient(data.SUPABASE_URL, data.SUPABASE_ANON_KEY);

          // Suscribirse a cambios de autenticación (ej. cuando volvemos de Google OAuth)
          this.supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
              const r = await this.sincronizarSesion(session.access_token);
              if (r.ok) {
                // Limpiar la URL si venimos de un redirect de OAuth
                if (
                  window.location.hash.includes('access_token') ||
                  window.location.search.includes('google_login=true')
                ) {
                  window.history.replaceState({}, document.title, window.location.pathname);
                }
              } else {
                // (antes: res.text() después de res.json() → el body ya estaba leído y tiraba TypeError)
                this.showAuthAlert('login-alert', (r.data && r.data.error) || 'Error al sincronizar la sesión.', 'error');
                this.openModal('login');
                this.supabaseClient.auth.signOut();
              }
            } else if (event === 'SIGNED_OUT') {
              localStorage.removeItem('unigames_token');
              localStorage.removeItem('unigames_user');
              this.cambiarUsuario(null);
              this.updateAuthUI();
            }
          });
          const { data: sessionData } = await this.supabaseClient.auth.getSession();

          // If we just clicked a password reset link
          if (window.location.href.includes('reset_password=true') && sessionData.session) {
            const newPassword = prompt('Ingresá tu nueva contraseña:');
            if (newPassword) {
              const { error } = await this.supabaseClient.auth.updateUser({
                password: newPassword,
              });
              if (!error) {
                alert('¡Contraseña actualizada exitosamente! Ya podés iniciar sesión.');
                this.supabaseClient.auth.signOut();
                window.history.replaceState({}, document.title, '/');
              } else {
                alert('Hubo un error al actualizar: ' + error.message);
              }
            }
          }
        }
      })
      .catch((err) => console.error('Error cargando config de supabase:', err));

  }

  // ─── Modal login / registro ────────────
  openModal(tab) {
    app.nucleo.APP_EL.modalOverlay.classList.add('open');
    this.switchTab(tab || 'login');
  }

  closeModal() {
    app.nucleo.APP_EL.modalOverlay.classList.remove('open');
    const inputs = ['loginIdentity', 'loginPassword', 'regUsername', 'regEmail', 'regPassword'];
    inputs.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }

  switchTab(tab) {
    const isLogin = tab === 'login';
    app.nucleo.APP_EL.tabLogin.classList.toggle('active', isLogin);
    app.nucleo.APP_EL.tabRegister.classList.toggle('active', !isLogin);
    app.nucleo.APP_EL.authSectionLogin.classList.toggle('active', isLogin);
    app.nucleo.APP_EL.authSectionRegister.classList.toggle('active', !isLogin);
  }

  showAuthAlert(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = 'auth-alert ' + type + ' show';
    setTimeout(() => el.classList.remove('show'), 4000);
  }

  // Medidor de fuerza de contraseña del registro (oninput de #regPassword).
  // Es solo feedback visual: la validación real la hace el backend.
  checkPasswordStrength(value) {
    const wrap = document.getElementById('pwdStrengthWrap');
    const fill = document.getElementById('pwdStrengthFill');
    const label = document.getElementById('pwdStrengthLabel');
    if (!wrap || !fill || !label) return;
    if (!value) {
      wrap.classList.remove('show');
      return;
    }
    wrap.classList.add('show');
    let score = 0;
    if (value.length >= 6) score++;
    if (value.length >= 10) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/[0-9]/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    const niveles = [
      {
        min: 0,
        width: '20%',
        color: '#ef4444',
        texto: 'Muy débil',
      },
      {
        min: 2,
        width: '40%',
        color: '#f97316',
        texto: 'Débil',
      },
      {
        min: 3,
        width: '65%',
        color: '#eab308',
        texto: 'Media',
      },
      {
        min: 4,
        width: '85%',
        color: '#22c55e',
        texto: 'Buena',
      },
      {
        min: 5,
        width: '100%',
        color: '#16a34a',
        texto: 'Fuerte',
      },
    ];
    const nivel = [...niveles].reverse().find((n) => score >= n.min) || niveles[0];
    fill.style.width = nivel.width;
    fill.style.background = nivel.color;
    label.textContent = nivel.texto;
    label.style.color = nivel.color;
  }

  async handleLogin(e) {
    e.preventDefault();
    const identity = app.nucleo.APP_EL.loginIdentity.value.trim();
    const password = app.nucleo.APP_EL.loginPassword.value;
    if (!identity || !password) {
      return this.showAuthAlert('login-alert', 'Completá todos los campos.', 'error');
    }
    if (!this.supabaseClient)
      return this.showAuthAlert('login-alert', 'El sistema de seguridad está cargando...', 'error');
    try {
      // 1. Iniciar sesión con Supabase Auth (requiere Email, no usuario)
      const { data: supaData, error: supaError } = await this.supabaseClient.auth.signInWithPassword({
        email: identity,
        password: password,
      });
      if (supaError) {
        return this.showAuthAlert('login-alert', 'Correo o contraseña incorrectos.', 'error');
      }

      // 2. Sincronizar con nuestro backend (token local + id)
      const { ok, data } = await this.sincronizarSesion(supaData.session.access_token);
      if (ok) {
        this.showAuthAlert('login-alert', '¡Bienvenido, ' + data.user.username + '!', 'success');
        setTimeout(this.closeModal, 900);
      } else {
        this.showAuthAlert('login-alert', (data && data.error) || 'Error al sincronizar sesión.', 'error');
      }
    } catch (err) {
      console.error(err);
      this.showAuthAlert('login-alert', 'No se pudo conectar con el servidor.', 'error');
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const username = app.nucleo.APP_EL.regUsername.value.trim();
    const email = app.nucleo.APP_EL.regEmail.value.trim();
    const password = app.nucleo.APP_EL.regPassword.value;
    const confirm = app.nucleo.APP_EL.regConfirm.value;
    if (!username || !email || !password || !confirm) {
      return this.showAuthAlert('register-alert', 'Completá todos los campos.', 'error');
    }
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_REGEX.test(email)) {
      return this.showAuthAlert(
        'register-alert',
        'Ingresá un email válido (ej: nombre@dominio.com).',
        'error',
      );
    }
    if (password !== confirm) {
      return this.showAuthAlert('register-alert', 'Las contraseñas no coinciden.', 'error');
    }
    if (!this.supabaseClient)
      return this.showAuthAlert('register-alert', 'El sistema de seguridad está cargando...', 'error');
    try {
      // 1. Crear usuario en Supabase Auth
      const { data: supaData, error: supaError } = await this.supabaseClient.auth.signUp({
        email: email,
        password: password,
        // Si Supabase pide confirmar el email, acá no hay sesión y el /sync de
        // abajo no corre: el nombre elegido se guarda en user_metadata y el
        // backend lo toma de ahí en el primer login.
        options: { data: { username: username } },
      });
      if (supaError) {
        return this.showAuthAlert('register-alert', supaError.message, 'error');
      }
      if (!supaData.session) {
        return this.showAuthAlert(
          'register-alert',
          'Por favor, revisa tu correo electrónico para confirmar tu cuenta.',
          'success',
        );
      }

      // 2. Sincronizar con backend
      const { ok, data } = await this.sincronizarSesion(supaData.session.access_token, username);
      if (ok) {
        this.showAuthAlert('register-alert', '¡Cuenta creada exitosamente! Sesión iniciada.', 'success');
        setTimeout(this.closeModal, 1200);
      } else {
        this.showAuthAlert('register-alert', (data && data.error) || 'Error al completar el registro.', 'error');
      }
    } catch (err) {
      console.error(err);
      this.showAuthAlert('register-alert', 'No se pudo conectar con el servidor.', 'error');
    }
  }

  // POST /api/auth/sync: cambia el token de Supabase por el JWT del backend
  // y deja la sesión iniciada. Lo usan el login, el registro y el evento
  // SIGNED_IN de Supabase. Ese evento también se dispara al loguearse con
  // email, así que había DOS sync a la vez; en el registro, los dos podían
  // intentar crear el usuario y el segundo fallaba. Ahora, si ya hay un sync
  // en curso para el mismo token, se reusa esa misma promesa.
  sincronizarSesion(accessToken, username) {
    if (this.syncEnCurso && this.syncEnCurso.token === accessToken) return this.syncEnCurso.promesa;
    const promesa = (async () => {
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(username ? { supabaseToken: accessToken, username } : { supabaseToken: accessToken }),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        /* respuesta sin body */
      }
      if (res.ok) {
        this.cambiarUsuario(data.user);
        localStorage.setItem('unigames_token', data.token);
        localStorage.setItem('unigames_user', JSON.stringify(this.currentUser));
        this.updateAuthUI();
        app.logros.sincronizarLogrosConBackend();
      }
      return { ok: res.ok, status: res.status, data };
    })();
    this.syncEnCurso = { token: accessToken, promesa };
    promesa.finally(() => {
      if (this.syncEnCurso && this.syncEnCurso.promesa === promesa) this.syncEnCurso = null;
    });
    return promesa;
  }

  async handleGoogleLogin() {
    if (!this.supabaseClient)
      return this.showAuthAlert(
        'login-alert',
        'Error de conexión con seguridad. Verificá que Supabase esté configurado.',
        'error',
      );
    const { data, error } = await this.supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/?google_login=true',
      },
    });
    if (error) {
      console.error('Error con Google Login:', error);
      this.showAuthAlert('login-alert', 'No se pudo iniciar con Google.', 'error');
    }
  }

  openRecoverModal() {
    document.getElementById('recoverOverlay').classList.add('open');
    document.getElementById('recoverEmail').value = '';
    document.getElementById('recover-alert').style.display = 'none';
    this.closeModal();
  }

  closeRecoverModal() {
    document.getElementById('recoverOverlay').classList.remove('open');
  }

  async submitRecoverPassword(e) {
    e.preventDefault();
    const identity = document.getElementById('recoverEmail').value.trim();
    const btn = document.getElementById('recoverSubmitBtn');
    if (!identity) {
      return this.showAuthAlert('recover-alert', 'Por favor ingresá tu correo electrónico.', 'error');
    }
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_REGEX.test(identity)) {
      return this.showAuthAlert('recover-alert', 'Ingresá un correo electrónico válido.', 'error');
    }
    if (!this.supabaseClient)
      return this.showAuthAlert(
        'recover-alert',
        'Error de conexión con seguridad. Verifica que supabase este configurado.',
        'error',
      );
    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span>Verificando...</span>';
    try {
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: identity,
        }),
      });
      if (checkRes.ok) {
        const data = await checkRes.json();
        if (!data.exists) {
          btn.disabled = false;
          btn.innerHTML = originalHtml;
          return this.showAuthAlert('recover-alert', 'Correo o cuenta no registrada.', 'error');
        }
      } else {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        return this.showAuthAlert(
          'recover-alert',
          'El servidor aún se está actualizando. Intenta de nuevo en unos segundos.',
          'error',
        );
      }
    } catch (err) {
      console.error('Error verificando email:', err);
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      return this.showAuthAlert('recover-alert', 'Error de conexión. Intenta de nuevo.', 'error');
    }
    btn.innerHTML = '<span>Enviando...</span>';
    const { data, error } = await this.supabaseClient.auth.resetPasswordForEmail(identity, {
      redirectTo: window.location.origin + '/?reset_password=true',
    });
    if (error) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      return this.showAuthAlert(
        'recover-alert',
        'Error al enviar el correo. Límite excedido o correo inválido.',
        'error',
      );
    }
    this.showAuthAlert('recover-alert', '¡Enviado! Revisa tu bandeja de entrada o spam.', 'success');
    let secondsLeft = 10;
    btn.innerHTML = '<span>Reenviar en ' + secondsLeft + 's</span>';
    const timerId = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        clearInterval(timerId);
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      } else {
        btn.innerHTML = '<span>Reenviar en ' + secondsLeft + 's</span>';
      }
    }, 1000);
  }

  updateAuthUI() {
    const drawerBody = app.nucleo.APP_EL.accountDrawerBody;
    const toggleBtn = app.nucleo.APP_EL.accountToggle;
    if (toggleBtn) {
      if (this.currentUser) {
        // Mismo campo y mismo default que ya usa Perfil/Amigos (PERFIL_ICONO_DEFAULT)
        // — "avatar" no existe en el usuario, el campo real es "icono".
        const icono = this.currentUser.icono || PerfilManager.PERFIL_ICONO_DEFAULT;
        toggleBtn.innerHTML = `<img class="account-avatar-img" src="${icono}" alt="${app.utils.sanitizeHTML(this.currentUser.username)}">`;
        toggleBtn.title = this.currentUser.username;
      } else {
        toggleBtn.innerHTML =
          '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.34 0-10 1.68-10 5v1c0 .55.45 1 1 1h18c.55 0 1-.45 1-1v-1c0-3.32-6.66-5-10-5z"/></svg>';
        toggleBtn.title = 'Mi cuenta';
        toggleBtn.classList.remove('has-notif'); // sin sesión no hay notificaciones que mostrar
      }
    }
    if (!drawerBody) return;
    if (this.currentUser) {
      drawerBody.innerHTML = `
        <div class="account-greeting">Hola, ${app.utils.sanitizeHTML(this.currentUser.username)}</div>
        ${this.currentUser.rol === 'admin' ? '<button class="account-drawer-btn" onclick="closeAccountDrawer(); openAdminModal();"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg><span class="account-drawer-btn-label">Panel Admin</span></button>' : ''}
        <button class="account-drawer-btn" onclick="closeAccountDrawer(); abrirPerfilPropio();"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg><span class="account-drawer-btn-label">Perfil</span></button>
        <button class="account-drawer-btn" onclick="closeAccountDrawer(); openNotifModal();" style="justify-content: space-between;"><span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg><span class="account-drawer-btn-label">Notificaciones</span></span><span id="notifDrawerBadge"></span></button>
        <button class="account-drawer-btn" onclick="closeAccountDrawer(); goTo('puntuacion');"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg><span class="account-drawer-btn-label">Puntuación</span></button>
        <button class="account-drawer-btn" onclick="closeAccountDrawer(); goTo('amigos');"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg><span class="account-drawer-btn-label">Amigos</span></button>
        <button class="account-drawer-btn" onclick="closeAccountDrawer(); goTo('logros');"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg><span class="account-drawer-btn-label">Logros</span></button>
        <button class="account-drawer-btn btn-logout" onclick="logout()"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg><span class="account-drawer-btn-label">Cerrar sesión</span></button>
      `;
      app.notificaciones.actualizarBadgeNotificaciones();
    } else {
      drawerBody.innerHTML = `
        <button class="account-drawer-btn btn-login-drawer" onclick="closeAccountDrawer(); openModal('login');"><span class="account-drawer-btn-label">Iniciar sesión</span></button>
      `;
    }
  }

  // Cambia el usuario logueado. El progreso de los juegos 2D es por usuario
  // (ServiciosApp.claveUsuario): si hay un juego abierto, primero se sale a
  // Juegos para que guarde con la cuenta con la que se estaba jugando.
  cambiarUsuario(usuario) {
    const antes = this.currentUser ? this.currentUser.id : null;
    const despues = usuario ? usuario.id : null;
    if (antes !== despues) {
      const activa = document.querySelector('.section.active');
      const juegos2D = ['sec-runner', 'sec-castle_escape', 'sec-rpg_pixel', 'sec-pixel_survi'];
      // Un duelo a medio jugar se cierra con lo que se llevaba hecho (con la
      // cuenta que lo estaba jugando, antes de cambiar de usuario).
      if (app.duelos.dueloEnPantalla()) {
        app.duelos.abandonarDuelo();
        app.navegacion.goTo('juegos', { forzar: true });
      } else if (activa && juegos2D.includes(activa.id)) {
        app.navegacion.goTo('juegos');
      }
    }
    this.currentUser = usuario;
    if (app.tema) app.tema.aplicarTemaEfectivo();
  }

  logout() {
    if (this.supabaseClient) {
      this.supabaseClient.auth.signOut();
    }
    this.cambiarUsuario(null);
    localStorage.removeItem('unigames_token');
    localStorage.removeItem('unigames_user');
    this.updateAuthUI();
  }
}

// Nucleo — Caché del DOM y manejo de errores. (app.nucleo)
class Nucleo extends Modulo {
  constructor() {
    super();
    // Caché del DOM: elementos que ya existen en index.html. Los que se arman con
    // innerHTML al abrir una pantalla (admin, dashboard, etc.) se buscan en el momento.
    this.APP_EL = {
      accountDrawer: document.getElementById('accountDrawer'),
      accountDrawerBody: document.getElementById('accountDrawerBody'),
      accountToggle: document.getElementById('accountToggle'),
      actionGrid: document.getElementById('actionGrid'),
      adivinaBtnPista: document.getElementById('adivinaBtnPista'),
      adivinaBtnRendirse: document.getElementById('adivinaBtnRendirse'),
      adivinaCanvas: document.getElementById('adivinaCanvas'),
      adivinaFeedback: document.getElementById('adivinaFeedback'),
      adivinaGame: document.getElementById('adivinaGame'),
      adivinaInput: document.getElementById('adivinaInput'),
      adivinaItemNum: document.getElementById('adivinaItemNum'),
      adivinaItemTotal: document.getElementById('adivinaItemTotal'),
      adivinaOverlay: document.getElementById('adivinaOverlay'),
      adivinaOverlayBtn: document.getElementById('adivinaOverlayBtn'),
      adivinaOverlayDesc: document.getElementById('adivinaOverlayDesc'),
      adivinaOverlayEmoji: document.getElementById('adivinaOverlayEmoji'),
      adivinaOverlayTitle: document.getElementById('adivinaOverlayTitle'),
      adivinaPistaCosto: document.getElementById('adivinaPistaCosto'),
      adivinaPistasList: document.getElementById('adivinaPistasList'),
      adivinaPistasUsed: document.getElementById('adivinaPistasUsed'),
      adivinaScore: document.getElementById('adivinaScore'),
      ahorcadoKeyboard: document.getElementById('ahorcado-keyboard'),
      ahorcadoStatus: document.getElementById('ahorcado-status'),
      ahorcadoWord: document.getElementById('ahorcado-word'),
      authSectionLogin: document.getElementById('auth-section-login'),
      authSectionRegister: document.getElementById('auth-section-register'),
      drawerBackdrop: document.getElementById('drawerBackdrop'),
      featuredGrid: document.getElementById('featuredGrid'),
      classicGrid: document.getElementById('classicGrid'),
      motorGrid: document.getElementById('motorGrid'),
      globalAudioBtn: document.getElementById('globalAudioBtn'),
      hamburger: document.getElementById('hamburger'),
      infoOverlay: document.getElementById('infoOverlay'),
      lbGlobalGrids: document.getElementById('lb-global-grids'),
      lbPanelAll: document.getElementById('lb-panel-all'),
      lbPanelSingle: document.getElementById('lb-panel-single'),
      leaderboardBody: document.getElementById('leaderboardBody'),
      lbYourRank: document.getElementById('lbYourRank'),
      loginIdentity: document.getElementById('loginIdentity'),
      loginPassword: document.getElementById('loginPassword'),
      modalOverlay: document.getElementById('modalOverlay'),
      navMenu: document.getElementById('navMenu'),
      preguntadosThemeLabel: document.getElementById('preguntados-theme-label'),
      regConfirm: document.getElementById('regConfirm'),
      regEmail: document.getElementById('regEmail'),
      regPassword: document.getElementById('regPassword'),
      regUsername: document.getElementById('regUsername'),
      runnerAjustesPanel: document.getElementById('runnerAjustesPanel'),
      runnerComoJugarPanel: document.getElementById('runnerComoJugarPanel'),
      runnerFullscreenBtn: document.getElementById('runnerFullscreenBtn'),
      runnerFullscreenRow: document.getElementById('runnerFullscreenRow'),
      runnerHudPauseBtn: document.getElementById('runnerHudPauseBtn'),
      runnerPausePanel: document.getElementById('runnerPausePanel'),
      runnerMejorasCoinsTotal: document.getElementById('runnerMejorasCoinsTotal'),
      runnerMejorasGrid: document.getElementById('runnerMejorasGrid'),
      runnerMejorasPanel: document.getElementById('runnerMejorasPanel'),
      runnerModePanel: document.getElementById('runnerModePanel'),
      runnerModoInfinitoBtn: document.getElementById('runnerModoInfinitoBtn'),
      runnerModoInfinitoDesc: document.getElementById('runnerModoInfinitoDesc'),
      runnerMusicVolume: document.getElementById('runnerMusicVolume'),
      runnerMusicVolumeValue: document.getElementById('runnerMusicVolumeValue'),
      runnerSfxVolume: document.getElementById('runnerSfxVolume'),
      runnerSfxVolumeValue: document.getElementById('runnerSfxVolumeValue'),
      secAhorcado: document.getElementById('sec-ahorcado'),
      secJuegos: document.getElementById('sec-juegos'),
      secPreguntados: document.getElementById('sec-preguntados'),
      secSopa: document.getElementById('sec-sopa'),
      secTermina: document.getElementById('sec-termina'),
      secWordle: document.getElementById('sec-wordle'),
      simpleGrid: document.getElementById('simpleGrid'),
      sopaThemeLabel: document.getElementById('sopa-theme-label'),
      tabLogin: document.getElementById('tabLogin'),
      tabRegister: document.getElementById('tabRegister'),
      terminaThemeLabel: document.getElementById('termina-theme-label'),
      wordleBoard: document.getElementById('wordle-board'),
      wordleHint: document.getElementById('wordle-hint'),
      wordleKeyboard: document.getElementById('wordle-keyboard'),
      wordleStatus: document.getElementById('wordle-status'),
      wordleThemeLabel: document.getElementById('wordle-theme-label'),
      year: document.getElementById('year'),
    };
  }

  onerror(msg, url, line, col, err) {
    alert('Error: ' + msg + ' at line ' + line);
    return false;
  }
}

// AudioManager — Música de fondo, volúmenes globales y pausa al cambiar de pestaña. (app.audio)
class AudioManager extends Modulo {
  constructor() {
    super();
    this.globalAudioEnabled = true;
    this.musicVolume = this.loadStoredVolume('musicVolume', 0.5);
    this.sfxVolume = this.loadStoredVolume('sfxVolume', 0.8);
    this.bgMusic = new Audio('assert/menu.mp3');
    this.firstInteractionArmed = false;
    // Reproduce una pista de música de fondo (menú o juego).
    // Solo cambia el src si es distinto para no reiniciar la reproducción,
    // y siempre intenta reproducir (dentro de un gesto del usuario).
    this.currentMusicSrc = null;
    // ─── Ahorro de CPU y batería al cambiar de pestaña (Page Visibility API) ───
    this.tabMutedByVisibility = false;
  }

  iniciar() {
    this.bgMusic.loop = true;
    this.bgMusic.volume = this.musicVolume;
    this.bgMusic.preload = 'none';
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (!this.bgMusic.paused) {
          this.bgMusic.pause();
          this.tabMutedByVisibility = true;
        }
        if (typeof Engine2D !== 'undefined' && Engine2D.Audio) {
          Engine2D.Audio.pause();
        }
        // Pausar bucles/partidas activas para frenar el uso de CPU/GPU
        if (typeof pauseRunner === 'function') {
          pauseRunner();
        }
        if (typeof trPauseGame === 'function') {
          trPauseGame();
        }
        if (typeof rpgPauseGame === 'function') {
          rpgPauseGame();
        }
      } else {
        // Reanudar música de fondo si se pausó por cambio de pestaña
        if (this.tabMutedByVisibility) {
          this.tabMutedByVisibility = false;
          if (this.globalAudioEnabled) {
            this.attemptPlayMusic();
          }
        }
        if (typeof Engine2D !== 'undefined' && Engine2D.Audio) {
          Engine2D.Audio.resume();
        }
        // Reanudar Pixel Runner si se pausó al ocultar la pestaña
        if (typeof resumeRunner === 'function') {
          resumeRunner();
        }
      }
    });

    // Datos de cada juego (una sola fuente para las tarjetas de Inicio y Juegos).
    // Colores undefined = los por defecto de .card-header-band/.btn-play.
  }

  // Volumen de música/efectos — 0 a 1, persistido en localStorage para que
  // se recuerde entre sesiones. Cualquier juego (no solo Castle Escape)
  // puede leer/cambiar esto con getGlobalMusicVolume()/setGlobalMusicVolume().
  loadStoredVolume(key, fallback) {
    const raw = localStorage.getItem(key);
    const n = raw !== null ? parseFloat(raw) : NaN;
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
  }

  setGlobalMusicVolume(v) {
    this.musicVolume = Math.min(1, Math.max(0, v));
    this.bgMusic.volume = this.musicVolume;
    localStorage.setItem('musicVolume', this.musicVolume);
  }

  setGlobalSfxVolume(v) {
    this.sfxVolume = Math.min(1, Math.max(0, v));
    localStorage.setItem('sfxVolume', this.sfxVolume);
  }

  getGlobalMusicVolume() {
    return this.musicVolume;
  }

  getGlobalSfxVolume() {
    return this.sfxVolume;
  }

  // El audio arranca "activado" por defecto (icono 🔊) e intenta reproducirse
  // apenas carga la página.
  initAudio() {
    const btn = app.nucleo.APP_EL.globalAudioBtn;
    if (btn)
      btn.innerHTML =
        '<svg style="width:1.8rem;height:1.8rem;fill:#FFF;filter:drop-shadow(0 0 2px rgba(255,255,255,0.8));" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
    this.attemptPlayMusic();
  }

  // Los navegadores bloquean play() sin un gesto del usuario: si falla, se
  // reintenta con la primera interacción (click, toque o tecla).
  attemptPlayMusic() {
    if (!this.globalAudioEnabled) return;
    const playPromise = this.bgMusic.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => this.armFirstInteractionUnlock());
    }
  }

  armFirstInteractionUnlock() {
    if (this.firstInteractionArmed) return;
    this.firstInteractionArmed = true;
    const unlock = () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
      this.firstInteractionArmed = false;
      this.attemptPlayMusic();
    };
    document.addEventListener('click', unlock, {
      once: true,
    });
    document.addEventListener('touchstart', unlock, {
      once: true,
    });
    document.addEventListener('keydown', unlock, {
      once: true,
    });
  }

  toggleGlobalAudio() {
    this.globalAudioEnabled = !this.globalAudioEnabled;
    if (this.globalAudioEnabled) {
      app.nucleo.APP_EL.globalAudioBtn.innerHTML =
        '<svg style="width:1.8rem;height:1.8rem;fill:#FFF;filter:drop-shadow(0 0 2px rgba(255,255,255,0.8));" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
      this.attemptPlayMusic();
    } else {
      app.nucleo.APP_EL.globalAudioBtn.innerHTML =
        '<svg style="width:1.8rem;height:1.8rem;fill:#FFF;filter:drop-shadow(0 0 2px rgba(255,255,255,0.8));" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
      this.bgMusic.pause();
    }
  }

  // trackName con o sin el prefijo 'assert/'
  changeBgMusic(trackName) {
    this.setMusic(trackName.startsWith('assert/') ? trackName : 'assert/' + trackName);
  }

  setMusic(src, forceRestart) {
    if (this.currentMusicSrc !== src) {
      this.currentMusicSrc = src;
      this.bgMusic.src = src;
    } else if (forceRestart) {
      // Mismo track, pero se pide arrancar desde 0 (ej: reintentar un nivel
      // después de perder, en vez de seguir donde había quedado sonando).
      this.bgMusic.currentTime = 0;
    }
    this.bgMusic.loop = true;
    this.bgMusic.volume = this.musicVolume;
    this.attemptPlayMusic();
  }

}

// CatalogoJuegos — Datos de los minijuegos y render de las cards del inicio. (app.catalogo)
class CatalogoJuegos extends Modulo {
  // Los 3 juegos sencillos fijos que se muestran siempre en el inicio.
  static SIMPLE_GAME_IDS = ['sopa', 'ahorcado', 'preguntados'];
  // ─── Juegos recomendados (dentro de cada pantalla de minijuego) ───
  // Se muestran 3 juegos al azar de los 9 totales, sin repetir el que
  // se está jugando en ese momento.
  static GAME_SCREEN_IDS = [
    'sopa',
    'preguntados',
    'termina',
    'ahorcado',
    'wordle',
    'adivina',
    'runner',
    'castle_escape',
    'rpg_pixel',
    'pixel_survi',
  ];
  constructor() {
    super();
    this.allGames = [
      {
        id: 'sopa',
        title: 'Sopa de Letras',
        desc: 'Encontrá palabras ocultas en la grilla. Mientras más rápido, más puntos ganás.',
        tags: ['Velocidad'],
      },
      {
        id: 'preguntados',
        title: 'Preguntados',
        desc: 'Trivia de múltiple opción. Respondé preguntas sobre tu temática favorita.',
        tags: ['Trivia'],
      },
      {
        id: 'termina',
        title: 'Termina la Palabra',
        desc: 'Adiviná la palabra incompleta. Tenés solo 5 intentos. ¡Pensá bien!',
        tags: ['5 intentos'],
      },
      {
        id: 'ahorcado',
        title: 'Ahorcado',
        desc: 'El clásico de siempre, ahora con temáticas. Letra por letra antes de que se complete el dibujo.',
        tags: ['Clásico'],
      },
      {
        id: 'adivina',
        title: 'Adivina la Cosa',
        desc: 'Pistas progresivas para adivinar un juego, película, actor o anime.',
        tags: ['Pistas'],
      },
      {
        id: 'wordle',
        title: 'Adivina la Palabra',
        desc: 'Modo difícil estilo Wordle. 5 intentos, colores que te dan pistas letra por letra.',
        tags: ['Hard'],
        bg: 'linear-gradient(135deg, #15803d, #166534)',
        btnBg: '#15803d',
        btnColor: '#fff',
      },
    ];
    // Los juegos de acción (jugables con el motor 2D): Pixel Runner, Castle
    // Escape, RPG Pixel y Pixel Survi. Se usan en "Juegos Destacados" y
    // "Juegos de Acción" (Inicio) y en "Juegos del Motor" (Juegos).
    this.actionGames = [
      {
        id: 'runner',
        title: 'Pixel Runner',
        desc: 'Corré sin parar, esquivá obstáculos del suelo y del cielo. Doble salto y velocidad creciente.',
        tags: ['Doble salto', 'Velocidad creciente'],
        bg: 'linear-gradient(135deg, #1a1a2e, #16213e)',
        titleColor: '#f5c518',
        btnBg: '#f5c518',
        btnColor: '#0f1e3d',
      },
      {
        id: 'castle_escape',
        title: 'Castle Escape',
        desc: 'Saltá plataformas, esquivá trampas y llegá a la salida de los 20 niveles del castillo.',
        tags: ['20 niveles', 'Música propia'],
        bg: 'linear-gradient(135deg, #2a0e37, #4c1d95)',
        titleColor: '#facc15',
        btnBg: '#facc15',
        btnColor: '#2a0e37',
      },
      {
        id: 'rpg_pixel',
        title: 'RPG Pixel',
        desc: 'Combatí contra jefes pixel art: dispará y bloqueá con el escudo en arenas fijas.',
        tags: ['Combate', 'Bloqueo'],
        bg: 'linear-gradient(135deg, #14532d, #166534)',
        titleColor: '#4ade80',
        btnBg: '#166534',
        btnColor: '#fff',
      },
      {
        id: 'pixel_survi',
        title: 'Pixel Survi',
        desc: 'Mundo abierto por biomas: rompé bloques, construí y sobreviví. Normal o hardcore.',
        tags: ['Sandbox', 'Biomas'],
        bg: 'linear-gradient(135deg, #78350f, #92400e)',
        titleColor: '#fde68a',
        btnBg: '#92400e',
        btnColor: '#fff',
      },
    ];
  }

  // Tarjeta completa de un juego (la misma en Inicio y en Juegos).
  // No pasar directo a .map() (le mandaría el índice): usar g => gameCardFullHTML(g).
  gameCardFullHTML(g) {
    const bandStyle = g.bg ? ` style="background: ${g.bg};"` : '';
    const titleStyle = g.titleColor ? ` style="color:${g.titleColor};"` : '';
    const btnStyle =
      g.btnBg || g.btnColor
        ? ` style="${g.btnBg ? `background:${g.btnBg};` : ''}${g.btnColor ? `color:${g.btnColor};font-weight:900;` : ''}"`
        : '';
    const tags = g.tags || (g.tag ? [g.tag] : []);
    return `
    <div class="game-card-full" onclick="launchGame('${g.id}', this)">
      <div class="card-header-band"${bandStyle}>
        <span class="card-emoji"><span class="card-emoji-float">${app.utils.gameIconSVG(g.id, 32)}</span></span>
        <span class="card-title"${titleStyle}>${g.title}</span>
      </div>
      <div class="card-body">
        <p class="card-desc">${g.desc}</p>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.25rem;">
          ${tags.map((t) => `<span class="card-tag">${t}</span>`).join('')}
        </div>
        <button class="btn-play"${btnStyle} onclick="event.stopPropagation(); launchGame('${g.id}', this)"><span class="btn-play-label">▶ Jugar</span></button>
      </div>
    </div>
  `;
  }

  // Destacados: 3 al azar sin repetir los fijos de "Sencillos".
  renderFeatured() {
    const pool = [...this.allGames, ...this.actionGames].filter(
      (g) => !CatalogoJuegos.SIMPLE_GAME_IDS.includes(g.id),
    );
    const three = app.utils.shuffle(pool).slice(0, 3);
    app.nucleo.APP_EL.featuredGrid.innerHTML = three.map((g) => this.gameCardFullHTML(g)).join('');
  }

  renderSimple() {
    const list = CatalogoJuegos.SIMPLE_GAME_IDS.map((id) => this.allGames.find((g) => g.id === id)).filter(
      Boolean,
    );
    app.nucleo.APP_EL.simpleGrid.innerHTML = list.map((g) => this.gameCardFullHTML(g)).join('');
  }

  renderAction() {
    app.nucleo.APP_EL.actionGrid.innerHTML = this.actionGames.map((g) => this.gameCardFullHTML(g)).join('');
  }

  // Página Juegos: Clásicos y Del Motor (los 4 juegos 2D).
  renderClassicGames() {
    if (app.nucleo.APP_EL.classicGrid)
      app.nucleo.APP_EL.classicGrid.innerHTML = this.allGames
        .map((g) => this.gameCardFullHTML(g))
        .join('');
  }

  renderMotorGames() {
    if (app.nucleo.APP_EL.motorGrid)
      app.nucleo.APP_EL.motorGrid.innerHTML = this.actionGames
        .map((g) => this.gameCardFullHTML(g))
        .join('');
  }

  renderRecommendedGames(currentGameId) {
    const container = document.getElementById('recBox-' + currentGameId);
    if (!container) return;
    const pool = [...this.allGames, ...this.actionGames].filter((g) => g.id !== currentGameId);
    const three = app.utils.shuffle(pool).slice(0, 3);
    container.innerHTML = three.map((g) => this.gameCardFullHTML(g)).join('');
  }

}

// AmigosManager — Lista de amigos, búsqueda de usuarios y solicitudes de amistad. (app.amigos)
class AmigosManager extends Modulo {
  // Máximo de amigos permitidos (debe coincidir con MAX_AMIGOS en routes/amigos.js,
  // que es quien realmente lo hace cumplir).
  static MAX_AMIGOS = 50;
  constructor() {
    super();
    // Amigos aceptados del usuario logueado (se llena con fetchAmigos()).
    this.amigosList = [];
    // Controla qué vista de la pantalla "Amigos" está activa (lista propia o
    // buscador). Se resetea a 'mios' cada vez que se entra a la sección.
    this.friendsTabActual = 'mios';
    // Ids a los que ya se les mandó solicitud en esta sesión (evita doble
    // click mientras el backend confirma; el estado real lo devuelve
    // GET /api/usuarios/:id/perfil vía el campo `amistad`).
    this.solicitudesAmistadEnviadas = new Set();
    // Debounce simple para no pegarle al backend en cada tecla.
    this.buscarUsuariosTimeout = null;
  }

  async fetchAmigos() {
    const box = document.getElementById('friendsListBox');
    if (box) box.innerHTML = `<div class="friends-empty"><p>Cargando amigos...</p></div>`;
    try {
      this.amigosList = await app.api.apiFetch('/api/amigos');
    } catch (error) {
      console.error('Error al obtener amigos:', error);
      this.amigosList = [];
    }
    this.renderAmigos();
  }

  // Se llama al entrar a la sección "Amigos" (desde goTo()). Sin cuenta no
  // tiene sentido mostrar la lista/buscador (no se pueden agregar amigos),
  // así que mostramos el cartel de "creá una cuenta" en su lugar.
  initAmigosScreen() {
    const banner = document.getElementById('amigosGuestBanner');
    const content = document.getElementById('amigosLoggedContent');
    if (!app.auth.currentUser) {
      if (banner) banner.classList.remove('hidden');
      if (content) content.classList.add('hidden');
      return;
    }
    if (banner) banner.classList.add('hidden');
    if (content) content.classList.remove('hidden');
    this.mostrarTabAmigos('mios');
    this.actualizarBadgeSolicitudes();
  }

  // Alterna entre las 3 vistas de la pantalla "Amigos": tus amigos,
  // solicitudes recibidas/enviadas y buscador.
  mostrarTabAmigos(tab) {
    this.friendsTabActual = tab;
    const tabs = {
      mios: document.getElementById('friendsTabMios'),
      solicitudes: document.getElementById('friendsTabSolicitudes'),
      duelos: document.getElementById('friendsTabDuelos'),
      buscar: document.getElementById('friendsTabBuscar'),
    };
    const views = {
      mios: document.getElementById('friendsViewMios'),
      solicitudes: document.getElementById('friendsViewSolicitudes'),
      duelos: document.getElementById('friendsViewDuelos'),
      buscar: document.getElementById('friendsViewBuscar'),
    };
    if (!tabs.mios || !tabs.solicitudes || !tabs.duelos || !tabs.buscar) return;
    Object.keys(tabs).forEach((key) => {
      tabs[key].classList.toggle('active', key === tab);
      views[key].classList.toggle('hidden', key !== tab);
    });
    if (tab === 'mios') {
      this.fetchAmigos();
    } else if (tab === 'solicitudes') {
      this.fetchSolicitudes();
    } else if (tab === 'duelos') {
      app.duelos.fetchDuelos();
    } else {
      // Al abrir el buscador arrancamos limpio, sin resultados de una
      // búsqueda anterior.
      const input = document.getElementById('buscarAmigoInput');
      const resultsBox = document.getElementById('buscarAmigoResultados');
      if (input) input.value = '';
      if (resultsBox) {
        resultsBox.innerHTML = '';
        resultsBox.classList.add('hidden');
      }
    }
  }

  // Arma el HTML de un avatar a partir de su valor guardado: si es una ruta
  // de imagen (termina en extensión de archivo) se renderiza como <img>,
  // si es un emoji (dato viejo / de respaldo) se muestra tal cual.
  avatarValueHTML(valor, altText) {
    if (valor && /\.(webp|png|jpe?g|gif|svg)$/i.test(valor)) {
      // loading/decoding: estos avatares salen en listas largas (amigos,
      // ranking, búsqueda) donde la mayoría arranca fuera de pantalla.
      return `<img src="${valor}" alt="${app.utils.sanitizeHTML(altText || '')}" loading="lazy" decoding="async">`;
    }
    return valor || '🙂';
  }

  buscarUsuarios() {
    clearTimeout(this.buscarUsuariosTimeout);
    this.buscarUsuariosTimeout = setTimeout(this.ejecutarBusquedaUsuarios, 300);
  }

  // Busca usuarios por nombre en GET /api/usuarios/buscar y pinta los
  // resultados con el botón correspondiente según el estado con cada uno
  // (ya son amigos / solicitud enviada / agregar).
  async ejecutarBusquedaUsuarios() {
    const input = document.getElementById('buscarAmigoInput');
    const resultsBox = document.getElementById('buscarAmigoResultados');
    if (!input || !resultsBox) return;
    const q = input.value.trim();
    if (!q) {
      resultsBox.innerHTML = '';
      resultsBox.classList.add('hidden');
      return;
    }
    resultsBox.classList.remove('hidden');
    resultsBox.innerHTML = `<div class="friends-empty"><p>Buscando...</p></div>`;
    let resultados = [];
    try {
      resultados = await app.api.apiFetch('/api/usuarios/buscar?nombre=' + encodeURIComponent(q));
    } catch (error) {
      resultsBox.innerHTML = `<div class="friends-empty"><p>No se pudo buscar usuarios.</p></div>`;
      return;
    }
    if (resultados.length === 0) {
      resultsBox.innerHTML = `<div class="friends-empty"><p>No se encontraron usuarios con ese nombre.</p></div>`;
      return;
    }
    const limiteAlcanzado = this.amigosList.length >= AmigosManager.MAX_AMIGOS;
    resultsBox.innerHTML = resultados
      .map((u) => {
        const esAmigo = this.amigosList.some((a) => a.id === u.id);
        const yaEnviada = this.solicitudesAmistadEnviadas.has(u.id);
        let accion;
        if (esAmigo) {
          accion = `<span class="friend-search-status">${app.utils.uiIconSVG('users')} Ya son amigos</span>`;
        } else if (yaEnviada) {
          accion = `<span class="friend-search-status">${app.utils.uiIconSVG('check')} Solicitud enviada</span>`;
        } else if (limiteAlcanzado) {
          accion = `<span class="friend-search-status">${app.utils.uiIconSVG('warning')} Límite de amigos alcanzado</span>`;
        } else {
          accion = `<button class="friend-btn friend-btn-add" onclick="enviarSolicitudAmistad(${u.id}, ${app.utils.jsArg(u.username)})">${app.utils.uiIconSVG('plus')} Agregar</button>`;
        }
        return `
      <div class="friend-row friend-search-row">
        <div class="friend-info">
          <span class="friend-avatar">${this.avatarValueHTML(u.avatar, u.username)}</span>
          <div class="friend-name">${app.utils.sanitizeHTML(u.username)}</div>
        </div>
        <div class="friend-actions">
          ${accion}
          <button class="friend-btn friend-btn-profile" onclick="verPerfilUsuarioBuscado(${u.id})" title="Ver perfil">${app.utils.uiIconSVG('user')} Perfil</button>
        </div>
      </div>`;
      })
      .join('');
  }

  // Ver el perfil de un usuario a partir de su nombre (usado desde la tabla
  // de Puntuación, que solo trae el nombre del jugador, sin id).
  async verPerfilPorUsername(username) {
    if (!username) return;

    // Si es el propio nombre, abrir directo: el buscador excluye al usuario
    // logueado de sus resultados (GET /api/usuarios/buscar no se busca a sí mismo).
    if (app.auth.currentUser && username.toLowerCase() === app.auth.currentUser.username.toLowerCase()) {
      app.perfil.abrirPerfilPropio();
      return;
    }
    try {
      const resultados = await app.api.apiFetch(
        '/api/usuarios/buscar?nombre=' + encodeURIComponent(username),
      );
      const usuario = resultados.find((u) => u.username.toLowerCase() === username.toLowerCase());
      if (!usuario) {
        app.utils.mostrarToast('No se encontró ese usuario.', 'error');
        return;
      }
      app.perfil.abrirPerfilDeUsuario(usuario.id);
    } catch (error) {
      console.error('Error al buscar usuario:', error);
    }
  }

  // Ver el perfil de un usuario encontrado por el buscador (sea o no amigo).
  verPerfilUsuarioBuscado(id) {
    app.perfil.abrirPerfilDeUsuario(id);
  }

  renderAmigos() {
    const box = document.getElementById('friendsListBox');
    const contador = document.getElementById('friendsTabMiosCount');
    if (contador) contador.textContent = `(${this.amigosList.length}/${AmigosManager.MAX_AMIGOS})`;
    if (!box) return;
    if (this.amigosList.length === 0) {
      box.innerHTML = `
      <div class="friends-empty">
        <p>Todavía no agregaste amigos.</p>
      </div>`;
      return;
    }
    box.innerHTML = this.amigosList
      .map(
        (a) => `
    <div class="friend-row" id="friendRow-${a.id}">
      <div class="friend-info">
        <span class="friend-avatar">${this.avatarValueHTML(a.avatar, a.username)}</span>
        <div>
          <div class="friend-name">${app.utils.sanitizeHTML(a.username)}</div>
        </div>
      </div>
      <div class="friend-actions">
        <button class="friend-btn friend-btn-remove" onclick="eliminarAmigo(${a.id})" title="Eliminar amigo">${app.utils.uiIconSVG('trash')} Eliminar</button>
        <button class="friend-btn friend-btn-duel" onclick="abrirSelectorJuegoDuelo(${a.id})" title="Retar a duelo">${app.utils.uiIconSVG('target')} Duelo</button>
        <button class="friend-btn friend-btn-profile" onclick="verPerfilAmigo(${a.id})" title="Ver perfil">${app.utils.uiIconSVG('user')} Perfil</button>
      </div>
    </div>
  `,
      )
      .join('');
  }

  async eliminarAmigo(id) {
    const amigo = this.amigosList.find((a) => a.id === id);
    if (!amigo) return;
    if (!confirm(`¿Eliminar a ${amigo.username} de tu lista de amigos?`)) return;
    try {
      await app.api.apiFetch('/api/amigos/' + id, {
        method: 'DELETE',
      });
      this.amigosList = this.amigosList.filter((a) => a.id !== id);
      this.renderAmigos();
    } catch (error) {
      alert(error.message || 'No se pudo eliminar al amigo.');
    }
  }

  // Abre el perfil de un amigo (solo lectura + botón de solicitud de amistad).
  verPerfilAmigo(id) {
    app.perfil.abrirPerfilDeUsuario(id);
  }

  // Envía la solicitud de amistad al backend y refresca la vista que
  // corresponda (perfil abierto y/o resultados del buscador), mostrando
  // un cartel en vez de un alert().
  async enviarSolicitudAmistad(id, nombre) {
    if (this.amigosList.length >= AmigosManager.MAX_AMIGOS) {
      app.utils.mostrarToast(`Llegaste al límite de ${AmigosManager.MAX_AMIGOS} amigos.`, 'error');
      return;
    }
    try {
      await app.api.apiFetch('/api/amigos/solicitudes', {
        method: 'POST',
        body: JSON.stringify({
          receptor_id: id,
        }),
      });
      this.solicitudesAmistadEnviadas.add(id);
      app.utils.mostrarToast('Solicitud de amistad enviada');
      if (document.getElementById('sec-perfil')?.classList.contains('active')) app.perfil.renderPerfil();
      if (this.friendsTabActual === 'buscar') this.ejecutarBusquedaUsuarios();
    } catch (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('ya existe una solicitud')) {
        this.solicitudesAmistadEnviadas.add(id);
        app.utils.mostrarToast('La solicitud ya fue enviada');
        if (document.getElementById('sec-perfil')?.classList.contains('active')) app.perfil.renderPerfil();
      } else {
        app.utils.mostrarToast(error.message || `No se pudo enviar la solicitud a ${nombre}.`, 'error');
      }
    }
  }

  // ─── Solicitudes de amistad (recibidas y enviadas) ───
  // Trae las solicitudes pendientes desde el backend y refresca la vista +
  // el contador de la pestaña.
  async fetchSolicitudes() {
    const box = document.getElementById('friendsSolicitudesBox');
    if (box) box.innerHTML = `<div class="friends-empty"><p>Cargando solicitudes...</p></div>`;
    try {
      const data = await app.api.apiFetch('/api/amigos/solicitudes');
      this.renderSolicitudes(data.recibidas || [], data.enviadas || []);
    } catch (error) {
      console.error('Error al obtener solicitudes:', error);
      if (box)
        box.innerHTML = `<div class="friends-empty"><p>No se pudieron cargar las solicitudes.</p></div>`;
    }
  }

  // Actualiza solo el número del badge de la pestaña "Solicitudes" (se
  // llama al entrar a la sección Amigos, sin importar qué pestaña quede
  // activa), para que se note que llegó algo sin tener que entrar a mirar.
  async actualizarBadgeSolicitudes() {
    const badge = document.getElementById('friendsTabSolicitudesCount');
    if (!badge || !localStorage.getItem('unigames_token')) return;
    try {
      const data = await app.api.apiFetch('/api/amigos/solicitudes');
      const recibidas = data.recibidas || [];
      badge.innerHTML = recibidas.length > 0 ? `<span class="lb-tab-badge">${recibidas.length}</span>` : '';
    } catch (error) {
      // silencioso: es solo un indicador, no bloquea nada
    }
  }

  renderSolicitudes(recibidas, enviadas) {
    const box = document.getElementById('friendsSolicitudesBox');
    const badge = document.getElementById('friendsTabSolicitudesCount');
    if (badge) {
      badge.innerHTML = recibidas.length > 0 ? `<span class="lb-tab-badge">${recibidas.length}</span>` : '';
    }
    if (!box) return;
    if (recibidas.length === 0 && enviadas.length === 0) {
      box.innerHTML = `<div class="friends-empty"><p>No tenés solicitudes de amistad pendientes.</p></div>`;
      return;
    }
    const recibidasHTML =
      recibidas.length === 0
        ? ''
        : `
    <div class="section-title" style="font-size:12px;">Solicitudes recibidas</div>
    ${recibidas
      .map(
        (s) => `
      <div class="friend-row" id="solicitudRow-${s.id}">
        <div class="friend-info">
          <span class="friend-avatar">${this.avatarValueHTML(s.avatar, s.username)}</span>
          <div class="friend-name">${app.utils.sanitizeHTML(s.username)}</div>
        </div>
        <div class="friend-actions">
          <button class="friend-btn friend-btn-add" onclick="aceptarSolicitud(${s.id})">${app.utils.uiIconSVG('check')} Aceptar</button>
          <button class="friend-btn friend-btn-remove" onclick="rechazarSolicitud(${s.id})">${app.utils.uiIconSVG('trash')} Rechazar</button>
          <button class="friend-btn friend-btn-profile" onclick="verPerfilUsuarioBuscado(${s.usuario_id})" title="Ver perfil">${app.utils.uiIconSVG('user')} Perfil</button>
        </div>
      </div>
    `,
      )
      .join('')}
  `;
    const enviadasHTML =
      enviadas.length === 0
        ? ''
        : `
    <div class="section-title" style="font-size:12px;margin-top:1.5rem;">Solicitudes enviadas</div>
    ${enviadas
      .map(
        (s) => `
      <div class="friend-row" id="solicitudRow-${s.id}">
        <div class="friend-info">
          <span class="friend-avatar">${this.avatarValueHTML(s.avatar, s.username)}</span>
          <div class="friend-name">${app.utils.sanitizeHTML(s.username)}</div>
        </div>
        <div class="friend-actions">
          <span class="friend-search-status">${app.utils.uiIconSVG('check')} Esperando respuesta</span>
          <button class="friend-btn friend-btn-remove" onclick="rechazarSolicitud(${s.id})" title="Cancelar solicitud">${app.utils.uiIconSVG('trash')} Cancelar</button>
        </div>
      </div>
    `,
      )
      .join('')}
  `;
    box.innerHTML = recibidasHTML + enviadasHTML;
  }

  async aceptarSolicitud(id) {
    try {
      await app.api.apiFetch(`/api/amigos/solicitudes/${id}/aceptar`, {
        method: 'POST',
      });
      app.utils.mostrarToast('Ahora son amigos');
      this.fetchSolicitudes();
    } catch (error) {
      app.utils.mostrarToast(error.message || 'No se pudo aceptar la solicitud.', 'error');
    }
  }

  async rechazarSolicitud(id) {
    try {
      await app.api.apiFetch(`/api/amigos/solicitudes/${id}/rechazar`, {
        method: 'POST',
      });
      this.fetchSolicitudes();
    } catch (error) {
      app.utils.mostrarToast(error.message || 'No se pudo rechazar la solicitud.', 'error');
    }
  }
}

// DuelosManager — Duelos 1v1: retos, selección de juego, resultados y revanchas. (app.duelos)
class DuelosManager extends Modulo {
  // Duelos 1v1 (routes/duelos.js). Juegos habilitados: debe coincidir con
  // JUEGOS_DUELO del backend.
  static JUEGOS_DUELO_INFO = {
    ahorcado: {
      nombre: 'Ahorcado',
    },
    sopa: {
      nombre: 'Sopa de Letras',
    },
    wordle: {
      nombre: 'Adivina la Palabra',
    },
    runner: {
      nombre: 'Pixel Runner',
    },
    preguntados: {
      nombre: 'Preguntados',
    },
    termina: {
      nombre: 'Termina la Palabra',
    },
    adivina: {
      nombre: 'Adivina la Cosa',
    },
  };
  // Juegos que, al retar, además piden elegir temática (debe reflejar
  // JUEGOS_CON_TEMATICA de routes/duelos.js). Runner no tiene temáticas,
  // así que va directo.
  static DUELO_REQUIERE_TEMATICA = {
    sopa: true,
    wordle: true,
    ahorcado: true,
    preguntados: true,
    termina: true,
    adivina: true,
  };
  // De los que piden temática, cuáles además aceptan "Normal" (sin
  // temática) como opción, igual que en modo libre (debe reflejar
  // JUEGOS_TEMATICA_NORMAL de routes/duelos.js). Ahorcado y Sopa comparten
  // el banco de palabras "Normal".
  static DUELO_TEMATICA_NORMAL = {
    ahorcado: true,
    sopa: true,
  };
  // De los que piden temática, cuáles además piden elegir la duración
  // (debe reflejar JUEGOS_CON_DURACION de routes/duelos.js).
  static DUELO_REQUIERE_DURACION = {
    sopa: true,
  };
  // Duraciones ofrecidas para Sopa de Letras al retar (en segundos), deben
  // coincidir con DURACIONES_VALIDAS_SOPA de routes/duelos.js.
  static DUELO_SOPA_DURACIONES = [
    {
      valor: 120,
      label: '2 min',
    },
    {
      valor: 180,
      label: '3 min',
    },
    {
      valor: 240,
      label: '4 min',
    },
    {
      valor: 300,
      label: '5 min',
    },
  ];
  constructor() {
    super();
    // Duelo en curso ({ id, juego }) o null. Los juegos 2D lo leen con
    // window.dueloActivo (ver exponerGlobales).
    this.dueloActivo = null;
    // Últimos duelos traídos del backend (se llena con fetchDuelos()).
    this.duelosList = [];
    // Id del amigo elegido para retar, mientras se elige el minijuego en el
    // selector (ver abrirSelectorJuegoDuelo).
    this.dueloAmigoIdSeleccionado = null;
    // Juego elegido en el paso 1 del selector, mientras se decide si hace
    // falta pedir temática/duración (paso 2) antes de mandar el reto.
    this.dueloJuegoSeleccionado = null;
  }

  async fetchDuelos() {
    const box = document.getElementById('friendsDuelosBox');
    if (box) box.innerHTML = `<div class="friends-empty"><p>Cargando duelos...</p></div>`;
    try {
      this.duelosList = await app.api.apiFetch('/api/duelos');
    } catch (error) {
      console.error('Error al obtener duelos:', error);
      this.duelosList = [];
    }
    this.renderDuelos();
  }

  renderDuelos() {
    const box = document.getElementById('friendsDuelosBox');
    if (!box) return;
    if (this.duelosList.length === 0) {
      box.innerHTML = `
      <div class="friends-empty">
        <p>Todavía no tenés duelos. ¡Retá a un amigo desde la pestaña "Tus amigos"!</p>
      </div>`;
      return;
    }
    box.innerHTML = this.duelosList
      .map((d) => {
        const juegoInfo = DuelosManager.JUEGOS_DUELO_INFO[d.juego] || {
          nombre: d.juegoNombre,
        };
        const tematicaTxt = d.tematicaId
          ? ` · ${Preguntados.TEMATICA_NAMES[d.tematicaId] || ''}`
          : d.juego === 'ahorcado'
            ? ' · Normal'
            : '';
        let cuerpo = '';
        if (d.estado === 'pendiente') {
          cuerpo = d.soyRetador
            ? `<span class="friend-status">${app.utils.uiIconSVG('clock')} Esperando respuesta</span>
           <button class="friend-btn friend-btn-remove" onclick="rechazarDuelo(${d.id})">Cancelar</button>`
            : `<button class="friend-btn friend-btn-duel" onclick="aceptarDuelo(${d.id})">${app.utils.uiIconSVG('check')} Aceptar</button>
           <button class="friend-btn friend-btn-remove" onclick="rechazarDuelo(${d.id})">Rechazar</button>`;
        } else if (d.estado === 'en_curso') {
          cuerpo = d.yaJugue
            ? `<span class="friend-status">${app.utils.uiIconSVG('clock')} Ya jugaste, esperando al rival</span>`
            : `<button class="friend-btn friend-btn-duel" onclick="jugarDuelo(${d.id}, '${d.juego}')">▶ Jugar</button>`;
        } else if (d.estado === 'finalizado') {
          const etiqueta =
            d.resultado === 'gano' ? '🏆 Ganaste' : d.resultado === 'perdio' ? '💀 Perdiste' : '🤝 Empate';
          cuerpo = `
        <span class="friend-status">${etiqueta} (${d.misPuntos ?? 0} vs ${d.puntosOponente ?? 0})</span>
        <button class="friend-btn friend-btn-duel" onclick="revanchaDuelo(${d.id})">Revancha</button>`;
        }
        return `
      <div class="friend-row" id="dueloRow-${d.id}">
        <div class="friend-info">
          <span class="friend-avatar">${app.amigos.avatarValueHTML(d.oponente.avatar, d.oponente.username)}</span>
          <div>
            <div class="friend-name">${app.utils.sanitizeHTML(d.oponente.username)}</div>
            <span class="friend-status">${app.utils.gameIconSVG(d.juego, 14)} ${juegoInfo.nombre}${tematicaTxt}</span>
          </div>
        </div>
        <div class="friend-actions">${cuerpo}</div>
      </div>`;
      })
      .join('');
  }

  async aceptarDuelo(id) {
    try {
      await app.api.apiFetch(`/api/duelos/${id}/aceptar`, {
        method: 'POST',
      });
      app.utils.mostrarToast('¡Duelo aceptado! Andá a la pestaña Duelos cuando quieras jugarlo.');
      this.fetchDuelos();
      app.notificaciones.actualizarBadgeNotificaciones();
    } catch (error) {
      app.utils.mostrarToast(error.message || 'No se pudo aceptar el duelo', 'error');
    }
  }

  async rechazarDuelo(id) {
    try {
      await app.api.apiFetch(`/api/duelos/${id}/rechazar`, {
        method: 'POST',
      });
      this.fetchDuelos();
    } catch (error) {
      app.utils.mostrarToast(error.message || 'No se pudo actualizar el duelo', 'error');
    }
  }

  async revanchaDuelo(id) {
    try {
      await app.api.apiFetch(`/api/duelos/${id}/revancha`, {
        method: 'POST',
      });
      app.utils.mostrarToast('¡Revancha enviada!');
      this.fetchDuelos();
    } catch (error) {
      app.utils.mostrarToast(error.message || 'No se pudo enviar la revancha', 'error');
    }
  }

  // Abre el selector de "¿a qué lo retás?" para el amigo elegido, siempre
  // arrancando en el paso 1 (elegir juego). Se llena dinámicamente por si en
  // el futuro se agregan más juegos a JUEGOS_DUELO_INFO, sin tocar el HTML.
  abrirSelectorJuegoDuelo(amigoId) {
    this.dueloAmigoIdSeleccionado = amigoId;
    this.dueloJuegoSeleccionado = null;
    const box = document.getElementById('dueloJuegoOpciones');
    if (box) {
      box.innerHTML = Object.entries(DuelosManager.JUEGOS_DUELO_INFO)
        .map(
          ([key, info]) => `
      <button class="duelo-juego-btn" onclick="elegirJuegoDuelo('${key}')">
        <span class="duelo-juego-icon">${app.utils.gameIconSVG(key, 26)}</span>
        <span>${info.nombre}</span>
      </button>
    `,
        )
        .join('');
    }
    this.mostrarPasoJuegoDuelo();
    const overlay = document.getElementById('dueloSelectorOverlay');
    if (overlay) overlay.classList.add('show');
  }

  cerrarSelectorJuegoDuelo() {
    const overlay = document.getElementById('dueloSelectorOverlay');
    if (overlay) overlay.classList.remove('show');
    this.dueloAmigoIdSeleccionado = null;
    this.dueloJuegoSeleccionado = null;
  }

  // Se llama al elegir un juego en el paso 1. Si ese juego necesita
  // temática (y opcionalmente duración), pasa al paso 2; si no, manda el
  // reto directo (comportamiento anterior, para Ahorcado y Runner).
  elegirJuegoDuelo(juego) {
    this.dueloJuegoSeleccionado = juego;
    if (DuelosManager.DUELO_REQUIERE_TEMATICA[juego]) {
      this.mostrarPasoOpcionesDuelo(juego);
    } else {
      this.enviarRetoDuelo(juego, null, null);
    }
  }

  // Paso 1: elegir el juego.
  mostrarPasoJuegoDuelo() {
    const t1 = document.getElementById('dueloJuegoTitle');
    const p1 = document.getElementById('dueloJuegoOpciones');
    const t2 = document.getElementById('dueloOpcionesTitle');
    const p2 = document.getElementById('dueloOpcionesStep');
    if (t1) t1.style.display = '';
    if (p1) p1.style.display = '';
    if (t2) t2.style.display = 'none';
    if (p2) p2.style.display = 'none';
  }

  // Paso 2: elegir temática (y duración si corresponde) para el juego ya
  // elegido. Reutiliza las mismas 4 temáticas que se usan jugando solo
  // (TEMATICA_NAMES, definido más abajo en este archivo).
  mostrarPasoOpcionesDuelo(juego) {
    const t1 = document.getElementById('dueloJuegoTitle');
    const p1 = document.getElementById('dueloJuegoOpciones');
    const t2 = document.getElementById('dueloOpcionesTitle');
    const p2 = document.getElementById('dueloOpcionesStep');
    if (t1) t1.style.display = 'none';
    if (p1) p1.style.display = 'none';
    if (t2) t2.style.display = '';
    if (p2) p2.style.display = '';
    const tematicaBox = document.getElementById('dueloTematicaOpciones');
    if (tematicaBox) {
      // Si el juego acepta "Normal" (sin temática, como Ahorcado en modo
      // libre), esa opción va primero y queda seleccionada por defecto.
      const normalBtn = DuelosManager.DUELO_TEMATICA_NORMAL[juego]
        ? `<button class="theme-btn selected" data-tematica="normal" onclick="selectTheme(this)">Normal</button>`
        : '';
      const temasBtn = Object.entries(Preguntados.TEMATICA_NAMES)
        .map(
          ([id, nombre], i) => `
      <button class="theme-btn${i === 0 && !normalBtn ? ' selected' : ''}" data-tematica="${id}" onclick="selectTheme(this)">${nombre}</button>
    `,
        )
        .join('');
      tematicaBox.innerHTML = normalBtn + temasBtn;
    }
    const requiereDuracion = !!DuelosManager.DUELO_REQUIERE_DURACION[juego];
    const duracionWrap = document.getElementById('dueloDuracionWrap');
    if (duracionWrap) duracionWrap.style.display = requiereDuracion ? '' : 'none';
    if (requiereDuracion) {
      const duracionBox = document.getElementById('dueloDuracionOpciones');
      if (duracionBox) {
        duracionBox.innerHTML = DuelosManager.DUELO_SOPA_DURACIONES.map(
          (d, i) => `
        <button class="theme-btn${i === 0 ? ' selected' : ''}" data-duracion="${d.valor}" onclick="selectTheme(this)">${d.label}</button>
      `,
        ).join('');
      }
    }
  }

  volverAPasoJuegoDuelo() {
    this.dueloJuegoSeleccionado = null;
    this.mostrarPasoJuegoDuelo();
  }

  // Lee lo elegido en el paso 2 (temática + duración si aplica) y manda el reto.
  confirmarDueloConOpciones() {
    const juego = this.dueloJuegoSeleccionado;
    if (!juego) return;
    const tematicaBtn = document.querySelector('#dueloTematicaOpciones .theme-btn.selected');
    const tematicaRaw = tematicaBtn ? tematicaBtn.dataset.tematica : '1';
    const tematicaId = tematicaRaw === 'normal' ? 'normal' : Number(tematicaRaw);
    let duracionSegundos = null;
    if (DuelosManager.DUELO_REQUIERE_DURACION[juego]) {
      const duracionBtn = document.querySelector('#dueloDuracionOpciones .theme-btn.selected');
      duracionSegundos = duracionBtn
        ? Number(duracionBtn.dataset.duracion)
        : DuelosManager.DUELO_SOPA_DURACIONES[0].valor;
    }
    this.enviarRetoDuelo(juego, tematicaId, duracionSegundos);
  }

  async enviarRetoDuelo(juego, tematicaId, duracionSegundos) {
    const amigoId = this.dueloAmigoIdSeleccionado;
    this.cerrarSelectorJuegoDuelo();
    if (!amigoId) return;
    const amigo = app.amigos.amigosList.find((a) => a.id === amigoId);
    const body = {
      amigo_id: amigoId,
      juego,
    };
    if (tematicaId) body.tematica_id = tematicaId;
    if (duracionSegundos) body.duracion_segundos = duracionSegundos;
    try {
      await app.api.apiFetch('/api/duelos', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      app.utils.mostrarToast(`Reto de duelo enviado a ${amigo ? amigo.username : 'tu amigo'}.`);
    } catch (error) {
      app.utils.mostrarToast(error.message || 'No se pudo enviar el reto de duelo', 'error');
    }
  }

  // Punto de entrada al tocar "▶ Jugar" en un duelo en curso: manda al
  // minijuego correspondiente en modo duelo, con la temática/duración que
  // se haya elegido al mandar el reto (guardadas en el duelo en el backend).
  jugarDuelo(dueloId, juego) {
    const duelo = this.duelosList.find((d) => d.id === dueloId);
    if (juego === 'ahorcado') {
      app.ahorcado.iniciarAhorcadoDuelo(dueloId, duelo && duelo.tematicaId);
    } else if (juego === 'runner') {
      app.runner.iniciarRunnerDuelo(dueloId);
    } else if (juego === 'sopa') {
      app.sopa.iniciarSopaDuelo(dueloId, duelo && duelo.tematicaId, duelo && duelo.duracionSegundos);
    } else if (juego === 'wordle') {
      app.wordle.iniciarWordleDuelo(dueloId, duelo && duelo.tematicaId);
    } else if (juego === 'preguntados') {
      app.preguntados.iniciarPreguntadosDuelo(dueloId, duelo && duelo.tematicaId);
    } else if (juego === 'termina') {
      app.termina.iniciarTerminaDuelo(dueloId, duelo && duelo.tematicaId);
    } else if (juego === 'adivina') {
      app.adivina.iniciarAdivinaDuelo(dueloId, duelo && duelo.tematicaId);
    } else {
      app.utils.mostrarToast('Ese juego todavía no tiene modo duelo.', 'error');
    }
  }

  // ─── Salir en medio de un duelo ───
  // Duelo que se está jugando en pantalla ({ id, juego }) o null. Cuenta solo
  // si la sección visible es la del juego del duelo y el juego todavía no
  // reportó el puntaje (cada juego pone su xxxDuelo en null al terminar).
  dueloEnPantalla() {
    const d = this.dueloActivo;
    if (!d) return null;
    const activa = document.querySelector('.section.active');
    if (!activa || activa.id !== 'sec-' + d.juego) return null;
    if (d.juego === 'runner') return d;
    const estado = DuelosManager.estadoDuelo(d.juego);
    return estado && estado.activo ? d : null;
  }

  static estadoDuelo(juego) {
    switch (juego) {
      case 'ahorcado': return app.ahorcado.ahorcadoDuelo;
      case 'wordle': return app.wordle.wordleDuelo;
      case 'preguntados': return app.preguntados.pregDuelo;
      case 'sopa': return app.sopa.sopaDuelo;
      case 'termina': return app.termina.terminaDuelo;
      case 'adivina': return app.adivina.adivinaDuelo;
      default: return null;
    }
  }

  // Lo que el jugador lleva hecho en el duelo. Wordle y Termina son una sola
  // palabra: sin resolverla todavía, 0.
  static puntajeParcial(juego) {
    switch (juego) {
      case 'ahorcado': return (app.ahorcado.ahorcadoDuelo && app.ahorcado.ahorcadoDuelo.puntosTotal) || 0;
      case 'preguntados': return ((app.preguntados.pregState && app.preguntados.pregState.score) || 0) * 150;
      case 'sopa': return (app.sopa.sopaState && app.sopa.sopaState.score) || 0;
      case 'adivina': return (app.adivina.adivinaState && app.adivina.adivinaState.score) || 0;
      case 'runner': return typeof runnerPuntajeActual === 'function' ? runnerPuntajeActual() : 0;
      default: return 0;
    }
  }

  // Termina el duelo en pantalla con el puntaje que se llevaba: corta el
  // juego (timers, loop) para que no reporte por su cuenta después.
  abandonarDuelo() {
    const d = this.dueloEnPantalla();
    if (!d) return;
    const puntos = DuelosManager.puntajeParcial(d.juego);
    switch (d.juego) {
      case 'ahorcado': app.ahorcado.ahorcadoDuelo = null; break;
      case 'wordle': app.wordle.wordleDuelo = null; break;
      case 'termina': app.termina.terminaDuelo = null; break;
      case 'adivina': app.adivina.adivinaDuelo = null; break;
      case 'preguntados':
        app.preguntados.pregDuelo = null;
        if (app.preguntados.pregState) clearInterval(app.preguntados.pregState.timer);
        break;
      case 'sopa':
        app.sopa.sopaDuelo = null;
        if (app.sopa.sopaState) clearInterval(app.sopa.sopaState.timer);
        break;
      case 'runner':
        if (typeof stopRunner === 'function') stopRunner();
        break;
    }
    this.finalizarDueloConPuntaje(d.id, puntos);
  }

  // Si hay un duelo en juego y se quiere ir a otra sección, muestra el
  // cartel de confirmación y devuelve true (goTo no sigue). Si confirma, se
  // manda el puntaje que llevaba y recién ahí navega.
  pedirConfirmacionSalida(destino) {
    const d = this.dueloEnPantalla();
    if (!d || destino === d.juego) return false;
    // El runner sigue corriendo atrás del cartel: se pausa mientras decide.
    const pausamosRunner =
      d.juego === 'runner' && typeof runnerEnPausa === 'function' && !runnerEnPausa() && typeof pauseRunner === 'function';
    if (pausamosRunner) pauseRunner();
    this.mostrarConfirmacionSalida(
      () => {
        this.abandonarDuelo(); // si el juego terminó mientras decidía, no hace nada
        app.navegacion.goTo(destino, { forzar: true });
      },
      () => {
        if (pausamosRunner && typeof resumeRunner === 'function') resumeRunner();
      },
    );
    return true;
  }

  mostrarConfirmacionSalida(alSalir, alQuedarse) {
    let overlay = document.getElementById('dueloSalirOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'dueloSalirOverlay';
      overlay.className = 'duelo-overlay';
      overlay.innerHTML = `
      <div class="modal-bg-blur"></div>
      <div class="duelo-card duelo-result-card">
        <div class="duelo-result-title">¿Salir del duelo?</div>
        <p class="duelo-result-desc">Si salís ahora, el duelo termina y se envía el puntaje que llevás hasta este momento.</p>
        <div class="duelo-result-buttons">
          <button class="btn-play duelo-btn-secondary" data-accion="quedarse">Seguir jugando</button>
          <button class="btn-play" data-accion="salir">Salir</button>
        </div>
      </div>`;
      document.body.appendChild(overlay);
    }
    overlay.onclick = (e) => {
      const accion = e.target.closest('[data-accion]')?.dataset.accion;
      if (!accion) return;
      overlay.classList.remove('show');
      if (accion === 'salir') alSalir();
      else alQuedarse();
    };
    overlay.classList.add('show');
  }

  // Manda el puntaje final de un duelo al backend y muestra el resultado
  // (o un aviso de "esperando al rival" si todavía no jugó su parte).
  async finalizarDueloConPuntaje(dueloId, puntos) {
    this.dueloActivo = null;
    try {
      const resultado = await app.api.apiFetch(`/api/duelos/${dueloId}/resultado`, {
        method: 'POST',
        body: JSON.stringify({
          puntos: Math.round(puntos),
        }),
      });
      this.mostrarResultadoDuelo(resultado);
    } catch (error) {
      app.utils.mostrarToast(error.message || 'No se pudo guardar el resultado del duelo', 'error');
    }
  }

  // Arma un "lado" del VS (avatar + nombre + puntos), resaltado con un
  // borde dorado y una corona si es el ganador.
  ladoVsDuelo(avatar, nombre, puntos, esGanador) {
    return `
    <div class="duelo-vs-lado${esGanador ? ' es-ganador' : ''}">
      ${esGanador ? `<span class="duelo-vs-corona">${app.utils.uiIconSVG('crown', 18)}</span>` : ''}
      <span class="duelo-vs-avatar">${app.amigos.avatarValueHTML(avatar, nombre)}</span>
      <span class="duelo-vs-nombre">${app.utils.sanitizeHTML(nombre || '')}</span>
      <span class="duelo-vs-puntos">${puntos}</span>
    </div>`;
  }

  // Cartel final del duelo: ganador y VS con ícono, nombre y puntaje de cada
  // uno. Si el rival no jugó todavía, muestra el aviso de espera.
  mostrarResultadoDuelo(d) {
    const overlay = document.getElementById('duelResultOverlay');
    const title = document.getElementById('duelResultTitle');
    const vsBox = document.getElementById('duelResultVs');
    const desc = document.getElementById('duelResultDesc');
    const btnRevancha = document.getElementById('duelResultRevanchaBtn');
    if (!overlay) return;
    const yo = d.yo || {
      username: 'Vos',
    };
    const oponente = d.oponente || {};
    if (d.estado !== 'finalizado') {
      if (title) title.textContent = '¡Puntaje enviado!';
      if (vsBox) {
        vsBox.innerHTML =
          this.ladoVsDuelo(yo.avatar, yo.username, d.misPuntos ?? 0, false) +
          `<div class="duelo-vs-centro">VS</div>` +
          this.ladoVsDuelo(oponente.avatar, oponente.username, '?', false);
      }
      if (desc)
        desc.textContent = `Apenas ${app.utils.sanitizeHTML(oponente.username || '')} juegue su parte vas a ver quién ganó.`;
      if (btnRevancha) btnRevancha.style.display = 'none';
    } else {
      const gano = d.resultado === 'gano';
      const empato = d.resultado === 'empate';
      if (title) title.textContent = empato ? '¡Empate!' : gano ? '¡Ganaste el duelo!' : 'Perdiste el duelo';
      if (vsBox) {
        vsBox.innerHTML =
          this.ladoVsDuelo(yo.avatar, yo.username, d.misPuntos ?? 0, gano) +
          `<div class="duelo-vs-centro">VS</div>` +
          this.ladoVsDuelo(oponente.avatar, oponente.username, d.puntosOponente ?? 0, !gano && !empato);
      }
      if (desc) desc.textContent = '¿Querés revancha?';
      if (gano)
        app.logros.actualizarProgresoParcial('general', {
          duelosGanados: 1,
        });
      if (btnRevancha) {
        btnRevancha.style.display = '';
        btnRevancha.onclick = () => this.cerrarResultadoDuelo(true, d.id);
      }
    }
    overlay.classList.add('show');
  }

  cerrarResultadoDuelo(revancha, dueloId) {
    const overlay = document.getElementById('duelResultOverlay');
    if (overlay) overlay.classList.remove('show');
    if (revancha && dueloId) this.revanchaDuelo(dueloId);
    app.navegacion.goTo('amigos');
    app.amigos.mostrarTabAmigos('duelos');
  }
}

// LogrosManager — Definición, progreso, sincronización y render de los logros. (app.logros)
class LogrosManager extends Modulo {
  // Logros: definición, guardado (localStorage + backend) y chequeo automático.
  // Juegos disponibles para filtrar la lista de logros.
  static LOGROS_JUEGOS = [
    {
      id: 'sopa',
      nombre: 'Sopa de Letras',
    },
    {
      id: 'preguntados',
      nombre: 'Preguntados',
    },
    {
      id: 'termina',
      nombre: 'Termina la Palabra',
    },
    {
      id: 'ahorcado',
      nombre: 'Ahorcado',
    },
    {
      id: 'wordle',
      nombre: 'Adivina la Palabra',
    },
    {
      id: 'adivina',
      nombre: 'Adivina la Cosa',
    },
    {
      id: 'runner',
      nombre: 'Pixel Runner',
    },
    {
      id: 'castle_escape',
      nombre: 'Castle Escape',
    },
    {
      id: 'rpg_pixel',
      nombre: 'RPG Pixel',
    },
    {
      id: 'general',
      nombre: 'Generales',
    },
    {
      id: 'pixel_survi',
      nombre: 'Pixel Survi',
    },
  ];
  // Los 50 logros. `check(stats)` recibe las estadísticas acumuladas del
  // jugador (ver getLogrosStats) y devuelve true/false según si ya se
  // cumplió la condición del logro.
  static ACHIEVEMENTS = [
    // ── Generales (5) ──
    {
      id: 'general_primer_juego',
      juego: 'general',
      icon: '🎮',
      nombre: 'Primeros pasos',
      desc: 'Jugá tu primer minijuego.',
      check: (s) => (s.partidasJugadas || 0) >= 1,
    },
    {
      id: 'general_los_9',
      juego: 'general',
      icon: '🕹️',
      nombre: 'Explorador',
      desc: 'Jugá los 9 minijuegos al menos una vez.',
      check: (s) => (s.juegosJugados || []).length >= 9,
    },
    {
      id: 'general_primer_amigo',
      juego: 'general',
      icon: '🤝',
      nombre: 'Nuevo amigo',
      desc: 'Agregá tu primer amigo.',
      check: (s) => (s.amigosAgregados || 0) >= 1,
    },
    {
      id: 'general_primer_duelo',
      juego: 'general',
      icon: '⚔️',
      nombre: 'Primer duelo',
      desc: 'Ganá tu primer duelo contra un amigo.',
      check: (s) => (s.duelosGanados || 0) >= 1,
    },
    {
      id: 'general_racha_semanal',
      juego: 'general',
      icon: '🔥',
      nombre: 'Jugador constante',
      desc: 'Iniciá sesión 7 días seguidos.',
      check: (s) => (s.diasSeguidos || 0) >= 7,
    },
    // ── Sopa de Letras (5) ──
    {
      id: 'sopa_primera',
      juego: 'sopa',
      icon: '🔍',
      nombre: 'Primera sopa',
      desc: 'Completá tu primera Sopa de Letras.',
      check: (s) => (s.sopa_completadas || 0) >= 1,
    },
    {
      id: 'sopa_veloz',
      juego: 'sopa',
      icon: '⏱️',
      nombre: 'Rayo veloz',
      desc: 'Encontrá todas las palabras con más de la mitad del tiempo restante.',
      check: (s) => (s.sopa_veloz || 0) >= 1,
    },
    {
      id: 'sopa_5',
      juego: 'sopa',
      icon: '🧩',
      nombre: 'Buscador',
      desc: 'Completá 5 Sopas de Letras.',
      check: (s) => (s.sopa_completadas || 0) >= 5,
    },
    {
      id: 'sopa_20',
      juego: 'sopa',
      icon: '🏆',
      nombre: 'Maestro de la sopa',
      desc: 'Completá 20 Sopas de Letras.',
      check: (s) => (s.sopa_completadas || 0) >= 20,
    },
    {
      id: 'sopa_tematicas',
      juego: 'sopa',
      icon: '🎭',
      nombre: 'Todo terreno',
      desc: 'Completá una Sopa en cada temática.',
      check: (s) => (s.sopa_tematicas || []).length >= 4,
    },
    {
      id: 'sopa_racha3',
      juego: 'sopa',
      icon: '🔥',
      nombre: 'Racha ganadora',
      desc: 'Completá 3 Sopas seguidas antes de que se acabe el tiempo.',
      check: (s) => (s.sopa_racha_max || 0) >= 3,
    },
    {
      id: 'sopa_sinerrores',
      juego: 'sopa',
      icon: '✨',
      nombre: 'Mano firme',
      desc: 'Completá una Sopa sin marcar ninguna selección incorrecta.',
      check: (s) => (s.sopa_sinerrores || 0) >= 1,
    },
    {
      id: 'sopa_1000',
      juego: 'sopa',
      icon: '💎',
      nombre: 'Puntaje alto',
      desc: 'Conseguí 1000 puntos o más en una sola partida.',
      check: (s) => (s.sopa_maxScore_best || 0) >= 1000,
    },
    {
      id: 'sopa_50',
      juego: 'sopa',
      icon: '🌟',
      nombre: 'Leyenda de la sopa',
      desc: 'Completá 50 Sopas de Letras.',
      check: (s) => (s.sopa_completadas || 0) >= 50,
    },
    {
      id: 'sopa_relampago',
      juego: 'sopa',
      icon: '⚡',
      nombre: 'Relámpago',
      desc: 'Encontrá todas las palabras con 90 segundos o más de sobra.',
      check: (s) => (s.sopa_relampago || 0) >= 1,
    },
    // ── Preguntados (5) ──
    {
      id: 'preg_primera',
      juego: 'preguntados',
      icon: '❓',
      nombre: 'Primera trivia',
      desc: 'Completá tu primera ronda de Preguntados.',
      check: (s) => (s.preg_completadas || 0) >= 1,
    },
    {
      id: 'preg_perfecta',
      juego: 'preguntados',
      icon: '💯',
      nombre: 'Ronda perfecta',
      desc: 'Contestá todas las preguntas correctas en una ronda.',
      check: (s) => (s.preg_perfectas || 0) >= 1,
    },
    {
      id: 'preg_50',
      juego: 'preguntados',
      icon: '🧠',
      nombre: 'Cerebrito',
      desc: 'Acumulá 50 respuestas correctas en total.',
      check: (s) => (s.preg_correctas || 0) >= 50,
    },
    {
      id: 'preg_racha',
      juego: 'preguntados',
      icon: '🔥',
      nombre: 'Racha ganadora',
      desc: 'Encadená 10 respuestas correctas seguidas.',
      check: (s) => (s.preg_racha_max || 0) >= 10,
    },
    {
      id: 'preg_tematicas',
      juego: 'preguntados',
      icon: '🎭',
      nombre: 'Todo terreno',
      desc: 'Jugá Preguntados en las 4 temáticas.',
      check: (s) => (s.preg_tematicas || []).length >= 4,
    },
    {
      id: 'preg_100',
      juego: 'preguntados',
      icon: '🧠',
      nombre: 'Enciclopedia',
      desc: 'Acumulá 100 respuestas correctas en total.',
      check: (s) => (s.preg_correctas || 0) >= 100,
    },
    {
      id: 'preg_racha15',
      juego: 'preguntados',
      icon: '🔥',
      nombre: 'Imparable',
      desc: 'Encadená 15 respuestas correctas seguidas.',
      check: (s) => (s.preg_racha_max || 0) >= 15,
    },
    {
      id: 'preg_10rondas',
      juego: 'preguntados',
      icon: '📊',
      nombre: 'Veterano',
      desc: 'Completá 10 rondas de Preguntados.',
      check: (s) => (s.preg_completadas || 0) >= 10,
    },
    {
      id: 'preg_perfectas5',
      juego: 'preguntados',
      icon: '🏅',
      nombre: 'Sin fallar',
      desc: 'Conseguí 5 rondas perfectas.',
      check: (s) => (s.preg_perfectas || 0) >= 5,
    },
    {
      id: 'preg_veloz',
      juego: 'preguntados',
      icon: '⚡',
      nombre: 'Reflejos rápidos',
      desc: 'Contestá correctamente apenas empieza el tiempo.',
      check: (s) => (s.preg_veloz || 0) >= 1,
    },
    // ── Termina la Palabra (5) ──
    {
      id: 'termina_primera',
      juego: 'termina',
      icon: '🔤',
      nombre: 'Primera palabra',
      desc: 'Completá tu primera palabra.',
      check: (s) => (s.termina_completadas || 0) >= 1,
    },
    {
      id: 'termina_1intento',
      juego: 'termina',
      icon: '🎯',
      nombre: 'Puntería',
      desc: 'Adiviná una palabra en el primer intento.',
      check: (s) => (s.termina_1intento || 0) >= 1,
    },
    {
      id: 'termina_10',
      juego: 'termina',
      icon: '📚',
      nombre: 'Buen vocabulario',
      desc: 'Completá 10 palabras.',
      check: (s) => (s.termina_completadas || 0) >= 10,
    },
    {
      id: 'termina_racha',
      juego: 'termina',
      icon: '🔥',
      nombre: 'Racha ganadora',
      desc: 'Completá 5 palabras seguidas sin agotar los intentos.',
      check: (s) => (s.termina_racha_max || 0) >= 5,
    },
    {
      id: 'termina_tematicas',
      juego: 'termina',
      icon: '🎭',
      nombre: 'Todo terreno',
      desc: 'Jugá en las 4 temáticas.',
      check: (s) => (s.termina_tematicas || []).length >= 4,
    },
    {
      id: 'termina_25',
      juego: 'termina',
      icon: '🌟',
      nombre: 'Erudito',
      desc: 'Completá 25 palabras.',
      check: (s) => (s.termina_completadas || 0) >= 25,
    },
    {
      id: 'termina_racha10',
      juego: 'termina',
      icon: '🔥',
      nombre: 'Imparable',
      desc: 'Completá 10 palabras seguidas sin agotar los intentos.',
      check: (s) => (s.termina_racha_max || 0) >= 10,
    },
    {
      id: 'termina_eficiente',
      juego: 'termina',
      icon: '🎯',
      nombre: 'Eficiente',
      desc: 'Adiviná 5 palabras usando como máximo 2 intentos.',
      check: (s) => (s.termina_eficientes || 0) >= 5,
    },
    {
      id: 'termina_larga',
      juego: 'termina',
      icon: '📏',
      nombre: 'Palabra larga',
      desc: 'Adiviná una palabra de 10 letras o más.',
      check: (s) => (s.termina_palabraLarga || 0) >= 1,
    },
    {
      id: 'termina_ultimomomento',
      juego: 'termina',
      icon: '😅',
      nombre: 'Al filo',
      desc: 'Adiviná una palabra en tu último intento disponible.',
      check: (s) => (s.termina_ultimoMomento || 0) >= 1,
    },
    // ── Ahorcado (5) ──
    {
      id: 'ahorcado_primera',
      juego: 'ahorcado',
      icon: '💀',
      nombre: 'Primera horca',
      desc: 'Ganá tu primera partida de Ahorcado.',
      check: (s) => (s.ahorcado_ganadas || 0) >= 1,
    },
    {
      id: 'ahorcado_perfecto',
      juego: 'ahorcado',
      icon: '✨',
      nombre: 'Sin errores',
      desc: 'Ganá una partida sin cometer ningún error.',
      check: (s) => (s.ahorcado_perfectas || 0) >= 1,
    },
    {
      id: 'ahorcado_10',
      juego: 'ahorcado',
      icon: '🏆',
      nombre: 'Verdugo experto',
      desc: 'Ganá 10 partidas.',
      check: (s) => (s.ahorcado_ganadas || 0) >= 10,
    },
    {
      id: 'ahorcado_tematicas',
      juego: 'ahorcado',
      icon: '🎭',
      nombre: 'Todo terreno',
      desc: 'Ganá en las 4 temáticas (o Normal).',
      check: (s) => (s.ahorcado_tematicas || []).length >= 4,
    },
    {
      id: 'ahorcado_racha',
      juego: 'ahorcado',
      icon: '🔥',
      nombre: 'Racha ganadora',
      desc: 'Ganá 5 partidas seguidas.',
      check: (s) => (s.ahorcado_racha_max || 0) >= 5,
    },
    {
      id: 'ahorcado_25',
      juego: 'ahorcado',
      icon: '🌟',
      nombre: 'Verdugo legendario',
      desc: 'Ganá 25 partidas.',
      check: (s) => (s.ahorcado_ganadas || 0) >= 25,
    },
    {
      id: 'ahorcado_racha10',
      juego: 'ahorcado',
      icon: '🔥',
      nombre: 'Imparable',
      desc: 'Ganá 10 partidas seguidas.',
      check: (s) => (s.ahorcado_racha_max || 0) >= 10,
    },
    {
      id: 'ahorcado_perfectas5',
      juego: 'ahorcado',
      icon: '💯',
      nombre: 'Precisión total',
      desc: 'Ganá 5 partidas sin cometer ningún error.',
      check: (s) => (s.ahorcado_perfectas || 0) >= 5,
    },
    {
      id: 'ahorcado_casiperfecto',
      juego: 'ahorcado',
      icon: '🎯',
      nombre: 'Casi perfecto',
      desc: 'Ganá una partida cometiendo como máximo 1 error.',
      check: (s) => (s.ahorcado_casiPerfectas || 0) >= 1,
    },
    {
      id: 'ahorcado_maratonista',
      juego: 'ahorcado',
      icon: '🏃',
      nombre: 'Maratonista',
      desc: 'Jugá 15 partidas de Ahorcado.',
      check: (s) => (s.ahorcado_partidas || 0) >= 15,
    },
    // ── Adivina la Palabra / Wordle (5) ──
    {
      id: 'wordle_primera',
      juego: 'wordle',
      icon: '🟩',
      nombre: 'Primera palabra',
      desc: 'Adiviná tu primera palabra.',
      check: (s) => (s.wordle_ganadas || 0) >= 1,
    },
    {
      id: 'wordle_1intento',
      juego: 'wordle',
      icon: '🎯',
      nombre: 'De un solo tiro',
      desc: 'Adiviná una palabra en el primer intento.',
      check: (s) => (s.wordle_1intento || 0) >= 1,
    },
    {
      id: 'wordle_10',
      juego: 'wordle',
      icon: '📚',
      nombre: 'Letrado',
      desc: 'Adiviná 10 palabras.',
      check: (s) => (s.wordle_ganadas || 0) >= 10,
    },
    {
      id: 'wordle_racha',
      juego: 'wordle',
      icon: '🔥',
      nombre: 'Racha ganadora',
      desc: 'Ganá 5 partidas seguidas.',
      check: (s) => (s.wordle_racha_max || 0) >= 5,
    },
    {
      id: 'wordle_25',
      juego: 'wordle',
      icon: '🏆',
      nombre: 'Maestro del wordle',
      desc: 'Adiviná 25 palabras en total.',
      check: (s) => (s.wordle_ganadas || 0) >= 25,
    },
    {
      id: 'wordle_50',
      juego: 'wordle',
      icon: '🌟',
      nombre: 'Leyenda del wordle',
      desc: 'Adiviná 50 palabras en total.',
      check: (s) => (s.wordle_ganadas || 0) >= 50,
    },
    {
      id: 'wordle_racha10',
      juego: 'wordle',
      icon: '🔥',
      nombre: 'Imparable',
      desc: 'Ganá 10 partidas seguidas.',
      check: (s) => (s.wordle_racha_max || 0) >= 10,
    },
    {
      id: 'wordle_eficiente',
      juego: 'wordle',
      icon: '🎯',
      nombre: 'Eficiente',
      desc: 'Adiviná 5 palabras en 2 intentos o menos.',
      check: (s) => (s.wordle_eficientes || 0) >= 5,
    },
    {
      id: 'wordle_larga',
      juego: 'wordle',
      icon: '📏',
      nombre: 'Palabra larga',
      desc: 'Adiviná una palabra de 8 letras o más.',
      check: (s) => (s.wordle_palabraLarga || 0) >= 1,
    },
    {
      id: 'wordle_tematicas',
      juego: 'wordle',
      icon: '🎭',
      nombre: 'Todo terreno',
      desc: 'Jugá Adivina la Palabra en las 4 temáticas.',
      check: (s) => (s.wordle_tematicas || []).length >= 4,
    },
    // ── Adivina la Cosa (5) ──
    {
      id: 'adivina_primera',
      juego: 'adivina',
      icon: '🕵️',
      nombre: 'Primer acierto',
      desc: 'Acertá tu primera respuesta.',
      check: (s) => (s.adivina_aciertos || 0) >= 1,
    },
    {
      id: 'adivina_sinpistas',
      juego: 'adivina',
      icon: '🧐',
      nombre: 'Ojo clínico',
      desc: 'Acertá sin usar ninguna pista.',
      check: (s) => (s.adivina_sinpistas || 0) >= 1,
    },
    {
      id: 'adivina_10',
      juego: 'adivina',
      icon: '🔎',
      nombre: 'Detective',
      desc: 'Acertá 10 veces.',
      check: (s) => (s.adivina_aciertos || 0) >= 10,
    },
    {
      id: 'adivina_1pista',
      juego: 'adivina',
      icon: '🎯',
      nombre: 'Pista certera',
      desc: 'Acertá usando una sola pista.',
      check: (s) => (s.adivina_1pista || 0) >= 1,
    },
    {
      id: 'adivina_25',
      juego: 'adivina',
      icon: '🏆',
      nombre: 'Sabelotodo',
      desc: 'Acertá 25 veces en total.',
      check: (s) => (s.adivina_aciertos || 0) >= 25,
    },
    {
      id: 'adivina_50',
      juego: 'adivina',
      icon: '🌟',
      nombre: 'Leyenda',
      desc: 'Acertá 50 veces en total.',
      check: (s) => (s.adivina_aciertos || 0) >= 50,
    },
    {
      id: 'adivina_racha5',
      juego: 'adivina',
      icon: '🔥',
      nombre: 'Racha ganadora',
      desc: 'Acertá 5 veces seguidas sin rendirte.',
      check: (s) => (s.adivina_racha_max || 0) >= 5,
    },
    {
      id: 'adivina_rondaperfecta',
      juego: 'adivina',
      icon: '✨',
      nombre: 'Ronda perfecta',
      desc: 'Completá una ronda entera sin usar ninguna pista.',
      check: (s) => (s.adivina_rondasPerfectas || 0) >= 1,
    },
    {
      id: 'adivina_tematicas',
      juego: 'adivina',
      icon: '🎭',
      nombre: 'Todo terreno',
      desc: 'Jugá Adivina la Cosa en las 4 temáticas.',
      check: (s) => (s.adivina_tematicas || []).length >= 4,
    },
    {
      id: 'adivina_10rondas',
      juego: 'adivina',
      icon: '📊',
      nombre: 'Veterano',
      desc: 'Completá 10 rondas de Adivina la Cosa.',
      check: (s) => (s.adivina_rondasCompletadas || 0) >= 10,
    },
    // ── Pixel Runner (5) ──
    {
      id: 'runner_500',
      juego: 'runner',
      icon: '🏃',
      nombre: 'Primeros pasos',
      desc: 'Alcanzá los 500 puntos en una carrera.',
      check: (s) => (s.runner_maxScore_best || 0) >= 500,
    },
    {
      id: 'runner_historia',
      juego: 'runner',
      icon: '📖',
      nombre: 'Fin de la historia',
      desc: 'Completá el modo Historia (2500 puntos).',
      check: (s) => !!s.runner_historiaCompleta,
    },
    {
      id: 'runner_infinito',
      juego: 'runner',
      icon: '♾️',
      nombre: 'Sin límites',
      desc: 'Desbloqueá el modo Infinito.',
      check: (s) => !!s.runner_infinitoDesbloqueado,
    },
    {
      id: 'runner_10000',
      juego: 'runner',
      icon: '🚀',
      nombre: 'Imparable',
      desc: 'Alcanzá los 10.000 puntos en modo Infinito.',
      check: (s) => (s.runner_maxScoreInfinito_best || 0) >= 10000,
    },
    {
      id: 'runner_monedas',
      juego: 'runner',
      icon: '🪙',
      nombre: 'Coleccionista',
      desc: 'Juntá 100 monedas en total.',
      check: (s) => (s.runner_monedasTotal || 0) >= 100,
    },
    // ── Castle Escape (5) ──
    {
      id: 'castle_nivel1',
      juego: 'castle_escape',
      icon: '🏰',
      nombre: 'Primer paso',
      desc: 'Completá el nivel 1.',
      check: (s) => (s.castle_nivelesCompletados || []).includes(1),
    },
    {
      id: 'castle_3estrellas',
      juego: 'castle_escape',
      icon: '⭐',
      nombre: 'Perfección',
      desc: 'Conseguí 3 estrellas en un nivel.',
      check: (s) => (s.castle_3estrellas || 0) >= 1,
    },
    {
      id: 'castle_10niveles',
      juego: 'castle_escape',
      icon: '🗝️',
      nombre: 'A mitad de camino',
      desc: 'Completá 10 niveles.',
      check: (s) => (s.castle_nivelesCompletados || []).length >= 10,
    },
    {
      id: 'castle_20niveles',
      juego: 'castle_escape',
      icon: '🏆',
      nombre: 'Fuera del castillo',
      desc: 'Completá los 20 niveles.',
      check: (s) => (s.castle_nivelesCompletados || []).length >= 20,
    },
    {
      id: 'castle_sinmuertes',
      juego: 'castle_escape',
      icon: '✨',
      nombre: 'Intacto',
      desc: 'Completá un nivel sin morir.',
      check: (s) => (s.castle_sinMuertes || 0) >= 1,
    },
    // ── RPG Pixel (5) ──
    {
      id: 'rpg_primerjefe',
      juego: 'rpg_pixel',
      icon: '🗡️',
      nombre: 'Primer jefe caído',
      desc: 'Vencé a tu primer jefe.',
      check: (s) => (s.rpg_jefesVencidos || 0) >= 1,
    },
    {
      id: 'rpg_capitulo1',
      juego: 'rpg_pixel',
      icon: '📜',
      nombre: 'Capítulo 1',
      desc: 'Completá el Capítulo 1.',
      check: (s) => (s.rpg_capitulosCompletados || []).includes(1),
    },
    {
      id: 'rpg_cofreoro',
      juego: 'rpg_pixel',
      icon: '💰',
      nombre: 'Fortuna',
      desc: 'Abrí tu primer cofre de oro.',
      check: (s) => (s.rpg_cofresOro || 0) >= 1,
    },
    {
      id: 'rpg_elite',
      juego: 'rpg_pixel',
      icon: '👑',
      nombre: 'Modo Elite',
      desc: 'Completá una partida en dificultad Elite.',
      check: (s) => !!s.rpg_eliteCompletado,
    },
    {
      id: 'rpg_powerups',
      juego: 'rpg_pixel',
      icon: '🧪',
      nombre: 'Alquimista',
      desc: 'Desbloqueá los 8 power-ups distintos.',
      check: (s) => (s.rpg_powerupsUnicos || []).length >= 8,
    },
  ];
  constructor() {
    super();
    this.logrosFiltroActivo = 'todos';
  }

  // Logros obtenidos: localStorage + sincronización con GET/POST /api/logros.
  getLogrosObtenidos() {
    try {
      return JSON.parse(localStorage.getItem('unigames_logros')) || [];
    } catch {
      return [];
    }
  }

  guardarLogrosObtenidos(lista) {
    localStorage.setItem('unigames_logros', JSON.stringify(lista));
  }

  // Se llama al iniciar sesión (o al cargar la app con un token guardado):
  // trae los logros ya desbloqueados en el servidor y los mezcla con los
  // que hubiera localmente (por si se jugó sin conexión), sin perder ninguno.
  async sincronizarLogrosConBackend() {
    if (!localStorage.getItem('unigames_token')) return;
    try {
      const remotos = await app.api.apiFetch('/api/logros');
      const idsRemotos = remotos.map((l) => l.logro_id);
      const locales = this.getLogrosObtenidos();
      const combinados = Array.from(new Set([...locales, ...idsRemotos]));
      this.guardarLogrosObtenidos(combinados);

      // Si había logros locales que el servidor todavía no tenía (jugados
      // sin conexión), los subimos.
      const faltantesEnServidor = locales.filter((id) => !idsRemotos.includes(id));
      for (const id of faltantesEnServidor) {
        this.enviarLogroBackend(id);
      }
      if (document.getElementById('sec-logros')?.classList.contains('active')) {
        this.renderLogros(this.logrosFiltroActivo);
      }
    } catch (error) {
      console.error('Error al sincronizar logros:', error);
    }
  }

  // Avisa al backend que se desbloqueó un logro. Se llama "en segundo
  // plano": si falla (sin conexión, sin sesión) no interrumpe el juego,
  // el logro ya quedó guardado localmente.
  async enviarLogroBackend(id) {
    if (!localStorage.getItem('unigames_token')) return;
    try {
      await app.api.apiFetch('/api/logros', {
        method: 'POST',
        body: JSON.stringify({
          logro_id: id,
        }),
      });
    } catch (error) {
      console.error('Error al guardar el logro en el servidor:', error);
    }
  }

  getLogrosStats() {
    try {
      return JSON.parse(localStorage.getItem('unigames_logros_stats')) || {};
    } catch {
      return {};
    }
  }

  guardarLogrosStats(stats) {
    localStorage.setItem('unigames_logros_stats', JSON.stringify(stats));
  }

  // Combina un patch con las stats: números se suman, "_best" guarda el máximo,
  // arrays se unen sin duplicar, "_racha" lleva racha actual y máxima
  // (true suma 1, false la corta).
  aplicarPatchLogros(patch) {
    const stats = this.getLogrosStats();
    Object.entries(patch).forEach(([key, val]) => {
      if (key.endsWith('_racha')) {
        const actualKey = key + '_actual';
        const maxKey = key + '_max';
        stats[actualKey] = val ? (stats[actualKey] || 0) + 1 : 0;
        stats[maxKey] = Math.max(stats[maxKey] || 0, stats[actualKey]);
      } else if (Array.isArray(val)) {
        stats[key] = Array.from(new Set([...(stats[key] || []), ...val]));
      } else if (key.endsWith('_best') && typeof val === 'number') {
        stats[key] = Math.max(stats[key] || 0, val);
      } else if (typeof val === 'number') {
        stats[key] = (stats[key] || 0) + val;
      } else {
        stats[key] = val;
      }
    });
    this.guardarLogrosStats(stats);
    return stats;
  }

  // Revisa los logros de un juego (+ los generales) contra las stats
  // actuales y desbloquea los que ya se cumplen.
  revisarLogros(juegoId) {
    const stats = this.getLogrosStats();
    LogrosManager.ACHIEVEMENTS.filter((a) => a.juego === juegoId || a.juego === 'general').forEach((a) => {
      if (a.check(stats)) this.desbloquearLogro(a.id);
    });
  }

  // Cada minijuego lo llama una vez por partida terminada con su patch de
  // stats. Sin sesión no se guarda progreso de logros.
  registrarProgresoJuego(juegoId, patch = {}) {
    if (!app.auth.currentUser) return;
    const stats = this.getLogrosStats();
    stats.partidasJugadas = (stats.partidasJugadas || 0) + 1;
    stats.juegosJugados = stats.juegosJugados || [];
    if (!stats.juegosJugados.includes(juegoId)) stats.juegosJugados.push(juegoId);
    this.guardarLogrosStats(stats);
    this.aplicarPatchLogros(patch);
    this.revisarLogros(juegoId);
  }

  // Igual que registrarProgresoJuego pero para actualizar stats a mitad de
  // partida (por ejemplo, cada acierto de Preguntados o cada item de Adivina
  // la Cosa) sin sumar una "partida jugada" extra por cada actualización.
  actualizarProgresoParcial(juegoId, patch = {}) {
    if (!app.auth.currentUser) return;
    this.aplicarPatchLogros(patch);
    this.revisarLogros(juegoId);
  }

  // Marca un logro como obtenido (si no lo estaba) y avisa al usuario.
  // Requiere cuenta: sin sesión no se guarda nada (ver banner de la
  // sección Logros).
  desbloquearLogro(id) {
    if (!app.auth.currentUser) return;
    const obtenidos = this.getLogrosObtenidos();
    if (obtenidos.includes(id)) return;
    obtenidos.push(id);
    this.guardarLogrosObtenidos(obtenidos);
    this.enviarLogroBackend(id);
    const def = LogrosManager.ACHIEVEMENTS.find((a) => a.id === id);
    if (def) this.mostrarToastLogro(def);
    if (document.getElementById('sec-logros')?.classList.contains('active')) {
      this.renderLogros(this.logrosFiltroActivo);
    }
  }

  // Pequeño aviso no bloqueante cuando se desbloquea un logro.
  mostrarToastLogro(def) {
    const toast = document.createElement('div');
    toast.className = 'logro-toast';
    toast.innerHTML = `<span class="logro-toast-icon">${def.icon}</span>
    <div><div class="logro-toast-title">¡Logro desbloqueado!</div><div class="logro-toast-name">${app.utils.sanitizeHTML(def.nombre)}</div></div>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // ─── Render de la pantalla de Logros ───
  renderLogrosProgreso() {
    const obtenidos = this.getLogrosObtenidos();
    const total = LogrosManager.ACHIEVEMENTS.length;
    const countEl = document.getElementById('logrosProgressCount');
    if (countEl) countEl.textContent = String(obtenidos.length).padStart(2, '0') + '/' + total;
    const fill = document.getElementById('logrosProgressFill');
    if (fill) fill.style.width = (total ? (obtenidos.length / total) * 100 : 0) + '%';
  }

  renderLogrosTabs() {
    const wrap = document.getElementById('logrosGameTabs');
    if (!wrap) return;
    wrap.innerHTML =
      `<button class="logro-tab active" data-juego="todos" onclick="renderLogros('todos', this)">${app.utils.gameIconSVG('todos', 15)} Todos</button>` +
      LogrosManager.LOGROS_JUEGOS.map(
        (j) =>
          `<button class="logro-tab" data-juego="${j.id}" onclick="renderLogros('${j.id}', this)">${app.utils.gameIconSVG(j.id, 15)} ${j.nombre}</button>`,
      ).join('');
  }

  renderLogros(filtro, btn) {
    this.logrosFiltroActivo = filtro || 'todos';
    if (btn) {
      document.querySelectorAll('.logro-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    }
    const obtenidos = this.getLogrosObtenidos();
    const lista =
      this.logrosFiltroActivo === 'todos'
        ? LogrosManager.ACHIEVEMENTS
        : LogrosManager.ACHIEVEMENTS.filter((a) => a.juego === this.logrosFiltroActivo);
    const box = document.getElementById('logrosList');
    if (!box) return;
    box.innerHTML = lista
      .map((a) => {
        const obtenido = obtenidos.includes(a.id);
        return `
      <div class="achievement-card ${obtenido ? 'obtained' : 'locked'}">
        <div class="achievement-icon">${a.icon}</div>
        <div class="achievement-info">
          <div class="achievement-name">${a.nombre}</div>
          <div class="achievement-desc">${a.desc}</div>
        </div>
        <div class="achievement-status">${obtenido ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Obtenido' : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> No obtenido'}</div>
      </div>`;
      })
      .join('');
  }

  // Se llama al entrar a la pantalla de Logros (desde goTo()). Sin cuenta
  // no se guarda progreso, así que mostramos el cartel de "creá una cuenta"
  // en vez de la lista de logros.
  initLogrosScreen() {
    const banner = document.getElementById('logrosGuestBanner');
    const content = document.getElementById('logrosLoggedContent');
    if (!app.auth.currentUser) {
      if (banner) banner.classList.remove('hidden');
      if (content) content.classList.add('hidden');
      return;
    }
    if (banner) banner.classList.add('hidden');
    if (content) content.classList.remove('hidden');
    this.renderLogrosProgreso();
    this.renderLogrosTabs();
    this.renderLogros('todos');
  }
}

// PerfilManager — Perfil propio y de otros usuarios (ícono, descripción, puntajes). (app.perfil)
class PerfilManager extends Modulo {
  // Íconos de perfil: public/assert/perfil_icons/icon_01..30.webp
  static PERFIL_ICONOS = Array.from(
    {
      length: 30,
    },
    (_, i) => 'assert/perfil_icons/icon_' + String(i + 1).padStart(2, '0') + '.webp',
  );
  // Ícono por defecto para cuentas que todavía no eligieron uno.
  static PERFIL_ICONO_DEFAULT = 'assert/perfil_icons/icon_01.webp';
  constructor() {
    super();
    // Perfil propio (GET/PATCH /api/perfil) y de otros (GET /api/usuarios/:id/perfil).
    // perfilContexto: { modo: 'propio' | 'otro', id, data }
    this.perfilContexto = {
      modo: 'propio',
      id: null,
      data: null,
    };
  }

  // Id de cada juego en la tabla `juegos` del backend (RPG Pixel no guarda puntaje).
  static JUEGO_ID = { sopa: 1, preguntados: 2, termina: 3, ahorcado: 4, adivina: 5, wordle: 6, runner: 7, castle_escape: 8 };

  // Puntaje máximo de la cuenta en cada juego, a partir de los puntajes que
  // manda el backend con el perfil (u.puntajes = [{ juego_id, puntos }]).
  // '—' si nunca jugó ese juego (o si no guarda puntaje).
  puntajesMaximos(u) {
    const porId = {};
    for (const p of u.puntajes || []) porId[p.juego_id] = p.puntos;
    const map = {};
    for (const [clave, id] of Object.entries(PerfilManager.JUEGO_ID)) map[clave] = porId[id] ?? '—';
    return map;
  }

  iniciarEdicionUsuario(currentName) {
    document.getElementById('profileNameContainer').style.display = 'none';
    const editContainer = document.getElementById('profileNameEditContainer');
    editContainer.classList.remove('hidden');
    const input = document.getElementById('profileNameInput');
    input.value = currentName;
    input.focus();
  }

  cancelarEdicionUsuario() {
    document.getElementById('profileNameContainer').style.display = 'flex';
    document.getElementById('profileNameEditContainer').classList.add('hidden');
  }

  async guardarNuevoUsuario() {
    const input = document.getElementById('profileNameInput');
    const newName = input.value.trim();
    if (!newName) return this.cancelarEdicionUsuario();
    if (newName === app.auth.currentUser?.username) return this.cancelarEdicionUsuario();
    try {
      const res = await app.api.apiFetch('/api/perfil/username', {
        method: 'PATCH',
        body: JSON.stringify({
          username: newName,
        }),
      });
      if (res.error) throw new Error(res.error);
      if (res.token) {
        localStorage.setItem('unigames_token', res.token);
        if (app.auth.currentUser) {
          app.auth.currentUser.username = res.username;
          localStorage.setItem('unigames_user', JSON.stringify(app.auth.currentUser));
          const headerName = document.querySelector('.header-username');
          if (headerName) headerName.textContent = res.username;
        }
      }
      this.abrirPerfilPropio(); // reload profile
    } catch (err) {
      alert(err.message);
      input.focus();
    }
  }

  togglePerfilIconPicker() {
    const picker = document.getElementById('perfilIconPicker');
    if (picker) picker.classList.toggle('hidden');
  }

  // PATCH /api/perfil { icono }
  async elegirPerfilIcono(icono) {
    try {
      await app.api.apiFetch('/api/perfil', {
        method: 'PATCH',
        body: JSON.stringify({
          icono,
        }),
      });
      if (this.perfilContexto.data) this.perfilContexto.data.icono = icono;
      this.togglePerfilIconPicker();
      this.renderPerfil();
    } catch (error) {
      alert(error.message || 'No se pudo cambiar el ícono.');
    }
  }

  // PATCH /api/perfil { descripcion }
  async guardarPerfilDescripcion() {
    const input = document.getElementById('perfilDescInput');
    const btn = document.getElementById('perfilDescGuardarBtn');
    if (!input) return;
    const descripcion = input.value.trim();
    try {
      await app.api.apiFetch('/api/perfil', {
        method: 'PATCH',
        body: JSON.stringify({
          descripcion,
        }),
      });
      if (this.perfilContexto.data) this.perfilContexto.data.descripcion = descripcion;
      if (btn) {
        const original = btn.textContent;
        btn.textContent = '✅ Guardado';
        setTimeout(() => {
          btn.textContent = original;
        }, 1500);
      }
    } catch (error) {
      alert(error.message || 'No se pudo guardar la descripción.');
    }
  }

  // Abre el perfil propio (botón "Perfil" del menú de cuenta).
  abrirPerfilPropio() {
    if (!app.auth.currentUser) {
      app.auth.openModal('login');
      return;
    }
    this.perfilContexto = {
      modo: 'propio',
      id: app.auth.currentUser.id,
      data: null,
    };
    app.navegacion.goTo('perfil');
  }

  // Abre el perfil de cualquier usuario por id (propio o de un tercero, el
  // backend decide qué tan detallada es la respuesta según quién pregunta).
  abrirPerfilDeUsuario(id) {
    const esPropio = app.auth.currentUser && Number(id) === app.auth.currentUser.id;
    this.perfilContexto = {
      modo: esPropio ? 'propio' : 'otro',
      id: Number(id),
      data: null,
    };
    app.navegacion.goTo('perfil');
  }

  // Etiqueta y acción del botón de amistad según el estado que devuelve el
  // backend en el campo `amistad` del perfil. Un invitado (sin cuenta) puede
  // ver el perfil, pero no mandar solicitud: se le ofrece iniciar sesión.
  botonAmistadHTML(data) {
    if (!app.auth.currentUser) {
      return `<button class="profile-friend-request-btn" onclick="openModal('login')">${app.utils.uiIconSVG('plus', 14)} Iniciá sesión para agregar</button>`;
    }
    switch (data.amistad) {
      case 'amigos':
        return `<span class="profile-friend-request-btn" style="cursor:default;opacity:.8;">${app.utils.uiIconSVG('users', 14)} Ya son amigos</span>`;
      case 'solicitud_enviada':
        return `<span class="profile-friend-request-btn" style="cursor:default;opacity:.8;">${app.utils.uiIconSVG('check', 14)} Solicitud enviada</span>`;
      case 'solicitud_recibida':
        return `<span class="profile-friend-request-btn" style="cursor:default;opacity:.8;">Te envió una solicitud — revisala en Amigos</span>`;
      default:
        return `<button class="profile-friend-request-btn" onclick="enviarSolicitudAmistad(${data.id}, ${app.utils.jsArg(data.username)})">${app.utils.uiIconSVG('plus', 14)} Solicitud de amistad</button>`;
    }
  }

  // Render de la pantalla de Perfil, sirve tanto para el propio como para
  // el de otro usuario. Usa perfilContexto.data, que llena initPerfilScreen().
  renderPerfil() {
    const box = document.getElementById('perfilBox');
    if (!box) return;
    const u = this.perfilContexto.data;
    if (!u) {
      box.innerHTML =
        '<p style="text-align:center;color:#94A3B8;padding:2rem;">No se encontró el perfil.</p>';
      return;
    }
    const esPropio = this.perfilContexto.modo === 'propio';
    const iconoAMostrar = u.icono || PerfilManager.PERFIL_ICONO_DEFAULT;
    const avatarHTML = app.amigos.avatarValueHTML(iconoAMostrar, u.username);

    const scores = this.puntajesMaximos(u);
    const juegos = LogrosManager.LOGROS_JUEGOS.filter((j) => j.id !== 'general');
    box.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar-wrap">
        <div class="profile-avatar" id="profileAvatarDisplay">${avatarHTML}</div>
        ${esPropio ? `<button class="profile-avatar-edit-btn" onclick="togglePerfilIconPicker()" title="Cambiar ícono"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"></path></svg></button>` : ''}
      </div>
      <div class="profile-header-main">
        <div class="profile-header-info">
          <div class="profile-name-container" id="profileNameContainer" style="display:flex;align-items:center;gap:8px;">
            <div class="profile-name" id="profileNameText">${app.utils.sanitizeHTML(u.username)}</div>
            ${esPropio ? `<button class="profile-name-edit-btn" onclick="iniciarEdicionUsuario(${app.utils.jsArg(u.username)})" title="Cambiar nombre" style="background:none;border:none;color:#94A3B8;cursor:pointer;padding:4px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"></path></svg></button>` : ''}
          </div>
          ${
            esPropio
              ? `
          <div class="profile-name-edit-container hidden" id="profileNameEditContainer" style="display:flex;align-items:center;gap:4px;">
            <input type="text" id="profileNameInput" class="auth-input" style="width:150px;padding:4px 8px;margin:0;font-family:'Press Start 2P', monospace;font-size:clamp(11px, 2vw, 15px);" maxlength="20">
            <button class="btn-play" style="padding:4px 8px;font-size:12px;margin:0;" onclick="guardarNuevoUsuario()">✔️</button>
            <button class="btn-back" style="padding:4px 8px;font-size:12px;margin:0;" onclick="cancelarEdicionUsuario()">❌</button>
          </div>
          `
              : ''
          }
          <div class="profile-name-tag">${esPropio ? 'Tu perfil' : 'Perfil de otro usuario'}</div>
        </div>
        <div class="profile-header-stat">
          <span class="profile-header-stat-value">${u.amigosCount}</span>
          <span class="profile-header-stat-label">${app.utils.uiIconSVG('users', 13)} Amigos</span>
        </div>
        <div class="profile-header-stat">
          <span class="profile-header-stat-value">${String(u.logrosCount).padStart(2, '0')}/${LogrosManager.ACHIEVEMENTS.length}</span>
          <span class="profile-header-stat-label">${app.utils.gameIconSVG('general', 13)} Logros</span>
        </div>
      </div>
      ${!esPropio ? this.botonAmistadHTML(u) : ''}
    </div>

    ${
      esPropio
        ? `
    <div class="profile-icon-picker hidden" id="perfilIconPicker">
      ${PerfilManager.PERFIL_ICONOS.map((ic) => `<button class="profile-icon-option ${ic === iconoAMostrar ? 'selected' : ''}" onclick="elegirPerfilIcono('${ic}')"><img src="${ic}" alt="Ícono"></button>`).join('')}
    </div>
    `
        : ''
    }

    <div class="profile-desc-box">
      ${
        esPropio
          ? `
        <textarea class="profile-desc-textarea" id="perfilDescInput" maxlength="180" placeholder="Escribí algo sobre vos... (lo van a ver tus amigos)">${app.utils.sanitizeHTML(u.descripcion || '')}</textarea>
        <button class="profile-desc-save-btn" id="perfilDescGuardarBtn" onclick="guardarPerfilDescripcion()">Guardar descripción</button>
      `
          : `<p class="profile-desc-text">${app.utils.sanitizeHTML(u.descripcion || 'Todavía no escribió una descripción.')}</p>`
      }
    </div>

    ${
      esPropio || u.amigos === undefined
        ? ''
        : `
    <div class="section-title" style="font-size:12px;margin-top:1.75rem;">Amigos en común / lista de amigos</div>
    <div class="profile-scores-grid">${(u.amigos || []).map((a) => `<div class="profile-score-card">${app.utils.sanitizeHTML(a.username)}</div>`).join('')}</div>
    `
    }

    <div class="section-title" style="font-size:12px;margin-top:1.75rem;">Logros completados</div>
    <div class="achievements-mini-grid" style="display:flex;flex-wrap:wrap;gap:8px;">
      ${
        u.logros.length === 0
          ? '<p style="color:#94A3B8;">Todavía no desbloqueó logros.</p>'
          : u.logros
              .map((id) => {
                const def = LogrosManager.ACHIEVEMENTS.find((a) => a.id === id);
                return def
                  ? `<span class="achievement-icon" title="${app.utils.sanitizeHTML(def.nombre)}" style="font-size:22px;">${def.icon}</span>`
                  : '';
              })
              .join('')
      }
    </div>

    <div class="section-title" style="font-size:12px;margin-top:1.75rem;">Puntuación máxima por minijuego</div>
    <div class="profile-scores-grid">
      ${juegos
        .map(
          (j) => `
        <div class="profile-score-card">
          <div class="profile-score-emoji">${app.utils.gameIconSVG(j.id, 26)}</div>
          <div class="profile-score-name">${j.nombre}</div>
          <div class="profile-score-value">${scores[j.id] ?? '—'}</div>
        </div>
      `,
        )
        .join('')}
    </div>
  `;
  }

  // Se llama al entrar a la pantalla de Perfil (desde goTo()): trae los
  // datos reales del backend y recién ahí renderiza.
  async initPerfilScreen() {
    const box = document.getElementById('perfilBox');
    if (box)
      box.innerHTML = '<p style="text-align:center;color:#94A3B8;padding:2rem;">Cargando perfil...</p>';
    if (!this.perfilContexto.id) {
      this.perfilContexto.data = null;
      this.renderPerfil();
      return;
    }
    try {
      const url =
        this.perfilContexto.modo === 'propio'
          ? '/api/perfil'
          : `/api/usuarios/${this.perfilContexto.id}/perfil`;
      this.perfilContexto.data = await app.api.apiFetch(url);
    } catch (error) {
      console.error('Error al cargar el perfil:', error);
      this.perfilContexto.data = null;
    }
    this.renderPerfil();
  }
}

// Navegacion — Navegación entre secciones, menú hamburguesa y panel de cuenta. (app.navegacion)
class Navegacion extends Modulo {
  constructor() {
    super();
    // ─── Guardar HTML original de secciones que reemplazan su contenido ───
    this.originalSectionHTML = {};
    this.hamburger = app.nucleo.APP_EL.hamburger;
    this.navMenu = app.nucleo.APP_EL.navMenu;
  }

  iniciar() {
    // Los dos menús laterales (nav izquierdo y cuenta derecha) comparten el
    // mismo fondo oscuro y nunca deben quedar abiertos los dos a la vez: al
    // abrir uno, se cierra el otro primero.
    this.hamburger.addEventListener('click', () => {
      const abriendo = !this.navMenu.classList.contains('open');
      this.closeAccountDrawer();
      if (abriendo) {
        this.hamburger.classList.add('open');
        this.navMenu.classList.add('open');
        const backdrop = app.nucleo.APP_EL.drawerBackdrop;
        if (backdrop) backdrop.classList.add('open');
      } else {
        this.closeNav();
      }
    });
  }

  saveOriginalSections() {
    ['preguntados', 'sopa', 'termina'].forEach((id) => {
      const sec = document.getElementById('sec-' + id);
      if (sec) this.originalSectionHTML[id] = sec.innerHTML;
    });
  }

  restoreOriginalSection(id) {
    if (this.originalSectionHTML[id]) {
      const sec = document.getElementById('sec-' + id);
      if (sec) sec.innerHTML = this.originalSectionHTML[id];
    }
  }

  // Calidad gráfica: clase q-low/q-medium/q-high en <html> para que el CSS apague
  // efectos caros (backdrop-filter). Además inserta la fila Bajo/Medio/Alto de
  // Engine2D.Quality en los ajustes de cada juego (una sola preferencia global).
  ensureQualityRows() {
    if (typeof Engine2D === 'undefined' || !Engine2D.Quality) return;
    const slots = [
      document.getElementById('runnerQualitySlot'),
      document.getElementById('trQualitySlot'),
      document.getElementById('rpgQualitySlot'),
    ];
    for (const slot of slots) {
      if (!slot || slot.childElementCount) continue;
      slot.appendChild(
        Engine2D.Quality.createRow({
          label: '🖼️ Gráficos',
        }),
      );
    }
  }

  syncQualityClass(level) {
    document.documentElement.classList.toggle('q-low', level === 'low');
  }

  // Efecto ola del título de bienvenida: un <span> por letra con su delay.
  animateHeroLetters() {
    const h1 = document.getElementById('heroTitle');
    if (!h1 || h1.dataset.animated) return;
    h1.dataset.animated = '1';
    let i = 0;
    const wrapTextNode = (node) => {
      const frag = document.createDocumentFragment();
      for (const ch of node.textContent) {
        const span = document.createElement('span');
        span.className = 'wave-letter';
        span.style.animationDelay = i * 0.045 + 's';
        span.textContent = ch === ' ' ? '\u00A0' : ch;
        frag.appendChild(span);
        i++;
      }
      node.replaceWith(frag);
    };
    [...h1.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        wrapTextNode(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        [...node.childNodes].forEach((inner) => {
          if (inner.nodeType === Node.TEXT_NODE) wrapTextNode(inner);
        });
      }
    });
  }

  // opciones.forzar: navega sin preguntar (lo usan la confirmación de salida
  // del duelo y el cambio de usuario).
  goTo(section, opciones = {}) {
    // Duelo en juego: primero se pregunta; si confirma, se vuelve a llamar con forzar.
    if (!opciones.forzar && app.duelos.pedirConfirmacionSalida(section)) return;
    if (typeof stopRunner === 'function') stopRunner();
    if (typeof stopTrampas === 'function') stopTrampas();
    if (typeof rpgStopLoop === 'function') rpgStopLoop();
    if (typeof stopSurvi === 'function') stopSurvi();

    document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
    document.getElementById('sec-' + section).classList.add('active');

    // Actualizar link activo en el menú (solo para las secciones del nav)
    const links = document.querySelectorAll('.nav-menu a');
    const map = {
      inicio: 0,
      juegos: 1,
      puntuacion: 2,
    };
    links.forEach((a) => a.classList.remove('active'));
    // Para pantallas de juego, mantener "Juegos" activo
    const navIdx = map[section] !== undefined ? map[section] : map['juegos'];
    if (links[navIdx]) links[navIdx].classList.add('active');

    // Puntuación siempre arranca en Global.
    if (section === 'puntuacion') app.puntuaciones.volverAPuntuacionGlobal();

    // Refrescar amigos / logros / perfil al navegar a esas secciones
    if (section === 'amigos') app.amigos.initAmigosScreen();
    if (section === 'logros') app.logros.initLogrosScreen();
    if (section === 'perfil') app.perfil.initPerfilScreen();

    // Restaurar HTML original de secciones de juego al volver a la grilla
    if (section === 'juegos') {
      ['preguntados', 'sopa', 'termina'].forEach(this.restoreOriginalSection);
    }

    // Marca "estoy en un juego del motor": el CSS apaga animaciones del sitio
    // que repintan por frame (brillo del logo) mientras corre el canvas.
    const isEngineGame =
      section === 'runner' ||
      section === 'castle_escape' ||
      section === 'rpg_pixel' ||
      section === 'pixel_survi';
    document.body.classList.toggle('in-engine-game', isEngineGame);
    if (isEngineGame) {
      // Estos juegos ponen su propia música (setMusic) al mostrar su menú.
      app.audio.attemptPlayMusic();
      if (section === 'castle_escape') {
        app.cargador.ensureCastleLoaded().then(() => {
          if (typeof initTrampas === 'function') initTrampas();
        });
      }
      if (section === 'rpg_pixel') {
        app.cargador.ensureRpgLoaded().then(() => {
          if (typeof rpgInit === 'function') rpgInit();
        });
      }
      if (section === 'pixel_survi') {
        app.cargador.ensureSurviLoaded().then(() => {
          if (typeof initSurvi === 'function') initSurvi();
        });
      }
    } else {
      // Cualquier otra sección usa la música ambiente del sitio
      app.audio.attemptPlayMusic();
      if (typeof app.audio.changeBgMusic === 'function') app.audio.changeBgMusic('menu.mp3');
    }

    // Al entrar a la pantalla de un minijuego, mostrar 3 recomendados al azar
    if (CatalogoJuegos.GAME_SCREEN_IDS.includes(section)) {
      app.catalogo.renderRecommendedGames(section);
    }
    this.closeNav();
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  closeNav() {
    this.hamburger.classList.remove('open');
    this.navMenu.classList.remove('open');
    const backdrop = app.nucleo.APP_EL.drawerBackdrop;
    if (backdrop && !app.nucleo.APP_EL.accountDrawer?.classList.contains('open'))
      backdrop.classList.remove('open');
  }

  // Botón redondo del header: sin sesión abre el login; con sesión, el menú de cuenta.
  handleAccountToggle() {
    if (app.auth.currentUser) {
      this.toggleAccountDrawer();
    } else {
      app.auth.openModal('login');
    }
  }

  toggleAccountDrawer() {
    const drawer = app.nucleo.APP_EL.accountDrawer;
    if (!drawer) return;
    const abriendo = !drawer.classList.contains('open');
    this.closeNav();
    if (abriendo) {
      drawer.classList.add('open');
      const backdrop = app.nucleo.APP_EL.drawerBackdrop;
      if (backdrop) backdrop.classList.add('open');
    } else {
      this.closeAccountDrawer();
    }
  }

  closeAccountDrawer() {
    const drawer = app.nucleo.APP_EL.accountDrawer;
    const backdrop = app.nucleo.APP_EL.drawerBackdrop;
    if (drawer) drawer.classList.remove('open');
    if (backdrop && !this.navMenu.classList.contains('open')) backdrop.classList.remove('open');
  }

  applyTheme(tema) {
    document.body.classList.remove('theme-light', 'theme-blue', 'theme-red');
    if (tema === 'light') {
      document.body.classList.add('theme-light');
    } else if (tema === 'red') {
      document.body.classList.add('theme-red');
    }
  }

}

// TemaUsuario — Tema visual (oscuro / claro / rojo): el admin fija el del sitio y cada usuario puede elegir el suyo. (app.tema)
class TemaUsuario extends Modulo {
  static TEMAS = ['dark', 'light', 'red'];
  static CLAVE = 'unigames_tema';

  constructor() {
    super();
    this.temaSitio = 'dark'; // el que eligió el admin en Config (configuracion_global.color_tema)
  }

  iniciar() {
    this.aplicarTemaEfectivo(); // lo antes posible, para que no parpadee el tema por defecto
  }

  // Preferencia guardada en este navegador para el usuario actual (o para
  // el invitado). Cada cuenta tiene la suya, igual que el progreso de los juegos.
  claveTema() {
    const u = app.auth.currentUser;
    return u && u.id != null ? TemaUsuario.CLAVE + '@u' + u.id : TemaUsuario.CLAVE;
  }

  temaElegido() {
    try {
      const t = localStorage.getItem(this.claveTema());
      return TemaUsuario.TEMAS.includes(t) ? t : null;
    } catch {
      return null;
    }
  }

  // Lo que se ve: la elección del usuario si tiene una; si no, la del sitio.
  temaEfectivo() {
    return this.temaElegido() || this.temaSitio;
  }

  // La llama InfoModal al leer la configuración del sitio.
  setTemaSitio(tema) {
    if (TemaUsuario.TEMAS.includes(tema)) this.temaSitio = tema;
    this.aplicarTemaEfectivo();
  }

  // Botones de "Apariencia" del menú lateral. '' = volver al tema del sitio.
  elegirTema(tema) {
    try {
      if (TemaUsuario.TEMAS.includes(tema)) localStorage.setItem(this.claveTema(), tema);
      else localStorage.removeItem(this.claveTema());
    } catch {
      /* sin localStorage: se aplica igual, solo que no se recuerda */
    }
    this.aplicarTemaEfectivo(TemaUsuario.TEMAS.includes(tema) ? tema : null);
  }

  aplicarTemaEfectivo(forzado) {
    const tema = forzado || this.temaEfectivo();
    app.navegacion.applyTheme(tema);
    // botones del menú: marcar el activo y mostrar "usar el del sitio" solo si hay preferencia propia
    const propio = forzado || this.temaElegido();
    document.querySelectorAll('.nav-tema-btn').forEach((b) => {
      const activo = b.dataset.tema === tema;
      b.classList.toggle('active', activo);
      b.setAttribute('aria-pressed', activo ? 'true' : 'false');
    });
    const reset = document.getElementById('navTemaReset');
    if (reset) reset.hidden = !propio;
  }
}

// CargadorModulos — Carga diferida de scripts/CSS de cada juego y selector de calidad. (app.cargador)
class CargadorModulos extends Modulo {
  constructor() {
    super();
    // Carga diferida de los juegos: el CSS y los módulos se bajan la primera vez
    // que se entra a la sección (la promesa se cachea). ensureCSS resuelve cuando
    // la hoja ya se aplicó, para no mostrar un frame sin estilos.
    this.cssPromises = {};
    this.runnerModuleLoading = null;
    this.castleModuleLoading = null;
    this.rpgModuleLoading = null;
    // Chart.js (200KB) se baja recién al abrir el dashboard del admin.
    this.chartJsLoading = null;
    // Pixel Survi es solo módulos ES: CSS e import() en paralelo.
    this.surviModuleLoading = null;
  }

  iniciar() {
    app.navegacion.ensureQualityRows();
    if (typeof Engine2D !== 'undefined' && Engine2D.Quality) {
      app.navegacion.syncQualityClass(Engine2D.Quality.get());
      Engine2D.Quality.onChange(app.navegacion.syncQualityClass);
    }
  }

  ensureCSS(href) {
    if (this.cssPromises[href]) return this.cssPromises[href];
    if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) {
      this.cssPromises[href] = Promise.resolve();
      return this.cssPromises[href];
    }
    this.cssPromises[href] = new Promise((resolve) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = resolve;
      l.onerror = resolve;
      document.head.appendChild(l);
    });
    return this.cssPromises[href];
  }

  // Carga un script clásico una sola vez (para globals que un juego lee al importarse).
  loadClassicScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  ensureRunnerLoaded() {
    if (!this.runnerModuleLoading) {
      this.runnerModuleLoading = this.ensureCSS('src/motor2d/games/pixel-runner/pixelrunner.css').then(
        () => import('./motor2d/games/pixel-runner/runner_main.js'),
      );
    }
    return this.runnerModuleLoading;
  }

  ensureCastleLoaded() {
    if (!this.castleModuleLoading) {
      // castle_escape_levels.js (global CASTLE_ESCAPE_CUSTOM_LEVELS) va antes del import().
      this.castleModuleLoading = Promise.all([
        this.ensureCSS('src/motor2d/games/castle-escape/castle_escape.css'),
        this.loadClassicScript('src/motor2d/games/castle-escape/castle_escape_levels.js'),
      ]).then(() => import('./motor2d/games/castle-escape/castle_main.js'));
    }
    return this.castleModuleLoading;
  }

  ensureRpgLoaded() {
    if (!this.rpgModuleLoading) {
      // El sprites.js del RPG define el global SPRITES: tiene que cargarse antes del import().
      this.rpgModuleLoading = Promise.all([
        this.ensureCSS('src/motor2d/games/rpg-pixel/rpg.css'),
        this.loadClassicScript('src/motor2d/games/rpg-pixel/models/sprites.js'),
      ]).then(() => import('./motor2d/games/rpg-pixel/rpg_main.js'));
    }
    return this.rpgModuleLoading;
  }

  ensureChartJsLoaded() {
    if (!this.chartJsLoading) {
      this.chartJsLoading = this.loadClassicScript('https://cdn.jsdelivr.net/npm/chart.js@4');
    }
    return this.chartJsLoading;
  }

  ensureSurviLoaded() {
    if (!this.surviModuleLoading) {
      this.surviModuleLoading = Promise.all([
        this.ensureCSS('src/motor2d/games/pixel-survi/pixel-survi.css'),
        import('./motor2d/games/pixel-survi/survi_main.js'),
      ]).then(([, mod]) => mod);
    }
    return this.surviModuleLoading;
  }
}

// RunnerUI — Paneles de Pixel Runner: pausa, modos, mejoras, ajustes y pantalla completa. (app.runner)
class RunnerUI extends Modulo {
  // Panel de Mejoras del runner: el estado vive en el juego (Economia); acá solo
  // se arma el HTML. Primero las mejoras por nivel y después las de compra única.
  static RUNNER_UPGRADE_DEFS = [
    // ── Mejoras de nivel (10 niveles, misma tabla de costos 100..1000) ──
    {
      tipo: 'shieldDuration',
      icon: '🛡️',
      nombre: 'Duración del Escudo',
      tipoNivel: true,
      campo: 'shieldLevel',
      formatEfecto: (nivel) => `Dura ${15 + nivel} seg`,
    },
    {
      tipo: 'x2Duration',
      icon: '⚡',
      nombre: 'Duración del x2',
      tipoNivel: true,
      campo: 'x2Level',
      formatEfecto: (nivel) => `Dura ${15 + nivel} seg`,
    },
    {
      tipo: 'slowFallDuration',
      icon: '🥾',
      nombre: 'Duración de Caída Lenta',
      tipoNivel: true,
      campo: 'slowFallLevel',
      formatEfecto: (nivel) => `Dura ${10 + nivel * 2} seg`,
    },
    {
      tipo: 'slowSpeedDuration',
      icon: '🐢',
      nombre: 'Duración de Velocidad Reducida',
      tipoNivel: true,
      campo: 'slowSpeedLevel',
      formatEfecto: (nivel) => `Dura ${10 + nivel} seg`,
    },
    // ── Mejoras especiales (compra única) ──
    {
      tipo: 'shieldHits',
      icon: '🛡️✨',
      nombre: 'Escudo Reforzado',
      tipoNivel: false,
      campo: 'shieldHits',
      costo: 1000,
      descripcion: 'El escudo aguanta 2 golpes en vez de 1',
    },
    {
      tipo: 'x2Triple',
      icon: '🔥',
      nombre: 'Triple Puntos',
      tipoNivel: false,
      campo: 'x2Triple',
      costo: 1500,
      descripcion: 'El power-up de puntos pasa de x2 a x3',
    },
    {
      tipo: 'slowSpeedStrong',
      icon: '🐢💨',
      nombre: 'Frenada Fuerte',
      tipoNivel: false,
      campo: 'slowSpeedStrong',
      costo: 1200,
      descripcion: 'Velocidad reducida pasa de -25% a -50%',
    },
  ];
  constructor() {
    super();
    // Pausa: Continuar, Ajustes o Volver al menú. runnerAjustesFromPause recuerda
    // desde dónde se abrió Ajustes para volver ahí.
    this.runnerAjustesFromPause = false;
  }

  iniciar() {
    document.addEventListener('fullscreenchange', this.runnerSyncFullscreenBtn);
    document.addEventListener('webkitfullscreenchange', this.runnerSyncFullscreenBtn);
  }

  // Paneles del runner (Mejoras / Ajustes / Cómo jugar) sobre el menú del juego.
  cerrarPanelesRunner() {
    [
      'runnerMejorasPanel',
      'runnerAjustesPanel',
      'runnerComoJugarPanel',
      'runnerModePanel',
      'runnerPausePanel',
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  }

  runnerOpenPause() {
    if (typeof pauseRunner === 'function') pauseRunner();
    const panel = app.nucleo.APP_EL.runnerPausePanel;
    if (panel) panel.classList.remove('hidden');
  }

  runnerResumeFromPause() {
    const panel = app.nucleo.APP_EL.runnerPausePanel;
    if (panel) panel.classList.add('hidden');
    if (typeof resumeRunner === 'function') resumeRunner();
  }

  runnerPauseToAjustes() {
    const panel = app.nucleo.APP_EL.runnerPausePanel;
    if (panel) panel.classList.add('hidden');
    this.runnerAjustesFromPause = true;
    this.mostrarAjustes();
  }

  runnerPauseToMenu() {
    const panel = app.nucleo.APP_EL.runnerPausePanel;
    if (panel) panel.classList.add('hidden');
    // stopRunner corta el loop del todo (a diferencia de pauseRunner, que
    // solo lo congela) — correcto acá porque de verdad se abandona la
    // partida, no se vuelve a ella.
    if (typeof stopRunner === 'function') stopRunner();
    if (typeof showRunnerMenu === 'function') showRunnerMenu();
  }

  // "← Volver" del cartel de Ajustes: si se abrió desde la pausa, vuelve a
  // la pausa (la partida sigue congelada atrás); si se abrió desde el menú
  // principal, vuelve al menú — mismo comportamiento de siempre.
  cerrarAjustesRunner() {
    const ajustes = app.nucleo.APP_EL.runnerAjustesPanel;
    if (ajustes) ajustes.classList.add('hidden');
    if (this.runnerAjustesFromPause) {
      this.runnerAjustesFromPause = false;
      const pausePanel = app.nucleo.APP_EL.runnerPausePanel;
      if (pausePanel) pausePanel.classList.remove('hidden');
    } else {
      this.cerrarPanelesRunner();
    }
  }

  // Selección de modo: Infinito se desbloquea al completar Historia.
  mostrarModoRunner() {
    const desbloqueado = typeof loadHistoriaCompleta === 'function' && loadHistoriaCompleta();
    const btnInfinito = app.nucleo.APP_EL.runnerModoInfinitoBtn;
    const descInfinito = app.nucleo.APP_EL.runnerModoInfinitoDesc;
    if (btnInfinito) btnInfinito.classList.toggle('locked', !desbloqueado);
    if (descInfinito) {
      descInfinito.textContent = desbloqueado
        ? 'Sin límite de puntos, ¡aguantá lo más que puedas!'
        : '🔒 Completá Historia para desbloquear';
    }
    const panel = app.nucleo.APP_EL.runnerModePanel;
    if (panel) panel.classList.remove('hidden');
  }

  // Duelo de Pixel Runner: modo Infinito directo, sin menú ni candado. El
  // puntaje lo reporta el juego al chocar (runner_loop.js).
  iniciarRunnerDuelo(dueloId) {
    app.duelos.dueloActivo = {
      id: dueloId,
      juego: 'runner',
    };
    app.navegacion.goTo('runner');
    this.cerrarPanelesRunner();
    const menu = document.getElementById('runnerMenu');
    // Con classList (no .style.display): un display inline le ganaba a la clase y
    // el menú quedaba invisible al volver del duelo.
    if (menu) menu.classList.add('hidden');
    app.utils.mostrarToast('¡Arrancó el duelo! Modo Infinito.');
    this.runnerSyncFullscreenBtn();
    app.cargador.ensureRunnerLoaded().then(() => {
      if (typeof startPixelRunnerGame === 'function') {
        startPixelRunnerGame('infinito');
      }
    });
  }

  elegirModoRunner(mode) {
    if (mode === 'infinito' && !(typeof loadHistoriaCompleta === 'function' && loadHistoriaCompleta())) {
      return; // sigue bloqueado, no hace nada
    }
    this.cerrarPanelesRunner();
    this.runnerSyncFullscreenBtn();
    if (mode === 'historia' && typeof RUNNER_COMICS !== 'undefined') {
      // Historia arranca con un cómic de intro; recién al tocar "Continuar"
      // se inicializa el juego de verdad.
      showRunnerComic(RUNNER_COMICS.intro, () => startPixelRunnerGame('historia'));
    } else {
      startPixelRunnerGame(mode);
    }
  }

  mejoraCardHtml(def, upgrades, coins) {
    if (def.tipoNivel) {
      const nivel = upgrades[def.campo];
      const maxLevel = def.maxLevel || 10;
      const maxed = nivel >= maxLevel;
      const costo = maxed ? null : getUpgradeCost(def.tipo, upgrades);
      const puedeComprar = !maxed && coins >= costo;
      const efectoActual = def.formatEfecto(nivel);
      const efectoSiguiente = maxed ? '' : def.formatEfecto(nivel + 1);
      return `
      <div class="runner-mejora-card${maxed ? ' maxed' : ''}">
        <div class="runner-mejora-icon">${def.icon}</div>
        <div class="runner-mejora-info">
          <div class="runner-mejora-nombre">${def.nombre}</div>
          <div class="runner-mejora-nivel">Nivel ${nivel}/${maxLevel}</div>
          <div class="runner-mejora-efecto">${maxed ? efectoActual : efectoActual + ' → ' + efectoSiguiente}</div>
        </div>
        <button class="runner-mejora-btn" ${maxed || !puedeComprar ? 'disabled' : ''} onclick="comprarMejora('${def.tipo}')">
          ${maxed ? 'MÁX' : '🪙 ' + costo}
        </button>
      </div>`;
    } else {
      const comprado = upgrades[def.campo];
      const puedeComprar = !comprado && coins >= def.costo;
      return `
      <div class="runner-mejora-card${comprado ? ' maxed' : ''}">
        <div class="runner-mejora-icon">${def.icon}</div>
        <div class="runner-mejora-info">
          <div class="runner-mejora-nombre">${def.nombre}</div>
          <div class="runner-mejora-efecto">${def.descripcion}</div>
        </div>
        <button class="runner-mejora-btn" ${comprado || !puedeComprar ? 'disabled' : ''} onclick="comprarMejora('${def.tipo}')">
          ${comprado ? '✔ Comprado' : '🪙 ' + def.costo}
        </button>
      </div>`;
    }
  }

  renderMejoras() {
    const grid = app.nucleo.APP_EL.runnerMejorasGrid;
    if (!grid || typeof refreshRunnerUpgrades !== 'function') return;
    const upgrades = refreshRunnerUpgrades();
    const coins = typeof loadTotalCoins === 'function' ? loadTotalCoins() : 0;
    grid.innerHTML = RunnerUI.RUNNER_UPGRADE_DEFS.map((def) =>
      this.mejoraCardHtml(def, upgrades, coins),
    ).join('');
  }

  comprarMejora(tipo) {
    if (typeof buyRunnerUpgrade !== 'function') return;
    buyRunnerUpgrade(tipo); // ya valida costo/máximo adentro; si no se pudo, simplemente no cambia nada
    this.mostrarMejoras(); // re-renderiza con las monedas y niveles actualizados
  }

  mostrarMejoras() {
    // Se relee siempre: el panel puede abrirse después de jugar.
    const coinsEl = app.nucleo.APP_EL.runnerMejorasCoinsTotal;
    const total = typeof loadTotalCoins === 'function' ? loadTotalCoins() : 0;
    if (coinsEl) coinsEl.textContent = total;
    this.renderMejoras();
    const panel = app.nucleo.APP_EL.runnerMejorasPanel;
    if (panel) panel.classList.remove('hidden');
  }

  mostrarAjustes() {
    const musicSlider = app.nucleo.APP_EL.runnerMusicVolume;
    const sfxSlider = app.nucleo.APP_EL.runnerSfxVolume;
    const musicValue = app.nucleo.APP_EL.runnerMusicVolumeValue;
    const sfxValue = app.nucleo.APP_EL.runnerSfxVolumeValue;
    const musicPct = Math.round(app.audio.getGlobalMusicVolume() * 100);
    const sfxPct = Math.round(app.audio.getGlobalSfxVolume() * 100);
    if (musicSlider) musicSlider.value = musicPct;
    if (sfxSlider) sfxSlider.value = sfxPct;
    if (musicValue) musicValue.textContent = musicPct + '%';
    if (sfxValue) sfxValue.textContent = sfxPct + '%';
    this.runnerSyncFullscreenBtn();
    const panel = app.nucleo.APP_EL.runnerAjustesPanel;
    if (panel) panel.classList.remove('hidden');
  }

  runnerOnMusicVolumeChange(value) {
    const pct = parseInt(value, 10) || 0;
    app.audio.setGlobalMusicVolume(pct / 100);
    const label = app.nucleo.APP_EL.runnerMusicVolumeValue;
    if (label) label.textContent = pct + '%';
  }

  runnerOnSfxVolumeChange(value) {
    const pct = parseInt(value, 10) || 0;
    app.audio.setGlobalSfxVolume(pct / 100);
    const label = app.nucleo.APP_EL.runnerSfxVolumeValue;
    if (label) label.textContent = pct + '%';
  }

  // Pantalla completa del .runner-container (no de toda la página).
  runnerGetFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  runnerFullscreenSupported() {
    const el = document.querySelector('#sec-runner .runner-container');
    return !!(el && (el.requestFullscreen || el.webkitRequestFullscreen));
  }

  runnerToggleFullscreen() {
    const el = document.querySelector('#sec-runner .runner-container');
    if (!el) return;
    if (!this.runnerGetFullscreenElement()) {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }

  runnerSyncFullscreenBtn() {
    const soportado = this.runnerFullscreenSupported();
    const enFullscreen = !!this.runnerGetFullscreenElement();
    const row = app.nucleo.APP_EL.runnerFullscreenRow;
    if (row) row.classList.toggle('unsupported', !soportado);
    const btn = app.nucleo.APP_EL.runnerFullscreenBtn;
    if (btn) btn.textContent = enFullscreen ? 'Salir' : 'Activar';
  }

  mostrarComoJugar() {
    const panel = app.nucleo.APP_EL.runnerComoJugarPanel;
    if (panel) panel.classList.remove('hidden');
  }
}

// Ahorcado — Minijuego Ahorcado (normal y duelo). (app.ahorcado)
class Ahorcado extends Modulo {
  //   AHORCADO
  static PARTES_HANG = ['h-head', 'h-body', 'h-arm-l', 'h-arm-r', 'h-leg-l', 'h-leg-r'];
  constructor() {
    super();
    this.ahorcadoState = {
      word: '',
      revealed: [],
      wrong: [],
      maxErrors: 6,
      finished: false,
      tematicaId: 'normal',
    };
    // Duelo de Ahorcado (null si no hay): suma 5 palabras y manda el total al duelo.
    this.ahorcadoDuelo = null;
  }

  iniciarAhorcadoDuelo(dueloId, tematicaId) {
    app.duelos.dueloActivo = {
      id: dueloId,
      juego: 'ahorcado',
    };
    // tematicaId llega en null cuando el reto se mandó con "Normal" (sin
    // temática), que es como se guarda tematica_id en la BD para ese caso.
    const tematicaDuelo = tematicaId ? tematicaId : 'normal';
    this.ahorcadoDuelo = {
      activo: true,
      dueloId,
      ronda: 0,
      totalRondas: 5,
      puntosTotal: 0,
      tematicaId: tematicaDuelo,
    };
    app.navegacion.goTo('ahorcado');
    const overlay = document.getElementById('ahorcadoStartOverlay');
    if (overlay) overlay.style.display = 'none';
    const gameEl = document.getElementById('ahorcadoGame');
    if (gameEl) gameEl.style.display = 'flex';
    this.siguienteRondaAhorcadoDuelo();
  }

  siguienteRondaAhorcadoDuelo() {
    this.ahorcadoDuelo.ronda += 1;
    if (this.ahorcadoDuelo.ronda > this.ahorcadoDuelo.totalRondas) {
      const dueloId = this.ahorcadoDuelo.dueloId;
      const puntos = this.ahorcadoDuelo.puntosTotal;
      this.ahorcadoDuelo = null;
      app.duelos.finalizarDueloConPuntaje(dueloId, puntos);
      return;
    }
    this.initAhorcado(this.ahorcadoDuelo.tematicaId);
  }

  async initAhorcado(tematicaId) {
    // Si no se pasa temática (ej. botón "Nueva palabra"), se reusa la última usada
    tematicaId = tematicaId || this.ahorcadoState.tematicaId || 'normal';
    let word = 'cargando';
    try {
      const res = await fetch('/api/ahorcado/palabra?tematica=' + encodeURIComponent(tematicaId), {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.palabra) word = data.palabra.toLowerCase();
    } catch (e) {
      console.error(e);
    }
    if (word === 'cargando' || !word) {
      const sec = app.nucleo.APP_EL.secAhorcado;
      if (sec) {
        sec.innerHTML = `
        <div class="game-screen-header">
          <button class="btn-back" onclick="goTo('juegos')">← Volver a Juegos</button>
          <div class="game-screen-title"><span>${app.utils.gameIconSVG('ahorcado', 22)}</span> Ahorcado</div>
          <div class="game-screen-theme">${Preguntados.TEMATICA_NAMES[tematicaId] || 'Normal'}</div>
        </div>
        <div class="coming-soon-box" style="margin-top:2rem;">
          <h2>Sin palabras</h2>
          <p>Aún no hay palabras cargadas para esta temática. (Recordá correr python crear_bd.py)</p>
          <button class="btn-play" style="margin-top:20px" onclick="goTo('juegos')">← Volver a Juegos</button>
        </div>`;
      }
      return;
    }
    this.ahorcadoState = {
      word,
      revealed: [],
      wrong: [],
      maxErrors: 6,
      finished: false,
      tematicaId,
    };

    Ahorcado.PARTES_HANG.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    this.renderAhorcadoWord();
    this.renderAhorcadoKeyboard();
    app.nucleo.APP_EL.ahorcadoStatus.textContent = '';
    app.nucleo.APP_EL.ahorcadoStatus.className = 'ahorcado-status';
    const labelEl = document.getElementById('ahorcado-theme-label');
    if (labelEl) {
      labelEl.textContent =
        this.ahorcadoDuelo && this.ahorcadoDuelo.activo
          ? `⚔️ Duelo · Palabra ${this.ahorcadoDuelo.ronda}/${this.ahorcadoDuelo.totalRondas} · ${this.ahorcadoDuelo.puntosTotal} pts`
          : Preguntados.TEMATICA_NAMES[tematicaId] || 'Normal';
    }
  }

  renderAhorcadoWord() {
    const { word, revealed } = this.ahorcadoState;
    app.nucleo.APP_EL.ahorcadoWord.innerHTML = word
      .split('')
      .map((l) => {
        const show = revealed.includes(l);
        return `<div class="letter-box">${show ? l.toUpperCase() : ''}</div>`;
      })
      .join('');
  }

  renderAhorcadoKeyboard() {
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    app.nucleo.APP_EL.ahorcadoKeyboard.innerHTML = letters
      .map((l) => {
        const isHit = this.ahorcadoState.revealed.includes(l);
        const isMiss = this.ahorcadoState.wrong.includes(l);
        const cls = isHit ? 'hit' : isMiss ? 'miss' : '';
        const dis = isHit || isMiss || this.ahorcadoState.finished ? 'disabled' : '';
        return `<button class="key-btn ${cls}" ${dis} onclick="guessLetter('${l}')">${l.toUpperCase()}</button>`;
      })
      .join('');
  }

  guessLetter(letter) {
    if (this.ahorcadoState.finished) return;
    const { word } = this.ahorcadoState;
    if (word.includes(letter)) {
      this.ahorcadoState.revealed.push(letter);
    } else {
      this.ahorcadoState.wrong.push(letter);
      const parte = Ahorcado.PARTES_HANG[this.ahorcadoState.wrong.length - 1];
      if (parte) {
        const el = document.getElementById(parte);
        if (el) el.style.display = 'block';
      }
    }
    const won = word.split('').every((l) => this.ahorcadoState.revealed.includes(l));
    const lost = this.ahorcadoState.wrong.length >= this.ahorcadoState.maxErrors;
    if (won || lost) {
      this.ahorcadoState.finished = true;
      const statusEl = app.nucleo.APP_EL.ahorcadoStatus;
      const tIdRaw = this.ahorcadoState.tematicaId;
      const tId = tIdRaw && tIdRaw !== 'normal' ? Number(tIdRaw) : null;
      const enDuelo = this.ahorcadoDuelo && this.ahorcadoDuelo.activo;
      if (won) {
        statusEl.textContent = '🎉 ¡Ganaste! La palabra era: ' + word.toUpperCase();
        statusEl.className = 'ahorcado-status win';
        // Cada error resta puntos: la primera palabra sin errores vale 200,
        // y cada fallo descuenta 30 (piso de 20 puntos por palabra ganada).
        const puntosPalabra = enDuelo
          ? Math.max(20, 200 - this.ahorcadoState.wrong.length * 30)
          : 1000 - this.ahorcadoState.wrong.length * 150;
        if (enDuelo) {
          this.ahorcadoDuelo.puntosTotal += puntosPalabra;
        } else {
          app.puntuaciones.guardarPuntaje(4, puntosPalabra, tId); // juego_id = 4 (Ahorcado)
          app.logros.registrarProgresoJuego('ahorcado', {
            ahorcado_ganadas: 1,
            ahorcado_tematicas: [tIdRaw],
            ahorcado_racha: true,
            ahorcado_partidas: 1,
            ...(this.ahorcadoState.wrong.length === 0
              ? {
                  ahorcado_perfectas: 1,
                }
              : {}),
            ...(this.ahorcadoState.wrong.length <= 1
              ? {
                  ahorcado_casiPerfectas: 1,
                }
              : {}),
          });
        }
      } else {
        this.ahorcadoState.revealed = word.split('');
        statusEl.textContent = '💀 ¡Perdiste! La palabra era: ' + word.toUpperCase();
        statusEl.className = 'ahorcado-status lose';
        if (!enDuelo) {
          app.puntuaciones.guardarPuntaje(4, 50, tId); // 50 puntos consuelo
          app.logros.registrarProgresoJuego('ahorcado', {
            ahorcado_racha: false,
            ahorcado_partidas: 1,
          });
        }
        // En duelo, perder una palabra no suma puntos (pero tampoco resta).
      }
      if (enDuelo) {
        const labelEl = document.getElementById('ahorcado-theme-label');
        if (labelEl)
          labelEl.textContent = `⚔️ Duelo · Palabra ${this.ahorcadoDuelo.ronda}/${this.ahorcadoDuelo.totalRondas} · ${this.ahorcadoDuelo.puntosTotal} pts`;
        // Pausa breve para que se alcance a leer la palabra, y pasa sola a
        // la siguiente (o cierra el duelo si era la última de las 5).
        setTimeout(this.siguienteRondaAhorcadoDuelo, 1600);
      }
    }
    this.renderAhorcadoWord();
    this.renderAhorcadoKeyboard();
  }
}

// AdivinaPalabra — Minijuego Adivina la Palabra estilo Wordle (normal y duelo). (app.wordle)
class AdivinaPalabra extends Modulo {
  static WORDLE_MAX_ATTEMPTS = 5;
  static WORDLE_TEMATICAS = {
    1: 'Videojuegos',
    2: 'Películas',
    3: 'Anime',
    4: 'Programación',
  };
  constructor() {
    super();
    // Duelo de Adivina la Palabra (null si no hay): una palabra, el puntaje va al duelo.
    this.wordleDuelo = null;
    this.wordleState = {
      word: '',
      length: 0,
      tematicaId: 1,
      currentRow: 0,
      currentGuess: '',
      rows: [],
      // cada fila terminada: { letters: [...], colors: [...] }
      keyColors: {},
      // estado acumulado de cada letra del teclado: 'correct' | 'present' | 'absent'
      finished: false,
    };
  }

  iniciarWordleDuelo(dueloId, tematicaId) {
    app.duelos.dueloActivo = {
      id: dueloId,
      juego: 'wordle',
    };
    this.wordleDuelo = {
      activo: true,
      dueloId,
    };
    app.navegacion.goTo('wordle');
    const overlay = document.getElementById('wordleStartOverlay');
    if (overlay) overlay.style.display = 'none';
    const gameEl = document.getElementById('wordleGame');
    if (gameEl) gameEl.style.display = 'flex';
    this.initWordle(tematicaId || 1);
  }

  wordleKeydownHandler(e) {
    const sec = app.nucleo.APP_EL.secWordle;
    if (!sec || !sec.classList.contains('active')) return;
    if (this.wordleState.finished) return;
    const key = e.key;
    if (key === 'Enter') {
      this.wordleSubmit();
      return;
    }
    if (key === 'Backspace') {
      this.wordleBackspace();
      return;
    }
    if (/^[a-zA-ZñÑ]$/.test(key)) {
      this.wordleAddLetter(key.toLowerCase());
    }
  }

  async initWordle(tematicaId) {
    tematicaId =
      tematicaId && /^\d+$/.test(tematicaId) ? Number(tematicaId) : this.wordleState.tematicaId || 1;
    let word = null;
    try {
      const res = await fetch('/api/wordle/palabra?tematica=' + encodeURIComponent(tematicaId), {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.palabra) word = data.palabra.toLowerCase();
    } catch (e) {
      console.error(e);
    }
    if (!word) {
      const sec = app.nucleo.APP_EL.secWordle;
      if (sec) {
        sec.innerHTML = `
        <div class="game-screen-header">
          <button class="btn-back" onclick="goTo('juegos')">← Volver a Juegos</button>
          <div class="game-screen-title"><span>${app.utils.gameIconSVG('wordle', 22)}</span> Adivina la Palabra</div>
          <div class="game-screen-theme">${Preguntados.TEMATICA_NAMES[tematicaId] || ''}</div>
        </div>
        <div class="coming-soon-box" style="margin-top:2rem;">
          <h2>Sin palabras</h2>
          <p>Aún no hay palabras cargadas para esta temática. (Recordá correr python crear_bd.py)</p>
          <button class="btn-play" style="margin-top:20px" onclick="goTo('juegos')">← Volver a Juegos</button>
        </div>`;
      }
      return;
    }
    this.wordleState = {
      word,
      length: word.length,
      tematicaId,
      currentRow: 0,
      currentGuess: '',
      rows: [],
      keyColors: {},
      finished: false,
    };
    const labelEl = app.nucleo.APP_EL.wordleThemeLabel;
    if (labelEl) {
      labelEl.textContent =
        this.wordleDuelo && this.wordleDuelo.activo
          ? `⚔️ Duelo · ${AdivinaPalabra.WORDLE_TEMATICAS[tematicaId] || ''}`
          : AdivinaPalabra.WORDLE_TEMATICAS[tematicaId] || '';
    }
    app.nucleo.APP_EL.wordleHint.textContent =
      word === 'error'
        ? 'No se pudo cargar la palabra. Probá de nuevo.'
        : `La palabra tiene ${word.length} letras. Tenés ${AdivinaPalabra.WORDLE_MAX_ATTEMPTS} intentos.`;
    app.nucleo.APP_EL.wordleStatus.textContent = '';
    app.nucleo.APP_EL.wordleStatus.className = 'wordle-status';
    this.renderWordleBoard();
    this.renderWordleKeyboard();
    document.removeEventListener('keydown', this.wordleKeydownHandler);
    document.addEventListener('keydown', this.wordleKeydownHandler);
  }

  stopWordle() {
    document.removeEventListener('keydown', this.wordleKeydownHandler);
  }

  renderWordleBoard() {
    const { length, rows, currentRow, currentGuess } = this.wordleState;
    let html = '';
    for (let r = 0; r < AdivinaPalabra.WORDLE_MAX_ATTEMPTS; r++) {
      html += '<div class="wordle-row">';
      for (let c = 0; c < length; c++) {
        let letter = '';
        let cls = 'wordle-tile';
        if (r < rows.length) {
          letter = rows[r].letters[c];
          cls += ' ' + rows[r].colors[c];
        } else if (r === currentRow) {
          letter = currentGuess[c] || '';
          if (letter) cls += ' filled';
        }
        html += `<div class="${cls}">${letter ? letter.toUpperCase() : ''}</div>`;
      }
      html += '</div>';
    }
    app.nucleo.APP_EL.wordleBoard.innerHTML = html;
  }

  renderWordleKeyboard() {
    const letters = 'qwertyuiopasdfghjklzxcvbnm'.split('');
    const { keyColors, finished } = this.wordleState;
    app.nucleo.APP_EL.wordleKeyboard.innerHTML = letters
      .map((l) => {
        const state = keyColors[l];
        const cls = state ? ' ' + state : '';
        const dis = finished ? 'disabled' : '';
        return `<button class="key-btn${cls}" ${dis} onclick="wordleAddLetter('${l}')">${l.toUpperCase()}</button>`;
      })
      .join('');
  }

  wordleAddLetter(letter) {
    if (this.wordleState.finished) return;
    if (this.wordleState.currentGuess.length >= this.wordleState.length) return;
    this.wordleState.currentGuess += letter;
    this.renderWordleBoard();
  }

  wordleBackspace() {
    if (this.wordleState.finished) return;
    this.wordleState.currentGuess = this.wordleState.currentGuess.slice(0, -1);
    this.renderWordleBoard();
  }

  wordleSubmit() {
    if (this.wordleState.finished) return;
    const { word, length, currentGuess } = this.wordleState;
    const statusEl = app.nucleo.APP_EL.wordleStatus;
    if (currentGuess.length < length) {
      statusEl.textContent = `Completá la palabra (${length} letras).`;
      statusEl.className = 'wordle-status warn';
      return;
    }

    // ── Algoritmo de colores estilo Wordle (maneja letras repetidas) ──
    const guessLetters = currentGuess.split('');
    const wordLetters = word.split('');
    const colors = new Array(length).fill('absent');
    const remaining = {};
    wordLetters.forEach((l) => {
      remaining[l] = (remaining[l] || 0) + 1;
    });

    // 1° pasada: verdes (posición exacta)
    for (let i = 0; i < length; i++) {
      if (guessLetters[i] === wordLetters[i]) {
        colors[i] = 'correct';
        remaining[guessLetters[i]]--;
      }
    }
    // 2° pasada: amarillos (la letra está, en otro lugar)
    for (let i = 0; i < length; i++) {
      if (colors[i] === 'correct') continue;
      const l = guessLetters[i];
      if (remaining[l] > 0) {
        colors[i] = 'present';
        remaining[l]--;
      }
    }

    // Actualizar estado acumulado del teclado (sin "degradar" una letra ya verde)
    const priority = {
      absent: 0,
      present: 1,
      correct: 2,
    };
    guessLetters.forEach((l, i) => {
      const prev = this.wordleState.keyColors[l];
      if (!prev || priority[colors[i]] > priority[prev]) {
        this.wordleState.keyColors[l] = colors[i];
      }
    });
    this.wordleState.rows.push({
      letters: guessLetters,
      colors,
    });
    this.wordleState.currentRow++;
    const won = currentGuess === word;
    const lost = !won && this.wordleState.currentRow >= AdivinaPalabra.WORDLE_MAX_ATTEMPTS;
    const tId = this.wordleState.tematicaId;
    const enDuelo = this.wordleDuelo && this.wordleDuelo.activo;
    if (won) {
      this.wordleState.finished = true;
      statusEl.textContent = '🎉 ¡La adivinaste! Era: ' + word.toUpperCase();
      statusEl.className = 'wordle-status win';
      const intentosUsados = this.wordleState.currentRow;
      const puntos = Math.max(1500 - (intentosUsados - 1) * 250, 250);
      if (enDuelo) {
        const dueloId = this.wordleDuelo.dueloId;
        this.wordleDuelo = null;
        setTimeout(() => app.duelos.finalizarDueloConPuntaje(dueloId, puntos), 1200);
      } else {
        app.puntuaciones.guardarPuntaje(6, puntos, tId); // juego_id = 6 (Adivina la Palabra)
        app.logros.registrarProgresoJuego('wordle', {
          wordle_ganadas: 1,
          wordle_racha: true,
          wordle_tematicas: [tId],
          ...(intentosUsados === 1
            ? {
                wordle_1intento: 1,
              }
            : {}),
          ...(intentosUsados <= 2
            ? {
                wordle_eficientes: 1,
              }
            : {}),
          ...(word.length >= 8
            ? {
                wordle_palabraLarga: 1,
              }
            : {}),
        });
      }
    } else if (lost) {
      this.wordleState.finished = true;
      statusEl.textContent = '💀 ¡Se acabaron los intentos! Era: ' + word.toUpperCase();
      statusEl.className = 'wordle-status lose';
      if (enDuelo) {
        const dueloId = this.wordleDuelo.dueloId;
        this.wordleDuelo = null;
        setTimeout(() => app.duelos.finalizarDueloConPuntaje(dueloId, 50), 1200); // 50 puntos consuelo, igual que fuera de duelo
      } else {
        app.puntuaciones.guardarPuntaje(6, 50, tId); // puntos consuelo
        app.logros.registrarProgresoJuego('wordle', {
          wordle_racha: false,
          wordle_tematicas: [tId],
        });
      }
    } else {
      statusEl.textContent = '';
    }
    this.wordleState.currentGuess = '';
    this.renderWordleBoard();
    this.renderWordleKeyboard();
  }
}

// Puntuaciones — Tabla de posiciones global y por juego, y guardado de puntajes. (app.puntuaciones)
class Puntuaciones extends Modulo {
  constructor() {
    super();
    this.lbCurrentTab = 'all';
  }

  async fetchLeaderboard() {
    if (this.lbCurrentTab === 'all') {
      await this.fetchLeaderboardGlobal();
    } else {
      await this.fetchLeaderboardByGame(this.lbCurrentTab);
    }
  }

  // Se entra a la tabla de un juego tocando su tarjeta en Global.
  volverAPuntuacionGlobal() {
    this.lbCurrentTab = 'all';
    app.nucleo.APP_EL.lbPanelAll.classList.add('active');
    app.nucleo.APP_EL.lbPanelAll.style.display = '';
    app.nucleo.APP_EL.lbPanelSingle.classList.remove('active');
    app.nucleo.APP_EL.lbPanelSingle.style.display = 'none';
    this.fetchLeaderboardGlobal();
  }

  // Estado vacío — mismo texto en la tarjeta de Global y en la tabla de un
  // solo juego, para que sea consistente en toda la sección.
  emptyRecordHTML() {
    return '<div class="lb-empty-mini"><p class="lb-empty-title">Sin récord aún</p><p class="lb-empty-sub">Sé el primero en jugar</p></div>';
  }

  // Datos (color, ícono) de un juego por id, en cualquiera de las dos listas.
  findGameMeta(id) {
    return (
      app.catalogo.allGames.find((g) => g.id === id) ||
      app.catalogo.actionGames.find((g) => g.id === id) ||
      null
    );
  }

  // Tarjeta de Global → tabla completa de ese juego.
  irATabDePuntuacion(target, nombreJuego) {
    this.lbCurrentTab = target;
    app.nucleo.APP_EL.lbPanelAll.classList.remove('active');
    app.nucleo.APP_EL.lbPanelAll.style.display = 'none';
    app.nucleo.APP_EL.lbPanelSingle.classList.add('active');
    app.nucleo.APP_EL.lbPanelSingle.style.display = '';
    const titleEl = document.getElementById('lbSingleTitle');
    if (titleEl) titleEl.textContent = nombreJuego;
    this.fetchLeaderboardByGame(target);
  }

  async fetchLeaderboardGlobal() {
    const container = app.nucleo.APP_EL.lbGlobalGrids;
    if (!container) return;
    try {
      const res = await fetch('/api/leaderboard/global');
      if (!res.ok) throw new Error();
      const data = await res.json(); // { juego_id: { juego, entries: [{jugador, puntos}] } }

      // Los 8 juegos con puntaje, siempre en este orden y aunque no tengan datos.
      const GAME_ID_MAP = {
        1: 'sopa',
        2: 'preguntados',
        3: 'termina',
        4: 'ahorcado',
        5: 'adivina',
        6: 'wordle',
        7: 'runner',
        8: 'castle_escape',
      };
      const medals = [
        '<svg style="width:1.05rem;height:1.05rem;fill:#ffd700;vertical-align:middle;" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>',
        '<svg style="width:1.05rem;height:1.05rem;fill:#c0c0c0;vertical-align:middle;" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>',
        '<svg style="width:1.05rem;height:1.05rem;fill:#cd7f32;vertical-align:middle;" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>',
      ];
      container.innerHTML = Object.keys(GAME_ID_MAP)
        .map((jid) => {
          const gameId = GAME_ID_MAP[jid];
          const meta = this.findGameMeta(gameId);
          const g = data[jid] || {
            juego: meta?.title || gameId,
            entries: [],
          };
          const bandStyle = meta?.bg ? ` style="background: ${meta.bg};"` : '';
          const titleStyle = meta?.titleColor
            ? ` style="color:${meta.titleColor};font-size:0.78rem;"`
            : ' style="font-size:0.78rem;"';

          // Lista vertical numerada — SIN cortar a los primeros N: si hay más
          // filas de las que entran en el alto fijo de la tarjeta, se
          // scrollea para abajo adentro de ella (ver .lb-game-card-body).
          const filasHTML = g.entries
            .map(
              (e, i) => `
        <div class="lb-rank-row">
          <span class="lb-rank-num">${medals[i] || '#' + (i + 1)}</span>
          <span class="lb-player-name" onclick="event.stopPropagation(); verPerfilPorUsername(${app.utils.jsArg(e.jugador)})">${app.utils.sanitizeHTML(e.jugador)}</span>
          <span class="score-badge">${app.utils.sanitizeHTML(String(e.puntos))}</span>
        </div>`,
            )
            .join('');
          return `
        <div class="game-card-full lb-game-card" onclick="irATabDePuntuacion('${gameId === 'runner' ? 'runner' : jid}', ${app.utils.jsArg(g.juego)})">
          <div class="card-header-band"${bandStyle}>
            <span class="card-emoji"><span class="card-emoji-float">${app.utils.gameIconSVG(gameId, 26)}</span></span>
            <span class="card-title"${titleStyle}>${app.utils.sanitizeHTML(g.juego)}</span>
          </div>
          <div class="lb-game-card-body">
            ${filasHTML || this.emptyRecordHTML()}
          </div>
        </div>`;
        })
        .join('');
    } catch (err) {
      console.error('Error leaderboard global', err);
      if (container)
        container.innerHTML =
          '<p style="text-align:center;color:#64748b;padding:2rem;">No se pudo cargar. ¿El servidor está corriendo?</p>';
    }
  }

  async fetchLeaderboardByGame(juegoId) {
    const tbody = app.nucleo.APP_EL.leaderboardBody;
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b;">Cargando...</td></tr>';
    if (app.nucleo.APP_EL.lbYourRank) app.nucleo.APP_EL.lbYourRank.classList.add('hidden'); // se muestra de nuevo abajo si corresponde
    try {
      const url =
        juegoId === 'runner'
          ? '/api/leaderboard?juego_id=7' // Pixel Runner = juego_id 7
          : `/api/leaderboard?juego_id=${juegoId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const scores = await res.json();

      // "Tu posición": con sesión, SIEMPRE se muestra — si no jugaste este
      // juego todavía, lo dice explícito en vez de desaparecer sin más.
      // Sin sesión no hay "vos" que mostrar, ahí sigue oculto.
      const rankEl = app.nucleo.APP_EL.lbYourRank;
      if (rankEl) {
        if (!app.auth.currentUser) {
          rankEl.classList.add('hidden');
        } else {
          const idx = scores.findIndex((s) => s.jugador === app.auth.currentUser.username);
          rankEl.innerHTML =
            idx >= 0
              ? `Tu posición: <strong>#${idx + 1}</strong> <span class="score-badge">${app.utils.sanitizeHTML(String(scores[idx].puntos))} pts</span>`
              : 'Tu posición: no jugaste aún a este juego';
          rankEl.classList.remove('hidden');
        }
      }
      if (scores.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="padding:1.5rem;">${this.emptyRecordHTML()}</td></tr>`;
        return;
      }
      tbody.innerHTML = scores
        .map((s, i) => {
          const medals = [
            '<svg style="width:1.2rem;height:1.2rem;fill:#ffd700;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>',
            '<svg style="width:1.2rem;height:1.2rem;fill:#c0c0c0;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>',
            '<svg style="width:1.2rem;height:1.2rem;fill:#cd7f32;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>',
          ];
          const medal = medals[i] || i + 1;
          const cls = i < 3 ? `rank-${i + 1}` : '';
          return `<tr>
        <td class="${cls}">${medal} ${i >= 3 ? i + 1 : ''}</td>
        <td><span class="lb-player-name" onclick="verPerfilPorUsername(${app.utils.jsArg(s.jugador)})">${app.utils.sanitizeHTML(s.jugador)}</span></td>
        <td><span class="score-badge">${app.utils.sanitizeHTML(String(s.puntos))}</span></td>
      </tr>`;
        })
        .join('');
    } catch (err) {
      console.error('Error leaderboard by game', err);
      tbody.innerHTML =
        '<tr><td colspan="3" style="text-align:center;color:#e53e3e;">Error al cargar</td></tr>';
    }
  }

  async guardarPuntaje(juego_id, puntos, tematica_id) {
    if (!app.auth.currentUser) return; // Solo guarda si hay sesión iniciada
    try {
      await app.api.authFetch('/api/partidas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          juego_id: juego_id,
          tematica_id: tematica_id || null,
          puntos: puntos,
        }),
      });
      this.fetchLeaderboard(); // Refrescar la tabla
    } catch (err) {
      console.error('Error guardando puntos', err);
    }
  }
}

// Preguntados — Minijuego Preguntados (normal y duelo). (app.preguntados)
class Preguntados extends Modulo {
  static PREGUNTADOS_TIME = 15;
  static TEMATICA_NAMES = {
    1: 'Videojuegos',
    2: 'Películas',
    3: 'Anime',
    4: 'Programación',
  };
  static TEMATICA_MAP = {
    Videojuegos: 1,
    Películas: 2,
    Anime: 3,
    Programación: 4,
  };
  constructor() {
    super();
    this.pregState = {
      preguntas: [],
      idx: 0,
      score: 0,
      timer: null,
      timeLeft: 0,
      tematicaId: 1,
      finished: false,
    };
    // Duelo de Preguntados (null si no hay): una ronda, el puntaje va al duelo.
    this.pregDuelo = null;
  }

  iniciarPreguntadosDuelo(dueloId, tematicaId) {
    app.duelos.dueloActivo = {
      id: dueloId,
      juego: 'preguntados',
    };
    this.pregDuelo = {
      activo: true,
      dueloId,
    };
    app.navegacion.goTo('preguntados');
    const overlay = document.getElementById('preguntadosStartOverlay');
    if (overlay) overlay.style.display = 'none';
    this.initPreguntados(tematicaId || 1);
  }

  async initPreguntados(tematicaId) {
    tematicaId = tematicaId || this.pregState.tematicaId || 1;
    this.pregState.tematicaId = tematicaId;
    clearInterval(this.pregState.timer);
    let preguntas = [];
    try {
      const res = await fetch('/api/preguntas?tematica_id=' + tematicaId);
      const raw = await res.json();
      // Deduplicar por texto de pregunta (la BD puede tener filas repetidas con distintos ids)
      const seen = new Set();
      preguntas = app.utils.shuffle(raw).filter((p) => {
        if (seen.has(p.pregunta)) return false;
        seen.add(p.pregunta);
        return true;
      });
    } catch (e) {
      console.error(e);
    }
    this.pregState = {
      preguntas,
      idx: 0,
      score: 0,
      timer: null,
      timeLeft: Preguntados.PREGUNTADOS_TIME,
      tematicaId,
      finished: false,
    };
    app.nucleo.APP_EL.preguntadosThemeLabel.textContent = this.temaLabelConDuelo(
      this.pregDuelo && this.pregDuelo.activo,
      tematicaId,
    );
    this.renderPreguntados();
  }

  // Arma el texto del "theme label" de cada minijuego clásico, agregando
  // el prefijo "⚔️ Duelo ·" cuando la partida es un duelo 1v1 (mismo
  // criterio visual que ya usaban Ahorcado y Adivina la Palabra).
  temaLabelConDuelo(esDuelo, tematicaId) {
    const base = Preguntados.TEMATICA_NAMES[tematicaId] || '';
    return esDuelo ? `⚔️ Duelo · ${base}` : base;
  }

  renderPreguntados() {
    const sec = app.nucleo.APP_EL.secPreguntados;
    const { preguntas, idx, score, finished } = this.pregState;
    if (preguntas.length === 0) {
      sec.innerHTML = `
      <div class="game-screen-header">
        <button class="btn-back" onclick="goTo('juegos')">← Volver a Juegos</button>
        <div class="game-screen-title"><span>${app.utils.gameIconSVG('preguntados', 22)}</span> Preguntados</div>
        <div class="game-screen-theme">${this.temaLabelConDuelo(this.pregDuelo && this.pregDuelo.activo, this.pregState.tematicaId)}</div>
      </div>
      <div class="coming-soon-box" style="margin-top:2rem;">
        <h2>Sin preguntas</h2>
        <p>Aún no hay preguntas cargadas para esta temática. (Recordá correr python crear_bd.py)</p>
        <button class="btn-play" style="margin-top:20px" onclick="goTo('juegos')">← Volver a Juegos</button>
      </div>`;
      // Si es un duelo y la temática no tiene preguntas cargadas, no lo
      // dejamos colgado: reportamos 0 puntos para que el duelo se pueda
      // resolver igual (mismo criterio de "no romper el duelo" que el resto).
      if (this.pregDuelo && this.pregDuelo.activo) {
        const dueloId = this.pregDuelo.dueloId;
        this.pregDuelo = null;
        app.duelos.finalizarDueloConPuntaje(dueloId, 0);
      }
      return;
    }
    if (finished || idx >= preguntas.length) {
      const puntos = score * 150;

      // En duelo: no se guarda puntaje normal ni logros, el puntaje va
      // directo al duelo (mismo criterio que ahorcadoDuelo/sopaDuelo).
      if (this.pregDuelo && this.pregDuelo.activo) {
        const dueloId = this.pregDuelo.dueloId;
        this.pregDuelo = null;
        app.duelos.finalizarDueloConPuntaje(dueloId, puntos);
        return;
      }
      sec.querySelector('.coming-soon-box')?.remove();
      app.puntuaciones.guardarPuntaje(2, puntos, this.pregState.tematicaId);
      app.logros.registrarProgresoJuego('preguntados', {
        preg_completadas: 1,
        preg_tematicas: [this.pregState.tematicaId],
        ...(score >= preguntas.length
          ? {
              preg_perfectas: 1,
            }
          : {}),
      });
      sec.innerHTML = `
      <div class="game-screen-header">
        <button class="btn-back" onclick="goTo('juegos')">← Volver a Juegos</button>
        <div class="game-screen-title"><span>${app.utils.gameIconSVG('preguntados', 22)}</span> Preguntados</div>
        <div class="game-screen-theme" id="preguntados-theme-label">${Preguntados.TEMATICA_NAMES[this.pregState.tematicaId] || ''}</div>
      </div>
      <div class="preg-result">
        <div class="preg-result-emoji">${score >= preguntas.length * 0.7 ? '🏆' : score >= preguntas.length * 0.4 ? '😊' : '😅'}</div>
        <p class="preg-result-title">${score >= preguntas.length * 0.7 ? '¡Excelente!' : score >= preguntas.length * 0.4 ? '¡Bien hecho!' : '¡Seguí practicando!'}</p>
        <p class="preg-result-score">${score} / ${preguntas.length} correctas</p>
        <p class="preg-result-pts">+${puntos} puntos</p>
        <button class="btn-play" style="max-width:240px;margin:0 auto;" onclick="initPreguntados(${this.pregState.tematicaId})"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>Jugar de nuevo</button>
        <button class="btn-back" style="margin:0 auto;" onclick="goTo('juegos')">← Volver a Juegos</button>
      </div>`;
      return;
    }
    const q = preguntas[idx];
    const opts = ['A', 'B', 'C', 'D'];
    const texts = [q.opcion_a, q.opcion_b, q.opcion_c, q.opcion_d];
    sec.innerHTML = `
    <div class="game-screen-header">
      <button class="btn-back" onclick="clearInterval(pregState.timer); goTo('juegos')">← Volver a Juegos</button>
      <div class="game-screen-title"><span>${app.utils.gameIconSVG('preguntados', 22)}</span> Preguntados</div>
      <div class="game-screen-theme" id="preguntados-theme-label">${this.temaLabelConDuelo(this.pregDuelo && this.pregDuelo.activo, this.pregState.tematicaId)}</div>
    </div>
    <div class="preg-wrap">
      <div class="preg-topbar">
        <span class="preg-counter">Pregunta ${idx + 1} / ${preguntas.length}</span>
        <span class="preg-score"><svg style="width:1rem;height:1rem;fill:gold;vertical-align:middle;margin-right:2px;" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> ${score}</span>
        <div class="preg-timer-bar"><div class="preg-timer-fill" id="pregTimerFill"></div></div>
        <span class="preg-time" id="pregTimeText">${this.pregState.timeLeft}s</span>
      </div>
      <div class="preg-question">${q.pregunta}</div>
      <div class="preg-options">
        ${opts
          .map(
            (opt, i) => `
          <button class="preg-opt" data-opt="${opt}" onclick="answerPreguntados('${opt}', '${q.respuesta_correcta}')">
            <span class="preg-opt-label">${opt}</span>
            <span>${texts[i]}</span>
          </button>
        `,
          )
          .join('')}
      </div>
    </div>`;
    this.startPregTimer();
  }

  startPregTimer() {
    clearInterval(this.pregState.timer);
    this.pregState.timeLeft = Preguntados.PREGUNTADOS_TIME;
    const fill = () => {
      const f = document.getElementById('pregTimerFill');
      const t = document.getElementById('pregTimeText');
      if (f) f.style.width = (this.pregState.timeLeft / Preguntados.PREGUNTADOS_TIME) * 100 + '%';
      if (t) t.textContent = this.pregState.timeLeft + 's';
      if (this.pregState.timeLeft <= 5 && f) f.style.background = '#e53e3e';
      if (this.pregState.timeLeft <= 0) {
        clearInterval(this.pregState.timer);
        this.flashPregAnswer(null, this.pregState.preguntas[this.pregState.idx]?.respuesta_correcta);
        app.logros.actualizarProgresoParcial('preguntados', {
          preg_racha: false,
        });
        setTimeout(() => {
          this.pregState.idx++;
          this.renderPreguntados();
        }, 1200);
        return;
      }
      this.pregState.timeLeft--;
    };
    fill();
    this.pregState.timer = setInterval(fill, 1000);
  }

  answerPreguntados(chosen, correct) {
    correct = correct ? correct.toUpperCase() : correct;
    clearInterval(this.pregState.timer);
    const isCorrect = chosen === correct;
    if (isCorrect) this.pregState.score++;
    app.logros.actualizarProgresoParcial('preguntados', {
      preg_racha: isCorrect,
      ...(isCorrect
        ? {
            preg_correctas: 1,
          }
        : {}),
      ...(isCorrect && this.pregState.timeLeft >= Preguntados.PREGUNTADOS_TIME - 1
        ? {
            preg_veloz: 1,
          }
        : {}),
    });
    this.flashPregAnswer(chosen, correct);
    setTimeout(() => {
      this.pregState.idx++;
      this.renderPreguntados();
    }, 1100);
  }

  flashPregAnswer(chosen, correct) {
    correct = correct ? correct.toUpperCase() : correct;
    document.querySelectorAll('.preg-opt').forEach((btn) => {
      const o = btn.dataset.opt;
      btn.disabled = true;
      if (o === correct) btn.classList.add('correct');
      else if (o === chosen && chosen !== correct) btn.classList.add('wrong');
    });
  }
}

// SopaDeLetras — Minijuego Sopa de Letras (normal y duelo). (app.sopa)
class SopaDeLetras extends Modulo {
  static SOPA_GRID = 12;

  static nombreTematica(tematicaId) {
    return tematicaId === 'normal' ? 'Normal' : Preguntados.TEMATICA_NAMES[tematicaId] || '';
  }

  static SOPA_TIME = 120;
  // Palabras de respaldo por si falla /api/sopa/palabras.
  static SOPA_WORDS = {
    normal: [
      'CASA',
      'PERRO',
      'GATO',
      'ARBOL',
      'SOL',
      'LUNA',
      'ESCUELA',
      'LIBRO',
      'MESA',
      'SILLA',
      'VENTANA',
      'PUERTA',
    ],
    1: [
      'POKEMON',
      'MINECRAFT',
      'VIDEOJUEGO',
      'JOYSTICK',
      'CONSOLA',
      'NINTENDO',
      'ZELDA',
      'MARIO',
      'ARCADE',
      'GAMER',
    ],
    2: [
      'PELICULA',
      'CINEMA',
      'DIRECTOR',
      'ACTOR',
      'GUION',
      'ESCENA',
      'TRAILER',
      'DRAMA',
      'COMEDIA',
      'ESTRENO',
    ],
    3: ['ANIME', 'NARUTO', 'MANGA', 'OTAKU', 'SHONEN', 'NINJA', 'SAMURAI', 'KAWAII', 'DRAGON', 'GOKU'],
    4: [
      'JAVASCRIPT',
      'PYTHON',
      'VARIABLE',
      'FUNCION',
      'SERVIDOR',
      'EXPRESS',
      'FRONTEND',
      'BACKEND',
      'REACT',
      'GITHUB',
    ],
  };
  constructor() {
    super();
    this.sopaState = {
      words: [],
      grid: [],
      placed: [],
      found: [],
      selected: [],
      dragging: false,
      timer: null,
      timeLeft: SopaDeLetras.SOPA_TIME,
      score: 0,
      tematicaId: 1,
      finished: false,
      erroresSeleccion: 0,
    };
    this.sopaFinishTimeout = null;
    // Duelo de Sopa (null si no hay): un intento con temática y duración del reto.
    this.sopaDuelo = null;
  }

  iniciarSopaDuelo(dueloId, tematicaId, duracionSegundos) {
    app.duelos.dueloActivo = {
      id: dueloId,
      juego: 'sopa',
    };
    this.sopaDuelo = {
      activo: true,
      dueloId,
    };
    app.navegacion.goTo('sopa');
    const overlay = document.getElementById('sopaStartOverlay');
    if (overlay) overlay.style.display = 'none';
    this.initSopa(tematicaId || 'normal', duracionSegundos || SopaDeLetras.SOPA_TIME);
  }

  async initSopa(tematicaId, duracionSegundosDuelo) {
    // 'normal' = palabras sin temática (las mismas que Ahorcado en modo Normal)
    tematicaId = tematicaId === 'normal' ? 'normal' : Number(tematicaId) || this.sopaState.tematicaId || 1;
    // Fuera de duelo siempre se juega con el tiempo estándar (SOPA_TIME);
    // el parámetro de duración solo se usa cuando initSopa lo llama
    // iniciarSopaDuelo con la duración elegida al mandar el reto.
    const tiempoTotal =
      this.sopaDuelo && this.sopaDuelo.activo && duracionSegundosDuelo
        ? duracionSegundosDuelo
        : SopaDeLetras.SOPA_TIME;
    clearInterval(this.sopaState.timer);
    if (this.sopaFinishTimeout) {
      clearTimeout(this.sopaFinishTimeout);
      this.sopaFinishTimeout = null;
    }
    const maxLargo = SopaDeLetras.SOPA_GRID - 1;
    let palabras = [];
    try {
      const res = await fetch(`/api/sopa/palabras?tematica=${tematicaId}&cantidad=8&max_largo=${maxLargo}`, {
        cache: 'no-store',
      });
      palabras = await res.json();
    } catch (e) {
      console.error(e);
    }

    // Si la API falló o trajo menos de 4 palabras utilizables, se usa el
    // set hardcodeado como red de contención (mejor jugar con las palabras
    // viejas que dejar la sopa sin arrancar).
    if (!Array.isArray(palabras) || palabras.filter((w) => w.length <= maxLargo).length < 4) {
      palabras = SopaDeLetras.SOPA_WORDS[tematicaId] || SopaDeLetras.SOPA_WORDS.normal;
    }
    const candidatos = [...new Set(palabras.map((w) => w.toUpperCase()).filter((w) => w.length <= maxLargo))];
    const shuffled = [...candidatos].sort(() => Math.random() - 0.5).slice(0, 8);
    const { grid, placed } = this.buildSopaGrid(shuffled, SopaDeLetras.SOPA_GRID);
    this.sopaState = {
      words: placed.map((p) => p.word),
      grid,
      placed,
      found: [],
      selected: [],
      dragging: false,
      timer: null,
      timeLeft: tiempoTotal,
      tiempoTotal,
      score: 0,
      tematicaId,
      finished: false,
      erroresSeleccion: 0,
    };
    app.nucleo.APP_EL.sopaThemeLabel.textContent =
      this.sopaDuelo && this.sopaDuelo.activo
        ? `⚔️ Duelo · ${SopaDeLetras.nombreTematica(tematicaId)}`
        : SopaDeLetras.nombreTematica(tematicaId);
    this.renderSopa();
    this.startSopaTimer();
  }

  buildSopaGrid(words, size) {
    const dirs = [
      [0, 1],
      [1, 0],
      [1, 1],
      [0, -1],
      [-1, 0],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ];
    const grid = Array.from(
      {
        length: size,
      },
      () => Array(size).fill(''),
    );
    const placed = [];
    for (const word of words) {
      let ok = false;
      for (let attempt = 0; attempt < 120 && !ok; attempt++) {
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        const row = Math.floor(Math.random() * size);
        const col = Math.floor(Math.random() * size);
        const cells = [];
        let valid = true;
        for (let i = 0; i < word.length; i++) {
          const r = row + dir[0] * i;
          const c = col + dir[1] * i;
          if (r < 0 || r >= size || c < 0 || c >= size) {
            valid = false;
            break;
          }
          if (grid[r][c] !== '' && grid[r][c] !== word[i]) {
            valid = false;
            break;
          }
          cells.push([r, c]);
        }
        if (valid) {
          cells.forEach(([r, c], i) => {
            grid[r][c] = word[i];
          });
          placed.push({
            word,
            cells,
          });
          ok = true;
        }
      }
    }

    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (!grid[r][c]) grid[r][c] = alpha[Math.floor(Math.random() * alpha.length)];
    return {
      grid,
      placed,
    };
  }

  renderSopa() {
    const sec = app.nucleo.APP_EL.secSopa;
    const { grid, placed, found, timeLeft } = this.sopaState;
    const size = SopaDeLetras.SOPA_GRID;
    const gridHTML = grid
      .map((row, r) =>
        row
          .map((cell, c) => {
            const isSel = this.sopaState.selected.some(([sr, sc]) => sr === r && sc === c);
            const isFound = this.sopaState.found.some((w) =>
              this.sopaState.placed.find((p) => p.word === w)?.cells.some(([pr, pc]) => pr === r && pc === c),
            );
            return `<div class="sopa-cell${isSel ? ' sopa-sel' : ''}${isFound ? ' sopa-found' : ''}"
        data-r="${r}" data-c="${c}"
        onmousedown="sopaStart(${r},${c})"
        onmouseenter="sopaMove(${r},${c})"
        ontouchstart="sopaTouch(event,${r},${c})"
        ontouchmove="sopaTouchMove(event)"
      >${cell}</div>`;
          })
          .join(''),
      )
      .join('');
    const wordsHTML = placed
      .map(
        (p) => `<span class="sopa-word${found.includes(p.word) ? ' sopa-word-found' : ''}">${p.word}</span>`,
      )
      .join('');
    sec.innerHTML = `
    <div class="game-screen-header">
      <button class="btn-back" onclick="clearInterval(sopaState.timer); goTo('juegos')">← Volver a Juegos</button>
      <div class="game-screen-title"><span>${app.utils.gameIconSVG('sopa', 22)}</span> Sopa de Letras</div>
      <div class="game-screen-theme" id="sopa-theme-label">${SopaDeLetras.nombreTematica(this.sopaState.tematicaId)}</div>
    </div>
    <div class="sopa-wrap">
      <div class="sopa-info">
        <span class="sopa-timer${timeLeft <= 15 ? ' sopa-timer-urgent' : ''}">⏱ ${timeLeft}s</span>
        <span class="sopa-score-disp"><svg style="width:1rem;height:1rem;fill:gold;vertical-align:middle;margin-right:2px;" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> ${this.sopaState.score}</span>
      </div>
      <div class="sopa-main">
        <div class="sopa-grid" onmouseup="sopaEnd()" ontouchend="sopaEnd()"
          style="grid-template-columns:repeat(${size},1fr);">${gridHTML}</div>
        <div class="sopa-words-panel">
          <p class="sopa-words-title">Palabras a encontrar:</p>
          <div class="sopa-words-list">${wordsHTML}</div>
        </div>
      </div>
    </div>`;
  }

  startSopaTimer() {
    clearInterval(this.sopaState.timer);
    this.sopaState.timer = setInterval(() => {
      this.sopaState.timeLeft--;
      // Actualizar solo el timer sin re-renderizar todo
      const el = document.querySelector('.sopa-timer');
      if (el) {
        el.textContent = '⏱ ' + this.sopaState.timeLeft + 's';
        if (this.sopaState.timeLeft <= 15) el.classList.add('sopa-timer-urgent');
      }
      if (this.sopaState.timeLeft <= 0) {
        clearInterval(this.sopaState.timer);
        this.sopaFinish(false);
      }
    }, 1000);
  }

  sopaStart(r, c) {
    this.sopaState.dragging = true;
    this.sopaState.startCell = [r, c];
    this.sopaState.selected = [[r, c]];
    this.updateSopaHighlight();
  }

  sopaMove(r, c) {
    if (!this.sopaState.dragging) return;
    const [sr, sc] = this.sopaState.startCell;
    // Calcular línea recta desde start hasta r,c
    this.sopaState.selected = this.getCellsInLine(sr, sc, r, c);
    this.updateSopaHighlight();
  }

  sopaEnd() {
    if (!this.sopaState.dragging) return;
    this.sopaState.dragging = false;
    this.checkSopaSelection();
    this.sopaState.selected = [];
    this.updateSopaHighlight();
  }

  sopaTouch(e, r, c) {
    e.preventDefault();
    this.sopaStart(r, c);
  }

  sopaTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el && el.dataset.r !== undefined) {
      this.sopaMove(Number(el.dataset.r), Number(el.dataset.c));
    }
  }

  getCellsInLine(r1, c1, r2, c2) {
    const dr = r2 - r1,
      dc = c2 - c1;
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    if (steps === 0) return [[r1, c1]];
    // Solo en dirección recta o diagonal exacta
    const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
    const stepC = dc === 0 ? 0 : dc / Math.abs(dc);
    // Validar que sea diagonal exacta o línea recta
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) {
      // No es diagonal exacta → solo extender en la dirección dominante
      if (Math.abs(dr) > Math.abs(dc))
        return Array.from(
          {
            length: Math.abs(dr) + 1,
          },
          (_, i) => [[r1 + stepR * i, c1]],
        ).flat();
      return Array.from(
        {
          length: Math.abs(dc) + 1,
        },
        (_, i) => [[r1, c1 + stepC * i]],
      ).flat();
    }
    return Array.from(
      {
        length: steps + 1,
      },
      (_, i) => [r1 + stepR * i, c1 + stepC * i],
    );
  }

  updateSopaHighlight() {
    document.querySelectorAll('.sopa-cell').forEach((el) => {
      const r = Number(el.dataset.r),
        c = Number(el.dataset.c);
      const isSel = this.sopaState.selected.some(([sr, sc]) => sr === r && sc === c);
      const isFound = this.sopaState.found.some((w) =>
        this.sopaState.placed.find((p) => p.word === w)?.cells.some(([pr, pc]) => pr === r && pc === c),
      );
      el.className = 'sopa-cell' + (isSel ? ' sopa-sel' : '') + (isFound ? ' sopa-found' : '');
    });
  }

  checkSopaSelection() {
    const sel = this.sopaState.selected;
    const word = sel.map(([r, c]) => this.sopaState.grid[r][c]).join('');
    const wordRev = word.split('').reverse().join('');
    for (const p of this.sopaState.placed) {
      if ((p.word === word || p.word === wordRev) && !this.sopaState.found.includes(p.word)) {
        this.sopaState.found.push(p.word);
        const bonus = Math.max(10, Math.floor(this.sopaState.timeLeft / 2));
        this.sopaState.score += bonus;
        document.querySelector('.sopa-score-disp').innerHTML =
          '<svg style="width:1rem;height:1rem;fill:gold;vertical-align:middle;margin-right:2px;" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> ' +
          this.sopaState.score;
        this.updateSopaHighlight();
        document.querySelectorAll('.sopa-word').forEach((el) => {
          if (el.textContent === p.word) el.classList.add('sopa-word-found');
        });
        if (this.sopaState.found.length === this.sopaState.placed.length) {
          // Todas las palabras encontradas — limpiar timer ANTES de programar el finish
          clearInterval(this.sopaState.timer);
          if (this.sopaFinishTimeout) clearTimeout(this.sopaFinishTimeout);
          this.sopaFinishTimeout = setTimeout(() => this.sopaFinish(true), 400);
        }
        return;
      }
    }

    // Ninguna palabra coincidió: cuenta como intento fallido (solo si la
    // selección tenía más de una celda, para no penalizar clicks sueltos).
    if (sel.length > 1) this.sopaState.erroresSeleccion = (this.sopaState.erroresSeleccion || 0) + 1;
  }

  sopaFinish(won) {
    // Evita terminar dos veces (última palabra justo cuando el tiempo llega a 0).
    if (this.sopaState.finished) return;
    this.sopaState.finished = true;
    clearInterval(this.sopaState.timer);
    if (this.sopaFinishTimeout) {
      clearTimeout(this.sopaFinishTimeout);
      this.sopaFinishTimeout = null;
    }
    const total = this.sopaState.placed.length;
    const found = this.sopaState.found.length;
    const pts = this.sopaState.score;

    // En duelo: no se guarda puntaje normal ni logros, el puntaje va
    // directo al duelo (mismo criterio que ahorcadoDuelo).
    if (this.sopaDuelo && this.sopaDuelo.activo) {
      const dueloId = this.sopaDuelo.dueloId;
      this.sopaDuelo = null;
      app.duelos.finalizarDueloConPuntaje(dueloId, pts);
      return;
    }
    const tematicaPuntaje = this.sopaState.tematicaId === 'normal' ? null : this.sopaState.tematicaId;
    app.puntuaciones.guardarPuntaje(1, pts, tematicaPuntaje); // juego_id=1 Sopa
    app.logros.registrarProgresoJuego('sopa', {
      sopa_racha: won,
      sopa_maxScore_best: pts,
      ...(won
        ? {
            sopa_completadas: 1,
            sopa_tematicas: [this.sopaState.tematicaId],
            ...(this.sopaState.timeLeft > SopaDeLetras.SOPA_TIME / 2
              ? {
                  sopa_veloz: 1,
                }
              : {}),
            ...(this.sopaState.timeLeft >= 90
              ? {
                  sopa_relampago: 1,
                }
              : {}),
            ...(this.sopaState.erroresSeleccion === 0
              ? {
                  sopa_sinerrores: 1,
                }
              : {}),
          }
        : {}),
    });
    const sec = app.nucleo.APP_EL.secSopa;
    sec.innerHTML = `
    <div class="game-screen-header">
      <button class="btn-back" onclick="goTo('juegos')">← Volver a Juegos</button>
      <div class="game-screen-title"><span>${app.utils.gameIconSVG('sopa', 22)}</span> Sopa de Letras</div>
    </div>
    <div class="preg-result">
      <div class="preg-result-emoji">${won ? '🏆' : found > total / 2 ? '😊' : '😅'}</div>
      <p class="preg-result-title">${won ? '¡Encontraste todas!' : '¡Tiempo agotado!'}</p>
      <p class="preg-result-score">${found} / ${total} palabras encontradas</p>
      <p class="preg-result-pts">+${pts} puntos</p>
      <button class="btn-play" style="max-width:240px;margin:0 auto;" onclick="initSopa('${this.sopaState.tematicaId}')"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>Jugar de nuevo</button>
      <button class="btn-back" style="margin:0 auto;" onclick="goTo('juegos')">← Volver a Juegos</button>
    </div>`;
  }
}

// TerminaPalabra — Minijuego Termina la Palabra (normal y duelo). (app.termina)
class TerminaPalabra extends Modulo {
  static TERMINA_MAX = 4;
  constructor() {
    super();
    this.terminaState = {
      word: '',
      revealed: '',
      intentos: 0,
      guesses: [],
      finished: false,
      tematicaId: 1,
    };
    // Duelo de Termina la Palabra (null si no hay): una palabra, el puntaje va al duelo.
    this.terminaDuelo = null;
  }

  iniciarTerminaDuelo(dueloId, tematicaId) {
    app.duelos.dueloActivo = {
      id: dueloId,
      juego: 'termina',
    };
    this.terminaDuelo = {
      activo: true,
      dueloId,
    };
    app.navegacion.goTo('termina');
    const overlay = document.getElementById('terminaStartOverlay');
    if (overlay) overlay.style.display = 'none';
    this.initTermina(tematicaId || 1);
  }

  async initTermina(tematicaId) {
    tematicaId = Number(tematicaId) || this.terminaState.tematicaId || 1;
    this.terminaState.tematicaId = tematicaId;
    let word = null;
    try {
      const res = await fetch('/api/wordle/palabra?tematica=' + tematicaId, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.palabra) word = data.palabra.toLowerCase();
    } catch (e) {
      console.error(e);
    }
    if (!word) {
      const sec = app.nucleo.APP_EL.secTermina;
      if (sec) {
        sec.innerHTML = `
        <div class="game-screen-header">
          <button class="btn-back" onclick="goTo('juegos')">← Volver a Juegos</button>
          <div class="game-screen-title"><span>${app.utils.gameIconSVG('termina', 22)}</span> Termina la Palabra</div>
          <div class="game-screen-theme">${app.preguntados.temaLabelConDuelo(this.terminaDuelo && this.terminaDuelo.activo, tematicaId)}</div>
        </div>
        <div class="coming-soon-box" style="margin-top:2rem;">
          <h2>Sin palabras</h2>
          <p>Aún no hay palabras cargadas para esta temática. (Recordá correr python crear_bd.py)</p>
          <button class="btn-play" style="margin-top:20px" onclick="goTo('juegos')">← Volver a Juegos</button>
        </div>`;
      }
      // Si es un duelo y la temática no tiene palabras cargadas, reportamos
      // 0 puntos para no dejarlo colgado (mismo criterio que Preguntados).
      if (this.terminaDuelo && this.terminaDuelo.activo) {
        const dueloId = this.terminaDuelo.dueloId;
        this.terminaDuelo = null;
        app.duelos.finalizarDueloConPuntaje(dueloId, 0);
      }
      return;
    }

    // Revelar entre 30-50% de las letras (posiciones aleatorias)
    const totalReveal = Math.max(1, Math.floor(word.length * 0.35));
    const positions = [...Array(word.length).keys()].sort(() => Math.random() - 0.5).slice(0, totalReveal);
    const revealed = word
      .split('')
      .map((l, i) => (positions.includes(i) ? l : '_'))
      .join('');
    this.terminaState = {
      word,
      revealed,
      intentos: 0,
      guesses: [],
      finished: false,
      tematicaId,
    };
    app.nucleo.APP_EL.terminaThemeLabel.textContent = app.preguntados.temaLabelConDuelo(
      this.terminaDuelo && this.terminaDuelo.activo,
      tematicaId,
    );
    this.renderTermina();
  }

  renderTermina() {
    const sec = app.nucleo.APP_EL.secTermina;
    const { word, revealed, intentos, guesses, finished } = this.terminaState;
    const intentosHTML = Array.from(
      {
        length: TerminaPalabra.TERMINA_MAX,
      },
      (_, i) => {
        if (i < guesses.length) {
          const g = guesses[i];
          return `<div class="termina-intento ${g.correct ? 'correct' : 'wrong'}">
        ${g.text} ${g.correct ? '✅' : '❌'}
      </div>`;
        }
        return `<div class="termina-intento empty">${i < intentos ? '' : '—'}</div>`;
      },
    ).join('');
    const displayWord = finished
      ? word.toUpperCase()
      : revealed
          .split('')
          .map(
            (l, i) =>
              `<span class="termina-letra ${l != '_' ? 'revelada' : ''}">${l === '_' ? '_' : l.toUpperCase()}</span>`,
          )
          .join('');

    // En duelo no se ofrece "Nueva palabra" (el duelo era una sola palabra):
    // el cartel de resultado del duelo se encarga de la navegación siguiente.
    const botonesFinTermina =
      this.terminaDuelo && this.terminaDuelo.activo
        ? ''
        : `
        <div style="display:flex;gap:1rem;justify-content:center;margin-top:1rem;">
          <button class="btn-play" style="max-width:220px;" onclick="initTermina(${this.terminaState.tematicaId})"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>Nueva palabra</button>
          <button class="btn-back" onclick="goTo('juegos')">← Volver a Juegos</button>
        </div>`;
    sec.innerHTML = `
    <div class="game-screen-header">
      <button class="btn-back" onclick="goTo('juegos')">← Volver a Juegos</button>
      <div class="game-screen-title"><span>${app.utils.gameIconSVG('termina', 22)}</span> Termina la Palabra</div>
      <div class="game-screen-theme" id="termina-theme-label">${app.preguntados.temaLabelConDuelo(this.terminaDuelo && this.terminaDuelo.activo, this.terminaState.tematicaId)}</div>
    </div>
    <div class="termina-wrap">
      <p class="termina-hint">Completá la palabra. Tenés ${TerminaPalabra.TERMINA_MAX - intentos} intentos restantes.</p>
      <div class="termina-display">${displayWord}</div>
      ${
        !finished
          ? `
        <div class="termina-input-row">
          <input class="termina-input" id="terminaInput" type="text"
            placeholder="Escribí la palabra completa..."
            maxlength="${word.length + 3}"
            onkeydown="if(event.key==='Enter') submitTermina()"
            autocomplete="off" autocorrect="off" spellcheck="false" />
          <button class="btn-play" style="min-width:100px;" onclick="submitTermina()">Enviar</button>
        </div>`
          : ''
      }
      <div class="termina-intentos">${intentosHTML}</div>
      ${
        finished
          ? `
        <div class="termina-result ${guesses[guesses.length - 1]?.correct ? 'win' : 'lose'}">
          ${guesses[guesses.length - 1]?.correct ? '🎉 ¡Correcto!' : '💀 Era: ' + word.toUpperCase()}
        </div>
        ${botonesFinTermina}`
          : ''
      }
    </div>`;
    if (!finished) {
      setTimeout(() => document.getElementById('terminaInput')?.focus(), 50);
    }
  }

  submitTermina() {
    const input = document.getElementById('terminaInput');
    if (!input) return;
    const guess = input.value.trim().toLowerCase();
    if (!guess) return;
    const { word } = this.terminaState;
    const correct = guess === word;
    this.terminaState.guesses.push({
      text: guess.toUpperCase(),
      correct,
    });
    this.terminaState.intentos++;
    if (correct || this.terminaState.intentos >= TerminaPalabra.TERMINA_MAX) {
      this.terminaState.finished = true;
      const pts = correct ? Math.max(200, 600 - (this.terminaState.intentos - 1) * 100) : 25;

      // En duelo: no se guarda puntaje normal ni logros, el puntaje va
      // directo al duelo (mismo criterio que ahorcadoDuelo/wordleDuelo).
      if (this.terminaDuelo && this.terminaDuelo.activo) {
        const dueloId = this.terminaDuelo.dueloId;
        this.renderTermina();
        this.terminaDuelo = null;
        setTimeout(() => app.duelos.finalizarDueloConPuntaje(dueloId, pts), 1400);
        return;
      }
      app.puntuaciones.guardarPuntaje(3, pts, this.terminaState.tematicaId); // juego_id=3 Termina la Palabra
      app.logros.registrarProgresoJuego('termina', {
        termina_racha: correct,
        ...(correct
          ? {
              termina_completadas: 1,
              termina_tematicas: [this.terminaState.tematicaId],
              ...(this.terminaState.intentos === 1
                ? {
                    termina_1intento: 1,
                  }
                : {}),
              ...(this.terminaState.intentos <= 2
                ? {
                    termina_eficientes: 1,
                  }
                : {}),
              ...(word.length >= 10
                ? {
                    termina_palabraLarga: 1,
                  }
                : {}),
              ...(this.terminaState.intentos === TerminaPalabra.TERMINA_MAX
                ? {
                    termina_ultimoMomento: 1,
                  }
                : {}),
            }
          : {}),
      });
    } else {
      // UI-004: dar feedback progresivo — revelar una letra oculta más
      // por cada intento fallido, para evitar la frustración del jugador.
      const ocultas = [];
      this.terminaState.revealed.split('').forEach((l, i) => {
        if (l === '_') ocultas.push(i);
      });
      if (ocultas.length > 0) {
        const idx = ocultas[Math.floor(Math.random() * ocultas.length)];
        const chars = this.terminaState.revealed.split('');
        chars[idx] = word[idx];
        this.terminaState.revealed = chars.join('');
      }
    }
    this.renderTermina();
  }
}

// AdivinaCosa — Minijuego Adivina la Cosa (normal y duelo). (app.adivina)
class AdivinaCosa extends Modulo {
  // Items de respaldo por temática, por si falla /api/adivina/items.
  // Cada item: respuesta, pistas (de vaga a específica), imagen y aliases.
  static ADIVINA_DATA = {
    1: [
      // Videojuegos
      {
        respuesta: 'minecraft',
        aliases: ['mine craft'],
        imagen: 'logos/videojuegos/minecraft.jpg',
        pistas: [
          'Es un videojuego de mundo abierto lanzado en 2011.',
          'Podés construir estructuras usando bloques.',
          'Incluye un modo supervivencia donde debés comer y combatir criaturas.',
          'El Creeper es uno de sus enemigos más icónicos.',
        ],
      },
      {
        respuesta: 'god of war',
        aliases: ['god of war', 'godofwar'],
        imagen: 'logos/videojuegos/god-of-war.jpg',
        pistas: [
          'Es una saga de acción y aventura con temática mitológica.',
          'El protagonista es un espartano con marcas blancas en la piel.',
          'En las entregas recientes viaja por la mitología nórdica con su hijo Atreus.',
          'Su nombre es Kratos.',
        ],
      },
      {
        respuesta: 'pokemon',
        aliases: ['pokémon', 'pokemon rojo', 'pokémon rojo'],
        imagen: 'logos/videojuegos/pokemon-rojo.jpg',
        pistas: [
          'Es una saga de RPG donde coleccionás y entrenás criaturas.',
          'Tu objetivo principal es vencer a los 8 líderes de gimnasio.',
          'La primera entrega se lanzó en 1996 para Game Boy.',
          'El Pokémon más famoso de la saga es Pikachu.',
        ],
      },
      {
        respuesta: 'silent hill',
        aliases: ['silent hill'],
        imagen: 'logos/videojuegos/silent-hill.jpg',
        pistas: [
          'Es una saga de videojuegos de terror psicológico.',
          'Transcurre en una ciudad envuelta en niebla y oscuridad.',
          'Pyramid Head es uno de sus enemigos más reconocibles.',
          'Fue desarrollada por Konami a fines de los 90.',
        ],
      },
    ],
    2: [
      // Películas
      {
        respuesta: 'el origen de los guardianes',
        aliases: ['rise of the guardians', 'origen de los guardianes', 'guardianes'],
        imagen: 'logos/pelicula/el-origen-de-los-guardianes.jpg',
        pistas: [
          'Es una película de animación de DreamWorks del año 2012.',
          'Los protagonistas son figuras míticas como el Conejo de Pascua y Santa Claus.',
          'Un villano llamado Pitch Black quiere que los niños dejen de creer.',
          'Jack Frost es el protagonista principal.',
        ],
      },
      {
        respuesta: 'metegol',
        aliases: ['foosball', 'underdogs'],
        imagen: 'logos/pelicula/metegol.jpg',
        pistas: [
          'Es una película de animación argentina estrenada en 2013.',
          'Fue producida por Juan José Campanella.',
          'Los personajes de un metegol cobran vida para ayudar al protagonista.',
          'Ganó el Premio Goya a Mejor Película de Animación.',
        ],
      },
      {
        respuesta: 'rapido y furioso',
        aliases: ['rápido y furioso', 'fast and furious', 'fast furious', 'fast & furious'],
        imagen: 'logos/pelicula/rapido-y-furioso.jpg',
        pistas: [
          'Es una saga de acción estadounidense con múltiples películas.',
          'Gira en torno a carreras ilegales de autos y misiones de alto riesgo.',
          'Dominic Toretto es uno de sus personajes principales.',
          'Vin Diesel y Paul Walker son los actores más asociados a la saga.',
        ],
      },
      {
        respuesta: 'scary movie',
        aliases: ['scary movie 1'],
        imagen: 'logos/pelicula/scary-movie.jpg',
        pistas: [
          'Es una comedia de parodia de películas de terror de los años 90.',
          'Se burla de cintas como Scream y Sé Lo Que Hiciste El Verano Pasado.',
          'Fue dirigida por Keenen Ivory Wayans en el año 2000.',
          'La protagonista es Cindy Campbell, interpretada por Anna Faris.',
        ],
      },
    ],
    3: [
      // Anime
      {
        respuesta: 'naruto',
        aliases: ['naruto shippuden', 'naruto uzumaki'],
        imagen: 'logos/anime/naruto.jpg',
        pistas: [
          'Es un anime shōnen que sigue la vida de un joven ninja.',
          'El protagonista sueña con convertirse en Hokage de su aldea.',
          'Tiene sellado en su cuerpo un zorro de nueve colas llamado Kurama.',
          'El nombre del protagonista es el mismo que el del anime.',
        ],
      },
      {
        respuesta: 'goku',
        aliases: ['son goku', 'dragon ball', 'dragon ball z'],
        imagen: 'logos/anime/goku-jr.jpg',
        pistas: [
          'Es un personaje de una de las sagas de anime más famosas del mundo.',
          'Es un Saiyan cuya técnica más emblemática es el Kamehameha.',
          'Pelea contra enemigos cada vez más poderosos para proteger la Tierra.',
          'Su nombre completo es Son Goku.',
        ],
      },
      {
        respuesta: 'eren',
        aliases: ['eren yeager', 'eren jaeger', 'attack on titan', 'shingeki no kyojin'],
        imagen: 'logos/anime/eren.jpg',
        pistas: [
          'Es el protagonista de un anime de acción y drama oscuro.',
          'Vive en un mundo amenazado por gigantes caníbales llamados Titanes.',
          'Posee la habilidad de transformarse en un Titán.',
          'Su apellido es Yeager y el anime se llama Shingeki no Kyojin.',
        ],
      },
      {
        respuesta: 'kazuma',
        aliases: ['kazuma sato', 'konosuba', 'kono subarashii'],
        imagen: 'logos/anime/kazuma.jpg',
        pistas: [
          'Es el protagonista de un anime de isekai y comedia.',
          'Fue transportado a un mundo de fantasía después de morir de forma ridícula.',
          'Viaja con un grupo de compañeras bastante incompetentes.',
          'El anime se llama KonoSuba.',
        ],
      },
    ],
    4: [
      // Programación
      {
        respuesta: 'python',
        aliases: ['python 3', 'python3'],
        imagen: 'logos/programacion/Python.png',
        pistas: [
          'Es uno de los lenguajes de programación más populares del mundo.',
          'Se usa mucho en ciencia de datos, inteligencia artificial y scripting.',
          'Su sintaxis es limpia y muy legible, ideal para principiantes.',
          'Su nombre hace referencia a un grupo de comediantes británicos.',
        ],
      },
      {
        respuesta: 'node',
        aliases: ['node.js', 'nodejs'],
        imagen: 'logos/programacion/node-js.png',
        pistas: [
          'Es un entorno de ejecución para JavaScript del lado del servidor.',
          'Está basado en el motor V8 de Google Chrome.',
          'Usa un modelo de entrada/salida no bloqueante, ideal para APIs.',
          'Se suele usar junto a Express para crear servidores web.',
        ],
      },
      {
        respuesta: 'arduino',
        aliases: [],
        imagen: 'logos/programacion/arduino.png',
        pistas: [
          'Es una plataforma de hardware y software de código abierto.',
          'Se usa para crear prototipos electrónicos y proyectos DIY.',
          'Su placa física es de color azul o verde y tiene pines de entrada/salida.',
          'Se programa con un lenguaje basado en C/C++.',
        ],
      },
      {
        respuesta: 'visual studio',
        aliases: ['visual studio code', 'vscode', 'vs code', 'vs'],
        imagen: 'logos/programacion/visual-studio.png',
        pistas: [
          'Es un editor de código desarrollado por Microsoft.',
          'Es altamente extensible mediante plugins y extensiones.',
          'Tiene integración nativa con Git y un terminal integrado.',
          'Es el editor de código más usado en el mundo según encuestas de Stack Overflow.',
        ],
      },
    ],
  };
  constructor() {
    super();
    this.adivinaState = null;
    // Duelo de Adivina la Cosa (null si no hay): una ronda, arranca directo.
    this.adivinaDuelo = null;
  }

  iniciar() {
    document.addEventListener('DOMContentLoaded', () => {
      const inp = app.nucleo.APP_EL.adivinaInput;
      if (inp)
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.submitAdivina();
        });
    });
  }

  iniciarAdivinaDuelo(dueloId, tematicaId) {
    app.duelos.dueloActivo = {
      id: dueloId,
      juego: 'adivina',
    };
    this.adivinaDuelo = {
      activo: true,
      dueloId,
    };
    app.navegacion.goTo('adivina');
    this.initAdivina(tematicaId || 1).then(() => {
      if (this.adivinaDuelo && this.adivinaDuelo.activo) this.startAdivina();
    });
  }

  stopAdivina() {
    this.adivinaState = null;
  }

  async initAdivina(tematicaId) {
    const tId = tematicaId && /^\d+$/.test(String(tematicaId)) ? Number(tematicaId) : 1;
    let items = [];
    try {
      const res = await fetch(`/api/adivina/items?tematica=${tId}`, {
        cache: 'no-store',
      });
      items = await res.json();
    } catch (e) {
      console.error(e);
    }

    // Fallback: la API falló o todavía no hay items cargados en la BD para
    // esta temática — mismo criterio que Sopa, mejor jugar con el set viejo
    // que dejar el juego sin arrancar.
    if (!Array.isArray(items) || items.length === 0) {
      items = AdivinaCosa.ADIVINA_DATA[tId] || AdivinaCosa.ADIVINA_DATA[1];
    }
    items = app.utils.shuffle([...items]);
    this.adivinaState = {
      tematicaId: tId,
      items,
      itemIdx: 0,
      score: 0,
      pistasUsed: 0,
      finished: false,
    };
    const enDuelo = this.adivinaDuelo && this.adivinaDuelo.activo;
    const labelEl = document.getElementById('adivina-theme-label');
    if (labelEl) labelEl.textContent = app.preguntados.temaLabelConDuelo(enDuelo, tId);

    // Mostrar overlay de inicio (en duelo, startAdivina() lo cierra enseguida)
    const ov = app.nucleo.APP_EL.adivinaOverlay;
    app.nucleo.APP_EL.adivinaOverlayEmoji.textContent = enDuelo ? '⚔️' : '🕵️';
    app.nucleo.APP_EL.adivinaOverlayTitle.textContent = enDuelo ? '¡Arrancó el duelo!' : 'Adivina la Cosa';
    app.nucleo.APP_EL.adivinaOverlayDesc.textContent = `Se muestran ${items.length} items de la temática seleccionada.\nCuantas menos pistas uses, ¡más puntos ganás!`;
    app.nucleo.APP_EL.adivinaOverlayBtn.textContent = '▶ Empezar';
    app.nucleo.APP_EL.adivinaOverlayBtn.onclick = this.startAdivina;
    ov.style.display = 'flex';
    app.nucleo.APP_EL.adivinaGame.style.display = 'none';
  }

  startAdivina() {
    if (!this.adivinaState) return;
    app.nucleo.APP_EL.adivinaOverlay.style.display = 'none';
    app.nucleo.APP_EL.adivinaGame.style.display = 'flex';
    this.adivinaState.itemIdx = 0;
    this.adivinaState.score = 0;
    this.adivinaState.pistasUsed = 0;
    this.adivinaState.pistasRevealedThisItem = [];
    this.adivinaState.pistasUsedThisItem = 0;
    this.adivinaState.respondido = false;
    this.renderAdivinaItem();
  }

  renderAdivinaItem() {
    const s = this.adivinaState;
    const item = s.items[s.itemIdx];

    app.nucleo.APP_EL.adivinaItemNum.textContent = s.itemIdx + 1;
    app.nucleo.APP_EL.adivinaItemTotal.textContent = s.items.length;
    app.nucleo.APP_EL.adivinaScore.textContent = s.score;
    app.nucleo.APP_EL.adivinaPistasUsed.textContent = s.pistasUsedThisItem || 0;

    app.nucleo.APP_EL.adivinaPistasList.innerHTML = '';
    s.pistasRevealedThisItem = s.pistasRevealedThisItem || [];
    for (const pista of s.pistasRevealedThisItem) {
      const el = document.createElement('div');
      el.className = 'adivina-pista-item';
      el.textContent = `🔹 ${pista}`;
      app.nucleo.APP_EL.adivinaPistasList.appendChild(el);
    }

    const btn = app.nucleo.APP_EL.adivinaBtnPista;
    const remaining = item.pistas.length - (s.pistasRevealedThisItem?.length || 0);
    btn.disabled = remaining === 0;
    btn.querySelector ? null : null;
    app.nucleo.APP_EL.adivinaPistaCosto.textContent = `(-${this.pistasCosto(s.pistasRevealedThisItem?.length || 0)} pts)`;

    this.renderAdivinaCanvas(item.imagen, s.pistasRevealedThisItem?.length || 0, item.pistas.length);

    app.nucleo.APP_EL.adivinaInput.value = '';
    app.nucleo.APP_EL.adivinaInput.disabled = false;
    app.nucleo.APP_EL.adivinaFeedback.style.display = 'none';
    setTimeout(() => app.nucleo.APP_EL.adivinaInput?.focus(), 50);

    // Botón "Me rindo": solo disponible cuando ya no quedan más pistas para pedir
    const btnRendirse = app.nucleo.APP_EL.adivinaBtnRendirse;
    if (btnRendirse) btnRendirse.style.display = remaining === 0 ? 'block' : 'none';
  }

  pistasCosto(pistasYaReveladas) {
    // Primera pista: -100, segunda: -150, tercera: -200, cuarta: -250
    return 100 + pistasYaReveladas * 50;
  }

  puntosItem(pistasUsadas) {
    // Sin pistas: 500, con 1: 400, con 2: 250, con 3: 100, con 4+: 50
    const base = [500, 400, 250, 100, 50];
    return base[Math.min(pistasUsadas, 4)];
  }

  renderAdivinaCanvas(imgSrc, pistasCnt, totalPistas) {
    const canvas = app.nucleo.APP_EL.adivinaCanvas;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = imgSrc;
    img.onload = () => {
      // Nivel de pixelado: cuantas más pistas, más nítida (1=muy pixelada, 0=nítida)
      // 0 pistas = pixelSize 24, 1=16, 2=10, 3=5, 4=1
      const pixelSizes = [24, 16, 10, 5, 1];
      const pixelSize = pixelSizes[Math.min(pistasCnt, pixelSizes.length - 1)];
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (pixelSize <= 1) {
        ctx.drawImage(img, 0, 0, w, h);
        return;
      }

      const small = document.createElement('canvas');
      small.width = Math.max(1, Math.floor(w / pixelSize));
      small.height = Math.max(1, Math.floor(h / pixelSize));
      const sCtx = small.getContext('2d');
      sCtx.drawImage(img, 0, 0, small.width, small.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, w, h);
    };
    img.onerror = () => {
      // Fallback: cuadrado gris con ícono
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '64px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🕵️', canvas.width / 2, canvas.height / 2);
    };
  }

  revelarPista() {
    const s = this.adivinaState;
    if (!s) return;
    const item = s.items[s.itemIdx];
    if (!s.pistasRevealedThisItem) s.pistasRevealedThisItem = [];
    if (s.pistasRevealedThisItem.length >= item.pistas.length) return;
    const pista = item.pistas[s.pistasRevealedThisItem.length];
    s.pistasRevealedThisItem.push(pista);
    s.pistasUsedThisItem = s.pistasRevealedThisItem.length;
    s.pistasUsed = (s.pistasUsed || 0) + 1;
    this.renderAdivinaItem();
  }

  rendirseAdivina() {
    const s = this.adivinaState;
    if (!s || s.respondido) return;
    const item = s.items[s.itemIdx];
    s.respondido = true;
    app.logros.actualizarProgresoParcial('adivina', {
      adivina_racha: false,
    });
    const input = app.nucleo.APP_EL.adivinaInput;
    const fb = app.nucleo.APP_EL.adivinaFeedback;
    fb.style.display = 'block';
    fb.className = 'adivina-feedback incorrecto';
    fb.textContent = `❌ La respuesta era: ${item.respuesta.charAt(0).toUpperCase() + item.respuesta.slice(1)}`;
    input.disabled = true;
    app.nucleo.APP_EL.adivinaBtnPista.disabled = true;
    const btnRendirse = app.nucleo.APP_EL.adivinaBtnRendirse;
    if (btnRendirse) btnRendirse.style.display = 'none';

    this.renderAdivinaCanvas(item.imagen, 99, item.pistas.length);
    setTimeout(() => this.nextAdivinaItem(), 2200);
  }

  submitAdivina() {
    const s = this.adivinaState;
    if (!s || s.respondido) return;
    const item = s.items[s.itemIdx];
    const input = app.nucleo.APP_EL.adivinaInput;
    const raw = input.value
      .trim()
      .toLowerCase()
      .replace(/[áàä]/g, 'a')
      .replace(/[éèë]/g, 'e')
      .replace(/[íìï]/g, 'i')
      .replace(/[óòö]/g, 'o')
      .replace(/[úùü]/g, 'u');
    if (!raw) return;
    const normalize = (str) =>
      str
        .toLowerCase()
        .replace(/[áàä]/g, 'a')
        .replace(/[éèë]/g, 'e')
        .replace(/[íìï]/g, 'i')
        .replace(/[óòö]/g, 'o')
        .replace(/[úùü]/g, 'u');
    const correctas = [item.respuesta, ...item.aliases].map(normalize);
    const correcto = correctas.includes(raw);
    const fb = app.nucleo.APP_EL.adivinaFeedback;
    fb.style.display = 'block';
    const pistasUsadas = s.pistasRevealedThisItem?.length || 0;
    if (correcto) {
      s.respondido = true;
      const pts = this.puntosItem(pistasUsadas);
      s.score += pts;
      fb.className = 'adivina-feedback correcto';
      fb.textContent = `✅ ¡Correcto! +${pts} puntos`;
      input.disabled = true;
      app.nucleo.APP_EL.adivinaBtnPista.disabled = true;
      app.logros.actualizarProgresoParcial('adivina', {
        adivina_aciertos: 1,
        adivina_racha: true,
        ...(pistasUsadas === 0
          ? {
              adivina_sinpistas: 1,
            }
          : {}),
        ...(pistasUsadas === 1
          ? {
              adivina_1pista: 1,
            }
          : {}),
      });

      this.renderAdivinaCanvas(item.imagen, 99, item.pistas.length);
      setTimeout(() => this.nextAdivinaItem(), 1800);
    } else {
      fb.className = 'adivina-feedback incorrecto';
      fb.textContent = '❌ No es eso, seguí intentando o pedí más pistas.';
      input.value = '';
      setTimeout(() => {
        fb.style.display = 'none';
        input.focus();
      }, 1500);
    }
  }

  nextAdivinaItem() {
    const s = this.adivinaState;
    s.pistasRevealedThisItem = [];
    s.pistasUsedThisItem = 0;
    s.respondido = false;
    s.itemIdx++;
    if (s.itemIdx >= s.items.length) {
      s.finished = true;

      // En duelo: no se guarda puntaje normal ni logros, el puntaje va
      // directo al duelo (mismo criterio que sopaDuelo).
      if (this.adivinaDuelo && this.adivinaDuelo.activo) {
        const dueloId = this.adivinaDuelo.dueloId;
        this.adivinaDuelo = null;
        app.duelos.finalizarDueloConPuntaje(dueloId, s.score);
        return;
      }
      app.puntuaciones.guardarPuntaje(5, s.score, s.tematicaId); // juego_id=5 Adivina la Cosa
      app.logros.registrarProgresoJuego('adivina', {
        adivina_tematicas: [s.tematicaId],
        adivina_rondasCompletadas: 1,
        ...((s.pistasUsed || 0) === 0
          ? {
              adivina_rondasPerfectas: 1,
            }
          : {}),
      });
      const ov = app.nucleo.APP_EL.adivinaOverlay;
      app.nucleo.APP_EL.adivinaOverlayEmoji.textContent = '🏆';
      app.nucleo.APP_EL.adivinaOverlayTitle.textContent = '¡Juego terminado!';
      app.nucleo.APP_EL.adivinaOverlayDesc.textContent = `Tu puntaje final: ${s.score} puntos`;
      app.nucleo.APP_EL.adivinaOverlayBtn.textContent = '🔁 Jugar de nuevo';
      app.nucleo.APP_EL.adivinaOverlayBtn.onclick = this.startAdivina;
      ov.style.display = 'flex';
      return;
    }
    this.renderAdivinaItem();
  }
}

// InfoModal — Modal de información / créditos del equipo. (app.info)
class InfoModal extends Modulo {
  constructor() {
    super();
    this.currentInfoPage = 1;
    this.totalInfoPages = 4;
  }

  iniciar() {
    fetch('/api/admin/config')
      .then((r) => r.json())
      .then((c) => {
        if (c.color_tema) app.tema.setTemaSitio(c.color_tema);

        const banner = document.getElementById('systemBanner');
        const bannerText = document.getElementById('systemBannerText');
        if (banner && bannerText) {
          if (c.anuncio_activo === 'true' && c.anuncio_texto) {
            bannerText.textContent = c.anuncio_texto;
            banner.style.display = 'block';
          } else {
            banner.style.display = 'none';
          }
        }

        // Configure Dev Profile Links & Avatars
        const setDevProfile = async (nameText, url) => {
          if (url) {
            // Buscamos el elemento b por su texto en lugar de id
            const nameEl = Array.from(document.querySelectorAll('b')).find((e) =>
              e.textContent.includes(nameText),
            );
            if (!nameEl || !nameEl.parentElement) return;
            const teamMemberDiv = nameEl.parentElement.parentElement;
            const textDiv = nameEl.parentElement;
            const avatarDiv = teamMemberDiv.querySelector('.team-avatar');

            // Aseguramos que el div del texto se pueda expandir y el link quede a la derecha
            textDiv.style.flex = '1';
            let linkA = teamMemberDiv.querySelector('.dev-link-icon');
            if (!linkA) {
              // Limpiar links viejos si hubieran
              const oldA = textDiv.querySelector('a');
              if (oldA) oldA.remove();
              linkA = document.createElement('a');
              linkA.className = 'dev-link-icon';
              linkA.target = '_blank';

              // Estilo de botoncito arcade
              linkA.style.marginLeft = 'auto'; // Empuja al borde derecho
              linkA.style.display = 'flex';
              linkA.style.alignItems = 'center';
              linkA.style.justifyContent = 'center';
              linkA.style.textDecoration = 'none';
              linkA.style.width = '45px';
              linkA.style.height = '45px';
              linkA.style.backgroundColor = 'rgba(255,255,255,0.03)';
              linkA.style.borderRadius = '8px';
              linkA.style.border = '2px solid rgba(255,255,255,0.08)';
              linkA.style.transition = 'all 0.2s ease';
              let isGithub =
                url.toLowerCase().includes('github.com') || (!url.startsWith('http') && !url.includes('/'));
              let svgPath = isGithub
                ? 'M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z'
                : 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z';
              linkA.innerHTML = `<svg style="width:1.8rem;height:1.8rem;fill:rgba(255,255,255,0.7);transition:fill 0.2s;" viewBox="0 0 24 24"><path d="${svgPath}"/></svg>`;

              // Efectos de hover arcade
              linkA.onmouseover = () => {
                linkA.style.backgroundColor = 'var(--yellow)';
                linkA.style.borderColor = 'var(--yellow)';
                linkA.style.boxShadow = '0 0 15px rgba(250, 204, 21, 0.4)';
                linkA.style.transform = 'scale(1.05)';
                linkA.querySelector('svg').style.fill = 'var(--bg-dark)';
              };
              linkA.onmouseout = () => {
                linkA.style.backgroundColor = 'rgba(255,255,255,0.03)';
                linkA.style.borderColor = 'rgba(255,255,255,0.08)';
                linkA.style.boxShadow = 'none';
                linkA.style.transform = 'scale(1)';
                linkA.querySelector('svg').style.fill = 'rgba(255,255,255,0.7)';
              };

              // Lo adjuntamos AL DIV CONTENEDOR PRINCIPAL (.team-member)
              teamMemberDiv.appendChild(linkA);
            }
            let finalUrl = url;
            if (!url.startsWith('http')) {
              finalUrl = 'https://github.com/' + url;
            }
            linkA.href = finalUrl;
            linkA.title = 'Visitar Perfil';
            if (avatarDiv) {
              let githubUsername = null;
              if (!url.startsWith('http') && !url.includes('/')) {
                githubUsername = url;
              } else if (url.includes('github.com/')) {
                githubUsername = url.split('github.com/')[1].split('/')[0];
              }
              if (githubUsername) {
                try {
                  const res = await fetch('https://api.github.com/users/' + githubUsername);
                  if (res.ok) {
                    const data = await res.json();
                    if (data.avatar_url) {
                      avatarDiv.innerHTML = `<img src="${data.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" alt="${githubUsername}">`;
                    }
                  }
                } catch (e) {}
              }
            }
          }
        };
        setDevProfile('Rodrigo Antunez', c.github_rodrigo);
        setDevProfile('Veliz Santiago', c.github_santiago);
        setDevProfile('Juarez Kevin', c.github_kevin);
      })
      .catch(() => {});
  }

  openInfoModal() {
    app.nucleo.APP_EL.infoOverlay.classList.add('show');
    this.currentInfoPage = 1;
    this.updateInfoModal();
  }

  closeInfoModal() {
    app.nucleo.APP_EL.infoOverlay.classList.remove('show');
  }

  changeInfoPage(dir) {
    this.currentInfoPage += dir;
    if (this.currentInfoPage < 1) this.currentInfoPage = 1;
    if (this.currentInfoPage > this.totalInfoPages) this.currentInfoPage = this.totalInfoPages;
    this.updateInfoModal();
  }

  goToInfoPage(page) {
    this.currentInfoPage = page;
    if (this.currentInfoPage < 1) this.currentInfoPage = 1;
    if (this.currentInfoPage > this.totalInfoPages) this.currentInfoPage = this.totalInfoPages;
    this.updateInfoModal();
  }

  updateInfoModal() {
    document.querySelectorAll('.info-page').forEach((p) => p.classList.remove('active'));
    const activePage = document.getElementById('infoPage' + this.currentInfoPage);
    if (activePage) activePage.classList.add('active');

    const dots = document.querySelectorAll('#infoDots .dot');
    dots.forEach((dot, index) => {
      if (index === this.currentInfoPage - 1) dot.classList.add('active');
      else dot.classList.remove('active');
    });

    // Sin "Atrás" en la primera página ni "Siguiente" en la última.
    const btnAtras = document.getElementById('infoBtnAtras');
    const btnSiguiente = document.getElementById('infoBtnSiguiente');
    if (btnAtras) btnAtras.style.visibility = this.currentInfoPage === 1 ? 'hidden' : 'visible';
    if (btnSiguiente)
      btnSiguiente.style.visibility = this.currentInfoPage === this.totalInfoPages ? 'hidden' : 'visible';
  }
}

// AvisosManager — Avisos globales: CRUD desde el admin y banner público. (app.avisos)
class AvisosManager extends Modulo {
  constructor() {
    super();
    this.avisoStyle = document.createElement('style');
  }

  iniciar() {
    this.avisoStyle.textContent = `
@keyframes slideDownAviso {
    from { transform: translateY(-100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
`;
    document.head.appendChild(this.avisoStyle);

    document.addEventListener('DOMContentLoaded', () => {
      // wait a bit for standard init
      setTimeout(this.loadAvisoPublico, 500);
    });

  }

  async loadAdminAvisos() {
    const token = localStorage.getItem('unigames_token');
    if (!token) return;
    try {
      const res = await app.api.authFetch('/api/admin/avisos');
      if (!res.ok) throw new Error('Error fetching avisos');
      const avisos = await res.json();
      const listDiv = document.getElementById('adminAvisosList');
      if (avisos.length === 0) {
        listDiv.innerHTML =
          '<div style="text-align:center; color:#94A3B8; font-size:12px; padding:10px;">No hay avisos creados.</div>';
        return;
      }
      listDiv.innerHTML = avisos
        .map(
          (aviso) => `
            <div style="background:rgba(0,0,0,0.3); border-radius:6px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between; border-left: 4px solid ${aviso.color || '#3b82f6'};">
                <div style="flex:1;">
                    <div style="font-size:13px; color:#F1F5F9; font-weight:600; margin-bottom:4px;">
                        ${app.utils.sanitizeHTML(aviso.icono || '📢')} ${app.utils.sanitizeHTML(aviso.texto)}
                    </div>
                    <div style="font-size:10px; color:#94A3B8;">
                        Estado: <span style="color: ${aviso.activo ? '#4ade80' : '#94A3B8'}">${aviso.activo ? 'Activo (Mostrándose)' : 'Inactivo'}</span>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    ${aviso.activo ? `<button onclick="toggleAvisoAdmin(${aviso.id}, false)" style="background:#334155; border:none; color:white; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; font-weight:bold;">Desactivar</button>` : `<button onclick="toggleAvisoAdmin(${aviso.id}, true)" style="background:#2563eb; border:none; color:white; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; font-weight:bold;">Activar</button>`}
                    <button onclick="eliminarAvisoAdmin(${aviso.id})" style="background:#ef4444; border:none; color:white; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; font-weight:bold;">X</button>
                </div>
            </div>
        `,
        )
        .join('');
    } catch (e) {
      console.error(e);
    }
  }

  async crearAvisoAdmin() {
    const texto = document.getElementById('adminAvisoNuevoTexto').value.trim();
    const icono = document.getElementById('adminAvisoNuevoIcono').value.trim() || '📢';
    const color = document.getElementById('adminAvisoNuevoColor').value;
    if (!texto) {
      alert('El texto del aviso no puede estar vacío');
      return;
    }
    try {
      const res = await app.api.authFetch('/api/admin/avisos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texto,
          icono,
          color,
          activo: false,
        }),
      });
      if (res.ok) {
        document.getElementById('adminAvisoNuevoTexto').value = '';
        this.loadAdminAvisos();
      } else {
        alert('Error al crear aviso');
      }
    } catch (e) {
      console.error(e);
    }
  }

  async toggleAvisoAdmin(id, activar) {
    try {
      const res = await app.api.authFetch(`/api/admin/avisos/${id}/toggle`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activo: activar,
        }),
      });
      if (res.ok) {
        this.loadAdminAvisos();
        // Refrescar el aviso en la UI pública si es necesario
        this.loadAvisoPublico();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async eliminarAvisoAdmin(id) {
    if (!confirm('¿Seguro que deseas eliminar este aviso de forma permanente?')) return;
    try {
      const res = await app.api.authFetch(`/api/admin/avisos/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        this.loadAdminAvisos();
        this.loadAvisoPublico();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async loadAvisoPublico() {
    try {
      const res = await fetch('/api/admin/avisos/activo');
      if (!res.ok) return;
      const aviso = await res.json();

      const existingAviso = document.getElementById('global-aviso-banner');
      if (existingAviso) existingAviso.remove();
      if (aviso) {
        const avisoHTML = `
                <div id="global-aviso-banner" style="background: ${aviso.color || '#3b82f6'}; color: white; text-align: center; padding: 12px 20px; font-weight: 600; font-size: 14px; position: relative; z-index: 50; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); animation: slideDownAviso 0.5s ease-out forwards;">
                    <span style="margin-right:8px; font-size:16px;">${app.utils.sanitizeHTML(aviso.icono || '📢')}</span>
                    ${app.utils.sanitizeHTML(aviso.texto)}
                </div>
            `;
        // Insertar justo debajo del header
        const header = document.querySelector('header');
        if (header) {
          header.insertAdjacentHTML('afterend', avisoHTML);
        }
      }
    } catch (e) {
      console.error('Error cargando aviso publico:', e);
    }
  }
}

// Utils — Utilidades generales (sanitizar HTML, íconos SVG, mezclar arrays). (app.utils)
class Utils extends Modulo {
  shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
  }

  // Escapa texto para HTML: contenido y atributos ("..." o '...').
  sanitizeHTML(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  // Texto como argumento dentro de un onclick="...": sanitizeHTML solo no alcanza
  // (el navegador decodifica &#39; antes de ejecutar). Uso sin comillas:
  // onclick="f(${app.utils.jsArg(nombre)})"
  jsArg(valor) {
    return this.sanitizeHTML(JSON.stringify(String(valor ?? '')));
  }

  // Íconos de línea de cada minijuego (tarjetas, puntuación, logros).
  gameIconSVG(id, size = 22) {
    const paths = {
      sopa: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>',
      preguntados:
        '<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line>',
      termina:
        '<polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line>',
      ahorcado:
        '<line x1="4" y1="21" x2="16" y2="21"></line><line x1="7" y1="21" x2="7" y2="3"></line><line x1="7" y1="3" x2="17" y2="3"></line><line x1="17" y1="3" x2="17" y2="7"></line><circle cx="17" cy="10" r="3"></circle>',
      adivina: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
      wordle:
        '<rect x="2" y="8" width="6" height="8" rx="1.5"></rect><rect x="9" y="8" width="6" height="8" rx="1.5"></rect><rect x="16" y="8" width="6" height="8" rx="1.5"></rect>',
      runner: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
      castle_escape:
        '<rect x="4" y="10" width="16" height="11"></rect><rect x="4" y="6" width="3" height="4"></rect><rect x="10.5" y="4" width="3" height="6"></rect><rect x="17" y="6" width="3" height="4"></rect><path d="M10 21v-5a2 2 0 0 1 4 0v5"></path>',
      rpg_pixel: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
      pixel_survi: '<rect x="3" y="13" width="18" height="8"></rect><path d="M3 13l4-4 5 3 4-5 5 6"></path>',
      general:
        '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
      todos:
        '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
    };
    const inner = paths[id] || paths.general;
    return `<svg class="game-icon-svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  }

  // Íconos de línea chicos para textos/botones sueltos (chequear, agregar,
  // advertencia, persona, papelera, duelo, etc.) — mismo estilo que el
  // resto de los íconos de la app.
  uiIconSVG(name, size = 14) {
    const paths = {
      check: '<polyline points="20 6 9 17 4 12"></polyline>',
      plus: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
      warning:
        '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
      user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
      users:
        '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
      trash:
        '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>',
      target:
        '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1"></circle>',
      lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>',
      crown: '<path d="M3 19h18"></path><path d="M5 19l-1.5-10L9 13l3-7 3 7 5.5-4L19 19"></path>',
      handshake:
        '<path d="M8.5 14.5 4 10l3.5-3.5a2 2 0 0 1 2.83 0l1.17 1.17"></path><path d="M15.5 14.5 20 10l-3.5-3.5a2 2 0 0 0-2.83 0l-1.17 1.17"></path><path d="M8.5 14.5l2 2a2 2 0 0 0 2.83 0l.34-.34a2 2 0 0 1 2.83 0L18 17.66"></path><path d="M9.5 13.5l1.79-1.79a2 2 0 0 1 2.83 0L15.5 13"></path>',
      maximize:
        '<path d="M8 3H5a2 2 0 0 0-2 2v3"></path><path d="M21 8V5a2 2 0 0 0-2-2h-3"></path><path d="M3 16v3a2 2 0 0 0 2 2h3"></path><path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>',
      minimize:
        '<path d="M8 3v3a2 2 0 0 1-2 2H3"></path><path d="M21 8h-3a2 2 0 0 1-2-2V3"></path><path d="M3 16h3a2 2 0 0 1 2 2v3"></path><path d="M16 21v-3a2 2 0 0 1 2-2h3"></path>',
    };
    const inner = paths[name] || '';
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  }

  // Cartel flotante genérico (mismo estilo visual que el toast de logros)
  // para avisos cortos como "Solicitud enviada" en vez de usar alert().
  mostrarToast(mensaje, tipo = 'info') {
    const toast = document.createElement('div');
    toast.className = 'app-toast' + (tipo === 'error' ? ' error' : '');
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2200);
  }
}

// ApiClient — Cliente HTTP del backend (agrega el token JWT). (app.api)
class ApiClient extends Modulo {
  async authFetch(url, options = {}) {
    const token = localStorage.getItem('unigames_token');
    const headers = { ...(options.headers || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 && token) this.sesionVencida();
    return res;
  }

  sesionVencida() {
    if (!app.auth.currentUser) return;
    app.auth.logout();
    app.utils.mostrarToast('Tu sesión venció: iniciá sesión de nuevo.', 'error');
    app.auth.openModal('login');
  }

  // Igual que authFetch, pero manda JSON y devuelve el JSON parseado; si
  // la respuesta no es ok, tira un Error con el mensaje del backend.
  async apiFetch(url, options = {}) {
    const res = await this.authFetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* respuesta sin body */
    }
    if (!res.ok) throw new Error((data && data.error) || 'Error de red');
    return data;
  }
}

// LanzadorJuegos — Selector de temática y arranque de los minijuegos desde las cards. (app.lanzador)
class LanzadorJuegos extends Modulo {
  // Los 6 minijuegos "clásicos" (los que usan el cartel de elegir temática +
  // jugar al entrar). Los juegos de acción (runner, castle_escape, rpg_pixel)
  // manejan su propio menú y no pasan por este flujo.
  static CLASSIC_GAME_IDS = ['ahorcado', 'wordle', 'sopa', 'preguntados', 'termina', 'adivina'];
  selectTheme(btn) {
    const parent = btn.closest('.theme-selector');
    parent.querySelectorAll('.theme-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
  }

  // Desde una tarjeta: solo navega; la temática se elige en la pantalla del juego.
  launchGame(gameKey, btn) {
    app.navegacion.goTo(gameKey);
    if (gameKey === 'runner') {
      // Entrada normal (no duelo): si había quedado un duelo colgado de una
      // visita anterior sin terminar, lo soltamos para no reportar mal un
      // puntaje de una partida libre como si fuera de duelo.
      if (app.duelos.dueloActivo && app.duelos.dueloActivo.juego === 'runner') app.duelos.dueloActivo = null;
      app.cargador.ensureRunnerLoaded().then(() => showRunnerMenu());
      return;
    }
    if (LanzadorJuegos.CLASSIC_GAME_IDS.includes(gameKey)) {
      this.resetGameStartMenu(gameKey);
    }
  }

  // Deja la pantalla del minijuego lista para arrancar: muestra el cartel de
  // inicio (con la temática por defecto seleccionada) y oculta/limpia lo que
  // haya quedado de una partida anterior.
  resetGameStartMenu(gameKey) {
    if (gameKey === 'adivina') {
      app.adivina.stopAdivina();
      app.adivina.adivinaDuelo = null;
      if (app.duelos.dueloActivo && app.duelos.dueloActivo.juego === 'adivina') app.duelos.dueloActivo = null;
      const ov = document.getElementById('adivinaOverlay');
      const themesWrap = document.getElementById('adivinaOverlayThemes');
      const emoji = document.getElementById('adivinaOverlayEmoji');
      const title = document.getElementById('adivinaOverlayTitle');
      const desc = document.getElementById('adivinaOverlayDesc');
      const btn = document.getElementById('adivinaOverlayBtn');
      if (emoji) emoji.textContent = '🕵️';
      if (title) title.textContent = 'Adivina la Cosa';
      if (desc) desc.innerHTML = 'Se muestran pistas una por una.<br>¡Cuantas menos uses, más puntos ganás!';
      if (btn) {
        btn.textContent = '▶ Jugar';
        btn.onclick = () => this.confirmGameStart('adivina');
      }
      if (themesWrap) themesWrap.style.display = '';
      if (ov) ov.style.display = 'flex';
      const game = document.getElementById('adivinaGame');
      if (game) game.style.display = 'none';
      return;
    }
    const overlay = document.getElementById(gameKey + 'StartOverlay');
    if (overlay) overlay.style.display = 'flex';
    if (gameKey === 'ahorcado' || gameKey === 'wordle') {
      const gameEl = document.getElementById(gameKey + 'Game');
      if (gameEl) gameEl.style.display = 'none';
    }
    if (gameKey === 'ahorcado') {
      // Si se abandonó un duelo a mitad de camino, no lo dejamos colgado.
      app.ahorcado.ahorcadoDuelo = null;
      if (app.duelos.dueloActivo && app.duelos.dueloActivo.juego === 'ahorcado')
        app.duelos.dueloActivo = null;
    }
    if (gameKey === 'wordle') {
      app.wordle.wordleDuelo = null;
      if (app.duelos.dueloActivo && app.duelos.dueloActivo.juego === 'wordle') app.duelos.dueloActivo = null;
    }
    if (gameKey === 'sopa') {
      clearInterval(app.sopa.sopaState.timer);
      app.sopa.sopaDuelo = null;
      if (app.duelos.dueloActivo && app.duelos.dueloActivo.juego === 'sopa') app.duelos.dueloActivo = null;
      const area = document.getElementById('sopaGameArea');
      if (area) area.innerHTML = '';
    }
    if (gameKey === 'preguntados') {
      clearInterval(app.preguntados.pregState.timer);
      app.preguntados.pregDuelo = null;
      if (app.duelos.dueloActivo && app.duelos.dueloActivo.juego === 'preguntados')
        app.duelos.dueloActivo = null;
      const area = document.getElementById('preguntadosGameArea');
      if (area) area.innerHTML = '';
    }
    if (gameKey === 'termina') {
      app.termina.terminaDuelo = null;
      if (app.duelos.dueloActivo && app.duelos.dueloActivo.juego === 'termina') app.duelos.dueloActivo = null;
      const area = document.getElementById('terminaGameArea');
      if (area) area.innerHTML = '';
    }
  }

  // Se ejecuta al tocar "▶ Jugar" en el cartel de inicio de cada minijuego:
  // lee la temática elegida, oculta el cartel y arranca el juego.
  confirmGameStart(gameKey) {
    if (gameKey === 'adivina') {
      const overlay = document.getElementById('adivinaOverlay');
      const selected = overlay ? overlay.querySelector('.theme-btn.selected') : null;
      const raw = selected ? selected.dataset.tematica : null;
      const tId = raw && /^\d+$/.test(raw) ? Number(raw) : 1;
      app.adivina.initAdivina(tId);
      return;
    }
    const overlay = document.getElementById(gameKey + 'StartOverlay');
    const selected = overlay ? overlay.querySelector('.theme-btn.selected') : null;
    const theme = selected ? selected.textContent.trim() : null;
    const raw = selected ? selected.dataset.tematica : null;
    if (overlay) overlay.style.display = 'none';
    const labelEl = document.getElementById(gameKey + '-theme-label');
    if (labelEl) labelEl.textContent = theme || '';
    if (gameKey === 'ahorcado') {
      const gameEl = document.getElementById('ahorcadoGame');
      if (gameEl) gameEl.style.display = 'flex';
      app.ahorcado.initAhorcado(raw || 'normal');
    }
    if (gameKey === 'wordle') {
      const gameEl = document.getElementById('wordleGame');
      if (gameEl) gameEl.style.display = 'flex';
      app.wordle.initWordle(raw);
    }
    if (gameKey === 'sopa') {
      const tId = raw === 'normal' ? 'normal' : raw && /^\d+$/.test(raw) ? Number(raw) : Preguntados.TEMATICA_MAP[theme] || 1;
      app.sopa.initSopa(tId);
    }
    if (gameKey === 'preguntados') {
      const tId = raw && /^\d+$/.test(raw) ? Number(raw) : Preguntados.TEMATICA_MAP[theme] || 1;
      app.preguntados.initPreguntados(tId);
    }
    if (gameKey === 'termina') {
      const tId = raw && /^\d+$/.test(raw) ? Number(raw) : Preguntados.TEMATICA_MAP[theme] || 1;
      app.termina.initTermina(tId);
    }
  }
}

// Notificaciones — Notificaciones del usuario: listado, badges y marcado como leídas. (app.notificaciones)
class Notificaciones extends Modulo {
  // Notificaciones (routes/notificaciones.js): amistad, avisos y récords superados.
  // Emoji + destino (goTo) según el tipo de notificación.
  static NOTIF_ICONOS = {
    solicitud_amistad: '🤝',
    aviso: '📢',
    record_superado: '🏆',
    duelo_reto: '⚔️',
    duelo_aceptado: '✅',
    duelo_resultado: '🏁',
  };
  iniciar() {
    // Cada 30s refresca el contador (no con la pestaña oculta: gasta batería).
    setInterval(() => {
      if (document.hidden) return;
      this.actualizarBadgeNotificaciones();
    }, 30000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.actualizarBadgeNotificaciones();
    });

  }

  formatearFechaNotif(fechaStr) {
    try {
      const f = new Date(fechaStr.replace(' ', 'T') + 'Z');
      return f.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '';
    }
  }

  openNotifModal() {
    const overlay = document.getElementById('notifOverlay');
    if (!overlay) return;
    overlay.classList.add('show');
    this.fetchNotificaciones();
  }

  closeNotifModal() {
    const overlay = document.getElementById('notifOverlay');
    if (overlay) overlay.classList.remove('show');
  }

  async fetchNotificaciones() {
    const body = document.getElementById('notifListBody');
    if (!body) return;
    body.innerHTML = '<div class="notif-empty">Cargando notificaciones...</div>';
    try {
      const notifs = await app.api.apiFetch('/api/notificaciones');
      this.renderNotificaciones(notifs);
      // Ya las estamos mostrando: refrescamos el badge (no las marca leídas,
      // eso pasa recién cuando el usuario toca cada una o "Marcar todas").
      this.actualizarBadgeNotificaciones();
    } catch (error) {
      console.error('Error al obtener notificaciones:', error);
      body.innerHTML = '<div class="notif-empty">No se pudieron cargar las notificaciones.</div>';
    }
  }

  renderNotificaciones(notifs) {
    const body = document.getElementById('notifListBody');
    if (!body) return;
    if (!notifs || notifs.length === 0) {
      body.innerHTML = '<div class="notif-empty">No tenés notificaciones todavía.</div>';
      return;
    }
    body.innerHTML = notifs
      .map(
        (n) => `
    <div class="notif-item ${n.leido ? '' : 'unread'}" id="notifItem-${n.id}" onclick="onClickNotif(${n.id}, ${n.leido ? 'true' : 'false'}, ${n.enlace ? `'${n.enlace}'` : 'null'}, '${n.tipo}')">
      <span class="notif-item-icon">${Notificaciones.NOTIF_ICONOS[n.tipo] || '🔔'}</span>
      <div class="notif-item-text">
        ${app.utils.sanitizeHTML(n.mensaje)}
        <span class="notif-item-date">${this.formatearFechaNotif(n.fecha)}</span>
      </div>
      <button class="notif-item-del" title="Eliminar" onclick="event.stopPropagation(); eliminarNotificacion(${n.id});">✕</button>
    </div>
  `,
      )
      .join('');
  }

  // Al tocar una notificación: si no estaba leída la marca como leída, y si
  // tiene una sección asociada (enlace) navega ahí y cierra el modal.
  async onClickNotif(id, yaLeida, enlace, tipo) {
    if (!yaLeida) await this.marcarNotifLeida(id, false);
    if (enlace) {
      this.closeNotifModal();
      app.navegacion.goTo(enlace);
      if (typeof tipo === 'string' && tipo.startsWith('duelo')) {
        app.amigos.mostrarTabAmigos('duelos');
      }
    }
  }

  async marcarNotifLeida(id, refrescarLista = true) {
    try {
      await app.api.apiFetch(`/api/notificaciones/${id}/leer`, {
        method: 'POST',
      });
      const item = document.getElementById(`notifItem-${id}`);
      if (item) item.classList.remove('unread');
      this.actualizarBadgeNotificaciones();
    } catch (error) {
      console.error('Error al marcar notificación como leída:', error);
    }
    if (refrescarLista) this.fetchNotificaciones();
  }

  async marcarTodasNotifLeidas() {
    try {
      await app.api.apiFetch('/api/notificaciones/leer-todas', {
        method: 'POST',
      });
      this.fetchNotificaciones();
    } catch (error) {
      app.utils.mostrarToast('No se pudieron marcar las notificaciones como leídas', 'error');
    }
  }

  async eliminarNotificacion(id) {
    try {
      await app.api.apiFetch(`/api/notificaciones/${id}`, {
        method: 'DELETE',
      });
      this.fetchNotificaciones();
    } catch (error) {
      app.utils.mostrarToast('No se pudo eliminar la notificación', 'error');
    }
  }

  // Actualiza el numerito rojo del botón "Notificaciones" en el menú lateral
  // derecho. Se llama al loguearse, al abrir/cerrar el modal, y cada 30s
  // mientras haya sesión iniciada (mismo criterio que actualizarBadgeSolicitudes).
  async actualizarBadgeNotificaciones() {
    const badge = document.getElementById('notifDrawerBadge');
    const toggleBtn = app.nucleo.APP_EL.accountToggle;
    if ((!badge && !toggleBtn) || !localStorage.getItem('unigames_token')) return;
    try {
      const data = await app.api.apiFetch('/api/notificaciones/no-leidas');
      const count = data.count || 0;
      if (badge) badge.innerHTML = count > 0 ? `<span class="lb-tab-badge">${count}</span>` : '';

      // Mismo contador en el botón redondo del header: borde rojo + numerito
      // asomando en la esquina, para que se note sin tener que abrir el menú.
      if (toggleBtn) {
        toggleBtn.classList.toggle('has-notif', count > 0);
        let dot = toggleBtn.querySelector('.account-notif-badge');
        if (count > 0) {
          if (!dot) {
            dot = document.createElement('span');
            dot.className = 'account-notif-badge';
            toggleBtn.appendChild(dot);
          }
          dot.textContent = count > 99 ? '99+' : String(count);
        } else if (dot) {
          dot.remove();
        }
      }
    } catch (error) {
      // silencioso: es solo un indicador
    }
  }
}

// AdminPanel — Panel de administración: configuración, usuarios, roles y dashboard. (app.admin)
class AdminPanel extends Modulo {
  openAdminModal() {
    document.getElementById('adminOverlay').classList.add('show');
    this.loadAdminDashboard();
    this.loadAdminUsers();
    this.loadAdminConfig();
    this.loadAdminUsers();
  }

  closeAdminModal() {
    document.getElementById('adminOverlay').classList.remove('show');
  }

  async loadAdminConfig() {
    try {
      const res = await fetch('/api/admin/config');
      const config = await res.json();
      if (config.color_tema) document.getElementById('adminTema').value = config.color_tema;
      if (config.github_rodrigo) document.getElementById('adminGitRodrigo').value = config.github_rodrigo;
      if (config.github_santiago) document.getElementById('adminGitSantiago').value = config.github_santiago;
      if (config.github_kevin) document.getElementById('adminGitKevin').value = config.github_kevin;
    } catch (e) {
      console.error('Error cargando config:', e);
    }
  }

  async saveAdminConfig() {
    const data = {
      color_tema: document.getElementById('adminTema').value,
      github_rodrigo: document.getElementById('adminGitRodrigo').value,
      github_santiago: document.getElementById('adminGitSantiago').value,
      github_kevin: document.getElementById('adminGitKevin').value,
    };
    try {
      const res = await app.api.authFetch('/api/admin/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        alert('Configuración guardada! La página se recargará para aplicar los cambios.');
        setTimeout(() => location.reload(), 500);
      } else {
        alert('Error guardando configuración');
      }
    } catch (e) {
      console.error(e);
    }
  }

  async loadAdminUsers() {
    const list = document.getElementById('adminUsersList');
    try {
      const res = await app.api.authFetch('/api/admin/usuarios');
      if (!res.ok) return (list.innerHTML = '<li>Error cargando usuarios</li>');
      let users = await res.json();

      const searchInput = document.getElementById('adminUserSearch');
      window.allAdminUsers = users;
      const renderUsers = (userList) => {
        list.innerHTML = userList
          .map(
            (u) => `
          <li>
            <div>
              <b style="${u.estado === 'suspendido' ? 'color:#EF4444;text-decoration:line-through;' : ''}">${app.utils.sanitizeHTML(u.nombre_usuario)}</b> 
              <span style="color:#94A3B8; font-size:11px;">(${app.utils.sanitizeHTML(u.email)})</span>
            </div>
            <div style="display:flex; gap:5px; align-items:center;">
              <select onchange="changeUserRole(${u.id}, this.value)" class="auth-input" style="width:auto; padding:2px; font-size:11px;">
                <option value="user" ${u.rol === 'user' ? 'selected' : ''}>User</option>
                <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Admin</option>
              </select>
              <button onclick="changeUserStatus(${u.id}, '${u.estado === 'activo' ? 'suspendido' : 'activo'}')" 
                      style="background:${u.estado === 'activo' ? '#EF4444' : '#10B981'}; border:none; color:white; padding:4px 8px; border-radius:4px; font-size:10px; cursor:pointer;">
                ${u.estado === 'activo' ? 'Suspender' : 'Activar'}
              </button>
            </div>
          </li>
        `,
          )
          .join('');
      };
      renderUsers(users);
      searchInput.oninput = (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = window.allAdminUsers.filter(
          (u) => u.nombre_usuario.toLowerCase().includes(query) || u.email.toLowerCase().includes(query),
        );
        renderUsers(filtered);
      };
    } catch (e) {
      console.error(e);
    }
  }

  async changeUserRole(id, rol) {
    try {
      const res = await app.api.authFetch('/api/admin/usuarios/' + id + '/rol', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rol,
        }),
      });
      if (res.ok) alert('Rol actualizado correctamente');
      else alert('Error actualizando rol');
    } catch (e) {
      console.error(e);
    }
  }

  switchAdminTab(tabId) {
    document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach((c) => (c.style.display = 'none'));
    event.target.classList.add('active');
    document.getElementById('adminTab' + tabId.charAt(0).toUpperCase() + tabId.slice(1)).style.display =
      'block';
    if (tabId === 'dashboard') this.loadAdminDashboard();
    if (tabId === 'usuarios') this.loadAdminUsers();
    if (tabId === 'avisos') app.avisos.loadAdminAvisos();
    if (tabId === 'juegos') app.adminJuegos.loadAdminJuegos();
    if (tabId === 'config') this.loadAdminConfig();
    if (tabId === 'reportes') app.reportes.abrirReportes();
  }

  async loadAdminDashboard() {
    try {
      const res = await app.api.authFetch('/api/admin/dashboard');
      if (!res.ok) return;
      const stats = await res.json();
      document.getElementById('dashboardActivos').textContent = stats.activos;
      document.getElementById('dashboardTotal').textContent = stats.totalUsuarios;
      const top5 = document.getElementById('dashboardTop5');
      top5.innerHTML = stats.top5
        .map((u, i) => `<li>${i + 1}. <b>${app.utils.sanitizeHTML(u.jugador)}</b> - ${u.puntosTotales} pts</li>`)
        .join('');

      await app.cargador.ensureChartJsLoaded();
      const ctx = document.getElementById('gamesChart').getContext('2d');
      if (window.adminChart) window.adminChart.destroy();
      window.adminChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: stats.partidasPorJuego.map((p) => p.nombre),
          datasets: [
            {
              data: stats.partidasPorJuego.map((p) => p.cantidad),
              backgroundColor: ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: '#F1F5F9',
                font: {
                  size: 11,
                },
              },
            },
          },
        },
      });
    } catch (e) {
      console.error(e);
    }
  }

  async changeUserStatus(id, estado) {
    try {
      const res = await app.api.authFetch(`/api/admin/usuarios/${id}/estado`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          estado,
        }),
      });
      if (res.ok) this.loadAdminUsers();
    } catch (e) {
      console.error(e);
    }
  }
}

// ReportesAdmin — Reportes del panel admin: se ven en pantalla y se exportan a CSV o PDF. (app.reportes)
class ReportesAdmin extends Modulo {
  // Cada reporte: de dónde salen los datos (routes/reportes.js) y qué columnas
  // se muestran, en orden: [campo del JSON, título de la columna].
  static REPORTES = {
    usuarios: {
      titulo: 'Usuarios registrados',
      url: '/api/admin/reportes/usuarios',
      horizontal: true, // muchas columnas: el PDF va apaisado
      columnas: [
        ['id', 'ID'],
        ['nombre_usuario', 'Usuario'],
        ['email', 'Email'],
        ['rol', 'Rol'],
        ['estado', 'Estado'],
        ['fecha_registro', 'Registro'],
        ['juegos_jugados', 'Juegos jugados'],
        ['logros', 'Logros'],
        ['amigos', 'Amigos'],
      ],
    },
    ranking: {
      titulo: 'Ranking por juego (top 10)',
      url: '/api/admin/reportes/ranking',
      columnas: [
        ['juego', 'Juego'],
        ['posicion', 'Puesto'],
        ['jugador', 'Jugador'],
        ['puntos', 'Puntos'],
        ['fecha', 'Fecha'],
      ],
    },
    actividad: {
      titulo: 'Actividad por juego',
      url: '/api/admin/reportes/actividad',
      columnas: [
        ['juego', 'Juego'],
        ['jugadores', 'Jugadores'],
        ['promedio', 'Puntaje promedio'],
        ['maximo', 'Puntaje máximo'],
        ['duelos', 'Duelos'],
        ['duelos_finalizados', 'Duelos finalizados'],
      ],
    },
  };

  // Juegos con puntaje (ids de la tabla `juegos`), para filtrar el ranking.
  static JUEGOS = [
    [1, 'Sopa de Letras'],
    [2, 'Preguntados'],
    [3, 'Termina la Palabra'],
    [4, 'Ahorcado'],
    [5, 'Adivina la Cosa'],
    [6, 'Adivina la Palabra'],
    [7, 'Pixel Runner'],
    [8, 'Castle Escape'],
  ];

  static CAMPOS_FECHA = new Set(['fecha_registro', 'fecha']);

  // jsPDF + autotable (~400KB) se bajan recién al exportar el primer PDF.
  static JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
  static AUTOTABLE_URL = 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js';

  constructor() {
    super();
    this.reporteTipo = 'usuarios';
    this.reporteFilas = [];
    this.jsPdfCargando = null;
  }

  // Al abrir la pestaña Reportes del panel admin.
  abrirReportes() {
    const sel = document.getElementById('reporteJuego');
    if (sel && sel.options.length <= 1) {
      sel.innerHTML += ReportesAdmin.JUEGOS.map(([id, nombre]) => `<option value="${id}">${nombre}</option>`).join('');
    }
    this.cargarReporte();
  }

  cambiarTipoReporte(tipo) {
    if (!ReportesAdmin.REPORTES[tipo]) return;
    this.reporteTipo = tipo;
    // el filtro por juego solo aplica al ranking
    document.getElementById('reporteJuegoGrupo').style.visibility = tipo === 'ranking' ? 'visible' : 'hidden';
    this.cargarReporte();
  }

  juegoFiltrado() {
    const sel = document.getElementById('reporteJuego');
    return this.reporteTipo === 'ranking' && sel && sel.value ? sel.value : '';
  }

  async cargarReporte() {
    const def = ReportesAdmin.REPORTES[this.reporteTipo];
    const estado = document.getElementById('reporteEstado');
    const juego = this.juegoFiltrado();
    const url = def.url + (juego ? '?juego_id=' + encodeURIComponent(juego) : '');
    estado.textContent = 'Cargando…';
    this.reporteFilas = [];
    this.renderReporte();
    try {
      this.reporteFilas = await app.api.apiFetch(url);
      estado.textContent = this.reporteFilas.length + (this.reporteFilas.length === 1 ? ' registro' : ' registros');
    } catch (err) {
      estado.textContent = 'No se pudo cargar el reporte: ' + err.message;
    }
    this.renderReporte();
  }

  // Valor de una celda, igual en pantalla, CSV y PDF (fechas en formato argentino).
  static valorCelda(fila, campo) {
    const v = fila[campo];
    if (v === null || v === undefined) return '';
    if (ReportesAdmin.CAMPOS_FECHA.has(campo)) {
      const d = new Date(v);
      return isNaN(d) ? String(v) : d.toLocaleDateString('es-AR');
    }
    return String(v);
  }

  renderReporte() {
    const tabla = document.getElementById('reporteTabla');
    if (!tabla) return;
    const { columnas } = ReportesAdmin.REPORTES[this.reporteTipo];
    const esc = app.utils.sanitizeHTML;
    const cabecera = '<thead><tr>' + columnas.map(([, t]) => `<th>${esc(t)}</th>`).join('') + '</tr></thead>';
    const cuerpo = this.reporteFilas.length
      ? this.reporteFilas
          .map((f) => '<tr>' + columnas.map(([c]) => `<td>${esc(ReportesAdmin.valorCelda(f, c))}</td>`).join('') + '</tr>')
          .join('')
      : `<tr><td colspan="${columnas.length}" class="admin-reporte-vacio">Sin datos</td></tr>`;
    tabla.innerHTML = cabecera + '<tbody>' + cuerpo + '</tbody>';
  }

  // "unigames_ranking_juego7_2026-09-25.pdf"
  nombreArchivoReporte(extension) {
    const hoy = new Date();
    const fecha = [hoy.getFullYear(), String(hoy.getMonth() + 1).padStart(2, '0'), String(hoy.getDate()).padStart(2, '0')].join('-');
    const juego = this.juegoFiltrado();
    return `unigames_${this.reporteTipo}${juego ? '_juego' + juego : ''}_${fecha}.${extension}`;
  }

  hayDatosParaExportar() {
    if (this.reporteFilas.length) return true;
    app.utils.mostrarToast('No hay datos para exportar.', 'error');
    return false;
  }

  // ─── CSV (se abre con Excel) ───
  // Separador ";" y BOM UTF-8: así Excel en español lo abre en columnas y con
  // los acentos bien. Los valores que empiezan con = + - @ se anteponen con '
  // para que Excel no los ejecute como fórmula (inyección de CSV).
  static celdaCSV(valor) {
    let s = String(valor);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[;"\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  exportarReporteCSV() {
    if (!this.hayDatosParaExportar()) return;
    const { columnas } = ReportesAdmin.REPORTES[this.reporteTipo];
    const lineas = [columnas.map(([, t]) => ReportesAdmin.celdaCSV(t)).join(';')];
    for (const f of this.reporteFilas) {
      lineas.push(columnas.map(([c]) => ReportesAdmin.celdaCSV(ReportesAdmin.valorCelda(f, c))).join(';'));
    }
    const blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    this.descargarArchivoReporte(blob, this.nombreArchivoReporte('csv'));
  }

  descargarArchivoReporte(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ─── PDF ───
  cargarJsPdf() {
    if (!this.jsPdfCargando) {
      this.jsPdfCargando = app.cargador
        .loadClassicScript(ReportesAdmin.JSPDF_URL)
        .then(() => app.cargador.loadClassicScript(ReportesAdmin.AUTOTABLE_URL)); // el plugin necesita jsPDF antes
      this.jsPdfCargando.catch(() => (this.jsPdfCargando = null)); // si falla, se reintenta la próxima vez
    }
    return this.jsPdfCargando;
  }

  async exportarReportePDF() {
    if (!this.hayDatosParaExportar()) return;
    try {
      await this.cargarJsPdf();
    } catch {
      app.utils.mostrarToast('No se pudo cargar el generador de PDF. Revisá la conexión.', 'error');
      return;
    }
    const def = ReportesAdmin.REPORTES[this.reporteTipo];
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: def.horizontal ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
    const ancho = doc.internal.pageSize.getWidth();

    // Encabezado: título, filtro y quién y cuándo lo generó
    const juego = this.juegoFiltrado();
    const nombreJuego = juego ? (ReportesAdmin.JUEGOS.find(([id]) => String(id) === juego) || [])[1] : '';
    doc.setFontSize(16);
    doc.text('UniGames — ' + def.titulo + (nombreJuego ? ' · ' + nombreJuego : ''), 40, 45);
    doc.setFontSize(9);
    doc.setTextColor(100);
    const usuario = app.auth.currentUser ? app.auth.currentUser.username : '';
    doc.text(
      `Generado el ${new Date().toLocaleString('es-AR')}${usuario ? ' por ' + usuario : ''} · ${this.reporteFilas.length} ${this.reporteFilas.length === 1 ? 'registro' : 'registros'}`,
      40,
      62,
    );

    doc.autoTable({
      startY: 75,
      head: [def.columnas.map(([, t]) => t)],
      body: this.reporteFilas.map((f) => def.columnas.map(([c]) => ReportesAdmin.valorCelda(f, c))),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      margin: { left: 40, right: 40 },
      // pie con el número de página en cada hoja
      didDrawPage: () => {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Página ' + doc.internal.getNumberOfPages(), ancho - 40, doc.internal.pageSize.getHeight() - 20, {
          align: 'right',
        });
      },
    });
    doc.save(this.nombreArchivoReporte('pdf'));
  }
}

// AdminContenidoJuegos — Admin del contenido de los juegos (palabras, preguntas, objetos). (app.adminJuegos)
class AdminContenidoJuegos extends Modulo {
  iniciar() {
    window.__jgEditingId = null;
    window.__jgTematicas = [];
    window.__jgLastItems = [];
  }

  jgEndpoint(tipo) {
    return {
      ahorcado: 'ahorcado',
      sopa: 'ahorcado',
      wordle: 'wordle',
      termina: 'wordle',
      preguntas: 'preguntas',
      adivina: 'adivina',
    }[tipo];
  }

  // "Sopa de Letras" y "Termina la Palabra" no tienen tabla propia: reusan
  // las palabras de Ahorcado y de Adivina la Palabra respectivamente.
  jgFormFamily(tipo) {
    if (tipo === 'sopa') return 'ahorcado';
    if (tipo === 'termina') return 'wordle';
    return tipo;
  }

  jgActualizarNotaCompartida(tipo) {
    const nota = document.getElementById('jgNotaCompartida');
    if (!nota) return;
    if (tipo === 'sopa') {
      nota.textContent = 'ℹ️ Sopa de Letras usa el mismo banco de palabras que Ahorcado.';
      nota.style.display = 'block';
    } else if (tipo === 'termina') {
      nota.textContent = 'ℹ️ Termina la Palabra usa el mismo banco de palabras que Adivina la Palabra.';
      nota.style.display = 'block';
    } else {
      nota.style.display = 'none';
    }
  }

  async jgFetchTematicas(force) {
    if (window.__jgTematicas.length && !force) return window.__jgTematicas;
    try {
      const res = await app.api.authFetch('/api/admin/tematicas');
      window.__jgTematicas = res.ok ? await res.json() : [];
    } catch (e) {
      console.error(e);
      window.__jgTematicas = [];
    }
    return window.__jgTematicas;
  }

  // Solo el banco de Ahorcado (que también usa Sopa) admite palabras sin
  // temática ("Normal"). El backend lo filtra con ?tematica_id=normal.
  jgPoblarSelectFiltro(tipo) {
    const sel = document.getElementById('juegosTematicaFiltro');
    if (!sel) return;
    const valorActual = sel.value;
    const conNormal = this.jgFormFamily(tipo || 'ahorcado') === 'ahorcado';
    sel.innerHTML =
      '<option value="">Todas las temáticas</option>' +
      (conNormal ? '<option value="normal">Normal (sin temática)</option>' : '') +
      window.__jgTematicas.map((t) => `<option value="${t.id}">${app.utils.sanitizeHTML(t.nombre)}</option>`).join('');
    // si el filtro elegido no existe para este juego (ej. "Normal" en Wordle), vuelve a "Todas"
    sel.value = [...sel.options].some((o) => o.value === valorActual) ? valorActual : '';
  }

  jgOpcionesTematica(incluirNormal) {
    let html = incluirNormal
      ? '<option value="">Normal (sin temática)</option>'
      : '<option value="">-- Elegí una temática --</option>';
    html += window.__jgTematicas.map((t) => `<option value="${t.id}">${t.nombre}</option>`).join('');
    return html;
  }

  jgResetBotones() {
    document.getElementById('juegosSubmitBtn').querySelector('span').textContent = 'Agregar';
    document.getElementById('juegosCancelBtn').style.display = 'none';
  }

  renderJuegoForm(tipo) {
    const box = document.getElementById('juegosCamposComunes');
    if (!box) return;
    const familia = this.jgFormFamily(tipo);
    if (familia === 'ahorcado') {
      box.innerHTML = `
            <div class="auth-form-group">
                <label class="auth-form-label">Palabra</label>
                <input class="auth-input" id="jgPalabra" placeholder="ej: piraña">
            </div>
            <div class="auth-form-group">
                <label class="auth-form-label">Temática</label>
                <select class="auth-input" id="jgTematica">${this.jgOpcionesTematica(true)}</select>
            </div>`;
    } else if (familia === 'wordle') {
      box.innerHTML = `
            <div class="auth-form-group">
                <label class="auth-form-label">Palabra</label>
                <input class="auth-input" id="jgPalabra" placeholder="ej: mundo">
            </div>
            <div class="auth-form-group">
                <label class="auth-form-label">Temática</label>
                <select class="auth-input" id="jgTematica">${this.jgOpcionesTematica(false)}</select>
            </div>`;
    } else if (familia === 'preguntas') {
      box.innerHTML = `
            <div class="auth-form-group">
                <label class="auth-form-label">Temática</label>
                <select class="auth-input" id="jgTematica">${this.jgOpcionesTematica(false)}</select>
            </div>
            <div class="auth-form-group">
                <label class="auth-form-label">Pregunta</label>
                <input class="auth-input" id="jgPregunta" placeholder="¿Cuál es...?">
            </div>
            <div class="auth-form-group" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <input class="auth-input" id="jgOpcionA" placeholder="Opción A">
                <input class="auth-input" id="jgOpcionB" placeholder="Opción B">
                <input class="auth-input" id="jgOpcionC" placeholder="Opción C">
                <input class="auth-input" id="jgOpcionD" placeholder="Opción D">
            </div>
            <div class="auth-form-group">
                <label class="auth-form-label">Respuesta correcta</label>
                <select class="auth-input" id="jgRespuestaCorrecta">
                    <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                </select>
            </div>`;
    } else if (familia === 'adivina') {
      box.innerHTML = `
            <div class="auth-form-group">
                <label class="auth-form-label">Temática</label>
                <select class="auth-input" id="jgTematica">${this.jgOpcionesTematica(false)}</select>
            </div>
            <div class="auth-form-group">
                <label class="auth-form-label">Respuesta</label>
                <input class="auth-input" id="jgRespuesta" placeholder="ej: Mario">
            </div>
            <div class="auth-form-group">
                <label class="auth-form-label">Alias (separados por coma)</label>
                <input class="auth-input" id="jgAliases" placeholder="mario, super mario">
            </div>
            <div class="auth-form-group">
                <label class="auth-form-label">Imagen (URL)</label>
                <input class="auth-input" id="jgImagen" placeholder="https://...">
            </div>
            <div class="auth-form-group" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <input class="auth-input" id="jgPista1" placeholder="Pista 1">
                <input class="auth-input" id="jgPista2" placeholder="Pista 2">
                <input class="auth-input" id="jgPista3" placeholder="Pista 3">
                <input class="auth-input" id="jgPista4" placeholder="Pista 4">
            </div>`;
    }
  }

  async loadAdminJuegos() {
    await this.jgFetchTematicas();
    const tipoSelect = document.getElementById('juegosTipoSelect');
    this.switchJuegoTipo(tipoSelect ? tipoSelect.value : 'ahorcado');
  }

  async switchJuegoTipo(tipo) {
    window.__jgEditingId = null;
    this.jgResetBotones();
    await this.jgFetchTematicas();
    this.jgPoblarSelectFiltro(tipo);
    this.jgActualizarNotaCompartida(tipo);
    this.renderJuegoForm(tipo);
    this.loadJuegosContenidoList();
  }

  jgValidarYArmarPayload(tipo) {
    const val = (id) => (document.getElementById(id) || {}).value ?? '';
    const familia = this.jgFormFamily(tipo);
    if (familia === 'ahorcado') {
      const palabra = val('jgPalabra').trim();
      if (!palabra) {
        alert('La palabra es requerida');
        return null;
      }
      return {
        palabra,
        tematica_id: val('jgTematica') || null,
      };
    }
    if (familia === 'wordle') {
      const palabra = val('jgPalabra').trim();
      const tematica_id = val('jgTematica');
      if (!palabra) {
        alert('La palabra es requerida');
        return null;
      }
      if (!tematica_id) {
        alert('Elegí una temática');
        return null;
      }
      return {
        palabra,
        tematica_id,
      };
    }
    if (familia === 'preguntas') {
      const tematica_id = val('jgTematica');
      const pregunta = val('jgPregunta').trim();
      const opcion_a = val('jgOpcionA').trim();
      const opcion_b = val('jgOpcionB').trim();
      const opcion_c = val('jgOpcionC').trim();
      const opcion_d = val('jgOpcionD').trim();
      if (!tematica_id) {
        alert('Elegí una temática');
        return null;
      }
      if (!pregunta) {
        alert('La pregunta es requerida');
        return null;
      }
      if (!opcion_a || !opcion_b || !opcion_c || !opcion_d) {
        alert('Las 4 opciones son requeridas');
        return null;
      }
      return {
        tematica_id,
        pregunta,
        opcion_a,
        opcion_b,
        opcion_c,
        opcion_d,
        respuesta_correcta: val('jgRespuestaCorrecta'),
      };
    }
    if (familia === 'adivina') {
      const tematica_id = val('jgTematica');
      const respuesta = val('jgRespuesta').trim();
      if (!tematica_id) {
        alert('Elegí una temática');
        return null;
      }
      if (!respuesta) {
        alert('La respuesta es requerida');
        return null;
      }
      return {
        tematica_id,
        respuesta,
        aliases: val('jgAliases')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        imagen: val('jgImagen').trim(),
        pistas: [1, 2, 3, 4].map((n) => val('jgPista' + n).trim()),
      };
    }
    return null;
  }

  async guardarContenidoJuego() {
    const tipo = document.getElementById('juegosTipoSelect').value;
    const payload = this.jgValidarYArmarPayload(tipo);
    if (!payload) return;
    const endpoint =
      '/api/admin/' + this.jgEndpoint(tipo) + (window.__jgEditingId ? '/' + window.__jgEditingId : '');
    const method = window.__jgEditingId ? 'PUT' : 'POST';
    try {
      const res = await app.api.authFetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error al guardar');
        return;
      }
      this.cancelarEdicionJuego();
      this.loadJuegosContenidoList();
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    }
  }

  cancelarEdicionJuego() {
    window.__jgEditingId = null;
    this.jgResetBotones();
    this.renderJuegoForm(document.getElementById('juegosTipoSelect').value);
  }

  editarContenidoJuegoPorId(tipo, id) {
    const item = window.__jgLastItems.find((i) => i.id === id);
    if (!item) return;
    window.__jgEditingId = item.id;
    this.renderJuegoForm(tipo);
    const familia = this.jgFormFamily(tipo);
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value ?? '';
    };
    if (familia === 'ahorcado' || familia === 'wordle') {
      set('jgPalabra', item.palabra);
      set('jgTematica', item.tematica_id ?? '');
    } else if (familia === 'preguntas') {
      set('jgTematica', item.tematica_id ?? '');
      set('jgPregunta', item.pregunta);
      set('jgOpcionA', item.opcion_a);
      set('jgOpcionB', item.opcion_b);
      set('jgOpcionC', item.opcion_c);
      set('jgOpcionD', item.opcion_d);
      set('jgRespuestaCorrecta', item.respuesta_correcta);
    } else if (familia === 'adivina') {
      set('jgTematica', item.tematica_id ?? '');
      set('jgRespuesta', item.respuesta);
      set('jgAliases', (item.aliases || []).join(', '));
      set('jgImagen', item.imagen);
      (item.pistas || []).forEach((p, i) => set('jgPista' + (i + 1), p));
    }
    document.getElementById('juegosSubmitBtn').querySelector('span').textContent = 'Guardar cambios';
    document.getElementById('juegosCancelBtn').style.display = 'inline-block';
    document.querySelector('.admin-juegos-form').scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }

  async eliminarContenidoJuego(tipo, id) {
    if (!confirm('¿Eliminar este elemento de forma permanente?')) return;
    try {
      const res = await app.api.authFetch('/api/admin/' + this.jgEndpoint(tipo) + '/' + id, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (window.__jgEditingId === id) this.cancelarEdicionJuego();
        this.loadJuegosContenidoList();
      } else {
        alert('Error al eliminar');
      }
    } catch (e) {
      console.error(e);
    }
  }

  async loadJuegosContenidoList() {
    const tipo = document.getElementById('juegosTipoSelect').value;
    const tematicaFiltro = document.getElementById('juegosTematicaFiltro').value;
    const listBox = document.getElementById('juegosContenidoList');
    listBox.innerHTML =
      '<div style="text-align:center; color:#94A3B8; font-size:12px; padding:10px;">Cargando...</div>';
    let url = '/api/admin/' + this.jgEndpoint(tipo);
    if (tematicaFiltro) url += '?tematica_id=' + encodeURIComponent(tematicaFiltro);
    try {
      const res = await app.api.authFetch(url);
      if (!res.ok) {
        listBox.innerHTML = '<div style="color:#FCA5A5; font-size:12px;">Error cargando contenido</div>';
        return;
      }
      const items = await res.json();
      window.__jgLastItems = items;
      if (!items.length) {
        listBox.innerHTML =
          '<div style="text-align:center; color:#94A3B8; font-size:12px; padding:10px;">No hay elementos cargados.</div>';
        return;
      }
      const temaNombre = (id) => {
        if (id === null || id === undefined || id === '') return 'Normal';
        const t = window.__jgTematicas.find((t) => t.id == id);
        return t ? t.nombre : '#' + id;
      };
      listBox.innerHTML = items
        .map((item) => {
          const familia = this.jgFormFamily(tipo);
          let titulo = '';
          if (familia === 'ahorcado' || familia === 'wordle') titulo = item.palabra;
          if (familia === 'preguntas') titulo = item.pregunta;
          if (familia === 'adivina') titulo = item.respuesta;
          return `
                <div style="background:rgba(0,0,0,0.3); border-radius:6px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:6px;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:13px; color:#F1F5F9; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${app.utils.sanitizeHTML(titulo)}</div>
                        <div style="font-size:10px; color:#94A3B8;">Temática: ${app.utils.sanitizeHTML(temaNombre(item.tematica_id))}</div>
                    </div>
                    <div style="display:flex; gap:6px; flex-shrink:0;">
                        <button class="admin-btn-small" style="background:#2563eb;" onclick="editarContenidoJuegoPorId('${tipo}', ${item.id})">Editar</button>
                        <button class="admin-btn-small" style="background:#ef4444;" onclick="eliminarContenidoJuego('${tipo}', ${item.id})">Eliminar</button>
                    </div>
                </div>`;
        })
        .join('');
    } catch (e) {
      console.error(e);
      listBox.innerHTML = '<div style="color:#FCA5A5; font-size:12px;">Error de conexión</div>';
    }
  }
}

//   App — clase raíz: compone los módulos y arranca la aplicación
class App extends Modulo {
  arrancar() {
    this.auth = new AuthManager();
    this.nucleo = new Nucleo();
    this.audio = new AudioManager();
    this.catalogo = new CatalogoJuegos();
    this.amigos = new AmigosManager();
    this.duelos = new DuelosManager();
    this.logros = new LogrosManager();
    this.perfil = new PerfilManager();
    this.navegacion = new Navegacion();
    this.tema = new TemaUsuario();
    this.cargador = new CargadorModulos();
    this.runner = new RunnerUI();
    this.ahorcado = new Ahorcado();
    this.wordle = new AdivinaPalabra();
    this.puntuaciones = new Puntuaciones();
    this.preguntados = new Preguntados();
    this.sopa = new SopaDeLetras();
    this.termina = new TerminaPalabra();
    this.adivina = new AdivinaCosa();
    this.info = new InfoModal();
    this.avisos = new AvisosManager();
    this.utils = new Utils();
    this.api = new ApiClient();
    this.lanzador = new LanzadorJuegos();
    this.notificaciones = new Notificaciones();
    this.admin = new AdminPanel();
    this.adminJuegos = new AdminContenidoJuegos();
    this.reportes = new ReportesAdmin();
    this.exponerGlobales();
    this.nucleo.iniciar();
    this.audio.iniciar();
    this.cargador.iniciar();
    this.navegacion.iniciar();
    this.tema.iniciar();
    this.runner.iniciar();
    this.iniciar();
    this.auth.iniciar();
    this.adivina.iniciar();
    this.notificaciones.iniciar();
    this.info.iniciar();
    this.avisos.iniciar();
    this.adminJuegos.iniciar();
  }

  modulos() {
    return [
      this.auth,
      this.nucleo,
      this.audio,
      this.catalogo,
      this.amigos,
      this.duelos,
      this.logros,
      this.perfil,
      this.navegacion,
      this.tema,
      this.cargador,
      this.runner,
      this.ahorcado,
      this.wordle,
      this.puntuaciones,
      this.preguntados,
      this.sopa,
      this.termina,
      this.adivina,
      this.info,
      this.avisos,
      this.utils,
      this.api,
      this.lanzador,
      this.notificaciones,
      this.admin,
      this.adminJuegos,
      this.reportes,
      this,
    ];
  }

  exponerGlobales() {
    for (const modulo of this.modulos()) {
      for (const nombre of modulo.metodosPublicos()) {
        if (['arrancar', 'modulos', 'exponerGlobales'].includes(nombre)) continue;
        window[nombre] = modulo[nombre];
      }
      for (const nombre of Object.keys(modulo)) {
        if (typeof modulo[nombre] === 'function' || modulo === this) continue;
        Object.defineProperty(window, nombre, {
          get: () => modulo[nombre],
          set: (v) => {
            modulo[nombre] = v;
          },
          configurable: true,
        });
      }
    }
    for (const Clase of [
      AuthManager,
      Nucleo,
      AudioManager,
      CatalogoJuegos,
      AmigosManager,
      DuelosManager,
      LogrosManager,
      PerfilManager,
      Navegacion,
      CargadorModulos,
      RunnerUI,
      Ahorcado,
      AdivinaPalabra,
      Puntuaciones,
      Preguntados,
      SopaDeLetras,
      TerminaPalabra,
      AdivinaCosa,
      InfoModal,
      AvisosManager,
      Utils,
      ApiClient,
      LanzadorJuegos,
      Notificaciones,
      AdminPanel,
      AdminContenidoJuegos,
    ]) {
      for (const nombre of Object.keys(Clase)) window[nombre] = Clase[nombre];
    }
  }

  iniciar() {
    document.addEventListener('DOMContentLoaded', () => {
      app.nucleo.APP_EL.year.textContent = new Date().getFullYear();

      // Restaurar sesión desde localStorage
      try {
        const savedUser = localStorage.getItem('unigames_user');
        const savedToken = localStorage.getItem('unigames_token');
        if (savedUser && savedToken) {
          app.auth.currentUser = JSON.parse(savedUser);
          app.tema.aplicarTemaEfectivo();
          app.logros.sincronizarLogrosConBackend();
        }
      } catch (e) {
        localStorage.removeItem('unigames_user');
        localStorage.removeItem('unigames_token');
      }
      // Siempre: sin sesión, esto pinta el botón de "Iniciar sesión".
      app.auth.updateAuthUI();
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get('error_description');
      if (urlError) {
        setTimeout(() => {
          app.auth.showAuthAlert(
            'login-alert',
            'Error de Supabase: ' + decodeURIComponent(urlError.replace(/\+/g, ' ')),
            'error',
          );
          app.auth.openModal('login');
        }, 500);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      // Guardar HTML original de secciones de juego (antes de que se modifiquen)
      app.navegacion.saveOriginalSections();

      // Juegos destacados aleatorios + secciones del inicio
      app.catalogo.renderFeatured();
      app.catalogo.renderSimple();
      app.catalogo.renderAction();
      app.catalogo.renderClassicGames();
      app.catalogo.renderMotorGames();

      document.querySelectorAll('.nav-menu a').forEach((a) => {
        a.addEventListener('click', (e) => e.preventDefault());
      });

      // Inicializar audio al cargar la página
      app.audio.initAudio();

      // Animación letra por letra del título de bienvenida (una sola vez)
      app.navegacion.animateHeroLetters();

      // Cargar tabla de posiciones desde la API
      app.puntuaciones.fetchLeaderboard();
    });
  }
}

const app = new App();
window.app = app;
app.arrancar();
