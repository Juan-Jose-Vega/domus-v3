/*
  ============================================================
  notifications.js — Módulo de Notificaciones v2
  ============================================================
  NUEVO v2:
  - Click en notificación → redirige a la sección correspondiente
  - Marca como leída al hacer click
  - Funciona para admin, tenant y superadmin
  ============================================================
*/

/**
 * Inicializa el sistema de notificaciones.
 * Se llama desde admin.js, tenant.js y superadmin.js al cargar el panel.
 */
function initNotifications() {
  renderNotifBadge();
  setupNotifPanel();
}

/**
 * Actualiza el contador (badge) de notificaciones no leídas en la campana.
 */
function renderNotifBadge() {
  const count   = countNotifNoLeidas();
  const notifBtn = document.getElementById('notifBtn');
  if (!notifBtn) return;

  let dot = notifBtn.querySelector('.notif-dot');

  if (count > 0) {
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'notif-dot';
      notifBtn.appendChild(dot);
    }
    dot.setAttribute('data-count', count);
  } else {
    if (dot) dot.remove();
  }

  const countBadge = document.getElementById('notifCountBadge');
  if (countBadge) countBadge.textContent = count;
}

/**
 * Configura los eventos del panel de notificaciones (open/close).
 */
function setupNotifPanel() {
  const notifBtn   = document.getElementById('notifBtn');
  const notifPanel = document.getElementById('notifPanel');
  if (!notifBtn || !notifPanel) return;

  notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = notifPanel.classList.toggle('open');
    if (isOpen) renderNotifList();
  });

  const markAllBtn = document.getElementById('markAllRead');
  if (markAllBtn) {
    markAllBtn.addEventListener('click', () => {
      marcarTodasLeidas();
      renderNotifList();
      renderNotifBadge();
    });
  }

  document.addEventListener('click', (e) => {
    if (!notifPanel.contains(e.target) && e.target !== notifBtn) {
      notifPanel.classList.remove('open');
    }
  });
}

/**
 * Detecta si estamos en el panel de inquilino (tenant) o admin.
 * Retorna 'tenant' o 'admin'.
 */
function detectarPanelActual() {
  if (typeof navigateToTenant === 'function') return 'tenant';
  return 'admin';
}

/**
 * Determina la sección de destino según el contenido/tipo de una notificación.
 * Devuelve el sectionId para navigateTo(), adaptado al panel actual.
 *
 * Secciones válidas tenant: inicio, pagos, comprobantes, expensas, servicios,
 *                           contrato, reclamos, avisos
 * Secciones válidas admin:  dashboard, inquilinos, pagos, reclamos, avisos,
 *                           calendario, simulador, expensas, reclamos-superadmin
 */
function resolverSeccionNotif(notif) {
  const titulo = (notif.titulo || '').toLowerCase();
  const cuerpo = (notif.cuerpo  || '').toLowerCase();
  const texto  = titulo + ' ' + cuerpo;
  const panel  = detectarPanelActual();

  // Expensas — presente en ambos paneles
  if (texto.includes('expensa'))                                      return 'expensas';

  // Reclamos — presente en ambos paneles
  if (texto.includes('reclamo'))                                      return 'reclamos';

  // Avisos — presente en ambos paneles
  if (
    texto.includes('aviso')      ||
    texto.includes('corte')      ||
    texto.includes('fumigación') ||
    texto.includes('comunicado')
  )                                                                   return 'avisos';

  // Comprobantes — solo en tenant; en admin redirigir a inquilinos
  if (texto.includes('comprobante')) {
    return panel === 'tenant' ? 'comprobantes' : 'inquilinos';
  }

  // Servicios — solo en tenant; en admin redirigir a inquilinos
  if (texto.includes('servicio')) {
    return panel === 'tenant' ? 'servicios' : 'inquilinos';
  }

  // Contrato / vencimiento — tenant usa 'contrato', admin usa 'inquilinos'
  if (texto.includes('contrato') || texto.includes('vencimiento') || texto.includes('venci')) {
    return panel === 'tenant' ? 'contrato' : 'inquilinos';
  }

  // Pagos / alquiler — presente en ambos paneles
  if (texto.includes('pago') || texto.includes('alquiler'))          return 'pagos';

  // Inquilinos — solo admin
  if (texto.includes('inquilino') && panel === 'admin')              return 'inquilinos';

  return null;
}

/**
 * Renderiza la lista de notificaciones dentro del panel.
 * Cada item es clickeable y redirige a la sección correspondiente.
 */
function renderNotifList() {
  const listEl = document.getElementById('notifList');
  if (!listEl) return;

  const notifs = getNotificaciones();

  if (notifs.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding: 40px 20px;">
        <div class="empty-state-icon"><i data-lucide="bell-off" style="width:24px;height:24px;"></i></div>
        <p class="empty-state-title">Sin notificaciones</p>
      </div>
    `;
    initIcons();
    return;
  }

  const iconosTipo = {
    success: 'check-circle',
    warning: 'alert-triangle',
    danger:  'x-circle',
    info:    'info',
  };

  const colorTipo = {
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger:  'var(--color-danger)',
    info:    'var(--color-info)',
  };

  listEl.innerHTML = notifs.map(notif => {
    const seccion = resolverSeccionNotif(notif);
    const clickable = seccion ? `cursor:pointer;` : '';
    const hoverTitle = seccion ? `title="Ir a ${seccion}"` : '';
    return `
      <div class="notif-item ${notif.leida ? '' : 'unread'}"
           data-id="${notif.id}"
           data-seccion="${seccion || ''}"
           style="${clickable}transition:background 0.15s;"
           ${hoverTitle}>
        <div style="
          width: 8px; height: 8px; border-radius: 50%;
          background: ${notif.leida ? 'transparent' : colorTipo[notif.tipo] || 'var(--color-info)'};
          flex-shrink: 0; margin-top: 6px;
        "></div>
        <div style="flex:1;">
          <div class="notif-item-title">${notif.titulo}</div>
          <div class="notif-item-body">${notif.cuerpo}</div>
          <div class="notif-item-time" style="display:flex;align-items:center;gap:6px;">
            ${tiempoRelativo(notif.fecha)}
            ${seccion ? `<span style="font-size:0.7rem;color:var(--color-primary);opacity:0.8;">→ ${seccion}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Agregar listeners de click en cada notificación
  listEl.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', () => {
      const id      = item.getAttribute('data-id');
      const seccion = item.getAttribute('data-seccion');

      // Marcar como leída
      const notifs = getNotificaciones().map(n =>
        n.id === id ? { ...n, leida: true } : n
      );
      storageSet(STORAGE_KEYS.NOTIFICACIONES, notifs);
      renderNotifBadge();

      // Cerrar el panel
      document.getElementById('notifPanel')?.classList.remove('open');

      // Navegar a la sección correspondiente
      if (seccion && typeof navigateTo === 'function') {
        navigateTo(seccion);
      }

      renderNotifList();
    });
  });

  initIcons();
}
