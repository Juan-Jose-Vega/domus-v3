/*
  ============================================================
  login.js — Login unificado para 3 roles (v2)
  ============================================================
  CAMBIOS vs v1:
  - Eliminado selector de rol (Admin / Inquilino)
  - Eliminados botones de demo
  - El rol se detecta automáticamente desde el objeto usuario
  - Nuevo modal "¿Olvidaste tu contraseña?" con flujo por jerarquía
  - Validaciones mejoradas con mensajes específicos
  ============================================================
*/

// ============================================================
// REFERENCIAS AL DOM
// ============================================================

const inputEmail    = document.getElementById('loginEmail');
const inputPassword = document.getElementById('loginPassword');
const emailError    = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const loginErrorMsg  = document.getElementById('loginErrorMsg');
const loginErrorText = document.getElementById('loginErrorText');
const btnLogin      = document.getElementById('btnLogin');
const btnLoginText  = document.getElementById('btnLoginText');
const btnSpinner    = document.getElementById('btnSpinner');
const togglePassword = document.getElementById('togglePassword');
const eyeIcon        = document.getElementById('eyeIcon');

// ============================================================
// INICIALIZACIÓN
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Si ya hay sesión activa → redirigir directamente
  const sesionActiva = getSession();
  if (sesionActiva) {
    redirigirSegunRol(sesionActiva.rol);
    return;
  }

  initIcons();
  setupEventListeners();

  console.log('[Login v2] Módulo listo. Sin selector de rol.');
});

// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {

  // ---- Submit con botón ----
  btnLogin.addEventListener('click', handleLogin);

  // ---- Submit con Enter ----
  inputEmail.addEventListener('keydown',    e => { if (e.key === 'Enter') inputPassword.focus(); });
  inputPassword.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

  // ---- Limpiar errores al escribir ----
  inputEmail.addEventListener('input', () => {
    loginErrorMsg.style.display = 'none';
    limpiarErrorField(inputEmail, emailError);
  });
  inputPassword.addEventListener('input', () => {
    loginErrorMsg.style.display = 'none';
    limpiarErrorField(inputPassword, passwordError);
  });

  // ---- Mostrar/ocultar contraseña ----
  togglePassword?.addEventListener('click', () => {
    const visible = inputPassword.type === 'text';
    inputPassword.type = visible ? 'password' : 'text';
    eyeIcon?.setAttribute('data-lucide', visible ? 'eye' : 'eye-off');
    initIcons();
  });

  // ---- Link "¿Olvidaste tu contraseña?" ----
  document.getElementById('forgotPassLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('modalRecuperar');
  });

  // ---- Cerrar modal recuperar ----
  document.getElementById('btnCerrarRecuperar')?.addEventListener('click', () => {
    closeModal('modalRecuperar');
  });
}

// ============================================================
// LÓGICA DE LOGIN
// ============================================================

function handleLogin() {
  const emailODni = inputEmail.value.trim();
  const password  = inputPassword.value.trim();

  // Resetear errores previos
  loginErrorMsg.style.display = 'none';
  limpiarErrorField(inputEmail, emailError);
  limpiarErrorField(inputPassword, passwordError);

  // ---- Validaciones de campos ----
  let hayErrores = false;

  if (!emailODni) {
    mostrarErrorField(inputEmail, emailError, 'El correo o DNI es requerido');
    hayErrores = true;
  } else {
    // Aceptar si es email válido O si parece un DNI (solo dígitos, 6-8 chars)
    const esEmail = validarEmail(emailODni);
    const esDNI   = /^\d{6,8}$/.test(emailODni);
    if (!esEmail && !esDNI) {
      mostrarErrorField(inputEmail, emailError, 'Ingresá un correo válido o tu DNI');
      hayErrores = true;
    }
  }

  if (!password) {
    mostrarErrorField(inputPassword, passwordError, 'La contraseña es requerida');
    hayErrores = true;
  }

  if (hayErrores) return;

  // ---- Simular carga ----
  setLoadingState(true);

  // Pequeño delay simulado para UX
  setTimeout(() => {
    // autenticar() acepta email O DNI (storage.js)
    const resultado = autenticar(emailODni, password);

    if (!resultado) {
      // Credenciales incorrectas
      setLoadingState(false);
      loginErrorMsg.style.display = 'flex';
      loginErrorText.textContent = 'Correo/DNI o contraseña incorrectos';
      shakeCard();
      return;
    }

    // Cuenta suspendida (admin suspendido por superadmin)
    if (resultado.suspendido) {
      setLoadingState(false);
      loginErrorMsg.style.display = 'flex';
      loginErrorText.textContent = 'Tu cuenta está suspendida. Contactá al soporte.';
      shakeCard();
      return;
    }

    // ---- Login exitoso ----
    // Guardamos la sesión y redirigimos según el rol detectado automáticamente
    setSession(resultado);
    redirigirSegunRol(resultado.rol);

  }, 800);
}

/**
 * Redirige según el rol del usuario.
 * El rol viene del objeto usuario en LocalStorage, no de un selector manual.
 * @param {string} rol - 'superadmin' | 'admin' | 'inquilino'
 */
function redirigirSegunRol(rol) {
  switch (rol) {
    case 'superadmin': window.location.href = 'superadmin.html'; break;
    case 'admin':      window.location.href = 'admin.html';      break;
    case 'inquilino':  window.location.href = 'tenant.html';     break;
    default:
      // Rol desconocido → limpiar sesión y quedarse en login
      clearSession();
      console.warn('[Login] Rol desconocido:', rol);
  }
}

// ============================================================
// UI HELPERS
// ============================================================

function setLoadingState(loading) {
  btnLoginText.style.display = loading ? 'none'  : '';
  btnSpinner.style.display   = loading ? 'block' : 'none';
  btnLogin.disabled          = loading;
}

function mostrarErrorField(inputEl, errorEl, mensaje) {
  inputEl.style.borderColor = 'var(--color-danger)';
  errorEl.textContent = mensaje;
  errorEl.style.display = 'block';
}

function limpiarErrorField(inputEl, errorEl) {
  inputEl.style.borderColor = '';
  errorEl.textContent = '';
  errorEl.style.display = 'none';
}

function shakeCard() {
  const card = document.getElementById('loginCard');
  if (!card) return;
  card.style.animation = 'none';
  card.offsetHeight; // forzar reflow
  card.style.animation = 'shake 0.4s ease';
}

// Inyectar animación shake
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%,100%{ transform: translateX(0); }
    20%    { transform: translateX(-8px); }
    40%    { transform: translateX(8px); }
    60%    { transform: translateX(-5px); }
    80%    { transform: translateX(5px); }
  }
`;
document.head.appendChild(shakeStyle);

console.log('[Login v2] Script cargado.');
