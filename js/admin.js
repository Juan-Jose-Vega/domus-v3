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
  updateReclamosBadge();
  navigateTo('dashboard');

  console.log('[Admin v3] Panel listo. AdminId:', adminIdActual);
});

// ============================================================
// BADGE RECLAMOS PENDIENTES (sidebar)
// ============================================================

function updateReclamosBadge() {
  const badge = document.getElementById('navReclamosBadge');
  if (!badge) return;
  const pendientes = getReclamosByAdmin(adminIdActual).filter(r => r.estado === 'pendiente').length;
  if (pendientes > 0) {
    badge.textContent = pendientes;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

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
    reclamos:           { title: 'Reclamos',          sub: 'Gestión de reclamos' },
    avisos:             { title: 'Avisos',            sub: 'Comunicados del edificio' },
    calendario:         { title: 'Calendario',        sub: 'Vencimientos y fechas' },
    simulador:          { title: 'Simulador',         sub: 'Calculadora de aumentos' },
    desactivados:       { title: 'Usuarios Desactivados', sub: 'Historial de bajas lógicas' },
    'reclamos-superadmin': { title: 'Soporte / SuperAdmin', sub: 'Enviá consultas técnicas o reportes de errores' },
    propiedades:           { title: 'Propiedades',          sub: 'Gestión de propiedades y unidades' },
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
    case 'reclamos':             renderReclamosAdmin(); updateReclamosBadge(); break;
    case 'avisos':               renderAvisosAdmin();           break;
    case 'calendario':           initCalendar();                break;
    case 'simulador':            renderSimulador();             break;
    case 'desactivados':         renderDesactivadosAdmin();     break;
    case 'reclamos-superadmin':  renderReclamosSuperAdmin();    break;
    case 'propiedades':          renderPropiedadesAdmin();      break;
    case 'expensas':             renderExpensasAdmin();         break;
    case 'pagos':               navigateTo('inquilinos');       return;
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
  const si = document.getElementById('searchInquilino');
  if (si && !si.dataset.bound) {
    si.dataset.bound = '1';
    si.addEventListener('input', e => { filtroInquilinos.busqueda = e.target.value.toLowerCase(); renderInquilinoTable(); });
  }
  const fe = document.getElementById('filterEstado');
  if (fe && !fe.dataset.bound) {
    fe.dataset.bound = '1';
    fe.addEventListener('change', e => { filtroInquilinos.estado = e.target.value; renderInquilinoTable(); });
  }
  const fa = document.getElementById('filterEstadoAdmin');
  if (fa && !fa.dataset.bound) {
    fa.dataset.bound = '1';
    fa.addEventListener('change', e => { filtroInquilinos.estadoAdmin = e.target.value; renderInquilinoTable(); });
  }
  const bn = document.getElementById('btnNuevoInquilino');
  if (bn) bn.onclick = () => openInquilinoModal(null);
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

  // ── Sección Pagos + Comprobantes del inquilino ──
  _renderPagosComprobantesDetalle(container, id);

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
 * Renderiza el historial de pagos y comprobantes del inquilino
 * dentro del modal de detalle — reemplaza la sección global "Pagos".
 */
function _renderPagosComprobantesDetalle(container, inquilinoId) {
  const inq     = getInquilinoById(inquilinoId);
  const pagos   = getPagosByInquilino(inquilinoId);
  const comps   = getComprobantesByInquilino(inquilinoId);

  const zona = document.createElement('div');
  zona.style.cssText = 'margin-top:var(--space-5);padding-top:var(--space-5);border-top:1px solid var(--border-subtle);';

  // ── Tabs ──
  zona.innerHTML = `
    <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4);">
      <button class="btn btn--sm btn--primary" id="tabBtnPagos_${inquilinoId}" onclick="_switchTabPagos('${inquilinoId}','pagos')">
        <i data-lucide="banknote" style="width:13px;height:13px;"></i> Pagos
      </button>
      <button class="btn btn--sm btn--secondary" id="tabBtnComps_${inquilinoId}" onclick="_switchTabPagos('${inquilinoId}','comps')">
        <i data-lucide="file-up" style="width:13px;height:13px;"></i> Comprobantes
        ${comps.length > 0 ? `<span style="margin-left:4px;background:var(--color-primary);color:white;border-radius:99px;padding:1px 6px;font-size:0.7rem;">${comps.length}</span>` : ''}
      </button>
    </div>

    <!-- TAB PAGOS -->
    <div id="tabPagos_${inquilinoId}">
      ${pagos.length === 0
        ? `<p style="color:var(--text-muted);font-size:0.875rem;padding:var(--space-4) 0;">Sin pagos registrados</p>`
        : `<div style="overflow-x:auto;">
            <table class="table" style="font-size:0.8125rem;">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Método</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${pagos.map(p => `
                  <tr>
                    <td>${p.concepto}</td>
                    <td>${formatearFecha(p.fecha)}</td>
                    <td style="font-family:var(--font-mono);color:var(--color-success);">${formatearPesos(p.monto)}</td>
                    <td>${p.metodoPago || '—'}</td>
                    <td>${badgePago(p.estado)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`
      }
    </div>

    <!-- TAB COMPROBANTES -->
    <div id="tabComps_${inquilinoId}" style="display:none;">
      ${comps.length === 0
        ? `<p style="color:var(--text-muted);font-size:0.875rem;padding:var(--space-4) 0;">Sin comprobantes adjuntados</p>`
        : `<div style="display:flex;flex-direction:column;gap:var(--space-3);">
            ${comps.map(c => `
              <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);background:var(--bg-elevated);border-radius:var(--radius-md);flex-wrap:wrap;">
                <div style="width:36px;height:36px;border-radius:var(--radius-sm);background:var(--bg-surface);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                  <i data-lucide="${c.tipo === 'pdf' ? 'file-text' : 'image'}" style="width:18px;height:18px;color:var(--color-primary);"></i>
                </div>
                <div style="flex:1;min-width:140px;">
                  <div style="font-weight:500;font-size:0.875rem;">${c.nombre}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted);">${c.concepto} · ${c.tamaño || ''} · Subido: ${formatearFecha(c.fecha)}</div>
                </div>
                <div style="display:flex;align-items:center;gap:var(--space-2);flex-shrink:0;">
                  ${c.estado === 'verificado'
                    ? '<span class="badge badge--success">✓ Verificado</span>'
                    : '<span class="badge badge--warning">⏳ Pendiente</span>'
                  }
                  ${c.dataUrl
                    ? `<button class="btn btn--sm btn--secondary" onclick="_verComprobante('${c.id}')" title="Ver comprobante">
                         <i data-lucide="eye" style="width:13px;height:13px;"></i> Ver
                       </button>
                       <a class="btn btn--sm btn--secondary" href="${c.dataUrl}" download="${c.nombre}" title="Descargar">
                         <i data-lucide="download" style="width:13px;height:13px;"></i>
                       </a>`
                    : `<span style="font-size:0.75rem;color:var(--text-muted);">Sin archivo</span>`
                  }
                  ${c.estado !== 'verificado'
                    ? `<button class="btn btn--sm btn--primary" onclick="_verificarComprobante('${c.id}','${inquilinoId}')" title="Verificar">
                         <i data-lucide="check" style="width:13px;height:13px;"></i>
                       </button>`
                    : ''
                  }
                </div>
              </div>
            `).join('')}
          </div>`
      }
    </div>
  `;

  container.appendChild(zona);
  initIcons();
}

function _switchTabPagos(inquilinoId, tab) {
  const tabPagos = document.getElementById(`tabPagos_${inquilinoId}`);
  const tabComps = document.getElementById(`tabComps_${inquilinoId}`);
  const btnPagos = document.getElementById(`tabBtnPagos_${inquilinoId}`);
  const btnComps = document.getElementById(`tabBtnComps_${inquilinoId}`);
  if (!tabPagos || !tabComps) return;
  if (tab === 'pagos') {
    tabPagos.style.display = '';
    tabComps.style.display = 'none';
    btnPagos.className = 'btn btn--sm btn--primary';
    btnComps.className = 'btn btn--sm btn--secondary';
  } else {
    tabPagos.style.display = 'none';
    tabComps.style.display = '';
    btnPagos.className = 'btn btn--sm btn--secondary';
    btnComps.className = 'btn btn--sm btn--primary';
  }
}

function _verComprobante(compId) {
  const comp = getComprobantes().find(c => c.id === compId);
  if (!comp?.dataUrl) { showToast('Archivo no disponible', 'warning'); return; }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'display:flex;z-index:9999;';
  const esImg = comp.tipo === 'imagen' || /\.(jpg|jpeg|png|gif|webp)$/i.test(comp.nombre);
  overlay.innerHTML = `
    <div class="modal" style="max-width:700px;width:95%;">
      <div class="modal__header">
        <h3 class="modal__title">📎 ${comp.nombre}</h3>
        <button class="modal__close" onclick="this.closest('.modal-overlay').remove()">
          <i data-lucide="x" style="width:16px;height:16px;"></i>
        </button>
      </div>
      <div style="font-size:0.8125rem;color:var(--text-muted);margin-bottom:var(--space-4);">
        ${comp.concepto} · Subido: ${formatearFecha(comp.fecha)} · ${comp.tamaño || ''}
      </div>
      <div style="background:var(--bg-elevated);border-radius:var(--radius-md);overflow:hidden;max-height:70vh;overflow-y:auto;display:flex;align-items:center;justify-content:center;min-height:200px;">
        ${esImg
          ? `<img src="${comp.dataUrl}" style="max-width:100%;max-height:65vh;object-fit:contain;" alt="${comp.nombre}" />`
          : `<iframe src="${comp.dataUrl}" style="width:100%;height:65vh;border:none;" title="${comp.nombre}"></iframe>`
        }
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
        <a class="btn btn--primary" href="${comp.dataUrl}" download="${comp.nombre}">
          <i data-lucide="download" style="width:15px;height:15px;"></i> Descargar
        </a>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  initIcons();
}

function _verificarComprobante(compId, inquilinoId) {
  updateComprobante(compId, { estado: 'verificado' });
  showToast('✔ Comprobante verificado', 'success');
  // Re-render detalle
  openInquilinoDetail(inquilinoId);
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
  document.getElementById('inqAlquiler').value  = inq?.valorAlquiler || '';
  document.getElementById('inqMetodo').value    = inq?.metodoPago || 'Transferencia';
  document.getElementById('inqEstado').value    = inq?.estadoPago || 'pendiente';
  document.getElementById('inqDuracion').value  = inq?.duracionContrato || 24;
  document.getElementById('inqFechaInicio').value = inq?.fechaInicioContrato || new Date().toISOString().split('T')[0];

  // Poblar selector de propiedades
  _poblarSelectorPropiedades(inq?.propiedadId || null, id || null);

  // Bloque contraseña: siempre visible, cambia según modo
  const passReadOnly = document.getElementById('inqPassReadOnly');
  const passCreate   = document.getElementById('inqPassCreate');

  if (id) {
    // Modo edición: mostrar contraseña actual (solo lectura)
    if (passCreate)   passCreate.style.display   = 'none';
    if (passReadOnly) passReadOnly.style.display  = 'block';

    // Buscar contraseña del usuario asociado al inquilino
    const usuarios = storageGet(STORAGE_KEYS.USUARIOS, []);
    const usuarioInq = usuarios.find(u => u.email === inq?.email && u.rol === 'inquilino');
    const passDisplay = document.getElementById('inqPasswordDisplay');
    if (passDisplay) {
      passDisplay.value = usuarioInq?.password || '';
      passDisplay.type  = 'password';
    }
    const btnToggle = document.getElementById('btnTogglePassDisplay');
    if (btnToggle) {
      btnToggle.innerHTML = '<i data-lucide="eye" style="width:15px;height:15px;"></i> Ver';
    }
  } else {
    // Modo creación: mostrar campos de contraseña
    if (passCreate)   passCreate.style.display   = 'grid';
    if (passReadOnly) passReadOnly.style.display  = 'none';

    // Limpiar campos
    ['inqPassword','inqPasswordConf'].forEach(fid => {
      const f = document.getElementById(fid);
      if (f) { f.value = ''; f.type = 'password'; }
    });
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('btnGuardarInquilino').setAttribute('data-id', id || '');
  openModal('modalInquilino');
}

/** Llena el <select> de propiedades con las disponibles + la actual del inquilino */
function _poblarSelectorPropiedades(propiedadIdActual, inquilinoId) {
  const sel = document.getElementById('inqPropiedadId');
  if (!sel) return;
  const props = getPropiedadesByAdmin(adminIdActual);

  sel.innerHTML = '<option value="">— Seleccionar propiedad —</option>';

  props.forEach(p => {
    // Mostrar: disponibles + la que ya tiene asignada este inquilino
    const esLaActual = p.id === propiedadIdActual;
    if (p.estado === 'disponible' || esLaActual) {
      const opt = document.createElement('option');
      opt.value = p.id;
      let label = p.nombre;
      if (p.piso) label += ` (Piso ${p.piso})`;
      if (esLaActual && p.estado !== 'disponible') label += ` — ${p.estado}`;
      opt.textContent = label;
      if (esLaActual) opt.selected = true;
      sel.appendChild(opt);
    }
  });

  // Si no hay propiedades disponibles y tampoco hay actual
  if (sel.options.length === 1) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.disabled = true;
    opt.textContent = 'Sin propiedades disponibles';
    sel.appendChild(opt);
  }
}

function setupInquilinoForm() {
  const bg = document.getElementById('btnGuardarInquilino');
  if (bg) bg.onclick = () => { const id = bg.getAttribute('data-id'); guardarInquilino(id || null); };
  const bc = document.getElementById('btnCancelarInquilino');
  if (bc) bc.onclick = () => closeModal('modalInquilino');
}

function guardarInquilino(id) {
  const nombre         = document.getElementById('inqNombre').value.trim();
  const apellido       = document.getElementById('inqApellido').value.trim();
  const email          = document.getElementById('inqEmail').value.trim();
  const dni            = document.getElementById('inqDni')?.value.trim() || '';
  // Propiedad seleccionada
  const propiedadId = document.getElementById('inqPropiedadId')?.value || '';
  const propObj     = propiedadId ? getPropiedadById(propiedadId) : null;
  // Validar estado si es nueva asignación
  if (!id && propObj && propObj.estado !== 'disponible') {
    const estadoLabel = { reservada: 'Propiedad reservada', ocupada: 'Propiedad ocupada' }[propObj.estado] || propObj.estado;
    showToast(`⚠️ ${estadoLabel}: "${propObj.nombre}"`, 'warning');
    return;
  }
  const unidad = propObj ? propObj.nombre : (document.getElementById('inqUnidad')?.value.trim() || '');
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
    propiedadId:         propiedadId || '',
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
    // Handle property change on edit
    const inqAnterior = getInquilinoById(id);
    const propAnterior = inqAnterior?.propiedadId || '';
    if (propAnterior && propAnterior !== propiedadId) {
      // Liberar la propiedad anterior
      liberarPropiedad(propAnterior);
    }
    if (propiedadId && propiedadId !== propAnterior) {
      // Ocupar la nueva propiedad
      ocuparPropiedad(propiedadId, 'ocupada');
    }
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
    // Ocupar la propiedad asignada
    if (propiedadId) ocuparPropiedad(propiedadId, 'ocupada');
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
  // Liberar la propiedad del inquilino
  const inqParaDesact = getInquilinoById(id);
  if (inqParaDesact?.propiedadId) liberarPropiedad(inqParaDesact.propiedadId);
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
  const sp = document.getElementById('searchPago');
  if (sp && !sp.dataset.bound) { sp.dataset.bound='1'; sp.addEventListener('input', e => renderPagosTable(e.target.value)); }
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
  updateReclamosBadge();
  showToast('Estado del reclamo actualizado', 'success');
}

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
  const btn = document.getElementById('btnPublicarAviso');
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = '1';
  let tipoSeleccionado = 'general';

  document.querySelectorAll('.aviso-tipo-btn').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.aviso-tipo-btn').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      tipoSeleccionado = b.getAttribute('data-tipo');
    };
  });

  btn.onclick = () => {
    const titulo = document.getElementById('avisoTitulo').value.trim();
    const cuerpo = document.getElementById('avisoCuerpo').value.trim();
    if (!titulo || !cuerpo) { showToast('Completá el título y el contenido', 'warning'); return; }

    createAviso({ tipo: tipoSeleccionado, titulo, cuerpo, adminId: adminIdActual });
    document.getElementById('avisoTitulo').value = '';
    document.getElementById('avisoCuerpo').value = '';
    renderAvisosList();
    showToast('Aviso publicado', 'success');
  };
}

function eliminarAviso(id) {
  if (confirm('¿Eliminar este aviso?')) {
    deleteAviso(id);
    renderAvisosList();
    showToast('Aviso eliminado', 'info');
  }
}

function renderSimulador() {
  const selectInq = document.getElementById('simInquilino');
  if (selectInq) {
    const inqs = getInquilinosByAdmin(adminIdActual);
    selectInq.innerHTML = `<option value="">— Seleccionar para autocompletar —</option>` +
      inqs.map(i => `<option value="${i.valorAlquiler}">${i.nombre} ${i.apellido} — ${formatearPesos(i.valorAlquiler)}</option>`).join('');

    if (!selectInq.dataset.bound) {
      selectInq.dataset.bound = '1';
      selectInq.addEventListener('change', () => {
        const val = parseFloat(selectInq.value);
        if (val) document.getElementById('simValorActual').value = val;
      });
    }
  }

  const btnCalc = document.getElementById('btnCalcAumento');
  if (btnCalc && !btnCalc.dataset.bound) {
    btnCalc.dataset.bound = '1';
    btnCalc.addEventListener('click', () => {
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
}

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


// ============================================================
// PROPIEDADES — Render, Modal y Lógica
// ============================================================

function renderPropiedades() { renderPropiedadesAdmin(); }

function renderPropiedadesAdmin() {
  const props   = getPropiedadesByAdmin(adminIdActual);
  const search  = (document.getElementById('searchPropiedad')?.value || '').toLowerCase();
  const filtEst = document.getElementById('filterPropEstado')?.value || 'todos';
  const tbody   = document.getElementById('propiedadTbody');
  if (!tbody) { setupPropiedadesAdmin(); return; }
  setupPropiedadesAdmin();

  const estadoBadge = {
    disponible: '<span class="badge badge--success">Disponible</span>',
    reservada:  '<span class="badge badge--warning">Reservada</span>',
    ocupada:    '<span class="badge badge--danger">Ocupada</span>',
  };

  const filtered = props.filter(p => {
    const matchSearch = !search ||
      p.nombre.toLowerCase().includes(search) ||
      (p.direccion || '').toLowerCase().includes(search) ||
      (p.ciudad || '').toLowerCase().includes(search);
    const matchEst = filtEst === 'todos' || p.estado === filtEst;
    return matchSearch && matchEst;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:var(--space-6);">Sin propiedades${search ? ' que coincidan' : ''}. Creá una nueva.</td></tr>`;
    initIcons();
    return;
  }

  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td><strong>${p.nombre}</strong></td>
      <td>${p.piso || '—'}</td>
      <td>${p.direccion || '—'}</td>
      <td>${[p.ciudad, p.provincia].filter(Boolean).join(', ') || '—'}</td>
      <td>${estadoBadge[p.estado] || p.estado}</td>
      <td style="font-size:0.8rem;color:var(--text-muted);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${p.observaciones || ''}">${p.observaciones || '—'}</td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn btn--sm btn--ghost" onclick="openPropiedadModal('${p.id}')" title="Editar">
            <i data-lucide="pencil" style="width:13px;height:13px;"></i>
          </button>
          ${p.estado === 'disponible'
            ? `<button class="btn btn--sm btn--ghost" onclick="confirmarEliminarPropiedad('${p.id}','${p.nombre.replace(/'/g, "\\'")}') " title="Eliminar" style="color:var(--color-danger);">
                <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
               </button>`
            : `<span style="font-size:0.72rem;color:var(--text-muted);padding:2px 6px;" title="No se puede eliminar: ${p.estado}">🔒</span>`
          }
        </div>
      </td>
    </tr>
  `).join('');
  initIcons();
}

function setupPropiedadesAdmin() {
  // Use onclick to avoid duplicate listeners
  const btnNew = document.getElementById('btnNuevaPropiedad');
  if (btnNew) btnNew.onclick = () => openPropiedadModal(null);
  const searchEl = document.getElementById('searchPropiedad');
  if (searchEl) searchEl.oninput = renderPropiedadesAdmin;
  const filterEl = document.getElementById('filterPropEstado');
  if (filterEl) filterEl.onchange = renderPropiedadesAdmin;
  const btnSave = document.getElementById('btnGuardarPropiedad');
  if (btnSave) btnSave.onclick = () => {
    const id = document.getElementById('btnGuardarPropiedad').getAttribute('data-id');
    guardarPropiedad(id || null);
  };
}

function openPropiedadModal(id) {
  const prop = id ? getPropiedadById(id) : null;
  document.getElementById('modalPropiedadTitle').textContent = prop ? 'Editar Propiedad' : 'Nueva Propiedad';
  document.getElementById('propNombre').value       = prop?.nombre       || '';
  document.getElementById('propPiso').value         = prop?.piso         || '';
  document.getElementById('propEstado').value       = prop?.estado       || 'disponible';
  document.getElementById('propDireccion').value    = prop?.direccion    || '';
  document.getElementById('propCiudad').value       = prop?.ciudad       || '';
  document.getElementById('propProvincia').value    = prop?.provincia    || '';
  document.getElementById('propObservaciones').value = prop?.observaciones || '';
  document.getElementById('btnGuardarPropiedad').setAttribute('data-id', id || '');
  openModal('modalPropiedad');
}

function guardarPropiedad(id) {
  const nombre = document.getElementById('propNombre').value.trim();
  if (!nombre) { showToast('El nombre es requerido', 'warning'); return; }

  const data = {
    nombre,
    piso:          document.getElementById('propPiso').value.trim(),
    estado:        document.getElementById('propEstado').value,
    direccion:     document.getElementById('propDireccion').value.trim(),
    ciudad:        document.getElementById('propCiudad').value.trim(),
    provincia:     document.getElementById('propProvincia').value.trim(),
    observaciones: document.getElementById('propObservaciones').value.trim(),
    adminId:       adminIdActual,
    adminNombre:   sesionAdmin?.nombre || 'Admin',
  };

  if (id) {
    const res = updatePropiedad(id, data);
    if (res?.error) { showToast(res.error, 'danger'); return; }
    showToast('Propiedad actualizada', 'success');
  } else {
    const res = createPropiedad(data);
    if (res?.error) { showToast(res.error, 'danger'); return; }
    showToast('Propiedad creada', 'success');
  }
  closeModal('modalPropiedad');
  renderPropiedadesAdmin();
}

function confirmarEliminarPropiedad(id, nombre) {
  if (!confirm(`¿Eliminar la propiedad "${nombre}"?`)) return;
  const res = deletePropiedad(id);
  if (res?.error) { showToast(res.error, 'danger'); return; }
  showToast('Propiedad eliminada', 'success');
  renderPropiedadesAdmin();
}


// ── Toggle visibilidad de contraseña ──
function togglePassVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    if (icon) icon.setAttribute('data-lucide', 'eye');
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
function renderConsultasAdmin() {}

// -- Toggle visibilidad contraseña en modo edición de inquilino --
function togglePassDisplay() {
  const input = document.getElementById('inqPasswordDisplay');
  const btn   = document.getElementById('btnTogglePassDisplay');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.innerHTML = '<i data-lucide="eye-off" style="width:15px;height:15px;"></i> Ocultar';
  } else {
    input.type = 'password';
    if (btn) btn.innerHTML = '<i data-lucide="eye" style="width:15px;height:15px;"></i> Ver';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}


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