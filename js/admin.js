/*
  ============================================================
  admin.js — Panel Administrador (v3 unificado)
  ============================================================
  CAMBIOS vs v1/v2:
  - requireAuth ahora verifica rol 'admin'
  - getInquilinosByAdmin(adminId) filtra por adminId
  - Columnas nuevas: próximo pago, deuda, expensas
  - Modal detalle con timeline, servicios argentinos, expensas
  - Botón "Restablecer contraseña" en tabla inquilinos
  - Los servicios usan nombres EDET / Gasnor / SAT
  - Corrección de lógica de vencimientos (textoVencimientoContrato / badgeVencimientoPago)
  - filtroInquilinos incluye estadoAdmin (activo / suspendido)
  - Acciones de gestión: suspender, ocultar, desactivar, reactivar
  - Dashboard excluye suspendidos del conteo de activos
  ============================================================
*/

// ── Estado global del panel ─────────────────────────────────
let sesionAdmin   = null;   // Objeto de sesión del admin logueado
let adminIdActual = null;   // adminId vinculado al usuario

let filtroInquilinos = { busqueda: '', estado: 'todos', estadoAdmin: 'todos' };

// ============================================================
// INICIALIZACIÓN
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  sesionAdmin = requireAuth('admin');
  if (!sesionAdmin) return;

  // adminId se guarda en el usuario de login
  adminIdActual = sesionAdmin.adminId;

  document.getElementById('adminName').textContent   = sesionAdmin.nombre;
  document.getElementById('adminAvatar').textContent = sesionAdmin.avatar || 'AD';

  initIcons();
  initSidebar();
  initNotifications();
  initTopbar();
  navigateTo('dashboard');

  console.log('[Admin v3] Panel listo. AdminId:', adminIdActual);
});

// ============================================================
// SIDEBAR
// ============================================================

function initSidebar() {
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    initIcons();
  });

  document.getElementById('hamburger')?.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
    sidebarOverlay?.classList.toggle('active');
  });

  sidebarOverlay?.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    sidebarOverlay.classList.remove('active');
  });

  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.getAttribute('data-section'));
      sidebar.classList.remove('mobile-open');
      sidebarOverlay?.classList.remove('active');
    });
  });
}

// ============================================================
// TOPBAR
// ============================================================

function initTopbar() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) {
      clearSession();
      window.location.href = 'index.html';
    }
  });
}

// ============================================================
// NAVEGACIÓN
// ============================================================

function navigateTo(sectionId) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('section-' + sectionId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-section') === sectionId);
  });

  const titles = {
    dashboard:          { title: 'Dashboard',         sub: 'Resumen general' },
    inquilinos:         { title: 'Inquilinos',        sub: 'Gestión de inquilinos y contratos' },
    pagos:              { title: 'Pagos',             sub: 'Historial de pagos' },
    reclamos:           { title: 'Reclamos',          sub: 'Gestión de reclamos' },
    avisos:             { title: 'Avisos',            sub: 'Comunicados del edificio' },
    calendario:         { title: 'Calendario',        sub: 'Vencimientos y fechas' },
    simulador:          { title: 'Simulador',         sub: 'Calculadora de aumentos' },
    desactivados:       { title: 'Usuarios Desactivados', sub: 'Historial de bajas lógicas' },
    'reclamos-superadmin': { title: 'Soporte / SuperAdmin', sub: 'Enviá consultas técnicas o reportes de errores' },
    expensas:              { title: 'Expensas',             sub: 'Gestión de expensas por inquilino' },
  };

  const info = titles[sectionId] || { title: sectionId, sub: '' };
  const titleEl = document.getElementById('topbarTitle');
  const subEl   = document.getElementById('topbarSubtitle');
  if (titleEl) titleEl.textContent = info.title;
  if (subEl)   subEl.textContent   = info.sub;

  switch (sectionId) {
    case 'dashboard':            renderDashboard();             break;
    case 'inquilinos':           renderInquilinos();            break;
    case 'pagos':                renderPagos();                 break;
    case 'reclamos':             renderReclamosAdmin();         break;
    case 'avisos':               renderAvisosAdmin();           break;
    case 'calendario':           initCalendar();                break;
    case 'simulador':            renderSimulador();             break;
    case 'desactivados':         renderDesactivadosAdmin();     break;
    case 'reclamos-superadmin':  renderReclamosSuperAdmin();    break;
    case 'expensas':             renderExpensasAdmin();         break;
  }
}

// ============================================================
// DASHBOARD
// ============================================================

function renderDashboard() {
  const inquilinos = getInquilinosByAdmin(adminIdActual);
  const pagos      = getPagosByAdmin(adminIdActual);
  const reclamos   = getReclamosByAdmin(adminIdActual);

  // Excluir suspendidos del conteo de activos
  const activos        = inquilinos.filter(i => i.estadoAdmin !== 'suspendido');
  const pagadosCount   = activos.filter(i => i.estadoPago === 'pagado').length;
  const atrasadosCount = inquilinos.filter(i => i.estadoPago === 'atrasado').length;
  const reclamosPend   = reclamos.filter(r => r.estado === 'pendiente').length;

  const mesActual   = new Date().toISOString().slice(0, 7);
  const ingresosMes = pagos
    .filter(p => p.estado === 'acreditado' && p.fecha?.startsWith(mesActual))
    .reduce((sum, p) => sum + p.monto, 0);

  const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setEl('statTotalInq',  activos.length);
  setEl('statPagados',   pagadosCount);
  setEl('statAtrasados', atrasadosCount);
  setEl('statIngresos',  formatearPesos(ingresosMes));
  setEl('statReclamos',  reclamosPend);

  renderQuickTenantList(inquilinos);
  renderChart(pagos);
  initIcons();
}

function renderQuickTenantList(inquilinos) {
  const container = document.getElementById('quickTenantList');
  if (!container) return;

  container.innerHTML = inquilinos.map(inq => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-subtle);">
      <div style="
        width:36px;height:36px;border-radius:50%;flex-shrink:0;
        background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));
        display:flex;align-items:center;justify-content:center;
        font-weight:700;font-size:0.8125rem;color:white;
      ">${getIniciales(inq.nombre, inq.apellido)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:500;font-size:0.875rem;">${inq.nombre} ${inq.apellido}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);">${inq.unidad}</div>
      </div>
      <div>${badgePago(inq.estadoPago)}</div>
    </div>
  `).join('');
}

function renderChart(pagos) {
  const chartEl = document.getElementById('chartBars');
  if (!chartEl) return;

  const hoy  = new Date();
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d     = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const key   = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('es-AR', { month: 'short' });
    const total = pagos.filter(p => p.fecha?.startsWith(key) && p.estado === 'acreditado').reduce((s, p) => s + p.monto, 0);
    meses.push({ label, total });
  }

  const maxTotal = Math.max(...meses.map(m => m.total), 1);
  chartEl.innerHTML = meses.map(m => {
    const pct = Math.round((m.total / maxTotal) * 100);
    return `
      <div class="chart-bar-group">
        <div class="chart-bar" style="height:${Math.max(pct,5)}%;">
          <span class="chart-bar-value">${m.total > 0 ? formatearPesos(m.total) : ''}</span>
        </div>
        <span class="chart-bar-label">${m.label}</span>
      </div>
    `;
  }).join('');
}

// ============================================================
// SECCIÓN INQUILINOS
// ============================================================

function renderInquilinos() {
  setupInquilinoFilters();
  renderInquilinoTable();
  setupInquilinoForm();
}

function setupInquilinoFilters() {
  document.getElementById('searchInquilino')?.addEventListener('input', e => {
    filtroInquilinos.busqueda = e.target.value.toLowerCase();
    renderInquilinoTable();
  });
  document.getElementById('filterEstado')?.addEventListener('change', e => {
    filtroInquilinos.estado = e.target.value;
    renderInquilinoTable();
  });
  document.getElementById('filterEstadoAdmin')?.addEventListener('change', e => {
    filtroInquilinos.estadoAdmin = e.target.value;
    renderInquilinoTable();
  });
  document.getElementById('btnNuevoInquilino')?.addEventListener('click', () => openInquilinoModal(null));
}

function renderInquilinoTable() {
  const tbody = document.getElementById('inquilinoTbody');
  if (!tbody) return;

  let inquilinos = getInquilinosByAdmin(adminIdActual);

  // Filtro de búsqueda
  if (filtroInquilinos.busqueda) {
    const q = filtroInquilinos.busqueda;
    inquilinos = inquilinos.filter(i =>
      `${i.nombre} ${i.apellido}`.toLowerCase().includes(q) ||
      i.email?.toLowerCase().includes(q) ||
      i.unidad?.toLowerCase().includes(q)
    );
  }

  // Filtro de estado de pago
  if (filtroInquilinos.estado !== 'todos') {
    inquilinos = inquilinos.filter(i => i.estadoPago === filtroInquilinos.estado);
  }

  // Filtro de estado administrativo (activo / suspendido)
  if (filtroInquilinos.estadoAdmin === 'activo') {
    inquilinos = inquilinos.filter(i => i.estadoAdmin !== 'suspendido');
  } else if (filtroInquilinos.estadoAdmin === 'suspendido') {
    inquilinos = inquilinos.filter(i => i.estadoAdmin === 'suspendido');
  }

  if (inquilinos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">No se encontraron inquilinos</td></tr>`;
    return;
  }

  tbody.innerHTML = inquilinos.map(inq => {
    const pct = Math.min(Math.round((inq.mesActual / inq.duracionContrato) * 100), 100);
    // textoVencimientoContrato() muestra meses/años (no días crudos)
    // badgeVencimientoPago() limita el ciclo mensual a máximo 31 días
    const vencPago    = badgeVencimientoPago(inq.proximoVencimientoPago);
    const vencContrato = textoVencimientoContrato(inq.fechaVencimiento);

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="
              width:34px;height:34px;border-radius:50%;flex-shrink:0;
              background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));
              display:flex;align-items:center;justify-content:center;
              font-weight:700;font-size:0.8125rem;color:white;
            ">${getIniciales(inq.nombre, inq.apellido)}</div>
            <div>
              <div style="font-weight:500;">${inq.nombre} ${inq.apellido}${inq.estadoAdmin === 'suspendido' ? ' <span class="badge badge--warning" style="font-size:0.65rem;padding:2px 6px;vertical-align:middle;">Suspendido</span>' : ''}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">${inq.email}</div>
            </div>
          </div>
        </td>
        <td><strong>${inq.unidad}</strong></td>
        <td>${badgePago(inq.estadoPago)}</td>
        <td>${vencPago}</td>
        <td>
          <div style="font-size:0.875rem;font-weight:600;">${formatearPesos(inq.valorAlquiler)}</div>
          ${inq.expensas ? `<div style="font-size:0.75rem;color:var(--text-muted);">Exp: ${formatearPesos(inq.expensas.monto)}</div>` : ''}
        </td>
        <td>
          <div style="min-width:100px;">
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">${inq.mesActual}/${inq.duracionContrato} meses</div>
            <div style="height:5px;background:var(--bg-elevated);border-radius:99px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--color-primary),var(--color-secondary));border-radius:99px;"></div>
            </div>
          </div>
        </td>
        <td>${typeof renderBadgeContratoTabla === 'function' ? renderBadgeContratoTabla(inq.id) : '—'}</td>
        <td>
          <div style="display:flex;gap:5px;">
            ${['luz','agua','gas'].map(s => {
              const srv = inq.servicios?.[s];
              const colores = {'status-ok':'#10b981','status-warn':'#f59e0b','status-danger':'#ef4444'};
              const cls = claseServicio(srv?.estado || 'pendiente');
              return `<div title="${srv?.nombre || s}: ${srv?.estado || '?'}" style="width:9px;height:9px;border-radius:50%;background:${colores[cls]};"></div>`;
            }).join('')}
          </div>
        </td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <button class="btn btn--sm btn--secondary" onclick="openInquilinoModal('${inq.id}')" title="Editar">
              <i data-lucide="edit-2" style="width:13px;height:13px;"></i>
            </button>
            <button class="btn btn--sm btn--secondary" onclick="openInquilinoDetail('${inq.id}')" title="Ver detalle">
              <i data-lucide="eye" style="width:13px;height:13px;"></i>
            </button>
            <button class="btn btn--sm btn--secondary" onclick="openResetPassInquilino('${inq.id}')" title="Restablecer contraseña">
              <i data-lucide="key-round" style="width:13px;height:13px;"></i>
            </button>
            ${inq.estadoAdmin === 'suspendido'
              ? `<button class="btn btn--sm btn--secondary" onclick="reactivarInq('${inq.id}','${inq.nombre} ${inq.apellido}')" title="Reactivar" style="color:var(--color-success);"><i data-lucide="play-circle" style="width:13px;height:13px;"></i></button>`
              : `<button class="btn btn--sm btn--secondary" onclick="suspenderInq('${inq.id}','${inq.nombre} ${inq.apellido}')" title="Suspender" style="color:var(--color-warning);"><i data-lucide="pause-circle" style="width:13px;height:13px;"></i></button>`
            }
            <button class="btn btn--sm btn--secondary" onclick="ocultarInq('${inq.id}','${inq.nombre} ${inq.apellido}')" title="Ocultar" style="color:var(--color-info);"><i data-lucide="eye-off" style="width:13px;height:13px;"></i></button>
            <button class="btn btn--sm btn--danger" onclick="desactivarInq('${inq.id}','${inq.nombre} ${inq.apellido}')" title="Desactivar" style="color:var(--color-danger);"><i data-lucide="user-x" style="width:13px;height:13px;"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  initIcons();
}

// ---- Detalle de inquilino (modal completo con timeline) ----
function openInquilinoDetail(id) {
  const inq = getInquilinoById(id);
  if (!inq) return;

  const pct = Math.min(Math.round((inq.mesActual / inq.duracionContrato) * 100), 100);
  const { texto: textoContrato, urgencia: urgContrato } = textoVencimientoContrato(inq.fechaVencimiento);

  const pagosInq    = getPagosByInquilino(id).slice(0, 3);
  const reclamosInq = getReclamosByInquilino(id).slice(0, 3);

  const container = document.getElementById('inquilinoDetailContent');
  if (!container) return;

  container.innerHTML = `
    <!-- Header -->
    <div class="tenant-detail-header">
      <div class="tenant-detail-avatar">${getIniciales(inq.nombre, inq.apellido)}</div>
      <div>
        <div class="tenant-detail-name">${inq.nombre} ${inq.apellido}</div>
        <div class="tenant-detail-unit">${inq.unidad} · ${badgePago(inq.estadoPago)}</div>
      </div>
    </div>

    <!-- Datos básicos -->
    <div class="detail-grid">
      <div class="detail-field"><div class="detail-field-label">Email</div><div class="detail-field-value">${inq.email}</div></div>
      <div class="detail-field"><div class="detail-field-label">Teléfono</div><div class="detail-field-value">${inq.telefono || '—'}</div></div>
      <div class="detail-field"><div class="detail-field-label">Alquiler</div><div class="detail-field-value">${formatearPesos(inq.valorAlquiler)}</div></div>
      <div class="detail-field"><div class="detail-field-label">Método</div><div class="detail-field-value">${inq.metodoPago}</div></div>
    </div>

    <!-- Timeline del contrato -->
    <div style="margin-bottom:var(--space-5);">
      <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:var(--space-3);">Timeline del contrato</div>
      <div style="position:relative;padding-left:24px;">
        ${buildTimeline(inq)}
      </div>
    </div>

    <!-- Progreso contrato -->
    <div style="margin-bottom:var(--space-5);">
      <div style="display:flex;justify-content:space-between;font-size:0.8125rem;color:var(--text-secondary);margin-bottom:6px;">
        <span>${inq.mesActual} de ${inq.duracionContrato} meses</span>
        <span class="badge badge--${urgContrato}">${textoContrato}</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width:${pct}%"></div>
      </div>
    </div>

    <!-- Expensas -->
    ${inq.expensas ? `
    <div style="margin-bottom:var(--space-5);">
      <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:var(--space-2);">Expensas</div>
      <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-elevated);border-radius:var(--radius-md);padding:12px 16px;">
        <div>
          <div style="font-weight:600;">${formatearPesos(inq.expensas.monto)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">${badgeVencimiento(inq.expensas.vencimiento)}</div>
        </div>
        ${badgePago(inq.expensas.estado)}
      </div>
    </div>
    ` : ''}

    <!-- Servicios argentinos -->
    <div style="margin-bottom:var(--space-5);">
      <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:var(--space-3);">Servicios</div>
      <div class="service-indicators">
        ${['luz','agua','gas'].map(s => {
          const srv = inq.servicios?.[s] || {};
          const cls = claseServicio(srv.estado || 'pendiente');
          const emojis = { luz: '💡', agua: '💧', gas: '🔥' };
          return `
            <div class="service-item ${cls}">
              <div class="service-name">${emojis[s]} ${srv.nombre || s}</div>
              <div class="service-status">${srv.estado || 'N/D'}</div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:3px;">${srv.vencimiento ? badgeVencimiento(srv.vencimiento) : ''}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Últimos pagos -->
    ${pagosInq.length > 0 ? `
    <div style="margin-bottom:var(--space-5);">
      <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:var(--space-3);">Últimos pagos</div>
      ${pagosInq.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-subtle);font-size:0.875rem;">
          <span>${p.concepto}</span>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-family:var(--font-mono);color:var(--color-success);">${formatearPesos(p.monto)}</span>
            ${badgePago(p.estado)}
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- Reclamos recientes -->
    ${reclamosInq.length > 0 ? `
    <div>
      <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:var(--space-3);">Reclamos recientes</div>
      ${reclamosInq.map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-subtle);font-size:0.875rem;">
          <span>${r.titulo}</span>
          ${badgeReclamo(r.estado)}
        </div>
      `).join('')}
    </div>
    ` : ''}
  `;

  openModal('modalInquilinoDetail');
  initIcons();

  // ── Widget de contratos en el detalle del inquilino ──
  if (typeof renderContratoWidget === 'function') {
    const zonaId = 'zonaContratoDetalle_' + id;
    const zonaEl = document.createElement('div');
    zonaEl.id = zonaId;
    zonaEl.style.marginTop = 'var(--space-5)';
    zonaEl.style.paddingTop = 'var(--space-5)';
    zonaEl.style.borderTop = '1px solid var(--border-subtle)';
    container.appendChild(zonaEl);
    renderContratoWidget(zonaId, {
      containerId:     zonaId,
      entidadId:       id,
      tipo:            'inquilino',
      usuarioActual:   sesionAdmin.nombre,
      usuarioActualId: adminIdActual,
      puedeModificar:  true,
      emailEntidad:    inq.email || '(email no registrado)',
    });
  }
}

/**
 * Construye el HTML del timeline visual del contrato.
 * Muestra: inicio → mes actual → próximo aumento → fin
 */
function buildTimeline(inq) {
  const eventos = [
    { label: 'Inicio contrato', fecha: inq.fechaInicio,      icono: '▶', color: 'var(--color-success)' },
    { label: 'Mes actual',      fecha: null,                  icono: '◉', color: 'var(--color-primary)', extra: `Mes ${inq.mesActual}` },
    { label: 'Próximo aumento', fecha: null,                  icono: '↑', color: 'var(--color-warning)', extra: 'Estimado en 3 meses' },
    { label: 'Fin contrato',    fecha: inq.fechaVencimiento,  icono: '■', color: 'var(--color-danger)' },
  ];

  return `
    <div style="border-left:2px solid var(--border-default);padding-left:var(--space-4);display:flex;flex-direction:column;gap:var(--space-4);">
      ${eventos.map(ev => `
        <div style="position:relative;display:flex;gap:var(--space-3);align-items:flex-start;">
          <div style="
            position:absolute;left:-20px;width:14px;height:14px;border-radius:50%;
            background:${ev.color};border:2px solid var(--bg-surface);
            display:flex;align-items:center;justify-content:center;
            font-size:0.5rem;color:white;flex-shrink:0;top:2px;
          "></div>
          <div>
            <div style="font-size:0.875rem;font-weight:500;">${ev.label}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">
              ${ev.fecha ? formatearFecha(ev.fecha) : (ev.extra || '')}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ---- Modal crear/editar inquilino ----
function openInquilinoModal(id) {
  const inq = id ? getInquilinoById(id) : null;
  document.getElementById('modalInquilinoTitle').textContent = inq ? 'Editar Inquilino' : 'Nuevo Inquilino';

  document.getElementById('inqNombre').value    = inq?.nombre    || '';
  document.getElementById('inqApellido').value  = inq?.apellido  || '';
  document.getElementById('inqEmail').value     = inq?.email     || '';
  document.getElementById('inqDni').value       = inq?.dni       || '';
  document.getElementById('inqTelefono').value  = inq?.telefono  || '';
  document.getElementById('inqUnidad').value    = inq?.unidad    || '';
  document.getElementById('inqAlquiler').value  = inq?.valorAlquiler || '';
  document.getElementById('inqMetodo').value    = inq?.metodoPago || 'Transferencia';
  document.getElementById('inqEstado').value    = inq?.estadoPago || 'pendiente';
  document.getElementById('inqDuracion').value  = inq?.duracionContrato || 24;
  document.getElementById('inqFechaInicio').value = inq?.fechaInicioContrato || new Date().toISOString().split('T')[0];

  // Campos contraseña solo en creación
  const passGroup = document.getElementById('inqPassGroup');
  if (passGroup) passGroup.style.display = id ? 'none' : 'block';

  document.getElementById('btnGuardarInquilino').setAttribute('data-id', id || '');
  openModal('modalInquilino');
}

function setupInquilinoForm() {
  document.getElementById('btnGuardarInquilino')?.addEventListener('click', () => {
    const id = document.getElementById('btnGuardarInquilino').getAttribute('data-id');
    guardarInquilino(id || null);
  });
  document.getElementById('btnCancelarInquilino')?.addEventListener('click', () => closeModal('modalInquilino'));
}

function guardarInquilino(id) {
  const nombre         = document.getElementById('inqNombre').value.trim();
  const apellido       = document.getElementById('inqApellido').value.trim();
  const email          = document.getElementById('inqEmail').value.trim();
  const dni            = document.getElementById('inqDni')?.value.trim() || '';
  const unidad         = document.getElementById('inqUnidad').value.trim();
  const alquiler       = parseFloat(document.getElementById('inqAlquiler').value) || 0;
  const fechaInicio    = document.getElementById('inqFechaInicio').value;
  const duracion       = parseInt(document.getElementById('inqDuracion').value) || 24;
  const password       = document.getElementById('inqPassword')?.value.trim() || '';
  const passwordConf   = document.getElementById('inqPasswordConf')?.value.trim() || '';

  if (!nombre || !apellido || !email || !unidad) {
    showToast('Completá todos los campos requeridos', 'warning');
    return;
  }
  if (!validarEmail(email)) {
    showToast('El email no es válido', 'danger');
    return;
  }
  if (dni && !/^\d{6,8}$/.test(dni)) {
    showToast('El DNI debe tener entre 6 y 8 dígitos', 'warning');
    return;
  }
  if (!id) {
    // Creación: contraseña obligatoria
    if (!password || password.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres', 'warning');
      return;
    }
    if (password !== passwordConf) {
      showToast('Las contraseñas no coinciden', 'danger');
      return;
    }
  }

  const data = {
    nombre, apellido, email, dni, unidad,
    telefono:            document.getElementById('inqTelefono').value.trim(),
    valorAlquiler:       alquiler,
    metodoPago:          document.getElementById('inqMetodo').value,
    estadoPago:          document.getElementById('inqEstado').value,
    duracionContrato:    duracion,
    fechaInicioContrato: fechaInicio,
    adminId:             adminIdActual,
    adminNombre:         sesionAdmin.nombre,
    password:            password || undefined,
    expensas:   { monto: 0, estado: 'pendiente', vencimiento: '' },
    servicios: {
      luz:  { nombre: 'EDET',   estado: 'pendiente', vencimiento: '' },
      agua: { nombre: 'SAT',    estado: 'pendiente', vencimiento: '' },
      gas:  { nombre: 'Gasnor', estado: 'pendiente', vencimiento: '' },
    }
  };

  if (id) {
    updateInquilino(id, data);
    showToast('Inquilino actualizado correctamente', 'success');
    closeModal('modalInquilino');
    renderInquilinoTable();
  } else {
    const resultado = createInquilino(data);
    if (resultado && resultado.error) {
      showToast(resultado.error, 'danger');
      return;
    }
    closeModal('modalInquilino');
    renderInquilinoTable();
    // Mostrar credenciales generadas al admin
    mostrarCredencialesInquilino({
      nombre:   `${nombre} ${apellido}`,
      email,
      dni:      dni || '(no cargado)',
      password: password,
      unidad
    });
  }
}

/** Modal informativo con las credenciales del inquilino recién creado */
function mostrarCredencialesInquilino({ nombre, email, dni, password, unidad }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'display:flex;z-index:9999;';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <div class="modal__header">
        <h3 class="modal__title">✅ Inquilino creado</h3>
      </div>
      <p style="color:var(--text-secondary);margin-bottom:var(--space-4);">
        Guardá estas credenciales. El inquilino puede ingresar con su email o DNI.
      </p>
      <div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:var(--space-4);display:flex;flex-direction:column;gap:var(--space-3);font-size:0.875rem;">
        <div><span style="color:var(--text-muted);">👤 Nombre:</span> <strong>${nombre}</strong></div>
        <div><span style="color:var(--text-muted);">🏠 Unidad:</span> <strong>${unidad}</strong></div>
        <div><span style="color:var(--text-muted);">📧 Email:</span> <strong>${email}</strong></div>
        <div><span style="color:var(--text-muted);">🪪 DNI:</span> <strong>${dni}</strong></div>
        <div><span style="color:var(--text-muted);">🔑 Contraseña:</span>
          <strong style="font-family:var(--font-mono);background:var(--bg-surface);padding:2px 8px;border-radius:4px;">${password}</strong>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--primary" onclick="this.closest('.modal-overlay').remove()">Entendido</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

// ---- Acciones de gestión de estado ----

function suspenderInq(id, nombre) {
  if (confirm(`¿Suspender a ${nombre}? Seguirá visible pero marcado como suspendido.`)) {
    suspenderInquilino(id);
    renderInquilinoTable();
    showToast(`${nombre} suspendido`, 'warning');
  }
}

function ocultarInq(id, nombre) {
  if (confirm(`¿Ocultar a ${nombre}? No aparecerá en los listados activos.`)) {
    ocultarInquilino(id);
    renderInquilinoTable();
    showToast(`${nombre} ocultado`, 'info');
  }
}

function desactivarInq(id, nombre) {
  const motivo = prompt(`Motivo de desactivación para ${nombre} (opcional):`);
  if (motivo === null) return; // canceló
  desactivarInquilino(id);
  // Buscar el usuario de login del inquilino para moverlo al panel
  const inq = getInquilinoById(id);
  if (inq) {
    const usuarios = storageGet(STORAGE_KEYS.USUARIOS, []);
    const usuario  = usuarios.find(u => u.email === inq.email && u.rol === 'inquilino');
    if (usuario) {
      // Marcar como inactivo en usuarios
      storageSet(STORAGE_KEYS.USUARIOS, usuarios.map(u =>
        u.id === usuario.id ? { ...u, activo: false } : u
      ));
      moverADesactivados({
        id:     usuario.id,
        nombre: `${inq.nombre} ${inq.apellido}`,
        rol:    'inquilino',
        email:  inq.email,
        unidad: inq.unidad,
        motivo: motivo || ''
      });
    }
  }
  renderInquilinoTable();
  showToast(`${nombre} desactivado`, 'danger');
}

function reactivarInq(id, nombre) {
  reactivarInquilino(id);
  renderInquilinoTable();
  showToast(`${nombre} reactivado`, 'success');
}

/* Alias de compatibilidad: delega a desactivarInq (baja lógica, sin borrar datos) */
function confirmarEliminar(id, nombre) {
  desactivarInq(id, nombre);
}

// ---- Restablecer contraseña de inquilino (admin) ----
function openResetPassInquilino(inquilinoId) {
  const inq = getInquilinoById(inquilinoId);
  document.getElementById('resetPassNombre').textContent = `${inq?.nombre} ${inq?.apellido}`;
  document.getElementById('resetPassInput').value = '';
  openModal('modalResetPass');

  document.getElementById('btnGuardarReset').onclick = () => {
    const newPass = document.getElementById('resetPassInput').value.trim();
    if (!newPass || newPass.length < 6) {
      showToast('Mínimo 6 caracteres', 'warning');
      return;
    }
    if (resetPasswordInquilino(inquilinoId, newPass)) {
      showToast('✔ Contraseña restablecida', 'success');
      closeModal('modalResetPass');
    }
  };
  document.getElementById('btnCancelarReset').onclick = () => closeModal('modalResetPass');
}

// ============================================================
// PAGOS
// ============================================================

function renderPagos() {
  renderPagosTable();
  document.getElementById('searchPago')?.addEventListener('input', e => renderPagosTable(e.target.value));
}

function renderPagosTable(filtro = '') {
  const tbody = document.getElementById('pagosTbody');
  if (!tbody) return;

  let pagos = getPagosByAdmin(adminIdActual);
  if (filtro) pagos = pagos.filter(p => p.inquilinoNombre?.toLowerCase().includes(filtro.toLowerCase()));

  if (pagos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">No hay pagos</td></tr>`;
    return;
  }

  tbody.innerHTML = pagos.map(p => `
    <tr>
      <td style="font-weight:500;">${p.inquilinoNombre}</td>
      <td>${p.concepto}</td>
      <td>${formatearFecha(p.fecha)}</td>
      <td style="font-family:var(--font-mono);color:var(--color-success);">${formatearPesos(p.monto)}</td>
      <td>${p.metodoPago}</td>
      <td>${badgePago(p.estado)}</td>
    </tr>
  `).join('');

  initIcons();
}

// ============================================================
// RECLAMOS
// ============================================================

function renderReclamosAdmin() {
  const container = document.getElementById('reclamosAdminList');
  if (!container) return;

  const reclamos = getReclamosByAdmin(adminIdActual);

  if (reclamos.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i data-lucide="inbox" style="width:24px;height:24px;"></i></div><p class="empty-state-title">Sin reclamos</p></div>`;
    initIcons();
    return;
  }

  container.innerHTML = reclamos.map(r => `
    <div class="reclamo-card">
      <div class="reclamo-header">
        <div>
          <div class="reclamo-title">${r.titulo}</div>
          <div class="reclamo-category">${r.unidad} · ${r.categoria} · ${r.inquilinoNombre}</div>
        </div>
        ${badgeReclamo(r.estado)}
      </div>
      <p class="reclamo-description">${r.descripcion}</p>
      ${r.respuesta ? `
        <div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:10px 14px;margin-bottom:12px;font-size:0.875rem;">
          <span style="font-weight:600;color:var(--color-info);">Respuesta: </span>${r.respuesta}
        </div>
      ` : ''}
      <div class="reclamo-footer">
        <span>${tiempoRelativo(r.fecha)}</span>
        <select class="filter-select" style="padding:5px 10px;font-size:0.8125rem;" onchange="cambiarEstadoReclamo('${r.id}', this.value)">
          <option value="pendiente"   ${r.estado==='pendiente'   ? 'selected':''}>Pendiente</option>
          <option value="en_proceso"  ${r.estado==='en_proceso'  ? 'selected':''}>En proceso</option>
          <option value="solucionado" ${r.estado==='solucionado' ? 'selected':''}>Solucionado</option>
        </select>
      </div>
    </div>
  `).join('');
  initIcons();
}

function cambiarEstadoReclamo(id, nuevoEstado) {
  updateReclamo(id, { estado: nuevoEstado });
  renderReclamosAdmin();
  showToast('Estado del reclamo actualizado', 'success');
}

// ============================================================
// AVISOS
// ============================================================

function renderAvisosAdmin() {
  renderAvisosList();
  setupAvisoForm();
}

function renderAvisosList() {
  const container = document.getElementById('avisosAdminList');
  if (!container) return;

  const avisos = getAvisosByAdmin(adminIdActual);
  const iconosTipo = { agua: '💧', luz: '💡', gas: '🔥', limpieza: '🧹', general: '📢' };

  if (avisos.length === 0) {
    container.innerHTML = `<div class="empty-state"><p class="empty-state-title">No hay avisos publicados</p></div>`;
    return;
  }

  container.innerHTML = avisos.map(av => `
    <div class="aviso-card tipo-${av.tipo}">
      <div class="aviso-meta">
        <span class="aviso-tipo-badge">${iconosTipo[av.tipo] || '📢'} ${av.tipo}</span>
        <span class="aviso-date">${formatearFecha(av.fecha)}</span>
        <button class="btn btn--sm btn--danger" onclick="eliminarAviso('${av.id}')" style="margin-left:auto;">
          <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
        </button>
      </div>
      <div class="aviso-title">${av.titulo}</div>
      <div class="aviso-body">${av.cuerpo}</div>
    </div>
  `).join('');
  initIcons();
}

function setupAvisoForm() {
  let tipoSeleccionado = 'general';

  document.querySelectorAll('.aviso-tipo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.aviso-tipo-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      tipoSeleccionado = btn.getAttribute('data-tipo');
    });
  });

  document.getElementById('btnPublicarAviso')?.addEventListener('click', () => {
    const titulo = document.getElementById('avisoTitulo').value.trim();
    const cuerpo = document.getElementById('avisoCuerpo').value.trim();
    if (!titulo || !cuerpo) { showToast('Completá el título y el contenido', 'warning'); return; }

    createAviso({ tipo: tipoSeleccionado, titulo, cuerpo, adminId: adminIdActual });
    document.getElementById('avisoTitulo').value = '';
    document.getElementById('avisoCuerpo').value = '';
    renderAvisosList();
    showToast('Aviso publicado', 'success');
  });
}

function eliminarAviso(id) {
  if (confirm('¿Eliminar este aviso?')) {
    deleteAviso(id);
    renderAvisosList();
    showToast('Aviso eliminado', 'info');
  }
}

// ============================================================
// SIMULADOR DE AUMENTO
// ============================================================

function renderSimulador() {
  const selectInq = document.getElementById('simInquilino');
  if (selectInq) {
    const inqs = getInquilinosByAdmin(adminIdActual);
    selectInq.innerHTML = `<option value="">— Seleccionar para autocompletar —</option>` +
      inqs.map(i => `<option value="${i.valorAlquiler}">${i.nombre} ${i.apellido} — ${formatearPesos(i.valorAlquiler)}</option>`).join('');

    selectInq.addEventListener('change', () => {
      const val = parseFloat(selectInq.value);
      if (val) document.getElementById('simValorActual').value = val;
    });
  }

  document.getElementById('btnCalcAumento')?.addEventListener('click', () => {
    const valorActual = parseFloat(document.getElementById('simValorActual').value) || 0;
    const porcentaje  = parseFloat(document.getElementById('simPorcentaje').value)  || 0;
    if (!valorActual || !porcentaje) { showToast('Ingresá el valor actual y el porcentaje', 'warning'); return; }

    const { nuevoValor, aumento } = calcularAumento(valorActual, porcentaje);
    document.getElementById('simResultado').classList.add('visible');
    document.getElementById('simNuevoValor').textContent    = formatearPesos(nuevoValor);
    document.getElementById('simAumento').textContent       = `+ ${formatearPesos(aumento)} (${porcentaje}%)`;
    document.getElementById('simValorAnterior').textContent = formatearPesos(valorActual);
    showToast(`Nuevo valor: ${formatearPesos(nuevoValor)}`, 'success');
  });
}


// ============================================================
// SECCIÓN USUARIOS DESACTIVADOS (admin panel)
// ============================================================

function renderDesactivadosAdmin() {
  const container = document.getElementById('desactivadosAdminList');
  if (!container) return;

  const desactivados = getUsuariosDesactivados().filter(u => u.rol === 'inquilino');

  if (desactivados.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="user-check" style="width:24px;height:24px;"></i></div>
        <p class="empty-state-title">Sin usuarios desactivados</p>
        <p class="empty-state-text">Los inquilinos dados de baja lógica aparecerán aquí</p>
      </div>`;
    initIcons();
    return;
  }

  container.innerHTML = desactivados.map(u => `
    <div class="reclamo-card" style="display:flex;align-items:center;gap:var(--space-4);flex-wrap:wrap;">
      <div style="width:40px;height:40px;border-radius:50%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.875rem;flex-shrink:0;">
        ${getIniciales(u.nombre, '')}
      </div>
      <div style="flex:1;min-width:200px;">
        <div style="font-weight:600;">${u.nombre}</div>
        <div style="font-size:0.8125rem;color:var(--text-muted);">
          ${u.email || ''} ${u.unidad ? '· ' + u.unidad : ''}
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">
          Desactivado: ${formatearFecha(u.fechaDesactivacion)}
          ${u.motivo ? ' · Motivo: ' + u.motivo : ''}
        </div>
      </div>
      <div style="display:flex;gap:var(--space-2);">
        <span class="badge badge--danger">Desactivado</span>
        <button class="btn btn--sm btn--secondary" onclick="restaurarInqAdmin('${u.id}','${u.nombre}')">
          <i data-lucide="rotate-ccw" style="width:13px;height:13px;"></i> Restaurar
        </button>
      </div>
    </div>
  `).join('');
  initIcons();
}

function restaurarInqAdmin(usuarioId, nombre) {
  if (!confirm(`¿Restaurar la cuenta de ${nombre}?`)) return;
  restaurarInquilinoDesactivado(usuarioId);
  renderDesactivadosAdmin();
  showToast(`${nombre} restaurado correctamente`, 'success');
}

// Stub para compatibilidad (propiedades/consultas eliminadas)
function renderPropiedades() {}
function renderConsultasAdmin() {}


// ============================================================
// EXPENSAS — GESTIÓN ADMIN (crear/editar expensas por inquilino)
// ============================================================

function renderExpensasAdmin() {
  const container = document.getElementById('expensasAdminList');
  if (!container) return;

  renderExpensasList(container);
  setupExpensaForm();
}

function renderExpensasList(container) {
  const expensas = getExpensasByAdmin(adminIdActual);

  if (expensas.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="building-2" style="width:24px;height:24px;"></i></div>
        <p class="empty-state-title">Sin expensas cargadas</p>
        <p class="empty-state-text">Usá el formulario para agregar una expensa a un inquilino</p>
      </div>`;
    initIcons();
    return;
  }

  const inqMap = {};
  getInquilinosByAdmin(adminIdActual).forEach(i => { inqMap[i.id] = i; });

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-3);">
      ${expensas.map(e => {
        const inq    = inqMap[e.inquilinoId];
        const nombre = inq ? `${inq.nombre} ${inq.apellido} — ${inq.unidad}` : e.inquilinoId;
        const esExt  = e.tipo === 'extraordinaria';
        const pagada = e.estadoInquilino === 'pagado';
        return `
          <div class="reclamo-card" style="border-left:4px solid ${esExt ? 'var(--color-warning)' : 'var(--color-primary)'};padding:var(--space-4);">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap;">
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:0.9375rem;">${nombre}</div>
                <div style="font-size:0.8125rem;color:var(--text-muted);margin-top:2px;">
                  ${esExt ? '⭐ Extraordinaria' : '🏢 Ordinaria'}
                  ${e.descripcion ? ' · ' + e.descripcion : ''}
                  · Vence: ${e.vencimiento ? formatearFecha(e.vencimiento) : '—'}
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:var(--space-3);flex-shrink:0;">
                <div style="font-family:var(--font-heading);font-size:1.25rem;font-weight:700;">${formatearPesos(e.monto)}</div>
                ${pagada
                  ? '<span class="badge badge--success">✓ Pagada</span>'
                  : '<span class="badge badge--warning">Pendiente</span>'
                }
                <button class="btn btn--sm btn--danger" onclick="eliminarExpensaAdmin('${e.id}')" title="Eliminar">
                  <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  initIcons();
}

function setupExpensaForm() {
  const btn = document.getElementById('btnGuardarExpensa');
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = '1';

  // Populate inquilino selector
  const select = document.getElementById('expensaInquilino');
  if (select) {
    const inqs = getInquilinosByAdmin(adminIdActual);
    select.innerHTML = '<option value="">— Seleccionar inquilino —</option>' +
      inqs.map(i => `<option value="${i.id}">${i.nombre} ${i.apellido} — ${i.unidad}</option>`).join('');
  }

  btn.addEventListener('click', () => {
    const inquilinoId = document.getElementById('expensaInquilino')?.value;
    const monto       = parseFloat(document.getElementById('expensaMonto')?.value) || 0;
    const tipo        = document.getElementById('expensaTipo')?.value || 'ordinaria';
    const descripcion = document.getElementById('expensaDescripcion')?.value.trim() || '';
    const vencimiento = document.getElementById('expensaVencimiento')?.value || '';

    if (!inquilinoId || !monto || !vencimiento) {
      showToast('Completá inquilino, monto y vencimiento', 'warning');
      return;
    }

    const inq = getInquilinoById(inquilinoId);
    createExpensa({
      inquilinoId,
      inquilinoNombre: inq ? `${inq.nombre} ${inq.apellido}` : inquilinoId,
      adminId: adminIdActual,
      monto,
      tipo,
      descripcion,
      vencimiento,
    });

    // Reset form
    document.getElementById('expensaInquilino').value   = '';
    document.getElementById('expensaMonto').value       = '';
    document.getElementById('expensaDescripcion').value = '';
    document.getElementById('expensaVencimiento').value = '';
    document.getElementById('expensaTipo').value        = 'ordinaria';

    showToast('✔ Expensa cargada correctamente', 'success');
    renderExpensasList(document.getElementById('expensasAdminList'));
  });
}

function eliminarExpensaAdmin(id) {
  if (!confirm('¿Eliminar esta expensa?')) return;
  deleteExpensa(id);
  renderExpensasList(document.getElementById('expensasAdminList'));
  showToast('Expensa eliminada', 'info');
}

// ============================================================
// RECLAMOS ADMIN → SUPERADMIN
// ============================================================

const CATEGORIAS_RSA = {
  bug:      'Bug / Error del sistema',
  consulta: 'Consulta administrativa',
  tecnico:  'Problema técnico',
  otro:     'Otro',
};

function renderReclamosSuperAdmin() {
  const container = document.getElementById('reclamosSAAdminList');
  if (!container) return;

  setupFormReclamoSA();

  const misReclamos = getReclamosSAByAdmin(adminIdActual);

  const estadoBadge = {
    pendiente:   '<span class="badge badge--warning">Pendiente</span>',
    respondido:  '<span class="badge badge--info">Respondido</span>',
    resuelto:    '<span class="badge badge--success">Resuelto</span>',
  };

  const histContainer = document.getElementById('historialReclamosSA');
  if (!histContainer) return;

  if (misReclamos.length === 0) {
    histContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="inbox" style="width:24px;height:24px;"></i></div>
        <p class="empty-state-title">Sin reclamos enviados</p>
        <p class="empty-state-text">Tus consultas al SuperAdmin aparecerán aquí</p>
      </div>`;
    initIcons();
    return;
  }

  histContainer.innerHTML = misReclamos.map(r => `
    <div class="reclamo-card">
      <div class="reclamo-header">
        <div>
          <div class="reclamo-title">${r.titulo}</div>
          <div class="reclamo-category">${CATEGORIAS_RSA[r.categoria] || r.categoria} · ${tiempoRelativo(r.fecha)}</div>
        </div>
        ${estadoBadge[r.estado] || ''}
      </div>
      <p class="reclamo-description">${r.descripcion}</p>
      ${r.respuesta ? `
        <div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:10px 14px;margin-top:8px;font-size:0.875rem;">
          <span style="font-weight:600;color:var(--color-success);">✔ Respuesta del SuperAdmin: </span>${r.respuesta}
          ${r.fechaRespuesta ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:3px;">${formatearFecha(r.fechaRespuesta)}</div>` : ''}
        </div>
      ` : `<div style="font-size:0.8125rem;color:var(--text-muted);margin-top:6px;font-style:italic;">Esperando respuesta del SuperAdmin...</div>`}
    </div>
  `).join('');
  initIcons();
}

function setupFormReclamoSA() {
  const btn = document.getElementById('btnEnviarReclamoSA');
  if (!btn || btn.dataset.listenerSet) return;
  btn.dataset.listenerSet = '1';
  btn.addEventListener('click', () => {
    const titulo      = document.getElementById('rsaTitulo')?.value.trim();
    const categoria   = document.getElementById('rsaCategoria')?.value;
    const descripcion = document.getElementById('rsaDescripcion')?.value.trim();

    if (!titulo || !descripcion) {
      showToast('Completá el título y la descripción', 'warning');
      return;
    }

    const admin = getAdminById(adminIdActual);
    createReclamoSA({
      adminId:     adminIdActual,
      adminNombre: admin?.nombre || 'Admin',
      titulo,
      categoria,
      descripcion,
    });

    document.getElementById('rsaTitulo').value      = '';
    document.getElementById('rsaDescripcion').value = '';
    document.getElementById('rsaCategoria').value   = 'bug';

    showToast('Reclamo enviado al SuperAdmin', 'success');
    renderReclamosSuperAdmin();
  });
}


// ============================================================
// INTEGRACIONES DE CONTRATOS — PANEL ADMIN
// ============================================================

/**
 * Badge de estado de contrato para la columna de la tabla de inquilinos.
 */
function renderBadgeContratoTabla(inquilinoId) {
  if (typeof getContratoActivo !== 'function') return '—';
  const contrato = getContratoActivo(inquilinoId, 'inquilino');
  if (!contrato) {
    return '<span style="font-size:0.75rem;color:var(--text-muted);">Sin doc.</span>';
  }
  return `
    <div style="display:flex;align-items:center;gap:4px;">
      <span class="badge badge--success" style="font-size:0.65rem;padding:2px 6px;">v${contrato.version}</span>
      <button class="btn btn--sm btn--ghost" onclick="verContratoRapido('${inquilinoId}')" title="Ver contrato" style="padding:2px 5px;">
        <i data-lucide="file-text" style="width:12px;height:12px;"></i>
      </button>
    </div>
  `;
}

/** Preview rápido del contrato activo desde la tabla */
function verContratoRapido(inquilinoId) {
  if (typeof getContratoActivo !== 'function') return;
  const contrato = getContratoActivo(inquilinoId, 'inquilino');
  if (!contrato) { showToast('Sin contrato activo', 'warning'); return; }
  if (contrato.archivo?.dataUrl && typeof abrirModalPreview === 'function') {
    abrirModalPreview(contrato.archivo);
  } else {
    showToast('Archivo no previsualizable', 'info');
  }
}
