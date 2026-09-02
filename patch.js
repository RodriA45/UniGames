const fs = require('fs');

// 1. Fix CSS
let css = fs.readFileSync('public/src/styles.css', 'utf8');
const newCss = `
/* Boton Google */
.auth-btn-google {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 12px;
  margin-top: 10px;
  background-color: #ffffff;
  color: #3c4043;
  border: 1px solid #dadce0;
  border-radius: 8px;
  font-family: 'Inter', sans-serif;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s, box-shadow 0.3s;
}

.auth-btn-google:hover {
  background-color: #f8f9fa;
  box-shadow: 0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15);
}

.auth-btn-google svg {
  margin-right: 10px;
}

.auth-divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 20px 0 10px 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.auth-divider span {
  padding: 0 10px;
}

.auth-forgot-link {
  display: block;
  text-align: right;
  margin-top: 5px;
  margin-bottom: 15px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  cursor: pointer;
  background: none;
  border: none;
  transition: color 0.2s;
}

.auth-forgot-link:hover {
  color: var(--primary);
  text-decoration: underline;
}
`;
if (!css.includes('.auth-btn-google')) {
  fs.writeFileSync('public/src/styles.css', css + '\n' + newCss, 'utf8');
}

// 2. Fix HTML
let html = fs.readFileSync('public/index.html', 'utf8');
const targetStr = `<button class="auth-btn-submit" type="submit"><span>Entrar al juego →</span></button>`;
const replacementStr = `<div style="text-align: right; width: 100%;">
          <button type="button" class="auth-forgot-link" onclick="handleForgotPassword(event)">¿Olvidaste tu contraseña?</button>
        </div>
        <button class="auth-btn-submit" type="submit"><span>Entrar al juego →</span></button>
        
        <div class="auth-divider">
          <span>O continuá con</span>
        </div>
        
        <button class="auth-btn-google" type="button" onclick="handleGoogleLogin()">
          <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </button>`;
if (!html.includes('.auth-btn-google')) {
  html = html.replace(targetStr, replacementStr);
  fs.writeFileSync('public/index.html', html, 'utf8');
}
