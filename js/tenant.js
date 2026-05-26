/*
  ============================================================
  tenant.js — Panel Inquilino (v2)
  ============================================================
  CAMBIOS vs v1:
  - Corregido bug "Vence en -81 días" usando textoVencimiento()
  - Nuevo campo: expensas con badge de estado
  - Servicios muestran nombre real: EDET / SAT / Gasnor
  - Próximos vencimientos con alertas visuales por urgencia
  - Timeline del contrato mejorado
  - Badges de colores correctos en todos los vencimientos
  ============================================================
*/

let inquilinoActual = null;

// ============================================================
// INICIALIZACIÓN
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const sesion = requireAuth('inquilino');
  if (!sesion) return;

  inquilinoActual = getInquilinoById(sesion.inquilinoId);

  if (!inquilinoActual) {
    alert('No se encontraron datos del inquilino. Contacte al administrador.');
    clearSession();
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('tenantName').textContent   = `${inquilinoActual.nombre} ${inquilinoActual.apellido}`;
  document.getElementById('tenantAvatar').textContent = getIniciales(inquilinoActual.nombre, inquilinoActual.apellido);
  document.getElementById('tenantUnidad').textContent = inquilinoActual.unidad;

  initIcons();
  initSidebarTenant();
  initNotifications();
  initTopbarTenant();
  navigateToTenant('inicio');
});

// ============================================================
// SIDEBAR
// ============================================================

function initSidebarTenant() {
  const sidebar        = document.getElementById('sidebarTenant');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

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
      navigateToTenant(item.getAttribute('data-section'));
      sidebar.classList.remove('mobile-open');
      sidebarOverlay?.classList.remove('active');
    });
  });
}

function initTopbarTenant() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) {
      clearSession();
      window.location.href = 'index.html?logout=1';
    }
  });
}

// ============================================================
// NAVEGACIÓN
// ============================================================

function navigateToTenant(sectionId) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('section-' + sectionId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-section') === sectionId);
  });

  const titles = {
    inicio:       { title: 'Mi Panel',         sub: 'Resumen de tu alquiler' },
    pagos:        { title: 'Mis Pagos',         sub: 'Historial de pagos' },
    comprobantes: { title: 'Comprobantes',      sub: 'Adjuntar comprobantes' },
    expensas:     { title: 'Expensas',          sub: 'Expensas del edificio' },
    servicios:    { title: 'Mis Servicios',     sub: 'Control de servicios personales' },
    reclamos:     { title: 'Reclamos',          sub: 'Reportar y ver reclamos' },
    avisos:       { title: 'Avisos',            sub: 'Comunicados del edificio' },
    contrato:     { title: 'Mi Contrato',      sub: 'Documento de alquiler vigente' },
  };

  const info = titles[sectionId] || { title: sectionId, sub: '' };
  const titleEl = document.getElementById('topbarTitle');
  const subEl   = document.getElementById('topbarSubtitle');
  if (titleEl) titleEl.textContent = info.title;
  if (subEl)   subEl.textContent   = info.sub;

  switch (sectionId) {
    case 'inicio':       renderTenantInicio();        break;
    case 'pagos':        renderTenantPagos();         break;
    case 'comprobantes': renderComprobantes();        break;
    case 'expensas':     renderExpensasTenant();      break;
    case 'servicios':    renderServiciosPersonales(); break;
    case 'reclamos':     renderReclamosTenant();      break;
    case 'avisos':       renderAvisosTenant();        break;
    case 'contrato':     renderContratoTenant();      break;
  }
}

// Alias global para que notifications.js pueda navegar desde el panel inquilino
function navigateTo(sectionId) { navigateToTenant(sectionId); }

// ============================================================
// SECCIÓN INICIO
// ============================================================

function renderTenantInicio() {
  const inq = inquilinoActual;

  // Calcular progreso del contrato
  const pct = Math.min(Math.round((inq.mesActual / inq.duracionContrato) * 100), 100);

  // ─── Vencimiento contrato (en meses/años) y próximo pago (≤31 días) ──
  // textoVencimientoContrato() evita mostrar "Vence en 425 días" para contratos largos.
  // textoVencimientoPago() limita el ciclo mensual a máximo 31 días.
  const { texto: textoContrato, urgencia: urgContrato } = textoVencimientoContrato(inq.fechaVencimiento);
  const { texto: textoPago,     urgencia: urgPago }     = textoVencimientoPago(inq.proximoVencimientoPago);

  // ---- Banner: Faltan X días para el próximo pago ----
  const diasPago = diasHasta(inq.proximoVencimientoPago);
  const diasParaPago = Math.min(Math.max(diasPago, 0), 31);
  let bannerColor = '#06b6d4';
  let bannerIcon  = 'calendar-clock';
  let bannerMsg   = '';
  if (diasPago < 0) {
    bannerColor = '#ef4444';
    bannerIcon  = 'alert-circle';
    bannerMsg   = `⚠️ El pago del alquiler está atrasado ${Math.abs(diasPago)} día${Math.abs(diasPago) !== 1 ? 's' : ''}`;
  } else if (diasPago === 0) {
    bannerColor = '#ef4444';
    bannerIcon  = 'alert-circle';
    bannerMsg   = '🔴 El pago del alquiler vence hoy';
  } else if (diasPago === 1) {
    bannerColor = '#f59e0b';
    bannerIcon  = 'clock';
    bannerMsg   = '⏰ Falta 1 día para el próximo pago del alquiler';
  } else {
    bannerMsg = `Faltan <strong>${diasParaPago}</strong> día${diasParaPago !== 1 ? 's' : ''} para el próximo pago del alquiler`;
  }

  // ---- Bienvenida ----
  const bienvenidaEl = document.getElementById('tenantWelcomeSection');
  if (bienvenidaEl) {
    bienvenidaEl.innerHTML = `
      <div class="tenant-welcome animate-fade-in">
        <div class="tenant-welcome-greeting">👋 ¡Hola de vuelta!</div>
        <div class="tenant-welcome-name">${inq.nombre} ${inq.apellido}</div>
        <div class="tenant-welcome-info">Unidad: <strong>${inq.unidad}</strong></div>
        <div class="tenant-welcome-tags">
          <div class="welcome-tag">
            <i data-lucide="calendar" style="width:14px;height:14px;"></i>
            Mes ${inq.mesActual} de ${inq.duracionContrato}
          </div>
          <div class="welcome-tag">
            <i data-lucide="clock" style="width:14px;height:14px;"></i>
            ${textoContrato}
          </div>
          <div class="welcome-tag">
            <i data-lucide="credit-card" style="width:14px;height:14px;"></i>
            ${inq.metodoPago}
          </div>
        </div>
      </div>
      <!-- Banner próximo pago -->
      <div class="proximo-pago-banner" style="border-left-color:${bannerColor};">
        <i data-lucide="${bannerIcon}" style="width:20px;height:20px;color:${bannerColor};flex-shrink:0;"></i>
        <span>${bannerMsg}</span>
      </div>
    `;
    initIcons();
  }

  // ---- Card próximo pago (con texto correcto) ----
  const pagoCard = document.getElementById('tenantNextPayment');
  if (pagoCard) {
    const statusClass = { pagado: 'status-ok', pendiente: 'status-warn', atrasado: 'status-danger' }[inq.estadoPago] || '';
    pagoCard.innerHTML = `
      <div class="next-payment-card ${statusClass}">
        <div class="next-payment-label">💰 Alquiler del mes</div>
        <div class="next-payment-amount">${formatearPesos(inq.valorAlquiler)}</div>
        <div style="margin-bottom:var(--space-3);">
          ${badgePago(inq.estadoPago)}
          <span style="margin-left:8px;font-size:0.8125rem;color:var(--text-muted);">
            Próximo pago: <span class="badge badge--${urgPago}" style="margin-left:4px;">${textoPago}</span>
          </span>
        </div>
        <div class="next-payment-actions">
          <button class="btn btn--primary" onclick="navigateToTenant('comprobantes')">
            <i data-lucide="upload" style="width:15px;height:15px;"></i> Adjuntar comprobante
          </button>
          <button class="btn btn--secondary" onclick="navigateToTenant('pagos')">
            <i data-lucide="history" style="width:15px;height:15px;"></i> Ver historial
          </button>
        </div>
      </div>
    `;
    initIcons();
  }

  // ---- Expensas (preview desde storage) ----
  const expensasEl = document.getElementById('tenantExpensas');
  if (expensasEl) {
    const expensas = getExpensasByInquilino(inq.id);
    const expPendientes = expensas.filter(e => e.estadoInquilino !== 'pagado');
    // También considerar expensas en el objeto del inquilino (legacy)
    const tieneExpensasLegacy = inq.expensas && inq.expensas.monto;
    const totalPendiente = expPendientes.reduce((s, e) => s + (parseFloat(e.monto) || 0), 0)
                         + (tieneExpensasLegacy && inq.expensas.estado !== 'pagado' ? inq.expensas.monto : 0);

    expensasEl.innerHTML = `
      <div class="card" style="margin-bottom:var(--space-5);">
        <div class="card__header">
          <span class="card__title">🏢 Expensas</span>
          <button class="btn btn--sm btn--ghost" onclick="navigateToTenant('expensas')">Ver todas</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            ${totalPendiente > 0
              ? `<div style="font-family:var(--font-heading);font-size:1.5rem;font-weight:700;">${formatearPesos(totalPendiente)}</div>
                 <div style="font-size:0.8125rem;color:var(--text-muted);margin-top:4px;">${expPendientes.length + (tieneExpensasLegacy && inq.expensas.estado !== 'pagado' ? 1 : 0)} expensa(s) pendiente(s)</div>`
              : `<div style="font-size:0.9375rem;color:var(--color-success);font-weight:600;">✓ Sin expensas pendientes</div>`
            }
          </div>
          ${totalPendiente > 0
            ? `<button class="btn btn--primary btn--sm" onclick="navigateToTenant('expensas')">Ver expensas</button>`
            : '<span class="badge badge--success">Al día</span>'
          }
        </div>
      </div>
    `;
  }

  // ---- Progreso del contrato ----
  const progresoEl = document.getElementById('tenantContratoProgress');
  if (progresoEl) {
    progresoEl.innerHTML = `
      <div class="card">
        <div class="card__header">
          <span class="card__title">📋 Contrato</span>
          <span class="badge badge--${urgContrato}">${textoContrato}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.8125rem;color:var(--text-secondary);margin-bottom:6px;">
          <span>${inq.mesActual} meses transcurridos</span>
          <span>${inq.duracionContrato - inq.mesActual} restantes</span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);margin-top:6px;">
          <span>${formatearFecha(inq.fechaInicio)}</span>
          <span>${formatearFecha(inq.fechaVencimiento)}</span>
        </div>
      </div>
    `;
  }

  // ---- Próximos vencimientos (panel resumen con badges de urgencia) ----
  const vencimientosEl = document.getElementById('tenantVencimientos');
  if (vencimientosEl) {
    const items = [];

    // Pago de alquiler — usa función específica (ciclo mensual ≤31 días)
    if (inq.proximoVencimientoPago) {
      const v = textoVencimientoPago(inq.proximoVencimientoPago);
      items.push({ label: '💰 Alquiler', ...v, fecha: inq.proximoVencimientoPago });
    }

    // Expensas
    if (inq.expensas?.vencimiento) {
      const v = textoVencimiento(inq.expensas.vencimiento);
      items.push({ label: '🏢 Expensas', ...v, fecha: inq.expensas.vencimiento });
    }

    // Servicios — fuente única: SERVICIOS_PERSONALES
    const emojisVenc = { luz: '💡', agua: '💧', gas: '🔥', internet: '📶', otro: '📌' };
    getServiciosByInquilino(inq.id).forEach(srv => {
      if (srv.vencimiento && srv.estado !== 'pagado') {
        const v = textoVencimiento(srv.vencimiento);
        const emoji = emojisVenc[srv.tipo] || '🔧';
        items.push({ label: `${emoji} ${srv.nombre || srv.tipo}`, ...v, fecha: srv.vencimiento });
      }
    });

    // Ordenar por urgencia (más urgentes primero)
    items.sort((a, b) => diasHasta(a.fecha) - diasHasta(b.fecha));

    vencimientosEl.innerHTML = `
      <div class="card">
        <div class="card__header"><span class="card__title">⏰ Próximos vencimientos</span></div>
        <div style="display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-2);">
          ${items.map(item => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-subtle);">
              <span style="font-size:0.875rem;">${item.label}</span>
              <span class="badge badge--${item.urgencia}">${item.texto}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ---- Servicios — fuente única: SERVICIOS_PERSONALES ----
  const serviciosEl = document.getElementById('tenantServicios');
  if (serviciosEl) {
    const srvPersonales = getServiciosByInquilino(inq.id);
    const emojisMap = { luz: '💡', agua: '💧', gas: '🔥', internet: '📶', otro: '📌' };
    if (srvPersonales.length === 0) {
      serviciosEl.innerHTML = `
        <div class="card">
          <div class="card__header">
            <span class="card__title">Servicios</span>
            <button class="btn btn--sm btn--ghost" onclick="navigateToTenant('servicios')">Agregar</button>
          </div>
          <p style="font-size:0.875rem;color:var(--text-muted);padding:var(--space-2) 0;">
            Sin servicios registrados. Podés agregarlos en Mis Servicios.
          </p>
        </div>
      `;
    } else {
      serviciosEl.innerHTML = `
        <div class="card">
          <div class="card__header">
            <span class="card__title">Servicios</span>
            <button class="btn btn--sm btn--ghost" onclick="navigateToTenant('servicios')">Ver todos</button>
          </div>
          <div class="service-indicators">
            ${srvPersonales.map(srv => {
              const cls   = claseServicio(srv.estado || 'pendiente');
              const emoji = emojisMap[srv.tipo] || '🔧';
              const { texto: vt, urgencia: vu } = srv.vencimiento
                ? textoVencimiento(srv.vencimiento)
                : { texto: '', urgencia: '' };
              return `
                <div class="service-item ${cls}">
                  <div class="service-name">${emoji} ${srv.nombre || srv.tipo}</div>
                  <div class="service-status">${srv.estado || 'N/D'}</div>
                  ${vt ? `<div style="margin-top:4px;"><span class="badge badge--${vu}" style="font-size:0.65rem;">${vt}</span></div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    initIcons();
  }

  // ---- Avisos mini ----
  const miniAvisosEl = document.getElementById('miniAvisosList');
  if (miniAvisosEl) {
    const avisos = getAvisos().slice(0, 2);
    const iconosTipo = { agua: '💧', luz: '💡', gas: '🔥', limpieza: '🧹', general: '📢' };
    if (avisos.length === 0) {
      miniAvisosEl.innerHTML = `<p style="color:var(--text-muted);font-size:0.875rem;padding:var(--space-3) 0;">No hay avisos recientes</p>`;
    } else {
      miniAvisosEl.innerHTML = avisos.map(av => `
        <div style="padding:var(--space-3) 0;border-bottom:1px solid var(--border-subtle);display:flex;gap:var(--space-3);">
          <span style="font-size:1.1rem;">${iconosTipo[av.tipo] || '📢'}</span>
          <div>
            <div style="font-weight:500;font-size:0.875rem;margin-bottom:3px;">${av.titulo}</div>
            <div style="font-size:0.8125rem;color:var(--text-muted);">${tiempoRelativo(av.fecha)}</div>
          </div>
        </div>
      `).join('');
    }
  }
}

// ============================================================
// PAGOS
// ============================================================

function renderTenantPagos() {
  const tbody = document.getElementById('tenantPagosTbody');
  if (!tbody) return;

  const pagos = getPagosByInquilino(inquilinoActual.id);

  if (pagos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">No tenés pagos registrados</td></tr>`;
    return;
  }

  tbody.innerHTML = pagos.map(p => `
    <tr>
      <td>${p.concepto}</td>
      <td>${formatearFecha(p.fecha)}</td>
      <td style="font-family:var(--font-mono);color:var(--color-success);">${formatearPesos(p.monto)}</td>
      <td>${p.metodoPago}</td>
      <td>${badgePago(p.estado)}</td>
    </tr>
  `).join('');
}

// ============================================================
// COMPROBANTES (simulados)
// ============================================================

function renderComprobantes() {
  const uploader      = document.getElementById('comprobanteUploader');
  const listContainer = document.getElementById('comprobantesList');

  renderComprobanteList(listContainer);

  uploader?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';

    input.addEventListener('change', () => {
      if (input.files?.[0]) {
        const file = input.files[0];
        const kb   = Math.round(file.size / 1024);
        const ext  = file.name.split('.').pop().toLowerCase();

        createComprobante({
          inquilinoId:     inquilinoActual.id,
          inquilinoNombre: `${inquilinoActual.nombre} ${inquilinoActual.apellido}`,
          nombre:          file.name,
          tipo:            ext === 'pdf' ? 'pdf' : 'imagen',
          tamaño:          kb > 1000 ? `${(kb/1000).toFixed(1)} MB` : `${kb} KB`,
          concepto:        `Alquiler ${new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`,
        });

        showToast('✔ Comprobante adjuntado — pendiente de verificación', 'success');
        renderComprobanteList(listContainer);
      }
    });

    input.click();
  });
}

function renderComprobanteList(container) {
  if (!container) return;
  const comps = getComprobantesByInquilino(inquilinoActual.id);

  if (comps.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="file-x" style="width:24px;height:24px;"></i></div>
        <p class="empty-state-title">Sin comprobantes</p>
        <p class="empty-state-text">Adjuntá tu comprobante de pago haciendo click arriba</p>
      </div>
    `;
    initIcons();
    return;
  }

  container.innerHTML = `
    <div class="comprobante-list">
      ${comps.map(c => `
        <div class="comprobante-item">
          <div class="comprobante-file-icon">
            <i data-lucide="${c.tipo === 'pdf' ? 'file-text' : 'image'}" style="width:20px;height:20px;"></i>
          </div>
          <div class="comprobante-info">
            <div class="comprobante-name">${c.nombre}</div>
            <div class="comprobante-meta">${c.concepto} · ${c.tamaño} · ${formatearFecha(c.fecha)}</div>
          </div>
          ${c.estado === 'verificado'
            ? '<span class="badge badge--success">✓ Verificado</span>'
            : '<span class="badge badge--warning">⏳ Pendiente</span>'
          }
        </div>
      `).join('')}
    </div>
  `;
  initIcons();
}

// ============================================================
// RECLAMOS
// ============================================================

function renderReclamosTenant() {
  setupReclamoForm();
  renderReclamoList();
}

function setupReclamoForm() {
  const btnEnviar = document.getElementById('btnEnviarReclamo');
  if (!btnEnviar) return;

  btnEnviar.addEventListener('click', () => {
    const titulo      = document.getElementById('reclamoTitulo').value.trim();
    const descripcion = document.getElementById('reclamoDescripcion').value.trim();
    const categoria   = document.getElementById('reclamoCategoria').value;

    if (!titulo || !descripcion || !categoria) {
      showToast('Completá todos los campos del reclamo', 'warning');
      return;
    }

    createReclamo({
      inquilinoId:     inquilinoActual.id,
      inquilinoNombre: `${inquilinoActual.nombre} ${inquilinoActual.apellido}`,
      unidad:          inquilinoActual.unidad,
      adminId:         inquilinoActual.adminId,
      titulo, descripcion, categoria, prioridad: 'media'
    });

    document.getElementById('reclamoTitulo').value      = '';
    document.getElementById('reclamoDescripcion').value = '';
    document.getElementById('reclamoCategoria').value   = '';

    showToast('✔ Reclamo enviado correctamente', 'success');
    renderReclamoList();
  });
}

function renderReclamoList() {
  const container = document.getElementById('tenantReclamoList');
  if (!container) return;

  const reclamos = getReclamosByInquilino(inquilinoActual.id);

  if (reclamos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="inbox" style="width:24px;height:24px;"></i></div>
        <p class="empty-state-title">Sin reclamos</p>
      </div>
    `;
    initIcons();
    return;
  }

  container.innerHTML = reclamos.map(r => `
    <div class="reclamo-card">
      <div class="reclamo-header">
        <div>
          <div class="reclamo-title">${r.titulo}</div>
          <div class="reclamo-category">${r.categoria} · ${tiempoRelativo(r.fecha)}</div>
        </div>
        ${badgeReclamo(r.estado)}
      </div>
      <p class="reclamo-description">${r.descripcion}</p>
      ${r.respuesta ? `
        <div style="background:var(--color-info-bg);border-radius:var(--radius-md);padding:10px 14px;font-size:0.875rem;border:1px solid rgba(59,130,246,0.2);">
          <span style="font-weight:600;color:var(--color-info);">Respuesta: </span>${r.respuesta}
        </div>
      ` : ''}
    </div>
  `).join('');
}

// ============================================================
// AVISOS
// ============================================================

function renderAvisosTenant() {
  const container = document.getElementById('avisosInquilinoList');
  if (!container) return;

  const avisos = getAvisos();
  const iconosTipo = { agua: '💧', luz: '💡', gas: '🔥', limpieza: '🧹', general: '📢' };

  if (avisos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="megaphone" style="width:24px;height:24px;"></i></div>
        <p class="empty-state-title">Sin avisos</p>
      </div>
    `;
    initIcons();
    return;
  }

  container.innerHTML = avisos.map(av => `
    <div class="aviso-card tipo-${av.tipo}">
      <div class="aviso-meta">
        <span class="aviso-tipo-badge">${iconosTipo[av.tipo] || '📢'} ${av.tipo}</span>
        <span class="aviso-date">${formatearFecha(av.fecha)}</span>
      </div>
      <div class="aviso-title">${av.titulo}</div>
      <div class="aviso-body">${av.cuerpo}</div>
    </div>
  `).join('');
}

// ============================================================
// EXPENSAS — VISTA INQUILINO
// ============================================================

function renderExpensasTenant() {
  const container = document.getElementById('tenantExpensasList');
  if (!container) return;

  const inq = inquilinoActual;
  // Expensas del storage (creadas por admin)
  const expensas = getExpensasByInquilino(inq.id);

  if (expensas.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="building-2" style="width:24px;height:24px;"></i></div>
        <p class="empty-state-title">Sin expensas registradas</p>
        <p class="empty-state-text">El administrador aún no ha cargado expensas para tu unidad</p>
      </div>
    `;
    initIcons();
    return;
  }

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-4);">
      ${expensas.map(e => {
        const { texto: vt, urgencia: vu } = textoVencimiento(e.vencimiento);
        const pagada = e.estadoInquilino === 'pagado';
        return `
          <div class="card" style="border-left:4px solid ${e.tipo === 'extraordinaria' ? '#f59e0b' : '#6366f1'};">
            <div class="card__header">
              <div>
                <span class="card__title">${e.tipo === 'ordinaria' ? '🏢 Ordinaria' : '⭐ Extraordinaria'}</span>
                ${e.descripcion ? `<div style="font-size:0.8125rem;color:var(--text-muted);margin-top:3px;">${e.descripcion}</div>` : ''}
              </div>
              ${pagada
                ? '<span class="badge badge--success">✓ Pagada</span>'
                : `<span class="badge badge--${vu}">${vt}</span>`
              }
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:var(--space-3);">
              <div style="font-family:var(--font-heading);font-size:1.5rem;font-weight:700;">${formatearPesos(e.monto)}</div>
              <div style="display:flex;gap:var(--space-2);align-items:center;">
                ${e.comprobante ? `<a href="${e.comprobante}" target="_blank" class="btn btn--sm btn--ghost"><i data-lucide="download" style="width:14px;height:14px;"></i> Comprobante</a>` : ''}
                ${!pagada
                  ? `<button class="btn btn--sm btn--primary" onclick="marcarExpensaPagada('${e.id}')">Marcar pagada</button>`
                  : ''
                }
              </div>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:var(--space-2);">Cargada el ${formatearFecha(e.fecha)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  initIcons();
}

function marcarExpensaPagada(id) {
  updateExpensa(id, { estadoInquilino: 'pagado' });
  showToast('✔ Expensa marcada como pagada', 'success');
  renderExpensasTenant();
}

// ============================================================
// SERVICIOS PERSONALES — VISTA INQUILINO
// ============================================================

const TIPOS_SERVICIO = {
  luz:      { emoji: '💡', label: 'Luz' },
  agua:     { emoji: '💧', label: 'Agua' },
  gas:      { emoji: '🔥', label: 'Gas' },
  internet: { emoji: '📶', label: 'Internet' },
  otro:     { emoji: '📌', label: 'Otro' },
};

function renderServiciosPersonales() {
  const container = document.getElementById('serviciosPersonalesList');
  if (!container) return;

  const servicios = getServiciosByInquilino(inquilinoActual.id);

  if (servicios.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="zap" style="width:24px;height:24px;"></i></div>
        <p class="empty-state-title">Sin servicios registrados</p>
        <p class="empty-state-text">Agregá tus servicios (luz, agua, gas, internet) para llevar un control personal de pagos y vencimientos</p>
      </div>
    `;
    initIcons();
    return;
  }

  // Ordenar: pendientes/atrasados primero
  const ordenados = [...servicios].sort((a, b) => {
    const urgA = a.estado !== 'pagado' ? diasHasta(a.vencimiento) : 999;
    const urgB = b.estado !== 'pagado' ? diasHasta(b.vencimiento) : 999;
    return urgA - urgB;
  });

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-4);">
      ${ordenados.map(s => {
        const tipoInfo  = TIPOS_SERVICIO[s.tipo] || TIPOS_SERVICIO.otro;
        const { texto: vt, urgencia: vu } = s.vencimiento ? textoVencimiento(s.vencimiento) : { texto: '', urgencia: 'neutral' };
        const pagado = s.estado === 'pagado';
        return `
          <div class="card servicio-personal-card ${pagado ? 'servicio-pagado' : ''}">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3);">
              <div style="display:flex;align-items:center;gap:var(--space-2);">
                <span style="font-size:1.5rem;">${tipoInfo.emoji}</span>
                <div>
                  <div style="font-weight:600;font-size:0.9375rem;">${s.nombre || tipoInfo.label}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;">${tipoInfo.label}</div>
                </div>
              </div>
              ${pagado
                ? '<span class="badge badge--success">✓ Pagado</span>'
                : `<span class="badge badge--${vu}">${vt}</span>`
              }
            </div>
            <div style="font-family:var(--font-heading);font-size:1.375rem;font-weight:700;margin-bottom:var(--space-3);">${formatearPesos(s.monto)}</div>
            ${s.comprobante ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:var(--space-3);">📎 ${s.comprobante}</div>` : ''}
            <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;">
              ${!pagado
                ? `<button class="btn btn--sm btn--primary" onclick="marcarServicioPagado('${s.id}')">
                     <i data-lucide="check" style="width:13px;height:13px;"></i> Marcar pagado
                   </button>`
                : `<button class="btn btn--sm btn--ghost" onclick="reabrirServicio('${s.id}')">
                     <i data-lucide="rotate-ccw" style="width:13px;height:13px;"></i> Reabrir
                   </button>`
              }
              <button class="btn btn--sm btn--ghost" onclick="editarServicio('${s.id}')">
                <i data-lucide="pencil" style="width:13px;height:13px;"></i>
              </button>
              <button class="btn btn--sm btn--ghost" style="color:var(--color-danger);" onclick="eliminarServicio('${s.id}')">
                <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  initIcons();

  // Setup del modal al abrir
  setupModalServicio();
}

function setupModalServicio() {
  const btn = document.getElementById('btnGuardarServicio');
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', guardarServicio);
}

// Resetear form al abrir modal de nuevo servicio
document.addEventListener('click', function(e) {
  const btn = e.target.closest('[onclick*="openModal(\'modalServicio\')"]');
  if (btn) {
    limpiarFormServicio();
    setTimeout(setupModalServicio, 50);
  }
});

function guardarServicio() {
  const id          = document.getElementById('servicioEditId').value;
  const tipo        = document.getElementById('servicioTipo').value;
  const nombre      = document.getElementById('servicioNombre').value.trim();
  const monto       = parseFloat(document.getElementById('servicioMonto').value);
  const vencimiento = document.getElementById('servicioVencimiento').value;
  const comprobante = document.getElementById('servicioComprobante').value.trim();

  if (!tipo || !monto || !vencimiento) {
    showToast('Completá tipo, monto y vencimiento', 'warning');
    return;
  }

  const data = {
    inquilinoId: inquilinoActual.id,
    tipo,
    nombre: nombre || TIPOS_SERVICIO[tipo]?.label || tipo,
    monto,
    vencimiento,
    comprobante: comprobante || null,
  };

  if (id) {
    updateServicioPersonal(id, data);
    showToast('✔ Servicio actualizado', 'success');
  } else {
    createServicioPersonal(data);
    showToast('✔ Servicio agregado', 'success');
  }

  closeModal('modalServicio');
  limpiarFormServicio();
  renderServiciosPersonales();
}

function limpiarFormServicio() {
  document.getElementById('servicioEditId').value   = '';
  document.getElementById('servicioNombre').value   = '';
  document.getElementById('servicioMonto').value    = '';
  document.getElementById('servicioVencimiento').value = '';
  document.getElementById('servicioComprobante').value = '';
  document.getElementById('servicioTipo').value     = 'luz';
  document.getElementById('modalServicioTitle').textContent = 'Agregar servicio';
  const btn = document.getElementById('btnGuardarServicio');
  if (btn) delete btn.dataset.bound;
}

function editarServicio(id) {
  const s = getServiciosByInquilino(inquilinoActual.id).find(x => x.id === id);
  if (!s) return;
  document.getElementById('servicioEditId').value       = s.id;
  document.getElementById('servicioTipo').value         = s.tipo;
  document.getElementById('servicioNombre').value       = s.nombre || '';
  document.getElementById('servicioMonto').value        = s.monto;
  document.getElementById('servicioVencimiento').value  = s.vencimiento || '';
  document.getElementById('servicioComprobante').value  = s.comprobante || '';
  document.getElementById('modalServicioTitle').textContent = 'Editar servicio';
  const btn = document.getElementById('btnGuardarServicio');
  if (btn) delete btn.dataset.bound;
  openModal('modalServicio');
  setupModalServicio();
}

function marcarServicioPagado(id) {
  updateServicioPersonal(id, { estado: 'pagado' });
  showToast('✔ Servicio marcado como pagado', 'success');
  renderServiciosPersonales();
}

function reabrirServicio(id) {
  updateServicioPersonal(id, { estado: 'pendiente' });
  showToast('Servicio reabierto como pendiente', 'info');
  renderServiciosPersonales();
}

function eliminarServicio(id) {
  if (!confirm('¿Eliminar este servicio?')) return;
  deleteServicioPersonal(id);
  showToast('Servicio eliminado', 'info');
  renderServiciosPersonales();
}


// ============================================================
// MI CONTRATO — PANEL INQUILINO (solo lectura + descarga)
// ============================================================

function renderContratoTenant() {
  if (!inquilinoActual) return;
  const zona = document.getElementById('zonaContratoTenant');
  if (!zona) return;

  if (typeof renderContratoWidget !== 'function') {
    zona.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem;">Sistema de contratos no disponible.</p>';
    return;
  }

  renderContratoWidget('zonaContratoTenant', {
    containerId:     'zonaContratoTenant',
    entidadId:       inquilinoActual.id,
    tipo:            'inquilino',
    usuarioActual:   inquilinoActual.nombre + ' ' + inquilinoActual.apellido,
    usuarioActualId: inquilinoActual.id,
    puedeModificar:  false,   // el inquilino NO puede solicitar modificaciones
    emailEntidad:    inquilinoActual.email,
  });
}
