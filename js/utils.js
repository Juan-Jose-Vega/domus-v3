/*
  ============================================================
  utils.js — Funciones Utilitarias Compartidas (v3)
  ============================================================
  NUEVO en v2:
  - textoVencimiento(): texto inteligente para días restantes
  - badgeVencimiento(): badge con color según días restantes
  - badgeEstadoAdmin(): badge para estado de cuentas de admin
  - badgePlan(): badge visual para planes Básico/Pro/Premium
  - requireAuth() actualizado para soportar 'superadmin'
  NUEVO en v3:
  - textoVencimientoContrato(): muestra meses/años para contratos largos
  - textoVencimientoPago(): próximo pago mensual, máximo 31 días
  - badgeVencimientoPago(): badge para pago mensual
  - badgeVencimientoContrato(): badge para fin de contrato
  ============================================================
*/

// ============================================================
// FORMATEO DE MONEDA Y FECHAS
// ============================================================

/** Formatea número como pesos argentinos: 180000 → "$ 180.000" */
function formatearPesos(monto) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(monto);
}

/** Formatea fecha ISO a legible: "2025-05-28" → "28 may 2025" */
function formatearFecha(fechaISO) {
  if (!fechaISO) return '—';
  const fecha = new Date(fechaISO + 'T00:00:00');
  return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Calcula cuántos días faltan (o pasaron) para una fecha.
 * Positivo = faltan días; negativo = ya venció.
 * @param {string} fechaISO
 * @returns {number}
 */
function diasHasta(fechaISO) {
  if (!fechaISO) return 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fechaISO + 'T00:00:00');
  return Math.round((fecha - hoy) / (1000 * 60 * 60 * 24));
}

/**
 * Devuelve texto relativo para fechas pasadas.
 * "Hoy" / "Ayer" / "Hace 3 días" / "Hace 2 semanas"
 */
function tiempoRelativo(fechaISO) {
  const dias = -diasHasta(fechaISO);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 7)   return `Hace ${dias} días`;
  if (dias < 30)  return `Hace ${Math.floor(dias / 7)} semanas`;
  return formatearFecha(fechaISO);
}

/**
 * ┌─────────────────────────────────────────────────────────┐
 * │  v3: textoVencimiento — uso general (servicios, etc.)   │
 * │                                                         │
 * │  Corrige el bug "Vence en -81 días" del tenant.         │
 * │  Reglas:                                                │
 * │   - dias < 0  → "Vencido hace N días"  (rojo)           │
 * │   - dias = 0  → "Vence hoy"            (rojo)           │
 * │   - dias <= 7 → "Vence en N días"      (amarillo)       │
 * │   - dias > 7  → "Vence en N días"      (verde)          │
 * └─────────────────────────────────────────────────────────┘
 * @param {string} fechaISO
 * @returns {{ texto: string, urgencia: string }}
 *   urgencia: 'danger' | 'warning' | 'success'
 */
function textoVencimiento(fechaISO) {
  const dias = diasHasta(fechaISO);

  if (dias < 0) {
    return {
      texto:    `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`,
      urgencia: 'danger'
    };
  }
  if (dias === 0) {
    return { texto: 'Vence hoy', urgencia: 'danger' };
  }
  if (dias <= 7) {
    return { texto: `Vence en ${dias} día${dias !== 1 ? 's' : ''}`, urgencia: 'warning' };
  }
  if (dias <= 30) {
    return { texto: `Vence en ${dias} días`, urgencia: 'warning' };
  }
  return { texto: `Vence en ${dias} días`, urgencia: 'success' };
}

/**
 * ┌─────────────────────────────────────────────────────────┐
 * │  v3 NUEVO: textoVencimientoContrato                     │
 * │                                                         │
 * │  Para mostrar el fin de contrato (puede ser años).      │
 * │  Convierte días a meses o años para mejor legibilidad.  │
 * │   - dias < 0  → "Contrato vencido hace N días" (rojo)   │
 * │   - dias = 0  → "Contrato vence hoy"           (rojo)   │
 * │   - dias <= 30 → "Vence en N días"             (rojo/amarillo) │
 * │   - dias <= 365 → "Vence en N meses"           (amarillo/verde) │
 * │   - dias > 365  → "Vence en N años y M meses"  (verde)  │
 * └─────────────────────────────────────────────────────────┘
 * @param {string} fechaISO
 * @returns {{ texto: string, urgencia: string }}
 */
function textoVencimientoContrato(fechaISO) {
  const dias = diasHasta(fechaISO);

  if (dias < 0) {
    const d = Math.abs(dias);
    return {
      texto:    `Contrato vencido hace ${d} día${d !== 1 ? 's' : ''}`,
      urgencia: 'danger'
    };
  }
  if (dias === 0) {
    return { texto: 'Contrato vence hoy', urgencia: 'danger' };
  }
  if (dias <= 30) {
    return { texto: `Contrato vence en ${dias} día${dias !== 1 ? 's' : ''}`, urgencia: 'danger' };
  }
  if (dias <= 180) {
    const meses = Math.round(dias / 30);
    return { texto: `Contrato vence en ${meses} mes${meses !== 1 ? 'es' : ''}`, urgencia: 'warning' };
  }
  if (dias <= 365) {
    const meses = Math.round(dias / 30);
    return { texto: `Contrato vence en ${meses} meses`, urgencia: 'success' };
  }
  // Más de un año: mostrar en años y meses
  const anios = Math.floor(dias / 365);
  const mesesRest = Math.round((dias % 365) / 30);
  const parteAnios = `${anios} año${anios !== 1 ? 's' : ''}`;
  const parteMeses = mesesRest > 0 ? ` y ${mesesRest} mes${mesesRest !== 1 ? 'es' : ''}` : '';
  return { texto: `Contrato vence en ${parteAnios}${parteMeses}`, urgencia: 'success' };
}

/**
 * ┌─────────────────────────────────────────────────────────┐
 * │  v3 NUEVO: textoVencimientoPago                         │
 * │                                                         │
 * │  Para el próximo pago mensual de alquiler.              │
 * │  El ciclo mensual NUNCA supera 31 días.                 │
 * │  Si la fecha almacenada supera 31 días desde hoy,       │
 * │  se recalcula al próximo ciclo dentro del mes.          │
 * └─────────────────────────────────────────────────────────┘
 * @param {string} fechaISO
 * @returns {{ texto: string, urgencia: string }}
 */
function textoVencimientoPago(fechaISO) {
  let dias = diasHasta(fechaISO);

  // Si el próximo pago está a más de 31 días, recalcular:
  // tomamos el día del mes de la fecha original y buscamos
  // la próxima ocurrencia de ese día dentro del mes actual/siguiente.
  if (dias > 31) {
    const fechaOrig = new Date(fechaISO + 'T00:00:00');
    const diaDelMes = fechaOrig.getDate();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Intentar en el mes actual
    let candidato = new Date(hoy.getFullYear(), hoy.getMonth(), diaDelMes);
    if (candidato <= hoy) {
      // Ya pasó este mes → mes siguiente
      candidato = new Date(hoy.getFullYear(), hoy.getMonth() + 1, diaDelMes);
    }
    dias = Math.round((candidato - hoy) / (1000 * 60 * 60 * 24));
    // Asegurar límite de 31
    if (dias > 31) dias = 31;
  }

  if (dias < 0) {
    const d = Math.abs(dias);
    return {
      texto:    `Pago atrasado hace ${d} día${d !== 1 ? 's' : ''}`,
      urgencia: 'danger'
    };
  }
  if (dias === 0) {
    return { texto: 'Pago vence hoy', urgencia: 'danger' };
  }
  if (dias <= 5) {
    return { texto: `Vence en ${dias} día${dias !== 1 ? 's' : ''}`, urgencia: 'danger' };
  }
  if (dias <= 15) {
    return { texto: `Vence en ${dias} días`, urgencia: 'warning' };
  }
  return { texto: `Vence en ${dias} días`, urgencia: 'success' };
}

/**
 * NUEVO v2: Genera HTML de badge de vencimiento (uso general).
 * @param {string} fechaISO
 * @returns {string} HTML del badge
 */
function badgeVencimiento(fechaISO) {
  if (!fechaISO) return '<span class="badge badge--neutral">Sin fecha</span>';
  const { texto, urgencia } = textoVencimiento(fechaISO);
  return `<span class="badge badge--${urgencia}">${texto}</span>`;
}

/**
 * v3 NUEVO: Badge específico para próximo pago mensual.
 * @param {string} fechaISO
 * @returns {string} HTML del badge
 */
function badgeVencimientoPago(fechaISO) {
  if (!fechaISO) return '<span class="badge badge--neutral">Sin fecha</span>';
  const { texto, urgencia } = textoVencimientoPago(fechaISO);
  return `<span class="badge badge--${urgencia}">${texto}</span>`;
}

/**
 * v3 NUEVO: Badge específico para vencimiento de contrato.
 * @param {string} fechaISO
 * @returns {string} HTML del badge
 */
function badgeVencimientoContrato(fechaISO) {
  if (!fechaISO) return '<span class="badge badge--neutral">Sin fecha</span>';
  const { texto, urgencia } = textoVencimientoContrato(fechaISO);
  return `<span class="badge badge--${urgencia}">${texto}</span>`;
}

// ============================================================
// BADGES DE ESTADO
// ============================================================

/** Badge de estado de pago */
function badgePago(estado) {
  const mapa = {
    'pagado':     { clase: 'success', texto: '✓ Pagado' },
    'pendiente':  { clase: 'warning', texto: '⏳ Pendiente' },
    'atrasado':   { clase: 'danger',  texto: '! Atrasado' },
    'acreditado': { clase: 'success', texto: '✓ Acreditado' },
  };
  const info = mapa[estado] || { clase: 'neutral', texto: estado };
  return `<span class="badge badge--${info.clase}">${info.texto}</span>`;
}

/** Badge de estado de reclamo */
function badgeReclamo(estado) {
  const mapa = {
    'pendiente':   { clase: 'warning', texto: 'Pendiente' },
    'en_proceso':  { clase: 'info',    texto: 'En proceso' },
    'solucionado': { clase: 'success', texto: 'Solucionado' },
  };
  const info = mapa[estado] || { clase: 'neutral', texto: estado };
  return `<span class="badge badge--${info.clase}">${info.texto}</span>`;
}

/**
 * NUEVO v2: Badge de estado de cuenta admin
 * 'activo' | 'suspendido' | 'inactivo'
 */
function badgeEstadoAdmin(estado) {
  const mapa = {
    'activo':     { clase: 'success', texto: '● Activo' },
    'suspendido': { clase: 'danger',  texto: '◉ Suspendido' },
    'inactivo':   { clase: 'neutral', texto: '○ Inactivo' },
  };
  const info = mapa[estado] || { clase: 'neutral', texto: estado };
  return `<span class="badge badge--${info.clase}">${info.texto}</span>`;
}

/**
 * NUEVO v2: Badge visual de plan
 * 'basico' | 'pro' | 'premium'
 */
function badgePlan(plan) {
  const mapa = {
    'basico':   { clase: 'neutral', texto: '⬡ Básico',   limite: '5 inq.' },
    'pro':      { clase: 'info',    texto: '◈ Pro',       limite: '30 inq.' },
    'premium':  { clase: 'success', texto: '★ Premium',   limite: 'Ilimitado' },
  };
  const info = mapa[plan] || { clase: 'neutral', texto: plan, limite: '' };
  return `<span class="badge badge--${info.clase}" title="${info.limite}">${info.texto}</span>`;
}

/** Clase CSS de semáforo según estado de servicio */
function claseServicio(estado) {
  return { 'pagado': 'status-ok', 'pendiente': 'status-warn', 'atrasado': 'status-danger' }[estado] || 'status-warn';
}

// ============================================================
// INICIALES / AVATAR
// ============================================================

/** "Juan" + "Pérez" → "JP" */
function getIniciales(nombre, apellido) {
  return ((nombre || '').charAt(0) + (apellido || '').charAt(0)).toUpperCase();
}

// ============================================================
// VALIDACIONES
// ============================================================

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarPassword(password) {
  return password && password.length >= 6;
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

/**
 * Muestra una notificación temporal (toast) en esquina inferior derecha.
 * Se crea con createElement, se anima con CSS y se borra con setTimeout.
 *
 * @param {string} mensaje  - Texto a mostrar
 * @param {string} tipo     - 'success' | 'warning' | 'danger' | 'info'
 * @param {number} duracion - ms antes de desaparecer (default 4000)
 */
function showToast(mensaje, tipo = 'info', duracion = 4000) {
  // Crear contenedor si no existe
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const iconos = { success: 'check-circle', warning: 'alert-triangle', danger: 'x-circle', info: 'info' };

  // Crear elemento toast
  const toast = document.createElement('div');
  toast.className = `toast toast--${tipo}`;
  toast.innerHTML = `
    <i data-lucide="${iconos[tipo] || 'info'}" class="toast-icon" style="width:18px;height:18px;flex-shrink:0;"></i>
    <span>${mensaje}</span>
  `;

  container.appendChild(toast);
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [toast] });

  // Auto-eliminar después de duracion ms
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 350);
  }, duracion);
}

// ============================================================
// MODAL HELPERS
// ============================================================

function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('active'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('active'); document.body.style.overflow = ''; }
}

function closeOnOverlay(event, id) {
  if (event.target === event.currentTarget) closeModal(id);
}

// ============================================================
// CALCULADORA DE AUMENTO
// ============================================================

function calcularAumento(valorActual, porcentaje) {
  const aumento    = valorActual * (porcentaje / 100);
  const nuevoValor = valorActual + aumento;
  return { nuevoValor: Math.round(nuevoValor), aumento: Math.round(aumento) };
}

// ============================================================
// PROTECCIÓN DE RUTAS
// ============================================================

/**
 * Verifica que haya sesión activa con el rol correcto.
 * Si no → redirige al login o al panel correspondiente.
 * Actualizado v2 para soportar 'superadmin'.
 *
 * @param {string|string[]} rolRequerido - Rol o array de roles permitidos
 * @returns {object|null} La sesión si es válida
 */
function requireAuth(rolRequerido) {
  const sesion = getSession();

  if (!sesion) {
    window.location.href = 'index.html';
    return null;
  }

  // Normalizar a array para soportar múltiples roles permitidos
  const rolesPermitidos = Array.isArray(rolRequerido) ? rolRequerido : [rolRequerido];

  if (!rolesPermitidos.includes(sesion.rol)) {
    // Redirigir al panel correcto para el rol que tiene
    const destinos = { superadmin: 'superadmin.html', admin: 'admin.html', inquilino: 'tenant.html' };
    window.location.href = destinos[sesion.rol] || 'index.html';
    return null;
  }

  return sesion;
}

// ============================================================
// LUCIDE ICONS
// ============================================================

/** Re-inicializa los íconos de Lucide en toda la página o en un nodo */
function initIcons(nodo) {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons(nodo ? { nodes: [nodo] } : undefined);
  }
}

console.log('[Utils v3] Módulo listo.');
