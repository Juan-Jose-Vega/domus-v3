/*
  ============================================================
  superadmin.js — Panel SuperAdmin
  ============================================================
  El superadmin es el dueño de la plataforma RentaAdmin.
  Puede gestionar cuentas de admin, ver estadísticas globales
  y controlar planes.

  SECCIONES:
    - dashboard: cards globales + actividad reciente + gráfico
    - admins:    tabla CRUD de administradores con planes
    - planes:    info visual de planes

  FLUJO:
    1. requireAuth('superadmin') verifica sesión
    2. initSidebar() configura la navegación
    3. navigateTo() renderiza la sección activa
    4. Cada sección tiene su propia función render*()
  ============================================================
*/

// ============================================================
// INICIALIZACIÓN
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('[SuperAdmin] Inicializando...');

  // Verificar que sea superadmin; si no, redirige
  const sesion = requireAuth('superadmin');
  if (!sesion) return;

  // Mostrar datos del superadmin en sidebar
  document.getElementById('saName').textContent   = sesion.nombre;
  document.getElementById('saAvatar').textContent = sesion.avatar || 'SA';

  initIcons();
  initSidebar();
  initTopbar();
  initNotifications();
  navigateTo('dashboard');   // sección inicial

  console.log('[SuperAdmin] Panel listo.');
});

// ============================================================
// SIDEBAR
// ============================================================

function initSidebar() {
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const toggleBtn      = document.getElementById('sidebarToggle');
  const hamburger      = document.getElementById('hamburger');

  // Colapsar sidebar (desktop)
  toggleBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    initIcons();
  });

  // Hamburguesa mobile
  hamburger?.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
    sidebarOverlay?.classList.toggle('active');
  });

  sidebarOverlay?.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    sidebarOverlay.classList.remove('active');
  });

  // Items de navegación
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

const SECTION_TITLES = {
  dashboard:    { title: 'Dashboard',            sub: 'Vista global de la plataforma' },
  admins:       { title: 'Administradores',       sub: 'Gestión de cuentas y planes' },
  planes:       { title: 'Planes',               sub: 'Configuración de planes disponibles' },
  'reclamos-sa':{ title: 'Reclamos de Admins',   sub: 'Consultas técnicas y administrativas' },
  desactivados: { title: 'Usuarios Desactivados', sub: 'Admins e inquilinos dados de baja' },
};

function navigateTo(sectionId) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

  const target = document.getElementById('section-' + sectionId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-section') === sectionId);
  });

  const info = SECTION_TITLES[sectionId] || { title: sectionId, sub: '' };
  const titleEl = document.getElementById('topbarTitle');
  const subEl   = document.getElementById('topbarSubtitle');
  if (titleEl) titleEl.textContent = info.title;
  if (subEl)   subEl.textContent   = info.sub;

  switch (sectionId) {
    case 'dashboard':    renderDashboard();         break;
    case 'admins':       renderAdmins();            break;
    case 'planes':       renderPlanes();            break;
    case 'reclamos-sa':  renderReclamosSA();        break;
    case 'desactivados': renderDesactivadosSA();    break;
  }
}

// ============================================================
// SECCIÓN: DASHBOARD
// ============================================================

function renderDashboard() {
  const admins     = getAdmins();
  const reclamos   = getReclamos();
  const pagos      = getPagos();

  // ---- Calcular métricas globales ----
  const adminsActivos     = admins.filter(a => a.estado === 'activo').length;
  const adminsSuspendidos = admins.filter(a => a.estado === 'suspendido').length;
  // Reclamos pendientes: tanto los de inquilinos como los de admins a superadmin
  const reclamosPendientes = reclamos.filter(r => r.estado === 'pendiente').length
    + getReclamosSA().filter(r => r.estado === 'pendiente').length;

  // Ingresos: suma de todos los pagos acreditados (simulado como 10% del total va a la plataforma)
  const ingresoTotal = pagos
    .filter(p => p.estado === 'acreditado')
    .reduce((sum, p) => sum + p.monto, 0);

  // ---- Renderizar stat cards ----
  setEl('saStatAdmins',      adminsActivos);
  setEl('saStatIngresos',    formatearPesos(Math.round(ingresoTotal * 0.1)));
  setEl('saStatReclamos',    reclamosPendientes);
  setEl('saStatSuspendidos', adminsSuspendidos);

  // ---- Badge de reclamos SA en sidebar ----
  actualizarBadgeReclamosSA();

  // ---- Actividad reciente ----
  renderActividad();

  // ---- Mini tabla de admins ----
  renderMiniAdmins();

  // ---- Gráfico de distribución de planes ----
  renderPlanesChart(admins);

  initIcons();
}

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/** Renderiza el feed de actividad reciente */
function renderActividad() {
  const container = document.getElementById('actividadList');
  if (!container) return;

  const actividad = getActividad();

  // Íconos según tipo de actividad
  const iconosTipo = {
    pago:      { icono: 'banknote',     color: 'var(--color-success)' },
    inquilino: { icono: 'user-plus',    color: 'var(--color-info)' },
    reclamo:   { icono: 'message-square-warning', color: 'var(--color-warning)' },
    aviso:     { icono: 'megaphone',    color: 'var(--color-primary)' },
    admin:     { icono: 'shield-check', color: 'var(--color-secondary)' },
    general:   { icono: 'activity',     color: 'var(--text-muted)' },
  };

  if (actividad.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted);font-size:0.875rem;padding:var(--space-4);">Sin actividad reciente</p>`;
    return;
  }

  container.innerHTML = actividad.slice(0, 8).map(act => {
    const tipo = iconosTipo[act.tipo] || iconosTipo.general;
    return `
      <div style="display:flex;align-items:flex-start;gap:var(--space-3);padding:var(--space-3) 0;border-bottom:1px solid var(--border-subtle);">
        <!-- Ícono de tipo -->
        <div style="
          width:32px;height:32px;border-radius:50%;
          background:rgba(255,255,255,0.05);
          display:flex;align-items:center;justify-content:center;
          flex-shrink:0;color:${tipo.color};
        ">
          <i data-lucide="${tipo.icono}" style="width:14px;height:14px;"></i>
        </div>
        <!-- Info -->
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.875rem;font-weight:500;">
            <span style="color:var(--color-primary-light);">${act.adminNombre}</span>
            ${act.accion}
          </div>
          ${act.detalle ? `<div style="font-size:0.8125rem;color:var(--text-muted);margin-top:2px;">${act.detalle}</div>` : ''}
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:3px;">${tiempoRelativo(act.fecha)}${act.hora ? ' · ' + act.hora : ''}</div>
        </div>
      </div>
    `;
  }).join('');

  initIcons();
}

/** Mini tabla de admins en el dashboard */
function renderMiniAdmins() {
  const container = document.getElementById('miniAdminsList');
  if (!container) return;

  const admins = getAdmins().filter(a => a.estado !== 'inactivo').slice(0, 5);

  container.innerHTML = admins.map(a => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-subtle);">
      <div style="
        width:34px;height:34px;border-radius:50%;flex-shrink:0;
        background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));
        display:flex;align-items:center;justify-content:center;
        font-weight:700;font-size:0.8125rem;color:white;
      ">${a.avatar || '?'}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:500;font-size:0.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.nombre}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);">${a.empresa || a.email}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        ${badgePlan(a.plan)}
        ${badgeEstadoAdmin(a.estado)}
      </div>
    </div>
  `).join('');
}

/** Gráfico de barras CSS simple para distribución de planes */
function renderPlanesChart(admins) {
  const container = document.getElementById('planesChartBars');
  if (!container) return;

  const total = admins.length || 1;
  const grupos = [
    { label: 'Básico',  key: 'basico',  color: 'var(--text-muted)' },
    { label: 'Pro',     key: 'pro',     color: 'var(--color-info)' },
    { label: 'Premium', key: 'premium', color: 'var(--color-success)' },
  ];

  container.innerHTML = grupos.map(g => {
    const count = admins.filter(a => a.plan === g.key).length;
    const pct   = Math.round((count / total) * 100);
    return `
      <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3);">
        <div style="width:70px;font-size:0.8125rem;color:var(--text-secondary);">${g.label}</div>
        <div style="flex:1;height:8px;background:var(--bg-elevated);border-radius:99px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${g.color};border-radius:99px;transition:width 1s ease;"></div>
        </div>
        <div style="width:40px;text-align:right;font-size:0.8125rem;font-weight:600;color:var(--text-secondary);">${count}</div>
      </div>
    `;
  }).join('');
}

// ============================================================
// SECCIÓN: GESTIÓN DE ADMINS
// ============================================================

function renderAdmins() {
  setupAdminFilters();
  renderAdminTable();
  setupAdminForm();
}

function setupAdminFilters() {
  const searchInput = document.getElementById('searchAdmin');
  const filterPlan  = document.getElementById('filterPlan');
  const filterEst   = document.getElementById('filterEstadoAdmin');

  searchInput?.addEventListener('input', () => renderAdminTable());
  filterPlan?.addEventListener('change',  () => renderAdminTable());
  filterEst?.addEventListener('change',   () => renderAdminTable());

  document.getElementById('btnNuevoAdmin')?.addEventListener('click', () => openAdminModal(null));
}

/** Renderiza la tabla de admins con filtros */
function renderAdminTable() {
  const tbody       = document.getElementById('adminTbody');
  if (!tbody) return;

  const busqueda    = document.getElementById('searchAdmin')?.value.toLowerCase() || '';
  const filtroPlan  = document.getElementById('filterPlan')?.value || 'todos';
  const filtroEst   = document.getElementById('filterEstadoAdmin')?.value || 'todos';

  // Excluir inactivos y ocultos de la tabla
  let admins = getAdmins().filter(a => a.estado !== 'inactivo' && a.estado !== 'oculto');

  // Aplicar filtros
  if (busqueda)               admins = admins.filter(a => a.nombre.toLowerCase().includes(busqueda) || a.email.toLowerCase().includes(busqueda));
  if (filtroPlan !== 'todos') admins = admins.filter(a => a.plan === filtroPlan);
  if (filtroEst  !== 'todos') admins = admins.filter(a => a.estado === filtroEst);

  if (admins.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">No se encontraron administradores</td></tr>`;
    return;
  }

  // Obtener count de inquilinos por admin
  const allInq = getInquilinos().filter(i => i.activo);

  tbody.innerHTML = admins.map(a => {
    const inqCount = allInq.filter(i => i.adminId === a.id).length;
    const limites  = { basico: 5, pro: 30, premium: Infinity };
    const limite   = limites[a.plan] || 5;
    const pct      = limite === Infinity ? 10 : Math.round((inqCount / limite) * 100);

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="
              width:36px;height:36px;border-radius:50%;flex-shrink:0;
              background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));
              display:flex;align-items:center;justify-content:center;
              font-weight:700;font-size:0.8125rem;color:white;
            ">${a.avatar || '?'}</div>
            <div>
              <div style="font-weight:500;">${a.nombre}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">${a.email}</div>
            </div>
          </div>
        </td>
        <td>${badgePlan(a.plan)}</td>
        <td>${badgeEstadoAdmin(a.estado)}</td>
        <td>
          <div style="min-width:100px;">
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">${inqCount} / ${limite === Infinity ? '∞' : limite}</div>
            <div style="height:5px;background:var(--bg-elevated);border-radius:99px;overflow:hidden;">
              <div style="height:100%;width:${Math.min(pct,100)}%;background:${pct >= 90 ? 'var(--color-danger)' : 'var(--color-primary)'};border-radius:99px;"></div>
            </div>
          </div>
        </td>
        <td style="font-size:0.8125rem;color:var(--text-muted);">${formatearFecha(a.fechaAlta)}</td>
        <td>
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            <button class="btn btn--sm btn--secondary" onclick="openAdminModal('${a.id}')" title="Editar">
              <i data-lucide="edit-2" style="width:13px;height:13px;"></i>
            </button>
            <button class="btn btn--sm btn--secondary" onclick="toggleAdmin('${a.id}')" title="${a.estado === 'activo' ? 'Suspender' : 'Activar'}">
              <i data-lucide="${a.estado === 'activo' ? 'pause-circle' : 'play-circle'}" style="width:13px;height:13px;"></i>
            </button>
            <button class="btn btn--sm btn--secondary" onclick="openResetPassword('${a.id}', 'admin')" title="Restablecer contraseña">
              <i data-lucide="key-round" style="width:13px;height:13px;"></i>
            </button>
            <button class="btn btn--sm btn--secondary" onclick="ocultarAdmin('${a.id}', '${a.nombre}')" title="Ocultar" style="color:var(--color-info);">
              <i data-lucide="eye-off" style="width:13px;height:13px;"></i>
            </button>
            <button class="btn btn--sm btn--secondary" onclick="desactivarAdmin('${a.id}', '${a.nombre}')" title="Desactivar" style="color:var(--color-danger);">
              <i data-lucide="user-x" style="width:13px;height:13px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  initIcons();
}

/** Suspende o activa un admin */
function toggleAdmin(id) {
  const nuevoEstado = toggleAdminEstado(id);
  const admin = getAdminById(id);
  showToast(
    `${admin?.nombre || 'Admin'} ${nuevoEstado === 'activo' ? 'activado' : 'suspendido'}`,
    nuevoEstado === 'activo' ? 'success' : 'warning'
  );
  renderAdminTable();
}

function ocultarAdmin(id, nombre) {
  if (confirm(`¿Ocultar a ${nombre}? No aparecerá en los listados activos pero sus datos se conservan.`)) {
    updateAdmin(id, { estado: 'oculto' });
    renderAdminTable();
    showToast(`${nombre} ocultado`, 'info');
  }
}

function desactivarAdmin(id, nombre) {
  const motivo = prompt(`Motivo de desactivación para ${nombre} (opcional):`);
  if (motivo === null) return; // canceló
  const admin = getAdminById(id);
  deleteAdmin(id); // soft delete: pone estado='inactivo'
  // Mover al panel de desactivados
  if (admin?.usuarioId) {
    const usuarios = storageGet(STORAGE_KEYS.USUARIOS, []);
    storageSet(STORAGE_KEYS.USUARIOS, usuarios.map(u =>
      u.id === admin.usuarioId ? { ...u, activo: false } : u
    ));
    moverADesactivados({
      id:     admin.usuarioId,
      nombre: admin.nombre,
      rol:    'admin',
      email:  admin.email,
      motivo: motivo || ''
    });
  }
  renderAdminTable();
  showToast(`${nombre} desactivado`, 'danger');
}

/** Mantenida por compatibilidad */
function confirmarEliminarAdmin(id, nombre) {
  desactivarAdmin(id, nombre);
}

// ============================================================
// MODAL CREAR / EDITAR ADMIN
// ============================================================

function setupAdminForm() {
  const btnSave   = document.getElementById('btnGuardarAdmin');
  const btnCancel = document.getElementById('btnCancelarAdmin');
  // Evitar doble binding en re-opens del modal
  if (btnSave && !btnSave.dataset.bound) {
    btnSave.dataset.bound = '1';
    btnSave.addEventListener('click', guardarAdmin);
  }
  if (btnCancel && !btnCancel.dataset.bound) {
    btnCancel.dataset.bound = '1';
    btnCancel.addEventListener('click', () => closeModal('modalAdmin'));
  }
}

function openAdminModal(id) {
  const admin = id ? getAdminById(id) : null;
  document.getElementById('modalAdminTitle').textContent = admin ? 'Editar Administrador' : 'Nuevo Administrador';

  document.getElementById('adminNombre').value   = admin?.nombre   || '';
  document.getElementById('adminEmail').value    = admin?.email    || '';
  const dniField = document.getElementById('adminDni');
  if (dniField) dniField.value = admin?.dni || '';
  document.getElementById('adminTelefono').value = admin?.telefono || '';
  document.getElementById('adminEmpresa').value  = admin?.empresa  || '';
  document.getElementById('adminPlan').value     = admin?.plan     || 'basico';
  const fechaInicioEl = document.getElementById('adminFechaInicio');
  if (fechaInicioEl) fechaInicioEl.value = admin?.fechaInicioContrato || new Date().toISOString().split('T')[0];

  // Campo contraseña solo en creación
  const passGroup = document.getElementById('adminPassGroup');
  if (passGroup) passGroup.style.display = id ? 'none' : 'block';

  document.getElementById('btnGuardarAdmin').setAttribute('data-id', id || '');
  openModal('modalAdmin');

  // ── Widget de contratos (solo en edición de admin existente) ──
  const zonaContrato = document.getElementById('zonaContratoAdminModal');
  if (zonaContrato) {
    if (id && typeof renderContratoWidget === 'function') {
      const adminObj = getAdminById(id);
      zonaContrato.style.display = 'block';
      renderContratoWidget('zonaContratoAdminModal', {
        containerId:     'zonaContratoAdminModal',
        entidadId:       id,
        tipo:            'admin',
        usuarioActual:   'SuperAdmin',
        usuarioActualId: 'u000',
        puedeModificar:  true,
        emailEntidad:    adminObj?.email || '(email registrado)',
      });
    } else if (!id) {
      zonaContrato.style.display = 'block';
      zonaContrato.innerHTML = '<p style="font-size:0.8125rem;color:var(--text-secondary);">Podés adjuntar el contrato del administrador después de crearlo.</p>';
    } else {
      zonaContrato.style.display = 'none';
    }
  }
}

function guardarAdmin() {
  const id              = document.getElementById('btnGuardarAdmin').getAttribute('data-id');
  const nombre          = document.getElementById('adminNombre').value.trim();
  const email           = document.getElementById('adminEmail').value.trim();
  const dni             = document.getElementById('adminDni')?.value.trim() || '';
  const telefono        = document.getElementById('adminTelefono').value.trim();
  const empresa         = document.getElementById('adminEmpresa').value.trim();
  const plan            = document.getElementById('adminPlan').value;
  const password        = document.getElementById('adminPassword')?.value.trim();
  const fechaInicioContrato = document.getElementById('adminFechaInicio')?.value || new Date().toISOString().split('T')[0];

  if (!nombre || !email) {
    showToast('Nombre y email son obligatorios', 'warning');
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

  if (id) {
    const usuarios    = storageGet(STORAGE_KEYS.USUARIOS, []);
    const adminActual = getAdminById(id);
    const emailOcupado = usuarios.some(u =>
      u.activo &&
      u.email.toLowerCase() === email.toLowerCase() &&
      u.id !== adminActual?.usuarioId
    );
    if (emailOcupado) { showToast('El correo ya está en uso por otro usuario', 'danger'); return; }
    if (dni) {
      const dniOcupado = usuarios.some(u =>
        u.activo && u.dni && u.dni === dni && u.id !== adminActual?.usuarioId
      );
      if (dniOcupado) { showToast('El DNI ya está registrado en otro usuario', 'danger'); return; }
    }
    updateAdmin(id, { nombre, email, dni, telefono, empresa, plan, fechaInicioContrato });
    showToast('Administrador actualizado', 'success');
  } else {
    if (!password || password.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres', 'warning');
      return;
    }
    const resultado = createAdmin({ nombre, email, dni, telefono, empresa, plan, password, fechaInicioContrato });
    if (resultado && resultado.error) {
      showToast(resultado.error, 'danger');
      return;
    }
    showToast('Administrador creado correctamente', 'success');
  }

  closeModal('modalAdmin');
  renderAdminTable();

  // Reset zona de contrato para la próxima apertura del modal
  const zonaContrato = document.getElementById('zonaContratoAdminModal');
  if (zonaContrato) {
    zonaContrato.style.display = 'none';
    zonaContrato.innerHTML = '';
  }
}

// ============================================================
// MODAL RESTABLECER CONTRASEÑA
// ============================================================

// Variable para rastrear qué entidad se está reseteando
let resetTarget = { id: null, tipo: null };

/**
 * Abre el modal de reseteo de contraseña.
 * @param {string} id   - ID del admin o inquilino
 * @param {string} tipo - 'admin' | 'inquilino'
 */
function openResetPassword(id, tipo) {
  resetTarget = { id, tipo };

  const entidad = tipo === 'admin' ? getAdminById(id) : getInquilinoById(id);
  const nombre  = tipo === 'admin' ? entidad?.nombre : `${entidad?.nombre} ${entidad?.apellido}`;

  document.getElementById('resetPassNombre').textContent = nombre || 'Usuario';
  document.getElementById('resetPassInput').value = '';

  openModal('modalResetPass');

  // Registrar listener del botón guardar
  document.getElementById('btnGuardarReset').onclick = ejecutarReset;
  document.getElementById('btnCancelarReset').onclick = () => closeModal('modalResetPass');
}

function ejecutarReset() {
  const newPass = document.getElementById('resetPassInput').value.trim();

  if (!newPass || newPass.length < 6) {
    showToast('La contraseña debe tener al menos 6 caracteres', 'warning');
    return;
  }

  let exito = false;
  if (resetTarget.tipo === 'admin') {
    exito = resetPasswordAdmin(resetTarget.id, newPass);
  } else {
    exito = resetPasswordInquilino(resetTarget.id, newPass);
  }

  if (exito) {
    showToast('✔ Contraseña restablecida correctamente', 'success');
    closeModal('modalResetPass');
  } else {
    showToast('No se pudo restablecer la contraseña', 'danger');
  }
}

// ============================================================
// SECCIÓN: PLANES
// ============================================================

function renderPlanes() {
  const admins    = getAdmins().filter(a => a.estado !== 'inactivo' && a.estado !== 'oculto');
  const allInq    = getInquilinos().filter(i => i.activo);
  const limites   = { basico: 5, pro: 30, premium: Infinity };
  const planLabel = { basico: '⬡ Básico', pro: '◈ Pro', premium: '★ Premium' };

  // Actualizar contadores de admins por plan en las cards
  const counts = {
    basico:  admins.filter(a => a.plan === 'basico').length,
    pro:     admins.filter(a => a.plan === 'pro').length,
    premium: admins.filter(a => a.plan === 'premium').length,
  };
  ['basico', 'pro', 'premium'].forEach(plan => {
    const el = document.getElementById(`planCount_${plan}`);
    if (el) el.textContent = `${counts[plan]} admin${counts[plan] !== 1 ? 's' : ''} activos`;
  });

  // ---- Tabla de inquilinos por admin ----
  const container = document.getElementById('inqPorAdminList');
  if (!container) return;

  if (admins.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted);padding:var(--space-4);">No hay administradores activos.</p>`;
    return;
  }

  container.innerHTML = admins.map(a => {
    const limite   = limites[a.plan] ?? 5;
    const usados   = allInq.filter(i => i.adminId === a.id).length;
    const pct      = limite === Infinity ? Math.min(usados * 2, 100) : Math.round((usados / limite) * 100);
    const color    = pct >= 90 ? 'var(--color-danger)' : pct >= 70 ? 'var(--color-warning)' : 'var(--color-primary)';
    const limStr   = limite === Infinity ? '∞' : limite;

    return `
      <div class="reclamo-card" style="display:flex;align-items:center;gap:var(--space-4);flex-wrap:wrap;">
        <div style="width:38px;height:38px;border-radius:50%;flex-shrink:0;
          background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));
          display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8125rem;color:white;">
          ${a.avatar || getIniciales(a.nombre, '')}
        </div>
        <div style="flex:1;min-width:160px;">
          <div style="font-weight:600;">${a.nombre}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">${a.empresa || a.email}</div>
        </div>
        <div style="flex:1;min-width:180px;">
          <div style="display:flex;justify-content:space-between;font-size:0.8125rem;margin-bottom:4px;">
            <span>${planLabel[a.plan] || a.plan}</span>
            <span style="font-weight:600;">${usados} / ${limStr} inquilinos</span>
          </div>
          <div style="height:6px;background:var(--bg-elevated);border-radius:99px;overflow:hidden;">
            <div style="height:100%;width:${Math.min(pct,100)}%;background:${color};border-radius:99px;transition:width .8s ease;"></div>
          </div>
        </div>
        ${badgePlan(a.plan)}
      </div>
    `;
  }).join('');

  initIcons();
}

// ============================================================
// SECCIÓN: RECLAMOS ADMINS → SUPERADMIN
// ============================================================

/** Actualiza el badge de reclamos pendientes en el sidebar */
function actualizarBadgeReclamosSA() {
  const badge = document.getElementById('saBadgeReclamos');
  if (!badge) return;
  const pendientes = getReclamosSA().filter(r => r.estado === 'pendiente').length;
  if (pendientes > 0) {
    badge.textContent = pendientes;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

const CATEGORIAS_SA = {
  bug:      { label: 'Bug / Error del sistema', color: 'var(--color-danger)',  icon: 'bug' },
  consulta: { label: 'Consulta administrativa', color: 'var(--color-info)',    icon: 'help-circle' },
  tecnico:  { label: 'Problema técnico',         color: 'var(--color-warning)', icon: 'wrench' },
  otro:     { label: 'Otro',                     color: 'var(--text-muted)',    icon: 'message-circle' },
};

function renderReclamosSA() {
  const container = document.getElementById('reclamosSAList');
  if (!container) return;

  // Filtros
  const filtroEstado    = document.getElementById('filterReclamoSAEstado')?.value    || 'todos';
  const filtroCategoria = document.getElementById('filterReclamoSACategoria')?.value || 'todas';

  // Registrar listeners de filtros (solo la primera vez)
  document.getElementById('filterReclamoSAEstado')?.addEventListener('change',    renderReclamosSA);
  document.getElementById('filterReclamoSACategoria')?.addEventListener('change', renderReclamosSA);

  let reclamos = getReclamosSA();
  if (filtroEstado    !== 'todos')  reclamos = reclamos.filter(r => r.estado    === filtroEstado);
  if (filtroCategoria !== 'todas')  reclamos = reclamos.filter(r => r.categoria === filtroCategoria);

  actualizarBadgeReclamosSA();

  if (reclamos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="inbox" style="width:24px;height:24px;"></i></div>
        <p class="empty-state-title">Sin reclamos</p>
        <p class="empty-state-text">No hay reclamos de administradores en este momento</p>
      </div>`;
    initIcons();
    return;
  }

  const estadoBadge = {
    pendiente:   '<span class="badge badge--warning">Pendiente</span>',
    respondido:  '<span class="badge badge--info">Respondido</span>',
    resuelto:    '<span class="badge badge--success">Resuelto</span>',
  };

  container.innerHTML = reclamos.map(r => {
    const cat    = CATEGORIAS_SA[r.categoria] || CATEGORIAS_SA.otro;
    const admin  = getAdminById(r.adminId);
    const nombre = admin ? admin.nombre : r.adminNombre || 'Admin desconocido';

    return `
      <div class="reclamo-card">
        <div class="reclamo-header">
          <div style="display:flex;align-items:flex-start;gap:var(--space-3);flex:1;">
            <div style="width:38px;height:38px;border-radius:50%;flex-shrink:0;
              background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));
              display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8125rem;color:white;">
              ${getIniciales(nombre, '')}
            </div>
            <div>
              <div class="reclamo-title">${r.titulo}</div>
              <div class="reclamo-category" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="color:${cat.color};display:flex;align-items:center;gap:3px;">
                  <i data-lucide="${cat.icon}" style="width:11px;height:11px;"></i> ${cat.label}
                </span>
                · <strong>${nombre}</strong>
                ${admin?.empresa ? `· ${admin.empresa}` : ''}
              </div>
            </div>
          </div>
          ${estadoBadge[r.estado] || ''}
        </div>

        <p class="reclamo-description">${r.descripcion}</p>

        ${r.respuesta ? `
          <div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:10px 14px;margin-bottom:12px;font-size:0.875rem;">
            <span style="font-weight:600;color:var(--color-info);">✔ Respuesta SuperAdmin: </span>${r.respuesta}
            ${r.fechaRespuesta ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:3px;">${formatearFecha(r.fechaRespuesta)}</div>` : ''}
          </div>
        ` : ''}

        <div class="reclamo-footer">
          <span style="font-size:0.8125rem;color:var(--text-muted);">${tiempoRelativo(r.fecha)}</span>
          <div style="display:flex;gap:var(--space-2);">
            <button class="btn btn--sm btn--primary" onclick="abrirResponderReclamoSA('${r.id}')">
              <i data-lucide="reply" style="width:13px;height:13px;"></i>
              ${r.respuesta ? 'Modificar respuesta' : 'Responder'}
            </button>
            <select class="filter-select" style="padding:5px 10px;font-size:0.8125rem;"
              onchange="cambiarEstadoReclamoSA('${r.id}', this.value)">
              <option value="pendiente"  ${r.estado==='pendiente'  ? 'selected':''}>Pendiente</option>
              <option value="respondido" ${r.estado==='respondido' ? 'selected':''}>Respondido</option>
              <option value="resuelto"   ${r.estado==='resuelto'   ? 'selected':''}>Resuelto</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }).join('');

  initIcons();
}

let reclamoSAActivoId = null;

function abrirResponderReclamoSA(id) {
  reclamoSAActivoId = id;
  const r     = getReclamosSA().find(r => r.id === id);
  if (!r) return;
  const admin = getAdminById(r.adminId);

  document.getElementById('rsaAdminNombre').textContent = admin ? admin.nombre : r.adminNombre || '—';
  document.getElementById('rsaDetalleTitulo').textContent = r.titulo;
  document.getElementById('rsaRespuestaInput').value = r.respuesta || '';
  document.getElementById('rsaEstadoSelect').value   = r.estado === 'pendiente' ? 'respondido' : r.estado;

  document.getElementById('btnEnviarRespuestaSA').onclick = enviarRespuestaSA;
  openModal('modalResponderReclamoSA');
}

function enviarRespuestaSA() {
  const respuesta = document.getElementById('rsaRespuestaInput').value.trim();
  const estado    = document.getElementById('rsaEstadoSelect').value;

  if (!respuesta) {
    showToast('Escribí una respuesta antes de enviar', 'warning');
    return;
  }

  updateReclamoSA(reclamoSAActivoId, {
    respuesta,
    estado,
    fechaRespuesta: new Date().toISOString().split('T')[0]
  });

  closeModal('modalResponderReclamoSA');
  showToast('Respuesta enviada correctamente', 'success');
  renderReclamosSA();
}

function cambiarEstadoReclamoSA(id, estado) {
  updateReclamoSA(id, { estado });
  actualizarBadgeReclamosSA();
  showToast('Estado actualizado', 'success');
  renderReclamosSA();
}

// ============================================================
// SECCIÓN: USUARIOS DESACTIVADOS (superadmin)
// ============================================================

function renderDesactivadosSA() {
  const container = document.getElementById('desactivadosSAList');
  if (!container) return;

  const desactivados = getUsuariosDesactivados();

  if (desactivados.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="user-check" style="width:24px;height:24px;"></i></div>
        <p class="empty-state-title">Sin usuarios desactivados</p>
        <p class="empty-state-text">Los admins e inquilinos dados de baja aparecerán aquí</p>
      </div>`;
    initIcons();
    return;
  }

  const rolBadge = { admin: 'badge--info', inquilino: 'badge--neutral', superadmin: 'badge--warning' };

  container.innerHTML = desactivados.map(u => `
    <div class="reclamo-card" style="display:flex;align-items:center;gap:var(--space-4);flex-wrap:wrap;">
      <div style="width:40px;height:40px;border-radius:50%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.875rem;flex-shrink:0;">
        ${getIniciales(u.nombre, '')}
      </div>
      <div style="flex:1;min-width:200px;">
        <div style="font-weight:600;">${u.nombre}</div>
        <div style="font-size:0.8125rem;color:var(--text-muted);">${u.email || ''}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">
          Desactivado: ${formatearFecha(u.fechaDesactivacion)}
          ${u.motivo ? ' · Motivo: ' + u.motivo : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;">
        <span class="badge ${rolBadge[u.rol] || 'badge--neutral'}">${u.rol}</span>
        <span class="badge badge--danger">Desactivado</span>
        <button class="btn btn--sm btn--secondary" onclick="restaurarUsuarioSA('${u.id}','${u.nombre}','${u.rol}')">
          <i data-lucide="rotate-ccw" style="width:13px;height:13px;"></i> Restaurar
        </button>
      </div>
    </div>
  `).join('');
  initIcons();
}

function restaurarUsuarioSA(usuarioId, nombre, rol) {
  if (!confirm(`¿Restaurar la cuenta de ${nombre}?`)) return;
  if (rol === 'admin') {
    restaurarAdminDesactivado(usuarioId);
  } else {
    restaurarInquilinoDesactivado(usuarioId);
  }
  renderDesactivadosSA();
  showToast(`${nombre} restaurado correctamente`, 'success');
}
